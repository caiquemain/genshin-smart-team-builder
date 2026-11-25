import { describe, it, expect } from 'vitest'
import {
  CHAR_PHASES,
  WEAPON_5STAR_PHASES,
  XP_BOOK_HERO,
  MYSTIC_ORE_XP,
  FORGE_MORA_PER_ORE,
  getLeylineMoraPerRun,
  getLeylineXpPerRun,
  getOwnedCharXp,
  computeCharXp,
  computeWeaponXp,
  computeMoraLeyline,
} from '../xp-costs'

describe('xp-costs', () => {
  it('returns zero cost when from >= to', () => {
    expect(computeCharXp(90, 90)).toEqual({
      xp: 0, moraLevelUp: 0, heroWits: 0, adventureBooks: 0, wandererBooks: 0, leylineRuns: 0, leylineResin: 0,
    })
    expect(computeCharXp(80, 70).xp).toBe(0)
    expect(computeWeaponXp(90, 90, 5)).toEqual({ xp: 0, moraLevelUp: 0, mysticOres: 0, forgeMora: 0 })
  })

  it('computes exact full 1 -> 90 character XP and mora totals', () => {
    const expectedXp = CHAR_PHASES.reduce((s, p) => s + p.xp, 0)
    const expectedMora = CHAR_PHASES.reduce((s, p) => s + p.mora, 0)
    const res = computeCharXp(1, 90, 9)

    expect(res.xp).toBe(expectedXp)
    expect(res.moraLevelUp).toBe(expectedMora)
    expect(res.heroWits).toBe(Math.ceil(expectedXp / XP_BOOK_HERO))
    expect(res.leylineRuns).toBe(Math.ceil(expectedXp / getLeylineXpPerRun(9)))
    expect(res.leylineResin).toBe(res.leylineRuns * 20)
  })

  it('interpolates partial character phase linearly', () => {
    // Phase 40 -> 50 is 10 levels; 40 -> 45 is 50%
    const phase50 = CHAR_PHASES.find((p) => p.toLevel === 50)!
    const res = computeCharXp(40, 45, 9)
    expect(res.xp).toBe(Math.round(phase50.xp * 0.5))
    expect(res.moraLevelUp).toBe(Math.round(phase50.mora * 0.5))
  })

  it('scales weapon XP and mora by rarity multiplier', () => {
    const five = computeWeaponXp(1, 90, 5)
    const four = computeWeaponXp(1, 90, 4)

    const expected5Xp = WEAPON_5STAR_PHASES.reduce((s, p) => s + p.xp, 0)
    expect(five.xp).toBe(expected5Xp)
    expect(five.mysticOres).toBe(Math.ceil(expected5Xp / MYSTIC_ORE_XP))
    expect(five.forgeMora).toBe(five.mysticOres * FORGE_MORA_PER_ORE)
    expect(four.xp).toBeLessThan(five.xp)
    expect(four.xp / five.xp).toBeCloseTo(0.84, 3)
  })

  it('computes leyline runs according to World Level with WL 6-9 cap', () => {
    expect(getLeylineMoraPerRun(6)).toBe(60_000)
    expect(getLeylineMoraPerRun(9)).toBe(60_000)
    expect(getLeylineMoraPerRun(0)).toBe(12_000)
    expect(getLeylineMoraPerRun(99)).toBe(60_000)

    expect(computeMoraLeyline(0, 9)).toEqual({ runs: 0, resin: 0 })
    expect(computeMoraLeyline(120_000, 9)).toEqual({ runs: 2, resin: 40 })
    expect(computeMoraLeyline(120_001, 9)).toEqual({ runs: 3, resin: 60 })
    expect(computeMoraLeyline(60_000, 0)).toEqual({ runs: 5, resin: 100 })
  })

  it('combines all 3 XP book tiers into total XP and Hero\'s Wit equivalent', () => {
    const res = getOwnedCharXp({
      'hero-s-wit': 10, // 200,000
      'adventurer-s-experience': 8, // 40,000 (= 2 Hero's Wit)
      'wanderer-s-advice': 25, // 25,000 (= 1.25 Hero's Wit)
    })
    expect(res.heroWits).toBe(10)
    expect(res.adventurerExp).toBe(8)
    expect(res.wandererAdvice).toBe(25)
    expect(res.totalXp).toBe(265_000)
    expect(res.heroWitEquivalent).toBe(13) // floor(265,000 / 20,000)
  })
})
