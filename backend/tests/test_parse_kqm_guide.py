from pathlib import Path
import pytest

from app.scripts.parse_kqm_guide import (
    split_respecting_parens,
    strip_parentheses,
    clean_weapon_name,
    clean_char_name,
    to_slug,
    trim_at_toc,
    split_sections,
    find_all_sections,
    parse_weapons,
    parse_artifacts,
    parse_stat_cell,
    parse_stats,
    parse_talent_priority,
    parse_combos,
    parse_teams,
    parse_guide,
)


KQM_DIR = Path(__file__).resolve().parents[1] / "data" / "kqm"


class TestStringHelpers:
    def test_split_respecting_parens(self):
        raw = "Mistsplitter Reforged (R1, 3 stacks), Primordial Jade Cutter, Finale of the Deep (R5)"
        assert split_respecting_parens(raw) == [
            "Mistsplitter Reforged (R1, 3 stacks)",
            "Primordial Jade Cutter",
            "Finale of the Deep (R5)",
        ]

    def test_clean_and_slug(self):
        assert strip_parentheses("Furina (C2)") == "Furina"
        assert clean_weapon_name("5★ Splendor of Tranquil Waters") == "Splendor of Tranquil Waters"
        assert clean_char_name("C6 Xingqiu/Yelan") == "Xingqiu"
        assert to_slug("5★ Crimson Moon's Semblance (R1)") == "crimson-moon-s-semblance"
        assert to_slug("C2 Kaedehara Kazuha") == "kaedehara-kazuha"

    def test_trim_at_toc(self):
        text = "Header\nBody\nTable of Contents\nFooter noise"
        assert trim_at_toc(text) == "Header\nBody"
        assert trim_at_toc("No toc here") == "No toc here"


class TestSections:
    def test_split_and_find_all_sections(self):
        doc = (
            "Talents\nNormal > Skill > Burst\n\n"
            "Example Teams\nSkirk — Furina — Escoffier — Yelan\n\n"
            "Example Teams\nSkirk — Furina — Charlotte — Shenhe\n"
        )
        secs = split_sections(doc)
        assert "Talents" in secs
        assert len(find_all_sections(doc, "Example Teams")) == 2


class TestWeaponsParser:
    def test_tiered_weapons_and_inline_tiers(self):
        section = (
            "5★ Azurelight\tBest-in-slot signature sword.\n\n"
            "5★ Mistsplitter Reforged, 4★ Finale of the Deep (R5)\tStrong alternatives.\n"
        )
        weapons = parse_weapons(section)
        slugs = [w["weapon_slug"] for w in weapons]
        assert slugs == ["azurelight", "mistsplitter-reforged", "finale-of-the-deep"]
        assert weapons[0]["rarity"] == 5
        assert weapons[2]["rarity"] == 4

    def test_flat_weapons_category_header_and_slash_list(self):
        section = (
            "Recommended 5-Star Options\tSurf's Up, Nocturne's Curtain Call\n"
            "These weapons provide huge CRIT value and should not be parsed as names.\n\n"
            "Fleuve Cendre Ferryman\tGreat F2P ER sword for Furina.\n\n"
            "Uraku Misugiri / Primordial Jade Cutter / Light of Foliar Incision\n"
        )
        weapons = parse_weapons(section)
        slugs = [w["weapon_slug"] for w in weapons]
        assert "recommended-5-star-options" not in slugs
        assert "surf-s-up" in slugs
        assert "nocturne-s-curtain-call" in slugs
        assert "fleuve-cendre-ferryman" in slugs
        assert "uraku-misugiri" in slugs
        assert "primordial-jade-cutter" in slugs
        assert "light-of-foliar-incision" in slugs


