import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Lightbulb, Search, Sparkles, SlidersHorizontal, Zap } from 'lucide-react'
import { api } from '../api/client'
import {
  ELEMENT_META,
  ElementPill,
  ElementSvgIcon,
  ReactionEmblem,
} from '../components/ReactionIcons'
import { REACTION_DETAILS } from '../data/reactionsInfo'
import type { ReactionListResponse } from '../types'

const REACTION_TYPES: Record<string, { label: string; color: string }> = {
  amplifying:     { label: 'Amplificadora',  color: '#fbbf24' },
  transformative: { label: 'Transformativa', color: '#f87171' },
  dendro:         { label: 'Dendro',         color: '#a5c83b' },
  lunar:          { label: 'Lunar',          color: '#818cf8' },
  stellar:        { label: 'Stellar',        color: '#f472b6' },
}

const FILTER_ELEMENTS = ['pyro', 'hydro', 'electro', 'cryo', 'anemo', 'geo', 'dendro'] as const

function getReactionType(slug: string): string {
  const detail = REACTION_DETAILS[slug]
  if (detail) return detail.category
  if (['vaporize', 'melt'].includes(slug)) return 'amplifying'
  if (['lunar_bloom', 'lunar_charged', 'lunar_crystallize'].includes(slug)) return 'lunar'
  if (['stellar_conduct', 'stellar_swirl'].includes(slug)) return 'stellar'
  if (['bloom', 'hyperbloom', 'burgeon', 'quicken', 'aggravate', 'spread'].includes(slug)) return 'dendro'
  return 'transformative'
}

