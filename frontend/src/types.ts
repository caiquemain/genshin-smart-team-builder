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
