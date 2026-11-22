import { useEffect, useState } from 'react'
import { parseGoodData, type GoodCharState } from './good-parser'
import type { GoodData } from '../types/good'
import { PLANNER_PLAN_KEY, PLANNER_UPDATED_EVENT } from './planner-storage'
import type { Plan } from '../types/planner'

const STORAGE_KEY = 'gsb.roster.v1'
const PLANNER_KEY = 'gsb.planner.v5'

// Alias: forma curta ou alternativa -> chave canônica (já normalizada, sem separadores)
const CHAR_ALIASES: Record<string, string> = {
  'ayaka': 'kamisatoayaka',
  'ayato': 'kamisatoayato',
  'kazuha': 'kaedeharakazuha',
  'kokomi': 'sangonomiyakokomi',
  'raiden': 'raidenshogun',
  'shogun': 'raidenshogun',
  'shinobu': 'kukishinobu',
  'kuki': 'kukishinobu',
  'yae': 'yaemiko',
  'miko': 'yaemiko',
  'itto': 'aratakiitto',
  'sara': 'kujousara',
  'heizou': 'shikanoinheizou',
  'mizuki': 'yumemizukimizuki',
  'yunjin': 'yunjin',
  'lanyan': 'lanyan',
}

function normKey(s: string): string {
  const k = (s || '').toLowerCase().replace(/[^a-z0-9]/g, '')
  return CHAR_ALIASES[k] || k
}

export interface RosterEntry {
  owned: boolean
  cons: number
}

export interface OwnedChar {
  owned: boolean
  cons: number
  source: 'manual' | 'good' | 'seelie' | 'unknown'
}

export interface Roster {
  get: (slug: string) => OwnedChar
  getGoodState: (slug: string) => GoodCharState | null
  set: (slug: string, entry: RosterEntry) => void
  setMany: (slugs: string[], entry: RosterEntry) => void
  remove: (slug: string) => void
  clearAll: () => void
  refresh: () => void
  all: Map<string, RosterEntry>
  hasGoodData: boolean
  hasGoodOrSeelie: boolean
  hasArtifactData: boolean
  ownedCount: number
}

