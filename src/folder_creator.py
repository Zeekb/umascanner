import os
import re
import cv2
import hashlib
import shutil
from ocr_utils import normalize_name # Keep normalize_name
import easyocr
import json
import logging # New import
from image_utils import select_layout, crop_rois, load_image # New import

# --- Path Configuration ---
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_FOLDER = os.path.join(BASE_DIR, "data")
INPUT_FOLDER = os.path.join(DATA_FOLDER, "input_images")
LOG_FILE = os.path.join(BASE_DIR, "app.log")

# --- Load Configuration ---
with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'config.json'), 'r') as f:
    config = json.load(f)

OCR_READER_CONFIG = config["OCR_READER_CONFIG"]
STAT_KEYS = config["STAT_KEYS"]
LOG_LEVEL = config["LOG_LEVEL"]
LOG_FORMAT = config["LOG_FORMAT"]

# Configure logging for this script
logging.basicConfig(level=getattr(logging, LOG_LEVEL),
                    format=LOG_FORMAT,
                    handlers=[
                        logging.FileHandler(LOG_FILE),
                        logging.StreamHandler() # Also log to console
                    ])
logger = logging.getLogger(__name__)

# ---------------- Configuration ----------------
reader = easyocr.Reader(OCR_READER_CONFIG["languages"], gpu=OCR_READER_CONFIG["gpu"]) # Updated initialization

# ---------------- Scan base folder for images ----------------
all_images = [
    os.path.join(INPUT_FOLDER, entry.name)
    for entry in os.scandir(INPUT_FOLDER)
    if entry.is_file() and entry.name.lower().endswith((".png", ".jpg", ".jpeg"))
]

grouped_images = {}          # key: (base_folder_name, stats_hash), value: list of images
folder_name_counters = {}    # key: base_folder_name, value: next folder index

stat_keys = STAT_KEYS

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
        score = re.sub(r"\D", "", stacked_text[1]) if len(stacked_text) > 1 else None
        if not name or not score:
            logger.warning(f"Could not extract name or score from {img_path}. Skipping.") # Replaced print
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
        logger.error(f"Failed to parse {img_path}: {e}") # Replaced print

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
