#!/usr/bin/env python3
"""
import_kqm.py — Importa JSONs gerados pelo parse_kqm_guide.py para o banco.

Uso:
    python -m app.scripts.import_kqm backend/data/parsed
    python -m app.scripts.import_kqm backend/data/parsed --dry-run
"""
import argparse
import json
from pathlib import Path
import re

from sqlalchemy import func
from app.database import SessionLocal
from app.models import (
    Character, Weapon, ArtifactSet,
    CharacterBuildPreset, TeamTemplate,
    Team, TeamCharacter,
)
# Aliases para corrigir nomes "sujos" do KQM
CHAR_ALIASES = {
    # Travelers (KQM usa "{elemento}-traveler", DB usa "traveler-{elemento}")
    "dendro-traveler": "traveler-dendro",
    "anemo-traveler": "traveler-anemo",
    "geo-traveler": "traveler-geo",
    "electro-traveler": "traveler-electro",
    "hydro-traveler": "traveler-hydro",
    "pyro-traveler": "traveler-pyro",
    "cryo-traveler": "traveler-cryo",
    # Typos do KQM
    "symphonist-of-scent": "symphonist-of-scents",
    "night-of-the-sky-s-unveiling": "night-of-the-skys-unveiling",
    # Originais
    "charlottel": "charlotte",
    "charlottell": "charlotte",
    "hutao": "hu-tao",
    "kaedeharakazuha": "kaedehara-kazuha",
    "kamisatoayaka": "kamisato-ayaka",
    "kamisatoayato": "kamisato-ayato",
    "kujousara": "kujou-sara",
    "kukishinobu": "kuki-shinobu",
    "shinobu": "kuki-shinobu",
    "raidenshogun": "raiden-shogun",
    "sangonomiyakokomi": "sangonomiya-kokomi",
    "shikanoinheizou": "shikanoin-heizou",
    "aratakiitto": "arataki-itto",
    "yaemiko": "yae-miko",
    "yumemizukimizuki": "yumemizuki-mizuki",
    "kokomi": "sangonomiya-kokomi",
    "kazuha": "kaedehara-kazuha",
    "itto": "arataki-itto",
    "ayaka": "kamisato-ayaka",
    "ayato": "kamisato-ayato",
    "heizou": "shikanoin-heizou",
    "mizuki": "yumemizuki-mizuki",
    "sara": "kujou-sara",
    "shogun": "raiden-shogun",
    "raiden": "raiden-shogun",
}

# Aliases especificos de armas (slug -> slug no DB)
WEAPON_ALIASES = {
    "symphonist-of-scent": "symphonist-of-scents",  # KQM omitiu o 's' final
    "jadefall-splendor": "jadefall-s-splendor",     # KQM sem apostrofo
    "sacrifical-jade": "sacrificial-jade",          # Helper Sheet typo
    "fruit-of-fulfilment": "fruit-of-fulfillment",  # Helper Sheet UK spelling
    "aquilla-favonia": "aquila-favonia",            # Helper Sheet typo
    "lost-prayer-to-sacred-winds": "lost-prayer-to-the-sacred-winds",
    "a-thousand-floating-dream": "a-thousand-floating-dreams",
    "gest-of-the-might-wolf": "gest-of-the-mighty-wolf",
}

# Aliases especificos de sets (slug -> slug no DB)
ARTIFACT_ALIASES = {
    "night-of-the-sky-s-unveiling": "night-of-the-skys-unveiling",
    "marchaussee-hunter": "marechaussee-hunter",
    "song-of-day-s-past": "song-of-days-past",
    "silken-moon-serenade": "silken-moons-serenade",
}

# Placeholders que aparecem nos times do KQM e NÃO são personagens
SKIP_SLUGS = {
    "flex", "pyro", "hydro", "cryo", "electro", "anemo", "geo", "dendro",
    "any", "none", "flexible", "utility", "healer", "shield", "buffer",
}

# Placeholders do KQM tipo "Core Dendro", "Secondary Hydro"
PLACEHOLDER_PATTERN = re.compile(r'^(?:core|secondary)-')

