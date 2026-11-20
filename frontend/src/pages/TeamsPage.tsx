import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Trash2, ArrowRight, Plus, Search, Users, CheckCircle2, UserX } from 'lucide-react'
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

type OwnedFilter = 'all' | 'complete' | 'almost'

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

  // Filtro aplicado
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

  // Lista de arquétipos disponíveis (para as pills)
  const availableArchetypes = useMemo(() => {
    const set = new Set(templates.map((t) => t.archetype))
    return ARCHETYPE_ORDER.filter((a) => set.has(a))
  }, [templates])

  return (
    <div>
      <div className="page-header">
        <h1>Times</h1>
        <Link to="/teams/new" className="btn-primary btn-new-team"><Plus size={18} /> Novo Time</Link>
      </div>

      {error && <p className="error">Erro: {error}</p>}

      {/* === Meus times === */}
      <section className="teams-section">
        <h2 className="teams-section-title">Meus times</h2>

        {!teams && <p className="status">Carregando...</p>}
        {teams && teams.length === 0 && (
          <p className="status">
            Você ainda não criou nenhum time. <Link to="/teams/new">Crie o primeiro</Link> ou use um template abaixo.
          </p>
        )}

        {teams && teams.length > 0 && (
          <div className="teams-grid">
            {teams.map((t) => (
              <Link key={t.id} to={`/teams/${t.id}`} className="team-card" style={{ textDecoration: 'none', color: 'inherit' }}>
                <div className="team-card-header">
                  <div>
                    <h3>
                      {t.name}
                      <span style={{ marginLeft: 10, verticalAlign: 'middle' }}>
                        <TeamTierBadge teamTier={t.team_tier} size="sm" />
                      </span>
                    </h3>
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
                  {t.members.map((m) => {
                    const img = iconUrl(m.character.icon)
                    return (
                      <span key={m.position} className="team-member" title={m.character.name}>
                        {img ? <img src={img} alt={m.character.name} /> : <span>?</span>}
                        <span className="team-member-name">{m.character.name}</span>
                      </span>
                    )
                  })}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* === Times recomendados (Multi-fonte) === */}
      {templates.length > 0 && (
        <section className="teams-section">
          <h2 className="teams-section-title">
            Times recomendados <span className="teams-section-badge">Multi-fonte</span>
          </h2>
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
