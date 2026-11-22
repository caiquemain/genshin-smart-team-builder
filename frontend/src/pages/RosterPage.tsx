import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Search, CheckCircle2, UserX, Upload, Trash2, CheckCheck, X, Star, Sparkles,
  UserCheck, BarChart3, Users, Swords, Gem, Lock, Repeat,
} from 'lucide-react'
import { api } from '../api/client'
import { useLanguage } from '../context/LanguageContext'
import { artifactIconUrl, iconUrl } from '../config'
import { useRoster } from '../utils/roster'
import type { GoodCharState } from '../utils/good-parser'
import {
  buildArtifactSetLookup,
  buildWeaponLookup,
  computeCharacterBuildStats,
  loadCharacterStatsDataset,
  STAT_SHORT_LABEL_PT,
  type CharacterStatsDataset,
  type ComputedCharStats,
} from '../utils/char-stats-calc'
import {
  auditArtifactBag,
  loadAllGoodArtifactsFromStorage,
} from '../utils/artifact-bag-auditor'
import UidImportModal from '../components/UidImportModal'
import CharacterArtifactsModal from '../components/CharacterArtifactsModal'
import type { ArtifactSetSummary, CharacterSummary, WeaponSummary } from '../types'

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
type RosterViewMode = 'manage' | 'builds' | 'bag'
type BuildSortKey = 'cv' | 'level' | 'atk' | 'hp' | 'crit_rate' | 'crit_dmg' | 'er' | 'em' | 'name'

function cvClass(cv: number): string {
  if (cv >= 210) return 'cv-insane'
  if (cv >= 180) return 'cv-great'
  if (cv >= 140) return 'cv-good'
  return 'cv-mid'
}

