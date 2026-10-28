import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api/client'
import { useLanguage } from '../context/LanguageContext'
import { iconUrl } from '../config'
import type { CharacterDetail } from '../types'

export default function CharacterDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const { lang } = useLanguage()
  const [char, setChar] = useState<CharacterDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!slug) return
    setChar(null)
    setError(null)
    api.getCharacter(slug, lang).then(setChar).catch((e) => setError(String(e)))
  }, [slug, lang])

  if (error) return <p className="error">Erro: {error}</p>
  if (!char) return <p className="status">Carregando...</p>

  return (
    <div>
      <Link to="/" className="back">← Voltar</Link>
      <div className="detail-header">
        {iconUrl(char.icon) && <img className="detail-avatar" src={iconUrl(char.icon)!} alt={char.name} />}
        <div>
          <h1>{char.name}</h1>
          {char.title && <p className="subtitle">{char.title}</p>}
          <p className="meta">{'★'.repeat(char.rarity)} · {char.element} · {char.weapon_type}{char.region ? ` · ${char.region}` : ''}</p>
        </div>
      </div>
      {char.description && <p className="description">{char.description}</p>}

      <h2>Stats (nível 1)</h2>
      <table className="stats">
        <tbody>
          <tr><th>HP</th><td>{char.base_hp}</td></tr>
          <tr><th>ATK</th><td>{char.base_atk}</td></tr>
          <tr><th>DEF</th><td>{char.base_def}</td></tr>
          {char.ascension_stat && (
            <tr><th>Ascensão</th><td>{char.ascension_stat}{char.ascension_stat_value ? ` (+${char.ascension_stat_value})` : ''}</td></tr>
          )}
          {char.birthday && <tr><th>Aniversário</th><td>{char.birthday}</td></tr>}
          {char.constellation_name && <tr><th>Constelação</th><td>{char.constellation_name}</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
