#!/usr/bin/env python3
"""Baixa e atualiza o snapshot de estatísticas da comunidade do Paimon.plus.

Uso:
    docker compose exec backend python -m app.scripts.sync_paimon_stats
"""
import sys

from app.services.community_stats import SNAPSHOT_PATH, fetch_and_save_paimon_snapshot


def main() -> int:
    data = fetch_and_save_paimon_snapshot(SNAPSHOT_PATH)
    players = (data.get("playerInfo") or {}).get("count", 0)
    avatars = len(data.get("avatarInfoList") or [])
    print(f"[sync_paimon_stats] Snapshot salvo em {SNAPSHOT_PATH}")
    print(f"[sync_paimon_stats] {players:,} contas · {avatars} personagens.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
