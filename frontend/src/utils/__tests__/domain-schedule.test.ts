import { describe, expect, it } from 'vitest'
import plannerDataJson from '../../../public/planner-data.json'
import {
  computeDailyFarmPlan,
  getFamilySchedule,
  getGenshinDayOfWeek,
} from '../domain-schedule'
import type { Plan } from '../../types/planner'
import type { PlannerData } from '../planner-data'

describe('domain-schedule', () => {
  it('covers every talent_book and weapon_ascension family in planner-data.json', () => {
    const data = plannerDataJson as unknown as PlannerData

    const missingFamilies: string[] = []
    for (const [famKey, slugs] of Object.entries(data.families)) {
      const cats = new Set(slugs.map((s) => data.materials[s]?.category).filter(Boolean))
      if (cats.has('talent_book') || cats.has('weapon_ascension')) {
        if (!getFamilySchedule(famKey)) {
          missingFamilies.push(famKey)
        }
      }
    }
    expect(missingFamilies).toEqual([])
  })

  it('respects Genshin 04:00 AM daily reset in getGenshinDayOfWeek', () => {
    // Terça-feira 02:30 -> ainda conta como Segunda (1)
    const tueEarly = new Date(2026, 10, 17, 2, 30, 0) // Nov 17 2026 = Tuesday
    expect(getGenshinDayOfWeek(tueEarly)).toBe(1)

    // Terça-feira 05:00 -> já é Terça (2)
    const tueMorning = new Date(2026, 10, 17, 5, 0, 0)
    expect(getGenshinDayOfWeek(tueMorning)).toBe(2)
  })

  it('filters open talent and weapon domains by weekday, skips inactive chars and completed mats, and opens all on Sunday', () => {
    const data: PlannerData = {
      version: '1',
      characters: {},
      weapons: {},
      materials: {
        'philosophies-of-moonlight': {
          name: { pt: 'Filosofia do Luar' },
          icon: null,
          rarity: 4,
          category: 'talent_book',
          description: {},
          source: {},
        },
        'philosophies-of-elysium': {
          name: { pt: 'Filosofia do Elísio' },
          icon: null,
          rarity: 4,
          category: 'talent_book',
          description: {},
          source: {},
        },
        'pale-star-4': {
          name: { pt: 'Estrela Pálida' },
          icon: null,
          rarity: 4,
          category: 'weapon_ascension',
          description: {},
          source: {},
        },
      },
      global_max: {},
      families: {
        moonlight: ['philosophies-of-moonlight'], // Mon/Thu/Sun
        elysium: ['philosophies-of-elysium'],     // Tue/Fri/Sun
        pale_star: ['pale-star-4'],               // Mon/Thu/Sun
      },
    }

    const plan: Plan = {
      chars: [
        {
          slug: 'vodyanitsa',
          name: 'Vodyanitsa',
          icon: null,
          is_inactive: false,
          ascension: null,
          char_goal: null,
          talent_goal: null,
          talents: {
            grand_total_mora: 450_000,
            grand_total_materials: [
              { slug: 'philosophies-of-moonlight', quantity: 12 },
            ],
          },
          weapons: [
            {
              slug: 'sig-weapon',
              name: 'Arma Assinatura',
              icon: null,
              rarity: 5,
              from_level: 70,
              to_level: 90,
              cost: {
                total_mora: 100_000,
                materials: [{ slug: 'pale-star-4', quantity: 6 }],
              },
            },
          ],
        },
        {
          slug: 'alyosha',
          name: 'Alyosha',
          icon: null,
          is_inactive: false,
          ascension: null,
          char_goal: null,
          talent_goal: null,
          talents: {
            grand_total_mora: 450_000,
            grand_total_materials: [
              { slug: 'philosophies-of-elysium', quantity: 10 },
            ],
          },
          weapons: [],
        },
      ],
      grand_mora: 0,
      grand_resin: 0,
      tier_groups: [],
      warnings: [],
      not_mapped: [],
      travelers_skipped: 0,
      weapons_processed: 1,
      weapons_skipped: 0,
      inventory_resolved: { 'philosophies-of-moonlight': 4 },
      inventory_stats: { mapped: 1, unmapped: 0, ambiguous: 0, total: 1 },
      materials_complete: 0,
      materials_partial: 1,
    }

    // Segunda (1): moonlight (falta 8) + pale_star (falta 6) abertos; elysium (1) em outro dia
    const mon = computeDailyFarmPlan(plan, data, 1, 'pt')
    expect(mon.talentDomains.map((d) => d.familyKey)).toEqual(['moonlight'])
    expect(mon.talentDomains[0].tiers[0].missing).toBe(8)
    expect(mon.weaponDomains.map((d) => d.familyKey)).toEqual(['pale_star'])
    expect(mon.otherDaysCount).toBe(1)

    // Domingo (0): TODOS os 3 abertos
    const sun = computeDailyFarmPlan(plan, data, 0, 'pt')
    expect(sun.openCount).toBe(3)
    expect(sun.otherDaysCount).toBe(0)
  })
})
