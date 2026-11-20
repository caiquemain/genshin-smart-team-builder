import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Trash2, ArrowRight, Plus, Search, Users, CheckCircle2, UserX,
  Repeat2, Sparkles, Layers, RotateCcw,
} from 'lucide-react'
import { api } from '../api/client'
import { useLanguage } from '../context/LanguageContext'
import { iconUrl } from '../config'
import { archetypeInfo } from '../utils/archetypes'
import { useRoster } from '../utils/roster'
import TeamTierBadge from '../components/TeamTierBadge'
import TeamTemplateModal from '../components/TeamTemplateModal'
import type { TeamDetail, TeamTemplateSummary, CharacterSummary } from '../types'

const ARCHETYPE_ORDER = [
  'hyperbloom', 'bloom', 'burgeon', 'quicken', 'aggravate', 'spread',
  'vaporize', 'melt', 'freeze', 'overload', 'superconduct',
  'hypercarry', 'national',
]

const ELEMENTS = ['pyro', 'hydro', 'cryo', 'electro', 'anemo', 'geo', 'dendro'] as const
const TIER_ORDER = ['S+', 'S', 'A', 'B', 'C', 'D'] as const

const ELEMENT_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  pyro: { color: '#fca5a5', bg: 'rgba(239, 68, 68, 0.14)', border: 'rgba(239, 68, 68, 0.38)' },
  hydro: { color: '#7dd3fc', bg: 'rgba(56, 189, 248, 0.14)', border: 'rgba(56, 189, 248, 0.38)' },
  cryo: { color: '#bae6fd', bg: 'rgba(125, 211, 252, 0.14)', border: 'rgba(125, 211, 252, 0.38)' },
  electro: { color: '#d8b4fe', bg: 'rgba(168, 85, 247, 0.16)', border: 'rgba(168, 85, 247, 0.42)' },
  anemo: { color: '#6ee7b7', bg: 'rgba(52, 211, 153, 0.14)', border: 'rgba(52, 211, 153, 0.38)' },
  geo: { color: '#fde68a', bg: 'rgba(245, 158, 11, 0.16)', border: 'rgba(245, 158, 11, 0.4)' },
  dendro: { color: '#bef264', bg: 'rgba(132, 204, 22, 0.15)', border: 'rgba(132, 204, 22, 0.4)' },
}

type OwnedFilter = 'all' | 'complete' | 'almost'
type TeamsTab = 'principal' | 'templates'
type TeamOriginFilter = 'all' | 'principal' | 'custom'
type TeamSort = 'tier' | 'name' | 'recent'