# Regras de detecção de arquétipo (ordem importa: mais específico primeiro)
ARCHETYPE_RULES = [
    # (archetype, required_in_team, forbidden_in_team)
    ("hyperbloom",  {"nahida", "kuki-shinobu"}, set()),
    ("hyperbloom",  {"nahida", "raiden-shogun", "xingqiu"}, set()),
    ("bloom",       {"nilou"}, set()),
    ("burgeon",     {"kinich"}, set()),
    ("burgeon",     {"emilie", "xiangling", "bennett"}, set()),
    ("aggravate",   {"fischl"}, {"nahida", "alhaitham", "tighnari"}),
    ("spread",      {"nahida"}, {"nilou", "kuki-shinobu"}),
    ("overload",    {"chevreuse"}, set()),
    ("melt",        {"xiangling", "bennett"}, {"yelan", "xingqiu", "furina", "childe"}),
    ("melt",        {"nahida", "bennett", "thoma"}, set()),
    ("freeze",      {"skirk"}, set()),
    ("freeze",      {"kamisato-ayaka"}, set()),
    ("freeze",      {"wriothesley", "furina"}, set()),
    ("freeze",      {"shenhe", "kazuha", "kokomi"}, set()),
    ("superconduct", {"eula", "raiden-shogun"}, set()),
    ("hypercarry",  {"eula", "bennett"}, set()),
    ("hypercarry",  {"arataki-itto", "gorou"}, set()),
    ("hypercarry",  {"navia", "zhongli"}, set()),
    ("hypercarry",  {"neuvillette", "furina"}, set()),
    ("hypercarry",  {"wanderer", "faruzan"}, set()),
    ("hypercarry",  {"xiao", "faruzan"}, set()),
    ("national",    {"tartaglia", "xiangling", "bennett"}, set()),
    ("national",    {"xiangling", "bennett"}, set()),
    ("vaporize",    {"hutao", "yelan"}, set()),
    ("vaporize",    {"arlecchino"}, set()),
    ("vaporize",    {"yoimiya", "xingqiu"}, set()),
    ("vaporize",    {"mualani", "xiangling"}, set()),
    ("vaporize",    {"klee", "bennett"}, set()),
    ("vaporize",    {"diluc", "xingqiu"}, set()),
]


def detect_archetype(character_slugs: list[str]) -> str:
    team = set(character_slugs)
    for archetype, required, forbidden in ARCHETYPE_RULES:
        if required.issubset(team) and not (forbidden & team):
            return archetype
    return "unknown"


def normalize_slug(slug: str) -> str:
    return CHAR_ALIASES.get(slug, slug)



def _canon_name(s: str) -> str:
    """Normaliza apostrofos tipograficos (U+2018/2019) para ASCII + lowercase."""
    if not s:
        return ""
    return s.replace("\u2019", "'").replace("\u2018", "'").lower()


def _name_filter(column, target: str):
    """SQL filter que canonicaliza apostrofos tipograficos na coluna antes de comparar."""
    canon_col = func.lower(
        func.replace(func.replace(column, "\u2019", "'"), "\u2018", "'")
    )
    return canon_col == target


def resolve_weapon(db, slug, name):
    w = db.query(Weapon).filter(Weapon.slug == slug).first()
    if w: return w
    aliased = WEAPON_ALIASES.get(slug)
    if aliased:
        w = db.query(Weapon).filter(Weapon.slug == aliased).first()
        if w: return w
    if not name: return None
    return db.query(Weapon).filter(_name_filter(Weapon.name, _canon_name(name))).first()


def resolve_artifact(db, slug, name):
    a = db.query(ArtifactSet).filter(ArtifactSet.slug == slug).first()
    if a: return a
    aliased = ARTIFACT_ALIASES.get(slug)
    if aliased:
        a = db.query(ArtifactSet).filter(ArtifactSet.slug == aliased).first()
        if a: return a
    if not name: return None
    return db.query(ArtifactSet).filter(_name_filter(ArtifactSet.name, _canon_name(name))).first()


