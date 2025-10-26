import cv2
import json
import os
import logging

# --- Load Configuration ---
with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'config.json'), 'r') as f:
    config = json.load(f)

ROI_MOBILE = config["ROI_MOBILE"]
MOBILE_SCREENSHOT_HEIGHT_THRESHOLD = config["MOBILE_SCREENSHOT_HEIGHT_THRESHOLD"]
MOBILE_ROI_SHIFT = config["MOBILE_ROI_SHIFT"]

logger = logging.getLogger(__name__)

def load_image(image_path):
    """Loads an image from the given path and handles basic error logging."""
    img = cv2.imread(image_path)
    if img is None:
        logger.error(f"Could not read image: {image_path}")
    return img

def select_layout(img):
    """Determines if the image is mobile or desktop layout based on aspect ratio."""
    h, w = img.shape[:2]
    return "mobile" if w/h < 0.9 else "desktop"

def crop_rois(img, layout):
    """Crops regions of interest (ROIs) from the image based on the detected layout."""
    h, w = img.shape[:2]
    
    if layout == "desktop":
        # Assuming desktop images are wider and we only care about the left half
        img = img[:, :w//2]

    rois = {}
    if layout == "mobile":
        for k, (y1, y2, x1, x2) in ROI_MOBILE.items():
            # Adjust ROI for smaller mobile screenshots if necessary
            if (k != "skills") and h < MOBILE_SCREENSHOT_HEIGHT_THRESHOLD:
                shift = MOBILE_ROI_SHIFT
                y1 = max(0, y1 - shift)
                y2 = max(y1, y2 - shift)
            rois[k] = img[y1:y2, x1:x2]
    return rois, img
