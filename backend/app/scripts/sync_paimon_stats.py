#!/usr/bin/env python3
"""Baixa e atualiza o snapshot de estatísticas da comunidade do Paimon.plus.

Uso manual:
    docker compose exec backend python -m app.scripts.sync_paimon_stats

Uso recomendado em cron (ex.: 1x por semana, com proteção de idade mínima):
    0 4 * * 0 docker compose exec -T backend python -m app.scripts.sync_paimon_stats --min-age-hours 144
"""
import argparse
import sys
import time

from app.services.community_stats import SNAPSHOT_PATH, fetch_and_save_paimon_snapshot


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Atualiza o snapshot local do Paimon.plus.")
    parser.add_argument(
        "--min-age-hours",
        type=float,
        default=0.0,
        help="Pula o download se o snapshot local tiver menos que N horas (útil para cron).",
    )
    args = parser.parse_args(argv)

    if args.min_age_hours > 0 and SNAPSHOT_PATH.is_file():
        age_hours = (time.time() - SNAPSHOT_PATH.stat().st_mtime) / 3600.0
        if age_hours < args.min_age_hours:
            print(
                f"[sync_paimon_stats] Snapshot recente ({age_hours:.1f}h < {args.min_age_hours:.1f}h). "
                "Nenhuma requisição enviada ao Paimon.plus."
            )
            return 0

    data = fetch_and_save_paimon_snapshot(SNAPSHOT_PATH)
    players = (data.get("playerInfo") or {}).get("count", 0)
    avatars = len(data.get("avatarInfoList") or [])
    print(f"[sync_paimon_stats] Snapshot salvo em {SNAPSHOT_PATH}")
    print(f"[sync_paimon_stats] {players:,} contas · {avatars} personagens.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

