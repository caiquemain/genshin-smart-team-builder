import { api } from '../api/client'
import { estimateResin, tierOf, TIERS } from './resin'
import { computeCharXp, computeWeaponXp, computeMoraLeyline } from './xp-costs'
import type { AggregateMaterial, CharBreakdown, TierGroup, Plan } from '../types/planner'
import type { LanguageCode, WeaponSummary } from '../types'

function mergeMats(target: Map<string, AggregateMaterial>, mats: any[]) {
  for (const m of mats ?? []) {
    const existing = target.get(m.slug)
    if (existing) {
      existing.quantity += m.quantity
      existing.resin_estimate = estimateResin(existing.category, existing.quantity)
    } else {
      target.set(m.slug, {
        slug: m.slug, name: m.name, icon: m.icon, rarity: m.rarity,
        category: m.category, description: m.description, source: m.source,
        quantity: m.quantity, resin_estimate: estimateResin(m.category, m.quantity),
      })
    }
  }
}

export interface CharEdit {
  isInactive?: boolean
  goal?: { currentLevel?: number; goalLevel?: number; cons?: number; activePhases?: number[] }
  talent?: {
    na?: { current: number; goal: number }
    es?: { current: number; goal: number }
    eb?: { current: number; goal: number }
  }
  weapons?: Array<{ index: number; weaponSlug?: string; fromLevel?: number; toLevel?: number; activePhases?: number[] }>
  removeWeaponIndex?: number
}

const LEVEL_TO_PHASE: Record<number, number> = { 20: 1, 40: 2, 50: 3, 60: 4, 70: 5, 80: 6 }

function filterPhasesByLevels(phases: any[], activeLevels: number[]): any[] {
  const activePhaseNums = new Set(activeLevels.map((l) => LEVEL_TO_PHASE[l]).filter(Boolean))
  return phases.filter((p) => activePhaseNums.has(p.phase))
}

export async function recomputeChar(
  char: CharBreakdown,
  edit: CharEdit,
  weaponsMap: Map<string, WeaponSummary>,
  lang: LanguageCode,
): Promise<CharBreakdown> {
  const next: CharBreakdown = { ...char, weapons: [...char.weapons] }

  if (edit.isInactive !== undefined) {
    next.is_inactive = edit.isInactive
  }

  if (edit.goal) {
    const curLevel = edit.goal.currentLevel ?? next.char_goal?.current.level ?? 1
    const goalLevel = edit.goal.goalLevel ?? next.char_goal?.goal.level ?? 90
    const cons = edit.goal.cons ?? next.char_goal?.cons ?? 0
    next.char_goal = {
      ...(next.char_goal ?? { type: 'character', character: next.slug }),
      current: { ...(next.char_goal?.current ?? {}), level: curLevel },
      goal: { ...(next.char_goal?.goal ?? {}), level: goalLevel },
      cons,
    }
    if (curLevel < goalLevel) {
      try {
        const full = await api.getAscensionCost(next.slug, curLevel, goalLevel, lang)
        let finalAscension = full
        if (edit.goal.activePhases) {
          const filtered = filterPhasesByLevels(full.phases ?? [], edit.goal.activePhases)
          const mats: any[] = []
          let mora = 0
          for (const p of filtered) { mora += p.mora; mats.push(...p.materials) }
          finalAscension = { ...full, phases: filtered, materials: mats, total_mora: mora, phases_included: filtered.map((p: any) => p.phase) }
        }
        next.ascension = finalAscension
      } catch { next.ascension = null }
    } else {
      next.ascension = null
    }
  }

  if (edit.talent) {
    const na = edit.talent.na ?? next.talent_goal?.normal ?? { current: 1, goal: 1 }
    const es = edit.talent.es ?? next.talent_goal?.skill ?? { current: 1, goal: 1 }
    const eb = edit.talent.eb ?? next.talent_goal?.burst ?? { current: 1, goal: 1 }
    next.talent_goal = {
      ...(next.talent_goal ?? { type: 'talent', character: next.slug }),
      normal: na, skill: es, burst: eb,
    }
    const hasPending = na.current < na.goal || es.current < es.goal || eb.current < eb.goal
    if (hasPending) {
      const target = Math.max(na.goal, es.goal, eb.goal)
      try { next.talents = await api.getTalentCost(next.slug, na.current, es.current, eb.current, target, lang) }
      catch { next.talents = null }
    } else {
      next.talents = null
    }
  }

  if (edit.weapons && edit.weapons.length > 0) {
    for (const wEdit of edit.weapons) {
      const old = next.weapons[wEdit.index]
      const newSlug = wEdit.weaponSlug ?? old?.slug
      const newFrom = wEdit.fromLevel ?? old?.from_level ?? 1
      const newTo = wEdit.toLevel ?? old?.to_level ?? 90
      if (!newSlug) continue
      const wInfo = weaponsMap.get(newSlug)
      let cost = null
      if (newFrom < newTo) {
        try {
          const full = await api.getWeaponAscension(newSlug, newFrom, newTo, lang)
          if (wEdit.activePhases) {
            const filtered = filterPhasesByLevels(full.phases ?? [], wEdit.activePhases)
            const mats: any[] = []
            let mora = 0
            for (const p of filtered) { mora += p.mora; mats.push(...p.materials) }
            cost = { ...full, phases: filtered, materials: mats, total_mora: mora, phases_included: filtered.map((p: any) => p.phase) }
          } else { cost = full }
        } catch {}
      }
      next.weapons[wEdit.index] = {
        slug: newSlug,
        name: wInfo?.name ?? newSlug,
        icon: wInfo?.icon ?? null,
        rarity: wInfo?.rarity ?? 4,
        from_level: newFrom,
        to_level: newTo,
        cost,
      }
    }
  }

  if (edit.removeWeaponIndex != null) next.weapons.splice(edit.removeWeaponIndex, 1)

  next.has_ascension_pending = !!(next.char_goal && next.char_goal.current.level < next.char_goal.goal.level)
  next.has_talent_pending = !!(next.talent_goal && (
    next.talent_goal.normal.current < next.talent_goal.normal.goal ||
    next.talent_goal.skill.current < next.talent_goal.skill.goal ||
    next.talent_goal.burst.current < next.talent_goal.burst.goal
  ))
  next.has_weapon_pending = next.weapons.some((w) => w.from_level < w.to_level)
  next.is_complete = !next.has_ascension_pending && !next.has_talent_pending && !next.has_weapon_pending && !next.is_inactive

  return next
}

