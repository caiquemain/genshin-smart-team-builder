/**
 * Fonte única de custos de XP/Mora para personagens e armas.
 * Usa tabelas oficiais do Genshin (1.0 → 5.x).
 */

// XP e Mora para subir um personagem de X para Y.
// Chave = nível de "milestone" (fim da faixa).
export const CHAR_PHASES = [
  { toLevel: 20, xp: 120_175, mora: 24_200 },
  { toLevel: 40, xp: 578_325, mora: 115_800 },
  { toLevel: 50, xp: 579_100, mora: 116_000 },
  { toLevel: 60, xp: 854_125, mora: 171_000 },
  { toLevel: 70, xp: 1_195_925, mora: 239_200 },
  { toLevel: 80, xp: 1_611_875, mora: 322_400 },
  { toLevel: 90, xp: 3_423_125, mora: 684_800 },
] as const

// Arma 5★ (base). Armas 4★ e 3★ usam multiplicadores.
export const WEAPON_5STAR_PHASES = [
  { toLevel: 20, xp: 48_900, mora: 4_890 },
  { toLevel: 40, xp: 194_000, mora: 19_400 },
  { toLevel: 50, xp: 280_200, mora: 28_020 },
  { toLevel: 60, xp: 451_450, mora: 45_145 },
  { toLevel: 70, xp: 708_950, mora: 70_895 },
  { toLevel: 80, xp: 1_125_400, mora: 112_540 },
  { toLevel: 90, xp: 3_233_750, mora: 323_375 },
] as const

// Multiplicador de XP da arma por raridade (5★ = 1.0)
export const WEAPON_RARITY_MULT: Record<number, number> = {
  1: 0.42, 2: 0.54, 3: 0.66, 4: 0.84, 5: 1.0,
}

// Valores de 1 item
export const XP_BOOK_HERO = 20_000       // Hero's Wit
export const XP_BOOK_ADVENTURER = 5_000  // Adventurer's Experience
export const XP_BOOK_WANDERER = 1_000    // Wanderer's Advice

export const MYSTIC_ORE_XP = 10_000      // Mystic Enhancement Ore

// Mora por XP de level up (não é ascensão)
export const CHAR_MORA_PER_XP = 0.2      // 1 mora a cada 5 XP
export const WEAPON_MORA_PER_XP = 0.1    // 1 mora a cada 10 XP

// Mora para forjar 1 Mystic Ore na fonte
export const FORGE_MORA_PER_ORE = 50

// Ley Lines
export const LEYLINE_XP_XP_PER_RUN = 130_000   // ~6-7 livros mistos por run
export const LEYLINE_XP_RESIN_PER_RUN = 20
export const LEYLINE_MORA_MORA_PER_RUN = 60_000
export const LEYLINE_MORA_RESIN_PER_RUN = 20

export interface XpCost {
  xp: number
  moraLevelUp: number
  heroWits: number
  adventureBooks: number
  wandererBooks: number
  // Para Ley Line de XP
  leylineRuns: number
  leylineResin: number
}

export interface WeaponXpCost {
  xp: number
  moraLevelUp: number
  mysticOres: number
  forgeMora: number
}

/**
 * Calcula o custo de XP para subir um personagem de `from` até `to`.
 * Interpola linearmente dentro de cada faixa (ex: 55→65 divide a faixa 50→60 e 60→70).
 */
export function computeCharXp(from: number, to: number): XpCost {
  if (from >= to) {
    return { xp: 0, moraLevelUp: 0, heroWits: 0, adventureBooks: 0, wandererBooks: 0, leylineRuns: 0, leylineResin: 0 }
  }

  let xp = 0
  let mora = 0
  let prevLevel = 1

  for (const phase of CHAR_PHASES) {
    const phaseStart = prevLevel
    const phaseEnd = phase.toLevel
    if (to <= phaseStart) break
    if (from >= phaseEnd) { prevLevel = phaseEnd; continue }

    const actualStart = Math.max(from, phaseStart)
    const actualEnd = Math.min(to, phaseEnd)
    const levelsUsed = actualEnd - actualStart
    const totalLevels = phaseEnd - phaseStart
    const fraction = levelsUsed / totalLevels

    xp += Math.round(phase.xp * fraction)
    mora += Math.round(phase.mora * fraction)
    prevLevel = phaseEnd
  }

  const heroWits = Math.ceil(xp / XP_BOOK_HERO)
  const leylineRuns = Math.ceil(xp / LEYLINE_XP_XP_PER_RUN)

  return {
    xp,
    moraLevelUp: mora,
    heroWits,
    adventureBooks: 0,   // simplificado — usamos só Hero's Wit
    wandererBooks: 0,
    leylineRuns,
    leylineResin: leylineRuns * LEYLINE_XP_RESIN_PER_RUN,
  }
}

/**
 * Calcula XP de arma considerando raridade.
 */
export function computeWeaponXp(from: number, to: number, rarity: number): WeaponXpCost {
  if (from >= to) {
    return { xp: 0, moraLevelUp: 0, mysticOres: 0, forgeMora: 0 }
  }

  const mult = WEAPON_RARITY_MULT[rarity] ?? 1.0
  let xp = 0
  let mora = 0
  let prevLevel = 1

  for (const phase of WEAPON_5STAR_PHASES) {
    const phaseStart = prevLevel
    const phaseEnd = phase.toLevel
    if (to <= phaseStart) break
    if (from >= phaseEnd) { prevLevel = phaseEnd; continue }

    const actualStart = Math.max(from, phaseStart)
    const actualEnd = Math.min(to, phaseEnd)
    const levelsUsed = actualEnd - actualStart
    const totalLevels = phaseEnd - phaseStart
    const fraction = levelsUsed / totalLevels

    xp += Math.round(phase.xp * mult * fraction)
    mora += Math.round(phase.mora * mult * fraction)
    prevLevel = phaseEnd
  }

  const mysticOres = Math.ceil(xp / MYSTIC_ORE_XP)
  const forgeMora = mysticOres * FORGE_MORA_PER_ORE

  return {
    xp,
    moraLevelUp: mora,
    mysticOres,
    forgeMora,
  }
}

/**
 * Calcula quantas runs de Ley Line of Wealth são necessárias pra X Mora.
 */
export function computeMoraLeyline(mora: number): { runs: number; resin: number } {
  if (mora <= 0) return { runs: 0, resin: 0 }
  const runs = Math.ceil(mora / LEYLINE_MORA_MORA_PER_RUN)
  return { runs, resin: runs * LEYLINE_MORA_RESIN_PER_RUN }
}
