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

from sqlalchemy import func
from app.database import SessionLocal
from app.models import (
    Character, Weapon, ArtifactSet,
    CharacterBuildPreset, TeamTemplate,
)
# Aliases para corrigir nomes "sujos" do KQM
CHAR_ALIASES = {
    "charlottel": "charlotte",
    "charlottell": "charlotte",
    "hutao": "hu-tao",
    "kaedeharakazuha": "kaedehara-kazuha",
    "kamisatoayaka": "kamisato-ayaka",
    "kamisatoayato": "kamisato-ayato",
    "kujousara": "kujou-sara",
    "kukishinobu": "kuki-shinobu",
    "raidenshogun": "raiden-shogun",
    "sangonomiyakokomi": "sangonomiya-kokomi",
    "shikanoinheizou": "shikanoin-heizou",
    "aratakiitto": "arataki-itto",
    "yaemiko": "yae-miko",
    "yumemizukimizuki": "yumemizuki-mizuki",
}

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



def resolve_weapon(db, slug, name):
    w = db.query(Weapon).filter(Weapon.slug == slug).first()
    if w: return w
    return db.query(Weapon).filter(func.lower(Weapon.name) == name.lower()).first()


def resolve_artifact(db, slug, name):
    a = db.query(ArtifactSet).filter(ArtifactSet.slug == slug).first()
    if a: return a
    return db.query(ArtifactSet).filter(func.lower(ArtifactSet.name) == name.lower()).first()


def resolve_character(db, slug):
    return db.query(Character).filter(Character.slug == slug).first()


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
                "weapon_refinement": 1,
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
        # Normaliza slugs via aliases ANTES de tentar resolver
        normalized = [normalize_slug(s) for s in t["character_slugs"]]
        valid = [s for s in normalized if resolve_character(db, s)]
        for s in normalized:
            if s not in valid:
                warnings.append(f"[team] Personagem não encontrado: {s}")
        if len(valid) < 3:
            continue

        name = t["raw_line"][:150]
        if db.query(TeamTemplate).filter(TeamTemplate.name == name).first():
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

    if args.dry_run:
        db.rollback()
        print("🔎 DRY RUN — nada foi salvo")
    else:
        db.commit()
        print("✅ Salvo no banco")

    print(f"   Builds: {builds} · Times: {teams}")
    if warnings:
        print(f"   ⚠️  {len(warnings)} aviso(s):")
        for w in warnings[:15]:
            print(f"     - {w}")
    db.close()


if __name__ == "__main__":
    main()
