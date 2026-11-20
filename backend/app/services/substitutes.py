"""Serviço unificado de sugestões de substitutos por slot de time.

Combina:
  1. Alternativas explícitas do guia (barras '/' em Example Teams e Notable Teammates)
  2. Fallback inteligente por role/capability + elemento (usando CHARACTER_CAPABILITIES),
     sempre excluindo personagens que já estão no time e respeitando restrições de elemento
     (ex.: Skirk/Escoffier -> apenas Cryo/Hydro).
"""
from typing import Any
from sqlalchemy.orm import Session

from ..models import Character
from .synergy import CHARACTER_CAPABILITIES, classify_role


ROLE_LABELS: dict[str, str] = {
    "healer_active": "Healer",
    "shielder": "Shielder",
    "res_shred": "RES Shred",
    "buffer": "Buffer",
    "off_field_dps": "Sub-DPS",
    "on_field_dps": "Main DPS",
}

# Personagens DPS principais que não devem ser substituídos automaticamente nem sugeridos como flex
DPS_SLUGS: set[str] = {
    slug for slug, caps in CHARACTER_CAPABILITIES.items()
    if "on_field_dps" in caps and "buffer" not in caps and "healer_active" not in caps
} | {
    "neuvillette", "mualani", "ayato", "kamisato-ayato",
    "arlecchino", "hu-tao", "hutao", "yoimiya", "lyney", "klee",
    "diluc", "gaming", "mavuika", "yanfei",
    "skirk", "wriothesley", "ganyu", "ayaka", "kamisato-ayaka",
    "eula", "freminet",
    "clorinde", "cyno", "sethos", "razor",
    "xiao", "wanderer", "shikanoin-heizou",
    "itto", "arataki-itto", "navia", "ningguang",
    "alhaitham", "tighnari", "kinich",
    "chasca", "varesa",
}


def format_capability_label(slug: str, char: Character | None = None) -> str:
    caps = CHARACTER_CAPABILITIES.get(slug, [])
    labels = [ROLE_LABELS[c] for c in ("healer_active", "shielder", "res_shred", "buffer", "off_field_dps") if c in caps]
    if labels:
        return " · ".join(labels[:2])
    if char is not None:
        role = classify_role(char)
        return {
            "healer": "Healer",
            "shielder": "Shielder",
            "sub": "Sub-DPS",
            "support": "Suporte",
            "dps": "DPS",
        }.get(role, "Suporte")
    return "Suporte"


def _element_str(char: Character) -> str:
    return char.element.value if hasattr(char.element, "value") else str(char.element)


def _capability_overlap(slug_a: str, slug_b: str) -> int:
    caps_a = set(CHARACTER_CAPABILITIES.get(slug_a, []))
    caps_b = set(CHARACTER_CAPABILITIES.get(slug_b, []))
    return len(caps_a & caps_b)


