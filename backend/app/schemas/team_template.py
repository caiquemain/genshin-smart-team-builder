from pydantic import BaseModel, ConfigDict
from .build import Substitute
from .team_analysis import TeamAnalysisResponse


class TeamTemplateSource(BaseModel):
    source: str
    url: str | None = None


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
    sources: list[TeamTemplateSource] = []


class TeamTemplateDetail(TeamTemplateSummary):
    artifact_set_slug: str | None = None
    weapon_slug: str | None = None
    notes: str | None = None
    analysis: TeamAnalysisResponse | None = None
    slot_substitutes: dict[int, list[Substitute]] = {}


class TeamTemplateListResponse(BaseModel):
    items: list[TeamTemplateSummary]


class ArchetypeCount(BaseModel):
    archetype: str
    count: int


class ArchetypesResponse(BaseModel):
    items: list[ArchetypeCount]
