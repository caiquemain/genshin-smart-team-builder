from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import (
    Character,
    CharacterAscensionMaterial,
    CharacterAscensionPhase,
    Material,
    MaterialTranslation,
    Language,
)
from ..schemas.ascension import (
    AscensionCostResponse,
    AscensionMaterialOut,
    AscensionPhaseOut,
)
from .deps import get_language

router = APIRouter(prefix="/characters", tags=["ascension"])

UNLOCK_LEVELS = [20, 40, 50, 60, 70, 80, 90]


def phases_needed(from_level: int, to_level: int) -> list[int]:
    if from_level >= to_level:
        return []
    included = []
    for n in range(1, 7):
        if from_level < UNLOCK_LEVELS[n] and to_level > UNLOCK_LEVELS[n - 1]:
            included.append(n)
    return included


@router.get("/{slug}/ascension", response_model=AscensionCostResponse)
def get_ascension_cost(
    slug: str,
    from_level: int = Query(default=1, ge=1, le=90),
    to_level: int = Query(default=90, ge=1, le=90),
    lang: Language = Depends(get_language),
    db: Session = Depends(get_db),
) -> AscensionCostResponse:
    char = db.query(Character).filter(Character.slug == slug).one_or_none()
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
    if from_level >= to_level:
        raise HTTPException(status_code=400, detail="from_level must be < to_level")

    needed = phases_needed(from_level, to_level)
    if not needed:
        return AscensionCostResponse(
            slug=slug, from_level=from_level, to_level=to_level,
            phases_included=[], total_mora=0, materials=[], phases=[],
        )

    # Materiais
    rows = (
        db.query(CharacterAscensionMaterial, Material)
        .join(Material, Material.id == CharacterAscensionMaterial.material_id)
        .filter(
            CharacterAscensionMaterial.character_id == char.id,
            CharacterAscensionMaterial.phase.in_(needed),
        )
        .all()
    )

    # Fases (mora por fase)
    phase_rows = (
        db.query(CharacterAscensionPhase)
        .filter(
            CharacterAscensionPhase.character_id == char.id,
            CharacterAscensionPhase.phase.in_(needed),
        )
        .order_by(CharacterAscensionPhase.phase)
        .all()
    )
    phase_mora = {p.phase: p.mora for p in phase_rows}
    total_mora = sum(phase_mora.values())

    # Traduções
    material_ids = {mat.id for _, mat in rows}
    trans_map: dict[int, str] = {}
    if lang != Language.EN and material_ids:
        for t in (
            db.query(MaterialTranslation)
            .filter(
                MaterialTranslation.material_id.in_(material_ids),
                MaterialTranslation.language == lang,
            )
            .all()
        ):
            trans_map[t.material_id] = t.name

    by_phase: dict[int, list[AscensionMaterialOut]] = {n: [] for n in needed}
    agg: dict[int, AscensionMaterialOut] = {}

    for cam, mat in rows:
        display = trans_map.get(mat.id, mat.name)
        category = mat.category.value if hasattr(mat.category, "value") else str(mat.category)
        item = AscensionMaterialOut(
            slug=mat.slug, name=display, icon=mat.icon,
            category=category, rarity=mat.rarity, quantity=cam.quantity,
        )
        by_phase[cam.phase].append(item)
        if mat.id in agg:
            agg[mat.id].quantity += cam.quantity
        else:
            agg[mat.id] = AscensionMaterialOut(
                slug=mat.slug, name=display, icon=mat.icon,
                category=category, rarity=mat.rarity, quantity=cam.quantity,
            )

    phases_out = [
        AscensionPhaseOut(
            phase=n,
            unlock_max_level=UNLOCK_LEVELS[n],
            mora=phase_mora.get(n, 0),
            materials=by_phase[n],
        )
        for n in needed
    ]

    return AscensionCostResponse(
        slug=slug,
        from_level=from_level,
        to_level=to_level,
        phases_included=needed,
        total_mora=total_mora,
        materials=sorted(agg.values(), key=lambda m: (-(m.rarity or 0), m.name)),
        phases=phases_out,
    )
