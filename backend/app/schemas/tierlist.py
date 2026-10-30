"""Schemas de tierlist."""
from typing import Optional
from pydantic import BaseModel, Field


class TierlistEntryImport(BaseModel):
    character_slug: str
    role: str
    tier: str
    source_url: Optional[str] = None


class TierlistImportPayload(BaseModel):
    site_slug: str
    scale: list[str]
    version: str
    entries: list[TierlistEntryImport]


class TierlistSiteOut(BaseModel):
    slug: str
    name: str
    url: str
    scale_size: int

    class Config:
        from_attributes = True


class TierlistEntryOut(BaseModel):
    site_slug: str
    tier_label: str
    tier_master: Optional[str] = None
    normalized_value: float
    role: str
    version: Optional[str]
    source_url: Optional[str]


class AggregatedTier(BaseModel):
    character_slug: str
    dominant_role: str
    consensus_tier: str
    consensus_votes: int
    tier_by_avg: str
    avg_score: float
    spread: float
    tiers_voted: list[str]
    num_sites: int
    entries: list[TierlistEntryOut]


class TierlistResponse(BaseModel):
    role: Optional[str] = None
    items: list[AggregatedTier]


class CharacterTierlistResponse(BaseModel):
    character_slug: str
    roles: list[AggregatedTier]
