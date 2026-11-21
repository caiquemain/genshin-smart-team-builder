import { useEffect, useRef, useState } from 'react'
import {
  X, Download, Upload, Cloud, CloudOff, RefreshCw, CheckCircle2,
  AlertCircle, ShieldCheck, KeyRound, HardDrive,
} from 'lucide-react'
import {
  downloadAccountBackup,
  getLocalAccountSummary,
  restoreAccountBackup,
  validateAccountBackup,
} from '../utils/account-backup'
import {
  connectGoogleDrive,
  disconnectGoogleDrive,
  downloadBackupFromDrive,
  findDriveBackupFile,
  getActiveDriveToken,
  getDriveSyncMeta,
  getEnvGoogleClientId,
  getGoogleClientId,
  isAutoSyncEnabled,
  isDriveConnected,
  setAutoSyncEnabled,
  setGoogleClientId,
  uploadBackupToDrive,
  type DriveRemoteFileInfo,
} from '../utils/google-drive-sync'

function formatDatePt(iso: string | null): string {
  if (!iso) return 'Nunca'
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

export default function BackupSyncModal({
  onClose,
  onRestored,
}: {
  onClose: () => void
  onRestored?: () => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [summary, setSummary] = useState(() => getLocalAccountSummary())
  const [statusMsg, setStatusMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const envClientId = getEnvGoogleClientId()
  const [clientIdInput, setClientIdInput] = useState(() => getGoogleClientId())
  const [showClientIdConfig, setShowClientIdConfig] = useState(() => !getGoogleClientId())
  const [connected, setConnected] = useState(() => isDriveConnected())
  const [autoSync, setAutoSync] = useState(() => isAutoSyncEnabled())
  const [driveMeta, setDriveMeta] = useState(() => getDriveSyncMeta())
  const [remoteFile, setRemoteFile] = useState<DriveRemoteFileInfo | null>(null)
  const [busy, setBusy] = useState<null | 'connect' | 'upload' | 'restore'>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    const token = getActiveDriveToken()
    if (!token) return
    findDriveBackupFile(token)
      .then((file) => setRemoteFile(file))
      .catch(() => {})
  }, [])

  const clearFeedback = () => {
    setStatusMsg(null)
    setErrorMsg(null)
  }

  // === Backup Local ===
  const handleExportLocal = () => {
    clearFeedback()
    try {
      downloadAccountBackup()
      setSummary(getLocalAccountSummary())
      setStatusMsg('Backup local exportado com sucesso (.json).')
    } catch (err: any) {
      setErrorMsg(err?.message || String(err))
    }
  }

  const handleImportLocalFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    clearFeedback()
    try {
      const text = await file.text()
      const parsed = validateAccountBackup(JSON.parse(text))
      const ok = confirm(
        `Restaurar backup de ${formatDatePt(parsed.exported_at)}?\nIsso substituirá seu Roster, Planejador e Inventário atuais neste navegador.`,
      )
      if (!ok) return
      const res = restoreAccountBackup(parsed)
      setSummary(getLocalAccountSummary())
      setStatusMsg(
        `Backup restaurado! (${res.plannerCharsCount} personagem(ns) no planejador, ${res.rosterCount} no roster manual).`,
      )
      onRestored?.()
    } catch (err: any) {
      setErrorMsg(err?.message || String(err))
    }
  }

  // === Google Drive ===
  const handleSaveClientId = () => {
    clearFeedback()
    const trimmed = clientIdInput.trim()
    setGoogleClientId(trimmed)
    if (trimmed) {
      setShowClientIdConfig(false)
      setStatusMsg('Google Client ID salvo neste navegador.')
    }
  }

  const ensureToken = async (): Promise<string> => {
    const existing = getActiveDriveToken()
    if (existing) return existing
    const cid = clientIdInput.trim() || getGoogleClientId()
    if (!cid) {
      throw new Error('Configure o Google OAuth Client ID primeiro.')
    }
    setGoogleClientId(cid)
    const token = await connectGoogleDrive(cid, 'select_account')
    setConnected(true)
    return token
  }

  const handleConnectDrive = async () => {
    clearFeedback()
    setBusy('connect')
    try {
      const token = await ensureToken()
      const file = await findDriveBackupFile(token)
      setRemoteFile(file)
      setStatusMsg(
        file
          ? `Conectado ao Google Drive! Backup na nuvem encontrado (${formatDatePt(file.modifiedTime)}).`
          : 'Conectado ao Google Drive! Ainda não há backup salvo na nuvem.',
      )
    } catch (err: any) {
      setErrorMsg(err?.message || String(err))
    } finally {
      setBusy(null)
    }
  }

  const handleDisconnectDrive = () => {
    clearFeedback()
    disconnectGoogleDrive()
    setConnected(false)
    setRemoteFile(null)
    setStatusMsg('Desconectado do Google Drive.')
  }

  const handleUploadDrive = async () => {
    clearFeedback()
    setBusy('upload')
    try {
      const token = await ensureToken()
      const file = await uploadBackupToDrive(token)
      setRemoteFile(file)
      setDriveMeta(getDriveSyncMeta())
      setStatusMsg(`Backup salvo no Google Drive (${formatDatePt(file.modifiedTime)}).`)
    } catch (err: any) {
      setErrorMsg(err?.message || String(err))
    } finally {
      setBusy(null)
    }
  }

  const handleRestoreDrive = async () => {
    clearFeedback()
    setBusy('restore')
    try {
      const token = await ensureToken()
      const { file, backup } = await downloadBackupFromDrive(token)
      setRemoteFile(file)
      const ok = confirm(
        `Restaurar backup do Google Drive salvo em ${formatDatePt(file.modifiedTime)}?\nIsso substituirá seu Roster, Planejador e Inventário atuais neste navegador.`,
      )
      if (!ok) return
      const res = restoreAccountBackup(backup)
      setSummary(getLocalAccountSummary())
      setDriveMeta(getDriveSyncMeta())
      setStatusMsg(
        `Conta restaurada do Google Drive! (${res.plannerCharsCount} personagem(ns) no planejador, ${res.rosterCount} no roster manual).`,
      )
      onRestored?.()
    } catch (err: any) {
      setErrorMsg(err?.message || String(err))
    } finally {
      setBusy(null)
    }
  }

  const handleToggleAutoSync = () => {
    const next = !autoSync
    setAutoSync(next)
    setAutoSyncEnabled(next)
  }

  const activeClientId = envClientId || clientIdInput.trim()
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8080'

  return (
    <div className="backup-modal-overlay" onClick={onClose}>
      <div className="backup-modal" onClick={(e) => e.stopPropagation()}>
        <div className="backup-modal-header">
          <div className="backup-modal-title-wrap">
            <Cloud size={20} color="#7dd3fc" />
            <div>
              <h2>Backup & Sync na Nuvem</h2>
              <p>Salve e restaure seu Roster, Planejador e Inventário em qualquer dispositivo</p>
            </div>
          </div>
          <button type="button" className="backup-modal-close" onClick={onClose} aria-label="Fechar">
            <X size={20} />
          </button>
        </div>

        {/* Resumo local */}
        <div className="backup-summary-strip">
          <div><strong>{summary.plannerCharsCount}</strong> no Planejador</div>
          <div><strong>{Math.max(summary.rosterManualCount, summary.goodCharsCount)}</strong> no Roster</div>
          <div><strong>~{summary.estimatedKb} KB</strong> salvos</div>
        </div>

        {statusMsg && (
          <div className="backup-feedback is-success">
            <CheckCircle2 size={16} /> <span>{statusMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="backup-feedback is-error">
            <AlertCircle size={16} /> <span>{errorMsg}</span>
          </div>
        )}

        {/* Seção 1: Backup Local */}
        <section className="backup-section">
          <div className="backup-section-head">
            <h3><HardDrive size={16} /> Backup Local (.json)</h3>
            <span className="backup-meta-tag">Último: {formatDatePt(summary.lastLocalBackupAt)}</span>
          </div>
          <p className="backup-section-desc">
            Gera um arquivo único com seu Roster, Planejador, Inventário e configurações. Funciona imediatamente sem conta externa.
          </p>
          <div className="backup-actions-row">
            <button type="button" className="btn-primary" onClick={handleExportLocal}>
              <Download size={15} /> Exportar Backup (.json)
            </button>
            <button type="button" className="btn-secondary" onClick={() => fileInputRef.current?.click()}>
              <Upload size={15} /> Restaurar Arquivo
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              hidden
              onChange={handleImportLocalFile}
            />
          </div>
        </section>

        {/* Seção 2: Google Drive (estilo Seelie) */}
        <section className="backup-section">
          <div className="backup-section-head">
            <h3><Cloud size={16} /> Google Drive (estilo Seelie)</h3>
            <span className={`backup-conn-pill ${connected ? 'is-on' : ''}`}>
              {connected ? 'Conectado' : 'Desconectado'}
            </span>
          </div>
          <p className="backup-section-desc">
            <ShieldCheck size={14} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: 4, color: '#4ade80' }} />
            Usa apenas a pasta privada oculta do aplicativo (<code>appDataFolder</code>) — sem permissão para ver outros arquivos do seu Drive.
          </p>

          {!envClientId && (
            <div className="backup-clientid-box">
              <div className="backup-clientid-header">
                <span><KeyRound size={13} /> Google OAuth Client ID</span>
                {activeClientId && !showClientIdConfig && (
                  <button type="button" className="backup-link-btn" onClick={() => setShowClientIdConfig(true)}>
                    Alterar
                  </button>
                )}
              </div>
              {showClientIdConfig || !activeClientId ? (
                <>
                  <div className="backup-clientid-row">
                    <input
                      type="text"
                      placeholder="123456789-xxxx.apps.googleusercontent.com"
                      value={clientIdInput}
                      onChange={(e) => setClientIdInput(e.target.value)}
                    />
                    <button type="button" className="btn-secondary" onClick={handleSaveClientId}>
                      Salvar ID
                    </button>
                  </div>
                  <details className="backup-howto">
                    <summary>Como criar seu Client ID grátis no Google Cloud (2 min)</summary>
                    <ol>
                      <li>Acesse <code>console.cloud.google.com</code> → crie um projeto e ative a <strong>Google Drive API</strong>.</li>
                      <li>Em <strong>Tela de permissão OAuth</strong> (Externo), adicione seu e-mail em <em>Usuários de teste</em>.</li>
                      <li>Em <strong>Credenciais → Criar credenciais → ID do cliente OAuth → Aplicativo da Web</strong>.</li>
                      <li>Em <em>Origens JavaScript autorizadas</em>, adicione <code>{currentOrigin}</code> (ou defina <code>VITE_GOOGLE_CLIENT_ID</code> no <code>.env</code>).</li>
                    </ol>
                  </details>
                </>
              ) : (
                <div className="backup-clientid-saved">
                  Configurado: <code>{activeClientId.slice(0, 18)}…apps.googleusercontent.com</code>
                </div>
              )}
            </div>
          )}

          {activeClientId && (
            <>
              <div className="backup-actions-row" style={{ marginTop: 12 }}>
                {!connected ? (
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={busy !== null}
                    onClick={handleConnectDrive}
                  >
                    <Cloud size={15} /> {busy === 'connect' ? 'Conectando...' : 'Conectar Google Drive'}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={busy !== null}
                      onClick={handleUploadDrive}
                    >
                      <Upload size={15} /> {busy === 'upload' ? 'Salvando...' : 'Salvar no Drive'}
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={busy !== null}
                      onClick={handleRestoreDrive}
                    >
                      <RefreshCw size={15} /> {busy === 'restore' ? 'Restaurando...' : 'Restaurar do Drive'}
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ color: '#f87171' }}
                      disabled={busy !== null}
                      onClick={handleDisconnectDrive}
                    >
                      <CloudOff size={15} /> Sair
                    </button>
                  </>
                )}
              </div>

              <div className="backup-drive-footer">
                <label className="backup-autosync-toggle">
                  <input
                    type="checkbox"
                    checked={autoSync}
                    onChange={handleToggleAutoSync}
                  />
                  <span>Sync automático após edições (enquanto conectado)</span>
                </label>
                <div className="backup-drive-times">
                  {remoteFile && (
                    <span>Nuvem: <strong>{formatDatePt(remoteFile.modifiedTime)}</strong></span>
                  )}
                  {driveMeta.lastSyncAt && (
                    <span>Último sync: <strong>{formatDatePt(driveMeta.lastSyncAt)}</strong></span>
                  )}
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
