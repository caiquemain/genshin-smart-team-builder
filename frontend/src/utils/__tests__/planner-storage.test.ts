import { beforeEach, describe, expect, it } from 'vitest'
import {
  PLANNER_PLAN_KEY,
  PLANNER_V5_KEY,
  ROSTER_KEY,
  addCharToPlan,
  compactPlanForStorage,
  getSavedEnkaUid,
  hydratePlanFromData,
  loadManualInventory,
  loadPlanFromStorage,
  loadPlannerSettings,
  mergeEnkaImportIntoStorage,
  removeCharFromPlan,
  saveManualCharacterGear,
  savePlanToStorage,
  syncCharEditToPlannerStorage,
  syncInventoryItemToPlannerStorage,
} from '../planner-storage'
import type { CharBreakdown, Plan } from '../../types/planner'
import type { PlannerData } from '../planner-data'

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

const SAMPLE_DATA: PlannerData = {
  version: '1',
  characters: {},
  weapons: {},
  materials: {
    'philosophies-of-moonlight': {
      name: { pt: 'Filosofia do Luar', en: 'Philosophies of Moonlight' },
      icon: 'UI_ItemIcon_104358',
      rarity: 4,
      category: 'talent_book',
      description: { pt: 'Descrição longa de teste que ocupa espaço no localStorage.' },
      source: { pt: 'Domínio de Proficiência' },
      is_weekly: false,
    },
  },
  global_max: {},
  families: {},
}

function makePlan(): Plan {
  return {
    chars: [
      {
        slug: 'vodyanitsa',
        name: 'Vodyanitsa',
        icon: 'UI_AvatarIcon_Vodyanitsa',
        is_inactive: false,
        is_complete: false,
        has_ascension_pending: true,
        has_talent_pending: true,
        has_weapon_pending: false,
        char_goal: {
          type: 'character',
          character: 'vodyanitsa',
          current: { level: 80, asc: 5 },
          goal: { level: 90, asc: 6 },
          cons: 1,
        },
        talent_goal: {
          type: 'talent',
          character: 'vodyanitsa',
          normal: { current: 1, goal: 1 },
          skill: { current: 9, goal: 10 },
          burst: { current: 8, goal: 10 },
        },
        ascension: {
          slug: 'vodyanitsa',
          from_level: 80,
          to_level: 90,
          phases_included: [6],
          total_mora: 120_000,
          phases: [
            {
              phase: 6,
              unlock_max_level: 90,
              mora: 120_000,
              materials: [
                {
                  slug: 'philosophies-of-moonlight',
                  name: 'Filosofia do Luar',
                  icon: 'UI_ItemIcon_104358',
                  category: 'talent_book',
                  rarity: 4,
                  quantity: 6,
                  description: 'Descrição longa duplicada',
                  source: 'Domínio',
                },
              ],
            },
          ],
          materials: [
            {
              slug: 'philosophies-of-moonlight',
              name: 'Filosofia do Luar',
              icon: 'UI_ItemIcon_104358',
              category: 'talent_book',
              rarity: 4,
              quantity: 6,
              description: 'Descrição longa duplicada',
              source: 'Domínio',
            },
          ],
        },
        talents: {
          slug: 'vodyanitsa',
          talents: {
            normal_attack: { from_level: 1, target_level: 1, levels_included: [], total_mora: 0, materials: [] },
            elemental_skill: {
              from_level: 9,
              target_level: 10,
              levels_included: [10],
              total_mora: 700_000,
              materials: [
                {
                  slug: 'philosophies-of-moonlight',
                  name: 'Filosofia do Luar',
                  icon: 'UI_ItemIcon_104358',
                  category: 'talent_book',
                  rarity: 4,
                  quantity: 16,
                  description: 'Descrição longa duplicada',
                  source: 'Domínio',
                },
              ],
            },
            elemental_burst: { from_level: 8, target_level: 10, levels_included: [9, 10], total_mora: 1_150_000, materials: [] },
          },
          grand_total_mora: 1_850_000,
          grand_total_materials: [
            {
              slug: 'philosophies-of-moonlight',
              name: 'Filosofia do Luar',
              icon: 'UI_ItemIcon_104358',
              category: 'talent_book',
              rarity: 4,
              quantity: 16,
              description: 'Descrição longa duplicada',
              source: 'Domínio',
            },
          ],
        },
        weapons: [],
      },
    ],
    grand_mora: 1_970_000,
    grand_resin: 1000,
    tier_groups: [
      {
        tier: { key: 'talent', label: 'Talentos', color: '#38bdf8' },
        resin_total: 400,
        materials: [
          {
            slug: 'philosophies-of-moonlight',
            name: 'Filosofia do Luar',
            icon: 'UI_ItemIcon_104358',
            category: 'talent_book',
            rarity: 4,
            quantity: 16,
            resin_estimate: 400,
            description: 'Descrição longa duplicada',
            source: 'Domínio',
          },
        ],
      },
    ],
    warnings: [],
    not_mapped: [],
    travelers_skipped: 0,
    weapons_processed: 0,
    weapons_skipped: 0,
    inventory_resolved: {},
    inventory_stats: { mapped: 0, unmapped: 0, ambiguous: 0, total: 0 },
    materials_complete: 0,
    materials_partial: 0,
  }
}

