from pydantic import BaseModel, ConfigDict


class ArtifactSetSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    slug: str
    name: str
    icon: str | None = None
    rarity_max: int
    two_piece_bonus: str | None = None
    four_piece_bonus: str | None = None


class ArtifactSetDetail(ArtifactSetSummary):
    level_list: list[int] | None = None
    two_piece_bonus: str | None = None
    four_piece_bonus: str | None = None
    pieces: dict | None = None
    source: str | None = None


class ArtifactSetListResponse(BaseModel):
    language: str
    pagination: dict
    items: list[ArtifactSetSummary]
