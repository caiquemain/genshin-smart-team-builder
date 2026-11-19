import { describe, it, expect } from 'vitest'
import { tierOf, estimateResin, estimateResinRange, formatDays } from '../resin'

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

  it('formats resin into human-readable days/months', () => {
    expect(formatDays(0)).toBe('—')
    expect(formatDays(180)).toBe('~1 dia')
    expect(formatDays(360)).toBe('~2 dias')
    expect(formatDays(180 * 30)).toBe('~1 mês')
    expect(formatDays(180 * 60)).toBe('~2 meses')
  })
})
