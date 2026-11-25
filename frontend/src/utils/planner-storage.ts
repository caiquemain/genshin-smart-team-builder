import type { AggregateMaterial, CharBreakdown, Plan, WeaponBreakdown } from '../types/planner'
import type { EnkaImportResponse } from '../types'
import type { GoodArtifact, GoodCharacter, GoodData } from '../types/good'
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
import { computeAscensionCost, computeTalentCost, computeWeaponAscension } from './planner-compute'
import { recomputeAggregates } from './planner-recompute'

export const PLANNER_V5_KEY = 'gsb.planner.v5'
export const PLANNER_PLAN_KEY = 'gsb.planner.plan'
export const ROSTER_KEY = 'gsb.roster.v1'
export const ENKA_LAST_UID_KEY = 'gsb.enka.last_uid'
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

export function loadPlannerSettings(): { ar: number; wl: number; resinMode: 20 | 40 | 60 } {
  try {
    const rawV5 = localStorage.getItem(PLANNER_V5_KEY)
    if (!rawV5) return { ar: 60, wl: 9, resinMode: 20 }
    const parsed = JSON.parse(rawV5)
    const rawMode = parsed?.resinMode
    const resinMode: 20 | 40 | 60 = rawMode === 60 || rawMode === 40 ? rawMode : 20
    return {
      ar: parsed?.ar ?? parsed?.seelie?.ar ?? 60,
      wl: parsed?.wl ?? parsed?.seelie?.wl ?? 9,
      resinMode,
    }
  } catch {
    return { ar: 60, wl: 9, resinMode: 20 }
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
  weapon?: { slug: string; level?: number; goalLevel?: number }
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

  const weapons: WeaponBreakdown[] = []
  if (opts.weapon?.slug) {
    const wMeta = data.weapons[opts.weapon.slug]
    if (wMeta) {
      const wFrom = Math.max(1, Math.min(90, Math.round(opts.weapon.level ?? 1)))
      const wTo = Math.max(wFrom, Math.min(90, Math.round(opts.weapon.goalLevel ?? 90)))
      const wCost = wFrom < wTo ? computeWeaponAscension(data, opts.weapon.slug, wFrom, wTo, lang) : null
      weapons.push({
        slug: opts.weapon.slug,
        name: pickLang(wMeta.name, lang) || opts.weapon.slug,
        icon: wMeta.icon ?? null,
        rarity: wMeta.rarity ?? 4,
        from_level: wFrom,
        to_level: wTo,
        cost: wCost,
      })
    }
  }

  const hasAscensionPending = curLevel < goalLevel
  const hasWeaponPending = weapons.some((w) => w.from_level < w.to_level)
  const displayName =
    pickLang(charMeta.name, lang) ||
    slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

  return {
    slug,
    name: displayName,
    icon: charMeta.icon ?? null,
    ascension,
    talents,
    weapons,
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
    has_weapon_pending: hasWeaponPending,
    is_complete: !hasAscensionPending && !hasTalentPending && !hasWeaponPending,
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

export function getSavedEnkaUid(): string {
  try {
    return localStorage.getItem(ENKA_LAST_UID_KEY) || ''
  } catch {
    return ''
  }
}

export function setSavedEnkaUid(uid: string): void {
  try {
    const clean = uid.trim()
    if (clean) localStorage.setItem(ENKA_LAST_UID_KEY, clean)
    else localStorage.removeItem(ENKA_LAST_UID_KEY)
  } catch {}
}

export interface MergeEnkaOptions {
  syncRoster?: boolean
  syncPlanner?: boolean
  syncSettings?: boolean
}

/**
 * Mescla personagens vindos da vitrine pública do Enka.Network (UID)
 * no Meu Roster, nas configurações AR/WL e no Planejador (atualizando
 * nível/constelação/talentos/arma atuais sem apagar metas já existentes).
 */
export function mergeEnkaImportIntoStorage(
  enka: EnkaImportResponse,
  selectedSlugs: string[],
  data: PlannerData | null,
  lang: string = 'pt',
  opts: MergeEnkaOptions = {},
): { rosterUpdated: number; plannerAdded: number; plannerUpdated: number } {
  const syncRoster = opts.syncRoster ?? true
  const syncPlanner = opts.syncPlanner ?? true
  const syncSettings = opts.syncSettings ?? true

  setSavedEnkaUid(enka.uid)

  const selectedSet = new Set(selectedSlugs)
  const chosenChars = enka.characters.filter((c) => selectedSet.has(c.slug))

  // 1) Atualiza AR / WL
  const currentSettings = loadPlannerSettings()
  const nextAr = syncSettings && enka.ar != null ? enka.ar : currentSettings.ar
  const nextWl = syncSettings && enka.wl != null ? enka.wl : currentSettings.wl

  if (syncSettings && (enka.ar != null || enka.wl != null)) {
    try {
      const existing = JSON.parse(localStorage.getItem(PLANNER_V5_KEY) || '{}')
      const nextSeelie = existing.seelie
        ? { ...existing.seelie, ar: nextAr, wl: nextWl }
        : existing.seelie ?? null
      localStorage.setItem(
        PLANNER_V5_KEY,
        JSON.stringify({ ...existing, ar: nextAr, wl: nextWl, seelie: nextSeelie }),
      )
    } catch {}
  }

  // 2) Atualiza Meu Roster (aditivo: nunca desmarca personagens já possuídos)
  let rosterUpdated = 0
  if (syncRoster && chosenChars.length > 0) {
    try {
      const existingRoster: Record<string, { owned: boolean; cons: number }> = JSON.parse(
        localStorage.getItem(ROSTER_KEY) || '{}',
      )
      for (const ec of chosenChars) {
        const prev = existingRoster[ec.slug]
        existingRoster[ec.slug] = {
          owned: true,
          cons: ec.has_detail ? ec.cons : prev?.cons ?? 0,
        }
        rosterUpdated++
      }
      localStorage.setItem(ROSTER_KEY, JSON.stringify(existingRoster))
    } catch {}
  }

  // 2.5) Persiste nível, talentos, arma e os 5 artefatos do Enka no estado GOOD local
  // (garante stats calculados, CV e auditoria mesmo para quem nunca importou GOOD JSON!)
  for (const ec of chosenChars) {
    if (!ec.has_detail) continue
    const enkaArts: GoodArtifact[] = (ec.artifacts ?? []).map((a) => ({
      setKey: a.set_slug,
      slotKey: a.slot_key,
      level: a.level,
      rarity: a.rarity,
      mainStatKey: a.main_stat_key,
      lock: true,
      substats: (a.substats ?? []).map((s) => ({ key: s.key, value: s.value })),
    }))
    saveManualCharacterGear({
      slug: ec.slug,
      level: ec.level,
      cons: ec.cons,
      talents: { na: ec.na, es: ec.es, eb: ec.eb },
      weaponSlug: ec.weapon?.slug ?? undefined,
      weaponLevel: ec.weapon?.level,
      weaponRefinement: ec.weapon?.refinement,
      artifacts: enkaArts,
    })
  }

  // 3) Sincroniza no Planejador (atualiza atuais ou adiciona novos com custos calculados)
  let plannerAdded = 0
  let plannerUpdated = 0
  if (syncPlanner && data && chosenChars.length > 0) {
    const basePlan = loadPlanFromStorage(data, lang) ?? createEmptyPlan(loadManualInventory())
    const charsList = [...basePlan.chars]

    for (const ec of chosenChars) {
      const idx = charsList.findIndex((c) => c.slug === ec.slug)
      const buildWeaponEntry = (
        wSlug: string,
        fromLevel: number,
        toLevel: number,
      ): WeaponBreakdown => {
        const wMeta = data.weapons[wSlug]
        const clampedTo = Math.max(fromLevel, toLevel)
        return {
          slug: wSlug,
          name: (wMeta ? pickLang(wMeta.name, lang) : ec.weapon?.name) || wSlug,
          icon: wMeta?.icon ?? ec.weapon?.icon ?? null,
          rarity: wMeta?.rarity ?? ec.weapon?.rarity ?? 4,
          from_level: fromLevel,
          to_level: clampedTo,
          cost:
            fromLevel < clampedTo
              ? computeWeaponAscension(data, wSlug, fromLevel, clampedTo, lang)
              : null,
        }
      }

      if (idx >= 0) {
        const prev = charsList[idx]
        const nextCurLv = ec.level
        const nextGoalLv = Math.max(prev.char_goal?.goal?.level ?? 90, nextCurLv)
        const nextCons = ec.has_detail ? ec.cons : prev.char_goal?.cons ?? 0

        const prevNa = prev.talent_goal?.normal ?? { current: 1, goal: 1 }
        const prevEs = prev.talent_goal?.skill ?? { current: 1, goal: 9 }
        const prevEb = prev.talent_goal?.burst ?? { current: 1, goal: 9 }

        const na = ec.has_detail
          ? { current: ec.na, goal: Math.max(prevNa.goal, ec.na) }
          : { ...prevNa }
        const es = ec.has_detail
          ? { current: ec.es, goal: Math.max(prevEs.goal, ec.es) }
          : { ...prevEs }
        const eb = ec.has_detail
          ? { current: ec.eb, goal: Math.max(prevEb.goal, ec.eb) }
          : { ...prevEb }

        const nextWeapons = [...(prev.weapons ?? [])]
        if (ec.has_detail && ec.weapon?.slug) {
          const wIdx = nextWeapons.findIndex((w) => w.slug === ec.weapon!.slug)
          if (wIdx >= 0) {
            const oldW = nextWeapons[wIdx]
            nextWeapons[wIdx] = buildWeaponEntry(
              ec.weapon.slug,
              ec.weapon.level,
              Math.max(oldW.to_level, ec.weapon.level),
            )
          } else if (nextWeapons.length === 0) {
            nextWeapons.push(buildWeaponEntry(ec.weapon.slug, ec.weapon.level, Math.max(nextGoalLv, ec.weapon.level)))
          }
        }

        const ascension =
          nextCurLv < nextGoalLv
            ? computeAscensionCost(data, prev.slug, nextCurLv, nextGoalLv, lang)
            : null
        const hasTalPending = na.current < na.goal || es.current < es.goal || eb.current < eb.goal
        const talents = hasTalPending
          ? computeTalentCost(data, prev.slug, na, es, eb, lang)
          : null

        const updatedChar: CharBreakdown = {
          ...prev,
          ascension,
          talents,
          weapons: nextWeapons,
          char_goal: {
            ...(prev.char_goal ?? { type: 'character', character: prev.slug, id: Date.now() }),
            cons: nextCons,
            current: { level: nextCurLv, asc: ec.ascension || inferAscensionFromLevel(nextCurLv) },
            goal: { level: nextGoalLv, asc: inferAscensionFromLevel(nextGoalLv) },
          },
          talent_goal: {
            ...(prev.talent_goal ?? { type: 'talent', character: prev.slug, id: Date.now() + 1 }),
            normal: na,
            skill: es,
            burst: eb,
          },
          has_ascension_pending: nextCurLv < nextGoalLv,
          has_talent_pending: hasTalPending,
          has_weapon_pending: nextWeapons.some((w) => w.from_level < w.to_level),
        }
        updatedChar.is_complete =
          !updatedChar.is_inactive &&
          !updatedChar.has_ascension_pending &&
          !updatedChar.has_talent_pending &&
          !updatedChar.has_weapon_pending

        charsList[idx] = updatedChar
        syncCharEditToPlannerStorage(updatedChar)
        plannerUpdated++
      } else {
        const built = buildManualCharBreakdown(ec.slug, data, lang, {
          currentLevel: ec.level,
          goalLevel: Math.max(ec.level, 90),
          cons: ec.cons,
          na: { current: ec.na, goal: Math.max(ec.na, 1) },
          es: { current: ec.es, goal: Math.max(ec.es, 9) },
          eb: { current: ec.eb, goal: Math.max(ec.eb, 9) },
        })
        if (built) {
          if (ec.has_detail && ec.weapon?.slug) {
            const wb = buildWeaponEntry(ec.weapon.slug, ec.weapon.level, Math.max(90, ec.weapon.level))
            built.weapons = [wb]
            built.has_weapon_pending = wb.from_level < wb.to_level
            built.is_complete =
              !built.is_inactive &&
              !built.has_ascension_pending &&
              !built.has_talent_pending &&
              !built.has_weapon_pending
          }
          charsList.unshift(built)
          syncCharEditToPlannerStorage(built)
          plannerAdded++
        }
      }
    }

    const mergedInv = { ...loadManualInventory(), ...(basePlan.inventory_resolved || {}) }
    const nextPlan = recomputeAggregates(
      { ...basePlan, chars: charsList, inventory_resolved: mergedInv },
      mergedInv,
      nextWl,
    )
    savePlanToStorage(nextPlan)
  } else {
    emitPlannerUpdated()
  }

  return { rosterUpdated, plannerAdded, plannerUpdated }
}

export interface SaveManualGearInput {
  slug: string
  level?: number
  cons?: number
  talents?: { na: number; es: number; eb: number }
  weaponSlug?: string | null
  weaponLevel?: number
  weaponRefinement?: number
  artifacts: GoodArtifact[]
}

/**
 * Salva artefatos (e opcionalmente nível/talentos/arma) editados manualmente no
 * objeto `good` dentro de `gsb.planner.v5`, funcionando mesmo para contas que
 * nunca importaram GOOD JSON — e sincronizando automaticamente com Roster,
 * Consultor da Conta, Página do Personagem e Backup Local / Google Drive.
 */
export function saveManualCharacterGear(input: SaveManualGearInput): void {
  const targetKey = canonicalCharKey(input.slug)
  if (!targetKey) return

  let v5: Record<string, any> = {}
  try {
    const raw = localStorage.getItem(PLANNER_V5_KEY)
    if (raw) v5 = JSON.parse(raw)
  } catch {
    v5 = {}
  }

  if (!v5.good || typeof v5.good !== 'object') {
    v5.good = {
      format: 'GOOD',
      version: 2,
      source: 'GenshinSmartTeamBuilder',
      characters: [],
      weapons: [],
      artifacts: [],
    } satisfies GoodData
  }
  if (!Array.isArray(v5.good.characters)) v5.good.characters = []
  if (!Array.isArray(v5.good.weapons)) v5.good.weapons = []
  if (!Array.isArray(v5.good.artifacts)) v5.good.artifacts = []

  // 1. Personagem: reutiliza o key original do GOOD se existir para manter consistência
  const existingCharIdx = v5.good.characters.findIndex(
    (c: any) => c?.key && canonicalCharKey(c.key) === targetKey,
  )
  let charKey = input.slug
  if (existingCharIdx >= 0) {
    const prev = v5.good.characters[existingCharIdx]
    charKey = prev.key || input.slug
    const nextLevel = input.level ?? prev.level ?? 1
    v5.good.characters[existingCharIdx] = {
      ...prev,
      level: nextLevel,
      ascension: inferAscensionFromLevel(nextLevel),
      constellation: input.cons ?? prev.constellation ?? 0,
      talent: {
        auto: input.talents?.na ?? prev.talent?.auto ?? 1,
        skill: input.talents?.es ?? prev.talent?.skill ?? 1,
        burst: input.talents?.eb ?? prev.talent?.burst ?? 1,
      },
    }
  } else {
    const nextLevel = input.level ?? 1
    const newChar: GoodCharacter = {
      key: charKey,
      level: nextLevel,
      ascension: inferAscensionFromLevel(nextLevel),
      constellation: input.cons ?? 0,
      talent: {
        auto: input.talents?.na ?? 1,
        skill: input.talents?.es ?? 1,
        burst: input.talents?.eb ?? 1,
      },
    }
    v5.good.characters.push(newChar)
  }

  // 2. Arma equipada (se especificada na edição)
  if (input.weaponSlug !== undefined) {
    // Desequipa arma antiga deste personagem (mantendo no inventário)
    for (const w of v5.good.weapons) {
      if (w?.location && canonicalCharKey(w.location) === targetKey) {
        w.location = ''
      }
    }
    if (input.weaponSlug) {
      const targetWeaponKey = canonicalWeaponKey(input.weaponSlug)
      const wLv = Math.max(1, Math.min(90, input.weaponLevel ?? 90))
      const wRef = Math.max(1, Math.min(5, input.weaponRefinement ?? 1))
      // Tenta reutilizar uma arma igual sem dono antes de criar nova entrada
      const freeIdx = v5.good.weapons.findIndex(
        (w: any) =>
          w?.key &&
          canonicalWeaponKey(w.key) === targetWeaponKey &&
          (!w.location || w.location === ''),
      )
      if (freeIdx >= 0) {
        v5.good.weapons[freeIdx] = {
          ...v5.good.weapons[freeIdx],
          level: wLv,
          ascension: inferAscensionFromLevel(wLv),
          refinement: wRef,
          location: charKey,
        }
      } else {
        v5.good.weapons.push({
          key: input.weaponSlug,
          level: wLv,
          ascension: inferAscensionFromLevel(wLv),
          refinement: wRef,
          location: charKey,
        })
      }
    }
  }

  // 3. Artefatos equipados: substitui apenas as peças deste personagem
  const keptArtifacts = v5.good.artifacts.filter(
    (a: any) => !a?.location || canonicalCharKey(a.location) !== targetKey,
  )
  const sanitizedArtifacts: GoodArtifact[] = input.artifacts.map((a) => ({
    setKey: a.setKey,
    slotKey: a.slotKey,
    level: Math.max(0, Math.min(a.rarity >= 5 ? 20 : 16, Math.round(a.level ?? 0))),
    rarity: a.rarity >= 5 ? 5 : 4,
    mainStatKey: a.mainStatKey,
    location: charKey,
    lock: a.lock ?? true,
    substats: (a.substats ?? [])
      .filter((s) => s && s.key && Number.isFinite(s.value) && s.value > 0)
      .slice(0, 4)
      .map((s) => ({ key: s.key, value: Math.round(s.value * 10) / 10 })),
  }))

  v5.good.artifacts = [...keptArtifacts, ...sanitizedArtifacts]

  try {
    localStorage.setItem(PLANNER_V5_KEY, JSON.stringify(v5))
  } catch (err) {
    console.error('[planner-storage] Falha ao salvar artefatos manuais:', err)
  }
  emitPlannerUpdated()
}
