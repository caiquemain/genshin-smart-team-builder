from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import CharacterBuildPreset,  Character, Team, TeamCharacter, Language
from ..schemas.team import TeamCreate, TeamDetail, TeamMemberOut, TeamListResponse, TeamMembersUpdate
from ..schemas.build import CharacterBuild, TeamBuildsUpdate, Substitute
from ..schemas.character import CharacterSummary
from ..services.i18n import resolve_character
from ..services.synergy import analyze_team
from ..schemas.team_analysis import TeamAnalysisRequest, TeamAnalysisResponse
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
        build = CharacterBuild(**tc.build_data) if tc.build_data else None
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
            build=build,
            substitutes=tc.substitutes or [],
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

@router.post("/analyze", response_model=TeamAnalysisResponse)
def analyze(
    payload: TeamAnalysisRequest,
    db: Session = Depends(get_db),
) -> TeamAnalysisResponse:
    result = analyze_team(db, payload.character_slugs)
    return TeamAnalysisResponse(**result)

@router.put("/{team_id}/builds", response_model=TeamDetail)
def update_team_builds(
    team_id: int,
    payload: TeamBuildsUpdate,
    lang: Language = Depends(get_language),
    db: Session = Depends(get_db),
) -> TeamDetail:
    team = db.query(Team).filter(Team.id == team_id).one_or_none()
    if not team:
        raise HTTPException(404, detail="Team not found")

    for position, build in payload.builds.items():
        tc = (
            db.query(TeamCharacter)
            .filter(
                TeamCharacter.team_id == team_id,
                TeamCharacter.position == position,
            )
            .one_or_none()
        )
        if tc:
            tc.build_data = build.model_dump() if build else None
            if position in payload.preset_ids:
                tc.preset_id = payload.preset_ids[position]
            else:
                tc.preset_id = None

    db.commit()
    db.refresh(team)
    return _build_detail(db, team, lang)


@router.put("/{team_id}/members", response_model=TeamDetail)
def update_team_members(
    team_id: int,
    payload: TeamMembersUpdate,
    lang: Language = Depends(get_language),
    db: Session = Depends(get_db),
) -> TeamDetail:
    team = db.query(Team).filter(Team.id == team_id).one_or_none()
    if not team:
        raise HTTPException(404, detail="Team not found")

    # Move todas as posições atuais pra valores temporários negativos (segurança da constraint)
    current_by_pos = {tc.position: tc for tc in team.members}
    for tc in team.members:
        tc.position = -abs(tc.position) - 100
    db.flush()

    # Reconstrói os slots baseado na lista de slugs
    for i, slug in enumerate(payload.character_slugs):
        pos = i + 1
        tc = current_by_pos.get(pos)
        char = db.query(Character).filter(Character.slug == slug).one_or_none()
        if not char:
            raise HTTPException(404, detail=f"Character {slug} not found")

        if tc:
            # O slot já existe. Apenas trocamos o personagem e mantemos os substitutos!
            if tc.character_id != char.id:
                tc.character_id = char.id
                preset = db.query(CharacterBuildPreset).filter(CharacterBuildPreset.character_id == char.id).first()
                tc.build_data = preset.build_data if preset else None
            tc.position = pos
        else:
            # Cria um slot novo
            tc = TeamCharacter(team_id=team_id, character_id=char.id, position=pos)
            preset = db.query(CharacterBuildPreset).filter(CharacterBuildPreset.character_id == char.id).first()
            if preset:
                tc.build_data = preset.build_data
            db.add(tc)

    # Deleta slots que sobraram se a lista for menor que o time atual
    for pos, tc in current_by_pos.items():
        if pos > len(payload.character_slugs):
            db.delete(tc)

    db.commit()
    db.refresh(team)
    return _build_detail(db, team, lang)


@router.put("/{team_id}/slots/{position}/substitutes", response_model=TeamDetail)
def update_slot_substitutes(
    team_id: int,
    position: int,
    payload: list[Substitute],
    lang: Language = Depends(get_language),
    db: Session = Depends(get_db),
) -> TeamDetail:
    tc = (
        db.query(TeamCharacter)
        .filter(TeamCharacter.team_id == team_id, TeamCharacter.position == position)
        .one_or_none()
    )
    if not tc:
        raise HTTPException(404, detail="Slot not found")
    
    tc.substitutes = [s.model_dump() for s in payload]
    db.commit()
    db.refresh(tc.team)
    return _build_detail(db, tc.team, lang)
