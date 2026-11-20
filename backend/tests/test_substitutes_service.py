from types import SimpleNamespace
from unittest.mock import MagicMock

from app.api.teams import _has_build_content
from app.scripts.import_kqm import _merge_sources, _merge_slot_substitutes
from app.services.substitutes import (
    compute_slot_substitutes_for_slugs,
    suggest_substitutes_for_slot,
)


def _char(slug: str, name: str, element: str):
    return SimpleNamespace(
        slug=slug,
        name=name,
        element=SimpleNamespace(value=element),
        weapon_type=SimpleNamespace(value="sword"),
        ascension_stat=None,
        base_def=50,
    )


def _mock_db(all_chars: list):
    db = MagicMock()

    def query_side_effect(_model):
        q = MagicMock()
        q.all.return_value = all_chars
        q.filter.return_value.all.return_value = all_chars
        return q

    db.query.side_effect = query_side_effect
    return db


class TestSubstitutesService:
    def test_prioritizes_curated_alternatives_excludes_team_and_respects_skirk_restriction(self):
        roster = [
            _char("skirk", "Skirk", "cryo"),
            _char("furina", "Furina", "hydro"),
            _char("escoffier", "Escoffier", "cryo"),
            _char("mona", "Mona", "hydro"),
            _char("shenhe", "Shenhe", "cryo"),
            _char("yelan", "Yelan", "hydro"),
            _char("bennett", "Bennett", "pyro"),
            _char("xingqiu", "Xingqiu", "hydro"),
        ]
        db = _mock_db(roster)
        notes = {
            "shenhe": {"category": "Buffers", "notes": "Cryo buffer with Icy Quill."},
            "yelan": {"category": "Hydro Appliers", "notes": "Off-field Hydro DMG + ramping buff."},
            "bennett": {"category": "Buffers", "notes": "ATK buff + heal."},
        }

        subs = compute_slot_substitutes_for_slugs(
            db,
            ["skirk", "furina", "escoffier", "mona"],
            main_character="skirk",
            slot_alternatives={"4": ["shenhe", "yelan", "bennett"]},
            teammate_notes=notes,
            limit=5,
        )

        # Slot 1 (main) gets no auto substitutes
        assert subs[1] == []

        # Slot 4 prioritizes curated Shenhe & Yelan, excludes Bennett (Pyro in Skirk team) and excludes Furina/Mona
        slot4_slugs = [s["character_slug"] for s in subs[4]]
        assert slot4_slugs[:2] == ["shenhe", "yelan"]
        assert "bennett" not in slot4_slugs
        assert "furina" not in slot4_slugs
        assert "mona" not in slot4_slugs
        assert subs[4][0]["build_label"] == "Buffers"
        assert "Icy Quill" in subs[4][0]["notes"]

    def test_no_db_fallback_never_suggests_faruzan_for_neuvillette(self):
        roster = [
            _char("neuvillette", "Neuvillette", "hydro"),
            _char("furina", "Furina", "hydro"),
            _char("kaedehara-kazuha", "Kazuha", "anemo"),
            _char("xilonen", "Xilonen", "geo"),
            _char("faruzan", "Faruzan", "anemo"),
            _char("gorou", "Gorou", "geo"),
            _char("sucrose", "Sucrose", "anemo"),
        ]
        db = _mock_db(roster)

        # Sem dados do guia, não inventa Faruzan/Gorou por elemento
        empty_subs = suggest_substitutes_for_slot(
            db,
            roster[2],  # kazuha
            team_slugs={"neuvillette", "furina", "kaedehara-kazuha", "xilonen"},
            limit=6,
        )
        assert empty_subs == []

        # Com Notable Teammates do guia (sem Faruzan/Gorou), permite cross-element da mesma categoria
        guide_notes = {
            "kaedehara-kazuha": {"category": "RES Shred", "notes": "VV + DMG%"},
            "sucrose": {"category": "RES Shred", "notes": "VV + EM"},
            "zhongli": {"category": "RES Shred", "notes": "Shield + universal shred"},
        }
        roster.append(_char("zhongli", "Zhongli", "geo"))
        curated = suggest_substitutes_for_slot(
            db,
            roster[2],  # kazuha
            team_slugs={"neuvillette", "furina", "kaedehara-kazuha", "xilonen"},
            teammate_notes=guide_notes,
            limit=6,
        )
        slugs = [s["character_slug"] for s in curated]
        assert slugs == ["zhongli", "sucrose"]
        assert "faruzan" not in slugs
        assert "gorou" not in slugs


class TestMultiSourceMergersAndBuildCheck:
    def test_merge_sources_deduplicates_by_source_name(self):
        s1 = _merge_sources([{"source": "KQM", "url": "https://kqm/a"}], "Game8", "https://game8/a")
        assert len(s1) == 2
        s2 = _merge_sources(s1, "KQM", "https://kqm/other")
        assert len(s2) == 2

    def test_merge_slot_substitutes_appends_unique_slugs(self):
        base = {"4": [{"character_slug": "shenhe", "build_label": "Buffers", "notes": "KQM"}]}
        incoming = {
            "4": [
                {"character_slug": "shenhe", "build_label": "Buffer", "notes": "Game8"},
                {"character_slug": "yelan", "build_label": "Sub-DPS", "notes": "Game8"},
            ]
        }
        merged = _merge_slot_substitutes(base, incoming)
        assert [x["character_slug"] for x in merged["4"]] == ["shenhe", "yelan"]

    def test_has_build_content_filters_empty_dicts(self):
        assert _has_build_content(None) is False
        assert _has_build_content({}) is False
        assert _has_build_content({"references": [], "weapons": []}) is False
        assert _has_build_content({"weapons": [{"weapon_slug": "azurelight"}]}) is True
        assert _has_build_content({"notes": "Use 4pc NO"}) is True

    def test_pick_best_from_list_prioritizes_kqm_and_falls_back_to_helper_sheet(self):
        from types import SimpleNamespace
        from app.services.presets import pick_best_from_list

        helper = SimpleNamespace(id=1, name="Helper Sheet Build", build_data={"weapons": [{"weapon_slug": "favonius-sword"}]})
        game8 = SimpleNamespace(id=2, name="Game8 Build", build_data={"weapons": [{"weapon_slug": "mistsplitter"}]})
        kqm = SimpleNamespace(id=3, name="KQM Build", build_data={"weapons": [{"weapon_slug": "splendor"}]})
        empty_kqm = SimpleNamespace(id=4, name="KQM Build", build_data={"weapons": []})

        assert pick_best_from_list([helper, game8, kqm]) is kqm
        assert pick_best_from_list([helper, empty_kqm]) is helper
        assert pick_best_from_list([empty_kqm]) is None

