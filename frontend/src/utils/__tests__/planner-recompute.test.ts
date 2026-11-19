import { describe, it, expect } from 'vitest'
import { getXpMaterials, recomputeAggregates } from '../planner-recompute'
import type { CharBreakdown, Plan } from '../../types/planner'

function makeChar(overrides: Partial<CharBreakdown> = {}): CharBreakdown {
  return {
    slug: 'furina',
    name: 'Furina',
    icon: 'furina.png',
    is_inactive: false,
    is_complete: false,
    has_ascension_pending: true,
    has_talent_pending: false,
    has_weapon_pending: false,
    char_goal: {
      type: 'character',
      character: 'furina',
      current: { level: 80 },
      goal: { level: 90 },
      cons: 0,
    },
    talent_goal: null,
    ascension: {
      slug: 'furina',
      from_level: 80,
      to_level: 90,
      phases_included: [6],
      total_mora: 120_000,
      phases: [],
      materials: [
        {
          slug: 'water-that-failed-to-transcend',
          name: 'Water That Failed To Transcend',
          icon: null,
          category: 'boss_material',
          rarity: 4,
          quantity: 20,
          description: null,
          source: null,
          is_weekly: false,
        },
        {
          slug: 'lightless-mass',
          name: 'Lightless Mass',
          icon: null,
          category: 'boss_material',
          rarity: 5,
          quantity: 6,
          description: null,
          source: null,
          is_weekly: true,
        },
      ],
    },
    talents: null,
    weapons: [
      {
        slug: 'splendor',
        name: 'Splendor',
        icon: null,
        rarity: 5,
        from_level: 80,
        to_level: 90,
        cost: null,
      },
    ],
    ...overrides,
  }
}

describe('planner-recompute', () => {
  it('computes XP materials for character and weapon upgrades', () => {
    const xp = getXpMaterials(makeChar(), 9)
    expect(xp.heroWits).toBeGreaterThan(0)
    expect(xp.ore).toBeGreaterThan(0)
    expect(xp.charMora).toBeGreaterThan(0)
    expect(xp.weaponMora).toBeGreaterThan(0)
    expect(xp.charLeyline.runs).toBeGreaterThan(0)
  })

  it('skips inactive characters, splits normal vs weekly bosses, and counts inventory progress', () => {
    const active = makeChar()
    const inactive = makeChar({ slug: 'skirk', is_inactive: true })
    const basePlan: Plan = {
      chars: [active, inactive],
      grand_mora: 0,
      grand_resin: 0,
      tier_groups: [],
      materials_complete: 0,
      materials_partial: 0,
      not_mapped: [],
      warnings: [],
      travelers_skipped: 0,
      weapons_processed: 1,
      weapons_skipped: 0,
      inventory_resolved: {},
      inventory_stats: { mapped: 0, unmapped: 0, ambiguous: 0, total: 0 },
    }

    const updated = recomputeAggregates(
      basePlan,
      { 'water-that-failed-to-transcend': 20, 'lightless-mass': 2 },
      9,
    )

    // Only active char counted
    const xp = getXpMaterials(active, 9)
    expect(updated.grand_mora).toBe(120_000 + xp.charMora + xp.weaponMora)

    const bossGroup = updated.tier_groups.find((g) => g.tier.key === 'boss40')
    const weeklyGroup = updated.tier_groups.find((g) => g.tier.key === 'weekly')
    expect(bossGroup?.materials.map((m) => m.slug)).toEqual(['water-that-failed-to-transcend'])
    expect(weeklyGroup?.materials.map((m) => m.slug)).toEqual(['lightless-mass'])

    expect(updated.materials_complete).toBe(1)
    expect(updated.materials_partial).toBe(1)
    expect(updated.grand_resin).toBeGreaterThan(0)
  })
})
