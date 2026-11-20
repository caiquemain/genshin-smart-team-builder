#!/usr/bin/env python3
"""
sync_weapon_sources.py — Popula `weapons.obtain_source` a partir da Genshin Impact Wiki
(`Weapon/List/By_Availability`) com fallback para `paimon-moe` e regras determinísticas.

Categorias canônicas:
  - gacha_limited : Exclusiva de Banner de Armas (5★ e 4★ limitadas)
  - gacha         : Gacha padrão / Mochileiro (+ Banner de Armas)
  - craftable     : Forja / Craftável
  - event         : Exclusiva de Evento
  - battle_pass   : Passe de Batalha (BP)
  - fishing       : Associação de Pesca
  - starglitter   : Loja da Paimon (Brilho Estrelar)
  - quest         : Recompensa de Missão / Quest
  - world         : Mundo / Baú / NPC / Loja comum

Uso:
    python -m app.scripts.sync_weapon_sources
    python -m app.scripts.sync_weapon_sources --dry-run
    python -m app.scripts.sync_weapon_sources --export-snapshot
    python -m app.scripts.sync_weapon_sources --snapshot data/sources/weapons/obtain_sources.json
"""
from __future__ import annotations

import argparse
import html
import json
import re
from pathlib import Path

import httpx

from app.database import SessionLocal
from app.models import Weapon

WIKI_API_URL = (
    "https://genshin-impact.fandom.com/api.php"
    "?action=parse&page=Weapon/List/By_Availability&prop=text&format=json"
)
PAIMON_MOE_URL = (
    "https://raw.githubusercontent.com/MadeBaruna/paimon-moe/main/src/data/weaponList.js"
)
DEFAULT_SNAPSHOT = Path("data/sources/weapons/obtain_sources.json")
HEADERS = {"User-Agent": "GenshinSmartTeamBuilder/1.0 (weapon-source-sync)"}

VALID_SOURCES = (
    "gacha_limited",
    "gacha",
    "craftable",
    "event",
    "battle_pass",
    "fishing",
    "starglitter",
    "quest",
    "world",
)

# Prioridade de classificação quando uma arma aparece em mais de uma seção da Wiki
SOURCE_PRIORITY: dict[str, int] = {
    "craftable": 0,
    "event": 1,
    "fishing": 2,
    "battle_pass": 3,
    "starglitter": 4,
    "quest": 5,
    "gacha_limited": 6,
    "gacha": 7,
    "world": 8,
}

# Mapeamento de títulos de seção de `Weapon/List/By_Availability` -> categoria canônica
WIKI_SECTION_MAP: list[tuple[str, str]] = [
    ("weapon event-exclusive", "gacha_limited"),
    ("standard and weapon event", "gacha"),
    ("flagship event-exclusive", "event"),
    ("event-exclusive", "event"),
    ("fishing association", "fishing"),
    ("paimon's bargains", "starglitter"),
    ("paimons bargains", "starglitter"),
    ("bp bounty", "battle_pass"),
    ("battle pass", "battle_pass"),
    ("forging", "craftable"),
    ("quest weapons", "quest"),
    ("unlimited", "world"),
    ("limited sources", "world"),
]


def weapon_name_to_slug(name: str) -> str:
    s = html.unescape(name or "").strip().strip('"').strip("'")
    s = s.replace("\u2019", "'").replace("\u2018", "'")
    s = re.sub(r"[^a-z0-9]+", "-", s.lower())
    return s.strip("-")


def _section_heading_to_source(heading: str) -> str | None:
    norm = re.sub(r"\s+", " ", html.unescape(heading or "")).strip().lower()
    norm = norm.replace("\u2019", "'")
    for needle, src in WIKI_SECTION_MAP:
        if needle in norm:
            return src
    return None


