#!/usr/bin/env python3
"""Reclassifica arquétipos de TeamTemplate no PostgreSQL com base nas reações elementais.

Uso:
    # Atualiza todos os times atualmente marcados como 'unknown'
    docker compose exec backend python -m app.scripts.reclassify_team_archetypes

    # Reavalia TODOS os templates (incluindo times que já tinham arquétipo)
    docker compose exec backend python -m app.scripts.reclassify_team_archetypes --all
"""
import argparse
import sys

from sqlalchemy import func

from app.database import SessionLocal
from app.models import TeamTemplate
from app.services.archetype_classifier import reclassify_team_templates


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Reclassifica arquétipos dos templates de time usando reações elementais."
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Reclassifica todos os templates (por padrão atualiza apenas os 'unknown').",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Simula a reclassificação sem salvar no banco.",
    )
    args = parser.parse_args(argv)

    db = SessionLocal()
    try:
        summary = reclassify_team_templates(db, only_unknown=not args.all)
        if args.dry_run:
            db.rollback()
            print("[reclassify] DRY RUN (nenhuma alteração salva)")
        else:
            db.commit()

        print(
            f"[reclassify] Analisados: {summary['scanned']} · "
            f"Atualizados: {summary['updated']} · "
            f"Restantes 'unknown': {summary['remaining_unknown']}"
        )

        rows = (
            db.query(TeamTemplate.archetype, func.count(TeamTemplate.id))
            .group_by(TeamTemplate.archetype)
            .order_by(func.count(TeamTemplate.id).desc())
            .all()
        )
        print("[reclassify] Distribuição atual de arquétipos:")
        for arch, cnt in rows:
            print(f"  - {arch}: {cnt}")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
