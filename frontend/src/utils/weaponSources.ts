import {
  Sparkles, Hammer, Gift, Crown, Fish, ShoppingBag, ScrollText, Compass, Star,
  type LucideIcon,
} from 'lucide-react'

export interface WeaponObtainSourceMeta {
  key: string
  label: string
  shortLabel: string
  color: string
  bg: string
  border: string
  isF2p: boolean
  icon: LucideIcon
}

export const WEAPON_OBTAIN_SOURCES: Record<string, WeaponObtainSourceMeta> = {
  gacha_limited: {
    key: 'gacha_limited',
    label: 'Gacha (Banner)',
    shortLabel: 'Banner',
    color: '#fbbf24',
    bg: 'rgba(245, 158, 11, 0.14)',
    border: 'rgba(245, 158, 11, 0.42)',
    isF2p: false,
    icon: Sparkles,
  },
  gacha: {
    key: 'gacha',
    label: 'Gacha',
    shortLabel: 'Gacha',
    color: '#c084fc',
    bg: 'rgba(168, 85, 247, 0.14)',
    border: 'rgba(168, 85, 247, 0.4)',
    isF2p: false,
    icon: Star,
  },
  craftable: {
    key: 'craftable',
    label: 'Craftável',
    shortLabel: 'Forja',
    color: '#4ade80',
    bg: 'rgba(34, 197, 94, 0.14)',
    border: 'rgba(34, 197, 94, 0.4)',
    isF2p: true,
    icon: Hammer,
  },
  event: {
    key: 'event',
    label: 'Evento',
    shortLabel: 'Evento',
    color: '#fb7185',
    bg: 'rgba(244, 63, 94, 0.14)',
    border: 'rgba(244, 63, 94, 0.4)',
    isF2p: true,
    icon: Gift,
  },
  battle_pass: {
    key: 'battle_pass',
    label: 'Passe de Batalha',
    shortLabel: 'Passe (BP)',
    color: '#fb923c',
    bg: 'rgba(249, 115, 22, 0.14)',
    border: 'rgba(249, 115, 22, 0.42)',
    isF2p: false,
    icon: Crown,
  },
  fishing: {
    key: 'fishing',
    label: 'Pesca',
    shortLabel: 'Pesca',
    color: '#38bdf8',
    bg: 'rgba(14, 165, 233, 0.14)',
    border: 'rgba(14, 165, 233, 0.42)',
    isF2p: true,
    icon: Fish,
  },
  starglitter: {
    key: 'starglitter',
    label: 'Loja Paimon',
    shortLabel: 'Loja Paimon',
    color: '#facc15',
    bg: 'rgba(234, 179, 8, 0.14)',
    border: 'rgba(234, 179, 8, 0.4)',
    isF2p: true,
    icon: ShoppingBag,
  },
  quest: {
    key: 'quest',
    label: 'Missão',
    shortLabel: 'Missão',
    color: '#2dd4bf',
    bg: 'rgba(20, 184, 166, 0.14)',
    border: 'rgba(20, 184, 166, 0.4)',
    isF2p: true,
    icon: ScrollText,
  },
  world: {
    key: 'world',
    label: 'Mundo / Baú',
    shortLabel: 'Mundo',
    color: '#94a3b8',
    bg: 'rgba(148, 163, 184, 0.14)',
    border: 'rgba(148, 163, 184, 0.35)',
    isF2p: true,
    icon: Compass,
  },
}

export const WEAPON_OBTAIN_FILTER_ORDER: Array<{ key: string; label: string; color: string }> = [
  { key: 'f2p', label: 'F2P (todas grátis)', color: '#34d399' },
  { key: 'craftable', label: 'Craftável', color: '#4ade80' },
  { key: 'event', label: 'Evento', color: '#fb7185' },
  { key: 'fishing', label: 'Pesca', color: '#38bdf8' },
  { key: 'quest', label: 'Missão', color: '#2dd4bf' },
  { key: 'starglitter', label: 'Loja Paimon', color: '#facc15' },
  { key: 'world', label: 'Mundo / Baú', color: '#94a3b8' },
  { key: 'battle_pass', label: 'Passe (BP)', color: '#fb923c' },
  { key: 'gacha', label: 'Gacha', color: '#c084fc' },
  { key: 'gacha_limited', label: 'Gacha (Banner)', color: '#fbbf24' },
]

export function weaponObtainInfo(source: string | null | undefined): WeaponObtainSourceMeta | null {
  if (!source) return null
  return WEAPON_OBTAIN_SOURCES[source] ?? null
}