def parse_wiki_availability_html(page_html: str) -> dict[str, str]:
    """Parseia o HTML retornado pela MediaWiki API de Weapon/List/By_Availability."""
    # Divide por headings <h2> / <h3> preservando o texto do heading
    token_re = re.compile(
        r"<h([23])[^>]*>(.*?)</h\1>|<tr[^>]*>(.*?)</tr>",
        re.IGNORECASE | re.DOTALL,
    )
    anchor_re = re.compile(
        r'<a[^>]+href="/wiki/([^"#?]+)"[^>]*>(.*?)</a>',
        re.IGNORECASE | re.DOTALL,
    )

    mapping: dict[str, str] = {}
    current_source: str | None = None

    for m in token_re.finditer(page_html):
        if m.group(2) is not None:
            heading_text = re.sub(r"<[^>]+>", " ", m.group(2))
            mapped = _section_heading_to_source(heading_text)
            if mapped is not None:
                current_source = mapped
            elif m.group(1) == "2":
                # Nova seção h2 desconhecida reseta contexto
                current_source = None
            continue

        if current_source is None:
            continue

        row_html = m.group(3) or ""
        # Extrai células <td>
        tds = re.findall(r"<td[^>]*>(.*?)</td>", row_html, flags=re.IGNORECASE | re.DOTALL)
        if len(tds) < 2:
            continue
        # Na tabela da Wiki: td[0]=Icon, td[1]=Name (com <a href="/wiki/...">Nome</a>)
        name_cell = tds[1]
        am = anchor_re.search(name_cell)
        if not am:
            # Fallback: texto puro da célula 1
            raw_name = re.sub(r"<[^>]+>", "", name_cell).strip()
        else:
            raw_name = re.sub(r"<[^>]+>", "", am.group(2)).strip()

        slug = weapon_name_to_slug(raw_name)
        if not slug:
            continue

        prev = mapping.get(slug)
        if prev is None or SOURCE_PRIORITY[current_source] < SOURCE_PRIORITY[prev]:
            mapping[slug] = current_source

    return mapping


def _normalize_paimon_source(raw: str) -> str | None:
    s = (raw or "").strip().lower()
    if not s:
        return None
    if "forging" in s or "craft" in s:
        return "craftable"
    if "battle pass" in s:
        return "battle_pass"
    if "fishing" in s:
        return "fishing"
    if "starglitter" in s or "paimon" in s:
        return "starglitter"
    if "event" in s or "playstation" in s:
        return "event"
    if "quest" in s and "wish" not in s:
        return "quest"
    if "chest" in s or "chen the sharp" in s or "orban" in s or "unobtainable" in s:
        return "world"
    if "wish" in s:
        return "gacha"
    return None


def parse_paimon_moe_weapon_list(js_text: str) -> dict[str, str]:
    """Parseia `src/data/weaponList.js` do Paimon.moe como fallback/complemento."""
    mapping: dict[str, str] = {}
    entry_re = re.compile(
        r"name:\s*(['\"])(?P<name>(?:\\.|(?!\1).)+)\1.*?source:\s*(['\"])(?P<src>(?:\\.|(?!\3).)+)\3",
        re.DOTALL,
    )
    chunks = re.split(r"\n[ \t]+[a-z0-9_]+:\s*\{", js_text)
    for chunk in chunks[1:]:
        m = entry_re.search(chunk[:900])
        if not m:
            continue
        name = m.group("name").replace("\\'", "'").replace('\\"', '"')
        src = _normalize_paimon_source(m.group("src"))
        slug = weapon_name_to_slug(name)
        if slug and src:
            mapping[slug] = src
    return mapping


def infer_fallback_source(weapon: Weapon) -> str | None:
    """Heurística segura para armas que ainda não apareceram na Wiki/Paimon.moe."""
    slug = (weapon.slug or "").lower()
    if weapon.rarity <= 2:
        return "world"
    if slug.startswith("blackcliff-") or slug.startswith("royal-"):
        return "starglitter"
    if weapon.rarity == 5:
        return "gacha_limited"
    return None


