import { X } from 'lucide-react';
import { BestiaryMonsterIcon } from './BestiaryMonsterIcon';
import { TYPE_LABELS, TYPE_COLORS, type BestiaryMonster } from '../types/bestiary';

function formatDescription(desc: string): string {
  if (!desc) return '';
  return desc
    .replace(/\\n/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function formatRate(rate: number | null): string {
  if (rate === null || rate === 0) return 'Garantido';
  const rounded = Math.round(rate * 10) / 10;
  return `${rounded}%`;
}

interface Props {
  monster: BestiaryMonster;
  onClose: () => void;
}

export function BestiaryMonsterModal({ monster, onClose }: Props) {
  const typeLabel = TYPE_LABELS[monster.type] ?? monster.type;
  const typeColor = TYPE_COLORS[monster.type] ?? '#94a3b8';
  const desc = formatDescription(monster.description);

  return (
    <div className="bestiary-modal-overlay" onClick={onClose}>
      <div className="bestiary-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="bestiary-modal-close" onClick={onClose}>
          <X size={18} />
        </button>

        <div className="bestiary-modal-header">
          <div className="bestiary-modal-portrait">
            <BestiaryMonsterIcon icon={monster.icon} name={monster.name} />
          </div>
          <div className="bestiary-modal-title">
            <span
              className="bestiary-card-type"
              style={{ color: typeColor, borderColor: typeColor + '66', background: typeColor + '22' }}
            >
              {typeLabel}
            </span>
            <h2>{monster.name}</h2>
          </div>
        </div>

        {desc && <div className="bestiary-modal-desc">{desc}</div>}

        <h3 className="bestiary-modal-subtitle">
          Drops <span className="bestiary-modal-subtitle-count">({monster.drops.length})</span>
        </h3>

        <div className="bestiary-drops">
          {monster.drops.map((drop, idx) => {
            const rateLabel = formatRate(drop.rate);
            const isGuaranteed = drop.rate === null || drop.rate === 0;
            return (
              <div key={`${drop.slug || drop.name}-${idx}`} className="bestiary-drop-row">
                <div className="bestiary-drop-icon">
                  <BestiaryMonsterIcon icon={drop.icon} name={drop.name} />
                </div>
                <div className="bestiary-drop-info">
                  <div className="bestiary-drop-name">{drop.name}</div>
                  <div className="bestiary-drop-rarity">{'★'.repeat(drop.rarity)}</div>
                </div>
                <div className={`bestiary-drop-rate ${isGuaranteed ? 'is-guaranteed' : ''}`}>
                  {rateLabel}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
