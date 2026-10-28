from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str
    service: str


class EnumsResponse(BaseModel):
    elements: list[str]
    weapon_types: list[str]
    regions: list[str]
    languages: list[str]


class Pagination(BaseModel):
    total: int
    limit: int = Field(ge=1, le=200)
    offset: int = Field(ge=0)
