"""Montador de Times Sem Conflito para Abismo (2 Times) e Stygian Onslaught (3 Times).

Encontra automaticamente as melhores combinações de 2 times (8 personagens únicos)
ou 3 times (12 personagens únicos) a partir do Roster do jogador, sem repetir
nenhum personagem entre os lados/chefes e respeitando favoritos fixados (`locked_slugs`)
ou personagens excluídos (`excluded_slugs`).
"""
from typing import Any, Optional

from sqlalchemy.orm import Session

from ..models import Character, Language, TeamTemplate
from .i18n import resolve_character
from .pull_advisor import (
    CharacterLite,
    TemplateLite,
    TierSummaryLite,
    _fetch_category_tiers,
)
from .upgrade_advisor import _effective_mode_score


def _score_to_tier_label(avg_score: float) -> str:
    if avg_score >= 92:
        return "S+"
    if avg_score >= 82:
        return "S"
    if avg_score >= 70:
        return "A"
    if avg_score >= 56:
        return "B"
    return "C"


def _char_mode_score(
    slug: str,
    mode: str,
    general_tiers: dict[str, TierSummaryLite],
    abyss_tiers: dict[str, TierSummaryLite],
    stygian_tiers: dict[str, TierSummaryLite],
) -> tuple[float, Optional[str]]:
    gen = general_tiers.get(slug)
    gen_val = (gen.avg_score * 100.0) if gen else 55.0

    primary_map = abyss_tiers if mode == "abyss" else stygian_tiers
    primary = primary_map.get(slug)
    primary_eff = _effective_mode_score(primary)
    if primary_eff is None:
        primary_eff = gen_val

    combined = 0.65 * primary_eff + 0.35 * gen_val
    tier_label = (primary.consensus_tier if primary else None) or (gen.consensus_tier if gen else None)
    return combined, tier_label


