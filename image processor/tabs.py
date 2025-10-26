import cv2
import numpy as np
from image_utils import load_image # New import

def detect_active_tab(image_path, debug=False, debug_out="tab_debug.jpg"):
    """Detect which tab is active: skills / inspiration / unknown."""
    img = load_image(image_path) # Load image using the new utility
    if img is None:
        return "unknown" # Handle case where image cannot be loaded

    skills_tab_roi = img[1060:1090, 260:370]
    insp_tab_roi   = img[1060:1090, 370:450]

    hsv_skills = cv2.cvtColor(skills_tab_roi, cv2.COLOR_BGR2HSV)
    hsv_insp   = cv2.cvtColor(insp_tab_roi, cv2.COLOR_BGR2HSV)

    green_lo, green_hi = np.array([35, 50, 120]), np.array([85, 255, 255])
    skills_ratio = np.sum(cv2.inRange(hsv_skills, green_lo, green_hi) > 0) / hsv_skills.size
    insp_ratio   = np.sum(cv2.inRange(hsv_insp, green_lo, green_hi) > 0) / hsv_insp.size

    if debug:
        #print(f"[Tab Debug] Skills={skills_ratio:.3f}, Insp={insp_ratio:.3f}")
        dbg = img.copy()
        cv2.rectangle(dbg, (260,1060), (370,1090), (0,0,255), 2)
        cv2.rectangle(dbg, (370,1060), (450,1090), (255,0,0), 2)
        cv2.imwrite(debug_out, dbg)

    if insp_ratio > 0.05: return "inspiration"
    if skills_ratio > 0.05: return "skills"
    return "unknown"