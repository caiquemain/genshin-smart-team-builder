import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Trophy, Filter, ExternalLink, RefreshCw, LayoutGrid, List } from 'lucide-react'
import { api } from '../api/client'
import { useLanguage } from '../context/LanguageContext'
import { iconUrl } from '../config'
import type { CharacterSummary } from '../types'
import type { TierlistSite, TierlistResponse, AggregatedTier } from '../types/tierlist'
import TierlistTooltip from '../components/TierlistTooltip'

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
  { key: 'main_dps', label: 'Main DPS', labelEn: 'Main DPS' },
  { key: 'sub_dps', label: 'Sub-DPS', labelEn: 'Sub-DPS' },
  { key: 'support', label: 'Suporte', labelEn: 'Support' },
]

const TIERS = [
  { key: 'all', label: 'Todos', labelEn: 'All' },
  { key: 'S+', label: 'S+', labelEn: 'S+' },
  { key: 'S',  label: 'S',  labelEn: 'S' },
  { key: 'A',  label: 'A',  labelEn: 'A' },
  { key: 'B',  label: 'B',  labelEn: 'B' },
  { key: 'C',  label: 'C',  labelEn: 'C' },
  { key: 'D',  label: 'D',  labelEn: 'D' },
]

const ELEMENTS = [
  { key: 'all', label: 'Todos', labelEn: 'All' },
  { key: 'pyro', label: 'Pyro', labelEn: 'Pyro' },
  { key: 'hydro', label: 'Hydro', labelEn: 'Hydro' },
  { key: 'electro', label: 'Electro', labelEn: 'Electro' },
  { key: 'cryo', label: 'Cryo', labelEn: 'Cryo' },
  { key: 'anemo', label: 'Anemo', labelEn: 'Anemo' },
  { key: 'geo', label: 'Geo', labelEn: 'Geo' },
  { key: 'dendro', label: 'Dendro', labelEn: 'Dendro' },
]

const ROLE_LABELS: Record<string, string> = {
  main_dps: 'Main DPS',
  sub_dps: 'Sub-DPS',
  support: 'Support',
  general: 'General',
}

const TIER_ORDER = ['S+', 'S', 'A', 'B', 'C', 'D']

const TIER_COLORS: Record<string, { bg: string; text: string }> = {
  'S+': { bg: 'rgba(239, 68, 68, 0.15)', text: '#f87171' },
  'S':  { bg: 'rgba(251, 146, 60, 0.15)', text: '#fb923c' },
  'A':  { bg: 'rgba(251, 191, 36, 0.15)', text: '#fbbf24' },
  'B':  { bg: 'rgba(74, 222, 128, 0.15)', text: '#4ade80' },
  'C':  { bg: 'rgba(96, 165, 250, 0.15)', text: '#60a5fa' },
  'D':  { bg: 'rgba(148, 163, 184, 0.15)', text: '#94a3b8' },
}

function tierStyle(tier: string) {
  return TIER_COLORS[tier] ?? { bg: 'rgba(148, 163, 184, 0.15)', text: '#cbd5e1' }
}

function CharacterTile({
  item, char, lang, sites,
}: {
  item: AggregatedTier
  char: CharacterSummary | undefined
  lang: string
  sites: TierlistSite[]
}) {
  const img = char ? iconUrl(char.icon) : null
  const name = char?.name ?? item.character_slug
  return (
    <TierlistTooltip item={item} char={char} sites={sites}>
      <Link
        to={`/characters/${resolveSlug(item.character_slug)}`}
        className="tierlist-tile"
      >
        <div className="tierlist-tile-avatar">
          {img ? <img src={img} alt={name} loading="lazy" /> : <span>?</span>}
        </div>
        <div className="tierlist-tile-name">{name}</div>
        <div className="tierlist-tile-role">{ROLE_LABELS[item.dominant_role] ?? item.dominant_role}</div>
        <div className="tierlist-tile-score">{item.avg_score.toFixed(2)}</div>
      </Link>
    </TierlistTooltip>
  )
}

