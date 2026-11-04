import { useState, useMemo } from 'react'
import { X, Search, Plus, Minus, Check } from 'lucide-react'
import { iconUrl } from '../config'
import { useLanguage } from '../context/LanguageContext'
import { pickLang, type PlannerData } from '../utils/planner-data'
import { categoryInfo } from '../utils/categories'

const RARITY_GRADIENTS: Record<number, string> = {
  1: 'linear-gradient(160deg,rgba(79,88,100,0.75) 0%,rgba(95,102,115,0.75) 39%,rgba(135,147,156,0.75) 100%)',
  2: 'linear-gradient(160deg,rgba(72,87,92,0.75) 0%,rgba(72,107,103,0.75) 39%,rgba(98,152,113,0.75) 100%)',
  3: 'linear-gradient(160deg,rgba(81,84,116,0.75) 0%,rgba(80,104,135,0.75) 39%,rgba(75,160,180,0.75) 100%)',
  4: 'linear-gradient(160deg,rgba(89,84,130,0.75) 0%,rgba(120,102,157,0.75) 39%,rgba(183,133,201,0.75) 100%)',
  5: 'linear-gradient(160deg,rgba(105,84,83,0.75) 0%,rgba(161,112,78,0.75) 39%,rgba(228,171,82,0.75) 100%)',
}

export default function InventoryEditorModal({
  inventory,
  data,
  onSave,
  onClose,
}: {
  inventory: Record<string, number>
  data: PlannerData
  onSave: (newInventory: Record<string, number>) => void
  onClose: () => void
}) {
  const { lang } = useLanguage()
  const [draft, setDraft] = useState<Record<string, number>>({ ...inventory })
  const [query, setQuery] = useState('')
  const [filterCategory, setFilterCategory] = useState('all')

  const categories = useMemo(() => {
    const cats = new Set<string>()
    Object.values(data.materials).forEach(m => cats.add(m.category))
    return Array.from(cats).sort()
  }, [data])

  const filteredMaterials = useMemo(() => {
    return Object.entries(data.materials)
      .filter(([slug, m]) => {
        const name = pickLang(m.name, lang).toLowerCase()
        if (query && !name.includes(query.toLowerCase()) && !slug.includes(query.toLowerCase())) return false
        if (filterCategory !== 'all' && m.category !== filterCategory) return false
        return true
      })
      .sort((a, b) => {
        const nameA = pickLang(a[1].name, lang)
        const nameB = pickLang(b[1].name, lang)
        return nameA.localeCompare(nameB)
      })
  }, [data, query, filterCategory, lang])

  const updateQty = (slug: string, delta: number) => {
    setDraft(prev => {
      const current = prev[slug] ?? 0
      const next = Math.max(0, current + delta)
      return { ...prev, [slug]: next }
    })
  }

  const handleSave = () => {
    onSave(draft)
  }

  return (
    <div className="plan-modal-overlay" onClick={onClose}>
      <div className="plan-modal" style={{ maxWidth: '900px', height: '85vh' }} onClick={e => e.stopPropagation()}>
        
        <div className="plan-modal-header">
          <div className="plan-modal-header-info">
            <h2 className="plan-modal-name">Inventário</h2>
            <div className="plan-modal-meta">
              <span>{filteredMaterials.length} itens encontrados</span>
            </div>
          </div>
          <div className="plan-modal-header-actions">
            <button className="btn-primary" onClick={handleSave}>
              <Check size={14} /> Salvar
            </button>
            <button className="plan-modal-close" onClick={onClose}><X size={20} /></button>
          </div>
        </div>

        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 12 }}>
          <div className="plan-weapon-picker-search" style={{ flex: 1, margin: 0 }}>
            <Search size={16} />
            <input
              autoFocus
              placeholder="Buscar item..."
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
          <select 
            className="planner-filter-select"
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
          >
            <option value="all">Todas as categorias</option>
            {categories.map(c => (
              <option key={c} value={c}>{categoryInfo(c).label}</option>
            ))}
          </select>
        </div>

        <div className="plan-modal-body" style={{ display: 'block', overflowY: 'auto', flex: 1, padding: '16px 24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
            {filteredMaterials.map(([slug, m]) => {
              const qty = draft[slug] ?? 0
              const img = iconUrl(m.icon)
              return (
                <div key={slug} className="plan-modal-mat-row" style={{ padding: '8px 12px', background: 'var(--surface-1)', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div className="plan-modal-mat-icon" style={{ background: RARITY_GRADIENTS[m.rarity ?? 1], width: 40, height: 40 }}>
                    {img ? <img src={img} alt={m.name.en} /> : <span>?</span>}
                  </div>
                  <div className="plan-modal-mat-info" style={{ flex: 1, minWidth: 0 }}>
                    <div className="plan-modal-mat-name" style={{ fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {pickLang(m.name, lang)}
                    </div>
                    <div className="plan-modal-mat-qty" style={{ fontSize: 11, color: 'var(--text-3)' }}>
                      {categoryInfo(m.category).label}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button className="btn-secondary" style={{ padding: '2px 6px' }} onClick={() => updateQty(slug, -1)} disabled={qty <= 0}>
                      <Minus size={12} />
                    </button>
                    <input 
                      type="number" 
                      className="planner-filter-select" 
                      style={{ width: 60, textAlign: 'center', padding: '2px 4px', fontSize: 13 }}
                      value={qty}
                      onChange={(e) => setDraft({ ...draft, [slug]: Math.max(0, parseInt(e.target.value) || 0) })}
                    />
                    <button className="btn-secondary" style={{ padding: '2px 6px' }} onClick={() => updateQty(slug, 1)}>
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

      </div>
    </div>
  )
}