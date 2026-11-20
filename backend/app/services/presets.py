"""Seleção determinística do melhor preset de build por personagem.

Quando um personagem possui presets de múltiplas fontes (ex.: KQM, Game8,
GameWith, Genshin.gg e Helper Sheet), priorizamos guias mais completos em vez
de depender da ordem arbitrária do banco (`first()`).
"""
from sqlalchemy.orm import Session

from ..models import CharacterBuildPreset

# Ordem de preferência por fonte (menor = maior prioridade)
PRESET_SOURCE_PRIORITY: dict[str, int] = {
    "kqm build": 0,
    "game8 build": 1,
    "gamewith build": 2,
    "genshin.gg build": 3,
    "helper sheet build": 4,
}


def has_build_content(data: dict | None) -> bool:
    if not data or not isinstance(data, dict):
        return False
    list_keys = (
        "weapons", "artifacts_4pc", "artifacts_2pc",
        "sands_stat", "goblet_stat", "circlet_stat",
        "substat_priority", "combos", "references",
    )
    if any(bool(data.get(k)) for k in list_keys):
        return True
    return any(bool(data.get(k)) for k in ("er_requirement", "talent_priority", "notes"))


def preset_sort_key(preset: CharacterBuildPreset) -> tuple[int, int]:
    name_norm = (preset.name or "").strip().lower()
    rank = PRESET_SOURCE_PRIORITY.get(name_norm, 10)
    return (rank, preset.id or 0)


def pick_best_from_list(presets: list[CharacterBuildPreset]) -> CharacterBuildPreset | None:
    valid = [p for p in presets if has_build_content(p.build_data)]
    if not valid:
        return None
    valid.sort(key=preset_sort_key)
    return valid[0]


def pick_best_preset(db: Session, character_id: int) -> CharacterBuildPreset | None:
    presets = (
        db.query(CharacterBuildPreset)
        .filter(CharacterBuildPreset.character_id == character_id)
        .all()
    )
    return pick_best_from_list(presets)


def pick_best_presets_batch(
    db: Session,
    character_ids: list[int],
) -> dict[int, CharacterBuildPreset]:
    if not character_ids:
        return {}
    rows = (
        db.query(CharacterBuildPreset)
        .filter(CharacterBuildPreset.character_id.in_(set(character_ids)))
        .all()
    )
    by_char: dict[int, list[CharacterBuildPreset]] = {}
    for row in rows:
        by_char.setdefault(row.character_id, []).append(row)
    out: dict[int, CharacterBuildPreset] = {}
    for cid, plist in by_char.items():
        best = pick_best_from_list(plist)
        if best is not None:
            out[cid] = best
    return out
