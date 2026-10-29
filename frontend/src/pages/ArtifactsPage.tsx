import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { useLanguage } from '../context/LanguageContext'
import { artifactIconUrl } from '../config'
import type { ArtifactSetSummary } from '../types'

function ArtifactCard({ artifact }: { artifact: ArtifactSetSummary }) {
  const img = artifactIconUrl(artifact.icon)
  return (
    <Link
      to={`/artifacts/${artifact.slug}`}
      className={`artifact-card rarity-${artifact.rarity_max}`}
    >
      <div className="artifact-card-icon">
        {img ? <img src={img} alt={artifact.name} loading="lazy" /> : <span>?</span>}
      </div>
      <div className="artifact-card-name">{artifact.name}</div>
      <div className="artifact-card-rarity">{'★'.repeat(artifact.rarity_max)}</div>
    </Link>
  )
}

export default function ArtifactsPage() {
  const { lang } = useLanguage()
  const [artifacts, setArtifacts] = useState<ArtifactSetSummary[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    setLoading(true)
    api.listArtifacts(lang, { limit: 100 })
      .then((d) => { setArtifacts(d.items); setError(null) })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [lang])

  const filtered = useMemo(() => {
    if (!search.trim()) return artifacts
    const q = search.toLowerCase()
    return artifacts.filter((a) => a.name.toLowerCase().includes(q))
  }, [artifacts, search])

  return (
    <div>
      <h1>Artefatos</h1>
      <p className="status">
        {filtered.length} conjunto(s) — de onde vem bônus 2pc e 4pc
      </p>

      <div className="filters">
        <input
          type="text"
          placeholder="Buscar artefato..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="filter-search"
        />
      </div>

      {loading && <p className="status">Carregando...</p>}
      {error && <p className="error">Erro: {error}</p>}

      {!loading && !error && (
        <div className="artifacts-grid">
          {filtered.map((a) => <ArtifactCard key={a.slug} artifact={a} />)}
        </div>
      )}
    </div>
  )
}
