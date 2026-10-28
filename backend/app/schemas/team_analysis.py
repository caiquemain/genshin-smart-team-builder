from pydantic import BaseModel


class TeamMemberRole(BaseModel):
    slug: str
    name: str
    icon: str | None = None
    element: str
    role: str  # dps, sub, support, healer, shielder


class TeamReactionOut(BaseModel):
    slug: str
    name: str
    effect: str | None = None


class TeamSuggestionOut(BaseModel):
    slug: str
    name: str
    icon: str | None = None
    element: str | None = None
    reason: str


class ScoreBreakdown(BaseModel):
    factor: str
    delta: int


class TeamAnalysisRequest(BaseModel):
    character_slugs: list[str]


class TeamAnalysisResponse(BaseModel):
    score: int
    roles: list[TeamMemberRole]
    reactions: list[TeamReactionOut]
    warnings: list[str]
    suggestions: list[TeamSuggestionOut]
    breakdown: list[ScoreBreakdown]