def resolve_character(db, slug):
    return db.query(Character).filter(Character.slug == slug).first()


def _extract_refinement(notes: str | None) -> int:
    """Extrai 'R5'/'R1' do notes. Default 1."""
    if not notes:
        return 1
    m = re.search(r'\bR([1-5])\b', notes)
    return int(m.group(1)) if m else 1


def _normalize_build_data(db, raw_bd, warnings):
    """Normaliza build_data do JSON (resolve slugs de armas/sets, extrai refinement)."""
    bd = dict(raw_bd)

    valid_w = []
    for w in bd.get("weapons", []):
        r = resolve_weapon(db, w["weapon_slug"], w.get("weapon_name", ""))
        if r:
            valid_w.append({
                "weapon_slug": r.slug,
                "weapon_refinement": _extract_refinement(w.get("notes")),
                "notes": w.get("notes"),
            })
        else:
            warnings.append(f"[team-custom] Arma não encontrada: {w['weapon_slug']}")
    bd["weapons"] = valid_w

    valid_a = []
    for a in bd.get("artifacts_4pc", []):
        r = resolve_artifact(db, a["artifact_set_slug"], a.get("artifact_set_name", ""))
        if r:
            valid_a.append({"artifact_set_slug": r.slug, "notes": a.get("notes")})
        else:
            warnings.append(f"[team-custom] Set não encontrado: {a['artifact_set_slug']}")
    bd["artifacts_4pc"] = valid_a

    return bd


def _normalize_teammate_notes(notable_teammates: list[dict] | None) -> dict[str, dict[str, str]]:
    notes: dict[str, dict[str, str]] = {}
    for nt in notable_teammates or []:
        slug = normalize_slug(nt.get("character_slug", ""))
        if not slug or slug in SKIP_SLUGS or PLACEHOLDER_PATTERN.match(slug):
            continue
        if slug not in notes:
            notes[slug] = {
                "category": nt.get("category") or "Teammate",
                "notes": nt.get("notes") or "",
            }
    return notes


def _normalize_slot_alternatives(raw_alts: dict | None) -> dict[str, list[str]]:
    out: dict[str, list[str]] = {}
    for k, slugs in (raw_alts or {}).items():
        cleaned = []
        for s in slugs or []:
            ns = normalize_slug(s)
            if ns and ns not in SKIP_SLUGS and not PLACEHOLDER_PATTERN.match(ns) and ns not in cleaned:
                cleaned.append(ns)
        if cleaned:
            out[str(k)] = cleaned
    return out


def _merge_sources(existing: list[dict] | None, source_name: str, source_url: str | None) -> list[dict]:
    merged = [dict(s) for s in (existing or []) if isinstance(s, dict)]
    if not any(s.get("source") == source_name for s in merged):
        merged.append({"source": source_name, "url": source_url})
    return merged


def _merge_slot_substitutes(existing: dict | None, incoming: dict[str, list[dict]]) -> dict[str, list[dict]]:
    merged: dict[str, list[dict]] = {
        str(k): [dict(item) for item in (v or [])]
        for k, v in (existing or {}).items()
    }
    for pos_k, items in incoming.items():
        bucket = merged.setdefault(str(pos_k), [])
        seen = {x.get("character_slug") for x in bucket}
        for item in items:
            slug = item.get("character_slug")
            if slug and slug not in seen:
                bucket.append(item)
                seen.add(slug)
    return merged


