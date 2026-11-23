import { describe, expect, it } from 'vitest'
import {
  analyzeStatTargets,
  auditEquippedBuild,
  buildArtifactSetLookup,
  buildWeaponLookup,
  computeCharacterBuildStats,
  getArtifactMainStatValue,
  type CharacterStatsDataset,
} from '../char-stats-calc'
import type { GoodCharState } from '../good-parser'
import type { ArtifactSetSummary, CharacterBuild, WeaponSummary } from '../../types'

const SAMPLE_STATS: CharacterStatsDataset = {
  neuvillette: {
    substat_name: 'CRIT DMG',
    levels: {
      '1': { hp: 1144, atk: 16, def: 45, substat: 0 },
      '80': { hp: 13662, atk: 194, def: 536, substat: 28.8 },
      '90': { hp: 14695, atk: 208, def: 576, substat: 38.4 },
    },
  },
}

const SAMPLE_WEAPONS: WeaponSummary[] = [
  {
    slug: 'tome-of-the-eternal-flow',
    name: 'Tomo do Fluxo Eterno',
    icon: 'UI_EquipIcon_Catalyst_Iudex',
    rarity: 5,
    weapon_type: 'catalyst',
    base_atk: 44,
    max_base_atk: 542,
    secondary_stat: 'crit_dmg',
    secondary_stat_value: 19.2,
    max_secondary_stat_value: 88.2,
    passive_name: null,
    passive_description_r5: null,
  },
]

const SAMPLE_SETS: ArtifactSetSummary[] = [
  {
    slug: 'marechaussee-hunter',
    name: 'Caçador das Sombras',
    icon: 'UI_RelicIcon_15031_4',
    rarity_max: 5,
    two_piece_bonus: 'Normal and Charged Attack DMG +15%',
    four_piece_bonus: null,
  },
  {
    slug: 'emblem-of-severed-fate',
    name: 'Selo da Insulação',
    icon: 'UI_RelicIcon_15020_4',
    rarity_max: 5,
    two_piece_bonus: 'Energy Recharge +20%',
    four_piece_bonus: null,
  },
]

