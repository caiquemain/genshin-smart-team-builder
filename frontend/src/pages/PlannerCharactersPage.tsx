import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft, Users, Flame, Droplets, Snowflake, Zap, Wind, Mountain, Leaf,
  Filter, ArrowUpDown,
} from 'lucide-react'
import PlannerCharacterCard from '../components/PlannerCharacterCard'
import type { Plan } from '../types/planner'

const ELEMENT_COLORS: Record<string, string> = {
  pyro: '#ff9c46', hydro: '#4cc2f1', electro: '#b398ff', cryo: '#93e2ff',
  anemo: '#73ffd0', geo: '#f2c869', dendro: '#a5c83b',
}
const ELEMENT_ICONS: Record<string, any> = {
  pyro: Flame, hydro: Droplets, electro: Zap, cryo: Snowflake,
  anemo: Wind, geo: Mountain, dendro: Leaf,
}

// Mapa de elementos (fallback quando o backend não tem)
const ELEMENT_MAP: Record<string, string> = {
  hutao: 'pyro', yoimiya: 'pyro', diluc: 'pyro', klee: 'pyro',
  amber: 'pyro', xiangling: 'pyro', bennett: 'pyro', xinyan: 'pyro', yanfei: 'pyro',
  tohma: 'pyro', thoma: 'pyro', dehya: 'pyro', lyney: 'pyro',
  gaming: 'pyro', arlecchino: 'pyro', mavuika: 'pyro', durin: 'pyro', nicole: 'pyro',
  barbara: 'hydro', xingqiu: 'hydro', mona: 'hydro', tartaglia: 'hydro',
  kokomi: 'hydro', ayato: 'hydro', yelan: 'hydro', nilou: 'hydro',
  candace: 'hydro', neuvillette: 'hydro', furina: 'hydro', sigewinne: 'hydro',
  mualani: 'hydro', columbina: 'hydro', vodyanitsa: 'hydro', aino: 'hydro', dahlia: 'hydro',
  razor: 'electro', beidou: 'electro', lisa: 'electro', keqing: 'electro',
  fischl: 'electro', shogun: 'electro', yae_miko: 'electro', kuki: 'electro',
  shinobu: 'electro', sara: 'electro', dori: 'electro', cyno: 'electro',
  clorinde: 'electro', ororon: 'electro', iansan: 'electro', varesa: 'electro',
  ineffa: 'electro', flins: 'electro', alyosha: 'electro',
  qiqi: 'cryo', kaeya: 'cryo', chongyun: 'cryo', ganyu: 'cryo', ayaka: 'cryo',
  diona: 'cryo', rosaria: 'cryo', eula: 'cryo', shenhe: 'cryo', layla: 'cryo',
  mika: 'cryo', wriothesley: 'cryo', charlotte: 'cryo', freminet: 'cryo',
  citlali: 'cryo', skirk: 'cryo', escoffier: 'cryo', odette: 'cryo', lohen: 'cryo', sandrone: 'cryo',
  chevreuse: 'pyro',
  jean: 'anemo', sucrose: 'anemo', venti: 'anemo', xiao: 'anemo', kazuha: 'anemo',
  sayu: 'anemo', heizou: 'anemo', wanderer: 'anemo', faruzan: 'anemo', lynette: 'anemo',
  xianyun: 'anemo', chasca: 'anemo', ifa: 'anemo', lanyan: 'anemo',
  mizuki: 'anemo', jahoda: 'anemo', varka: 'anemo', prune: 'anemo', vesna: 'anemo',
  ningguang: 'geo', noelle: 'geo', zhongli: 'geo', albedo: 'geo', gorou: 'geo',
  itto: 'geo', arataki_itto: 'geo', yunjin: 'geo', chiori: 'geo', navia: 'geo',
  kachina: 'geo', xilonen: 'geo', zibai: 'geo', illuga: 'geo', linnea: 'geo',
  traveler_anemo: 'anemo', traveler_geo: 'geo', traveler_electro: 'electro',
  traveler_dendro: 'dendro', traveler_hydro: 'hydro', traveler_pyro: 'pyro', traveler_cryo: 'cryo',
  collei: 'dendro', tighnari: 'dendro', nahida: 'dendro', baizhu: 'dendro',
  kaveh: 'dendro', yaoyao: 'dendro', kirara: 'dendro', alhaitham: 'dendro',
  kinich: 'dendro', emilie: 'dendro', nefer: 'dendro', lauma: 'dendro',
}

