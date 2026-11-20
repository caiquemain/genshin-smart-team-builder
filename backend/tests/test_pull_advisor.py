"""Testes unitários para o motor de recomendações do Pull Advisor."""
from app.services.pull_advisor import (
    CharacterLite,
    TemplateLite,
    TierSummaryLite,
    compute_pull_recommendations,
)


def _sample_world():
    chars = [
        CharacterLite("skirk", "Skirk", None, 5, "cryo", "sword"),
        CharacterLite("furina", "Furina", None, 5, "hydro", "sword"),
        CharacterLite("yelan", "Yelan", None, 5, "hydro", "bow"),
        CharacterLite("escoffier", "Escoffier", None, 5, "cryo", "polearm"),
        CharacterLite("citlali", "Citlali", None, 5, "cryo", "catalyst"),
        CharacterLite("mavuika", "Mavuika", None, 5, "pyro", "claymore"),
        CharacterLite("xilonen", "Xilonen", None, 5, "geo", "sword"),
        CharacterLite("zibai", "Zibai", None, 5, "geo", "sword"),
        CharacterLite("columbina", "Columbina", None, 5, "hydro", "catalyst"),
        CharacterLite("amber", "Amber", None, 4, "pyro", "bow"),
        CharacterLite("aloy", "Aloy", None, 5, "cryo", "bow"),
        CharacterLite("traveler-cryo", "Traveler (Cryo)", None, 5, "cryo", "sword"),
    ]
    templates = [
        TemplateLite(1, "Skirk Freeze", "freeze", ("skirk", "furina", "escoffier", "yelan"), "KQM", 3),
        TemplateLite(2, "Skirk Freeze Alt", "freeze", ("skirk", "furina", "escoffier", "citlali"), "Game8", 2),
        TemplateLite(3, "Mavuika Melt", "melt", ("mavuika", "citlali", "xilonen", "furina"), "KQM", 2),
        TemplateLite(4, "Zibai Lunar", "hypercarry", ("zibai", "columbina", "xilonen", "furina"), "YS Abyss 7.2", 2),
    ]
    general = {
        "skirk": TierSummaryLite("S+", 0.90, 7, "main_dps"),
        "furina": TierSummaryLite("S+", 0.92, 7, "sub_dps"),
        "yelan": TierSummaryLite("S", 0.78, 7, "sub_dps"),
        "escoffier": TierSummaryLite("S+", 0.91, 7, "sub_dps"),
        "citlali": TierSummaryLite("S+", 0.89, 7, "support"),
        "mavuika": TierSummaryLite("S+", 0.95, 7, "main_dps"),
        "xilonen": TierSummaryLite("S", 0.84, 7, "support"),
        "zibai": TierSummaryLite("S+", 0.92, 7, "main_dps"),
        "columbina": TierSummaryLite("S+", 0.94, 7, "sub_dps"),
        "amber": TierSummaryLite("D", 0.05, 7, "sub_dps"),
    }
    abyss = {
        "zibai": TierSummaryLite("S+", 1.0, 1, "main_dps"),
        "columbina": TierSummaryLite("S+", 1.0, 1, "sub_dps"),
        "escoffier": TierSummaryLite("B", 0.25, 1, "sub_dps"),
        "mavuika": TierSummaryLite("A", 0.50, 1, "main_dps"),
    }
    stygian = {
        "zibai": TierSummaryLite("S+", 1.0, 2, "main_dps"),
        "columbina": TierSummaryLite("S+", 1.0, 2, "sub_dps"),
        "escoffier": TierSummaryLite("S", 0.75, 2, "sub_dps"),
        "mavuika": TierSummaryLite("S+", 0.90, 2, "main_dps"),
    }
    return chars, templates, general, abyss, stygian


