#!/usr/bin/env python3
"""
parse_guides.py — Runner multi-fonte para converter guias .txt em JSON canônico.

Uso:
    python -m app.scripts.parse_guides --all
    python -m app.scripts.parse_guides --source kqm
    python -m app.scripts.parse_guides --source kqm --file skirk.txt
"""
import argparse
import json
from pathlib import Path

from app.scripts.parsers import SOURCES, get_source
from app.scripts.parsers.helper_sheet import parse_element_csv


def _write_canonical_guide(out_dir: Path, result: dict) -> None:
    slug = result["character_slug"]
    build_payload = {
        "source": result["source"],
        "source_slug": result["source_slug"],
        "source_url": result["source_url"],
        "character_slug": slug,
        "build": result["build"],
        "notable_teammates": result.get("notable_teammates", []),
    }
    if result.get("tier_ratings"):
        build_payload["tier_ratings"] = result["tier_ratings"]

    (out_dir / f"{slug}-build.json").write_text(
        json.dumps(build_payload, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    if result.get("teams"):
        (out_dir / f"{slug}-teams.json").write_text(
            json.dumps(result["teams"], indent=2, ensure_ascii=False),
            encoding="utf-8",
        )


def parse_source(
    source_slug: str,
    sources_root: Path,
    parsed_root: Path,
    single_file: str | None = None,
) -> tuple[int, int]:
    cfg = get_source(source_slug)
    in_dir = sources_root / source_slug
    out_dir = parsed_root / source_slug

    if not in_dir.exists():
        print(f"  [{source_slug}] pasta {in_dir} não existe — pulando.")
        return 0, 0

    # Modo CSV em lote (Helper Sheet: 1 CSV por elemento com dezenas de personagens)
    if source_slug == "helper_sheet":
        csv_files = [in_dir / single_file] if single_file else sorted(in_dir.glob("*.csv"))
        csv_files = [f for f in csv_files if f.is_file()]
        if not csv_files:
            print(f"  [{source_slug}] nenhum .csv em {in_dir} — pulando.")
            return 0, 0
        out_dir.mkdir(parents=True, exist_ok=True)
        ok = 0
        errors = 0
        for path in csv_files:
            element = path.stem.lower()
            try:
                guides = parse_element_csv(path.read_text(encoding="utf-8", errors="replace"), element)
            except Exception as e:
                print(f"❌ [{cfg.display_name}] {path.name}: {e}")
                errors += 1
                continue
            for g in guides:
                _write_canonical_guide(out_dir, g)
                ok += 1
            print(f"✅ [{cfg.display_name}] {path.name}: {len(guides)} personagens parseados")
        return ok, errors

    files = [in_dir / single_file] if single_file else sorted(in_dir.glob("*.txt"))
    files = [f for f in files if f.is_file()]
    if not files:
        print(f"  [{source_slug}] nenhum .txt em {in_dir} — pulando.")
        return 0, 0

    if cfg.parser is None:
        print(
            f"  [{source_slug}] {len(files)} arquivo(s) encontrado(s), "
            f"mas parser de '{cfg.display_name}' ainda não foi implementado."
        )
        return 0, len(files)

    out_dir.mkdir(parents=True, exist_ok=True)
    ok = 0
    errors = 0

    for path in files:
        slug = path.stem
        print(f"\n📄 [{cfg.display_name}] Processando {path.name}...")
        try:
            result = cfg.parser(path.read_text(encoding="utf-8"), slug)
        except Exception as e:
            print(f"❌ [{cfg.display_name}] {path.name}: {e}")
            errors += 1
            continue

        result.setdefault("source", cfg.display_name)
        result.setdefault("source_slug", cfg.slug)
        result.setdefault("source_url", cfg.base_url.format(slug=slug))
        _write_canonical_guide(out_dir, result)

        b = result["build"]["build_data"]
        print(
            f"✅ [{cfg.display_name}] {slug}: {len(b.get('weapons', []))} armas, "
            f"{len(b.get('artifacts_4pc', []))} sets 4pc, "
            f"{len(result.get('notable_teammates', []))} teammates, "
            f"{len(result.get('teams', []))} times"
        )
        ok += 1

    return ok, errors


def main():
    ap = argparse.ArgumentParser(description="Parser multi-fonte de guias .txt")
    ap.add_argument("--source", type=str, choices=list(SOURCES.keys()), help="Fonte específica (ex.: kqm)")
    ap.add_argument("--all", action="store_true", help="Processa todas as fontes configuradas")
    ap.add_argument("--file", type=str, help="Arquivo específico dentro da fonte (ex.: skirk.txt)")
    ap.add_argument("--sources-dir", type=Path, default=Path("data/sources"))
    ap.add_argument("--output-dir", type=Path, default=Path("data/parsed"))
    args = ap.parse_args()

    targets = list(SOURCES.keys()) if (args.all or not args.source) else [args.source]
    total_ok, total_err = 0, 0
    for src in targets:
        ok, err = parse_source(src, args.sources_dir, args.output_dir, args.file)
        total_ok += ok
        total_err += err

    print(f"\nResumo: {total_ok} guia(s) parseado(s), {total_err} pendência(s)/erro(s).")


if __name__ == "__main__":
    main()
