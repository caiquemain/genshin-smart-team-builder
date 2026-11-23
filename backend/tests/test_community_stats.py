"""Testes unitários para o serviço de Estatísticas da Comunidade (Paimon.plus)."""
import json

from app.services.community_stats import (
    SNAPSHOT_PATH,
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
