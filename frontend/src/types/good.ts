export type GoodSlotKey = 'flower' | 'plume' | 'sands' | 'goblet' | 'circlet'

export interface GoodSubstat {
  key: string
  value: number
}

export interface GoodArtifact {
  setKey: string
  slotKey: GoodSlotKey | string
  level: number
  rarity: number
  mainStatKey: string
  location?: string | null
  lock?: boolean
  substats?: GoodSubstat[]
}

export interface GoodCharacter {
  key: string
  level: number
  ascension: number
  constellation: number
  talent: {
    auto: number
    skill: number
    burst: number
  }
}

export interface GoodWeapon {
  key: string
  level: number
  ascension: number
  refinement: number
  location?: string | null // char key
}

export interface GoodData {
  format: string
  version: number
  source: string
  characters: GoodCharacter[]
  weapons: GoodWeapon[]
  artifacts?: GoodArtifact[]
}