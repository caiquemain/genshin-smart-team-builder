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

export interface TeamDetail {
  id: number
  name: string
  description: string | null
  author_name: string | null
  is_public: boolean
  members: TeamMember[]
}

export interface TeamListResponse {
  items: TeamDetail[]
}

export interface TeamCreate {
  name: string
  description?: string
  author_name?: string
  character_slugs: string[]
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
  passive_name: string | null
  passive_description_r5: string | null
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
