// Estimativas de resina e drop por categoria de material.
// Baseado em observações da comunidade; ajustável por categoria.

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
}

export function estimateResinRange(
  category: string,
  quantity: number,
  have: number = 0,
): ResinRange {
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

  // Mora: caso especial
  if (category === 'mora') {
    return { kind: 'mora', tier, quantity, have, ...empty }
  }

  // Free: farmável sem resina
  if (tier.resinPerRun === 0) {
    return { kind: 'free', tier, quantity, have, ...empty }
  }

  // Resin: faixa min/avg/max
  const avgDrop = AVG_DROP[category] ?? 2
  const dropMin = Math.max(1, Math.floor(avgDrop * 0.6))  // pior sorte ~60%
  const dropMax = Math.max(dropMin, Math.ceil(avgDrop * 1.4)) // melhor sorte ~140%

  // Melhor sorte = menos runs, pior sorte = mais runs
  const minRuns = Math.ceil(missing / dropMax)
  const avgRuns = Math.ceil(missing / avgDrop)
  const maxRuns = Math.ceil(missing / dropMin)

  return {
    kind: 'resin',
    tier,
    quantity,
    have,
    minRuns, avgRuns, maxRuns,
    minResin: minRuns * tier.resinPerRun,
    avgResin: avgRuns * tier.resinPerRun,
    maxResin: maxRuns * tier.resinPerRun,
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
