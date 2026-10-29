from pydantic import BaseModel, ConfigDict
from .team_analysis import TeamAnalysisResponse


class TeamTemplateSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    main_character: str
    archetype: str
    description: str | None = None
    character_slugs: list[str]
    source: str | None = None
    source_url: str | None = None


class TeamTemplateDetail(TeamTemplateSummary):
    artifact_set_slug: str | None = None
    weapon_slug: str | None = None
    notes: str | None = None
    analysis: TeamAnalysisResponse | None = None


class TeamTemplateListResponse(BaseModel):
    items: list[TeamTemplateSummary]


class ArchetypeCount(BaseModel):
    archetype: str
    count: int


class ArchetypesResponse(BaseModel):
    items: list[ArchetypeCount]
