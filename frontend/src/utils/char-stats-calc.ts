import type { GoodArtifact } from '../types/good'
import type { GoodCharState } from './good-parser'
import type { ArtifactSetSummary, CharacterBuild, WeaponSummary } from '../types'
import { normKey } from './slug-resolver'

export interface CharStatLevel {
  hp: number
  atk: number
  def: number
  substat: number
}

export interface CharStatsEntry {
  substat_name: string
  levels: Record<string, CharStatLevel>
}

export type CharacterStatsDataset = Record<string, CharStatsEntry>

let cachedStatsPromise: Promise<CharacterStatsDataset> | null = null

export function loadCharacterStatsDataset(): Promise<CharacterStatsDataset> {
  if (!cachedStatsPromise) {
    cachedStatsPromise = fetch('/character-stats.json')
      .then((r) => (r.ok ? (r.json() as Promise<CharacterStatsDataset>) : {}))
      .catch(() => ({}))
  }
  return cachedStatsPromise
}

export type CanonicalStatKey =
  | 'hp'
  | 'hp_pct'
  | 'atk'
  | 'atk_pct'
  | 'def'
  | 'def_pct'
  | 'em'
  | 'er'
  | 'crit_rate'
  | 'crit_dmg'
  | 'healing_bonus'
  | 'pyro_dmg'
  | 'hydro_dmg'
  | 'cryo_dmg'
  | 'electro_dmg'
  | 'anemo_dmg'
  | 'geo_dmg'
  | 'dendro_dmg'
  | 'physical_dmg'

const GOOD_STAT_TO_CANONICAL: Record<string, CanonicalStatKey> = {
  hp: 'hp',
  hp_: 'hp_pct',
  atk: 'atk',
  atk_: 'atk_pct',
  def: 'def',
  def_: 'def_pct',
  eleMas: 'em',
  enerRech_: 'er',
  critRate_: 'crit_rate',
  critDMG_: 'crit_dmg',
  heal_: 'healing_bonus',
  pyro_dmg_: 'pyro_dmg',
  hydro_dmg_: 'hydro_dmg',
  cryo_dmg_: 'cryo_dmg',
  electro_dmg_: 'electro_dmg',
  anemo_dmg_: 'anemo_dmg',
  geo_dmg_: 'geo_dmg',
  dendro_dmg_: 'dendro_dmg',
  physical_dmg_: 'physical_dmg',
}

const SUBSTAT_NAME_TO_CANONICAL: Record<string, CanonicalStatKey> = {
  'elemental mastery': 'em',
  em: 'em',
  'proficiência elemental': 'em',
  'energy recharge': 'er',
  er: 'er',
  'recarga de energia': 'er',
  'crit rate': 'crit_rate',
  'taxa crítica': 'crit_rate',
  'crit dmg': 'crit_dmg',
  'dano crítico': 'crit_dmg',
  atk: 'atk_pct',
  'atk%': 'atk_pct',
  'atq%': 'atk_pct',
  hp: 'hp_pct',
  'hp%': 'hp_pct',
  'vida%': 'hp_pct',
  def: 'def_pct',
  'def%': 'def_pct',
  'healing bonus': 'healing_bonus',
  'bônus de cura': 'healing_bonus',
  'pyro dmg bonus': 'pyro_dmg',
  'hydro dmg bonus': 'hydro_dmg',
  'cryo dmg bonus': 'cryo_dmg',
  'electro dmg bonus': 'electro_dmg',
  'anemo dmg bonus': 'anemo_dmg',
  'geo dmg bonus': 'geo_dmg',
  'dendro dmg bonus': 'dendro_dmg',
  'physical dmg bonus': 'physical_dmg',
}

export const STAT_SHORT_LABEL_PT: Record<CanonicalStatKey, string> = {
  hp: 'Vida',
  hp_pct: 'Vida%',
  atk: 'ATQ',
  atk_pct: 'ATQ%',
  def: 'DEF',
  def_pct: 'DEF%',
  em: 'EM',
  er: 'Recarga',
  crit_rate: 'Taxa Crít.',
  crit_dmg: 'Dano Crít.',
  healing_bonus: 'Bônus Cura',
  pyro_dmg: 'Dano Pyro',
  hydro_dmg: 'Dano Hydro',
  cryo_dmg: 'Dano Cryo',
  electro_dmg: 'Dano Electro',
  anemo_dmg: 'Dano Anemo',
  geo_dmg: 'Dano Geo',
  dendro_dmg: 'Dano Dendro',
  physical_dmg: 'Dano Físico',
}