def suggest_substitutes_for_slot(
    db: Session,
    target_char: Character,
    team_slugs: set[str],
    curated_alternatives: list[str] | None = None,
    teammate_notes: dict[str, dict[str, str]] | None = None,
    limit: int = 6,
) -> list[dict[str, Any]]:
    """Retorna até `limit` substitutos curados + fallback inteligente para um slot.

    - Nunca sugere personagens já presentes em `team_slugs` (incluindo o próprio slot).
    - Prioriza:
      1) `curated_alternatives` vindos das barras '/' do guia (com nota de `teammate_notes` se existir)
      2) `teammate_notes` (Notable Teammates do guia) do mesmo elemento ou mesma capability
      3) Fallback do banco (mesmo elemento, não-DPS, ordenado por sobreposição de capability)
    """
    teammate_notes = teammate_notes or {}
    excluded = set(team_slugs) | {target_char.slug}
    target_el = _element_str(target_char)
    cryo_hydro_only = bool({"skirk", "escoffier"} & team_slugs)

    results: list[dict[str, Any]] = []
    added: set[str] = set()

    # Pré-carrega candidatos do banco para lookup rápido de elemento/nome
    all_chars = db.query(Character).all()
    by_slug = {c.slug: c for c in all_chars}

    def _allowed(slug: str) -> bool:
        if slug in excluded or slug in added:
            return False
        c = by_slug.get(slug)
        if not c:
            return False
        if cryo_hydro_only and _element_str(c) not in ("cryo", "hydro"):
            return False
        return True

    # 1) Alternativas diretas da linha do time (ex.: "Mona / Shenhe / Yelan")
    for alt_slug in curated_alternatives or []:
        if len(results) >= limit:
            break
        if not _allowed(alt_slug):
            continue
        info = teammate_notes.get(alt_slug)
        c = by_slug[alt_slug]
        label = (info.get("category") if info else None) or format_capability_label(alt_slug, c)
        notes = (info.get("notes") if info else None) or f"Alternativa direta sugerida pelo guia ({_element_str(c).capitalize()})"
        results.append({
            "character_slug": alt_slug,
            "build_label": label,
            "notes": notes,
        })
        added.add(alt_slug)

    # 2) Notable Teammates do guia compatíveis (mesmo elemento ou sobreposição de capability, não-DPS)
    if teammate_notes and len(results) < limit:
        nt_candidates = []
        for nt_slug, info in teammate_notes.items():
            if not _allowed(nt_slug) or nt_slug in DPS_SLUGS:
                continue
            c = by_slug[nt_slug]
            same_el = _element_str(c) == target_el
            overlap = _capability_overlap(target_char.slug, nt_slug)
            if not same_el and overlap == 0:
                continue
            nt_candidates.append((0 if same_el else 1, -overlap, c.name, nt_slug, info))

        nt_candidates.sort()
        for _, _, _, nt_slug, info in nt_candidates:
            if len(results) >= limit:
                break
            c = by_slug[nt_slug]
            results.append({
                "character_slug": nt_slug,
                "build_label": info.get("category") or format_capability_label(nt_slug, c),
                "notes": info.get("notes") or f"Alternativa {_element_str(c).capitalize()}",
            })
            added.add(nt_slug)

    # 3) Fallback do banco: mesmo elemento, não-DPS, ordenado por capability overlap
    if len(results) < limit:
        db_candidates = []
        for c in all_chars:
            if not _allowed(c.slug) or c.slug in DPS_SLUGS:
                continue
            if _element_str(c) != target_el:
                continue
            overlap = _capability_overlap(target_char.slug, c.slug)
            has_known_cap = 0 if c.slug in CHARACTER_CAPABILITIES else 1
            db_candidates.append((-overlap, has_known_cap, c.name, c))

        db_candidates.sort()
        for _, _, _, c in db_candidates:
            if len(results) >= limit:
                break
            label = format_capability_label(c.slug, c)
            results.append({
                "character_slug": c.slug,
                "build_label": label,
                "notes": f"Alternativa {_element_str(c).capitalize()} ({label})",
            })
            added.add(c.slug)

    return results


def compute_slot_substitutes_for_slugs(
    db: Session,
    character_slugs: list[str],
    main_character: str | None = None,
    slot_alternatives: dict[str, list[str]] | None = None,
    teammate_notes: dict[str, dict[str, str]] | None = None,
    limit: int = 6,
) -> dict[int, list[dict[str, Any]]]:
    """Calcula mapa `{position: [Substitute, ...]}` para um time de slugs.

    Slot 1 (main) e DPS puros não recebem substitutos automáticos (salvo se houver
    alternativa explícita com '/' no guia para aquele slot).
    """
    if not character_slugs:
        return {}

    chars = db.query(Character).filter(Character.slug.in_(character_slugs)).all()
    by_slug = {c.slug: c for c in chars}
    team_set = set(character_slugs)
    slot_alternatives = slot_alternatives or {}

    out: dict[int, list[dict[str, Any]]] = {}
    for pos, slug in enumerate(character_slugs, start=1):
        char = by_slug.get(slug)
        if not char:
            continue
        curated = slot_alternatives.get(str(pos)) or []
        is_main = (pos == 1) or (main_character is not None and slug == main_character)
        if (is_main or slug in DPS_SLUGS) and not curated:
            out[pos] = []
            continue
        out[pos] = suggest_substitutes_for_slot(
            db,
            char,
            team_slugs=team_set,
            curated_alternatives=curated,
            teammate_notes=teammate_notes,
            limit=limit,
        )
    return out
