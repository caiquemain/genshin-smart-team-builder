import { describe, expect, it } from 'vitest'
import {
  analyzeCommunityDataset,
  findNearestNeighbors,
  normalizedEntropy,
  spearmanCorrelation,
} from '../community-analytics'
import type { CommunityCharStats } from '../../types'

function makeChar(
  slug: string,
  overrides: Partial<{
    rarity: number
    count: number
    c6_pct: number
    hp: number
    atk: number
    def: number
    em: number
    emMean: number
    cr: number
    cd: number
    cdMean: number
    er: number
    elem: number
    weaponCounts: number[]
    setCounts: number[]
  }> = {},
): CommunityCharStats {
  const count = overrides.count ?? 1000
  const wCounts = overrides.weaponCounts ?? [600, 200, 100, 60, 40]
  const sCounts = overrides.setCounts ?? [800, 100, 50, 30, 20]
  return {
    slug,
    name: slug,
    icon: null,
    rarity: overrides.rarity ?? 5,
    element: 'Hydro',
    avatar_id: 10000000,
    count,
    popularity_pct: (count / 40000) * 100,
    avg_constellation: 1.5,
    c6_pct: overrides.c6_pct ?? 10,
    consts: [],
    stopping_points: [],
    stats: {
      hp: { median: overrides.hp ?? 20000, mean: overrides.hp ?? 20000 },
      atk: { median: overrides.atk ?? 2000, mean: overrides.atk ?? 2000 },
      def: { median: overrides.def ?? 800, mean: overrides.def ?? 800 },
      em: { median: overrides.em ?? 50, mean: overrides.emMean ?? overrides.em ?? 50 },
      crit_rate: { median: overrides.cr ?? 70, mean: overrides.cr ?? 70 },
      crit_dmg: { median: overrides.cd ?? 180, mean: overrides.cdMean ?? overrides.cd ?? 180 },
      er: { median: overrides.er ?? 125, mean: overrides.er ?? 125 },
      elem_dmg: { median: overrides.elem ?? 46.6, mean: overrides.elem ?? 46.6 },
    },
    talents: {
      na: { mean: 8, median: 9, mode: 9 },
      es: { mean: 9.5, median: 10, mode: 10 },
      eb: { mean: 9.5, median: 10, mode: 10 },
    },
    weapons: wCounts.map((c, idx) => ({
      ambr_id: 1000 + idx,
      slug: `w-${idx}`,
      name: `Weapon ${idx}`,
      icon: null,
      rarity: 5,
      count: c,
      pct: (c / count) * 100,
    })),
    artifact_sets: sCounts.map((c, idx) => ({
      sets: [{ ambr_id: 2000 + idx, slug: `s-${idx}`, name: `Set ${idx}`, icon: null, pieces: 4 }],
      count: c,
      pct: (c / count) * 100,
    })),
  }
}

describe('community-analytics', () => {
  it('computes normalized Shannon entropy in [0, 1]', () => {
    expect(normalizedEntropy([100])).toBe(0)
    expect(normalizedEntropy([25, 25, 25, 25])).toBeCloseTo(1, 5)
    const skewed = normalizedEntropy([95, 2, 2, 1])
    expect(skewed).toBeGreaterThan(0)
    expect(skewed).toBeLessThan(0.35)
  })

  it('computes Spearman rank correlation accurately', () => {
    const perfect = spearmanCorrelation([1, 2, 3, 4, 5, 6], [10, 20, 30, 40, 50, 60])
    expect(perfect.rho).toBeCloseTo(1, 5)
    expect(perfect.pValue).toBeLessThan(0.01)

    const inverse = spearmanCorrelation([1, 2, 3, 4, 5, 6], [60, 50, 40, 30, 20, 10])
    expect(inverse.rho).toBeCloseTo(-1, 5)
  })

  it('clusters archetypes, runs PCA 2D, detects bimodal builds, and finds nearest neighbors', () => {
    const chars = [
      makeChar('furina', { hp: 38000, atk: 1100, cr: 75, cd: 180, er: 180 }),
      makeChar('yelan', { hp: 33000, atk: 1150, cr: 74, cd: 185, er: 185 }),
      makeChar('kazuha', { hp: 19000, atk: 1400, em: 920, emMean: 810, cr: 20, cd: 70, er: 165 }),
      makeChar('sucrose', { hp: 16000, atk: 1200, em: 860, cr: 18, cd: 65, er: 155 }),
      makeChar('itto', { hp: 20000, atk: 1300, def: 2450, cr: 78, cd: 210, er: 125 }),
      makeChar('chiori', { hp: 18000, atk: 1350, def: 2300, cr: 82, cd: 215, er: 115 }),
      makeChar('hu-tao', { hp: 31000, atk: 1300, em: 210, cr: 75, cd: 225, er: 110 }),
      makeChar('arlecchino', { hp: 19000, atk: 2400, em: 80, cr: 82, cd: 210, er: 110 }),
    ]

    const res = analyzeCommunityDataset(chars, 4)
    expect(res.items).toHaveLength(8)
    expect(res.clusters.length).toBeGreaterThanOrEqual(3)
    expect(res.pcaVariance[0] + res.pcaVariance[1]).toBeGreaterThan(0.5)
    expect(res.mostPolarized[0].slug).toBe('kazuha')

    const neighbors = findNearestNeighbors('furina', res.items, 3)
    expect(neighbors[0].item.slug).toBe('yelan')
  })
})
