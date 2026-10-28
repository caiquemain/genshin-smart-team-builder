from pydantic import BaseModel, Field
from .character import CharacterSummary


class TeamCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=150)
    description: str | None = None
    author_name: str | None = Field(default=None, max_length=100)
    character_slugs: list[str] = Field(..., min_length=1, max_length=4)


class TeamMemberOut(BaseModel):
    position: int
    character: CharacterSummary


class TeamDetail(BaseModel):
    id: int
    name: str
    description: str | None = None
    author_name: str | None = None
    is_public: bool = True
    members: list[TeamMemberOut]


class TeamListResponse(BaseModel):
    items: list[TeamDetail]
