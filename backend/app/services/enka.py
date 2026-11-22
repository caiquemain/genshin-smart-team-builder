"""Serviço de importação de vitrine pública via UID (Enka.Network).

Faz proxy no backend (contornando CORS), mantém cache em memória respeitando
o TTL retornado pelo Enka e resolve avatarId/skillLevelMap/weapon.itemId
diretamente contra os personagens e armas do banco PostgreSQL.
"""
from dataclasses import dataclass
import re
import time
from typing import Any, Optional

import httpx
from fastapi import HTTPException
from sqlalchemy.orm import Session

from ..models import ArtifactSet, Character, Language, Weapon
from ..models.weapon import WeaponTranslation
from .i18n import resolve_character

ENKA_UID_URL = "https://enka.network/api/uid/{uid}/"
ENKA_STORE_CHARS_URL = (
    "https://raw.githubusercontent.com/EnkaNetwork/API-docs/master/store/characters.json"
)
USER_AGENT = "genshin-smart-team-builder/1.0 (uid-import)"

UID_REGEX = re.compile(r"^\d{9,10}$")

# Mapeamento oficial de Element (Enka) -> slug de elemento do Viajante
ENKA_ELEMENT_TO_SLUG: dict[str, str] = {
    "Wind": "anemo",
    "Rock": "geo",
    "Electric": "electro",
    "Grass": "dendro",
    "Water": "hydro",
    "Fire": "pyro",
    "Ice": "cryo",
}

# Fallback direto para skillDepotId do Viajante (Aether 5xx / Lumine 7xx)
TRAVELER_DEPOT_TO_ELEMENT: dict[int, str] = {
    502: "pyro", 702: "pyro",
    503: "hydro", 703: "hydro",
    504: "anemo", 704: "anemo",
    505: "cryo", 705: "cryo",
    506: "geo", 706: "geo",
    507: "electro", 707: "electro",
    508: "dendro", 708: "dendro",
}

TRAVELER_AVATAR_IDS = {10000005, 10000007}

# Cache em memória: uid -> (expires_at, raw_json)
_uid_cache: dict[str, tuple[float, dict[str, Any]]] = {}
# Cache do characters.json do Enka (24h)
_store_cache: tuple[float, dict[str, Any]] = (0.0, {})


@dataclass(frozen=True)
class DbCharRef:
    slug: str
    name: str
    icon: Optional[str]
    rarity: int
    element: str


@dataclass(frozen=True)
class DbWeaponRef:
    slug: str
    ambr_id: Optional[int]
    name: str
    icon: Optional[str]
    rarity: int


def validate_uid(uid: str) -> str:
    cleaned = (uid or "").strip()
    if not UID_REGEX.match(cleaned):
        raise HTTPException(
            status_code=400,
            detail="UID inválido. Informe os 9 ou 10 dígitos numéricos do seu UID do Genshin Impact.",
        )
    return cleaned


def _fetch_enka_char_store() -> dict[str, Any]:
    """Busca e mantém em cache (24h) o store/characters.json oficial do Enka.Network."""
    global _store_cache
    now = time.time()
    expires_at, data = _store_cache
    if data and now < expires_at:
        return data

    try:
        with httpx.Client(timeout=12.0, headers={"User-Agent": USER_AGENT}) as client:
            res = client.get(ENKA_STORE_CHARS_URL)
            if res.status_code == 200:
                parsed = res.json()
                if isinstance(parsed, dict):
                    _store_cache = (now + 86400.0, parsed)
                    return parsed
    except Exception:
        pass

    return data


