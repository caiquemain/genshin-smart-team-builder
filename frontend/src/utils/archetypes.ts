export const ARCHETYPE_LABELS: Record<string, { label: string; emoji: string; color: string }> = {
  hyperbloom:  { label: 'Hyperbloom',   emoji: '🌿', color: '#4ade80' },
  bloom:       { label: 'Bloom',        emoji: '🌸', color: '#86efac' },
  burgeon:     { label: 'Burgeon',      emoji: '🔥', color: '#fbbf24' },
  quicken:     { label: 'Quicken',      emoji: '⚡', color: '#a78bfa' },
  aggravate:   { label: 'Aggravate',    emoji: '⚡', color: '#a78bfa' },
  spread:      { label: 'Spread',       emoji: '🌱', color: '#10b981' },
  vaporize:    { label: 'Vaporize',     emoji: '💧', color: '#7dd3fc' },
  melt:        { label: 'Melt',         emoji: '🔥', color: '#fb923c' },
  freeze:      { label: 'Freeze',       emoji: '❄️', color: '#67e8f9' },
  overload:    { label: 'Overload',     emoji: '💥', color: '#f87171' },
  superconduct:{ label: 'Superconduct', emoji: '⚡', color: '#818cf8' },
  hypercarry:  { label: 'Hypercarry',   emoji: '⚔️', color: '#fbbf24' },
  national:    { label: 'National',     emoji: '🔥', color: '#fb923c' },
}

export function archetypeInfo(key: string) {
  return ARCHETYPE_LABELS[key] ?? { label: key, emoji: '🎯', color: '#94a3b8' }
}
