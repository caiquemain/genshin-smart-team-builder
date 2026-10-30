export interface TierlistSite {
  slug: string
  name: string
  url: string
  scale_size: number
}

export interface TierlistEntry {
  site_slug: string
  tier_label: string
  tier_master: string | null
  normalized_value: number
  role: string
  version: string | null
  source_url: string | null
}

export interface AggregatedTier {
  character_slug: string
  dominant_role: string
  consensus_tier: string
  consensus_votes: number
  tier_by_avg: string
  avg_score: number
  spread: number
  tiers_voted: string[]
  num_sites: number
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