class TestPullAdvisor:
    def test_escoffier_ranks_first_when_unlocking_skirk_furina_core_and_fixing_furina_healer_gap(self):
        chars, templates, general, abyss, stygian = _sample_world()
        res = compute_pull_recommendations(
            characters=chars,
            templates=templates,
            general_tiers=general,
            abyss_tiers=abyss,
            stygian_tiers=stygian,
            owned_slugs=["skirk", "furina", "yelan"],
            goal="meta",
        )
        recs = res["recommendations"]
        rec_slugs = [r["slug"] for r in recs]

        # Nunca sugere quem já possui, nem Aloy, nem Travelers
        assert "skirk" not in rec_slugs
        assert "furina" not in rec_slugs
        assert "aloy" not in rec_slugs
        assert "traveler-cryo" not in rec_slugs

        # Escoffier fecha 3/4 -> 4/4 da Skirk + resolve healer da Furina + RES shred
        top = recs[0]
        assert top["slug"] == "escoffier"
        assert top["unlocked_teams_count"] == 1
        assert top["unlocked_teams"][0]["name"] == "Skirk Freeze"
        assert top["verdict"] in ("must_pull", "high_value")
        assert any("Furina" in r for r in top["reasons"])
        assert res["account_summary"]["almost_ready_teams_count"] == 1

    def test_endgame_goal_boosts_seasonal_dominators(self):
        chars, templates, general, abyss, stygian = _sample_world()
        # Conta sem times 3/4 prontos: modo endgame deve elevar Zibai/Columbina (S+ Abyss + S+ Stygian)
        res_endgame = compute_pull_recommendations(
            characters=chars,
            templates=templates,
            general_tiers=general,
            abyss_tiers=abyss,
            stygian_tiers=stygian,
            owned_slugs=["amber"],
            goal="endgame",
        )
        top2 = {r["slug"] for r in res_endgame["recommendations"][:2]}
        assert top2 == {"zibai", "columbina"}

    def test_imaginarium_goal_boosts_weak_element_coverage(self):
        chars, templates, general, abyss, stygian = _sample_world()
        # Conta cheia de Cryo/Hydro e 0 Geo/Pyro
        res = compute_pull_recommendations(
            characters=chars,
            templates=templates,
            general_tiers=general,
            abyss_tiers=abyss,
            stygian_tiers=stygian,
            owned_slugs=["skirk", "furina", "yelan", "escoffier", "citlali"],
            goal="imaginarium",
        )
        assert "geo" in res["account_summary"]["weak_elements"] or "pyro" in res["account_summary"]["weak_elements"]
        geo_or_pyro = [r for r in res["recommendations"][:3] if r["element"] in ("geo", "pyro")]
        assert len(geo_or_pyro) >= 2

    def test_banner_simulator_evaluates_target_even_when_filtered_or_owned(self):
        chars, templates, general, abyss, stygian = _sample_world()
        res = compute_pull_recommendations(
            characters=chars,
            templates=templates,
            general_tiers=general,
            abyss_tiers=abyss,
            stygian_tiers=stygian,
            owned_slugs=["skirk", "furina", "yelan"],
            goal="meta",
            rarity_filter=5,
            target_slug="amber",
        )
        assert res["target_evaluation"] is not None
        assert res["target_evaluation"]["slug"] == "amber"
        assert res["target_evaluation"]["verdict"] == "situational"
        # Amber é 4★ então não entra na lista filtrada por 5★
        assert all(r["rarity"] == 5 for r in res["recommendations"])

    def test_archetype_diminishing_returns_prefers_diverse_unlocks(self):
        chars = [
            CharacterLite("dps1", "DPS 1", None, 5, "pyro", "sword"),
            CharacterLite("dps2", "DPS 2", None, 5, "hydro", "sword"),
            CharacterLite("sup1", "Sup 1", None, 5, "anemo", "sword"),
            CharacterLite("sup2", "Sup 2", None, 5, "geo", "sword"),
            CharacterLite("cand-same", "Cand Same", None, 5, "cryo", "sword"),
            CharacterLite("cand-diverse", "Cand Diverse", None, 5, "cryo", "sword"),
        ]
        templates = [
            # cand-same fecha 2 times do MESMO arquétipo (freeze)
            TemplateLite(1, "Freeze A", "freeze", ("dps1", "sup1", "sup2", "cand-same"), "KQM", 1),
            TemplateLite(2, "Freeze B", "freeze", ("dps2", "sup1", "sup2", "cand-same"), "KQM", 1),
            # cand-diverse fecha 2 times de arquétipos DIFERENTES (melt + vaporize)
            TemplateLite(3, "Melt A", "melt", ("dps1", "sup1", "sup2", "cand-diverse"), "KQM", 1),
            TemplateLite(4, "Vape B", "vaporize", ("dps2", "sup1", "sup2", "cand-diverse"), "KQM", 1),
        ]
        same_tier = TierSummaryLite("S", 0.80, 7, "support")
        general = {c.slug: same_tier for c in chars}
        res = compute_pull_recommendations(
            characters=chars,
            templates=templates,
            general_tiers=general,
            abyss_tiers={},
            stygian_tiers={},
            owned_slugs=["dps1", "dps2", "sup1", "sup2"],
            goal="unlock_teams",
        )
        scores = {r["slug"]: r["breakdown"]["team_unlocks"] for r in res["recommendations"]}
        assert scores["cand-diverse"] > scores["cand-same"]
