import type { PlannerData } from './planner-data'
import { pickLang } from './planner-data'

export interface ComputedMaterial {
  slug: string
  name: string
  icon: string | null
  category: string
  rarity: number | null
  quantity: number
  description: string | null
  source: string | null
}

interface ComputedPhase {
  phase: number
  unlock_max_level: number
  mora: number
  materials: ComputedMaterial[]
}

export interface AscensionCostComputed {
  slug: string
  from_level: number
  to_level: number
  phases_included: number[]
  total_mora: number
  materials: ComputedMaterial[]
  phases: ComputedPhase[]
}

interface TalentLevelCost {
  from_level: number
  target_level: number
  levels_included: number[]
  total_mora: number
  materials: ComputedMaterial[]
}

export interface TalentCostComputed {
  slug: string
  talents: {
    normal_attack: TalentLevelCost
    elemental_skill: TalentLevelCost
    elemental_burst: TalentLevelCost
  }
  grand_total_mora: number
  grand_total_materials: ComputedMaterial[]
}

// ── helpers ──────────────────────────────────────────────────────────────

function materialOf(
  data: PlannerData,
  slug: string,
  qty: number,
  lang: string,
): ComputedMaterial {
  const m = data.materials[slug]
  return {
    slug,
    name: m ? pickLang(m.name, lang) : slug,
    icon: m?.icon ?? null,
    category: m?.category ?? 'unknown',
    rarity: m?.rarity ?? null,
    quantity: qty,
    description: m ? pickLang(m.description, lang) : null,
    source: m ? pickLang(m.source, lang) : null,
  }
}

function aggregate(
  data: PlannerData,
  phases: { materials: { slug: string; qty?: number; quantity?: number }[] }[],
  lang: string,
): ComputedMaterial[] {
  const map = new Map<string, number>()
  for (const p of phases) {
    for (const m of p.materials ?? []) {
      const q = m.qty ?? m.quantity ?? 0
      map.set(m.slug, (map.get(m.slug) ?? 0) + q)
    }
  }
  return Array.from(map.entries()).map(([slug, qty]) => materialOf(data, slug, qty, lang))
}

export function aggregatePhases(
  data: PlannerData,
  phases: ComputedPhase[],
  lang: string,
): { materials: ComputedMaterial[]; mora: number } {
  let mora = 0
  for (const p of phases) mora += p.mora
  return { materials: aggregate(data, phases, lang), mora }
}

// ── ascensão personagem ─────────────────────────────────────────────────

export function computeAscensionCost(
  data: PlannerData,
  slug: string,
  fromLevel: number,
  toLevel: number,
  lang: string,
): AscensionCostComputed {
  const char = data.characters[slug]
  if (!char) {
    return {
      slug, from_level: fromLevel, to_level: toLevel,
      phases_included: [], total_mora: 0, materials: [], phases: [],
    }
  }

  const included = char.ascension_phases.filter(
    (p) => fromLevel < p.max_level && p.max_level <= toLevel,
  )

  const phases: ComputedPhase[] = included.map((p) => ({
    phase: p.phase,
    unlock_max_level: p.max_level,
    mora: p.mora,
    materials: aggregate(data, [p], lang),
  }))

  return {
    slug,
    from_level: fromLevel,
    to_level: toLevel,
    phases_included: included.map((p) => p.phase),
    total_mora: phases.reduce((s, p) => s + p.mora, 0),
    materials: aggregate(data, included, lang),
    phases,
  }
}

// ── ascensão arma ───────────────────────────────────────────────────────

export function computeWeaponAscension(
  data: PlannerData,
  slug: string,
  fromLevel: number,
  toLevel: number,
  lang: string,
): AscensionCostComputed {
  const weapon = data.weapons[slug]
  if (!weapon) {
    return {
      slug, from_level: fromLevel, to_level: toLevel,
      phases_included: [], total_mora: 0, materials: [], phases: [],
    }
  }

  const included = weapon.ascension_phases.filter(
    (p) => fromLevel < p.max_level && p.max_level <= toLevel,
  )

  const phases: ComputedPhase[] = included.map((p) => ({
    phase: p.phase,
    unlock_max_level: p.max_level,
    mora: p.mora,
    materials: aggregate(data, [p], lang),
  }))

  return {
    slug,
    from_level: fromLevel,
    to_level: toLevel,
    phases_included: included.map((p) => p.phase),
    total_mora: phases.reduce((s, p) => s + p.mora, 0),
    materials: aggregate(data, included, lang),
    phases,
  }
}

// ── talentos ────────────────────────────────────────────────────────────

function computeOneTalent(
  data: PlannerData,
  phases: { level: number; mora: number; materials: { slug: string; qty: number }[] }[],
  fromLevel: number,
  targetLevel: number,
  lang: string,
): TalentLevelCost {
  if (fromLevel >= targetLevel) {
    return {
      from_level: fromLevel,
      target_level: targetLevel,
      levels_included: [],
      total_mora: 0,
      materials: [],
    }
  }
  const included = phases.filter((p) => fromLevel < p.level && p.level <= targetLevel)
  return {
    from_level: fromLevel,
    target_level: targetLevel,
    levels_included: included.map((p) => p.level),
    total_mora: included.reduce((s, p) => s + p.mora, 0),
    materials: aggregate(data, included, lang),
  }
}

export function computeTalentCost(
  data: PlannerData,
  slug: string,
  na: { current: number; goal: number },
  es: { current: number; goal: number },
  eb: { current: number; goal: number },
  lang: string,
): TalentCostComputed {
  const char = data.characters[slug]
  const empty = (c: number, g: number): TalentLevelCost => ({
    from_level: c, target_level: g, levels_included: [], total_mora: 0, materials: [],
  })
  if (!char) {
    return {
      slug,
      talents: {
        normal_attack: empty(na.current, na.goal),
        elemental_skill: empty(es.current, es.goal),
        elemental_burst: empty(eb.current, eb.goal),
      },
      grand_total_mora: 0,
      grand_total_materials: [],
    }
  }

  const naOut = computeOneTalent(data, char.talent_phases['normal_attack'] ?? [], na.current, na.goal, lang)
  const esOut = computeOneTalent(data, char.talent_phases['elemental_skill'] ?? [], es.current, es.goal, lang)
  const ebOut = computeOneTalent(data, char.talent_phases['elemental_burst'] ?? [], eb.current, eb.goal, lang)

  const matMap = new Map<string, number>()
  for (const t of [naOut, esOut, ebOut]) {
    for (const m of t.materials) {
      matMap.set(m.slug, (matMap.get(m.slug) ?? 0) + m.quantity)
    }
  }
  const grandMaterials = Array.from(matMap.entries()).map(([s, q]) => materialOf(data, s, q, lang))

  return {
    slug,
    talents: { normal_attack: naOut, elemental_skill: esOut, elemental_burst: ebOut },
    grand_total_mora: naOut.total_mora + esOut.total_mora + ebOut.total_mora,
    grand_total_materials: grandMaterials,
  }
}