from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import CharacterBuildPreset, Character, Language
from ..schemas.build_preset import BuildPresetCreate, BuildPresetDetail
from ..services.guide_i18n import localize_build_data_batch
from .deps import get_language

router = APIRouter(prefix="/presets", tags=["presets"])

@router.get("/{character_slug}", response_model=list[BuildPresetDetail])
def list_presets(
    character_slug: str,
    lang: Language = Depends(get_language),
    db: Session = Depends(get_db),
):
    char = db.query(Character).filter(Character.slug == character_slug).first()
    if not char:
        raise HTTPException(404, "Character not found")
    presets = db.query(CharacterBuildPreset).filter(CharacterBuildPreset.character_id == char.id).all()
    localized_bds = localize_build_data_batch(db, [p.build_data for p in presets], lang)
    out = []
    for p, bd in zip(presets, localized_bds):
        detail = BuildPresetDetail.from_model(p)
        if bd is not None:
            detail.build_data = type(detail.build_data)(**bd)
        out.append(detail)
    return out

@router.post("", response_model=BuildPresetDetail)
def create_preset(payload: BuildPresetCreate, db: Session = Depends(get_db)):
    char = db.query(Character).filter(Character.slug == payload.character_slug).first()
    if not char: raise HTTPException(404, "Character not found")
    preset = CharacterBuildPreset(
        character_id=char.id,
        name=payload.name,
        build_data=payload.build_data.model_dump()
    )
    db.add(preset)
    db.commit()
    db.refresh(preset)
    return BuildPresetDetail.from_model(preset)

@router.delete("/{preset_id}", status_code=204)
def delete_preset(preset_id: int, db: Session = Depends(get_db)):
    preset = db.query(CharacterBuildPreset).filter(CharacterBuildPreset.id == preset_id).first()
    if not preset: raise HTTPException(404, "Preset not found")
    db.delete(preset)
    db.commit()