def create_team_from_build(
    db,
    char,
    raw_bd,
    teams,
    source_url,
    warnings,
    source_name: str = "KQM",
    teammate_notes: dict[str, dict[str, str]] | None = None,
):
    """Cria Team customizável a partir do guia. Retorna True se criou."""
    from app.services.substitutes import compute_slot_substitutes_for_slugs

    if not teams:
        warnings.append(f"[team-custom] {char.slug}: sem times no guia")
        return False

    # Escolhe time: main_character == char.slug, senão primeiro
    chosen = next((t for t in teams if normalize_slug(t.get("main_character", "")) == char.slug), None) or teams[0]

    # Resolve chars válidos (aplica CHAR_ALIASES + skip placeholders)
    valid_chars = []
    for slug in chosen.get("character_slugs", []):
        slug = normalize_slug(slug)
        if slug in SKIP_SLUGS or PLACEHOLDER_PATTERN.match(slug):
            continue
        c = resolve_character(db, slug)
        if c:
            valid_chars.append(c)
    if len(valid_chars) < 2:
        warnings.append(f"[team-custom] {char.slug}: time inválido ({len(valid_chars)} chars)")
        return False

    # Nome (opção B)
    team_name = f"{char.name} — Principal"
    if db.query(Team).filter(Team.name == team_name).first():
        warnings.append(f"[team-custom] Team '{team_name}' já existe (skip)")
        return False

    # Normaliza build_data do main char
    main_bd = _normalize_build_data(db, raw_bd, warnings)
    main_bd["references"] = [{"url": source_url, "title": f"{source_name} {char.name} Guide"}]
    main_bd["substitutes"] = []

    # Calcula substitutos curados por slot a partir de '/' + Notable Teammates + fallback
    valid_slugs = [c.slug for c in valid_chars]
    slot_alts = _normalize_slot_alternatives(chosen.get("slot_alternatives"))
    computed_subs = compute_slot_substitutes_for_slugs(
        db,
        valid_slugs,
        main_character=char.slug,
        slot_alternatives=slot_alts,
        teammate_notes=teammate_notes,
        limit=6,
    )

    # Cria Team
    team = Team(
        name=team_name,
        description=f"Build importada de {source_name} — {source_url}",
        is_public=True,
    )
    db.add(team)
    db.flush()

    for i, c in enumerate(valid_chars, start=1):
        if c.id == char.id:
            char_bd = main_bd
        else:
            preset = db.query(CharacterBuildPreset).filter(
                CharacterBuildPreset.character_id == c.id,
            ).first()
            char_bd = dict(preset.build_data) if preset and preset.build_data else None

        db.add(TeamCharacter(
            team_id=team.id,
            character_id=c.id,
            position=i,
            build_data=char_bd,
            substitutes=computed_subs.get(i, []),
        ))

    return True


def import_build(db, data, warnings):
    slug = data["character_slug"]
    char = resolve_character(db, slug)
    if not char:
        warnings.append(f"[build] Character não encontrado: {slug}")
        return False

    build = data["build"]
    bd = dict(build["build_data"])

    valid_w = []
    for w in bd.get("weapons", []):
        r = resolve_weapon(db, w["weapon_slug"], w.get("weapon_name", ""))
        if r:
            valid_w.append({
                "weapon_slug": r.slug,
                "weapon_refinement": _extract_refinement(w.get("notes")),
                "notes": w.get("notes"),
            })
        else:
            warnings.append(f"[build] Arma não encontrada: {w['weapon_slug']}")
    bd["weapons"] = valid_w

    valid_a = []
    for a in bd.get("artifacts_4pc", []):
        r = resolve_artifact(db, a["artifact_set_slug"], a.get("artifact_set_name", ""))
        if r:
            valid_a.append({"artifact_set_slug": r.slug, "notes": a.get("notes")})
        else:
            warnings.append(f"[build] Set não encontrado: {a['artifact_set_slug']}")
    bd["artifacts_4pc"] = valid_a

    valid_a2 = []
    for p in bd.get("artifacts_2pc", []):
        if "set1_slug" in p and "set2_slug" in p:
            r1 = resolve_artifact(db, p["set1_slug"], p.get("set1_name", ""))
            r2 = resolve_artifact(db, p["set2_slug"], p.get("set2_name", ""))
            if r1 and r2:
                valid_a2.append({"set1_slug": r1.slug, "set2_slug": r2.slug, "notes": p.get("notes")})
            else:
                warnings.append(f"[build] Par 2pc não encontrado: {p.get('set1_slug')} + {p.get('set2_slug')}")
    bd["artifacts_2pc"] = valid_a2

    existing = db.query(CharacterBuildPreset).filter(
        CharacterBuildPreset.character_id == char.id,
        CharacterBuildPreset.name == build["name"],
    ).first()
    if existing:
        existing.build_data = bd
    else:
        db.add(CharacterBuildPreset(
            character_id=char.id, name=build["name"], build_data=bd,
        ))
    return True


