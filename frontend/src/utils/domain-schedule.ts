import type { Plan } from '../types/planner'
import { pickLang, type PlannerData } from './planner-data'
import { estimateResin } from './resin'

export type ScheduleKey = 'mon_thu' | 'tue_fri' | 'wed_sat'

export interface DomainFamilySchedule {
  family: string
  kind: 'talent' | 'weapon'
  region: string
  schedule: ScheduleKey
  days: number[] // 0=Dom, 1=Seg, ..., 6=Sáb
}

const DAYS_BY_SCHEDULE: Record<ScheduleKey, number[]> = {
  mon_thu: [1, 4, 0],
  tue_fri: [2, 5, 0],
  wed_sat: [3, 6, 0],
}

export const SCHEDULE_LABELS_PT: Record<ScheduleKey, string> = {
  mon_thu: 'Seg / Qui / Dom',
  tue_fri: 'Ter / Sex / Dom',
  wed_sat: 'Qua / Sáb / Dom',
}

export const DAY_LABELS_PT: { day: number; short: string; full: string }[] = [
  { day: 1, short: 'Seg', full: 'Segunda-feira' },
  { day: 2, short: 'Ter', full: 'Terça-feira' },
  { day: 3, short: 'Qua', full: 'Quarta-feira' },
  { day: 4, short: 'Qui', full: 'Quinta-feira' },
  { day: 5, short: 'Sex', full: 'Sexta-feira' },
  { day: 6, short: 'Sáb', full: 'Sábado' },
  { day: 0, short: 'Dom', full: 'Domingo (Todos)' },
]

// Mapeamento completo de todas as famílias de Livros de Talento e Materiais de Arma (1.0 -> 7.x)
const RAW_SCHEDULE: Array<[string, 'talent' | 'weapon', string, ScheduleKey]> = [
  // Talentos — Mondstadt
  ['freedom', 'talent', 'Mondstadt', 'mon_thu'],
  ['resistance', 'talent', 'Mondstadt', 'tue_fri'],
  ['ballad', 'talent', 'Mondstadt', 'wed_sat'],
  // Talentos — Liyue
  ['prosperity', 'talent', 'Liyue', 'mon_thu'],
  ['diligence', 'talent', 'Liyue', 'tue_fri'],
  ['gold', 'talent', 'Liyue', 'wed_sat'],
  // Talentos — Inazuma
  ['transience', 'talent', 'Inazuma', 'mon_thu'],
  ['elegance', 'talent', 'Inazuma', 'tue_fri'],
  ['light', 'talent', 'Inazuma', 'wed_sat'],
  // Talentos — Sumeru
  ['admonition', 'talent', 'Sumeru', 'mon_thu'],
  ['ingenuity', 'talent', 'Sumeru', 'tue_fri'],
  ['praxis', 'talent', 'Sumeru', 'wed_sat'],
  // Talentos — Fontaine
  ['equity', 'talent', 'Fontaine', 'mon_thu'],
  ['fairness', 'talent', 'Fontaine', 'mon_thu'],
  ['justice', 'talent', 'Fontaine', 'tue_fri'],
  ['order', 'talent', 'Fontaine', 'wed_sat'],
  // Talentos — Natlan
  ['contention', 'talent', 'Natlan', 'mon_thu'],
  ['kindling', 'talent', 'Natlan', 'tue_fri'],
  ['conflict', 'talent', 'Natlan', 'wed_sat'],
  // Talentos — Nod-Krai (6.x)
  ['moonlight', 'talent', 'Nod-Krai', 'mon_thu'],
  ['elysium', 'talent', 'Nod-Krai', 'tue_fri'],
  ['vagrancy', 'talent', 'Nod-Krai', 'wed_sat'],
  // Talentos — Snezhnaya (7.x)
  ['charity', 'talent', 'Snezhnaya', 'mon_thu'],
  ['fortitude', 'talent', 'Snezhnaya', 'tue_fri'],
  ['glory', 'talent', 'Snezhnaya', 'wed_sat'],

  // Armas — Mondstadt
  ['decarabian', 'weapon', 'Mondstadt', 'mon_thu'],
  ['boreal_wolf', 'weapon', 'Mondstadt', 'tue_fri'],
  ['dandelion_gladiator', 'weapon', 'Mondstadt', 'wed_sat'],
  // Armas — Liyue
  ['guyun', 'weapon', 'Liyue', 'mon_thu'],
  ['mist_veiled_elixer', 'weapon', 'Liyue', 'tue_fri'],
  ['aerosiderite', 'weapon', 'Liyue', 'wed_sat'],
  // Armas — Inazuma
  ['sea_branch', 'weapon', 'Inazuma', 'mon_thu'],
  ['narukami', 'weapon', 'Inazuma', 'tue_fri'],
  ['mask_w', 'weapon', 'Inazuma', 'wed_sat'],
  // Armas — Sumeru
  ['talisman', 'weapon', 'Sumeru', 'mon_thu'],
  ['oasis_gardens', 'weapon', 'Sumeru', 'tue_fri'],
  ['scorching_might', 'weapon', 'Sumeru', 'wed_sat'],
  // Armas — Fontaine
  ['ancient_chord', 'weapon', 'Fontaine', 'mon_thu'],
  ['dewdrop', 'weapon', 'Fontaine', 'tue_fri'],
  ['pristine_sea', 'weapon', 'Fontaine', 'wed_sat'],
  // Armas — Natlan
  ['bs_heart', 'weapon', 'Natlan', 'mon_thu'],
  ['delirious', 'weapon', 'Natlan', 'tue_fri'],
  ['night_wind', 'weapon', 'Natlan', 'wed_sat'],
  // Armas — Nod-Krai (6.x)
  ['artful_device', 'weapon', 'Nod-Krai', 'mon_thu'],
  ['flint', 'weapon', 'Nod-Krai', 'tue_fri'],
  ['far_north_scions', 'weapon', 'Nod-Krai', 'wed_sat'],
  // Armas — Snezhnaya (7.x)
  ['pale_star', 'weapon', 'Snezhnaya', 'mon_thu'],
  ['spiritual_nectar', 'weapon', 'Snezhnaya', 'tue_fri'],
  ['frost_emperor', 'weapon', 'Snezhnaya', 'wed_sat'],
]