def _fetch_enka_uid_raw(uid: str) -> dict[str, Any]:
    """Busca o JSON da vitrine do jogador na API pública do Enka.Network com cache TTL."""
    now = time.time()
    cached = _uid_cache.get(uid)
    if cached and now < cached[0]:
        return cached[1]

    url = ENKA_UID_URL.format(uid=uid)
    try:
        with httpx.Client(timeout=15.0, headers={"User-Agent": USER_AGENT}) as client:
            res = client.get(url)
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=504,
            detail="Tempo esgotado ao consultar o Enka.Network. Tente novamente em instantes.",
        )
    except httpx.HTTPError:
        raise HTTPException(
            status_code=502,
            detail="Não foi possível conectar ao Enka.Network no momento.",
        )

    if res.status_code == 400:
        raise HTTPException(status_code=400, detail="UID inválido segundo o Enka.Network.")
    if res.status_code == 404:
        raise HTTPException(
            status_code=404,
            detail="Jogador não encontrado. Verifique se o UID está correto.",
        )
    if res.status_code == 424:
        raise HTTPException(
            status_code=503,
            detail="Os servidores do Genshin Impact estão em manutenção no momento.",
        )
    if res.status_code == 429:
        raise HTTPException(
            status_code=429,
            detail="Muitas consultas seguidas ao Enka.Network. Aguarde alguns segundos e tente novamente.",
        )
    if res.status_code >= 500:
        raise HTTPException(
            status_code=502,
            detail="Enka.Network temporariamente indisponível. Tente novamente em breve.",
        )
    if res.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"Resposta inesperada do Enka.Network (HTTP {res.status_code}).",
        )

    try:
        payload = res.json()
    except ValueError:
        raise HTTPException(status_code=502, detail="Resposta inválida do Enka.Network.")

    ttl = int(payload.get("ttl") or 60)
    ttl_clamped = max(60, min(300, ttl))
    _uid_cache[uid] = (now + ttl_clamped, payload)
    return payload


def _side_icon_to_avatar_icon(side_icon: Optional[str]) -> Optional[str]:
    """Converte `UI_AvatarIcon_Side_Furina` -> `UI_AvatarIcon_Furina`."""
    if not side_icon:
        return None
    return side_icon.replace("_Side_", "_")


def _resolve_db_char(
    avatar_id: int,
    skill_depot_id: Optional[int],
    enka_store: dict[str, Any],
    chars_by_icon: dict[str, DbCharRef],
    chars_by_slug: dict[str, DbCharRef],
) -> tuple[Optional[DbCharRef], Optional[dict[str, Any]]]:
    """Resolve um avatar do Enka para o registro correspondente no banco."""
    # Caso especial: Viajante (Aether 10000005 / Lumine 10000007)
    if avatar_id in TRAVELER_AVATAR_IDS:
        store_key = f"{avatar_id}-{skill_depot_id}" if skill_depot_id else str(avatar_id)
        meta = enka_store.get(store_key) or {}
        el_slug: Optional[str] = None
        if meta.get("Element"):
            el_slug = ENKA_ELEMENT_TO_SLUG.get(meta["Element"])
        if not el_slug and skill_depot_id is not None:
            el_slug = TRAVELER_DEPOT_TO_ELEMENT.get(skill_depot_id)
        if el_slug:
            ref = chars_by_slug.get(f"traveler-{el_slug}")
            if ref:
                return ref, meta
        return None, meta

    meta = enka_store.get(str(avatar_id)) or {}
    avatar_icon = _side_icon_to_avatar_icon(meta.get("SideIconName"))
    if avatar_icon:
        ref = chars_by_icon.get(avatar_icon.lower())
        if ref:
            return ref, meta
        # Fallback: parte final do nome do ícone (ex.: UI_AvatarIcon_Furina -> furina)
        suffix = avatar_icon.replace("UI_AvatarIcon_", "").lower()
        ref = chars_by_slug.get(suffix)
        if ref:
            return ref, meta

    return None, meta


def _extract_talents(
    skill_level_map: dict[str, Any],
    meta: Optional[dict[str, Any]],
) -> tuple[int, int, int]:
    """Extrai (normal_attack, elemental_skill, elemental_burst) usando SkillOrder do Enka."""
    if not skill_level_map:
        return 1, 1, 1

    # Normaliza chaves para str -> int
    levels_by_id: dict[str, int] = {}
    for k, v in skill_level_map.items():
        try:
            levels_by_id[str(k)] = max(1, min(10, int(v)))
        except (TypeError, ValueError):
            continue

    skill_order = (meta or {}).get("SkillOrder")
    if isinstance(skill_order, list) and len(skill_order) >= 3:
        na = levels_by_id.get(str(skill_order[0]), 1)
        es = levels_by_id.get(str(skill_order[1]), 1)
        eb = levels_by_id.get(str(skill_order[2]), 1)
        return na, es, eb

    # Fallback: ordena IDs numéricos de habilidade (tipicamente NA < Skill < Burst)
    sorted_vals = [
        levels_by_id[k]
        for k in sorted(levels_by_id.keys(), key=lambda x: int(x) if x.isdigit() else 0)
    ]
    na = sorted_vals[0] if len(sorted_vals) > 0 else 1
    es = sorted_vals[1] if len(sorted_vals) > 1 else 1
    eb = sorted_vals[2] if len(sorted_vals) > 2 else 1
    return na, es, eb


