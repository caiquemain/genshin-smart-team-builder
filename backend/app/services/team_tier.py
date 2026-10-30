"""Cálculo de tier do time baseado nos consensus_tier dos personagens.

Regra: cada consensus_tier vira valor numérico (S+=6 ... D=1).
Média dos 4 chars, round half-up. Time 4 S+ = S+ (100%).
"""
from collections import defaultdict
from sqlalchemy import text
from sqlalchemy.orm import Session


TIER_TO_VALUE = {"S+": 6, "S": 5, "A": 4, "B": 3, "C": 2, "D": 1}
VALUE_TO_TIER = {6: "S+", 5: "S", 4: "A", 3: "B", 2: "C", 1: "D"}


def compute_team_tier(char_tiers: list[tuple[str, str, str | None]]) -> dict:
    """Média dos tiers consolidados, arredonda half-up pro tier mais próximo."""
    values: list[int] = []
    details: list[dict] = []

    for slug, name, tier in char_tiers:
        if tier and tier in TIER_TO_VALUE:
            v = TIER_TO_VALUE[tier]
            values.append(v)
            details.append({"slug": slug, "name": name, "tier": tier, "value": v})
        else:
            details.append({"slug": slug, "name": name, "tier": None, "value": None})

    if not values:
        return {"tier": None, "value": 0.0, "filled": 0,
                "missing": len(char_tiers), "char_tiers": details}

    avg = sum(values) / len(values)
    rounded = int(avg + 0.5)
    rounded = max(1, min(6, rounded))

    return {
        "tier": VALUE_TO_TIER[rounded],
        "value": round(avg, 2),
        "filled": len(values),
        "missing": len(char_tiers) - len(values),
        "char_tiers": details,
    }


def fetch_char_tiers_batch(db: Session, team_ids: list[int]) -> dict[int, dict]:
    """Batch: {team_id: TeamTierInfo} pra todos os times de uma vez."""
    if not team_ids:
        return {}
    rows = db.execute(text("""
        SELECT tc.team_id, c.slug, c.name, v.consensus_tier
        FROM team_characters tc
        JOIN characters c ON c.id = tc.character_id
        LEFT JOIN v_tierlist_consensus v ON v.character_slug = c.slug
        WHERE tc.team_id = ANY(:ids)
        ORDER BY tc.team_id, tc.position
    """), {"ids": team_ids}).all()

    grouped: dict[int, list] = defaultdict(list)
    for r in rows:
        grouped[r[0]].append((r[1], r[2], r[3]))

    return {tid: compute_team_tier(chars) for tid, chars in grouped.items()}


def fetch_char_tiers_slugs(db: Session, slugs: list[str]) -> dict:
    """Preview sem persistir: computa tier de uma lista de slugs (TeamBuilder)."""
    if not slugs:
        return compute_team_tier([])
    rows = db.execute(text("""
        SELECT c.slug, c.name, v.consensus_tier
        FROM characters c
        LEFT JOIN v_tierlist_consensus v ON v.character_slug = c.slug
        WHERE c.slug = ANY(:slugs)
    """), {"slugs": slugs}).all()
    by_slug = {r[0]: (r[0], r[1], r[2]) for r in rows}
    ordered = [by_slug[s] for s in slugs if s in by_slug]
    return compute_team_tier(ordered)
