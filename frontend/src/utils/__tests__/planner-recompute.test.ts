import { describe, it, expect, vi } from 'vitest'
import { getXpMaterials, recomputeAggregates, recomputeChar } from '../planner-recompute'
import * as plannerDataModule from '../planner-data'
import type { CharBreakdown, Plan } from '../../types/planner'
import type { WeaponSummary } from '../../types'

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
    expect(updated.inventory_resolved).toEqual({
      'water-that-failed-to-transcend': 20,
      'lightless-mass': 2,
    })
  })

  it('updates skill/burst talents, clamps goal >= current, preserves active ascension phases, and removes deleted weapons', async () => {
    vi.spyOn(plannerDataModule, 'loadPlannerData').mockResolvedValue({
      version: '1',
      characters: {
        furina: {
          name: { pt: 'Furina', en: 'Furina' },
          icon: 'furina.png',
          element: 'hydro',
          weapon_type: 'sword',
          rarity: 5,
          region: 'fontaine',
          ascension_phases: [
            { phase: 6, max_level: 90, mora: 120_000, materials: [{ slug: 'water-that-failed-to-transcend', qty: 20 }] },
          ],
          talent_phases: {
            normal_attack: [],
            elemental_skill: [{ level: 9, mora: 450_000, materials: [{ slug: 'book-a', qty: 12 }] }],
            elemental_burst: [{ level: 10, mora: 700_000, materials: [{ slug: 'book-a', qty: 16 }] }],
          },
        },
      },
      weapons: {},
      materials: {
        'water-that-failed-to-transcend': {
          name: { pt: 'Água' },
          icon: null,
          rarity: 4,
          category: 'boss_material',
          description: {},
          source: {},
        },
        'book-a': {
          name: { pt: 'Livro A' },
          icon: null,
          rarity: 4,
          category: 'talent_book',
          description: {},
          source: {},
        },
      },
      global_max: {},
      families: {},
    })

    const updated = await recomputeChar(
      makeChar(),
      {
        goal: { currentLevel: 80, goalLevel: 90, cons: 2, activePhases: [80] },
        talent: {
          na: { current: 1, goal: 1 },
          es: { current: 8, goal: 9 },
          eb: { current: 9, goal: 6 }, // current > goal must clamp goal to 9
        },
        weapons: [], // user removed the weapon
      },
      new Map<string, WeaponSummary>(),
      'pt',
    )

    expect(updated.char_goal?.cons).toBe(2)
    expect(updated.ascension?.phases_included).toEqual([6])
    expect(updated.ascension?.total_mora).toBe(120_000)
    expect(updated.talent_goal?.skill).toEqual({ current: 8, goal: 9 })
    expect(updated.talent_goal?.burst).toEqual({ current: 9, goal: 9 })
    expect(updated.talents?.grand_total_mora).toBe(450_000)
    expect(updated.weapons).toEqual([])
    expect(updated.has_talent_pending).toBe(true)
    expect(updated.has_weapon_pending).toBe(false)
  })
})
