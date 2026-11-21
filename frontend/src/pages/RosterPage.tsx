import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, CheckCircle2, UserX, Upload, Trash2, CheckCheck, X, Star, Sparkles, UserCheck } from 'lucide-react'
import { api } from '../api/client'
import { useLanguage } from '../context/LanguageContext'
import { iconUrl } from '../config'
import { useRoster } from '../utils/roster'
import UidImportModal from '../components/UidImportModal'
import type { CharacterSummary } from '../types'

const ELEMENT_ORDER = ['pyro', 'hydro', 'electro', 'cryo', 'anemo', 'geo', 'dendro']
const ELEMENT_COLORS: Record<string, string> = {
  pyro: '#ff9c46', hydro: '#4cc2f1', electro: '#b398ff', cryo: '#93e2ff',
  anemo: '#73ffd0', geo: '#f2c869', dendro: '#a5c83b',
}
const WEAPON_ORDER = ['sword', 'claymore', 'polearm', 'bow', 'catalyst']
const WEAPON_LABELS: Record<string, string> = {
  sword: 'Espada', claymore: 'Claymore', polearm: 'Lança',
  bow: 'Arco', catalyst: 'Catalisador',
}

type StatusFilter = 'all' | 'owned' | 'missing'

export default function RosterPage() {
  const { lang } = useLanguage()
  const roster = useRoster()
  const [chars, setChars] = useState<CharacterSummary[]>([])
  const [search, setSearch] = useState('')
  const [elemFilter, setElemFilter] = useState('all')
  const [rarityFilter, setRarityFilter] = useState<'all' | '5' | '4'>('all')
  const [weaponFilter, setWeaponFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showUidModal, setShowUidModal] = useState(false)
  const [openConsPopover, setOpenConsPopover] = useState<string | null>(null)
  const consPopoverRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  useEffect(() => {
    api.listCharacters(lang, { limit: 200 }).then((r) => setChars(r.items))
  }, [lang])

  const filtered = useMemo(() => {
    return chars
      .filter((c) => {
        if (elemFilter !== 'all' && c.element !== elemFilter) return false
        if (rarityFilter !== 'all' && String(c.rarity) !== rarityFilter) return false
        if (weaponFilter !== 'all' && c.weapon_type !== weaponFilter) return false
        if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false
        if (statusFilter !== 'all') {
          const o = roster.get(c.slug)
          if (statusFilter === 'owned' && !o.owned) return false
          if (statusFilter === 'missing' && o.owned) return false
        }
        return true
      })
      .sort((a, b) => {
        // Ordena por raridade desc, depois nome
        if (a.rarity !== b.rarity) return b.rarity - a.rarity
        return a.name.localeCompare(b.name)
      })
  }, [chars, search, elemFilter, rarityFilter, weaponFilter, statusFilter, roster])

  const bulkMarkVisible = () => {
    roster.setMany(filtered.map((c) => c.slug), { owned: true, cons: 0 })
  }

  const bulkMark4Star = () => {
    const fourStarSlugs = chars.filter((c) => c.rarity === 4).map((c) => c.slug)
    roster.setMany(fourStarSlugs, { owned: true, cons: 0 })
  }

  const bulkMark5StarVisible = () => {
    const visible5 = filtered.filter((c) => c.rarity === 5).map((c) => c.slug)
    roster.setMany(visible5, { owned: true, cons: 0 })
  }

  const bulkClearVisible = () => {
    roster.setMany(filtered.map((c) => c.slug), { owned: false, cons: 0 })
  }

  const handleGoodUpload = async (file: File) => {
    setUploadError(null)
    setUploadSuccess(null)
    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      if (parsed?.format !== 'GOOD') {
        setUploadError('Arquivo não é um GOOD válido (falta "format": "GOOD").')
        return
      }
      if (!Array.isArray(parsed.characters)) {
        setUploadError('GOOD sem array "characters".')
        return
      }
      // Merge: preserva seelie existente, substitui good
      const current = JSON.parse(localStorage.getItem('gsb.planner.v5') || '{}')
      current.good = parsed
      localStorage.setItem('gsb.planner.v5', JSON.stringify(current))
      roster.refresh()
      setUploadSuccess(`GOOD importado: ${parsed.characters.length} personagens.`)
    } catch (e: any) {
      setUploadError(`Erro ao ler o arquivo: ${e?.message || String(e)}`)
    }
  }

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const f = e.dataTransfer.files?.[0]
    if (f) handleGoodUpload(f)
  }

  const onFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) handleGoodUpload(f)
    e.target.value = ''
  }

  // Atalhos globais: / foca search, ? abre painel
  useEffect(() => {
    const onGlobalKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
      if (isTyping) return
      if (e.key === '/') {
        e.preventDefault()
        searchInputRef.current?.focus()
      } else if (e.key === '?') {
        e.preventDefault()
        setShowShortcuts(v => !v)
      } else if (e.key === 'Escape') {
        setShowShortcuts(false)
      }
    }
    window.addEventListener('keydown', onGlobalKey)
    return () => window.removeEventListener('keydown', onGlobalKey)
  }, [])

  useEffect(() => {
    if (!openConsPopover) return
    const onClickOutside = (e: MouseEvent) => {
      if (consPopoverRef.current && !consPopoverRef.current.contains(e.target as Node)) {
        setOpenConsPopover(null)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [openConsPopover])

  const handleCardKeyDown = (
    e: React.KeyboardEvent<HTMLDivElement>,
    c: CharacterSummary,
    o: ReturnType<typeof roster.get>,
    idx: number,
  ) => {
    // 0-6 define constelação
    if (e.key >= '0' && e.key <= '6') {
      e.preventDefault()
      roster.set(c.slug, { owned: true, cons: parseInt(e.key, 10) })
      return
    }
    // Espaço / Enter toggla owned
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      roster.set(c.slug, { owned: !o.owned, cons: o.cons })
      return
    }
    // Backspace / Delete remove override
    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault()
      if (o.source === 'manual') roster.remove(c.slug)
      return
    }
    // Setas navegam
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault()
      const next = filtered[idx + 1]
      if (next) cardRefs.current.get(next.slug)?.focus()
      return
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault()
      const prev = filtered[idx - 1]
      if (prev) cardRefs.current.get(prev.slug)?.focus()
      return
    }
    if (e.key === 'Escape') {
      (e.currentTarget as HTMLDivElement).blur()
      return
    }
  }

  const activeFilters = (elemFilter !== 'all' ? 1 : 0) + (rarityFilter !== 'all' ? 1 : 0)
    + (weaponFilter !== 'all' ? 1 : 0) + (statusFilter !== 'all' ? 1 : 0)

  const clearFilters = () => {
    setElemFilter('all'); setRarityFilter('all'); setWeaponFilter('all'); setStatusFilter('all'); setSearch('')
  }

  return (
    <div className="roster-page">
      <div className="page-header">
        <h1>Meus personagens</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setShowUidModal(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <UserCheck size={15} /> Importar por UID
          </button>
          <Link to="/pull-advisor" className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Sparkles size={15} /> Quem vale pegar?
          </Link>
          <div className="roster-count">
            <strong>{roster.ownedCount}</strong>
            <span>/ {chars.length} marcados</span>
          </div>
        </div>
      </div>

      <p className="roster-hint">
        Marque quem você tem. Importou GOOD/Seelie no Planner? Já vêm marcados automaticamente.
        Manual sempre sobrescreve o importado.
      </p>

      {/* Zona de upload GOOD */}
      <div
        className="roster-upload"
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        <Upload size={16} />
        <span>Arraste um arquivo <code>.json</code> do GOOD aqui, ou</span>
        <button type="button" className="roster-upload-btn" onClick={() => fileInputRef.current?.click()}>
          Selecionar arquivo
        </button>
        <input ref={fileInputRef} type="file" accept=".json,application/json" hidden onChange={onFilePick} />
      </div>
      {uploadError && <div className="roster-upload-feedback error">{uploadError}</div>}
      {uploadSuccess && <div className="roster-upload-feedback success">{uploadSuccess}</div>}

      {/* Toolbar de busca + filtros */}
      <div className="premium-filters roster-filters">
        <div className="filter-group" style={{ flex: 1, minWidth: 220 }}>
          <span className="filter-label">Buscar</span>
          <div className="template-filter-search" style={{ width: '100%' }}>
            <Search size={16} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Nome do personagem... (tecla /)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="filter-group">
          <span className="filter-label">Elemento</span>
          <div className="filter-pills">
            {ELEMENT_ORDER.map((el) => (
              <button
                key={el}
                className={`filter-pill ${elemFilter === el ? 'active' : ''}`}
                style={{ '--pill-color': ELEMENT_COLORS[el] } as React.CSSProperties}
                onClick={() => setElemFilter(elemFilter === el ? 'all' : el)}
              >
                {el.charAt(0).toUpperCase() + el.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="filter-group">
          <span className="filter-label">Raridade</span>
          <div className="filter-pills">
            <button
              className={`filter-pill ${rarityFilter === '5' ? 'active' : ''}`}
              style={{ '--pill-color': '#e0a647' } as React.CSSProperties}
              onClick={() => setRarityFilter(rarityFilter === '5' ? 'all' : '5')}
            >
              <Star size={14} fill={rarityFilter === '5' ? 'currentColor' : 'none'} /> 5★
            </button>
            <button
              className={`filter-pill ${rarityFilter === '4' ? 'active' : ''}`}
              style={{ '--pill-color': '#a35bd8' } as React.CSSProperties}
              onClick={() => setRarityFilter(rarityFilter === '4' ? 'all' : '4')}
            >
              <Star size={14} fill={rarityFilter === '4' ? 'currentColor' : 'none'} /> 4★
            </button>
          </div>
        </div>

        <div className="filter-group">
          <span className="filter-label">Arma</span>
          <select
            className="template-filter-select"
            value={weaponFilter}
            onChange={(e) => setWeaponFilter(e.target.value)}
          >
            <option value="all">Todas</option>
            {WEAPON_ORDER.map((w) => (
              <option key={w} value={w}>{WEAPON_LABELS[w]}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <span className="filter-label">Status</span>
          <div className="filter-pills">
            <button
              className={`filter-pill ${statusFilter === 'owned' ? 'active' : ''}`}
              style={{ '--pill-color': '#4ade80' } as React.CSSProperties}
              onClick={() => setStatusFilter(statusFilter === 'owned' ? 'all' : 'owned')}
            >
              <CheckCircle2 size={14} /> Tenho
            </button>
            <button
              className={`filter-pill ${statusFilter === 'missing' ? 'active' : ''}`}
              style={{ '--pill-color': '#f87171' } as React.CSSProperties}
              onClick={() => setStatusFilter(statusFilter === 'missing' ? 'all' : 'missing')}
            >
              <UserX size={14} /> Faltam
            </button>
          </div>
        </div>

        {activeFilters > 0 && (
          <button className="clear-filters-btn" onClick={clearFilters}>
            <X size={14} /> Limpar filtros ({activeFilters})
          </button>
        )}
      </div>

      {/* Bulk actions */}
      <div className="roster-bulk-bar">
        <span className="roster-bulk-label">
          Mostrando <strong>{filtered.length}</strong> de {chars.length}
        </span>
        <div className="roster-bulk-actions">
          <button className="roster-bulk-btn" onClick={bulkMarkVisible}>
            <CheckCheck size={14} /> Marcar {filtered.length} visíveis
          </button>
          {rarityFilter === '5' && filtered.length > 0 && (
            <button className="roster-bulk-btn" onClick={bulkMark5StarVisible}>
              <Star size={14} /> Marcar 5★ visíveis
            </button>
          )}
          <button className="roster-bulk-btn" onClick={bulkMark4Star}>
            <Star size={14} /> Marcar todos os 4★
          </button>
          <button className="roster-bulk-btn roster-bulk-danger" onClick={bulkClearVisible}>
            <X size={14} /> Desmarcar visíveis
          </button>
          {roster.all.size > 0 && (
            <button
              className="roster-bulk-btn roster-bulk-danger"
              onClick={() => {
                if (confirm('Remover TODOS os overrides manuais? GOOD/Seelie voltam a valer.')) roster.clearAll()
              }}
            >
              <Trash2 size={14} /> Limpar overrides
            </button>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="roster-grid">
        {filtered.map((c) => {
          const o = roster.get(c.slug)
          const img = iconUrl(c.icon)
          const borderColor = ELEMENT_COLORS[c.element] || '#64748b'
          return (
            <div
              key={c.slug}
              ref={(el) => {
                if (el) cardRefs.current.set(c.slug, el)
                else cardRefs.current.delete(c.slug)
              }}
              tabIndex={0}
              onKeyDown={(e) => handleCardKeyDown(e, c, o, filtered.indexOf(c))}
              className={`roster-card ${o.owned ? 'is-owned' : ''} ${openConsPopover === c.slug ? 'has-cons-open' : ''}`}
              style={{ '--el-color': borderColor } as React.CSSProperties}
            >
              <div className="roster-card-avatar">
                {img ? <img src={img} alt={c.name} loading="lazy" /> : <span>?</span>}
                <span className="roster-card-rarity">{'★'.repeat(c.rarity)}</span>
              </div>
              <div className="roster-card-name">{c.name}</div>
              <div className="roster-card-actions">
                <button
                  type="button"
                  className={`roster-toggle ${o.owned ? 'is-owned' : 'is-not-owned'}`}
                  onClick={() => roster.set(c.slug, { owned: !o.owned, cons: o.cons })}
                  title={o.owned ? 'Marcar como não possuído' : 'Marcar como possuído'}
                >
                  {o.owned ? <><CheckCircle2 size={12} /> Tenho</> : <><UserX size={12} /> Não</>}
                </button>
                {o.owned && (
                  <div
                    className="roster-cons-wrapper"
                    ref={openConsPopover === c.slug ? consPopoverRef : undefined}
                  >
                    <button
                      type="button"
                      className={`roster-cons-trigger ${openConsPopover === c.slug ? 'is-open' : ''}`}
                      onClick={() => setOpenConsPopover(openConsPopover === c.slug ? null : c.slug)}
                      title={`Constelação C${o.cons} — clique para alterar`}
                      aria-haspopup="listbox"
                      aria-expanded={openConsPopover === c.slug}
                    >
                      C{o.cons}
                    </button>
                    {openConsPopover === c.slug && (
                      <div className="roster-cons-popover" role="listbox">
                        {[0, 1, 2, 3, 4, 5, 6].map((n) => (
                          <button
                            key={n}
                            type="button"
                            role="option"
                            aria-selected={o.cons === n}
                            className={`roster-cons-opt ${o.cons === n ? 'active' : ''}`}
                            onClick={() => {
                              roster.set(c.slug, { owned: true, cons: n })
                              setOpenConsPopover(null)
                            }}
                          >
                            C{n}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              {o.source !== 'manual' && o.source !== 'unknown' && (
                <span className={`roster-source-badge source-${o.source}`}>
                  {o.source === 'good' ? 'GOOD' : 'Seelie'}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <p className="status" style={{ padding: 40, textAlign: 'center' }}>Nenhum personagem encontrado com esses filtros.</p>
      )}

      {showShortcuts && (
        <div className="roster-shortcuts-overlay" onClick={() => setShowShortcuts(false)}>
          <div className="roster-shortcuts-panel" onClick={(e) => e.stopPropagation()}>
            <div className="roster-shortcuts-header">
              <h3>Atalhos de teclado</h3>
              <button className="roster-shortcuts-close" onClick={() => setShowShortcuts(false)} aria-label="Fechar">
                <X size={16} />
              </button>
            </div>
            <div className="roster-shortcuts-list">
              <div><kbd>/</kbd><span>Focar busca</span></div>
              <div><kbd>?</kbd><span>Mostrar atalhos</span></div>
              <div><kbd>Tab</kbd><span>Navegar entre cards</span></div>
              <div><kbd>→</kbd><kbd>↓</kbd><span>Próximo card</span></div>
              <div><kbd>←</kbd><kbd>↑</kbd><span>Card anterior</span></div>
              <div><kbd>Espaço</kbd><kbd>Enter</kbd><span>Marcar / desmarcar</span></div>
              <div><kbd>0</kbd>–<kbd>6</kbd><span>Definir constelação (marca como owned)</span></div>
              <div><kbd>Backspace</kbd><span>Remover override (volta ao GOOD/Seelie)</span></div>
              <div><kbd>Esc</kbd><span>Fechar painel / tirar foco</span></div>
            </div>
          </div>
        </div>
      )}

      {showUidModal && (
        <UidImportModal
          onClose={() => setShowUidModal(false)}
          onImported={({ nickname, rosterUpdated, plannerAdded, plannerUpdated }) => {
            roster.refresh()
            setUploadError(null)
            setUploadSuccess(
              `Vitrine de ${nickname} sincronizada! (${rosterUpdated} no Roster · ${plannerAdded} adicionado(s) e ${plannerUpdated} atualizado(s) no Planejador).`,
            )
          }}
        />
      )}
    </div>
  )
}