export function useRoster(): Roster {
  const [manual, setManual] = useState<Map<string, RosterEntry>>(new Map())
  const [good, setGood] = useState<Map<string, GoodCharState>>(new Map())
  const [planState, setPlanState] = useState<Map<string, GoodCharState>>(new Map())
  const [seelieSlugs, setSeelieSlugs] = useState<Set<string>>(new Set())
  const [refreshTick, setRefreshTick] = useState(0)

  useEffect(() => {
    const onExternalUpdate = () => setRefreshTick((t) => t + 1)
    window.addEventListener(PLANNER_UPDATED_EVENT, onExternalUpdate)
    window.addEventListener('storage', onExternalUpdate)
    return () => {
      window.removeEventListener(PLANNER_UPDATED_EVENT, onExternalUpdate)
      window.removeEventListener('storage', onExternalUpdate)
    }
  }, [])

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        const map = new Map<string, RosterEntry>()
        for (const [slug, entry] of Object.entries(parsed)) {
          if (typeof entry === 'object' && entry !== null) {
            map.set(slug, entry as RosterEntry)
          }
        }
        setManual(map)
      } catch {}
    } else {
      setManual(new Map())
    }

    const planner = localStorage.getItem(PLANNER_KEY)
    if (planner) {
      try {
        const parsed = JSON.parse(planner)
        if (parsed?.good) {
          const raw = parseGoodData(parsed.good as GoodData)
          const normalized = new Map<string, GoodCharState>()
          raw.forEach((v, k) => normalized.set(normKey(k), v))
          setGood(normalized)
        } else {
          setGood(new Map())
        }
        if (parsed?.seelie?.goals) {
          const slugs = new Set<string>()
          for (const g of parsed.seelie.goals) {
            if (g.type === 'character' && g.character) {
              slugs.add(normKey(g.character))
            }
          }
          setSeelieSlugs(slugs)
        } else {
          setSeelieSlugs(new Set())
        }
      } catch {}
    } else {
      setGood(new Map())
      setSeelieSlugs(new Set())
    }

    const savedPlan = localStorage.getItem(PLANNER_PLAN_KEY)
    if (savedPlan) {
      try {
        const parsed = JSON.parse(savedPlan) as Plan
        const map = new Map<string, GoodCharState>()
        for (const c of parsed?.chars ?? []) {
          if (!c?.slug || (!c.char_goal && !c.talent_goal)) continue
          const primaryWeapon = c.weapons?.[0]
          map.set(normKey(c.slug), {
            level: c.char_goal?.current?.level ?? 1,
            ascension: c.char_goal?.current?.ascension ?? 0,
            cons: c.char_goal?.cons ?? 0,
            talents: {
              na: c.talent_goal?.normal?.current ?? 1,
              es: c.talent_goal?.skill?.current ?? 1,
              eb: c.talent_goal?.burst?.current ?? 1,
            },
            weaponSlug: primaryWeapon?.slug ?? null,
            weaponLevel: primaryWeapon?.from_level ?? 0,
            weaponRefinement: 1,
            artifacts: [],
          })
        }
        setPlanState(map)
      } catch {
        setPlanState(new Map())
      }
    } else {
      setPlanState(new Map())
    }
  }, [refreshTick])

  const get = (slug: string): OwnedChar => {
    const nk = normKey(slug)
    // Manual: tenta slug bruto (DB) e normalizado — preserva dados antigos
    const m = manual.get(slug) || manual.get(nk)
    if (m) {
      return { owned: m.owned, cons: m.cons, source: 'manual' }
    }
    const g = good.get(nk)
    if (g) {
      return { owned: true, cons: g.cons, source: 'good' }
    }
    if (good.size === 0 && seelieSlugs.has(nk)) {
      return { owned: true, cons: 0, source: 'seelie' }
    }
    return { owned: false, cons: 0, source: 'unknown' }
  }

  const set = (slug: string, entry: RosterEntry) => {
    setManual(prev => {
      const next = new Map(prev)
      next.set(slug, entry)
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(next))) } catch {}
      return next
    })
  }

  const setMany = (slugs: string[], entry: RosterEntry) => {
    setManual(prev => {
      const next = new Map(prev)
      for (const slug of slugs) next.set(slug, entry)
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(next))) } catch {}
      return next
    })
  }

  const clearAll = () => {
    setManual(new Map())
    try { localStorage.removeItem(STORAGE_KEY) } catch {}
  }

  const refresh = () => setRefreshTick(t => t + 1)

  const remove = (slug: string) => {
    setManual(prev => {
      const next = new Map(prev)
      next.delete(slug)
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(next))) } catch {}
      return next
    })
  }

  // Conta total de "owned" — normaliza tudo antes de contar
  let ownedCount = 0
  if (manual.size > 0 || good.size > 0 || seelieSlugs.size > 0) {
    const all = new Set<string>()

    // Manual: normaliza e preserva flag "owned"
    const manualOwnedNorm = new Map<string, boolean>()
    manual.forEach((v, k) => {
      const nk = normKey(k)
      manualOwnedNorm.set(nk, v.owned)
      if (v.owned) all.add(nk)
    })

    // GOOD: conta se manual não negou explicitamente
    good.forEach((_, k) => {
      const nk = normKey(k)
      if (!manualOwnedNorm.has(nk) || manualOwnedNorm.get(nk)) all.add(nk)
    })

    // Seelie: so conta se GOOD estiver vazio (GOOD e fonte da verdade)
    if (good.size === 0) {
      seelieSlugs.forEach(k => {
        const nk = normKey(k)
        if (!manualOwnedNorm.has(nk)) all.add(nk)
      })
    }

    ownedCount = all.size
  }

  const getGoodState = (slug: string): GoodCharState | null => {
    const nk = normKey(slug)
    return good.get(nk) ?? planState.get(nk) ?? null
  }

  let hasArtifactData = false
  good.forEach((st) => {
    if (st.artifacts.length > 0) hasArtifactData = true
  })

  return {
    get,
    getGoodState,
    set,
    setMany,
    remove,
    clearAll,
    refresh,
    all: manual,
    hasGoodData: good.size > 0 || planState.size > 0,
    hasGoodOrSeelie: good.size > 0 || seelieSlugs.size > 0,
    hasArtifactData,
    ownedCount,
  }
}
