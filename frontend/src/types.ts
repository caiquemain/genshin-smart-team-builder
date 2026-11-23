export type Element = 'pyro' | 'hydro' | 'electro' | 'cryo' | 'anemo' | 'geo' | 'dendro'
export type WeaponType = 'sword' | 'claymore' | 'polearm' | 'bow' | 'catalyst'
export type Region =
  | 'mondstadt' | 'liyue' | 'inazuma' | 'sumeru'
  | 'fontaine' | 'natlan' | 'snezhnaya' | 'other'
export type StatType =
  | 'hp' | 'atk' | 'def' | 'hp_pct' | 'atk_pct' | 'def_pct'
  | 'em' | 'er' | 'crit_rate' | 'crit_dmg' | 'healing_bonus'
  | 'physical_dmg' | 'pyro_dmg' | 'hydro_dmg' | 'electro_dmg'
  | 'cryo_dmg' | 'anemo_dmg' | 'geo_dmg' | 'dendro_dmg'
export type LanguageCode =
  | 'pt' | 'en' | 'es' | 'fr' | 'de' | 'jp' | 'kr' | 'chs' | 'cht' | 'ru'

export interface Enums {
  elements: Element[]
  weapon_types: WeaponType[]
  regions: Region[]
  languages: LanguageCode[]
}

export interface Pagination {
  total: number
  limit: number
  offset: number
}

export interface CharacterSummary {
  slug: string
  name: string
  icon: string | null
  rarity: number
  element: Element
  weapon_type: WeaponType
  region: Region | null
}

export interface CharacterListResponse {
  language: string
  pagination: Pagination
  items: CharacterSummary[]
}

export interface Constellation {
  level: number
  name: string
  description: string | null
  icon: string | null
}

export interface TalentScalings {
  [level: string]: { label: string; value: string }[]
}

export interface Talent {
  talent_type: 'normal_attack' | 'elemental_skill' | 'elemental_burst'
  name: string
  description: string | null
  icon: string | null
  scalings: TalentScalings | null
}

export interface Passive {
  name: string
  description: string | null
  icon: string | null
  kind: string
  linked_constellations: unknown
}

export interface CharacterDetail extends CharacterSummary {
  title: string | null
  description: string | null
  constellation_name: string | null
  birthday: string | null
  base_hp: number
  base_atk: number
  base_def: number
  max_hp: number
  max_atk: number
  max_def: number
  ascension_stat: StatType | null
  ascension_stat_value: number | null
  release_date: string | null
  voice_actors: Record<string, string> | null
  constellations: Constellation[]
  talents: Talent[]
  passives: Passive[]
}

export interface AscensionMaterial {
  slug: string
  name: string
  icon: string | null
  category: string
  rarity: number | null
  quantity: number
  description: string | null
  source: string | null
}

export interface AscensionPhase {
  phase: number
  unlock_max_level: number
  mora: number
  materials: AscensionMaterial[]
}

export interface AscensionCost {
  slug: string
  from_level: number
  to_level: number
  phases_included: number[]
  total_mora: number
  materials: AscensionMaterial[]
  phases: AscensionPhase[]
}

export interface Reaction {
  slug: string
  name: string
  elements: string[]
  effect: string | null
  multiplier: number | null
  icon: string | null
}

export interface ReactionListResponse {
  items: Reaction[]
}

export interface TalentPath {
  from_level: number
  target_level: number
  levels_included: number[]
  total_mora: number
  materials: AscensionMaterial[]
}

export interface TalentCost {
  slug: string
  talents: {
    normal_attack: TalentPath
    elemental_skill: TalentPath
    elemental_burst: TalentPath
  }
  grand_total_mora: number
  grand_total_materials: AscensionMaterial[]
}

export interface TeamMember {
  position: number
  character: CharacterSummary
}

export interface TeamTierChar {
  slug: string
  name: string
  tier: string | null
  value: number | null
}

export interface TeamTierInfo {
  tier: string | null
  value: number
  filled: number
  missing: number
  char_tiers: TeamTierChar[]
}

