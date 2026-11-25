import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext'
import { iconUrl } from '../config'
import ItemTooltip from '../components/ItemTooltip'
import { tierOf, estimateResin, estimateResinRange, formatDays, formatResin, TIERS, type ResinSpendMode } from '../utils/resin'
import { resolveGoodMaterials, resolveInventory, type SeelieInventoryItem } from '../utils/inventory-mapper'
import { getBestiaryData, calculateKills, calculateFamilyKills } from '../utils/kills-compute'
import type { BestiaryData } from '../types/bestiary'
import type {
  AscensionCost, TalentCost, WeaponAscensionResponse, AscensionMaterial, CharacterSummary, WeaponSummary,
} from '../types'
import type { SeelieData, SeelieCharacterGoal, SeelieTalentGoal, SeelieWeaponGoal } from '../types/seelie'
import type { GoodData } from '../types/good'
import { 
  Flame, Droplets, Snowflake, Zap, Wind, Mountain, Leaf,
  Coins, Users, Sword, Calculator, CheckCircle2, FlaskConical,
  Settings, Pencil, ClipboardList, AlertTriangle, Sprout,
  Shield, Skull, CalendarDays, Gem, BookOpen, MapPin, Star, Plus, Download, Upload, UserCheck,
  Target, X, Search, Filter,
} from 'lucide-react'
import type { AggregateMaterial, CharBreakdown, WeaponBreakdown, TierGroup, Plan } from '../types/planner'

import { loadPlannerData, getPlannerData, getPlannerDataOrNull, elementOf, pickLang, type PlannerData } from '../utils/planner-data'
import { buildIndexes, resolveCharSlug, resolveWeaponSlug } from '../utils/slug-resolver'
import { computeAscensionCost, computeTalentCost, computeWeaponAscension } from '../utils/planner-compute'
import { parseGoodData, type GoodCharState } from '../utils/good-parser'
import { getXpMaterials, recomputeAggregates } from '../utils/planner-recompute'
import { getOwnedCharXp, getOwnedWeaponXp } from '../utils/xp-costs'
import { useRoster } from '../utils/roster'
import {
  PLANNER_UPDATED_EVENT,
  addCharToPlan,
  hydratePlanFromData,
  loadManualInventory,
  loadPlanFromStorage,
  loadPlannerSettings,
  removeCharFromPlan,
  savePlanToStorage,
  syncCharEditToPlannerStorage,
  syncInventoryItemToPlannerStorage,
} from '../utils/planner-storage'

import ItemEditModal from '../components/ItemEditModal'
import SettingsModal from '../components/SettingsModal'
import CharacterPickerModal from '../components/CharacterPickerModal'
import PlannerCharacterModal from '../components/PlannerCharacterModal'
import TodayFarmWidget from '../components/TodayFarmWidget'
import UidImportModal from '../components/UidImportModal'

const STORAGE_KEY = 'gsb.planner.v5'
const FOCUS_STORAGE_KEY = 'gsb.planner.focus'

const VIRTUAL_RESOURCES: Record<string, { name: string; icon: string; rarity: number }> = {
  mora: { name: 'Mora', icon: 'UI_ItemIcon_202', rarity: 3 },
  'hero-s-wit': { name: "Experiência do Herói (20k XP)", icon: 'UI_ItemIcon_104003', rarity: 4 },
  'adventurer-s-experience': { name: 'Experiência do Aventureiro (5k XP)', icon: 'UI_ItemIcon_104002', rarity: 3 },
  'wanderer-s-advice': { name: 'Conselho do Andarilho (1k XP)', icon: 'UI_ItemIcon_104001', rarity: 2 },
  'mystic-enhancement-ore': { name: 'Minério de Refinamento Místico (10k XP)', icon: 'UI_ItemIcon_104012', rarity: 3 },
  'fine-enhancement-ore': { name: 'Minério de Refinamento Fino (2k XP)', icon: 'UI_ItemIcon_104011', rarity: 2 },
  'enhancement-ore': { name: 'Minério de Refinamento (400 XP)', icon: 'UI_ItemIcon_104011', rarity: 1 },
}

const SEELIE_ORDER = [
  'horn', 'ley_line', 'ley-line', 'chaos', 'mist', 'sacrificial_knife', 'sacrificial-knife', 'bone-shard', 'chaos_g', 'chaos-g', 'prism', 'claw', 'statuette', 'fungal_nucleus', 'fungal-nucleus', 'chaos_s', 'chaos-s', 'd_prism', 'd-prism', 'shell', 'whopperflower', 'tainted_water', 'tainted-water', 'core', 'pocket_watch', 'pocket-watch', 'fin', 'hilt', 'will', 'ignited', 'secret_source', 'secret-source', 'bud', 'shellshard', 'frostnight', 'l_bone', 'l-bone', 'mistshroud', 'deep_shadow', 'deep-shadow', 'flaming_hilt', 'flaming-hilt', 'lunar_iron', 'lunar-iron', 'accreted', 'life',
  'slime', 'mask', 'scroll', 'arrowhead', 'f_insignia', 'th_insignia', 'nectar', 'handguard', 'spectral', 'spores', 'red-satin', 'transoceanic', 'gear', 'n_fang', 'n-fang', 'whistle', 'drive_shaft', 'drive-shaft', 'warrant', 'ethereal', 'chimeric',
  'hurricane-seed', 'lightning-prism', 'basalt-pillar', 'hoarfrost-core', 'everflame-seed', 'cleansing-heart', 'juvenile-jade', 'crystalline-bloom', 'maguu-kishin', 'perpetual-heart', 'smoldering-pearl', 'dew-of-repudiation', 'storm-beads', 'riftborn-regalia', 'dragonheirs-false-fin', 'runic-fang', 'majestic-hooked-beak', 'thunderclap-fruitcore', 'perpetual-caliber', 'light-guiding-tetrahedron', 'quelled-creeper', 'pseudo-stamens', 'evergloom-ring', 'clockwork-component-coppelia', 'clockwork-component-coppelius', 'emperors-resolution', 'tourbillon-device', 'fontemer-unihorn', 'water-that-failed', 'cloudseam-scale', 'golden-melody', 'binding-blessing', 'flamegranate', 'secret-source-core', 'ensnaring-gaze', 'talisman-of-the-enigmatic-land', 'sparkless-statue-core', 'airflow-accumulator', 'precision-kuuvahki', 'lightbearing-scale-feather', 'radiant-antler', 'kuuvahki-core', 'remnant-of-the-dreadwing', 'prismatic-severed-tail', 'plume-of-the-fallen-watcher', 'unscorched-blossom-branch', 'severed-tail-of-the-sky-roamer', 'cracked-armor', 'worldspan-fern', 'false-stamen', 'tubion-device', 'moment-of-syzygy', 'fragment-of-the-demon-king', 'chifre-de-baleia-cometeu',
  'dvalin', 'boreas', 'signora', 'shogun', 'scaramouche', 'azhdaha', 'narwhal', 'arlecchino',
  'brilliant', 'agnidus', 'varunada', 'nagadus', 'vajrada', 'vayuda', 'shivada', 'prithiva',
  'freedom', 'resistance', 'ballad', 'prosperity', 'diligence', 'gold', 'transience', 'elegance', 'light', 'admonition', 'ingenuity', 'praxis', 'fairness', 'justice', 'order', 'contention', 'kindling', 'conflict', 'moonlight', 'elysium', 'vagrancy', 'charity', 'fortitude', 'glory',
  'decarabian', 'boreal-wolf', 'dandelion-gladiator', 'guyun', 'mist-veiled-elixer', 'aerosiderite', 'sea-branch', 'narukami', 'mask-w', 'talisman', 'oasis-gardens', 'scorching-might', 'ancient-chord', 'dewdrop', 'pristine-sea', 'bs-heart', 'delirious', 'night-wind', 'artful-device', 'flint', 'far-north-scions', 'pale-star', 'spiritual-nectar', 'frost-emperor'
];

const SEELIE_ORDER_MAP = new Map<string, number>();
SEELIE_ORDER.forEach((key, index) => {
  SEELIE_ORDER_MAP.set(key, index);
  SEELIE_ORDER_MAP.set(key.replace(/-/g, '_'), index);
});

const TIER_ICONS: Record<string, React.ReactNode> = {
  free: <Sprout size={18} />,
  common: <Leaf size={18} />,
  elite: <Shield size={18} />,
  boss40: <Skull size={18} />,
  weekly: <CalendarDays size={18} />,
  gem: <Gem size={18} />,
  talent: <BookOpen size={18} />,
  local: <MapPin size={18} />,
}

function mergeMats(target: Map<string, AggregateMaterial>, mats: AscensionMaterial[]) {
  for (const m of mats) {
    const existing = target.get(m.slug)
    if (existing) {
      existing.quantity += m.quantity
      existing.resin_estimate = estimateResin(existing.category, existing.quantity)
    } else {
      target.set(m.slug, {
        slug: m.slug, name: m.name, icon: m.icon, rarity: m.rarity,
        category: m.category, description: m.description, source: m.source,
        quantity: m.quantity, resin_estimate: estimateResin(m.category, m.quantity),
        is_weekly: (m as any).is_weekly,
      })
    }
  }
}

