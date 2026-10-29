import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import { useLanguage } from '../context/LanguageContext'
import { artifactIconUrl } from '../config'
import ArtifactTooltip from './ArtifactTooltip'
import type { ArtifactSetSummary } from '../types'

export default function ArtifactPickerModal({
  onSelect,
  onClose,
  title = 'Escolher artefato',
}: {
  onSelect: (artifact: ArtifactSetSummary) => void
  onClose: () => void
  title?: string
}) {
  const { lang } = useLanguage()
  const [artifacts, setArtifacts] = useState<ArtifactSetSummary[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.listArtifacts(lang, { rarity: 5, limit: 100 })
      .then((d) => setArtifacts(d.items))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [lang])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q ? artifacts.filter((a) => a.name.toLowerCase().includes(q)) : artifacts
  }, [artifacts, search])

  return (
    <div className="picker-overlay" onClick={onClose}>
      <div className="picker-modal" onClick={(e) => e.stopPropagation()}>
        <div className="picker-header">
          <div>
            <div className="picker-title">{title}</div>
            <div className="picker-subtitle">Sets 5★ · ESC fecha</div>
          </div>
          <button className="picker-close" onClick={onClose} aria-label="Fechar">✕</button>
        </div>

        <div className="picker-search">
          <input
            type="text"
            autoFocus
            placeholder="Buscar set por nome..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="picker-search-input"
          />
        </div>

        <div className="picker-body">
          {loading && <p className="status">Carregando artefatos...</p>}
          {!loading && filtered.length === 0 && (
            <p className="status">Nenhum set encontrado.</p>
          )}
          {!loading && filtered.length > 0 && (
            <div className="picker-grid">
              {filtered.map((a) => {
                const img = artifactIconUrl(a.icon)
                return (
                  <ArtifactTooltip key={a.slug} artifact={a}>
                    <button
                      className="picker-card"
                      onClick={() => onSelect(a)}
                    >
                      <div className={`picker-card-icon rarity-${a.rarity_max}`}>
                        {img ? <img src={img} alt={a.name} loading="lazy" /> : <span>?</span>}
                      </div>
                      <div className="picker-card-name">{a.name}</div>
                      <div className="picker-card-stars">{'★'.repeat(a.rarity_max)}</div>
                    </button>
                  </ArtifactTooltip>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