export interface TeamDetail {
  id: number
  name: string
  description: string | null
  author_name: string | null
  is_public: boolean
  members: TeamMemberWithBuild[]
  team_tier: TeamTierInfo | null
}

export interface TeamListResponse {
  items: TeamDetail[]
}

export interface TeamCreate {
  name: string
  description?: string
  author_name?: string
  character_slugs: string[]
  template_id?: number
}

// === Weapons ===
export interface WeaponSummary {
  slug: string
  name: string
  icon: string | null
  rarity: number
  weapon_type: 'sword' | 'claymore' | 'polearm' | 'bow' | 'catalyst'
  base_atk: number
  max_base_atk: number | null
  secondary_stat: StatType | null
  secondary_stat_value: number | null
  max_secondary_stat_value: number | null
  passive_name: string | null
  passive_description_r5: string | null
  obtain_source?: string | null
}

export interface WeaponDetail extends WeaponSummary {
  description: string | null
  passive_name: string | null
  passive_description: string | null
  passive_levels: Record<string, string> | null
}

export interface WeaponListResponse {
  language: string
  pagination: { total: number; limit: number; offset: number }
  items: WeaponSummary[]
}

export interface WeaponAscensionResponse {
  slug: string
  from_level: number
  to_level: number
  phases_included: number[]
  total_mora: number
  materials: AscensionMaterial[]
  phases: AscensionPhase[]
}

// === Team Analysis ===
export interface TeamMemberRole {
  slug: string
  name: string
  icon: string | null
  element: Element
  role: 'dps' | 'sub' | 'support' | 'healer' | 'shielder'
}

export interface TeamReaction {
  slug: string
  name: string
  effect: string | null
}

export interface TeamSuggestion {
  slug: string
  name: string
  icon: string | null
  element: Element | null
  reason: string
}

export interface ScoreBreakdown {
  factor: string
  delta: number
}

export interface TeamAnalysisResponse {
  score: number
  roles: TeamMemberRole[]
  reactions: TeamReaction[]
  warnings: string[]
  suggestions: TeamSuggestion[]
  breakdown: ScoreBreakdown[]
}

// === Artifacts ===
export interface ArtifactSetSummary {
  slug: string
  name: string
  icon: string | null
  rarity_max: number
  two_piece_bonus: string | null
  four_piece_bonus: string | null
}

export interface ArtifactPieceSlot {
  id: number
  name: string
  description: string | null
  maxLevel: number
  icon: string | null
}

export interface ArtifactSetDetail extends ArtifactSetSummary {
  level_list: number[] | null
  two_piece_bonus: string | null
  four_piece_bonus: string | null
  pieces: Record<string, ArtifactPieceSlot> | null
  source: string | null
}

export interface ArtifactSetListResponse {
  language: string
  pagination: { total: number; limit: number; offset: number }
  items: ArtifactSetSummary[]
}

// === Team Templates (Multi-Source) ===
export interface TeamTemplateSource {
  source: string
  url: string | null
}

export interface TeamTemplateSummary {
  id: number
  name: string
  main_character: string
  archetype: string
  description: string | null
  character_slugs: string[]
  source: string | null
  source_url: string | null
  sources?: TeamTemplateSource[]
}

export interface TeamTemplateDetail extends TeamTemplateSummary {
  artifact_set_slug: string | null
  weapon_slug: string | null
  notes: string | null
  analysis: TeamAnalysisResponse | null
  slot_substitutes?: Record<string, Substitute[]>
}

export interface TeamTemplateListResponse {
  items: TeamTemplateSummary[]
}

export interface ArchetypeCount {
  archetype: string
  count: number
}

export interface ArchetypesResponse {
  items: ArchetypeCount[]
}

// === Character Build (dentro de um time) ===
export interface WeaponSlot {
  weapon_slug: string | null
  weapon_refinement: number | null
  notes: string | null
}

export interface ArtifactSlot {
  artifact_set_slug: string | null
  notes: string | null
}

export interface ArtifactPair {
  set1_slug: string | null
  set2_slug: string | null
  notes: string | null
}