function isPrincipalTeam(t: TeamDetail): boolean {
  return t.name.includes('— Principal') || (t.description ?? '').startsWith('Build importada de ')
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

function TeamTemplateCard({
  template,
  chars,
  roster,
  onOpenModal,
}: {
  template: TeamTemplateSummary
  chars: Map<string, CharacterSummary>
  roster: ReturnType<typeof useRoster>
  onOpenModal: () => void
}) {
  const arch = archetypeInfo(template.archetype)
  const ArchIcon = arch.icon

  const owned = template.character_slugs.map((s) => roster.get(s))
  const ownedCount = owned.filter((o) => o.owned).length
  const total = template.character_slugs.length
  const isComplete = ownedCount === total
  const isNone = ownedCount === 0

  return (
    <div
      className="template-card"
      style={{ borderLeftColor: arch.color, cursor: 'pointer', position: 'relative' }}
      onClick={onOpenModal}
    >
      <span className={`template-card-owned-badge ${isComplete ? 'is-complete' : isNone ? 'is-none' : 'is-incomplete'}`}>
        {isComplete ? <CheckCircle2 size={12} /> : isNone ? <UserX size={12} /> : <Users size={12} />}
        {ownedCount}/{total}
      </span>

      <div className="template-card-header">
        <div className="template-card-arch" style={{ background: `${arch.color}20`, color: arch.color }}>
          <ArchIcon size={14} /> {arch.label}
        </div>
        {template.sources && template.sources.length > 1 ? (
          <span
            className="template-card-source-badge is-multi"
            title={template.sources.map((s) => s.source).join(' · ')}
          >
            {template.sources.length} fontes
          </span>
        ) : template.source ? (
          <span className="template-card-source-badge">
            {template.source}
          </span>
        ) : null}
      </div>
      <div className="template-card-name">{template.name}</div>
      {template.description && (
        <p className="template-card-desc">{template.description}</p>
      )}
      <div className="template-card-members">
        {template.character_slugs.map((slug, i) => {
          const c = chars.get(slug)
          const img = c ? iconUrl(c.icon) : null
          const isMain = slug === template.main_character
          const o = owned[i]
          return (
            <span
              key={slug}
              className={`template-member ${isMain ? 'template-member-main' : ''} ${o.owned ? 'is-owned' : 'is-missing'}`}
              title={`${c?.name ?? slug}${o.owned ? ' (você tem)' : ' (não tem)'}`}
            >
              {img ? <img src={img} alt={c?.name ?? slug} /> : <span>?</span>}
            </span>
          )
        })}
      </div>
      <div className="template-card-actions">
        <button
          type="button"
          className="btn-primary"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', width: '100%' }}
          onClick={(e) => { e.stopPropagation(); window.location.href = `/teams/new?template_id=${template.id}` }}
        >
          Usar <ArrowRight size={14} />
        </button>
      </div>
    </div>
  )
}

export default function TeamsPage() {
  const { lang } = useLanguage()
  const roster = useRoster()
  const [teams, setTeams] = useState<TeamDetail[] | null>(null)
  const [templates, setTemplates] = useState<TeamTemplateSummary[]>([])
  const [chars, setChars] = useState<Map<string, CharacterSummary>>(new Map())
  const [error, setError] = useState<string | null>(null)

  const [activeTab, setActiveTab] = useState<TeamsTab>('principal')

  // Filtros dos Times Principais / Meus Times
  const [teamSearch, setTeamSearch] = useState('')
  const [teamElement, setTeamElement] = useState<string>('all')
  const [teamTierFilter, setTeamTierFilter] = useState<string>('all')
  const [teamOwnedFilter, setTeamOwnedFilter] = useState<OwnedFilter>('all')
  const [teamOriginFilter, setTeamOriginFilter] = useState<TeamOriginFilter>('all')
  const [teamSort, setTeamSort] = useState<TeamSort>('tier')

  // Filtros dos Templates Multi-fonte
  const [search, setSearch] = useState('')
  const [archFilter, setArchFilter] = useState<string>('all')
  const [ownedFilter, setOwnedFilter] = useState<OwnedFilter>('all')
  const [modalTemplateId, setModalTemplateId] = useState<number | null>(null)

  useEffect(() => {
    Promise.all([
      api.listTeams(lang),
      api.listTemplates(),
      api.listCharacters(lang, { limit: 200 }),
    ])
      .then(([t, tpl, c]) => {
        setTeams(t.items)
        setTemplates(tpl.items)
        const cm = new Map<string, CharacterSummary>()
        c.items.forEach((x) => cm.set(x.slug, x))
        setChars(cm)
      })
      .catch((e) => setError(String(e)))
  }, [lang])

  const handleDelete = async (id: number) => {
    if (!confirm('Apagar este time?')) return
    try {
      await api.deleteTeam(id)
      setTeams((prev) => prev?.filter((t) => t.id !== id) ?? null)
    } catch (e) {
      setError(String(e))
    }
  }

  // Filtro & ordenação dos Times Principais / Meus Times
  const filteredTeams = useMemo(() => {
    if (!teams) return []
    const q = teamSearch.trim().toLowerCase()
    const filtered = teams.filter((t) => {
      if (teamOriginFilter === 'principal' && !isPrincipalTeam(t)) return false
      if (teamOriginFilter === 'custom' && isPrincipalTeam(t)) return false

      if (teamElement !== 'all') {
        const mainEl = (t.members[0]?.character.element ?? '').toLowerCase()
        if (mainEl !== teamElement) return false
      }

      if (teamTierFilter !== 'all') {
        const tier = t.team_tier?.tier ?? ''
        if (tier !== teamTierFilter) return false
      }

      if (q) {
        const nameMatch = t.name.toLowerCase().includes(q)
        const memberMatch = t.members.some(
          (m) =>
            m.character.name.toLowerCase().includes(q) ||
            m.character.slug.toLowerCase().includes(q),
        )
        const subMatch = t.members.some((m) =>
          (m.substitutes ?? []).some((s) => {
            if (!s.character_slug) return false
            const sc = chars.get(s.character_slug)
            return (
              s.character_slug.toLowerCase().includes(q) ||
              (sc?.name ?? '').toLowerCase().includes(q)
            )
          }),
        )
        if (!nameMatch && !memberMatch && !subMatch) return false
      }

      if (teamOwnedFilter !== 'all') {
        const ownedCount = t.members.filter((m) => roster.get(m.character.slug).owned).length
        const total = t.members.length
        if (teamOwnedFilter === 'complete' && (total === 0 || ownedCount !== total)) return false
        if (teamOwnedFilter === 'almost' && (total === 0 || ownedCount < total - 1)) return false
      }

      return true
    })

    return [...filtered].sort((a, b) => {
      if (teamSort === 'tier') {
        const av = a.team_tier?.value ?? -1
        const bv = b.team_tier?.value ?? -1
        if (bv !== av) return bv - av
        return a.name.localeCompare(b.name)
      }
      if (teamSort === 'name') {
        return a.name.localeCompare(b.name)
      }
      return b.id - a.id
    })
  }, [teams, teamSearch, teamElement, teamTierFilter, teamOwnedFilter, teamOriginFilter, teamSort, chars, roster])

  const hasTeamFilters =
    teamSearch !== '' ||
    teamElement !== 'all' ||
    teamTierFilter !== 'all' ||
    teamOwnedFilter !== 'all' ||
    teamOriginFilter !== 'all'

  const resetTeamFilters = () => {
    setTeamSearch('')
    setTeamElement('all')
    setTeamTierFilter('all')
    setTeamOwnedFilter('all')
    setTeamOriginFilter('all')
  }

  // Filtro aplicado nos Templates Multi-fonte
  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      if (archFilter !== 'all' && t.archetype !== archFilter) return false
      if (search) {
        const q = search.toLowerCase()
        const nameMatch = t.name.toLowerCase().includes(q)
        const charMatch = t.character_slugs.some((s) => {
          const c = chars.get(s)
          return (c?.name ?? s).toLowerCase().includes(q)
        })
        if (!nameMatch && !charMatch) return false
      }
      if (ownedFilter !== 'all') {
        const ownedCount = t.character_slugs.filter((s) => roster.get(s).owned).length
        const total = t.character_slugs.length
        if (ownedFilter === 'complete' && ownedCount !== total) return false
        if (ownedFilter === 'almost' && ownedCount < total - 1) return false
      }
      return true
    })
  }, [templates, archFilter, search, ownedFilter, chars, roster])

  const groupedTemplates = useMemo(() => {
    const groups = new Map<string, TeamTemplateSummary[]>()
    for (const t of filteredTemplates) {
      const arr = groups.get(t.archetype) ?? []
      arr.push(t)
      groups.set(t.archetype, arr)
    }
    return ARCHETYPE_ORDER
      .filter((a) => groups.has(a))
      .map((a) => ({ archetype: a, items: groups.get(a)! }))
  }, [filteredTemplates])

  const availableArchetypes = useMemo(() => {
    const set = new Set(templates.map((t) => t.archetype))
    return ARCHETYPE_ORDER.filter((a) => set.has(a))
  }, [templates])

  const principalCount = useMemo(() => (teams ?? []).filter(isPrincipalTeam).length, [teams])
  const customCount = (teams?.length ?? 0) - principalCount

  return (
    <div>
      <div className="page-header">
        <h1>Times</h1>
        <Link to="/teams/new" className="btn-primary btn-new-team"><Plus size={18} /> Novo Time</Link>
      </div>

      {error && <p className="error">Erro: {error}</p>}

      {/* Abas principais */}
      <div className="teams-mode-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'principal'}
          className={`teams-mode-tab ${activeTab === 'principal' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('principal')}
        >
          <Sparkles size={16} />
          <span>Times Principais &amp; Meus Times</span>
          <span className="teams-mode-tab-count">{teams ? teams.length : '…'}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'templates'}
          className={`teams-mode-tab ${activeTab === 'templates' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('templates')}
        >
          <Layers size={16} />
          <span>Templates Multi-fonte</span>
          <span className="teams-mode-tab-count">{templates.length}</span>
        </button>
      </div>

      {/* === Aba 1: Times Principais & Meus Times === */}
      {activeTab === 'principal' && (
        <section className="teams-section">
          <p className="teams-section-sub">
            Times detalhados com build completa dos 4 personagens, análise de sinergia e substitutos curados por slot.{' '}
            {roster.hasGoodOrSeelie
              ? <>Você tem <strong>{roster.ownedCount}</strong> personagens na conta.</>
              : <>Importe o GOOD no Roster/Planner para ver quais times você já consegue montar.</>}
          </p>

          {/* Barra de filtros (mesmo estilo dos templates + elemento/tier/origem/ordenação) */}
          <div className="template-filters">
            <div className="template-filter-search">
              <Search size={16} />
              <input
                type="text"
                placeholder="Buscar time, personagem ou substituto..."
                value={teamSearch}
                onChange={(e) => setTeamSearch(e.target.value)}
              />
            </div>

            <select
              className="template-filter-select"
              value={teamElement}
              onChange={(e) => setTeamElement(e.target.value)}
              aria-label="Filtrar por elemento"
            >
              <option value="all">Todos os elementos</option>
              {ELEMENTS.map((el) => (
                <option key={el} value={el}>{capitalize(el)}</option>
              ))}
            </select>

            <select
              className="template-filter-select"
              value={teamTierFilter}
              onChange={(e) => setTeamTierFilter(e.target.value)}
              aria-label="Filtrar por tier"
            >
              <option value="all">Todos os tiers</option>
              {TIER_ORDER.map((tr) => (
                <option key={tr} value={tr}>Tier {tr}</option>
              ))}
            </select>

            <select
              className="template-filter-select"
              value={teamOwnedFilter}
              onChange={(e) => setTeamOwnedFilter(e.target.value as OwnedFilter)}
              aria-label="Filtrar por posse na conta"
            >
              <option value="all">Todos os times</option>
              <option value="complete">Só os que posso montar (4/4)</option>
              <option value="almost">Falta 1 ou menos (3/4+)</option>
            </select>

            {principalCount > 0 && customCount > 0 && (
              <select
                className="template-filter-select"
                value={teamOriginFilter}
                onChange={(e) => setTeamOriginFilter(e.target.value as TeamOriginFilter)}
                aria-label="Filtrar por origem"
              >
                <option value="all">Principais + Meus ({teams?.length ?? 0})</option>
                <option value="principal">Principais KQM ({principalCount})</option>
                <option value="custom">Criados por mim ({customCount})</option>
              </select>
            )}

            <select
              className="template-filter-select"
              value={teamSort}
              onChange={(e) => setTeamSort(e.target.value as TeamSort)}
              aria-label="Ordenar times"
            >
              <option value="tier">Ordenar: Melhor Tier</option>
              <option value="name">Ordenar: Nome (A–Z)</option>
              <option value="recent">Ordenar: Mais recentes</option>
            </select>

            {hasTeamFilters && (
              <button type="button" className="team-filter-reset" onClick={resetTeamFilters}>
                <RotateCcw size={14} /> Limpar
              </button>
            )}

            <span className="template-filter-count">
              {filteredTeams.length} de {teams?.length ?? 0} times
            </span>
          </div>

          {!teams && <p className="status">Carregando...</p>}
          {teams && teams.length === 0 && (
            <p className="status">
              Você ainda não criou nenhum time. <Link to="/teams/new">Crie o primeiro</Link> ou abra a aba Templates Multi-fonte.
            </p>
          )}
          {teams && teams.length > 0 && filteredTeams.length === 0 && (
            <p className="status" style={{ padding: 20 }}>Nenhum time encontrado com esses filtros.</p>
          )}

          {filteredTeams.length > 0 && (
            <div className="teams-grid">
              {filteredTeams.map((t) => {
                const ownedFlags = t.members.map((m) => roster.get(m.character.slug).owned)
                const ownedCount = ownedFlags.filter(Boolean).length
                const total = t.members.length
                const isComplete = total > 0 && ownedCount === total
                const isNone = ownedCount === 0
                const totalSubs = t.members.reduce((acc, m) => acc + (m.substitutes?.length ?? 0), 0)
                const mainEl = (t.members[0]?.character.element ?? '').toLowerCase()
                const elStyle = ELEMENT_COLORS[mainEl]

                return (
                  <Link
                    key={t.id}
                    to={`/teams/${t.id}`}
                    className="team-card"
                    style={{ textDecoration: 'none', color: 'inherit' }}
                  >
                    <div className="team-card-header">
                      <div className="team-card-title-block">
                        <h3>
                          {t.name}
                          <span style={{ marginLeft: 10, verticalAlign: 'middle' }}>
                            <TeamTierBadge teamTier={t.team_tier} size="sm" />
                          </span>
                        </h3>
                        <div className="team-card-meta-badges">
                          {mainEl && elStyle && (
                            <span
                              className="team-card-el-chip"
                              style={{ color: elStyle.color, background: elStyle.bg, borderColor: elStyle.border }}
                            >
                              {capitalize(mainEl)}
                            </span>
                          )}
                          <span className={`team-card-owned-pill ${isComplete ? 'is-complete' : isNone ? 'is-none' : 'is-incomplete'}`}>
                            {isComplete ? <CheckCircle2 size={11} /> : isNone ? <UserX size={11} /> : <Users size={11} />}
                            {ownedCount}/{total}
                          </span>
                          {totalSubs > 0 && (
                            <span className="team-card-subs-pill" title={`${totalSubs} opções de substitutos curados nos slots`}>
                              <Repeat2 size={11} /> {totalSubs} subs
                            </span>
                          )}
                        </div>
                        {t.author_name && <p className="team-author">por {t.author_name}</p>}
                      </div>
                      <button
                        className="btn-danger"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(t.id) }}
                        aria-label="Apagar time"
                        title="Apagar time"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    {t.description && <p className="team-desc">{t.description}</p>}
                    <div className="team-members">
                      {t.members.map((m, idx) => {
                        const img = iconUrl(m.character.icon)
                        const hasChar = ownedFlags[idx]
                        return (
                          <span
                            key={m.position}
                            className={`team-member ${hasChar ? 'is-owned' : 'is-missing'}`}
                            title={`${m.character.name}${hasChar ? ' (você tem)' : ' (não tem)'}`}
                          >
                            {img ? <img src={img} alt={m.character.name} /> : <span>?</span>}
                            <span className="team-member-name">{m.character.name}</span>
                          </span>
                        )
                      })}
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </section>
      )}

      {/* === Aba 2: Times recomendados (Multi-fonte) === */}
      {activeTab === 'templates' && (
        <section className="teams-section">
          <p className="teams-section-sub">
            Curados de múltiplas fontes (KQM, Game8, GameWith, Genshin.gg e YS Helper). {roster.hasGoodOrSeelie
              ? <>Você tem <strong>{roster.ownedCount}</strong> personagens na conta.</>
              : <>Importe o GOOD no Planner para ver quais times você pode montar.</>}
          </p>

          {/* Filtros */}
          <div className="template-filters">
            <div className="template-filter-search">
              <Search size={16} />
              <input
                type="text"
                placeholder="Buscar time ou personagem..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              className="template-filter-select"
              value={archFilter}
              onChange={(e) => setArchFilter(e.target.value)}
            >
              <option value="all">Todos os arquétipos</option>
              {availableArchetypes.map((a) => {
                const info = archetypeInfo(a)
                return <option key={a} value={a}>{info.label}</option>
              })}
            </select>
            <select
              className="template-filter-select"
              value={ownedFilter}
              onChange={(e) => setOwnedFilter(e.target.value as OwnedFilter)}
            >
              <option value="all">Todos os times</option>
              <option value="complete">Só os que posso montar</option>
              <option value="almost">Falta 1 ou menos</option>
            </select>
            <span className="template-filter-count">
              {filteredTemplates.length} de {templates.length} times
            </span>
          </div>

          {groupedTemplates.length === 0 && (
            <p className="status" style={{ padding: 20 }}>Nenhum time encontrado com esses filtros.</p>
          )}

          {groupedTemplates.map((g) => {
            const arch = archetypeInfo(g.archetype)
            const ArchIcon = arch.icon
            return (
              <div key={g.archetype} className="template-archetype-group">
                <div className="template-archetype-title">
                  <ArchIcon size={20} color={arch.color} />
                  <span style={{ color: arch.color }}>{arch.label}</span>
                  <span className="template-archetype-count">{g.items.length}</span>
                </div>
                <div className="templates-grid">
                  {g.items.map((t) => (
                    <TeamTemplateCard
                      key={t.id}
                      template={t}
                      chars={chars}
                      roster={roster}
                      onOpenModal={() => setModalTemplateId(t.id)}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </section>
      )}

      {modalTemplateId !== null && (
        <TeamTemplateModal
          templateId={modalTemplateId}
          chars={chars}
          onClose={() => setModalTemplateId(null)}
        />
      )}
    </div>
  )
}