export default function RosterPage() {
  const { lang } = useLanguage()
  const roster = useRoster()
  const [viewMode, setViewMode] = useState<RosterViewMode>('manage')
  const [buildSort, setBuildSort] = useState<BuildSortKey>('cv')
  const [bagTab, setBagTab] = useState<'gems' | 'recycle'>('gems')
  const [bagIncludeLocked, setBagIncludeLocked] = useState(false)
  const [bagSetFilter, setBagSetFilter] = useState('all')
  const [bagSlotFilter, setBagSlotFilter] = useState('all')
  const [chars, setChars] = useState<CharacterSummary[]>([])
  const [weaponsCatalog, setWeaponsCatalog] = useState<WeaponSummary[]>([])
  const [artifactsCatalog, setArtifactsCatalog] = useState<ArtifactSetSummary[]>([])
  const [statsDataset, setStatsDataset] = useState<CharacterStatsDataset>({})
  const [search, setSearch] = useState('')
  const [elemFilter, setElemFilter] = useState('all')
  const [rarityFilter, setRarityFilter] = useState<'all' | '5' | '4'>('all')
  const [weaponFilter, setWeaponFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showUidModal, setShowUidModal] = useState(false)
  const [selectedBuildChar, setSelectedBuildChar] = useState<{
    char: CharacterSummary
    goodState: GoodCharState
  } | null>(null)
  const [openConsPopover, setOpenConsPopover] = useState<string | null>(null)
  const consPopoverRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  useEffect(() => {
    api.listCharacters(lang, { limit: 200 }).then((r) => setChars(r.items))
  }, [lang])

  useEffect(() => {
    if (viewMode !== 'builds' && viewMode !== 'bag') return
    let active = true
    if (viewMode === 'builds') {
      loadCharacterStatsDataset().then((d) => {
        if (active) setStatsDataset(d)
      })
      api
        .listWeapons(lang, { limit: 500 })
        .then((r) => {
          if (active) setWeaponsCatalog(r.items)
        })
        .catch(() => {})
    }
    api
      .listArtifacts(lang, { limit: 200 })
      .then((r) => {
        if (active) setArtifactsCatalog(r.items)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [viewMode, lang])

  const bagAudit = useMemo(() => {
    if (viewMode !== 'bag') return null
    const allArts = loadAllGoodArtifactsFromStorage()
    return auditArtifactBag(allArts, artifactsCatalog)
  }, [viewMode, artifactsCatalog, roster])

  const bagDisplayedItems = useMemo(() => {
    if (!bagAudit) return []
    const base = bagTab === 'gems' ? bagAudit.gems : bagAudit.recycle
    return base.filter((item) => {
      if (bagTab === 'recycle' && !bagIncludeLocked && item.locked) return false
      if (bagSetFilter !== 'all' && item.setSlug !== bagSetFilter) return false
      if (bagSlotFilter !== 'all' && item.slotKey !== bagSlotFilter) return false
      return true
    })
  }, [bagAudit, bagTab, bagIncludeLocked, bagSetFilter, bagSlotFilter])

  const bagAvailableSets = useMemo(() => {
    if (!bagAudit) return [] as { slug: string; name: string }[]
    const map = new Map<string, string>()
    for (const item of [...bagAudit.gems, ...bagAudit.recycle]) {
      map.set(item.setSlug, item.setName)
    }
    return [...map.entries()]
      .map(([slug, name]) => ({ slug, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [bagAudit])

  const weaponLookup = useMemo(() => buildWeaponLookup(weaponsCatalog), [weaponsCatalog])
  const artifactSetLookup = useMemo(() => buildArtifactSetLookup(artifactsCatalog), [artifactsCatalog])

  const computedBuilds = useMemo(() => {
    if (viewMode !== 'builds') return [] as { char: CharacterSummary; goodState: GoodCharState; stats: ComputedCharStats }[]
    const rows: { char: CharacterSummary; goodState: GoodCharState; stats: ComputedCharStats }[] = []
    for (const c of chars) {
      const o = roster.get(c.slug)
      if (!o.owned) continue
      if (elemFilter !== 'all' && c.element !== elemFilter) continue
      if (rarityFilter !== 'all' && String(c.rarity) !== rarityFilter) continue
      if (weaponFilter !== 'all' && c.weapon_type !== weaponFilter) continue
      if (search && !c.name.toLowerCase().includes(search.toLowerCase())) continue

      const g = roster.getGoodState(c.slug) ?? {
        level: 1,
        ascension: 0,
        cons: o.cons,
        talents: { na: 1, es: 1, eb: 1 },
        weaponSlug: null,
        weaponLevel: 0,
        weaponRefinement: 1,
        artifacts: [],
      }
      const stats = computeCharacterBuildStats({
        slug: c.slug,
        element: String(c.element),
        goodState: g,
        statsDataset,
        weaponLookup,
        artifactSetLookup,
      })
      rows.push({ char: c, goodState: g, stats })
    }

    rows.sort((a, b) => {
      switch (buildSort) {
        case 'cv':
          if (b.stats.totalCritValue !== a.stats.totalCritValue)
            return b.stats.totalCritValue - a.stats.totalCritValue
          return b.stats.level - a.stats.level
        case 'level':
          if (b.stats.level !== a.stats.level) return b.stats.level - a.stats.level
          return b.stats.totalCritValue - a.stats.totalCritValue
        case 'atk':
          return b.stats.totalAtk - a.stats.totalAtk
        case 'hp':
          return b.stats.totalHp - a.stats.totalHp
        case 'crit_rate':
          return b.stats.critRate - a.stats.critRate
        case 'crit_dmg':
          return b.stats.critDmg - a.stats.critDmg
        case 'er':
          return b.stats.er - a.stats.er
        case 'em':
          return b.stats.em - a.stats.em
        case 'name':
          return a.char.name.localeCompare(b.char.name)
      }
    })
    return rows
  }, [viewMode, chars, roster, elemFilter, rarityFilter, weaponFilter, search, statsDataset, weaponLookup, artifactSetLookup, buildSort])

  const buildsSummary = useMemo(() => {
    const withArts = computedBuilds.filter((r) => r.stats.hasArtifacts)
    const avgCv =
      withArts.length > 0
        ? withArts.reduce((acc, r) => acc + r.stats.totalCritValue, 0) / withArts.length
        : 0
    const topCv = withArts.reduce<{ name: string; cv: number } | null>((best, r) => {
      if (!best || r.stats.totalCritValue > best.cv) {
        return { name: r.char.name, cv: r.stats.totalCritValue }
      }
      return best
    }, null)
    return { total: computedBuilds.length, withArts: withArts.length, avgCv, topCv }
  }, [computedBuilds])

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
      const artCount = Array.isArray(parsed.artifacts) ? parsed.artifacts.length : 0
      setUploadSuccess(
        `GOOD importado: ${parsed.characters.length} personagens${artCount > 0 ? ` e ${artCount} artefatos` : ''}.`,
      )
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
            <Sparkles size={15} /> Consultor da Conta
          </Link>
          <div className="roster-count">
            <strong>{roster.ownedCount}</strong>
            <span>/ {chars.length} marcados</span>
          </div>
        </div>
      </div>

      <div className="roster-view-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={viewMode === 'manage'}
          className={`roster-view-tab ${viewMode === 'manage' ? 'active' : ''}`}
          onClick={() => setViewMode('manage')}
        >
          <Users size={15} /> Gerenciar Roster
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={viewMode === 'builds'}
          className={`roster-view-tab ${viewMode === 'builds' ? 'active' : ''}`}
          onClick={() => setViewMode('builds')}
        >
          <BarChart3 size={15} /> Minhas Builds & Stats ({roster.ownedCount})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={viewMode === 'bag'}
          className={`roster-view-tab ${viewMode === 'bag' ? 'active' : ''}`}
          onClick={() => setViewMode('bag')}
        >
          <Gem size={15} /> Mochila de Artefatos
        </button>
      </div>

      <p className="roster-hint">
        {viewMode === 'manage'
          ? 'Marque quem você tem. Importou GOOD/Seelie no Planner? Já vêm marcados automaticamente. Manual sempre sobrescreve o importado.'
          : viewMode === 'builds'
            ? 'Stats calculados (Base do nível + Ascensão + Arma + 5 Artefatos + Bônus de 2pc) para todos os personagens da sua conta.'
            : 'Auditoria dos artefatos 5★ não equipados do seu GOOD JSON: descubra joias paradas em +0 e peças seguras para reciclar no Strongbox.'}
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

      {/* Toolbar de busca + filtros (Roster e Builds) */}
      {viewMode !== 'bag' && (
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

        {viewMode === 'manage' ? (
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
        ) : (
          <div className="filter-group">
            <span className="filter-label">Ordenar por</span>
            <select
              className="rb-sort-select"
              value={buildSort}
              onChange={(e) => setBuildSort(e.target.value as BuildSortKey)}
            >
              <option value="cv">Crit Value (CV)</option>
              <option value="level">Nível</option>
              <option value="atk">ATQ Total</option>
              <option value="hp">Vida Total</option>
              <option value="crit_rate">Taxa Crítica</option>
              <option value="crit_dmg">Dano Crítico</option>
              <option value="er">Recarga (ER)</option>
              <option value="em">Proficiência (EM)</option>
              <option value="name">Nome (A-Z)</option>
            </select>
          </div>
        )}

        {activeFilters > 0 && (
          <button className="clear-filters-btn" onClick={clearFilters}>
            <X size={14} /> Limpar filtros ({activeFilters})
          </button>
        )}
      </div>
      )}

      {viewMode === 'manage' && (
        <>
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
        </>
      )}

      {viewMode === 'builds' && (
        <>
          <div className="rb-summary-strip">
            <div className="rb-summary-card">
              <div className="rb-summary-label">Personagens na Conta</div>
              <div className="rb-summary-val">{buildsSummary.total}</div>
              <div className="rb-summary-sub">
                {buildsSummary.withArts} com artefatos lidos do GOOD
              </div>
            </div>
            <div className="rb-summary-card">
              <div className="rb-summary-label">Média de Crit Value</div>
              <div className="rb-summary-val">
                {buildsSummary.withArts > 0 ? `${buildsSummary.avgCv.toFixed(1)} CV` : '—'}
              </div>
              <div className="rb-summary-sub">Substats de Taxa/Dano Crít. nas 5 peças</div>
            </div>
            <div className="rb-summary-card">
              <div className="rb-summary-label">Maior CV da Conta</div>
              <div className="rb-summary-val" style={{ color: '#fde68a' }}>
                {buildsSummary.topCv ? `${buildsSummary.topCv.cv.toFixed(1)} CV` : '—'}
              </div>
              <div className="rb-summary-sub">
                {buildsSummary.topCv ? buildsSummary.topCv.name : 'Importe GOOD JSON acima para calcular'}
              </div>
            </div>
          </div>

          {computedBuilds.length === 0 ? (
            <p className="status" style={{ padding: 40, textAlign: 'center' }}>
              Nenhum personagem possuído encontrado com esses filtros.
            </p>
          ) : (
            <div className="rb-grid">
              {computedBuilds.map(({ char: c, goodState, stats }) => {
                const img = iconUrl(c.icon)
                const elColor = ELEMENT_COLORS[c.element] || '#38bdf8'
                const primaryBonus =
                  stats.physicalDmgBonus > stats.elemDmgBonus && stats.physicalDmgBonus >= 20
                    ? { label: 'Dano Fís.', value: `${stats.physicalDmgBonus.toFixed(1)}%` }
                    : stats.healingBonus > stats.elemDmgBonus && stats.healingBonus >= 15
                      ? { label: 'Cura', value: `${stats.healingBonus.toFixed(1)}%` }
                      : {
                          label: (STAT_SHORT_LABEL_PT[stats.elemDmgKey] ?? 'Elem.').replace('Dano ', ''),
                          value: `${stats.elemDmgBonus.toFixed(1)}%`,
                        }

                return (
                  <div key={c.slug} className="rb-card" style={{ borderLeftColor: elColor }}>
                    <div className="rb-card-head">
                      <div className="rb-avatar" style={{ borderColor: elColor }}>
                        {img ? <img src={img} alt={c.name} loading="lazy" /> : null}
                      </div>
                      <div className="rb-head-info">
                        <div className="rb-name-row">
                          <Link to={`/characters/${c.slug}#minha-build`} className="rb-name">
                            {c.name}
                          </Link>
                        </div>
                        <div className="rb-meta-line">
                          Lv. {stats.level} · C{stats.cons} · Talentos {stats.talents.na}/{stats.talents.es}/{stats.talents.eb}
                        </div>
                      </div>
                      {stats.hasArtifacts && (
                        <span className={`eb-cv-badge ${cvClass(stats.totalCritValue)}`}>
                          {stats.totalCritValue.toFixed(1)} CV
                        </span>
                      )}
                    </div>

                    <div className="rb-gear-row">
                      <div className="rb-gear-weapon" title={stats.weapon ? `${stats.weapon.name} Lv.${stats.weapon.level} R${stats.weapon.refinement}` : 'Sem arma no GOOD'}>
                        {stats.weapon && iconUrl(stats.weapon.icon) ? (
                          <img src={iconUrl(stats.weapon.icon)!} alt={stats.weapon.name} loading="lazy" />
                        ) : (
                          <Swords size={15} color="#64748b" />
                        )}
                        <span>
                          {stats.weapon
                            ? `${stats.weapon.name} (Lv.${stats.weapon.level} R${stats.weapon.refinement})`
                            : 'Sem arma no GOOD'}
                        </span>
                      </div>

                      <div className="rb-gear-sets">
                        {stats.activeSets.length > 0 ? (
                          stats.activeSets.map((s) => (
                            <span key={s.slug} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }} title={`${s.pieces}pc ${s.name}`}>
                              {artifactIconUrl(s.icon) && (
                                <img
                                  src={artifactIconUrl(s.icon)!}
                                  alt={s.name}
                                  className="rb-gear-set-icon"
                                  loading="lazy"
                                />
                              )}
                              <span>{s.pieces}pc</span>
                            </span>
                          ))
                        ) : (
                          <span style={{ color: '#64748b' }}>
                            {stats.hasArtifacts ? 'Sem set' : 'Sem artefatos'}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="rb-stats-mini">
                      <div className="rb-stat-cell">
                        <span>Vida</span>
                        <strong>{stats.hasBaseData ? stats.totalHp.toLocaleString('pt-BR') : '—'}</strong>
                      </div>
                      <div className="rb-stat-cell">
                        <span>ATQ</span>
                        <strong>{stats.hasBaseData ? stats.totalAtk.toLocaleString('pt-BR') : '—'}</strong>
                      </div>
                      <div className="rb-stat-cell">
                        <span>DEF</span>
                        <strong>{stats.hasBaseData ? stats.totalDef.toLocaleString('pt-BR') : '—'}</strong>
                      </div>
                      <div className="rb-stat-cell">
                        <span>EM</span>
                        <strong>{stats.em}</strong>
                      </div>
                      <div className="rb-stat-cell">
                        <span>Taxa Crít.</span>
                        <strong className="is-crit">{stats.critRate.toFixed(1)}%</strong>
                      </div>
                      <div className="rb-stat-cell">
                        <span>Dano Crít.</span>
                        <strong className="is-crit">{stats.critDmg.toFixed(1)}%</strong>
                      </div>
                      <div className="rb-stat-cell">
                        <span>Recarga</span>
                        <strong>{stats.er.toFixed(1)}%</strong>
                      </div>
                      <div className="rb-stat-cell">
                        <span>{primaryBonus.label}</span>
                        <strong>{primaryBonus.value}</strong>
                      </div>
                    </div>

                    <div className="rb-card-foot">
                      <span>
                        {stats.pieces.length > 0
                          ? `${stats.pieces.length}/5 peças · média +${Math.round(stats.avgArtifactLevel)}`
                          : 'Sem artefatos cadastrados'}
                      </span>
                      <button
                        type="button"
                        className="rb-detail-btn"
                        onClick={() => setSelectedBuildChar({ char: c, goodState })}
                      >
                        <Gem size={12} />
                        {stats.pieces.length > 0 ? 'Ver / Editar Artefatos' : '+ Adicionar Artefatos'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {viewMode === 'bag' && bagAudit && (
        <>
          <div className="rb-summary-strip">
            <div className="rb-summary-card">
              <div className="rb-summary-label">5★ na Mochila (Livres)</div>
              <div className="rb-summary-val">{bagAudit.bagFiveStarCount}</div>
              <div className="rb-summary-sub">
                {bagAudit.totalInGood} no GOOD ({bagAudit.equippedCount} equipados)
              </div>
            </div>
            <div className="rb-summary-card">
              <div className="rb-summary-label">Joias Escondidas (Upar!)</div>
              <div className="rb-summary-val" style={{ color: '#86efac' }}>
                {bagAudit.gems.length}
              </div>
              <div className="rb-summary-sub">Duplo Crítico / Cálices & Tiaras fortes em +0..+12</div>
            </div>
            <div className="rb-summary-card">
              <div className="rb-summary-label">Seguras p/ Strongbox</div>
              <div className="rb-summary-val" style={{ color: '#fde68a' }}>
                {bagAudit.recycle.length}
              </div>
              <div className="rb-summary-sub">
                ≈ <strong>{bagAudit.strongboxBoxes}</strong> caixas (3→1) só com peças destrancadas
              </div>
            </div>
          </div>

          {bagAudit.bagFiveStarCount === 0 ? (
            <div className="rb-summary-card" style={{ textAlign: 'center', padding: 32 }}>
              <p style={{ margin: 0, color: '#cbd5e1' }}>
                Nenhum artefato 5★ não equipado foi encontrado no seu GOOD JSON.
              </p>
              <p style={{ margin: '8px 0 0', fontSize: 12.5, color: '#94a3b8' }}>
                Arraste um arquivo <code>.json</code> completo do GOOD (ex.: Inventory Kamera / Artiscan) na caixa acima para auditar toda a sua mochila.
              </p>
            </div>
          ) : (
            <>
              <div className="bag-controls">
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className={`filter-pill ${bagTab === 'gems' ? 'active' : ''}`}
                    style={{ '--pill-color': '#4ade80' } as React.CSSProperties}
                    onClick={() => setBagTab('gems')}
                  >
                    <Sparkles size={13} /> Joias Escondidas ({bagAudit.gems.length})
                  </button>
                  <button
                    type="button"
                    className={`filter-pill ${bagTab === 'recycle' ? 'active' : ''}`}
                    style={{ '--pill-color': '#fbbf24' } as React.CSSProperties}
                    onClick={() => setBagTab('recycle')}
                  >
                    <Repeat size={13} /> Reciclar no Strongbox ({bagAudit.recycle.length})
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <select
                    className="rb-sort-select"
                    value={bagSetFilter}
                    onChange={(e) => setBagSetFilter(e.target.value)}
                  >
                    <option value="all">Todos os Sets</option>
                    {bagAvailableSets.map((s) => (
                      <option key={s.slug} value={s.slug}>{s.name}</option>
                    ))}
                  </select>

                  <select
                    className="rb-sort-select"
                    value={bagSlotFilter}
                    onChange={(e) => setBagSlotFilter(e.target.value)}
                  >
                    <option value="all">Todos os Slots</option>
                    <option value="flower">Flor</option>
                    <option value="plume">Pena</option>
                    <option value="sands">Ampulheta</option>
                    <option value="goblet">Cálice</option>
                    <option value="circlet">Tiara</option>
                  </select>

                  {bagTab === 'recycle' && (
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#cbd5e1', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={bagIncludeLocked}
                        onChange={(e) => setBagIncludeLocked(e.target.checked)}
                      />
                      Incluir trancadas
                    </label>
                  )}
                </div>
              </div>

              {bagDisplayedItems.length === 0 ? (
                <p className="status" style={{ padding: 36, textAlign: 'center' }}>
                  Nenhuma peça nesta categoria com os filtros selecionados.
                </p>
              ) : (
                <>
                  <div className="bag-grid">
                    {bagDisplayedItems.slice(0, 80).map((item) => {
                      const artImg = artifactIconUrl(item.setIcon)
                      return (
                        <div
                          key={item.index}
                          className={`bag-art-card ${item.verdict === 'gem' ? 'is-gem' : 'is-recycle'}`}
                        >
                          <div className="eb-art-head">
                            <div className="eb-art-icon">
                              {artImg ? <img src={artImg} alt={item.setName} loading="lazy" /> : <Gem size={15} />}
                            </div>
                            <div className="eb-art-head-info">
                              <div className="eb-art-slot-row">
                                <span className="eb-art-slot">{item.slotLabel}</span>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                  {item.locked && <Lock size={11} color="#fbbf24" />}
                                  <span className="eb-art-lv">+{item.level}</span>
                                </span>
                              </div>
                              <Link to={`/artifacts/${item.setSlug}`} className="eb-art-set-name" title={item.setName}>
                                {item.setName}
                              </Link>
                            </div>
                          </div>

                          <div className="eb-art-main">
                            <span className="eb-art-main-label">{item.mainStatLabel}</span>
                            <strong className="eb-art-main-val">{item.mainStatFormatted}</strong>
                          </div>

                          <ul className="eb-art-subs">
                            {item.substats.map((sub, si) => {
                              const isCrit = sub.key === 'crit_rate' || sub.key === 'crit_dmg'
                              return (
                                <li key={si} className={isCrit ? 'is-crit-sub' : ''}>
                                  <span>{sub.label}</span>
                                  <strong>+{sub.formatted}</strong>
                                </li>
                              )
                            })}
                          </ul>

                          <p className="bag-art-reason">{item.reason}</p>
                        </div>
                      )
                    })}
                  </div>
                  {bagDisplayedItems.length > 80 && (
                    <p className="status" style={{ textAlign: 'center', marginTop: 14 }}>
                      Mostrando as 80 peças mais prioritárias de {bagDisplayedItems.length}. Use os filtros de Set ou Slot acima para refinar.
                    </p>
                  )}
                </>
              )}
            </>
          )}
        </>
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

      {selectedBuildChar && (
        <CharacterArtifactsModal
          character={selectedBuildChar.char}
          initialState={selectedBuildChar.goodState}
          statsDataset={statsDataset}
          weaponsCatalog={weaponsCatalog}
          artifactsCatalog={artifactsCatalog}
          onClose={() => setSelectedBuildChar(null)}
          onSaved={() => roster.refresh()}
        />
      )}
    </div>
  )
}
