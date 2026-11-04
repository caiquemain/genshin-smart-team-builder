import { useState, cloneElement, isValidElement } from 'react';
import {
  useFloating,
  useHover,
  useInteractions,
  offset,
  flip,
  shift,
  autoUpdate,
  FloatingPortal,
} from '@floating-ui/react';
import { BestiaryMonsterIcon } from './BestiaryMonsterIcon';
import { TYPE_LABELS, TYPE_COLORS, type BestiaryMonster } from '../types/bestiary';

interface Props {
  monster: BestiaryMonster;
  children: React.ReactElement;
}

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

export function BestiaryMonsterTooltip({ monster, children }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    placement: 'right-start',
    whileElementsMounted: autoUpdate,
    middleware: [offset(12), flip({ padding: 8 }), shift({ padding: 8 })],
  });

  const hover = useHover(context, {
    move: false,
    delay: { open: 150, close: 80 },
  });
  const { getReferenceProps, getFloatingProps } = useInteractions([hover]);

  const typeLabel = TYPE_LABELS[monster.type] ?? monster.type;
  const typeColor = TYPE_COLORS[monster.type] ?? '#94a3b8';
  const desc = formatDescription(monster.description);

  if (!isValidElement(children)) return children;

  return (
    <>
      {cloneElement(children, {
        ref: refs.setReference,
        ...getReferenceProps(),
      } as any)}

      {isOpen && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={{ ...floatingStyles, zIndex: 20000 }}
            {...getFloatingProps()}
            className="bestiary-tooltip"
          >
            <div className="bestiary-tooltip-header">
              <div className="bestiary-tooltip-portrait">
                <BestiaryMonsterIcon icon={monster.icon} name={monster.name} />
              </div>
              <div className="bestiary-tooltip-title">
                <span
                  className="bestiary-card-type"
                  style={{
                    color: typeColor,
                    borderColor: typeColor + '66',
                    background: typeColor + '22',
                  }}
                >
                  {typeLabel}
                </span>
                <h3>{monster.name}</h3>
              </div>
            </div>

            {desc && (
              <p className="bestiary-tooltip-desc">
                {desc.length > 220 ? desc.slice(0, 220) + '…' : desc}
              </p>
            )}

            <div className="bestiary-tooltip-drops">
              <div className="bestiary-tooltip-drops-label">
                Drops <span>({monster.drops.length})</span>
              </div>
              {monster.drops.map((drop, idx) => {
                const isGuaranteed = drop.rate === null || drop.rate === 0;
                return (
                  <div key={`${drop.slug || drop.name}-${idx}`} className="bestiary-tooltip-drop">
                    <div className="bestiary-tooltip-drop-icon">
                      <BestiaryMonsterIcon icon={drop.icon} name={drop.name} />
                    </div>
                    <div className="bestiary-tooltip-drop-info">
                      <div className="bestiary-tooltip-drop-name">{drop.name}</div>
                      <div className="bestiary-tooltip-drop-rarity">
                        {'★'.repeat(drop.rarity)}
                      </div>
                    </div>
                    <div
                      className={`bestiary-tooltip-drop-rate ${
                        isGuaranteed ? 'is-guaranteed' : ''
                      }`}
                    >
                      {formatRate(drop.rate)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </FloatingPortal>
      )}
    </>
  );
}
