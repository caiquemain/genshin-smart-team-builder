from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import CharacterBuildPreset, Character
from ..schemas.build_preset import BuildPresetCreate, BuildPresetDetail

router = APIRouter(prefix="/presets", tags=["presets"])

@router.get("/{character_slug}", response_model=list[BuildPresetDetail])
def list_presets(character_slug: str, db: Session = Depends(get_db)):
    char = db.query(Character).filter(Character.slug == character_slug).first()
    if not char: raise HTTPException(404, "Character not found")
    presets = db.query(CharacterBuildPreset).filter(CharacterBuildPreset.character_id == char.id).all()
    return [BuildPresetDetail.from_model(p) for p in presets]

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
