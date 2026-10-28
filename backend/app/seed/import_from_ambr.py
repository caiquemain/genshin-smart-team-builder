"""Importa personagens, materiais, ascensão e traduções do Project Amber.

Estratégia: paralelização em 5 fases.

  Fase 1 — lista de IDs de personagens (1 request)
  Fase 2 — avatares em paralelo (N × 3 langs, Semaphore)
  Fase 3 — extrai ambr_ids únicos de costItems
  Fase 4 — materiais em paralelo (M × 3 langs, Semaphore)
  Fase 5 — persistência no DB (serial, sem awaits)

Isso reduz o import de ~140s (N+1 sequencial) para ~15-20s.

Endpoint base: https://gi.yatta.moe/api/v2

Uso:
    docker compose exec backend python -m app.seed.import_from_ambr
    AMBR_MAX_CHARACTERS=0 docker compose exec backend python -m app.seed.import_from_ambr
    AMBR_CONCURRENCY=12 docker compose exec backend python -m app.seed.import_from_ambr
"""
import asyncio
import os
import re
from typing import Any

import httpx
from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..models import (
    Character,
    CharacterTranslation,
    CharacterAscensionMaterial,
    CharacterAscensionPhase,
    CharacterTalentPhase,
    Material,
    MaterialTranslation,
    Element,
    WeaponType,
    StatType,
    Region,
    Language,
    MaterialCategory,
    TalentType,
)

AMBR_BASE = "https://gi.yatta.moe"
API_PATH = "/api/v2"
VH = "32F2"

CANONICAL_LANG = "en"
TRANSLATION_LANGS = [
    s.strip() for s in os.getenv("AMBR_LANGS", "pt,es").split(",") if s.strip()
]

_max_raw = os.getenv("AMBR_MAX_CHARACTERS", "10")
MAX_CHARACTERS = int(_max_raw) if _max_raw.isdigit() and int(_max_raw) > 0 else None
CONCURRENCY = int(os.getenv("AMBR_CONCURRENCY", "8"))
REQUEST_DELAY = float(os.getenv("AMBR_REQUEST_DELAY", "0.02"))
HEADERS = {"User-Agent": "GenshinSmartTeamBuilder/0.1 (educational, fan-made)"}

ELEMENT_MAP = {
    "fire": Element.PYRO, "pyro": Element.PYRO,
    "water": Element.HYDRO, "hydro": Element.HYDRO,
    "electric": Element.ELECTRO, "electro": Element.ELECTRO,
    "ice": Element.CRYO, "cryo": Element.CRYO,
    "wind": Element.ANEMO, "anemo": Element.ANEMO,
    "rock": Element.GEO, "geo": Element.GEO,
    "grass": Element.DENDRO, "dendro": Element.DENDRO,
}

WEAPON_MAP = {
    "WEAPON_SWORD_ONE_HAND": WeaponType.SWORD,
    "WEAPON_CLAYMORE": WeaponType.CLAYMORE,
    "WEAPON_POLE": WeaponType.POLEARM,
    "WEAPON_BOW": WeaponType.BOW,
    "WEAPON_CATALYST": WeaponType.CATALYST,
}

REGION_MAP = {
    "MONDSTADT": Region.MONDSTADT,
    "LIYUE": Region.LIYUE,
    "INAZUMA": Region.INAZUMA,
    "SUMERU": Region.SUMERU,
    "FONTAINE": Region.FONTAINE,
    "NATLAN": Region.NATLAN,
    "SNEZHNAYA": Region.SNEZHNAYA,
}

