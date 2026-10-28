from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import (
    Character,
    CharacterTalentPhase,
    CharacterTalentMaterial,
    Material,
    MaterialTranslation,
    Language,
    TalentType,
)
from ..schemas.talent import TalentCostResponse, TalentPath
from ..schemas.ascension import AscensionMaterialOut
from .deps import get_language

router = APIRouter(prefix="/characters", tags=["talents"])

TALENT_KEYS = {
    TalentType.NORMAL_ATTACK: "normal_attack",
    TalentType.ELEMENTAL_SKILL: "elemental_skill",
    TalentType.ELEMENTAL_BURST: "elemental_burst",
}


def levels_needed(from_level: int, target: int) -> list[int]:
    """Níveis que precisam ser comprados para ir de from_level até target."""
    if from_level >= target:
        return []
    return list(range(from_level + 1, target + 1))


@router.get("/{slug}/talents", response_model=TalentCostResponse)
def get_talent_cost(
    slug: str,
    na: int = Query(default=1, ge=1, le=10, description="Nível atual do Normal Attack"),
    es: int = Query(default=1, ge=1, le=10, description="Nível atual do Elemental Skill"),
    eb: int = Query(default=1, ge=1, le=10, description="Nível atual do Elemental Burst"),
    target: int = Query(default=10, ge=2, le=10, description="Nível alvo (comum aos três)"),
    lang: Language = Depends(get_language),
    db: Session = Depends(get_db),
) -> TalentCostResponse:
    char = db.query(Character).filter(Character.slug == slug).one_or_none()
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")

    current_by_type = {
        TalentType.NORMAL_ATTACK: na,
        TalentType.ELEMENTAL_SKILL: es,
        TalentType.ELEMENTAL_BURST: eb,
    }

    talents: dict[str, TalentPath] = {}
    grand_mats: dict[int, AscensionMaterialOut] = {}
    grand_mora = 0

    for ttype, key in TALENT_KEYS.items():
        cur = current_by_type[ttype]
        needed = levels_needed(cur, target)
        if not needed:
            talents[key] = TalentPath(
                from_level=cur, target_level=target,
                levels_included=[], total_mora=0, materials=[],
            )
            continue

        # Fases (mora)
        phase_rows = (
            db.query(CharacterTalentPhase)
            .filter(
                CharacterTalentPhase.character_id == char.id,
                CharacterTalentPhase.talent_type == ttype,
                CharacterTalentPhase.level.in_(needed),
            )
            .all()
        )
        mora = sum(p.mora for p in phase_rows)

        # Materiais
        mat_rows = (
            db.query(CharacterTalentMaterial, Material)
            .join(Material, Material.id == CharacterTalentMaterial.material_id)
            .filter(
                CharacterTalentMaterial.character_id == char.id,
                CharacterTalentMaterial.talent_type == ttype,
                CharacterTalentMaterial.level.in_(needed),
            )
            .all()
        )

        # Traduções
        material_ids = {mat.id for _, mat in mat_rows}
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
                name, desc, src = trans
                desc = desc or mat.description
                src = src or mat.source
            else:
                name, desc, src = mat.name, mat.description, mat.source
            category = mat.category.value if hasattr(mat.category, "value") else str(mat.category)
            return AscensionMaterialOut(
                slug=mat.slug, name=name, icon=mat.icon,
                category=category, rarity=mat.rarity, quantity=qty,
                description=desc, source=src,
            )

        agg: dict[int, AscensionMaterialOut] = {}
        for ctm, mat in mat_rows:
            if mat.id in agg:
                agg[mat.id].quantity += ctm.quantity
            else:
                agg[mat.id] = build_item(mat, ctm.quantity)

        talents[key] = TalentPath(
            from_level=cur, target_level=target,
            levels_included=needed, total_mora=mora,
            materials=sorted(agg.values(), key=lambda m: (-(m.rarity or 0), m.name)),
        )
        grand_mora += mora

        # Acumula grand total
        for ctm, mat in mat_rows:
            if mat.id in grand_mats:
                grand_mats[mat.id].quantity += ctm.quantity
            else:
                grand_mats[mat.id] = build_item(mat, ctm.quantity)

    return TalentCostResponse(
        slug=slug,
        talents=talents,
        grand_total_mora=grand_mora,
        grand_total_materials=sorted(
            grand_mats.values(), key=lambda m: (-(m.rarity or 0), m.name),
        ),
    )
