const PCT_STATS = new Set([
  'crit_rate', 'crit_dmg', 'hp_pct', 'atk_pct', 'def_pct',
  'er', 'healing_bonus', 'physical_dmg',
  'pyro_dmg', 'hydro_dmg', 'electro_dmg', 'cryo_dmg',
  'anemo_dmg', 'geo_dmg', 'dendro_dmg',
])

const STAT_LABELS: Record<string, string> = {
  hp: 'HP',
  atk: 'ATK',
  def: 'DEF',
  hp_pct: 'HP%',
  atk_pct: 'ATK%',
  def_pct: 'DEF%',
  em: 'Proficiência Elemental',
  er: 'Recarga de Energia',
  crit_rate: 'Taxa Crítica',
  crit_dmg: 'Dano Crítico',
  healing_bonus: 'Bônus de Cura',
  physical_dmg: 'Dano Físico',
  pyro_dmg: 'Dano Pyro',
  hydro_dmg: 'Dano Hydro',
  electro_dmg: 'Dano Electro',
  cryo_dmg: 'Dano Cryo',
  anemo_dmg: 'Dano Anemo',
  geo_dmg: 'Dano Geo',
  dendro_dmg: 'Dano Dendro',
}

export function formatStatLabel(stat: string | null | undefined): string {
  if (!stat) return '—'
  return STAT_LABELS[stat] ?? stat.replace(/_/g, ' ')
}

export function formatStatValue(stat: string | null | undefined, value: number | null): string {
  if (value == null) return '—'
  if (stat && PCT_STATS.has(stat)) return `${value.toFixed(1)}%`
  return String(Math.round(value))
}
