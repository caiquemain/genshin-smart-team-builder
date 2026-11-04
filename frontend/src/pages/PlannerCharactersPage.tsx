import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft, Users, Flame, Droplets, Snowflake, Zap, Wind, Mountain, Leaf,
  Filter, ArrowUpDown,
} from 'lucide-react'
import PlannerCharacterCard from '../components/PlannerCharacterCard'
import PlannerCharacterModal from '../components/PlannerCharacterModal'
import { useLanguage } from '../context/LanguageContext'
import { recomputeAggregates } from '../utils/planner-recompute'
import type { Plan } from '../types/planner'
import type { WeaponSummary } from '../types'

import { loadPlannerData, elementOf, pickLang } from '../utils/planner-data'

const ELEMENT_COLORS: Record<string, string> = {
  pyro: '#ff9c46', hydro: '#4cc2f1', electro: '#b398ff', cryo: '#93e2ff',
  anemo: '#73ffd0', geo: '#f2c869', dendro: '#a5c83b',
}
const ELEMENT_ICONS: Record<string, any> = {
  pyro: Flame, hydro: Droplets, electro: Zap, cryo: Snowflake,
  anemo: Wind, geo: Mountain, dendro: Leaf,
}

type StatusFilter = 'all' | 'pending' | 'complete' | 'inactive'
type PendingFilter = 'all' | 'ascension' | 'talent' | 'weapon'
type SortBy = 'name' | 'days' | 'status'

function readWL(): number {
  try {
    const raw = localStorage.getItem('gsb.planner.v5')
    if (!raw) return 9
    const parsed = JSON.parse(raw)
    return parsed?.seelie?.wl ?? 9
  } catch { return 9 }
}

