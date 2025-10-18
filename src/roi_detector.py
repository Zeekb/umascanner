import cv2
import numpy as np
from skimage.metrics import structural_similarity
import easyocr
import json
import os
from difflib import get_close_matches # New import

def load_spark_info():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    sparks_path = os.path.join(script_dir, "..", "data", "game_data", "sparks.json")
    with open(sparks_path, 'r') as f:
        return json.load(f)

spark_info = load_spark_info()
BLUE_SPARK_KEYWORDS = spark_info['blue']

def get_screenshot_width(image_width):
    # Assuming a fixed width for a single screenshot based on observations
    return 540 # Approximate width of a single screenshot

def are_rois_similar(roi1, roi2, threshold=0.9):
    """Compare two ROIs using Structural Similarity Index (SSIM)."""
    if roi1.shape != roi2.shape:
        # Resize the smaller image to match the larger one for comparison
        h1, w1 = roi1.shape[:2]
        h2, w2 = roi2.shape[:2]
        if h1 * w1 < h2 * w2:
            roi1 = cv2.resize(roi1, (w2, h2))
        else:
            roi2 = cv2.resize(roi2, (w1, h1))

    gray1 = cv2.cvtColor(roi1, cv2.COLOR_BGR2GRAY)
    gray2 = cv2.cvtColor(roi2, cv2.COLOR_BGR2GRAY)
    score, _ = structural_similarity(gray1, gray2, full=True)
    return score > threshold

def detect_spark_zones(image, reader):
    """Detect spark zones based on blue spark keywords and other heuristics."""
    h, w, _ = image.shape
    
    single_screenshot_width = get_screenshot_width(w)

    ocr_results = reader.readtext(image, detail='word')
    
    potential_zones = []
    min_y_threshold = h * (1/2) # Start searching from 1/2 of the image height

    # Store detected blue spark keywords with their coordinates for dynamic height calculation
    blue_spark_detections = []
    for keyword in BLUE_SPARK_KEYWORDS:
        for (bbox, text, _) in ocr_results:
            tl, _, br, _ = bbox
            x1_text, y1_text = int(tl[0]), int(tl[1])
            x2_text, y2_text = int(br[0]), int(br[1])
            y_center_text = (y1_text + y2_text) / 2
            
            if y_center_text < min_y_threshold: # Skip if the text is in the top 1/2
                continue

            matches = get_close_matches(keyword.lower(), [text.lower()], n=1, cutoff=0.8)
            if matches:
                blue_spark_detections.append({
                    'keyword': keyword,
                    'bbox': bbox,
                    'x1_text': x1_text,
                    'y1_text': y1_text,
                    'screenshot_index': x1_text // single_screenshot_width
                })
    
    # Sort detections by y-coordinate to easily find the "next" blue spark
    blue_spark_detections.sort(key=lambda d: d['y1_text'])

    for i, current_spark in enumerate(blue_spark_detections):
        screenshot_index = current_spark['screenshot_index']
        x1_text = current_spark['x1_text']
        y1_text = current_spark['y1_text']

        # Fixed offset from the left edge of a single screenshot
        offset_from_screenshot_left_edge = 205 
        fixed_spark_area_width = 827

        zone_x1 = screenshot_index * single_screenshot_width + offset_from_screenshot_left_edge
        zone_x2 = zone_x1 + fixed_spark_area_width
        
        zone_y1 = y1_text - 20 # Adjusted to not include area above blue spark term

        # Determine zone_y2 dynamically
        zone_y2 = h - 420 # Adjusted to extend further down

        # Find the next blue spark in the same screenshot column
        for next_spark in blue_spark_detections[i+1:]:
            if next_spark['screenshot_index'] == screenshot_index:
                # The bottom of the current zone is the top of the next zone's title
                zone_y2 = next_spark['y1_text'] - 77
                break
        
        potential_zones.append((zone_x1, zone_y1, zone_x2, zone_y2))

    # Deduplicate zones using IoU
    deduplicated_zones = []
    for zone in potential_zones:
        is_duplicate = False
        for existing_zone in deduplicated_zones:
            # Calculate intersection over union (IoU)
            x_overlap = max(0, min(zone[2], existing_zone[2]) - max(zone[0], existing_zone[0]))
            y_overlap = max(0, min(zone[3], existing_zone[3]) - max(zone[1], existing_zone[1]))
            
            intersection_area = x_overlap * y_overlap
            
            zone_area = (zone[2] - zone[0]) * (zone[3] - zone[1])
            existing_zone_area = (existing_zone[2] - existing_zone[0]) * (existing_zone[3] - existing_zone[1])
            
            union_area = float(zone_area + existing_zone_area - intersection_area)
            
            if union_area > 0 and (intersection_area / union_area) > 0.5: # If IoU > 0.5, consider it a duplicate
                is_duplicate = True
                break
        if not is_duplicate:
            deduplicated_zones.append(zone)

    # --- New Selection Logic ---
    final_selected_zones = []

    # Sort by x1 ascending, then y1 ascending for consistent selection
    deduplicated_zones.sort(key=lambda z: (z[0], z[1]))

    top_leftmost_zone = None
    bottom_rightmost_zone = None
    
    if len(deduplicated_zones) > 0:
        top_leftmost_zone = deduplicated_zones[0]
        final_selected_zones.append(top_leftmost_zone)

    if len(deduplicated_zones) > 0:
        # Find bottom-rightmost zone (largest x, then largest y)
        deduplicated_zones.sort(key=lambda z: (z[0], z[1]), reverse=True) # Sort by x1 descending, then y1 descending
        bottom_rightmost_zone = deduplicated_zones[0]
        if bottom_rightmost_zone not in final_selected_zones:
            final_selected_zones.append(bottom_rightmost_zone)

    # Middle zone logic
    if len(final_selected_zones) < 3:
        middle_zone_to_add = None
        remaining_zones = [z for z in deduplicated_zones if z not in final_selected_zones]

        # Calculate image center for distance sorting
        image_center_x = w / 2
        image_center_y = h / 2

        if remaining_zones:
            # Sort remaining zones by distance to image center
            remaining_zones.sort(key=lambda z: (
                (z[0] + z[2]) / 2 - image_center_x)**2 + 
                ((z[1] + z[3]) / 2 - image_center_y)**2
            )
            middle_zone_to_add = remaining_zones[0]

        if middle_zone_to_add and middle_zone_to_add not in final_selected_zones:
            final_selected_zones.append(middle_zone_to_add)

    # Sort the final selected zones for consistent output (e.g., left to right, top to bottom)
    final_selected_zones.sort(key=lambda z: (z[0], z[1]))

    return final_selected_zones[:3]