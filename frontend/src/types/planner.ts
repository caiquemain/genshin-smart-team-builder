// Tipos compartilhados entre PlannerPage e PlannerCharactersPage

export interface AggregateMaterial {
  slug: string
  name: string
  icon: string | null
  rarity: number | null
  category: string
  description: string | null
  source: string | null
  quantity: number
  resin_estimate: number
}

export interface WeaponBreakdown {
  slug: string
  name: string
  icon: string | null
  rarity: number
  from_level: number
  to_level: number
  cost: any
}

export interface CharBreakdown {
  slug: string
  name: string
  icon: string | null
  ascension: any | null
  talents: any | null
  weapons: WeaponBreakdown[]
  char_goal: any | null
  talent_goal: any | null
  is_inactive?: boolean
  is_complete?: boolean
  has_ascension_pending?: boolean
  has_talent_pending?: boolean
  has_weapon_pending?: boolean
}

export interface TierGroup {
  tier: any
  materials: AggregateMaterial[]
  resin_total: number
}

export interface Plan {
  chars: CharBreakdown[]
  grand_mora: number
  grand_resin: number
  tier_groups: TierGroup[]
  warnings: string[]
  not_mapped: string[]
  travelers_skipped: number
  weapons_processed: number
  weapons_skipped: number
  inventory_resolved: Record<string, number>
  inventory_stats: { mapped: number; unmapped: number; ambiguous: number; total: number }
  materials_complete: number
  materials_partial: number
}
