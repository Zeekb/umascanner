import cv2
import numpy as np
import sys
from skimage.metrics import structural_similarity
import easyocr
import json
import os
from difflib import get_close_matches
import re
import logging

# --- Load Configuration ---
if getattr(sys, 'frozen', False):
    BUNDLED_ROOT = sys._MEIPASS
    CONFIG_PATH = os.path.join(BUNDLED_ROOT, 'src', 'config.json')
else:
    CONFIG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'config.json')

with open(CONFIG_PATH, 'r') as f:
    config = json.load(f)
    
SPARK_ROI_CONFIG = config["SPARK_ROI_DETECTION"]
SPARK_BOX_HEIGHT = config["SPARK_BOX_HEIGHT"] # New config load


def load_spark_info():
    if getattr(sys, 'frozen', False):
        BUNDLED_ROOT = sys._MEIPASS
        data_folder_path = os.path.join(BUNDLED_ROOT, "data", "game_data")
    else:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        data_folder_path = os.path.join(script_dir, "..", "data", "game_data")

    sparks_path = os.path.join(data_folder_path, "sparks.json")
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


# ---------------- Helper: Detect Boxes (from spark_parser.py) ----------------
def _detect_boxes(column_img):
    """Detects horizontal boxes in a spark column image."""
    h, w = column_img.shape[:2]
    if h == 0 or w == 0:
        return []
    
    gray = cv2.cvtColor(column_img, cv2.COLOR_BGR2GRAY)
    mid_x = w // 2

    # Find first non-white-ish pixel starting from the top
    y_start = next((y for y in range(h) if gray[y, mid_x] < 200), 0)

    boxes = []
    y = y_start

    while y + SPARK_BOX_HEIGHT <= h:
        boxes.append((y, y + SPARK_BOX_HEIGHT))
        y += SPARK_BOX_HEIGHT

    if h - y >= 40:  # only add if at least 40 pixels tall
        boxes.append((y, h))
    return boxes


# ---------------- Helper: Get Average OCR Confidence ----------------
def _get_avg_confidence(roi, reader):
    """Runs OCR on an ROI and returns the average confidence score."""
    if roi.size == 0:
        return 0.0
    try:
        text_results = reader.readtext(roi) 
        if not text_results:
            return 0.0 # No text found, 0 confidence
        
        total_confidence = sum(confidence for _, _, confidence in text_results)
        return total_confidence / len(text_results)
    except Exception:
        return 0.0 # Error during OCR


