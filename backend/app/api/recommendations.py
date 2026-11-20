"""API de recomendações (Pull Advisor)."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Language
from ..schemas.pull_advisor import PullAdvisorRequest, PullAdvisorResponse
from ..services.pull_advisor import build_pull_advisor_response
from .deps import get_language

router = APIRouter(prefix="/recommendations", tags=["recommendations"])


@router.post("/pulls", response_model=PullAdvisorResponse)
def recommend_pulls(
    payload: PullAdvisorRequest,
    lang: Language = Depends(get_language),
    db: Session = Depends(get_db),
) -> PullAdvisorResponse:
    result = build_pull_advisor_response(
        db=db,
        lang=lang,
        owned_slugs=payload.owned_slugs,
        goal=payload.goal,
        rarity_filter=payload.rarity_filter,
        element_filter=payload.element_filter,
        target_slug=payload.target_slug,
        limit=payload.limit,
    )
    return PullAdvisorResponse(**result)