def _extract_weapon(
    equip_list: list[dict[str, Any]],
    weapons_by_ambr_id: dict[int, DbWeaponRef],
    weapons_by_icon: dict[str, DbWeaponRef],
) -> Optional[dict[str, Any]]:
    """Extrai a arma equipada na vitrine do Enka."""
    for item in equip_list or []:
        w_data = item.get("weapon")
        if not isinstance(w_data, dict):
            continue
        item_id = int(item.get("itemId") or 0)
        flat = item.get("flat") or {}
        icon = flat.get("icon")

        ref = weapons_by_ambr_id.get(item_id)
        if not ref and icon:
            ref = weapons_by_icon.get(str(icon).lower())

        level = max(1, min(90, int(w_data.get("level") or 1)))
        ascension = max(0, min(6, int(w_data.get("promoteLevel") or 0)))

        affix_map = w_data.get("affixMap") or {}
        refinement = 1
        if isinstance(affix_map, dict) and affix_map:
            try:
                first_val = next(iter(affix_map.values()))
                refinement = max(1, min(5, int(first_val) + 1))
            except (TypeError, ValueError, StopIteration):
                refinement = 1

        return {
            "slug": ref.slug if ref else None,
            "item_id": item_id,
            "name": ref.name if ref else (flat.get("nameTextMapHash") or f"Weapon #{item_id}"),
            "icon": ref.icon if ref else icon,
            "rarity": ref.rarity if ref else int(flat.get("rankLevel") or 4),
            "level": level,
            "ascension": ascension,
            "refinement": refinement,
        }
    return None


RELIC_ICON_SET_RE = re.compile(r"UI_RelicIcon_(\d+)_")

ENKA_EQUIP_TO_SLOT: dict[str, str] = {
    "EQUIP_BRACER": "flower",
    "EQUIP_NECKLACE": "plume",
    "EQUIP_SHOES": "sands",
    "EQUIP_RING": "goblet",
    "EQUIP_DRESS": "circlet",
}

SLOT_SORT_ORDER: dict[str, int] = {
    "flower": 0,
    "plume": 1,
    "sands": 2,
    "goblet": 3,
    "circlet": 4,
}

ENKA_PROP_TO_GOOD: dict[str, str] = {
    "FIGHT_PROP_HP": "hp",
    "FIGHT_PROP_HP_PERCENT": "hp_",
    "FIGHT_PROP_ATTACK": "atk",
    "FIGHT_PROP_ATTACK_PERCENT": "atk_",
    "FIGHT_PROP_DEFENSE": "def",
    "FIGHT_PROP_DEFENSE_PERCENT": "def_",
    "FIGHT_PROP_ELEMENT_MASTERY": "eleMas",
    "FIGHT_PROP_CHARGE_EFFICIENCY": "enerRech_",
    "FIGHT_PROP_CRITICAL": "critRate_",
    "FIGHT_PROP_CRITICAL_HURT": "critDMG_",
    "FIGHT_PROP_HEAL_ADD": "heal_",
    "FIGHT_PROP_FIRE_ADD_HURT": "pyro_dmg_",
    "FIGHT_PROP_WATER_ADD_HURT": "hydro_dmg_",
    "FIGHT_PROP_ICE_ADD_HURT": "cryo_dmg_",
    "FIGHT_PROP_ELEC_ADD_HURT": "electro_dmg_",
    "FIGHT_PROP_WIND_ADD_HURT": "anemo_dmg_",
    "FIGHT_PROP_ROCK_ADD_HURT": "geo_dmg_",
    "FIGHT_PROP_GRASS_ADD_HURT": "dendro_dmg_",
    "FIGHT_PROP_PHYSICAL_ADD_HURT": "physical_dmg_",
}


