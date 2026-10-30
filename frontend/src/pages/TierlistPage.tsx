import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Trophy, Filter, ExternalLink, RefreshCw, LayoutGrid, List } from 'lucide-react'
import { api } from '../api/client'
import { useLanguage } from '../context/LanguageContext'
import { iconUrl } from '../config'
import type { CharacterSummary } from '../types'
import type { TierlistSite, TierlistResponse, AggregatedTier } from '../types/tierlist'

const SLUG_ALIASES: Record<string, string> = {
  kazuha: 'kaedehara-kazuha', hutao: 'hu-tao', shogun: 'raiden-shogun',
  ayaka: 'kamisato-ayaka', kokomi: 'sangonomiya-kokomi', heizou: 'shikanoin-heizou',
  shinobu: 'kuki-shinobu', mizuki: 'yumemizuki-mizuki', yunjin: 'yun-jin',
  sara: 'kujou-sara', lanyan: 'lan-yan',
}
const resolveSlug = (slug: string): string => SLUG_ALIASES[slug] ?? slug

const ROLES = [
  { key: 'all', label: 'Todos', labelEn: 'All' },
  { key: 'general', label: 'Geral', labelEn: 'General' },
  { key: 'main-dps', label: 'Main DPS', labelEn: 'Main DPS' },
  { key: 'sub-dps', label: 'Sub-DPS', labelEn: 'Sub-DPS' },
  { key: 'support', label: 'Suporte', labelEn: 'Support' },
  { key: 'healer', label: 'Healer', labelEn: 'Healer' },
]

const TIER_ORDER = ['S+', 'S', 'A', 'B', 'C', 'D', 'E', 'F']

const TIER_COLORS: Record<string, { bg: string; text: string }> = {
  'S+': { bg: 'rgba(239, 68, 68, 0.15)', text: '#f87171' },
  'S':  { bg: 'rgba(251, 146, 60, 0.15)', text: '#fb923c' },
  'A':  { bg: 'rgba(251, 191, 36, 0.15)', text: '#fbbf24' },
  'B':  { bg: 'rgba(74, 222, 128, 0.15)', text: '#4ade80' },
  'C':  { bg: 'rgba(96, 165, 250, 0.15)', text: '#60a5fa' },
  'D':  { bg: 'rgba(148, 163, 184, 0.15)', text: '#94a3b8' },
  'E':  { bg: 'rgba(120, 113, 108, 0.15)', text: '#a8a29e' },
  'F':  { bg: 'rgba(87, 83, 78, 0.15)', text: '#78716c' },
}

function tierStyle(tier: string) {
  return TIER_COLORS[tier] ?? { bg: 'rgba(148, 163, 184, 0.15)', text: '#cbd5e1' }
}

function CharacterTile({
  item, char, lang,
}: {
  item: AggregatedTier
  char: CharacterSummary | undefined
  lang: string
}) {
  const img = char ? iconUrl(char.icon) : null
  const name = char?.name ?? item.character_slug
  const siteDetails = item.entries.map((e) => `${e.site_slug}: ${e.tier_label}`).join(' · ')
  return (
    <Link
      to={`/characters/${resolveSlug(item.character_slug)}`}
      className="tierlist-tile"
      title={`${name}\n${item.tier_consolidated} (${item.avg_score.toFixed(2)})\n${siteDetails}`}
    >
      <div className="tierlist-tile-avatar">
        {img ? <img src={img} alt={name} loading="lazy" /> : <span>?</span>}
      </div>
      <div className="tierlist-tile-name">{name}</div>
      <div className="tierlist-tile-score">{item.avg_score.toFixed(2)}</div>
    </Link>
  )
}