describe('char-stats-calc', () => {
  it('computes 5-star artifact main stat values accurately at lv 20', () => {
    expect(getArtifactMainStatValue('hp', 5, 20)).toBe(4780)
    expect(getArtifactMainStatValue('atk', 5, 20)).toBe(311)
    expect(getArtifactMainStatValue('hp_', 5, 20)).toBeCloseTo(46.6, 1)
    expect(getArtifactMainStatValue('critRate_', 5, 20)).toBeCloseTo(31.1, 1)
    expect(getArtifactMainStatValue('critDMG_', 5, 20)).toBeCloseTo(62.2, 1)
  })

  it('computes full character stats (base + ascension + weapon + 5 artifacts + CV)', () => {
    const goodState: GoodCharState = {
      level: 90,
      ascension: 6,
      cons: 1,
      talents: { na: 10, es: 8, eb: 9 },
      weaponSlug: 'tome-of-the-eternal-flow',
      weaponLevel: 90,
      weaponRefinement: 1,
      artifacts: [
        {
          setKey: 'MarechausseeHunter',
          slotKey: 'flower',
          level: 20,
          rarity: 5,
          mainStatKey: 'hp',
          substats: [
            { key: 'critRate_', value: 10.5 },
            { key: 'critDMG_', value: 21.0 },
            { key: 'hp_', value: 9.9 },
          ],
        },
        {
          setKey: 'MarechausseeHunter',
          slotKey: 'plume',
          level: 20,
          rarity: 5,
          mainStatKey: 'atk',
          substats: [
            { key: 'critRate_', value: 7.0 },
            { key: 'critDMG_', value: 28.0 },
          ],
        },
        {
          setKey: 'MarechausseeHunter',
          slotKey: 'sands',
          level: 20,
          rarity: 5,
          mainStatKey: 'hp_',
          substats: [
            { key: 'critRate_', value: 10.1 },
            { key: 'critDMG_', value: 14.0 },
          ],
        },
        {
          setKey: 'EmblemOfSeveredFate',
          slotKey: 'goblet',
          level: 20,
          rarity: 5,
          mainStatKey: 'hydro_dmg_',
          substats: [
            { key: 'critRate_', value: 6.6 },
            { key: 'critDMG_', value: 20.2 },
          ],
        },
        {
          setKey: 'MarechausseeHunter',
          slotKey: 'circlet',
          level: 20,
          rarity: 5,
          mainStatKey: 'critRate_',
          substats: [
            { key: 'critDMG_', value: 21.8 },
            { key: 'enerRech_', value: 11.7 },
          ],
        },
      ],
    }

    const res = computeCharacterBuildStats({
      slug: 'neuvillette',
      element: 'hydro',
      goodState,
      statsDataset: SAMPLE_STATS,
      weaponLookup: buildWeaponLookup(SAMPLE_WEAPONS),
      artifactSetLookup: buildArtifactSetLookup(SAMPLE_SETS),
    })

    // Base HP 14695 * (1 + (46.6 + 9.9 + 16 Tome R1)/100) + 4780 = 30129
    expect(res.totalHp).toBe(30129)
    expect(res.weaponPassiveBonuses).toContain('+16.0% Vida%')
    // Base ATK = 208 + 542 = 750; +311 plume = 1061
    expect(res.totalAtk).toBe(1061)
    // Crit Rate = 5 + 31.1 + 10.5 + 7.0 + 10.1 + 6.6 = 70.3%
    expect(res.critRate).toBeCloseTo(70.3, 1)
    // Crit DMG = 50 + 38.4 + 88.2 + 21 + 28 + 14 + 20.2 + 21.8 = 281.6%
    expect(res.critDmg).toBeCloseTo(281.6, 1)
    // Hydro DMG = 46.6%
    expect(res.elemDmgBonus).toBeCloseTo(46.6, 1)
    // Substat CV = (21+21) + (14+28) + (20.2+14) + (13.2+20.2) + 21.8 = 173.4
    expect(res.totalCritValue).toBeCloseTo(173.4, 1)
    expect(res.active4pcSlug).toBe('marechaussee-hunter')
    expect(res.activeSets[0].pieces).toBe(4)

    // Auditoria contra build recomendada
    const rec: CharacterBuild = {
      weapons: [],
      artifacts_4pc: [{ artifact_set_slug: 'marechaussee-hunter', notes: null }],
      artifacts_2pc: [],
      sands_stat: ['hp_pct'],
      goblet_stat: ['hydro_dmg', 'hp_pct'],
      circlet_stat: ['crit_rate', 'crit_dmg'],
      substat_priority: [],
      er_requirement: null,
      talent_priority: null,
      notes: null,
      references: [],
      substitutes: [],
      combos: [],
    }
    const audit = auditEquippedBuild(res, rec)
    expect(audit.status).toBe('built')

    // Metas de stats: ER baixo + 4pc Caçador (+36% CR) detectando overcap (70.3 + 36 = 106.3%)
    const advice = analyzeStatTargets(res, {
      ...rec,
      er_requirement: '140-160%',
    })
    const erAdv = advice.find((a) => a.key === 'er')
    const critAdv = advice.find((a) => a.key === 'crit')
    expect(erAdv?.status).toBe('low')
    expect(critAdv?.status).toBe('warn')
    expect(critAdv?.message).toContain('Overcap')
  })

  it('matches in-game Enka stats for Columbina + Nocturne Curtain Call R1 (+10% HP passive)', () => {
    const colDataset: CharacterStatsDataset = {
      columbina: {
        substat_name: 'CRIT Rate',
        levels: {
          '90': { hp: 14695, atk: 96, def: 515, substat: 19.2 },
        },
      },
    }
    const colWeapons: WeaponSummary[] = [
      {
        slug: 'nocturne-s-curtain-call',
        name: 'Cortinas Noturnas',
        icon: 'UI_EquipIcon_Catalyst_Nocturne',
        rarity: 5,
        weapon_type: 'catalyst',
        base_atk: 44,
        max_base_atk: 542,
        secondary_stat: 'crit_dmg',
        secondary_stat_value: 19.2,
        max_secondary_stat_value: 88.2,
        passive_name: null,
        passive_description_r5: null,
      },
      {
        slug: 'staff-of-homa',
        name: 'Báculo de Homa',
        icon: null,
        rarity: 5,
        weapon_type: 'polearm',
        base_atk: 46,
        max_base_atk: 608,
        secondary_stat: 'crit_dmg',
        secondary_stat_value: 14.4,
        max_secondary_stat_value: 66.2,
        passive_name: null,
        passive_description_r5: null,
      },
    ]
    const colSets: ArtifactSetSummary[] = [
      {
        slug: 'night-of-the-skys-unveiling',
        name: 'Noite da Revelação do Céu',
        icon: null,
        rarity_max: 5,
        two_piece_bonus: 'Increases Elemental Mastery by 80.',
        four_piece_bonus: null,
      },
    ]
    const colGood: GoodCharState = {
      level: 90,
      ascension: 6,
      cons: 0,
      talents: { na: 10, es: 10, eb: 10 },
      weaponSlug: 'nocturne-s-curtain-call',
      weaponLevel: 90,
      weaponRefinement: 1,
      artifacts: [
        {
          setKey: 'NightOfTheSkysUnveiling',
          slotKey: 'flower',
          level: 20,
          rarity: 5,
          mainStatKey: 'hp',
          substats: [
            { key: 'def_', value: 11.7 },
            { key: 'critRate_', value: 2.7 },
            { key: 'critDMG_', value: 29.5 },
            { key: 'enerRech_', value: 4.5 },
          ],
        },
        {
          setKey: 'NightOfTheSkysUnveiling',
          slotKey: 'plume',
          level: 20,
          rarity: 5,
          mainStatKey: 'atk',
          substats: [
            { key: 'enerRech_', value: 5.2 },
            { key: 'critDMG_', value: 27.2 },
            { key: 'def', value: 39 },
            { key: 'critRate_', value: 6.6 },
          ],
        },
        {
          setKey: 'NightOfTheSkysUnveiling',
          slotKey: 'sands',
          level: 20,
          rarity: 5,
          mainStatKey: 'hp_',
          substats: [
            { key: 'critRate_', value: 5.4 },
            { key: 'def', value: 23 },
            { key: 'atk_', value: 11.1 },
            { key: 'critDMG_', value: 20.2 },
          ],
        },
        {
          setKey: 'NightOfTheSkysUnveiling',
          slotKey: 'goblet',
          level: 20,
          rarity: 5,
          mainStatKey: 'hp_',
          substats: [
            { key: 'critDMG_', value: 21.0 },
            { key: 'critRate_', value: 3.9 },
            { key: 'def', value: 21 },
            { key: 'enerRech_', value: 17.5 },
          ],
        },
        {
          setKey: 'NightOfTheSkysUnveiling',
          slotKey: 'circlet',
          level: 20,
          rarity: 5,
          mainStatKey: 'critDMG_',
          substats: [
            { key: 'critRate_', value: 13.6 },
            { key: 'enerRech_', value: 6.5 },
            { key: 'hp', value: 538 },
            { key: 'def', value: 44 },
          ],
        },
      ],
    }

    const res = computeCharacterBuildStats({
      slug: 'columbina',
      element: 'hydro',
      goodState: colGood,
      statsDataset: colDataset,
      weaponLookup: buildWeaponLookup(colWeapons),
      artifactSetLookup: buildArtifactSetLookup(colSets),
    })

    // Exato como no Enka/Jogo!
    expect(res.totalHp).toBe(35178)
    expect(res.totalDef).toBe(702)
    expect(res.em).toBe(80)
    expect(res.er).toBeCloseTo(133.7, 1)
    expect(res.totalCritValue).toBeCloseTo(162.3, 1)
    expect(res.weaponPassiveBonuses).toEqual(['+10.0% Vida%'])

    // Staff of Homa R1: +20% HP + 0.8% Max HP convertido em ATQ flat
    const homaRes = computeCharacterBuildStats({
      slug: 'columbina',
      element: 'hydro',
      goodState: { ...colGood, weaponSlug: 'staff-of-homa', weaponRefinement: 1 },
      statsDataset: colDataset,
      weaponLookup: buildWeaponLookup(colWeapons),
      artifactSetLookup: buildArtifactSetLookup(colSets),
    })
    expect(homaRes.totalHp).toBe(36648)
    // 0.8% de 36648 ≈ +293 ATQ adicionado ao ATQ total
    expect(homaRes.totalAtk).toBeGreaterThan(1350)
    expect(homaRes.weaponPassiveBonuses.length).toBe(2)
  })
})