export interface CharacterBuild {
  weapons: WeaponSlot[]
  artifacts_4pc: ArtifactSlot[]
  artifacts_2pc: ArtifactPair[]
  sands_stat: string[]
  goblet_stat: string[]
  circlet_stat: string[]
  substat_priority: string[]
  er_requirement: string | null
  talent_priority: string | null
  notes: string | null
  references: BuildReference[]
  substitutes: Substitute[]
  combos: string[]
}

export interface TeamBuildsUpdate {
  builds: Record<number, CharacterBuild>
}

// Estende TeamMember com build
export interface TeamMemberWithBuild extends TeamMember {
  build: CharacterBuild | null
  substitutes: Substitute[]
}


export interface BuildReference {
  url: string
  title: string | null
}

export interface Substitute {
  character_slug: string | null
  build_label: string | null
  notes: string | null
}


export interface BuildPreset {
  id: number
  character_slug: string
  name: string
  build_data: CharacterBuild
}

// === Pull Advisor ===
export type PullGoal = 'meta' | 'unlock_teams' | 'endgame' | 'imaginarium'
export type PullVerdict = 'must_pull' | 'high_value' | 'good_option' | 'situational'

export interface PullAdvisorRequest {
  owned_slugs: string[]
  goal: PullGoal
  rarity_filter?: number | null
  element_filter?: string | null
  target_slug?: string | null
  limit?: number
}

export interface UnlockedTeam {
  id: number
  name: string
  archetype: string
  character_slugs: string[]
  source: string | null
  sources_count: number
  team_avg_score: number
}

export interface PullBreakdown {
  general_meta: number
  team_unlocks: number
  account_gaps: number
  endgame_seasonal: number
}

export interface PullCandidate {
  slug: string
  name: string
  icon: string | null
  rarity: number
  element: string
  weapon_type: string
  role: string
  already_owned: boolean
  score: number
  verdict: PullVerdict
  verdict_label: string
  breakdown: PullBreakdown
  general_tier: string | null
  general_avg: number | null
  general_sites: number
  abyss_tier: string | null
  stygian_tier: string | null
  unlocked_teams_count: number
  near_unlock_teams_count: number
  unlocked_teams: UnlockedTeam[]
  synergy_partners_owned: string[]
  reasons: string[]
}

export interface AccountSummary {
  owned_count: number
  ready_teams_count: number
  almost_ready_teams_count: number
  total_templates: number
  element_counts: Record<string, number>
  weak_elements: string[]
  missing_dps_elements: string[]
  missing_capabilities: string[]
}

export interface PullAdvisorResponse {
  goal: PullGoal
  account_summary: AccountSummary
  target_evaluation: PullCandidate | null
  recommendations: PullCandidate[]
}

// === Upgrade Advisor ("Quem upar até Lv.90 & Talentos") ===
export type UpgradeGoal = 'overall' | 'endgame' | 'teams' | 'quick_wins'
export type UpgradeVerdict = 'priority_now' | 'high_impact' | 'good_upgrade' | 'already_built'
export type UpgradeStageFilter = 'needs_work' | 'needs_90' | 'needs_talents' | 'built' | 'all'

export interface OwnedCharProgress {
  slug: string
  level?: number | null
  cons?: number | null
  na?: number | null
  es?: number | null
  eb?: number | null
}

export interface UpgradeAdvisorRequest {
  owned_slugs: string[]
  characters_progress?: OwnedCharProgress[]
  goal: UpgradeGoal
  stage_filter?: UpgradeStageFilter
  rarity_filter?: number | null
  element_filter?: string | null
  limit?: number
}

export interface TalentTarget {
  key: 'na' | 'es' | 'eb'
  label: string
  priority: number
  current: number | null
  recommended: number
  needs_upgrade: boolean
}

export interface UpgradeBreakdown {
  meta_value: number
  team_usage: number
  upgrade_gain: number
  endgame_seasonal: number
}