function TierlistGrid({
  items, chars, lang,
}: {
  items: AggregatedTier[]
  chars: Map<string, CharacterSummary>
  lang: string
}) {
  const grouped = useMemo(() => {
    const g: Record<string, AggregatedTier[]> = {}
    for (const item of items) {
      const t = item.tier_consolidated
      if (!g[t]) g[t] = []
      g[t].push(item)
    }
    for (const t of Object.keys(g)) g[t].sort((a, b) => b.avg_score - a.avg_score)
    return g
  }, [items])

  const visibleTiers = TIER_ORDER.filter((t) => grouped[t] && grouped[t].length > 0)

  return (
    <div className="tierlist-grid">
      {visibleTiers.map((tier) => {
        const style = tierStyle(tier)
        return (
          <div key={tier} className="tierlist-col">
            <div
              className="tierlist-col-header"
              style={{ background: style.bg, color: style.text, borderBottomColor: style.text }}
            >
              <span className="tierlist-col-label">{tier}</span>
              <span className="tierlist-col-count">{grouped[tier].length}</span>
            </div>
            <div className="tierlist-col-body">
              {grouped[tier].map((item) => (
                <CharacterTile
                  key={`${item.character_slug}-${item.role}`}
                  item={item}
                  char={chars.get(resolveSlug(item.character_slug))}
                  lang={lang}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function TierlistList({
  items, chars, lang,
}: {
  items: AggregatedTier[]
  chars: Map<string, CharacterSummary>
  lang: string
}) {
  return (
    <div className="tierlist-list">
      {items.map((item) => {
        const char = chars.get(resolveSlug(item.character_slug))
        const img = char ? iconUrl(char.icon) : null
        const style = tierStyle(item.tier_consolidated)
        return (
          <Link
            key={`${item.character_slug}-${item.role}`}
            to={`/characters/${resolveSlug(item.character_slug)}`}
            className="tierlist-list-row"
          >
            <span className="tierlist-list-tier" style={{ background: style.bg, color: style.text }}>
              {item.tier_consolidated}
            </span>
            <div className="tierlist-list-avatar">
              {img ? <img src={img} alt={char?.name} loading="lazy" /> : <span>?</span>}
            </div>
            <div className="tierlist-list-info">
              <span className="tierlist-list-name">{char?.name ?? item.character_slug}</span>
              <span className="tierlist-list-meta">{item.num_sites} sites</span>
            </div>
            <div className="tierlist-list-sites">
              {item.entries.map((e) => (
                <span key={e.site_slug} className="tierlist-list-site">
                  {e.site_slug}: <strong>{e.tier_label}</strong>
                </span>
              ))}
            </div>
            <span className="tierlist-list-score">{item.avg_score.toFixed(2)}</span>
          </Link>
        )
      })}
    </div>
  )
}

export default function TierlistPage() {
  const { lang } = useLanguage()
  const [data, setData] = useState<TierlistResponse | null>(null)
  const [sites, setSites] = useState<TierlistSite[]>([])
  const [chars, setChars] = useState<Map<string, CharacterSummary>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [roleFilter, setRoleFilter] = useState('all')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  const load = async () => {
    setLoading(true)
    try {
      const [tierlist, sitesData, charsData] = await Promise.all([
        api.getTierlist(),
        api.getTierlistSites(),
        api.listCharacters(lang, { limit: 200 }),
      ])
      setData(tierlist)
      setSites(sitesData)
      setChars(new Map(charsData.items.map((c) => [c.slug, c])))
      setError(null)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [lang])

  const filtered = useMemo(() => {
    if (!data) return []
    let list = data.items
    if (roleFilter !== 'all') {
      list = list.filter((i) => i.role === roleFilter)
    }
    // Se roleFilter='all', dedupe por char (pega maior score)
    if (roleFilter === 'all') {
      const byChar = new Map<string, AggregatedTier>()
      for (const item of list) {
        const existing = byChar.get(item.character_slug)
        if (!existing || item.avg_score > existing.avg_score) {
          byChar.set(item.character_slug, item)
        }
      }
      list = Array.from(byChar.values())
    }
    return [...list].sort((a, b) => b.avg_score - a.avg_score)
  }, [data, roleFilter])

  if (loading) return <p className="status">Carregando tierlist...</p>
  if (error) return <p className="status error">Erro: {error}</p>

  const byRoleCount = (data?.items ?? []).reduce<Record<string, number>>((acc, i) => {
    acc[i.role] = (acc[i.role] || 0) + 1
    return acc
  }, {})
  const allUnique = new Set((data?.items ?? []).map((i) => i.character_slug)).size

  return (
    <div className="tierlist-page">
      <div className="tierlist-header">
        <div>
          <h1><Trophy size={32} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 8 }} /> Tierlist Agregada</h1>
          <p className="tierlist-subtitle">
            {sites.length} {lang === 'en' ? 'sources' : 'fontes'} · {allUnique} {lang === 'en' ? 'characters' : 'personagens'} · {data?.items.length ?? 0} {lang === 'en' ? 'entries' : 'entradas'}
          </p>
        </div>
        <div className="tierlist-header-actions">
          <div className="tierlist-view-toggle">
            <button
              className={`tierlist-view-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
              title={lang === 'en' ? 'Grid view' : 'Modo grade'}
            >
              <LayoutGrid size={14} />
            </button>
            <button
              className={`tierlist-view-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
              title={lang === 'en' ? 'List view' : 'Modo lista'}
            >
              <List size={14} />
            </button>
          </div>
          <button className="btn-secondary" onClick={load} disabled={loading}>
            <RefreshCw size={14} /> {lang === 'en' ? 'Refresh' : 'Atualizar'}
          </button>
        </div>
      </div>

      <div className="tierlist-sources">
        <span className="tierlist-sources-label">
          <Filter size={14} /> {lang === 'en' ? 'Sources' : 'Fontes'}:
        </span>
        {sites.map((s) => (
          <a key={s.slug} href={s.url} target="_blank" rel="noopener noreferrer" className="tierlist-source-chip">
            {s.name} <ExternalLink size={10} />
          </a>
        ))}
      </div>

      <div className="premium-filters">
        <div className="filter-group">
          <span className="filter-label">{lang === 'en' ? 'Role' : 'Função'}</span>
          <div className="filter-pills">
            {ROLES.map((r) => {
              const isActive = roleFilter === r.key
              const count = r.key === 'all' ? allUnique : (byRoleCount[r.key] ?? 0)
              return (
                <button
                  key={r.key}
                  className={`filter-pill ${isActive ? 'active' : ''}`}
                  style={{ '--pill-color': '#7dd3fc' } as React.CSSProperties}
                  onClick={() => setRoleFilter(r.key)}
                >
                  {lang === 'en' ? r.labelEn : r.label} <span className="filter-pill-count">{count}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="tierlist-empty">
          <Trophy size={48} opacity={0.2} />
          <p>
            {lang === 'en' ? 'No tierlist data yet.' : 'Sem dados de tierlist ainda.'}
          </p>
          <code>POST /tierlist/import</code>
        </div>
      ) : viewMode === 'grid' ? (
        <TierlistGrid items={filtered} chars={chars} lang={lang} />
      ) : (
        <TierlistList items={filtered} chars={chars} lang={lang} />
      )}
    </div>
  )
}
