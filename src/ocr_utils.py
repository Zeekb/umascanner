import re
from difflib import get_close_matches
from data_loader import KNOWN_RACERS, KNOWN_SKILLS

def fuzzy_match(text, candidates, cutoff=0.6):
    """Fuzzy match OCR text against known candidates."""
    text = text.strip()
    match = get_close_matches(text, candidates, n=1, cutoff=cutoff)
    return match[0] if match else text

def normalize_name(name):
    return fuzzy_match(name, KNOWN_RACERS)

def normalize_skills(raw_skills):
    """Clean OCR skill text and fuzzy match against known list."""
    normalized = []
    for s in raw_skills:
        clean = re.sub(r'Lvl.*', '', s).strip()
        if clean:
            normalized.append(fuzzy_match(clean, KNOWN_SKILLS, cutoff=0.55))
    return normalized