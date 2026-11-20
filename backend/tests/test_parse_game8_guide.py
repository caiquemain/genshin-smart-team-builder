from pathlib import Path
import pytest

from app.scripts.parsers.game8 import (
    _clean_game8_item_line,
    parse_tier_ratings,
    parse_talent_priority,
    parse_weapons,
    parse_artifacts,
    parse_stats,
    parse_teams,
    parse_guide,
)


GAME8_DIR = Path(__file__).resolve().parents[1] / "data" / "sources" / "guides" / "game8"


class TestGame8Helpers:
    def test_clean_game8_item_line_variants(self):
        assert _clean_game8_item_line("Genshin Impact - Tome of the Eternal Flow Image Tome of the Eternal Flow") == "Tome of the Eternal Flow"
        assert _clean_game8_item_line("Genshin - Marechaussee Hunter ImageMarechaussee Hunter") == "Marechaussee Hunter"
        assert _clean_game8_item_line("Genshin Impact - Surf Surf's Up") == "Surf's Up"
        assert _clean_game8_item_line("Genshin - NeuvilletteNeuvillette") == "Neuvillette"

    def test_parse_tier_ratings_and_talent_priority(self):
        doc = (
            "Tier List Rankings\n"
            "Main DPS\tSub-DPS\tSupport\tExploration\n"
            "A\t-\t-\tSS\n"
            "1st\t2nd\t3rd\n"
            "Normal Attack\tElemental Skill\tElemental Burst\n"
        )
        assert parse_tier_ratings(doc) == {"Main DPS": "A", "Exploration": "SS"}
        assert parse_talent_priority(doc) == "Normal > Skill > Burst"

    def test_parse_teams_infers_3_of_4_sibling_alternatives_cross_element(self):
        doc = (
            "Neuvillette Best Team Comps\n"
            "Neuvillette Lunar-Charged Team\n"
            "Genshin - NeuvilletteNeuvillette\tGenshin - IneffaIneffa\tGenshin - ColumbinaColumbina\tGenshin - SucroseSucrose\n"
            "Team Summary\n"
            "Sucrose boosts EM.\n"
            "Neuvillette Constellations\n"
            "General Team Comps\n"
            "Genshin - Neuvillette ImageGenshin - Columbina ImageGenshin - Ineffa ImageGenshin - Xilonen Image\n"
            "Alternate Lunar-Charged team.\n"
            "Neuvillette Talent Priority\n"
        )
        teams = parse_teams(doc)
        assert len(teams) == 2
        assert teams[0]["character_slugs"] == ["neuvillette", "ineffa", "columbina", "sucrose"]
        assert teams[0]["slot_alternatives"] == {"4": ["xilonen"]}
        assert teams[1]["character_slugs"] == ["neuvillette", "columbina", "ineffa", "xilonen"]
        assert teams[1]["slot_alternatives"] == {"4": ["sucrose"]}


def test_real_game8_neuvillette_guide_regression():
    path = GAME8_DIR / "neuvillette.txt"
    if not path.exists():
        pytest.skip(f"Fixture {path} not found")

    result = parse_guide(path.read_text(encoding="utf-8"), "neuvillette")
    bd = result["build"]["build_data"]

    assert result["source"] == "Game8"
    assert result["source_slug"] == "game8"
    assert result["tier_ratings"] == {"Main DPS": "A", "Exploration": "SS"}
    assert bd["weapons"][0]["weapon_slug"] == "tome-of-the-eternal-flow"
    assert len(bd["weapons"]) >= 8
    assert [a["artifact_set_slug"] for a in bd["artifacts_4pc"]] == ["marechaussee-hunter", "heart-of-depth"]
    assert bd["sands_stat"] == ["hp_pct"]
    assert bd["goblet_stat"] == ["hydro_dmg", "hp_pct"]
    assert bd["circlet_stat"] == ["crit_rate", "crit_dmg", "hp_pct"]
    assert bd["substat_priority"] == ["er", "crit_rate", "crit_dmg", "hp_pct"]
    assert bd["talent_priority"] == "Normal > Skill > Burst"
    assert len(result["teams"]) == 3
    # Verifica alternativa cross-element (Sucrose <-> Xilonen) inferida entre times 3/4 irmãos
    lunar_sucrose = next(t for t in result["teams"] if "sucrose" in t["character_slugs"])
    assert lunar_sucrose["slot_alternatives"] == {"4": ["xilonen"]}


def test_real_game8_furina_guide_regression():
    path = GAME8_DIR / "furina.txt"
    if not path.exists():
        pytest.skip(f"Fixture {path} not found")

    result = parse_guide(path.read_text(encoding="utf-8"), "furina")
    bd = result["build"]["build_data"]

    assert result["source"] == "Game8"
    assert bd["weapons"][0]["weapon_slug"] == "splendor-of-tranquil-waters"
    assert "the-dockhand-s-assistant" in [w["weapon_slug"] for w in bd["weapons"]]
    assert [a["artifact_set_slug"] for a in bd["artifacts_4pc"]] == [
        "golden-troupe",
        "tenacity-of-the-millelith",
        "scroll-of-the-hero-of-cinder-city",
    ]
    assert bd["er_requirement"] == "180% or above"
    assert bd["talent_priority"] == "Burst > Skill > Normal"
    assert len(result["notable_teammates"]) == 10
    assert len(result["teams"]) == 3

    freeze = next(t for t in result["teams"] if "skirk" in t["character_slugs"])
    assert freeze["slot_alternatives"] == {"4": ["yelan", "xingqiu"]}

    hyper = next(t for t in result["teams"] if "wriothesley" in t["character_slugs"])
    assert hyper["slot_alternatives"] == {"2": ["shinobu"], "3": ["sucrose"], "4": ["neuvillette"]}
