import { describe, expect, it } from 'vitest'
import {
  buildInvestmentAdvice,
  computeReachableCharMilestone,
  computeReachableWeaponMilestone,
  simulatePortfolioAllocation,
} from '../investment-simulator'
import type { PlannerData } from '../planner-data'
import type { UpgradeCandidate } from '../../types'

const MOCK_DATA: PlannerData = {
  version: '1',
  characters: {
    noelle: {
      name: { pt: 'Noelle', en: 'Noelle' },
      icon: 'UI_AvatarIcon_Noel',
      element: 'geo',
      weapon_type: 'claymore',
      rarity: 4,
      region: 'mondstadt',
      ascension_phases: [
        { phase: 1, max_level: 40, mora: 20_000, materials: [{ slug: 'valberry', qty: 3 }] },
        { phase: 2, max_level: 50, mora: 40_000, materials: [{ slug: 'valberry', qty: 10 }, { slug: 'basalt-pillar', qty: 2 }] },
        { phase: 3, max_level: 60, mora: 60_000, materials: [{ slug: 'valberry', qty: 20 }, { slug: 'basalt-pillar', qty: 4 }] },
        { phase: 4, max_level: 70, mora: 80_000, materials: [{ slug: 'valberry', qty: 30 }, { slug: 'basalt-pillar', qty: 8 }] },
        { phase: 5, max_level: 80, mora: 100_000, materials: [{ slug: 'valberry', qty: 45 }, { slug: 'basalt-pillar', qty: 12 }] },
        { phase: 6, max_level: 90, mora: 120_000, materials: [{ slug: 'valberry', qty: 60 }, { slug: 'basalt-pillar', qty: 20 }] },
      ],
      talent_phases: { normal_attack: [], elemental_skill: [], elemental_burst: [] },
    },
    chiori: {
      name: { pt: 'Chiori', en: 'Chiori' },
      icon: 'UI_AvatarIcon_Chiori',
      element: 'geo',
      weapon_type: 'sword',
      rarity: 5,
      region: 'inazuma',
      ascension_phases: [
        { phase: 1, max_level: 40, mora: 20_000, materials: [{ slug: 'dendrobium', qty: 3 }] },
        { phase: 2, max_level: 50, mora: 40_000, materials: [{ slug: 'dendrobium', qty: 10 }] },
      ],
      talent_phases: { normal_attack: [], elemental_skill: [], elemental_burst: [] },
    },
  },
  weapons: {
    'harbinger-of-dawn': {
      name: { pt: 'Prenúncio do Alvorecer', en: 'Harbinger of Dawn' },
      icon: 'UI_EquipIcon_Sword_Dawn',
      rarity: 3,
      weapon_type: 'sword',
      ascension_phases: [
        { phase: 1, max_level: 40, mora: 5_000, materials: [{ slug: 'wolf-tooth', qty: 2 }] },
        { phase: 2, max_level: 50, mora: 10_000, materials: [{ slug: 'wolf-tooth', qty: 4 }] },
      ],
    },
  },
  materials: {
    valberry: { name: { pt: 'Valberry' }, icon: null, rarity: 1, category: 'local_specialty', description: {}, source: {} },
    'basalt-pillar': { name: { pt: 'Pilar de Basalto' }, icon: null, rarity: 4, category: 'boss_material', description: {}, source: {} },
    dendrobium: { name: { pt: 'Dendrobium' }, icon: null, rarity: 1, category: 'local_specialty', description: {}, source: {} },
    'wolf-tooth': { name: { pt: 'Dente de Lobo' }, icon: null, rarity: 2, category: 'weapon_ascension', description: {}, source: {} },
  },
  families: {},
  global_max: {},
}

function makeCandidate(overrides: Partial<UpgradeCandidate> = {}): UpgradeCandidate {
  return {
    slug: 'noelle',
    name: 'Noelle',
    icon: null,
    rarity: 4,
    element: 'geo',
    weapon_type: 'claymore',
    role: 'dps',
    cons: 6,
    has_progress_data: true,
    current_level: 20,
    recommended_level: 90,
    recommended_level_label: 'Nv. 90',
    needs_level_90: true,
    level_scaling_tag: 'Escala com DEF — alto ganho 80->90',
    level_gap: 70,
    talent_priority_text: null,
    talent_levels_needed: 5,
    already_built: false,
    score: 85,
    verdict: 'top_priority',
    verdict_label: 'Alta Prioridade',
    breakdown: { meta_value: 80, team_usage: 80, upgrade_gain: 90, endgame_seasonal: 70 },
    general_tier: 'A',
    general_avg: 80,
    general_sites: 5,
    abyss_tier: null,
    stygian_tier: null,
    ready_teams_count: 2,
    ready_teams: [],
    talents: [
      { key: 'na', label: 'Ataque Normal', current: 4, recommended: 9, needs_upgrade: true },
    ],
    reasons: [],
    ...overrides,
  } as UpgradeCandidate
}

