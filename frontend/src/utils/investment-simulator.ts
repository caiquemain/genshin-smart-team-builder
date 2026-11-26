import type { UpgradeCandidate } from '../types'
import {
  clampAscForLevel,
  computeAscensionCost,
  computeWeaponAscension,
  minAscForLevel,
} from './planner-compute'
import type { PlannerData } from './planner-data'
import {
  computeCharXp,
  computeWeaponXp,
  getOwnedCharXp,
  getOwnedWeaponXp,
  MYSTIC_ORE_XP,
  XP_BOOK_HERO,
} from './xp-costs'

export const FOCUS_STORAGE_KEY = 'gsb.planner.focus'

export function loadFocusSlugs(): string[] {
  try {
    const raw = localStorage.getItem(FOCUS_STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string') : []
  } catch {
    return []
  }
}

export function saveFocusSlugs(slugs: string[]): void {
  try {
    localStorage.setItem(FOCUS_STORAGE_KEY, JSON.stringify(slugs))
  } catch {
    // ignore storage quota errors
  }
}

export interface ResourceBlocker {
  kind: 'mora' | 'xp' | 'ore' | 'material'
  label: string
  missing: number
  slug?: string
}

export interface ConsumedResources {
  mora: number
  charXp: number
  weaponXp: number
  materials: Record<string, number>
}

export interface ReachableMilestone {
  startLevel: number
  startAsc: number
  targetLevel: number
  targetAsc: number
  reachableLevel: number
  reachableAsc: number
  reachableLabel: string
  canAdvanceNow: boolean
  reachedTarget: boolean
  moraUsed: number
  heroWitsUsed: number
  mysticOresUsed: number
  blocker: ResourceBlocker | null
  consumed: ConsumedResources
}

export interface ResourcePool {
  mora: number
  charXp: number
  weaponXp: number
  materials: Record<string, number>
}

export function createResourcePool(inventory: Record<string, number>): ResourcePool {
  const charXp = getOwnedCharXp(inventory).totalXp
  const weaponXp = getOwnedWeaponXp(inventory).totalXp
  const materials: Record<string, number> = {}
  for (const [k, v] of Object.entries(inventory)) {
    if (typeof v === 'number' && v > 0) materials[k] = v
  }
  return {
    mora: Math.max(0, inventory['mora'] ?? 0),
    charXp,
    weaponXp,
    materials,
  }
}

export function formatMilestoneLabel(level: number, asc: number): string {
  const capByAsc: Record<number, number> = { 0: 20, 1: 40, 2: 50, 3: 60, 4: 70, 5: 80, 6: 90 }
  const cap = capByAsc[asc] ?? 90
  // Destaca formato X/Y quando o personagem está ascendido no marco (ex: 80/90, 70/80)
  if (level < cap && (level === 20 || level === 40 || level === 50 || level === 60 || level === 70 || level === 80)) {
    return `Nv. ${level}/${cap}`
  }
  return `Nv. ${level}`
}

const STEP_SEQUENCE: Array<{ level: number; asc: number }> = [
  { level: 20, asc: 0 },
  { level: 20, asc: 1 },
  { level: 40, asc: 1 },
  { level: 40, asc: 2 },
  { level: 50, asc: 2 },
  { level: 50, asc: 3 },
  { level: 60, asc: 3 },
  { level: 60, asc: 4 },
  { level: 70, asc: 4 },
  { level: 70, asc: 5 },
  { level: 80, asc: 5 },
  { level: 80, asc: 6 },
  { level: 90, asc: 6 },
]

function buildTargetSteps(
  startLevel: number,
  startAsc: number,
  targetLevel: number,
  targetAsc: number,
): Array<{ level: number; asc: number }> {
  const steps = STEP_SEQUENCE.filter((s) => {
    const afterStart = s.level > startLevel || (s.level === startLevel && s.asc > startAsc)
    const withinTarget = s.level < targetLevel || (s.level === targetLevel && s.asc <= targetAsc)
    return afterStart && withinTarget
  })
  const last = steps[steps.length - 1]
  if (
    (targetLevel > startLevel || (targetLevel === startLevel && targetAsc > startAsc)) &&
    (!last || last.level !== targetLevel || last.asc !== targetAsc)
  ) {
    steps.push({ level: targetLevel, asc: targetAsc })
  }
  return steps
}

export function computeReachableCharMilestone(
  slug: string,
  currentLevel: number,
  currentAsc: number | null | undefined,
  targetLevel: number,
  targetAsc: number | null | undefined,
  poolInput: ResourcePool | Record<string, number>,
  data: PlannerData,
  lang: string = 'pt',
): ReachableMilestone {
  const pool: ResourcePool =
    'charXp' in poolInput && 'materials' in poolInput
      ? (poolInput as ResourcePool)
      : createResourcePool(poolInput as Record<string, number>)

  const startLevel = Math.max(1, Math.min(90, Math.round(currentLevel)))
  const startAsc = clampAscForLevel(startLevel, currentAsc)
  const clampedTargetLv = Math.max(startLevel, Math.min(90, Math.round(targetLevel)))
  const clampedTargetAsc = Math.max(
    startAsc,
    targetAsc != null ? clampAscForLevel(clampedTargetLv, targetAsc) : minAscForLevel(clampedTargetLv),
  )

  let curLv = startLevel
  let curAsc = startAsc
  let remMora = pool.mora
  let remXp = pool.charXp
  const remMats: Record<string, number> = { ...pool.materials }
  const consumedMats: Record<string, number> = {}
  let totalMoraUsed = 0
  let totalXpUsed = 0
  let blocker: ResourceBlocker | null = null

  const steps = buildTargetSteps(startLevel, startAsc, clampedTargetLv, clampedTargetAsc)

  for (const step of steps) {
    const xpCost = step.level > curLv ? computeCharXp(curLv, step.level) : null
    const ascCost =
      step.asc > curAsc
        ? computeAscensionCost(data, slug, curLv, step.level, lang, {
            fromAsc: curAsc,
            toAsc: step.asc,
          })
        : null

    const stepXp = xpCost?.xp ?? 0
    const stepMora = (xpCost?.moraLevelUp ?? 0) + (ascCost?.total_mora ?? 0)

    if (stepXp > remXp) {
      const missingWits = Math.ceil((stepXp - remXp) / XP_BOOK_HERO)
      blocker = { kind: 'xp', label: 'Livros de XP (eq. 20k)', missing: missingWits }
      break
    }

    if (stepMora > remMora) {
      blocker = { kind: 'mora', label: 'Mora', missing: stepMora - remMora }
      break
    }

    if (ascCost) {
      let missingMat: ResourceBlocker | null = null
      for (const mat of ascCost.materials) {
        const have = remMats[mat.slug] ?? 0
        if (have < mat.quantity) {
          missingMat = {
            kind: 'material',
            label: mat.name,
            missing: mat.quantity - have,
            slug: mat.slug,
          }
          break
        }
      }
      if (missingMat) {
        blocker = missingMat
        break
      }
      for (const mat of ascCost.materials) {
        remMats[mat.slug] = (remMats[mat.slug] ?? 0) - mat.quantity
        consumedMats[mat.slug] = (consumedMats[mat.slug] ?? 0) + mat.quantity
      }
    }

    remXp -= stepXp
    remMora -= stepMora
    totalXpUsed += stepXp
    totalMoraUsed += stepMora
    curLv = step.level
    curAsc = step.asc
  }

  return {
    startLevel,
    startAsc,
    targetLevel: clampedTargetLv,
    targetAsc: clampedTargetAsc,
    reachableLevel: curLv,
    reachableAsc: curAsc,
    reachableLabel: formatMilestoneLabel(curLv, curAsc),
    canAdvanceNow: curLv > startLevel || curAsc > startAsc,
    reachedTarget: curLv >= clampedTargetLv && curAsc >= clampedTargetAsc,
    moraUsed: totalMoraUsed,
    heroWitsUsed: Math.ceil(totalXpUsed / XP_BOOK_HERO),
    mysticOresUsed: 0,
    blocker,
    consumed: {
      mora: totalMoraUsed,
      charXp: totalXpUsed,
      weaponXp: 0,
      materials: consumedMats,
    },
  }
}

export function computeReachableWeaponMilestone(
  weaponSlug: string,
  currentLevel: number,
  currentAsc: number | null | undefined,
  targetLevel: number,
  poolInput: ResourcePool | Record<string, number>,
  data: PlannerData,
  lang: string = 'pt',
): ReachableMilestone | null {
  const wMeta = data.weapons[weaponSlug]
  if (!wMeta) return null

  const pool: ResourcePool =
    'weaponXp' in poolInput && 'materials' in poolInput
      ? (poolInput as ResourcePool)
      : createResourcePool(poolInput as Record<string, number>)

  const startLevel = Math.max(1, Math.min(90, Math.round(currentLevel)))
  const startAsc = clampAscForLevel(startLevel, currentAsc)
  const clampedTargetLv = Math.max(startLevel, Math.min(90, Math.round(targetLevel)))
  const clampedTargetAsc = Math.max(startAsc, minAscForLevel(clampedTargetLv))

  let curLv = startLevel
  let curAsc = startAsc
  let remMora = pool.mora
  let remWeaponXp = pool.weaponXp
  const remMats: Record<string, number> = { ...pool.materials }
  const consumedMats: Record<string, number> = {}
  let totalMoraUsed = 0
  let totalWeaponXpUsed = 0
  let blocker: ResourceBlocker | null = null

  const steps = buildTargetSteps(startLevel, startAsc, clampedTargetLv, clampedTargetAsc)

  for (const step of steps) {
    const xpCost = step.level > curLv ? computeWeaponXp(curLv, step.level, wMeta.rarity ?? 4) : null
    const ascCost =
      step.asc > curAsc
        ? computeWeaponAscension(data, weaponSlug, curLv, step.level, lang, {
            fromAsc: curAsc,
            toAsc: step.asc,
          })
        : null

    const stepXp = xpCost?.xp ?? 0
    const stepMora = (xpCost?.moraLevelUp ?? 0) + (ascCost?.total_mora ?? 0)

    if (stepXp > remWeaponXp) {
      const missingOres = Math.ceil((stepXp - remWeaponXp) / MYSTIC_ORE_XP)
      blocker = { kind: 'ore', label: 'Minérios (eq. 10k)', missing: missingOres }
      break
    }

    if (stepMora > remMora) {
      blocker = { kind: 'mora', label: 'Mora', missing: stepMora - remMora }
      break
    }

    if (ascCost) {
      let missingMat: ResourceBlocker | null = null
      for (const mat of ascCost.materials) {
        const have = remMats[mat.slug] ?? 0
        if (have < mat.quantity) {
          missingMat = {
            kind: 'material',
            label: mat.name,
            missing: mat.quantity - have,
            slug: mat.slug,
          }
          break
        }
      }
      if (missingMat) {
        blocker = missingMat
        break
      }
      for (const mat of ascCost.materials) {
        remMats[mat.slug] = (remMats[mat.slug] ?? 0) - mat.quantity
        consumedMats[mat.slug] = (consumedMats[mat.slug] ?? 0) + mat.quantity
      }
    }

    remWeaponXp -= stepXp
    remMora -= stepMora
    totalWeaponXpUsed += stepXp
    totalMoraUsed += stepMora
    curLv = step.level
    curAsc = step.asc
  }

  return {
    startLevel,
    startAsc,
    targetLevel: clampedTargetLv,
    targetAsc: clampedTargetAsc,
    reachableLevel: curLv,
    reachableAsc: curAsc,
    reachableLabel: formatMilestoneLabel(curLv, curAsc),
    canAdvanceNow: curLv > startLevel || curAsc > startAsc,
    reachedTarget: curLv >= clampedTargetLv && curAsc >= clampedTargetAsc,
    moraUsed: totalMoraUsed,
    heroWitsUsed: 0,
    mysticOresUsed: Math.ceil(totalWeaponXpUsed / MYSTIC_ORE_XP),
    blocker,
    consumed: {
      mora: totalMoraUsed,
      charXp: 0,
      weaponXp: totalWeaponXpUsed,
      materials: consumedMats,
    },
  }
}

export interface InvestmentStep {
  id: string
  roi: 'high' | 'medium' | 'optional'
  title: string
  detail: string
  readyNow: boolean
}

export function buildInvestmentAdvice(
  candidate: UpgradeCandidate,
  charReach: ReachableMilestone | null,
  weaponReach: ReachableMilestone | null,
  weaponName: string | null,
): InvestmentStep[] {
  const steps: InvestmentStep[] = []
  const curLv = candidate.current_level ?? 1
  const recLv = candidate.recommended_level ?? 80

  // 1. Arma -> 90 (quase sempre maior ganho por recurso)
  if (weaponReach && weaponReach.startLevel < 90) {
    steps.push({
      id: 'weapon-90',
      roi: 'high',
      title: `Arma (${weaponName ?? 'equipada'}) até Nv. 90`,
      detail: weaponReach.canAdvanceNow
        ? `Você já consegue subir agora até ${weaponReach.reachableLabel} sem gastar livros de personagem.`
        : 'Melhor custo-benefício: ATQ base + substat completo sem gastar livros de XP de personagem.',
      readyNow: weaponReach.canAdvanceNow,
    })
  }

  // 2. Personagem -> 80/90 vs 90/90
  if (candidate.needs_level_90 || recLv >= 90) {
    if (curLv < 90) {
      steps.push({
        id: 'char-90',
        roi: 'high',
        title: 'Personagem até Nv. 90',
        detail:
          candidate.level_scaling_tag ||
          'Escala com HP, DEF, Proficiência Elemental ou reações — subir 80->90 traz ganho alto real.',
        readyNow: Boolean(charReach?.canAdvanceNow),
      })
    }
  } else {
    if (curLv < 80 || (curLv === 80 && (charReach?.startAsc ?? 5) < 6)) {
      steps.push({
        id: 'char-80-90',
        roi: 'high',
        title: 'Personagem até Nv. 80/90 (última ascensão)',
        detail:
          'Desbloqueia atributo de ascensão e talentos Nv. 9/10 economizando ~172 Livros de XP e ~685k Mora do 80->90.',
        readyNow: Boolean(charReach?.canAdvanceNow),
      })
    } else if (curLv < 90) {
      steps.push({
        id: 'char-90-opt',
        roi: 'optional',
        title: 'Subir 80/90 para 90/90 (opcional)',
        detail: 'Ganho modesto para escaladores de ATQ (~3–5% DPS); priorize arma 90 e talentos antes.',
        readyNow: Boolean(charReach?.canAdvanceNow),
      })
    }
  }

  // 3. Talentos principais atrasados
  const laggingTalents = (candidate.talents ?? []).filter(
    (t) => t.recommended > 1 && t.needs_upgrade && (t.current === null || t.current < t.recommended),
  )
  if (laggingTalents.length > 0) {
    const names = laggingTalents
      .map((t) => `${t.label} (${t.current ?? 1}->${t.recommended})`)
      .join(', ')
    steps.push({
      id: 'talents',
      roi: laggingTalents.some((t) => (t.current ?? 1) < 8) ? 'high' : 'medium',
      title: 'Talentos principais',
      detail: `Priorize ${names} antes de gastar resina em artefatos.`,
      readyNow: false,
    })
  }

  return steps
}

export interface PortfolioInputEntry {
  candidate: UpgradeCandidate
  currentLevel: number
  currentAsc: number | null
  targetLevel: number
  targetAsc: number | null
  weaponSlug: string | null
  weaponName: string | null
  weaponLevel: number
  weaponAsc: number | null
}

export interface PortfolioAllocatedEntry {
  slug: string
  candidate: UpgradeCandidate
  weaponSlug: string | null
  weaponName: string | null
  charReach: ReachableMilestone
  weaponReach: ReachableMilestone | null
  advice: InvestmentStep[]
}

export interface PortfolioSimulationResult {
  initialPool: { mora: number; heroWits: number; mysticOres: number }
  remainingPool: { mora: number; heroWits: number; mysticOres: number }
  entries: PortfolioAllocatedEntry[]
}

function deductFromPool(pool: ResourcePool, consumed: ConsumedResources): void {
  pool.mora = Math.max(0, pool.mora - consumed.mora)
  pool.charXp = Math.max(0, pool.charXp - consumed.charXp)
  pool.weaponXp = Math.max(0, pool.weaponXp - consumed.weaponXp)
  for (const [slug, qty] of Object.entries(consumed.materials)) {
    pool.materials[slug] = Math.max(0, (pool.materials[slug] ?? 0) - qty)
  }
}

/**
 * Simula a alocação sequencial da mochila (Mora, Livros XP, Minérios e Materiais)
 * em uma lista ordenada de personagens + armas equipadas.
 */
export function simulatePortfolioAllocation(
  items: PortfolioInputEntry[],
  inventory: Record<string, number>,
  data: PlannerData,
  lang: string = 'pt',
): PortfolioSimulationResult {
  const pool = createResourcePool(inventory)
  const initialPool = {
    mora: pool.mora,
    heroWits: Math.floor(pool.charXp / XP_BOOK_HERO),
    mysticOres: Math.floor(pool.weaponXp / MYSTIC_ORE_XP),
  }

  const entries: PortfolioAllocatedEntry[] = []

  for (const item of items) {
    // 1. Primeiro aloca a arma (maior ROI, não consome livros de personagem)
    const weaponReach = item.weaponSlug
      ? computeReachableWeaponMilestone(
          item.weaponSlug,
          item.weaponLevel,
          item.weaponAsc,
          90,
          pool,
          data,
          lang,
        )
      : null
    if (weaponReach) deductFromPool(pool, weaponReach.consumed)

    // 2. Depois aloca o personagem até a meta recomendada
    const charReach = computeReachableCharMilestone(
      item.candidate.slug,
      item.currentLevel,
      item.currentAsc,
      item.targetLevel,
      item.targetAsc,
      pool,
      data,
      lang,
    )
    deductFromPool(pool, charReach.consumed)

    const advice = buildInvestmentAdvice(item.candidate, charReach, weaponReach, item.weaponName)

    entries.push({
      slug: item.candidate.slug,
      candidate: item.candidate,
      weaponSlug: item.weaponSlug,
      weaponName: item.weaponName,
      charReach,
      weaponReach,
      advice,
    })
  }

  return {
    initialPool,
    remainingPool: {
      mora: pool.mora,
      heroWits: Math.floor(pool.charXp / XP_BOOK_HERO),
      mysticOres: Math.floor(pool.weaponXp / MYSTIC_ORE_XP),
    },
    entries,
  }
}
