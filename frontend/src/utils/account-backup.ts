import type { Plan } from '../types/planner'
import {
  PLANNER_PLAN_KEY,
  PLANNER_V5_KEY,
  ROSTER_KEY,
  compactPlanForStorage,
  emitPlannerUpdated,
} from './planner-storage'

const LANG_KEY = 'gsb.lang'
const LAST_LOCAL_BACKUP_KEY = 'gsb.backup.last_local'

export interface AccountBackupData {
  roster: Record<string, any> | null
  planner_v5: Record<string, any> | null
  planner_plan: Plan | null
  language: string | null
}

export interface AccountBackupPayload {
  format: 'GSB_BACKUP'
  version: 1
  exported_at: string
  data: AccountBackupData
}

function safeParseJson<T>(raw: string | null): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function exportAccountBackup(): AccountBackupPayload {
  const roster = safeParseJson<Record<string, any>>(localStorage.getItem(ROSTER_KEY))
  const plannerV5 = safeParseJson<Record<string, any>>(localStorage.getItem(PLANNER_V5_KEY))
  const rawPlan = safeParseJson<Plan>(localStorage.getItem(PLANNER_PLAN_KEY))
  const plannerPlan = rawPlan ? compactPlanForStorage(rawPlan) : null
  const language = localStorage.getItem(LANG_KEY)

  return {
    format: 'GSB_BACKUP',
    version: 1,
    exported_at: new Date().toISOString(),
    data: {
      roster,
      planner_v5: plannerV5,
      planner_plan: plannerPlan,
      language,
    },
  }
}

export function validateAccountBackup(raw: unknown): AccountBackupPayload {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Arquivo de backup inválido (não é um objeto JSON).')
  }
  const obj = raw as Record<string, unknown>
  if (obj.format !== 'GSB_BACKUP') {
    throw new Error('Arquivo não é um backup do Genshin Smart Team Builder (falta "format": "GSB_BACKUP").')
  }
  if (!obj.data || typeof obj.data !== 'object') {
    throw new Error('Backup corrompido (falta o bloco "data").')
  }
  const data = obj.data as Record<string, unknown>
  return {
    format: 'GSB_BACKUP',
    version: 1,
    exported_at: typeof obj.exported_at === 'string' ? obj.exported_at : new Date().toISOString(),
    data: {
      roster: (data.roster && typeof data.roster === 'object' ? data.roster : null) as Record<string, any> | null,
      planner_v5: (data.planner_v5 && typeof data.planner_v5 === 'object' ? data.planner_v5 : null) as Record<string, any> | null,
      planner_plan: (data.planner_plan && typeof data.planner_plan === 'object' ? data.planner_plan : null) as Plan | null,
      language: typeof data.language === 'string' ? data.language : null,
    },
  }
}

export function restoreAccountBackup(backup: AccountBackupPayload): {
  rosterCount: number
  plannerCharsCount: number
} {
  const validated = validateAccountBackup(backup)
  const { roster, planner_v5, planner_plan, language } = validated.data

  if (roster) {
    localStorage.setItem(ROSTER_KEY, JSON.stringify(roster))
  } else {
    localStorage.removeItem(ROSTER_KEY)
  }

  if (planner_v5) {
    localStorage.setItem(PLANNER_V5_KEY, JSON.stringify(planner_v5))
  } else {
    localStorage.removeItem(PLANNER_V5_KEY)
  }

  if (planner_plan) {
    localStorage.setItem(PLANNER_PLAN_KEY, JSON.stringify(compactPlanForStorage(planner_plan)))
  } else {
    localStorage.removeItem(PLANNER_PLAN_KEY)
  }

  if (language) {
    localStorage.setItem(LANG_KEY, language)
  }

  emitPlannerUpdated()

  const rosterCount = roster ? Object.values(roster).filter((v: any) => v?.owned).length : 0
  const plannerCharsCount = Array.isArray(planner_plan?.chars) ? planner_plan.chars.length : 0
  return { rosterCount, plannerCharsCount }
}

export function downloadAccountBackup(): AccountBackupPayload {
  const payload = exportAccountBackup()
  const json = JSON.stringify(payload, null, 2)
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const datePart = new Date().toISOString().slice(0, 10)
  const link = document.createElement('a')
  link.href = url
  link.download = `gsb-backup-${datePart}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
  try {
    localStorage.setItem(LAST_LOCAL_BACKUP_KEY, payload.exported_at)
  } catch {}
  return payload
}

export function getLocalAccountSummary(): {
  rosterManualCount: number
  goodCharsCount: number
  plannerCharsCount: number
  lastLocalBackupAt: string | null
  estimatedKb: number
} {
  const rawRoster = localStorage.getItem(ROSTER_KEY)
  const rawV5 = localStorage.getItem(PLANNER_V5_KEY)
  const rawPlan = localStorage.getItem(PLANNER_PLAN_KEY)

  const roster = safeParseJson<Record<string, any>>(rawRoster)
  const v5 = safeParseJson<Record<string, any>>(rawV5)
  const plan = safeParseJson<Plan>(rawPlan)

  const totalBytes = (rawRoster?.length ?? 0) + (rawV5?.length ?? 0) + (rawPlan?.length ?? 0)

  return {
    rosterManualCount: roster ? Object.values(roster).filter((v: any) => v?.owned).length : 0,
    goodCharsCount: Array.isArray(v5?.good?.characters) ? v5.good.characters.length : 0,
    plannerCharsCount: Array.isArray(plan?.chars) ? plan.chars.length : 0,
    lastLocalBackupAt: localStorage.getItem(LAST_LOCAL_BACKUP_KEY),
    estimatedKb: Math.max(1, Math.round(totalBytes / 1024)),
  }
}
