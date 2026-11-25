import { describe, it, expect } from 'vitest'
import {
  clampAscForLevel,
  computeAscensionCost,
  computeWeaponAscension,
  computeTalentCost,
  aggregatePhases,
} from '../planner-compute'
import type { PlannerData } from '../planner-data'

const mockData: PlannerData = {
  version: 'test',
  materials: {
    'varunada-sliver': {
      name: { en: 'Varunada Lazurite Sliver', pt: 'Lasca de Lazurita Varunada' },
      icon: 'sliver.png',
      category: 'ascension_gem',
      rarity: 2,
      description: { en: 'Gem', pt: 'Gema' },
      source: { en: 'Boss', pt: 'Chefe' },
    },
    'lakelight-lily': {
      name: { en: 'Lakelight Lily', pt: 'Lírio Luz do Lago' },
      icon: 'lily.png',
      category: 'local_specialty',
      rarity: 1,
      description: {},
      source: {},
    },
    'teachings-justice': {
      name: { en: 'Teachings of Justice', pt: 'Ensinamentos da Justiça' },
      icon: 'book.png',
      category: 'talent_book',
      rarity: 2,
      description: {},
      source: {},
    },
    'dross-dewdrop': {
      name: { en: 'Dross of Pure Sacred Dewdrop', pt: 'Impureza da Gota' },
      icon: 'dew.png',
      category: 'weapon_ascension',
      rarity: 2,
      description: {},
      source: {},
    },
  },
  characters: {
    furina: {
      name: { en: 'Furina', pt: 'Furina' },
      icon: 'furina.png',
      element: 'hydro',
      weapon_type: 'sword',
      region: 'fontaine',
      rarity: 5,
      ascension_phases: [
        { phase: 1, max_level: 40, mora: 20_000, materials: [{ slug: 'varunada-sliver', qty: 1 }, { slug: 'lakelight-lily', qty: 3 }] },
        { phase: 2, max_level: 50, mora: 40_000, materials: [{ slug: 'lakelight-lily', qty: 10 }] },
      ],
      talent_phases: {
        normal_attack: [
          { level: 2, mora: 12_500, materials: [{ slug: 'teachings-justice', qty: 3 }] },
          { level: 3, mora: 17_500, materials: [{ slug: 'teachings-justice', qty: 6 }] },
        ],
        elemental_skill: [
          { level: 2, mora: 12_500, materials: [{ slug: 'teachings-justice', qty: 3 }] },
        ],
        elemental_burst: [
          { level: 2, mora: 12_500, materials: [{ slug: 'teachings-justice', qty: 3 }] },
        ],
      },
    },
  },
  weapons: {
    'splendor-of-tranquil-waters': {
      name: { en: 'Splendor of Tranquil Waters', pt: 'Esplendor das Águas Silenciosas' },
      icon: 'splendor.png',
      weapon_type: 'sword',
      rarity: 5,
      ascension_phases: [
        { phase: 1, max_level: 40, mora: 10_000, materials: [{ slug: 'dross-dewdrop', qty: 5 }] },
        { phase: 2, max_level: 50, mora: 20_000, materials: [{ slug: 'dross-dewdrop', qty: 10 }] },
      ],
    },
  },
  families: {},
  global_max: {},
}