# Prioridade editorial para metadados de TeamTemplate (menor = maior autoridade).
# Guias editoriais (KQM, Game8, GameWith, Genshin.gg) sempre prevalecem sobre
# templates importados de estatísticas empíricas (YS Helper), preservando ambos em `sources`.
TEMPLATE_SOURCE_PRIORITY: dict[str, int] = {
    "kqm": 0,
    "game8": 1,
    "gamewith": 2,
    "genshin.gg": 3,
    "genshingg": 3,
    "ys abyss": 10,
    "ys stygian": 11,
}


def source_priority(source_name: str | None) -> int:
    norm = (source_name or "").strip().lower()
    if norm in TEMPLATE_SOURCE_PRIORITY:
        return TEMPLATE_SOURCE_PRIORITY[norm]
    for prefix, prio in TEMPLATE_SOURCE_PRIORITY.items():
        if norm.startswith(prefix):
            return prio
    return 5  # Outras fontes editoriais continuam acima do YS Helper


def import_teams(
    db,
    teams,
    source_url,
    warnings,
    source_name: str = "KQM",
    teammate_notes: dict[str, dict[str, str]] | None = None,
):
    from app.services.substitutes import compute_slot_substitutes_for_slugs

    imported = 0
    existing_by_canonical: dict[tuple[str, ...], TeamTemplate] = {
        tuple(sorted(et.character_slugs or [])): et
        for et in db.query(TeamTemplate).all()
    }
    incoming_prio = source_priority(source_name)

    for t in teams:
        cleaned = [
            s for s in t["character_slugs"]
            if s not in SKIP_SLUGS and not PLACEHOLDER_PATTERN.match(s)
        ]
        normalized = [normalize_slug(s) for s in cleaned]
        valid = [s for s in normalized if resolve_character(db, s)]
        for s in normalized:
            if s not in valid:
                warnings.append(f"[team] Personagem não encontrado: {s}")
        if len(valid) < 3:
            continue

        slot_alts = _normalize_slot_alternatives(t.get("slot_alternatives"))
        computed = compute_slot_substitutes_for_slugs(
            db,
            valid,
            main_character=valid[0],
            slot_alternatives=slot_alts,
            teammate_notes=teammate_notes,
            limit=6,
        )
        slot_subs_json = {str(pos): items for pos, items in computed.items() if items}

        canonical = tuple(sorted(valid))
        dup = existing_by_canonical.get(canonical)
        if dup:
            # Multi-fonte: mescla fontes e substitutos, respeitando hierarquia editorial > empírica
            existing_prio = source_priority(dup.source)
            dup.sources = _merge_sources(dup.sources, source_name, source_url)
            if incoming_prio < existing_prio:
                # Fonte editorial mais rica sobrescreve nome, descrição, ordem e fonte primária
                dup.source = source_name
                dup.source_url = source_url
                dup.character_slugs = valid
                dup.main_character = valid[0]
                dup.archetype = detect_archetype(valid)
                if t.get("description"):
                    dup.description = t["description"]
                new_name = (t.get("raw_line") or "")[:150]
                if new_name and new_name != dup.name:
                    clash = db.query(TeamTemplate).filter(
                        TeamTemplate.name == new_name,
                        TeamTemplate.id != dup.id,
                    ).first()
                    if not clash:
                        dup.name = new_name
                dup.slot_substitutes = _merge_slot_substitutes(slot_subs_json, dup.slot_substitutes)
            else:
                dup.slot_substitutes = _merge_slot_substitutes(dup.slot_substitutes, slot_subs_json)
                if not dup.description and t.get("description"):
                    dup.description = t["description"]
            continue

        name = t["raw_line"][:150]
        if db.query(TeamTemplate).filter(TeamTemplate.name == name).first():
            continue

        archetype = detect_archetype(valid)
        tpl = TeamTemplate(
            name=name,
            main_character=valid[0],
            archetype=archetype,
            description=t.get("description"),
            character_slugs=valid,
            source=source_name,
            source_url=source_url,
            sources=[{"source": source_name, "url": source_url}],
            slot_substitutes=slot_subs_json,
        )
        db.add(tpl)
        existing_by_canonical[canonical] = tpl
        imported += 1
    return imported


