import { beforeEach, describe, expect, it } from 'vitest'
import {
  exportAccountBackup,
  getLocalAccountSummary,
  restoreAccountBackup,
  validateAccountBackup,
} from '../account-backup'
import { PLANNER_PLAN_KEY, PLANNER_V5_KEY, ROSTER_KEY } from '../planner-storage'

function makeMemoryStorage() {
  const store = new Map<string, string>()
  return {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      store.set(k, String(v))
    },
    removeItem: (k: string) => {
      store.delete(k)
    },
    clear: () => store.clear(),
  }
}

describe('account-backup', () => {
  beforeEach(() => {
    ;(globalThis as any).localStorage = makeMemoryStorage()
  })

  it('exports and restores full account snapshot cleanly across empty storage', () => {
    localStorage.setItem(ROSTER_KEY, JSON.stringify({ vodyanitsa: { owned: true, cons: 2 } }))
    localStorage.setItem(
      PLANNER_V5_KEY,
      JSON.stringify({ ar: 60, wl: 9, manual_inventory: { mora: 500_000 }, good: null, seelie: null }),
    )
    localStorage.setItem(
      PLANNER_PLAN_KEY,
      JSON.stringify({
        chars: [{ slug: 'vodyanitsa', name: 'Vodyanitsa', icon: null, ascension: null, talents: null, weapons: [], char_goal: null, talent_goal: null }],
        grand_mora: 100,
        grand_resin: 20,
        tier_groups: [],
        warnings: [],
        not_mapped: [],
        travelers_skipped: 0,
        weapons_processed: 0,
        weapons_skipped: 0,
        inventory_resolved: { mora: 500_000 },
        inventory_stats: { mapped: 1, unmapped: 0, ambiguous: 0, total: 1 },
        materials_complete: 0,
        materials_partial: 0,
      }),
    )
    localStorage.setItem('gsb.lang', 'pt')

    const snapshot = exportAccountBackup()
    expect(snapshot.format).toBe('GSB_BACKUP')
    expect(snapshot.version).toBe(1)

    // Limpa tudo simulando outro navegador
    localStorage.clear()
    expect(getLocalAccountSummary().plannerCharsCount).toBe(0)

    const result = restoreAccountBackup(snapshot)
    expect(result.rosterCount).toBe(1)
    expect(result.plannerCharsCount).toBe(1)
    expect(JSON.parse(localStorage.getItem(ROSTER_KEY)!).vodyanitsa.cons).toBe(2)
    expect(JSON.parse(localStorage.getItem(PLANNER_V5_KEY)!).manual_inventory.mora).toBe(500_000)
    expect(localStorage.getItem('gsb.lang')).toBe('pt')
  })

  it('rejects invalid backup files with descriptive error messages', () => {
    expect(() => validateAccountBackup(null)).toThrow(/inválido/i)
    expect(() => validateAccountBackup({ format: 'GOOD' })).toThrow(/GSB_BACKUP/)
    expect(() => validateAccountBackup({ format: 'GSB_BACKUP' })).toThrow(/data/)
  })
})
