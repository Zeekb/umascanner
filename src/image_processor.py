import os
import cv2
import numpy as np
import easyocr
import pandas as pd
import hashlib
import shutil
from PIL import Image
from tkinter import Tk
from multiprocessing import Pool, cpu_count
import logging
from typing import Optional
import json

from schema import init_schema, CharacterData, Stats, Rankings, Sparks
from main_parser import parse_umamusume
from spark_parser import parse_sparks
from sparks_handler import get_entries, combine_images_horizontally, ROISelector
from tabs import detect_active_tab
from post_processing import update_and_join_tables

# --- Path Configuration ---
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_FOLDER = os.path.join(BASE_DIR, "data")
INPUT_FOLDER = os.path.join(DATA_FOLDER, "input_images")
COMPLETED_FOLDER = os.path.join(DATA_FOLDER, "processed_images")
OUTPUT_FOLDER = os.path.join(BASE_DIR, "runner_tables", "all_tables")
LOG_FILE = os.path.join(BASE_DIR, "app.log")

# --- Load Configuration ---
with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'config.json'), 'r') as f:
    config = json.load(f)

OCR_READER_CONFIG = config["OCR_READER_CONFIG"]
DEFAULT_NUM_PROCESSES_OFFSET = config["DEFAULT_NUM_PROCESSES_OFFSET"]
LOG_LEVEL = config["LOG_LEVEL"]
LOG_FORMAT = config["LOG_FORMAT"]

logger = logging.getLogger(__name__)

def process_folder(folder_name, all_rois) -> Optional[tuple[str, CharacterData]]:
    """
    This function processes a single character folder. It's designed to be
    run in a separate process by the multiprocessing Pool.
    """
    # Each process must have its own OCR reader instance
    reader = easyocr.Reader(OCR_READER_CONFIG["languages"], gpu=OCR_READER_CONFIG["gpu"])
    logger.info(f"Processing folder: {folder_name}...")

    folder_path = os.path.join(INPUT_FOLDER, folder_name)
    if not os.path.isdir(folder_path):
        return None

    character_data = init_schema()

    image_paths = sorted([
        os.path.join(folder_path, f)
        for f in os.listdir(folder_path)
        if f.lower().endswith((".png", ".jpg", ".jpeg"))
    ])

    # --- Parser 1: Umamusume stats ---
    for img_path in image_paths:
        try:
            result = parse_umamusume(img_path, reader)
            if not result:
                continue

            # Merge results into character_data
            if result.name and not character_data.name:
                character_data.name = result.name
            if result.score and not character_data.score:
                character_data.score = result.score

            for stat, value in result.stats.__dict__.items():
                setattr(character_data.stats, stat, max(getattr(character_data.stats, stat), value))

            for category, sub in result.rankings.__dict__.items():
                for key_, val in sub.items():
                    if val:
                        character_data.rankings.__dict__.setdefault(category, {})[key_] = val

            for skill in result.skills:
                if skill not in character_data.skills:
                    character_data.skills.append(skill)

        except Exception as e:
            logger.error(f"[ERROR] Parser 1 failed on {img_path}: {e}")

    # --- Parser 2: Sparks ---
    rois_list = all_rois.get(folder_name, [])
    if not rois_list:
        return folder_name, character_data

    spark_image_paths = [p for p in image_paths if detect_active_tab(p) == "inspiration"]

    if not spark_image_paths:
        return folder_name, character_data

    combined_img = combine_images_horizontally(spark_image_paths)

    rep_filled = False
    for roi_idx, roi_data in enumerate(rois_list):
        _, roi_box, _ = roi_data
        roi_crop = combined_img.crop(roi_box)
        roi_cv_crop = cv2.cvtColor(np.array(roi_crop), cv2.COLOR_RGB2BGR)

        try:
            sparks_result = parse_sparks(roi_cv_crop, reader)
            logger.debug(f"sparks_result from parse_sparks: {sparks_result}")
            target = "representative" if not rep_filled else "legacy"

            for color, sparks_dict in sparks_result.items():
                for spark, count in sparks_dict.items():
                    character_data.sparks.__dict__[target][color][spark] = \
                        character_data.sparks.__dict__[target][color].get(spark, 0) + count
            
            if not rep_filled:
                rep_filled = True

        except Exception as e:
            logger.error(f"[ERROR] Parser 2 failed on ROI for {folder_name}: {e}")

    return folder_name, character_data

def _run_parallel_parsing(roi_app):
    logger = logging.getLogger(__name__)
    logger.info("\n=== Step 2: Parsing all folders in parallel ===")
    folder_names = sorted([d for d in os.listdir(INPUT_FOLDER) if os.path.isdir(os.path.join(INPUT_FOLDER, d))])
    pool_args = [(name, roi_app.all_rois) for name in folder_names]

    final_results = {}
    num_processes = max(1, cpu_count() - DEFAULT_NUM_PROCESSES_OFFSET)
    with Pool(processes=num_processes) as pool:
        results = pool.starmap(process_folder, pool_args)
    
    for res in results:
        if res:
            folder_name, schema = res
            final_results[folder_name] = schema
    logger.info("All folders parsed.")
    return final_results, folder_names

