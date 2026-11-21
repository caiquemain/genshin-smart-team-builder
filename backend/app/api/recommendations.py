"""API de recomendações (Pull Advisor)."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Language
from ..schemas.pull_advisor import (
    ArtifactAdvisorRequest,
    ArtifactAdvisorResponse,
    PullAdvisorRequest,
    PullAdvisorResponse,
    UpgradeAdvisorRequest,
    UpgradeAdvisorResponse,
)
from ..services.artifact_advisor import build_artifact_advisor_response
from ..services.pull_advisor import build_pull_advisor_response
from ..services.upgrade_advisor import build_upgrade_advisor_response
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


@router.post("/upgrades", response_model=UpgradeAdvisorResponse)
def recommend_upgrades(
    payload: UpgradeAdvisorRequest,
    lang: Language = Depends(get_language),
    db: Session = Depends(get_db),
) -> UpgradeAdvisorResponse:
    result = build_upgrade_advisor_response(
        db=db,
        lang=lang,
        owned_slugs=payload.owned_slugs,
        characters_progress=[p.model_dump() for p in payload.characters_progress],
        goal=payload.goal,
        stage_filter=payload.stage_filter,
        rarity_filter=payload.rarity_filter,
        element_filter=payload.element_filter,
        limit=payload.limit,
    )
    return UpgradeAdvisorResponse(**result)


@router.post("/artifacts", response_model=ArtifactAdvisorResponse)
def recommend_artifacts(
    payload: ArtifactAdvisorRequest,
    lang: Language = Depends(get_language),
    db: Session = Depends(get_db),
) -> ArtifactAdvisorResponse:
    result = build_artifact_advisor_response(
        db=db,
        lang=lang,
        owned_slugs=payload.owned_slugs,
        planner_slugs=payload.planner_slugs,
        focus=payload.focus,
        limit=payload.limit,
    )
    return ArtifactAdvisorResponse(**result)
