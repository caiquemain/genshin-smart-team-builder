import type { GoodArtifact, GoodData } from '../types/good'
import { resolveCharSlug, resolveWeaponSlug, normKey } from './slug-resolver'

export interface GoodCharState {
  level: number
  ascension: number
  cons: number
  talents: { na: number; es: number; eb: number }
  weaponSlug: string | null
  weaponLevel: number
  weaponRefinement: number
  artifacts: GoodArtifact[]
}

const SLOT_ORDER: Record<string, number> = {
  flower: 0,
  plume: 1,
  sands: 2,
  goblet: 3,
  circlet: 4,
}

const CHAR_ALIASES: Record<string, string> = {
  ayaka: 'kamisatoayaka',
  ayato: 'kamisatoayato',
  kazuha: 'kaedeharakazuha',
  kokomi: 'sangonomiyakokomi',
  raiden: 'raidenshogun',
  shogun: 'raidenshogun',
  shinobu: 'kukishinobu',
  kuki: 'kukishinobu',
  yae: 'yaemiko',
  miko: 'yaemiko',
  itto: 'aratakiitto',
  sara: 'kujousara',
  heizou: 'shikanoinheizou',
  mizuki: 'yumemizukimizuki',
}

function aliasNorm(raw: string): string {
  const n = normKey(raw)
  return CHAR_ALIASES[n] || n
}

export function parseGoodData(data: GoodData): Map<string, GoodCharState> {
  const map = new Map<string, GoodCharState>()
  // Índice auxiliar por chave normalizada -> chave real no mapa (evita mismatch quando
  // character.key resolve diferente de weapon.location / artifact.location)
  const normToMapKey = new Map<string, string>()

  // 1. Mapeia personagens
  const characters = Array.isArray(data?.characters) ? data.characters : []
  for (const c of characters) {
    // Fallback: se buildIndexes ainda nao rodou, resolveCharSlug retorna null.
    // normKey normaliza (lowercase, sem separadores) e o get() do roster normaliza igual.
    const slug = resolveCharSlug(c.key) || normKey(c.key)
    if (!slug) continue
    map.set(slug, {
      level: c.level,
      ascension: c.ascension ?? 0,
      cons: c.constellation ?? 0,
      talents: {
        na: c.talent?.auto ?? 1,
        es: c.talent?.skill ?? 1,
        eb: c.talent?.burst ?? 1,
      },
      weaponSlug: null,
      weaponLevel: 0,
      weaponRefinement: 1,
      artifacts: [],
    })
    normToMapKey.set(aliasNorm(c.key), slug)
    normToMapKey.set(aliasNorm(slug), slug)
  }

  const findState = (location: string | null | undefined): GoodCharState | undefined => {
    if (!location) return undefined
    const direct = resolveCharSlug(location) || normKey(location)
    if (map.has(direct)) return map.get(direct)
    const mapped = normToMapKey.get(aliasNorm(location))
    return mapped ? map.get(mapped) : undefined
  }

  // 2. Mapeia armas (se equipadas em algum personagem)
  const weapons = Array.isArray(data?.weapons) ? data.weapons : []
  for (const w of weapons) {
    if (!w.location) continue
    const weaponSlug = resolveWeaponSlug(w.key) || normKey(w.key)
    const state = findState(w.location)
    if (state && weaponSlug) {
      state.weaponSlug = weaponSlug
      state.weaponLevel = w.level
      state.weaponRefinement = w.refinement ?? 1
    }
  }

  // 3. Mapeia artefatos equipados em cada personagem
  const artifacts = Array.isArray(data?.artifacts) ? data.artifacts : []
  for (const a of artifacts) {
    if (!a?.location || !a?.setKey || !a?.slotKey) continue
    const state = findState(a.location)
    if (state) {
      state.artifacts.push(a)
    }
  }

  // Ordena as peças no padrão oficial: Flor -> Pena -> Ampulheta -> Cálice -> Tiara
  map.forEach((st) => {
    if (st.artifacts.length > 1) {
      st.artifacts.sort(
        (x, y) => (SLOT_ORDER[x.slotKey] ?? 99) - (SLOT_ORDER[y.slotKey] ?? 99),
      )
    }
  })

  return map
}
