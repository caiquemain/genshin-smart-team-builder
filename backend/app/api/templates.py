from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import TeamTemplate
from ..schemas.build import Substitute
from ..schemas.team_template import (
    TeamTemplateSource,
    TeamTemplateSummary,
    TeamTemplateDetail,
    TeamTemplateListResponse,
    ArchetypeCount,
    ArchetypesResponse,
)
from ..schemas.team_analysis import TeamAnalysisResponse
from ..services.substitutes import compute_slot_substitutes_for_slugs
from ..services.synergy import analyze_team

router = APIRouter(prefix="/teams/templates", tags=["templates"])


def _resolve_sources(t: TeamTemplate) -> list[TeamTemplateSource]:
    raw = t.sources or []
    if raw:
        return [
            TeamTemplateSource(
                source=s.get("source") or "KQM",
                url=s.get("url"),
            )
            for s in raw
            if isinstance(s, dict)
        ]
    if t.source:
        return [TeamTemplateSource(source=t.source, url=t.source_url)]
    return []


def _resolve_slot_substitutes(t: TeamTemplate) -> dict[int, list[Substitute]]:
    stored = t.slot_substitutes or {}
    parsed_stored: dict[int, list[Substitute]] = {}
    for k, items in stored.items():
        try:
            pos = int(k)
        except (TypeError, ValueError):
            continue
        if isinstance(items, list) and items:
            parsed_stored[pos] = [Substitute(**s) for s in items if isinstance(s, dict)]
    return parsed_stored


@router.get("/archetypes", response_model=ArchetypesResponse)
def list_archetypes(db: Session = Depends(get_db)) -> ArchetypesResponse:
    from sqlalchemy import func
    rows = (
        db.query(TeamTemplate.archetype, func.count(TeamTemplate.id))
        .group_by(TeamTemplate.archetype)
        .order_by(func.count(TeamTemplate.id).desc())
        .all()
    )
    return ArchetypesResponse(
        items=[ArchetypeCount(archetype=a, count=c) for a, c in rows],
    )


@router.get("", response_model=TeamTemplateListResponse)
def list_templates(
    archetype: str | None = Query(default=None),
    main_character: str | None = Query(default=None),
    character_slug: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> TeamTemplateListResponse:
    q = db.query(TeamTemplate)
    if archetype:
        q = q.filter(TeamTemplate.archetype == archetype)
    if main_character:
        q = q.filter(TeamTemplate.main_character == main_character)
    if character_slug:
        # character_slugs é JSONB; filter por containment
        q = q.filter(TeamTemplate.character_slugs.contains([character_slug]))
    rows = q.order_by(TeamTemplate.archetype, TeamTemplate.name).all()
    items = [
        TeamTemplateSummary(
            id=r.id,
            name=r.name,
            main_character=r.main_character,
            archetype=r.archetype,
            description=r.description,
            character_slugs=list(r.character_slugs or []),
            source=r.source,
            source_url=r.source_url,
            sources=_resolve_sources(r),
        )
        for r in rows
    ]
    return TeamTemplateListResponse(items=items)


@router.get("/{template_id}", response_model=TeamTemplateDetail)
def get_template(
    template_id: int,
    include_analysis: bool = Query(default=True),
    db: Session = Depends(get_db),
) -> TeamTemplateDetail:
    t = db.query(TeamTemplate).filter(TeamTemplate.id == template_id).one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")

    analysis = None
    if include_analysis:
        result = analyze_team(db, list(t.character_slugs))
        analysis = TeamAnalysisResponse(**result)

    return TeamTemplateDetail(
        id=t.id,
        name=t.name,
        main_character=t.main_character,
        archetype=t.archetype,
        description=t.description,
        character_slugs=list(t.character_slugs),
        artifact_set_slug=t.artifact_set_slug,
        weapon_slug=t.weapon_slug,
        notes=t.notes,
        source=t.source,
        source_url=t.source_url,
        sources=_resolve_sources(t),
        analysis=analysis,
        slot_substitutes=_resolve_slot_substitutes(t),
    )
