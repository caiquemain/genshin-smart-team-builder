import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, ArrowLeft, Database, AlertCircle, CheckCircle2, Package } from 'lucide-react'
import { useLanguage } from '../context/LanguageContext'
import { loadPlannerData, pickLang, type PlannerMaterialData } from '../utils/planner-data'
import { resolveInventory, type SeelieInventoryItem } from '../utils/inventory-mapper'
import { iconUrl } from '../config'

const RARITY_GRADIENTS: Record<number, string> = {
  1: 'linear-gradient(160deg,rgba(79,88,100,0.75) 0%,rgba(95,102,115,0.75) 39%,rgba(135,147,156,0.75) 100%)',
  2: 'linear-gradient(160deg,rgba(72,87,92,0.75) 0%,rgba(72,107,103,0.75) 39%,rgba(98,152,113,0.75) 100%)',
  3: 'linear-gradient(160deg,rgba(81,84,116,0.75) 0%,rgba(80,104,135,0.75) 39%,rgba(75,160,180,0.75) 100%)',
  4: 'linear-gradient(160deg,rgba(89,84,130,0.75) 0%,rgba(120,102,157,0.75) 39%,rgba(183,133,201,0.75) 100%)',
  5: 'linear-gradient(160deg,rgba(105,84,83,0.75) 0%,rgba(161,112,78,0.75) 39%,rgba(228,171,82,0.75) 100%)',
}

