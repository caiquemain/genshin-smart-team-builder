import { useEffect, useState } from 'react'
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
      <div className="picker-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600 }}>
        <div className="picker-header">
          <div>
            <div className="picker-title">Substituir {currentCharName}</div>
            <div className="picker-subtitle">Alternativas recomendadas para este slot</div>
          </div>
          <button className="picker-close" onClick={onClose} aria-label="Fechar">✕</button>
        </div>

        <div className="picker-body">
          {loading ? (
            <p className="status">Carregando...</p>
          ) : substitutes.filter(s => s.character_slug !== currentCharSlug).length === 0 ? (
            <p className="status">Nenhuma alternativa curada para este personagem.</p>
          ) : (
            <div className="substitute-list">
              {substitutes.filter(s => s.character_slug !== currentCharSlug).map((sub, i) => {
                const char = sub.character_slug ? chars.get(sub.character_slug) : null
                const img = char ? iconUrl(char.icon) : null
                return (
                  <div key={i} className="substitute-card">
                    <div className="substitute-card-header">
                      <div className={`member-avatar rarity-${char?.rarity ?? 4}`} style={{ width: 48, height: 48 }}>
                        {img ? <img src={img} alt={char?.name} /> : <span>?</span>}
                      </div>
                      <div className="substitute-card-info">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <h4 style={{ margin: 0, fontSize: 16 }}>{char?.name ?? 'Desconhecido'}</h4>
                          {sub.build_label && <span className="badge-build-label">{sub.build_label}</span>}
                        </div>
                        {sub.notes && <p className="substitute-card-notes">{sub.notes}</p>}
                      </div>
                    </div>
                    <button
                      className="btn-primary"
                      style={{ width: '100%', marginTop: 12 }}
                      onClick={() => {
                        if (sub.character_slug) onSelect(sub.character_slug)
                      }}
                      disabled={!sub.character_slug}
                    >
                      Aplicar {char?.name}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="picker-footer">
          <button className="btn-secondary" onClick={onFallback}>
            🔍 Procurar outro personagem...
          </button>
        </div>
      </div>
    </div>
  )
}
