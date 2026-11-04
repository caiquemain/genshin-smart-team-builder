import { useState } from 'react'
import { X, Check, Minus, Plus } from 'lucide-react'

export default function SettingsModal({
  ar,
  wl,
  onSave,
  onClose,
}: {
  ar: number
  wl: number
  onSave: (newAr: number, newWl: number) => void
  onClose: () => void
}) {
  const [draftAr, setDraftAr] = useState(ar)
  const [draftWl, setDraftWl] = useState(wl)

  return (
    <div className="plan-modal-overlay" onClick={onClose}>
      <div className="plan-modal" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
        
        <div className="plan-modal-header">
          <div className="plan-modal-header-info">
            <h2 className="plan-modal-name">Configurações da Conta</h2>
          </div>
          <div className="plan-modal-header-actions">
            <button className="plan-modal-close" onClick={onClose}><X size={20} /></button>
          </div>
        </div>

        <div className="plan-modal-body" style={{ display: 'block', padding: 24 }}>
          
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', marginBottom: 8, fontSize: 14, color: 'var(--text-2)' }}>
              Adventure Rank (AR)
            </label>
            <div className="plan-modal-level-controls">
              <button className="plan-level-step" onClick={() => setDraftAr(Math.max(1, draftAr - 1))}>
                <Minus size={16} />
              </button>
              <input 
                type="number" 
                min={1} max={60} 
                value={draftAr} 
                onChange={e => setDraftAr(Math.max(1, Math.min(60, +e.target.value || 1)))}
              />
              <button className="plan-level-step" onClick={() => setDraftAr(Math.min(60, draftAr + 1))}>
                <Plus size={16} />
              </button>
            </div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', marginBottom: 8, fontSize: 14, color: 'var(--text-2)' }}>
              World Level (WL)
            </label>
            <div className="plan-modal-level-controls">
              <button className="plan-level-step" onClick={() => setDraftWl(Math.max(0, draftWl - 1))}>
                <Minus size={16} />
              </button>
              <input 
                type="number" 
                min={0} max={9} 
                value={draftWl} 
                onChange={e => setDraftWl(Math.max(0, Math.min(9, +e.target.value || 0)))}
              />
              <button className="plan-level-step" onClick={() => setDraftWl(Math.min(9, draftWl + 1))}>
                <Plus size={16} />
              </button>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 8 }}>
              Afeta o cálculo de Ley Lines (Mora e XP).
            </p>
          </div>

          <button 
            className="btn-primary" 
            style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: 8 }}
            onClick={() => onSave(draftAr, draftWl)}
          >
            <Check size={16} /> Salvar Configurações
          </button>

        </div>
      </div>
    </div>
  )
}