from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import CharacterBuildPreset, Character, CharacterTranslation, Team, TeamCharacter, TeamTemplate, Language
from ..schemas.team import (
    TeamCreate, TeamDetail, TeamMemberOut, TeamListResponse,
    TeamMembersUpdate, TeamTierInfo, TeamTierChar, TeamPreviewTierPayload,
)
from ..schemas.build import CharacterBuild, TeamBuildsUpdate, Substitute
from ..schemas.character import CharacterSummary
from ..services.i18n import resolve_character
from ..services.guide_i18n import (
    apply_build_data_localization,
    apply_substitutes_localization,
    collect_build_data_texts,
    collect_substitutes_texts,
    fetch_translations_map,
)
from ..services.presets import has_build_content as _has_build_content, pick_best_preset, pick_best_presets_batch
from ..services.substitutes import compute_slot_substitutes_for_slugs
from ..services.synergy import analyze_team
from ..schemas.team_analysis import TeamAnalysisRequest, TeamAnalysisResponse
from .deps import get_language
from ..services.team_tier import fetch_char_tiers_batch, fetch_char_tiers_slugs, compute_team_tier

router = APIRouter(prefix="/teams", tags=["teams"])


def _build_details_batch(db: Session, teams: list[Team], lang: Language) -> list[TeamDetail]:
    """Monta TeamDetail para uma lista de times em ~5 queries (sem N+1)."""
    if not teams:
        return []

    team_ids = [t.id for t in teams]
    rows = (
        db.query(TeamCharacter, Character)
        .join(Character, Character.id == TeamCharacter.character_id)
        .filter(TeamCharacter.team_id.in_(team_ids))
        .order_by(TeamCharacter.team_id, TeamCharacter.position)
        .all()
    )

    members_by_team: dict[int, list[tuple[TeamCharacter, Character]]] = {}
    missing_char_ids: set[int] = set()
    all_char_ids: set[int] = set()
    for tc, char in rows:
        members_by_team.setdefault(tc.team_id, []).append((tc, char))
        all_char_ids.add(char.id)
        if not _has_build_content(tc.build_data):
            missing_char_ids.add(char.id)

    fallback_presets = pick_best_presets_batch(db, list(missing_char_ids))
    tier_map = fetch_char_tiers_batch(db, team_ids)

    name_by_char_id: dict[int, str] = {}
    if lang != Language.EN and all_char_ids:
        trans_rows = (
            db.query(CharacterTranslation.character_id, CharacterTranslation.name)
            .filter(
                CharacterTranslation.character_id.in_(list(all_char_ids)),
                CharacterTranslation.language == lang,
            )
            .all()
        )
        name_by_char_id = {cid: cname for cid, cname in trans_rows if cname}

    # Coleta textos de builds e substitutos para 1 único lookup no cache de traduções
    trans_map: dict[str, str] = {}
    if lang != Language.EN:
        texts_to_translate: list[str] = []
        for tc, char in rows:
            raw_bd = tc.build_data if _has_build_content(tc.build_data) else (
                fallback_presets[char.id].build_data if char.id in fallback_presets else None
            )
            texts_to_translate.extend(collect_build_data_texts(raw_bd))
            texts_to_translate.extend(collect_substitutes_texts(tc.substitutes))
        trans_map = fetch_translations_map(db, texts_to_translate, lang)

    result: list[TeamDetail] = []
    for team in teams:
        member_out: list[TeamMemberOut] = []
        for tc, char in members_by_team.get(team.id, []):
            raw_build = tc.build_data if _has_build_content(tc.build_data) else (
                fallback_presets[char.id].build_data if char.id in fallback_presets else None
            )
            loc_build = apply_build_data_localization(raw_build, lang, trans_map)
            build = CharacterBuild(**loc_build) if loc_build else None
            loc_subs = apply_substitutes_localization(tc.substitutes or [], lang, trans_map)
            member_out.append(TeamMemberOut(
                position=tc.position,
                character=CharacterSummary(
                    slug=char.slug,
                    name=name_by_char_id.get(char.id, char.name),
                    icon=char.icon,
                    rarity=char.rarity,
                    element=char.element,
                    weapon_type=char.weapon_type,
                    region=char.region,
                ),
                build=build,
                substitutes=loc_subs,
            ))
        team_tier_data = tier_map.get(team.id)
        team_tier = (
            TeamTierInfo(
                tier=team_tier_data["tier"],
                value=team_tier_data["value"],
                filled=team_tier_data["filled"],
                missing=team_tier_data["missing"],
                char_tiers=[TeamTierChar(**c) for c in team_tier_data["char_tiers"]],
            )
            if team_tier_data else None
        )
        result.append(TeamDetail(
            id=team.id,
            name=team.name,
            description=team.description,
            author_name=team.author_name,
            is_public=team.is_public,
            members=member_out,
            team_tier=team_tier,
        ))
    return result


def _build_detail(db: Session, team: Team, lang: Language) -> TeamDetail:
    return _build_details_batch(db, [team], lang)[0]


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

    template_subs: dict[int, list[dict]] = {}
    if payload.auto_populate:
        if payload.template_id:
            tpl = db.query(TeamTemplate).filter(TeamTemplate.id == payload.template_id).one_or_none()
            if tpl and tpl.slot_substitutes:
                for k, v in tpl.slot_substitutes.items():
                    try:
                        template_subs[int(k)] = list(v)
                    except (TypeError, ValueError):
                        pass

        computed_subs = compute_slot_substitutes_for_slugs(
            db,
            payload.character_slugs,
            limit=6,
        )
    else:
        computed_subs = {}

    for i, slug in enumerate(payload.character_slugs, start=1):
        char = by_slug[slug]
        build_data = None
        substitutes: list[dict] = []
        if payload.auto_populate:
            preset = pick_best_preset(db, char.id)
            if preset and _has_build_content(preset.build_data):
                build_data = dict(preset.build_data)
            substitutes = template_subs.get(i) or computed_subs.get(i, [])

        db.add(TeamCharacter(
            team_id=team.id,
            character_id=char.id,
            position=i,
            build_data=build_data,
            substitutes=substitutes,
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
    return TeamListResponse(items=_build_details_batch(db, teams, lang))


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
                preset = pick_best_preset(db, char.id)
                tc.build_data = dict(preset.build_data) if preset else None
            tc.position = pos
        else:
            # Cria um slot novo
            tc = TeamCharacter(team_id=team_id, character_id=char.id, position=pos)
            preset = pick_best_preset(db, char.id)
            if preset:
                tc.build_data = dict(preset.build_data)
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


# ============================================================
# TEAM TIER — preview (usado pelo TeamBuilderPage em tempo real)
# ============================================================

@router.post("/preview-tier", response_model=TeamTierInfo)
def preview_tier(
    payload: TeamPreviewTierPayload,
    db: Session = Depends(get_db),
) -> TeamTierInfo:
    """Preview do tier do time sem persistir (TeamBuilder antes de salvar)."""
    if not payload.character_slugs:
        return TeamTierInfo()
    data = fetch_char_tiers_slugs(db, payload.character_slugs)
    return TeamTierInfo(
        tier=data["tier"],
        value=data["value"],
        filled=data["filled"],
        missing=data["missing"],
        char_tiers=[TeamTierChar(**c) for c in data["char_tiers"]],
    )
