#
# --- main.py ---
#

import os
import sys

def add_external_lib_path(lib_path):
    """Helper to add a library path to sys.path and OS DLL paths."""
    if not lib_path or (not os.path.isdir(lib_path) and "site-packages" not in lib_path):
        # Allow the path even if it doesn't exist yet, but log a warning.
        # The check will be the os.path.isdir inside.
        print(f"Warning: Received library path may be invalid: {lib_path}")
    
    if os.path.isdir(lib_path):
        # 1. Add to sys.path for Python modules
        print(f"Adding to sys.path: {lib_path}")
        sys.path.append(lib_path)
        
        # 2. Add torch\lib to DLL path
        torch_lib_path = os.path.join(lib_path, 'torch', 'lib')
        if os.path.isdir(torch_lib_path):
            try:
                os.add_dll_directory(torch_lib_path)
                print(f"Adding to DLL path: {torch_lib_path}")
            except AttributeError:
                os.environ['PATH'] = torch_lib_path + os.pathsep + os.environ.get('PATH', '')
                print(f"Adding to OS PATH (fallback): {torch_lib_path}")
        else:
            print(f"Warning: torch\\lib not found at {torch_lib_path}")
    else:
        print(f"Error: Path is not a valid directory, cannot add: {lib_path}")


# --- This variable must be defined in the global scope for later ---
external_lib_path = "" 

if getattr(sys, 'frozen', False) and len(sys.argv) > 1 and "site-packages" in sys.argv[1]:
    # --- GPU BUILD ---
    # A path was passed, so this is the GPU build.
    # We use your helper function (defined on line 10) to add the path.
    os.environ["CUDA_VISIBLE_DEVICES"] = "0"
    external_lib_path = sys.argv[1]
    add_external_lib_path(external_lib_path) 

elif getattr(sys, 'frozen', False):
    # --- CPU BUILD ---
    # No path was passed, so this is the CPU build.
    # Force CPU-mode.
    os.environ["CUDA_VISIBLE_DEVICES"] = "-1"

else:
    # --- LOCAL SCRIPT RUN ---
    # Not frozen, so do nothing.
    pass

import torch
import cv2
import numpy as np
import easyocr
import pandas as pd
import hashlib
import shutil
from PIL import Image, ImageOps
import queue
import threading
import logging
import re
import io
from typing import Optional
import json
from multiprocessing import cpu_count
from datetime import datetime
from tqdm import tqdm
import subprocess
import warnings

from conflict_resolver import launch_resolver_gui
from schema import init_schema, CharacterData
from umamusume_parser import parse_umamusume
from spark_parser import parse_sparks
from roi_selector_gui import get_entries, combine_images_horizontally
from roi_detector import detect_spark_zones
from tabs import detect_active_tab
from data_updater import update_all_runners
from ocr_utils import normalize_name
from image_utils import select_layout, crop_rois, load_image

# --- Path Configuration ---
# Detects if running as a script or a frozen executable (.exe)
# and sets paths accordingly.

if getattr(sys, 'frozen', False):
    BASE_DIR = os.path.dirname(sys.executable)
    DATA_FOLDER = os.path.join(BASE_DIR, "data")
    BUNDLED_ROOT = sys._MEIPASS
    
    INPUT_FOLDER = os.path.join(DATA_FOLDER, "input_images")
    COMPLETED_FOLDER = os.path.join(DATA_FOLDER, "processed_images")
    DEBUG_PORTRAITS_DIR = os.path.join(DATA_FOLDER, 'debug_portraits')
    DEBUG_MASTER_FACES_DIR = os.path.join(DATA_FOLDER, 'debug_master_faces')
    
    CONFIG_PATH = os.path.join(BUNDLED_ROOT, 'src', 'config.json')
    GAME_DATA_ROOT = os.path.join(BUNDLED_ROOT, "data", "game_data")
    PROFILE_IMAGES_DIR = os.path.join(BUNDLED_ROOT, 'assets', 'profile_images')
    
    RESOLVER_SCRIPT_PATH = os.path.join(BUNDLED_ROOT, 'src', 'conflict_resolver.py')

