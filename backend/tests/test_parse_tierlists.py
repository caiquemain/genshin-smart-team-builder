"""Testes unitários e de regressão para o pipeline de tierlists (Icy Veins, YS Helper + CSVs)."""
from collections import Counter
from pathlib import Path
import pytest

from app.scripts.import_tierlists import pick_latest_source_file
from app.scripts.tierlist_parsers import (
    TIERLIST_SITES,
    compute_tier_metrics,
    dedupe_best_tier,
    normalize_character_slug,
    parse_canonical_csv,
    parse_genshingg,
    parse_icy_veins,
    parse_yshelper_abyss,
    parse_yshelper_stygian,
    parse_yshelper_teams,
)

TIERLISTS_DIR = Path(__file__).resolve().parents[1] / "data" / "sources" / "tierlists"


class TestTierlistHelpers:
    def test_normalize_character_slug_handles_travelers_and_aliases(self):
        assert normalize_character_slug("Cryo Traveler") == "traveler-cryo"
        assert normalize_character_slug("Dendro Traveler") == "traveler-dendro"
        assert normalize_character_slug("Traveler (Anemo)") == "traveler-anemo"
        assert normalize_character_slug("Hu Tao") == "hu-tao"
        assert normalize_character_slug("Kaedehara Kazuha") == "kaedehara-kazuha"
        assert normalize_character_slug("Kazuha") == "kaedehara-kazuha"
        assert normalize_character_slug("Childe") == "tartaglia"
        assert normalize_character_slug("Ambor") == "amber"

    def test_dedupe_best_tier_picks_highest_tier_and_deterministic_role_tiebreak(self):
        raw = [
            {"character_slug": "furina", "role": "support", "tier_label": "S"},
            {"character_slug": "furina", "role": "sub_dps", "tier_label": "S+"},
            {"character_slug": "mavuika", "role": "sub_dps", "tier_label": "S+"},
            {"character_slug": "mavuika", "role": "main_dps", "tier_label": "S+"},
            {"character_slug": "venti", "role": "main_dps", "tier_label": "A"},
            {"character_slug": "venti", "role": "sub_dps", "tier_label": "S"},
            {"character_slug": "venti", "role": "support", "tier_label": "A"},
        ]
        deduped = {e["character_slug"]: e for e in dedupe_best_tier(raw, ["S+", "S", "A", "B", "C", "D"])}
        assert deduped["furina"] == {"character_slug": "furina", "role": "sub_dps", "tier_label": "S+"}
        assert deduped["mavuika"] == {"character_slug": "mavuika", "role": "main_dps", "tier_label": "S+"}
        assert deduped["venti"] == {"character_slug": "venti", "role": "sub_dps", "tier_label": "S"}

    def test_compute_tier_metrics_matches_expected_scales(self):
        # Icy Veins: 6-level S+..D
        assert compute_tier_metrics(TIERLIST_SITES["icy-veins"], "S+") == (0, 1.0, "S+")
        assert compute_tier_metrics(TIERLIST_SITES["icy-veins"], "S") == (1, 0.8, "S")
        assert compute_tier_metrics(TIERLIST_SITES["icy-veins"], "D") == (5, 0.0, "D")
        # Game8: 7-level SS..D
        assert compute_tier_metrics(TIERLIST_SITES["game8"], "SS") == (0, 1.0, "S+")
        assert compute_tier_metrics(TIERLIST_SITES["game8"], "A+") == (2, 0.6667, "A")
        # Mobalytics: 9-level S..F
        assert compute_tier_metrics(TIERLIST_SITES["mobalytics"], "S") == (0, 1.0, "S+")
        assert compute_tier_metrics(TIERLIST_SITES["mobalytics"], "F") == (8, 0.0, "D")
        # YS Helper: 5-level S+..C
        assert compute_tier_metrics(TIERLIST_SITES["yshelper-abyss"], "S+") == (0, 1.0, "S+")
        assert compute_tier_metrics(TIERLIST_SITES["yshelper-abyss"], "A") == (2, 0.5, "A")
        assert compute_tier_metrics(TIERLIST_SITES["yshelper-stygian"], "C") == (4, 0.0, "C")

        with pytest.raises(ValueError):
            compute_tier_metrics(TIERLIST_SITES["icy-veins"], "INVALID")

    def test_pick_latest_source_file_prefers_newer_version_and_raw_parser(self, tmp_path):
        (tmp_path / "7.1.csv").write_text("character_slug,role,tier_label\n", encoding="utf-8")
        (tmp_path / "7.2.txt").write_text("Main DPS\tSub DPS\tSupport\n", encoding="utf-8")
        picked = pick_latest_source_file(tmp_path, TIERLIST_SITES["icy-veins"])
        assert picked is not None
        assert picked.name == "7.2.txt"

        (tmp_path / "7.2.html").write_text("<html></html>", encoding="utf-8")
        picked_html = pick_latest_source_file(tmp_path, TIERLIST_SITES["yshelper-abyss"])
        assert picked_html is not None
        assert picked_html.name == "7.2.html"


