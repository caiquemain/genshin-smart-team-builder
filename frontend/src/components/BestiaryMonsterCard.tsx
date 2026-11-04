import { BestiaryMonsterIcon } from './BestiaryMonsterIcon';
import { TYPE_LABELS, TYPE_COLORS, type BestiaryMonster } from '../types/bestiary';

interface Props {
  monster: BestiaryMonster;
  onClick: () => void;
}

export function BestiaryMonsterCard({ monster, onClick }: Props) {
  const typeLabel = TYPE_LABELS[monster.type] ?? monster.type;
  const typeColor = TYPE_COLORS[monster.type] ?? '#94a3b8';
  const dropCount = monster.drops.length;

  return (
    <button type="button" className="bestiary-card" onClick={onClick}>
      <span
        className="bestiary-card-type"
        style={{ color: typeColor, borderColor: typeColor + '66', background: typeColor + '22' }}
      >
        {typeLabel}
      </span>
      <div className="bestiary-card-icon">
        <BestiaryMonsterIcon icon={monster.icon} name={monster.name} />
      </div>
      <div className="bestiary-card-name">{monster.name}</div>
      <div className="bestiary-card-drops">
        {dropCount} drop{dropCount !== 1 ? 's' : ''}
      </div>
    </button>
  );
}
