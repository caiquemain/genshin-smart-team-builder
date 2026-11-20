"""Testes unitários e de regressão para o pipeline de tierlists (Icy Veins + CSVs)."""
from pathlib import Path
import pytest

from app.scripts.import_tierlists import pick_latest_source_file
from app.scripts.tierlist_parsers import (
    TIERLIST_SITES,
    compute_tier_metrics,
    dedupe_best_tier,
    normalize_character_slug,
    parse_canonical_csv,
    parse_icy_veins,
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

        with pytest.raises(ValueError):
            compute_tier_metrics(TIERLIST_SITES["icy-veins"], "INVALID")

    def test_pick_latest_source_file_prefers_newer_version_and_txt(self, tmp_path):
        (tmp_path / "7.1.csv").write_text("character_slug,role,tier_label\n", encoding="utf-8")
        (tmp_path / "7.2.txt").write_text("Main DPS\tSub DPS\tSupport\n", encoding="utf-8")
        picked = pick_latest_source_file(tmp_path, TIERLIST_SITES["icy-veins"])
        assert picked is not None
        assert picked.name == "7.2.txt"


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

    # Verifica roles e best-tier dedupe em personagens conhecidos
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


def test_all_five_existing_7_1_csvs_parse_cleanly():
    for slug in ("genshin-gg", "genshinlab", "game8", "mobalytics", "gamewith"):
        path = TIERLISTS_DIR / slug / "7.1.csv"
        assert path.is_file()
        cfg = TIERLIST_SITES[slug]
        res = parse_canonical_csv(path.read_text(encoding="utf-8"), slug, "7.1", list(cfg.scale))
        assert len(res["entries"]) >= 120
        # Verifica que todos os labels são válidos na escala do site
        for e in res["entries"]:
            idx, norm, master = compute_tier_metrics(cfg, e["tier_label"])
            assert 0.0 <= norm <= 1.0
            assert master in ("S+", "S", "A", "B", "C", "D")
