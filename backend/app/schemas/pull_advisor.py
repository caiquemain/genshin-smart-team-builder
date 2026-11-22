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
    missing_dps_elements: list[str] = Field(default_factory=list)
    missing_capabilities: list[str]


class PullAdvisorResponse(BaseModel):
    goal: PullGoal
    account_summary: AccountSummaryOut
    target_evaluation: Optional[PullCandidateOut] = None
    recommendations: list[PullCandidateOut]


# ============================================================
# Upgrade Advisor ("Quem upar até o Lv.90 e quais talentos?")
# ============================================================

UpgradeGoal = Literal["overall", "endgame", "teams", "quick_wins"]
UpgradeVerdict = Literal["priority_now", "high_impact", "good_upgrade", "already_built"]
UpgradeStageFilter = Literal["needs_work", "needs_90", "needs_talents", "built", "all"]


class OwnedCharProgressIn(BaseModel):
    slug: str
    level: Optional[int] = Field(default=None, ge=1, le=90)
    cons: Optional[int] = Field(default=None, ge=0, le=6)
    na: Optional[int] = Field(default=None, ge=1, le=15)
    es: Optional[int] = Field(default=None, ge=1, le=15)
    eb: Optional[int] = Field(default=None, ge=1, le=15)


class UpgradeAdvisorRequest(BaseModel):
    owned_slugs: list[str] = Field(default_factory=list)
    characters_progress: list[OwnedCharProgressIn] = Field(default_factory=list)
    goal: UpgradeGoal = "overall"
    stage_filter: UpgradeStageFilter = "needs_work"
    rarity_filter: Optional[int] = Field(default=None, ge=4, le=5)
    element_filter: Optional[str] = None
    limit: int = Field(default=30, ge=1, le=100)


class TalentTargetOut(BaseModel):
    key: Literal["na", "es", "eb"]
    label: str
    priority: int
    current: Optional[int] = None
    recommended: int
    needs_upgrade: bool


class UpgradeBreakdownOut(BaseModel):
    meta_value: float
    team_usage: float
    upgrade_gain: float
    endgame_seasonal: float


class UpgradeCandidateOut(BaseModel):
    slug: str
    name: str
    icon: Optional[str] = None
    rarity: int
    element: str
    weapon_type: str
    role: str

    score: float
    verdict: UpgradeVerdict
    verdict_label: str
    breakdown: UpgradeBreakdownOut

    general_tier: Optional[str] = None
    general_avg: Optional[float] = None
    general_sites: int = 0
    abyss_tier: Optional[str] = None
    stygian_tier: Optional[str] = None

    has_progress_data: bool = False
    current_level: Optional[int] = None
    cons: Optional[int] = None
    recommended_level: int = 90
    recommended_level_label: str = "Lv. 90"
    needs_level_90: bool = True
    level_scaling_tag: str = ""
    level_gap: int = 0

    talent_priority_text: Optional[str] = None
    talents: list[TalentTargetOut] = Field(default_factory=list)
    talent_levels_needed: int = 0
    already_built: bool = False

    ready_teams_count: int = 0
    ready_teams: list[UnlockedTeamOut] = Field(default_factory=list)
    reasons: list[str] = Field(default_factory=list)


class UpgradeSummaryOut(BaseModel):
    owned_count: int
    with_progress_count: int
    needs_upgrade_count: int
    needs_90_count: int
    needs_talents_count: int
    built_count: int


class UpgradeAdvisorResponse(BaseModel):
    goal: UpgradeGoal
    summary: UpgradeSummaryOut
    recommendations: list[UpgradeCandidateOut]


# ============================================================
# Artifact Domain & Strongbox Advisor ("Artefatos & Domínios")
# ============================================================

ArtifactFocus = Literal["all", "planner", "top_meta"]
ArtifactDomainStrategy = Literal["farm_domain", "strongbox", "situational"]
ArtifactAuditStatus = Literal["built", "partial", "needs_farm"]


class EquippedArtifactSummaryIn(BaseModel):
    slug: str
    active_4pc_slug: Optional[str] = None
    active_2pc_slugs: list[str] = Field(default_factory=list)
    pieces_count: int = 0
    avg_level: float = 0.0
    five_star_count: int = 0
    crit_value: float = 0.0


class ArtifactAdvisorRequest(BaseModel):
    owned_slugs: list[str] = Field(default_factory=list)
    planner_slugs: list[str] = Field(default_factory=list)
    equipped_artifacts: list[EquippedArtifactSummaryIn] = Field(default_factory=list)
    focus: ArtifactFocus = "all"
    limit: int = Field(default=20, ge=1, le=50)


class ArtifactUserCharOut(BaseModel):
    slug: str
    name: str
    icon: Optional[str] = None
    element: str
    rarity: int
    tier: Optional[str] = None
    is_bis: bool = False
    is_in_planner: bool = False
    usage_label: str = "4pc"
    artifact_status: Optional[ArtifactAuditStatus] = None
    crit_value: Optional[float] = None
    equipped_note: Optional[str] = None


class ArtifactSetDemandOut(BaseModel):
    slug: str
    name: str
    icon: Optional[str] = None
    in_strongbox: bool = True
    demand_score: float = 0.0
    bis_count: int = 0
    total_users: int = 0
    users: list[ArtifactUserCharOut] = Field(default_factory=list)


class ArtifactDomainRecommendationOut(BaseModel):
    domain_id: str
    domain_name: str
    region: str
    is_boss_only: bool = False
    score: float
    efficiency_pct: int
    strategy: ArtifactDomainStrategy
    strategy_label: str
    usable_sets_count: int
    unique_characters_count: int
    bis_characters_count: int
    sets: list[ArtifactSetDemandOut] = Field(default_factory=list)
    reasons: list[str] = Field(default_factory=list)


class StrongboxTargetOut(BaseModel):
    slug: str
    name: str
    icon: Optional[str] = None
    domain_name: str
    score: float
    bis_count: int
    total_users: int
    why: str
    users: list[ArtifactUserCharOut] = Field(default_factory=list)


class ArtifactAdvisorSummaryOut(BaseModel):
    evaluated_characters: int
    domains_matched: int
    best_domain_name: Optional[str] = None
    best_strongbox_name: Optional[str] = None
    planner_characters_matched: int = 0
    audited_characters: int = 0
    already_built_characters: int = 0


class ArtifactAdvisorResponse(BaseModel):
    focus: ArtifactFocus
    summary: ArtifactAdvisorSummaryOut
    domains: list[ArtifactDomainRecommendationOut]
    strongbox_targets: list[StrongboxTargetOut]
