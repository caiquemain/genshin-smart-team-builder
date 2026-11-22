import type { GoodArtifact } from '../types/good'
import type { ArtifactSetSummary } from '../types'
import {
  buildArtifactSetLookup,
  computeArtifactCritValue,
  formatCanonicalStatValue,
  getArtifactMainStatValue,
  normalizeGoodStatKey,
  SLOT_LABEL_PT,
  STAT_SHORT_LABEL_PT,
  type CanonicalStatKey,
} from './char-stats-calc'
import { PLANNER_V5_KEY } from './planner-storage'
import { normKey } from './slug-resolver'

export type BagArtifactVerdict = 'gem' | 'recycle' | 'keep'

export interface AuditedBagArtifact {
  index: number
  raw: GoodArtifact
  setSlug: string
  setName: string
  setIcon: string | null
  slotKey: string
  slotLabel: string
  level: number
  rarity: number
  locked: boolean
  mainStatKey: CanonicalStatKey | null
  mainStatLabel: string
  mainStatFormatted: string
  substats: { key: CanonicalStatKey | null; label: string; value: number; formatted: string }[]
  critValue: number
  verdict: BagArtifactVerdict
  priorityScore: number
  reason: string
}

export interface ArtifactBagAuditReport {
  totalInGood: number
  equippedCount: number
  bagFiveStarCount: number
  gems: AuditedBagArtifact[]
  recycle: AuditedBagArtifact[]
  keep: AuditedBagArtifact[]
  strongboxBoxes: number
}

const FLAT_BAD_STATS = new Set<CanonicalStatKey>(['hp', 'atk', 'def'])
const ELEM_DMG_MAIN = new Set<CanonicalStatKey>([
  'pyro_dmg',
  'hydro_dmg',
  'cryo_dmg',
  'electro_dmg',
  'anemo_dmg',
  'geo_dmg',
  'dendro_dmg',
])
const DEF_SCALING_SETS = new Set([
  'husk-of-opulent-dreams',
  'archaic-petra',
  'golden-troupe',
  'nighttime-whispers-in-the-echoing-woods',
])
const EM_SETS = new Set([
  'viridescent-venerer',
  'gilded-dreams',
  'flower-of-paradise-lost',
  'deepwood-memories',
  'wanderers-troupe',
])
const HEALER_HP_SETS = new Set([
  'ocean-hued-clam',
  'maiden-beloved',
  'song-of-days-past',
  'tenacity-of-the-millelith',
  'vourukashas-glow',
])

export function loadAllGoodArtifactsFromStorage(): GoodArtifact[] {
  try {
    const raw = localStorage.getItem(PLANNER_V5_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed?.good?.artifacts)) {
      return parsed.good.artifacts as GoodArtifact[]
    }
    return []
  } catch {
    return []
  }
}

