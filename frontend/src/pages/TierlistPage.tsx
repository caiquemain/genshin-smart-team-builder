import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Trophy, Filter, ChevronDown, ExternalLink, RefreshCw } from 'lucide-react'
import { api } from '../api/client'
import { useLanguage } from '../context/LanguageContext'
import { iconUrl } from '../config'
import type { CharacterSummary } from '../types'
import type { TierlistSite, TierlistResponse, AggregatedTier } from '../types/tierlist'

const ROLES = [
  { key: 'all', label: 'Todos', labelEn: 'All' },
  { key: 'main-dps', label: 'Main DPS', labelEn: 'Main DPS' },
  { key: 'sub-dps', label: 'Sub-DPS', labelEn: 'Sub-DPS' },
  { key: 'support', label: 'Suporte', labelEn: 'Support' },
  { key: 'healer', label: 'Healer', labelEn: 'Healer' },
  { key: 'general', label: 'Geral', labelEn: 'General' },
]


const SLUG_ALIASES: Record<string, string> = {
  kazuha: 'kaedehara-kazuha',
  hutao: 'hu-tao',
  shogun: 'raiden-shogun',
  ayaka: 'kamisato-ayaka',
  kokomi: 'sangonomiya-kokomi',
  heizou: 'shikanoin-heizou',
  shinobu: 'kuki-shinobu',
  mizuki: 'yumemizuki-mizuki',
  yunjin: 'yun-jin',
  sara: 'kujou-sara',
  lanyan: 'lan-yan',
}

const resolveSlug = (slug: string): string => SLUG_ALIASES[slug] ?? slug

const ROLE_LABELS: Record<string, { pt: string; en: string }> = {
  'main-dps': { pt: 'Main DPS', en: 'Main DPS' },
  'sub-dps': { pt: 'Sub-DPS', en: 'Sub-DPS' },
  'support': { pt: 'Suporte', en: 'Support' },
  'healer': { pt: 'Healer', en: 'Healer' },
  'general': { pt: 'Geral', en: 'General' },
}

