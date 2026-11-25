import { describe, expect, it } from 'vitest'
import { artifactPieceIconUrl } from '../../config'

describe('artifactPieceIconUrl', () => {
  it('maps each GOOD slot key to its Genshin UI_RelicIcon suffix', () => {
    const base = 'UI_RelicIcon_15020_4'
    expect(artifactPieceIconUrl(base, 'flower')).toBe('/icons/UI_RelicIcon_15020_4.webp?v=3')
    expect(artifactPieceIconUrl(base, 'plume')).toBe('/icons/UI_RelicIcon_15020_2.webp?v=3')
    expect(artifactPieceIconUrl(base, 'sands')).toBe('/icons/UI_RelicIcon_15020_5.webp?v=3')
    expect(artifactPieceIconUrl(base, 'goblet')).toBe('/icons/UI_RelicIcon_15020_1.webp?v=3')
    expect(artifactPieceIconUrl(base, 'circlet')).toBe('/icons/UI_RelicIcon_15020_3.webp?v=3')
  })

  it('supports EQUIP_* slot keys from Ambr/Enka', () => {
    const base = 'UI_RelicIcon_15041_4'
    expect(artifactPieceIconUrl(base, 'EQUIP_BRACER')).toBe('/icons/UI_RelicIcon_15041_4.webp?v=3')
    expect(artifactPieceIconUrl(base, 'EQUIP_NECKLACE')).toBe('/icons/UI_RelicIcon_15041_2.webp?v=3')
    expect(artifactPieceIconUrl(base, 'EQUIP_SHOES')).toBe('/icons/UI_RelicIcon_15041_5.webp?v=3')
    expect(artifactPieceIconUrl(base, 'EQUIP_RING')).toBe('/icons/UI_RelicIcon_15041_1.webp?v=3')
    expect(artifactPieceIconUrl(base, 'EQUIP_DRESS')).toBe('/icons/UI_RelicIcon_15041_3.webp?v=3')
  })

  it('preserves 1-piece circlet-only sets and handles missing inputs', () => {
    expect(artifactPieceIconUrl('UI_RelicIcon_15009_3', 'circlet')).toBe('/icons/UI_RelicIcon_15009_3.webp?v=3')
    expect(artifactPieceIconUrl('UI_RelicIcon_15009_3', 'flower')).toBe('/icons/UI_RelicIcon_15009_3.webp?v=3')
    expect(artifactPieceIconUrl(null, 'plume')).toBeNull()
    expect(artifactPieceIconUrl('UI_RelicIcon_15020_4', null)).toBe('/icons/UI_RelicIcon_15020_4.webp?v=3')
  })
})
