import os
import re
import cv2
import time
import glob
import easyocr
import json
from schema import init_schema, CharacterData, Stats, Rankings, Sparks # New imports
from ocr_utils import normalize_name, normalize_skills
from rankings import parse_rankings_by_color
from tabs import detect_active_tab
from image_utils import select_layout, crop_rois, load_image # New import
import logging # New import
from typing import Optional # New import

# --- Path Configuration ---
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOG_FILE = os.path.join(BASE_DIR, "app.log")

# --- Load Configuration ---
with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'config.json'), 'r') as f:
    config = json.load(f)

ROI_MOBILE = config["ROI_MOBILE"]
SAVE_DEBUG_IMAGES = config["SAVE_DEBUG_IMAGES"]
MIN_OCR_WIDTH = config["MIN_OCR_WIDTH"]
STAT_KEYS = config["STAT_KEYS"]
LOG_LEVEL = config["LOG_LEVEL"]
LOG_FORMAT = config["LOG_FORMAT"]

logger = logging.getLogger(__name__)

# ------------------- Main Parsing Function -------------------
def parse_umamusume(image_path, reader) -> Optional[CharacterData]:
    t0 = time.perf_counter()
    
    img = load_image(image_path)
    t1 = time.perf_counter()
    if img is None:
        logger.error(f"Could not read {image_path}") # Replaced raise ValueError
        return None # Return None instead of raising error to allow other images to be processed
    
    active_tab = detect_active_tab(image_path)
    t2 = time.perf_counter()
    
    if active_tab == "inspiration":
        return None

    layout = select_layout(img)
    rois, _ = crop_rois(img, layout)
    t3 = time.perf_counter()

    character_data = init_schema()

    # ---------- OCR: Name, Score, Stats ----------
    roi_names = ["name", "score"] + STAT_KEYS # Used STAT_KEYS
    ocr_rois = [rois[k] for k in roi_names]

    stacked_text = []
    for roi, roi_name in zip(ocr_rois, roi_names):
        text_results = reader.readtext(roi)
        if not text_results:
            stacked_text.append("")
            continue
        
        full_text_parts = []
        for (bbox, text, confidence) in text_results:
            full_text_parts.append(text)
            if confidence < 0.7:
                logger.warning(f"  [STATS WARNING] Low confidence ({confidence:.2f}) for text: '{text}' in ROI: '{roi_name}'")
        
        full_text = " ".join(full_text_parts)
        stacked_text.append(full_text)

        if SAVE_DEBUG_IMAGES:
            cv2.imwrite(f"debug_{os.path.basename(image_path).split('.')[0]}_{full_text}.png", roi)

    # Extract name, score, stats
    name = stacked_text[0] if stacked_text else ""
    score = int(re.sub(r"\D", "", stacked_text[1]) if len(stacked_text) > 1 else "0")
    stats_dict = {}
    for i, k in enumerate(STAT_KEYS): # Used STAT_KEYS
        stats_dict[k] = int(re.sub(r"\D", "", stacked_text[i+2]) or 0) if len(stacked_text) > i+2 else 0

    character_data.name = normalize_name(name)
    character_data.score = score
    if any(stats_dict.values()):
        character_data.stats = Stats(**stats_dict)

    # ---------- OCR: Rankings ----------
    if "rankings" in rois:
        rankings_data = parse_rankings_by_color(rois["rankings"])
        character_data.rankings = Rankings(**rankings_data)

    # ---------- OCR: Skills ----------
    if active_tab == "skills" and "skills" in rois:
        skills_roi = rois["skills"]
        h, w = skills_roi.shape[:2]
        
        left_half = skills_roi[:, :w//2][:, :-94]
        right_half = skills_roi[:, w//2:][:, 74:]

        min_width = min(left_half.shape[1], right_half.shape[1])
        stacked_skills = cv2.vconcat([left_half[:, :min_width], right_half[:, :min_width]])

        scale_factor = max(MIN_OCR_WIDTH / stacked_skills.shape[1], 1)
        if scale_factor > 1:
            new_w = int(stacked_skills.shape[1] / scale_factor)
            new_h = int(stacked_skills.shape[0] / scale_factor)
            stacked_skills = cv2.resize(stacked_skills, (new_w, new_h), interpolation=cv2.INTER_AREA)

        gray = cv2.cvtColor(stacked_skills, cv2.COLOR_BGR2GRAY)
        _, bw = cv2.threshold(gray, 150, 255, cv2.THRESH_BINARY)
        
        # Get detailed results for confidence checking
        detailed_results = reader.readtext(bw)
        for (bbox, text, confidence) in detailed_results:
            if confidence < 0.6:
                logger.warning(f"  [SKILL WARNING] Low confidence ({confidence:.2f}) for word: '{text}'")

        # Get paragraph results for easier normalization
        skills_text_list = reader.readtext(bw, detail=0, paragraph=True)
        character_data.skills = normalize_skills(skills_text_list)
    
    return character_data