def _move_processed_folders(folder_names):
    logger = logging.getLogger(__name__)
    logger.info(f"\n=== Step 3: Moving processed images to {COMPLETED_FOLDER} ===")
    os.makedirs(COMPLETED_FOLDER, exist_ok=True)
    for folder_name in folder_names:
        folder_path = os.path.join(INPUT_FOLDER, folder_name)
        dest_path = os.path.join(COMPLETED_FOLDER, folder_name)
        if os.path.exists(dest_path):
            shutil.rmtree(dest_path) # Overwrite existing completed folders
        shutil.move(folder_path, dest_path)
        logger.info(f"Moved {folder_name} to {COMPLETED_FOLDER}")

def _save_results_to_csvs(final_results):
    logger = logging.getLogger(__name__)
    logger.info("\n=== Step 4: Saving individual results to CSV files ===")
    entries_rows, stats_rows, rankings_rows, skills_rows, sparks_rows = [], [], [], [], []

    for folder_name, character_data in final_results.items():
        if not character_data.name:
            continue
        
        entry_hash = hashlib.md5(f"{folder_name}_{character_data.name}".encode("utf-8")).hexdigest()
        entry_id = str(len(entries_rows)) # Generate a unique entry_id for this batch, starting from 0
        entries_rows.append({"entry_id": entry_id, "name": character_data.name, "score": character_data.score, "entry_hash": entry_hash})

        for stat_name, value in character_data.stats.__dict__.items():
            stats_rows.append({"entry_id": entry_id, "name": character_data.name, "stat_name": stat_name, "value": value})

        for category, sub in character_data.rankings.__dict__.items():
            for subcat, grade in sub.items():
                rankings_rows.append({"entry_id": entry_id, "name": character_data.name, "category": category, "subcategory": subcat, "grade": grade})

        for skill in character_data.skills:
            skills_rows.append({"entry_id": entry_id, "name": character_data.name, "skill_name": skill})

        for spark_type in ["representative", "legacy"]:
            for color, sparks in character_data.sparks.__dict__[spark_type].items():
                for spark_name, count in sparks.items():
                    sparks_rows.append({"entry_id": entry_id, "name": character_data.name, "type": spark_type, "color": color, "spark_name": spark_name, "count": count})

    os.makedirs(OUTPUT_FOLDER, exist_ok=True)
    pd.DataFrame(entries_rows).to_csv(os.path.join(OUTPUT_FOLDER, "entries.csv"), index=False)
    pd.DataFrame(stats_rows).to_csv(os.path.join(OUTPUT_FOLDER, "stats.csv"), index=False)
    pd.DataFrame(rankings_rows).to_csv(os.path.join(OUTPUT_FOLDER, "rankings.csv"), index=False)
    pd.DataFrame(skills_rows).to_csv(os.path.join(OUTPUT_FOLDER, "skills.csv"), index=False)
    pd.DataFrame(sparks_rows).to_csv(os.path.join(OUTPUT_FOLDER, "sparks.csv"), index=False)
    logger.info("Saved results to 5 CSV files.")

def _join_all_tables():
    logger = logging.getLogger(__name__)
    logger.info("\n=== Step 5: Joining all tables into a single CSV ===")
    update_and_join_tables()

def _run_roi_selection():
    logger = logging.getLogger(__name__)
    logger.info("=== Step 1: Launching ROI Selector GUI ===")
    entries = get_entries(INPUT_FOLDER)
    if not entries:
        logger.error(f"No subfolders with images found in {INPUT_FOLDER}. Did you run folder_creator.py?")
        raise FileNotFoundError(f"No subfolders with images found in {INPUT_FOLDER}. Did you run folder_creator.py?")

    root = Tk()
    root.state('zoomed')
    roi_app = ROISelector(root, entries)
    root.mainloop()  # Wait for user to select all ROIs
    logger.info("ROI selection complete.")
    return roi_app

def main():
    # Configure logging
    logging.basicConfig(level=getattr(logging, LOG_LEVEL),
                        format=LOG_FORMAT,
                        handlers=[
                            logging.FileHandler(LOG_FILE),
                            logging.StreamHandler() # Also log to console
                        ])
    logger = logging.getLogger(__name__) # Get a logger for this module

    roi_app = _run_roi_selection()

    final_results, folder_names = _run_parallel_parsing(roi_app)

    _move_processed_folders(folder_names)

    _save_results_to_csvs(final_results)

    _join_all_tables()

if __name__ == "__main__":
    main()
