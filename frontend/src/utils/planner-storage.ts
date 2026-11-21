import type { AggregateMaterial, CharBreakdown, Plan, WeaponBreakdown } from '../types/planner'
import type { GoodCharacter, GoodData } from '../types/good'
import type {
  SeelieCharacterGoal,
  SeelieData,
  SeelieGoal,
  SeelieTalentGoal,
  SeelieWeaponGoal,
} from '../types/seelie'
import { pickLang, type PlannerData } from './planner-data'
import { normKey, resolveCharSlug, resolveWeaponSlug } from './slug-resolver'
import { resolveInventory, type SeelieInventoryItem } from './inventory-mapper'
import { computeAscensionCost, computeTalentCost } from './planner-compute'
import { recomputeAggregates } from './planner-recompute'

export const PLANNER_V5_KEY = 'gsb.planner.v5'
export const PLANNER_PLAN_KEY = 'gsb.planner.plan'
export const ROSTER_KEY = 'gsb.roster.v1'
export const PLANNER_UPDATED_EVENT = 'gsb:planner-updated'

const EXTRA_CHAR_ALIASES: Record<string, string> = {
  ayaka: 'kamisatoayaka',
  ayato: 'kamisatoayato',
  kazuha: 'kaedeharakazuha',
  kokomi: 'sangonomiyakokomi',
  raiden: 'raidenshogun',
  shogun: 'raidenshogun',
  shinobu: 'kukishinobu',
  kuki: 'kukishinobu',
  yae: 'yaemiko',
  miko: 'yaemiko',
  itto: 'aratakiitto',
  sara: 'kujousara',
  heizou: 'shikanoinheizou',
  mizuki: 'yumemizukimizuki',
  yunjin: 'yunjin',
  lanyan: 'lanyan',
}

function canonicalCharKey(input: string): string {
  const resolved = resolveCharSlug(input)
  const raw = normKey(resolved || input)
  return EXTRA_CHAR_ALIASES[raw] || raw
}

function canonicalWeaponKey(input: string): string {
  const resolved = resolveWeaponSlug(input)
  return normKey(resolved || input)
}

function inferAscensionFromLevel(level: number): number {
  if (level > 80) return 6
  if (level > 70) return 5
  if (level > 60) return 4
  if (level > 50) return 3
  if (level > 40) return 2
  if (level > 20) return 1
  return 0
}

function stripMaterial(m: any): any {
  if (!m || typeof m !== 'object') return m
  const { description: _d, source: _s, ...rest } = m
  return rest
}

function stripAscension(asc: any): any {
  if (!asc || typeof asc !== 'object') return asc
  const { phases: _phases, ...rest } = asc
  return {
    ...rest,
    materials: Array.isArray(asc.materials) ? asc.materials.map(stripMaterial) : [],
  }
}

function stripTalents(tal: any): any {
  if (!tal || typeof tal !== 'object') return tal
  const stripSlot = (slot: any) =>
    slot && typeof slot === 'object'
      ? { ...slot, materials: Array.isArray(slot.materials) ? slot.materials.map(stripMaterial) : [] }
      : slot
  return {
    ...tal,
    talents: tal.talents
      ? {
          normal_attack: stripSlot(tal.talents.normal_attack),
          elemental_skill: stripSlot(tal.talents.elemental_skill),
          elemental_burst: stripSlot(tal.talents.elemental_burst),
        }
      : tal.talents,
    grand_total_materials: Array.isArray(tal.grand_total_materials)
      ? tal.grand_total_materials.map(stripMaterial)
      : [],
  }
}

/**
 * Remove campos textuais pesados e redundantes (description, source, phases)
 * antes de gravar o plano no localStorage para evitar QuotaExceededError silencioso.
 */
export function compactPlanForStorage(plan: Plan): Plan {
  return {
    ...plan,
    chars: plan.chars.map((c) => ({
      ...c,
      ascension: stripAscension(c.ascension),
      talents: stripTalents(c.talents),
      weapons: (c.weapons ?? []).map((w: WeaponBreakdown) => ({
        ...w,
        cost: stripAscension(w.cost),
      })),
    })),
    tier_groups: (plan.tier_groups ?? []).map((tg) => ({
      ...tg,
      materials: (tg.materials ?? []).map(stripMaterial),
    })),
  }
}

