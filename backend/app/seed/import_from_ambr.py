"""Importa personagens do Project Amber com suporte multi-idioma.

Endpoint base: https://gi.yatta.moe/api/v2
Canonical (name/slug): en.
Traduções: definidas em AMBR_LANGS (padrão: pt,es).

Uso:
    docker compose exec backend python -m app.seed.import_from_ambr
    AMBR_LANGS=pt,es,fr docker compose exec backend python -m app.seed.import_from_ambr
    AMBR_MAX_CHARACTERS=0 docker compose exec backend python -m app.seed.import_from_ambr  # todos

O ``vh`` (version hash) muda a cada patch. Se o endpoint retornar 404,
atualize ``VH`` consultando o site do Project Amber.
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
    Element,
    WeaponType,
    StatType,
    Region,
    Language,
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
REQUEST_DELAY = 0.3
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


async def fetch_json(client: httpx.AsyncClient, path: str) -> dict[str, Any] | None:
    url = f"{AMBR_BASE}{API_PATH}{path}"
    try:
        resp = await client.get(url, timeout=30.0)
        resp.raise_for_status()
        return resp.json()
    except Exception as exc:
        print(f"[ambr] erro {path}: {exc}")
        return None


async def fetch_character_ids(client: httpx.AsyncClient) -> list[int]:
    data = await fetch_json(client, f"/{CANONICAL_LANG}/avatar?vh={VH}")
    if not data:
        return []
    items = (data.get("data") or {}).get("items") or {}
    return sorted(int(k) for k in items.keys() if str(k).isdigit())


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
    max_hp, max_atk, max_def = base_hp, base_atk, base_def  # TODO: aplicar curva

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


def upsert_translation(db: Session, char: Character, payload: dict[str, Any]) -> str:
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
        return "updated"
    db.add(CharacterTranslation(character_id=char.id, **payload))
    return "inserted"


async def main() -> None:
    async with httpx.AsyncClient(headers=HEADERS, follow_redirects=True) as client:
        ids = await fetch_character_ids(client)
        if not ids:
            print("[ambr] nenhum personagem retornado; abortando.")
            return
        if MAX_CHARACTERS is not None:
            ids = ids[:MAX_CHARACTERS]
        print(f"[ambr] {len(ids)} personagens | canônico={CANONICAL_LANG} | traduções={TRANSLATION_LANGS}")

        db = SessionLocal()
        try:
            for i, cid in enumerate(ids, 1):
                raw = await fetch_json(client, f"/{CANONICAL_LANG}/avatar/{cid}?vh={VH}")
                if not raw:
                    continue
                payload = parse_canonical(raw.get("data") or {})
                if not payload:
                    continue

                char = upsert_character(db, payload)
                print(f"[ambr] [{i}/{len(ids)}] {char.slug} (canonical)")

                for lang_code in TRANSLATION_LANGS:
                    if lang_code == CANONICAL_LANG:
                        continue
                    raw_lang = await fetch_json(
                        client, f"/{lang_code}/avatar/{cid}?vh={VH}"
                    )
                    if not raw_lang:
                        continue
                    trans = parse_translation(raw_lang.get("data") or {}, lang_code)
                    if trans:
                        status = upsert_translation(db, char, trans)
                        print(f"[ambr]   ↳ {lang_code}: {status}")
                    await asyncio.sleep(REQUEST_DELAY)
                await asyncio.sleep(REQUEST_DELAY)

            db.commit()
            total = db.query(Character).count()
            trans_total = db.query(CharacterTranslation).count()
            print(f"[ambr] concluído. Characters={total}  Translations={trans_total}")
        finally:
            db.close()


if __name__ == "__main__":
    asyncio.run(main())