else:
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    DATA_FOLDER = os.path.join(BASE_DIR, "data")
    INPUT_FOLDER = os.path.join(DATA_FOLDER, "input_images")
    COMPLETED_FOLDER = os.path.join(DATA_FOLDER, "processed_images")
    DEBUG_PORTRAITS_DIR = os.path.join(BASE_DIR, 'debug_portraits')
    DEBUG_MASTER_FACES_DIR = os.path.join(BASE_DIR, 'debug_master_faces')
    CONFIG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'config.json')
    GAME_DATA_ROOT = os.path.join(BASE_DIR, "data", "game_data")
    PROFILE_IMAGES_DIR = os.path.join(BASE_DIR, 'assets', 'profile_images')
    RESOLVER_SCRIPT_PATH = os.path.join(BASE_DIR, 'src', 'conflict_resolver.py')

with open(CONFIG_PATH, 'r') as f: 
    config = json.load(f)

OCR_READER_CONFIG = config["OCR_READER_CONFIG"]
DEFAULT_NUM_PROCESSES_OFFSET = config["DEFAULT_NUM_PROCESSES_OFFSET"]
LOG_LEVEL = config["LOG_LEVEL"]
LOG_FORMAT = config["LOG_FORMAT"]
logger = logging.getLogger(__name__)

# --- Runner Skill Mapping ---
# Loads a JSON file mapping in-game skills to specific runners. This map is
# reversed to allow identifying a runner based on their unique green skill,
# which serves as a primary method for grandparent identification.
SKILL_TO_RUNNER_MAP = {}
try:
    skills_path = os.path.join(GAME_DATA_ROOT, 'runner_skills.json')
    with open(skills_path, 'r', encoding='utf-8') as f:
        runner_skills = json.load(f)
    for runner, skills in runner_skills.items():
        for skill in skills:
            SKILL_TO_RUNNER_MAP[skill] = runner
    logger.info("Successfully loaded and reversed runner skills map.")
except Exception as e:
    logger.error(f"Failed to load or process runner_skills.json: {e}. Green Spark ID will be disabled.")

class TqdmLoggingHandler(logging.Handler):
    """
    A custom logging handler that redirects log messages through tqdm.write(),
    ensuring that log output doesn't interfere with tqdm's progress bars.
    """
    def __init__(self, level=logging.NOTSET):
        super().__init__(level)

    def emit(self, record):
        try:
            msg = self.format(record)
            tqdm.write(msg)
            self.flush()
        except Exception:
            self.handleError(record)

# --- Helper Functions ---

def _crop_face_from_screenshot(img: Image.Image) -> Image.Image:
    """Crops the region of an input screenshot where the character's face is typically located."""
    width, height = img.size
    left, top, right, bottom = width * 0.10, height * 0.40, width, height * 0.88
    return img.crop((left, top, right, bottom))

def _convert_to_grayscale_with_white_bg(img: Image.Image) -> Image.Image:
    """Converts an image to grayscale, ensuring transparent areas are replaced with a white background."""
    if img.mode == 'RGBA':
        bg = Image.new("RGB", img.size, (255, 255, 255))
        bg.paste(img, mask=img.split()[3])
        return bg.convert('L')
    else:
        return img.convert('L')

