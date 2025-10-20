import os
import cv2
import numpy as np
import re
from difflib import get_close_matches
from data_loader import SPARKS_BY_COLOR, SPARK_CORRECTION_RULES # New import
import json
import logging # New import

# --- Load Configuration ---
with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'config.json'), 'r') as f:
    config = json.load(f)

SPARK_BOX_HEIGHT = config["SPARK_BOX_HEIGHT"]
YELLOW_STAR_HSV_LOWER = np.array(config["YELLOW_STAR_HSV_LOWER"])
YELLOW_STAR_HSV_UPPER = np.array(config["YELLOW_STAR_HSV_UPPER"])
STAR_AREA_MIN = config["STAR_AREA_MIN"]
STAR_AREA_MAX = config["STAR_AREA_MAX"]

logger = logging.getLogger(__name__)

# ---------------- Text Normalization ----------------
def normalize_text(s):
    s = re.sub(r"[^A-Za-z0-9\s]", "", s)
    return re.sub(r"\s+", " ", s.strip().lower())

def normalize_spark(name, components=None, color_hint=None):
    """
    Normalize spark names robustly, optionally using OCR word components for disambiguation.
    """
    name_norm = normalize_text(name)
    logger.debug(f"Normalizing spark: '{name}' (normalized: '{name_norm}') with color hint: {color_hint}")

    best_match, best_color, longest_len = None, None, 0

    candidate_colors = [color_hint] if color_hint else SPARKS_BY_COLOR.keys()

    # --- Contextual correction ---
    if components:
        joined = " ".join(c.lower() for c in components)
        for rule in SPARK_CORRECTION_RULES:
            if all(keyword.lower() in joined for keyword in rule["keywords"]):
                logger.debug(f"  -> Matched correction rule for '{rule['spark_name']}'")
                return rule["color"], rule["spark_name"]
        
    # --- Exact match ---
    for color in candidate_colors:
        for c in SPARKS_BY_COLOR[color]:
            if name_norm == normalize_text(c):
                logger.debug(f"  -> Found exact match: '{c}' (color: {color})")
                return color, c

    # --- Substring match ---
    for color in candidate_colors:
        for c in SPARKS_BY_COLOR[color]:
            c_norm = normalize_text(c)
            if c_norm in name_norm or name_norm in c_norm:
                if len(c_norm) > longest_len:
                    best_match, best_color, longest_len = c, color, len(c_norm)

    if best_match:
        logger.debug(f"  -> Found substring match: '{best_match}' (color: {best_color})")

    # --- Fuzzy match ---
    if not best_match or longest_len < max(3, len(name_norm)//2):
        for color in candidate_colors:
            candidates_map = {normalize_text(c): c for c in SPARKS_BY_COLOR[color]}
            cutoff = 0.7 if color == "green" else 0.75 if color == "white" else 0.55
            matches = get_close_matches(name_norm, candidates_map.keys(), n=1, cutoff=cutoff)
            if matches:
                best_match, best_color = candidates_map[matches[0]], color
                logger.debug(f"  -> Found fuzzy match: '{best_match}' (color: {best_color})")
                break

    # --- Final Validation --
    # If a pink spark was matched, it MUST have had the 'pink' hint.
    if best_color == "pink" and color_hint != "pink":
        logger.debug(f"  -> REJECTED pink match '{best_match}' because color_hint was not 'pink'.")
        return None, None

    logger.debug(f"  => Final Match: '{best_match}' (color: {best_color})")
    return best_color, best_match



# ---------------- Main Parsing ----------------
def _process_spark_roi(roi, reader, color_hint=None):
    """Helper to parse a single spark ROI, check confidence, and return results."""
    if roi.size == 0:
        return None, None, 0, 0

    text_results = reader.readtext(roi)
    if not text_results:
        return None, None, 0, 0

    all_text_parts = []
    total_confidence = 0
    y_pos = 0
    for i, (bbox, text, confidence) in enumerate(text_results):
        if i == 0: # Get y-pos from the first detected word
            y_pos = (bbox[0][1] + bbox[2][1]) / 2
        all_text_parts.append(text)
        if confidence < 0.7:
            logger.warning(f"  [SPARK WARNING] Low confidence ({confidence:.2f}) for text: '{text}'")
        total_confidence += confidence
    
    clean_text = " ".join(all_text_parts).strip()
    if not clean_text:
        return None, None, 0, 0

    avg_confidence = total_confidence / len(text_results)
    if avg_confidence < 0.5:
        logger.warning(f"  [SPARK WARNING] Avg confidence is very low ({avg_confidence:.2f}) for '{clean_text}'. Matching may be unreliable.")

    color, spark_name = normalize_spark(clean_text, all_text_parts, color_hint=color_hint)
    if not spark_name:
        return None, None, 0, 0

    stars = count_yellow_stars(roi)
    return color, spark_name, stars, y_pos

def parse_sparks(img, reader, debug_prefix=""):
    if img is None:
        logger.error("Image could not be loaded.")
        return {}

    try:
        h, w = img.shape[:2]
        col_w = w // 2
        left_col, right_col = img[:, :col_w], img[:, col_w:]

        sparks = {c: [] for c in ["blue", "pink", "green", "white"]}

        # ---- Process both columns ----
        for i, col_img in enumerate([left_col, right_col]):
            row_boxes = detect_boxes(col_img)

#            if debug_prefix:
#                debug_col_img = col_img.copy()
#               for y1_box, y2_box in row_boxes:
#                    cv2.rectangle(debug_col_img, (0, y1_box), (col_img.shape[1], y2_box), (0, 255, 0), 2)
#                cv2.imwrite(f"{debug_prefix}_col_{i}.png", debug_col_img)

            for j, (y1, y2) in enumerate(row_boxes):
                roi = col_img[y1:y2, :]
                
                hint = "pink" if i == 1 and j == 0 else None

                color, spark_name, stars, y_pos_rel = _process_spark_roi(roi, reader, color_hint=hint)

                if color and spark_name and stars > 0:
                    y_pos_abs = y1 + y_pos_rel
                    is_right_col = (i == 1)
                    sparks[color].append({"name": spark_name, "count": stars, "y_pos": y_pos_abs, "is_right_col": is_right_col})

        logger.debug(f"parse_sparks returning: {sparks}")
        return sparks
    except Exception as e:
        logger.error(f"Error in parse_sparks: {e}")
        return {}



# ---------------- Helper: Detect Boxes ----------------
def detect_boxes(column_img):
    h, w = column_img.shape[:2]
    gray = cv2.cvtColor(column_img, cv2.COLOR_BGR2GRAY)
    mid_x = w // 2

    y_start = next((y for y in range(h) if gray[y, mid_x] < 200), 0)

    # box_h = 88 # Removed, now using SPARK_BOX_HEIGHT
    boxes = []
    y = y_start

    while y + SPARK_BOX_HEIGHT <= h: # Used SPARK_BOX_HEIGHT
        boxes.append((y, y + SPARK_BOX_HEIGHT))
        y += SPARK_BOX_HEIGHT

    if h - y >= 40:  # only add if at least 40 pixels tall
        boxes.append((y, h))
    return boxes


# ---------------- Helper: Count Yellow Stars ----------------
def count_yellow_stars(roi):
    if roi.size == 0:
        return 0

    h, w = roi.shape[:2]
    roi_slice = roi[int(h*3/5):, 40:] #remove possibility of seeing gold character icon border with 40:
    hsv = cv2.cvtColor(roi_slice, cv2.COLOR_BGR2HSV)
    mask = cv2.inRange(hsv, YELLOW_STAR_HSV_LOWER, YELLOW_STAR_HSV_UPPER) # Used YELLOW_STAR_HSV_LOWER, YELLOW_STAR_HSV_UPPER
    kernel = np.ones((3,3), np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)

    num_labels, _, stats, _ = cv2.connectedComponentsWithStats(mask)

    # Print all component areas
    for i in range(1, num_labels):  # skip 0 (background)
        area = stats[i, cv2.CC_STAT_AREA]

    # Count stars based on area
    stars = sum(1 for i in range(1, num_labels) if STAR_AREA_MIN < stats[i, cv2.CC_STAT_AREA] < STAR_AREA_MAX) # Used STAR_AREA_MIN, STAR_AREA_MAX

    return min(stars, 3)