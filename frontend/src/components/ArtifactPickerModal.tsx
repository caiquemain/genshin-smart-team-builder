import { X } from 'lucide-react'
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
  items,
  subtitle,
}: {
  onSelect: (artifact: ArtifactSetSummary) => void
  onClose: () => void
  title?: string
  items?: ArtifactSetSummary[]
  subtitle?: string
}) {
  const { lang } = useLanguage()
  const [artifacts, setArtifacts] = useState<ArtifactSetSummary[]>(items ?? [])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(!items || items.length === 0)

  useEffect(() => {
    if (items && items.length > 0) {
      setArtifacts(items)
      setLoading(false)
      return
    }
    setLoading(true)
    api.listArtifacts(lang, { rarity: 5, limit: 200 })
      .then((d) => setArtifacts(d.items))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [lang, items])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = q
      ? artifacts.filter((a) => a.name.toLowerCase().includes(q) || a.slug.toLowerCase().includes(q))
      : artifacts
    return [...list].sort((a, b) => b.rarity_max - a.rarity_max || a.name.localeCompare(b.name))
  }, [artifacts, search])

  return (
    <div className="picker-overlay" onClick={onClose}>
      <div className="picker-modal" onClick={(e) => e.stopPropagation()}>
        <div className="picker-header">
          <div>
            <div className="picker-title">{title}</div>
            <div className="picker-subtitle">{subtitle ?? (items ? 'Sets 5★ e 4★ · ESC fecha' : 'Sets 5★ · ESC fecha')}</div>
          </div>
          <button type="button" className="picker-close" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
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