export default function ReactionsPage() {
  const [data, setData] = useState<ReactionListResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterElement, setFilterElement] = useState('')

  useEffect(() => {
    api.listReactions().then(setData).catch((e) => setError(String(e)))
  }, [])

  const filtered = useMemo(() => {
    if (!data) return []
    const q = search.trim().toLowerCase()
    return data.items.filter((r) => {
      const type = getReactionType(r.slug)
      if (filterType && type !== filterType) return false

      const els = (r.elements as string[]).map((e) => e.toLowerCase())
      if (filterElement) {
        const matchesEl =
          els.includes(filterElement) ||
          (els.includes('qualquer') && ['pyro', 'hydro', 'electro', 'cryo'].includes(filterElement)) ||
          (els.includes('frozen') && (filterElement === 'cryo' || filterElement === 'hydro'))
        if (!matchesEl) return false
      }

      if (q) {
        const detail = REACTION_DETAILS[r.slug]
        const haystack = [
          r.name,
          r.slug,
          r.effect ?? '',
          detail?.ptName ?? '',
          detail?.summary ?? '',
          detail?.mechanics ?? '',
          detail?.tip ?? '',
          ...els,
        ]
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [data, search, filterType, filterElement])

  if (error) return <p className="status error">Erro: {error}</p>
  if (!data) return <p className="status">Carregando...</p>

  return (
    <div className="reactions-page">
      <div className="reactions-hero">
        <div>
          <h1>Reações Elementais</h1>
          <p className="reactions-hero-sub">
            Guia completo de mecânicas, multiplicadores, escalonamento de Proficiência Elemental (EM) e dicas práticas de combate.
          </p>
        </div>
      </div>

      <div className="premium-filters">
        <div className="filter-group" style={{ flex: '1 1 260px', maxWidth: 340 }}>
          <span className="filter-label">Buscar</span>
          <div className="premium-search">
            <Search size={16} />
            <input
              type="text"
              placeholder="Buscar reação, elemento ou mecânica..."
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
                  type="button"
                  className={`filter-pill ${isActive ? 'active' : ''}`}
                  style={{ '--pill-color': info.color } as CSSProperties}
                  onClick={() => setFilterType(isActive ? '' : key)}
                >
                  <Sparkles size={14} />
                  {info.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="filter-group">
          <span className="filter-label">Elemento</span>
          <div className="filter-pills">
            {FILTER_ELEMENTS.map((el) => {
              const meta = ELEMENT_META[el]
              const isActive = filterElement === el
              return (
                <button
                  key={el}
                  type="button"
                  className={`filter-pill ${isActive ? 'active' : ''}`}
                  style={{ '--pill-color': meta.color } as CSSProperties}
                  onClick={() => setFilterElement(isActive ? '' : el)}
                >
                  <ElementSvgIcon element={el} size={14} />
                  {meta.label}
                </button>
              )
            })}
          </div>
        </div>

        {(filterType || filterElement || search) && (
          <button
            type="button"
            className="clear-filters-btn"
            onClick={() => {
              setFilterType('')
              setFilterElement('')
              setSearch('')
            }}
          >
            Limpar Filtros
          </button>
        )}
      </div>

      <p className="status">{filtered.length} reação(ões) encontrada(s)</p>

      <div className="reactions-grid">
        {filtered.map((r, i) => {
          const type = getReactionType(r.slug)
          const typeInfo = REACTION_TYPES[type] ?? REACTION_TYPES.transformative
          const detail = REACTION_DETAILS[r.slug]
          const elements = (r.elements as string[]) || []
          const isThreeStep = elements.length === 3

          return (
            <article
              key={r.slug}
              className="reaction-card"
              style={{
                animationDelay: `${Math.min(i, 12) * 0.03}s`,
                '--reaction-color': typeInfo.color,
              } as CSSProperties}
            >
              <div className="reaction-card-glow" />

              <header className="reaction-card-header">
                <div className="reaction-icon-wrap">
                  <ReactionEmblem slug={r.slug} size={48} />
                </div>
                <div className="reaction-title-wrap">
                  <div className="reaction-title-top">
                    <h3>{r.name}</h3>
                    <span className="reaction-type-badge">{typeInfo.label}</span>
                  </div>
                  {detail?.ptName && (
                    <span className="reaction-pt-name">{detail.ptName}</span>
                  )}
                </div>
              </header>

              <div className="reaction-elements">
                {elements.map((el, j) => (
                  <span key={`${el}-${j}`} className="reaction-el-step">
                    {j > 0 && (
                      <span className="reaction-el-op">
                        {isThreeStep && j === 2 ? '→' : '+'}
                      </span>
                    )}
                    <ElementPill element={el} />
                  </span>
                ))}
              </div>

              <p className="reaction-summary">
                {detail?.summary ?? r.effect ?? '—'}
              </p>

              {detail?.mechanics && (
                <p className="reaction-mechanics">{detail.mechanics}</p>
              )}

              {detail && (
                <div className="reaction-specs">
                  <div className="reaction-spec">
                    <span className="reaction-spec-label">
                      <Zap size={12} /> Fórmula / Efeito
                    </span>
                    <strong className="reaction-spec-val">{detail.formula}</strong>
                  </div>
                  <div className="reaction-spec-row">
                    <div className="reaction-spec">
                      <span className="reaction-spec-label">
                        <SlidersHorizontal size={12} /> Escala com
                      </span>
                      <span className="reaction-spec-val">{detail.scaling}</span>
                    </div>
                    <div className="reaction-spec is-crit">
                      <span className="reaction-spec-label">Crítico?</span>
                      <span
                        className={`reaction-crit-pill ${
                          detail.canCrit.startsWith('Sim') ? 'can-crit' : 'no-crit'
                        }`}
                      >
                        {detail.canCrit}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {detail?.tip && (
                <div className="reaction-tip">
                  <div className="reaction-tip-head">
                    <Lightbulb size={13} />
                    <span>Dica de Time & Build</span>
                  </div>
                  <p>{detail.tip}</p>
                  {detail.notableSets && detail.notableSets.length > 0 && (
                    <div className="reaction-sets">
                      {detail.notableSets.map((s) => (
                        <span key={s} className="reaction-set-tag">{s}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </article>
          )
        })}
      </div>
    </div>
  )
}