def _find_and_crop_match_from_master(master_img_gray: Image.Image, template_face_gray: Image.Image, angles_to_check: list[int]) -> Optional[Image.Image]:
    """
    Finds and crops a matching face from a master image based on a template face.
    This function performs a multi-scale and multi-angle template matching to robustly
    find the template within a specific search zone of the master image.
    """
    master_width, master_height = master_img_gray.size
    # Define a smaller search area within the master image to speed up matching.
    search_zone_box = (
        int(master_width * 0.15),
        int(master_height * 0.10),
        int(master_width * 0.85),
        int(master_height * 0.70)
    )
    search_area_img = master_img_gray.crop(search_zone_box)
    search_area_cv = np.array(search_area_img)

    template_cv_orig = np.array(template_face_gray)

    best_overall_match = {'val': -1, 'loc': None, 'scale': 1.0, 'angle': 0}

    # Iterate through specified angles to handle slight rotations in character art.
    for angle in angles_to_check:
        template_cv = template_cv_orig
        h, w = template_cv.shape

        if angle != 0:
            # Rotate the template image and adjust its bounding box.
            center = (w // 2, h // 2)
            rot_mat = cv2.getRotationMatrix2D(center, angle, 1.0)
            cos = np.abs(rot_mat[0, 0])
            sin = np.abs(rot_mat[0, 1])
            new_w = int((w * cos) + (h * sin))
            new_h = int((w * sin) + (h * cos))
            rot_mat[0, 2] += (new_w / 2) - center[0]
            rot_mat[1, 2] += (new_h / 2) - center[1]
            template_cv = cv2.warpAffine(template_cv_orig, rot_mat, (new_w, new_h), borderValue=255)
            h, w = template_cv.shape

        best_scale_match = {'val': -1, 'loc': None, 'scale': 1.0}
        # Iterate through different scales to find the best match size.
        for scale in np.linspace(1.0, 0.1, 20):
            resized_w, resized_h = int(search_area_cv.shape[1] * scale), int(search_area_cv.shape[0] * scale)
            if resized_h < h or resized_w < w:
                continue

            resized_master = cv2.resize(search_area_cv, (resized_w, resized_h), interpolation=cv2.INTER_AREA)
            result = cv2.matchTemplate(resized_master, template_cv, cv2.TM_CCOEFF_NORMED)
            _, max_val, _, max_loc = cv2.minMaxLoc(result)

            if max_val > best_scale_match['val']:
                best_scale_match.update({'val': max_val, 'loc': max_loc, 'scale': scale})

        if best_scale_match['val'] > best_overall_match['val']:
            best_overall_match.update(best_scale_match)
            best_overall_match['angle'] = angle

    # If the best match confidence is below a threshold, assume no match was found.
    if best_overall_match['val'] < 0.6:
        return None

    # Calculate the coordinates of the matched region in the original, unscaled master image.
    top_left_in_zone = best_overall_match['loc']
    scale = best_overall_match['scale']
    unscaled_x_in_zone = int(top_left_in_zone[0] / scale)
    unscaled_y_in_zone = int(top_left_in_zone[1] / scale)
    orig_x = unscaled_x_in_zone + search_zone_box[0]
    orig_y = unscaled_y_in_zone + search_zone_box[1]

    angle = best_overall_match['angle']
    w, h = template_face_gray.size
    if angle != 0:
        # Recalculate the bounding box of the rotated template to ensure correct cropping.
        center = (w // 2, h // 2)
        rot_mat = cv2.getRotationMatrix2D(center, angle, 1.0)
        cos, sin = np.abs(rot_mat[0, 0]), np.abs(rot_mat[0, 1])
        w, h = int((w * cos) + (h * sin)), int((w * sin) + (h * cos))

    orig_w = int(w / scale)
    orig_h = int(h / scale)

    return master_img_gray.crop((orig_x, orig_y, orig_x + orig_w, orig_y + orig_h))

# --- Character Portrait Identification Engine ---
MASTER_IMAGE_CACHE = {}

def _identify_portrait(screenshot_portrait_img: Image.Image, debug_filename: str) -> str:
    """
    Identifies a character by comparing a cropped portrait from a screenshot against a library of master images.
    It uses template matching and calculates the sum of squared differences to find the best match.
    """
    global MASTER_IMAGE_CACHE

    # Load master images into a cache on the first run.
    if not MASTER_IMAGE_CACHE:
        if os.path.isdir(PROFILE_IMAGES_DIR):
            for f in os.listdir(PROFILE_IMAGES_DIR):
                if f.lower().endswith(('_c.png', '_c.jpg')):
                    identifier = os.path.splitext(f)[0]
                    try:
                        img_path = os.path.join(PROFILE_IMAGES_DIR, f)
                        master_img = Image.open(img_path)
                        MASTER_IMAGE_CACHE[identifier] = _convert_to_grayscale_with_white_bg(master_img)
                    except Exception as e:
                        logger.error(f"Could not load master image {f}: {e}")
    if not MASTER_IMAGE_CACHE:
        logger.error("Master image cache is empty."); return "Unknown"

    best_match_identifier = "Unknown"
    lowest_diff = float('inf')

    # Prepare the screenshot's face for comparison.
    target_gray = _convert_to_grayscale_with_white_bg(screenshot_portrait_img)
    target_face_img = _crop_face_from_screenshot(target_gray)
    #os.makedirs(DEBUG_PORTRAITS_DIR, exist_ok=True)
    #target_face_img.save(os.path.join(DEBUG_PORTRAITS_DIR, debug_filename))

    #os.makedirs(DEBUG_MASTER_FACES_DIR, exist_ok=True)
    # Compare the target face against each master image.
    for identifier, master_img_gray in MASTER_IMAGE_CACHE.items():
        angles = [0]

        master_face_img = _find_and_crop_match_from_master(master_img_gray, target_face_img, angles)

        if master_face_img is None:
            continue

        #master_face_img.save(os.path.join(DEBUG_MASTER_FACES_DIR, f"{identifier}.png"))
        master_resized_face = master_face_img.resize(target_face_img.size, Image.Resampling.LANCZOS)

        # Calculate the sum of squared differences between the target and master face.
        target_arr = np.array(target_face_img, dtype=np.int32)
        master_arr = np.array(master_resized_face, dtype=np.int32)
        diff = np.sum((target_arr - master_arr)**2)

        if diff < lowest_diff:
            lowest_diff = diff
            best_match_identifier = identifier

    logger.info(f"--> Best match for {debug_filename}: '{best_match_identifier}' with diff {lowest_diff}")

    # If the difference is below a confidence threshold, return the identified name.
    CONFIDENCE_THRESHOLD = 16_000_000
    if lowest_diff < CONFIDENCE_THRESHOLD:
        return best_match_identifier.replace('_', ' ')
    else:
        return "Unknown"

def process_folder(folder_name, all_rois, reader) -> Optional[tuple[str, CharacterData]]:
    """
    Main processing function for a single character folder. It orchestrates OCR parsing for
    stats and skills, identifies grandparents, and extracts spark data.
    """
    logger.info(f"--- Starting to process folder: {folder_name} ---")
    folder_path = os.path.join(INPUT_FOLDER, folder_name)
    if not os.path.isdir(folder_path):
        return None

    character_data = init_schema()
    image_paths = sorted([os.path.join(folder_path, f) for f in os.listdir(folder_path) if f.lower().endswith((".png", ".jpg", ".jpeg"))])

    logger.info("--- Parser 1: Extracting Main Stats & Skills ---")
    # --- Parser 1: Extract Main Stats and Skills ---
    # Iterates through all images in the folder to parse and aggregate character stats,
    # rankings, and skills using the `parse_umamusume` function.
    for img_path in image_paths:
        try:
            result = parse_umamusume(img_path, reader)
            if not result: continue
            if result.name and not character_data.name: character_data.name = result.name
            if result.score and not character_data.score: character_data.score = result.score
            for stat, value in result.stats.__dict__.items(): setattr(character_data.stats, stat, max(getattr(character_data.stats, stat), value))
            for category, sub in result.rankings.__dict__.items():
                for key_, val in sub.items():
                    if val: character_data.rankings.__dict__.setdefault(category, {})[key_] = val
            for skill in result.skills:
                if skill not in character_data.skills: 
                    logger.debug(f"Found new skill for {character_data.name or folder_name}: '{skill}'")
                    character_data.skills.append(skill)
        except Exception as e:
            logger.error(f"[ERROR] Parser 1 failed on {img_path}: {e}")

    logger.info("--- Parser 2: Extracting Sparks & Grandparents ---")
    # --- Parser 2: Extract Sparks and Identify Grandparents ---
    rois_list = all_rois.get(folder_name, [])
    if not rois_list: return folder_name, character_data

    spark_image_paths = [p for p in image_paths if detect_active_tab(p) == "inspiration"]
    if not spark_image_paths: return folder_name, character_data

    # Combines multiple inspiration screenshots into one wide image for easier processing.
    combined_img = combine_images_horizontally(spark_image_paths)
    final_sparks_list = []
    roi_type_map = ["parent", "gp1", "gp2"]
    character_data.parent = character_data.name
    character_data.rep_char_name = character_data.name

    # Process each detected ROI (parent, grandparent1, grandparent2).
    for roi_idx, roi_data in enumerate(rois_list):
        if roi_idx >= len(roi_type_map): break

        current_roi_type = roi_type_map[roi_idx]
        _, roi_box, _ = roi_data

        roi_crop_pil = combined_img.crop(roi_box)
        roi_cv_crop = cv2.cvtColor(np.array(roi_crop_pil), cv2.COLOR_RGB2BGR)
        identified_name = "Unknown"

        try:
            # Step 1: Always parse sparks from the ROI.
            sparks_result = parse_sparks(roi_cv_crop, reader)
            for color, sparks_list_data in sparks_result.items():
                for spark in sparks_list_data:
                    logger.debug(f"Detected spark for {folder_name} ({current_roi_type}): Color='{color}', Name='{spark['name']}', Stars='{spark['count']}'")
                    final_sparks_list.append({ "type": current_roi_type, "color": color, "spark_name": spark['name'], "count": spark['count'] })

            # Step 2: Attempt identification only for grandparents.
            if current_roi_type in ["gp1", "gp2"]:
                # Step 3: Primary ID Method - Use unique green spark to identify the runner.
                if SKILL_TO_RUNNER_MAP and 'green' in sparks_result and sparks_result['green']:
                    green_spark_name = sparks_result['green'][0]['name']
                    found_runner = SKILL_TO_RUNNER_MAP.get(green_spark_name)
                    if found_runner:
                        identified_name = found_runner
                        logger.info(f"Identified {current_roi_type} for {folder_name} as '{identified_name}' via Green Spark.")

                # Step 4: Fallback ID Method - If green spark fails, use image comparison.
                if identified_name == "Unknown":
                    logger.info(f"Green Spark ID for {folder_name} failed for {current_roi_type}. Falling back to image comparison.")
                    x1, y1, x2, y2 = roi_box
                    portrait_box = (x1 - 110, y1 + 9, x1 - 20, y1 + 125)
                    portrait_image = combined_img.crop(portrait_box)
                    debug_filename = f"{folder_name}_{current_roi_type}.png"
                    identified_name = _identify_portrait(portrait_image, debug_filename)

            # Step 5: Store the final identified name.
            if current_roi_type == "gp1": character_data.gp1 = identified_name
            elif current_roi_type == "gp2": character_data.gp2 = identified_name

        except Exception as e:
            logger.error(f"[ERROR] Main processing loop failed on ROI for {folder_name}: {e}")

    grouped_sparks = {"parent": [], "gp1": [], "gp2": []}
    for spark_info in final_sparks_list:
        spark_type = spark_info.get("type")
        if spark_type in grouped_sparks:
            # Create a new dictionary for the spark, excluding the now-redundant 'type' key.
            new_spark_entry = {
                "color": spark_info.get("color"),
                "spark_name": spark_info.get("spark_name"),
                "count": spark_info.get("count")
            }
            grouped_sparks[spark_type].append(new_spark_entry)

    # Assign the newly structured dictionary to character_data.
    character_data.sparks = grouped_sparks
    logger.info(f"--- Finished processing folder: {folder_name} ---")
    return folder_name, character_data

def processing_worker(q, final_results, lock, reader):
    """Worker thread function to process folders from a queue."""
    while True:
        try:
            folder_name, rois = q.get()
            if folder_name is None: break
            single_folder_rois = {folder_name: rois}
            _, character_data = process_folder(folder_name, single_folder_rois, reader)
            if character_data:
                with lock:
                    final_results[folder_name] = character_data
        finally:
            q.task_done()

def _move_processed_folders(folder_names):
    """Moves successfully processed folders from the input directory to the completed directory."""
    logger.info(f"\n=== Step 3: Moving processed images to {COMPLETED_FOLDER} ===")
    os.makedirs(COMPLETED_FOLDER, exist_ok=True)
    for folder_name in folder_names:
        source_path = os.path.join(INPUT_FOLDER, folder_name)
        if not os.path.isdir(source_path): continue
        dest_path = os.path.join(COMPLETED_FOLDER, folder_name)
        if os.path.exists(dest_path): shutil.rmtree(dest_path)
        shutil.move(source_path, dest_path)
        logger.info(f"Moved {folder_name} to {COMPLETED_FOLDER}")

# --- IN image_processor.py ---

def _create_new_runners_dataframe(final_results):
    """
    Transforms the processed character data into a pandas DataFrame, assigning new or
    existing entry IDs based on a hash of the folder and character name from all_runners.json.
    """
    logger.info("\n=== Step 4: Creating new runners DataFrame from JSON ===")
    if not final_results:
        logger.info("No new results to process.")
        return pd.DataFrame()

    all_runners_output_file = os.path.join(BASE_DIR, "data", "all_runners.json")
    try:
        existing_all_runners_df = pd.read_json(all_runners_output_file, dtype={'entry_id': str, 'entry_hash': str})
        if existing_all_runners_df.empty:
            existing_all_runners_df = pd.DataFrame(columns=['entry_id', 'entry_hash'])
    except (FileNotFoundError, ValueError):
        existing_all_runners_df = pd.DataFrame(columns=['entry_id', 'entry_hash'])

    entry_hash_to_id = pd.Series(existing_all_runners_df.entry_id.values, index=existing_all_runners_df.entry_hash).to_dict()
    numeric_ids = pd.to_numeric(existing_all_runners_df['entry_id'], errors='coerce').dropna()
    next_entry_id = int(numeric_ids.max()) + 1 if not numeric_ids.empty else 1

    new_runners_rows = []
    for folder_name, character_data in final_results.items():
        if not character_data.name: continue

        current_entry_hash = hashlib.md5(f"{folder_name}_{character_data.name}".encode("utf-8")).hexdigest()
        entry_id = entry_hash_to_id.get(current_entry_hash, str(next_entry_id))
        if entry_id == str(next_entry_id): next_entry_id += 1

        row = {
            "entry_id": entry_id,
            "last_updated": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "entry_hash": current_entry_hash,
            "name": character_data.name,
            "score": character_data.score
        }

        for stat_name, value in character_data.stats.__dict__.items(): row[stat_name] = value
        for category, sub in character_data.rankings.__dict__.items():
            for subcat, grade in sub.items(): row[f"{subcat}"] = grade
        row["gp1"] = character_data.gp1
        row["gp2"] = character_data.gp2
        row["skills"] = character_data.skills
        row["sparks"] = character_data.sparks
        new_runners_rows.append(row)

    return pd.DataFrame(new_runners_rows)

def _group_loose_images(reader):
    """
    Organizes individual image files in the input directory into subfolders. Images are
    grouped based on the character's name, score, and a hash of their stats to ensure
    all screenshots for a single run are placed together.
    """
    logger.info("\n=== Step 0: Organizing loose images ===")
    stat_keys = config["STAT_KEYS"]
    all_images = [
        os.path.join(INPUT_FOLDER, entry.name)
        for entry in os.scandir(INPUT_FOLDER)
        if entry.is_file() and entry.name.lower().endswith((".png", ".jpg", ".jpeg"))
    ]
    if not all_images:
        logger.info("No loose images found in input_images. Skipping folder organization.")
        return False

    grouped_images = {}
    folder_name_counters = {}
    for img_path in all_images:
        try:
            # For each image, extract name, score, and stats to form a unique key.
            img = load_image(img_path)
            if img is None: continue
            layout = select_layout(img)
            rois, _ = crop_rois(img, layout)
            ocr_rois = [rois["name"], rois["score"]] + [rois[k] for k in stat_keys]
            stacked_text = [" ".join(reader.readtext(roi, detail=0, paragraph=False)) for roi in ocr_rois]
            logger.debug(f"Raw OCR text for {os.path.basename(img_path)}: Name='{stacked_text[0]}', Score='{stacked_text[1]}', Stats='{stacked_text[2:]}'")
            name = normalize_name(stacked_text[0]).strip().replace(" ", "_") if len(stacked_text) > 0 else None
            score = re.sub(r"[^0-9]", "", str(stacked_text[1])) if len(stacked_text) > 1 else ""
            if not name or not score:
                logger.warning(f"Could not extract name or score from {img_path}. Skipping.")
                continue

            stats = {k: int(re.sub(r"\D", "", stacked_text[i+2]) or "0") for i, k in enumerate(stat_keys)}
            stats_hash = hashlib.md5("_".join(f"{k}:{v}" for k, v in sorted(stats.items())).encode("utf-8")).hexdigest()

            # Group images by a key tuple of (name+score, stats_hash).
            base_folder_name = f"{name}{score}"
            folder_key = (base_folder_name, stats_hash)
            if folder_key not in grouped_images: grouped_images[folder_key] = []
            grouped_images[folder_key].append(img_path)
        except Exception as e:
            logger.error(f"Failed to parse {img_path}: {e}")

    # Move the grouped images into their respective new folders.
    for (base_folder_name, stats_hash), img_list in grouped_images.items():
        count = folder_name_counters.get(base_folder_name, 1)
        folder_name = base_folder_name if count == 1 else f"{base_folder_name}_{count}"
        folder_name_counters[base_folder_name] = count + 1
        folder_path = os.path.join(INPUT_FOLDER, folder_name)
        os.makedirs(folder_path, exist_ok=True)
        for img_path in img_list:
            dest_path = os.path.join(folder_path, os.path.basename(img_path))
            # Handle potential file name collisions.
            counter = 1
            base_name_file, ext = os.path.splitext(os.path.basename(img_path))
            while os.path.exists(dest_path):
                dest_path = os.path.join(folder_path, f"{base_name_file}_{counter}{ext}")
                counter += 1
            shutil.move(img_path, dest_path)

    logger.info("Images grouped into folders by Name + Score + Stats.")
    return True

def _run_roi_detection_automatically(processing_q, reader):
    """
    Scans input folders for inspiration images, combines them, detects the regions of
    interest (ROIs) for parent/grandparents, and adds them to the processing queue.
    """
    logger.info("=== Step 1: Running automatic ROI detection ===")
    entries = get_entries(INPUT_FOLDER)
    if not entries:
        logger.error(f"No subfolders with inspiration images found in {INPUT_FOLDER}.")
        return []

    # The 'file' argument is the only change in this loop
    for folder_name in tqdm(entries.keys(), desc="Detecting Umas", ncols=120):
        image_paths = entries[folder_name]
        logger.info(f"Detecting ROIs for {folder_name}...")
        try:
            img_original = combine_images_horizontally(image_paths)
            img_cv = cv2.cvtColor(np.array(img_original), cv2.COLOR_RGB2BGR)
            detected_rois = detect_spark_zones(img_cv, reader)
            rois_for_queue = [(folder_name, roi, image_paths) for roi in detected_rois]
            processing_q.put((folder_name, rois_for_queue))
        except Exception as e:
            logger.error(f"Error processing {folder_name} for ROI detection: {e}")
            processing_q.put((folder_name, []))

    logger.info("Automatic ROI detection complete.")
    return list(entries.keys())

def main():
    """
    Main execution function that orchestrates the entire scanning and processing pipeline.
    """
    logs_folder = os.path.join(DATA_FOLDER, "logs")

    os.makedirs(logs_folder, exist_ok=True)

    timestamp = datetime.now().strftime("%d%m%Y_%H.%M.%S")
    log_filename = f"app_{timestamp}.log"
    log_filepath = os.path.join(logs_folder, log_filename)

    logger = logging.getLogger()
    logger.setLevel(getattr(logging, LOG_LEVEL))
    formatter = logging.Formatter(LOG_FORMAT, datefmt="%H:%M:%S")

    # Create a handler to write to the log file (as before)
    file_handler = logging.FileHandler(log_filepath, mode='w', encoding='utf-8')
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)
    logging.getLogger("PIL").setLevel(logging.WARNING)
    # --- CONSOLE HANDLER REMOVED ---
    # The following handler is responsible for printing logs to the console.
    # By removing it, only the tqdm progress bar will be visible there.
    # All log messages will now go exclusively to the app.log file.
    # 
    # tqdm_handler = TqdmLoggingHandler()
    # tqdm_handler.setFormatter(formatter)
    # logger.addHandler(tqdm_handler)
    
    logger = logging.getLogger(__name__) # This line can remain

    # Warn if GPU is configured but not available.
    if OCR_READER_CONFIG.get("gpu") and not torch.cuda.is_available():
        # This warning will now only appear in the log file, not the console.
        warnings.warn("\n\GPU acceleration is enabled, but a compatible GPU/PyTorch was not found. \nCrashing Out\n")

    logger.info("Starting Umamusume Scanner...")
    # Clear any previous conflict resolution files.
    conflicts_file = os.path.join(BASE_DIR, 'data', 'conflicts.json')
    if os.path.exists(conflicts_file):
        with open(conflicts_file, 'w') as f: json.dump([], f)

    reader = easyocr.Reader(OCR_READER_CONFIG["languages"], gpu=OCR_READER_CONFIG["gpu"])

    # Step 0: Organize loose images into folders.
    _group_loose_images(reader)

    # Initialize multithreading for parallel folder processing.
    processing_q = queue.Queue()
    final_results = {}
    results_lock = threading.Lock()
    num_workers = max(1, cpu_count() - DEFAULT_NUM_PROCESSES_OFFSET)
    logger.info(f"Initializing {num_workers} worker threads for processing.")
    workers = []
    for _ in range(num_workers):
        worker = threading.Thread(target=processing_worker, args=(processing_q, final_results, results_lock, reader))
        worker.daemon = True
        worker.start()
        workers.append(worker)

    try:
        # Step 1: Detect ROIs and populate the processing queue.
        processed_folder_names = _run_roi_detection_automatically(processing_q, reader)

        # Wait for all folders in the queue to be processed.
        logger.info(f"All {len(processed_folder_names)} folders have been queued. Waiting for workers to complete...")
        processing_q.join()
        logger.info("All tasks in the processing queue have been completed.")

    finally:
        # Stop worker threads.
        logger.info("Stopping worker threads...")
        for _ in range(num_workers): processing_q.put((None, None))
        for worker in workers: worker.join()

    logger.info(f"All background processing complete. Collected {len(final_results)} results.")

    # Load skill data needed for formatting BEFORE calling update_all_runners
    skill_order_map: Dict[str, int] = {}
    runner_unique_skills: Dict[str, list] = {}
    try:
        skills_path = os.path.join(GAME_DATA_ROOT, 'skills.json')
        runner_skills_path = os.path.join(GAME_DATA_ROOT, 'runner_skills.json')

        with open(skills_path, 'r', encoding='utf-8') as f:
            skills_data = json.load(f) # skills_data is a dict {"Skill Name": "type"}
        with open(runner_skills_path, 'r', encoding='utf-8') as f:
            runner_unique_skills = json.load(f)
        
        # Build the order map from the keys of the skills dict
        skill_order_map = {skill_name: i for i, skill_name in enumerate(skills_data.keys())}
        logger.info("Successfully loaded skills data for formatting.")

    except FileNotFoundError:
        logger.warning("Skill ordering files (skills.json/runner_skills.json) not found. Skills will not be sorted during update.")
    except Exception as e:
        logger.error(f"Failed to load skill data for formatting: {e}")
        
    # Step 3: Move processed folders to the completed directory.
    _move_processed_folders(processed_folder_names)
    # Step 4: Create a DataFrame from the results and update the main data file.
    new_runners_df = _create_new_runners_dataframe(final_results)
    if not new_runners_df.empty:
        update_all_runners(new_runners_df, runner_unique_skills, skill_order_map, DATA_FOLDER)

    # If conflicts were detected during data updates, launch the conflict resolver tool.
    conflicts_file = os.path.join(BASE_DIR, 'data', 'conflicts.json')

    run_resolver = False
    try:
        # Check if the file exists AND is not empty "[]"
        if os.path.exists(conflicts_file) and os.path.getsize(conflicts_file) > 2: # Check size > 2
             with open(conflicts_file, 'r', encoding='utf-8') as f:
                 content = f.read().strip()
                 # Check content is not just empty brackets
                 if content and content != '[]':
                     try:
                         # Verify it's valid JSON and contains data
                         if json.loads(content):
                              run_resolver = True
                     except json.JSONDecodeError:
                          logger.error(f"{os.path.basename(conflicts_file)} is corrupted.")
                          run_resolver = False # Don't run if corrupted

    except IOError as e:
         logger.error(f"Error checking conflicts file: {e}")
    except Exception as e:
         logger.error(f"Unexpected error checking conflicts file status: {e}")


    if run_resolver:
        logger.info("Conflicts detected. Launching conflict resolver GUI...")
        try:
            # This is now a direct function call, not a subprocess
            launch_resolver_gui(DATA_FOLDER, GAME_DATA_ROOT)

            logger.info("Conflict resolver finished.")

            # --- This cleanup logic you had is good, keep it ---
            try:
                if os.path.exists(conflicts_file):
                    with open(conflicts_file, 'r', encoding='utf-8') as f:
                        content_after = f.read().strip()
                    if content_after == '[]':
                        os.remove(conflicts_file)
                        logger.info(f"Removed empty {os.path.basename(conflicts_file)} after resolution.")
            except (IOError, OSError, json.JSONDecodeError) as e:
                logger.warning(f"Could not check or remove empty conflicts file after resolution: {e}")

        except Exception as e:
            # Catch any errors from the GUI itself
            logger.error(f"Error running conflict resolver: {e}", exc_info=True)    
    else:
        # --- This 'else' block runs if no resolver was needed ---
        logger.info("No unresolved conflicts found.")
        # --- ADDED: Ensure empty file is removed if no resolver was needed ---
        try:
             # Check if the file exists (it might not if data_updater found no conflicts)
             if os.path.exists(conflicts_file):
                 with open(conflicts_file, 'r', encoding='utf-8') as f:
                      content = f.read().strip()
                 # If it exists but is empty, remove it
                 if content == '[]':
                      os.remove(conflicts_file)
                      logger.info(f"Removed empty {os.path.basename(conflicts_file)} as no conflicts were found.")
        except (IOError, OSError, json.JSONDecodeError) as e:
             logger.warning(f"Could not check or remove empty conflicts file when no conflicts were found: {e}")
        # --- END ADDED ---

    logger.info("Processing finished successfully!")

if __name__ == "__main__":
    main()