def import_directory(db, input_dir: Path, create_team: bool, warnings: list[str]) -> tuple[int, int, int]:
    """Importa todos os *-build.json e *-teams.json de uma pasta parseada."""
    builds, teams, custom_teams = 0, 0, 0
    notes_by_slug: dict[str, dict[str, dict[str, str]]] = {}
    meta_by_slug: dict[str, tuple[str, str]] = {}

    for f in sorted(input_dir.glob("*-build.json")):
        slug = f.stem.replace("-build", "")
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
            source_name = data.get("source") or "KQM"
            source_url = data.get("source_url") or f"https://keqingmains.com/{slug}/"
            meta_by_slug[slug] = (source_name, source_url)
            notes_by_slug[slug] = _normalize_teammate_notes(data.get("notable_teammates"))
            if import_build(db, data, warnings):
                builds += 1
        except Exception as e:
            warnings.append(f"[{f.name}] {e}")

    teams_by_slug: dict[str, list[dict]] = {}
    for f in sorted(input_dir.glob("*-teams.json")):
        slug = f.stem.replace("-teams", "")
        source_name, source_url = meta_by_slug.get(slug, ("KQM", f"https://keqingmains.com/{slug}/"))
        try:
            t_list = json.loads(f.read_text(encoding="utf-8"))
            teams_by_slug[slug] = t_list
            teams += import_teams(
                db,
                t_list,
                source_url,
                warnings,
                source_name=source_name,
                teammate_notes=notes_by_slug.get(slug),
            )
        except Exception as e:
            warnings.append(f"[{f.name}] {e}")

    if create_team:
        for f in sorted(input_dir.glob("*-build.json")):
            slug = f.stem.replace("-build", "")
            try:
                data = json.loads(f.read_text(encoding="utf-8"))
                char = resolve_character(db, slug)
                if not char:
                    warnings.append(f"[team-custom] {slug}: character não encontrado")
                    continue
                raw_bd = data["build"]["build_data"]
                source_name, source_url = meta_by_slug.get(slug, ("KQM", f"https://keqingmains.com/{slug}/"))
                if create_team_from_build(
                    db,
                    char,
                    raw_bd,
                    teams_by_slug.get(slug, []),
                    source_url,
                    warnings,
                    source_name=source_name,
                    teammate_notes=notes_by_slug.get(slug),
                ):
                    custom_teams += 1
            except Exception as e:
                warnings.append(f"[{f.name}] team-custom: {e}")

    return builds, teams, custom_teams


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("input", type=Path)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--create-team", action="store_true",
                    help="Cria 1 Team customizado por guia (o mais canônico)")
    args = ap.parse_args()

    db = SessionLocal()
    warnings: list[str] = []
    builds, teams, custom_teams = import_directory(db, args.input, args.create_team, warnings)

    if args.dry_run:
        db.rollback()
        print("🔎 DRY RUN — nada foi salvo")
    else:
        db.commit()
        print("✅ Salvo no banco")

    suffix = f" · Teams customizados: {custom_teams}" if args.create_team else ""
    print(f"   Builds: {builds} · Times novos: {teams}{suffix}")
    if warnings:
        print(f"   ⚠️  {len(warnings)} aviso(s):")
        for w in warnings[:15]:
            print(f"     - {w}")
    db.close()


if __name__ == "__main__":
    main()