function formatRole(role: string, lang: string): string {
  const labels = ROLE_LABELS[role]
  if (labels) return lang === 'en' ? labels.en : labels.pt
  return role.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

const TIER_COLORS: Record<string, { bg: string; text: string }> = {
  'S+': { bg: 'rgba(239, 68, 68, 0.2)', text: '#f87171' },
  'S':  { bg: 'rgba(251, 146, 60, 0.2)', text: '#fb923c' },
  'A':  { bg: 'rgba(251, 191, 36, 0.2)', text: '#fbbf24' },
  'B':  { bg: 'rgba(74, 222, 128, 0.2)', text: '#4ade80' },
  'C':  { bg: 'rgba(96, 165, 250, 0.2)', text: '#60a5fa' },
  'D':  { bg: 'rgba(148, 163, 184, 0.2)', text: '#94a3b8' },
}

function tierStyle(tier: string) {
  return TIER_COLORS[tier] ?? { bg: 'rgba(148, 163, 184, 0.15)', text: '#cbd5e1' }
}

function TierBadge({ tier, large = false }: { tier: string; large?: boolean }) {
  const s = tierStyle(tier)
  return (
    <span
      className={`tier-badge ${large ? 'tier-badge-large' : ''}`}
      style={{ background: s.bg, color: s.text, borderColor: `${s.text}55` }}
    >
      {tier}
    </span>
  )
}

function CharacterRow({
  item, char, sites, lang, expanded, onToggle,
}: {
  item: AggregatedTier
  char: CharacterSummary | undefined
  sites: TierlistSite[]
  lang: string
  expanded: boolean
  onToggle: () => void
}) {
  const img = char ? iconUrl(char.icon) : null
  const sortedEntries = [...item.entries].sort((a, b) => b.normalized_value - a.normalized_value)

  return (
    <div className={`tierlist-row ${expanded ? 'expanded' : ''}`}>
      <div className="tierlist-row-main" onClick={onToggle}>
        <div className="tierlist-row-rank">
          <TierBadge tier={item.tier_consolidated} large />
        </div>
        <div className="tierlist-row-avatar">
          {img ? <img src={img} alt={item.character_slug} /> : <span>?</span>}
        </div>
        <div className="tierlist-row-info">
          <Link
            to={`/characters/${item.character_slug}`}
            className="tierlist-row-name"
            onClick={(e) => e.stopPropagation()}
          >
            {char?.name ?? item.character_slug}
          </Link>
          <div className="tierlist-row-meta">
            <span className="tierlist-row-role">{formatRole(item.role, lang)}</span>
            <span>·</span>
            <span>{item.num_sites} sites</span>
          </div>
        </div>
        <div className="tierlist-row-score">
          <div className="tierlist-score-bar">
            <div
              className="tierlist-score-fill"
              style={{ width: `${item.avg_score * 100}%`, background: tierStyle(item.tier_consolidated).text }}
            />
          </div>
          <span className="tierlist-score-value">{item.avg_score.toFixed(2)}</span>
        </div>
        <button className="tierlist-row-expand" aria-label="Expandir">
          <ChevronDown size={18} className={expanded ? 'rotated' : ''} />
        </button>
      </div>
      {expanded && (
        <div className="tierlist-row-details">
          {sortedEntries.map((e) => {
            const site = sites.find((s) => s.slug === e.site_slug)
            return (
              <div key={`${e.site_slug}-${e.role}`} className="tierlist-entry">
                <span className="tierlist-entry-site">{site?.name ?? e.site_slug}</span>
                <TierBadge tier={e.tier_label} />
                <div className="tierlist-entry-bar">
                  <div
                    className="tierlist-entry-fill"
                    style={{ width: `${e.normalized_value * 100}%` }}
                  />
                </div>
                <span className="tierlist-entry-value">{e.normalized_value.toFixed(2)}</span>
                {e.source_url && (
                  <a href={e.source_url} target="_blank" rel="noopener noreferrer" className="tierlist-entry-link">
                    <ExternalLink size={12} />
                  </a>
                )}
              </div>
            )
          })}
        </div>
      )}
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
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null)

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
    if (roleFilter === 'all') return data.items
    return data.items.filter((i) => i.role === roleFilter)
  }, [data, roleFilter])

  if (loading) return <p className="status">Carregando tierlist...</p>
  if (error) return <p className="status error">Erro: {error}</p>

  const byRoleCount = (data?.items ?? []).reduce<Record<string, number>>((acc, i) => {
    acc[i.role] = (acc[i.role] || 0) + 1
    return acc
  }, {})

  return (
    <div className="tierlist-page">
      <div className="tierlist-header">
        <div>
          <h1><Trophy size={32} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 8 }} /> Tierlist Agregada</h1>
          <p className="tierlist-subtitle">
            {sites.length} {lang === 'en' ? 'sources' : 'fontes'} · {data?.items.length ?? 0} {lang === 'en' ? 'entries' : 'entradas'}
          </p>
        </div>
        <button className="btn-secondary" onClick={load} disabled={loading}>
          <RefreshCw size={14} /> {lang === 'en' ? 'Refresh' : 'Atualizar'}
        </button>
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
              const count = r.key === 'all' ? (data?.items.length ?? 0) : (byRoleCount[r.key] ?? 0)
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
            {lang === 'en'
              ? 'No tierlist data yet. Import via POST /tierlist/import.'
              : 'Sem dados de tierlist ainda. Importe via POST /tierlist/import.'}
          </p>
          <code>POST /tierlist/import</code>
        </div>
      ) : (
        <div className="tierlist-list">
          {filtered.map((item) => (
            <CharacterRow
              key={`${item.character_slug}-${item.role}`}
              item={item}
              char={chars.get(resolveSlug(item.character_slug))}
              sites={sites}
              lang={lang}
              expanded={expandedSlug === `${item.character_slug}-${item.role}`}
              onToggle={() => setExpandedSlug(
                expandedSlug === `${item.character_slug}-${item.role}`
                  ? null
                  : `${item.character_slug}-${item.role}`
              )}
            />
          ))}
        </div>
      )}
    </div>
  )
}