def _extract_artifacts(
    equip_list: list[dict[str, Any]],
    artifact_sets_by_ambr_id: Optional[dict[int, str]] = None,
) -> list[dict[str, Any]]:
    """Extrai os artefatos equipados (ITEM_RELIQUARY) de um avatar do Enka.Network."""
    sets_map = artifact_sets_by_ambr_id or {}
    out: list[dict[str, Any]] = []
    for eq in equip_list or []:
        flat = eq.get("flat") or {}
        if flat.get("itemType") != "ITEM_RELIQUARY":
            continue
        slot_key = ENKA_EQUIP_TO_SLOT.get(str(flat.get("equipType") or ""))
        if not slot_key:
            continue

        rel = eq.get("reliquary") or {}
        # No Enka, level=1 equivale a +0 e level=21 equivale a +20
        raw_lv = int(rel.get("level") or 1)
        level = max(0, min(20, raw_lv - 1))
        rarity = int(flat.get("rankLevel") or 5)

        icon = str(flat.get("icon") or "")
        set_slug: Optional[str] = None
        m = RELIC_ICON_SET_RE.search(icon)
        if m:
            ambr_id = int(m.group(1))
            set_slug = sets_map.get(ambr_id)
        if not set_slug:
            # Fallback para setNameTextMapHash ou prefixo do ícone
            set_slug = str(flat.get("setNameTextMapHash") or (f"set-{m.group(1)}" if m else "unknown-set"))

        main_raw = flat.get("reliquaryMainstat") or {}
        main_prop_id = str(main_raw.get("mainPropId") or "")
        main_stat_key = ENKA_PROP_TO_GOOD.get(main_prop_id, main_prop_id)
        if not main_stat_key:
            continue

        substats: list[dict[str, Any]] = []
        for sub in flat.get("reliquarySubstats") or []:
            prop_id = str(sub.get("appendPropId") or "")
            good_key = ENKA_PROP_TO_GOOD.get(prop_id)
            val = sub.get("statValue")
            if good_key and val is not None:
                try:
                    substats.append({"key": good_key, "value": round(float(val), 1)})
                except (TypeError, ValueError):
                    pass

        out.append({
            "set_slug": set_slug,
            "slot_key": slot_key,
            "level": level,
            "rarity": rarity,
            "main_stat_key": main_stat_key,
            "substats": substats[:4],
        })

    out.sort(key=lambda a: SLOT_SORT_ORDER.get(a["slot_key"], 99))
    return out


def parse_enka_payload(
    uid: str,
    raw: dict[str, Any],
    enka_store: dict[str, Any],
    chars_by_icon: dict[str, DbCharRef],
    chars_by_slug: dict[str, DbCharRef],
    weapons_by_ambr_id: dict[int, DbWeaponRef],
    weapons_by_icon: dict[str, DbWeaponRef],
    artifact_sets_by_ambr_id: Optional[dict[int, str]] = None,
) -> dict[str, Any]:
    """Converte o JSON bruto do Enka.Network no payload normalizado da API."""
    player_info = raw.get("playerInfo") or {}
    nickname = str(player_info.get("nickname") or f"UID {uid}")
    ar = player_info.get("level")
    wl = player_info.get("worldLevel")
    signature = player_info.get("signature") or None
    ttl = int(raw.get("ttl") or 60)

    avatar_info_list = raw.get("avatarInfoList") or []
    show_list = player_info.get("showAvatarInfoList") or []
    showcase_hidden = len(avatar_info_list) == 0 and len(show_list) > 0

    parsed_chars: list[dict[str, Any]] = []
    unmapped_ids: list[int] = []
    seen_slugs: set[str] = set()

    if avatar_info_list:
        for av in avatar_info_list:
            avatar_id = int(av.get("avatarId") or 0)
            skill_depot_id = av.get("skillDepotId")
            ref, meta = _resolve_db_char(
                avatar_id,
                int(skill_depot_id) if skill_depot_id is not None else None,
                enka_store,
                chars_by_icon,
                chars_by_slug,
            )
            if not ref:
                if avatar_id:
                    unmapped_ids.append(avatar_id)
                continue
            if ref.slug in seen_slugs:
                continue
            seen_slugs.add(ref.slug)

            prop_map = av.get("propMap") or {}
            try:
                level = max(1, min(90, int((prop_map.get("4001") or {}).get("val", 1))))
            except (TypeError, ValueError):
                level = 1
            try:
                ascension = max(0, min(6, int((prop_map.get("1002") or {}).get("val", 0))))
            except (TypeError, ValueError):
                ascension = 0

            talent_id_list = av.get("talentIdList") or []
            cons = max(0, min(6, len(talent_id_list)))
            na, es, eb = _extract_talents(av.get("skillLevelMap") or {}, meta)
            equip_list = av.get("equipList") or []
            weapon = _extract_weapon(
                equip_list,
                weapons_by_ambr_id,
                weapons_by_icon,
            )
            artifacts = _extract_artifacts(equip_list, artifact_sets_by_ambr_id)

            parsed_chars.append({
                "slug": ref.slug,
                "avatar_id": avatar_id,
                "name": ref.name,
                "icon": ref.icon,
                "rarity": ref.rarity,
                "element": ref.element,
                "level": level,
                "ascension": ascension,
                "cons": cons,
                "na": na,
                "es": es,
                "eb": eb,
                "has_detail": True,
                "weapon": weapon,
                "artifacts": artifacts,
            })
    elif show_list:
        # Detalhes ocultos no jogo: ainda conseguimos importar lista básica + nível
        for av in show_list:
            avatar_id = int(av.get("avatarId") or 0)
            ref, _ = _resolve_db_char(
                avatar_id,
                None,
                enka_store,
                chars_by_icon,
                chars_by_slug,
            )
            if not ref:
                if avatar_id:
                    unmapped_ids.append(avatar_id)
                continue
            if ref.slug in seen_slugs:
                continue
            seen_slugs.add(ref.slug)

            try:
                level = max(1, min(90, int(av.get("level") or 1)))
            except (TypeError, ValueError):
                level = 1

            parsed_chars.append({
                "slug": ref.slug,
                "avatar_id": avatar_id,
                "name": ref.name,
                "icon": ref.icon,
                "rarity": ref.rarity,
                "element": ref.element,
                "level": level,
                "ascension": 0,
                "cons": 0,
                "na": 1,
                "es": 1,
                "eb": 1,
                "has_detail": False,
                "weapon": None,
                "artifacts": [],
            })

    return {
        "uid": uid,
        "nickname": nickname,
        "ar": int(ar) if ar is not None else None,
        "wl": int(wl) if wl is not None else None,
        "signature": signature,
        "ttl": ttl,
        "showcase_hidden": showcase_hidden,
        "characters": parsed_chars,
        "unmapped_avatar_ids": unmapped_ids,
    }


