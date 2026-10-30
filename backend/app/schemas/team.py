from typing import Optional
from pydantic import BaseModel, Field
from .character import CharacterSummary
from .build import CharacterBuild, Substitute


class TeamCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=150)
    description: str | None = None
    author_name: str | None = Field(default=None, max_length=100)
    character_slugs: list[str] = Field(..., min_length=1, max_length=4)


class TeamMemberOut(BaseModel):
    position: int
    character: CharacterSummary
    build: CharacterBuild | None = None
    substitutes: list[Substitute] = []


class TeamTierChar(BaseModel):
    slug: str
    name: str
    tier: Optional[str] = None
    value: Optional[int] = None


class TeamTierInfo(BaseModel):
    tier: Optional[str] = None
    value: float = 0.0
    filled: int = 0
    missing: int = 0
    char_tiers: list[TeamTierChar] = []


class TeamPreviewTierPayload(BaseModel):
    character_slugs: list[str]


class TeamDetail(BaseModel):
    id: int
    name: str
    description: str | None = None
    author_name: str | None = None
    is_public: bool = True
    members: list[TeamMemberOut]


    team_tier: Optional[TeamTierInfo] = None
class TeamListResponse(BaseModel):
    items: list[TeamDetail]


class TeamMembersUpdate(BaseModel):
    character_slugs: list[str]
