export interface CategoryInfo {
  label: string
  color: string
  bg: string
}

const MAP: Record<string, CategoryInfo> = {
  ascension_gem:    { label: 'Gema de Ascensão',    color: '#a35bd8', bg: 'rgba(163, 91, 216, 0.15)' },
  boss_material:    { label: 'Material de Boss',    color: '#f87171', bg: 'rgba(248, 113, 113, 0.15)' },
  local_specialty:  { label: 'Especialidade Local', color: '#5fa860', bg: 'rgba(95, 168, 96, 0.15)' },
  common_drop:      { label: 'Drop Comum',          color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.12)' },
  talent_book:      { label: 'Livro de Talento',    color: '#5a8fd8', bg: 'rgba(90, 143, 216, 0.15)' },
  weekly_boss:      { label: 'Boss Semanal',        color: '#e0a647', bg: 'rgba(224, 166, 71, 0.15)' },
  crown:            { label: 'Coroa',               color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.15)' },
  weapon_ascension: { label: 'Ascensão de Arma',    color: '#c084fc', bg: 'rgba(192, 132, 252, 0.15)' },
  weapon_exp:       { label: 'EXP de Arma',         color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.15)' },
  mora:             { label: 'Mora',                color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.15)' },
  character_exp:    { label: 'EXP de Personagem',   color: '#22c55e', bg: 'rgba(34, 197, 94, 0.15)' },
}

export function categoryInfo(cat: string): CategoryInfo {
  return MAP[cat] ?? {
    label: cat.replace(/_/g, ' '),
    color: '#94a3b8',
    bg: 'rgba(148, 163, 184, 0.12)',
  }
}