const SCHEDULE_MAP = new Map<string, DomainFamilySchedule>()
for (const [family, kind, region, schedule] of RAW_SCHEDULE) {
  const entry: DomainFamilySchedule = {
    family,
    kind,
    region,
    schedule,
    days: DAYS_BY_SCHEDULE[schedule],
  }
  SCHEDULE_MAP.set(family, entry)
  SCHEDULE_MAP.set(family.replace(/_/g, '-'), entry)
}

export function getFamilySchedule(familyKey: string): DomainFamilySchedule | null {
  return SCHEDULE_MAP.get(familyKey) ?? SCHEDULE_MAP.get(familyKey.replace(/-/g, '_')) ?? null
}

/**
 * Retorna o dia da semana atual do Genshin (0=Dom..6=Sáb), respeitando
 * o reset diário às 04:00 (entre 00:00 e 03:59 ainda conta como o dia anterior).
 */
export function getGenshinDayOfWeek(now: Date = new Date()): number {
  const d = new Date(now.getTime())
  if (d.getHours() < 4) {
    d.setDate(d.getDate() - 1)
  }
  return d.getDay()
}

export interface DailyDomainTierItem {
  slug: string
  name: string
  icon: string | null
  rarity: number
  needed: number
  have: number
  missing: number
}

export interface DailyDomainEntry {
  familyKey: string
  displayName: string
  icon: string | null
  rarity: number
  kind: 'talent' | 'weapon'
  region: string
  schedule: ScheduleKey
  scheduleLabel: string
  resinMissing: number
  tiers: DailyDomainTierItem[]
  usedBy: Array<{ slug: string; name: string; icon: string | null; kind: 'character' | 'weapon' }>
}

export interface DailyFarmPlan {
  dayOfWeek: number
  talentDomains: DailyDomainEntry[]
  weaponDomains: DailyDomainEntry[]
  totalMissingResin: number
  openCount: number
  otherDaysCount: number
}