function hydrateMaterial(m: any, data: PlannerData, lang: string): any {
  if (!m || typeof m !== 'object' || !m.slug) return m
  const meta = data.materials[m.slug]
  if (!meta) return m
  return {
    ...m,
    name: pickLang(meta.name, lang) || m.name,
    icon: meta.icon ?? m.icon,
    rarity: meta.rarity ?? m.rarity,
    category: meta.category ?? m.category,
    description: pickLang(meta.description, lang) || m.description || null,
    source: pickLang(meta.source, lang) || m.source || null,
    is_weekly: meta.is_weekly ?? m.is_weekly,
  }
}

function hydrateAscension(asc: any, data: PlannerData, lang: string): any {
  if (!asc || typeof asc !== 'object') return asc
  return {
    ...asc,
    materials: Array.isArray(asc.materials)
      ? asc.materials.map((m: any) => hydrateMaterial(m, data, lang))
      : [],
  }
}

function hydrateTalents(tal: any, data: PlannerData, lang: string): any {
  if (!tal || typeof tal !== 'object') return tal
  const hydrateSlot = (slot: any) =>
    slot && typeof slot === 'object'
      ? {
          ...slot,
          materials: Array.isArray(slot.materials)
            ? slot.materials.map((m: any) => hydrateMaterial(m, data, lang))
            : [],
        }
      : slot
  return {
    ...tal,
    talents: tal.talents
      ? {
          normal_attack: hydrateSlot(tal.talents.normal_attack),
          elemental_skill: hydrateSlot(tal.talents.elemental_skill),
          elemental_burst: hydrateSlot(tal.talents.elemental_burst),
        }
      : tal.talents,
    grand_total_materials: Array.isArray(tal.grand_total_materials)
      ? tal.grand_total_materials.map((m: any) => hydrateMaterial(m, data, lang))
      : [],
  }
}

export function hydratePlanFromData(plan: Plan, data: PlannerData | null, lang: string): Plan {
  if (!data) return plan
  return {
    ...plan,
    chars: (plan.chars ?? []).map((c) => ({
      ...c,
      ascension: hydrateAscension(c.ascension, data, lang),
      talents: hydrateTalents(c.talents, data, lang),
      weapons: (c.weapons ?? []).map((w) => ({
        ...w,
        cost: hydrateAscension(w.cost, data, lang),
      })),
    })),
    tier_groups: (plan.tier_groups ?? []).map((tg) => ({
      ...tg,
      materials: (tg.materials ?? []).map((m: AggregateMaterial) => hydrateMaterial(m, data, lang)),
    })),
  }
}

export function emitPlannerUpdated(): void {
  try {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent(PLANNER_UPDATED_EVENT))
    }
  } catch {}
}

export function savePlanToStorage(plan: Plan): boolean {
  try {
    const compact = compactPlanForStorage(plan)
    localStorage.setItem(PLANNER_PLAN_KEY, JSON.stringify(compact))
    emitPlannerUpdated()
    return true
  } catch (err) {
    console.error('[planner-storage] Falha ao salvar gsb.planner.plan:', err)
    return false
  }
}

