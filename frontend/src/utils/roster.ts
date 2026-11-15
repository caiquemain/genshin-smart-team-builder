import { useEffect, useState } from 'react'
import { parseGoodData, type GoodCharState } from './good-parser'
import type { SeelieData } from '../types/seelie'
import type { GoodData } from '../types/good'

const STORAGE_KEY = 'gsb.roster.v1'
const PLANNER_KEY = 'gsb.planner.v5'

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
  set: (slug: string, entry: RosterEntry) => void
  remove: (slug: string) => void
  all: Map<string, RosterEntry>
  hasGoodOrSeelie: boolean
  ownedCount: number
}

export function useRoster(): Roster {
  const [manual, setManual] = useState<Map<string, RosterEntry>>(new Map())
  const [good, setGood] = useState<Map<string, GoodCharState>>(new Map())
  const [seelieSlugs, setSeelieSlugs] = useState<Set<string>>(new Set())

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
    }

    const planner = localStorage.getItem(PLANNER_KEY)
    if (planner) {
      try {
        const parsed = JSON.parse(planner)
        if (parsed?.good) {
          setGood(parseGoodData(parsed.good as GoodData))
        }
        if (parsed?.seelie?.goals) {
          const slugs = new Set<string>()
          for (const g of parsed.seelie.goals) {
            if (g.type === 'character' && g.character) {
              slugs.add(g.character)
            }
          }
          setSeelieSlugs(slugs)
        }
      } catch {}
    }
  }, [])

  const get = (slug: string): OwnedChar => {
    // Manual SEMPRE sobrescreve
    const m = manual.get(slug)
    if (m) {
      return { owned: m.owned, cons: m.cons, source: 'manual' }
    }
    // GOOD > Seelie
    const g = good.get(slug)
    if (g) {
      return { owned: true, cons: g.cons, source: 'good' }
    }
    if (seelieSlugs.has(slug)) {
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

  const remove = (slug: string) => {
    setManual(prev => {
      const next = new Map(prev)
      next.delete(slug)
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(next))) } catch {}
      return next
    })
  }

  // Conta total de "owned" (manual + good + seelie)
  let ownedCount = 0
  if (manual.size > 0 || good.size > 0 || seelieSlugs.size > 0) {
    const all = new Set<string>()
    manual.forEach((v, k) => { if (v.owned) all.add(k) })
    good.forEach((_, k) => { if (!manual.has(k) || manual.get(k)!.owned) all.add(k) })
    seelieSlugs.forEach(k => { if (!manual.has(k) && !good.has(k)) all.add(k) })
    ownedCount = all.size
  }

  return {
    get,
    set,
    remove,
    all: manual,
    hasGoodOrSeelie: good.size > 0 || seelieSlugs.size > 0,
    ownedCount,
  }
}