def compute_endgame_combinations(
    characters: list[CharacterLite],
    templates: list[TemplateLite],
    general_tiers: dict[str, TierSummaryLite],
    abyss_tiers: dict[str, TierSummaryLite],
    stygian_tiers: dict[str, TierSummaryLite],
    owned_slugs: list[str],
    mode: str = "abyss",
    locked_slugs: list[str] = (),
    excluded_slugs: list[str] = (),
    limit: int = 8,
) -> dict[str, Any]:
    """Busca as melhores combinações de 2 (abyss) ou 3 (stygian) times disjuntos."""
    team_count = 3 if mode == "stygian" else 2
    chars_by_slug = {c.slug: c for c in characters}

    excluded_set = {s for s in excluded_slugs if s in chars_by_slug}
    owned_set = {s for s in owned_slugs if s in chars_by_slug and s not in excluded_set}
    locked_set = {s for s in locked_slugs if s in owned_set}

    # 1. Filtra templates 4/4 jogáveis com o Roster atual e deduplica por conjunto de 4 chars
    best_by_roster: dict[frozenset[str], dict[str, Any]] = {}
    for tpl in templates:
        slugs = list(dict.fromkeys(tpl.character_slugs))
        if len(slugs) != 4:
            continue
        if not all(s in owned_set for s in slugs):
            continue

        # Score do time baseado nos 4 integrantes no modo atual
        char_scores: list[float] = []
        members_out: list[dict[str, Any]] = []
        for s in slugs:
            c = chars_by_slug[s]
            c_score, c_tier = _char_mode_score(s, mode, general_tiers, abyss_tiers, stygian_tiers)
            char_scores.append(c_score)
            members_out.append({
                "slug": c.slug,
                "name": c.name,
                "icon": c.icon,
                "element": c.element,
                "rarity": c.rarity,
                "tier": c_tier,
            })

        # Dá peso levemente maior aos 2 pilares mais fortes do time (carry + suporte chave)
        sorted_sc = sorted(char_scores, reverse=True)
        weighted_avg = (
            sorted_sc[0] * 0.30
            + sorted_sc[1] * 0.28
            + sorted_sc[2] * 0.22
            + sorted_sc[3] * 0.20
        )
        source_bonus = min(4.0, (tpl.sources_count - 1) * 1.5) if tpl.sources_count > 1 else 0.0
        team_score = round(min(100.0, weighted_avg + source_bonus), 1)
        team_tier = _score_to_tier_label(team_score)

        key = frozenset(slugs)
        prev = best_by_roster.get(key)
        if prev is None or (tpl.sources_count, team_score) > (prev["sources_count"], prev["score"]):
            best_by_roster[key] = {
                "id": tpl.id,
                "name": tpl.name,
                "archetype": tpl.archetype,
                "score": team_score,
                "tier": team_tier,
                "source": tpl.source,
                "sources_count": tpl.sources_count,
                "members": members_out,
                "_set": key,
            }

    all_playable = sorted(
        best_by_roster.values(),
        key=lambda x: (x["score"], x["sources_count"]),
        reverse=True,
    )
    playable_count = len(all_playable)

    if playable_count < team_count:
        return {
            "mode": mode,
            "team_count": team_count,
            "playable_templates_count": playable_count,
            "owned_count": len(owned_set),
            "locked_slugs": sorted(locked_set),
            "combinations": [],
        }

    # Mantém um pool focado para busca instantânea, preservando TODOS os times que contêm locked_slugs
    pool_limit = 75 if team_count == 2 else 55
    pool: list[dict[str, Any]] = []
    seen_ids: set[int] = set()
    for t in all_playable:
        if len(pool) < pool_limit or (locked_set and (t["_set"] & locked_set)):
            if t["id"] not in seen_ids:
                pool.append(t)
                seen_ids.add(t["id"])
    # Reordena pool por score decrescente para podar o branch-and-bound rapidamente
    pool.sort(key=lambda x: (x["score"], x["sources_count"]), reverse=True)

    # Bitmask por personagem para checagem de interseção em O(1)
    slug_to_bit: dict[str, int] = {}
    for t in pool:
        mask = 0
        for s in t["_set"]:
            if s not in slug_to_bit:
                slug_to_bit[s] = 1 << len(slug_to_bit)
            mask |= slug_to_bit[s]
        t["_mask"] = mask

    locked_mask = 0
    for ls in locked_set:
        if ls not in slug_to_bit:
            # Nenhum time jogável contém esse favorito -> impossível satisfazer
            return {
                "mode": mode,
                "team_count": team_count,
                "playable_templates_count": playable_count,
                "owned_count": len(owned_set),
                "locked_slugs": sorted(locked_set),
                "combinations": [],
            }
        locked_mask |= slug_to_bit[ls]

    # Busca branch-and-bound por combinações disjuntas de tamanho `team_count`
    raw_results: list[tuple[float, tuple[int, ...]]] = []
    max_raw = max(limit * 8, 48)
    n = len(pool)
    scores = [t["score"] for t in pool]
    masks = [t["_mask"] for t in pool]

    def _dfs(start_idx: int, chosen: list[int], used_mask: int, acc_score: float) -> None:
        rem = team_count - len(chosen)
        if rem == 0:
            if (used_mask & locked_mask) == locked_mask:
                raw_results.append((acc_score, tuple(chosen)))
                if len(raw_results) > max_raw * 3:
                    raw_results.sort(key=lambda r: r[0], reverse=True)
                    del raw_results[max_raw:]
            return

        if start_idx + rem > n:
            return

        # Poda otimista: melhor score possível restante
        if len(raw_results) >= max_raw:
            raw_results.sort(key=lambda r: r[0], reverse=True)
            del raw_results[max_raw:]
            cutoff = raw_results[-1][0]
            upper_bound = acc_score + sum(scores[start_idx : start_idx + rem])
            if upper_bound <= cutoff:
                return

        for i in range(start_idx, n - rem + 1):
            if used_mask & masks[i]:
                continue
            # Se é o último slot, verifica rápido se fecha todos os locked_slugs
            if rem == 1 and ((used_mask | masks[i]) & locked_mask) != locked_mask:
                continue
            chosen.append(i)
            _dfs(i + 1, chosen, used_mask | masks[i], acc_score + scores[i])
            chosen.pop()

    _dfs(0, [], 0, 0.0)
    raw_results.sort(key=lambda r: r[0], reverse=True)

    # Seleciona combinações diversas (no máx. 2 combinações repetindo exatamente o mesmo Time 1)
    combinations_out: list[dict[str, Any]] = []
    team1_usage: dict[int, int] = {}
    seen_combo_sigs: set[frozenset[int]] = set()

    for total_sc, idxs in raw_results:
        combo_teams = [pool[i] for i in idxs]
        combo_teams.sort(key=lambda t: t["score"], reverse=True)
        sig = frozenset(t["id"] for t in combo_teams)
        if sig in seen_combo_sigs:
            continue
        t1_id = combo_teams[0]["id"]
        if team1_usage.get(t1_id, 0) >= 2 and len(raw_results) > limit:
            continue

        seen_combo_sigs.add(sig)
        team1_usage[t1_id] = team1_usage.get(t1_id, 0) + 1

        avg_sc = round(total_sc / team_count, 1)
        clean_teams = [
            {k: v for k, v in t.items() if not k.startswith("_")}
            for t in combo_teams
        ]
        reasons = [
            f"{team_count * 4} personagens únicos — zero conflito de suportes entre os {team_count} times",
            f"Força média {avg_sc}/100 (Tier {_score_to_tier_label(avg_sc)}) para {'Abismo Espiral' if mode == 'abyss' else 'Stygian Onslaught'}",
        ]
        if locked_set:
            reasons.append(f"Inclui todos os {len(locked_set)} favorito(s) fixado(s)")

        combinations_out.append({
            "rank": len(combinations_out) + 1,
            "total_score": round(total_sc, 1),
            "avg_score": avg_sc,
            "avg_tier": _score_to_tier_label(avg_sc),
            "teams": clean_teams,
            "reasons": reasons,
        })
        if len(combinations_out) >= limit:
            break

    return {
        "mode": mode,
        "team_count": team_count,
        "playable_templates_count": playable_count,
        "owned_count": len(owned_set),
        "locked_slugs": sorted(locked_set),
        "combinations": combinations_out,
    }