export default function InventoryAuditPage() {
  const { lang } = useLanguage()
  const [materials, setMaterials] = useState<[string, PlannerMaterialData][]>([])
  const [inventory, setInventory] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('all')
  const [onlyOwned, setOnlyOwned] = useState(false)

  useEffect(() => {
    loadPlannerData().then((data) => {
      setMaterials(Object.entries(data.materials))

      // SEMPRE re-resolve a partir do Seelie bruto.
      // NUNCA confia em plan.inventory_resolved — ele pode ter sido gerado
      // com um families incompleto (bug histórico) e ficar congelado.
      let parsedInv: Record<string, number> = {}
      try {
        const savedSeelie = localStorage.getItem('gsb.planner.v5')
        if (savedSeelie) {
          const v5 = JSON.parse(savedSeelie)
          const invRaw: SeelieInventoryItem[] = v5?.seelie?.inventory ?? []
          if (invRaw.length > 0) {
            const catalog = Object.entries(data.materials).map(
              ([slug, m]) => ({ ...m, slug }),
            )
            const result = resolveInventory(invRaw, catalog, data.families)
            parsedInv = result.resolved

            const totalQty = Object.values(parsedInv).reduce((a, b) => a + b, 0)
            console.log(
              `[audit] ${Object.keys(parsedInv).length} slugs · ${totalQty} itens · ` +
              `${result.unmapped.length} unmapped · ${result.ambiguous.length} ambiguous`,
            )
            if (result.unmapped.length > 0) {
              console.group('[audit] unmapped (item.item [tier] = valor)')
              for (const e of result.unmapped) {
                console.log(`${e.item} [tier ${e.tier}] = ${e.value}`)
              }
              console.groupEnd()
            }
          }
        }
      } catch (e) {
        console.error('Erro ao ler inventário:', e)
      }
      setInventory(parsedInv)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const categories = useMemo(() => {
    const cats = new Set<string>()
    materials.forEach(([_, m]) => cats.add(m.category))
    return Array.from(cats).sort()
  }, [materials])

  const filtered = useMemo(() => {
    return materials
      .filter(([slug, m]) => {
        if (filterCategory !== 'all' && m.category !== filterCategory) return false
        if (onlyOwned && (!inventory[slug] || inventory[slug] === 0)) return false
        if (!search) return true
        const q = search.toLowerCase()
        const namePt = (m.name.pt || '').toLowerCase()
        const nameEn = (m.name.en || '').toLowerCase()
        return slug.toLowerCase().includes(q) || namePt.includes(q) || nameEn.includes(q)
      })
      .sort(([slugA], [slugB]) => {
        const qtyA = inventory[slugA] || 0
        const qtyB = inventory[slugB] || 0
        if (qtyA !== qtyB) return qtyB - qtyA
        return slugA.localeCompare(slugB)
      })
  }, [materials, search, filterCategory, inventory, onlyOwned])

  const totalOwned = useMemo(() => {
    return materials.filter(([slug]) => (inventory[slug] || 0) > 0).length
  }, [materials, inventory])

  if (loading) return <div className="container" style={{ padding: 40 }}>Carregando catálogo...</div>

  return (
    <div className="container" style={{ padding: '32px 24px' }}>

      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <Link to="/planner" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-2)', textDecoration: 'none', marginBottom: 12 }}>
            <ArrowLeft size={16} /> Voltar ao Planner
          </Link>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Database size={32} /> Auditoria de Inventário
          </h1>
          <p style={{ color: 'var(--text-2)' }}>
            Exibindo <strong>{filtered.length}</strong> de <strong>{materials.length}</strong> itens no catálogo ·
            <strong style={{ color: '#4ade80', marginLeft: 6 }}>{totalOwned}</strong> itens no seu inventário.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <div className="plan-weapon-picker-search" style={{ flex: 1, minWidth: 300, margin: 0 }}>
          <Search size={16} />
          <input
            placeholder="Buscar por nome ou slug..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="planner-filter-select"
          style={{ minWidth: 200 }}
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
        >
          <option value="all">Todas as categorias</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button
          className={`btn-secondary ${onlyOwned ? 'active' : ''}`}
          onClick={() => setOnlyOwned(!onlyOwned)}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <Package size={16} /> Só os que eu tenho
        </button>
      </div>

      <div style={{ background: 'var(--surface-1)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
            <tr>
              <th style={{ padding: 12, width: 50 }}>Ícone</th>
              <th style={{ padding: 12 }}>Slug (ID)</th>
              <th style={{ padding: 12 }}>Nome (PT / EN)</th>
              <th style={{ padding: 12 }}>Categoria</th>
              <th style={{ padding: 12 }}>Raridade</th>
              <th style={{ padding: 12, textAlign: 'center' }}>Semanal?</th>
              <th style={{ padding: 12, textAlign: 'right', width: 100 }}>Qtd</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(([slug, m]) => {
              const namePt = pickLang(m.name, 'pt')
              const nameEn = pickLang(m.name, 'en')
              const img = iconUrl(m.icon)
              const qty = inventory[slug] || 0

              return (
                <tr key={slug} style={{ borderBottom: '1px solid var(--border)', opacity: qty === 0 ? 0.5 : 1 }}>
                  <td style={{ padding: 12 }}>
                    <div style={{ width: 40, height: 40, background: RARITY_GRADIENTS[m.rarity ?? 1], borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {img ? <img src={img} alt={slug} style={{ width: 32, height: 32 }} /> : '?'}
                    </div>
                  </td>
                  <td style={{ padding: 12, fontFamily: 'monospace', fontSize: 13 }}>{slug}</td>
                  <td style={{ padding: 12 }}>
                    <div style={{ fontWeight: 'bold' }}>{namePt || nameEn}</div>
                    {namePt && nameEn && namePt !== nameEn && <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{nameEn}</div>}
                  </td>
                  <td style={{ padding: 12, fontSize: 13, color: 'var(--text-2)' }}>{m.category}</td>
                  <td style={{ padding: 12 }}>
                    <span style={{ color: '#e0a647', letterSpacing: 2 }}>{'★'.repeat(m.rarity ?? 1)}</span>
                  </td>
                  <td style={{ padding: 12, textAlign: 'center' }}>
                    {m.is_weekly ? (
                      <span title="Boss Semanal" style={{ color: '#b398ff', display: 'inline-flex' }}><CheckCircle2 size={18} /></span>
                    ) : (
                      <span title="Normal" style={{ color: 'var(--text-3)', display: 'inline-flex' }}><div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid var(--text-3)' }} /></span>
                    )}
                  </td>
                  <td style={{ padding: 12, textAlign: 'right', fontFamily: 'monospace', fontSize: 14, fontWeight: qty > 0 ? 'bold' : 'normal', color: qty > 0 ? 'var(--text-1)' : 'var(--text-3)' }}>
                    {qty > 0 ? qty.toLocaleString('pt-BR') : '0'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>
            <AlertCircle size={32} style={{ marginBottom: 12 }} />
            <p>Nenhum item encontrado com esses filtros.</p>
          </div>
        )}
      </div>
    </div>
  )
}