export function auditArtifactBag(
  allArtifacts: GoodArtifact[],
  artifactSetsCatalog: ArtifactSetSummary[],
): ArtifactBagAuditReport {
  const setLookup = buildArtifactSetLookup(artifactSetsCatalog)
  let equippedCount = 0
  const gems: AuditedBagArtifact[] = []
  const recycle: AuditedBagArtifact[] = []
  const keep: AuditedBagArtifact[] = []

  allArtifacts.forEach((a, idx) => {
    if (!a || !a.setKey || !a.slotKey) return
    if (a.location && a.location.trim() !== '') {
      equippedCount += 1
      return
    }
    if ((a.rarity ?? 0) < 5) return

    const meta = setLookup.get(normKey(a.setKey))
    const setSlug = meta?.slug ?? a.setKey
    const mainKey = normalizeGoodStatKey(a.mainStatKey)
    const mainVal = getArtifactMainStatValue(a.mainStatKey, a.rarity, a.level)
    const subs = (a.substats ?? [])
      .filter((s) => s && s.key && Number.isFinite(s.value) && s.value > 0)
      .map((s) => {
        const sk = normalizeGoodStatKey(s.key)
        return {
          key: sk,
          label: sk ? STAT_SHORT_LABEL_PT[sk] : s.key,
          value: s.value,
          formatted: sk ? formatCanonicalStatValue(sk, s.value) : String(s.value),
        }
      })

    const subKeys = new Set(subs.map((s) => s.key).filter((k): k is CanonicalStatKey => k !== null))
    const hasCr = subKeys.has('crit_rate')
    const hasCd = subKeys.has('crit_dmg')
    const doubleCrit = hasCr && hasCd
    const anyCrit = hasCr || hasCd
    const hasEr = subKeys.has('er')
    const hasEm = subKeys.has('em')
    const usefulPctCount =
      (subKeys.has('atk_pct') ? 1 : 0) +
      (subKeys.has('hp_pct') ? 1 : 0) +
      (hasEr ? 1 : 0) +
      (hasEm ? 1 : 0)
    const flatBadCount = subs.filter((s) => s.key && FLAT_BAD_STATS.has(s.key)).length
    const isFourLiner = subs.length >= 4
    const cv = computeArtifactCritValue(a)
    const lv = a.level ?? 0

    let verdict: BagArtifactVerdict = 'keep'
    let priorityScore = 0
    let reason = 'Peça situacional — vale manter como off-piece ou reserva.'

    const isElemGoblet = a.slotKey === 'goblet' && mainKey !== null && ELEM_DMG_MAIN.has(mainKey)
    const isCritCirclet = a.slotKey === 'circlet' && (mainKey === 'crit_rate' || mainKey === 'crit_dmg')
    const isEmPiece =
      (a.slotKey === 'sands' || a.slotKey === 'goblet' || a.slotKey === 'circlet') && mainKey === 'em'
    const isDefMain = mainKey === 'def_pct'

    // 1. JOIAS ESCONDIDAS (peças de alto potencial paradas em nível <= 12)
    if (lv <= 12) {
      if (doubleCrit && !isDefMain) {
        verdict = 'gem'
        priorityScore = 95 + (isElemGoblet ? 15 : 0) + (isFourLiner ? 8 : 0) + usefulPctCount * 3
        reason = isElemGoblet
          ? `Cálice Elemental com Duplo Crítico (${isFourLiner ? '4 linhas' : '3 linhas'}) parado em +${lv}!`
          : `Duplo Crítico (${isFourLiner ? '4 linhas iniciais' : '3 linhas'}) parado em +${lv} — vale upar!`
      } else if (isCritCirclet && anyCrit && (usefulPctCount >= 1 || isFourLiner)) {
        verdict = 'gem'
        priorityScore = 88 + usefulPctCount * 4 + (isFourLiner ? 6 : 0)
        reason = `Tiara Crítica com substat Crítico + stats úteis parada em +${lv}.`
      } else if (isElemGoblet && anyCrit && usefulPctCount >= 1) {
        verdict = 'gem'
        priorityScore = 84 + usefulPctCount * 4
        reason = `Cálice Elemental com Crítico + ${usefulPctCount} stat(s) útil(eis) parado em +${lv}.`
      } else if (isEmPiece && (EM_SETS.has(setSlug) || hasEr || anyCrit)) {
        verdict = 'gem'
        priorityScore = 82 + (EM_SETS.has(setSlug) ? 10 : 0) + (hasEr ? 5 : 0)
        reason = `Peça rara de Proficiência (EM) com ${hasEr ? 'Recarga' : anyCrit ? 'Crítico' : 'set de reação'} parada em +${lv}.`
      } else if (
        (a.slotKey === 'flower' || a.slotKey === 'plume') &&
        isFourLiner &&
        anyCrit &&
        usefulPctCount >= 2 &&
        flatBadCount === 0
      ) {
        verdict = 'gem'
        priorityScore = 76 + usefulPctCount * 3
        reason = `Peça 4 linhas sem substats flat (Crítico + ${usefulPctCount} stats úteis) em +${lv}.`
      }
    }

    // 2. RECICLAGEM SEGURA PRO STRONGBOX (somente peças <= +4 para não jogar fora peças já upadas)
    if (verdict === 'keep' && lv <= 4) {
      const isProtectedMain =
        isEmPiece ||
        isCritCirclet ||
        isElemGoblet ||
        (mainKey === 'healing_bonus' && HEALER_HP_SETS.has(setSlug))

      if (!isProtectedMain) {
        if (isDefMain && !DEF_SCALING_SETS.has(setSlug) && !doubleCrit) {
          verdict = 'recycle'
          priorityScore = 92 - (anyCrit ? 15 : 0)
          reason = `Main stat DEF% em set que não escala com DEF — reciclagem segura pro Strongbox.`
        } else if (!anyCrit && flatBadCount >= 2 && !(hasEr && hasEm)) {
          verdict = 'recycle'
          priorityScore = 88 + flatBadCount * 4
          reason = `Sem Crítico e com ${flatBadCount} substats flat (HP/ATQ/DEF) — seguro mandar pro Strongbox.`
        } else if (
          (a.slotKey === 'flower' || a.slotKey === 'plume') &&
          !anyCrit &&
          flatBadCount >= 1 &&
          usefulPctCount <= 1
        ) {
          verdict = 'recycle'
          priorityScore = 80 + flatBadCount * 4
          reason = `${SLOT_LABEL_PT[a.slotKey]} sem Crítico e poucos substats úteis — fácil de repor.`
        } else if (
          a.slotKey === 'circlet' &&
          (mainKey === 'atk_pct' || mainKey === 'hp_pct') &&
          !anyCrit &&
          !hasEr &&
          !HEALER_HP_SETS.has(setSlug)
        ) {
          verdict = 'recycle'
          priorityScore = 82
          reason = `Tiara de ${STAT_SHORT_LABEL_PT[mainKey]} sem Crítico nem Recarga.`
        }
      } else if (isElemGoblet && !anyCrit && flatBadCount >= 3) {
        verdict = 'recycle'
        priorityScore = 72
        reason = `Cálice Elemental com 3 substats flat e sem Crítico.`
      }
    }

    const audited: AuditedBagArtifact = {
      index: idx,
      raw: a,
      setSlug,
      setName: meta?.name ?? a.setKey,
      setIcon: meta?.icon ?? null,
      slotKey: a.slotKey,
      slotLabel: SLOT_LABEL_PT[a.slotKey] ?? a.slotKey,
      level: lv,
      rarity: a.rarity,
      locked: Boolean(a.lock),
      mainStatKey: mainKey,
      mainStatLabel: mainKey ? STAT_SHORT_LABEL_PT[mainKey] : a.mainStatKey,
      mainStatFormatted: mainKey ? formatCanonicalStatValue(mainKey, mainVal) : '—',
      substats: subs,
      critValue: cv,
      verdict,
      priorityScore,
      reason,
    }

    if (verdict === 'gem') gems.push(audited)
    else if (verdict === 'recycle') recycle.push(audited)
    else keep.push(audited)
  })

  gems.sort((a, b) => b.priorityScore - a.priorityScore || b.critValue - a.critValue)
  recycle.sort((a, b) => b.priorityScore - a.priorityScore || a.level - b.level)

  const unlockedRecycle = recycle.filter((r) => !r.locked).length
  return {
    totalInGood: allArtifacts.length,
    equippedCount,
    bagFiveStarCount: gems.length + recycle.length + keep.length,
    gems,
    recycle,
    keep,
    strongboxBoxes: Math.floor(unlockedRecycle / 3),
  }
}