class TestArtifactsAndStats:
    def test_parse_artifacts_comma_and_slash_splits(self):
        section = (
            "4pc Marechaussee Hunter, 4pc Finale of the Deep Galleries\tBest 4pc sets.\n"
            "2pc Blizzard Strayer / 2pc Gladiator's Finale\tSolid 2pc mix.\n"
        )
        four, two = parse_artifacts(section)
        assert [a["artifact_set_slug"] for a in four] == [
            "marechaussee-hunter",
            "finale-of-the-deep-galleries",
        ]
        assert [a["artifact_set_slug"] for a in two] == [
            "blizzard-strayer",
            "gladiator-s-finale",
        ]

    def test_parse_stat_cell_expands_crit_and_or(self):
        assert parse_stat_cell("HP% or ER%") == ["hp_pct", "er"]
        assert parse_stat_cell("CRIT Rate or CRIT DMG") == ["crit_rate", "crit_dmg"]
        assert parse_stat_cell("CRIT ≥ ATK%") == ["crit_rate", "crit_dmg", "atk_pct"]

    def test_parse_stats_inline_and_multiline(self):
        inline = (
            "Sands\tGoblet\tCirclet\n"
            "ATK%\tCryo DMG\tCRIT Rate or CRIT DMG\n"
            "Stat Priority: CRIT > ATK% > ER%\n"
        )
        s = parse_stats(inline)
        assert s["sands"] == ["atk_pct"]
        assert s["goblet"] == ["cryo_dmg"]
        assert s["circlet"] == ["crit_rate", "crit_dmg"]
        assert s["substats"] == ["crit_rate", "crit_dmg", "atk_pct", "er"]

        multiline = (
            "Sands\nGoblet\nCirclet\n"
            "HP% or ER%\tHP% or Hydro DMG\tCRIT\n"
            "Stat Priority: ER (until req) > CRIT > HP%\n"
        )
        s2 = parse_stats(multiline)
        assert s2["sands"] == ["hp_pct", "er"]
        assert s2["goblet"] == ["hp_pct", "hydro_dmg"]
        assert s2["circlet"] == ["crit_rate", "crit_dmg"]
        assert s2["substats"] == ["er", "crit_rate", "crit_dmg", "hp_pct"]


class TestTalentsCombosTeams:
    def test_parse_talent_priority(self):
        assert parse_talent_priority("Priority: Normal Attack > Skill > Burst") == "Normal > Skill > Burst"
        assert parse_talent_priority("Burst ≥ Skill > Normal") == "Burst > Skill > Normal"
        assert parse_talent_priority("Talent Priority\nSince her damage comes from...") is None

    def test_parse_combos_splits_and_filters_noise(self):
        section = (
            "N2C and N3C\tBasic combos\n"
            "C1+: E Q 3[N3D]\tFull rotation\n"
            "Note that you should always dash cancel E.\n"
            "Normal > Skill > Burst\n"
        )
        combos = parse_combos(section)
        assert combos == ["N2C", "N3C", "E Q 3[N3D]"]

    def test_parse_teams_filters_placeholders_and_deduplicates_order(self):
        section = (
            "Furina — Neuvillette — Kazuha — Xilonen\n"
            "Neuvillette — Furina — Xilonen — Kazuha\n"
            "Furina — Pyro — Hydro — Flex/Healer\n"
            "Arlecchino — C6 Xingqiu/Yelan — Bennett — Kazuha\n"
        )
        teams = parse_teams(section)
        assert len(teams) == 2
        assert teams[0]["character_slugs"] == ["furina", "neuvillette", "kazuha", "xilonen"]
        assert teams[1]["character_slugs"] == ["arlecchino", "xingqiu", "bennett", "kazuha"]


@pytest.mark.parametrize("slug", ["arlecchino", "furina", "neuvillette", "skirk"])
def test_real_kqm_guides_regression(slug: str):
    path = KQM_DIR / f"{slug}.txt"
    if not path.exists():
        pytest.skip(f"Guide fixture {path} not found")

    result = parse_guide(path.read_text(encoding="utf-8"), slug)
    bd = result["build"]["build_data"]

    assert result["character_slug"] == slug
    assert len(bd["weapons"]) >= 3
    assert len(bd["artifacts_4pc"]) >= 1
    assert len(bd["sands_stat"]) >= 1
    assert len(bd["goblet_stat"]) >= 1
    assert len(bd["circlet_stat"]) >= 1
    assert len(bd["substat_priority"]) >= 2
    assert bd["talent_priority"] is not None
    assert len(result["teams"]) >= 1
    assert bd["references"][0]["url"] == f"https://keqingmains.com/{slug}/"