STAT_MAP = {
    "FIGHT_PROP_CRITICAL": StatType.CRIT_RATE,
    "FIGHT_PROP_CRITICAL_HURT": StatType.CRIT_DMG,
    "FIGHT_PROP_ATTACK_PERCENT": StatType.ATK_PCT,
    "FIGHT_PROP_HP_PERCENT": StatType.HP_PCT,
    "FIGHT_PROP_DEFENSE_PERCENT": StatType.DEF_PCT,
    "FIGHT_PROP_ELEMENT_MASTERY": StatType.EM,
    "FIGHT_PROP_CHARGE_EFFICIENCY": StatType.ER,
    "FIGHT_PROP_HEAL_ADD": StatType.HEALING_BONUS,
    "FIGHT_PROP_PHYSICAL_ADD_HURT": StatType.PHYSICAL_DMG,
    "FIGHT_PROP_FIRE_ADD_HURT": StatType.PYRO_DMG,
    "FIGHT_PROP_WATER_ADD_HURT": StatType.HYDRO_DMG,
    "FIGHT_PROP_ELEC_ADD_HURT": StatType.ELECTRO_DMG,
    "FIGHT_PROP_ICE_ADD_HURT": StatType.CRYO_DMG,
    "FIGHT_PROP_WIND_ADD_HURT": StatType.ANEMO_DMG,
    "FIGHT_PROP_ROCK_ADD_HURT": StatType.GEO_DMG,
    "FIGHT_PROP_GRASS_ADD_HURT": StatType.DENDRO_DMG,
}


def slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def map_material_category(type_raw: str | None) -> MaterialCategory:
    if not type_raw:
        return MaterialCategory.COMMON_DROP
    t = type_raw.lower()
    if "local specialty" in t:
        return MaterialCategory.LOCAL_SPECIALTY
    if "weekly boss" in t:
        return MaterialCategory.WEEKLY_BOSS
    if "crown" in t:
        return MaterialCategory.CROWN
    if "talent" in t and ("book" in t or "teaching" in t or "guide" in t or "philosoph" in t):
        return MaterialCategory.TALENT_BOOK
    if "weapon" in t and "ascension" in t:
        return MaterialCategory.WEAPON_ASCENSION
    if "character ascension" in t:
        return MaterialCategory.ASCENSION_GEM
    if "boss" in t:
        return MaterialCategory.BOSS_MATERIAL
    if "enhancement ore" in t or "experience" in t or "exp" in t:
        return MaterialCategory.CHARACTER_EXP
    return MaterialCategory.COMMON_DROP


async def fetch_json(client: httpx.AsyncClient, path: str) -> dict[str, Any] | None:
    url = f"{AMBR_BASE}{API_PATH}{path}"
    try:
        resp = await client.get(url, timeout=30.0)
        resp.raise_for_status()
        return resp.json()
    except Exception as exc:
        print(f"[ambr] erro {path}: {exc}")
        return None


async def fetch_many(
    client: httpx.AsyncClient,
    paths: list[str],
    sem: asyncio.Semaphore,
    delay: float,
) -> dict[str, dict[str, Any] | None]:
    """Fetch paralelo de várias paths, respeitando semáforo e delay."""
    async def _one(p: str) -> tuple[str, dict[str, Any] | None]:
        async with sem:
            await asyncio.sleep(delay)
            return p, await fetch_json(client, p)

    results = await asyncio.gather(*[_one(p) for p in paths])
    return dict(results)


async def fetch_character_ids(client: httpx.AsyncClient) -> list[int]:
    data = await fetch_json(client, f"/{CANONICAL_LANG}/avatar?vh={VH}")
    if not data:
        return []
    items = (data.get("data") or {}).get("items") or {}
    return sorted(int(k) for k in items.keys() if str(k).isdigit())


# =============================================================
# Parsers (puros, sem DB)
# =============================================================

