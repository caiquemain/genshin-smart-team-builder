import type { GoodData } from '../types/good'
import { resolveCharSlug, resolveWeaponSlug } from './slug-resolver'

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
  for (const c of data.characters) {
    const slug = resolveCharSlug(c.key)
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
  for (const w of data.weapons) {
    if (!w.location) continue
    const charSlug = resolveCharSlug(w.location)
    const weaponSlug = resolveWeaponSlug(w.key)
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