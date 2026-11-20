#!/usr/bin/env python3
"""
import_guides.py — Importador multi-fonte para JSONs canônicos em `backend/data/parsed/<source>/`.

Uso:
    python -m app.scripts.import_guides --all
    python -m app.scripts.import_guides --source kqm --create-team
    python -m app.scripts.import_guides --all --dry-run
"""
import argparse
from pathlib import Path

from app.database import SessionLocal
from app.scripts.import_kqm import import_directory
from app.scripts.parsers import SOURCES


def main():
    ap = argparse.ArgumentParser(description="Importador multi-fonte de guias parseados")
    ap.add_argument("--source", type=str, choices=list(SOURCES.keys()), help="Fonte específica (ex.: kqm)")
    ap.add_argument("--all", action="store_true", help="Importa todas as fontes presentes em data/parsed/")
    ap.add_argument("--parsed-dir", type=Path, default=Path("data/parsed"))
    ap.add_argument("--create-team", action="store_true", help="Cria 1 Team customizado por guia")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    targets = list(SOURCES.keys()) if (args.all or not args.source) else [args.source]
    db = SessionLocal()
    warnings: list[str] = []
    tot_b, tot_t, tot_c = 0, 0, 0

    for src in targets:
        src_dir = args.parsed_dir / src
        if not src_dir.exists() or not any(src_dir.glob("*-build.json")):
            print(f"  [{src}] nenhum JSON parseado em {src_dir} — pulando.")
            continue
        print(f"\n📥 Importando fonte [{src}] de {src_dir}...")
        b, t, c = import_directory(db, src_dir, args.create_team, warnings)
        tot_b += b
        tot_t += t
        tot_c += c
        print(f"  [{src}] Builds: {b} · Templates novos: {t} · Teams customizados: {c}")

    if args.dry_run:
        db.rollback()
        print("\n🔎 DRY RUN — nada foi salvo")
    else:
        db.commit()
        print("\n✅ Salvo no banco")

    print(f"Total: Builds={tot_b} · Templates novos={tot_t} · Teams customizados={tot_c}")
    if warnings:
        print(f"⚠️  {len(warnings)} aviso(s):")
        for w in warnings[:20]:
            print(f"  - {w}")
    db.close()


if __name__ == "__main__":
    main()
