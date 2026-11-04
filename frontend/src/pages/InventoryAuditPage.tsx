import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, ArrowLeft, Database } from 'lucide-react';
import {
  loadPlannerData,
  pickLang,
  type PlannerData,
  type PlannerMaterialData,
} from '../utils/planner-data';
import { resolveInventory, type SeelieInventoryItem } from '../utils/inventory-mapper';
import { InventoryMaterialCard } from '../components/InventoryMaterialCard';
import { useLanguage } from '../context/LanguageContext';

const TABS = [
  { id: 'all', label: 'Todos' },
  { id: 'common', label: 'Comum' },
  { id: 'elite', label: 'Elite' },
  { id: 'domain', label: 'Domínio' },
  { id: 'boss', label: 'Boss' },
  { id: 'weekly', label: 'Semanal' },
  { id: 'gem', label: 'Gema' },
  { id: 'talent', label: 'Talento' },
  { id: 'local', label: 'Local' },
];

export default function InventoryAuditPage() {
  const { lang } = useLanguage();
  const [data, setData] = useState<PlannerData | null>(null);
  const [inventory, setInventory] = useState<Record<string, number>>({});
  const [targets, setTargets] = useState<Record<string, number>>({});
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadPlannerData().then((plannerData) => {
      setData(plannerData);

      const savedSeelie = localStorage.getItem('gsb.planner.v5');
      if (savedSeelie) {
        const v5 = JSON.parse(savedSeelie);
        const invRaw: SeelieInventoryItem[] = v5?.seelie?.inventory || [];
        const catalog = Object.entries(plannerData.materials).map(([slug, m]) => ({ ...m, slug }));
        const resolved = resolveInventory(invRaw, catalog, plannerData.families);
        setInventory(resolved.resolved);
      }

      const savedPlan = localStorage.getItem('gsb.planner.plan');
      if (savedPlan) {
        const plan = JSON.parse(savedPlan);
        const targetMap: Record<string, number> = {};
        if (plan.tier_groups) {
          plan.tier_groups.forEach((group: any) => {
            group.materials.forEach((mat: any) => {
              targetMap[mat.slug] = (targetMap[mat.slug] || 0) + mat.quantity;
            });
          });
        }
        setTargets(targetMap);
      }
    });
  }, []);

  const handleUpdateQty = (slug: string, newQty: number) => {
    if (!data) return;
    const savedSeelie = localStorage.getItem('gsb.planner.v5');
    if (!savedSeelie) return;
    const v5 = JSON.parse(savedSeelie);
    const invRaw: SeelieInventoryItem[] = v5.seelie.inventory || [];
    const catalog = Object.entries(data.materials).map(([s, m]) => ({ ...m, slug: s }));

    let found = false;
    for (const item of invRaw) {
      const res = resolveInventory([item], catalog, data.families);
      if (res.resolved[slug] !== undefined) {
        item.value = newQty;
        found = true;
        break;
      }
    }

    localStorage.setItem('gsb.planner.v5', JSON.stringify(v5));
    const newResolved = resolveInventory(invRaw, catalog, data.families);
    setInventory(newResolved.resolved);
  };

  const filteredMaterials = useMemo<[string, PlannerMaterialData][]>(() => {
    if (!data) return [];

    const slugToFamily: Record<string, string> = {};
    Object.entries(data.families).forEach(([familyKey, slugs]) => {
      slugs.forEach(slug => { slugToFamily[slug] = familyKey; });
    });

    const familyMinRarity: Record<string, number> = {};
    Object.entries(data.families).forEach(([fam, slugs]) => {
      const rarities = slugs.map(s => data.materials[s]?.rarity || 1);
      familyMinRarity[fam] = Math.min(...rarities);
    });

    const familyStats: Record<string, { current: number, target: number }> = {};
    Object.keys(data.families).forEach(fam => familyStats[fam] = { current: 0, target: 0 });

    (Object.keys(data.materials) as string[]).forEach(slug => {
      const fam = slugToFamily[slug] || slug;
      if (!familyStats[fam]) familyStats[fam] = { current: 0, target: 0 };
      familyStats[fam].current += inventory[slug] || 0;
      familyStats[fam].target += targets[slug] || 0;
    });

    const items = (Object.entries(data.materials) as [string, PlannerMaterialData][]).filter(
      ([slug, m]) => {
        const namePt = pickLang(m.name, 'pt').toLowerCase();
        if (search && !namePt.includes(search.toLowerCase()) && !slug.includes(search)) {
          return false;
        }

        if (activeTab === 'all') return true;
        if (activeTab === 'common') return m.category === 'common_drop' && (m.rarity || 0) === 1;
        if (activeTab === 'elite') return m.category === 'common_drop' && (m.rarity || 0) >= 2;
        if (activeTab === 'domain') return m.category === 'weapon_ascension';
        if (activeTab === 'boss') return m.category === 'boss_material' && !m.is_weekly;
        if (activeTab === 'weekly') return m.category === 'boss_material' && !!m.is_weekly;
        if (activeTab === 'gem') return m.category === 'ascension_gem';
        if (activeTab === 'talent') return m.category === 'talent_book';
        if (activeTab === 'local') return m.category === 'local_specialty';
        return false;
      }
    );

    const getCategoryRank = (slug: string, m: PlannerMaterialData) => {
      const fam = slugToFamily[slug];
      const effectiveRarity = fam ? (familyMinRarity[fam] || 1) : (m.rarity || 1);

      if (m.category === 'common_drop') return effectiveRarity === 1 ? 0 : 1;
      if (m.category === 'weapon_ascension') return 2;
      if (m.category === 'boss_material') return m.is_weekly ? 4 : 3;
      if (m.category === 'ascension_gem') return 5;
      if (m.category === 'talent_book') return 6;
      if (m.category === 'local_specialty') return 7;
      return 8;
    };

    return items.sort((a, b) => {
      const [slugA, mA] = a;
      const [slugB, mB] = b;

      const rankCatA = getCategoryRank(slugA, mA);
      const rankCatB = getCategoryRank(slugB, mB);
      if (rankCatA !== rankCatB) return rankCatA - rankCatB;

      const famA = slugToFamily[slugA] || slugA;
      const famB = slugToFamily[slugB] || slugB;
      const statsA = familyStats[famA];
      const statsB = familyStats[famB];

      const isPendingA = statsA.target > 0 && statsA.current < statsA.target;
      const isPendingB = statsB.target > 0 && statsB.current < statsB.target;
      const isCompleteA = statsA.target > 0 && statsA.current >= statsA.target;
      const isCompleteB = statsB.target > 0 && statsB.current >= statsB.target;

      const statusA = isPendingA ? 0 : (isCompleteA ? 1 : 2);
      const statusB = isPendingB ? 0 : (isCompleteB ? 1 : 2);

      if (statusA !== statusB) return statusA - statusB;

      if (famA !== famB) return famA.localeCompare(famB);

      return (mA.rarity || 0) - (mB.rarity || 0);
    });

  }, [data, activeTab, search, inventory, targets]);

  if (!data) {
    return <div className="container" style={{ padding: 40 }}>Carregando catálogo...</div>;
  }

  return (
    <div className="inventory-page">
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <Link to="/planner" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-2)', textDecoration: 'none', marginBottom: 12 }}>
            <ArrowLeft size={16} /> Voltar ao Planner
          </Link>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Database size={32} /> Inventário
          </h1>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
        <div className="plan-weapon-picker-search" style={{ width: '100%', margin: 0 }}>
          <Search size={16} />
          <input placeholder="Buscar por nome..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <div className="inventory-tabs" style={{ display: 'flex', borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`inventory-tab ${activeTab === tab.id ? 'active' : ''}`}
              style={{
                padding: '8px 16px',
                background: 'transparent',
                border: 'none',
                borderBottom: '2px solid transparent',
                color: activeTab === tab.id ? '#b398ff' : 'var(--text-2)',
                borderBottomColor: activeTab === tab.id ? '#b398ff' : 'transparent',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px', paddingBottom: '40px' }}>
        {filteredMaterials.map(([slug, m]) => (
          <InventoryMaterialCard
            key={slug}
            material={{ ...m, slug }}
            currentQty={inventory[slug] || 0}
            targetQty={targets[slug] || 0}
            onUpdateQty={handleUpdateQty}
          />
        ))}
        {filteredMaterials.length === 0 && (
          <p style={{ color: 'var(--text-3)', padding: 20 }}>Nenhum item encontrado.</p>
        )}
      </div>
    </div>
  );
}
