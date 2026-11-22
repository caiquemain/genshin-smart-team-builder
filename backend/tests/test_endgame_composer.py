"""Unit tests for the Conflict-Free Endgame Team Composer (Abyss 2 Teams / Stygian 3 Teams)."""
from app.services.endgame_composer import compute_endgame_combinations
from app.services.pull_advisor import CharacterLite, TemplateLite, TierSummaryLite


def _c(slug: str, element: str = "hydro") -> CharacterLite:
    return CharacterLite(slug=slug, name=slug.title(), icon=None, rarity=5, element=element, weapon_type="sword")


def _t(tid: int, name: str, slugs: tuple[str, ...]) -> TemplateLite:
    return TemplateLite(id=tid, name=name, archetype="hypercarry", character_slugs=slugs, source="KQM", sources_count=2)


def _tier(label: str, avg: float) -> TierSummaryLite:
    return TierSummaryLite(consensus_tier=label, avg_score=avg, site_count=3)


def test_abyss_picks_two_disjoint_teams_avoiding_support_conflict():
    chars = [_c(s) for s in [
        "neuvillette", "furina", "kazuha", "xilonen",
        "arlecchino", "bennett", "yelan", "zhongli",
        "skirk", "escoffier", "shenhe",
    ]]
    templates = [
        _t(1, "Neuvi Furina", ("neuvillette", "furina", "kazuha", "xilonen")),
        _t(2, "Skirk Furina (conflita Furina)", ("skirk", "furina", "escoffier", "shenhe")),
        _t(3, "Arle Vape (sem conflito)", ("arlecchino", "bennett", "yelan", "zhongli")),
    ]
    tiers = {c.slug: _tier("S+", 0.96) for c in chars}

    res = compute_endgame_combinations(
        characters=chars,
        templates=templates,
        general_tiers=tiers,
        abyss_tiers=tiers,
        stygian_tiers=tiers,
        owned_slugs=[c.slug for c in chars],
        mode="abyss",
    )

    assert res["team_count"] == 2
    assert len(res["combinations"]) >= 1
    top = res["combinations"][0]
    all_slugs = [m["slug"] for team in top["teams"] for m in team["members"]]
    assert len(all_slugs) == 8
    assert len(set(all_slugs)) == 8  # Zero conflito!


def test_stygian_builds_three_disjoint_teams_and_respects_locked_favorites():
    chars = [_c(f"c{i}") for i in range(1, 13)]
    templates = [
        _t(1, "Time A", ("c1", "c2", "c3", "c4")),
        _t(2, "Time B", ("c5", "c6", "c7", "c8")),
        _t(3, "Time C", ("c9", "c10", "c11", "c12")),
        _t(4, "Time Conflito", ("c1", "c5", "c9", "c10")),
    ]
    tiers = {c.slug: _tier("S", 0.9) for c in chars}

    res = compute_endgame_combinations(
        characters=chars,
        templates=templates,
        general_tiers=tiers,
        abyss_tiers=tiers,
        stygian_tiers=tiers,
        owned_slugs=[c.slug for c in chars],
        mode="stygian",
        locked_slugs=["c1", "c9"],
    )

    assert res["team_count"] == 3
    assert len(res["combinations"]) == 1
    top = res["combinations"][0]
    used = {m["slug"] for team in top["teams"] for m in team["members"]}
    assert len(used) == 12
    assert {"c1", "c9"}.issubset(used)
