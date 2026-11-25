import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft, Users, Flame, Droplets, Snowflake, Zap, Wind, Mountain, Leaf,
  Filter, ArrowUpDown, Plus, Download,
} from 'lucide-react'
import PlannerCharacterCard from '../components/PlannerCharacterCard'
import PlannerCharacterModal from '../components/PlannerCharacterModal'
import CharacterPickerModal from '../components/CharacterPickerModal'
import { useLanguage } from '../context/LanguageContext'
import { recomputeAggregates } from '../utils/planner-recompute'
import type { CharBreakdown, Plan } from '../types/planner'
import type { CharacterSummary, WeaponSummary } from '../types'

import { loadPlannerData, elementOf, pickLang, type PlannerData } from '../utils/planner-data'
import { buildIndexes } from '../utils/slug-resolver'
import { useRoster } from '../utils/roster'
import {
  addCharToPlan,
  hydratePlanFromData,
  loadPlanFromStorage,
  loadPlannerSettings,
  removeCharFromPlan,
  savePlanToStorage,
  syncCharEditToPlannerStorage,
  syncInventoryItemToPlannerStorage,
} from '../utils/planner-storage'

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

export default function PlannerCharactersPage() {
  const { lang } = useLanguage()
  const roster = useRoster()
  const [searchParams, setSearchParams] = useSearchParams()
  const [plan, setPlan] = useState<Plan | null>(null)
  const [plannerData, setPlannerData] = useState<PlannerData | null>(null)
  const [elementFilter, setElementFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [pendingFilter, setPendingFilter] = useState<PendingFilter>('all')
  const [sortBy, setSortBy] = useState<SortBy>('status')
  const [selectedChar, setSelectedChar] = useState<CharBreakdown | null>(null)
  const [modalInitialEdit, setModalInitialEdit] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [weaponsMap, setWeaponsMap] = useState<Map<string, WeaponSummary>>(new Map())
  const [wl] = useState<number>(() => loadPlannerSettings().wl)
  const handledAddParamRef = useRef<string | null>(null)

  useEffect(() => {
    const initial = loadPlanFromStorage()
    if (initial) setPlan(initial)

    loadPlannerData().then((data) => {
      buildIndexes(data)
      setPlannerData(data)
      const m = new Map<string, WeaponSummary>()
      for (const [slug, w] of Object.entries(data.weapons)) {
        m.set(slug, { slug, name: pickLang(w.name, lang), icon: w.icon, rarity: w.rarity, weapon_type: w.weapon_type as any } as any)
      }
      setWeaponsMap(m)
      setPlan((prev) => (prev ? hydratePlanFromData(prev, data, lang) : loadPlanFromStorage(data, lang)))
    }).catch(() => {})
  }, [lang])

  // Suporta deep-link `/planner/characters?add=<slug>&goal=<80|90>` (ex.: botão "Planejar Farm" no Pull Advisor)
  useEffect(() => {
    const addSlug = searchParams.get('add')
    if (!addSlug || !plannerData || handledAddParamRef.current === addSlug) return
    handledAddParamRef.current = addSlug

    const goalParam = Number(searchParams.get('goal'))
    const goalLevel = goalParam === 80 || goalParam === 90 ? goalParam : 90
    const r = roster.get(addSlug)
    const g = roster.getGoodState(addSlug)

    const currentPlan = loadPlanFromStorage(plannerData, lang) ?? plan
    const res = addCharToPlan(currentPlan, addSlug, plannerData, lang, wl, {
      currentLevel: g?.level ?? 1,
      goalLevel: Math.max(g?.level ?? 1, goalLevel),
      cons: g?.cons ?? r.cons ?? 0,
      na: g ? { current: g.talents.na, goal: Math.max(g.talents.na, 1) } : undefined,
      es: g ? { current: g.talents.es, goal: Math.max(g.talents.es, 9) } : undefined,
      eb: g ? { current: g.talents.eb, goal: Math.max(g.talents.eb, 9) } : undefined,
    })

    if (res) {
      setPlan(res.plan)
      setSelectedChar(res.char)
      setModalInitialEdit(res.added)
    }
    setSearchParams({}, { replace: true })
  }, [searchParams, plannerData, lang, wl, plan, roster, setSearchParams])

  const handleUpdate = (newChar: CharBreakdown): boolean => {
    if (!plan) return false
    const newChars = plan.chars.map((c) => c.slug === newChar.slug ? newChar : c)
    const updated = recomputeAggregates({ ...plan, chars: newChars }, plan.inventory_resolved, wl)
    const v5Saved = syncCharEditToPlannerStorage(newChar)
    const planSaved = savePlanToStorage(updated)
    setPlan(updated)
    setSelectedChar(newChar)
    return v5Saved || planSaved
  }

  const handleSaveInventory = (slug: string, newQty: number) => {
    if (!plan) return
    const nextInv = { ...plan.inventory_resolved, [slug]: newQty }
    const updated = recomputeAggregates(plan, nextInv, wl)
    setPlan(updated)
    savePlanToStorage(updated)
    syncInventoryItemToPlannerStorage(slug, newQty, plannerData)
  }

  const handleAddChar = (chosen: CharacterSummary) => {
    setShowPicker(false)
    if (!plannerData) return
    const r = roster.get(chosen.slug)
    const g = roster.getGoodState(chosen.slug)
    const res = addCharToPlan(plan, chosen.slug, plannerData, lang, wl, {
      currentLevel: g?.level ?? 1,
      goalLevel: Math.max(g?.level ?? 1, 90),
      cons: g?.cons ?? r.cons ?? 0,
      na: g ? { current: g.talents.na, goal: Math.max(g.talents.na, 1) } : undefined,
      es: g ? { current: g.talents.es, goal: Math.max(g.talents.es, 9) } : undefined,
      eb: g ? { current: g.talents.eb, goal: Math.max(g.talents.eb, 9) } : undefined,
    })
    if (res) {
      setPlan(res.plan)
      setSelectedChar(res.char)
      setModalInitialEdit(res.added)
    }
  }

  const handleRemoveChar = (slug: string) => {
    if (!plan) return
    const updated = removeCharFromPlan(plan, slug, wl)
    setPlan(updated)
    setSelectedChar(null)
    setModalInitialEdit(false)
  }

  const unaddedRosterSlugs = useMemo(() => {
    if (!plannerData) return []
    const existing = new Set((plan?.chars ?? []).map((c) => c.slug))
    return Object.keys(plannerData.characters).filter(
      (slug) => !existing.has(slug) && roster.get(slug).owned,
    )
  }, [plannerData, plan, roster])

  const handleImportFromRoster = () => {
    if (!plannerData || unaddedRosterSlugs.length === 0) return
    let current = plan
    for (const slug of unaddedRosterSlugs) {
      const r = roster.get(slug)
      const g = roster.getGoodState(slug)
      const res = addCharToPlan(current, slug, plannerData, lang, wl, {
        currentLevel: g?.level ?? 1,
        goalLevel: Math.max(g?.level ?? 1, 90),
        cons: g?.cons ?? r.cons ?? 0,
        na: g ? { current: g.talents.na, goal: Math.max(g.talents.na, 1) } : undefined,
        es: g ? { current: g.talents.es, goal: Math.max(g.talents.es, 9) } : undefined,
        eb: g ? { current: g.talents.eb, goal: Math.max(g.talents.eb, 9) } : undefined,
      })
      if (res) current = res.plan
    }
    if (current) setPlan(current)
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

  const existingSlugs = useMemo(() => (plan?.chars ?? []).map((c) => c.slug), [plan])

  if (!plan || plan.chars.length === 0) {
    return (
      <div className="planner-empty-state">
        <h1>Personagens do Planner</h1>
        <p>
          Seu planejador ainda está vazio. Adicione personagens manualmente para começar do zero — não precisa importar nenhum JSON!
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 16 }}>
          <button
            className="btn-primary"
            onClick={() => setShowPicker(true)}
            disabled={!plannerData}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Plus size={16} /> Adicionar personagem
          </button>
          {unaddedRosterSlugs.length > 0 && (
            <button
              className="btn-secondary"
              onClick={handleImportFromRoster}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Download size={16} /> Importar do Meu Roster ({unaddedRosterSlugs.length})
            </button>
          )}
          <Link to="/planner" className="btn-secondary">← Voltar ao Planejador</Link>
        </div>

        {showPicker && (
          <CharacterPickerModal
            title="Adicionar personagem ao planejador"
            excludeSlugs={existingSlugs}
            onSelect={handleAddChar}
            onClose={() => setShowPicker(false)}
          />
        )}
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <h1><Users size={32} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 8 }} /> Personagens do Planner</h1>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              className="btn-primary"
              onClick={() => setShowPicker(true)}
              disabled={!plannerData}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Plus size={16} /> Adicionar personagem
            </button>
            {unaddedRosterSlugs.length > 0 && (
              <button
                className="btn-secondary"
                onClick={handleImportFromRoster}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <Download size={15} /> Trazer do Roster (+{unaddedRosterSlugs.length})
              </button>
            )}
          </div>
        </div>
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
            <div
              key={c.slug}
              onClick={() => { setModalInitialEdit(false); setSelectedChar(c) }}
              style={{ cursor: 'pointer' }}
            >
              <PlannerCharacterCard char={c} element={elementOf(c.slug)} inventory={plan.inventory_resolved} />
            </div>
          ))}
        </div>
      )}

      {selectedChar && (
        <PlannerCharacterModal
          key={`${selectedChar.slug}-${modalInitialEdit ? 'edit' : 'view'}`}
          char={selectedChar}
          element={elementOf(selectedChar.slug)}
          inventory={plan.inventory_resolved}
          onClose={() => { setSelectedChar(null); setModalInitialEdit(false) }}
          onUpdate={handleUpdate}
          onRemove={handleRemoveChar}
          onSaveInventory={handleSaveInventory}
          weaponsMap={weaponsMap}
          wl={wl}
          initialEditing={modalInitialEdit}
        />
      )}

      {showPicker && (
        <CharacterPickerModal
          title="Adicionar personagem ao planejador"
          excludeSlugs={existingSlugs}
          onSelect={handleAddChar}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  )
}