function MaterialCard({ 
  material, have, globalMax, inventory, family, solvents, isWeekly = false, onEdit, wl, resinMode = 20, bestiary
}: { 
  material: AggregateMaterial
  have: number
  globalMax: number
  inventory: Record<string, number>
  family?: string[]
  solvents?: number
  isWeekly?: boolean
  onEdit: (slug: string) => void
  wl: number
  resinMode?: ResinSpendMode
  bestiary: BestiaryData | null
}) {
  const img = iconUrl(material.icon)
  const missing = Math.max(0, material.quantity - have)
  const isPlanComplete = have >= material.quantity
  const isGlobalCapReached = have >= globalMax && globalMax > 0
  
  let alchemyHintText = null
  let alchemyHintDesc = null
  let canAlchemize = false
  
  if (!isPlanComplete && family) {
    if (isWeekly) {
      const otherMaterials = family.filter(s => s !== material.slug)
      for (const other of otherMaterials) {
        const haveOther = inventory[other] || 0
        if (haveOther > 0 && (solvents || 0) > 0) {
          alchemyHintText = `Transmutação (Solvente)`
          alchemyHintDesc = `Você tem ${haveOther}x de outro material deste chefe. Use Dream Solvent para converter.`
          canAlchemize = true
          break
        }
      }
    } else {
      const targetIndex = family.indexOf(material.slug)
      for (let i = targetIndex - 1; i >= 0; i--) {
        const lowerSlug = family[i]
        const haveLower = inventory[lowerSlug] || 0
        const neededLower = missing * 3
        if (haveLower >= neededLower) {
          alchemyHintText = `Alquimia (Tier Inferior)`
          alchemyHintDesc = `Você tem ${haveLower}x do material inferior. Você pode craftar ${missing}x deste usando ${neededLower}x do inferior.`
          canAlchemize = true
          break
        }
      }
    }
  }

  const killsData = bestiary ? calculateKills(material.slug, missing, wl, bestiary) : null
  const effectiveCategory = isWeekly ? 'weekly_boss' : material.category
  const resinRange = estimateResinRange(effectiveCategory, material.quantity, have, {
    rarity: material.rarity,
    wl,
    resinMode,
  })

  return (
    <ItemTooltip 
      data={{ 
        name: material.name, 
        icon: img ?? undefined, 
        rarity: material.rarity ?? undefined, 
        category: effectiveCategory, 
        description: material.description ?? undefined, 
        source: material.source ?? undefined,
        resinRange,
        killsNeeded: killsData ? { monsterName: killsData.monsterName, kills: killsData.kills, dropRate: killsData.dropRate } : null,
        customFooter: (
          <>
            {isGlobalCapReached && (
               <div style={{ marginTop: 12, padding: 8, background: 'rgba(34, 197, 94, 0.2)', borderLeft: '3px solid #22c55e', color: '#b9f8cf', fontSize: 12, borderRadius: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                 <CheckCircle2 size={14} />
                 <div><strong>Teto Global Atingido ({globalMax})</strong><br/>Você já tem o suficiente para maximizar TODOS os personagens e armas do jogo. Pare de farmar!</div>
               </div>
            )}
            {canAlchemize && (
               <div style={{ marginTop: 12, padding: 8, background: 'rgba(59, 130, 246, 0.2)', borderLeft: '3px solid #3b82f6', color: '#bfdbfe', fontSize: 12, borderRadius: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                 <FlaskConical size={14} />
                 <div><strong>{alchemyHintText}</strong><br/>{alchemyHintDesc}</div>
               </div>
            )}
          </>
        )
      }}
    >
      <div onClick={() => onEdit(material.slug)} className={`ascension-item ${isPlanComplete ? 'item-complete' : have > 0 ? 'item-partial' : 'item-unmapped'}`} style={{ position: 'relative', overflow: 'hidden', cursor: 'pointer' }} title="Clique para editar">
        {isGlobalCapReached && !isPlanComplete && (
           <div style={{ position: 'absolute', top: 0, right: 0, background: '#22c55e', padding: '4px', borderBottomLeftRadius: '4px' }}>
             <CheckCircle2 size={12} color="#fff" />
           </div>
        )}
        {canAlchemize && (
           <div style={{ position: 'absolute', top: isGlobalCapReached ? '20px' : '0', right: 0, background: '#3b82f6', padding: '4px', borderBottomLeftRadius: '4px' }}>
             <FlaskConical size={12} color="#fff" />
           </div>
        )}

        <div className="ascension-icon">{img ? <img src={img} alt={material.name} loading="lazy" /> : <span>?</span>}</div>
        <div className="ascension-info">
          <div className="ascension-name">
            {material.name}
            {isPlanComplete && <span className="item-check">✓</span>}
          </div>
          <div className="ascension-meta">
            <span className="stars">{'★'.repeat(material.rarity ?? 0)}</span>
            {have > 0 && <span className="have-badge">tem {have.toLocaleString('pt-BR')}</span>}
          </div>
        </div>
        <div className="ascension-qty-group">
          <div className="ascension-qty">×{material.quantity}</div>
          {!isPlanComplete && <div className="ascension-missing">falta {missing.toLocaleString('pt-BR')}</div>}
          {isPlanComplete && <div className="ascension-done">completo</div>}
        </div>
      </div>
    </ItemTooltip>
  )
}

function MaterialGroupCard({ mats, inventory, globalMax, family, solvents, isWeekly = false, onEdit, wl, resinMode = 20, bestiary }: {
  mats: AggregateMaterial[]
  inventory: Record<string, number>
  globalMax: Record<string, number>
  family?: string[]
  solvents?: number
  isWeekly?: boolean
  onEdit: (slug: string) => void
  wl: number
  resinMode?: ResinSpendMode
  bestiary: BestiaryData | null
}) {
  if (mats.length === 1 || isWeekly) {
    return (
      <>
        {mats.map(m => (
          <MaterialCard 
            key={m.slug} 
            material={m} 
            have={inventory[m.slug] ?? 0} 
            globalMax={globalMax[m.slug] ?? 0} 
            inventory={inventory} 
            family={family} 
            solvents={solvents} 
            isWeekly={isWeekly} 
            onEdit={onEdit}
            wl={wl}
            resinMode={resinMode}
            bestiary={bestiary}
          />
        ))}
      </>
    )
  }

  const sortedMats = [...mats].sort((a, b) => (b.rarity ?? 0) - (a.rarity ?? 0))
  const mainMat = sortedMats[0]
  
  const totalMissing = mats.reduce((sum, m) => sum + Math.max(0, m.quantity - (inventory[m.slug] ?? 0)), 0)
  const isComplete = totalMissing === 0

  const isGlobalCapReached = mats.every(m => (inventory[m.slug] ?? 0) >= (globalMax[m.slug] ?? 0) && (globalMax[m.slug] ?? 0) > 0)

  let canAlchemize = false
  if (!isComplete) {
     const missingHigh = Math.max(0, sortedMats[0].quantity - (inventory[sortedMats[0].slug] ?? 0))
     if (missingHigh > 0) {
        for (let i = 1; i < sortedMats.length; i++) {
           const lower = sortedMats[i]
           const haveLower = inventory[lower.slug] ?? 0
           const neededLower = missingHigh * Math.pow(3, i)
           if (haveLower >= neededLower) {
             canAlchemize = true
             break
           }
        }
     }
  }

  const img = iconUrl(mainMat.icon)
  const familyName = sortedMats[sortedMats.length - 1].name.replace(/^(Danificada|Sagrada|Prateada|Dourada|Velha|Comum|Gasta)/i, '').trim() || sortedMats[0].name

  let familyKills = null
  if (bestiary && family) {
    const required: Record<string, number> = {}
    for (const m of mats) required[m.slug] = m.quantity
    
    const sortedFamily = [...family].sort((a, b) => {
      const matA = mats.find(m => m.slug === a)
      const matB = mats.find(m => m.slug === b)
      return (matA?.rarity ?? 0) - (matB?.rarity ?? 0)
    })
    
    familyKills = calculateFamilyKills(sortedFamily, inventory, required, wl, bestiary)
  }

  // Converte todos os tiers do grupo para equivalente do tier mais alto (alquimia 3:1)
  const highestRarity = sortedMats[0].rarity ?? 4
  let eqNeeded = 0
  let eqHave = 0
  for (const m of sortedMats) {
    const rDiff = Math.max(0, highestRarity - (m.rarity ?? highestRarity))
    const factor = Math.pow(3, rDiff)
    eqNeeded += m.quantity / factor
    eqHave += (inventory[m.slug] ?? 0) / factor
  }
  const groupResinRange = estimateResinRange(
    mainMat.category,
    Math.ceil(eqNeeded),
    Math.floor(eqHave),
    { rarity: highestRarity, wl, resinMode },
  )

  return (
    <ItemTooltip 
      data={{ 
        name: `${familyName} (Grupo)`,
        icon: img ?? undefined, 
        rarity: mainMat.rarity ?? undefined, 
        category: mainMat.category, 
        description: `Materiais da mesma família. Cálculo de farm considera alquimia 3:1.`, 
        source: undefined,
        resinRange: groupResinRange,
        killsNeeded: familyKills ? { monsterName: familyKills.monsterName, kills: familyKills.kills, dropRate: familyKills.dropRate } : null,
        customFooter: (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
              {sortedMats.map(m => {
                const have = inventory[m.slug] ?? 0
                const miss = Math.max(0, m.quantity - have)
                return (
                  <div key={m.slug} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, color: miss > 0 ? '#fca5a5' : '#4ade80', background: 'rgba(0,0,0,0.2)', padding: '4px 8px', borderRadius: 4 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {m.icon && <img src={iconUrl(m.icon) || ''} alt="" width={20} height={20} style={{ borderRadius: 4 }} />}
                      {m.name}
                    </span>
                    <span>{have} / {m.quantity}</span>
                    <button 
                      className="btn-secondary" 
                      style={{ padding: '2px 6px', fontSize: 11, height: 22 }} 
                      onClick={(e) => { e.stopPropagation(); onEdit(m.slug); }}
                    >
                      Editar
                    </button>
                  </div>
                )
              })}
            </div>
            {isGlobalCapReached && (
              <div style={{ padding: 8, background: 'rgba(34, 197, 94, 0.2)', borderLeft: '3px solid #22c55e', color: '#b9f8cf', fontSize: 12, borderRadius: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle2 size={14} />
                <div><strong>Teto Global Atingido</strong><br/>Você já tem o suficiente de todos os tiers desta família.</div>
              </div>
            )}
            {canAlchemize && (
              <div style={{ padding: 8, background: 'rgba(59, 130, 246, 0.2)', borderLeft: '3px solid #3b82f6', color: '#bfdbfe', fontSize: 12, borderRadius: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                <FlaskConical size={14} />
                <div><strong>Pode usar Alquimia</strong><br/>Você tem tiers inferiores suficientes para craftar o que falta.</div>
              </div>
            )}
          </div>
        )
      }}
    >
      <div onClick={() => onEdit(mainMat.slug)} className={`ascension-item ${isComplete ? 'item-complete' : 'item-partial'}`} style={{ position: 'relative', overflow: 'hidden', cursor: 'pointer' }} title="Clique para editar o tier principal">
        {isGlobalCapReached && !isComplete && (
          <div style={{ position: 'absolute', top: 0, right: 0, background: '#22c55e', padding: '4px', borderBottomLeftRadius: '4px' }}>
            <CheckCircle2 size={12} color="#fff" />
          </div>
        )}
        {canAlchemize && (
          <div style={{ position: 'absolute', top: isGlobalCapReached ? '20px' : '0', right: 0, background: '#3b82f6', padding: '4px', borderBottomLeftRadius: '4px' }}>
            <FlaskConical size={12} color="#fff" />
          </div>
        )}

        <div className="ascension-icon">{img ? <img src={img} alt={mainMat.name} loading="lazy" /> : <span>?</span>}</div>
        <div className="ascension-info">
          <div className="ascension-name">
            {familyName} <span style={{ fontSize: 10, opacity: 0.6, marginLeft: 4 }}>(x{mats.length})</span>
            {isComplete && <span className="item-check">✓</span>}
          </div>
          <div className="ascension-meta">
            <span className="stars">{'★'.repeat(mainMat.rarity ?? 0)}</span>
          </div>
        </div>
        <div className="ascension-qty-group">
          <div className="ascension-qty">Total</div>
          {!isComplete && <div className="ascension-missing">falta {totalMissing.toLocaleString('pt-BR')}</div>}
          {isComplete && <div className="ascension-done">completo</div>}
        </div>
      </div>
    </ItemTooltip>
  )
}

function groupMaterials(mats: AggregateMaterial[], families: Record<string, string[]>): [string, AggregateMaterial[]][] {
  const groups = new Map<string, AggregateMaterial[]>()
  for (const m of mats) {
    const familyKey = Object.keys(families).find(k => families[k].includes(m.slug)) || m.slug
    if (!groups.has(familyKey)) groups.set(familyKey, [])
    groups.get(familyKey)!.push(m)
  }

  const sorted = Array.from(groups.entries()).sort((a, b) => {
    const keyA = a[0]
    const keyB = b[0]
    let indexA = SEELIE_ORDER_MAP.get(keyA) ?? SEELIE_ORDER_MAP.get(keyA.replace(/-/g, '_'))
    let indexB = SEELIE_ORDER_MAP.get(keyB) ?? SEELIE_ORDER_MAP.get(keyB.replace(/-/g, '_'))

    if (indexA === undefined && a[1].length > 0) {
      const slugA = a[1][0].slug
      indexA = SEELIE_ORDER_MAP.get(slugA) ?? SEELIE_ORDER_MAP.get(slugA.replace(/-/g, '_'))
    }
    if (indexB === undefined && b[1].length > 0) {
      const slugB = b[1][0].slug
      indexB = SEELIE_ORDER_MAP.get(slugB) ?? SEELIE_ORDER_MAP.get(slugB.replace(/-/g, '_'))
    }

    if (indexA !== undefined && indexB !== undefined) {
      if (indexA !== indexB) return indexA - indexB
      return a[1][0].name.localeCompare(b[1][0].name)
    }
    if (indexA !== undefined) return -1
    if (indexB !== undefined) return 1
    return keyA.localeCompare(keyB)
  })

  return sorted
}

export default function PlannerPage() {
  const { lang } = useLanguage()
  const roster = useRoster()
  const [seelieData, setSeelieData] = useState<SeelieData | null>(null)
  const [goodData, setGoodData] = useState<GoodData | null>(null)
  const [plan, setPlan] = useState<Plan | null>(null)
  const [plannerData, setPlannerData] = useState<PlannerData | null>(() => getPlannerDataOrNull())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [chars, setChars] = useState<Map<string, CharacterSummary>>(new Map())
  const [weapons, setWeapons] = useState<Map<string, WeaponSummary>>(new Map())
  const [currentResin, setCurrentResin] = useState(200)
  
  const [ar, setAr] = useState(() => loadPlannerSettings().ar)
  const [wl, setWl] = useState(() => loadPlannerSettings().wl)
  const [resinMode, setResinMode] = useState<20 | 40 | 60>(() => loadPlannerSettings().resinMode)
  const [showSettings, setShowSettings] = useState(false)
  const [showCharPicker, setShowCharPicker] = useState(false)
  const [charPickerMode, setCharPickerMode] = useState<'plan' | 'focus'>('plan')
  const [showUidModal, setShowUidModal] = useState(false)
  const [editingChar, setEditingChar] = useState<CharBreakdown | null>(null)
  const [editingCharInitialEdit, setEditingCharInitialEdit] = useState(false)
  const [editingItem, setEditingItem] = useState<string | null>(null)
  const [bestiary, setBestiary] = useState<BestiaryData | null>(null)
  const [focusSlugs, setFocusSlugs] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(FOCUS_STORAGE_KEY)
      if (!raw) return []
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
    } catch {
      return []
    }
  })
  const [showFocusPicker, setShowFocusPicker] = useState(false)
  const [focusSearch, setFocusSearch] = useState('')
  const [focusFilter, setFocusFilter] = useState<'all' | 'focused' | 'pending'>('all')
  const [onlyMissingMats, setOnlyMissingMats] = useState(false)

  useEffect(() => {
    if (!showFocusPicker) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setShowFocusPicker(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [showFocusPicker])

  useEffect(() => {
    try {
      if (focusSlugs.length > 0) localStorage.setItem(FOCUS_STORAGE_KEY, JSON.stringify(focusSlugs))
      else localStorage.removeItem(FOCUS_STORAGE_KEY)
    } catch {}
  }, [focusSlugs])

  useEffect(() => {
    getBestiaryData().then(setBestiary)
  }, [])

  useEffect(() => {
    const initialPlan = loadPlanFromStorage()
    if (initialPlan) setPlan(initialPlan)

    loadPlannerData().then((data) => {
      buildIndexes(data)
      setPlannerData(data)
      const cm = new Map<string, CharacterSummary>()
      for (const [slug, c] of Object.entries(data.characters)) {
        cm.set(slug, { slug, name: pickLang(c.name, lang), icon: c.icon, rarity: c.rarity, element: c.element as any, weapon_type: c.weapon_type as any, region: c.region as any })
      }
      setChars(cm)
      const wm = new Map<string, WeaponSummary>()
      for (const [slug, w] of Object.entries(data.weapons)) {
        wm.set(slug, { slug, name: pickLang(w.name, lang), icon: w.icon, rarity: w.rarity, weapon_type: w.weapon_type as any } as any)
      }
      setWeapons(wm)
      setPlan((prev) => (prev ? hydratePlanFromData(prev, data, lang) : loadPlanFromStorage(data, lang)))
    }).catch(e => setError(String(e)))
  }, [lang])

  useEffect(() => {
    const loadStoredState = () => {
      try {
        localStorage.removeItem('gsb.planner.v1')
        localStorage.removeItem('gsb.planner.v2')
        localStorage.removeItem('gsb.planner.v3')
        localStorage.removeItem('gsb.planner.v4')
      } catch {}
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          setSeelieData(parsed?.seelie ?? null)
          setGoodData(parsed?.good ?? null)
          setAr(parsed?.ar ?? parsed?.seelie?.ar ?? 60)
          setWl(parsed?.wl ?? parsed?.seelie?.wl ?? 9)
        } catch {
          localStorage.removeItem(STORAGE_KEY)
        }
      } else {
        setSeelieData(null)
        setGoodData(null)
      }
      const latestPlan = loadPlanFromStorage(getPlannerDataOrNull(), lang)
      if (latestPlan) setPlan(latestPlan)
    }

    loadStoredState()
    window.addEventListener(PLANNER_UPDATED_EVENT, loadStoredState)
    return () => window.removeEventListener(PLANNER_UPDATED_EVENT, loadStoredState)
  }, [lang])

  const saveToStorage = (s: SeelieData | null, g: GoodData | null, currentAr: number, currentWl: number) => {
    try {
      const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
      const toSave = s ? { ...s, ar: currentAr, wl: currentWl } : null
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          ...existing,
          ar: currentAr,
          wl: currentWl,
          seelie: toSave,
          good: g,
        }),
      )
    } catch {}
  }

  const handleSeelieFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null); setPlan(null)
    try {
      const text = await file.text()
      const parsed = JSON.parse(text) as SeelieData
      if (!Array.isArray(parsed.goals)) throw new Error('Arquivo inválido do Seelie (falta `goals`)')
      setSeelieData(parsed)
      setAr(parsed.ar ?? 60)
      setWl(parsed.wl ?? 9)
      saveToStorage(parsed, goodData, parsed.ar ?? 60, parsed.wl ?? 9)
    } catch (err) { setError(String(err)) }
  }

  const handleGoodFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null); setPlan(null)
    try {
      const text = await file.text()
      const parsed = JSON.parse(text) as GoodData
      const hasAnySection =
        Array.isArray(parsed.characters) ||
        Array.isArray(parsed.weapons) ||
        Array.isArray(parsed.artifacts) ||
        (parsed.materials && typeof parsed.materials === 'object')
      if (parsed.format !== 'GOOD' || !hasAnySection) {
        throw new Error('Arquivo não parece ser um export GOOD válido (falta `format: "GOOD"` ou dados)')
      }
      const mergedGood: GoodData = {
        ...(goodData ?? { format: 'GOOD', version: 2, source: parsed.source || 'GOOD' }),
        ...parsed,
        characters: Array.isArray(parsed.characters) ? parsed.characters : goodData?.characters ?? [],
        weapons: Array.isArray(parsed.weapons) ? parsed.weapons : goodData?.weapons ?? [],
        artifacts: Array.isArray(parsed.artifacts) ? parsed.artifacts : goodData?.artifacts ?? [],
        materials:
          parsed.materials && typeof parsed.materials === 'object'
            ? { ...(goodData?.materials ?? {}), ...parsed.materials }
            : goodData?.materials,
      }
      setGoodData(mergedGood)
      saveToStorage(seelieData, mergedGood, ar, wl)
    } catch (err) { setError(String(err)) }
  }

  const handleSaveSettings = (newAr: number, newWl: number, newResinMode: 20 | 40 | 60) => {
    setAr(newAr)
    setWl(newWl)
    setResinMode(newResinMode)
    saveToStorage(seelieData, goodData, newAr, newWl)
    try {
      const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...existing, ar: newAr, wl: newWl, resinMode: newResinMode }))
    } catch {}
    setShowSettings(false)
    if (plan) {
      const updated = recomputeAggregates({ ...plan, tier_groups: [] }, plan.inventory_resolved, newWl)
      setPlan(updated)
      savePlanToStorage(updated)
    }
  }

  const handleSaveItem = (slug: string, newQty: number) => {
    if (!plan) return
    const newInv = { ...plan.inventory_resolved, [slug]: newQty }
    const updated = recomputeAggregates({ ...plan, inventory_resolved: newInv }, newInv, wl)
    setPlan(updated)
    setEditingItem(null)
    savePlanToStorage(updated)
    syncInventoryItemToPlannerStorage(slug, newQty, plannerData)
  }

  const unaddedRosterSlugs = useMemo(() => {
    if (!plannerData) return []
    const existing = new Set((plan?.chars ?? []).map((c) => c.slug))
    return Object.keys(plannerData.characters).filter(
      (slug) => !existing.has(slug) && roster.get(slug).owned,
    )
  }, [plannerData, plan, roster])

  const toggleFocusSlug = (slug: string) => {
    setFocusSlugs((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]))
  }

  const clearFocus = () => {
    setFocusSlugs([])
    setShowFocusPicker(false)
  }

  const handleAddChar = (chosen: CharacterSummary) => {
    const mode = charPickerMode
    setShowCharPicker(false)
    setCharPickerMode('plan')
    if (!plannerData) return
    const r = roster.get(chosen.slug)
    const g = roster.getGoodState(chosen.slug)
    const res = addCharToPlan(plan, chosen.slug, plannerData, lang, wl, {
      currentLevel: g?.level ?? 1,
      goalLevel: Math.max(g?.level ?? 1, 90),
      cons: g?.cons ?? r.cons ?? 0,
      na: g ? { current: g.talents.na, goal: Math.max(g.talents.na, 1) } : undefined,
      es: g ? { current: g.talents.es, goal: Math.max(g.talents.es, 9) } : undefined,
      eb: g ? { current: g.talents.eb, goal: Math.max(g.talents.eb, 9) } : undefined,
      weapon: g?.weaponSlug ? { slug: g.weaponSlug, level: g.weaponLevel } : undefined,
    })
    if (res) {
      setPlan(res.plan)
      if (mode === 'focus') {
        setFocusSlugs((prev) => (prev.includes(chosen.slug) ? prev : [...prev, chosen.slug]))
      }
      setEditingChar(res.char)
      setEditingCharInitialEdit(res.added)
    }
  }

  const handleImportFromRoster = () => {
    if (!plannerData || unaddedRosterSlugs.length === 0) return
    let current = plan
    for (const slug of unaddedRosterSlugs) {
      const r = roster.get(slug)
      const g = roster.getGoodState(slug)
      const res = addCharToPlan(current, slug, plannerData, lang, wl, {
        currentLevel: g?.level ?? 1,
        goalLevel: Math.max(g?.level ?? 1, 90),
        cons: g?.cons ?? r.cons ?? 0,
        na: g ? { current: g.talents.na, goal: Math.max(g.talents.na, 1) } : undefined,
        es: g ? { current: g.talents.es, goal: Math.max(g.talents.es, 9) } : undefined,
        eb: g ? { current: g.talents.eb, goal: Math.max(g.talents.eb, 9) } : undefined,
        weapon: g?.weaponSlug ? { slug: g.weaponSlug, level: g.weaponLevel } : undefined,
      })
      if (res) current = res.plan
    }
    if (current) setPlan(current)
  }

  const handleUpdateChar = (newChar: CharBreakdown): boolean => {
    if (!plan) return false
    const newChars = plan.chars.map((c) => c.slug === newChar.slug ? newChar : c)
    const updated = recomputeAggregates({ ...plan, chars: newChars }, plan.inventory_resolved, wl)
    const v5Saved = syncCharEditToPlannerStorage(newChar)
    const planSaved = savePlanToStorage(updated)
    setPlan(updated)
    setEditingChar(newChar)
    return v5Saved || planSaved
  }

  const handleRemoveChar = (slug: string) => {
    if (!plan) return
    const updated = removeCharFromPlan(plan, slug, wl)
    setPlan(updated)
    setEditingChar(null)
    setEditingCharInitialEdit(false)
  }

  const handleCompute = async () => {
    if (!seelieData && !goodData) return
    if (chars.size === 0 || weapons.size === 0) {
      setError('Dados ainda carregando. Aguarde 1s e tente de novo.')
      return
    }
    setLoading(true); setError(null)

    try {
      const data = getPlannerData()
      const warnings: string[] = []
      const notMapped = new Set<string>()
      let travelersSkipped = 0

      const seelieChars = new Map<string, SeelieCharacterGoal>()
      const seelieTalents = new Map<string, SeelieTalentGoal>()
      const seelieWeapons = new Map<string, SeelieWeaponGoal[]>()

      if (seelieData) {
        const artifactGoals = seelieData.goals.filter((g) => g.type === 'artifact')
        if (artifactGoals.length > 0) warnings.push(`${artifactGoals.length} goal(s) de artefato ignorado(s)`)

        for (const g of seelieData.goals) {
          if (g.type === 'character') {
            const slug = resolveCharSlug(g.character)
            if (slug) seelieChars.set(slug, g)
            else notMapped.add(g.character)
          } else if (g.type === 'talent') {
            const slug = resolveCharSlug(g.character)
            if (slug) seelieTalents.set(slug, g)
            else notMapped.add(g.character)
          } else if (g.type === 'weapon' && g.character) {
            const slug = resolveCharSlug(g.character)
            const wSlug = resolveWeaponSlug(g.weapon)
            if (slug && wSlug) {
              if (!seelieWeapons.has(slug)) seelieWeapons.set(slug, [])
              seelieWeapons.get(slug)!.push({ ...g, weapon: wSlug })
            } else {
              notMapped.add(`${g.character}/${g.weapon}`)
            }
          }
        }
      }

      const goodMap = goodData ? parseGoodData(goodData) : new Map<string, GoodCharState>()

      const allSlugs = new Set<string>()
      seelieChars.forEach((_, k) => allSlugs.add(k))
      seelieTalents.forEach((_, k) => allSlugs.add(k))
      seelieWeapons.forEach((_, k) => allSlugs.add(k))
      goodMap.forEach((_, k) => allSlugs.add(k))

      interface ResolvedGoal {
        slug: string
        char_goal: SeelieCharacterGoal | null
        talent_goal: SeelieTalentGoal | null
        weapon_goals: SeelieWeaponGoal[]
      }
      const bySlug = new Map<string, ResolvedGoal>()

      for (const slug of allSlugs) {
        const sChar = seelieChars.get(slug)
        const sTal = seelieTalents.get(slug)
        const sWeapons = seelieWeapons.get(slug) || []
        const gState = goodMap.get(slug)

        if (!sChar && !gState && !sTal && sWeapons.length === 0) continue

        let currentLevel = sChar?.current.level ?? gState?.level ?? 1
        let goalLevel = sChar?.goal.level ?? gState?.level ?? 90
        let cons = gState?.cons ?? sChar?.cons ?? 0

        if (gState) {
          if (sChar && gState.level < sChar.current.level) {
            warnings.push(`GOOD desatualizado p/ ${slug}: nível ${gState.level} (GOOD) < ${sChar.current.level} (Seelie). Usando ${gState.level}.`)
          }
          currentLevel = gState.level
        }
        goalLevel = Math.max(currentLevel, goalLevel)

        const charGoal: SeelieCharacterGoal | null = (sChar || gState) ? {
          type: 'character', character: slug, id: sChar?.id ?? 0, cons,
          current: { level: currentLevel, asc: 0 },
          goal: { level: goalLevel, asc: 0 },
        } : null

        const na = sTal ? { ...sTal.normal } : { current: gState?.talents.na ?? 1, goal: gState?.talents.na ?? 1 }
        const es = sTal ? { ...sTal.skill } : { current: gState?.talents.es ?? 1, goal: gState?.talents.es ?? 1 }
        const eb = sTal ? { ...sTal.burst } : { current: gState?.talents.eb ?? 1, goal: gState?.talents.eb ?? 1 }

        if (gState) {
          na.current = gState.talents.na
          es.current = gState.talents.es
          eb.current = gState.talents.eb
        }
        na.goal = Math.max(na.current, na.goal)
        es.goal = Math.max(es.current, es.goal)
        eb.goal = Math.max(eb.current, eb.goal)

        const talentGoal: SeelieTalentGoal | null = (sTal || gState) ? {
          type: 'talent', character: slug, id: sTal?.id ?? 0,
          normal: na, skill: es, burst: eb,
        } : null

        const mergedWeapons: SeelieWeaponGoal[] = []
        for (const sw of sWeapons) {
          let currentWLevel = sw.current.level
          if (gState?.weaponSlug === sw.weapon) {
            currentWLevel = gState.weaponLevel
          }
          mergedWeapons.push({
            ...sw,
            current: { ...sw.current, level: currentWLevel },
            goal: { ...sw.goal, level: Math.max(currentWLevel, sw.goal.level) },
          })
        }

        if (gState?.weaponSlug && !mergedWeapons.some(w => w.weapon === gState.weaponSlug)) {
          mergedWeapons.push({
            type: 'weapon', character: slug, weapon: gState.weaponSlug, id: 0,
            current: { level: gState.weaponLevel, asc: 0 },
            goal: { level: gState.weaponLevel, asc: 0 },
          })
        }

        bySlug.set(slug, { slug, char_goal: charGoal, talent_goal: talentGoal, weapon_goals: mergedWeapons })
      }

      const ascMap = new Map<string, AscensionCost>()
      const talMap = new Map<string, TalentCost>()
      const weaponAscMap = new Map<string, WeaponAscensionResponse>()
      let weaponsProcessed = 0

      for (const [slug, g] of bySlug.entries()) {
        if (
          g.char_goal &&
          (g.char_goal.current.level < g.char_goal.goal.level ||
            (g.char_goal.current.asc ?? 0) < (g.char_goal.goal.asc ?? 0))
        ) {
          ascMap.set(
            slug,
            computeAscensionCost(data, slug, g.char_goal.current.level, g.char_goal.goal.level, lang, {
              fromAsc: g.char_goal.current.asc,
              toAsc: g.char_goal.goal.asc,
            }) as any,
          )
        }
        if (g.talent_goal) {
          talMap.set(slug, computeTalentCost(data, slug, g.talent_goal.normal, g.talent_goal.skill, g.talent_goal.burst, lang) as any)
        }
        for (const wg of g.weapon_goals) {
          if (wg.current.level < wg.goal.level || (wg.current.asc ?? 0) < (wg.goal.asc ?? 0)) {
            weaponAscMap.set(
              `${slug}::${wg.weapon}`,
              computeWeaponAscension(data, wg.weapon, wg.current.level, wg.goal.level, lang, {
                fromAsc: wg.current.asc,
                toAsc: wg.goal.asc,
              }) as any,
            )
            weaponsProcessed++
          }
        }
      }

      const grand_mats = new Map<string, AggregateMaterial>()
      let grand_mora = 0
      const charBreakdowns: CharBreakdown[] = []

      for (const [slug, g] of bySlug.entries()) {
        const char = chars.get(slug)
        const ascension = ascMap.get(slug) ?? null
        const talents = talMap.get(slug) ?? null
        const weaponBreakdowns: WeaponBreakdown[] = []

        for (const wg of g.weapon_goals) {
          const wInfo = weapons.get(wg.weapon)
          const cost = weaponAscMap.get(`${slug}::${wg.weapon}`) ?? null
          weaponBreakdowns.push({
            slug: wg.weapon, name: wInfo?.name ?? wg.weapon, icon: wInfo?.icon ?? null,
            rarity: wInfo?.rarity ?? 4, from_level: wg.current.level, to_level: wg.goal.level, cost,
          })
        }

        let displayName = char?.name || slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

        charBreakdowns.push({
          slug, name: displayName, icon: char?.icon ?? null,
          ascension, talents, weapons: weaponBreakdowns,
          char_goal: g.char_goal, talent_goal: g.talent_goal,
        })

        if (ascension) { grand_mora += ascension.total_mora; mergeMats(grand_mats, ascension.materials) }
        if (talents) { grand_mora += talents.grand_total_mora; mergeMats(grand_mats, talents.grand_total_materials) }
        for (const wb of weaponBreakdowns) {
          if (wb.cost) { grand_mora += wb.cost.total_mora; mergeMats(grand_mats, wb.cost.materials) }
        }
      }

      charBreakdowns.sort((a, b) => {
        const costA = (a.ascension?.total_mora ?? 0) + (a.talents?.grand_total_mora ?? 0) + a.weapons.reduce((s, w) => s + (w.cost?.total_mora ?? 0), 0)
        const costB = (b.ascension?.total_mora ?? 0) + (b.talents?.grand_total_mora ?? 0) + b.weapons.reduce((s, w) => s + (w.cost?.total_mora ?? 0), 0)
        return costB - costA
      })

      const invRaw = (seelieData?.inventory || []) as SeelieInventoryItem[]
      
      const fullCatalog = Object.entries(data.materials).map(([slug, m]) => ({ ...m, slug }))
      const invResolved: Record<string, number> = {}
      const invStats = { mapped: 0, unmapped: 0, ambiguous: 0, total: invRaw.length }
      
      let solvents = 0
      if (invRaw.length > 0) {
        const direct = resolveInventory(invRaw, fullCatalog, data.families)
        Object.assign(invResolved, direct.resolved)
        invStats.mapped = Object.keys(direct.resolved).length
        invStats.ambiguous = direct.ambiguous.length
        invStats.unmapped = direct.unmapped.length

        const solventItem = invRaw.find(i => i.item === 'dream_solvent')
        if (solventItem) solvents = solventItem.value
      }
      if (goodData?.materials && typeof goodData.materials === 'object') {
        const goodMat = resolveGoodMaterials(goodData.materials, fullCatalog)
        Object.assign(invResolved, goodMat.resolved)
        invStats.mapped = Object.keys(invResolved).length
        if (goodMat.resolved['dream-solvent'] != null) {
          solvents = goodMat.resolved['dream-solvent']
        }
      }
      // Preserva edições manuais de inventário sobre o JSON
      Object.assign(invResolved, loadManualInventory())

      const allMats = Array.from(grand_mats.values())
      const normalMats = allMats.filter(m => m.category === 'boss_material' && !m.is_weekly)
      const weeklyMats = allMats.filter(m => m.is_weekly)

      const tierGroups: TierGroup[] = TIERS.map((tier) => {
        if (tier.key === 'boss40') {
          return { tier: { ...tier, label: 'Boss Normal' }, materials: normalMats, resin_total: normalMats.reduce((s, m) => s + m.resin_estimate, 0) }
        }
        if (tier.key === 'weekly') {
          return { tier, materials: weeklyMats, resin_total: weeklyMats.reduce((s, m) => s + m.resin_estimate, 0) }
        }
        
        const mats = allMats
          .filter((m) => tierOf(m.category).key === tier.key && m.category !== 'boss_material' && !m.is_weekly)
          .sort((a, b) => b.resin_estimate - a.resin_estimate || a.name.localeCompare(b.name))
        return { tier, materials: mats, resin_total: mats.reduce((s, m) => s + m.resin_estimate, 0) }
      }).filter((tg) => tg.materials.length > 0)

      const grand_resin = tierGroups.reduce((s, tg) => s + tg.resin_total, 0)
      let materialsComplete = 0, materialsPartial = 0
      for (const m of allMats) {
        const have = invResolved[m.slug] ?? 0
        if (have >= m.quantity) materialsComplete++
        else if (have > 0) materialsPartial++
      }

      const inactiveMap = (seelieData?.inactive as Record<string, boolean>) || {}
      for (const c of charBreakdowns) {
        c.is_inactive = !!inactiveMap[c.slug]
        c.has_ascension_pending = !!(c.char_goal && c.char_goal.current.level < c.char_goal.goal.level)
        c.has_talent_pending = !!(c.talent_goal && (
          c.talent_goal.normal.current < c.talent_goal.normal.goal ||
          c.talent_goal.skill.current < c.talent_goal.skill.goal ||
          c.talent_goal.burst.current < c.talent_goal.burst.goal
        ))
        c.has_weapon_pending = c.weapons.some((w) => w.from_level < w.to_level)
        c.is_complete = !c.is_inactive && !c.has_ascension_pending && !c.has_talent_pending && !c.has_weapon_pending
      }

      const finalPlan: Plan = {
        chars: charBreakdowns, grand_mora, grand_resin, tier_groups: tierGroups, warnings,
        not_mapped: Array.from(notMapped).sort(), travelers_skipped: travelersSkipped,
        weapons_processed: weaponsProcessed, weapons_skipped: 0,
        inventory_resolved: invResolved, inventory_stats: invStats,
        materials_complete: materialsComplete, materials_partial: materialsPartial,
      }

      const finalPlanWl = recomputeAggregates(finalPlan, invResolved, wl)
      setPlan(finalPlanWl)
      savePlanToStorage(finalPlanWl)

    } catch (err) { setError(String(err)) } finally { setLoading(false) }
  }

  const handleClear = () => {
    if (!confirm('Limpar todo o plano e as importações atuais?')) return
    setSeelieData(null); setGoodData(null); setPlan(null); setFocusSlugs([])
    localStorage.removeItem(STORAGE_KEY); localStorage.removeItem('gsb.planner.plan'); localStorage.removeItem(FOCUS_STORAGE_KEY); setError(null)
  }

  const summary = useMemo(() => {
    if (!seelieData && !goodData) return null
    return {
      seelieChars: seelieData?.goals.filter((g) => g.type === 'character').length ?? 0,
      seelieTalents: seelieData?.goals.filter((g) => g.type === 'talent').length ?? 0,
      seelieWeapons: seelieData?.goals.filter((g) => g.type === 'weapon').length ?? 0,
      inventory: (seelieData?.inventory?.length ?? 0) + Object.keys(goodData?.materials ?? {}).length,
      goodChars: goodData?.characters?.length ?? 0,
    }
  }, [seelieData, goodData])

  const hasActivePlan = !!(plan && plan.chars.length > 0)
  const existingSlugs = useMemo(() => (plan?.chars ?? []).map((c) => c.slug), [plan])

  const focusedChars = useMemo(() => {
    if (!plan || focusSlugs.length === 0) return []
    const bySlug = new Map(plan.chars.map((c) => [c.slug, c]))
    return focusSlugs.map((s) => bySlug.get(s)).filter((c): c is CharBreakdown => Boolean(c))
  }, [plan, focusSlugs])

  const isFocusMode = focusedChars.length > 0

  const displayPlan = useMemo(() => {
    if (!plan) return null
    if (!isFocusMode) return plan
    const focusedSubPlan: Plan = {
      ...plan,
      chars: focusedChars.map((c) => ({ ...c, is_inactive: false })),
    }
    return recomputeAggregates(focusedSubPlan, plan.inventory_resolved, wl)
  }, [plan, isFocusMode, focusedChars, wl])

  const displayXpTotals = useMemo(() => {
    if (!displayPlan) {
      return {
        heroWits: 0, ore: 0, heroWitsHave: 0, oreHave: 0,
        purple: 0, blue: 0, green: 0,
        mysticOres: 0, fineOres: 0, enhancementOres: 0,
      }
    }
    let heroWits = 0
    let ore = 0
    for (const c of displayPlan.chars) {
      if (c.is_inactive) continue
      const xp = getXpMaterials(c, wl)
      heroWits += xp.heroWits
      ore += xp.ore
    }
    const inv = displayPlan.inventory_resolved
    const ownedXp = getOwnedCharXp(inv)
    const ownedWeaponXp = getOwnedWeaponXp(inv)
    return {
      heroWits,
      ore,
      heroWitsHave: ownedXp.heroWitEquivalent,
      oreHave: ownedWeaponXp.mysticOreEquivalent,
      purple: ownedXp.heroWits,
      blue: ownedXp.adventurerExp,
      green: ownedXp.wandererAdvice,
      mysticOres: ownedWeaponXp.mysticOres,
      fineOres: ownedWeaponXp.fineOres,
      enhancementOres: ownedWeaponXp.enhancementOres,
    }
  }, [displayPlan, wl])

  const focusPickerOptions = useMemo(() => {
    if (!plan) return []
    const q = focusSearch.trim().toLowerCase()
    const focusSet = new Set(focusSlugs)
    return [...plan.chars]
      .filter((c) => {
        if (q && !c.name.toLowerCase().includes(q) && !c.slug.includes(q)) return false
        if (focusFilter === 'focused') return focusSet.has(c.slug)
        if (focusFilter === 'pending') return !c.is_complete
        return true
      })
      .sort((a, b) => {
        const aFocused = focusSet.has(a.slug) ? 0 : 1
        const bFocused = focusSet.has(b.slug) ? 0 : 1
        if (aFocused !== bFocused) return aFocused - bFocused
        return a.name.localeCompare(b.name)
      })
  }, [plan, focusSearch, focusSlugs, focusFilter])

  const jsonImportSection = (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginBottom: '16px' }}>
        <div className="import-card" style={{ borderColor: seelieData ? 'var(--primary)' : 'transparent' }}>
          <h2><CheckCircle2 size={18} style={{ display: 'inline', marginRight: 8, verticalAlign: 'text-bottom' }}/> Seelie (Metas)</h2>
          {seelieData ? (
            <p style={{ color: '#4ade80' }}>Importado com sucesso.</p>
          ) : (
            <>
              <p className="muted" style={{ fontSize: '14px', marginBottom: 12 }}>Opcional: importa metas de nível/talentos e inventário do Seelie.</p>
              <input type="file" accept=".json" onChange={handleSeelieFile} className="file-input" />
            </>
          )}
        </div>

        <div className="import-card" style={{ borderColor: goodData ? 'var(--primary)' : 'transparent' }}>
          <h2><CheckCircle2 size={18} style={{ display: 'inline', marginRight: 8, verticalAlign: 'text-bottom' }}/> GOOD (Estado Atual)</h2>
          {goodData ? (
            <p style={{ color: '#4ade80' }}>Importado com sucesso.</p>
          ) : (
            <>
              <p className="muted" style={{ fontSize: '14px', marginBottom: 12 }}>Opcional: sincroniza o nível real dos personagens e armas via scanner.</p>
              <input type="file" accept=".json" onChange={handleGoodFile} className="file-input" />
            </>
          )}
        </div>
      </div>

      {(seelieData || goodData) && summary && (
        <div style={{ marginBottom: 20 }}>
          <div className="import-summary">
            <div><strong>{summary.goodChars}</strong> chars no GOOD</div>
            <div><strong>{summary.seelieChars}</strong> metas (Seelie)</div>
            <div><strong>{summary.inventory}</strong> itens no inv.</div>
          </div>

          <button
            className="btn-primary"
            onClick={handleCompute}
            disabled={loading || chars.size === 0 || weapons.size === 0}
            style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            <Calculator size={16} />
            {loading ? 'Calculando...' : chars.size === 0 ? 'Carregando dados...' : 'Calcular / sincronizar plano do JSON'}
          </button>
        </div>
      )}
    </>
  )

  return (
    <div>
      <div className="page-header" style={{ flexWrap: 'wrap', gap: 12 }}>
        <h1>Planejador</h1>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            className="btn-primary"
            onClick={() => setShowCharPicker(true)}
            disabled={!plannerData}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Plus size={16} /> Adicionar personagem
          </button>
          <button
            className="btn-secondary"
            onClick={() => setShowUidModal(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <UserCheck size={16} /> Importar por UID
          </button>
          <button className="btn-secondary" onClick={() => setShowSettings(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Settings size={16} /> AR {ar} / WL {wl} · {resinMode}⚡
          </button>
          {(hasActivePlan || seelieData || goodData) && (
            <button className="btn-danger" onClick={handleClear}>Limpar plano</button>
          )}
        </div>
      </div>

      {!hasActivePlan && (
        <div
          className="import-card"
          style={{
            marginBottom: 20,
            borderColor: 'rgba(125, 211, 252, 0.35)',
            background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.08), rgba(15, 23, 42, 0.65))',
          }}
        >
          <h2 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Plus size={18} /> Comece do zero — sem precisar de JSON
          </h2>
          <p className="muted" style={{ fontSize: 14, marginBottom: 16 }}>
            Adicione personagens manualmente ou informe seu <strong>UID do Genshin</strong> para puxar automaticamente nível, talentos e armas da sua vitrine pública.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button
              className="btn-primary"
              onClick={() => setShowCharPicker(true)}
              disabled={!plannerData}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Plus size={16} /> {plannerData ? 'Adicionar primeiro personagem' : 'Carregando dados...'}
            </button>
            <button
              className="btn-secondary"
              onClick={() => setShowUidModal(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <UserCheck size={16} /> Importar por UID (Enka)
            </button>
            {unaddedRosterSlugs.length > 0 && (
              <button
                className="btn-secondary"
                onClick={handleImportFromRoster}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <Download size={16} /> Importar do Meu Roster ({unaddedRosterSlugs.length})
              </button>
            )}
          </div>
        </div>
      )}

      {hasActivePlan ? (
        <details className="planner-warnings" style={{ marginBottom: 20, background: 'rgba(15, 23, 42, 0.5)', borderColor: 'rgba(148, 163, 184, 0.25)' }}>
          <summary style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: '#cbd5e1' }}>
            <Upload size={15} /> Importação rápida via JSON (Seelie / GOOD — opcional)
            {unaddedRosterSlugs.length > 0 && (
              <span style={{ marginLeft: 'auto', fontSize: 12, color: '#7dd3fc' }}>
                +{unaddedRosterSlugs.length} no Roster
              </span>
            )}
          </summary>
          <div style={{ marginTop: 14 }}>
            {unaddedRosterSlugs.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <button
                  className="btn-secondary"
                  onClick={handleImportFromRoster}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <Download size={15} /> Trazer personagens restantes do Meu Roster (+{unaddedRosterSlugs.length})
                </button>
              </div>
            )}
            {jsonImportSection}
          </div>
        </details>
      ) : (
        <div style={{ marginBottom: 24 }}>
          <p className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
            Ou, se já usa scanner/planejador externo, importe os arquivos abaixo (opcional):
          </p>
          {jsonImportSection}
        </div>
      )}

      {error && <p className="error">Erro: {error}</p>}

      {hasActivePlan && plan && displayPlan && (
        <>
          {plan.warnings.length > 0 && (
            <details className="planner-warnings">
              <summary>{plan.warnings.length} aviso(s) — clique para expandir</summary>
              {plan.warnings.map((w, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertTriangle size={14} /> {w}
                </div>
              ))}
            </details>
          )}

          {/* Barra de Foco de Farm */}
          <section className={`planner-focus-bar ${isFocusMode ? 'is-active' : ''}`}>
            <div className="planner-focus-head">
              <div className="planner-focus-title-wrap">
                <span className="planner-focus-title">
                  <Target size={16} /> Foco de Farm
                </span>
                {isFocusMode ? (
                  <span className="planner-focus-badge is-focused">
                    Focando em {focusedChars.length} {focusedChars.length === 1 ? 'personagem' : 'personagens'}
                  </span>
                ) : (
                  <span className="planner-focus-badge">
                    Todos os ativos ({plan.chars.filter((c) => !c.is_inactive).length})
                  </span>
                )}
              </div>

              <div className="planner-focus-actions">
                <button
                  type="button"
                  className="planner-focus-btn is-accent"
                  onClick={() => {
                    setFocusSearch('')
                    setFocusFilter('all')
                    setShowFocusPicker(true)
                  }}
                >
                  <Target size={14} /> Escolher personagens
                </button>
                <button
                  type="button"
                  className="planner-focus-btn"
                  disabled={!plannerData}
                  onClick={() => {
                    setCharPickerMode('focus')
                    setShowCharPicker(true)
                  }}
                  title="Adicionar um personagem novo ao plano e já colocar no foco"
                >
                  <Plus size={14} /> Novo personagem no foco
                </button>
                {isFocusMode && (
                  <button
                    type="button"
                    className="planner-focus-btn is-clear"
                    onClick={clearFocus}
                  >
                    <X size={14} /> Ver todos
                  </button>
                )}
              </div>
            </div>

            {isFocusMode ? (
              <div className="planner-focus-selected">
                {focusedChars.map((c) => {
                  const curLv = c.char_goal?.current?.level ?? 1
                  const goalLv = c.char_goal?.goal?.level ?? 90
                  const tGoal = c.talent_goal
                  const talStr = tGoal
                    ? `${tGoal.normal?.current ?? 1}/${tGoal.skill?.current ?? 1}/${tGoal.burst?.current ?? 1} → ${tGoal.normal?.goal ?? 1}/${tGoal.skill?.goal ?? 1}/${tGoal.burst?.goal ?? 1}`
                    : null
                  return (
                    <div key={c.slug} className="planner-focus-chip">
                      <button
                        type="button"
                        className="planner-focus-chip-main"
                        onClick={() => {
                          setEditingChar(c)
                          setEditingCharInitialEdit(false)
                        }}
                        title={`Editar metas de ${c.name}`}
                      >
                        {iconUrl(c.icon) && <img src={iconUrl(c.icon)!} alt={c.name} />}
                        <span className="planner-focus-chip-info">
                          <strong>{c.name}</strong>
                          <small>
                            Nv. {curLv}→{goalLv}
                            {talStr ? ` · Tal. ${talStr}` : ''}
                          </small>
                        </span>
                        <Pencil size={12} className="planner-focus-chip-edit" />
                      </button>
                      <button
                        type="button"
                        className="planner-focus-chip-remove"
                        onClick={() => toggleFocusSlug(c.slug)}
                        aria-label={`Remover ${c.name} do foco`}
                        title="Remover do foco"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="planner-focus-hint">
                Selecione 1 ou mais personagens (ex.: Linnea, Noelle e Chiori) para filtrar Mora, Resina, Livros de XP, Domínios de Hoje e Materiais faltantes apenas para eles.
              </p>
            )}
          </section>

          <div className="planner-stats">
            {(() => {
              const moraHave = displayPlan.inventory_resolved['mora'] ?? 0
              const moraMissing = Math.max(0, displayPlan.grand_mora - moraHave)
              const moraRange = estimateResinRange('mora', displayPlan.grand_mora, moraHave, { wl, resinMode })
              return (
                <ItemTooltip
                  data={{
                    name: 'Mora',
                    icon: iconUrl('UI_ItemIcon_202'),
                    rarity: 3,
                    category: 'mora',
                    source: 'Linha Ley — Flor da Riqueza (clique no card para informar sua Mora)',
                    resinRange: moraRange,
                  }}
                >
                  <button
                    type="button"
                    className="planner-stat is-editable"
                    onClick={() => setEditingItem('mora')}
                  >
                    <div className="planner-stat-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <Coins size={14} /> {isFocusMode ? 'Mora (no foco)' : 'Mora total'}
                      </span>
                      <Pencil size={12} className="planner-stat-edit-icon" />
                    </div>
                    <div className="planner-stat-value mora">{formatResin(displayPlan.grand_mora)}</div>
                    <small className="planner-stat-sub">
                      {moraHave > 0
                        ? moraMissing === 0
                          ? `✓ Você tem ${formatResin(moraHave)}`
                          : `Tem ${formatResin(moraHave)} · falta ${formatResin(moraMissing)}`
                        : 'Clique para informar sua Mora'}
                    </small>
                  </button>
                </ItemTooltip>
              )
            })()}
            <div className="planner-stat">
              <div className="planner-stat-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Zap size={14} /> {isFocusMode ? 'Resina (no foco)' : 'Resina estimada'}
              </div>
              <div className="planner-stat-value resin">{formatResin(displayPlan.grand_resin)} ⚡</div>
            </div>
            {(() => {
              const xpRange = estimateResinRange('character_exp', displayXpTotals.heroWits, displayXpTotals.heroWitsHave, { rarity: 4, wl, resinMode })
              const xpMissing = Math.max(0, displayXpTotals.heroWits - displayXpTotals.heroWitsHave)
              return (
                <ItemTooltip
                  data={{
                    name: "Livros de XP (eq. Hero's Wit)",
                    icon: iconUrl('UI_ItemIcon_104003'),
                    rarity: 4,
                    category: 'character_exp',
                    source: 'Linha Ley — Flor da Revelação (soma livros Roxo 20k + Azul 5k + Verde 1k)',
                    resinRange: xpRange,
                  }}
                >
                  <div className="planner-stat is-editable" onClick={() => setEditingItem('hero-s-wit')}>
                    <div className="planner-stat-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <BookOpen size={14} /> Livros XP (eq. 20k)
                      </span>
                      <Pencil size={12} className="planner-stat-edit-icon" />
                    </div>
                    <div className="planner-stat-value" style={{ color: '#c4b5fd' }}>
                      {displayXpTotals.heroWits.toLocaleString('pt-BR')}
                    </div>
                    <small className="planner-stat-sub">
                      {displayXpTotals.heroWitsHave > 0
                        ? xpMissing === 0
                          ? `✓ Eq. ${displayXpTotals.heroWitsHave.toLocaleString('pt-BR')} livros`
                          : `Eq. ${displayXpTotals.heroWitsHave.toLocaleString('pt-BR')} · falta ${xpMissing.toLocaleString('pt-BR')}`
                        : 'Clique nos livros abaixo para informar'}
                    </small>
                    <div className="planner-xp-pills" onClick={(e) => e.stopPropagation()}>
                      <button type="button" className="planner-xp-pill is-purple" onClick={() => setEditingItem('hero-s-wit')} title="Experiência do Herói (20k XP)">
                        <img src={iconUrl('UI_ItemIcon_104003')!} alt="Roxo" />
                        <span>{displayXpTotals.purple}</span>
                      </button>
                      <button type="button" className="planner-xp-pill is-blue" onClick={() => setEditingItem('adventurer-s-experience')} title="Experiência do Aventureiro (5k XP)">
                        <img src={iconUrl('UI_ItemIcon_104002')!} alt="Azul" />
                        <span>{displayXpTotals.blue}</span>
                      </button>
                      <button type="button" className="planner-xp-pill is-green" onClick={() => setEditingItem('wanderer-s-advice')} title="Conselho do Andarilho (1k XP)">
                        <img src={iconUrl('UI_ItemIcon_104001')!} alt="Verde" />
                        <span>{displayXpTotals.green}</span>
                      </button>
                    </div>
                  </div>
                </ItemTooltip>
              )
            })()}
            {(() => {
              const oreMissing = Math.max(0, displayXpTotals.ore - displayXpTotals.oreHave)
              return (
                <ItemTooltip
                  data={{
                    name: 'Minérios de Refinamento (eq. Místico 10k)',
                    icon: iconUrl('UI_ItemIcon_104012'),
                    rarity: 3,
                    category: 'weapon_exp',
                    source: 'Ferreiro / Expedições / Baús (soma Místico 10k + Fino 2k + Comum 400)',
                    resinRange: estimateResinRange('weapon_exp', displayXpTotals.ore, displayXpTotals.oreHave, { rarity: 3, wl, resinMode }),
                  }}
                >
                  <div className="planner-stat is-editable" onClick={() => setEditingItem('mystic-enhancement-ore')}>
                    <div className="planner-stat-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <Sword size={14} /> XP Arma (eq. 10k)
                      </span>
                      <Pencil size={12} className="planner-stat-edit-icon" />
                    </div>
                    <div className="planner-stat-value" style={{ color: '#67e8f9' }}>
                      {displayXpTotals.ore.toLocaleString('pt-BR')}
                    </div>
                    <small className="planner-stat-sub">
                      {displayXpTotals.oreHave > 0
                        ? oreMissing === 0
                          ? `✓ Eq. ${displayXpTotals.oreHave.toLocaleString('pt-BR')} místico(s)`
                          : `Eq. ${displayXpTotals.oreHave.toLocaleString('pt-BR')} · falta ${oreMissing.toLocaleString('pt-BR')}`
                        : 'Clique nos minérios abaixo para informar'}
                    </small>
                    <div className="planner-xp-pills" onClick={(e) => e.stopPropagation()}>
                      <button type="button" className="planner-xp-pill is-purple" onClick={() => setEditingItem('mystic-enhancement-ore')} title="Minério de Refinamento Místico (10k XP)">
                        <img src={iconUrl('UI_ItemIcon_104012')!} alt="Místico" />
                        <span>{displayXpTotals.mysticOres}</span>
                      </button>
                      <button type="button" className="planner-xp-pill is-blue" onClick={() => setEditingItem('fine-enhancement-ore')} title="Minério de Refinamento Fino (2k XP)">
                        <img src={iconUrl('UI_ItemIcon_104011')!} alt="Fino" />
                        <span>{displayXpTotals.fineOres}</span>
                      </button>
                      <button type="button" className="planner-xp-pill is-green" onClick={() => setEditingItem('enhancement-ore')} title="Minério de Refinamento (400 XP)">
                        <img src={iconUrl('UI_ItemIcon_104011')!} alt="Comum" style={{ filter: 'saturate(0.25) brightness(1.05)' }} />
                        <span>{displayXpTotals.enhancementOres}</span>
                      </button>
                    </div>
                  </div>
                </ItemTooltip>
              )
            })()}
            <div className="planner-stat">
              <div className="planner-stat-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Users size={14} /> {isFocusMode ? 'No foco / Total' : 'Personagens'}
              </div>
              <div className="planner-stat-value">
                {isFocusMode ? `${focusedChars.length} / ${plan.chars.length}` : plan.chars.length}
              </div>
            </div>
          </div>

          <Link to="/planner/characters" className="planner-view-chars-cta" style={{ marginTop: 24, marginBottom: 24 }}>
            <div className="planner-view-chars-icon" style={{ color: '#7dd3fc' }}><ClipboardList size={32} /></div>
            <div className="planner-view-chars-text">
              <div className="planner-view-chars-title">Ver {plan.chars.length} personagens em detalhes</div>
              <div className="planner-view-chars-desc">Cards com portrait, talentos, materiais e dias de farm por personagem</div>
            </div>
            <div className="planner-view-chars-arrow">→</div>
          </Link>

          <div className="resin-counter">
            <label>Resina atual: <input type="number" min={0} max={2000} value={currentResin} onChange={(e) => setCurrentResin(Math.max(0, parseInt(e.target.value) || 0))} /></label>
            <div className="resin-days">
              Falta{isFocusMode ? ' (foco)' : ''}: <strong>{formatDays(Math.max(0, displayPlan.grand_resin - currentResin))}</strong>
              <span className="resin-hint">({formatResin(Math.max(0, displayPlan.grand_resin - currentResin))} ⚡ @ 180/dia)</span>
            </div>
          </div>

          {plannerData && (
            <TodayFarmWidget
              plan={displayPlan}
              data={plannerData}
              wl={wl}
              resinMode={resinMode}
              onEditMaterial={(slug) => setEditingItem(slug)}
            />
          )}

          <div className="planner-mats-header">
            <h2 style={{ margin: 0 }}>
              Materiais por resina{isFocusMode ? ` — Foco (${focusedChars.map((c) => c.name).join(', ')})` : ''}
            </h2>
            <button
              type="button"
              className={`planner-focus-btn ${onlyMissingMats ? 'is-accent' : ''}`}
              onClick={() => setOnlyMissingMats((v) => !v)}
            >
              <Filter size={13} /> {onlyMissingMats ? 'Mostrando só o que falta' : 'Mostrar só o que falta'}
            </button>
          </div>
          
          {plannerData ? (() => {
             const data = plannerData
             let solvents = 0
             const invRaw = (seelieData?.inventory || []) as SeelieInventoryItem[]
             const solventItem = invRaw.find(i => i.item === 'dream_solvent')
             if (solventItem) solvents = solventItem.value

             if (displayPlan.tier_groups.length === 0) {
               return (
                 <p className="status">
                   {isFocusMode
                     ? 'Os personagens em foco já atingiram suas metas atuais! Clique no card do personagem acima para ajustar nível/talentos.'
                     : 'Todos os personagens ativos deste plano já atingiram suas metas!'}
                 </p>
               )
             }

             const renderedGroups = displayPlan.tier_groups
               .map((tg) => {
                 const groupedMats = groupMaterials(tg.materials, data.families)
                 const visibleMats = onlyMissingMats
                   ? groupedMats.filter(([, mats]) =>
                       mats.some((m) => (displayPlan.inventory_resolved[m.slug] ?? 0) < m.quantity),
                     )
                   : groupedMats
                 return { tg, visibleMats }
               })
               .filter(({ visibleMats }) => visibleMats.length > 0)

             if (renderedGroups.length === 0) {
               return <p className="status">Você já possui todos os materiais necessários no inventário para essas metas!</p>
             }

             return renderedGroups.map(({ tg, visibleMats }) => (
                <details key={tg.tier.key} className="tier-group" open>
                  <summary>
                    <span className="tier-title">
                      <span className="tier-emoji" style={{ display: 'flex', alignItems: 'center' }}>
                        {TIER_ICONS[tg.tier.key] || <Star size={18} />}
                      </span>
                      <span style={{ color: tg.tier.color }}>{tg.tier.label}</span>
                    </span>
                    <span className="tier-meta">{visibleMats.length} grupo(s) {tg.resin_total > 0 && ` · ≈${formatResin(tg.resin_total)} ⚡`}</span>
                  </summary>
                  <div className="ascension-grid">
                    {visibleMats.map(([key, mats]) => {
                      const family = data.families[key]
                      return (
                        <MaterialGroupCard 
                          key={key} 
                          mats={mats} 
                          inventory={displayPlan.inventory_resolved}
                          globalMax={data.global_max}
                          family={family}
                          solvents={solvents}
                          isWeekly={tg.tier.key === 'weekly'}
                          onEdit={(slug) => setEditingItem(slug)}
                          wl={wl}
                          resinMode={resinMode}
                          bestiary={bestiary}
                        />
                      )
                    })}
                  </div>
                </details>
              ))
          })() : (
            <p className="status">Carregando catálogo de materiais...</p>
          )}
        </>
      )}

      {showFocusPicker && plan && (
        <div className="plan-modal-overlay" onClick={() => setShowFocusPicker(false)}>
          <div className="plan-modal planner-focus-modal" onClick={(e) => e.stopPropagation()}>
            <div className="plan-modal-header">
              <div className="plan-modal-header-info">
                <h2 className="plan-modal-name" style={{ fontSize: 18, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <Target size={18} /> Escolher Personagens em Foco
                </h2>
                <p className="muted" style={{ margin: '3px 0 0', fontSize: 12.5 }}>
                  Clique nos personagens que deseja priorizar agora ({focusedChars.length} selecionado{focusedChars.length === 1 ? '' : 's'}).
                </p>
              </div>
              <div className="plan-modal-header-actions">
                <button
                  type="button"
                  className="plan-modal-close"
                  onClick={() => setShowFocusPicker(false)}
                  title="Fechar (Esc)"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="planner-focus-modal-body">
              <div className="planner-focus-modal-toolbar">
                <div className="planner-focus-search">
                  <Search size={14} />
                  <input
                    type="text"
                    autoFocus
                    placeholder="Buscar personagem no plano..."
                    value={focusSearch}
                    onChange={(e) => setFocusSearch(e.target.value)}
                  />
                  {focusSearch && (
                    <button type="button" onClick={() => setFocusSearch('')} aria-label="Limpar busca">
                      <X size={13} />
                    </button>
                  )}
                </div>

                <div className="planner-focus-filter-pills">
                  <button
                    type="button"
                    className={`planner-focus-btn ${focusFilter === 'all' ? 'is-accent' : ''}`}
                    onClick={() => setFocusFilter('all')}
                  >
                    Todos ({plan.chars.length})
                  </button>
                  <button
                    type="button"
                    className={`planner-focus-btn ${focusFilter === 'focused' ? 'is-accent' : ''}`}
                    onClick={() => setFocusFilter('focused')}
                  >
                    No foco ({focusedChars.length})
                  </button>
                  <button
                    type="button"
                    className={`planner-focus-btn ${focusFilter === 'pending' ? 'is-accent' : ''}`}
                    onClick={() => setFocusFilter('pending')}
                  >
                    Pendentes
                  </button>
                </div>
              </div>

              <div className="planner-focus-modal-grid">
                {focusPickerOptions.map((c) => {
                  const selected = focusSlugs.includes(c.slug)
                  const curLv = c.char_goal?.current?.level ?? 1
                  const goalLv = c.char_goal?.goal?.level ?? 90
                  return (
                    <button
                      key={c.slug}
                      type="button"
                      className={`planner-focus-card ${selected ? 'is-selected' : ''}`}
                      onClick={() => toggleFocusSlug(c.slug)}
                    >
                      <div className="planner-focus-card-av">
                        {iconUrl(c.icon) ? <img src={iconUrl(c.icon)!} alt={c.name} loading="lazy" /> : <span>{c.name[0]}</span>}
                      </div>
                      <div className="planner-focus-card-info">
                        <strong>{c.name}</strong>
                        <small>Nv. {curLv}→{goalLv}{c.is_inactive ? ' · inativo' : ''}</small>
                      </div>
                      {selected && <CheckCircle2 size={16} className="planner-focus-check" />}
                    </button>
                  )
                })}
                {focusPickerOptions.length === 0 && (
                  <p className="muted" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '24px 8px', margin: 0 }}>
                    Nenhum personagem encontrado. Use &quot;Novo personagem fora do plano&quot; abaixo para adicionar.
                  </p>
                )}
              </div>

              <div className="planner-focus-modal-foot">
                <button
                  type="button"
                  className="planner-focus-btn"
                  disabled={!plannerData}
                  onClick={() => {
                    setShowFocusPicker(false)
                    setCharPickerMode('focus')
                    setShowCharPicker(true)
                  }}
                >
                  <Plus size={14} /> Novo personagem fora do plano
                </button>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {isFocusMode && (
                    <button type="button" className="planner-focus-btn is-clear" onClick={clearFocus}>
                      <X size={14} /> Limpar foco
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => setShowFocusPicker(false)}
                  >
                    Concluir ({focusedChars.length})
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSettings && (
        <SettingsModal
          ar={ar}
          wl={wl}
          resinMode={resinMode}
          onSave={handleSaveSettings}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showCharPicker && (
        <CharacterPickerModal
          title={
            charPickerMode === 'focus'
              ? 'Adicionar personagem ao plano e focar'
              : 'Adicionar personagem ao planejador'
          }
          excludeSlugs={existingSlugs}
          onSelect={handleAddChar}
          onClose={() => {
            setShowCharPicker(false)
            setCharPickerMode('plan')
          }}
        />
      )}

      {showUidModal && (
        <UidImportModal
          onClose={() => setShowUidModal(false)}
          onImported={() => {
            const refreshed = loadPlanFromStorage(plannerData, lang)
            if (refreshed) setPlan(refreshed)
            const settings = loadPlannerSettings()
            setAr(settings.ar)
            setWl(settings.wl)
          }}
        />
      )}

      {editingChar && plan && (
        <PlannerCharacterModal
          key={`${editingChar.slug}-${editingCharInitialEdit ? 'edit' : 'view'}`}
          char={editingChar}
          element={elementOf(editingChar.slug)}
          inventory={plan.inventory_resolved}
          onClose={() => { setEditingChar(null); setEditingCharInitialEdit(false) }}
          onUpdate={handleUpdateChar}
          onRemove={handleRemoveChar}
          onSaveInventory={handleSaveItem}
          weaponsMap={weapons}
          wl={wl}
          resinMode={resinMode}
          initialEditing={editingCharInitialEdit}
        />
      )}

      {editingItem && plan && (() => {
        const matMeta = plannerData?.materials[editingItem]
        const virtMeta = VIRTUAL_RESOURCES[editingItem]
        if (!matMeta && !virtMeta) return null
        const resolvedName = virtMeta ? virtMeta.name : pickLang(matMeta!.name, lang)
        const resolvedIcon = virtMeta ? virtMeta.icon : matMeta!.icon
        const resolvedRarity = virtMeta ? virtMeta.rarity : matMeta!.rarity
        return (
          <ItemEditModal
            name={resolvedName}
            icon={resolvedIcon}
            rarity={resolvedRarity}
            currentQty={plan.inventory_resolved[editingItem] ?? 0}
            maxGlobal={plannerData?.global_max[editingItem] ?? 0}
            onSave={(qty) => handleSaveItem(editingItem, qty)}
            onClose={() => setEditingItem(null)}
          />
        )
      })()}
    </div>
  )
}