describe('planner-compute', () => {
  it('computes character ascension phases and aggregates materials in chosen language', () => {
    const cost = computeAscensionCost(mockData, 'furina', 1, 50, 'pt')
    expect(cost.phases_included).toEqual([1, 2])
    expect(cost.total_mora).toBe(60_000)

    const lily = cost.materials.find((m) => m.slug === 'lakelight-lily')!
    expect(lily.quantity).toBe(13)
    expect(lily.name).toBe('Lírio Luz do Lago')
  })

  it('returns empty cost for unknown character or weapon', () => {
    expect(computeAscensionCost(mockData, 'missing', 1, 90, 'en').total_mora).toBe(0)
    expect(computeWeaponAscension(mockData, 'missing', 1, 90, 'en').total_mora).toBe(0)
  })

  it('computes weapon ascension across selected level range', () => {
    const cost = computeWeaponAscension(mockData, 'splendor-of-tranquil-waters', 40, 50, 'en')
    expect(cost.phases_included).toEqual([2])
    expect(cost.total_mora).toBe(20_000)
    expect(cost.materials[0].quantity).toBe(10)
  })

  it('computes grand totals across all three talents and respects from >= goal', () => {
    const cost = computeTalentCost(
      mockData,
      'furina',
      { current: 1, goal: 3 },
      { current: 1, goal: 2 },
      { current: 2, goal: 2 },
      'en',
    )
    expect(cost.talents.normal_attack.levels_included).toEqual([2, 3])
    expect(cost.talents.elemental_skill.levels_included).toEqual([2])
    expect(cost.talents.elemental_burst.levels_included).toEqual([])
    expect(cost.grand_total_mora).toBe(42_500)
    expect(cost.grand_total_materials).toHaveLength(1)
    expect(cost.grand_total_materials[0].quantity).toBe(12)
  })

  it('aggregates selected phases cleanly', () => {
    const full = computeAscensionCost(mockData, 'furina', 1, 50, 'en')
    const subset = aggregatePhases(mockData, [full.phases[1]], 'en')
    expect(subset.mora).toBe(40_000)
    expect(subset.materials).toHaveLength(1)
    expect(subset.materials[0].quantity).toBe(10)
  })

  it('handles intermediate levels, 80/80 -> 80/90, 80/90 -> 90, and lowering levels accurately', () => {
    const full6Data: PlannerData = {
      ...mockData,
      characters: {
        furina: {
          ...mockData.characters.furina,
          ascension_phases: [
            { phase: 1, max_level: 40, mora: 20_000, materials: [{ slug: 'lakelight-lily', qty: 3 }] },
            { phase: 2, max_level: 50, mora: 40_000, materials: [{ slug: 'lakelight-lily', qty: 10 }] },
            { phase: 3, max_level: 60, mora: 60_000, materials: [{ slug: 'lakelight-lily', qty: 20 }] },
            { phase: 4, max_level: 70, mora: 80_000, materials: [{ slug: 'lakelight-lily', qty: 30 }] },
            { phase: 5, max_level: 80, mora: 100_000, materials: [{ slug: 'lakelight-lily', qty: 45 }] },
            { phase: 6, max_level: 90, mora: 120_000, materials: [{ slug: 'lakelight-lily', qty: 60 }] },
          ],
        },
      },
    }

    // 75 -> 90: fase 5 (Nv.70) já foi concluída, só cobra fase 6 (Nv.80)
    expect(computeAscensionCost(full6Data, 'furina', 75, 90, 'pt').phases_included).toEqual([6])

    // 81 -> 90: já passou do Nv.80, nenhuma ascensão pendente
    expect(computeAscensionCost(full6Data, 'furina', 81, 90, 'pt').phases_included).toEqual([])

    // 1 -> 75: precisa da fase 5 (Nv.70) para chegar a 75
    expect(computeAscensionCost(full6Data, 'furina', 1, 75, 'pt').phases_included).toEqual([1, 2, 3, 4, 5])

    // 80/80 -> 80/90 (toAsc = 6 ou activePhases = [6]): cobra apenas fase 6
    const asc80to90 = computeAscensionCost(full6Data, 'furina', 80, 80, 'pt', { fromAsc: 5, toAsc: 6 })
    expect(asc80to90.phases_included).toEqual([6])
    expect(asc80to90.total_mora).toBe(120_000)

    // 80/90 -> 90 (fromAsc = 6): já ascendido, 0 fases
    expect(computeAscensionCost(full6Data, 'furina', 80, 90, 'pt', { fromAsc: 6 }).phases_included).toEqual([])

    // activePhases deduplica materiais iguais entre fases
    const multi = computeAscensionCost(full6Data, 'furina', 1, 90, 'pt', { activePhases: [1, 2, 6] })
    expect(multi.phases_included).toEqual([1, 2, 6])
    expect(multi.materials).toHaveLength(1)
    expect(multi.materials[0].quantity).toBe(3 + 10 + 60)

    // Voltar níveis para baixo rebaixa a ascensão fisicamente
    expect(clampAscForLevel(40, 6)).toBe(2)
    expect(clampAscForLevel(55, 6)).toBe(3)
    expect(clampAscForLevel(1, 6)).toBe(0)
    expect(clampAscForLevel(80, 6)).toBe(6)
  })
})
