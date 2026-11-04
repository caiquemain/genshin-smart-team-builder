export interface BestiaryDrop {
  name: string;
  slug: string | null;
  rarity: number;
  rate: number | null;
  rate_raw: string;
  icon: string;
}

export interface BestiaryMonster {
  id: string;
  name: string;
  type: string;
  icon: string;
  description: string;
  drops: BestiaryDrop[];
}

export type BestiaryData = Record<string, BestiaryMonster>;

export const TYPE_LABELS: Record<string, string> = {
  ABYSS: 'Abismo',
  AUTOMATRON: 'Autômato',
  BEAST: 'Fera',
  BOSS: 'Boss',
  ELEMENTAL: 'Elemental',
  FATUI: 'Fatui',
  HILICHURL: 'Hilichurl',
  HUMAN: 'Humano',
};

export const TYPE_COLORS: Record<string, string> = {
  ABYSS: '#a855f7',
  AUTOMATRON: '#94a3b8',
  BEAST: '#f59e0b',
  BOSS: '#ef4444',
  ELEMENTAL: '#06b6d4',
  FATUI: '#3b82f6',
  HILICHURL: '#84cc16',
  HUMAN: '#ec4899',
};

export const TYPE_ORDER = [
  'HILICHURL', 'BEAST', 'BOSS', 'FATUI',
  'ABYSS', 'AUTOMATRON', 'ELEMENTAL', 'HUMAN',
];
