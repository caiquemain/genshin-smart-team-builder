import { describe, it, expect } from 'vitest'
import { tierOf, estimateResin, estimateResinRange, computeRunModes, runsForMode, formatDays } from '../resin'

describe('resin', () => {
  it('maps material categories to expected resin tiers', () => {
    expect(tierOf('local_specialty').key).toBe('free')
    expect(tierOf('talent_book').key).toBe('domain20')
    expect(tierOf('boss_material').key).toBe('boss40')
    expect(tierOf('weekly_boss').key).toBe('weekly')
    expect(tierOf('unknown_category').key).toBe('free')
  })

  it('estimates resin based on average drop rate', () => {
    expect(estimateResin('local_specialty', 168)).toBe(0)
    // boss_material avgDrop = 2.5, resinPerRun = 40 -> ceil(46 / 2.5) = 19 runs -> 760 resin
    expect(estimateResin('boss_material', 46)).toBe(19 * 40)
    // weekly_boss avgDrop = 2.2, resinPerRun = 30 -> ceil(6 / 2.2) = 3 runs -> 90 resin
    expect(estimateResin('weekly_boss', 6)).toBe(3 * 30)
  })

  it('computes resin ranges for complete, mora, free, and resin categories', () => {
    expect(estimateResinRange('boss_material', 46, 50).kind).toBe('complete')
    expect(estimateResinRange('mora', 1_000_000, 0).kind).toBe('mora')
    expect(estimateResinRange('common_drop', 36, 10).kind).toBe('free')

    const range = estimateResinRange('boss_material', 46, 6)
    expect(range.kind).toBe('resin')
    expect(range.minRuns).toBeLessThanOrEqual(range.avgRuns)
    expect(range.avgRuns).toBeLessThanOrEqual(range.maxRuns)
    expect(range.minResin).toBe(range.minRuns * 40)
    expect(range.avgResin).toBe(range.avgRuns * 40)
    expect(range.maxResin).toBe(range.maxRuns * 40)
  })

  it('computes Leyline runs for Mora and Hero\'s Wit and calibrates by rarity and WL', () => {
    const mora = estimateResinRange('mora', 600_000, 120_000, { wl: 9, resinMode: 60 })
    expect(mora.kind).toBe('mora')
    expect(mora.avgRuns).toBe(8) // 480k / 60k = 8 runs (20 resin)
    expect(mora.avgResin).toBe(160)
    expect(mora.preferredResinMode).toBe(60)

    const xp = estimateResinRange('character_exp', 122, 0, { rarity: 4, wl: 9, resinMode: 40 })
    expect(xp.kind).toBe('resin')
    expect(xp.avgRuns).toBe(20) // 122 / 6.125 = 19.9 -> 20 runs
    expect(xp.avgResin).toBe(400)
    expect(xp.preferredResinMode).toBe(40)

    const bossWl9 = estimateResinRange('boss_material', 46, 0, { wl: 9 })
    const bossWl8 = estimateResinRange('boss_material', 46, 0, { wl: 8 })
    expect(bossWl9.avgRuns).toBeLessThan(bossWl8.avgRuns)

    const goldBook = estimateResinRange('talent_book', 38, 0, { rarity: 4, wl: 9 })
    const blueBook = estimateResinRange('talent_book', 38, 0, { rarity: 3, wl: 9 })
    expect(goldBook.avgRuns).toBeGreaterThan(blueBook.avgRuns)
  })

  it('computes 20 / 40 / 60 Condensed Resin (3x) run modes accurately', () => {
    expect(computeRunModes(0)).toEqual({ runs20: 0, runs40: 0, runs60: 0 })
    expect(computeRunModes(1)).toEqual({ runs20: 1, runs40: 1, runs60: 1 })
    expect(computeRunModes(6)).toEqual({ runs20: 6, runs40: 3, runs60: 2 })
    expect(computeRunModes(7)).toEqual({ runs20: 7, runs40: 4, runs60: 3 })
    expect(computeRunModes(12)).toEqual({ runs20: 12, runs40: 6, runs60: 4 })

    expect(runsForMode(10, 20)).toBe(10)
    expect(runsForMode(10, 40)).toBe(5)
    expect(runsForMode(10, 60)).toBe(4)
  })

  it('formats resin into human-readable days/months', () => {
    expect(formatDays(0)).toBe('—')
    expect(formatDays(180)).toBe('~1 dia')
    expect(formatDays(360)).toBe('~2 dias')
    expect(formatDays(180 * 30)).toBe('~1 mês')
    expect(formatDays(180 * 60)).toBe('~2 meses')
  })
})