def fetch_sources_online(timeout: float = 25.0) -> tuple[dict[str, str], dict[str, str]]:
    wiki_map: dict[str, str] = {}
    paimon_map: dict[str, str] = {}
    with httpx.Client(headers=HEADERS, timeout=timeout, follow_redirects=True) as client:
        try:
            r = client.get(WIKI_API_URL)
            r.raise_for_status()
            payload = r.json()
            page_html = payload.get("parse", {}).get("text", {}).get("*", "")
            if page_html:
                wiki_map = parse_wiki_availability_html(page_html)
                print(f"✅ [Wiki] {len(wiki_map)} armas classificadas via Weapon/List/By_Availability")
        except Exception as exc:
            print(f"⚠️  [Wiki] falha ao buscar disponibilidade: {exc}")

        try:
            r2 = client.get(PAIMON_MOE_URL)
            r2.raise_for_status()
            paimon_map = parse_paimon_moe_weapon_list(r2.text)
            print(f"✅ [Paimon.moe] {len(paimon_map)} armas carregadas como complemento")
        except Exception as exc:
            print(f"⚠️  [Paimon.moe] falha ao buscar weaponList.js: {exc}")

    return wiki_map, paimon_map


def merge_source_maps(
    wiki_map: dict[str, str],
    paimon_map: dict[str, str],
    snapshot_map: dict[str, str] | None = None,
) -> dict[str, str]:
    merged: dict[str, str] = {}
    for src_map in (snapshot_map or {}, paimon_map, wiki_map):
        for slug, src in src_map.items():
            if src in VALID_SOURCES:
                merged[slug] = src
    return merged


def sync_weapon_sources_in_db(
    db,
    source_map: dict[str, str],
    *,
    dry_run: bool = False,
) -> dict[str, int]:
    weapons = db.query(Weapon).order_by(Weapon.slug).all()
    counts: dict[str, int] = {}
    updated = 0
    unmatched: list[str] = []

    for w in weapons:
        src = source_map.get(w.slug) or source_map.get(weapon_name_to_slug(w.name))
        if not src:
            src = infer_fallback_source(w)
        if src:
            counts[src] = counts.get(src, 0) + 1
            if w.obtain_source != src:
                w.obtain_source = src
                updated += 1
        else:
            unmatched.append(w.slug)

    if dry_run:
        db.rollback()
        print("🔎 DRY RUN — nada foi salvo")
    else:
        db.commit()
        print(f"✅ Salvo no banco ({updated} arma(s) atualizada(s) de {len(weapons)} total).")

    print("   Distribuição:", ", ".join(f"{k}:{v}" for k, v in sorted(counts.items())))
    if unmatched:
        print(f"   ⚠️  {len(unmatched)} arma(s) sem classificação: {', '.join(unmatched[:20])}")
    return counts


def main() -> None:
    ap = argparse.ArgumentParser(description="Sincroniza weapons.obtain_source via Genshin Wiki + Paimon.moe")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--offline", action="store_true", help="Usa apenas o snapshot local sem requisições HTTP")
    ap.add_argument("--snapshot", type=Path, default=DEFAULT_SNAPSHOT)
    ap.add_argument("--export-snapshot", action="store_true", help="Salva o mapa consolidado em JSON")
    args = ap.parse_args()

    snapshot_map: dict[str, str] = {}
    if args.snapshot.is_file():
        snapshot_map = json.loads(args.snapshot.read_text(encoding="utf-8"))

    wiki_map: dict[str, str] = {}
    paimon_map: dict[str, str] = {}
    if not args.offline:
        wiki_map, paimon_map = fetch_sources_online()

    merged = merge_source_maps(wiki_map, paimon_map, snapshot_map)
    if args.export_snapshot and merged:
        args.snapshot.parent.mkdir(parents=True, exist_ok=True)
        args.snapshot.write_text(
            json.dumps(dict(sorted(merged.items())), indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
        print(f"💾 Snapshot salvo em {args.snapshot} ({len(merged)} armas)")

    db = SessionLocal()
    try:
        sync_weapon_sources_in_db(db, merged, dry_run=args.dry_run)
    finally:
        db.close()


if __name__ == "__main__":
    main()
