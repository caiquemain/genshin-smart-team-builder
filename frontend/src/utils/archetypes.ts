import { 
  Sprout, Flower2, Flame, Zap, Droplets, Snowflake, Bomb, Swords, Target,
  type LucideIcon
} from 'lucide-react'

export const ARCHETYPE_LABELS: Record<string, { label: string; icon: LucideIcon; color: string }> = {
  hyperbloom:  { label: 'Hyperbloom',   icon: Sprout,    color: '#4ade80' },
  bloom:       { label: 'Bloom',        icon: Flower2,   color: '#86efac' },
  burgeon:     { label: 'Burgeon',      icon: Flame,     color: '#fbbf24' },
  quicken:     { label: 'Quicken',      icon: Zap,       color: '#a78bfa' },
  aggravate:   { label: 'Aggravate',    icon: Zap,       color: '#a78bfa' },
  spread:      { label: 'Spread',       icon: Sprout,    color: '#10b981' },
  vaporize:    { label: 'Vaporize',     icon: Droplets,  color: '#7dd3fc' },
  melt:        { label: 'Melt',         icon: Flame,     color: '#fb923c' },
  freeze:      { label: 'Freeze',       icon: Snowflake, color: '#67e8f9' },
  overload:    { label: 'Overload',     icon: Bomb,      color: '#f87171' },
  superconduct:{ label: 'Superconduct', icon: Zap,       color: '#818cf8' },
  hypercarry:  { label: 'Hypercarry',   icon: Swords,    color: '#fbbf24' },
  national:    { label: 'National',     icon: Flame,     color: '#fb923c' },
}

export function archetypeInfo(key: string): { label: string; icon: LucideIcon; color: string } {
  return ARCHETYPE_LABELS[key] ?? { label: key, icon: Target, color: '#94a3b8' }
}