describe('planner-storage', () => {
  beforeEach(() => {
    ;(globalThis as any).localStorage = makeMemoryStorage()
  })

  it('compacts plan by stripping redundant description/source/phases and hydrates back from planner-data', () => {
    const plan = makePlan()
    const compact = compactPlanForStorage(plan)

    expect(compact.chars[0].ascension.phases).toBeUndefined()
    expect(compact.chars[0].ascension.materials[0].description).toBeUndefined()
    expect(compact.chars[0].talents.grand_total_materials[0].source).toBeUndefined()
    expect(compact.tier_groups[0].materials[0].description).toBeUndefined()

    expect(savePlanToStorage(plan)).toBe(true)
    const loaded = loadPlanFromStorage(SAMPLE_DATA, 'pt')
    expect(loaded).not.toBeNull()
    expect(loaded!.chars[0].ascension.materials[0].description).toBe(
      'Descrição longa de teste que ocupa espaço no localStorage.',
    )
    expect(loaded!.tier_groups[0].materials[0].source).toBe('Domínio de Proficiência')

    // Ensure raw stored JSON is compact
    const rawStored = localStorage.getItem(PLANNER_PLAN_KEY)!
    expect(rawStored).not.toContain('Descrição longa')

    // Direct hydrate preserves existing fields when material not in catalog
    const hydrated = hydratePlanFromData(compact, SAMPLE_DATA, 'en')
    expect(hydrated.chars[0].talents.grand_total_materials[0].name).toBe('Philosophies of Moonlight')
  })

  it('syncs edited character level, talents, constellation, inactive flag, and weapons into gsb.planner.v5 and roster', () => {
    localStorage.setItem(
      PLANNER_V5_KEY,
      JSON.stringify({
        good: {
          format: 'GOOD',
          version: 2,
          source: 'test',
          characters: [
            {
              key: 'Vodyanitsa',
              level: 70,
              ascension: 4,
              constellation: 0,
              talent: { auto: 1, skill: 6, burst: 6 },
            },
          ],
          weapons: [
            {
              key: 'LostPrayerToTheSacredWinds',
              level: 70,
              ascension: 4,
              refinement: 1,
              location: 'Vodyanitsa',
            },
          ],
        },
        seelie: {
          ar: 60,
          wl: 9,
          inventory: [],
          inactive: {},
          goals: [
            {
              type: 'character',
              character: 'vodyanitsa',
              id: 1,
              cons: 0,
              current: { level: 70, asc: 4 },
              goal: { level: 80, asc: 5 },
            },
            {
              type: 'talent',
              character: 'vodyanitsa',
              id: 2,
              normal: { current: 1, goal: 1 },
              skill: { current: 6, goal: 8 },
              burst: { current: 6, goal: 8 },
            },
            {
              type: 'weapon',
              character: 'vodyanitsa',
              weapon: 'old-weapon',
              id: 3,
              current: { level: 50, asc: 2 },
              goal: { level: 80, asc: 5 },
            },
          ],
        },
      }),
    )

    localStorage.setItem(
      ROSTER_KEY,
      JSON.stringify({
        vodyanitsa: { owned: true, cons: 0 },
      }),
    )

    const updatedChar: CharBreakdown = {
      slug: 'vodyanitsa',
      name: 'Vodyanitsa',
      icon: null,
      ascension: null,
      talents: null,
      is_inactive: true,
      char_goal: {
        type: 'character',
        character: 'vodyanitsa',
        current: { level: 80, asc: 5 },
        goal: { level: 90, asc: 6 },
        cons: 2,
      },
      talent_goal: {
        type: 'talent',
        character: 'vodyanitsa',
        normal: { current: 1, goal: 1 },
        skill: { current: 9, goal: 10 },
        burst: { current: 9, goal: 9 },
      },
      weapons: [
        {
          slug: 'lost-prayer-to-the-sacred-winds',
          name: 'Lost Prayer',
          icon: null,
          rarity: 5,
          from_level: 80,
          to_level: 90,
          cost: null,
        },
      ],
    }

    expect(syncCharEditToPlannerStorage(updatedChar)).toBe(true)

    const v5 = JSON.parse(localStorage.getItem(PLANNER_V5_KEY)!)
    // GOOD updated
    expect(v5.good.characters[0]).toMatchObject({
      key: 'Vodyanitsa',
      level: 80,
      constellation: 2,
      talent: { auto: 1, skill: 9, burst: 9 },
    })
    expect(v5.good.weapons[0].level).toBe(80)

    // Seelie updated
    expect(v5.seelie.inactive.vodyanitsa).toBe(true)
    const charGoal = v5.seelie.goals.find((g: any) => g.type === 'character')
    expect(charGoal.current.level).toBe(80)
    expect(charGoal.goal.level).toBe(90)
    expect(charGoal.cons).toBe(2)

    const talGoal = v5.seelie.goals.find((g: any) => g.type === 'talent')
    expect(talGoal.skill).toEqual({ current: 9, goal: 10 })
    expect(talGoal.burst).toEqual({ current: 9, goal: 9 })

    // Old weapon replaced by updated weapon list
    const weaponGoals = v5.seelie.goals.filter((g: any) => g.type === 'weapon')
    expect(weaponGoals).toHaveLength(1)
    expect(weaponGoals[0].weapon).toBe('lost-prayer-to-the-sacred-winds')
    expect(weaponGoals[0].current.level).toBe(80)
    expect(weaponGoals[0].goal.level).toBe(90)

    // Manual roster override constellation updated
    const roster = JSON.parse(localStorage.getItem(ROSTER_KEY)!)
    expect(roster.vodyanitsa.cons).toBe(2)
  })

  it('does not create a fake GOOD object when user only imported Seelie', () => {
    localStorage.setItem(
      PLANNER_V5_KEY,
      JSON.stringify({
        seelie: { goals: [], inventory: [], inactive: {} },
        good: null,
      }),
    )

    syncCharEditToPlannerStorage({
      slug: 'vodyanitsa',
      name: 'Vodyanitsa',
      icon: null,
      ascension: null,
      talents: null,
      weapons: [],
      char_goal: { current: { level: 80 }, goal: { level: 90 }, cons: 0 },
      talent_goal: {
        normal: { current: 1, goal: 1 },
        skill: { current: 8, goal: 9 },
        burst: { current: 8, goal: 9 },
      },
    })

    const v5 = JSON.parse(localStorage.getItem(PLANNER_V5_KEY)!)
    expect(v5.good).toBeNull()
    expect(v5.seelie.goals).toHaveLength(2)
  })

  it('supports starting completely from scratch without JSON: manual inventory, addCharToPlan, deduplication, and removeCharFromPlan', () => {
    const richData: PlannerData = {
      ...SAMPLE_DATA,
      characters: {
        vodyanitsa: {
          name: { pt: 'Vodyanitsa', en: 'Vodyanitsa' },
          icon: 'UI_AvatarIcon_Vodyanitsa',
          element: 'hydro',
          weapon_type: 'catalyst',
          rarity: 5,
          region: 'snezhnaya',
          ascension_phases: [
            { phase: 6, max_level: 90, mora: 120_000, materials: [{ slug: 'philosophies-of-moonlight', qty: 6 }] },
          ],
          talent_phases: {
            normal_attack: [],
            elemental_skill: [{ level: 9, mora: 450_000, materials: [{ slug: 'philosophies-of-moonlight', qty: 12 }] }],
            elemental_burst: [{ level: 9, mora: 450_000, materials: [{ slug: 'philosophies-of-moonlight', qty: 12 }] }],
          },
        },
      },
    }

    // 1) Manual inventory works even when localStorage is completely empty
    syncInventoryItemToPlannerStorage('philosophies-of-moonlight', 10, richData)
    expect(loadManualInventory()).toEqual({ 'philosophies-of-moonlight': 10 })

    // 2) Adding first character creates a full plan from scratch
    const res1 = addCharToPlan(null, 'vodyanitsa', richData, 'pt', 9, {
      currentLevel: 80,
      goalLevel: 90,
      es: { current: 8, goal: 9 },
      eb: { current: 8, goal: 9 },
    })
    expect(res1).not.toBeNull()
    expect(res1!.added).toBe(true)
    expect(res1!.plan.chars).toHaveLength(1)
    expect(res1!.plan.inventory_resolved['philosophies-of-moonlight']).toBe(10)
    expect(res1!.plan.grand_mora).toBeGreaterThan(1_000_000)

    // 3) Re-adding the same character does not duplicate
    const res2 = addCharToPlan(res1!.plan, 'vodyanitsa', richData, 'pt', 9)
    expect(res2!.added).toBe(false)
    expect(res2!.plan.chars).toHaveLength(1)

    // 4) Removing the character updates plan & storage
    const afterRemove = removeCharFromPlan(res1!.plan, 'vodyanitsa', 9)
    expect(afterRemove.chars).toHaveLength(0)
    expect(afterRemove.grand_mora).toBe(0)
    expect(loadPlanFromStorage()?.chars).toHaveLength(0)
  })

  it('merges Enka UID showcase into roster, AR/WL settings, and planner without losing existing roster chars', () => {
    localStorage.setItem(ROSTER_KEY, JSON.stringify({ furina: { owned: true, cons: 2 } }))
    const richData: PlannerData = {
      ...SAMPLE_DATA,
      characters: {
        vodyanitsa: {
          name: { pt: 'Vodyanitsa', en: 'Vodyanitsa' },
          icon: 'UI_AvatarIcon_Vodyanitsa',
          element: 'hydro',
          weapon_type: 'catalyst',
          rarity: 5,
          region: 'snezhnaya',
          ascension_phases: [
            { phase: 6, max_level: 90, mora: 120_000, materials: [{ slug: 'philosophies-of-moonlight', qty: 6 }] },
          ],
          talent_phases: {
            normal_attack: [],
            elemental_skill: [{ level: 9, mora: 450_000, materials: [{ slug: 'philosophies-of-moonlight', qty: 12 }] }],
            elemental_burst: [{ level: 9, mora: 450_000, materials: [{ slug: 'philosophies-of-moonlight', qty: 12 }] }],
          },
        },
      },
      weapons: {
        'sig-catalyst': {
          name: { pt: 'Catalisador Teste' },
          icon: null,
          weapon_type: 'catalyst',
          rarity: 5,
          ascension_phases: [
            { phase: 6, max_level: 90, mora: 65_000, materials: [{ slug: 'philosophies-of-moonlight', qty: 4 }] },
          ],
        },
      },
    }

    const summary = mergeEnkaImportIntoStorage(
      {
        uid: '612345678',
        nickname: 'AetherBR',
        ar: 59,
        wl: 8,
        signature: null,
        ttl: 60,
        showcase_hidden: false,
        unmapped_avatar_ids: [],
        characters: [
          {
            slug: 'vodyanitsa',
            avatar_id: 10000120,
            name: 'Vodyanitsa',
            icon: 'UI_AvatarIcon_Vodyanitsa',
            rarity: 5,
            element: 'hydro',
            level: 80,
            ascension: 5,
            cons: 1,
            na: 1,
            es: 8,
            eb: 8,
            has_detail: true,
            weapon: {
              slug: 'sig-catalyst',
              item_id: 14599,
              name: 'Catalisador Teste',
              icon: null,
              rarity: 5,
              level: 80,
              ascension: 5,
              refinement: 1,
            },
          },
        ],
      },
      ['vodyanitsa'],
      richData,
      'pt',
    )

    expect(summary).toEqual({ rosterUpdated: 1, plannerAdded: 1, plannerUpdated: 0 })
    expect(getSavedEnkaUid()).toBe('612345678')
    expect(loadPlannerSettings()).toEqual({ ar: 59, wl: 8, resinMode: 20 })

    const rawV5 = JSON.parse(localStorage.getItem(PLANNER_V5_KEY)!)
    localStorage.setItem(PLANNER_V5_KEY, JSON.stringify({ ...rawV5, resinMode: 60 }))
    expect(loadPlannerSettings()).toEqual({ ar: 59, wl: 8, resinMode: 60 })

    const roster = JSON.parse(localStorage.getItem(ROSTER_KEY)!)
    expect(roster.furina).toEqual({ owned: true, cons: 2 }) // preservado!
    expect(roster.vodyanitsa).toEqual({ owned: true, cons: 1 })

    const plan = loadPlanFromStorage()!
    expect(plan.chars).toHaveLength(1)
    expect(plan.chars[0].char_goal.current.level).toBe(80)
    expect(plan.chars[0].talent_goal.skill).toEqual({ current: 8, goal: 9 })
    expect(plan.chars[0].weapons[0].slug).toBe('sig-catalyst')
    expect(plan.chars[0].weapons[0].from_level).toBe(80)
  })

  it('saveManualCharacterGear funciona do zero (sem GOOD) e preserva artefatos de outros personagens', () => {
    // 1. Sem nenhum GOOD JSON prévio, salva artefatos + arma de Neuvillette
    saveManualCharacterGear({
      slug: 'neuvillette',
      level: 90,
      cons: 1,
      weaponSlug: 'tome-of-the-eternal-flow',
      weaponLevel: 90,
      weaponRefinement: 1,
      artifacts: [
        {
          setKey: 'marechaussee-hunter',
          slotKey: 'flower',
          level: 20,
          rarity: 5,
          mainStatKey: 'hp',
          substats: [
            { key: 'critRate_', value: 10.5 },
            { key: 'critDMG_', value: 21.0 },
          ],
        },
      ],
    })

    // 2. Salva artefatos de Furina sem apagar os do Neuvillette
    saveManualCharacterGear({
      slug: 'furina',
      level: 90,
      cons: 0,
      artifacts: [
        {
          setKey: 'golden-troupe',
          slotKey: 'plume',
          level: 20,
          rarity: 5,
          mainStatKey: 'atk',
          substats: [{ key: 'critDMG_', value: 28.0 }],
        },
      ],
    })

    // 3. Atualiza artefatos de Neuvillette (substitui só os dele)
    saveManualCharacterGear({
      slug: 'neuvillette',
      level: 90,
      artifacts: [
        {
          setKey: 'marechaussee-hunter',
          slotKey: 'flower',
          level: 20,
          rarity: 5,
          mainStatKey: 'hp',
          substats: [{ key: 'critDMG_', value: 35.0 }],
        },
      ],
    })

    const v5 = JSON.parse(localStorage.getItem(PLANNER_V5_KEY)!)
    expect(v5.good.format).toBe('GOOD')
    expect(v5.good.characters).toHaveLength(2)
    expect(v5.good.artifacts).toHaveLength(2)

    const neuviArt = v5.good.artifacts.find((a: any) => a.location === 'neuvillette')
    const furinaArt = v5.good.artifacts.find((a: any) => a.location === 'furina')
    expect(neuviArt.substats).toEqual([{ key: 'critDMG_', value: 35 }])
    expect(furinaArt.setKey).toBe('golden-troupe')
  })
})

