import { useEffect, useState } from 'react'
import { X, Check, Minus, Plus, Zap } from 'lucide-react'
import type { ResinSpendMode } from '../utils/resin'

const RESIN_MODES: Array<{ value: ResinSpendMode; label: string; desc: string }> = [
  { value: 20, label: '20 (1x)', desc: 'Original' },
  { value: 40, label: '40 (2x)', desc: 'Direto' },
  { value: 60, label: '60 (3x)', desc: 'Condensada' },
]

export default function SettingsModal({
  ar,
  wl,
  resinMode = 20,
  onSave,
  onClose,
}: {
  ar: number
  wl: number
  resinMode?: ResinSpendMode
  onSave: (newAr: number, newWl: number, newResinMode: ResinSpendMode) => void
  onClose: () => void
}) {
  const [draftAr, setDraftAr] = useState(ar)
  const [draftWl, setDraftWl] = useState(wl)
  const [draftMode, setDraftMode] = useState<ResinSpendMode>(resinMode)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="plan-modal-overlay" onClick={onClose}>
      <div className="plan-modal" style={{ maxWidth: '420px' }} onClick={e => e.stopPropagation()}>
        
        <div className="plan-modal-header">
          <div className="plan-modal-header-info">
            <h2 className="plan-modal-name">Configurações da Conta</h2>
          </div>
          <div className="plan-modal-header-actions">
            <button type="button" className="plan-modal-close" onClick={onClose} title="Fechar (Esc)"><X size={20} /></button>
          </div>
        </div>

        <div className="plan-modal-body" style={{ display: 'block', padding: 24 }}>
          
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 8, fontSize: 14, color: 'var(--text-2)' }}>
              Adventure Rank (AR)
            </label>
            <div className="plan-modal-level-controls">
              <button type="button" className="plan-level-step" onClick={() => setDraftAr(Math.max(1, draftAr - 1))}>
                <Minus size={16} />
              </button>
              <input 
                type="number" 
                min={1} max={60} 
                value={draftAr} 
                onChange={e => setDraftAr(Math.max(1, Math.min(60, +e.target.value || 1)))}
              />
              <button type="button" className="plan-level-step" onClick={() => setDraftAr(Math.min(60, draftAr + 1))}>
                <Plus size={16} />
              </button>
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 8, fontSize: 14, color: 'var(--text-2)' }}>
              World Level (WL)
            </label>
            <div className="plan-modal-level-controls">
              <button type="button" className="plan-level-step" onClick={() => setDraftWl(Math.max(0, draftWl - 1))}>
                <Minus size={16} />
              </button>
              <input 
                type="number" 
                min={0} max={9} 
                value={draftWl} 
                onChange={e => setDraftWl(Math.max(0, Math.min(9, +e.target.value || 0)))}
              />
              <button type="button" className="plan-level-step" onClick={() => setDraftWl(Math.min(9, draftWl + 1))}>
                <Plus size={16} />
              </button>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 8 }}>
              Afeta o cálculo de Bosses Normais e Linhas Ley (Mora e XP).
            </p>
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontSize: 14, color: 'var(--text-2)' }}>
              <Zap size={14} /> Gasto padrão por run (Domínios &amp; Linhas Ley)
            </label>
            <div className="resin-mode-selector">
              {RESIN_MODES.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  className={`resin-mode-opt ${draftMode === m.value ? 'is-active' : ''}`}
                  onClick={() => setDraftMode(m.value)}
                >
                  <strong style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Zap size={12} /> {m.label}</strong>
                  <small>{m.desc}</small>
                </button>
              ))}
            </div>
            <p style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 8 }}>
              Destaca seu modo preferido nas tooltips e cards (60 resina = Resina Condensada com Núcleo de Cristal, 3x recompensas).
            </p>
          </div>

          <button 
            type="button"
            className="btn-primary" 
            style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: 8 }}
            onClick={() => onSave(draftAr, draftWl, draftMode)}
          >
            <Check size={16} /> Salvar Configurações
          </button>

        </div>
      </div>
    </div>
  )
}