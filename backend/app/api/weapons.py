from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Weapon, WeaponTranslation, WeaponType, Language, Material, MaterialTranslation, WeaponAscensionMaterial, WeaponAscensionPhase
from ..schemas.weapon import (
    WeaponSummary,
    WeaponDetail,
    WeaponListResponse,
    WeaponAscensionResponse,
)
from ..schemas.ascension import AscensionMaterialOut, AscensionPhaseOut
from .deps import get_language

router = APIRouter(prefix="/weapons", tags=["weapons"])

UNLOCK_LEVELS = [20, 40, 50, 60, 70, 80, 90]


def _resolve_translation(
    db: Session, weapon: Weapon, lang: Language
) -> tuple[str, str | None, str | None, str | None]:
    if lang == Language.EN:
        return weapon.name, weapon.description, weapon.passive_name, weapon.passive_description
    trans = (
        db.query(WeaponTranslation)
        .filter(
            WeaponTranslation.weapon_id == weapon.id,
            WeaponTranslation.language == lang,
        )
        .one_or_none()
    )
    if trans:
        return (
            trans.name,
            trans.description or weapon.description,
            trans.passive_name or weapon.passive_name,
            trans.passive_description or weapon.passive_description,
        )
    return weapon.name, weapon.description, weapon.passive_name, weapon.passive_description


def _phases_needed(from_level: int, to_level: int) -> list[int]:
    if from_level >= to_level:
        return []
    included = []
    for n in range(1, 7):
        if from_level < UNLOCK_LEVELS[n] and to_level > UNLOCK_LEVELS[n - 1]:
            included.append(n)
    return included


@router.get("", response_model=WeaponListResponse)
def list_weapons(
    weapon_type: WeaponType | None = Query(default=None),
    rarity: int | None = Query(default=None, ge=1, le=5),
    limit: int = Query(default=300, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    lang: Language = Depends(get_language),
    db: Session = Depends(get_db),
) -> WeaponListResponse:
    q = db.query(Weapon)
    if weapon_type:
        q = q.filter(Weapon.weapon_type == weapon_type)
    if rarity:
        q = q.filter(Weapon.rarity == rarity)
    total = q.count()
    rows = q.order_by(Weapon.name).offset(offset).limit(limit).all()

    items = []
    for w in rows:
        name, _, passive_name, _ = _resolve_translation(db, w, lang)
        passive_r5 = None
        if w.passive_levels and "4" in w.passive_levels:
            passive_r5 = w.passive_levels["4"]
        items.append(WeaponSummary(
            slug=w.slug,
            name=name,
            icon=w.icon,
            rarity=w.rarity,
            weapon_type=w.weapon_type,
            base_atk=w.base_atk,
            max_base_atk=w.max_base_atk,
            secondary_stat=w.secondary_stat,
            secondary_stat_value=w.secondary_stat_value,
            max_secondary_stat_value=w.max_secondary_stat_value,
            passive_name=passive_name,
            passive_description_r5=passive_r5,
        ))

    return WeaponListResponse(
        language=lang.value,
        pagination={"total": total, "limit": limit, "offset": offset},
        items=items,
    )


@router.get("/{slug}", response_model=WeaponDetail)
def get_weapon(
    slug: str,
    lang: Language = Depends(get_language),
    db: Session = Depends(get_db),
) -> WeaponDetail:
    w = db.query(Weapon).filter(Weapon.slug == slug).one_or_none()
    if not w:
        raise HTTPException(status_code=404, detail="Weapon not found")
    name, desc, p_name, p_desc = _resolve_translation(db, w, lang)
    return WeaponDetail(
        slug=w.slug,
        name=name,
        icon=w.icon,
        rarity=w.rarity,
        weapon_type=w.weapon_type,
        base_atk=w.base_atk,
        max_base_atk=w.max_base_atk,
        secondary_stat=w.secondary_stat,
        secondary_stat_value=w.secondary_stat_value,
        max_secondary_stat_value=w.max_secondary_stat_value,
        description=desc,
        passive_name=p_name,
        passive_description=p_desc,
        passive_levels=w.passive_levels,
    )


@router.get("/{slug}/ascension", response_model=WeaponAscensionResponse)
def get_weapon_ascension(
    slug: str,
    from_level: int = Query(default=1, ge=1, le=90),
    to_level: int = Query(default=90, ge=1, le=90),
    lang: Language = Depends(get_language),
    db: Session = Depends(get_db),
) -> WeaponAscensionResponse:
    w = db.query(Weapon).filter(Weapon.slug == slug).one_or_none()
    if not w:
        raise HTTPException(status_code=404, detail="Weapon not found")
    if from_level >= to_level:
        raise HTTPException(status_code=400, detail="from_level must be < to_level")

    needed = _phases_needed(from_level, to_level)
    if not needed:
        return WeaponAscensionResponse(
            slug=slug, from_level=from_level, to_level=to_level,
            phases_included=[], total_mora=0, materials=[], phases=[],
        )

    # Materiais
    rows = (
        db.query(WeaponAscensionMaterial, Material)
        .join(Material, Material.id == WeaponAscensionMaterial.material_id)
        .filter(
            WeaponAscensionMaterial.weapon_id == w.id,
            WeaponAscensionMaterial.phase.in_(needed),
        )
        .all()
    )

    # Fases (mora)
    phase_rows = (
        db.query(WeaponAscensionPhase)
        .filter(
            WeaponAscensionPhase.weapon_id == w.id,
            WeaponAscensionPhase.phase.in_(needed),
        )
        .order_by(WeaponAscensionPhase.phase)
        .all()
    )
    phase_mora = {p.phase: p.mora for p in phase_rows}
    total_mora = sum(phase_mora.values())

    # Traduções
    material_ids = {mat.id for _, mat in rows}
    trans_map: dict[int, tuple[str, str | None, str | None]] = {}
    if lang != Language.EN and material_ids:
        for t in (
            db.query(MaterialTranslation)
            .filter(
                MaterialTranslation.material_id.in_(material_ids),
                MaterialTranslation.language == lang,
            )
            .all()
        ):
            trans_map[t.material_id] = (t.name, t.description, t.source)

    def build_item(mat, qty):
        trans = trans_map.get(mat.id)
        if trans:
            n, d, s = trans
            d = d or mat.description
            s = s or mat.source
        else:
            n, d, s = mat.name, mat.description, mat.source
        cat = mat.category.value if hasattr(mat.category, "value") else str(mat.category)
        return AscensionMaterialOut(
            slug=mat.slug, name=n, icon=mat.icon, category=cat,
            rarity=mat.rarity, quantity=qty, description=d, source=s,
        )

    by_phase: dict[int, list[AscensionMaterialOut]] = {n: [] for n in needed}
    agg: dict[int, AscensionMaterialOut] = {}
    for wam, mat in rows:
        item = build_item(mat, wam.quantity)
        by_phase[wam.phase].append(item)
        if mat.id in agg:
            agg[mat.id].quantity += wam.quantity
        else:
            agg[mat.id] = build_item(mat, wam.quantity)

    phases_out = [
        AscensionPhaseOut(
            phase=n, unlock_max_level=UNLOCK_LEVELS[n],
            mora=phase_mora.get(n, 0), materials=by_phase[n],
        )
        for n in needed
    ]

    return WeaponAscensionResponse(
        slug=slug, from_level=from_level, to_level=to_level,
        phases_included=needed, total_mora=total_mora,
        materials=sorted(agg.values(), key=lambda m: (-(m.rarity or 0), m.name)),
        phases=phases_out,
    )
