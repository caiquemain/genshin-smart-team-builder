import {
  exportAccountBackup,
  validateAccountBackup,
  type AccountBackupPayload,
} from './account-backup'
import { PLANNER_UPDATED_EVENT } from './planner-storage'

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata'
const DRIVE_BACKUP_FILENAME = 'genshin-smart-team-builder-backup.json'
const GDRIVE_CLIENT_ID_KEY = 'gsb.gdrive.client_id'
const GDRIVE_META_KEY = 'gsb.gdrive.meta'
const GDRIVE_AUTOSYNC_KEY = 'gsb.gdrive.autosync'

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string
            scope: string
            callback: (resp: { access_token?: string; expires_in?: number; error?: string; error_description?: string }) => void
            error_callback?: (err: { type?: string; message?: string }) => void
          }) => { requestAccessToken: (opts?: { prompt?: string }) => void }
          revoke: (token: string, done?: () => void) => void
        }
      }
    }
  }
}

export interface DriveSyncMeta {
  lastSyncAt: string | null
  lastAction: 'upload' | 'restore' | null
  cloudModifiedAt: string | null
  fileId: string | null
}

export interface DriveRemoteFileInfo {
  id: string
  name: string
  modifiedTime: string
  size?: string
}

let gsiScriptPromise: Promise<void> | null = null
let cachedToken: string | null = null
let cachedTokenExpiresAt = 0

export function getEnvGoogleClientId(): string {
  const val = (import.meta as any)?.env?.VITE_GOOGLE_CLIENT_ID
  return typeof val === 'string' ? val.trim() : ''
}

export function getGoogleClientId(): string {
  const fromEnv = getEnvGoogleClientId()
  if (fromEnv) return fromEnv
  try {
    return (localStorage.getItem(GDRIVE_CLIENT_ID_KEY) || '').trim()
  } catch {
    return ''
  }
}

export function setGoogleClientId(clientId: string): void {
  try {
    const trimmed = clientId.trim()
    if (trimmed) localStorage.setItem(GDRIVE_CLIENT_ID_KEY, trimmed)
    else localStorage.removeItem(GDRIVE_CLIENT_ID_KEY)
  } catch {}
}

export function isAutoSyncEnabled(): boolean {
  try {
    return localStorage.getItem(GDRIVE_AUTOSYNC_KEY) === '1'
  } catch {
    return false
  }
}

export function setAutoSyncEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(GDRIVE_AUTOSYNC_KEY, enabled ? '1' : '0')
  } catch {}
}

export function getDriveSyncMeta(): DriveSyncMeta {
  try {
    const raw = localStorage.getItem(GDRIVE_META_KEY)
    if (!raw) return { lastSyncAt: null, lastAction: null, cloudModifiedAt: null, fileId: null }
    const parsed = JSON.parse(raw)
    return {
      lastSyncAt: parsed?.lastSyncAt ?? null,
      lastAction: parsed?.lastAction ?? null,
      cloudModifiedAt: parsed?.cloudModifiedAt ?? null,
      fileId: parsed?.fileId ?? null,
    }
  } catch {
    return { lastSyncAt: null, lastAction: null, cloudModifiedAt: null, fileId: null }
  }
}

function saveDriveSyncMeta(patch: Partial<DriveSyncMeta>): DriveSyncMeta {
  const next: DriveSyncMeta = { ...getDriveSyncMeta(), ...patch }
  try {
    localStorage.setItem(GDRIVE_META_KEY, JSON.stringify(next))
  } catch {}
  return next
}

export function getActiveDriveToken(): string | null {
  if (!cachedToken) return null
  if (Date.now() >= cachedTokenExpiresAt - 60_000) {
    cachedToken = null
    cachedTokenExpiresAt = 0
    return null
  }
  return cachedToken
}

export function isDriveConnected(): boolean {
  return getActiveDriveToken() !== null
}

export function loadGoogleIdentityScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Ambiente sem browser'))
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  if (gsiScriptPromise) return gsiScriptPromise

  gsiScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[src*="accounts.google.com/gsi/client"]')
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('Falha ao carregar Google Identity Services.')), { once: true })
      return
    }
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => {
      gsiScriptPromise = null
      reject(new Error('Não foi possível carregar o script de login do Google (verifique sua conexão).'))
    }
    document.head.appendChild(script)
  })
  return gsiScriptPromise
}