def build_endgame_composer_response(
    db: Session,
    lang: Language,
    owned_slugs: list[str],
    mode: str = "abyss",
    locked_slugs: list[str] = (),
    excluded_slugs: list[str] = (),
    limit: int = 8,
) -> dict[str, Any]:
    """Carrega dados do banco e calcula combinações sem conflito para Abismo/Stygian."""
    db_chars = db.query(Character).all()
    characters: list[CharacterLite] = []
    for c in db_chars:
        resolved = resolve_character(db, c, lang)
        el = c.element.value if hasattr(c.element, "value") else str(c.element)
        wpn = c.weapon_type.value if hasattr(c.weapon_type, "value") else str(c.weapon_type)
        characters.append(
            CharacterLite(
                slug=c.slug,
                name=resolved["name"],
                icon=c.icon,
                rarity=c.rarity,
                element=el,
                weapon_type=wpn,
            )
        )

    db_templates = db.query(TeamTemplate).all()
    templates: list[TemplateLite] = []
    for t in db_templates:
        slugs = tuple(t.character_slugs or [])
        if len(slugs) != 4:
            continue
        sources_list = t.sources if isinstance(t.sources, list) else []
        templates.append(
            TemplateLite(
                id=t.id,
                name=t.name,
                archetype=t.archetype or "unknown",
                character_slugs=slugs,
                source=t.source,
                sources_count=max(len(sources_list), 1 if t.source else 0),
            )
        )

    general_tiers = _fetch_category_tiers(db, "general")
    abyss_tiers = _fetch_category_tiers(db, "abyss")
    stygian_tiers = _fetch_category_tiers(db, "stygian")

    return compute_endgame_combinations(
        characters=characters,
        templates=templates,
        general_tiers=general_tiers,
        abyss_tiers=abyss_tiers,
        stygian_tiers=stygian_tiers,
        owned_slugs=owned_slugs,
        mode=mode,
        locked_slugs=locked_slugs,
        excluded_slugs=excluded_slugs,
        limit=limit,
    )
