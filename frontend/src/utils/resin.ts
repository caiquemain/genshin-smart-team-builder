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

// Classificação: categoria → tier
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

// Drop médio por run (heurística)
const AVG_DROP: Record<string, number> = {
  ascension_gem: 1.8,   // ~2 gemas de tier compatível por boss
  boss_material: 2.5,   // ~2-3 por boss
  weekly_boss: 2.2,     // ~2-3 por weekly (limitado a 1x/semana por boss)
  talent_book: 2.3,     // ~2-3 livros por domínio
  weapon_ascension: 2.0,
  local_specialty: 1,   // grátis, 1:1
  common_drop: 5,       // grátis, farm infinito
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

export function formatDays(resin: number): string {
  if (resin <= 0) return '—'
  const dailyResin = 180 // 1 a cada 8min = 180/dia
  const days = Math.ceil(resin / dailyResin)
  if (days === 1) return '~1 dia'
  if (days < 30) return `~${days} dias`
  const months = Math.ceil(days / 30)
  return `~${months} ${months === 1 ? 'mês' : 'meses'}`
}

export function formatResin(n: number): string {
  return n.toLocaleString('pt-BR')
}