export const SLOT_LABEL_PT: Record<string, string> = {
  flower: 'Flor',
  plume: 'Pena',
  sands: 'Ampulheta',
  goblet: 'Cálice',
  circlet: 'Tiara',
}

const FLAT_STATS = new Set<CanonicalStatKey>(['hp', 'atk', 'def', 'em'])

export function isPercentStat(key: CanonicalStatKey): boolean {
  return !FLAT_STATS.has(key)
}

export function normalizeGoodStatKey(key: string | null | undefined): CanonicalStatKey | null {
  if (!key) return null
  if (GOOD_STAT_TO_CANONICAL[key]) return GOOD_STAT_TO_CANONICAL[key]
  const low = key.trim().toLowerCase()
  if (SUBSTAT_NAME_TO_CANONICAL[low]) return SUBSTAT_NAME_TO_CANONICAL[low]
  if (low in STAT_SHORT_LABEL_PT) return low as CanonicalStatKey
  return null
}

export function formatCanonicalStatValue(key: CanonicalStatKey, value: number): string {
  if (isPercentStat(key)) return `${value.toFixed(1)}%`
  return Math.round(value).toLocaleString('pt-BR')
}

// Tabelas oficiais de Main Stat de artefatos [Lv.0, Lv.Max]
const MAIN_STAT_5STAR: Record<CanonicalStatKey, [number, number]> = {
  hp: [717, 4780],
  atk: [47, 311],
  hp_pct: [7.0, 46.6],
  atk_pct: [7.0, 46.6],
  def_pct: [8.7, 58.3],
  em: [28, 186.5],
  er: [7.8, 51.8],
  crit_rate: [4.7, 31.1],
  crit_dmg: [9.3, 62.2],
  healing_bonus: [5.4, 35.9],
  pyro_dmg: [7.0, 46.6],
  hydro_dmg: [7.0, 46.6],
  cryo_dmg: [7.0, 46.6],
  electro_dmg: [7.0, 46.6],
  anemo_dmg: [7.0, 46.6],
  geo_dmg: [7.0, 46.6],
  dendro_dmg: [7.0, 46.6],
  physical_dmg: [8.7, 58.3],
  def: [0, 0],
}

const MAIN_STAT_4STAR: Record<CanonicalStatKey, [number, number]> = {
  hp: [645, 3571],
  atk: [42, 232],
  hp_pct: [6.3, 34.8],
  atk_pct: [6.3, 34.8],
  def_pct: [7.9, 43.5],
  em: [25, 139.3],
  er: [7.0, 38.7],
  crit_rate: [4.2, 23.2],
  crit_dmg: [8.4, 46.4],
  healing_bonus: [4.8, 26.8],
  pyro_dmg: [6.3, 34.8],
  hydro_dmg: [6.3, 34.8],
  cryo_dmg: [6.3, 34.8],
  electro_dmg: [6.3, 34.8],
  anemo_dmg: [6.3, 34.8],
  geo_dmg: [6.3, 34.8],
  dendro_dmg: [6.3, 34.8],
  physical_dmg: [7.9, 43.5],
  def: [0, 0],
}

export function getArtifactMainStatValue(
  mainStatKey: string,
  rarity: number,
  level: number,
): number {
  const key = normalizeGoodStatKey(mainStatKey)
  if (!key) return 0
  if (rarity >= 5) {
    const [minV, maxV] = MAIN_STAT_5STAR[key] ?? [0, 0]
    const lv = Math.max(0, Math.min(20, level))
    return minV + ((maxV - minV) * lv) / 20
  }
  if (rarity === 4) {
    const [minV, maxV] = MAIN_STAT_4STAR[key] ?? [0, 0]
    const lv = Math.max(0, Math.min(16, level))
    return minV + ((maxV - minV) * lv) / 16
  }
  const [minV, maxV] = MAIN_STAT_4STAR[key] ?? [0, 0]
  const lv = Math.max(0, Math.min(12, level))
  return (minV + ((maxV - minV) * lv) / 12) * 0.72
}

