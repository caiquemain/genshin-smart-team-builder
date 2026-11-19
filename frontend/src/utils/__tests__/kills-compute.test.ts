import { describe, it, expect } from 'vitest'
import {
  getWLDropMultiplier,
  calculateKills,
  calculateFamilyKills,
} from '../kills-compute'
import type { BestiaryData } from '../../types/bestiary'

const bestiary: BestiaryData = {
  hilichurl: {
    id: '1',
    name: 'Hilichurl',
    type: 'HILICHURL',
    icon: 'hili.png',
    description: 'Common enemy',
    drops: [
      { slug: 'damaged-mask', name: 'Damaged Mask', rarity: 1, rate: 50, rate_raw: '50%', icon: '' },
      { slug: 'stained-mask', name: 'Stained Mask', rarity: 2, rate: 10, rate_raw: '10%', icon: '' },
    ],
  },
  mitachurl: {
    id: '2',
    name: 'Mitachurl',
    type: 'HILICHURL',
    icon: 'mita.png',
    description: 'Elite enemy',
    drops: [
      { slug: 'damaged-mask', name: 'Damaged Mask', rarity: 1, rate: 100, rate_raw: '100%', icon: '' },
      { slug: 'stained-mask', name: 'Stained Mask', rarity: 2, rate: 25, rate_raw: '25%', icon: '' },
      { slug: 'ominous-mask', name: 'Ominous Mask', rarity: 3, rate: 10, rate_raw: '10%', icon: '' },
    ],
  },
}

describe('kills-compute', () => {
  it('returns WL drop multiplier table with default fallback 1.0', () => {
    expect(getWLDropMultiplier(0)).toBe(0.3)
    expect(getWLDropMultiplier(5)).toBe(0.8)
    expect(getWLDropMultiplier(9)).toBe(1.0)
    expect(getWLDropMultiplier(42)).toBe(1.0)
  })

  it('picks highest drop-rate monster and scales kills by WL', () => {
    expect(calculateKills('damaged-mask', 0, 9, bestiary)).toBeNull()
    expect(calculateKills('nonexistent-drop', 10, 9, bestiary)).toBeNull()

    // Mitachurl has 100% rate at WL 9 -> 10 kills for 10 items
    const wl9 = calculateKills('damaged-mask', 10, 9, bestiary)!
    expect(wl9.monsterName).toBe('Mitachurl')
    expect(wl9.kills).toBe(10)
    expect(wl9.dropRate).toBe(100)

    // At WL 2 (0.5x) -> 50% rate -> 20 kills
    const wl2 = calculateKills('damaged-mask', 10, 2, bestiary)!
    expect(wl2.kills).toBe(20)
    expect(wl2.dropRate).toBe(50)
  })

  it('applies 3:1 alchemy surplus conversion across family tiers', () => {
    const family = ['damaged-mask', 'stained-mask', 'ominous-mask']

    // Need 10 stained-mask, have 30 damaged-mask -> 30 / 3 = 10 via alchemy -> 0 kills!
    const covered = calculateFamilyKills(
      family,
      { 'damaged-mask': 30 },
      { 'stained-mask': 10 },
      9,
      bestiary,
    )
    expect(covered).toBeNull()

    // Need 2 ominous-mask, have 9 damaged-mask (converts to 3 stained -> 1 ominous) -> missing 1 ominous -> 10 kills (10% rate)
    const partial = calculateFamilyKills(
      family,
      { 'damaged-mask': 9 },
      { 'ominous-mask': 2 },
      9,
      bestiary,
    )!
    expect(partial.monsterName).toBe('Mitachurl')
    expect(partial.kills).toBe(10)
  })
})