def test_real_icy_veins_7_2_regression():
    path = TIERLISTS_DIR / "icy-veins" / "7.2.txt"
    assert path.is_file(), f"Arquivo não encontrado: {path}"
    res = parse_icy_veins(path.read_text(encoding="utf-8"), version_hint="7.2")

    assert res["site_slug"] == "icy-veins"
    assert res["version"] == "7.2"
    assert len(res["raw_entries"]) == 140

    by_slug = {e["character_slug"]: e for e in res["entries"]}
    # 140 raw entries - 10 multi-role duplicates = 130 unique characters
    assert len(by_slug) == 130

    assert by_slug["skirk"] == {"character_slug": "skirk", "role": "main_dps", "tier_label": "S+"}
    assert by_slug["escoffier"] == {"character_slug": "escoffier", "role": "sub_dps", "tier_label": "S+"}
    assert by_slug["furina"] == {"character_slug": "furina", "role": "sub_dps", "tier_label": "S+"}
    assert by_slug["citlali"] == {"character_slug": "citlali", "role": "support", "tier_label": "S+"}
    assert by_slug["neuvillette"] == {"character_slug": "neuvillette", "role": "main_dps", "tier_label": "S"}
    assert by_slug["arlecchino"] == {"character_slug": "arlecchino", "role": "main_dps", "tier_label": "S"}
    assert by_slug["xilonen"] == {"character_slug": "xilonen", "role": "support", "tier_label": "S"}
    assert by_slug["venti"] == {"character_slug": "venti", "role": "sub_dps", "tier_label": "S"}
    assert by_slug["raiden-shogun"] == {"character_slug": "raiden-shogun", "role": "sub_dps", "tier_label": "A"}
    assert by_slug["traveler-cryo"] == {"character_slug": "traveler-cryo", "role": "main_dps", "tier_label": "S"}
    assert by_slug["traveler-dendro"] == {"character_slug": "traveler-dendro", "role": "sub_dps", "tier_label": "B"}
    assert by_slug["amber"] == {"character_slug": "amber", "role": "sub_dps", "tier_label": "D"}
    assert by_slug["dahlia"] == {"character_slug": "dahlia", "role": "support", "tier_label": "D"}


def test_real_yshelper_abyss_7_2_regression():
    path = TIERLISTS_DIR / "yshelper-abyss" / "7.2.html"
    assert path.is_file(), f"Arquivo não encontrado: {path}"
    res = parse_yshelper_abyss(path.read_text(encoding="utf-8", errors="replace"), version_hint="7.2")

    assert res["site_slug"] == "yshelper-abyss"
    assert res["version"] == "7.2"
    assert len(res["entries"]) == 123

    counts = Counter(e["tier_label"] for e in res["entries"])
    assert dict(counts) == {"S+": 5, "S": 8, "A": 13, "B": 27, "C": 70}

    by_slug = {e["character_slug"]: e for e in res["entries"]}
    assert by_slug["zibai"]["tier_label"] == "S+"
    assert by_slug["zibai"]["use_rate"] == pytest.approx(84.6)
    assert by_slug["furina"]["tier_label"] == "A"
    assert by_slug["furina"]["use_rate"] == pytest.approx(22.6)
    assert by_slug["amber"]["tier_label"] == "C"  # alias Ambor -> amber


def test_real_yshelper_stygian_7_2_regression():
    path = TIERLISTS_DIR / "yshelper-stygian" / "7.2.html"
    assert path.is_file(), f"Arquivo não encontrado: {path}"
    res = parse_yshelper_stygian(path.read_text(encoding="utf-8", errors="replace"), version_hint="7.2")

    assert res["site_slug"] == "yshelper-stygian"
    assert res["version"] == "7.2"
    assert len(res["entries"]) == 123

    counts = Counter(e["tier_label"] for e in res["entries"])
    assert dict(counts) == {"S+": 9, "S": 9, "A": 10, "B": 24, "C": 71}

    by_slug = {e["character_slug"]: e for e in res["entries"]}
    assert by_slug["odette"]["tier_label"] == "S+"
    assert by_slug["odette"]["use_rate"] == pytest.approx(91.1)
    assert by_slug["furina"]["tier_label"] == "S+"
    assert by_slug["furina"]["use_rate"] == pytest.approx(90.5)
    assert by_slug["escoffier"]["tier_label"] == "S"
    assert by_slug["amber"]["tier_label"] == "C"


