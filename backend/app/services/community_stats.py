"""Serviço de Estatísticas da Comunidade (Paimon.plus — Censo de 40.000+ contas reais).

Lê o snapshot em `backend/data/sources/paimon_plus/statistics.json` (atualizável via
`https://paimon.plus/api/statistics`), resolve todos os IDs (avatarId, weapon.id,
reliquarySet.id) contra o PostgreSQL com traduções PT/EN, e calcula métricas de
Ciência de Dados:
  - Censo global de jogadores (AR, Abismo, Teatro Imaginário, conquistas, amizade 10)
  - Por personagem: mediana/média dos 8 stats, distribuição C0..C6 com detecção de
    picos de constelação, Top 5 armas, Top 5 combinações de artefatos e talentos típicos
  - Rankings globais: mais populares, maior % C6 ("índice whale"), armas e sets mais usados.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import time
from typing import Any, Optional

import httpx
from fastapi import HTTPException
from sqlalchemy.orm import Session

from ..models import (
    ArtifactSet,
    ArtifactSetTranslation,
    Character,
    CharacterTranslation,
    Language,
    Weapon,
)
from ..models.weapon import WeaponTranslation
from .enka import (
    TRAVELER_AVATAR_IDS,
    DbCharRef,
    _fetch_enka_char_store,
    _resolve_db_char,
    _side_icon_to_avatar_icon,
)

PAIMON_STATS_URL = "https://paimon.plus/api/statistics"
YATTA_AVATAR_LIST_URL = "https://gi.yatta.moe/api/v2/en/avatar"
USER_AGENT = "genshin-smart-team-builder/1.0 (community-stats)"

SNAPSHOT_PATH = (
    Path(__file__).resolve().parents[2]
    / "data"
    / "sources"
    / "paimon_plus"
    / "statistics.json"
)

# Cache em memória por idioma: lang -> (snapshot_mtime_ns, expires_at, payload)
_parsed_cache: dict[str, tuple[int, float, dict[str, Any]]] = {}
_yatta_avatar_cache: tuple[float, dict[str, dict[str, Any]]] = (0.0, {})
CACHE_TTL_SECONDS = 3600.0

# FightProp IDs usados no JSON do Paimon.plus
FIGHT_PROP_MAP: dict[int, tuple[str, bool]] = {
    2000: ("hp", False),
    2001: ("atk", False),
    2002: ("def", False),
    28: ("em", False),
    20: ("crit_rate", True),   # decimal 0.458 -> 45.8%
    22: ("crit_dmg", True),    # decimal 2.351 -> 235.1%
    23: ("er", True),          # decimal 1.220 -> 122.0%
}


def invalidate_community_stats_cache() -> None:
    _parsed_cache.clear()


def fetch_and_save_paimon_snapshot(dest: Path = SNAPSHOT_PATH) -> dict[str, Any]:
    """Baixa o snapshot mais recente de `https://paimon.plus/api/statistics` e salva em disco.

    Uso exclusivo via CLI (`python -m app.scripts.sync_paimon_stats`) — nunca chamado por rotas HTTP públicas.
    """
    try:
        with httpx.Client(timeout=20.0, headers={"User-Agent": USER_AGENT}) as client:
            res = client.get(PAIMON_STATS_URL)
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Paimon.plus demorou demais para responder.")
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail=f"Erro de conexão com Paimon.plus: {exc}")

    if res.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"Paimon.plus retornou HTTP {res.status_code}.",
        )

    try:
        data = res.json()
    except ValueError:
        raise HTTPException(status_code=502, detail="Resposta inválida do Paimon.plus.")

    if not isinstance(data, dict) or "avatarInfoList" not in data:
        raise HTTPException(status_code=502, detail="Formato inesperado retornado pelo Paimon.plus.")

    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = dest.with_suffix(".json.tmp")
    tmp_path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    os.replace(tmp_path, dest)
    invalidate_community_stats_cache()
    return data


def _load_raw_snapshot(snapshot_path: Path = SNAPSHOT_PATH) -> tuple[int, dict[str, Any]]:
    """Lê exclusivamente o snapshot local em disco (jamais consulta a API externa em requisições públicas)."""
    if not snapshot_path.is_file():
        raise HTTPException(
            status_code=503,
            detail="Snapshot de estatísticas comunitárias indisponível no servidor.",
        )
    try:
        mtime_ns = snapshot_path.stat().st_mtime_ns
        data = json.loads(snapshot_path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        raise HTTPException(
            status_code=503,
            detail="Snapshot de estatísticas comunitárias corrompido ou ilegível.",
        )
    if not isinstance(data, dict) or "avatarInfoList" not in data:
        raise HTTPException(
            status_code=503,
            detail="Snapshot de estatísticas comunitárias em formato inválido.",
        )
    return mtime_ns, data


def _fetch_yatta_avatar_fallback() -> dict[str, dict[str, Any]]:
    """Fallback para mapear avatarIds muito novos (6.x/7.x) caso ainda não estejam no store do Enka."""
    global _yatta_avatar_cache
    now = time.time()
    expires, cached = _yatta_avatar_cache
    if cached and now < expires:
        return cached
    try:
        with httpx.Client(timeout=10.0, headers={"User-Agent": USER_AGENT}) as client:
            res = client.get(YATTA_AVATAR_LIST_URL)
            if res.status_code == 200:
                items = (res.json().get("data") or {}).get("items") or {}
                if isinstance(items, dict):
                    _yatta_avatar_cache = (now + 86400.0, items)
                    return items
    except Exception:
        pass
    return cached


def _weighted_median_from_histogram(hist: list[int], start_val: int = 0) -> float:
    total = sum(int(x) for x in hist if x and x > 0)
    if total <= 0:
        return 0.0
    half = total / 2.0
    acc = 0
    for idx, cnt in enumerate(hist):
        acc += int(cnt or 0)
        if acc >= half:
            return float(start_val + idx)
    return float(start_val + max(0, len(hist) - 1))


def _weighted_mean_from_histogram(hist: list[int], start_val: int = 0) -> float:
    total = sum(int(x) for x in hist if x and x > 0)
    if total <= 0:
        return 0.0
    weighted = sum((start_val + idx) * int(cnt or 0) for idx, cnt in enumerate(hist))
    return round(weighted / total, 1)


def parse_player_census(player_info: dict[str, Any]) -> dict[str, Any]:
    """Extrai métricas agregadas do censo global (`playerInfo` — ex.: 40.000 contas)."""
    total = int(player_info.get("count") or 0)
    levels = [int(x or 0) for x in (player_info.get("level") or [])]
    towers = [int(x or 0) for x in (player_info.get("towerFloorIndex") or [])]
    theaters = [int(x or 0) for x in (player_info.get("theaterActIndex") or [])]
    achievements = [int(x or 0) for x in (player_info.get("finishAchievementNum") or [])]
    fetter = [int(x or 0) for x in (player_info.get("fetterCount") or [])]

    denom = max(1, total)

    # Agrupamento limpo de AR para visualização
    ar_buckets = [
        {"label": "AR < 50", "count": sum(levels[:50])},
        {"label": "AR 50–54", "count": sum(levels[50:55])},
        {"label": "AR 55", "count": levels[55] if len(levels) > 55 else 0},
        {"label": "AR 56", "count": levels[56] if len(levels) > 56 else 0},
        {"label": "AR 57", "count": levels[57] if len(levels) > 57 else 0},
        {"label": "AR 58", "count": levels[58] if len(levels) > 58 else 0},
        {"label": "AR 59", "count": levels[59] if len(levels) > 59 else 0},
        {"label": "AR 60", "count": levels[60] if len(levels) > 60 else 0},
    ]
    for b in ar_buckets:
        b["pct"] = round((b["count"] / denom) * 100, 1)

    ar60_count = levels[60] if len(levels) > 60 else 0
    abyss_12_count = towers[12] if len(towers) > 12 else 0
    theater_10_count = theaters[10] if len(theaters) > 10 else 0

    abyss_buckets = [
        {"label": "Sem registro / < 9", "count": sum(towers[:9])},
        {"label": "Andar 9", "count": towers[9] if len(towers) > 9 else 0},
        {"label": "Andar 10", "count": towers[10] if len(towers) > 10 else 0},
        {"label": "Andar 11", "count": towers[11] if len(towers) > 11 else 0},
        {"label": "Andar 12", "count": abyss_12_count},
    ]
    for b in abyss_buckets:
        b["pct"] = round((b["count"] / denom) * 100, 1)

    theater_buckets = [
        {"label": "Sem registro / 0", "count": theaters[0] if len(theaters) > 0 else 0},
        {"label": "Atos 1–3", "count": sum(theaters[1:4])},
        {"label": "Atos 4–6", "count": sum(theaters[4:7])},
        {"label": "Atos 7–8", "count": sum(theaters[7:9])},
        {"label": "Ato 9", "count": theaters[9] if len(theaters) > 9 else 0},
        {"label": "Ato 10", "count": theater_10_count},
    ]
    for b in theater_buckets:
        b["pct"] = round((b["count"] / denom) * 100, 1)

    return {
        "total_players": total,
        "ar60_pct": round((ar60_count / denom) * 100, 1),
        "abyss_floor12_pct": round((abyss_12_count / denom) * 100, 1),
        "theater_act10_pct": round((theater_10_count / denom) * 100, 1),
        "achievements_median": int(round(_weighted_median_from_histogram(achievements, 0))),
        "achievements_mean": _weighted_mean_from_histogram(achievements, 0),
        "achievements_top": int(player_info.get("finishAchievementNumTop") or 0),
        "friendship10_median": int(round(_weighted_median_from_histogram(fetter, 0))),
        "ar_distribution": ar_buckets,
        "abyss_distribution": abyss_buckets,
        "theater_distribution": theater_buckets,
    }


def detect_constellation_stopping_points(consts: list[int]) -> list[dict[str, Any]]:
    """Detecta picos estatísticos de parada em C1..C6 (ex.: C2 > C1 indica constelação alvo!)."""
    padded = [int(consts[i]) if i < len(consts) else 0 for i in range(7)]
    total = sum(padded)
    if total < 20:
        return []

    pcts = [(c / total) * 100.0 for c in padded]
    spikes: list[dict[str, Any]] = []

    for c in range(1, 7):
        prev_pct = pcts[c - 1]
        cur_pct = pcts[c]
        # Pico claro em C2..C5: maior que a constelação anterior e relevante (>= 8%)
        if 2 <= c <= 5 and cur_pct >= 8.0 and cur_pct > prev_pct * 1.15:
            spikes.append({
                "constellation": c,
                "pct": round(cur_pct, 1),
                "label": f"Pico em C{c} ({cur_pct:.1f}%)",
            })
        # C1 muito visada (>= 16% dos donos param especificamente em C1)
        elif c == 1 and cur_pct >= 16.0 and cur_pct > pcts[2] * 1.25:
            spikes.append({
                "constellation": 1,
                "pct": round(cur_pct, 1),
                "label": f"Parada popular em C1 ({cur_pct:.1f}%)",
            })
        # C6 com índice expressivo (>= 12% dos donos têm C6)
        elif c == 6 and cur_pct >= 12.0:
            spikes.append({
                "constellation": 6,
                "pct": round(cur_pct, 1),
                "label": f"Alto índice C6 ({cur_pct:.1f}%)",
            })

    return spikes[:2]


def parse_avatar_stats_entry(
    entry: dict[str, Any],
    skill_order: Optional[list[int]] = None,
    total_players: int = 40000,
) -> dict[str, Any]:
    """Normaliza uma entrada de `avatarInfoList` em métricas limpas para UI e Ciência de Dados."""
    count = int(entry.get("count") or 0)
    consts_raw = [int(x or 0) for x in (entry.get("consts") or [])]
    consts_padded = [consts_raw[i] if i < len(consts_raw) else 0 for i in range(7)]
    const_total = max(1, sum(consts_padded))

    consts = [
        {
            "level": i,
            "count": consts_padded[i],
            "pct": round((consts_padded[i] / const_total) * 100, 1),
        }
        for i in range(7)
    ]
    avg_const = round(sum(i * consts_padded[i] for i in range(7)) / const_total, 2)
    c6_pct = consts[6]["pct"]

    # Stats (média e mediana)
    stats_out: dict[str, dict[str, float]] = {}
    for st in entry.get("stats") or []:
        val = st.get("value") or {}
        mean_v = float(val.get("mean") or 0.0)
        med_v = float(val.get("median") or 0.0)
        fp = st.get("fightProp")
        if fp is None:
            # Último item sem fightProp no Paimon.plus representa o bônus elemental/principal
            stats_out["elem_dmg"] = {
                "mean": round(mean_v * 100, 1),
                "median": round(med_v * 100, 1),
            }
            continue
        mapped = FIGHT_PROP_MAP.get(int(fp))
        if not mapped:
            continue
        key, is_pct = mapped
        if is_pct:
            stats_out[key] = {
                "mean": round(mean_v * 100, 1),
                "median": round(med_v * 100, 1),
            }
        else:
            stats_out[key] = {
                "mean": round(mean_v, 1),
                "median": round(med_v, 1),
            }

    # Talentos (NA / Skill / Burst): usa SkillOrder do Enka para filtrar sprints/passivas (ex.: Ayaka/Mona)
    skills_raw = entry.get("skills") or []
    skills_by_id = {int(s["id"]): s for s in skills_raw if "id" in s}

    def _fmt_skill(s: Optional[dict[str, Any]]) -> dict[str, float | int]:
        if not s:
            return {"mean": 1.0, "median": 1, "mode": 1}
        return {
            "mean": round(float(s.get("mean") or 1.0), 2),
            "median": int(round(float(s.get("median") or 1))),
            "mode": int(round(float(s.get("mode") or 1))),
        }

    if skill_order and len(skill_order) >= 3:
        na_s = skills_by_id.get(int(skill_order[0]))
        es_s = skills_by_id.get(int(skill_order[1]))
        eb_s = skills_by_id.get(int(skill_order[2]))
    else:
        # Fallback: descarta skills com max/mode==1 se houver 4 skills (sprint alternativo)
        filtered = list(skills_raw)
        if len(filtered) > 3:
            non_trivial = [s for s in filtered if float(s.get("mean") or 0) > 1.05]
            if len(non_trivial) >= 3:
                filtered = non_trivial
        na_s = filtered[0] if len(filtered) > 0 else None
        es_s = filtered[1] if len(filtered) > 1 else None
        eb_s = filtered[2] if len(filtered) > 2 else None

    return {
        "avatar_id": int(entry.get("avatarId") or 0),
        "count": count,
        "popularity_pct": round((count / max(1, total_players)) * 100, 2),
        "avg_constellation": avg_const,
        "c6_pct": c6_pct,
        "consts": consts,
        "stopping_points": detect_constellation_stopping_points(consts_padded),
        "stats": stats_out,
        "talents": {
            "na": _fmt_skill(na_s),
            "es": _fmt_skill(es_s),
            "eb": _fmt_skill(eb_s),
        },
        "raw_weapons": entry.get("weapon") or [],
        "raw_sets": entry.get("reliquarySet") or [],
    }


def _build_db_lookups(db: Session, lang: Language):
    # Personagens (1 query em lote para traduções em vez de N+1)
    c_trans: dict[int, str] = {}
    if lang != Language.EN:
        for ct in db.query(CharacterTranslation).filter(CharacterTranslation.language == lang).all():
            c_trans[ct.character_id] = ct.name

    chars_by_icon: dict[str, DbCharRef] = {}
    chars_by_slug: dict[str, DbCharRef] = {}
    for ch in db.query(Character).all():
        t_name = c_trans.get(ch.id, ch.name)
        ref = DbCharRef(
            slug=ch.slug,
            name=t_name,
            icon=ch.icon,
            rarity=ch.rarity,
            element=ch.element.value if hasattr(ch.element, "value") else str(ch.element),
        )
        chars_by_slug[ch.slug.lower()] = ref
        if ch.icon:
            chars_by_icon[ch.icon.lower()] = ref

    # Armas por ambr_id
    w_trans: dict[int, str] = {}
    if lang != Language.EN:
        for wt in db.query(WeaponTranslation).filter(WeaponTranslation.language == lang).all():
            w_trans[wt.weapon_id] = wt.name

    weapons_by_ambr: dict[int, dict[str, Any]] = {}
    for w in db.query(Weapon).all():
        if w.ambr_id is None:
            continue
        weapons_by_ambr[int(w.ambr_id)] = {
            "slug": w.slug,
            "name": w_trans.get(w.id, w.name),
            "icon": w.icon,
            "rarity": w.rarity,
        }

    # Sets de artefato por ambr_id
    a_trans: dict[int, str] = {}
    if lang != Language.EN:
        for at in db.query(ArtifactSetTranslation).filter(ArtifactSetTranslation.language == lang).all():
            a_trans[at.artifact_set_id] = at.name

    sets_by_ambr: dict[int, dict[str, Any]] = {}
    for s in db.query(ArtifactSet).all():
        if s.ambr_id is None:
            continue
        sets_by_ambr[int(s.ambr_id)] = {
            "slug": s.slug,
            "name": a_trans.get(s.id, s.name),
            "icon": s.icon,
        }

    return chars_by_icon, chars_by_slug, weapons_by_ambr, sets_by_ambr


def get_community_stats(
    db: Session,
    lang: Language = Language.PT,
) -> dict[str, Any]:
    """Retorna o relatório estatístico completo da comunidade (cacheado por idioma e mtime do snapshot)."""
    lang_key = lang.value if hasattr(lang, "value") else str(lang)
    now = time.time()

    try:
        current_mtime_ns = SNAPSHOT_PATH.stat().st_mtime_ns
    except OSError:
        raise HTTPException(
            status_code=503,
            detail="Snapshot de estatísticas comunitárias indisponível no servidor.",
        )

    if lang_key in _parsed_cache:
        cached_mtime_ns, exp, cached = _parsed_cache[lang_key]
        if cached_mtime_ns == current_mtime_ns and now < exp:
            return cached

    snapshot_mtime_ns, raw = _load_raw_snapshot()
    player_info = raw.get("playerInfo") or {}
    census = parse_player_census(player_info)
    total_players = census["total_players"] or 40000

    ts_ms = raw.get("timestamp")
    updated_at = (
        datetime.fromtimestamp(ts_ms / 1000.0, tz=timezone.utc).isoformat()
        if isinstance(ts_ms, (int, float)) and ts_ms > 0
        else None
    )

    enka_store = _fetch_enka_char_store()
    yatta_fallback: Optional[dict[str, dict[str, Any]]] = None
    chars_by_icon, chars_by_slug, weapons_by_ambr, sets_by_ambr = _build_db_lookups(db, lang)

    characters_by_slug: dict[str, dict[str, Any]] = {}
    global_weapon_counts: dict[int, int] = defaultdict(int)
    global_set_counts: dict[int, int] = defaultdict(int)

    for entry in raw.get("avatarInfoList") or []:
        avatar_id = int(entry.get("avatarId") or 0)
        if avatar_id <= 0 or avatar_id in TRAVELER_AVATAR_IDS:
            continue

        ref, meta = _resolve_db_char(avatar_id, None, enka_store, chars_by_icon, chars_by_slug)
        if not ref:
            # Tenta fallback Yatta para personagens recém-lançados
            if yatta_fallback is None:
                yatta_fallback = _fetch_yatta_avatar_fallback()
            y_item = yatta_fallback.get(str(avatar_id))
            if y_item:
                y_icon = y_item.get("icon")
                if y_icon and y_icon.lower() in chars_by_icon:
                    ref = chars_by_icon[y_icon.lower()]
                else:
                    y_route = str(y_item.get("route") or "").lower().replace(" ", "-")
                    ref = chars_by_slug.get(y_route)
            if not ref and meta:
                side = _side_icon_to_avatar_icon(meta.get("SideIconName"))
                if side:
                    ref = chars_by_icon.get(side.lower())

        if not ref:
            continue

        skill_order = (meta or {}).get("SkillOrder") if isinstance(meta, dict) else None
        parsed = parse_avatar_stats_entry(entry, skill_order=skill_order, total_players=total_players)
        char_count = max(1, parsed["count"])

        # Top 5 Armas resolvidas
        weapons_out: list[dict[str, Any]] = []
        for w in parsed["raw_weapons"][:5]:
            wid = int(w.get("id") or 0)
            wcnt = int(w.get("count") or 0)
            if wid <= 0 or wcnt <= 0:
                continue
            global_weapon_counts[wid] += wcnt
            wmeta = weapons_by_ambr.get(wid)
            weapons_out.append({
                "ambr_id": wid,
                "slug": wmeta["slug"] if wmeta else None,
                "name": wmeta["name"] if wmeta else f"Arma #{wid}",
                "icon": wmeta["icon"] if wmeta else None,
                "rarity": wmeta["rarity"] if wmeta else 4,
                "count": wcnt,
                "pct": round((wcnt / char_count) * 100, 1),
            })

        # Top 5 Combinações de Artefatos resolvidas
        sets_out: list[dict[str, Any]] = []
        for rs in parsed["raw_sets"][:5]:
            rcnt = int(rs.get("count") or 0)
            pieces_list = rs.get("set") or []
            if not pieces_list or rcnt <= 0:
                continue
            resolved_parts = []
            for part in pieces_list:
                sid = int(part.get("id") or 0)
                pcs = int(part.get("piece") or 2)
                if sid <= 0:
                    continue
                global_set_counts[sid] += rcnt
                smeta = sets_by_ambr.get(sid)
                resolved_parts.append({
                    "ambr_id": sid,
                    "slug": smeta["slug"] if smeta else None,
                    "name": smeta["name"] if smeta else f"Set #{sid}",
                    "icon": smeta["icon"] if smeta else None,
                    "pieces": pcs,
                })
            if resolved_parts:
                sets_out.append({
                    "sets": resolved_parts,
                    "count": rcnt,
                    "pct": round((rcnt / char_count) * 100, 1),
                })

        characters_by_slug[ref.slug] = {
            "slug": ref.slug,
            "name": ref.name,
            "icon": ref.icon,
            "rarity": ref.rarity,
            "element": ref.element,
            "avatar_id": avatar_id,
            "count": parsed["count"],
            "popularity_pct": parsed["popularity_pct"],
            "avg_constellation": parsed["avg_constellation"],
            "c6_pct": parsed["c6_pct"],
            "consts": parsed["consts"],
            "stopping_points": parsed["stopping_points"],
            "stats": parsed["stats"],
            "talents": parsed["talents"],
            "weapons": weapons_out,
            "artifact_sets": sets_out,
        }

    all_chars = list(characters_by_slug.values())

    top_popular = sorted(all_chars, key=lambda c: c["count"], reverse=True)[:15]
    top_c6_5star = sorted(
        [c for c in all_chars if c["rarity"] == 5 and c["count"] >= 100],
        key=lambda c: c["c6_pct"],
        reverse=True,
    )[:15]

    total_weapon_mentions = max(1, sum(global_weapon_counts.values()))
    top_weapons_global = []
    for wid, cnt in sorted(global_weapon_counts.items(), key=lambda kv: kv[1], reverse=True)[:15]:
        wmeta = weapons_by_ambr.get(wid)
        if not wmeta:
            continue
        top_weapons_global.append({
            "ambr_id": wid,
            "slug": wmeta["slug"],
            "name": wmeta["name"],
            "icon": wmeta["icon"],
            "rarity": wmeta["rarity"],
            "count": cnt,
            "share_pct": round((cnt / total_weapon_mentions) * 100, 2),
        })

    total_set_mentions = max(1, sum(global_set_counts.values()))
    top_sets_global = []
    for sid, cnt in sorted(global_set_counts.items(), key=lambda kv: kv[1], reverse=True)[:15]:
        smeta = sets_by_ambr.get(sid)
        if not smeta:
            continue
        top_sets_global.append({
            "ambr_id": sid,
            "slug": smeta["slug"],
            "name": smeta["name"],
            "icon": smeta["icon"],
            "count": cnt,
            "share_pct": round((cnt / total_set_mentions) * 100, 2),
        })

    payload = {
        "source": "Paimon.plus",
        "source_url": PAIMON_STATS_URL,
        "updated_at": updated_at,
        "total_characters": len(characters_by_slug),
        "census": census,
        "rankings": {
            "top_popular": top_popular,
            "top_c6_5star": top_c6_5star,
            "top_weapons": top_weapons_global,
            "top_artifact_sets": top_sets_global,
        },
        "characters": characters_by_slug,
    }

    _parsed_cache[lang_key] = (snapshot_mtime_ns, now + CACHE_TTL_SECONDS, payload)
    return payload


def get_character_community_stats(
    db: Session,
    slug: str,
    lang: Language = Language.PT,
) -> Optional[dict[str, Any]]:
    data = get_community_stats(db, lang=lang)
    char_entry = data["characters"].get(slug)
    if not char_entry:
        return None
    return {
        "source": data["source"],
        "updated_at": data["updated_at"],
        "total_players": data["census"]["total_players"],
        "character": char_entry,
    }
