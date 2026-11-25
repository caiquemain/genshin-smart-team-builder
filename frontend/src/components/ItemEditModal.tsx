import { useEffect, useState } from 'react'
import { X, Check, Minus, Plus } from 'lucide-react'
import { iconUrl } from '../config'

const RARITY_GRADIENTS: Record<number, string> = {
  1: 'linear-gradient(160deg,rgba(79,88,100,0.75) 0%,rgba(95,102,115,0.75) 39%,rgba(135,147,156,0.75) 100%)',
  2: 'linear-gradient(160deg,rgba(72,87,92,0.75) 0%,rgba(72,107,103,0.75) 39%,rgba(98,152,113,0.75) 100%)',
  3: 'linear-gradient(160deg,rgba(81,84,116,0.75) 0%,rgba(80,104,135,0.75) 39%,rgba(75,160,180,0.75) 100%)',
  4: 'linear-gradient(160deg,rgba(89,84,130,0.75) 0%,rgba(120,102,157,0.75) 39%,rgba(183,133,201,0.75) 100%)',
  5: 'linear-gradient(160deg,rgba(105,84,83,0.75) 0%,rgba(161,112,78,0.75) 39%,rgba(228,171,82,0.75) 100%)',
}

const QUICK_ADD_STEPS = [1, 2, 3, 5, 10, 20]

export default function ItemEditModal({
  name,
  icon,
  rarity,
  currentQty,
  maxGlobal,
  onSave,
  onClose,
}: {
  name: string
  icon: string | null
  rarity: number | null
  currentQty: number
  maxGlobal: number
  onSave: (qty: number) => void
  onClose: () => void
}) {
  const [qty, setQty] = useState(currentQty)
  const [customAdd, setCustomAdd] = useState('')

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const delta = qty - currentQty

  const applyCustomAdd = () => {
    const n = parseInt(customAdd, 10)
    if (!Number.isFinite(n) || n === 0) return
    setQty((prev) => Math.max(0, prev + n))
    setCustomAdd('')
  }

  return (
    <div className="plan-modal-overlay" onClick={onClose}>
      <div className="plan-modal" style={{ maxWidth: '420px' }} onClick={e => e.stopPropagation()}>
        
        <div className="plan-modal-header">
          <div className="plan-modal-header-info">
            <h2 className="plan-modal-name" style={{ fontSize: 18 }}>Editar Quantidade</h2>
          </div>
          <div className="plan-modal-header-actions">
            <button className="plan-modal-close" onClick={onClose} title="Fechar (Esc)"><X size={20} /></button>
          </div>
        </div>

        <div className="plan-modal-body" style={{ display: 'block', padding: 24 }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, background: 'var(--surface-2)', padding: 14, borderRadius: 8 }}>
            <div style={{ width: 60, height: 60, background: RARITY_GRADIENTS[rarity ?? 1], borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {iconUrl(icon) ? <img src={iconUrl(icon)!} alt={name} style={{ width: 46, height: 46 }} /> : <span>?</span>}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 'bold', fontSize: 16, color: 'var(--text-1)' }}>{name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span>Teto Global: {maxGlobal > 0 ? maxGlobal : '?'}</span>
                {delta !== 0 && (
                  <span style={{ color: delta > 0 ? '#4ade80' : '#f87171', fontWeight: 700 }}>
                    ({delta > 0 ? `+${delta}` : delta})
                  </span>
                )}
              </div>
            </div>
          </div>

          <label style={{ display: 'block', marginBottom: 8, fontSize: 13, color: 'var(--text-2)', fontWeight: 600 }}>
            Quantidade Atual
          </label>
          <div className="plan-modal-level-controls" style={{ marginBottom: 14 }}>
            <button type="button" className="plan-level-step" onClick={() => setQty(Math.max(0, qty - 1))} title="-1">
              <Minus size={16} />
            </button>
            <input 
              type="number" 
              min={0} 
              value={qty} 
              onChange={e => setQty(Math.max(0, parseInt(e.target.value) || 0))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  onSave(qty)
                }
              }}
            />
            <button type="button" className="plan-level-step" onClick={() => setQty(qty + 1)} title="+1">
              <Plus size={16} />
            </button>
          </div>

          <div className="plan-modal-milestones" style={{ marginBottom: 20 }}>
            {[0, 10, 100, 500, 1000, 5000].map(val => (
              <button 
                key={val} 
                type="button" 
                className={`plan-modal-milestone ${qty === val ? 'active' : ''}`} 
                onClick={() => setQty(val)}
              >
                {val}
              </button>
            ))}
          </div>

          {/* Adição rápida (soma sobre a quantidade atual) */}
          <div className="item-quick-add-box">
            <span className="item-quick-add-label">Adicionar rapidamente ao estoque</span>
            <div className="item-quick-add-pills">
              {QUICK_ADD_STEPS.map((step) => (
                <button
                  key={step}
                  type="button"
                  className="item-quick-add-pill"
                  onClick={() => setQty((prev) => prev + step)}
                >
                  +{step}
                </button>
              ))}
            </div>
            <div className="item-quick-add-custom">
              <input
                type="number"
                placeholder="Somar outra qtd (ex.: 14)"
                value={customAdd}
                onChange={(e) => setCustomAdd(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    applyCustomAdd()
                  }
                }}
              />
              <button
                type="button"
                className="item-quick-add-apply"
                onClick={applyCustomAdd}
                disabled={!customAdd || Number(customAdd) === 0}
              >
                <Plus size={14} /> Somar
              </button>
            </div>
          </div>

          <button 
            type="button"
            className="btn-primary" 
            style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: 8, marginTop: 18 }}
            onClick={() => onSave(qty)}
          >
            <Check size={16} /> Salvar
          </button>

        </div>
      </div>
    </div>
  )
}