def fetch_and_parse_enka_uid(db: Session, uid: str, lang: Language) -> dict[str, Any]:
    """Carrega referências do DB, consulta o Enka.Network e devolve os personagens resolvidos."""
    clean_uid = validate_uid(uid)
    raw = _fetch_enka_uid_raw(clean_uid)
    enka_store = _fetch_enka_char_store()

    chars_by_icon: dict[str, DbCharRef] = {}
    chars_by_slug: dict[str, DbCharRef] = {}
    for c in db.query(Character).all():
        resolved = resolve_character(db, c, lang)
        el = c.element.value if hasattr(c.element, "value") else str(c.element)
        ref = DbCharRef(
            slug=c.slug,
            name=resolved["name"],
            icon=c.icon,
            rarity=c.rarity,
            element=el,
        )
        chars_by_slug[c.slug] = ref
        if c.icon:
            chars_by_icon[c.icon.lower()] = ref

    weapon_trans_by_id: dict[int, str] = {}
    if lang != Language.EN:
        for wt in db.query(WeaponTranslation).filter(WeaponTranslation.language == lang).all():
            weapon_trans_by_id[wt.weapon_id] = wt.name

    weapons_by_ambr_id: dict[int, DbWeaponRef] = {}
    weapons_by_icon: dict[str, DbWeaponRef] = {}
    for w in db.query(Weapon).all():
        wref = DbWeaponRef(
            slug=w.slug,
            ambr_id=w.ambr_id,
            name=weapon_trans_by_id.get(w.id) or w.name,
            icon=w.icon,
            rarity=w.rarity,
        )
        if w.ambr_id is not None:
            weapons_by_ambr_id[int(w.ambr_id)] = wref
        if w.icon:
            weapons_by_icon[w.icon.lower()] = wref

    artifact_sets_by_ambr_id: dict[int, str] = {}
    for a in db.query(ArtifactSet).all():
        if a.ambr_id is not None:
            artifact_sets_by_ambr_id[int(a.ambr_id)] = a.slug
        if a.icon:
            m = RELIC_ICON_SET_RE.search(a.icon)
            if m:
                artifact_sets_by_ambr_id.setdefault(int(m.group(1)), a.slug)

    return parse_enka_payload(
        uid=clean_uid,
        raw=raw,
        enka_store=enka_store,
        chars_by_icon=chars_by_icon,
        chars_by_slug=chars_by_slug,
        weapons_by_ambr_id=weapons_by_ambr_id,
        weapons_by_icon=weapons_by_icon,
        artifact_sets_by_ambr_id=artifact_sets_by_ambr_id,
    )
