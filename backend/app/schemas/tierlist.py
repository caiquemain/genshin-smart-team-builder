"""Schemas de tierlist."""
from pydantic import BaseModel, ConfigDict, Field


class TierlistEntryImport(BaseModel):
    character_slug: str
    role: str  # main-dps, sub-dps, support, healer, general
    tier: str  # label do tier (SS, S, T0.5...)
    source_url: str | None = None


class TierlistImportPayload(BaseModel):
    site_slug: str
    scale: list[str]  # ex: ["SS", "S", "A", "B", "C"]
    version: str | None = None
    entries: list[TierlistEntryImport] = Field(default_factory=list)


class TierlistSiteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    slug: str
    name: str
    url: str
    scale_size: int


class TierlistEntryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    site_slug: str
    tier_label: str
    normalized_value: float
    role: str
    version: str | None = None
    source_url: str | None = None


class AggregatedTier(BaseModel):
    character_slug: str
    role: str
    avg_score: float  # 0.0 - 1.0
    num_sites: int
    tier_consolidated: str  # "S", "A", "B"...
    entries: list[TierlistEntryOut] = Field(default_factory=list)


class TierlistResponse(BaseModel):
    role: str | None = None
    items: list[AggregatedTier] = Field(default_factory=list)


class CharacterTierlistResponse(BaseModel):
    character_slug: str
    roles: list[AggregatedTier] = Field(default_factory=list)
