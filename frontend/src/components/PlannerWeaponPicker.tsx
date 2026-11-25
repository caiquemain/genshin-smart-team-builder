import { useEffect, useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import { iconUrl } from '../config'
import type { WeaponSummary } from '../types'

const RARITY_GRADIENTS: Record<number, string> = {
  1: 'linear-gradient(160deg,rgba(79,88,100,0.75),rgba(135,147,156,0.75))',
  2: 'linear-gradient(160deg,rgba(72,87,92,0.75),rgba(98,152,113,0.75))',
  3: 'linear-gradient(160deg,rgba(81,84,116,0.75),rgba(75,160,180,0.75))',
  4: 'linear-gradient(160deg,rgba(89,84,130,0.75),rgba(183,133,201,0.75))',
  5: 'linear-gradient(160deg,rgba(105,84,83,0.75),rgba(228,171,82,0.75))',
}

const WEAPON_TYPE_LABELS: Record<string, string> = {
  sword: 'Espada',
  claymore: 'Espadão',
  polearm: 'Lança',
  bow: 'Arco',
  catalyst: 'Catalisador',
}

export default function PlannerWeaponPicker({
  weaponsMap,
  currentSlug,
  weaponType,
  onSelect,
  onClose,
}: {
  weaponsMap: Map<string, WeaponSummary>
  currentSlug: string
  weaponType?: string
  onSelect: (slug: string) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [rarityFilter, setRarityFilter] = useState<number | 'all'>('all')
  const current = weaponsMap.get(currentSlug)
  const targetType = current?.weapon_type || weaponType

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return Array.from(weaponsMap.values())
      .filter((w) => !targetType || w.weapon_type === targetType)
      .filter((w) => (rarityFilter === 'all' ? w.rarity >= 3 || !!q : w.rarity === rarityFilter))
      .filter((w) => !q || w.name.toLowerCase().includes(q) || w.slug.includes(q))
      .sort((a, b) => {
        if (b.rarity !== a.rarity) return b.rarity - a.rarity
        return a.name.localeCompare(b.name)
      })
  }, [weaponsMap, targetType, rarityFilter, query])

  return (
    <div className="plan-weapon-picker-overlay" onClick={onClose}>
      <div className="plan-weapon-picker" onClick={(e) => e.stopPropagation()}>
        <div className="plan-weapon-picker-header">
          <div>
            <h3>{currentSlug ? 'Trocar arma' : 'Adicionar arma'}</h3>
            <p className="plan-weapon-picker-hint">
              {targetType
                ? `Filtrando por tipo: ${WEAPON_TYPE_LABELS[targetType] ?? targetType} (${filtered.length})`
                : `Mostrando todos os tipos (${filtered.length})`}
            </p>
          </div>
          <button onClick={onClose} className="plan-modal-close">
            <X size={18} />
          </button>
        </div>
        <div className="plan-weapon-picker-search">
          <Search size={16} />
          <input
            autoFocus
            placeholder="Buscar arma..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="plan-weapon-picker-rarities">
          {(['all', 5, 4, 3] as const).map((r) => (
            <button
              key={String(r)}
              type="button"
              className={`plan-weapon-rarity-pill ${rarityFilter === r ? 'is-active' : ''} ${r !== 'all' ? `is-r${r}` : ''}`}
              onClick={() => setRarityFilter(r)}
            >
              {r === 'all' ? 'Todas (5★–3★)' : `${r}★`}
            </button>
          ))}
        </div>
        <div className="plan-weapon-picker-grid">
          {filtered.map((w) => (
            <button
              key={w.slug}
              className={`plan-weapon-picker-item ${w.slug === currentSlug ? 'is-current' : ''}`}
              onClick={() => { onSelect(w.slug); onClose() }}
            >
              <div className="plan-weapon-picker-icon" style={{ background: RARITY_GRADIENTS[w.rarity] }}>
                {iconUrl(w.icon) ? <img src={iconUrl(w.icon)!} alt={w.name} /> : <span>?</span>}
              </div>
              <div className="plan-weapon-picker-name">{w.name}</div>
              <div className="plan-weapon-picker-stars">{'★'.repeat(w.rarity)}</div>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="plan-weapon-picker-empty">Nenhuma arma encontrada.</p>
          )}
        </div>
      </div>
    </div>
  )
}
