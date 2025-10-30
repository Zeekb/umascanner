import numpy as np
import cv2
import json
import os
import sys

# --- Load Configuration ---
if getattr(sys, 'frozen', False):
    BUNDLED_ROOT = sys._MEIPASS
    CONFIG_PATH = os.path.join(BUNDLED_ROOT, 'src', 'config.json')
else:
    CONFIG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'config.json')

with open(CONFIG_PATH, 'r') as f:
    config = json.load(f)

COLOR_TO_GRADE_LISTS = config["COLOR_TO_GRADE"]
COLOR_TO_GRADE = {
    grade: (np.array(values[0]), np.array(values[1]))
    for grade, values in COLOR_TO_GRADE_LISTS.items()
}

def classify_grade_roi(roi):
    """Classify a single ranking grade cell based on HSV color mask."""
    h, w = roi.shape[:2]
    roi = roi[:, int(w * 0.65):]
    hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)

    for grade, (lo, hi) in COLOR_TO_GRADE.items():
        mask = cv2.inRange(hsv, lo, hi)
        if np.sum(mask > 0) / mask.size > 0.02:
            return grade
    return "G"

def parse_rankings_by_color(roi):
    """Parse ranking table into structured dictionary."""
    rh, rw = roi.shape[:2]
    rows, cols = 3, 4
    cell_h, cell_w = rh // rows, rw // cols

    labels = [
        "Turf", "Dirt", "", "",
        "Sprint", "Mile", "Medium", "Long",
        "Front", "Pace", "Late", "End"
    ]

    grades, i = {}, 0
    for r in range(rows):
        for c in range(cols):
            label = labels[i]; i += 1
            if not label:
                continue
            y1, y2 = r*cell_h, (r+1)*cell_h
            x1, x2 = c*cell_w, (c+1)*cell_w
            grades[label] = classify_grade_roi(roi[y1:y2, x1:x2])

    return {
        "track": {"turf": grades.get("Turf",""), "dirt": grades.get("Dirt","")},
        "distance": {"sprint": grades.get("Sprint",""), "mile": grades.get("Mile",""),
                     "medium": grades.get("Medium",""), "long": grades.get("Long","")},
        "style": {"front": grades.get("Front",""), "pace": grades.get("Pace",""),
                  "late": grades.get("Late",""), "end": grades.get("End","")}
    }