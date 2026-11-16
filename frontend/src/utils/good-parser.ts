import type { GoodData } from '../types/good'
import { resolveCharSlug, resolveWeaponSlug, normKey } from './slug-resolver'

export interface GoodCharState {
  level: number
  cons: number
  talents: { na: number; es: number; eb: number }
  weaponSlug: string | null
  weaponLevel: number
}

export function parseGoodData(data: GoodData): Map<string, GoodCharState> {
  const map = new Map<string, GoodCharState>()

  // 1. Mapeia personagens
  const characters = Array.isArray(data?.characters) ? data.characters : []
  for (const c of characters) {
    // Fallback: se buildIndexes ainda nao rodou, resolveCharSlug retorna null.
    // normKey normaliza (lowercase, sem separadores) e o get() do roster normaliza igual.
    const slug = resolveCharSlug(c.key) || normKey(c.key)
    if (!slug) continue
    map.set(slug, {
      level: c.level,
      cons: c.constellation ?? 0,
      talents: {
        na: c.talent?.auto ?? 1,
        es: c.talent?.skill ?? 1,
        eb: c.talent?.burst ?? 1,
      },
      weaponSlug: null,
      weaponLevel: 0,
    })
  }

  // 2. Mapeia armas (se equipadas em algum personagem)
  const weapons = Array.isArray(data?.weapons) ? data.weapons : []
  for (const w of weapons) {
    if (!w.location) continue
    const charSlug = resolveCharSlug(w.location) || normKey(w.location)
    const weaponSlug = resolveWeaponSlug(w.key) || normKey(w.key)
    if (charSlug && weaponSlug) {
      const state = map.get(charSlug)
      if (state) {
        state.weaponSlug = weaponSlug
        state.weaponLevel = w.level
      }
    }
  }

  return map
}
