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
}

# Aliases especificos de sets (slug -> slug no DB)
ARTIFACT_ALIASES = {
    "night-of-the-sky-s-unveiling": "night-of-the-skys-unveiling",
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


def create_team_from_build(db, char, raw_bd, teams, source_url, warnings):
    """Cria Team customizável a partir do guia KQM. Retorna True se criou."""
    if not teams:
        warnings.append(f"[team-custom] {char.slug}: sem times no guia")
        return False

    # Escolhe time: main_character == char.slug, senão primeiro
    chosen = next((t for t in teams if t.get("main_character") == char.slug), None) or teams[0]

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
    main_bd["references"] = [{"url": source_url, "title": f"KQM {char.name} Guide"}]
    main_bd["substitutes"] = []

    # Cria Team
    team = Team(
        name=team_name,
        description=f"Build importada do KQM — {source_url}",
        is_public=True,
    )
    db.add(team)
    db.flush()

    for i, c in enumerate(valid_chars, start=1):
        if c.id == char.id:
            char_bd = main_bd
        else:
            # Flex: usa preset existente se tiver, senão vazio
            preset = db.query(CharacterBuildPreset).filter(
                CharacterBuildPreset.character_id == c.id,
            ).first()
            char_bd = dict(preset.build_data) if preset and preset.build_data else {}
            if isinstance(char_bd, dict) and "references" not in char_bd:
                char_bd["references"] = []

        db.add(TeamCharacter(
            team_id=team.id,
            character_id=c.id,
            position=i,
            build_data=char_bd,
            substitutes=[],
        ))

    return True


def import_build(db, data, warnings):
    slug = data["character_slug"]
    char = resolve_character(db, slug)
    if not char:
        warnings.append(f"[build] Character não encontrado: {slug}")
        return False

    build = data["build"]
    bd = build["build_data"]

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


def import_teams(db, teams, source_url, warnings):
    imported = 0
    for t in teams:
        # Filtra placeholders e normaliza slugs
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

        name = t["raw_line"][:150]
        if db.query(TeamTemplate).filter(TeamTemplate.name == name).first():
            continue
        # Dedup por slugs canonicos (previne duplicata entre guias diferentes)
        if valid:
            canonical = tuple(sorted(valid))
            dup = None
            for et in db.query(TeamTemplate).all():
                if tuple(sorted(et.character_slugs or [])) == canonical:
                    dup = et
                    break
            if dup:
                warnings.append(f"[team] Duplicado (slugs={canonical}) — ja existe id={dup.id}")
                continue

        archetype = detect_archetype(valid)

        db.add(TeamTemplate(
            name=name,
            main_character=valid[0],
            archetype=archetype,
            character_slugs=valid,
            source="KQM",
            source_url=source_url,
        ))
        imported += 1
    return imported


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("input", type=Path)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--create-team", action="store_true",
                    help="Cria 1 Team customizado por guia (o mais canônico)")
    args = ap.parse_args()

    db = SessionLocal()
    warnings = []
    builds, teams = 0, 0

    for f in sorted(args.input.glob("*-build.json")):
        try:
            if import_build(db, json.loads(f.read_text(encoding="utf-8")), warnings):
                builds += 1
        except Exception as e:
            warnings.append(f"[{f.name}] {e}")

    for f in sorted(args.input.glob("*-teams.json")):
        slug = f.stem.replace("-teams", "")
        try:
            teams += import_teams(
                db, json.loads(f.read_text(encoding="utf-8")),
                f"https://keqingmains.com/{slug}/", warnings,
            )
        except Exception as e:
            warnings.append(f"[{f.name}] {e}")

    custom_teams = 0
    if args.create_team:
        # Coleta teams_json por slug
        teams_by_slug = {}
        for f in sorted(args.input.glob("*-teams.json")):
            slug = f.stem.replace("-teams", "")
            try:
                teams_by_slug[slug] = json.loads(f.read_text(encoding="utf-8"))
            except Exception:
                teams_by_slug[slug] = []

        # Cria 1 Team por build
        for f in sorted(args.input.glob("*-build.json")):
            slug = f.stem.replace("-build", "")
            try:
                data = json.loads(f.read_text(encoding="utf-8"))
                char = resolve_character(db, slug)
                if not char:
                    warnings.append(f"[team-custom] {slug}: character não encontrado")
                    continue
                raw_bd = data["build"]["build_data"]
                source_url = f"https://keqingmains.com/{slug}/"
                if create_team_from_build(
                    db, char, raw_bd, teams_by_slug.get(slug, []), source_url, warnings,
                ):
                    custom_teams += 1
            except Exception as e:
                warnings.append(f"[{f.name}] team-custom: {e}")

    if args.dry_run:
        db.rollback()
        print("🔎 DRY RUN — nada foi salvo")
    else:
        db.commit()
        print("✅ Salvo no banco")

    suffix = f" · Teams customizados: {custom_teams}" if args.create_team else ""
    print(f"   Builds: {builds} · Times: {teams}{suffix}")
    if warnings:
        print(f"   ⚠️  {len(warnings)} aviso(s):")
        for w in warnings[:15]:
            print(f"     - {w}")
    db.close()


if __name__ == "__main__":
    main()
