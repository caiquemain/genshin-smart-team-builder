import { useEffect, useState } from 'react'
import {
  X, Search, CheckCircle2, AlertCircle, AlertTriangle, Download, Sword, UserCheck,
} from 'lucide-react'
import { api } from '../api/client'
import { iconUrl } from '../config'
import { useLanguage } from '../context/LanguageContext'
import type { EnkaImportResponse } from '../types'
import { loadPlannerData } from '../utils/planner-data'
import {
  getSavedEnkaUid,
  mergeEnkaImportIntoStorage,
} from '../utils/planner-storage'

const ELEMENT_COLORS: Record<string, string> = {
  pyro: '#ff9c46',
  hydro: '#4cc2f1',
  electro: '#b398ff',
  cryo: '#93e2ff',
  anemo: '#73ffd0',
  geo: '#f2c869',
  dendro: '#a5c83b',
}

export default function UidImportModal({
  onClose,
  onImported,
  defaultSyncPlanner = true,
}: {
  onClose: () => void
  onImported?: (summary: {
    nickname: string
    rosterUpdated: number
    plannerAdded: number
    plannerUpdated: number
  }) => void
  defaultSyncPlanner?: boolean
}) {
  const { lang } = useLanguage()
  const [uid, setUid] = useState(() => getSavedEnkaUid())
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<EnkaImportResponse | null>(null)
  const [selectedSlugs, setSelectedSlugs] = useState<Set<string>>(new Set())

  const [syncRoster, setSyncRoster] = useState(true)
  const [syncPlanner, setSyncPlanner] = useState(defaultSyncPlanner)
  const [syncSettings, setSyncSettings] = useState(true)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleFetch = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const clean = uid.replace(/\D/g, '')
    setUid(clean)
    if (clean.length < 9 || clean.length > 10) {
      setError('Informe um UID válido com 9 ou 10 dígitos numéricos.')
      return
    }
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const data = await api.importEnkaUid(clean, lang)
      setResult(data)
      setSelectedSlugs(new Set(data.characters.map((c) => c.slug)))
    } catch (err: any) {
      setError(err?.message || String(err))
    } finally {
      setLoading(false)
    }
  }

  const toggleSlug = (slug: string) => {
    setSelectedSlugs((prev) => {
      const next = new Set(prev)
      if (next.has(slug)) next.delete(slug)
      else next.add(slug)
      return next
    })
  }

  const handleApply = async () => {
    if (!result || selectedSlugs.size === 0) return
    setApplying(true)
    setError(null)
    try {
      const plannerData = syncPlanner ? await loadPlannerData() : null
      const summary = mergeEnkaImportIntoStorage(
        result,
        Array.from(selectedSlugs),
        plannerData,
        lang,
        { syncRoster, syncPlanner, syncSettings },
      )
      onImported?.({ nickname: result.nickname, ...summary })
      onClose()
    } catch (err: any) {
      setError(err?.message || String(err))
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="backup-modal-overlay" onClick={onClose}>
      <div className="backup-modal uid-modal" onClick={(e) => e.stopPropagation()}>
        <div className="backup-modal-header">
          <div className="backup-modal-title-wrap">
            <UserCheck size={20} color="#7dd3fc" />
            <div>
              <h2>Importar por UID (Enka.Network)</h2>
              <p>Puxa nível, constelação, talentos e arma dos personagens exibidos na vitrine do seu perfil</p>
            </div>
          </div>
          <button type="button" className="backup-modal-close" onClick={onClose} aria-label="Fechar">
            <X size={20} />
          </button>
        </div>

        <form className="uid-search-row" onSubmit={handleFetch}>
          <input
            type="text"
            inputMode="numeric"
            autoFocus
            maxLength={10}
            placeholder="Digite seu UID (ex.: 612345678)"
            value={uid}
            onChange={(e) => setUid(e.target.value.replace(/\D/g, ''))}
          />
          <button type="submit" className="btn-primary" disabled={loading || uid.length < 9}>
            <Search size={15} /> {loading ? 'Buscando...' : 'Buscar vitrine'}
          </button>
        </form>

        <p className="uid-hint">
          Dica: no Genshin, você pode exibir até <strong>12 personagens</strong> na vitrine do perfil e ativar{' '}
          <em>"Mostrar detalhes do personagem"</em> para importar talentos, constelações e armas.
        </p>

        {error && (
          <div className="backup-feedback is-error">
            <AlertCircle size={16} /> <span>{error}</span>
          </div>
        )}

        {result && (
          <>
            <div className="uid-player-card">
              <div>
                <div className="uid-player-name">{result.nickname}</div>
                {result.signature && <div className="uid-player-sig">{result.signature}</div>}
              </div>
              <div className="uid-player-badges">
                {result.ar != null && <span>AR {result.ar}</span>}
                {result.wl != null && <span>WL {result.wl}</span>}
                <span>{result.characters.length} na vitrine</span>
              </div>
            </div>

            {result.showcase_hidden && (
              <div className="uid-warn-banner">
                <AlertTriangle size={16} />
                <span>
                  Os <strong>detalhes dos personagens</strong> estão ocultos no seu perfil do Genshin. Conseguimos ler apenas a lista e o nível — ative <em>"Mostrar detalhes do personagem"</em> no jogo (e aguarde ~5 min) para puxar talentos, constelação e arma.
                </span>
              </div>
            )}

            {result.characters.length === 0 ? (
              <div className="uid-warn-banner">
                <AlertTriangle size={16} />
                <span>
                  Nenhum personagem está exposto na vitrine deste perfil. Adicione personagens à vitrine dentro do Genshin e tente novamente.
                </span>
              </div>
            ) : (
              <>
                <div className="uid-select-bar">
                  <span>
                    <strong>{selectedSlugs.size}</strong> de {result.characters.length} selecionado(s)
                  </span>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      type="button"
                      className="backup-link-btn"
                      onClick={() => setSelectedSlugs(new Set(result.characters.map((c) => c.slug)))}
                    >
                      Selecionar todos
                    </button>
                    <button
                      type="button"
                      className="backup-link-btn"
                      onClick={() => setSelectedSlugs(new Set())}
                    >
                      Limpar
                    </button>
                  </div>
                </div>

                <div className="uid-chars-grid">
                  {result.characters.map((c) => {
                    const checked = selectedSlugs.has(c.slug)
                    const img = iconUrl(c.icon)
                    const wImg = c.weapon?.icon ? iconUrl(c.weapon.icon) : null
                    const accent = ELEMENT_COLORS[c.element] || '#7dd3fc'
                    return (
                      <button
                        key={c.slug}
                        type="button"
                        className={`uid-char-item ${checked ? 'is-selected' : ''}`}
                        style={{ '--char-accent': accent } as React.CSSProperties}
                        onClick={() => toggleSlug(c.slug)}
                      >
                        <div className="uid-char-avatar">
                          {img ? <img src={img} alt={c.name} loading="lazy" /> : <span>?</span>}
                          <span className="uid-char-check">{checked ? <CheckCircle2 size={14} /> : null}</span>
                        </div>
                        <div className="uid-char-info">
                          <div className="uid-char-name">{c.name}</div>
                          <div className="uid-char-stats">
                            <span>Nv.{c.level}</span>
                            {c.has_detail && (
                              <>
                                <span>·</span>
                                <span>C{c.cons}</span>
                                <span>·</span>
                                <span>{c.na}/{c.es}/{c.eb}</span>
                                {(c.artifacts?.length ?? 0) > 0 && (
                                  <>
                                    <span>·</span>
                                    <span>{c.artifacts!.length} art.</span>
                                  </>
                                )}
                              </>
                            )}
                          </div>
                          {c.weapon && (
                            <div className="uid-char-weapon">
                              {wImg ? <img src={wImg} alt={c.weapon.name} loading="lazy" /> : <Sword size={11} />}
                              <span>{c.weapon.name}</span>
                              <small>Nv.{c.weapon.level} R{c.weapon.refinement}</small>
                            </div>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>

                <div className="uid-sync-options">
                  <label className="backup-autosync-toggle">
                    <input type="checkbox" checked={syncRoster} onChange={(e) => setSyncRoster(e.target.checked)} />
                    <span>Marcar no <strong>Meu Roster</strong> (aditivo, não remove os outros)</span>
                  </label>
                  <label className="backup-autosync-toggle">
                    <input type="checkbox" checked={syncPlanner} onChange={(e) => setSyncPlanner(e.target.checked)} />
                    <span>Sincronizar nível, talentos e arma no <strong>Planejador</strong></span>
                  </label>
                  <label className="backup-autosync-toggle">
                    <input type="checkbox" checked={syncSettings} onChange={(e) => setSyncSettings(e.target.checked)} />
                    <span>Atualizar <strong>AR / WL</strong> ({result.ar ?? '—'} / {result.wl ?? '—'})</span>
                  </label>
                </div>

                <div className="backup-actions-row" style={{ justifyContent: 'flex-end' }}>
                  <button type="button" className="btn-secondary" onClick={onClose}>
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={applying || selectedSlugs.size === 0 || (!syncRoster && !syncPlanner && !syncSettings)}
                    onClick={handleApply}
                  >
                    <Download size={15} />
                    {applying ? 'Importando...' : `Importar ${selectedSlugs.size} personagem(ns)`}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
