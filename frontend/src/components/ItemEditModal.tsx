import { useState } from 'react'
import { X, Check, Minus, Plus } from 'lucide-react'
import { iconUrl } from '../config'

const RARITY_GRADIENTS: Record<number, string> = {
  1: 'linear-gradient(160deg,rgba(79,88,100,0.75) 0%,rgba(95,102,115,0.75) 39%,rgba(135,147,156,0.75) 100%)',
  2: 'linear-gradient(160deg,rgba(72,87,92,0.75) 0%,rgba(72,107,103,0.75) 39%,rgba(98,152,113,0.75) 100%)',
  3: 'linear-gradient(160deg,rgba(81,84,116,0.75) 0%,rgba(80,104,135,0.75) 39%,rgba(75,160,180,0.75) 100%)',
  4: 'linear-gradient(160deg,rgba(89,84,130,0.75) 0%,rgba(120,102,157,0.75) 39%,rgba(183,133,201,0.75) 100%)',
  5: 'linear-gradient(160deg,rgba(105,84,83,0.75) 0%,rgba(161,112,78,0.75) 39%,rgba(228,171,82,0.75) 100%)',
}

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

  return (
    <div className="plan-modal-overlay" onClick={onClose}>
      <div className="plan-modal" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
        
        <div className="plan-modal-header">
          <div className="plan-modal-header-info">
            <h2 className="plan-modal-name" style={{ fontSize: 18 }}>Editar Quantidade</h2>
          </div>
          <div className="plan-modal-header-actions">
            <button className="plan-modal-close" onClick={onClose}><X size={20} /></button>
          </div>
        </div>

        <div className="plan-modal-body" style={{ display: 'block', padding: 24 }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32, background: 'var(--surface-2)', padding: 16, borderRadius: 8 }}>
            <div style={{ width: 64, height: 64, background: RARITY_GRADIENTS[rarity ?? 1], borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {iconUrl(icon) ? <img src={iconUrl(icon)!} alt={name} style={{ width: 48, height: 48 }} /> : <span>?</span>}
            </div>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: 16, color: 'var(--text-1)' }}>{name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
                Teto Global: {maxGlobal > 0 ? maxGlobal : '?'}
              </div>
            </div>
          </div>

          <label style={{ display: 'block', marginBottom: 8, fontSize: 14, color: 'var(--text-2)' }}>
            Quantidade Atual
          </label>
          <div className="plan-modal-level-controls" style={{ marginBottom: 24 }}>
            <button className="plan-level-step" onClick={() => setQty(Math.max(0, qty - 10))}>
              <Minus size={16} />
            </button>
            <input 
              type="number" 
              min={0} 
              value={qty} 
              onChange={e => setQty(Math.max(0, parseInt(e.target.value) || 0))}
            />
            <button className="plan-level-step" onClick={() => setQty(qty + 10)}>
              <Plus size={16} />
            </button>
          </div>
          <div className="plan-modal-milestones" style={{ marginBottom: 24 }}>
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

          <button 
            className="btn-primary" 
            style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}
            onClick={() => onSave(qty)}
          >
            <Check size={16} /> Salvar
          </button>

        </div>
      </div>
    </div>
  )
}
