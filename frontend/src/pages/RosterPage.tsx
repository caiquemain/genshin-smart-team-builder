import { useEffect, useMemo, useState } from 'react'
import { Search, CheckCircle2, UserX } from 'lucide-react'
import { api } from '../api/client'
import { useLanguage } from '../context/LanguageContext'
import { iconUrl } from '../config'
import { useRoster } from '../utils/roster'
import type { CharacterSummary } from '../types'

const ELEMENT_ORDER = ['pyro', 'hydro', 'electro', 'cryo', 'anemo', 'geo', 'dendro']

export default function RosterPage() {
  const { lang } = useLanguage()
  const roster = useRoster()
  const [chars, setChars] = useState<CharacterSummary[]>([])
  const [search, setSearch] = useState('')
  const [elemFilter, setElemFilter] = useState('all')

  useEffect(() => {
    api.listCharacters(lang, { limit: 200 }).then((r) => setChars(r.items))
  }, [lang])

  const filtered = useMemo(() => {
    return chars
      .filter((c) => {
        if (elemFilter !== 'all' && c.element !== elemFilter) return false
        if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false
        return true
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [chars, search, elemFilter])

  return (
    <div>
      <div className="page-header">
        <h1>Meus personagens</h1>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 14, color: '#94a3b8' }}>
          <span><strong style={{ color: '#4ade80', fontSize: 18 }}>{roster.ownedCount}</strong> / {chars.length} marcados</span>
        </div>
      </div>

      <p className="status" style={{ marginBottom: 16 }}>
        Marque os personagens que você tem. Se importou GOOD/Seelie no Planner, eles já vêm marcados automaticamente.
        Você pode ajustar manualmente — o manual sempre sobrescreve o importado.
      </p>

      <div className="roster-toolbar">
        <div className="template-filter-search" style={{ flex: 1, maxWidth: 320 }}>
          <Search size={16} />
          <input
            type="text"
            placeholder="Buscar personagem..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="template-filter-select"
          value={elemFilter}
          onChange={(e) => setElemFilter(e.target.value)}
        >
          <option value="all">Todos os elementos</option>
          {ELEMENT_ORDER.map((el) => (
            <option key={el} value={el}>{el.charAt(0).toUpperCase() + el.slice(1)}</option>
          ))}
        </select>
      </div>

      <div className="roster-grid">
        {filtered.map((c) => {
          const o = roster.get(c.slug)
          const img = iconUrl(c.icon)
          return (
            <div key={c.slug} className={`roster-card ${o.owned ? 'is-owned' : ''}`}>
              <div className="roster-card-avatar">
                {img ? <img src={img} alt={c.name} /> : <span>?</span>}
              </div>
              <div className="roster-card-name">{c.name}</div>
              <div className="roster-card-actions">
                <button
                  type="button"
                  className={`roster-toggle ${o.owned ? 'is-owned' : 'is-not-owned'}`}
                  onClick={() => roster.set(c.slug, { owned: !o.owned, cons: o.cons })}
                >
                  {o.owned ? <><CheckCircle2 size={10} /> Tenho</> : <><UserX size={10} /> Não</>}
                </button>
                {o.owned && (
                  <input
                    type="number"
                    min={0}
                    max={6}
                    className="roster-cons-input"
                    value={o.cons}
                    onChange={(e) => roster.set(c.slug, { owned: true, cons: Math.max(0, Math.min(6, +e.target.value || 0)) })}
                    title="Constelação"
                  />
                )}
              </div>
              {o.source !== 'manual' && o.source !== 'unknown' && (
                <span style={{ fontSize: 9, color: '#64748b', marginTop: 2 }}>
                  {o.source === 'good' ? 'GOOD' : 'Seelie'}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <p className="status" style={{ padding: 40, textAlign: 'center' }}>Nenhum personagem encontrado.</p>
      )}
    </div>
  )
}