function elementOf(slug: string): string | undefined {
  const normalized = slug.toLowerCase().replace(/-/g, '_')
  return ELEMENT_MAP[normalized] ?? ELEMENT_MAP[slug]
}

type StatusFilter = 'all' | 'pending' | 'complete' | 'inactive'
type PendingFilter = 'all' | 'ascension' | 'talent' | 'weapon'
type SortBy = 'name' | 'days' | 'rarity' | 'status'

export default function PlannerCharactersPage() {
  const [plan, setPlan] = useState<Plan | null>(null)
  const [elementFilter, setElementFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [pendingFilter, setPendingFilter] = useState<PendingFilter>('all')
  const [sortBy, setSortBy] = useState<SortBy>('name')

  useEffect(() => {
    try {
      const raw = localStorage.getItem('gsb.planner.plan')
      if (raw) setPlan(JSON.parse(raw))
    } catch {}
  }, [])

  const filtered = useMemo(() => {
    if (!plan) return []
    let list = plan.chars.filter((c) => {
      // Elemento
      if (elementFilter && elementOf(c.slug) !== elementFilter) return false

      // Status
      if (statusFilter === 'pending' && c.is_complete) return false
      if (statusFilter === 'complete' && !c.is_complete) return false
      if (statusFilter === 'inactive' && !c.is_inactive) return false

      // Tipo de pendência
      if (pendingFilter === 'ascension' && !c.has_ascension_pending) return false
      if (pendingFilter === 'talent' && !c.has_talent_pending) return false
      if (pendingFilter === 'weapon' && !c.has_weapon_pending) return false

      return true
    })

    // Ordenação
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
          {filtered.length} de {total} personagens · {pendingCount} pendentes · {completeCount} completos · {inactiveCount} inativos
        </p>
      </div>

      {/* Filtros em linha */}
      <div className="planner-filters-row">
        {/* Elementos */}
        <div className="plan-element-filter">
          <button
            className={`plan-element-pill ${elementFilter === '' ? 'active' : ''}`}
            onClick={() => setElementFilter('')}
          >
            Todos
          </button>
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
                <Icon size={14} />
                {el.charAt(0).toUpperCase() + el.slice(1)}
              </button>
            )
          })}
        </div>

        {/* Status */}
        <div className="planner-filter-group">
          <span className="planner-filter-label"><Filter size={14} /> Status</span>
          <select
            className="planner-filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          >
            <option value="all">Todos</option>
            <option value="pending">Pendentes</option>
            <option value="complete">Completos</option>
            <option value="inactive">Inativos</option>
          </select>
        </div>

        {/* Tipo de pendência */}
        <div className="planner-filter-group">
          <span className="planner-filter-label"><Filter size={14} /> Pendência</span>
          <select
            className="planner-filter-select"
            value={pendingFilter}
            onChange={(e) => setPendingFilter(e.target.value as PendingFilter)}
          >
            <option value="all">Todos</option>
            <option value="ascension">Falta nível</option>
            <option value="talent">Falta talento</option>
            <option value="weapon">Falta arma</option>
          </select>
        </div>

        {/* Ordenação */}
        <div className="planner-filter-group">
          <span className="planner-filter-label"><ArrowUpDown size={14} /> Ordem</span>
          <select
            className="planner-filter-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
          >
            <option value="name">Nome</option>
            <option value="status">Status</option>
            <option value="days">Dias de farm</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="planner-empty-filter">Nenhum personagem bate os filtros.</p>
      ) : (
        <div className="plan-chars-grid">
          {filtered.map((c) => (
            <PlannerCharacterCard
              key={c.slug}
              char={c}
              element={elementOf(c.slug)}
              inventory={plan.inventory_resolved}
            />
          ))}
        </div>
      )}
    </div>
  )
}
