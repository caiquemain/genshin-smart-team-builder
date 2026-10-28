import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { useLanguage } from '../context/LanguageContext'
import { iconUrl } from '../config'
import type { TeamDetail } from '../types'

export default function TeamsPage() {
  const { lang } = useLanguage()
  const [teams, setTeams] = useState<TeamDetail[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    api.listTeams(lang).then((d) => setTeams(d.items)).catch((e) => setError(String(e)))
  }

  useEffect(() => { load() }, [lang])

  const handleDelete = async (id: number) => {
    if (!confirm('Apagar este time?')) return
    try {
      await api.deleteTeam(id)
      setTeams((prev) => prev?.filter((t) => t.id !== id) ?? null)
    } catch (e) {
      setError(String(e))
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Times</h1>
        <Link to="/teams/new" className="btn-primary">+ Novo time</Link>
      </div>

      {error && <p className="error">Erro: {error}</p>}
      {!teams && !error && <p className="status">Carregando...</p>}
      {teams && teams.length === 0 && (
        <p className="status">Nenhum time criado ainda. <Link to="/teams/new">Crie o primeiro</Link>.</p>
      )}

      {teams && teams.length > 0 && (
        <div className="teams-grid">
          {teams.map((t) => (
            <div key={t.id} className="team-card">
              <div className="team-card-header">
                <div>
                  <h3>{t.name}</h3>
                  {t.author_name && <p className="team-author">por {t.author_name}</p>}
                </div>
                <button
                  className="btn-danger"
                  onClick={() => handleDelete(t.id)}
                  aria-label="Apagar time"
                >
                  ✕
                </button>
              </div>
              {t.description && <p className="team-desc">{t.description}</p>}
              <div className="team-members">
                {t.members.map((m) => {
                  const img = iconUrl(m.character.icon)
                  return (
                    <Link
                      key={m.position}
                      to={`/characters/${m.character.slug}`}
                      className="team-member"
                      title={m.character.name}
                    >
                      {img ? <img src={img} alt={m.character.name} /> : <span>?</span>}
                      <span className="team-member-name">{m.character.name}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