// Bônus estáticos de 2 peças (2pc) mais comuns por slug de set
const STATIC_2PC_BONUS: Record<string, [CanonicalStatKey, number]> = {
  'gladiators-finale': ['atk_pct', 18],
  'shimenawas-reminiscence': ['atk_pct', 18],
  'vermillion-hereafter': ['atk_pct', 18],
  'echoes-of-an-offering': ['atk_pct', 18],
  'fragment-of-harmonic-whimsy': ['atk_pct', 18],
  'unfinished-reverie': ['atk_pct', 18],
  'nighttime-whispers-in-the-echoing-woods': ['atk_pct', 18],
  'emblem-of-severed-fate': ['er', 20],
  'the-exile': ['er', 20],
  scholar: ['er', 20],
  'wanderers-troupe': ['em', 80],
  'gilded-dreams': ['em', 80],
  'flower-of-paradise-lost': ['em', 80],
  instructor: ['em', 80],
  'tenacity-of-the-millelith': ['hp_pct', 20],
  'vourukashas-glow': ['hp_pct', 20],
  'crimson-witch-of-flames': ['pyro_dmg', 15],
  'heart-of-depth': ['hydro_dmg', 15],
  'nymphs-dream': ['hydro_dmg', 15],
  'blizzard-strayer': ['cryo_dmg', 15],
  'finale-of-the-deep-galleries': ['cryo_dmg', 15],
  'thundering-fury': ['electro_dmg', 15],
  'viridescent-venerer': ['anemo_dmg', 15],
  'desert-pavilion-chronicle': ['anemo_dmg', 15],
  'archaic-petra': ['geo_dmg', 15],
  'deepwood-memories': ['dendro_dmg', 15],
  'husk-of-opulent-dreams': ['def_pct', 30],
  'bloodstained-chivalry': ['physical_dmg', 25],
  'pale-flame': ['physical_dmg', 25],
  'maiden-beloved': ['healing_bonus', 15],
  'ocean-hued-clam': ['healing_bonus', 15],
  'song-of-days-past': ['healing_bonus', 15],
  berserker: ['crit_rate', 12],
}

function parse2pcFromText(text: string | null | undefined): [CanonicalStatKey, number] | null {
  if (!text) return null
  const t = text.toLowerCase()
  const pctMatch = t.match(/\+(\d+(?:\.\d+)?)\s*%/)
  const flatMatch = t.match(/\+(\d+)/)
  if (t.includes('elemental mastery') || t.includes('proficiência elemental')) {
    return ['em', flatMatch ? Number(flatMatch[1]) : 80]
  }
  if (t.includes('energy recharge') || t.includes('recarga de energia')) {
    return ['er', pctMatch ? Number(pctMatch[1]) : 20]
  }
  if ((t.includes('atk') || t.includes('atq')) && pctMatch) {
    return ['atk_pct', Number(pctMatch[1])]
  }
  if ((t.includes('hp') || t.includes('vida')) && pctMatch) {
    return ['hp_pct', Number(pctMatch[1])]
  }
  if (t.includes('def') && pctMatch) {
    return ['def_pct', Number(pctMatch[1])]
  }
  if (t.includes('crit rate') || t.includes('taxa crítica')) {
    return ['crit_rate', pctMatch ? Number(pctMatch[1]) : 12]
  }
  if (t.includes('healing') || t.includes('cura')) {
    return ['healing_bonus', pctMatch ? Number(pctMatch[1]) : 15]
  }
  for (const el of ['pyro', 'hydro', 'cryo', 'electro', 'anemo', 'geo', 'dendro'] as const) {
    if (t.includes(`${el} dmg`) || t.includes(`dano ${el}`)) {
      return [`${el}_dmg` as CanonicalStatKey, pctMatch ? Number(pctMatch[1]) : 15]
    }
  }
  if (t.includes('physical') || t.includes('físico')) {
    return ['physical_dmg', pctMatch ? Number(pctMatch[1]) : 25]
  }
  return null
}

