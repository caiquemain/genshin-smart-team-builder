import { describe, it, expect } from 'vitest'
import { resolveInventory, type MaterialLike, type SeelieInventoryItem } from '../inventory-mapper'

const catalog: MaterialLike[] = [
  { slug: 'lakelight-lily', name: { en: 'Lakelight Lily', pt: 'Lírio Luz do Lago' } },
  { slug: 'dup-a', name: { en: 'Same Name' } },
  { slug: 'dup-b', name: { en: 'Same Name' } },
]

const families: Record<string, string[]> = {
  mask: ['damaged-mask', 'stained-mask', 'ominous-mask'],
  spectral: ['spectral-husk', 'spectral-heart', 'spectral-nucleus'],
}

describe('inventory-mapper', () => {
  it('skips non-material types and zero/negative values', () => {
    const items: SeelieInventoryItem[] = [
      { type: 'xp', item: 'hero_wit', tier: 0, value: 100 },
      { type: 'wep_xp', item: 'ore', tier: 0, value: 50 },
      { type: 'resin', item: 'fragile', tier: 0, value: 10 },
      { type: 'common', item: 'mask', tier: 0, value: 0 },
    ]
    const res = resolveInventory(items, catalog, families)
    expect(res.resolved).toEqual({})
    expect(res.ambiguous).toEqual([])
    expect(res.unmapped).toEqual([])
  })

  it('handles Seelie special cases (l_bone tier 2, mora, dream_solvent, crown)', () => {
    const items: SeelieInventoryItem[] = [
      { type: 'common', item: 'l_bone', tier: 0, value: 99 },
      { type: 'common', item: 'l_bone', tier: 1, value: 88 },
      { type: 'common', item: 'l_bone', tier: 2, value: 14 },
      { type: 'currency', item: 'mora', tier: 0, value: 5_000_000 },
      { type: 'special', item: 'dream_solvent', tier: 0, value: 12 },
      { type: 'special', item: 'crown', tier: 0, value: 7 },
    ]
    const res = resolveInventory(items, catalog, families)
    expect(res.resolved).toEqual({
      'lightless-bone': 14,
      mora: 5_000_000,
      'dream-solvent': 12,
      'crown-of-insight': 7,
    })
  })

  it('resolves by family key, family item slug, name fallback, and tracks ambiguous/unmapped', () => {
    const items: SeelieInventoryItem[] = [
      { type: 'common', item: 'mask', tier: 2, value: 40 },
      { type: 'common', item: 'spectral_husk', tier: 0, value: 25 },
      { type: 'specialty', item: 'Lakelight Lily', tier: 0, value: 60 },
      { type: 'misc', item: 'Same Name', tier: 0, value: 5 },
      { type: 'misc', item: 'Totally Unknown Item', tier: 0, value: 3 },
    ]
    const res = resolveInventory(items, catalog, families)
    expect(res.resolved).toEqual({
      'ominous-mask': 40,
      'spectral-husk': 25,
      'lakelight-lily': 60,
    })
    expect(res.ambiguous).toHaveLength(1)
    expect(res.ambiguous[0].item).toBe('Same Name')
    expect(res.unmapped).toHaveLength(1)
    expect(res.unmapped[0].item).toBe('Totally Unknown Item')
  })
})
