import { describe, it, expect, beforeEach } from 'vitest'
import { buildIndexes, resolveCharSlug, resolveWeaponSlug, normKey } from '../slug-resolver'
import { parseGoodData } from '../good-parser'
import type { PlannerData } from '../planner-data'
import type { GoodData } from '../../types/good'

const plannerStub: PlannerData = {
  version: 'test',
  materials: {},
  families: {},
  global_max: {},
  characters: {
    'kaedehara-kazuha': {
      name: { en: 'Kaedehara Kazuha', pt: 'Kaedehara Kazuha' },
      icon: null,
      element: 'anemo',
      weapon_type: 'sword',
      region: 'inazuma',
      rarity: 5,
      ascension_phases: [],
      talent_phases: {},
    },
    furina: {
      name: { en: 'Furina', pt: 'Furina' },
      icon: null,
      element: 'hydro',
      weapon_type: 'sword',
      region: 'fontaine',
      rarity: 5,
      ascension_phases: [],
      talent_phases: {},
    },
  },
  weapons: {
    'amenoma-kageuchi': {
      name: { en: 'Amenoma Kageuchi', pt: 'Lâmina Amenoma Kageuchi' },
      icon: null,
      weapon_type: 'sword',
      rarity: 4,
      ascension_phases: [],
    },
    'splendor-of-tranquil-waters': {
      name: { en: 'Splendor of Tranquil Waters', pt: 'Esplendor das Águas Silenciosas' },
      icon: null,
      weapon_type: 'sword',
      rarity: 5,
      ascension_phases: [],
    },
  },
}

describe('slug-resolver & good-parser', () => {
  beforeEach(() => {
    buildIndexes(plannerStub)
  })

  it('normalizes keys and resolves slugs and aliases', () => {
    expect(normKey('Kaedehara_Kazuha!')).toBe('kaedeharakazuha')
    expect(resolveCharSlug('KaedeharaKazuha')).toBe('kaedehara-kazuha')
    expect(resolveCharSlug('kazuha')).toBe('kaedehara-kazuha')
    expect(resolveCharSlug('unknown')).toBeNull()

    expect(resolveWeaponSlug('SplendorOfTranquilWaters')).toBe('splendor-of-tranquil-waters')
    expect(resolveWeaponSlug('amenoma_kageuta_blade')).toBe('amenoma-kageuchi')
  })

  it('parses GOOD characters and attaches equipped weapons', () => {
    const good: GoodData = {
      format: 'GOOD',
      version: 2,
      source: 'test',
      characters: [
        {
          key: 'Furina',
          level: 90,
          constellation: 2,
          ascension: 6,
          talent: { auto: 6, skill: 10, burst: 10 },
        },
        {
          key: 'KaedeharaKazuha',
          level: 80,
          constellation: 0,
          ascension: 5,
          talent: { auto: 1, skill: 8, burst: 8 },
        },
      ],
      weapons: [
        {
          key: 'SplendorOfTranquilWaters',
          level: 90,
          ascension: 6,
          refinement: 1,
          location: 'Furina',
        },
        {
          key: 'AmenomaKageuchi',
          level: 70,
          ascension: 4,
          refinement: 5,
          location: '',
        },
      ],
      artifacts: [
        {
          setKey: 'GoldenTroupe',
          slotKey: 'circlet',
          level: 20,
          rarity: 5,
          mainStatKey: 'critRate_',
          location: 'Furina',
          substats: [{ key: 'critDMG_', value: 21.0 }],
        },
        {
          setKey: 'GoldenTroupe',
          slotKey: 'flower',
          level: 20,
          rarity: 5,
          mainStatKey: 'hp',
          location: 'Furina',
          substats: [{ key: 'critRate_', value: 10.5 }],
        },
      ],
    }

    const parsed = parseGoodData(good)
    expect(parsed.size).toBe(2)

    const furina = parsed.get('furina')!
    expect(furina).toMatchObject({
      level: 90,
      ascension: 6,
      cons: 2,
      talents: { na: 6, es: 10, eb: 10 },
      weaponSlug: 'splendor-of-tranquil-waters',
      weaponLevel: 90,
      weaponRefinement: 1,
    })
    // Ordenado flower -> circlet
    expect(furina.artifacts.map((a) => a.slotKey)).toEqual(['flower', 'circlet'])

    const kazuha = parsed.get('kaedehara-kazuha')!
    expect(kazuha.weaponSlug).toBeNull()
    expect(kazuha.weaponLevel).toBe(0)
    expect(kazuha.artifacts).toEqual([])
  })
})