def parse_canonical(raw: dict[str, Any]) -> dict[str, Any] | None:
    name = raw.get("name")
    if not name:
        return None
    upgrade = raw.get("upgrade") or {}
    base_values: dict[str, float] = {}
    for p in upgrade.get("prop") or []:
        if isinstance(p, dict) and p.get("propType"):
            base_values[p["propType"]] = p.get("initValue") or 0

    base_hp = int(round(base_values.get("FIGHT_PROP_BASE_HP", 0)))
    base_atk = int(round(base_values.get("FIGHT_PROP_BASE_ATTACK", 0)))
    base_def = int(round(base_values.get("FIGHT_PROP_BASE_DEFENSE", 0)))
    max_hp, max_atk, max_def = base_hp, base_atk, base_def  # TODO: curva de nível 90

    birthday = raw.get("birthday") or []
    birthday_str = (
        f"{int(birthday[0]):02d}-{int(birthday[1]):02d}"
        if isinstance(birthday, list) and len(birthday) == 2
        else None
    )

    element = ELEMENT_MAP.get((raw.get("element") or "").lower())
    weapon_type = WEAPON_MAP.get(raw.get("weaponType") or "")
    region = REGION_MAP.get((raw.get("region") or "").upper())
    if not element or not weapon_type:
        print(f"[ambr] pulando {name}: element={raw.get('element')} weapon={raw.get('weaponType')}")
        return None

    return {
        "name": name,
        "slug": slugify(name),
        "icon": raw.get("icon"),
        "rarity": raw.get("rank"),
        "element": element,
        "weapon_type": weapon_type,
        "region": region,
        "birthday": birthday_str,
        "base_hp": base_hp,
        "base_atk": base_atk,
        "base_def": base_def,
        "max_hp": max_hp,
        "max_atk": max_atk,
        "max_def": max_def,
        "ascension_stat": STAT_MAP.get(raw.get("specialProp") or ""),
        "ascension_stat_value": None,
    }


def parse_translation(raw: dict[str, Any], lang_code: str) -> dict[str, Any] | None:
    name = raw.get("name")
    if not name:
        return None
    try:
        lang_enum = Language(lang_code)
    except ValueError:
        return None
    fetter = raw.get("fetter") or {}
    return {
        "language": lang_enum,
        "name": name,
        "title": fetter.get("title"),
        "description": fetter.get("detail"),
        "constellation_name": fetter.get("constellation"),
    }


def parse_promote(raw: dict[str, Any]) -> list[dict[str, Any]]:
    upgrade = raw.get("upgrade") or {}
    phases = upgrade.get("promote") or []
    result: list[dict[str, Any]] = []
    for p in phases:
        if not isinstance(p, dict):
            continue
        cost_items = p.get("costItems") or {}
        if not cost_items:
            continue
        promote_level = p.get("promoteLevel")
        if not promote_level:
            continue
        result.append({
            "promote_level": int(promote_level),
            "unlock_max_level": int(p.get("unlockMaxLevel") or 0),
            "mora": int(p.get("coinCost") or 0),
            "items": {int(k): int(v) for k, v in cost_items.items()},
        })
    result.sort(key=lambda x: x["promote_level"])
    return result


TALENT_ORDER = [
    TalentType.NORMAL_ATTACK,
    TalentType.ELEMENTAL_SKILL,
    TalentType.ELEMENTAL_BURST,
]


def parse_talent(raw: dict[str, Any]) -> list[dict[str, Any]]:
    """Extrai os 3 talentos upáveis (na ordem: normal, skill, burst).

    Cada item retornado:
      {talent_type, phases: [{level, mora, items: {ambr_id: qty}}, ...]}
    """
    talent_map = raw.get("talent") or {}
    entries = []
    for key in sorted(talent_map.keys(), key=lambda x: int(x) if str(x).isdigit() else 9999):
        t = talent_map.get(key) or {}
        promote = t.get("promote") or {}
        phases = []
        for lvl_str, phase in promote.items():
            if not isinstance(phase, dict):
                continue
            cost_items = phase.get("costItems") or {}
            if not cost_items:
                continue
            try:
                lvl = int(lvl_str)
            except (TypeError, ValueError):
                continue
            phases.append({
                "level": lvl,
                "mora": int(phase.get("coinCost") or 0),
                "items": {int(k): int(v) for k, v in cost_items.items()},
            })
        if phases:
            phases.sort(key=lambda p: p["level"])
            entries.append(phases)
    result = []
    for idx, phases in enumerate(entries[:3]):
        result.append({
            "talent_type": TALENT_ORDER[idx],
            "phases": phases,
        })
    return result


def parse_material(raw: dict[str, Any], ambr_id: int) -> dict[str, Any] | None:
    name = raw.get("name")
    if not name:
        return None
    source_list = raw.get("source") or []
    first_source = source_list[0].get("name") if source_list and isinstance(source_list[0], dict) else None
    return {
        "ambr_id": ambr_id,
        "slug": slugify(name),
        "name": name,
        "category": map_material_category(raw.get("type")),
        "type_raw": raw.get("type"),
        "rarity": raw.get("rank"),
        "icon": raw.get("icon"),
        "source": first_source,
        "description": raw.get("description"),
    }


