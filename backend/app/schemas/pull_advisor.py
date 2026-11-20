"""Schemas do Pull Advisor ("Quem vale a pena pegar na minha conta?")."""
from typing import Literal, Optional
from pydantic import BaseModel, Field


PullGoal = Literal["meta", "unlock_teams", "endgame", "imaginarium"]
PullVerdict = Literal["must_pull", "high_value", "good_option", "situational"]


class PullAdvisorRequest(BaseModel):
    owned_slugs: list[str] = Field(default_factory=list)
    goal: PullGoal = "meta"
    rarity_filter: Optional[int] = Field(default=None, ge=4, le=5)
    element_filter: Optional[str] = None
    target_slug: Optional[str] = None
    limit: int = Field(default=20, ge=1, le=60)


class UnlockedTeamOut(BaseModel):
    id: int
    name: str
    archetype: str
    character_slugs: list[str]
    source: Optional[str] = None
    sources_count: int = 1
    team_avg_score: float = 0.0


class PullBreakdownOut(BaseModel):
    general_meta: float
    team_unlocks: float
    account_gaps: float
    endgame_seasonal: float


class PullCandidateOut(BaseModel):
    slug: str
    name: str
    icon: Optional[str] = None
    rarity: int
    element: str
    weapon_type: str
    role: str
    already_owned: bool = False

    score: float
    verdict: PullVerdict
    verdict_label: str
    breakdown: PullBreakdownOut

    # Tiers separados (Consenso Geral vs Endgame Sazonal 30d)
    general_tier: Optional[str] = None
    general_avg: Optional[float] = None
    general_sites: int = 0
    abyss_tier: Optional[str] = None
    stygian_tier: Optional[str] = None

    # Impacto direto na conta
    unlocked_teams_count: int = 0
    near_unlock_teams_count: int = 0
    unlocked_teams: list[UnlockedTeamOut] = Field(default_factory=list)
    synergy_partners_owned: list[str] = Field(default_factory=list)
    reasons: list[str] = Field(default_factory=list)


class AccountSummaryOut(BaseModel):
    owned_count: int
    ready_teams_count: int
    almost_ready_teams_count: int
    total_templates: int
    element_counts: dict[str, int]
    weak_elements: list[str]
    missing_capabilities: list[str]


class PullAdvisorResponse(BaseModel):
    goal: PullGoal
    account_summary: AccountSummaryOut
    target_evaluation: Optional[PullCandidateOut] = None
    recommendations: list[PullCandidateOut]
