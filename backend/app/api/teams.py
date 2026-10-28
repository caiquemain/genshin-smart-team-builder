from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Character, Team, TeamCharacter, Language
from ..schemas.team import TeamCreate, TeamDetail, TeamMemberOut, TeamListResponse
from ..schemas.character import CharacterSummary
from ..services.i18n import resolve_character
from .deps import get_language

router = APIRouter(prefix="/teams", tags=["teams"])


def _build_detail(db: Session, team: Team, lang: Language) -> TeamDetail:
    members = (
        db.query(TeamCharacter, Character)
        .join(Character, Character.id == TeamCharacter.character_id)
        .filter(TeamCharacter.team_id == team.id)
        .order_by(TeamCharacter.position)
        .all()
    )
    member_out = []
    for tc, char in members:
        data = resolve_character(db, char, lang)
        member_out.append(TeamMemberOut(
            position=tc.position,
            character=CharacterSummary(
                slug=char.slug,
                name=data["name"],
                icon=char.icon,
                rarity=char.rarity,
                element=char.element,
                weapon_type=char.weapon_type,
                region=char.region,
            ),
        ))
    return TeamDetail(
        id=team.id,
        name=team.name,
        description=team.description,
        author_name=team.author_name,
        is_public=team.is_public,
        members=member_out,
    )


@router.post("", response_model=TeamDetail, status_code=status.HTTP_201_CREATED)
def create_team(
    payload: TeamCreate,
    lang: Language = Depends(get_language),
    db: Session = Depends(get_db),
) -> TeamDetail:
    if len(set(payload.character_slugs)) != len(payload.character_slugs):
        raise HTTPException(400, detail="Personagens duplicados no time")

    chars = (
        db.query(Character)
        .filter(Character.slug.in_(payload.character_slugs))
        .all()
    )
    if len(chars) != len(payload.character_slugs):
        found = {c.slug for c in chars}
        missing = [s for s in payload.character_slugs if s not in found]
        raise HTTPException(404, detail=f"Personagens não encontrados: {missing}")

    by_slug = {c.slug: c for c in chars}
    team = Team(
        name=payload.name,
        description=payload.description,
        author_name=payload.author_name,
        is_public=True,
    )
    db.add(team)
    db.flush()

    for i, slug in enumerate(payload.character_slugs, start=1):
        db.add(TeamCharacter(
            team_id=team.id,
            character_id=by_slug[slug].id,
            position=i,
        ))
    db.commit()
    db.refresh(team)
    return _build_detail(db, team, lang)


@router.get("", response_model=TeamListResponse)
def list_teams(
    lang: Language = Depends(get_language),
    db: Session = Depends(get_db),
) -> TeamListResponse:
    teams = db.query(Team).order_by(Team.id.desc()).all()
    return TeamListResponse(items=[_build_detail(db, t, lang) for t in teams])


@router.get("/{team_id}", response_model=TeamDetail)
def get_team(
    team_id: int,
    lang: Language = Depends(get_language),
    db: Session = Depends(get_db),
) -> TeamDetail:
    team = db.query(Team).filter(Team.id == team_id).one_or_none()
    if not team:
        raise HTTPException(404, detail="Time não encontrado")
    return _build_detail(db, team, lang)


@router.delete("/{team_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_team(team_id: int, db: Session = Depends(get_db)) -> None:
    team = db.query(Team).filter(Team.id == team_id).one_or_none()
    if not team:
        raise HTTPException(404, detail="Time não encontrado")
    db.delete(team)
    db.commit()