def parse_material_translation(raw: dict[str, Any], lang_code: str) -> dict[str, Any] | None:
    name = raw.get("name")
    if not name:
        return None
    try:
        lang_enum = Language(lang_code)
    except ValueError:
        return None
    sources = raw.get("source") or []
    first_source = sources[0].get("name") if sources and isinstance(sources[0], dict) else None
    return {
        "language": lang_enum,
        "name": name,
        "description": raw.get("description"),
        "source": first_source,
    }


# =============================================================
# Persistência (serial, sem awaits)
# =============================================================

def upsert_character(db: Session, payload: dict[str, Any]) -> Character:
    existing = db.query(Character).filter(Character.slug == payload["slug"]).one_or_none()
    if existing:
        for k, v in payload.items():
            setattr(existing, k, v)
        db.flush()
        return existing
    char = Character(**payload)
    db.add(char)
    db.flush()
    return char


def upsert_translation(db: Session, char: Character, payload: dict[str, Any]) -> None:
    existing = (
        db.query(CharacterTranslation)
        .filter(
            CharacterTranslation.character_id == char.id,
            CharacterTranslation.language == payload["language"],
        )
        .one_or_none()
    )
    if existing:
        for k, v in payload.items():
            setattr(existing, k, v)
    else:
        db.add(CharacterTranslation(character_id=char.id, **payload))


# =============================================================
# Main
# =============================================================

