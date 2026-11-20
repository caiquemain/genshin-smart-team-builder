from pathlib import Path
import pytest

from app.scripts.parsers.genshingg import (
    parse_weapons,
    parse_artifacts,
    parse_stats,
    parse_teams,
    parse_guide,
)


GENSHINGG_DIR = Path(__file__).resolve().parents[1] / "data" / "sources" / "guides" / "genshingg"


def test_real_genshingg_furina_guide_regression():
    path = GENSHINGG_DIR / "furina.txt"
    if not path.exists():
        pytest.skip(f"Fixture {path} not found")

    result = parse_guide(path.read_text(encoding="utf-8"), "furina")
    bd = result["build"]["build_data"]

    assert result["source"] == "Genshin.gg"
    assert result["source_slug"] == "genshingg"
    assert [w["weapon_slug"] for w in bd["weapons"]] == [
        "splendor-of-tranquil-waters",
        "favonius-sword",
        "primordial-jade-cutter",
        "serenity-s-call",
        "uraku-misugiri",
    ]
    assert "R5" in (bd["weapons"][3]["notes"] or "")
    assert [a["artifact_set_slug"] for a in bd["artifacts_4pc"]] == [
        "golden-troupe",
        "tenacity-of-the-millelith",
    ]
    assert len(bd["artifacts_2pc"]) == 3
    assert bd["sands_stat"] == ["er", "hp_pct"]
    assert bd["goblet_stat"] == ["hydro_dmg", "hp_pct"]
    assert bd["circlet_stat"] == ["crit_rate", "crit_dmg"]
    assert bd["substat_priority"] == ["er", "crit_rate", "crit_dmg", "hp_pct"]
    assert len(result["teams"]) == 3
    assert result["teams"][2]["character_slugs"] == ["neuvillette", "furina", "xilonen", "kazuha"]


def test_real_genshingg_neuvillette_guide_regression():
    path = GENSHINGG_DIR / "neuvillette.txt"
    if not path.exists():
        pytest.skip(f"Fixture {path} not found")

    result = parse_guide(path.read_text(encoding="utf-8"), "neuvillette")
    bd = result["build"]["build_data"]

    assert result["source"] == "Genshin.gg"
    assert bd["weapons"][0]["weapon_slug"] == "tome-of-the-eternal-flow"
    assert len(bd["weapons"]) == 5
    assert [a["artifact_set_slug"] for a in bd["artifacts_4pc"]] == [
        "marechaussee-hunter",
        "heart-of-depth",
    ]
    assert len(bd["artifacts_2pc"]) == 3
    assert bd["sands_stat"] == ["hp_pct"]
    assert bd["goblet_stat"] == ["hydro_dmg"]
    assert bd["circlet_stat"] == ["crit_rate", "crit_dmg"]
    assert len(result["teams"]) == 3
    assert [t["character_slugs"] for t in result["teams"]] == [
        ["neuvillette", "furina", "xilonen", "kazuha"],
        ["neuvillette", "fischl", "zhongli", "kazuha"],
        ["neuvillette", "nahida", "kuki-shinobu", "zhongli"],
    ]
