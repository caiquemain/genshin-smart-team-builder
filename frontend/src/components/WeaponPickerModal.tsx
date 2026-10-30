import { X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import { useLanguage } from '../context/LanguageContext'
import { iconUrl } from '../config'
import WeaponTooltip from './WeaponTooltip'
import type { CharacterSummary, WeaponSummary } from '../types'

export default function WeaponPickerModal({
  character,
  onSelect,
  onClose,
}: {
  character: CharacterSummary
  onSelect: (weapon: WeaponSummary) => void
  onClose: () => void
}) {
  const { lang } = useLanguage()
  const [weapons, setWeapons] = useState<WeaponSummary[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.listWeapons(lang, { weapon_type: character.weapon_type, limit: 200 })
      .then((d) => setWeapons(d.items))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [lang, character.weapon_type])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = weapons
    if (q) list = list.filter((w) => w.name.toLowerCase().includes(q))
    // Ordena por raridade desc, depois nome
    return [...list].sort((a, b) => b.rarity - a.rarity || a.name.localeCompare(b.name))
  }, [weapons, search])

  return (
    <div className="picker-overlay" onClick={onClose}>
      <div className="picker-modal" onClick={(e) => e.stopPropagation()}>
        <div className="picker-header">
          <div>
            <div className="picker-title">Escolher arma</div>
            <div className="picker-subtitle">
              Mostrando apenas <strong>{character.weapon_type}</strong> · ESC fecha
            </div>
          </div>
          <button className="picker-close" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        </div>

        <div className="picker-search">
          <input
            type="text"
            autoFocus
            placeholder="Buscar arma por nome..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="picker-search-input"
          />
        </div>

        <div className="picker-body">
          {loading && <p className="status">Carregando armas...</p>}
          {!loading && filtered.length === 0 && (
            <p className="status">Nenhuma arma encontrada.</p>
          )}
          {!loading && filtered.length > 0 && (
            <div className="picker-grid">
              {filtered.map((w) => {
                const img = iconUrl(w.icon)
                return (
                  <WeaponTooltip key={w.slug} weapon={w}>
                    <button
                      className="picker-card"
                      onClick={() => onSelect(w)}
                    >
                      <div className={`picker-card-icon rarity-${w.rarity}`}>
                        {img ? <img src={img} alt={w.name} loading="lazy" /> : <span>?</span>}
                      </div>
                      <div className="picker-card-name">{w.name}</div>
                      <div className="picker-card-stars">{'★'.repeat(w.rarity)}</div>
                    </button>
                  </WeaponTooltip>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