def test_all_five_existing_7_1_csvs_parse_cleanly():
    for slug in ("genshin-gg", "genshinlab", "game8", "mobalytics", "gamewith"):
        path = TIERLISTS_DIR / slug / "7.1.csv"
        assert path.is_file()
        cfg = TIERLIST_SITES[slug]
        res = parse_canonical_csv(path.read_text(encoding="utf-8"), slug, "7.1", list(cfg.scale))
        assert len(res["entries"]) >= 120
        for e in res["entries"]:
            idx, norm, master = compute_tier_metrics(cfg, e["tier_label"])
            assert 0.0 <= norm <= 1.0
            assert master in ("S+", "S", "A", "B", "C", "D")


def test_real_yshelper_teams_extraction_and_sibling_substitutes():
    abyss_html = (TIERLISTS_DIR / "yshelper-abyss" / "7.2.html").read_text(encoding="utf-8", errors="replace")
    abyss = parse_yshelper_teams(abyss_html, version_hint="7.2", site_slug="yshelper-abyss", min_use_rate=3.0)
    assert abyss["source_name"] == "YS Abyss 7.2"
    assert abyss["total_parsed"] == 99
    assert len(abyss["teams"]) == 51
    top = abyss["teams"][0]
    assert top["character_slugs"] == ["zibai", "columbina", "linnea", "illuga"]
    assert top["use_rate"] == pytest.approx(67.4)
    assert "67.4%" in top["description"]
    # Deve ter inferido substitutos reais a partir dos irmãos 3/4 (ex.: zhongli no lugar de linnea)
    assert any("zhongli" in alts for alts in top["slot_alternatives"].values())

    stygian_html = (TIERLISTS_DIR / "yshelper-stygian" / "7.2.html").read_text(encoding="utf-8", errors="replace")
    stygian = parse_yshelper_teams(stygian_html, version_hint="7.2", site_slug="yshelper-stygian", min_use_rate=3.0)
    assert stygian["source_name"] == "YS Stygian 7.2"
    assert stygian["total_parsed"] == 99
    assert len(stygian["teams"]) == 54
    assert stygian["teams"][0]["character_slugs"] == ["zibai", "columbina", "linnea", "illuga"]
    assert stygian["teams"][0]["use_rate"] == pytest.approx(70.5)


def test_real_genshingg_7_2_regression():
    path = TIERLISTS_DIR / "genshin-gg" / "7.2.txt"
    assert path.is_file(), f"Arquivo não encontrado: {path}"
    res = parse_genshingg(path.read_text(encoding="utf-8"), version_hint="7.2")

    assert res["site_slug"] == "genshin-gg"
    assert res["version"] == "7.2"
    assert len(res["entries"]) == 129

    counts = Counter(e["tier_label"] for e in res["entries"])
    assert dict(counts) == {"S": 23, "A": 15, "B": 17, "C": 28, "D": 46}

    by_slug = {e["character_slug"]: e for e in res["entries"]}
    assert by_slug["flins"] == {"character_slug": "flins", "role": "main_dps", "tier_label": "S"}
    assert by_slug["furina"] == {"character_slug": "furina", "role": "sub_dps", "tier_label": "S"}
    assert by_slug["kaedehara-kazuha"] == {"character_slug": "kaedehara-kazuha", "role": "support", "tier_label": "A"}
    assert by_slug["raiden-shogun"] == {"character_slug": "raiden-shogun", "role": "sub_dps", "tier_label": "B"}
    assert by_slug["clorinde"] == {"character_slug": "clorinde", "role": "main_dps", "tier_label": "C"}
    assert by_slug["tartaglia"] == {"character_slug": "tartaglia", "role": "main_dps", "tier_label": "C"}
    assert by_slug["traveler-cryo"] == {"character_slug": "traveler-cryo", "role": "main_dps", "tier_label": "A"}
    assert by_slug["traveler-pyro"] == {"character_slug": "traveler-pyro", "role": "support", "tier_label": "B"}
    assert by_slug["shikanoin-heizou"] == {"character_slug": "shikanoin-heizou", "role": "sub_dps", "tier_label": "D"}


