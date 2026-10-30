import { iconUrl } from '../config'
import type { AggregateMaterial, CharBreakdown } from '../types/planner'

const ELEMENT_COLORS: Record<string, string> = {
  pyro: '#ff9c46', hydro: '#4cc2f1', electro: '#b398ff', cryo: '#93e2ff',
  anemo: '#73ffd0', geo: '#f2c869', dendro: '#a5c83b',
}

export function formatMoraShort(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`
  return String(n)
}

function mergeMats(target: Map<string, AggregateMaterial>, mats: any[]) {
  for (const m of mats ?? []) {
    const existing = target.get(m.slug)
    if (existing) {
      existing.quantity += m.quantity
    } else {
      target.set(m.slug, {
        slug: m.slug, name: m.name, icon: m.icon, rarity: m.rarity,
        category: m.category, description: m.description, source: m.source,
        quantity: m.quantity, resin_estimate: 0,
      })
    }
  }
}

export function aggregateCharMaterials(c: CharBreakdown): AggregateMaterial[] {
  const mats = new Map<string, AggregateMaterial>()
  if (c.ascension) mergeMats(mats, c.ascension.materials)
  if (c.talents) mergeMats(mats, c.talents.grand_total_materials)
  c.weapons.forEach((w) => { if (w.cost) mergeMats(mats, w.cost.materials) })
  const totalMora = (c.ascension?.total_mora ?? 0) + (c.talents?.grand_total_mora ?? 0)
    + c.weapons.reduce((sum, w) => sum + (w.cost?.total_mora ?? 0), 0)
  if (totalMora > 0) {
    mats.set('__mora__', {
      slug: '__mora__', name: 'Mora', icon: 'UI_ItemIcon_202', rarity: 3,
      category: 'mora', description: null, source: null,
      quantity: totalMora, resin_estimate: 0,
    })
  }
  return Array.from(mats.values()).sort((a, b) => (b.rarity ?? 0) - (a.rarity ?? 0) || a.name.localeCompare(b.name))
}

function PlanMaterialIcon({ material, have }: { material: AggregateMaterial; have: number }) {
  const isMora = material.slug === '__mora__'
  const img = isMora ? iconUrl('UI_ItemIcon_202') : iconUrl(material.icon)
  const missing = Math.max(0, material.quantity - have)
  const isComplete = have >= material.quantity && material.quantity > 0
  let displayQty: string
  if (isComplete) displayQty = '✓'
  else if (have > 0) displayQty = isMora ? formatMoraShort(missing) : `-${missing}`
  else displayQty = isMora ? formatMoraShort(material.quantity) : String(material.quantity)
  const rarityGrad: Record<number, string> = {
    1: 'linear-gradient(160deg,rgba(79,88,100,0.75) 0%,rgba(95,102,115,0.75) 39%,rgba(135,147,156,0.75) 100%)',
    2: 'linear-gradient(160deg,rgba(72,87,92,0.75) 0%,rgba(72,107,103,0.75) 39%,rgba(98,152,113,0.75) 100%)',
    3: 'linear-gradient(160deg,rgba(81,84,116,0.75) 0%,rgba(80,104,135,0.75) 39%,rgba(75,160,180,0.75) 100%)',
    4: 'linear-gradient(160deg,rgba(89,84,130,0.75) 0%,rgba(120,102,157,0.75) 39%,rgba(183,133,201,0.75) 100%)',
    5: 'linear-gradient(160deg,rgba(105,84,83,0.75) 0%,rgba(161,112,78,0.75) 39%,rgba(228,171,82,0.75) 100%)',
  }
  return (
    <div className="plan-mat-icon" title={`${material.name}: ${material.quantity}${have > 0 ? ` (tem ${have})` : ''}`}>
      <div className="plan-mat-icon-inner" style={{ background: rarityGrad[material.rarity ?? 1] }}>
        {img ? <img src={img} alt={material.name} loading="lazy" /> : <span>?</span>}
      </div>
      <span className={`plan-mat-qty ${isComplete ? 'complete' : have > 0 ? 'partial' : ''}`}>{displayQty}</span>
    </div>
  )
}

function PlanTalentBar({ label, current, goal }: { label: string; current: number | null; goal: number | null }) {
  if (current == null || goal == null) return null
  if (current === goal) {
    return (
      <div className="plan-talent-row">
        <span className="plan-talent-label">{label}</span>
        <span className="plan-talent-done">MAX</span>
      </div>
    )
  }
  const pct = Math.min(100, (current / 10) * 100)
  const goalPct = Math.min(100, (goal / 10) * 100)
  return (
    <div className="plan-talent-row">
      <span className="plan-talent-label">{label}</span>
      <div className="plan-talent-bar">
        <div className="plan-talent-fill" style={{ width: `${pct}%` }} />
        <div className="plan-talent-goal" style={{ width: `${goalPct}%` }} />
      </div>
      <span className="plan-talent-range">{current}→{goal}</span>
    </div>
  )
}

export default function PlannerCharacterCard({
  char, element, inventory,
}: {
  char: CharBreakdown
  element: string | undefined
  inventory: Record<string, number>
}) {
  const img = iconUrl(char.icon)
  const mats = aggregateCharMaterials(char)
  const accent = element ? ELEMENT_COLORS[element] ?? '#7dd3fc' : '#7dd3fc'
  const charLevels = char.char_goal ? `${char.char_goal.current.level} → ${char.char_goal.goal.level}` : null
  const cons = char.char_goal?.cons ?? 0
  const talentsDone = !char.talent_goal
  const resinTotal = mats.reduce((sum, m) => sum + m.resin_estimate, 0)
  const resinDays = Math.ceil(resinTotal / 180)
  return (
    <div className="plan-char-card" style={{ '--char-accent': accent } as React.CSSProperties}>
      <div className="plan-char-header">
        <div className="plan-char-portrait">
          {img ? <img src={img} alt={char.name} /> : <span>?</span>}
          <div className="plan-char-portrait-gradient" />
          {charLevels && <span className="plan-char-lv">{charLevels}</span>}
          <span className="plan-char-c0">C{cons}</span>
        </div>
        <div className="plan-char-info">
          <div className="plan-char-title-row">
            <a href={`/characters/${char.slug}`} className="plan-char-name">{char.name}</a>
            {resinDays > 0 && (
              <span className="plan-char-days">{resinDays} day{resinDays !== 1 ? 's' : ''}</span>
            )}
          </div>
          <div className="plan-char-talents">
            {talentsDone ? (
              <p className="plan-char-talents-done">Talents caught up ✓</p>
            ) : (
              <>
                <PlanTalentBar label="ATTACK" current={char.talent_goal!.normal.current} goal={char.talent_goal!.normal.goal} />
                <PlanTalentBar label="SKILL" current={char.talent_goal!.skill.current} goal={char.talent_goal!.skill.goal} />
                <PlanTalentBar label="BURST" current={char.talent_goal!.burst.current} goal={char.talent_goal!.burst.goal} />
              </>
            )}
          </div>
        </div>
      </div>
      {mats.length > 0 && (
        <div className="plan-char-mats">
          {mats.map((m) => (
            <PlanMaterialIcon
              key={m.slug}
              material={m}
              have={m.slug === '__mora__' ? 0 : inventory[m.slug] ?? 0}
            />
          ))}
        </div>
      )}
    </div>
  )
}
