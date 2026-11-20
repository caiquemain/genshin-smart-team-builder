#!/usr/bin/env python3
"""
import_tierlists.py — Parser + importador multi-fonte para tierlists em `backend/data/sources/tierlists/<site>/`.

Lê o snapshot mais recente (`.txt` com parser próprio ou `.csv` canônico),
cadastra/atualiza o site em `tierlist_sites`, calcula `tier_index`,
`normalized_value` e `tier_master`, e substitui as entradas do site de forma
idempotente em `tierlist_entries`.

Uso:
    python -m app.scripts.import_tierlists --site icy-veins
    python -m app.scripts.import_tierlists --site icy-veins --dry-run
    python -m app.scripts.import_tierlists --all
"""
import argparse
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import Character, TierlistEntry, TierlistSite
from app.scripts.tierlist_parsers import (
    TIERLIST_SITES,
    TierlistSiteConfig,
    compute_tier_metrics,
    parse_canonical_csv,
)

_SEMVER_RE = re.compile(r"(\d+)(?:\.(\d+))?")


def _version_sort_key(path: Path, cfg: TierlistSiteConfig) -> tuple:
    m = _SEMVER_RE.search(path.stem)
    major = int(m.group(1)) if m else -1
    minor = int(m.group(2)) if (m and m.group(2) is not None) else -1
    ext = path.suffix.lower()
    if ext == ".html" and cfg.html_parser is not None:
        ext_rank = 2
    elif ext == ".txt" and cfg.txt_parser is not None:
        ext_rank = 2
    elif ext == ".csv":
        ext_rank = 1
    else:
        ext_rank = 0
    return (major, minor, ext_rank, path.name)


def pick_latest_source_file(site_dir: Path, cfg: TierlistSiteConfig, single_file: Optional[str] = None) -> Optional[Path]:
    """Escolhe o arquivo mais recente (.html/.txt se houver parser, ou .csv canônico)."""
    if not site_dir.exists():
        return None
    if single_file:
        p = site_dir / single_file
        return p if p.is_file() else None

    candidates: list[Path] = []
    if cfg.html_parser is not None:
        candidates.extend(site_dir.glob("*.html"))
    if cfg.txt_parser is not None:
        candidates.extend(site_dir.glob("*.txt"))
    candidates.extend(site_dir.glob("*.csv"))
    candidates = [p for p in candidates if p.is_file()]
    if not candidates:
        return None
    candidates.sort(key=lambda p: _version_sort_key(p, cfg))
    return candidates[-1]


def parse_tierlist_file(path: Path, cfg: TierlistSiteConfig) -> dict:
    text = path.read_text(encoding="utf-8", errors="replace")
    version_hint = path.stem
    ext = path.suffix.lower()
    if ext == ".csv":
        return parse_canonical_csv(text, cfg.slug, version_hint, list(cfg.scale))
    if ext == ".txt":
        if cfg.txt_parser is None:
            raise ValueError(f"Site '{cfg.slug}' ainda não tem parser de .txt implementado.")
        return cfg.txt_parser(text, version_hint)
    if ext == ".html":
        if cfg.html_parser is None:
            raise ValueError(f"Site '{cfg.slug}' ainda não tem parser de .html implementado.")
        return cfg.html_parser(text, version_hint)
    raise ValueError(f"Extensão não suportada: {path.suffix}")


def _load_role_fallback_map(db: Session) -> dict[str, str]:
    """Usa roles do genshin-gg já gravadas no banco como fallback para sites sem coluna de role."""
    gg = db.query(TierlistSite).filter(TierlistSite.slug == "genshin-gg").one_or_none()
    if not gg:
        return {}
    rows = (
        db.query(TierlistEntry.character_slug, TierlistEntry.role)
        .filter(TierlistEntry.site_id == gg.id)
        .all()
    )
    return {slug: role for slug, role in rows if role and role != "general"}


def import_site(
    db: Session,
    cfg: TierlistSiteConfig,
    source_path: Path,
    valid_char_slugs: set[str],
    role_fallback: dict[str, str],
) -> dict:
    parsed = parse_tierlist_file(source_path, cfg)
    version = parsed["version"]
    entries = parsed["entries"]

    site_name = parsed.get("site_name") or cfg.name
    site = db.query(TierlistSite).filter(TierlistSite.slug == cfg.slug).one_or_none()
    if site is None:
        site = TierlistSite(
            slug=cfg.slug,
            name=site_name,
            url=cfg.url,
            scale_size=len(cfg.scale),
        )
        db.add(site)
        db.flush()
    else:
        site.name = site_name
        site.url = cfg.url
        site.scale_size = len(cfg.scale)

    # Substitui entries anteriores deste site (evita duplicatas de versões antigas)
    db.query(TierlistEntry).filter(TierlistEntry.site_id == site.id).delete(synchronize_session=False)

    inserted = 0
    skipped_unknown: list[str] = []
    tier_counts: dict[str, int] = {}

    for entry in entries:
        slug = entry["character_slug"]
        if slug not in valid_char_slugs:
            skipped_unknown.append(slug)
            continue

        tier_label = entry["tier_label"]
        tier_idx, norm, master = compute_tier_metrics(cfg, tier_label)
        role = entry.get("role") or role_fallback.get(slug) or "general"

        db.add(
            TierlistEntry(
                site_id=site.id,
                character_slug=slug,
                role=role,
                tier_label=tier_label,
                tier_index=tier_idx,
                normalized_value=norm,
                tier_master=master,
                version=version,
                source_url=cfg.url,
            )
        )
        inserted += 1
        tier_counts[master] = tier_counts.get(master, 0) + 1

    site.last_scraped_at = datetime.now(timezone.utc)
    return {
        "site": cfg.slug,
        "file": source_path.name,
        "version": version,
        "inserted": inserted,
        "skipped_unknown": sorted(set(skipped_unknown)),
        "tier_counts": tier_counts,
    }


