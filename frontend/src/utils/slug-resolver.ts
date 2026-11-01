import type { PlannerData } from './planner-data'

const CHAR_ALIASES: Record<string, string> = {
  kazuha: 'kaedehara-kazuha',
  shogun: 'raiden-shogun',
  heizou: 'shikanoin-heizou',
  kokomi: 'sangonomiya-kokomi',
  ayaka: 'kamisato-ayaka',
  shinobu: 'kuki-shinobu',
  mizuki: 'yumemizuki-mizuki',
  yunjin: 'yun-jin',
  sara: 'kujou-sara',
  lanyan: 'lan-yan',
}

const WEAPON_ALIASES: Record<string, string> = {
  amenoma_kageuta_blade: 'amenoma-kageuchi',
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

let charIndex: Map<string, string> | null = null
let weaponIndex: Map<string, string> | null = null

export function buildIndexes(data: PlannerData): void {
  charIndex = new Map()
  for (const [slug, c] of Object.entries(data.characters)) {
    charIndex.set(normalize(slug), slug)
    for (const name of Object.values(c.name)) {
      if (name) charIndex.set(normalize(name), slug)
    }
  }

  weaponIndex = new Map()
  for (const [slug, w] of Object.entries(data.weapons)) {
    weaponIndex.set(normalize(slug), slug)
    for (const name of Object.values(w.name)) {
      if (name) weaponIndex.set(normalize(name), slug)
    }
  }
}

export function resolveCharSlug(input: string): string | null {
  if (!charIndex) return null
  const norm = normalize(input)
  if (charIndex.has(norm)) return charIndex.get(norm)!

  const aliased = CHAR_ALIASES[input] ?? CHAR_ALIASES[norm]
  if (aliased) {
    const aliasedNorm = normalize(aliased)
    if (charIndex.has(aliasedNorm)) return charIndex.get(aliasedNorm)!
  }
  return null
}

export function resolveWeaponSlug(input: string): string | null {
  if (!weaponIndex) return null
  const norm = normalize(input)
  if (weaponIndex.has(norm)) return weaponIndex.get(norm)!

  const aliased = WEAPON_ALIASES[input] ?? WEAPON_ALIASES[norm]
  if (aliased) {
    const aliasedNorm = normalize(aliased)
    if (weaponIndex.has(aliasedNorm)) return weaponIndex.get(aliasedNorm)!
  }
  return null
}