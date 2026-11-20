"""Registro de parsers por fonte (multi-source guide pipeline).

Cada parser converte um arquivo .txt de sua respectiva pasta em `backend/data/sources/<source_slug>/`
para o formato JSON canônico consumido por `import_guides.py`:
  {
    "source": "KQM",
    "source_slug": "kqm",
    "source_url": "https://...",
    "character_slug": "skirk",
    "build": {"name": "...", "build_data": {...}},
    "notable_teammates": [{"character_slug": ..., "character_name": ..., "category": ..., "notes": ...}],
    "teams": [{"character_slugs": [...], "main_character": ..., "raw_line": ..., "slot_alternatives": {"4": [...]}}],
  }
"""
from dataclasses import dataclass
from typing import Callable

from ..parse_kqm_guide import parse_guide as parse_kqm_guide
from .game8 import parse_guide as parse_game8_guide
from .genshingg import parse_guide as parse_genshingg_guide
from .gamewith import parse_guide as parse_gamewith_guide


@dataclass(frozen=True)
class SourceConfig:
    slug: str
    display_name: str
    base_url: str
    parser: Callable[[str, str], dict] | None = None


SOURCES: dict[str, SourceConfig] = {
    "kqm": SourceConfig(
        slug="kqm",
        display_name="KQM",
        base_url="https://keqingmains.com/{slug}/",
        parser=parse_kqm_guide,
    ),
    "game8": SourceConfig(
        slug="game8",
        display_name="Game8",
        base_url="https://game8.co/games/Genshin-Impact",
        parser=parse_game8_guide,
    ),
    "genshingg": SourceConfig(
        slug="genshingg",
        display_name="Genshin.gg",
        base_url="https://genshin.gg/characters/{slug}/",
        parser=parse_genshingg_guide,
    ),
    "gamewith": SourceConfig(
        slug="gamewith",
        display_name="GameWith",
        base_url="https://gamewith.net/genshin-impact/",
        parser=parse_gamewith_guide,
    ),
    "helper_sheet": SourceConfig(
        slug="helper_sheet",
        display_name="Helper Sheet",
        base_url="https://docs.google.com/spreadsheets/d/1gNxZ2xab1J6o1TuNVWMeLOZ7TPOqrsf3SshP5DLvKzI",
        parser=None,
    ),
}


def get_source(slug: str) -> SourceConfig:
    if slug not in SOURCES:
        raise ValueError(f"Fonte desconhecida: {slug!r}. Disponíveis: {', '.join(SOURCES)}")
    return SOURCES[slug]
