#!/usr/bin/env python3
"""
enrich_substitutes.py - Preenche TeamCharacter.substitutes por elemento.

Regras:
  - Slot 1 (main anchor do time) -> nunca ganha substitutes
  - DPS conhecido (DPS_SLUGS) -> nunca ganha substitutes (nao faz sentido trocar DPS por support)
  - Support/flex -> substitutes = mesmo elemento, NAO DPS, SUPPORT_SLUGS primeiro
  - Limite: 8 por slot
  - --skip-ids preserva times manuais (ex: id=4 do Skirk)
"""
import argparse
from app.database import SessionLocal
from app.models import Team, Character

# DPS verificados (main damage dealers) - NUNCA substituir
# Fonte: KQM guides + knowledge base dos personagens. Editavel.
DPS_SLUGS = {
    # Hydro DPS
    'neuvillette', 'mualani', 'ayato', 'kamisato-ayato',
    # Pyro DPS
    'arlecchino', 'hu-tao', 'hutao', 'yoimiya', 'lyney', 'klee',
    'diluc', 'gaming', 'mavuika', 'yanfei',
    # Cryo DPS
    'skirk', 'wriothesley', 'ganyu', 'ayaka', 'kamisato-ayaka',
    'eula', 'freminet',
    # Electro DPS
    'clorinde', 'cyno', 'sethos', 'razor',
    # Anemo DPS
    'xiao', 'wanderer', 'shikanoin-heizou',
    # Geo DPS
    'itto', 'arataki-itto', 'navia', 'ningguang',
    # Dendro DPS
    'alhaitham', 'tighnari', 'kinich',
    # Mixed/flex DPS
    'chasca', 'varesa',
}

# Supports/buffers/healers - priorizados como substitutes
SUPPORT_SLUGS = {
    # Top tier buffers
    'bennett', 'kazuha', 'kaedehara-kazuha', 'furina',
    # Hydro supports
    'xingqiu', 'yelan', 'kokomi', 'sangonomiya-kokomi', 'mona', 'candace',
    # Cryo supports
    'layla', 'rosaria', 'charlotte', 'mika', 'diona',
    # Anemo supports
    'jean', 'sucrose', 'venti', 'sayu', 'xianyun', 'faruzan', 'lynelle',
    # Electro supports
    'fischl', 'beidou', 'lisa', 'kuki-shinobu', 'shinobu', 'kujou-sara', 'sara',
    # Pyro supports
    'xiangling', 'thoma', 'yanfei',
    # Geo supports
    'zhongli', 'gorou', 'albedo', 'chiori', 'yun-jin', 'yunjin',
    # Dendro supports
    'yaoyao', 'baizhu', 'kirara', 'collei', 'kaveh',
    # Other
    'nilou', 'lanyan',
}


def _is_dps(char):
    """DPS via hardcoded list."""
    return char.slug in DPS_SLUGS


def _find_subs_for_char(db, char, limit=8, exclude_slugs: set[str] | None = None):
    """Retorna substitutes (mesmo elemento, NAO DPS, exclui membros do time, SUPPORT primeiro)."""
    from app.services.substitutes import format_capability_label

    excluded = (exclude_slugs or set()) | {char.slug}
    candidates = db.query(Character).filter(
        Character.element == char.element,
        Character.id != char.id,
    ).all()

    # Exclui DPS e personagens que já estão no time
    candidates = [c for c in candidates if not _is_dps(c) and c.slug not in excluded]

    # Ordena: SUPPORT_SLUGS primeiro, depois alfabetico
    candidates.sort(key=lambda c: (0 if c.slug in SUPPORT_SLUGS else 1, c.name))

    out = []
    for c in candidates[:limit]:
        el = c.element.value.capitalize() if hasattr(c.element, 'value') else str(c.element).capitalize()
        label = format_capability_label(c.slug, c)
        out.append({
            "character_slug": c.slug,
            "build_label": label,
            "notes": f"Alternativa {el} ({label})",
        })
    return out


def enrich_team(db, team, warnings):
    """Preenche substitutes dos TeamCharacters do team. Retorna count."""
    count = 0
    resolved_members: list[tuple] = []
    for tc in team.members:
        c = db.query(Character).filter(Character.id == tc.character_id).first()
        if not c:
            warnings.append(f"[team {team.id}] char {tc.character_id} nao encontrado")
            continue
        resolved_members.append((tc, c))

    team_slugs = {c.slug for _, c in resolved_members}

    for tc, c in resolved_members:
        # Slot 1 (main) ou DPS: limpa substitutes
        if tc.position == 1 or _is_dps(c):
            tc.substitutes = []
            continue

        tc.substitutes = _find_subs_for_char(db, c, limit=8, exclude_slugs=team_slugs)
        count += len(tc.substitutes)

    return count


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--team-ids", type=str, help="Ex: 6,8,10,11")
    ap.add_argument("--skip-ids", type=str, help="Times a preservar (ex: 4)")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    db = SessionLocal()
    warnings = []
    total = 0
    processed = 0

    query = db.query(Team)
    if args.team_ids:
        ids = [int(x.strip()) for x in args.team_ids.split(",")]
        query = query.filter(Team.id.in_(ids))
    elif args.skip_ids:
        skips = [int(x.strip()) for x in args.skip_ids.split(",")]
        query = query.filter(Team.id.notin_(skips))

    for team in query.order_by(Team.id).all():
        n = enrich_team(db, team, warnings)
        total += n
        processed += 1
        print(f"  id={team.id} | {team.name!r}: {n} subs")

    if args.dry_run:
        db.rollback()
        print(f"\nDRY RUN - {processed} teams, {total} subs (nao salvos)")
    else:
        db.commit()
        print(f"\nOK - {processed} teams, {total} subs gerados")

    if warnings:
        print(f"\n{len(warnings)} avisos:")
        for w in warnings[:10]:
            print(f"  {w}")
    db.close()


if __name__ == "__main__":
    main()
