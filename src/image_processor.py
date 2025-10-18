import os
import cv2
import numpy as np
import easyocr
import pandas as pd
import hashlib
import shutil
from PIL import Image
from tkinter import Tk
import queue
import threading
import logging
import re
from typing import Optional
import json
from multiprocessing import cpu_count
from datetime import datetime
import sys
import subprocess

from schema import init_schema, CharacterData
from main_parser import parse_umamusume
from spark_parser import parse_sparks
from sparks_handler import get_entries, combine_images_horizontally, ROISelector
from tabs import detect_active_tab
from post_processing import update_all_runners
from ocr_utils import normalize_name
from image_utils import select_layout, crop_rois, load_image

# --- Path Configuration ---
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_FOLDER = os.path.join(BASE_DIR, "data")
INPUT_FOLDER = os.path.join(DATA_FOLDER, "input_images")
COMPLETED_FOLDER = os.path.join(DATA_FOLDER, "processed_images")
OUTPUT_FOLDER = os.path.join(BASE_DIR, "data", "all_tables")
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
    This function processes a single character folder.
    """
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

def processing_worker(q, final_results, lock):
    """Worker thread that gets an entry from the queue and processes it."""
    while True:
        try:
            folder_name, rois = q.get()
            if folder_name is None: # Sentinel to stop the worker
                break
            
            single_folder_rois = {folder_name: rois}
            _, character_data = process_folder(folder_name, single_folder_rois)
            
            if character_data:
                with lock:
                    final_results[folder_name] = character_data
        finally:
            q.task_done()

def _move_processed_folders(folder_names):
    logger.info(f"\n=== Step 3: Moving processed images to {COMPLETED_FOLDER} ===")
    os.makedirs(COMPLETED_FOLDER, exist_ok=True)
    for folder_name in folder_names:
        source_path = os.path.join(INPUT_FOLDER, folder_name)
        if not os.path.isdir(source_path):
            continue
        dest_path = os.path.join(COMPLETED_FOLDER, folder_name)
        if os.path.exists(dest_path):
            shutil.rmtree(dest_path)
        shutil.move(source_path, dest_path)
        logger.info(f"Moved {folder_name} to {COMPLETED_FOLDER}")


def _create_new_runners_dataframe(final_results):
    logger.info("\n=== Step 4: Creating new runners DataFrame ===")
    if not final_results:
        logger.info("No new results to process.")
        return pd.DataFrame()

    all_runners_output_file = os.path.join(BASE_DIR, "data", "all_runners.csv")
    try:
        existing_all_runners_df = pd.read_csv(all_runners_output_file, dtype={'entry_id': str, 'entry_hash': str})
    except FileNotFoundError:
        existing_all_runners_df = pd.DataFrame(columns=['entry_id', 'entry_hash'])

    entry_hash_to_id = pd.Series(existing_all_runners_df.entry_id.values, index=existing_all_runners_df.entry_hash).to_dict()
    numeric_ids = pd.to_numeric(existing_all_runners_df['entry_id'], errors='coerce').dropna()
    next_entry_id = int(numeric_ids.max()) + 1 if not numeric_ids.empty else 1

    new_runners_rows = []

    for folder_name, character_data in final_results.items():
        if not character_data.name:
            continue
        
        current_entry_hash = hashlib.md5(f"{folder_name}_{character_data.name}".encode("utf-8")).hexdigest()
        entry_id = entry_hash_to_id.get(current_entry_hash, str(next_entry_id))
        if entry_id == str(next_entry_id):
            next_entry_id += 1
        
        row = {
            "entry_id": entry_id,
            "name": character_data.name,
            "score": character_data.score,
            "entry_hash": current_entry_hash,
            "folder_name": folder_name,
            "last_updated": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }

        for stat_name, value in character_data.stats.__dict__.items():
            row[stat_name] = value

        for category, sub in character_data.rankings.__dict__.items():
            for subcat, grade in sub.items():
                row[f"rank_{subcat}"] = grade
        
        row["skills"] = "|".join(character_data.skills)

        sparks_list = []
        for spark_type in ["representative", "legacy"]:
            for color, sparks in character_data.sparks.__dict__[spark_type].items():
                for spark_name, count in sparks.items():
                    sparks_list.append({"type": spark_type, "color": color, "spark_name": spark_name, "count": count})
        row["sparks"] = json.dumps(sparks_list)

        new_runners_rows.append(row)

    return pd.DataFrame(new_runners_rows)

def _group_loose_images():
    logger.info("\n=== Step 0: Organizing loose images ===")
    # ---------------- Configuration ----------------
    reader = easyocr.Reader(OCR_READER_CONFIG["languages"], gpu=OCR_READER_CONFIG["gpu"]) # Updated initialization
    stat_keys = config["STAT_KEYS"] # Use global config

    # ---------------- Scan base folder for images ----------------
    all_images = [
        os.path.join(INPUT_FOLDER, entry.name)
        for entry in os.scandir(INPUT_FOLDER)
        if entry.is_file() and entry.name.lower().endswith((".png", ".jpg", ".jpeg"))
    ]

    if not all_images:
        logger.info("No loose images found in input_images. Skipping folder organization.")
        return False

    grouped_images = {}          # key: (base_folder_name, stats_hash), value: list of images
    folder_name_counters = {}    # key: base_folder_name, value: next folder index

    for img_path in all_images:
        try:
            img = load_image(img_path)
            if img is None:
                continue

            layout = select_layout(img)
            rois, _ = crop_rois(img, layout)

            # OCR name, score, and stats
            ocr_rois = [rois["name"], rois["score"]] + [rois[k] for k in stat_keys]
            stacked_text = []
            for roi in ocr_rois:
                text = reader.readtext(roi, detail=0, paragraph=False)
                stacked_text.append(" ".join(text))

            # Extract name and score
            name = normalize_name(stacked_text[0]).strip().replace(" ", "_") if len(stacked_text) > 0 else None
            
            # Ensure score_text is a string before applying regex
            score_text = str(stacked_text[1]) if len(stacked_text) > 1 else ""
            
            # Remove all non-digit characters, including potential unicode dots or other symbols
            score = re.sub(r"[^0-9]", "", score_text)
            
            if not name or not score:
                logger.warning(f"Could not extract name or score from {img_path}. Skipping.")
                continue

            # Extract stats
            stats = {}
            for i, k in enumerate(stat_keys):
                val = re.sub(r"\D", "", stacked_text[i+2]) if len(stacked_text) > i+2 else "0"
                stats[k] = int(val) if val else 0

            # Compute stats hash
            stats_str = "_".join(f"{k}:{v}" for k, v in sorted(stats.items()))
            stats_hash = hashlib.md5(stats_str.encode("utf-8")).hexdigest()

            base_folder_name = f"{name}{score}"
            folder_key = (base_folder_name, stats_hash)

            # Add image to grouped dict
            if folder_key not in grouped_images:
                grouped_images[folder_key] = []
            grouped_images[folder_key].append(img_path)

        except Exception as e:
            logger.error(f"Failed to parse {img_path}: {e}")

    # ---------------- Create folders and move images ----------------
    for (base_folder_name, stats_hash), img_list in grouped_images.items():
        # Determine folder name (_2, _3 for duplicate base names)
        count = folder_name_counters.get(base_folder_name, 1)
        folder_name = base_folder_name if count == 1 else f"{base_folder_name}_{count}"
        folder_name_counters[base_folder_name] = count + 1

        folder_path = os.path.join(INPUT_FOLDER, folder_name)
        os.makedirs(folder_path, exist_ok=True)

        for img_path in img_list:
            dest_path = os.path.join(folder_path, os.path.basename(img_path))
            counter = 1
            base_name_file, ext = os.path.splitext(os.path.basename(img_path))
            while os.path.exists(dest_path):
                dest_path = os.path.join(folder_path, f"{base_name_file}_{counter}{ext}")
                counter += 1
            shutil.move(img_path, dest_path)

    logger.info("Images grouped into folders by Name + Score + Stats.")
    return True


def _run_roi_selection(processing_q):
    logger.info("=== Step 1: Launching ROI Selector GUI ===")
    entries = get_entries(INPUT_FOLDER)
    if not entries:
        logger.error(f"No subfolders with images found in {INPUT_FOLDER}. Did you run folder_creator.py?")
        raise FileNotFoundError(f"No subfolders with images found in {INPUT_FOLDER}.")

    root = Tk()
    root.state('zoomed')
    roi_app = ROISelector(root, entries, processing_q)
    root.mainloop()
    logger.info("ROI selection complete.")
    return list(entries.keys())

def main():
    logging.basicConfig(level=getattr(logging, LOG_LEVEL), format=LOG_FORMAT, handlers=[
        logging.FileHandler(LOG_FILE, mode='w'), logging.StreamHandler()
    ])
    logger.info("Starting Umamusume Scanner...")

    # Clear conflicts from previous run
    conflicts_file = os.path.join(BASE_DIR, 'data', 'conflicts.json')
    if os.path.exists(conflicts_file):
        with open(conflicts_file, 'w') as f:
            json.dump([], f)

    # Group loose images if any
    _group_loose_images()

    processing_q = queue.Queue()
    final_results = {}
    results_lock = threading.Lock()
    num_workers = max(1, cpu_count() - DEFAULT_NUM_PROCESSES_OFFSET)
    
    workers = []
    for _ in range(num_workers):
        worker = threading.Thread(target=processing_worker, args=(processing_q, final_results, results_lock))
        worker.daemon = True
        worker.start()
        workers.append(worker)

    try:
        processed_folder_names = _run_roi_selection(processing_q)
        processing_q.join()
    finally:
        for _ in range(num_workers):
            processing_q.put((None, None))
        for worker in workers:
            worker.join()

    logger.info("All background processing complete.")

    _move_processed_folders(processed_folder_names)
    
    new_runners_df = _create_new_runners_dataframe(final_results)
    
    if not new_runners_df.empty:
        update_all_runners(new_runners_df)

    # --- Launch conflict resolver if conflicts exist ---
    conflicts_file = os.path.join(BASE_DIR, 'data', 'conflicts.json')
    if os.path.exists(conflicts_file):
        with open(conflicts_file, 'r') as f:
            try:
                conflicts = json.load(f)
                if conflicts:
                    logger.info(f"Found {len(conflicts)} conflicts. Launching conflict resolver.")
                    subprocess.run([sys.executable, os.path.join(BASE_DIR, 'src', 'conflict_resolver.py')])
            except (json.JSONDecodeError, FileNotFoundError):
                pass # No conflicts or bad file, just continue

    logger.info("Processing finished successfully!")

if __name__ == "__main__":
    main()
