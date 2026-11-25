// Estimativas de resina e drop por categoria de material.
// Baseado em observações da comunidade (Genshin Data Gathering Project); ajustável por categoria/raridade/WL.
import {
  getLeylineMoraPerRun,
  getLeylineXpPerRun,
  LEYLINE_MORA_RESIN_PER_RUN,
  LEYLINE_XP_RESIN_PER_RUN,
  XP_BOOK_HERO,
} from './xp-costs'

export interface ResinTier {
  key: 'free' | 'domain20' | 'boss40' | 'weekly'
  label: string
  emoji: string
  color: string
  resinPerRun: number
}

export const TIERS: ResinTier[] = [
  { key: 'free',     label: 'Grátis',           emoji: '🌿', color: '#5fa860', resinPerRun: 0 },
  { key: 'domain20', label: 'Domínios (20)',    emoji: '📖', color: '#5a8fd8', resinPerRun: 20 },
  { key: 'boss40',   label: 'Chefes (40)',      emoji: '👹', color: '#f87171', resinPerRun: 40 },
  { key: 'weekly',   label: 'Bosses Semanais',  emoji: '🐲', color: '#e0a647', resinPerRun: 30 },
]

const CATEGORY_TIER: Record<string, ResinTier['key']> = {
  local_specialty: 'free',
  common_drop: 'free',
  crown: 'free',
  character_exp: 'free',
  weapon_exp: 'free',
  talent_book: 'domain20',
  weapon_ascension: 'domain20',
  ascension_gem: 'boss40',
  boss_material: 'boss40',
  weekly_boss: 'weekly',
}

const AVG_DROP: Record<string, number> = {
  ascension_gem: 1.8,
  boss_material: 2.5,
  weekly_boss: 2.2,
  talent_book: 2.3,
  weapon_ascension: 2.0,
  local_specialty: 1,
  common_drop: 5,
  crown: 1,
  character_exp: 10,
  weapon_exp: 10,
}

export function tierOf(category: string): ResinTier {
  const key = CATEGORY_TIER[category] ?? 'free'
  return TIERS.find((t) => t.key === key) ?? TIERS[0]
}

export function estimateResin(category: string, quantity: number): number {
  const tier = tierOf(category)
  if (tier.resinPerRun === 0) return 0
  const dropRate = AVG_DROP[category] ?? 2
  const runs = Math.ceil(quantity / dropRate)
  return runs * tier.resinPerRun
}

/* ============================================================
   NOVO: estimateResinRange — faixa min/avg/max de runs e resina
   ============================================================ */

export interface ResinRange {
  kind: 'free' | 'mora' | 'resin' | 'complete'
  tier: ResinTier
  quantity: number
  have: number
  minRuns: number
  avgRuns: number
  maxRuns: number
  minResin: number
  avgResin: number
  maxResin: number
  unitLabel?: string
  perRunNote?: string
}

export interface ResinRangeOptions {
  rarity?: number | null
  wl?: number
}

/**
 * Taxas de drop (min / avg / max por run) em AR45+ / WL6–9 (com equivalência de alquimia 3:1
 * para livros de talento, materiais de arma e gemas elementais).
 */
function getDropRates(
  category: string,
  rarity: number | null | undefined,
  wl: number,
): { min: number; avg: number; max: number } {
  if (category === 'boss_material') {
    if (wl >= 9) return { min: 3, avg: 3.15, max: 4 }
    if (wl >= 8) return { min: 2, avg: 2.55, max: 3 }
    return { min: 2, avg: 2.25, max: 3 }
  }
  if (category === 'weekly_boss') {
    return { min: 2, avg: 2.4, max: 3 }
  }
  if (category === 'talent_book') {
    if (rarity === 4) return { min: 0.55, avg: 0.80, max: 1.15 }
    if (rarity === 2) return { min: 5.0, avg: 7.2, max: 9.0 }
    return { min: 1.8, avg: 2.4, max: 3.2 } // 3★ padrão
  }
  if (category === 'weapon_ascension') {
    if (rarity === 5) return { min: 0.28, avg: 0.40, max: 0.58 }
    if (rarity === 4) return { min: 0.85, avg: 1.18, max: 1.6 }
    if (rarity === 2) return { min: 7.0, avg: 10.5, max: 14.0 }
    return { min: 2.5, avg: 3.5, max: 4.8 } // 3★ padrão
  }
  if (category === 'ascension_gem') {
    if (rarity === 5) return { min: 0.18, avg: 0.28, max: 0.42 }
    if (rarity === 4) return { min: 0.55, avg: 0.85, max: 1.25 }
    if (rarity === 2) return { min: 5.0, avg: 7.5, max: 11.0 }
    return { min: 1.7, avg: 2.5, max: 3.7 } // 3★ padrão
  }
  const avg = AVG_DROP[category] ?? 2
  const min = Math.max(1, Math.floor(avg * 0.65))
  const max = Math.max(min, Math.ceil(avg * 1.35))
  return { min, avg, max }
}

