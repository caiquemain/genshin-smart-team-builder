from types import SimpleNamespace
from unittest.mock import MagicMock

from app.scripts.enrich_substitutes import _is_dps, _find_subs_for_char, enrich_team


def _char(cid: int, slug: str, name: str, element: str):
    return SimpleNamespace(
        id=cid,
        slug=slug,
        name=name,
        element=SimpleNamespace(value=element),
    )


class TestEnrichSubstitutes:
    def test_is_dps_identifies_known_dps_and_supports(self):
        assert _is_dps(_char(1, "neuvillette", "Neuvillette", "hydro")) is True
        assert _is_dps(_char(2, "skirk", "Skirk", "cryo")) is True
        assert _is_dps(_char(3, "furina", "Furina", "hydro")) is False
        assert _is_dps(_char(4, "bennett", "Bennett", "pyro")) is False

    def test_find_subs_excludes_dps_prioritizes_supports_and_limits(self):
        target = _char(1, "furina", "Furina", "hydro")
        candidates = [
            _char(2, "neuvillette", "Neuvillette", "hydro"),  # DPS -> excluded
            _char(3, "mualani", "Mualani", "hydro"),          # DPS -> excluded
            _char(4, "barbara", "Barbara", "hydro"),          # non-SUPPORT_SLUGS
            _char(5, "yelan", "Yelan", "hydro"),              # SUPPORT_SLUGS
            _char(6, "xingqiu", "Xingqiu", "hydro"),          # SUPPORT_SLUGS
            _char(7, "mona", "Mona", "hydro"),                # SUPPORT_SLUGS
        ]
        db = MagicMock()
        db.query.return_value.filter.return_value.all.return_value = candidates

        subs = _find_subs_for_char(db, target, limit=3, exclude_slugs={"furina", "mona"})
        slugs = [s["character_slug"] for s in subs]
        assert slugs == ["xingqiu", "yelan", "barbara"]
        assert all("Alternativa Hydro" in s["notes"] for s in subs)

    def test_enrich_team_skips_slot1_and_dps_and_populates_supports(self):
        furina = _char(1, "furina", "Furina", "hydro")
        neuv = _char(2, "neuvillette", "Neuvillette", "hydro")
        kazuha = _char(3, "kaedehara-kazuha", "Kazuha", "anemo")
        sucrose = _char(4, "sucrose", "Sucrose", "anemo")

        members = [
            SimpleNamespace(position=1, character_id=1, substitutes=[{"old": True}]),
            SimpleNamespace(position=2, character_id=2, substitutes=[{"old": True}]),
            SimpleNamespace(position=3, character_id=3, substitutes=[]),
            SimpleNamespace(position=4, character_id=999, substitutes=[]),
        ]
        team = SimpleNamespace(id=10, name="Furina — Principal", members=members)

        by_id = {1: furina, 2: neuv, 3: kazuha}

        db = MagicMock()
        call_idx = {"n": 0}

        def query_side_effect(_model):
            q = MagicMock()
            def filter_side_effect(*_args, **_kwargs):
                f = MagicMock()
                idx = call_idx["n"]
                call_idx["n"] += 1
                # First 4 calls resolve all team members; 5th call fetches candidates for kazuha
                if idx == 0:
                    f.first.return_value = by_id[1]
                elif idx == 1:
                    f.first.return_value = by_id[2]
                elif idx == 2:
                    f.first.return_value = by_id[3]
                elif idx == 3:
                    f.first.return_value = None
                elif idx == 4:
                    f.all.return_value = [sucrose]
                return f
            q.filter.side_effect = filter_side_effect
            return q

        db.query.side_effect = query_side_effect
        warnings = []
        count = enrich_team(db, team, warnings)

        assert members[0].substitutes == []  # slot 1 main anchor
        assert members[1].substitutes == []  # known DPS
        assert [s["character_slug"] for s in members[2].substitutes] == ["sucrose"]
        assert count == 1
        assert len(warnings) == 1
        assert "999" in warnings[0]