export function computeDailyFarmPlan(
  plan: Plan,
  data: PlannerData,
  dayOfWeek: number,
  lang: string = 'pt',
): DailyFarmPlan {
  // Índice slug -> familyKey (apenas famílias com agenda de domínio)
  const slugToFamily = new Map<string, string>()
  for (const [famKey, slugs] of Object.entries(data.families)) {
    if (!getFamilySchedule(famKey)) continue
    for (const s of slugs) slugToFamily.set(s, famKey)
  }

  // Acumula demanda total por material e quem usa cada família
  const neededBySlug = new Map<string, number>()
  const usersByFamily = new Map<
    string,
    Map<string, { slug: string; name: string; icon: string | null; kind: 'character' | 'weapon' }>
  >()

  const registerMat = (
    matSlug: string,
    qty: number,
    user: { slug: string; name: string; icon: string | null; kind: 'character' | 'weapon' },
  ) => {
    const fam = slugToFamily.get(matSlug)
    if (!fam || qty <= 0) return
    neededBySlug.set(matSlug, (neededBySlug.get(matSlug) ?? 0) + qty)
    if (!usersByFamily.has(fam)) usersByFamily.set(fam, new Map())
    usersByFamily.get(fam)!.set(`${user.kind}:${user.slug}`, user)
  }

  for (const c of plan.chars) {
    if (c.is_inactive) continue
    if (c.talents?.grand_total_materials) {
      for (const m of c.talents.grand_total_materials) {
        registerMat(m.slug, m.quantity, {
          slug: c.slug,
          name: c.name,
          icon: c.icon,
          kind: 'character',
        })
      }
    }
    for (const w of c.weapons ?? []) {
      if (w.cost?.materials) {
        for (const m of w.cost.materials) {
          registerMat(m.slug, m.quantity, {
            slug: w.slug,
            name: w.name,
            icon: w.icon,
            kind: 'weapon',
          })
        }
      }
    }
  }

  const inv = plan.inventory_resolved || {}
  const talentDomains: DailyDomainEntry[] = []
  const weaponDomains: DailyDomainEntry[] = []
  let otherDaysCount = 0

  for (const [famKey, usersMap] of usersByFamily.entries()) {
    const sched = getFamilySchedule(famKey)
    if (!sched) continue
    const famSlugs = data.families[famKey] ?? []

    const tiers: DailyDomainTierItem[] = []
    let familyMissingTotal = 0
    let resinMissing = 0

    for (const s of famSlugs) {
      const needed = neededBySlug.get(s) ?? 0
      if (needed <= 0) continue
      const meta = data.materials[s]
      const have = inv[s] ?? 0
      const missing = Math.max(0, needed - have)
      familyMissingTotal += missing
      if (missing > 0) {
        resinMissing += estimateResin(meta?.category ?? (sched.kind === 'talent' ? 'talent_book' : 'weapon_ascension'), missing)
      }
      tiers.push({
        slug: s,
        name: meta ? pickLang(meta.name, lang) : s,
        icon: meta?.icon ?? null,
        rarity: meta?.rarity ?? 2,
        needed,
        have,
        missing,
      })
    }

    if (familyMissingTotal <= 0) continue

    const isOpen = sched.days.includes(dayOfWeek)
    if (!isOpen) {
      otherDaysCount++
      continue
    }

    tiers.sort((a, b) => a.rarity - b.rarity)
    const topTier = tiers[tiers.length - 1]
    // Nome limpo da família baseado no maior tier
    const displayName = topTier?.name || famKey

    const entry: DailyDomainEntry = {
      familyKey: famKey,
      displayName,
      icon: topTier?.icon ?? null,
      rarity: topTier?.rarity ?? 4,
      kind: sched.kind,
      region: sched.region,
      schedule: sched.schedule,
      scheduleLabel: SCHEDULE_LABELS_PT[sched.schedule],
      resinMissing,
      tiers,
      usedBy: Array.from(usersMap.values()),
    }

    if (sched.kind === 'talent') talentDomains.push(entry)
    else weaponDomains.push(entry)
  }

  talentDomains.sort((a, b) => b.resinMissing - a.resinMissing || a.displayName.localeCompare(b.displayName))
  weaponDomains.sort((a, b) => b.resinMissing - a.resinMissing || a.displayName.localeCompare(b.displayName))

  const totalMissingResin =
    talentDomains.reduce((s, d) => s + d.resinMissing, 0) +
    weaponDomains.reduce((s, d) => s + d.resinMissing, 0)

  return {
    dayOfWeek,
    talentDomains,
    weaponDomains,
    totalMissingResin,
    openCount: talentDomains.length + weaponDomains.length,
    otherDaysCount,
  }
}
