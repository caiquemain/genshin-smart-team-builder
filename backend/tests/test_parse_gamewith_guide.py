from pathlib import Path
import pytest

from app.scripts.parsers.gamewith import (
    _dedup_gamewith_name,
    _extract_prose_substitutes,
    parse_guide,
)


GAMEWITH_DIR = Path(__file__).resolve().parents[1] / "data" / "sources" / "guides" / "gamewith"


class TestGameWithHelpers:
    def test_dedup_glued_names(self):
        assert _dedup_gamewith_name("Splendor of Tranquil WatersSplendor of Tranquil Waters") == "Splendor of Tranquil Waters"
        assert _dedup_gamewith_name("Tome Of The Eternal Flow Tome Of The Eternal Flow") == "Tome Of The Eternal Flow"
        assert _dedup_gamewith_name("SerenitySerenity's Call") == "Serenity's Call"
        assert _dedup_gamewith_name("NocturneNocturne's Curtain Call") == "Nocturne's Curtain Call"
        assert _dedup_gamewith_name("DahliaDahlia (C6)") == "Dahlia"
        assert _dedup_gamewith_name("Golden TroupeAny Elemental Skill DMG") == "Golden Troupe"

    def test_extract_prose_substitutes(self):
        alts = _extract_prose_substitutes(
            ["furina", "skirk", "escoffier", "dahlia"],
            "Dahlia can be switched out for Yelan or Shenhe.",
        )
        assert alts == {"4": ["yelan", "shenhe"]}


def test_real_gamewith_furina_guide_regression():
    path = GAMEWITH_DIR / "furina.txt"
    if not path.exists():
        pytest.skip(f"Fixture {path} not found")

    result = parse_guide(path.read_text(encoding="utf-8"), "furina")
    bd = result["build"]["build_data"]

    assert result["source"] == "GameWith"
    assert result["source_slug"] == "gamewith"
    assert result["tier_ratings"]["Overall"] == "SS"
    assert result["tier_ratings"]["Support"] == "SS"
    assert bd["weapons"][0]["weapon_slug"] == "splendor-of-tranquil-waters"
    assert "serenity-s-call" in [w["weapon_slug"] for w in bd["weapons"]]
    assert len(bd["weapons"]) == 8
    assert [a["artifact_set_slug"] for a in bd["artifacts_4pc"]] == ["golden-troupe"]
    assert len(bd["artifacts_2pc"]) == 1
    assert bd["er_requirement"] == "180%~"
    assert bd["talent_priority"] == "Burst > Skill > Normal"
    assert len(result["teams"]) == 2
    assert result["teams"][0]["character_slugs"] == ["furina", "skirk", "escoffier", "dahlia"]
    assert result["teams"][0]["slot_alternatives"] == {"4": ["yelan", "shenhe"]}
    assert result["teams"][1]["character_slugs"] == ["furina", "yanfei", "sucrose", "barbara"]


def test_real_gamewith_neuvillette_guide_regression():
    path = GAMEWITH_DIR / "neuvillette.txt"
    if not path.exists():
        pytest.skip(f"Fixture {path} not found")

    result = parse_guide(path.read_text(encoding="utf-8"), "neuvillette")
    bd = result["build"]["build_data"]

    assert result["source"] == "GameWith"
    assert result["tier_ratings"] == {"Overall": "S", "On-Field": "S", "DPS": "S"}
    w_slugs = [w["weapon_slug"] for w in bd["weapons"]]
    assert w_slugs[0] == "tome-of-the-eternal-flow"
    assert "nocturne-s-curtain-call" in w_slugs
    assert "surf-s-up" in w_slugs
    assert "prototype-amber" in w_slugs
    assert [a["artifact_set_slug"] for a in bd["artifacts_4pc"]] == [
        "marechaussee-hunter",
        "heart-of-depth",
        "wanderer-s-troupe",
    ]
    assert len(bd["artifacts_2pc"]) == 1
    assert bd["talent_priority"] == "Normal > Burst > Skill"
    assert len(result["teams"]) == 3
    assert result["teams"][0]["character_slugs"] == ["neuvillette", "ineffa", "xilonen", "furina"]
    assert result["teams"][0]["slot_alternatives"] == {"4": ["columbina"]}
    assert result["teams"][1]["character_slugs"] == ["neuvillette", "escoffier", "furina", "citlali"]
    assert result["teams"][2]["character_slugs"] == ["neuvillette", "lan-yan", "fischl", "yaoyao"]
