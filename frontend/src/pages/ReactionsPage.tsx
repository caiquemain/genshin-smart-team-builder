import { useEffect, useMemo, useState } from 'react'
import { Search, Sparkles } from 'lucide-react'
import { api } from '../api/client'
import { iconUrl } from '../config'
import type { ReactionListResponse } from '../types'

// Ícones oficiais dos elementos (CDN Hoyoverse)
const ELEMENT_ICON: Record<string, string> = {
  pyro: 'UI_Buff_Element_Fire',
  hydro: 'UI_Buff_Element_Water',
  electro: 'UI_Buff_Element_Electric',
  cryo: 'UI_Buff_Element_Ice',
  anemo: 'UI_Buff_Element_Wind',
  geo: 'UI_Buff_Element_Rock',
  dendro: 'UI_Buff_Element_Grass',
  qualquer: 'UI_Buff_Element_Fire',
  frozen: 'UI_Buff_Element_Ice',
  claymore: 'UI_WeaponIcon_Claymore',
}
const ELEMENT_COLORS: Record<string, string> = {
  pyro: '#ff9c46', hydro: '#4cc2f1', electro: '#b398ff', cryo: '#93e2ff',
  anemo: '#73ffd0', geo: '#f2c869', dendro: '#a5c83b',
  qualquer: '#94a3b8', frozen: '#93e2ff', claymore: '#94a3b8',
}

const REACTION_TYPES: Record<string, { label: string; color: string }> = {
  amplifying: { label: 'Amplificadora', color: '#fbbf24' },
  transformative: { label: 'Transformativa', color: '#f87171' },
  dendro: { label: 'Dendro', color: '#a5c83b' },
  lunar: { label: 'Lunar', color: '#818cf8' },
  stellar: { label: 'Stellar', color: '#f472b6' },
}

function getReactionType(slug: string): string {
  if (['vaporize', 'melt'].includes(slug)) return 'amplifying'
  if (['lunar_bloom', 'lunar_charged', 'lunar_crystallize'].includes(slug)) return 'lunar'
  if (['stellar_conduct', 'stellar_swirl'].includes(slug)) return 'stellar'
  if (['bloom', 'hyperbloom', 'burgeon', 'quicken', 'aggravate', 'spread'].includes(slug)) return 'dendro'
  return 'transformative'
}

function ElementIcon({ element }: { element: string }) {
  const iconName = ELEMENT_ICON[element]
  const color = ELEMENT_COLORS[element] || '#94a3b8'
  const img = iconName ? iconUrl(iconName) : null
  return (
    <span className="element-pill" style={{ '--el-color': color } as React.CSSProperties} title={element}>
      {img ? <img src={img} alt={element} loading="lazy" /> : <span style={{ fontSize: 10 }}>{element.slice(0, 3)}</span>}
      <span className="element-pill-label">{element}</span>
    </span>
  )
}

export default function ReactionsPage() {
  const [data, setData] = useState<ReactionListResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')

  useEffect(() => {
    api.listReactions().then(setData).catch((e) => setError(String(e)))
  }, [])

  const filtered = useMemo(() => {
    if (!data) return []
    let list = data.items
    if (filterType) list = list.filter((r) => getReactionType(r.slug) === filterType)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((r) => r.name.toLowerCase().includes(q))
    }
    return list
  }, [data, search, filterType])

  if (error) return <p className="status error">Erro: {error}</p>
  if (!data) return <p className="status">Carregando...</p>

  return (
    <div>
      <h1>Reações Elementais</h1>

      <div className="premium-filters">
        <div className="filter-group" style={{ flex: '1 1 280px', maxWidth: 360 }}>
          <span className="filter-label">Buscar</span>
          <div className="premium-search">
            <Search size={16} />
            <input
              type="text"
              placeholder="Buscar reação..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="filter-group">
          <span className="filter-label">Tipo</span>
          <div className="filter-pills">
            {Object.entries(REACTION_TYPES).map(([key, info]) => {
              const isActive = filterType === key
              return (
                <button
                  key={key}
                  className={`filter-pill ${isActive ? 'active' : ''}`}
                  style={{ '--pill-color': info.color } as React.CSSProperties}
                  onClick={() => setFilterType(isActive ? '' : key)}
                >
                  <Sparkles size={14} />
                  {info.label}
                </button>
              )
            })}
          </div>
        </div>

        {(filterType || search) && (
          <button className="clear-filters-btn" onClick={() => { setFilterType(''); setSearch('') }}>
            Limpar Filtros
          </button>
        )}
      </div>

      <p className="status">{filtered.length} reação(ões)</p>

      <div className="reactions-table-wrap">
        <table className="reactions-table">
          <thead>
            <tr>
              <th style={{ width: '26%' }}>Reação</th>
              <th style={{ width: '24%' }}>Elementos</th>
              <th style={{ width: '15%' }}>Tipo</th>
              <th>Efeito</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => {
              const type = getReactionType(r.slug)
              const typeInfo = REACTION_TYPES[type]
              return (
                <tr key={r.slug} style={{ animationDelay: `${i * 0.03}s`, '--row-color': typeInfo.color } as React.CSSProperties}>
                  <td>
                    <div className="row-title">{r.name}</div>
                  </td>
                  <td>
                    <div className="row-elements">
                      {(r.elements as string[]).map((el, j) => <ElementIcon key={j} element={el} />)}
                    </div>
                  </td>
                  <td>
                    <span className="row-type-badge">{typeInfo.label}</span>
                  </td>
                  <td className="row-effect">{r.effect ?? '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
