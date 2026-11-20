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
    parse_notable_teammates,
    parse_guide,
)


KQM_DIR = Path(__file__).resolve().parents[1] / "data" / "sources" / "guides" / "kqm"


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
            "Arlecchino — C6 Xingqiu/Yelan — Bennett — Kazuha / Sucrose\n"
        )
        teams = parse_teams(section)
        assert len(teams) == 2
        assert teams[0]["character_slugs"] == ["furina", "neuvillette", "kazuha", "xilonen"]
        assert teams[1]["character_slugs"] == ["arlecchino", "xingqiu", "bennett", "kazuha"]
        assert teams[1]["slot_alternatives"] == {"2": ["yelan"], "4": ["sucrose"]}

    def test_parse_notable_teammates_extracts_categories_and_skips_tab_strip(self):
        doc = (
            "Notable Teammates\n"
            "Hydro AppliersBuffersOther Supports\n"
            "Hydro Appliers\n"
            "Yelan\tYelan deals high off-field damage and buffs on-field DMG.\n"
            "Buffers\n"
            "Sigewinne, Qiqi\tBoth provide teamwide healing for Furina.\n"
            "Example Teams\n"
            "Skirk — Furina — Escoffier — Yelan\n"
        )
        nts = parse_notable_teammates(doc)
        assert [n["character_slug"] for n in nts] == ["yelan", "sigewinne", "qiqi"]
        assert nts[0]["category"] == "Hydro Appliers"
        assert nts[1]["category"] == "Buffers"
        assert "off-field damage" in nts[0]["notes"]


@pytest.mark.parametrize("slug", ["arlecchino", "furina", "neuvillette", "skirk"])
def test_real_kqm_guides_regression(slug: str):
    path = KQM_DIR / f"{slug}.txt"
    if not path.exists():
        pytest.skip(f"Guide fixture {path} not found")

    result = parse_guide(path.read_text(encoding="utf-8"), slug)
    bd = result["build"]["build_data"]

    assert result["source"] == "KQM"
    assert result["source_slug"] == "kqm"
    assert result["character_slug"] == slug
    assert len(bd["weapons"]) >= 3
    assert len(bd["artifacts_4pc"]) >= 1
    assert len(bd["sands_stat"]) >= 1
    assert len(bd["goblet_stat"]) >= 1
    assert len(bd["circlet_stat"]) >= 1
    assert len(bd["substat_priority"]) >= 2
    assert bd["talent_priority"] is not None
    assert len(result["notable_teammates"]) >= 20
    assert len(result["teams"]) >= 1
    assert bd["references"][0]["url"] == f"https://keqingmains.com/{slug}/"


def test_import_kqm_normalizes_short_kqm_filenames():
    from app.scripts.import_kqm import normalize_slug, resolve_character

    expected = {
        "anemo-traveler": "traveler-anemo",
        "geo-traveler": "traveler-geo",
        "electro-traveler": "traveler-electro",
        "dendro-traveler": "traveler-dendro",
        "hydro-traveler": "traveler-hydro",
        "pyro-traveler": "traveler-pyro",
        "ayaka": "kamisato-ayaka",
        "ayato": "kamisato-ayato",
        "heizou": "shikanoin-heizou",
        "itto": "arataki-itto",
        "kazuha": "kaedehara-kazuha",
        "kokomi": "sangonomiya-kokomi",
        "mizuki": "yumemizuki-mizuki",
        "raiden": "raiden-shogun",
        "sara": "kujou-sara",
        "shinobu": "kuki-shinobu",
        "yae": "yae-miko",
        "yunjin": "yun-jin",
    }
    for raw, canonical in expected.items():
        assert normalize_slug(raw) == canonical

    # resolve_character must query using the canonical normalized slug
    queried: list[str] = []

    class _FakeQuery:
        def filter(self, criterion):
            queried.append(criterion.right.value)
            return self

        def first(self):
            return {"slug": queried[-1]}

    class _FakeDB:
        def query(self, _model):
            return _FakeQuery()

    res = resolve_character(_FakeDB(), "yae")
    assert res == {"slug": "yae-miko"}
    res2 = resolve_character(_FakeDB(), "yunjin")
    assert res2 == {"slug": "yun-jin"}
    res3 = resolve_character(_FakeDB(), "dendro-traveler")
    assert res3 == {"slug": "traveler-dendro"}


def test_soft_hyphen_and_refinement_suffix_cleaned_in_weapon_slugs():
    assert to_slug("Wave\u00adbreak\u00ader's Fin") == "wavebreaker-s-fin"
    assert to_slug("Ul\u00adti\u00admate O\u00adver\u00adlord's Me\u00adga Ma\u00adgic Sword") == "ultimate-overlord-s-mega-magic-sword"
    assert to_slug("Kitain Cross Spear R5") == "kitain-cross-spear"
    assert clean_weapon_name("4★ White Tassel R5") == "White Tassel"


def test_import_teams_deduplicates_pending_objects_when_autoflush_disabled():
    from app.models import Character, TeamTemplate
    from app.scripts.import_kqm import import_teams

    # Simula uma sessão com autoflush=False: query().all() não enxerga db.new
    chars = {
        slug: Character(id=i + 1, slug=slug, name=slug.title(), element="Dendro", weapon_type="Sword", rarity=5)
        for i, slug in enumerate(["alhaitham", "fischl", "furina", "baizhu"])
    }

    class _FakeQuery:
        def __init__(self, model):
            self.model = model
            self._slug = None

        def filter(self, criterion):
            if hasattr(criterion, "right") and hasattr(criterion.right, "value"):
                self._slug = criterion.right.value
            return self

        def first(self):
            if self.model is Character:
                return chars.get(self._slug)
            return None

        def all(self):
            if self.model is Character:
                return list(chars.values())
            return []

    class _FakeDB:
        def __init__(self):
            self.new = []

        def query(self, model):
            return _FakeQuery(model)

        def add(self, obj):
            self.new.append(obj)

    db = _FakeDB()
    warnings: list[str] = []
    team_entry = [{
        "character_slugs": ["alhaitham", "fischl", "furina", "baizhu"],
        "main_character": "alhaitham",
        "raw_line": "Alhaitham — Fischl — Furina — Baizhu",
        "slot_alternatives": {},
    }]

    added_first = import_teams(db, team_entry, "https://keqingmains.com/alhaitham/", warnings)
    added_second = import_teams(db, team_entry, "https://keqingmains.com/baizhu/", warnings)

    assert added_first == 1
    assert added_second == 0
    templates = [o for o in db.new if isinstance(o, TeamTemplate)]
    assert len(templates) == 1
    assert templates[0].name == "Alhaitham — Fischl — Furina — Baizhu"


