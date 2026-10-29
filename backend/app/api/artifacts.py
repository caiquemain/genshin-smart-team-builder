from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import ArtifactSet, ArtifactSetTranslation, Language
from ..schemas.artifact import (
    ArtifactSetSummary,
    ArtifactSetDetail,
    ArtifactSetListResponse,
)
from .deps import get_language

router = APIRouter(prefix="/artifacts", tags=["artifacts"])


def _resolve_name_and_bonuses(
    db: Session, art: ArtifactSet, lang: Language
) -> tuple[str, str | None, str | None]:
    if lang == Language.EN:
        return art.name, art.two_piece_bonus, art.four_piece_bonus
    trans = (
        db.query(ArtifactSetTranslation)
        .filter(
            ArtifactSetTranslation.artifact_set_id == art.id,
            ArtifactSetTranslation.language == lang,
        )
        .one_or_none()
    )
    if trans:
        return (
            trans.name,
            trans.two_piece_bonus or art.two_piece_bonus,
            trans.four_piece_bonus or art.four_piece_bonus,
        )
    return art.name, art.two_piece_bonus, art.four_piece_bonus


@router.get("", response_model=ArtifactSetListResponse)
def list_artifacts(
    rarity: int | None = Query(default=None, ge=3, le=5),
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    lang: Language = Depends(get_language),
    db: Session = Depends(get_db),
) -> ArtifactSetListResponse:
    q = db.query(ArtifactSet)
    if rarity:
        q = q.filter(ArtifactSet.rarity_max >= rarity)
    total = q.count()
    rows = q.order_by(ArtifactSet.name).offset(offset).limit(limit).all()

    items = []
    for a in rows:
        name, two_pc, four_pc = _resolve_name_and_bonuses(db, a, lang)
        items.append(ArtifactSetSummary(
            slug=a.slug, name=name, icon=a.icon, rarity_max=a.rarity_max,
            two_piece_bonus=two_pc, four_piece_bonus=four_pc,
        ))

    return ArtifactSetListResponse(
        language=lang.value,
        pagination={"total": total, "limit": limit, "offset": offset},
        items=items,
    )


@router.get("/{slug}", response_model=ArtifactSetDetail)
def get_artifact(
    slug: str,
    lang: Language = Depends(get_language),
    db: Session = Depends(get_db),
) -> ArtifactSetDetail:
    art = db.query(ArtifactSet).filter(ArtifactSet.slug == slug).one_or_none()
    if not art:
        raise HTTPException(status_code=404, detail="Artifact set not found")
    name, two_pc, four_pc = _resolve_name_and_bonuses(db, art, lang)
    return ArtifactSetDetail(
        slug=art.slug,
        name=name,
        icon=art.icon,
        rarity_max=art.rarity_max,
        level_list=art.level_list,
        two_piece_bonus=two_pc,
        four_piece_bonus=four_pc,
        pieces=art.pieces,
        source=art.source,
    )