export function estimateResinRange(
  category: string,
  quantity: number,
  have: number = 0,
  options: ResinRangeOptions = {},
): ResinRange {
  const wl = options.wl ?? 9
  const rarity = options.rarity ?? null
  const tier = tierOf(category)
  const missing = Math.max(0, quantity - have)
  const empty: Omit<ResinRange, 'kind' | 'tier' | 'quantity' | 'have'> = {
    minRuns: 0, avgRuns: 0, maxRuns: 0,
    minResin: 0, avgResin: 0, maxResin: 0,
  }

  // Já completo na mochila
  if (missing === 0 && quantity > 0) {
    return { kind: 'complete', tier, quantity, have, ...empty }
  }

  // Mora: Linha Ley da Riqueza (fixa por WL)
  if (category === 'mora') {
    const perRun = getLeylineMoraPerRun(wl)
    const runs = missing > 0 ? Math.ceil(missing / perRun) : 0
    const resin = runs * LEYLINE_MORA_RESIN_PER_RUN
    return {
      kind: 'mora',
      tier: {
        key: 'domain20',
        label: 'Linha Ley — Riqueza',
        emoji: '🪙',
        color: '#fbbf24',
        resinPerRun: LEYLINE_MORA_RESIN_PER_RUN,
      },
      quantity,
      have,
      minRuns: runs,
      avgRuns: runs,
      maxRuns: runs,
      minResin: resin,
      avgResin: resin,
      maxResin: resin,
      unitLabel: 'Mora',
      perRunNote: `${(perRun / 1000).toFixed(0)}k Mora/run (WL ${wl})`,
    }
  }

  // Livros de XP (Hero's Wit): Linha Ley da Revelação
  if (category === 'character_exp') {
    const xpPerRun = getLeylineXpPerRun(wl)
    const booksPerRunAvg = xpPerRun / XP_BOOK_HERO
    const booksPerRunMin = booksPerRunAvg * 0.90
    const booksPerRunMax = booksPerRunAvg * 1.10
    const minRuns = missing > 0 ? Math.ceil(missing / booksPerRunMax) : 0
    const avgRuns = missing > 0 ? Math.ceil(missing / booksPerRunAvg) : 0
    const maxRuns = missing > 0 ? Math.ceil(missing / booksPerRunMin) : 0
    return {
      kind: 'resin',
      tier: {
        key: 'domain20',
        label: 'Linha Ley — Revelação',
        emoji: '📘',
        color: '#a78bfa',
        resinPerRun: LEYLINE_XP_RESIN_PER_RUN,
      },
      quantity,
      have,
      minRuns,
      avgRuns,
      maxRuns,
      minResin: minRuns * LEYLINE_XP_RESIN_PER_RUN,
      avgResin: avgRuns * LEYLINE_XP_RESIN_PER_RUN,
      maxResin: maxRuns * LEYLINE_XP_RESIN_PER_RUN,
      unitLabel: 'livros',
      perRunNote: `≈${booksPerRunAvg.toFixed(1)} Hero's Wit/run (WL ${wl})`,
    }
  }

  // Free: farmável sem resina
  if (tier.resinPerRun === 0) {
    return { kind: 'free', tier, quantity, have, ...empty }
  }

  // Resin: faixa min/avg/max calibrada por raridade e WL
  const drops = getDropRates(category, rarity, wl)

  // Melhor sorte = menos runs, pior sorte = mais runs
  const minRuns = Math.ceil(missing / drops.max)
  const avgRuns = Math.ceil(missing / drops.avg)
  const maxRuns = Math.ceil(missing / drops.min)

  return {
    kind: 'resin',
    tier,
    quantity,
    have,
    minRuns, avgRuns, maxRuns,
    minResin: minRuns * tier.resinPerRun,
    avgResin: avgRuns * tier.resinPerRun,
    maxResin: maxRuns * tier.resinPerRun,
    unitLabel: 'un.',
  }
}

export function formatDays(resin: number): string {
  if (resin <= 0) return '—'
  const dailyResin = 180
  const days = Math.ceil(resin / dailyResin)
  if (days === 1) return '~1 dia'
  if (days < 30) return `~${days} dias`
  const months = Math.ceil(days / 30)
  return `~${months} ${months === 1 ? 'mês' : 'meses'}`
}

export function formatResin(n: number): string {
  return n.toLocaleString('pt-BR')
}
