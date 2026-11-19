from unittest.mock import MagicMock

from app.services.team_tier import (
    compute_team_tier,
    fetch_char_tiers_batch,
    fetch_char_tiers_slugs,
)


class TestComputeTeamTier:
    def test_empty_or_all_missing(self):
        empty = compute_team_tier([])
        assert empty["tier"] is None
        assert empty["value"] == 0.0
        assert empty["filled"] == 0
        assert empty["missing"] == 0

        missing = compute_team_tier([
            ("a", "A", None),
            ("b", "B", "INVALID"),
        ])
        assert missing["tier"] is None
        assert missing["filled"] == 0
        assert missing["missing"] == 2

    def test_all_s_plus(self):
        res = compute_team_tier([
            ("skirk", "Skirk", "S+"),
            ("furina", "Furina", "S+"),
            ("escoffier", "Escoffier", "S+"),
            ("yelan", "Yelan", "S+"),
        ])
        assert res["tier"] == "S+"
        assert res["value"] == 6.0
        assert res["filled"] == 4
        assert res["missing"] == 0

    def test_half_up_rounding(self):
        # (6 + 5) / 2 = 5.5 -> rounds half-up to 6 (S+)
        res = compute_team_tier([("a", "A", "S+"), ("b", "B", "S")])
        assert res["value"] == 5.5
        assert res["tier"] == "S+"

        # (5 + 4) / 2 = 4.5 -> rounds half-up to 5 (S)
        res2 = compute_team_tier([("a", "A", "S"), ("b", "B", "A")])
        assert res2["value"] == 4.5
        assert res2["tier"] == "S"

        # (5 + 4 + 4 + 4) / 4 = 4.25 -> rounds to 4 (A)
        res3 = compute_team_tier([
            ("a", "A", "S"),
            ("b", "B", "A"),
            ("c", "C", "A"),
            ("d", "D", "A"),
        ])
        assert res3["value"] == 4.25
        assert res3["tier"] == "A"

    def test_ignores_missing_in_average(self):
        res = compute_team_tier([
            ("a", "A", "S+"),
            ("b", "B", None),
            ("c", "C", "A"),
        ])
        assert res["filled"] == 2
        assert res["missing"] == 1
        assert res["value"] == 5.0
        assert res["tier"] == "S"


class TestFetchCharTiers:
    def test_fetch_batch_empty_short_circuits(self):
        db = MagicMock()
        assert fetch_char_tiers_batch(db, []) == {}
        db.execute.assert_not_called()

    def test_fetch_batch_groups_by_team_id(self):
        db = MagicMock()
        db.execute.return_value.all.return_value = [
            (1, "furina", "Furina", "S+"),
            (1, "neuvillette", "Neuvillette", "S+"),
            (2, "amber", "Amber", "D"),
        ]
        res = fetch_char_tiers_batch(db, [1, 2])
        assert res[1]["tier"] == "S+"
        assert res[2]["tier"] == "D"

    def test_fetch_slugs_preserves_input_order(self):
        db = MagicMock()
        db.execute.return_value.all.return_value = [
            ("kazuha", "Kazuha", "S+"),
            ("bennett", "Bennett", "S"),
        ]
        res = fetch_char_tiers_slugs(db, ["bennett", "kazuha", "missing"])
        assert [c["slug"] for c in res["char_tiers"]] == ["bennett", "kazuha"]
        assert res["tier"] == "S+"