export interface UpgradeCandidate {
  slug: string
  name: string
  icon: string | null
  rarity: number
  element: string
  weapon_type: string
  role: string
  score: number
  verdict: UpgradeVerdict
  verdict_label: string
  breakdown: UpgradeBreakdown
  general_tier: string | null
  general_avg: number | null
  general_sites: number
  abyss_tier: string | null
  stygian_tier: string | null
  has_progress_data: boolean
  current_level: number | null
  cons: number | null
  recommended_level: number
  recommended_level_label: string
  needs_level_90: boolean
  level_scaling_tag: string
  level_gap: number
  talent_priority_text: string | null
  talents: TalentTarget[]
  talent_levels_needed: number
  already_built: boolean
  ready_teams_count: number
  ready_teams: UnlockedTeam[]
  reasons: string[]
}

export interface UpgradeSummary {
  owned_count: number
  with_progress_count: number
  needs_upgrade_count: number
  needs_90_count: number
  needs_talents_count: number
  built_count: number
}

export interface UpgradeAdvisorResponse {
  goal: UpgradeGoal
  summary: UpgradeSummary
  recommendations: UpgradeCandidate[]
}

// === Importação via UID (Enka.Network) ===
export interface EnkaWeaponOut {
  slug: string | null
  item_id: number
  name: string
  icon: string | null
  rarity: number
  level: number
  ascension: number
  refinement: number
}

export interface EnkaSubstatOut {
  key: string
  value: number
}

export interface EnkaArtifactOut {
  set_slug: string
  slot_key: string
  level: number
  rarity: number
  main_stat_key: string
  substats: EnkaSubstatOut[]
}

export interface EnkaCharacterOut {
  slug: string
  avatar_id: number
  name: string
  icon: string | null
  rarity: number
  element: string
  level: number
  ascension: number
  cons: number
  na: number
  es: number
  eb: number
  has_detail: boolean
  weapon: EnkaWeaponOut | null
  artifacts?: EnkaArtifactOut[]
}

export interface EnkaImportResponse {
  uid: string
  nickname: string
  ar: number | null
  wl: number | null
  signature: string | null
  ttl: number
  showcase_hidden: boolean
  characters: EnkaCharacterOut[]
  unmapped_avatar_ids: number[]
}

// === Artifact Domain & Strongbox Advisor ("Artefatos & Domínios") ===
export type ArtifactFocus = 'all' | 'planner' | 'top_meta'
export type ArtifactDomainStrategy = 'farm_domain' | 'strongbox' | 'situational'
export type ArtifactAuditStatus = 'built' | 'partial' | 'needs_farm'

export interface EquippedArtifactSummaryIn {
  slug: string
  active_4pc_slug: string | null
  active_2pc_slugs: string[]
  pieces_count: number
  avg_level: number
  five_star_count: number
  crit_value: number
}

export interface ArtifactAdvisorRequest {
  owned_slugs: string[]
  planner_slugs?: string[]
  equipped_artifacts?: EquippedArtifactSummaryIn[]
  focus?: ArtifactFocus
  limit?: number
}

export interface ArtifactUserChar {
  slug: string
  name: string
  icon: string | null
  element: string
  rarity: number
  tier: string | null
  is_bis: boolean
  is_in_planner: boolean
  usage_label: string
  artifact_status?: ArtifactAuditStatus | null
  crit_value?: number | null
  equipped_note?: string | null
}

export interface ArtifactSetDemand {
  slug: string
  name: string
  icon: string | null
  in_strongbox: boolean
  demand_score: number
  bis_count: number
  total_users: number
  users: ArtifactUserChar[]
}

export interface ArtifactDomainRecommendation {
  domain_id: string
  domain_name: string
  region: string
  is_boss_only: boolean
  score: number
  efficiency_pct: number
  strategy: ArtifactDomainStrategy
  strategy_label: string
  usable_sets_count: number
  unique_characters_count: number
  bis_characters_count: number
  sets: ArtifactSetDemand[]
  reasons: string[]
}

export interface StrongboxTarget {
  slug: string
  name: string
  icon: string | null
  domain_name: string
  score: number
  bis_count: number
  total_users: number
  why: string
  users: ArtifactUserChar[]
}

export interface ArtifactAdvisorSummary {
  evaluated_characters: number
  domains_matched: number
  best_domain_name: string | null
  best_strongbox_name: string | null
  planner_characters_matched: number
  audited_characters?: number
  already_built_characters?: number
}