def detect_spark_zones(image, reader, debug_image_path=None):
    """Detect spark zones based on blue spark keywords and other heuristics."""

    h, w, _ = image.shape
    debug_image = image.copy()
    logger = logging.getLogger(__name__)

    # Use a fixed ratio of the height to determine the starting point.
    start_y = int(h * 0.48)

    # Perform OCR on the entire image once.
    ocr_results = reader.readtext(image, detail='word')

    # Filter OCR results to only include items below the starting threshold.
    filtered_ocr_results = [res for res in ocr_results if res[0][0][1] > start_y]

    if debug_image_path:
        cv2.line(debug_image, (0, start_y), (w, start_y), (255, 0, 0), 3) # Draw crop line
        for (bbox, text, _) in filtered_ocr_results: # Draw only filtered results
            tl, _, br, _ = bbox
            tl = (int(tl[0]), int(tl[1]))
            br = (int(br[0]), int(br[1]))
            cv2.rectangle(debug_image, tl, br, (0, 255, 0), 2)
            cv2.putText(debug_image, text, (tl[0], tl[1] - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 2)
        #cv2.imwrite(debug_image_path, debug_image)

    single_screenshot_width = get_screenshot_width(w)
    potential_zones = []
    blue_spark_detections = []

    IGNORE_KEYWORDS = ["sparks", "legacy origin", "rank", "3", "4", "3.", "4."]

    for keyword in BLUE_SPARK_KEYWORDS:
        for (bbox, text, _) in filtered_ocr_results:
            if text.lower() in IGNORE_KEYWORDS:
                continue

            tl, _, br, _ = bbox
            x1_text, y1_text = int(tl[0]), int(tl[1])
            
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
        offset_from_screenshot_left_edge = SPARK_ROI_CONFIG["OFFSET_FROM_SCREENSHOT_LEFT_EDGE"]
        fixed_spark_area_width = SPARK_ROI_CONFIG["FIXED_SPARK_AREA_WIDTH"]

        zone_x1 = screenshot_index * single_screenshot_width + offset_from_screenshot_left_edge
        zone_x2 = zone_x1 + fixed_spark_area_width
        
        zone_y1 = y1_text + SPARK_ROI_CONFIG["ZONE_Y1_OFFSET"]

        # Determine zone_y2 dynamically
        zone_y2 = h + SPARK_ROI_CONFIG["ZONE_Y2_FALLBACK"]

        # Find the next blue spark in the same screenshot column
        for next_spark in blue_spark_detections[i+1:]:
            if next_spark['screenshot_index'] == screenshot_index:
                # The bottom of the current zone is the top of the next zone's title
                zone_y2 = next_spark['y1_text'] + SPARK_ROI_CONFIG["ZONE_Y2_NEXT_SPARK_OFFSET"]
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
        
        surviving_zones_with_dist = []

        if remaining_zones:
            for zone in remaining_zones:
                x1, y1, x2, y2 = [int(v) for v in zone]
                
                # Crop the zone from the original image
                zone_crop = image[y1:y2, x1:x2]
                zone_h, zone_w, _ = zone_crop.shape

                if zone_h == 0 or zone_w == 0:
                    continue

                # Split zone into columns
                col_w = zone_w // 2
                left_col = zone_crop[:, :col_w]
                right_col = zone_crop[:, col_w:]

                # Find boxes in each column
                left_boxes = _detect_boxes(left_col)
                right_boxes = _detect_boxes(right_col)

                blue_conf = 0.0
                pink_conf = 0.0

                # Check confidence of "blue" spark area (left col, 1st box)
                if left_boxes:
                    y1_b, y2_b = left_boxes[0]
                    blue_roi = left_col[y1_b:y2_b, :]
                    blue_conf = _get_avg_confidence(blue_roi, reader)

                # Check confidence of "pink" spark area (right col, 1st box)
                # Note: This logic assumes pink is *always* 1st in right col,
                # which matches the parser's 'hint' logic.
                if right_boxes:
                    y1_p, y2_p = right_boxes[0]
                    pink_roi = right_col[y1_p:y2_p, :]
                    pink_conf = _get_avg_confidence(pink_roi, reader)

                logger.debug(f"Zone {zone} confs: Blue={blue_conf:.2f}, Pink={pink_conf:.2f}")

                # Filter: Disregard if either blue or pink conf is < 0.3
                if blue_conf < 0.3 or pink_conf < 0.3:
                    logger.debug(f"  -> REJECTED zone {zone} due to low confidence.")
                    continue
                
                # If it survives, calculate its distance to center
                center_x = (x1 + x2) / 2
                center_y = (y1 + y2) / 2
                dist_sq = (center_x - image_center_x)**2 + (center_y - image_center_y)**2
                surviving_zones_with_dist.append((dist_sq, zone))

            # Sort surviving zones by distance to image center
            if surviving_zones_with_dist:
                surviving_zones_with_dist.sort(key=lambda x: x[0])
                middle_zone_to_add = surviving_zones_with_dist[0][1]


        if middle_zone_to_add and middle_zone_to_add not in final_selected_zones:
            final_selected_zones.append(middle_zone_to_add)

    # Sort the final selected zones for consistent output (e.g., left to right, top to bottom)
    final_selected_zones.sort(key=lambda z: (z[0], z[1]))

#    if debug_image_path:
#        # Draw the final zones on the debug image
#        zone_debug_image = image.copy() # Use a fresh copy of the original image
#        for (x1, y1, x2, y2) in final_selected_zones:
#            cv2.rectangle(zone_debug_image, (x1, y1), (x2, y2), (0, 0, 255), 3) # Red rectangle for final zones
        
#        dir_name = os.path.dirname(debug_image_path)
#        base_name = os.path.basename(debug_image_path)
#        name, ext = os.path.splitext(base_name)
#        new_debug_path = os.path.join(dir_name, f"{name}_zones{ext}")
#        cv2.imwrite(new_debug_path, zone_debug_image)

    return final_selected_zones[:3]