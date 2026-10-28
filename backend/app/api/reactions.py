from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import ElementalReaction
from ..schemas.reaction import ReactionListResponse, ReactionRead

router = APIRouter(prefix="/reactions", tags=["reactions"])


@router.get("", response_model=ReactionListResponse)
def list_reactions(db: Session = Depends(get_db)) -> ReactionListResponse:
    rows = db.query(ElementalReaction).order_by(ElementalReaction.name).all()
    items = [
        ReactionRead(
            slug=r.slug,
            name=r.name,
            elements=r.elements,
            effect=r.effect,
            multiplier=r.multiplier,
        )
        for r in rows
    ]
    return ReactionListResponse(items=items)
