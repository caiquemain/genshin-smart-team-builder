import { X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import { useLanguage } from '../context/LanguageContext'
import { iconUrl } from '../config'
import type { CharacterSummary } from '../types'

export default function CharacterPickerModal({
  onSelect,
  onClose,
  excludeSlug,
  title = 'Escolher personagem',
}: {
  onSelect: (character: CharacterSummary) => void
  onClose: () => void
  excludeSlug?: string
  title?: string
}) {
  const { lang } = useLanguage()
  const [characters, setCharacters] = useState<CharacterSummary[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.listCharacters(lang, { limit: 200 })
      .then((d) => setCharacters(d.items))
      .catch((e) => console.error(e))
      .finally(() => setLoading(false))
  }, [lang])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = characters
    if (excludeSlug) list = list.filter((c) => c.slug !== excludeSlug)
    if (q) list = list.filter((c) => c.name.toLowerCase().includes(q))
    return [...list].sort((a, b) => b.rarity - a.rarity || a.name.localeCompare(b.name))
  }, [characters, search, excludeSlug])

  return (
    <div className="picker-overlay" onClick={onClose}>
      <div className="picker-modal" onClick={(e) => e.stopPropagation()}>
        <div className="picker-header">
          <div>
            <div className="picker-title">{title}</div>
            <div className="picker-subtitle">ESC fecha</div>
          </div>
          <button className="picker-close" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        </div>
        <div className="picker-search">
          <input
            type="text"
            autoFocus
            placeholder="Buscar personagem..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="picker-search-input"
          />
        </div>
        <div className="picker-body">
          {loading && <p className="status">Carregando...</p>}
          {!loading && filtered.length === 0 && <p className="status">Nenhum personagem.</p>}
          {!loading && filtered.length > 0 && (
            <div className="picker-grid">
              {filtered.map((c) => {
                const img = iconUrl(c.icon)
                return (
                  <button
                    key={c.slug}
                    className="picker-card"
                    onClick={() => onSelect(c)}
                  >
                    <div className={`picker-card-icon rarity-${c.rarity}`}>
                      {img ? <img src={img} alt={c.name} loading="lazy" /> : <span>?</span>}
                    </div>
                    <div className="picker-card-name">{c.name}</div>
                    <div className="picker-card-stars">{'★'.repeat(c.rarity)}</div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
