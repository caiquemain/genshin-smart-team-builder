import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext'
import { iconUrl } from '../config'
import ItemTooltip from '../components/ItemTooltip'
import { tierOf, estimateResin, formatDays, formatResin, TIERS } from '../utils/resin'
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
} from 'lucide-react'
import type { AggregateMaterial, CharBreakdown, WeaponBreakdown, TierGroup, Plan } from '../types/planner'

import { loadPlannerData, getPlannerData, getPlannerDataOrNull, elementOf, pickLang, type PlannerData } from '../utils/planner-data'
import { buildIndexes, resolveCharSlug, resolveWeaponSlug } from '../utils/slug-resolver'
import { computeAscensionCost, computeTalentCost, computeWeaponAscension } from '../utils/planner-compute'
import { parseGoodData, type GoodCharState } from '../utils/good-parser'
import { recomputeAggregates } from '../utils/planner-recompute'
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
  material, have, globalMax, inventory, family, solvents, isWeekly = false, onEdit, wl, bestiary
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

  return (
    <ItemTooltip 
      data={{ 
        name: material.name, 
        icon: img ?? undefined, 
        rarity: material.rarity ?? undefined, 
        category: material.category, 
        description: material.description ?? undefined, 
        source: material.source ?? undefined,
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

function MaterialGroupCard({ mats, inventory, globalMax, family, solvents, isWeekly = false, onEdit, wl, bestiary }: {
  mats: AggregateMaterial[]
  inventory: Record<string, number>
  globalMax: Record<string, number>
  family?: string[]
  solvents?: number
  isWeekly?: boolean
  onEdit: (slug: string) => void
  wl: number
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

  return (
    <ItemTooltip 
      data={{ 
        name: `${familyName} (Grupo)`,
        icon: img ?? undefined, 
        rarity: mainMat.rarity ?? undefined, 
        category: mainMat.category, 
        description: `Materiais da mesma família. Cálculo de farm considera alquimia.`, 
        source: undefined,
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
  const [showSettings, setShowSettings] = useState(false)
  const [showCharPicker, setShowCharPicker] = useState(false)
  const [showUidModal, setShowUidModal] = useState(false)
  const [editingChar, setEditingChar] = useState<CharBreakdown | null>(null)
  const [editingCharInitialEdit, setEditingCharInitialEdit] = useState(false)
  const [editingItem, setEditingItem] = useState<string | null>(null)
  const [bestiary, setBestiary] = useState<BestiaryData | null>(null)

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

  const handleSaveSettings = (newAr: number, newWl: number) => {
    setAr(newAr)
    setWl(newWl)
    saveToStorage(seelieData, goodData, newAr, newWl)
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

  const handleAddChar = (chosen: CharacterSummary) => {
    setShowCharPicker(false)
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
    })
    if (res) {
      setPlan(res.plan)
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
        if (g.char_goal && g.char_goal.current.level < g.char_goal.goal.level) {
          ascMap.set(slug, computeAscensionCost(data, slug, g.char_goal.current.level, g.char_goal.goal.level, lang) as any)
        }
        if (g.talent_goal) {
          talMap.set(slug, computeTalentCost(data, slug, g.talent_goal.normal, g.talent_goal.skill, g.talent_goal.burst, lang) as any)
        }
        for (const wg of g.weapon_goals) {
          if (wg.current.level < wg.goal.level) {
            weaponAscMap.set(`${slug}::${wg.weapon}`, computeWeaponAscension(data, wg.weapon, wg.current.level, wg.goal.level, lang) as any)
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
    setSeelieData(null); setGoodData(null); setPlan(null)
    localStorage.removeItem(STORAGE_KEY); localStorage.removeItem('gsb.planner.plan'); setError(null)
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
            <Settings size={16} /> AR {ar} / WL {wl}
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

      {hasActivePlan && plan && (
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

          <div className="planner-stats">
            <div className="planner-stat">
              <div className="planner-stat-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Coins size={14} /> Mora total</div>
              <div className="planner-stat-value mora">{formatResin(plan.grand_mora)}</div>
            </div>
            <div className="planner-stat">
              <div className="planner-stat-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Zap size={14} /> Resina estimada</div>
              <div className="planner-stat-value resin">{formatResin(plan.grand_resin)} ⚡</div>
            </div>
            <div className="planner-stat">
              <div className="planner-stat-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Users size={14} /> Personagens</div>
              <div className="planner-stat-value">{plan.chars.length}</div>
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
              Falta: <strong>{formatDays(Math.max(0, plan.grand_resin - currentResin))}</strong>
              <span className="resin-hint">({formatResin(Math.max(0, plan.grand_resin - currentResin))} ⚡ @ 180/dia)</span>
            </div>
          </div>

          {plannerData && (
            <TodayFarmWidget
              plan={plan}
              data={plannerData}
              onEditMaterial={(slug) => setEditingItem(slug)}
            />
          )}

          <h2 style={{ marginTop: 32 }}>Materiais por resina</h2>
          
          {plannerData ? (() => {
             const data = plannerData
             let solvents = 0
             const invRaw = (seelieData?.inventory || []) as SeelieInventoryItem[]
             const solventItem = invRaw.find(i => i.item === 'dream_solvent')
             if (solventItem) solvents = solventItem.value

             if (plan.tier_groups.length === 0) {
               return <p className="status">Todos os personagens ativos deste plano já atingiram suas metas!</p>
             }

             return plan.tier_groups.map((tg) => {
               const groupedMats = groupMaterials(tg.materials, data.families)
               return (
                <details key={tg.tier.key} className="tier-group" open>
                  <summary>
                    <span className="tier-title">
                      <span className="tier-emoji" style={{ display: 'flex', alignItems: 'center' }}>
                        {TIER_ICONS[tg.tier.key] || <Star size={18} />}
                      </span>
                      <span style={{ color: tg.tier.color }}>{tg.tier.label}</span>
                    </span>
                    <span className="tier-meta">{groupedMats.length} grupo(s) {tg.resin_total > 0 && ` · ≈${formatResin(tg.resin_total)} ⚡`}</span>
                  </summary>
                  <div className="ascension-grid">
                    {groupedMats.map(([key, mats]) => {
                      const family = data.families[key]
                      return (
                        <MaterialGroupCard 
                          key={key} 
                          mats={mats} 
                          inventory={plan.inventory_resolved}
                          globalMax={data.global_max}
                          family={family}
                          solvents={solvents}
                          isWeekly={tg.tier.key === 'weekly'}
                          onEdit={(slug) => setEditingItem(slug)}
                          wl={wl}
                          bestiary={bestiary}
                        />
                      )
                    })}
                  </div>
                </details>
              )
             })
          })() : (
            <p className="status">Carregando catálogo de materiais...</p>
          )}
        </>
      )}

      {showSettings && (
        <SettingsModal
          ar={ar}
          wl={wl}
          onSave={handleSaveSettings}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showCharPicker && (
        <CharacterPickerModal
          title="Adicionar personagem ao planejador"
          excludeSlugs={existingSlugs}
          onSelect={handleAddChar}
          onClose={() => setShowCharPicker(false)}
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
          weaponsMap={weapons}
          wl={wl}
          initialEditing={editingCharInitialEdit}
        />
      )}

      {editingItem && plan && plannerData && plannerData.materials[editingItem] && (
        <ItemEditModal
          name={pickLang(plannerData.materials[editingItem].name, lang)}
          icon={plannerData.materials[editingItem].icon}
          rarity={plannerData.materials[editingItem].rarity}
          currentQty={plan.inventory_resolved[editingItem] ?? 0}
          maxGlobal={plannerData.global_max[editingItem] ?? 0}
          onSave={(qty) => handleSaveItem(editingItem, qty)}
          onClose={() => setEditingItem(null)}
        />
      )}
    </div>
  )
}