function TierlistGrid({
  items, chars, lang, sites,
}: {
  items: AggregatedTier[]
  chars: Map<string, CharacterSummary>
  lang: string
  sites: TierlistSite[]
}) {
  const grouped = useMemo(() => {
    const g: Record<string, AggregatedTier[]> = {}
    for (const item of items) {
      const t = item.consensus_tier
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
                  key={item.character_slug}
                  item={item}
                  char={chars.get(resolveSlug(item.character_slug))}
                  lang={lang}
                  sites={sites}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function SingleTierGrid({
  items, chars, lang, sites, tier,
}: {
  items: AggregatedTier[]
  chars: Map<string, CharacterSummary>
  lang: string
  sites: TierlistSite[]
  tier: string
}) {
  const style = tierStyle(tier)
  const ROLE_ORDER = ['main_dps', 'sub_dps', 'support', 'general']

  const grouped = useMemo(() => {
    const g: Record<string, AggregatedTier[]> = {}
    for (const item of items) {
      const r = item.dominant_role || 'general'
      if (!g[r]) g[r] = []
      g[r].push(item)
    }
    for (const r of Object.keys(g)) {
      g[r].sort((a, b) => b.avg_score - a.avg_score)
    }
    return g
  }, [items])

  return (
    <div className="tierlist-single">
      <div
        className="tierlist-single-header"
        style={{ background: style.bg, color: style.text, borderColor: style.text }}
      >
        <span className="tierlist-single-label">{tier}</span>
        <span className="tierlist-single-count">
          {items.length} {items.length === 1 ? 'personagem' : 'personagens'}
        </span>
      </div>

      <div className="tierlist-single-groups">
        {ROLE_ORDER.map((role) => {
          const groupItems = grouped[role]
          if (!groupItems || groupItems.length === 0) return null
          return (
            <div key={role} className="tierlist-single-group">
              <div className="tierlist-single-group-header">
                {ROLE_LABELS[role] ?? role}
                <span className="tierlist-single-group-count">{groupItems.length}</span>
              </div>
              <div className="tierlist-single-grid">
                {groupItems.map((item) => (
                  <CharacterTile
                    key={item.character_slug}
                    item={item}
                    char={chars.get(resolveSlug(item.character_slug))}
                    lang={lang}
                    sites={sites}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TierlistList({
  items, chars, lang, sites,
}: {
  items: AggregatedTier[]
  chars: Map<string, CharacterSummary>
  lang: string
  sites: TierlistSite[]
}) {
  return (
    <div className="tierlist-list">
      {items.map((item) => {
        const char = chars.get(resolveSlug(item.character_slug))
        const img = char ? iconUrl(char.icon) : null
        const style = tierStyle(item.consensus_tier)
        return (
          <Link
            key={item.character_slug}
            to={`/characters/${resolveSlug(item.character_slug)}`}
            className="tierlist-list-row"
          >
            <span className="tierlist-list-tier" style={{ background: style.bg, color: style.text }}>
              {item.consensus_tier}
            </span>
            <div className="tierlist-list-avatar">
              {img ? <img src={img} alt={char?.name} loading="lazy" /> : <span>?</span>}
            </div>
            <div className="tierlist-list-info">
              <span className="tierlist-list-name">{char?.name ?? item.character_slug}</span>
              <span className="tierlist-list-meta">
                <strong style={{ color: '#7dd3fc' }}>{ROLE_LABELS[item.dominant_role] ?? item.dominant_role}</strong>
                {' · '}{item.num_sites} sites · média {item.tier_by_avg} · spread {item.spread.toFixed(2)}
              </span>
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

type TierlistCategory = 'general' | 'abyss' | 'stygian'

const CATEGORY_TABS: { key: TierlistCategory; label: string; labelEn: string; hint: string; hintEn: string }[] = [
  {
    key: 'general',
    label: 'Consenso Geral',
    labelEn: 'General Consensus',
    hint: 'Valor de conta e força geral (sem viés sazonal de 30 dias)',
    hintEn: 'Overall account value (excludes 30-day seasonal boss cycles)',
  },
  {
    key: 'abyss',
    label: 'Abismo (30d)',
    labelEn: 'Spiral Abyss (30d)',
    hint: 'Taxa de uso real no Abismo Espiral (YS Helper)',
    hintEn: 'Real Spiral Abyss usage statistics (YS Helper)',
  },
  {
    key: 'stygian',
    label: 'Stygian Onslaught (30d)',
    labelEn: 'Stygian Onslaught (30d)',
    hint: 'Uso real + ranking por chefe do ciclo atual',
    hintEn: 'Real usage + per-boss rankings for the current cycle',
  },
]

export default function TierlistPage() {
  const { lang } = useLanguage()
  const [data, setData] = useState<TierlistResponse | null>(null)
  const [sites, setSites] = useState<TierlistSite[]>([])
  const [chars, setChars] = useState<Map<string, CharacterSummary>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [category, setCategory] = useState<TierlistCategory>('general')
  const [siteFilter, setSiteFilter] = useState<string>('all')
  const [roleFilter, setRoleFilter] = useState('all')
  const [tierFilter, setTierFilter] = useState('all')
  const [elementFilter, setElementFilter] = useState('all')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  const load = async () => {
    setLoading(true)
    try {
      const params: { role?: string; category: string; site?: string } = { category }
      if (roleFilter !== 'all') params.role = roleFilter
      if (siteFilter !== 'all') params.site = siteFilter
      const [tierlist, sitesData, charsData] = await Promise.all([
        api.getTierlist(params),
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

  useEffect(() => { load() }, [lang, roleFilter, category, siteFilter])

  const activeCategorySites = useMemo(
    () => sites.filter((s) => (s.category ?? 'general') === category),
    [sites, category],
  )

  const handleCategoryChange = (next: TierlistCategory) => {
    setCategory(next)
    setSiteFilter('all')
    setTierFilter('all')
  }

  const filtered = useMemo(() => {
    if (!data) return []
    let list = data.items
    if (tierFilter !== 'all') {
      list = list.filter((i) => i.consensus_tier === tierFilter)
    }
    if (elementFilter !== 'all') {
      list = list.filter((i) => {
        const c = chars.get(resolveSlug(i.character_slug))
        return c?.element === elementFilter
      })
    }
    return [...list].sort((a, b) => b.avg_score - a.avg_score)
  }, [data, tierFilter, elementFilter, chars])

  if (loading) return <p className="status">Carregando tierlist...</p>
  if (error) return <p className="status error">Erro: {error}</p>

  const byRoleCount = (data?.items ?? []).reduce<Record<string, number>>((acc, i) => {
    acc[i.dominant_role] = (acc[i.dominant_role] || 0) + 1
    return acc
  }, {})
  const allUnique = (data?.items ?? []).length
  const activeTabMeta = CATEGORY_TABS.find((t) => t.key === category) ?? CATEGORY_TABS[0]

  return (
    <div className="tierlist-page">
      <div className="tierlist-header">
        <div>
          <h1><Trophy size={32} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 8 }} /> Tierlist Agregada</h1>
          <p className="tierlist-subtitle">
            {activeCategorySites.length} {lang === 'en' ? 'sources' : 'fontes'} · {allUnique} {lang === 'en' ? 'characters' : 'personagens'} · {lang === 'en' ? activeTabMeta.hintEn : activeTabMeta.hint}
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

      {/* Abas de modo: Consenso Geral vs Endgame Sazonal (30 dias) */}
      <div className="filter-pills" style={{ marginBottom: 14, gap: 8 }}>
        {CATEGORY_TABS.map((tab) => {
          const tabSiteCount = sites.filter((s) => (s.category ?? 'general') === tab.key).length
          const isActive = category === tab.key
          return (
            <button
              key={tab.key}
              className={`filter-pill ${isActive ? 'active' : ''}`}
              style={{
                '--pill-color': tab.key === 'general' ? '#38bdf8' : tab.key === 'abyss' ? '#c084fc' : '#f97316',
                padding: '7px 14px',
                fontSize: 13,
                fontWeight: 700,
              } as React.CSSProperties}
              onClick={() => handleCategoryChange(tab.key)}
            >
              {lang === 'en' ? tab.labelEn : tab.label}
              <span className="filter-pill-count">{tabSiteCount}</span>
            </button>
          )
        })}
      </div>

      {/* Sub-filtro por chefe / fonte dentro do Stygian Onslaught */}
      {category === 'stygian' && activeCategorySites.length > 1 && (
        <div className="filter-pills" style={{ marginBottom: 12, gap: 6 }}>
          <button
            className={`filter-pill ${siteFilter === 'all' ? 'active' : ''}`}
            style={{ '--pill-color': '#fb923c' } as React.CSSProperties}
            onClick={() => setSiteFilter('all')}
          >
            {lang === 'en' ? 'All Stygian (Consensus)' : 'Todos (Consenso Stygian)'}
          </button>
          {activeCategorySites.map((s) => (
            <button
              key={s.slug}
              className={`filter-pill ${siteFilter === s.slug ? 'active' : ''}`}
              style={{ '--pill-color': '#fb923c' } as React.CSSProperties}
              onClick={() => setSiteFilter(s.slug)}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      <div className="tierlist-sources">
        <span className="tierlist-sources-label">
          <Filter size={14} /> {lang === 'en' ? 'Sources' : 'Fontes'}:
        </span>
        {activeCategorySites.map((s) => (
          <a key={s.slug} href={s.url} target="_blank" rel="noopener noreferrer" className="tierlist-source-chip">
            {s.name} <ExternalLink size={10} />
          </a>
        ))}
      </div>

      <div className="tierlist-filters">
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

        <div className="filter-group">
          <span className="filter-label">Tier</span>
          <div className="filter-pills">
            {TIERS.map((t) => (
              <button
                key={t.key}
                className={`filter-pill ${tierFilter === t.key ? 'active' : ''}`}
                style={{ '--pill-color': '#fbbf24' } as React.CSSProperties}
                onClick={() => setTierFilter(t.key)}
              >
                {lang === 'en' ? t.labelEn : t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="filter-group">
          <span className="filter-label">{lang === 'en' ? 'Element' : 'Elemento'}</span>
          <div className="filter-pills">
            {ELEMENTS.map((e) => (
              <button
                key={e.key}
                className={`filter-pill ${elementFilter === e.key ? 'active' : ''}`}
                style={{ '--pill-color': '#a78bfa' } as React.CSSProperties}
                onClick={() => setElementFilter(e.key)}
              >
                {lang === 'en' ? e.labelEn : e.label}
              </button>
            ))}
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
        tierFilter !== 'all' ? (
          <SingleTierGrid
            items={filtered}
            chars={chars}
            lang={lang}
            sites={sites}
            tier={tierFilter}
          />
        ) : (
          <TierlistGrid items={filtered} chars={chars} lang={lang} sites={sites} />
        )
      ) : (
        <TierlistList items={filtered} chars={chars} lang={lang} sites={sites} />
      )}
    </div>
  )
}
