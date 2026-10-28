export interface SeelieCharacterGoal {
  type: 'character'
  character: string
  current: { level: number; asc: number }
  goal: { level: number; asc: number }
  id: number
}

export interface SeelieTalentGoal {
  type: 'talent'
  character: string
  normal: { current: number; goal: number }
  skill: { current: number; goal: number }
  burst: { current: number; goal: number }
  id: number
}

export interface SeelieWeaponGoal {
  type: 'weapon'
  character: string | null
  weapon: string
  current: { level: number; asc: number; craft?: number }
  goal: { level: number; asc: number; craft?: number }
  id: number
}

export interface SeelieArtifactGoal {
  type: 'artifact'
  character: string
  artifacts: string[]
  sands: string | null
  goblet: string | null
  circlet: string | null
  done: boolean | Record<string, boolean>
  id: number
}

export type SeelieGoal =
  | SeelieCharacterGoal
  | SeelieTalentGoal
  | SeelieWeaponGoal
  | SeelieArtifactGoal

export interface SeelieData {
  goals: SeelieGoal[]
  inventory: unknown[]
  [key: string]: unknown
}
