import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Star, Sparkles } from 'lucide-react'
import { api } from '../api/client'
import { useLanguage } from '../context/LanguageContext'
import { artifactIconUrl } from '../config'
import ArtifactTooltip from '../components/ArtifactTooltip'
import type { ArtifactSetSummary } from '../types'

function ArtifactCard({ artifact }: { artifact: ArtifactSetSummary }) {
  const img = artifactIconUrl(artifact.icon)
  const rarityColor = artifact.rarity_max === 5 ? '#e0a647' : artifact.rarity_max === 4 ? '#a35bd8' : '#5a8fd8'

  const card = (
    <Link
      to={`/artifacts/${artifact.slug}`}
      className="artifact-card"
      style={{ '--rarity-color': rarityColor } as React.CSSProperties}
    >
      <div className="artifact-card-glow" />
      <div className="artifact-card-rarity">{'★'.repeat(artifact.rarity_max)}</div>
      <div className="artifact-card-icon">
        {img ? <img src={img} alt={artifact.name} loading="lazy" /> : <span>?</span>}
      </div>
      <div className="artifact-card-name">{artifact.name}</div>
      <div className="artifact-card-bonuses">
        {artifact.two_piece_bonus && (
          <div className="artifact-card-bonus">
            <span className="artifact-bonus-badge">2pc</span>
            <span className="artifact-bonus-text">{artifact.two_piece_bonus}</span>
          </div>
        )}
      </div>
    </Link>
  )

  return <ArtifactTooltip artifact={artifact}>{card}</ArtifactTooltip>
}

export default function ArtifactsPage() {
  const { lang } = useLanguage()
  const [artifacts, setArtifacts] = useState<ArtifactSetSummary[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [rarity, setRarity] = useState('')

  useEffect(() => {
    setLoading(true)
    api.listArtifacts(lang, { limit: 100 })
      .then((d) => { setArtifacts(d.items); setError(null) })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [lang])

  const filtered = useMemo(() => {
    let list = artifacts
    if (rarity) list = list.filter((a) => String(a.rarity_max) === rarity)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((a) => a.name.toLowerCase().includes(q))
    }
    return list
  }, [artifacts, search, rarity])

  return (
    <div>
      <h1>Artefatos</h1>

      <div className="premium-filters">
        {/* Busca */}
        <div className="filter-group" style={{ flex: '1 1 300px', maxWidth: 400 }}>
          <span className="filter-label">Buscar</span>
          <div className="premium-search">
            <Search size={16} />
            <input
              type="text"
              placeholder="Buscar conjunto pelo nome..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Raridade */}
        <div className="filter-group">
          <span className="filter-label">Raridade Máx.</span>
          <div className="filter-pills">
            {['5', '4', '3'].map((r) => {
              const isActive = rarity === r
              const color = r === '5' ? '#e0a647' : r === '4' ? '#a35bd8' : '#5a8fd8'
              return (
                <button
                  key={r}
                  className={`filter-pill ${isActive ? 'active' : ''}`}
                  style={{ '--pill-color': color } as React.CSSProperties}
                  onClick={() => setRarity(isActive ? '' : r)}
                >
                  <Star size={16} fill={isActive ? 'currentColor' : 'none'} />
                  {r}★
                </button>
              )
            })}
          </div>
        </div>

        {(rarity || search) && (
          <button
            className="clear-filters-btn"
            onClick={() => { setRarity(''); setSearch('') }}
          >
            Limpar Filtros
          </button>
        )}
      </div>

      {loading && <p className="status">Carregando...</p>}
      {error && <p className="error">Erro: {error}</p>}

      {!loading && !error && (
        <>
          <p className="status">
            <Sparkles size={14} style={{ display: 'inline', marginRight: 6 }} />
            {filtered.length} conjunto(s) — bônus 2pc e 4pc
          </p>
          <div className="artifacts-grid">
            {filtered.map((a) => <ArtifactCard key={a.slug} artifact={a} />)}
          </div>
        </>
      )}
    </div>
  )
}