export function loadPlanFromStorage(data?: PlannerData | null, lang: string = 'pt'): Plan | null {
  try {
    const raw = localStorage.getItem(PLANNER_PLAN_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Plan
    if (!parsed || !Array.isArray(parsed.chars)) return null
    return data ? hydratePlanFromData(parsed, data, lang) : parsed
  } catch (err) {
    console.error('[planner-storage] Falha ao ler gsb.planner.plan:', err)
    return null
  }
}

interface PlannerV5Payload {
  seelie?: SeelieData | null
  good?: GoodData | null
}

/**
 * Sincroniza uma edição feita em um personagem no PlannerCharacterModal de volta
 * para `gsb.planner.v5` (GOOD e Seelie) e para override manual do Roster (se existir),
 * garantindo que recarregar, recalcular o plano ou abrir o Pull Advisor / Quem Upar
 * mantenha sempre os valores editados.
 */
export function syncCharEditToPlannerStorage(updatedChar: CharBreakdown): boolean {
  const targetKey = canonicalCharKey(updatedChar.slug)
  const curLevel = updatedChar.char_goal?.current?.level
  const goalLevel = updatedChar.char_goal?.goal?.level
  const cons = updatedChar.char_goal?.cons
  const na = updatedChar.talent_goal?.normal
  const es = updatedChar.talent_goal?.skill
  const eb = updatedChar.talent_goal?.burst

  let saved = true
  try {
    const rawV5 = localStorage.getItem(PLANNER_V5_KEY)
    if (rawV5) {
      const v5 = JSON.parse(rawV5) as PlannerV5Payload
      let dirty = false

      // 1) Atualiza GOOD JSON (fonte de verdade de nível atual, constelação e talentos atuais)
      if (v5.good && Array.isArray(v5.good.characters)) {
        const chars = v5.good.characters
        const idx = chars.findIndex((c) => canonicalCharKey(c.key) === targetKey)
        if (idx >= 0) {
          const existing = chars[idx]
          const nextLevel = curLevel ?? existing.level
          chars[idx] = {
            ...existing,
            level: nextLevel,
            ascension:
              nextLevel !== existing.level
                ? Math.max(existing.ascension ?? 0, inferAscensionFromLevel(nextLevel))
                : existing.ascension,
            constellation: cons ?? existing.constellation,
            talent: {
              auto: na?.current ?? existing.talent?.auto ?? 1,
              skill: es?.current ?? existing.talent?.skill ?? 1,
              burst: eb?.current ?? existing.talent?.burst ?? 1,
            },
          }
          dirty = true
        } else if (curLevel != null || na || es || eb) {
          const newLevel = curLevel ?? 1
          const newEntry: GoodCharacter = {
            key: updatedChar.slug,
            level: newLevel,
            ascension: inferAscensionFromLevel(newLevel),
            constellation: cons ?? 0,
            talent: {
              auto: na?.current ?? 1,
              skill: es?.current ?? 1,
              burst: eb?.current ?? 1,
            },
          }
          chars.push(newEntry)
          dirty = true
        }

        // Sincroniza nível das armas equipadas no GOOD
        if (Array.isArray(v5.good.weapons) && updatedChar.weapons.length > 0) {
          for (const wb of updatedChar.weapons) {
            const wKey = canonicalWeaponKey(wb.slug)
            const gw = v5.good.weapons.find(
              (item) =>
                item.location &&
                canonicalCharKey(item.location) === targetKey &&
                canonicalWeaponKey(item.key) === wKey,
            )
            if (gw && gw.level !== wb.from_level) {
              gw.level = wb.from_level
              gw.ascension = inferAscensionFromLevel(wb.from_level)
              dirty = true
            }
          }
        }
      }

      // 2) Atualiza Seelie JSON (metas de nível, talentos, armas e flag inativo)
      if (v5.seelie && Array.isArray(v5.seelie.goals)) {
        const goals: SeelieGoal[] = [...v5.seelie.goals]

        // Inactive map
        const inactive: Record<string, boolean> = { ...(v5.seelie.inactive || {}) }
        let matchedInactiveKey: string | null = null
        for (const k of Object.keys(inactive)) {
          if (canonicalCharKey(k) === targetKey) {
            matchedInactiveKey = k
            break
          }
        }
        const inactiveKey = matchedInactiveKey || updatedChar.slug
        if (updatedChar.is_inactive) {
          inactive[inactiveKey] = true
        } else {
          delete inactive[inactiveKey]
        }
        v5.seelie.inactive = inactive

        // Character goal
        if (updatedChar.char_goal && curLevel != null && goalLevel != null) {
          const cIdx = goals.findIndex(
            (g) => g.type === 'character' && canonicalCharKey(g.character) === targetKey,
          )
          if (cIdx >= 0) {
            const existing = goals[cIdx] as SeelieCharacterGoal
            goals[cIdx] = {
              ...existing,
              cons: cons ?? existing.cons,
              current: { ...existing.current, level: curLevel },
              goal: { ...existing.goal, level: goalLevel },
            }
          } else {
            goals.push({
              type: 'character',
              character: updatedChar.slug,
              id: Date.now(),
              cons: cons ?? 0,
              current: { level: curLevel, asc: inferAscensionFromLevel(curLevel) },
              goal: { level: goalLevel, asc: inferAscensionFromLevel(goalLevel) },
            })
          }
        }

        // Talent goal
        if (updatedChar.talent_goal && na && es && eb) {
          const tIdx = goals.findIndex(
            (g) => g.type === 'talent' && canonicalCharKey(g.character) === targetKey,
          )
          if (tIdx >= 0) {
            const existing = goals[tIdx] as SeelieTalentGoal
            goals[tIdx] = {
              ...existing,
              normal: { current: na.current, goal: na.goal },
              skill: { current: es.current, goal: es.goal },
              burst: { current: eb.current, goal: eb.goal },
            }
          } else {
            goals.push({
              type: 'talent',
              character: updatedChar.slug,
              id: Date.now() + 1,
              normal: { current: na.current, goal: na.goal },
              skill: { current: es.current, goal: es.goal },
              burst: { current: eb.current, goal: eb.goal },
            })
          }
        }

        // Weapon goals: substitui os goals de arma deste personagem pelos atuais
        const preservedGoals = goals.filter(
          (g) => !(g.type === 'weapon' && g.character && canonicalCharKey(g.character) === targetKey),
        )
        const existingCharWeapons = goals.filter(
          (g): g is SeelieWeaponGoal =>
            g.type === 'weapon' && !!g.character && canonicalCharKey(g.character) === targetKey,
        )
        const charKeyForSeelie =
          existingCharWeapons[0]?.character || updatedChar.slug
        for (let i = 0; i < updatedChar.weapons.length; i++) {
          const wb = updatedChar.weapons[i]
          const prev = existingCharWeapons.find(
            (ew) => canonicalWeaponKey(ew.weapon) === canonicalWeaponKey(wb.slug),
          )
          preservedGoals.push({
            type: 'weapon',
            character: charKeyForSeelie,
            weapon: wb.slug,
            id: prev?.id ?? Date.now() + 10 + i,
            current: { ...(prev?.current ?? { asc: 0 }), level: wb.from_level },
            goal: { ...(prev?.goal ?? { asc: 0 }), level: wb.to_level },
          })
        }

        v5.seelie.goals = preservedGoals
        dirty = true
      }

      if (dirty) {
        localStorage.setItem(PLANNER_V5_KEY, JSON.stringify(v5))
      }
    }
  } catch (err) {
    console.error('[planner-storage] Falha ao sincronizar gsb.planner.v5:', err)
    saved = false
  }

  // 3) Se o usuário tiver override manual de constelação no Roster, mantém coerente
  if (cons != null) {
    try {
      const rawRoster = localStorage.getItem(ROSTER_KEY)
      if (rawRoster) {
        const parsed = JSON.parse(rawRoster) as Record<string, { owned: boolean; cons: number }>
        let changed = false
        for (const [k, entry] of Object.entries(parsed)) {
          if (canonicalCharKey(k) === targetKey && entry && typeof entry === 'object') {
            parsed[k] = { ...entry, cons }
            changed = true
          }
        }
        if (changed) {
          localStorage.setItem(ROSTER_KEY, JSON.stringify(parsed))
        }
      }
    } catch {}
  }

  emitPlannerUpdated()
  return saved
}

/**
 * Sincroniza edição de quantidade de um item feita no PlannerPage ou InventoryAuditPage
 * de volta para `gsb.planner.v5` (seelie.inventory se existir + manual_inventory).
 */
export function syncInventoryItemToPlannerStorage(
  slug: string,
  newQty: number,
  data?: PlannerData | null,
): void {
  try {
    const rawV5 = localStorage.getItem(PLANNER_V5_KEY)
    const v5: PlannerV5Payload & { manual_inventory?: Record<string, number>; ar?: number; wl?: number } =
      rawV5 ? JSON.parse(rawV5) : {}

    const manualInv: Record<string, number> = { ...(v5.manual_inventory || {}) }
    manualInv[slug] = newQty
    v5.manual_inventory = manualInv

    if (data && v5.seelie && Array.isArray(v5.seelie.inventory)) {
      const invRaw = v5.seelie.inventory as SeelieInventoryItem[]
      const catalog = Object.entries(data.materials).map(([s, m]) => ({ ...m, slug: s }))
      for (const item of invRaw) {
        const res = resolveInventory([item], catalog, data.families)
        if (res.resolved[slug] !== undefined) {
          item.value = newQty
          break
        }
      }
    }

    localStorage.setItem(PLANNER_V5_KEY, JSON.stringify(v5))
    emitPlannerUpdated()
  } catch (err) {
    console.error('[planner-storage] Falha ao sincronizar inventário no v5:', err)
  }
}

export function loadManualInventory(): Record<string, number> {
  try {
    const rawV5 = localStorage.getItem(PLANNER_V5_KEY)
    if (!rawV5) return {}
    const parsed = JSON.parse(rawV5)
    return parsed?.manual_inventory && typeof parsed.manual_inventory === 'object'
      ? parsed.manual_inventory
      : {}
  } catch {
    return {}
  }
}

export function loadPlannerSettings(): { ar: number; wl: number } {
  try {
    const rawV5 = localStorage.getItem(PLANNER_V5_KEY)
    if (!rawV5) return { ar: 60, wl: 9 }
    const parsed = JSON.parse(rawV5)
    return {
      ar: parsed?.ar ?? parsed?.seelie?.ar ?? 60,
      wl: parsed?.wl ?? parsed?.seelie?.wl ?? 9,
    }
  } catch {
    return { ar: 60, wl: 9 }
  }
}

/**
 * Sincroniza inventário editado em InventoryAuditPage de volta para `gsb.planner.plan`.
 */
export function syncInventoryToPlanStorage(
  inventoryResolved: Record<string, number>,
  wl: number = 9,
): void {
  const existing = loadPlanFromStorage()
  if (!existing) return
  const updated = recomputeAggregates(
    { ...existing, inventory_resolved: inventoryResolved },
    inventoryResolved,
    wl,
  )
  savePlanToStorage(updated)
}

export function createEmptyPlan(inventory: Record<string, number> = {}): Plan {
  return {
    chars: [],
    grand_mora: 0,
    grand_resin: 0,
    tier_groups: [],
    warnings: [],
    not_mapped: [],
    travelers_skipped: 0,
    weapons_processed: 0,
    weapons_skipped: 0,
    inventory_resolved: { ...inventory },
    inventory_stats: { mapped: Object.keys(inventory).length, unmapped: 0, ambiguous: 0, total: Object.keys(inventory).length },
    materials_complete: 0,
    materials_partial: 0,
  }
}

export interface AddCharOptions {
  currentLevel?: number
  goalLevel?: number
  cons?: number
  na?: { current: number; goal: number }
  es?: { current: number; goal: number }
  eb?: { current: number; goal: number }
}

export function buildManualCharBreakdown(
  slug: string,
  data: PlannerData,
  lang: string,
  opts: AddCharOptions = {},
): CharBreakdown | null {
  const charMeta = data.characters[slug]
  if (!charMeta) return null

  const curLevel = Math.max(1, Math.min(90, Math.round(opts.currentLevel ?? 1)))
  const goalLevel = Math.max(curLevel, Math.min(90, Math.round(opts.goalLevel ?? 90)))
  const cons = Math.max(0, Math.min(6, Math.round(opts.cons ?? 0)))

  const naCur = Math.max(1, Math.min(10, Math.round(opts.na?.current ?? 1)))
  const naGoal = Math.max(naCur, Math.min(10, Math.round(opts.na?.goal ?? naCur)))
  const esCur = Math.max(1, Math.min(10, Math.round(opts.es?.current ?? 1)))
  const esGoal = Math.max(esCur, Math.min(10, Math.round(opts.es?.goal ?? 9)))
  const ebCur = Math.max(1, Math.min(10, Math.round(opts.eb?.current ?? 1)))
  const ebGoal = Math.max(ebCur, Math.min(10, Math.round(opts.eb?.goal ?? 9)))

  const na = { current: naCur, goal: naGoal }
  const es = { current: esCur, goal: esGoal }
  const eb = { current: ebCur, goal: ebGoal }

  const ascension = curLevel < goalLevel ? computeAscensionCost(data, slug, curLevel, goalLevel, lang) : null
  const hasTalentPending = na.current < na.goal || es.current < es.goal || eb.current < eb.goal
  const talents = hasTalentPending ? computeTalentCost(data, slug, na, es, eb, lang) : null

  const hasAscensionPending = curLevel < goalLevel
  const displayName =
    pickLang(charMeta.name, lang) ||
    slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

  return {
    slug,
    name: displayName,
    icon: charMeta.icon ?? null,
    ascension,
    talents,
    weapons: [],
    char_goal: {
      type: 'character',
      character: slug,
      id: Date.now(),
      cons,
      current: { level: curLevel, asc: inferAscensionFromLevel(curLevel) },
      goal: { level: goalLevel, asc: inferAscensionFromLevel(goalLevel) },
    },
    talent_goal: {
      type: 'talent',
      character: slug,
      id: Date.now() + 1,
      normal: na,
      skill: es,
      burst: eb,
    },
    is_inactive: false,
    has_ascension_pending: hasAscensionPending,
    has_talent_pending: hasTalentPending,
    has_weapon_pending: false,
    is_complete: !hasAscensionPending && !hasTalentPending,
  }
}

/**
 * Adiciona um personagem manualmente ao plano (funciona mesmo começando do zero, sem JSON!).
 * Se o personagem já existir no plano, retorna o registro existente sem duplicar.
 */
export function addCharToPlan(
  existingPlan: Plan | null,
  slug: string,
  data: PlannerData,
  lang: string,
  wl: number = 9,
  opts: AddCharOptions = {},
): { plan: Plan; char: CharBreakdown; added: boolean } | null {
  const basePlan = existingPlan ?? createEmptyPlan(loadManualInventory())
  const existing = basePlan.chars.find((c) => c.slug === slug)
  if (existing) {
    return { plan: basePlan, char: existing, added: false }
  }

  const newChar = buildManualCharBreakdown(slug, data, lang, opts)
  if (!newChar) return null

  const mergedInv = { ...loadManualInventory(), ...(basePlan.inventory_resolved || {}) }
  const updated = recomputeAggregates(
    { ...basePlan, chars: [newChar, ...basePlan.chars], inventory_resolved: mergedInv },
    mergedInv,
    wl,
  )
  syncCharEditToPlannerStorage(newChar)
  savePlanToStorage(updated)
  return { plan: updated, char: newChar, added: true }
}

/**
 * Remove um personagem do plano (e das metas Seelie em gsb.planner.v5 se existirem).
 */
export function removeCharFromPlan(
  existingPlan: Plan,
  slug: string,
  wl: number = 9,
): Plan {
  const remaining = existingPlan.chars.filter((c) => c.slug !== slug)
  const updated = recomputeAggregates(
    { ...existingPlan, chars: remaining },
    existingPlan.inventory_resolved,
    wl,
  )
  savePlanToStorage(updated)

  try {
    const rawV5 = localStorage.getItem(PLANNER_V5_KEY)
    if (rawV5) {
      const v5 = JSON.parse(rawV5) as PlannerV5Payload
      const targetKey = canonicalCharKey(slug)
      let dirty = false
      if (v5.seelie && Array.isArray(v5.seelie.goals)) {
        const before = v5.seelie.goals.length
        v5.seelie.goals = v5.seelie.goals.filter((g) => {
          if (g.type === 'character' || g.type === 'talent' || g.type === 'artifact') {
            return canonicalCharKey(g.character) !== targetKey
          }
          if (g.type === 'weapon' && g.character) {
            return canonicalCharKey(g.character) !== targetKey
          }
          return true
        })
        if (v5.seelie.goals.length !== before) dirty = true
      }
      if (dirty) {
        localStorage.setItem(PLANNER_V5_KEY, JSON.stringify(v5))
      }
    }
  } catch {}

  emitPlannerUpdated()
  return updated
}

