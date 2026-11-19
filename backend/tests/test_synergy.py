from types import SimpleNamespace
from unittest.mock import MagicMock

from app.models import Character, ElementalReaction
from app.services.synergy import classify_role, analyze_team


def _make_char(
    slug: str,
    element: str = "hydro",
    weapon_type: str = "sword",
    ascension_stat: str | None = None,
    base_def: int = 50,
    name: str | None = None,
):
    return SimpleNamespace(
        slug=slug,
        name=name or slug.replace("-", " ").title(),
        icon=f"{slug}.png",
        element=SimpleNamespace(value=element),
        weapon_type=SimpleNamespace(value=weapon_type),
        ascension_stat=SimpleNamespace(value=ascension_stat) if ascension_stat else None,
        base_def=base_def,
    )


def _make_reaction(slug: str, elements: list[str], name: str | None = None):
    return SimpleNamespace(
        slug=slug,
        name=name or slug.title(),
        elements=elements,
        effect=f"Effect of {slug}",
    )


def _mock_db(chars: list, reactions: list | None = None):
    reactions = reactions or []
    db = MagicMock()

    def query_side_effect(model):
        q = MagicMock()
        if model is Character:
            q.filter.return_value.all.return_value = chars
        elif model is ElementalReaction:
            q.all.return_value = reactions
        return q

    db.query.side_effect = query_side_effect
    return db


class TestClassifyRole:
    def test_uses_known_capabilities_first(self):
        assert classify_role(_make_char("skirk", "cryo")) == "dps"
        assert classify_role(_make_char("furina", "hydro")) == "sub"
        assert classify_role(_make_char("bennett", "pyro")) == "healer"
        assert classify_role(_make_char("zhongli", "geo")) == "shielder"
        assert classify_role(_make_char("kazuha", "anemo")) == "support"

    def test_fallback_heuristics_for_unknown_characters(self):
        assert classify_role(_make_char("unknown-1", ascension_stat="healing_bonus")) == "healer"
        assert classify_role(_make_char("unknown-2", weapon_type="catalyst", ascension_stat="hp_pct")) == "healer"
        assert classify_role(_make_char("unknown-3", ascension_stat="def_pct", base_def=80)) == "shielder"
        assert classify_role(_make_char("unknown-4", element="geo", weapon_type="claymore")) == "shielder"
        assert classify_role(_make_char("unknown-5", ascension_stat="em")) == "support"
        assert classify_role(_make_char("unknown-6", ascension_stat="crit_rate")) == "dps"
        assert classify_role(_make_char("unknown-7", weapon_type="catalyst")) == "support"
        assert classify_role(_make_char("unknown-8", weapon_type="polearm")) == "dps"


class TestAnalyzeTeam:
    def test_empty_team(self):
        db = _mock_db([])
        res = analyze_team(db, ["nonexistent"])
        assert res["score"] == 0
        assert res["warnings"] == ["Time vazio"]
        assert res["roles"] == []

    def test_optimal_skirk_freeze_core_scores_high(self):
        chars = [
            _make_char("skirk", "cryo"),
            _make_char("furina", "hydro"),
            _make_char("escoffier", "cryo"),
            _make_char("vodyanitsa", "hydro"),
        ]
        reactions = [
            _make_reaction("freeze", ["cryo", "hydro"]),
            _make_reaction("vaporize", ["pyro", "hydro"]),
        ]
        db = _mock_db(chars, reactions)
        res = analyze_team(db, ["skirk", "furina", "escoffier", "vodyanitsa"])

        assert res["score"] == 100
        assert res["warnings"] == []
        assert [r["slug"] for r in res["reactions"]] == ["freeze"]
        assert len(res["roles"]) == 4

    def test_skirk_and_escoffier_penalized_outside_cryo_hydro(self):
        chars = [
            _make_char("skirk", "cryo"),
            _make_char("escoffier", "cryo"),
            _make_char("furina", "hydro"),
            _make_char("bennett", "pyro"),
        ]
        db = _mock_db(chars, [_make_reaction("freeze", ["cryo", "hydro"])])
        res = analyze_team(db, ["skirk", "escoffier", "furina", "bennett"])

        factors = [b["factor"] for b in res["breakdown"]]
        assert any("Skirk exige apenas Cryo/Hydro" in f for f in factors)
        assert any("Escoffier exige apenas Cryo/Hydro" in f for f in factors)
        assert any("Skirk exige time 100% Cryo/Hydro" in w for w in res["warnings"])
        assert any("Escoffier exige time 100% Cryo/Hydro" in w for w in res["warnings"])

    def test_furina_without_strong_healer_penalized_and_suggests_escoffier(self):
        chars = [
            _make_char("neuvillette", "hydro"),
            _make_char("furina", "hydro"),
            _make_char("kazuha", "anemo"),
            _make_char("zhongli", "geo"),
        ]
        reactions = [_make_reaction("swirl", ["anemo", "qualquer"])]
        db = _mock_db(chars, reactions)
        res = analyze_team(db, ["neuvillette", "furina", "kazuha", "zhongli"])

        assert any("Furina sem healer forte" in b["factor"] for b in res["breakdown"])
        assert any("Fanfare" in w for w in res["warnings"])
        assert any(s["slug"] == "escoffier" for s in res["suggestions"])
        assert [r["slug"] for r in res["reactions"]] == ["swirl"]

    def test_redundant_pure_healer_penalty(self):
        chars = [
            _make_char("arlecchino", "pyro"),
            _make_char("yelan", "hydro"),
            _make_char("bennett", "pyro"),
            _make_char("barbara", "hydro"),
        ]
        db = _mock_db(chars)
        res = analyze_team(db, ["arlecchino", "yelan", "bennett", "barbara"])

        assert any("Healer redundante" in b["factor"] for b in res["breakdown"])
        assert any("2 healers" in w for w in res["warnings"])

    def test_three_on_field_dps_and_mono_element_clamped_at_zero(self):
        chars = [
            _make_char("diluc", "pyro"),
            _make_char("klee", "pyro"),
            _make_char("yoimiya", "pyro"),
            _make_char("hutao", "pyro"),
        ]
        db = _mock_db(chars)
        res = analyze_team(db, ["diluc", "klee", "yoimiya", "hutao"])

        assert 0 <= res["score"] <= 100
        assert any("4 DPS on-field competindo" in b["factor"] for b in res["breakdown"])
        assert any("3+ chars do mesmo elemento (pyro)" in b["factor"] for b in res["breakdown"])
        assert any("Mono-elemento" in w for w in res["warnings"])
        assert any(s["slug"] == "furina" for s in res["suggestions"])