export interface ArtifactAdvisorResponse {
  focus: ArtifactFocus
  summary: ArtifactAdvisorSummary
  domains: ArtifactDomainRecommendation[]
  strongbox_targets: StrongboxTarget[]
}

// === Endgame Conflict-Free Team Composer (Abismo 2 Times / Stygian 3 Times) ===
export type EndgameMode = 'abyss' | 'stygian'

export interface EndgameTeamsRequest {
  owned_slugs: string[]
  mode: EndgameMode
  locked_slugs?: string[]
  excluded_slugs?: string[]
  limit?: number
}

export interface EndgameMemberOut {
  slug: string
  name: string
  icon: string | null
  element: string
  rarity: number
  tier: string | null
}

export interface EndgameTeamOut {
  id: number
  name: string
  archetype: string
  score: number
  tier: string
  source: string | null
  sources_count: number
  members: EndgameMemberOut[]
}

export interface EndgameCombinationOut {
  rank: number
  total_score: number
  avg_score: number
  avg_tier: string
  teams: EndgameTeamOut[]
  reasons: string[]
}

export interface EndgameTeamsResponse {
  mode: EndgameMode
  team_count: number
  playable_templates_count: number
  owned_count: number
  locked_slugs: string[]
  combinations: EndgameCombinationOut[]
}

// === Estatísticas da Comunidade (Paimon.plus — Censo de 40k+ contas) ===
export interface CommunityBucket {
  label: string
  count: number
  pct: number
}

export interface CommunityPlayerCensus {
  total_players: number
  ar60_pct: number
  abyss_floor12_pct: number
  theater_act10_pct: number
  achievements_median: number
  achievements_mean: number
  achievements_top: number
  friendship10_median: number
  ar_distribution: CommunityBucket[]
  abyss_distribution: CommunityBucket[]
  theater_distribution: CommunityBucket[]
}

export interface CommunityStatPair {
  mean: number
  median: number
}

export interface CommunityConstellationDist {
  level: number
  count: number
  pct: number
}

export interface CommunityStoppingPoint {
  constellation: number
  pct: number
  label: string
}

export interface CommunityTalentStat {
  mean: number
  median: number
  mode: number
}

export interface CommunityWeaponUsage {
  ambr_id: number
  slug: string | null
  name: string
  icon: string | null
  rarity: number
  count: number
  pct: number
}

export interface CommunityArtifactSetPart {
  ambr_id: number
  slug: string | null
  name: string
  icon: string | null
  pieces: number
}

export interface CommunityArtifactSetCombo {
  sets: CommunityArtifactSetPart[]
  count: number
  pct: number
}

export interface CommunityCharStats {
  slug: string
  name: string
  icon: string | null
  rarity: number
  element: string
  avatar_id: number
  count: number
  popularity_pct: number
  avg_constellation: number
  c6_pct: number
  consts: CommunityConstellationDist[]
  stopping_points: CommunityStoppingPoint[]
  stats: Record<string, CommunityStatPair>
  talents: {
    na: CommunityTalentStat
    es: CommunityTalentStat
    eb: CommunityTalentStat
  }
  weapons: CommunityWeaponUsage[]
  artifact_sets: CommunityArtifactSetCombo[]
}

export interface CommunityGlobalWeaponRank {
  ambr_id: number
  slug: string
  name: string
  icon: string | null
  rarity: number
  count: number
  share_pct: number
}

export interface CommunityGlobalSetRank {
  ambr_id: number
  slug: string
  name: string
  icon: string | null
  count: number
  share_pct: number
}

export interface CommunityStatsResponse {
  source: string
  source_url: string
  updated_at: string | null
  total_characters: number
  census: CommunityPlayerCensus
  rankings: {
    top_popular: CommunityCharStats[]
    top_c6_5star: CommunityCharStats[]
    top_weapons: CommunityGlobalWeaponRank[]
    top_artifact_sets: CommunityGlobalSetRank[]
  }
  characters: Record<string, CommunityCharStats>
}

export interface CharacterCommunityStatsResponse {
  source: string
  updated_at: string | null
  total_players: number
  character: CommunityCharStats
}

