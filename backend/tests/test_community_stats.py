"""Testes unitários para o serviço de Estatísticas da Comunidade (Paimon.plus)."""
import inspect
import json

import pytest
from fastapi import HTTPException

from app.api import community_stats as community_stats_api
from app.scripts import sync_paimon_stats
from app.services import community_stats as community_stats_service
from app.services.community_stats import (
    SNAPSHOT_PATH,
    _load_raw_snapshot,
    detect_constellation_stopping_points,
    parse_avatar_stats_entry,
    parse_player_census,
)


def test_detect_constellation_stopping_points_finds_c2_spike():
    # Padrão típico (ex.: Furina / Raiden / Odette): C0=71%, C1=8%, C2=16%, C6=4%
    spikes = detect_constellation_stopping_points([710, 80, 160, 7, 2, 0, 41])
    assert any(s["constellation"] == 2 for s in spikes)


def test_parse_real_paimon_plus_snapshot():
    assert SNAPSHOT_PATH.is_file(), "Snapshot Paimon.plus deve existir em backend/data/sources/paimon_plus/"
    raw = json.loads(SNAPSHOT_PATH.read_text(encoding="utf-8"))

    census = parse_player_census(raw["playerInfo"])
    assert census["total_players"] == 40000
    assert 50.0 < census["ar60_pct"] < 90.0
    assert 50.0 < census["abyss_floor12_pct"] < 90.0
    assert 20.0 < census["theater_act10_pct"] < 80.0
    assert census["achievements_median"] > 500
    assert len(census["ar_distribution"]) == 8

    # Testa Ayaka (primeiro avatar, com 4 skills incluindo sprint alternativo 10013)
    ayaka = raw["avatarInfoList"][0]
    parsed = parse_avatar_stats_entry(ayaka, skill_order=[10024, 10018, 10019], total_players=40000)
    assert parsed["avatar_id"] == 10000002
    assert parsed["count"] == 3250
    assert 18000 < parsed["stats"]["hp"]["median"] < 21000
    assert 1900 < parsed["stats"]["atk"]["median"] < 2300
    assert 30 < parsed["stats"]["crit_rate"]["median"] < 70
    assert 200 < parsed["stats"]["crit_dmg"]["median"] < 270
    assert 40 < parsed["stats"]["elem_dmg"]["median"] < 75
    assert parsed["talents"]["eb"]["mode"] == 10
    assert len(parsed["consts"]) == 7
    assert sum(c["count"] for c in parsed["consts"]) == parsed["count"]


def test_community_stats_api_is_strictly_read_only():
    """Garante que nenhum usuário público pode acionar refresh remoto via HTTP."""
    paths = {route.path for route in community_stats_api.router.routes}
    methods = {
        method
        for route in community_stats_api.router.routes
        for method in getattr(route, "methods", set())
    }
    assert "/community-stats/refresh" not in paths
    assert methods == {"GET"}

    sig = inspect.signature(community_stats_api.read_community_stats)
    assert "refresh" not in sig.parameters

    svc_sig = inspect.signature(community_stats_service.get_community_stats)
    assert "force_refresh" not in svc_sig.parameters


def test_load_raw_snapshot_never_fetches_upstream(tmp_path, monkeypatch):
    """Leituras locais jamais devem disparar requisições externas ao Paimon.plus."""
    def _forbid_fetch(*args, **kwargs):
        raise AssertionError("Requisição pública não deve chamar fetch_and_save_paimon_snapshot")

    monkeypatch.setattr(community_stats_service, "fetch_and_save_paimon_snapshot", _forbid_fetch)

    missing = tmp_path / "missing.json"
    with pytest.raises(HTTPException) as exc_missing:
        _load_raw_snapshot(missing)
    assert exc_missing.value.status_code == 503

    corrupt = tmp_path / "corrupt.json"
    corrupt.write_text("{not valid json", encoding="utf-8")
    with pytest.raises(HTTPException) as exc_corrupt:
        _load_raw_snapshot(corrupt)
    assert exc_corrupt.value.status_code == 503


def test_sync_cli_skips_when_snapshot_is_recent(tmp_path, monkeypatch):
    """O CLI com --min-age-hours pula o download se o snapshot for recente."""
    recent_file = tmp_path / "statistics.json"
    recent_file.write_text('{"avatarInfoList": []}', encoding="utf-8")

    called = False

    def _fake_fetch(*args, **kwargs):
        nonlocal called
        called = True
        return {"playerInfo": {"count": 1}, "avatarInfoList": []}

    monkeypatch.setattr(sync_paimon_stats, "SNAPSHOT_PATH", recent_file)
    monkeypatch.setattr(sync_paimon_stats, "fetch_and_save_paimon_snapshot", _fake_fetch)

    rc = sync_paimon_stats.main(["--min-age-hours", "24"])
    assert rc == 0
    assert not called

