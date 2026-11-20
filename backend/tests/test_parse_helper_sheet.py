from pathlib import Path
import pytest

from app.scripts.parsers.helper_sheet import parse_element_csv


HELPER_DIR = Path(__file__).resolve().parents[1] / "data" / "sources" / "helper_sheet"


def test_all_seven_helper_sheet_csvs_parse_completely():
    csv_files = sorted(HELPER_DIR.glob("*.csv"))
    if not csv_files:
        pytest.skip("No Helper Sheet CSV fixtures found")

    assert len(csv_files) == 7
    all_guides: dict[str, dict] = {}
    for path in csv_files:
        guides = parse_element_csv(path.read_text(encoding="utf-8", errors="replace"), path.stem)
        assert len(guides) >= 13
        for g in guides:
            all_guides[g["character_slug"]] = g

    assert len(all_guides) == 119

    # Todos os 119 personagens têm armas, artefatos e stats (incluindo Beidou com células mescladas!)
    for slug, g in all_guides.items():
        bd = g["build"]["build_data"]
        assert len(bd["weapons"]) >= 1, f"{slug} sem armas"
        assert len(bd["artifacts_4pc"]) + len(bd["artifacts_2pc"]) >= 1, f"{slug} sem artefatos"
        assert bd["sands_stat"] or bd["goblet_stat"] or bd["circlet_stat"], f"{slug} sem main stats"

    # Spot-checks de qualidade
    furina_bd = all_guides["furina"]["build"]["build_data"]
    assert furina_bd["weapons"][0]["weapon_slug"] == "splendor-of-tranquil-waters"
    assert "golden-troupe" in [a["artifact_set_slug"] for a in furina_bd["artifacts_4pc"]]
    assert furina_bd["talent_priority"] == "Burst = Skill"

    beidou_bd = all_guides["beidou"]["build"]["build_data"]
    assert "emblem-of-severed-fate" in [a["artifact_set_slug"] for a in beidou_bd["artifacts_4pc"]]
    assert beidou_bd["goblet_stat"] == ["electro_dmg"]

    assert "traveler-dendro" in all_guides
    assert "traveler-pyro" in all_guides
    assert "skirk" in all_guides