export function getXpMaterials(char: CharBreakdown): {
  heroWits: number
  ore: number
  charMora: number
  weaponMora: number
  charLeyline: { runs: number; resin: number }
} {
  const cur = char.char_goal?.current.level
  const goal = char.char_goal?.goal.level
  let heroWits = 0
  let charMora = 0
  let charLeyline = { runs: 0, resin: 0 }
  if (cur != null && goal != null && cur < goal) {
    const c = computeCharXp(cur, goal)
    heroWits = c.heroWits
    charMora = c.moraLevelUp
    charLeyline = { runs: c.leylineRuns, resin: c.leylineResin }
  }

  let ore = 0
  let weaponMora = 0
  for (const w of char.weapons) {
    if (w.from_level < w.to_level) {
      const c = computeWeaponXp(w.from_level, w.to_level, w.rarity)
      ore += c.mysticOres
      weaponMora += c.moraLevelUp + c.forgeMora
    }
  }

  return { heroWits, ore, charMora, weaponMora, charLeyline }
}

export function recomputeAggregates(plan: Plan, inventory: Record<string, number>): Plan {
  const grand_mats = new Map<string, AggregateMaterial>()
  let grand_mora = 0

  for (const c of plan.chars) {
    // INATIVOS NÃO ENTRAM NOS CÁLCULOS GLOBAIS
    if (c.is_inactive) continue

    if (c.ascension) { grand_mora += c.ascension.total_mora ?? 0; mergeMats(grand_mats, c.ascension.materials) }
    if (c.talents) { grand_mora += c.talents.grand_total_mora ?? 0; mergeMats(grand_mats, c.talents.grand_total_materials) }
    for (const wb of c.weapons) {
      if (wb.cost) { grand_mora += wb.cost.total_mora ?? 0; mergeMats(grand_mats, wb.cost.materials) }
    }
    const xp = getXpMaterials(c)
    grand_mora += xp.charMora + xp.weaponMora
  }

  const moraLeyline = computeMoraLeyline(grand_mora)

  const allMats = Array.from(grand_mats.values())
  const tierGroups: TierGroup[] = TIERS.map((tier) => {
    const mats = allMats
      .filter((m) => tierOf(m.category).key === tier.key)
      .sort((a, b) => b.resin_estimate - a.resin_estimate || a.name.localeCompare(b.name))
    const resin = mats.reduce((s, m) => s + m.resin_estimate, 0)
    return { tier, materials: mats, resin_total: resin }
  }).filter((tg) => tg.materials.length > 0)

  const grand_resin = tierGroups.reduce((s, tg) => s + tg.resin_total, 0) + moraLeyline.resin

  let materialsComplete = 0
  let materialsPartial = 0
  for (const m of allMats) {
    const have = inventory[m.slug] ?? 0
    if (have >= m.quantity) materialsComplete++
    else if (have > 0) materialsPartial++
  }

  return {
    ...plan,
    grand_mora,
    grand_resin,
    tier_groups: tierGroups,
    materials_complete: materialsComplete,
    materials_partial: materialsPartial,
  }
}
