import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { loadBestiaryData } from '../utils/bestiary-data';
import { BestiaryMonsterCard } from '../components/BestiaryMonsterCard';
import { BestiaryMonsterModal } from '../components/BestiaryMonsterModal';
import { BestiaryMonsterTooltip } from '../components/BestiaryMonsterTooltip';
import { TYPE_ORDER, TYPE_LABELS, type BestiaryData, type BestiaryMonster } from '../types/bestiary';

export default function BestiaryPage() {
  const [data, setData] = useState<BestiaryData | null>(null);
  const [search, setSearch] = useState('');
  const [activeType, setActiveType] = useState('all');
  const [selected, setSelected] = useState<BestiaryMonster | null>(null);

  useEffect(() => {
    loadBestiaryData().then(setData);
  }, []);

  // ESC fecha o modal
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);

  const uniqueMonsters = useMemo<BestiaryMonster[]>(() => {
    if (!data) return [];
    const byName = new Map<string, BestiaryMonster>();
    for (const m of Object.values(data)) {
      const key = m.name.toLowerCase();
      if (!byName.has(key)) byName.set(key, m);
    }
    return Array.from(byName.values());
  }, [data]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: uniqueMonsters.length };
    for (const m of uniqueMonsters) c[m.type] = (c[m.type] ?? 0) + 1;
    return c;
  }, [uniqueMonsters]);

  const filtered = useMemo(() => {
    return uniqueMonsters
      .filter((m) => {
        if (activeType !== 'all' && m.type !== activeType) return false;
        if (search && !m.name.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [uniqueMonsters, activeType, search]);

  if (!data) {
    return <div className="container" style={{ padding: 40 }}>Carregando bestiário...</div>;
  }

  const tabs = [
    { id: 'all', label: 'Todos', count: counts.all },
    ...TYPE_ORDER.filter((t) => counts[t] > 0).map((t) => ({
      id: t,
      label: TYPE_LABELS[t] ?? t,
      count: counts[t],
    })),
  ];

  return (
    <div className="bestiary-page">
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <h1>Bestiário</h1>
          <p style={{ color: 'var(--text-2)', fontSize: 14, margin: '4px 0 0' }}>
            {uniqueMonsters.length} monstros · {TYPE_ORDER.filter((t) => counts[t] > 0).length} tipos
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
        <div className="plan-weapon-picker-search" style={{ width: '100%', margin: 0 }}>
          <Search size={16} />
          <input
            placeholder="Buscar por nome..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="inventory-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveType(tab.id)}
              className={`inventory-tab ${activeType === tab.id ? 'active' : ''}`}
            >
              {tab.label} <span style={{ opacity: 0.5, fontSize: 12 }}>({tab.count})</span>
            </button>
          ))}
        </div>
      </div>

      <div className="bestiary-grid">
        {filtered.map((m) => (
          <BestiaryMonsterTooltip key={m.id} monster={m}>
            <div className="bestiary-card-wrapper">
              <BestiaryMonsterCard monster={m} onClick={() => setSelected(m)} />
            </div>
          </BestiaryMonsterTooltip>
        ))}
        {filtered.length === 0 && (
          <p style={{ color: 'var(--text-3)', padding: 20 }}>Nenhum monstro encontrado.</p>
        )}
      </div>

      {selected && (
        <BestiaryMonsterModal monster={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
