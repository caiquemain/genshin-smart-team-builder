"""
Exporta dados estáticos do Planner para JSON (consumido pelo frontend offline).

Uso:
    docker compose exec backend python -m app.scripts.export_planner_data
    docker compose exec backend python -m app.scripts.export_planner_data --limit 3
    docker compose exec backend python -m app.scripts.export_planner_data -o /tmp/out.json

Rodar SEMPRE que adicionar personagem/arma/material novo ao DB.
O arquivo é servido como asset estático (dev: frontend/public/, prod: Cloudflare Pages).
"""
import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.database import SessionLocal
from app.models.character import (
    Character,
    CharacterAscensionMaterial,
    CharacterTalentMaterial,
)
from app.models.weapon import Weapon, WeaponAscensionMaterial
from app.models.material import Material

LANGS = ('en', 'pt', 'es')


def _localized(row, field: str, langs=LANGS) -> dict:
    """{lang: value} a partir das traduções. Não inclui fallback canônico."""
    out = {}
    for t in row.translations:
        if t.language in langs:
            out[t.language] = getattr(t, field, None)
    return out


def _localized_with_en_fallback(row, field: str, canonical: str | None) -> dict:
    """
    Igual a _localized, mas preenche 'en' com o valor canônico da coluna
    se não houver tradução EN explícita (character.name / weapon.name são EN).
    """
    out = _localized(row, field)
    if 'en' not in out and canonical:
        out['en'] = canonical
    return out


def build_character(c: Character) -> dict:
    # Ascensão: agrupa materials por phase
    mats_by_phase: dict[int, list] = {}
    for m in c.ascension_materials:
        mats_by_phase.setdefault(m.phase, []).append(
            {'slug': m.material.slug, 'qty': m.quantity}
        )

    asc_phases = [
        {
            'phase': p.phase,
            'max_level': p.unlock_max_level,
            'mora': p.mora,
            'materials': mats_by_phase.get(p.phase, []),
        }
        for p in c.ascension_phases
    ]

    # Talentos: CharacterTalentPhase (level+mora) e CharacterTalentMaterial (level+mats)
    # são tabelas distintas, casadas por (talent_type, level).
    mats_by_talent: dict[tuple, list] = {}
    for tm in c.talent_materials:
        mats_by_talent.setdefault((tm.talent_type, tm.level), []).append(
            {'slug': tm.material.slug, 'qty': tm.quantity}
        )

    talent_phases: dict[str, list] = {}
    for tp in c.talent_phases:
        talent_phases.setdefault(tp.talent_type, []).append({
            'level': tp.level,
            'mora': tp.mora,
            'materials': mats_by_talent.get((tp.talent_type, tp.level), []),
        })
    for k in talent_phases:
        talent_phases[k].sort(key=lambda x: x['level'])

    return {
        'name': _localized_with_en_fallback(c, 'name', c.name),
        'icon': c.icon,
        'element': c.element,
        'weapon_type': c.weapon_type,
        'rarity': c.rarity,
        'region': c.region,
        'ascension_phases': asc_phases,
        'talent_phases': talent_phases,
    }


def build_weapon(w: Weapon) -> dict:
    mats_by_phase: dict[int, list] = {}
    for m in w.ascension_materials:
        mats_by_phase.setdefault(m.phase, []).append(
            {'slug': m.material.slug, 'qty': m.quantity}
        )

    phases = [
        {
            'phase': p.phase,
            'max_level': p.unlock_max_level,
            'mora': p.mora,
            'materials': mats_by_phase.get(p.phase, []),
        }
        for p in w.ascension_phases
    ]

    return {
        'name': _localized_with_en_fallback(w, 'name', w.name),
        'icon': w.icon,
        'weapon_type': w.weapon_type,
        'rarity': w.rarity,
        'ascension_phases': phases,
    }


def build_material(m: Material) -> dict:
    # Material tem fallback canônico pra name/description/source (todos EN).
    return {
        'name': _localized_with_en_fallback(m, 'name', m.name),
        'icon': m.icon,
        'rarity': m.rarity,
        'category': m.category,
        'description': _localized_with_en_fallback(m, 'description', m.description),
        'source': _localized_with_en_fallback(m, 'source', m.source),
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--output', '-o', default='frontend/public/planner-data.json')
    ap.add_argument('--limit', type=int, default=0,
                    help='Limita N chars/weapons (0 = todos). Teste com 3 primeiro.')
    args = ap.parse_args()

    db: Session = SessionLocal()
    try:
        char_q = select(Character).options(
            selectinload(Character.translations),
            selectinload(Character.ascension_phases),
            selectinload(Character.ascension_materials).selectinload(CharacterAscensionMaterial.material),
            selectinload(Character.talent_phases),
            selectinload(Character.talent_materials).selectinload(CharacterTalentMaterial.material),
        )
        if args.limit:
            char_q = char_q.limit(args.limit)
        chars = db.scalars(char_q).all()
        print(f'  chars: {len(chars)} carregados', file=sys.stderr)

        weapon_q = select(Weapon).options(
            selectinload(Weapon.translations),
            selectinload(Weapon.ascension_phases),
            selectinload(Weapon.ascension_materials).selectinload(WeaponAscensionMaterial.material),
        )
        if args.limit:
            weapon_q = weapon_q.limit(args.limit)
        weapons = db.scalars(weapon_q).all()
        print(f'  weapons: {len(weapons)} carregadas', file=sys.stderr)

        materials = db.scalars(
            select(Material).options(selectinload(Material.translations))
        ).all()
        print(f'  materials: {len(materials)} carregados', file=sys.stderr)
    finally:
        db.close()

    payload = {
        'version': datetime.now(timezone.utc).isoformat(),
        'characters': {c.slug: build_character(c) for c in chars},
        'weapons': {w.slug: build_weapon(w) for w in weapons},
        'materials': {m.slug: build_material(m) for m in materials},
    }

    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(',', ':')),
        encoding='utf-8',
    )

    size_kb = out.stat().st_size / 1024
    print(f'✓ {len(chars)} characters, {len(weapons)} weapons, {len(materials)} materials')
    print(f'✓ {out} ({size_kb:.1f} KB)')

    # Sanity checks — falha "barulhenta" se algo ficou vazio
    empty_chars = [c.slug for c in chars if not c.ascension_phases]
    if empty_chars:
        print(
            f'⚠ {len(empty_chars)} chars sem ascension_phases: '
            f'{empty_chars[:8]}{"..." if len(empty_chars) > 8 else ""}',
            file=sys.stderr,
        )

    empty_weapons = [w.slug for w in weapons if not w.ascension_phases]
    if empty_weapons:
        print(
            f'⚠ {len(empty_weapons)} weapons sem ascension_phases: '
            f'{empty_weapons[:8]}{"..." if len(empty_weapons) > 8 else ""}',
            file=sys.stderr,
        )

    return 0


if __name__ == '__main__':
    sys.exit(main())