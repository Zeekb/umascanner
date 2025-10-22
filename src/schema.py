from dataclasses import dataclass, field
from typing import List, Dict, Optional

@dataclass
class Stats:
    speed: int = 0
    stamina: int = 0
    power: int = 0
    guts: int = 0
    wit: int = 0

@dataclass
class Rankings:
    track: Dict[str, str] = field(default_factory=lambda: {"turf": "", "dirt": ""})
    distance: Dict[str, str] = field(default_factory=lambda: {"sprint": "", "mile": "", "medium": "", "long": ""})
    style: Dict[str, str] = field(default_factory=lambda: {"front": "", "pace": "", "late": "", "end": ""})

@dataclass
class Sparks:
    representative: Dict[str, Dict[str, int]] = field(default_factory=lambda: {
        "blue": {}, "pink": {}, "green": {}, "white": {}
    })
    legacy: Dict[str, Dict[str, int]] = field(default_factory=lambda: {
        "blue": {}, "pink": {}, "green": {}, "white": {}
    })

@dataclass
class CharacterData:
    name: str = ""
    score: int = 0
    stats: Stats = field(default_factory=Stats)
    rankings: Rankings = field(default_factory=Rankings)
    skills: List[str] = field(default_factory=list)
    sparks: List[Dict] = field(default_factory=list)

def init_schema() -> CharacterData:
    """Return a fresh CharacterData dataclass instance."""
    return CharacterData()