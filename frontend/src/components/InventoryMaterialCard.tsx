import { useState, useEffect } from 'react';
import { CheckCircle2, Minus, Plus } from 'lucide-react';
import { MaterialLike } from '../utils/inventory-mapper';
import { pickLang } from '../utils/planner-data';
import { useLanguage } from '../context/LanguageContext';
import { iconUrl } from '../config';

interface Props {
  material: MaterialLike & { slug: string };
  currentQty: number;
  targetQty: number;
  onUpdateQty: (slug: string, qty: number) => void;
}

function getDisplayName(name: MaterialLike['name'], lang: string, fallback: string): string {
  if (!name) return fallback;
  if (typeof name === 'string') return name;
  return pickLang(name, lang) || fallback;
}

export function InventoryMaterialCard({ material, currentQty, targetQty, onUpdateQty }: Props) {
  const { lang } = useLanguage();
  const [inputValue, setInputValue] = useState(currentQty.toString());

  useEffect(() => {
    setInputValue(currentQty.toString());
  }, [currentQty]);

  const handleBlur = () => {
    const val = parseInt(inputValue) || 0;
    if (val !== currentQty) {
      onUpdateQty(material.slug, val);
    }
  };

  const handleStep = (delta: number) => {
    const newVal = Math.max(0, currentQty + delta);
    onUpdateQty(material.slug, newVal);
  };

  const percentage = targetQty > 0 ? Math.min((currentQty / targetQty) * 100, 100) : 0;
  const isComplete = targetQty > 0 && currentQty >= targetQty;
  const missing = targetQty > currentQty ? targetQty - currentQty : 0;

  let barColor = '#ef4444';
  if (percentage >= 100) barColor = '#22c55e';
  else if (percentage > 0) barColor = '#eab308';

  const displayName = getDisplayName(material.name, lang, material.slug);
  const iconSrc = iconUrl(material.icon);
  const cardClass = targetQty === 0 ? 'opacity-50' : '';

  return (
    <div className={`ascension-item ${isComplete ? 'item-complete' : (targetQty > 0 ? 'item-partial' : '')} ${cardClass}`} style={{ position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '12px' }}>
      
      <div style={{ display: 'flex', width: '100%', alignItems: 'center', gap: '12px' }}>
        
        {/* Ícone */}
        <div className="ascension-icon" style={{ width: '48px', height: '48px', flexShrink: 0 }}>
          {iconSrc ? (
            <img src={iconSrc} alt={material.slug} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          ) : (
            <span style={{ color: '#888' }}>?</span>
          )}
        </div>

        {/* Nome e Meta */}
        <div className="ascension-info" style={{ flex: 1, minWidth: 0 }}>
          <div className="ascension-name" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {displayName}
            {isComplete && <CheckCircle2 size={14} color="#22c55e" style={{ marginLeft: 4, display: 'inline', verticalAlign: 'middle' }} />}
          </div>
          <div className="ascension-meta" style={{ fontSize: '12px', color: 'var(--text-3)', display: 'flex', gap: '6px', alignItems: 'center', marginTop: '2px' }}>
            <span className="stars" style={{ color: '#e0a647' }}>{'★'.repeat(material.rarity || 1)}</span>
            {targetQty > 0 && (
              <span>Meta: {targetQty}</span>
            )}
          </div>
        </div>

        {/* Controles de Edição (+ / -) */}
        <div style={{ display: 'flex', alignItems: 'center', border: '1px solid rgba(179, 152, 255, 0.5)', borderRadius: '6px', overflow: 'hidden', background: 'rgba(0,0,0,0.3)', flexShrink: 0 }}>
          <button onClick={() => handleStep(-1)} style={{ padding: '6px 8px', background: 'rgba(255,255,255,0.05)', border: 'none', color: 'var(--text-1)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <Minus size={14} />
          </button>
          
          <input
            type="number"
            min="0"
            style={{ 
              width: '50px', textAlign: 'center', background: 'transparent', color: 'white',
              border: 'none', borderLeft: '1px solid rgba(179, 152, 255, 0.2)', borderRight: '1px solid rgba(179, 152, 255, 0.2)',
              padding: '6px 0', fontSize: '13px', fontWeight: 'bold', outline: 'none'
            }}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={(e) => e.key === 'Enter' && handleBlur()}
          />
          
          <button onClick={() => handleStep(1)} style={{ padding: '6px 8px', background: 'rgba(255,255,255,0.05)', border: 'none', color: 'var(--text-1)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <Plus size={14} />
          </button>
        </div>
      </div>

      {/* Barra de Progresso */}
      {targetQty > 0 && (
        <div style={{ width: '100%', height: '6px', background: 'rgba(0,0,0,0.4)', borderRadius: '3px', marginTop: '12px', overflow: 'hidden' }}>
          <div style={{ width: `${percentage}%`, height: '100%', backgroundColor: barColor, transition: 'width 0.3s ease' }} />
        </div>
      )}
      
      {/* Badge de Faltando */}
      {targetQty > 0 && !isComplete && (
        <div style={{ position: 'absolute', top: 8, right: 12, fontSize: '11px', color: '#ef4444', fontWeight: 'bold' }}>
          falta {missing}
        </div>
      )}
    </div>
  );
}