export default function PlannerCharactersPage() {
  const { lang } = useLanguage()
  const [plan, setPlan] = useState<Plan | null>(null)
  const [elementFilter, setElementFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [pendingFilter, setPendingFilter] = useState<PendingFilter>('all')
  const [sortBy, setSortBy] = useState<SortBy>('status')
  const [selectedChar, setSelectedChar] = useState<any | null>(null)
  const [weaponsMap, setWeaponsMap] = useState<Map<string, WeaponSummary>>(new Map())
  const [wl] = useState<number>(() => readWL())

  useEffect(() => {
    try {
      const raw = localStorage.getItem('gsb.planner.plan')
      if (raw) setPlan(JSON.parse(raw))
    } catch {}
    
    loadPlannerData().then((data) => {
      const m = new Map<string, WeaponSummary>()
      for (const [slug, w] of Object.entries(data.weapons)) {
        m.set(slug, { slug, name: pickLang(w.name, lang), icon: w.icon, rarity: w.rarity, weapon_type: w.weapon_type as any } as any)
      }
      setWeaponsMap(m)
    }).catch(() => {})
  }, [lang])

  const handleUpdate = (newChar: any) => {
    if (!plan) return
    const newChars = plan.chars.map((c) => c.slug === newChar.slug ? newChar : c)
    const updated = recomputeAggregates({ ...plan, chars: newChars }, plan.inventory_resolved, wl)
    setPlan(updated)
    setSelectedChar(newChar)
    try { localStorage.setItem('gsb.planner.plan', JSON.stringify(updated)) } catch {}
  }

  const filtered = useMemo(() => {
    if (!plan) return []
    let list = plan.chars.filter((c) => {
      const el = elementOf(c.slug)
      if (elementFilter && el !== elementFilter) return false
      if (statusFilter === 'pending' && c.is_complete) return false
      if (statusFilter === 'complete' && !c.is_complete) return false
      if (statusFilter === 'inactive' && !c.is_inactive) return false
      if (pendingFilter === 'ascension' && !c.has_ascension_pending) return false
      if (pendingFilter === 'talent' && !c.has_talent_pending) return false
      if (pendingFilter === 'weapon' && !c.has_weapon_pending) return false
      return true
    })

    list = [...list].sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name)

      if (sortBy === 'status') {
        const scoreA = a.is_inactive ? 2 : (a.is_complete ? 1 : 0)
        const scoreB = b.is_inactive ? 2 : (b.is_complete ? 1 : 0)
        if (scoreA !== scoreB) return scoreA - scoreB
        return a.name.localeCompare(b.name)
      }

      if (sortBy === 'days') {
        const daysA = a.is_inactive ? 0 : Math.ceil((a.ascension?.total_mora ?? 0) / 50_000)
        const daysB = b.is_inactive ? 0 : Math.ceil((b.ascension?.total_mora ?? 0) / 50_000)
        return daysB - daysA
      }
      return a.name.localeCompare(b.name)
    })

    return list
  }, [plan, elementFilter, statusFilter, pendingFilter, sortBy])

  if (!plan) {
    return (
      <div className="planner-empty-state">
        <h1>Personagens do Planner</h1>
        <p>Nenhum plano carregado. Importe o JSON e clique em <strong>Calcular custo total</strong>.</p>
        <Link to="/planner" className="btn-primary">← Voltar ao Planner</Link>
      </div>
    )
  }

  const total = plan.chars.length
  const completeCount = plan.chars.filter((c) => c.is_complete).length
  const pendingCount = plan.chars.filter((c) => !c.is_complete).length
  const inactiveCount = plan.chars.filter((c) => c.is_inactive).length

  return (
    <div>
      <div className="planner-chars-header">
        <Link to="/planner" className="planner-back-link"><ArrowLeft size={16} /> Voltar ao Planner</Link>
        <h1><Users size={32} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 8 }} /> Personagens do Planner</h1>
        <p className="planner-chars-subtitle">
          {filtered.length} de {total} personagens · {pendingCount} pendentes · {completeCount} completos · {inactiveCount} inativos · WL {wl}
        </p>
      </div>

      <div className="planner-filters-row">
        <div className="plan-element-filter">
          <button className={`plan-element-pill ${elementFilter === '' ? 'active' : ''}`} onClick={() => setElementFilter('')}>Todos</button>
          {Object.entries(ELEMENT_COLORS).map(([el, color]) => {
            const Icon = ELEMENT_ICONS[el]
            if (!Icon) return null
            return (
              <button
                key={el}
                className={`plan-element-pill ${elementFilter === el ? 'active' : ''}`}
                style={{ '--pill-color': color } as React.CSSProperties}
                onClick={() => setElementFilter(elementFilter === el ? '' : el)}
              >
                <Icon size={14} />{el.charAt(0).toUpperCase() + el.slice(1)}
              </button>
            )
          })}
        </div>

        <div className="planner-filter-group">
          <span className="planner-filter-label"><Filter size={14} /> Status</span>
          <select className="planner-filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
            <option value="all">Todos</option>
            <option value="pending">Pendentes</option>
            <option value="complete">Completos</option>
            <option value="inactive">Inativos</option>
          </select>
        </div>

        <div className="planner-filter-group">
          <span className="planner-filter-label"><Filter size={14} /> Pendência</span>
          <select className="planner-filter-select" value={pendingFilter} onChange={(e) => setPendingFilter(e.target.value as PendingFilter)}>
            <option value="all">Todos</option>
            <option value="ascension">Falta nível</option>
            <option value="talent">Falta talento</option>
            <option value="weapon">Falta arma</option>
          </select>
        </div>

        <div className="planner-filter-group">
          <span className="planner-filter-label"><ArrowUpDown size={14} /> Ordem</span>
          <select className="planner-filter-select" value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)}>
            <option value="status">Prioridade</option>
            <option value="name">Nome</option>
            <option value="days">Dias de farm</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="planner-empty-filter">Nenhum personagem bate os filtros.</p>
      ) : (
        <div className="plan-chars-grid">
          {filtered.map((c) => (
            <div key={c.slug} onClick={() => setSelectedChar(c)} style={{ cursor: 'pointer' }}>
              <PlannerCharacterCard char={c} element={elementOf(c.slug)} inventory={plan.inventory_resolved} />
            </div>
          ))}
        </div>
      )}

      {selectedChar && (
        <PlannerCharacterModal
          char={selectedChar}
          element={elementOf(selectedChar.slug)}
          inventory={plan.inventory_resolved}
          onClose={() => setSelectedChar(null)}
          onUpdate={handleUpdate}
          weaponsMap={weaponsMap}
          wl={wl}
        />
      )}
    </div>
  )
}