def import_yshelper_teams_from_file(
    db: Session,
    cfg: TierlistSiteConfig,
    source_path: Path,
    min_use_rate: float,
    warnings: list[str],
) -> dict:
    """Importa times reais do HTML do YS Helper para TeamTemplate (com merge multi-fonte)."""
    from app.scripts.import_kqm import import_teams
    from app.scripts.tierlist_parsers import parse_yshelper_teams

    html = source_path.read_text(encoding="utf-8", errors="replace")
    parsed = parse_yshelper_teams(
        html,
        version_hint=source_path.stem,
        site_slug=cfg.slug,
        min_use_rate=min_use_rate,
    )
    teams = parsed["teams"]
    if not teams:
        return {"source_name": parsed["source_name"], "matched": 0, "new": 0, "total_parsed": parsed["total_parsed"]}

    new_count = import_teams(
        db,
        teams,
        source_url=cfg.url,
        warnings=warnings,
        source_name=parsed["source_name"],
    )
    return {
        "source_name": parsed["source_name"],
        "matched": len(teams),
        "new": new_count,
        "merged": len(teams) - new_count,
        "total_parsed": parsed["total_parsed"],
    }


def main():
    ap = argparse.ArgumentParser(description="Importador multi-fonte de tierlists")
    ap.add_argument("--site", type=str, choices=list(TIERLIST_SITES.keys()), help="Site específico (ex.: icy-veins)")
    ap.add_argument("--all", action="store_true", help="Importa todos os sites com arquivos em data/sources/tierlists/")
    ap.add_argument("--file", type=str, help="Arquivo específico dentro da pasta do site (ex.: 7.2.txt)")
    ap.add_argument("--sources-dir", type=Path, default=Path("data/sources/tierlists"))
    ap.add_argument("--with-teams", action="store_true", help="Também importa times reais do YS Helper (HTML) em TeamTemplate")
    ap.add_argument("--teams-only", action="store_true", help="Importa apenas os times do YS Helper sem reescrever tierlist_entries")
    ap.add_argument("--min-use-rate", type=float, default=3.0, help="Taxa de uso mínima (%) para importar times do YS Helper (padrão: 3.0)")
    ap.add_argument("--dry-run", action="store_true", help="Valida e mostra resumo sem salvar no banco")
    args = ap.parse_args()

    if not args.all and not args.site:
        ap.error("Informe --site <slug> ou --all")

    # Garante genshin-gg primeiro quando rodando --all para popular role_fallback
    if args.all:
        targets = ["genshin-gg"] + [s for s in TIERLIST_SITES.keys() if s != "genshin-gg"]
    else:
        targets = [args.site]

    db = SessionLocal()
    try:
        valid_slugs = {row[0] for row in db.query(Character.slug).all()}
        role_fallback = _load_role_fallback_map(db)

        total_inserted = 0
        total_teams_new = 0
        team_warnings: list[str] = []

        for site_slug in targets:
            cfg = TIERLIST_SITES[site_slug]
            src_path = pick_latest_source_file(args.sources_dir / site_slug, cfg, args.file)
            if src_path is None:
                print(f"  [{site_slug}] nenhum arquivo encontrado — pulando.")
                continue

            if not args.teams_only:
                summary = import_site(db, cfg, src_path, valid_slugs, role_fallback)
                total_inserted += summary["inserted"]

                # Se acabamos de importar genshin-gg, atualiza o role_fallback para os próximos sites
                if site_slug == "genshin-gg":
                    db.flush()
                    role_fallback = _load_role_fallback_map(db)

                counts_str = " ".join(
                    f"{t}:{summary['tier_counts'][t]}"
                    for t in ("S+", "S", "A", "B", "C", "D")
                    if t in summary["tier_counts"]
                )
                print(
                    f"✅ [{site_slug}] {summary['file']} (v{summary['version']}): "
                    f"{summary['inserted']} entries ({counts_str})"
                )
                if summary["skipped_unknown"]:
                    print(
                        f"   ⚠️  {len(summary['skipped_unknown'])} slug(s) ausente(s) na tabela characters: "
                        f"{', '.join(summary['skipped_unknown'])}"
                    )

            if (args.with_teams or args.teams_only) and site_slug.startswith("yshelper-") and src_path.suffix.lower() == ".html":
                t_sum = import_yshelper_teams_from_file(
                    db, cfg, src_path, args.min_use_rate, team_warnings
                )
                db.flush()
                total_teams_new += t_sum["new"]
                print(
                    f"⚔️  [{t_sum['source_name']}] times >= {args.min_use_rate:.1f}%: "
                    f"{t_sum['new']} novo(s), {t_sum.get('merged', 0)} mesclado(s) "
                    f"(de {t_sum['total_parsed']} times no HTML)"
                )

        if team_warnings:
            print(f"⚠️  {len(team_warnings)} aviso(s) nos times:")
            for w in team_warnings[:15]:
                print(f"  - {w}")

        if args.dry_run:
            db.rollback()
            print(f"\n🔎 DRY RUN — nada foi salvo (tierlist={total_inserted}, teams_novos={total_teams_new}).")
        else:
            db.commit()
            print(f"\n✅ Salvo no banco (tierlist={total_inserted}, teams_novos={total_teams_new}).")
    finally:
        db.close()


if __name__ == "__main__":
    main()
