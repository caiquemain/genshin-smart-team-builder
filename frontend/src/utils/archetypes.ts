import {
  Sprout, Flower2, Flame, Zap, Droplets, Snowflake, Bomb, Swords, Target,
  Wind, Shield, Moon, Sparkles, Gem,
  type LucideIcon,
} from 'lucide-react'

export const ARCHETYPE_LABELS: Record<string, { label: string; icon: LucideIcon; color: string }> = {
  hyperbloom:        { label: 'Hyperbloom',        icon: Sprout,    color: '#4ade80' },
  bloom:             { label: 'Bloom',             icon: Flower2,   color: '#86efac' },
  burgeon:           { label: 'Burgeon',           icon: Flame,     color: '#fbbf24' },
  quicken:           { label: 'Quicken',           icon: Zap,       color: '#a78bfa' },
  aggravate:         { label: 'Aggravate',         icon: Zap,       color: '#a78bfa' },
  spread:            { label: 'Spread',            icon: Sprout,    color: '#10b981' },
  burning:           { label: 'Burning',           icon: Flame,     color: '#f97316' },
  vaporize:          { label: 'Vaporize',          icon: Droplets,  color: '#7dd3fc' },
  melt:              { label: 'Melt',              icon: Flame,     color: '#fb923c' },
  freeze:            { label: 'Freeze',            icon: Snowflake, color: '#67e8f9' },
  overload:          { label: 'Overload',          icon: Bomb,      color: '#f87171' },
  electro_charged:   { label: 'Electro-Charged',   icon: Zap,       color: '#38bdf8' },
  superconduct:      { label: 'Superconduct',      icon: Zap,       color: '#818cf8' },
  swirl:             { label: 'Swirl',             icon: Wind,      color: '#5eead4' },
  crystallize:       { label: 'Crystallize',       icon: Gem,       color: '#f2c869' },
  lunar_bloom:       { label: 'Lunar-Bloom',       icon: Moon,      color: '#6ee7b7' },
  lunar_charged:     { label: 'Lunar-Charged',     icon: Sparkles,  color: '#818cf8' },
  lunar_crystallize: { label: 'Lunar-Crystallize', icon: Moon,      color: '#fcd34d' },
  hypercarry:        { label: 'Hypercarry',        icon: Swords,    color: '#fbbf24' },
  national:          { label: 'National',          icon: Flame,     color: '#fb923c' },
  mono_pyro:         { label: 'Mono Pyro',         icon: Flame,     color: '#ff9c46' },
  mono_hydro:        { label: 'Mono Hydro',        icon: Droplets,  color: '#4cc2f1' },
  mono_cryo:         { label: 'Mono Cryo',         icon: Snowflake, color: '#93e2ff' },
  mono_electro:      { label: 'Mono Electro',      icon: Zap,       color: '#b398ff' },
  mono_geo:          { label: 'Mono Geo',          icon: Shield,    color: '#f2c869' },
}

export function archetypeInfo(key: string): { label: string; icon: LucideIcon; color: string } {
  return ARCHETYPE_LABELS[key] ?? { label: key === 'unknown' ? 'Misto' : key, icon: Target, color: '#94a3b8' }
}