export async function connectGoogleDrive(
  clientIdOverride?: string,
  prompt: '' | 'consent' | 'select_account' = 'select_account',
): Promise<string> {
  const clientId = (clientIdOverride ?? getGoogleClientId()).trim()
  if (!clientId) {
    throw new Error('Configure o Google OAuth Client ID antes de conectar ao Google Drive.')
  }
  await loadGoogleIdentityScript()
  const oauth2 = window.google?.accounts?.oauth2
  if (!oauth2) {
    throw new Error('Google Identity Services não foi inicializado corretamente.')
  }

  return new Promise<string>((resolve, reject) => {
    const tokenClient = oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPE,
      callback: (resp) => {
        if (resp.error || !resp.access_token) {
          reject(new Error(resp.error_description || resp.error || 'Autorização cancelada.'))
          return
        }
        cachedToken = resp.access_token
        cachedTokenExpiresAt = Date.now() + (resp.expires_in ?? 3600) * 1000
        resolve(resp.access_token)
      },
      error_callback: (err) => {
        reject(new Error(err?.message || err?.type || 'Falha ao abrir janela de login do Google.'))
      },
    })
    tokenClient.requestAccessToken({ prompt })
  })
}

export function disconnectGoogleDrive(): void {
  const token = cachedToken
  cachedToken = null
  cachedTokenExpiresAt = 0
  if (token && window.google?.accounts?.oauth2?.revoke) {
    try {
      window.google.accounts.oauth2.revoke(token)
    } catch {}
  }
}

export async function findDriveBackupFile(token: string): Promise<DriveRemoteFileInfo | null> {
  const q = encodeURIComponent(`name='${DRIVE_BACKUP_FILENAME}' and trashed=false`)
  const url = `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${q}&fields=files(id,name,modifiedTime,size)&orderBy=modifiedTime desc&pageSize=1`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (res.status === 401) {
    cachedToken = null
    throw new Error('Sessão do Google expirada. Clique em "Conectar Google Drive" novamente.')
  }
  if (!res.ok) {
    throw new Error(`Erro ao consultar Google Drive (HTTP ${res.status}).`)
  }
  const body = await res.json()
  const file = body?.files?.[0]
  if (!file) return null
  return {
    id: file.id,
    name: file.name,
    modifiedTime: file.modifiedTime,
    size: file.size,
  }
}

export async function uploadBackupToDrive(
  token: string,
  payload: AccountBackupPayload = exportAccountBackup(),
): Promise<DriveRemoteFileInfo> {
  const existing = await findDriveBackupFile(token)
  const boundary = '-------gsb_drive_boundary_314159'
  const metadata = existing
    ? { name: DRIVE_BACKUP_FILENAME, mimeType: 'application/json' }
    : { name: DRIVE_BACKUP_FILENAME, parents: ['appDataFolder'], mimeType: 'application/json' }

  const multipartBody =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(payload)}\r\n` +
    `--${boundary}--`

  const endpoint = existing
    ? `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(existing.id)}?uploadType=multipart&fields=id,name,modifiedTime,size`
    : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime,size`

  const res = await fetch(endpoint, {
    method: existing ? 'PATCH' : 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipartBody,
  })

  if (res.status === 401) {
    cachedToken = null
    throw new Error('Sessão do Google expirada. Conecte novamente para sincronizar.')
  }
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Falha ao salvar backup no Google Drive (HTTP ${res.status}): ${errText.slice(0, 160)}`)
  }

  const file = (await res.json()) as DriveRemoteFileInfo
  saveDriveSyncMeta({
    lastSyncAt: new Date().toISOString(),
    lastAction: 'upload',
    cloudModifiedAt: file.modifiedTime,
    fileId: file.id,
  })
  return file
}

export async function downloadBackupFromDrive(token: string): Promise<{
  file: DriveRemoteFileInfo
  backup: AccountBackupPayload
}> {
  const file = await findDriveBackupFile(token)
  if (!file) {
    throw new Error('Nenhum backup encontrado na pasta do app no seu Google Drive.')
  }

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  if (res.status === 401) {
    cachedToken = null
    throw new Error('Sessão do Google expirada. Conecte novamente.')
  }
  if (!res.ok) {
    throw new Error(`Falha ao baixar backup do Google Drive (HTTP ${res.status}).`)
  }

  const raw = await res.json()
  const backup = validateAccountBackup(raw)
  saveDriveSyncMeta({
    lastSyncAt: new Date().toISOString(),
    lastAction: 'restore',
    cloudModifiedAt: file.modifiedTime,
    fileId: file.id,
  })
  return { file, backup }
}

/**
 * Inscreve listener global para auto-sync silencioso quando o usuário
 * estiver conectado ao Google Drive com a opção Auto-Sync ativada.
 */
export function attachDriveAutoSyncListener(): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null
  const onUpdate = () => {
    if (!isAutoSyncEnabled()) return
    const token = getActiveDriveToken()
    if (!token) return
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      const freshToken = getActiveDriveToken()
      if (!freshToken || !isAutoSyncEnabled()) return
      uploadBackupToDrive(freshToken).catch((err) => {
        console.warn('[gdrive-sync] Falha no auto-sync:', err)
      })
    }, 4500)
  }

  window.addEventListener(PLANNER_UPDATED_EVENT, onUpdate)
  return () => {
    if (timer) clearTimeout(timer)
    window.removeEventListener(PLANNER_UPDATED_EVENT, onUpdate)
  }
}