describe('investment-simulator', () => {
  it('computes exact reachable character level and identifies material blocker', () => {
    const reach = computeReachableCharMilestone(
      'noelle',
      1,
      0,
      90,
      6,
      {
        mora: 5_000_000,
        'hero-s-wit': 300,
        valberry: 50,
        'basalt-pillar': 2, // cobre fase 2 (40->50), mas falta para fase 3 (precisa 4)
      },
      MOCK_DATA,
      'pt',
    )

    expect(reach.canAdvanceNow).toBe(true)
    expect(reach.reachableLevel).toBe(50)
    expect(reach.reachableAsc).toBe(2)
    expect(reach.blocker?.kind).toBe('material')
    expect(reach.blocker?.slug).toBe('basalt-pillar')
    expect(reach.blocker?.missing).toBe(4)
  })

  it('computes reachable weapon milestone using all 3 weapon XP ores', () => {
    const reach = computeReachableWeaponMilestone(
      'harbinger-of-dawn',
      1,
      0,
      50,
      {
        mora: 500_000,
        'mystic-enhancement-ore': 10, // 100k XP
        'fine-enhancement-ore': 50,   // 100k XP
        'enhancement-ore': 500,       // 200k XP -> total 400k XP
        'wolf-tooth': 6,
      },
      MOCK_DATA,
      'pt',
    )

    expect(reach).not.toBeNull()
    expect(reach!.reachableLevel).toBe(50)
    expect(reach!.reachableAsc).toBe(2)
    expect(reach!.reachedTarget).toBe(true)
    expect(reach!.blocker).toBeNull()
  })

  it('deducts shared Mora and XP sequentially across portfolio entries and generates ROI advice', () => {
    const noelle = makeCandidate({ slug: 'noelle', name: 'Noelle', current_level: 1, recommended_level: 90, needs_level_90: true })
    const chiori = makeCandidate({
      slug: 'chiori',
      name: 'Chiori',
      current_level: 1,
      recommended_level: 80,
      needs_level_90: false,
      level_scaling_tag: '',
      talents: [],
    })

    const sim = simulatePortfolioAllocation(
      [
        {
          candidate: noelle,
          currentLevel: 1,
          currentAsc: 0,
          targetLevel: 50,
          targetAsc: 2,
          weaponSlug: null,
          weaponName: null,
          weaponLevel: 1,
          weaponAsc: 0,
        },
        {
          candidate: chiori,
          currentLevel: 1,
          currentAsc: 0,
          targetLevel: 50,
          targetAsc: 2,
          weaponSlug: 'harbinger-of-dawn',
          weaponName: 'Prenúncio do Alvorecer',
          weaponLevel: 1,
          weaponAsc: 0,
        },
      ],
      {
        mora: 400_000,
        'hero-s-wit': 40, // ~800k XP (cobre Noelle 1->40, sobra pouco para Chiori)
        'mystic-enhancement-ore': 30,
        valberry: 20,
        'basalt-pillar': 2,
        dendrobium: 20,
        'wolf-tooth': 10,
      },
      MOCK_DATA,
      'pt',
    )

    expect(sim.entries).toHaveLength(2)
    expect(sim.entries[0].charReach.reachableLevel).toBe(40)
    expect(sim.remainingPool.mora).toBeLessThan(sim.initialPool.mora)
    expect(sim.remainingPool.heroWits).toBeLessThan(sim.initialPool.heroWits)

    // Chiori teve arma alocada primeiro e recebeu recomendação de arma 90 + 80/90
    const chioriAdvice = buildInvestmentAdvice(
      chiori,
      sim.entries[1].charReach,
      sim.entries[1].weaponReach,
      'Prenúncio do Alvorecer',
    )
    expect(chioriAdvice.some((s) => s.id === 'weapon-90' && s.roi === 'high')).toBe(true)
    expect(chioriAdvice.some((s) => s.id === 'char-80-90' && s.roi === 'high')).toBe(true)
  })
})