async def main() -> None:
    async with httpx.AsyncClient(headers=HEADERS, follow_redirects=True) as client:
        sem = asyncio.Semaphore(CONCURRENCY)

        # Fase 1
        ids = await fetch_character_ids(client)
        if not ids:
            print("[ambr] nenhum personagem retornado; abortando.")
            return
        if MAX_CHARACTERS is not None:
            ids = ids[:MAX_CHARACTERS]
        all_langs = [CANONICAL_LANG] + TRANSLATION_LANGS
        print(f"[ambr] {len(ids)} personagens | langs={all_langs} | concurrency={CONCURRENCY}")

        # Fase 2: avatares em paralelo
        avatar_paths = [
            f"/{lang}/avatar/{cid}?vh={VH}" for cid in ids for lang in all_langs
        ]
        print(f"[ambr] baixando {len(avatar_paths)} avatares em paralelo...")
        avatars_raw = await fetch_many(client, avatar_paths, sem, REQUEST_DELAY)

        # Fase 3: extrair ambr_ids únicos (ascensão + talentos)
        material_ids: set[int] = set()
        for cid in ids:
            en_data = (avatars_raw.get(f"/{CANONICAL_LANG}/avatar/{cid}?vh={VH}") or {}).get("data") or {}
            for phase in parse_promote(en_data):
                material_ids.update(phase["items"].keys())
            for talent in parse_talent(en_data):
                for phase in talent["phases"]:
                    material_ids.update(phase["items"].keys())
        print(f"[ambr] {len(material_ids)} materiais únicos para baixar")

        # Fase 4: materiais em paralelo
        mat_paths = [
            f"/{lang}/material/{mid}?vh={VH}" for mid in material_ids for lang in all_langs
        ]
        print(f"[ambr] baixando {len(mat_paths)} materiais em paralelo...")
        mats_raw = await fetch_many(client, mat_paths, sem, REQUEST_DELAY)

        # Fase 5: persistência serial
        print("[ambr] persistindo no DB...")
        db = SessionLocal()
        try:
            # 5a) Materiais (idempotente por ambr_id)
            material_by_ambr: dict[int, Material] = {}
            for mid in material_ids:
                existing = db.query(Material).filter(Material.ambr_id == mid).one_or_none()
                if existing:
                    material_by_ambr[mid] = existing
                    mat = existing
                else:
                    en_raw = (mats_raw.get(f"/{CANONICAL_LANG}/material/{mid}?vh={VH}") or {}).get("data") or {}
                    payload = parse_material(en_raw, mid)
                    if not payload:
                        print(f"[ambr] material {mid} inválido; pulando")
                        continue
                    if db.query(Material).filter(Material.slug == payload["slug"]).one_or_none():
                        payload["slug"] = f"{payload['slug']}-{mid}"
                    mat = Material(**payload)
                    db.add(mat)
                    db.flush()
                    material_by_ambr[mid] = mat

                for lang in TRANSLATION_LANGS:
                    lang_raw = (mats_raw.get(f"/{lang}/material/{mid}?vh={VH}") or {}).get("data") or {}
                    trans = parse_material_translation(lang_raw, lang)
                    if not trans:
                        continue
                    existing_t = (
                        db.query(MaterialTranslation)
                        .filter(
                            MaterialTranslation.material_id == mat.id,
                            MaterialTranslation.language == trans["language"],
                        )
                        .one_or_none()
                    )
                    if existing_t:
                        for k, v in trans.items():
                            setattr(existing_t, k, v)
                    else:
                        db.add(MaterialTranslation(material_id=mat.id, **trans))

            print(f"[ambr] {len(material_by_ambr)} materiais criados")

            # 5b) Personagens
            for i, cid in enumerate(ids, 1):
                en_raw = (avatars_raw.get(f"/{CANONICAL_LANG}/avatar/{cid}?vh={VH}") or {}).get("data") or {}
                payload = parse_canonical(en_raw)
                if not payload:
                    continue
                char = upsert_character(db, payload)
                print(f"[ambr] [{i}/{len(ids)}] {char.slug}")

                for lang in TRANSLATION_LANGS:
                    lang_raw = (avatars_raw.get(f"/{lang}/avatar/{cid}?vh={VH}") or {}).get("data") or {}
                    trans = parse_translation(lang_raw, lang)
                    if trans:
                        upsert_translation(db, char, trans)

                phases = parse_promote(en_raw)
                db.query(CharacterAscensionMaterial).filter_by(character_id=char.id).delete()
                db.query(CharacterAscensionPhase).filter_by(character_id=char.id).delete()
                db.query(CharacterTalentPhase).filter_by(character_id=char.id).delete()
                from ..models import CharacterTalentMaterial
                db.query(CharacterTalentMaterial).filter_by(character_id=char.id).delete()
                for phase in phases:
                    db.add(CharacterAscensionPhase(
                        character_id=char.id,
                        phase=phase["promote_level"],
                        unlock_max_level=phase["unlock_max_level"],
                        mora=phase["mora"],
                    ))
                    for mid, qty in phase["items"].items():
                        mat = material_by_ambr.get(mid)
                        if mat:
                            db.add(CharacterAscensionMaterial(
                                character_id=char.id,
                                material_id=mat.id,
                                quantity=qty,
                                phase=phase["promote_level"],
                            ))

                for talent in parse_talent(en_raw):
                    ttype = talent["talent_type"]
                    for phase in talent["phases"]:
                        db.add(CharacterTalentPhase(
                            character_id=char.id,
                            talent_type=ttype,
                            level=phase["level"],
                            mora=phase["mora"],
                        ))
                        for mid, qty in phase["items"].items():
                            mat = material_by_ambr.get(mid)
                            if mat:
                                db.add(CharacterTalentMaterial(
                                    character_id=char.id,
                                    material_id=mat.id,
                                    quantity=qty,
                                    talent_type=ttype,
                                    level=phase["level"],
                                ))

            db.commit()
            total_chars = db.query(Character).count()
            total_trans = db.query(CharacterTranslation).count()
            total_mats = db.query(Material).filter(Material.ambr_id.isnot(None)).count()
            total_asc = db.query(CharacterAscensionMaterial).count()
            total_phases = db.query(CharacterAscensionPhase).count()
            total_talent_phases = db.query(CharacterTalentPhase).count()
            print(
                f"[ambr] concluído. Characters={total_chars}  Translations={total_trans}  "
                f"Materials={total_mats}  AscensionLinks={total_asc}  Phases={total_phases}"
            )
        finally:
            db.close()


if __name__ == "__main__":
    asyncio.run(main())
