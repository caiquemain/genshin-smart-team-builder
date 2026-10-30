export interface TierlistSite {
  slug: string
  name: string
  url: string
  scale_size: number
}

export interface TierlistEntry {
  site_slug: string
  tier_label: string
  normalized_value: number
  role: string
  version: string | null
  source_url: string | null
}

export interface AggregatedTier {
  character_slug: string
  role: string
  avg_score: number
  num_sites: number
  tier_consolidated: string
  entries: TierlistEntry[]
}

export interface TierlistResponse {
  role: string | null
  items: AggregatedTier[]
}

export interface CharacterTierlistResponse {
  character_slug: string
  roles: AggregatedTier[]
}
