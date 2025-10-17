import json
import os
from config import DATA_FOLDER

def _load_json(path):
    """Helper to load a JSON file with UTF-8 encoding."""
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

# --- Load Known Data ---
KNOWN_RACERS = _load_json(os.path.join(DATA_FOLDER, "racers.json"))
KNOWN_SKILLS = _load_json(os.path.join(DATA_FOLDER, "skills.json"))
_known_sparks_raw = _load_json(os.path.join(DATA_FOLDER, "sparks.json"))
SPARK_CORRECTION_RULES = _load_json(os.path.join(DATA_FOLDER, "spark_correction_rules.json")) # New line

# --- Pre-process Sparks Data ---
SPARKS_BY_COLOR = {
    "blue": _known_sparks_raw.get("blue", []),
    "pink": _known_sparks_raw.get("pink", []),
    "green": _known_sparks_raw.get("green", []),
    "white": _known_sparks_raw.get("white", {}).get("race", []) +
             _known_sparks_raw.get("white", {}).get("skill", [])
}
