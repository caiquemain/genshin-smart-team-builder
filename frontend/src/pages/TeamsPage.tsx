import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Trash2, ArrowRight, Plus, Swords, Users } from 'lucide-react'
import { api } from '../api/client'
import { useLanguage } from '../context/LanguageContext'
import { iconUrl } from '../config'
import { archetypeInfo } from '../utils/archetypes'
import TeamTierBadge from '../components/TeamTierBadge'
import type { TeamDetail, TeamTemplateSummary, CharacterSummary } from '../types'

const ARCHETYPE_ORDER = [
  'hyperbloom', 'bloom', 'burgeon', 'quicken', 'aggravate', 'spread',
  'vaporize', 'melt', 'freeze', 'overload', 'superconduct',
  'hypercarry', 'national',
]

function TeamTemplateCard({
  template,
  chars,
}: {
  template: TeamTemplateSummary
  chars: Map<string, CharacterSummary>
}) {
  const arch = archetypeInfo(template.archetype)
  return (
    <div className="template-card" style={{ borderLeftColor: arch.color }}>
      <div className="template-card-header">
        <div className="template-card-arch" style={{ background: `${arch.color}20`, color: arch.color }}>
          {arch.emoji} {arch.label}
        </div>
      </div>
      <Link to={`/teams/templates/${template.id}`} className="template-card-name">
        {template.name}
      </Link>
      {template.description && (
        <p className="template-card-desc">{template.description}</p>
      )}
      <div className="template-card-members">
        {template.character_slugs.map((slug) => {
          const c = chars.get(slug)
          const img = c ? iconUrl(c.icon) : null
          const isMain = slug === template.main_character
          return (
            <Link
              key={slug}
              to={`/characters/${slug}`}
              className={`template-member ${isMain ? 'template-member-main' : ''}`}
              title={c?.name ?? slug}
            >
              {img ? <img src={img} alt={c?.name ?? slug} /> : <span>?</span>}
            </Link>
          )
        })}
      </div>
      <div className="template-card-actions">
        <Link to={`/teams/templates/${template.id}`} className="btn-secondary">
          Detalhes
        </Link>
        <Link to={`/teams/new?template_id=${template.id}`} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          Usar <ArrowRight size={14} />
        </Link>
      </div>
      {template.source_url && (
        <a
          href={template.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="template-card-source"
        >
          Fonte: {template.source} ↗
        </a>
      )}
    </div>
  )
}

export default function TeamsPage() {
  const { lang } = useLanguage()
  const [teams, setTeams] = useState<TeamDetail[] | null>(null)
  const [templates, setTemplates] = useState<TeamTemplateSummary[]>([])
  const [chars, setChars] = useState<Map<string, CharacterSummary>>(new Map())
  const [error, setError] = useState<string | null>(null)

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

  const groupedTemplates = useMemo(() => {
    const groups = new Map<string, TeamTemplateSummary[]>()
    for (const t of templates) {
      const arr = groups.get(t.archetype) ?? []
      arr.push(t)
      groups.set(t.archetype, arr)
    }
    return ARCHETYPE_ORDER
      .filter((a) => groups.has(a))
      .map((a) => ({ archetype: a, items: groups.get(a)! }))
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
            Você ainda não criou nenhum time. <Link to="/teams/new">Crie o primeiro</Link> ou use um template acima.
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
                      <span
                        key={m.position}
                        className="team-member"
                        title={m.character.name}
                      >
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

      {/* === Times recomendados (KQM) === */}
      {templates.length > 0 && (
        <section className="teams-section">
          <h2 className="teams-section-title">
            Times recomendados <span className="teams-section-badge">KQM</span>
          </h2>
          <p className="teams-section-sub">
            Curados do Keqing Mains. Clique em "Usar" pra carregar no builder e editar.
          </p>

          {groupedTemplates.map((g) => {
            const arch = archetypeInfo(g.archetype)
            return (
              <div key={g.archetype} className="template-archetype-group">
                <div className="template-archetype-title">
                  <span className="template-archetype-emoji">{arch.emoji}</span>
                  <span style={{ color: arch.color }}>{arch.label}</span>
                  <span className="template-archetype-count">{g.items.length}</span>
                </div>
                <div className="templates-grid">
                  {g.items.map((t) => (
                    <TeamTemplateCard key={t.id} template={t} chars={chars} />
                  ))}
                </div>
              </div>
            )
          })}
        </section>
      )}

      
    </div>
  )
}
