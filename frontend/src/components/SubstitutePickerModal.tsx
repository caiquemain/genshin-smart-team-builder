import { useEffect, useState } from 'react'
import { Search, X } from 'lucide-react'
import { useLanguage } from '../context/LanguageContext'
import { api } from '../api/client'
import { iconUrl } from '../config'
import type { CharacterSummary, Substitute } from '../types'

export default function SubstitutePickerModal({
  substitutes,
  onSelect,
  onFallback,
  onClose,
  currentCharName,
  currentCharSlug
}: {
  substitutes: Substitute[]
  onSelect: (slug: string) => void
  onFallback: () => void
  onClose: () => void
  currentCharName: string
  currentCharSlug: string
}) {
  const { lang } = useLanguage()
  const [chars, setChars] = useState<Map<string, CharacterSummary>>(new Map())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.listCharacters(lang, { limit: 200 })
      .then((d) => setChars(new Map(d.items.map(c => [c.slug, c]))))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [lang])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="picker-overlay" onClick={onClose}>
      <div className="picker-modal substitute-picker-modal" onClick={(e) => e.stopPropagation()}>
        <div className="picker-header">
          <div>
            <div className="picker-title">Substituir {currentCharName}</div>
            <div className="picker-subtitle">Alternativas recomendadas para este slot</div>
          </div>
          <button className="picker-close" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        </div>

        <div className="picker-body">
          {loading ? (
            <p className="status">Carregando...</p>
          ) : substitutes.filter(s => s.character_slug !== currentCharSlug).length === 0 ? (
            <p className="status">Nenhuma alternativa curada para este personagem.</p>
          ) : (
            <div className="substitute-grid">
              {substitutes.filter(s => s.character_slug !== currentCharSlug).map((sub, i) => {
                const char = sub.character_slug ? chars.get(sub.character_slug) : null
                const img = char ? iconUrl(char.icon) : null
                return (
                  <div key={i} className={`substitute-card ${sub.character_slug === currentCharSlug ? 'current-char' : ''}`} style={{ animationDelay: `${i * 0.05}s` }}>
                    <div className="card-glow"></div>
                    <div className="substitute-card-portrait">
                      <div className={`portrait-bg rarity-bg-${char?.rarity ?? 4}`}>
                        {img ? <img src={img} alt={char?.name} /> : <span>?</span>}
                      </div>
                    </div>
                    <div className="substitute-card-content">
                      <div className="substitute-card-title">
                        <h4>{char?.name ?? 'Desconhecido'}</h4>
                        <span className="stars" style={{ color: `var(--rarity-${char?.rarity ?? 4})` }}>
                          {'★'.repeat(char?.rarity ?? 4)}
                        </span>
                      </div>
                      {sub.build_label && <span className="badge-build-label">{sub.build_label}</span>}
                      {sub.notes && <p className="substitute-card-notes">{sub.notes}</p>}
                      
                      <button
                        className="btn-primary apply-btn"
                        onClick={() => {
                          if (sub.character_slug) onSelect(sub.character_slug)
                        }}
                        disabled={!sub.character_slug}
                      >
                        Selecionar
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="picker-footer">
          <button className="btn-secondary" onClick={onFallback}>
            <Search size={16} /> Procurar outro personagem...
          </button>
        </div>
      </div>
    </div>
  )
}
