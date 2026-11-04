export type PlannerLang = 'pt' | 'en' | 'es'

export interface LocalizedName {
  pt?: string
  en?: string
  es?: string
}

export interface MaterialRef {
  slug: string
  qty: number
}

export interface AscensionPhaseData {
  phase: number
  max_level: number
  mora: number
  materials: MaterialRef[]
}

export interface TalentPhaseData {
  level: number
  mora: number
  materials: MaterialRef[]
}

export interface PlannerCharacterData {
  name: LocalizedName
  icon: string | null
  element: string
  weapon_type: string
  rarity: number
  region: string | null
  ascension_phases: AscensionPhaseData[]
  talent_phases: Record<string, TalentPhaseData[]>
}

export interface PlannerWeaponData {
  name: LocalizedName
  icon: string | null
  weapon_type: string
  rarity: number
  ascension_phases: AscensionPhaseData[]
}

export interface PlannerMaterialData {
  name: LocalizedName
  icon: string | null
  rarity: number | null
  category: string
  description: LocalizedName
  source: LocalizedName
  is_weekly?: boolean          // <-- NOVO
}

export interface PlannerData {
  version: string
  characters: Record<string, PlannerCharacterData>
  weapons: Record<string, PlannerWeaponData>
  materials: Record<string, PlannerMaterialData>
  global_max: Record<string, number>
  families: Record<string, string[]>
}

const URL = '/planner-data.json'

let cached: PlannerData | null = null
let inflight: Promise<PlannerData> | null = null

export async function loadPlannerData(): Promise<PlannerData> {
  if (cached) return cached
  if (inflight) return inflight

  inflight = (async () => {
    const res = await fetch(URL, { cache: 'default' })
    if (!res.ok) {
      throw new Error(`Falha ao carregar ${URL}: HTTP ${res.status}`)
    }
    const data: PlannerData = await res.json()
    cached = data
    return data
  })().finally(() => { inflight = null })

  return inflight
}

export function getPlannerData(): PlannerData {
  if (!cached) {
    throw new Error('planner-data.json não carregado. Chame loadPlannerData() antes.')
  }
  return cached
}

export function getPlannerDataOrNull(): PlannerData | null {
  return cached
}

export function pickLang(map: LocalizedName | undefined | null, lang: string): string {
  if (!map) return ''
  const v = map[lang as PlannerLang]
  if (v) return v
  return map.en ?? ''
}

export function elementOf(slug: string): string | undefined {
  return cached?.characters[slug]?.element
}