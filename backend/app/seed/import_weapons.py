"""Importer de armas do Project Amber.

Estratégia paralelizada (mesmo padrão do import_from_ambr.py):
  Fase 1 — lista de armas (1 request)
  Fase 2 — detalhes em paralelo (N × 3 langs)
  Fase 3 — persistência serial (Weapon + WeaponTranslation)

Uso:
    docker compose exec backend python -m app.seed.import_weapons
    AMBR_LANGS=pt,es,fr docker compose exec backend python -m app.seed.import_weapons
    AMBR_MAX_WEAPONS=0 docker compose exec backend python -m app.seed.import_weapons  # todas
"""
import asyncio
import os
import re
from typing import Any

import httpx
from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..models import (
    Weapon,
    WeaponTranslation,
    WeaponType,
    StatType,
    Language,
    Material,
    MaterialTranslation,
    WeaponAscensionMaterial,
    WeaponAscensionPhase,
)

# Reusa parsers do importer de personagens (funções puras, sem estado)
from .import_from_ambr import parse_material, parse_material_translation

AMBR_BASE = "https://gi.yatta.moe"
API_PATH = "/api/v2"
VH = "32F6"  # hash da versão das armas (diferente do /avatar)
VH_MATERIAL = "32F2"  # materiais usam o mesmo hash dos personagens

CANONICAL_LANG = "en"
TRANSLATION_LANGS = [
    s.strip() for s in os.getenv("AMBR_LANGS", "pt,es").split(",") if s.strip()
]

_max_raw = os.getenv("AMBR_MAX_WEAPONS", "0")
MAX_WEAPONS = int(_max_raw) if _max_raw.isdigit() and int(_max_raw) > 0 else None
CONCURRENCY = int(os.getenv("AMBR_CONCURRENCY", "8"))
REQUEST_DELAY = float(os.getenv("AMBR_REQUEST_DELAY", "0.02"))
HEADERS = {"User-Agent": "GenshinSmartTeamBuilder/0.1 (educational, fan-made)"}

# "Sword", "Claymore", "Catalyst", "Polearm", "Bow"
WEAPON_TYPE_MAP = {
    "sword": WeaponType.SWORD,
    "claymore": WeaponType.CLAYMORE,
    "catalyst": WeaponType.CATALYST,
    "polearm": WeaponType.POLEARM,
    "bow": WeaponType.BOW,
}

# Stat props que devem ser multiplicadas por 100 (são frações 0.0-1.0)
PERCENT_PROPS = {
    "FIGHT_PROP_CRITICAL_HURT",
    "FIGHT_PROP_CRITICAL",
    "FIGHT_PROP_ATTACK_PERCENT",
    "FIGHT_PROP_HP_PERCENT",
    "FIGHT_PROP_DEFENSE_PERCENT",
    "FIGHT_PROP_CHARGE_EFFICIENCY",
    "FIGHT_PROP_HEAL_ADD",
    "FIGHT_PROP_PHYSICAL_ADD_HURT",
    "FIGHT_PROP_FIRE_ADD_HURT",
    "FIGHT_PROP_WATER_ADD_HURT",
    "FIGHT_PROP_ELEC_ADD_HURT",
    "FIGHT_PROP_ICE_ADD_HURT",
    "FIGHT_PROP_WIND_ADD_HURT",
    "FIGHT_PROP_ROCK_ADD_HURT",
    "FIGHT_PROP_GRASS_ADD_HURT",
}