const CHAR_BREAKPOINTS = [1, 20, 40, 50, 60, 70, 80, 90]

export function interpolateCharBaseStats(
  entry: CharStatsEntry | undefined,
  level: number,
): { hp: number; atk: number; def: number; ascKey: CanonicalStatKey | null; ascVal: number } {
  if (!entry?.levels) {
    return { hp: 0, atk: 0, def: 0, ascKey: null, ascVal: 0 }
  }
  const lv = Math.max(1, Math.min(90, level || 1))
  const ascKey = normalizeGoodStatKey(entry.substat_name)

  let lo = 1
  let hi = 90
  for (let i = 0; i < CHAR_BREAKPOINTS.length; i++) {
    const bp = CHAR_BREAKPOINTS[i]
    if (bp <= lv) lo = bp
    if (bp >= lv) {
      hi = bp
      break
    }
  }
  const sLo = entry.levels[String(lo)] ?? entry.levels['1']
  const sHi = entry.levels[String(hi)] ?? sLo
  if (!sLo || !sHi) {
    return { hp: 0, atk: 0, def: 0, ascKey, ascVal: 0 }
  }

  const ratio = hi === lo ? 0 : (lv - lo) / (hi - lo)
  const hp = Math.round(sLo.hp + (sHi.hp - sLo.hp) * ratio)
  const atk = Math.round(sLo.atk + (sHi.atk - sLo.atk) * ratio)
  const def = Math.round(sLo.def + (sHi.def - sLo.def) * ratio)
  let rawSub = sLo.substat + (sHi.substat - sLo.substat) * ratio
  if (ascKey === 'em' && rawSub > 500) rawSub = rawSub / 100

  return { hp, atk, def, ascKey, ascVal: rawSub }
}

export function interpolateWeaponStats(
  weapon: WeaponSummary | undefined,
  level: number,
): { baseAtk: number; subKey: CanonicalStatKey | null; subVal: number } {
  if (!weapon) return { baseAtk: 0, subKey: null, subVal: 0 }
  const lv = Math.max(1, Math.min(90, level || 1))
  const minAtk = weapon.base_atk ?? 0
  const maxAtk = weapon.max_base_atk ?? minAtk
  // Curva de arma no Genshin é aproximadamente linear em Lv 1..90 (exata em 1 e 90)
  const ratio = (lv - 1) / 89
  const baseAtk = Math.round(minAtk + (maxAtk - minAtk) * ratio)

  const subKey = normalizeGoodStatKey(weapon.secondary_stat)
  const minSub = weapon.secondary_stat_value ?? 0
  const maxSub = weapon.max_secondary_stat_value ?? minSub
  const subVal = minSub + (maxSub - minSub) * ratio

  return { baseAtk, subKey, subVal }
}

export interface ComputedArtifactPiece {
  raw: GoodArtifact
  setSlug: string
  setName: string
  setIcon: string | null
  slotKey: string
  slotLabel: string
  level: number
  rarity: number
  mainStatKey: CanonicalStatKey | null
  mainStatLabel: string
  mainStatValue: number
  substats: { key: CanonicalStatKey | null; label: string; value: number; formatted: string }[]
  critValue: number
}

export interface ActiveSetBonus {
  slug: string
  name: string
  icon: string | null
  pieces: number // 2 ou 4
}

export interface ComputedCharStats {
  hasBaseData: boolean
  hasArtifacts: boolean
  level: number
  cons: number
  talents: { na: number; es: number; eb: number }
  weapon: {
    slug: string
    name: string
    icon: string | null
    rarity: number
    level: number
    refinement: number
    baseAtk: number
    subKey: CanonicalStatKey | null
    subVal: number
  } | null
  baseHp: number
  baseAtk: number
  baseDef: number
  totalHp: number
  totalAtk: number
  totalDef: number
  em: number
  critRate: number
  critDmg: number
  er: number
  healingBonus: number
  elemDmgBonus: number
  elemDmgKey: CanonicalStatKey
  physicalDmgBonus: number
  totalCritValue: number
  avgArtifactLevel: number
  fiveStarCount: number
  activeSets: ActiveSetBonus[]
  active4pcSlug: string | null
  active2pcSlugs: string[]
  pieces: ComputedArtifactPiece[]
}

