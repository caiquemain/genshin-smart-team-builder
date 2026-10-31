from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..models import (
    Character, CharacterConstellation, CharacterTalent, CharacterPassive,
    Element, WeaponType, Language, CharacterBuildPreset,
    CharacterTalentTranslation, CharacterPassiveTranslation, CharacterConstellationTranslation,
)
from ..schemas.character import (
    CharacterDetail, CharacterListResponse, CharacterSummary,
    ConstellationOut, TalentOut, PassiveOut,
)
from ..schemas.common import Pagination
from ..services.i18n import resolve_character
from .deps import get_language
from ..models import TalentType

router = APIRouter(prefix="/characters", tags=["characters"])


@router.get("", response_model=CharacterListResponse)
def list_characters(
    element: Element | None = Query(default=None),
    weapon_type: WeaponType | None = Query(default=None),
    rarity: int | None = Query(default=None, ge=1, le=5),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    lang: Language = Depends(get_language),
    db: Session = Depends(get_db),
) -> CharacterListResponse:
    q = db.query(Character)
    if element:
        q = q.filter(Character.element == element)
    if weapon_type:
        q = q.filter(Character.weapon_type == weapon_type)
    if rarity:
        q = q.filter(Character.rarity == rarity)
    total = q.count()
    rows = q.order_by(Character.name).offset(offset).limit(limit).all()

    items = []
    for char in rows:
        data = resolve_character(db, char, lang)
        items.append(CharacterSummary(
            slug=char.slug, name=data["name"], icon=char.icon,
            rarity=char.rarity, element=char.element,
            weapon_type=char.weapon_type, region=char.region,
        ))

    return CharacterListResponse(
        language=lang.value,
        pagination=Pagination(total=total, limit=limit, offset=offset),
        items=items,
    )


def _pick_translation(obj, lang: Language):
    if lang == Language.EN:
        return obj
    for t in obj.translations:
        if t.language == lang:
            return t
    return obj


@router.get("/{slug}", response_model=CharacterDetail)
def get_character(
    slug: str,
    lang: Language = Depends(get_language),
    db: Session = Depends(get_db),
) -> CharacterDetail:
    char = db.query(Character).filter(Character.slug == slug).one_or_none()
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
    data = resolve_character(db, char, lang)

    consts = (
        db.query(CharacterConstellation)
        .options(joinedload(CharacterConstellation.translations))
        .filter(CharacterConstellation.character_id == char.id)
        .order_by(CharacterConstellation.level)
        .all()
    )
    talents = (
        db.query(CharacterTalent)
        .options(joinedload(CharacterTalent.translations))
        .filter(CharacterTalent.character_id == char.id)
        .all()
    )
    order = {TalentType.NORMAL_ATTACK: 0, TalentType.ELEMENTAL_SKILL: 1, TalentType.ELEMENTAL_BURST: 2}
    talents.sort(key=lambda t: order.get(t.talent_type, 99))
    passives = (
        db.query(CharacterPassive)
        .options(joinedload(CharacterPassive.translations))
        .filter(CharacterPassive.character_id == char.id)
        .all()
    )

    return CharacterDetail(
        slug=char.slug, name=data["name"], icon=char.icon,
        title=data["title"], description=data["description"],
        constellation_name=data["constellation_name"],
        rarity=char.rarity, element=char.element, weapon_type=char.weapon_type,
        region=char.region, birthday=char.birthday,
        base_hp=char.base_hp, base_atk=char.base_atk, base_def=char.base_def,
        max_hp=char.max_hp, max_atk=char.max_atk, max_def=char.max_def,
        ascension_stat=char.ascension_stat,
        ascension_stat_value=char.ascension_stat_value,
        release_date=char.release_date, voice_actors=char.voice_actors,
        constellations=[
            ConstellationOut(
                level=c.level,
                name=_pick_translation(c, lang).name,
                description=_pick_translation(c, lang).description,
                icon=c.icon,
            ) for c in consts
        ],
        talents=[
            TalentOut(
                talent_type=t.talent_type,
                name=_pick_translation(t, lang).name,
                description=_pick_translation(t, lang).description,
                icon=t.icon, scalings=t.scalings,
            ) for t in talents
        ],
        passives=[
            PassiveOut(
                name=_pick_translation(p, lang).name,
                description=_pick_translation(p, lang).description,
                icon=p.icon, kind=p.kind,
                linked_constellations=p.linked_constellations,
            ) for p in passives
        ],
    )


@router.get("/{slug}/build")
def get_character_build(slug: str, db: Session = Depends(get_db)):
    char = db.query(Character).filter(Character.slug == slug).one_or_none()
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
    preset = db.query(CharacterBuildPreset).filter(CharacterBuildPreset.character_id == char.id).first()
    if not preset:
        return None
    return {"name": preset.name, "build_data": preset.build_data}
