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
}