export function buildArtifactSetLookup(
  sets: ArtifactSetSummary[],
): Map<string, ArtifactSetSummary> {
  const m = new Map<string, ArtifactSetSummary>()
  for (const s of sets) {
    m.set(normKey(s.slug), s)
    m.set(normKey(s.name), s)
  }
  return m
}

export function buildWeaponLookup(weapons: WeaponSummary[]): Map<string, WeaponSummary> {
  const m = new Map<string, WeaponSummary>()
  for (const w of weapons) {
    m.set(normKey(w.slug), w)
    m.set(normKey(w.name), w)
  }
  return m
}

export function computeArtifactCritValue(artifact: GoodArtifact): number {
  let cv = 0
  for (const sub of artifact.substats ?? []) {
    const k = normalizeGoodStatKey(sub.key)
    if (k === 'crit_rate') cv += sub.value * 2
    else if (k === 'crit_dmg') cv += sub.value
  }
  return Math.round(cv * 10) / 10
}

export function computeCharacterBuildStats(params: {
  slug: string
  element: string
  goodState: GoodCharState
  statsDataset: CharacterStatsDataset
  weaponLookup: Map<string, WeaponSummary>
  artifactSetLookup: Map<string, ArtifactSetSummary>
}): ComputedCharStats {
  const { slug, element, goodState, statsDataset, weaponLookup, artifactSetLookup } = params

  const entry = statsDataset[slug]
  const charBase = interpolateCharBaseStats(entry, goodState.level)

  const matchedWeapon = goodState.weaponSlug
    ? weaponLookup.get(normKey(goodState.weaponSlug))
    : undefined
  const wStats = interpolateWeaponStats(matchedWeapon, goodState.weaponLevel || 90)

  const baseHp = charBase.hp
  const baseAtk = charBase.atk + wStats.baseAtk
  const baseDef = charBase.def

  const totals: Record<CanonicalStatKey, number> = {
    hp: 0,
    hp_pct: 0,
    atk: 0,
    atk_pct: 0,
    def: 0,
    def_pct: 0,
    em: 0,
    er: 100,
    crit_rate: 5,
    crit_dmg: 50,
    healing_bonus: 0,
    pyro_dmg: 0,
    hydro_dmg: 0,
    cryo_dmg: 0,
    electro_dmg: 0,
    anemo_dmg: 0,
    geo_dmg: 0,
    dendro_dmg: 0,
    physical_dmg: 0,
  }

  const addStat = (k: CanonicalStatKey | null, v: number) => {
    if (!k || !Number.isFinite(v)) return
    totals[k] += v
  }

  // Ascensão + Arma
  addStat(charBase.ascKey, charBase.ascVal)
  addStat(wStats.subKey, wStats.subVal)

  // Artefatos equipados
  const setCounts = new Map<string, { count: number; meta: ArtifactSetSummary | undefined; rawKey: string }>()
  const pieces: ComputedArtifactPiece[] = []
  let totalCv = 0
  let lvSum = 0
  let fiveStarCount = 0

  for (const a of goodState.artifacts ?? []) {
    const setMeta = artifactSetLookup.get(normKey(a.setKey))
    const resolvedSlug = setMeta?.slug ?? a.setKey
    const prev = setCounts.get(resolvedSlug)
    if (prev) prev.count += 1
    else setCounts.set(resolvedSlug, { count: 1, meta: setMeta, rawKey: a.setKey })

    const mainKey = normalizeGoodStatKey(a.mainStatKey)
    const mainVal = getArtifactMainStatValue(a.mainStatKey, a.rarity, a.level)
    addStat(mainKey, mainVal)

    const subs = (a.substats ?? [])
      .filter((s) => s && s.key && Number.isFinite(s.value) && s.value > 0)
      .map((s) => {
        const sk = normalizeGoodStatKey(s.key)
        addStat(sk, s.value)
        return {
          key: sk,
          label: sk ? STAT_SHORT_LABEL_PT[sk] : s.key,
          value: s.value,
          formatted: sk ? formatCanonicalStatValue(sk, s.value) : String(s.value),
        }
      })

    const pieceCv = computeArtifactCritValue(a)
    totalCv += pieceCv
    lvSum += a.level ?? 0
    if ((a.rarity ?? 0) >= 5) fiveStarCount += 1

    pieces.push({
      raw: a,
      setSlug: resolvedSlug,
      setName: setMeta?.name ?? a.setKey,
      setIcon: setMeta?.icon ?? null,
      slotKey: a.slotKey,
      slotLabel: SLOT_LABEL_PT[a.slotKey] ?? a.slotKey,
      level: a.level ?? 0,
      rarity: a.rarity ?? 5,
      mainStatKey: mainKey,
      mainStatLabel: mainKey ? STAT_SHORT_LABEL_PT[mainKey] : a.mainStatKey,
      mainStatValue: mainVal,
      substats: subs,
      critValue: pieceCv,
    })
  }

  // Bônus de 2pc e 4pc ativos
  const activeSets: ActiveSetBonus[] = []
  let active4pcSlug: string | null = null
  const active2pcSlugs: string[] = []

  setCounts.forEach((info, sSlug) => {
    if (info.count >= 2) {
      const pc = info.count >= 4 ? 4 : 2
      if (pc === 4) active4pcSlug = sSlug
      active2pcSlugs.push(sSlug)
      activeSets.push({
        slug: sSlug,
        name: info.meta?.name ?? info.rawKey,
        icon: info.meta?.icon ?? null,
        pieces: pc,
      })

      // Aplica bônus estático de 2pc
      const staticBonus =
        STATIC_2PC_BONUS[sSlug] ?? parse2pcFromText(info.meta?.two_piece_bonus)
      if (staticBonus) {
        addStat(staticBonus[0], staticBonus[1])
      }
    }
  })

  activeSets.sort((a, b) => b.pieces - a.pieces)

  const totalHp = Math.round(baseHp * (1 + totals.hp_pct / 100) + totals.hp)
  const totalAtk = Math.round(baseAtk * (1 + totals.atk_pct / 100) + totals.atk)
  const totalDef = Math.round(baseDef * (1 + totals.def_pct / 100) + totals.def)

  const elemKey = (`${element.toLowerCase()}_dmg` as CanonicalStatKey)
  const validElemKey: CanonicalStatKey = elemKey in totals ? elemKey : 'pyro_dmg'

  return {
    hasBaseData: baseHp > 0,
    hasArtifacts: pieces.length > 0,
    level: goodState.level,
    cons: goodState.cons,
    talents: goodState.talents,
    weapon: matchedWeapon
      ? {
          slug: matchedWeapon.slug,
          name: matchedWeapon.name,
          icon: matchedWeapon.icon,
          rarity: matchedWeapon.rarity,
          level: goodState.weaponLevel || 90,
          refinement: goodState.weaponRefinement || 1,
          baseAtk: wStats.baseAtk,
          subKey: wStats.subKey,
          subVal: wStats.subVal,
        }
      : null,
    baseHp,
    baseAtk,
    baseDef,
    totalHp,
    totalAtk,
    totalDef,
    em: Math.round(totals.em),
    critRate: Math.round(totals.crit_rate * 10) / 10,
    critDmg: Math.round(totals.crit_dmg * 10) / 10,
    er: Math.round(totals.er * 10) / 10,
    healingBonus: Math.round(totals.healing_bonus * 10) / 10,
    elemDmgBonus: Math.round(totals[validElemKey] * 10) / 10,
    elemDmgKey: validElemKey,
    physicalDmgBonus: Math.round(totals.physical_dmg * 10) / 10,
    totalCritValue: Math.round(totalCv * 10) / 10,
    avgArtifactLevel: pieces.length > 0 ? Math.round((lvSum / pieces.length) * 10) / 10 : 0,
    fiveStarCount,
    activeSets,
    active4pcSlug,
    active2pcSlugs,
    pieces,
  }
}

