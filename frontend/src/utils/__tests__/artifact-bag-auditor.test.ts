import { describe, expect, it } from 'vitest'
import { auditArtifactBag } from '../artifact-bag-auditor'
import type { GoodArtifact } from '../../types/good'
import type { ArtifactSetSummary } from '../../types'

const SETS: ArtifactSetSummary[] = [
  {
    slug: 'emblem-of-severed-fate',
    name: 'Selo da Insulação',
    icon: 'UI_RelicIcon_15020_4',
    rarity_max: 5,
    two_piece_bonus: 'Energy Recharge +20%',
    four_piece_bonus: null,
  },
  {
    slug: 'viridescent-venerer',
    name: 'Sombra Verde',
    icon: 'UI_RelicIcon_15002_4',
    rarity_max: 5,
    two_piece_bonus: 'Anemo DMG Bonus +15%',
    four_piece_bonus: null,
  },
]

describe('artifact-bag-auditor', () => {
  it('identifies double-crit unequipped +0 gems and safe strongbox fodder while ignoring equipped pieces', () => {
    const artifacts: GoodArtifact[] = [
      // Equipada -> deve ser ignorada da mochila
      {
        setKey: 'EmblemOfSeveredFate',
        slotKey: 'flower',
        level: 20,
        rarity: 5,
        mainStatKey: 'hp',
        location: 'RaidenShogun',
        substats: [
          { key: 'critRate_', value: 10.5 },
          { key: 'critDMG_', value: 21.0 },
        ],
      },
      // Joia escondida: Cálice Hydro +0 com Duplo Crítico!
      {
        setKey: 'EmblemOfSeveredFate',
        slotKey: 'goblet',
        level: 0,
        rarity: 5,
        mainStatKey: 'hydro_dmg_',
        location: '',
        lock: false,
        substats: [
          { key: 'critRate_', value: 3.9 },
          { key: 'critDMG_', value: 7.8 },
          { key: 'enerRech_', value: 5.8 },
          { key: 'hp', value: 239 },
        ],
      },
      // Lixo seguro pro Strongbox: Ampulheta DEF% em Selo sem crítico + 2 flats
      {
        setKey: 'EmblemOfSeveredFate',
        slotKey: 'sands',
        level: 0,
        rarity: 5,
        mainStatKey: 'def_',
        location: '',
        lock: false,
        substats: [
          { key: 'hp', value: 299 },
          { key: 'def', value: 21 },
          { key: 'atk', value: 18 },
        ],
      },
      // Joia de EM em Sombra Verde!
      {
        setKey: 'ViridescentVenerer',
        slotKey: 'goblet',
        level: 0,
        rarity: 5,
        mainStatKey: 'eleMas',
        location: '',
        lock: true,
        substats: [
          { key: 'enerRech_', value: 5.8 },
          { key: 'hp', value: 239 },
          { key: 'def', value: 19 },
        ],
      },
    ]

    const report = auditArtifactBag(artifacts, SETS)
    expect(report.totalInGood).toBe(4)
    expect(report.equippedCount).toBe(1)
    expect(report.bagFiveStarCount).toBe(3)
    expect(report.gems).toHaveLength(2)
    expect(report.gems[0].slotKey).toBe('goblet')
    expect(report.gems[0].mainStatKey).toBe('hydro_dmg')
    expect(report.recycle).toHaveLength(1)
    expect(report.recycle[0].mainStatKey).toBe('def_pct')
  })
})