STAT_MAP = {
    "FIGHT_PROP_HP": StatType.HP,
    "FIGHT_PROP_ATTACK": StatType.ATK,
    "FIGHT_PROP_DEFENSE": StatType.DEF,
    "FIGHT_PROP_HP_PERCENT": StatType.HP_PCT,
    "FIGHT_PROP_ATTACK_PERCENT": StatType.ATK_PCT,
    "FIGHT_PROP_DEFENSE_PERCENT": StatType.DEF_PCT,
    "FIGHT_PROP_ELEMENT_MASTERY": StatType.EM,
    "FIGHT_PROP_CHARGE_EFFICIENCY": StatType.ER,
    "FIGHT_PROP_CRITICAL": StatType.CRIT_RATE,
    "FIGHT_PROP_CRITICAL_HURT": StatType.CRIT_DMG,
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


def _format_number(prop_type: str, value: float) -> float:
    """Aplica 100x para percentuais (fração → %)."""
    if prop_type in PERCENT_PROPS:
        return round(value * 100, 2)
    return round(value, 2)


async def fetch_json(client: httpx.AsyncClient, path: str) -> dict[str, Any] | None:
    url = f"{AMBR_BASE}{API_PATH}{path}"
    try:
        resp = await client.get(url, timeout=30.0)
        resp.raise_for_status()
        return resp.json()
    except Exception as exc:
        print(f"[weapons] erro {path}: {exc}")
        return None


async def fetch_many(
    client: httpx.AsyncClient,
    paths: list[str],
    sem: asyncio.Semaphore,
    delay: float,
) -> dict[str, dict[str, Any] | None]:
    async def _one(p: str) -> tuple[str, dict[str, Any] | None]:
        async with sem:
            await asyncio.sleep(delay)
            return p, await fetch_json(client, p)
    results = await asyncio.gather(*[_one(p) for p in paths])
    return dict(results)


def parse_weapon_promote(raw: dict[str, Any]) -> list[dict[str, Any]]:
    """Extrai fases de ascensão do upgrade.promote[] da arma.

    Retorna [{promote_level, unlock_max_level, mora, items: {ambr_id: qty}}].
    promote[0] é o unlock-max-level 20 (fase 0, sem custo) — pulamos.
    """
    upgrade = raw.get("upgrade") or {}
    promote = upgrade.get("promote") or []
    if not isinstance(promote, list):
        return []
    result: list[dict[str, Any]] = []
    for p in promote:
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


async def fetch_material_json(client: httpx.AsyncClient, mid: int, lang: str) -> dict[str, Any] | None:
    url = f"{AMBR_BASE}{API_PATH}/{lang}/material/{mid}?vh={VH_MATERIAL}"
    try:
        resp = await client.get(url, timeout=20.0)
        resp.raise_for_status()
        return resp.json()
    except Exception:
        return None


async def fetch_weapon_ids(client: httpx.AsyncClient) -> list[int]:
    data = await fetch_json(client, f"/{CANONICAL_LANG}/weapon?vh={VH}")
    if not data:
        return []
    items = (data.get("data") or {}).get("items") or {}
    return sorted(int(k) for k in items.keys() if str(k).isdigit())



# Multiplicadores da curva de crescimento no nível 90.
# Baseado no dataset do gcsim/genshin-optimizer + validação empírica contra armas com stats Lv.90 conhecidos.
CURVE_M = {
    "GROW_CURVE_CRITICAL_201": 4.5972,  # substats (4★) — HP%, ER, EM, Crit
    "GROW_CURVE_CRITICAL_301": 4.5972,  # substats (5★) — HP%, CritDMG, EM, ER
    "GROW_CURVE_ATTACK_101": 7.34,     # 3★ approx (Silver Sword, Cool Steel)
    "GROW_CURVE_ATTACK_102": 8.31,     # 3★ (Traveler's Handy Sword, Halberd)
    "GROW_CURVE_ATTACK_104": 6.31,     # 3★ (Skyrider Sword, Bloodtainted)
    "GROW_CURVE_ATTACK_201": 8.3583,   # 4★ (The Flute, Royal, Lion's Roar, Favonius)
    "GROW_CURVE_ATTACK_202": 9.3609,   # 4★ (Prototype Rancour, Sapwood)
    "GROW_CURVE_ATTACK_203": 10.3043,  # 4★ (The Alley Flash, Wavebreaker's)
    "GROW_CURVE_ATTACK_204": 7.2662,   # 4★ (Favonius Sword, Sacrificial, Amenoma)
    "GROW_CURVE_ATTACK_301": 9.1714,   # 5★ (Skyward, Homa, Staff of Homa)
    "GROW_CURVE_ATTACK_302": 10.2510,  # 5★ (Aquila, Mistsplitter, Absolution)
    "GROW_CURVE_ATTACK_303": 11.2805,  # 5★ (Song of Broken Pines, Thousand Blazing)
    "GROW_CURVE_ATTACK_304": 8.5326,   # 5★ (Primordial Jade Cutter, Key of Khaj-Nisut, Light of Foliar)
}

def parse_weapon_canonical(raw: dict[str, Any]) -> dict[str, Any] | None:
    name = raw.get("name")
    if not name:
        return None

    weapon_type_raw = (raw.get("type") or "").strip().lower()
    weapon_type = WEAPON_TYPE_MAP.get(weapon_type_raw)
    if not weapon_type:
        print(f"[weapons] tipo desconhecido {weapon_type_raw!r} em {name}; pulando")
        return None

    # Stats base via upgrade.prop
    upgrade = raw.get("upgrade") or {}
    prop = upgrade.get("prop") or []
    base_atk = 0
    base_atk_raw = 0.0  # float raw para cálculo de max_base_atk
    secondary_stat: StatType | None = None
    secondary_value: float | None = None
    secondary_curve: str | None = None
    for p in prop:
        if not isinstance(p, dict):
            continue
        prop_type = p.get("propType")
        val = p.get("initValue") or 0
        if prop_type == "FIGHT_PROP_BASE_ATTACK":
            base_atk_raw = float(val)
            base_atk = int(round(val))
        elif prop_type and prop_type in STAT_MAP:
            secondary_stat = STAT_MAP[prop_type]
            secondary_value = _format_number(prop_type, val)
            secondary_curve = p.get("type")

    # max_base_atk: base_atk * CURVE_M[curve] + addProps da fase 6
    # addProps é cumulativo (fase 6 = total a aplicar), não somar todas as fases.
    curve_type = None
    for p in prop:
        if isinstance(p, dict) and p.get("propType") == "FIGHT_PROP_BASE_ATTACK":
            curve_type = p.get("type")
            break
    promote = upgrade.get("promote") or []
    add6 = 0.0
    for phase in promote:
        if isinstance(phase, dict) and phase.get("promoteLevel") == 6:
            add6 = float((phase.get("addProps") or {}).get("FIGHT_PROP_BASE_ATTACK", 0) or 0)
            break
    multiplier = CURVE_M.get(curve_type or "", 1.0)
    max_base_atk = int(round(base_atk_raw * multiplier + add6)) if base_atk_raw else None

    # max_secondary_stat_value: secondary_value_lv1 * curve_multiplier
    # (mas secondary_value já passou por format, multiplica direto)
    max_secondary: float | None = None
    if secondary_value is not None and secondary_curve:
        m = CURVE_M.get(secondary_curve, 1.0)
        max_secondary = round(secondary_value * m, 2)

    # Affix (passivo)
    affix = raw.get("affix") or {}
    affix_data: dict[str, Any] = {}
    if isinstance(affix, dict) and affix:
        first = next(iter(affix.values()))
        if isinstance(first, dict):
            affix_data = {
                "name": first.get("name"),
                "levels": first.get("upgrade") or {},
            }

    return {
        "ambr_id": raw.get("id"),
        "slug": slugify(name),
        "name": name,
        "description": raw.get("description"),
        "rarity": raw.get("rank"),
        "weapon_type": weapon_type,
        "base_atk": base_atk,
        "max_base_atk": max_base_atk,
        "secondary_stat": secondary_stat,
        "secondary_stat_value": secondary_value,
        "max_secondary_stat_value": max_secondary,
        "icon": raw.get("icon"),
        "passive_name": affix_data.get("name"),
        "passive_description": (affix_data.get("levels") or {}).get("0"),
        "passive_levels": affix_data.get("levels"),
    }


def parse_weapon_translation(raw: dict[str, Any], lang_code: str) -> dict[str, Any] | None:
    name = raw.get("name")
    if not name:
        return None
    try:
        lang_enum = Language(lang_code)
    except ValueError:
        return None
    affix = raw.get("affix") or {}
    passive_name = None
    passive_desc = None
    if isinstance(affix, dict) and affix:
        first = next(iter(affix.values()))
        if isinstance(first, dict):
            passive_name = first.get("name")
            levels = first.get("upgrade") or {}
            passive_desc = levels.get("0")
    return {
        "language": lang_enum,
        "name": name,
        "description": raw.get("description"),
        "passive_name": passive_name,
        "passive_description": passive_desc,
    }


def upsert_weapon(db: Session, payload: dict[str, Any]) -> Weapon | None:
    existing = db.query(Weapon).filter(Weapon.ambr_id == payload["ambr_id"]).one_or_none()
    if existing:
        for k, v in payload.items():
            if k == "slug":
                continue
            setattr(existing, k, v)
        db.flush()
        return existing

    # Detecta colisão de name (mesma arma com variantes, ex: Traveler)
    name_taken = (
        db.query(Weapon)
        .filter(Weapon.name == payload["name"])
        .one_or_none()
    )
    if name_taken:
        print(
            f"[weapons] pulando {payload['name']!r} (ambr_id={payload['ambr_id']}): "
            f"nome já existe (ambr_id={name_taken.ambr_id})"
        )
        return None

    # Detecta colisão de slug (raro, mas previne crash)
    slug_taken = (
        db.query(Weapon)
        .filter(Weapon.slug == payload["slug"])
        .one_or_none()
    )
    if slug_taken:
        payload["slug"] = f"{payload['slug']}-{payload['ambr_id']}"

    w = Weapon(**payload)
    db.add(w)
    db.flush()
    return w


async def main() -> None:
    async with httpx.AsyncClient(headers=HEADERS, follow_redirects=True) as client:
        sem = asyncio.Semaphore(CONCURRENCY)

        ids = await fetch_weapon_ids(client)
        if not ids:
            print("[weapons] nenhuma arma retornada; abortando.")
            return
        if MAX_WEAPONS is not None:
            ids = ids[:MAX_WEAPONS]

        all_langs = [CANONICAL_LANG] + TRANSLATION_LANGS
        print(f"[weapons] {len(ids)} armas | langs={all_langs} | concurrency={CONCURRENCY}")

        # Fase 2a: detalhes de armas em paralelo
        paths = [f"/{lang}/weapon/{wid}?vh={VH}" for wid in ids for lang in all_langs]
        print(f"[weapons] baixando {len(paths)} detalhes de armas...")
        raw_w = await fetch_many(client, paths, sem, REQUEST_DELAY)

        # Fase 2b: coletar material IDs únicos das fases de ascensão
        material_ids: set[int] = set()
        for wid in ids:
            en = (raw_w.get(f"/{CANONICAL_LANG}/weapon/{wid}?vh={VH}") or {}).get("data") or {}
            for phase in parse_weapon_promote(en):
                material_ids.update(phase["items"].keys())
        print(f"[weapons] {len(material_ids)} material IDs únicos nas fases")

        # Fase 2c: quais já existem no DB?
        check_db = SessionLocal()
        try:
            existing = {
                m.ambr_id
                for m in check_db.query(Material)
                .filter(Material.ambr_id.in_(material_ids))
                .all()
            }
            missing = material_ids - existing
        finally:
            check_db.close()
        print(f"[weapons] {len(missing)} materiais faltam no DB — baixando")

        # Fase 2d: fetch materiais faltantes em paralelo
        if missing:
            mat_paths = [
                f"/{lang}/material/{mid}?vh={VH_MATERIAL}"
                for mid in missing for lang in all_langs
            ]
            raw_m = await fetch_many(client, mat_paths, sem, REQUEST_DELAY)
        else:
            raw_m = {}

        # Fase 3: persistência serial
        print("[weapons] persistindo...")
        db = SessionLocal()
        try:
            # 3a: cria os materiais faltantes
            created_mats = 0
            for mid in missing:
                en = (raw_m.get(f"/{CANONICAL_LANG}/material/{mid}?vh={VH_MATERIAL}") or {}).get("data") or {}
                if not en:
                    continue
                payload = parse_material(en, mid)
                if not payload:
                    continue
                if db.query(Material).filter(Material.slug == payload["slug"]).one_or_none():
                    payload["slug"] = f"{payload['slug']}-{mid}"
                mat = Material(**payload)
                db.add(mat)
                db.flush()
                created_mats += 1
                for lang in TRANSLATION_LANGS:
                    lang_d = (raw_m.get(f"/{lang}/material/{mid}?vh={VH_MATERIAL}") or {}).get("data") or {}
                    trans = parse_material_translation(lang_d, lang)
                    if trans:
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
            db.commit()
            print(f"[weapons] {created_mats} materiais criados")

            # 3b: rebuild material cache
            material_cache = {m.ambr_id: m for m in db.query(Material).filter(Material.ambr_id.isnot(None)).all()}

            # 3c: persiste armas + fases + asc materials
            total = 0
            errors = 0
            for i, wid in enumerate(ids, 1):
                try:
                    en = (raw_w.get(f"/{CANONICAL_LANG}/weapon/{wid}?vh={VH}") or {}).get("data") or {}
                    if not en:
                        continue
                    en_with_id = dict(en)
                    en_with_id["id"] = wid
                    payload = parse_weapon_canonical(en_with_id)
                    if not payload:
                        continue
                    w = upsert_weapon(db, payload)
                    if w is None:
                        continue

                    # traduções
                    for lang in TRANSLATION_LANGS:
                        lang_raw = (raw_w.get(f"/{lang}/weapon/{wid}?vh={VH}") or {}).get("data") or {}
                        trans = parse_weapon_translation(lang_raw, lang)
                        if not trans:
                            continue
                        existing_t = (
                            db.query(WeaponTranslation)
                            .filter(
                                WeaponTranslation.weapon_id == w.id,
                                WeaponTranslation.language == trans["language"],
                            )
                            .one_or_none()
                        )
                        if existing_t:
                            for k, v in trans.items():
                                setattr(existing_t, k, v)
                        else:
                            db.add(WeaponTranslation(weapon_id=w.id, **trans))

                    # fases de ascensão
                    db.query(WeaponAscensionPhase).filter_by(weapon_id=w.id).delete()
                    db.query(WeaponAscensionMaterial).filter_by(weapon_id=w.id).delete()
                    for phase in parse_weapon_promote(en):
                        db.add(WeaponAscensionPhase(
                            weapon_id=w.id,
                            phase=phase["promote_level"],
                            unlock_max_level=phase["unlock_max_level"],
                            mora=phase["mora"],
                        ))
                        for mid, qty in phase["items"].items():
                            mat = material_cache.get(mid)
                            if mat:
                                db.add(WeaponAscensionMaterial(
                                    weapon_id=w.id,
                                    material_id=mat.id,
                                    quantity=qty,
                                    phase=phase["promote_level"],
                                ))

                    total += 1
                    if i % 50 == 0:
                        print(f"  [{i}/{len(ids)}] {w.slug}")
                except Exception as exc:
                    errors += 1
                    db.rollback()
                    print(f"  [erro {wid}] {type(exc).__name__}: {exc}")
                    continue

            db.commit()
            w_count = db.query(Weapon).count()
            wp_count = db.query(WeaponAscensionPhase).count()
            wam_count = db.query(WeaponAscensionMaterial).count()
            print(f"[weapons] concluído. Weapons={w_count}  AscPhases={wp_count}  AscMaterials={wam_count}")
            if errors:
                print(f"[weapons] {errors} arma(s) com erro")
        finally:
            db.close()


if __name__ == "__main__":
    asyncio.run(main())