export interface BuildAuditResult {
  status: 'built' | 'partial' | 'needs_farm'
  label: string
  notes: string[]
}

export function auditEquippedBuild(
  computed: ComputedCharStats,
  recommended: CharacterBuild | null | undefined,
): BuildAuditResult {
  if (!computed.hasArtifacts) {
    return {
      status: 'needs_farm',
      label: 'Sem artefatos no GOOD',
      notes: ['Nenhum artefato equipado foi encontrado para este personagem no GOOD JSON.'],
    }
  }

  const notes: string[] = []
  let setMatched = false
  let mainStatIssues = 0

  const rec4 = (recommended?.artifacts_4pc ?? [])
    .map((a) => a.artifact_set_slug)
    .filter((s): s is string => Boolean(s))
  const rec2 = recommended?.artifacts_2pc ?? []

  if (recommended && (rec4.length > 0 || rec2.length > 0)) {
    if (computed.active4pcSlug && rec4.includes(computed.active4pcSlug)) {
      setMatched = true
      const isBis = rec4[0] === computed.active4pcSlug
      notes.push(isBis ? 'Set 4pc BiS recomendado fechado.' : 'Set 4pc alternativo recomendado fechado.')
    } else if (computed.active2pcSlugs.length >= 2 && rec2.length > 0) {
      const hasRec2 = rec2.some((pair) => {
        const s1 = pair.set1_slug
        const s2 = pair.set2_slug
        return (
          Boolean(s1) &&
          computed.active2pcSlugs.includes(s1!) &&
          (!s2 || computed.active2pcSlugs.includes(s2))
        )
      })
      if (hasRec2) {
        setMatched = true
        notes.push('Combinação 2pc+2pc recomendada ativa.')
      }
    }

    if (!setMatched) {
      if (computed.active4pcSlug) {
        notes.push('Set 4pc atual diferente dos recomendados na build.')
      } else if (computed.active2pcSlugs.length > 0) {
        notes.push('Apenas bônus 2pc ativo — considere fechar um set 4pc recomendado.')
      } else {
        notes.push('Sem bônus de set ativo (peças soltas).')
      }
    }

    // Checa main stats de Ampulheta, Cálice e Tiara contra a build recomendada
    const slotChecks: { slot: 'sands' | 'goblet' | 'circlet'; allowed: string[] }[] = [
      { slot: 'sands', allowed: recommended.sands_stat ?? [] },
      { slot: 'goblet', allowed: recommended.goblet_stat ?? [] },
      { slot: 'circlet', allowed: recommended.circlet_stat ?? [] },
    ]
    for (const chk of slotChecks) {
      if (chk.allowed.length === 0) continue
      const piece = computed.pieces.find((p) => p.slotKey === chk.slot)
      if (!piece || !piece.mainStatKey) continue
      const allowedCanon = chk.allowed
        .map((a) => normalizeGoodStatKey(a))
        .filter((x): x is CanonicalStatKey => x !== null)
      if (allowedCanon.length > 0 && !allowedCanon.includes(piece.mainStatKey)) {
        mainStatIssues += 1
        const recLabels = allowedCanon.slice(0, 2).map((k) => STAT_SHORT_LABEL_PT[k]).join(' / ')
        notes.push(
          `${SLOT_LABEL_PT[chk.slot]} com ${piece.mainStatLabel} (recomendado: ${recLabels}).`,
        )
      }
    }
  }

  if (computed.pieces.length < 5) {
    notes.push(`Apenas ${computed.pieces.length}/5 peças equipadas.`)
  } else if (computed.avgArtifactLevel < 18) {
    notes.push(`Nível médio das peças está em +${Math.round(computed.avgArtifactLevel)} (ideal: +20).`)
  }

  if (setMatched && computed.pieces.length === 5 && computed.avgArtifactLevel >= 18 && mainStatIssues === 0) {
    return { status: 'built', label: 'Build Fechada', notes }
  }
  if (setMatched || (computed.pieces.length === 5 && mainStatIssues <= 1 && computed.avgArtifactLevel >= 16)) {
    return { status: 'partial', label: 'Ajustável', notes }
  }
  return { status: 'needs_farm', label: 'Precisa Farmar', notes }
}
