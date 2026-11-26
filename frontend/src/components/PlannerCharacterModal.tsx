import { useEffect, useState } from 'react'
import {
  X, Sword, Sparkles, Gem, Coins, Zap, AlertCircle, Check,
  Pencil, Save, XCircle, Plus, Trash2, Minus, BookOpen,
} from 'lucide-react'
import { iconUrl } from '../config'
import { useLanguage } from '../context/LanguageContext'
import type { AggregateMaterial, CharBreakdown, WeaponBreakdown } from '../types/planner'
import type { WeaponSummary } from '../types'
import type { BestiaryData } from '../types/bestiary'
import { estimateResin, estimateResinRange, type ResinSpendMode } from '../utils/resin'
import { loadPlannerSettings } from '../utils/planner-storage'
import { getBestiaryData, calculateKills } from '../utils/kills-compute'
import { recomputeChar, getXpMaterials, type CharEdit } from '../utils/planner-recompute'
import { getPlannerDataOrNull } from '../utils/planner-data'
import { computeMoraLeyline, computeWeaponXp, getOwnedCharXp, getOwnedWeaponXp } from '../utils/xp-costs'
import ItemTooltip, { type ItemTooltipData } from './ItemTooltip'
import ItemEditModal from './ItemEditModal'
import PlannerWeaponPicker from './PlannerWeaponPicker'

const ELEMENT_COLORS: Record<string, string> = {
  pyro: '#ff9c46', hydro: '#4cc2f1', electro: '#b398ff', cryo: '#93e2ff',
  anemo: '#73ffd0', geo: '#f2c869', dendro: '#a5c83b',
}
const ELEMENT_ICON_NAME: Record<string, string> = {
  pyro: 'UI_Buff_Element_Fire', hydro: 'UI_Buff_Element_Water',
  electro: 'UI_Buff_Element_Electric', cryo: 'UI_Buff_Element_Ice',
  anemo: 'UI_Buff_Element_Wind', geo: 'UI_Buff_Element_Rock',
  dendro: 'UI_Buff_Element_Grass',
}
const RARITY_GRADIENTS: Record<number, string> = {
  1: 'linear-gradient(160deg,rgba(79,88,100,0.75) 0%,rgba(95,102,115,0.75) 39%,rgba(135,147,156,0.75) 100%)',
  2: 'linear-gradient(160deg,rgba(72,87,92,0.75) 0%,rgba(72,107,103,0.75) 39%,rgba(98,152,113,0.75) 100%)',
  3: 'linear-gradient(160deg,rgba(81,84,116,0.75) 0%,rgba(80,104,135,0.75) 39%,rgba(75,160,180,0.75) 100%)',
  4: 'linear-gradient(160deg,rgba(89,84,130,0.75) 0%,rgba(120,102,157,0.75) 39%,rgba(183,133,201,0.75) 100%)',
  5: 'linear-gradient(160deg,rgba(105,84,83,0.75) 0%,rgba(161,112,78,0.75) 39%,rgba(228,171,82,0.75) 100%)',
}
const LEVEL_MILESTONES = [1, 20, 40, 50, 60, 70, 80, 90]
const ASCENSION_MILESTONES = [20, 40, 50, 60, 70, 80]
const PHASE_TO_LEVEL: Record<number, number> = { 1: 20, 2: 40, 3: 50, 4: 60, 5: 70, 6: 80 }
const MILESTONE_NEXT_MAX: Record<number, number> = { 20: 40, 40: 50, 50: 60, 60: 70, 70: 80, 80: 90 }
const TALENT_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
const HERO_WIT_ICON = 'UI_ItemIcon_104003'
const MYSTIC_ORE_ICON = 'UI_ItemIcon_104012'
const MORA_ICON = 'UI_ItemIcon_202'

function canonicalInventorySlug(slug: string): string {
  if (slug.startsWith('__mora_')) return 'mora'
  if (slug === '__hero_wit__') return 'hero-s-wit'
  if (slug === '__mystic_ore__') return 'mystic-enhancement-ore'
  return slug
}

/** Marcos clicáveis no intervalo (inclui `m === goal` para permitir planejar 80/90, 70/80 etc.). */
function selectableMilestonesForRange(current: number, goal: number): number[] {
  return ASCENSION_MILESTONES.filter((m) => m >= current && m <= goal)
}

/** Marcos obrigatórios por padrão (estritamente abaixo da meta: `m >= current && m < goal`). */
function validMilestonesForRange(current: number, goal: number): number[] {
  return ASCENSION_MILESTONES.filter((m) => m >= current && m < goal)
}

/**
 * Atualiza os marcos marcados quando o usuário sobe OU volta o nível atual/meta:
 * - Ao subir o nível atual: remove marcos que ficaram para trás (`m < nextCur`).
 * - Ao voltar o nível atual para baixo: reativa automaticamente os marcos que voltaram a ser necessários (`nextCur <= m < nextGoal`).
 * - Ao baixar a meta: remove marcos acima da nova meta e desmarca o marco que virou teto (`m === nextGoal`) para padrão `X/X`.
 * - Ao subir a meta: ativa automaticamente os novos marcos obrigatórios.
 */
function reconcileActiveMilestones(
  prevActive: number[],
  prevCur: number,
  prevGoal: number,
  nextCur: number,
  nextGoal: number,
): number[] {
  const selectable = selectableMilestonesForRange(nextCur, nextGoal)
  const prevReq = validMilestonesForRange(prevCur, prevGoal)
  const nextReq = validMilestonesForRange(nextCur, nextGoal)

  const kept = prevActive.filter((m) => {
    if (!selectable.includes(m)) return false
    // Se a meta diminuiu e este marco agora é exatamente o nível meta (ex: 90 -> 80), desmarca por padrão (80/80)
    if (nextGoal < prevGoal && m === nextGoal && prevReq.includes(m)) return false
    return true
  })

  // Se o nível atual foi reduzido (voltando níveis), garante que todos os marcos obrigatórios do novo intervalo voltem marcados
  const added = nextCur < prevCur
    ? nextReq.filter((m) => !kept.includes(m))
    : nextReq.filter((m) => !prevReq.includes(m) && !kept.includes(m))

  return [...kept, ...added].sort((a, b) => a - b)
}

function getInitialCharPhases(c: CharBreakdown): number[] {
  const cur = c.char_goal?.current.level ?? 1
  const goal = c.char_goal?.goal.level ?? 90
  const selectable = selectableMilestonesForRange(cur, goal)
  if (Array.isArray(c.ascension?.phases_included)) {
    return c.ascension.phases_included
      .map((p: number) => PHASE_TO_LEVEL[p])
      .filter((m: number | undefined): m is number => m != null && selectable.includes(m))
  }
  const curAsc = c.char_goal?.current.asc
  const goalAsc = c.char_goal?.goal.asc
  if (curAsc != null || goalAsc != null) {
    const effFrom = curAsc ?? 0
    const effTo = goalAsc ?? 0
    return selectable.filter((m) => {
      const p = Object.entries(PHASE_TO_LEVEL).find(([, lv]) => lv === m)?.[0]
      const pNum = p ? Number(p) : 0
      return pNum > effFrom && pNum <= Math.max(effFrom, effTo)
    })
  }
  return validMilestonesForRange(cur, goal)
}

function getInitialWeaponPhases(c: CharBreakdown): Record<number, number[]> {
  const out: Record<number, number[]> = {}
  c.weapons.forEach((w, i) => {
    const selectable = selectableMilestonesForRange(w.from_level, w.to_level)
    if (Array.isArray(w.cost?.phases_included)) {
      out[i] = w.cost.phases_included
        .map((p: number) => PHASE_TO_LEVEL[p])
        .filter((m: number | undefined): m is number => m != null && selectable.includes(m))
    } else {
      out[i] = validMilestonesForRange(w.from_level, w.to_level)
    }
  })
  return out
}

function formatMoraShort(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`
  return String(n)
}

function mergeMatsIntoMap(target: Map<string, AggregateMaterial>, mats: any[]) {
  for (const m of mats ?? []) {
    const existing = target.get(m.slug)
    if (existing) existing.quantity += m.quantity
    else target.set(m.slug, { ...m, resin_estimate: (m as any).resin_estimate ?? estimateResin(m.category, m.quantity) })
  }
}

function MaterialRow({
  material,
  have,
  lang,
  wl,
  resinMode,
  bestiary,
  onEdit,
}: {
  material: AggregateMaterial
  have: number
  lang: string
  wl: number
  resinMode: ResinSpendMode
  bestiary: BestiaryData | null
  onEdit?: (material: AggregateMaterial) => void
}) {
  const img = iconUrl(material.icon)
  const isComplete = have >= material.quantity && material.quantity > 0
  const missing = Math.max(0, material.quantity - have)
  const isMora = material.slug.startsWith('__mora_')
  const isWeaponXp = material.category === 'weapon_exp'
  const effectiveCategory = isMora ? 'mora' : (material.is_weekly ? 'weekly_boss' : material.category)
  const resinRange = estimateResinRange(effectiveCategory, material.quantity, have, {
    rarity: material.rarity,
    wl,
    resinMode,
  })

  const killsData = bestiary ? calculateKills(material.slug, missing, wl, bestiary) : null

  const tooltipData: ItemTooltipData = {
    name: material.name, icon: img, rarity: material.rarity,
    category: effectiveCategory,
    description: material.description, source: material.source,
    resinRange,
    killsNeeded: killsData ? { monsterName: killsData.monsterName, kills: killsData.kills, dropRate: killsData.dropRate } : null,
  }

  const row = (
    <div
      className={`plan-modal-mat-row ${isComplete ? 'is-complete' : have > 0 ? 'is-partial' : ''} ${onEdit ? 'is-editable' : ''}`}
      style={{ cursor: onEdit ? 'pointer' : 'help' }}
      onClick={onEdit ? () => onEdit(material) : undefined}
      role={onEdit ? 'button' : undefined}
      tabIndex={onEdit ? 0 : undefined}
      onKeyDown={
        onEdit
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onEdit(material)
              }
            }
          : undefined
      }
    >
      <div className="plan-modal-mat-icon" style={{ background: RARITY_GRADIENTS[material.rarity ?? 1] }}>
        {img ? <img src={img} alt={material.name} loading="lazy" /> : <span>?</span>}
      </div>
      <div className="plan-modal-mat-info">
        <div className="plan-modal-mat-name">{material.name}</div>
        <div className="plan-modal-mat-qty">
          <span className="plan-modal-qty-total">{material.quantity.toLocaleString(lang === 'pt' ? 'pt-BR' : 'en-US')}</span>
          {have > 0 && !isComplete && (
            <span className="plan-modal-qty-missing">(falta {missing.toLocaleString(lang === 'pt' ? 'pt-BR' : 'en-US')})</span>
          )}
          {isComplete && <span className="plan-modal-qty-check"><Check size={12} /></span>}
          {isWeaponXp && !isComplete && <span className="plan-modal-qty-free">forja</span>}
        </div>
      </div>
      {onEdit && (
        <span className="plan-modal-mat-edit-cue" title="Atualizar quantidade na mochila">
          <Pencil size={12} />
        </span>
      )}
    </div>
  )
  return <ItemTooltip data={tooltipData}>{row}</ItemTooltip>
}

function LevelInput({ value, onChange, min = 1, max = 90 }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number
}) {
  return (
    <div className="plan-modal-level-input">
      <div className="plan-modal-level-controls">
        <button type="button" className="plan-level-step" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label="Diminuir">
          <Minus size={16} />
        </button>
        <input type="number" min={min} max={max} value={value}
          onChange={(e) => onChange(Math.max(min, Math.min(max, +e.target.value || min)))} />
        <button type="button" className="plan-level-step" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label="Aumentar">
          <Plus size={16} />
        </button>
      </div>
      <div className="plan-modal-milestones">
        {LEVEL_MILESTONES.map((l) => (
          <button key={l} type="button" className={`plan-modal-milestone ${value === l ? 'active' : ''}`} onClick={() => onChange(l)}>{l}</button>
        ))}
      </div>
    </div>
  )
}

function MilestoneCheckboxes({ current, goal, active, onChange, disabled }: {
  current: number; goal: number; active: number[]; onChange: (next: number[]) => void; disabled?: boolean
}) {
  return (
    <div className="plan-modal-milestones-read">
      {ASCENSION_MILESTONES.map((m) => {
        const passed = current > m
        const notReached = goal < m
        const isActive = active.includes(m)
        const isDisabled = passed || notReached || disabled
        const nextMax = MILESTONE_NEXT_MAX[m]
        const tooltip = passed
          ? 'Ascensão já concluída (nível atual já passou deste marco)'
          : notReached
            ? 'Meta atual não alcança este marco'
            : m === goal
              ? isActive
                ? `Planejando ascender no Nv. ${m} (${m}/${nextMax}) — clique para parar em ${m}/${m}`
                : `Clique para incluir a ascensão do Nv. ${m} (${m}/${nextMax})`
              : isActive
                ? 'Clique para pular esta ascensão (já feita)'
                : 'Clique para incluir esta ascensão'
        return (
          <button key={m} type="button" disabled={isDisabled}
            className={`milestone-chip ${passed ? 'passed' : notReached ? 'inactive' : isActive ? 'active' : 'unmarked'}`}
            onClick={() => {
              if (isDisabled) return
              if (isActive) onChange(active.filter((x) => x !== m))
              else onChange([...active, m].sort((a, b) => a - b))
            }}
            title={tooltip}
          >
            <span className="milestone-check">{passed ? '✓' : isActive ? '☑' : '☐'}</span>
            <span className="milestone-num">{m}</span>
          </button>
        )
      })}
    </div>
  )
}

interface TalentDraft { current: number; goal: number }

export default function PlannerCharacterModal({
  char, element, inventory, onClose, onUpdate, onRemove, onSaveInventory, weaponsMap, wl = 9, resinMode, initialEditing = false,
}: {
  char: CharBreakdown
  element: string | undefined
  inventory: Record<string, number>
  onClose: () => void
  onUpdate?: (newChar: CharBreakdown) => boolean | void
  onRemove?: (slug: string) => void
  onSaveInventory?: (slug: string, newQty: number) => void
  weaponsMap?: Map<string, WeaponSummary>
  wl?: number
  resinMode?: ResinSpendMode
  initialEditing?: boolean
}) {
  const effectiveResinMode = resinMode ?? loadPlannerSettings().resinMode
  const { lang } = useLanguage()
  const canEdit = !!onUpdate && !!weaponsMap

  const [editing, setEditing] = useState(initialEditing)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [weaponPickerIndex, setWeaponPickerIndex] = useState<number | null>(null)
  const [addingWeapon, setAddingWeapon] = useState(false)
  const [editingMaterial, setEditingMaterial] = useState<AggregateMaterial | null>(null)

  const [draftInactive, setDraftInactive] = useState(char.is_inactive ?? false)
  const [draftCurLevel, setDraftCurLevel] = useState(char.char_goal?.current.level ?? 1)
  const [draftGoalLevel, setDraftGoalLevel] = useState(char.char_goal?.goal.level ?? 90)
  const [draftCons, setDraftCons] = useState(char.char_goal?.cons ?? 0)
  const [draftNa, setDraftNa] = useState<TalentDraft>({ current: char.talent_goal?.normal.current ?? 1, goal: char.talent_goal?.normal.goal ?? 1 })
  const [draftEs, setDraftEs] = useState<TalentDraft>({ current: char.talent_goal?.skill.current ?? 1, goal: char.talent_goal?.skill.goal ?? 1 })
  const [draftEb, setDraftEb] = useState<TalentDraft>({ current: char.talent_goal?.burst.current ?? 1, goal: char.talent_goal?.burst.goal ?? 1 })
  const [draftWeapons, setDraftWeapons] = useState<WeaponBreakdown[]>(char.weapons.map((w) => ({ ...w })))

  const [previewChar, setPreviewChar] = useState<CharBreakdown>(char)
  const [recomputing, setRecomputing] = useState(false)

  const [charActivePhases, setCharActivePhases] = useState<number[]>(() => getInitialCharPhases(char))
  const [weaponActivePhases, setWeaponActivePhases] = useState<Record<number, number[]>>(() => getInitialWeaponPhases(char))

  const [bestiary, setBestiary] = useState<BestiaryData | null>(null)
  useEffect(() => {
    getBestiaryData().then(setBestiary)
  }, [])

  const handleCurLevelChange = (nextCur: number) => {
    const nextGoal = Math.max(draftGoalLevel, nextCur)
    setDraftCurLevel(nextCur)
    if (nextGoal !== draftGoalLevel) setDraftGoalLevel(nextGoal)
    setCharActivePhases((prev) =>
      reconcileActiveMilestones(prev, draftCurLevel, draftGoalLevel, nextCur, nextGoal),
    )
  }

  const handleGoalLevelChange = (nextGoal: number) => {
    const nextCur = Math.min(draftCurLevel, nextGoal)
    setDraftGoalLevel(nextGoal)
    if (nextCur !== draftCurLevel) setDraftCurLevel(nextCur)
    setCharActivePhases((prev) =>
      reconcileActiveMilestones(prev, draftCurLevel, draftGoalLevel, nextCur, nextGoal),
    )
  }

  const buildEditPayload = (): CharEdit => {
    const weaponEdits = draftWeapons.map((dw, i) => {
      const toLevel = Math.max(dw.from_level, dw.to_level || draftGoalLevel)
      const selectableW = selectableMilestonesForRange(dw.from_level, toLevel)
      const activeW = weaponActivePhases[i] !== undefined
        ? weaponActivePhases[i].filter((m) => selectableW.includes(m))
        : validMilestonesForRange(dw.from_level, toLevel)
      return {
        index: i,
        weaponSlug: dw.slug,
        fromLevel: dw.from_level,
        toLevel,
        activePhases: activeW,
      }
    })
    const selectableChar = selectableMilestonesForRange(draftCurLevel, draftGoalLevel)
    return {
      isInactive: draftInactive,
      goal: {
        currentLevel: draftCurLevel,
        goalLevel: draftGoalLevel,
        cons: draftCons,
        activePhases: charActivePhases.filter((m) => selectableChar.includes(m)),
      },
      talent: {
        na: { ...draftNa },
        es: { ...draftEs },
        eb: { ...draftEb },
      },
      weapons: weaponEdits,
    }
  }

  useEffect(() => {
    if (!editing || !weaponsMap) { setPreviewChar(char); return }
    let cancelled = false
    const handler = setTimeout(async () => {
      setRecomputing(true)
      try {
        const updated = await recomputeChar(char, buildEditPayload(), weaponsMap, lang)
        if (!cancelled) setPreviewChar(updated)
      } catch (e) { console.error(e) }
      finally { if (!cancelled) setRecomputing(false) }
    }, 350)
    return () => { cancelled = true; clearTimeout(handler) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftInactive, draftCurLevel, draftGoalLevel, draftCons, draftNa, draftEs, draftEb, draftWeapons, charActivePhases, weaponActivePhases, editing, weaponsMap, char, lang])

  useEffect(() => {
    setDraftInactive(char.is_inactive ?? false)
    setDraftCurLevel(char.char_goal?.current.level ?? 1)
    setDraftGoalLevel(char.char_goal?.goal.level ?? 90)
    setDraftCons(char.char_goal?.cons ?? 0)
    setDraftNa({ current: char.talent_goal?.normal.current ?? 1, goal: char.talent_goal?.normal.goal ?? 1 })
    setDraftEs({ current: char.talent_goal?.skill.current ?? 1, goal: char.talent_goal?.skill.goal ?? 1 })
    setDraftEb({ current: char.talent_goal?.burst.current ?? 1, goal: char.talent_goal?.burst.goal ?? 1 })
    setDraftWeapons(char.weapons.map((w) => ({ ...w })))
    setPreviewChar(char)
    setCharActivePhases(getInitialCharPhases(char))
    setWeaponActivePhases(getInitialWeaponPhases(char))
  }, [char])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (editingMaterial) { setEditingMaterial(null) }
      else if (weaponPickerIndex !== null || addingWeapon) { setWeaponPickerIndex(null); setAddingWeapon(false) }
      else if (editing) setEditing(false)
      else onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, editing, editingMaterial, weaponPickerIndex, addingWeapon])

  const handleCancel = () => {
    setEditing(false); setSaveError(null)
    setDraftInactive(char.is_inactive ?? false)
    setDraftCurLevel(char.char_goal?.current.level ?? 1)
    setDraftGoalLevel(char.char_goal?.goal.level ?? 90)
    setDraftCons(char.char_goal?.cons ?? 0)
    setDraftNa({ current: char.talent_goal?.normal.current ?? 1, goal: char.talent_goal?.normal.goal ?? 1 })
    setDraftEs({ current: char.talent_goal?.skill.current ?? 1, goal: char.talent_goal?.skill.goal ?? 1 })
    setDraftEb({ current: char.talent_goal?.burst.current ?? 1, goal: char.talent_goal?.burst.goal ?? 1 })
    setDraftWeapons(char.weapons.map((w) => ({ ...w })))
    setCharActivePhases(getInitialCharPhases(char))
    setWeaponActivePhases(getInitialWeaponPhases(char))
  }

  const handleSave = async () => {
    if (!onUpdate || !weaponsMap) return
    setSaving(true); setSaveError(null)
    try {
      const final = await recomputeChar(char, buildEditPayload(), weaponsMap, lang)
      const persisted = onUpdate(final)
      if (persisted === false) {
        setSaveError('Não foi possível salvar no armazenamento local do navegador (espaço insuficiente).')
        return
      }
      setEditing(false)
    } catch (e) { setSaveError(String(e)) }
    finally { setSaving(false) }
  }

  const accent = element ? ELEMENT_COLORS[element] ?? '#7dd3fc' : '#7dd3fc'
  const img = iconUrl(char.icon) || (element ? iconUrl(ELEMENT_ICON_NAME[element]) : null)
  const renderChar = editing ? previewChar : char
  const cons = renderChar.char_goal?.cons ?? 0
  const curLevel = renderChar.char_goal?.current.level ?? 1
  const goalLevel = renderChar.char_goal?.goal.level ?? 90

  const xp = getXpMaterials(renderChar, wl)

  const ascensionMats: AggregateMaterial[] = []
  if (renderChar.ascension) {
    const map = new Map<string, AggregateMaterial>()
    mergeMatsIntoMap(map, renderChar.ascension.materials)
    ascensionMats.push(...map.values())
    if (renderChar.ascension.total_mora > 0) {
      ascensionMats.push({ slug: '__mora_asc__', name: 'Mora (Ascensão)', icon: MORA_ICON, rarity: 3, category: 'mora', description: null, source: null, quantity: renderChar.ascension.total_mora, resin_estimate: 0 })
    }
  }
  if (xp.heroWits > 0) {
    ascensionMats.push({
      slug: '__hero_wit__', name: "Experiência do Herói", icon: HERO_WIT_ICON, rarity: 4,
      category: 'character_exp', description: 'Livro de XP para personagens.', source: null,
      quantity: xp.heroWits, resin_estimate: 0,
    })
  }
  if (xp.charMora > 0) {
    ascensionMats.push({
      slug: '__mora_xp__', name: 'Mora (Nível)', icon: MORA_ICON, rarity: 3, category: 'mora',
      description: 'Mora consumida ao subir de nível.', source: null,
      quantity: xp.charMora, resin_estimate: 0,
    })
  }

  const talentMats: AggregateMaterial[] = []
  if (renderChar.talents) {
    const map = new Map<string, AggregateMaterial>()
    mergeMatsIntoMap(map, renderChar.talents.grand_total_materials)
    talentMats.push(...map.values())
    if (renderChar.talents.grand_total_mora > 0) {
      talentMats.push({ slug: '__mora_tal__', name: 'Mora (Talentos)', icon: MORA_ICON, rarity: 3, category: 'mora', description: null, source: null, quantity: renderChar.talents.grand_total_mora, resin_estimate: 0 })
    }
  }

  const weaponMats: AggregateMaterial[] = []
  for (const w of renderChar.weapons) {
    if (w.cost) {
      const map = new Map<string, AggregateMaterial>()
      mergeMatsIntoMap(map, w.cost.materials)
      weaponMats.push(...map.values())
      if (w.cost.total_mora > 0) {
        weaponMats.push({ slug: `__mora_w_${w.slug}__`, name: 'Mora (Arma)', icon: MORA_ICON, rarity: 3, category: 'mora', description: null, source: null, quantity: w.cost.total_mora, resin_estimate: 0 })
      }
    }
  }
  if (xp.ore > 0) {
    weaponMats.push({
      slug: '__mystic_ore__', name: 'Minério Místico (eq. 10k)', icon: MYSTIC_ORE_ICON, rarity: 3,
      category: 'weapon_exp', description: 'XP de arma (soma Minério Místico 10k + Fino 2k + Comum 400).', source: null,
      quantity: xp.ore, resin_estimate: 0,
    })
  }
  if (xp.weaponMora > 0) {
    weaponMats.push({
      slug: '__mora_wxp__', name: 'Mora (Nível Arma)', icon: MORA_ICON, rarity: 3, category: 'mora',
      description: 'Mora consumida ao subir arma.', source: null,
      quantity: xp.weaponMora, resin_estimate: 0,
    })
  }

  const totalMora =
    (renderChar.ascension?.total_mora ?? 0) +
    (renderChar.talents?.grand_total_mora ?? 0) +
    renderChar.weapons.reduce((sum, w) => sum + (w.cost?.total_mora ?? 0), 0) +
    xp.charMora + xp.weaponMora

  const currentMora = inventory['mora'] ?? 0
  const missingMora = Math.max(0, totalMora - currentMora)
  const moraLeyline = computeMoraLeyline(missingMora, wl)

  const materialsResin = [...ascensionMats, ...talentMats, ...weaponMats].reduce((sum, m) => {
    if (m.slug.startsWith('__mora_') || m.slug.startsWith('__hero_wit') || m.slug.startsWith('__mystic_ore')) return sum
    const have = inventory[m.slug] ?? 0
    const missing = Math.max(0, m.quantity - have)
    if (missing === 0) return sum
    return sum + (m.resin_estimate || 0)
  }, 0)

  const totalResin = materialsResin + xp.charLeyline.resin + moraLeyline.resin
  const estimatedDays = Math.ceil(totalResin / 180)

  return (
    <div className="plan-modal-overlay" onClick={editing ? undefined : onClose}>
      <div className="plan-modal" onClick={(e) => e.stopPropagation()}>
        <div className="plan-modal-header">
          <div className="plan-modal-portrait" style={{ background: `color-mix(in srgb, ${accent} 25%, transparent)` }}>
            {img ? <img src={img} alt={char.name} /> : <span>?</span>}
            <div className="plan-modal-portrait-gradient" />
          </div>
          <div className="plan-modal-header-info">
            <h2 className="plan-modal-name" style={{ color: accent }}>{char.name}</h2>
            <div className="plan-modal-meta">
              <span style={{ color: accent }}>{element ? element.charAt(0).toUpperCase() + element.slice(1) : ''}</span>
              <span>·</span><span>C{cons}</span><span>·</span>
              <span>Nv. {curLevel} → {goalLevel}</span><span>·</span>
              <span>WL {wl}</span>
            </div>
            <div className="plan-modal-badges">
              {char.is_inactive && <span className="plan-modal-badge plan-modal-badge-inactive">Inativo</span>}
              {renderChar.is_complete && !char.is_inactive && !editing && (
                <span className="plan-modal-badge plan-modal-badge-complete"><Check size={12} /> Completo</span>
              )}
              {!renderChar.is_complete && !char.is_inactive && !editing && (
                <span className="plan-modal-badge plan-modal-badge-pending"><AlertCircle size={12} /> Pendente</span>
              )}
              {editing && (
                <span className="plan-modal-badge" style={{ background: 'rgba(125,211,252,0.15)', color: '#7dd3fc', border: '1px solid rgba(125,211,252,0.4)' }}>
                  {recomputing ? 'Calculando...' : 'Editando'}
                </span>
              )}
            </div>
          </div>
          <div className="plan-modal-header-actions">
            {canEdit && !editing && (
              <button className="btn-secondary" onClick={() => setEditing(true)}>
                <Pencil size={14} /> Editar
              </button>
            )}
            {onRemove && !editing && (
              <button
                className="btn-secondary"
                style={{ color: '#f87171', borderColor: 'rgba(248, 113, 113, 0.35)' }}
                onClick={() => {
                  if (confirm(`Remover ${char.name} do planejador?`)) {
                    onRemove(char.slug)
                  }
                }}
                title="Remover do planejador"
              >
                <Trash2 size={14} /> Remover
              </button>
            )}
            {editing && (
              <>
                <button className="btn-secondary" onClick={handleCancel} disabled={saving}>
                  <XCircle size={14} /> Cancelar
                </button>
                <button className="btn-primary" onClick={handleSave} disabled={saving}>
                  <Save size={14} /> {saving ? 'Salvando...' : 'Salvar'}
                </button>
              </>
            )}
            <button className="plan-modal-close" onClick={onClose} aria-label="Fechar"><X size={20} /></button>
          </div>
        </div>

        <div className="plan-modal-top-summary">
          <div className="plan-top-stat">
            <Coins size={16} className="plan-top-stat-icon mora" />
            <div>
              <div className="plan-top-stat-label">Mora Total</div>
              <div className="plan-top-stat-value">{formatMoraShort(totalMora)}</div>
            </div>
          </div>
          <div className="plan-top-stat">
            <Zap size={16} className="plan-top-stat-icon resin" />
            <div>
              <div className="plan-top-stat-label">Resina</div>
              <div className="plan-top-stat-value">{totalResin.toLocaleString('pt-BR')}</div>
              <div className="plan-top-stat-sub">{estimatedDays === 0 ? 'Pronto' : `~${estimatedDays} dias`}</div>
            </div>
          </div>
          <div className="plan-top-stat">
            <BookOpen size={16} className="plan-top-stat-icon xp" />
            <div>
              <div className="plan-top-stat-label">Ley Line XP</div>
              <div className="plan-top-stat-value">{xp.charLeyline.runs} runs</div>
              <div className="plan-top-stat-sub">{xp.charLeyline.resin} resina</div>
            </div>
          </div>
          <div className="plan-top-stat">
            <Coins size={16} className="plan-top-stat-icon mora" />
            <div>
              <div className="plan-top-stat-label">Ley Line Mora</div>
              <div className="plan-top-stat-value">{moraLeyline.runs} runs</div>
              <div className="plan-top-stat-sub">{moraLeyline.resin} resina</div>
            </div>
          </div>
        </div>

        {saveError && <div className="plan-modal-error">{saveError}</div>}

        <div className="plan-modal-body">
          <div className="plan-modal-col-left">
            <section className="plan-modal-section">
              <h3 className="plan-modal-section-title"><Sparkles size={16} /> Nível & Meta</h3>
              {editing ? (
                <div className="plan-modal-edit-goal">
                  <label>
                    <span>Nível atual</span>
                    <LevelInput value={draftCurLevel} onChange={handleCurLevelChange} min={1} max={90} />
                  </label>
                  <label>
                    <span>Meta (char + armas)</span>
                    <LevelInput value={draftGoalLevel} onChange={handleGoalLevelChange} min={1} max={90} />
                  </label>
                  <label>
                    <span>Constelação</span>
                    <div className="plan-modal-cons-input">
                      <Minus size={16} className="plan-modal-cons-step" onClick={() => setDraftCons(Math.max(0, draftCons - 1))} />
                      <input type="number" min={0} max={6} value={draftCons}
                        onChange={(e) => setDraftCons(Math.max(0, Math.min(6, +e.target.value || 0)))} />
                      <Plus size={16} className="plan-modal-cons-step" onClick={() => setDraftCons(Math.min(6, draftCons + 1))} />
                    </div>
                  </label>
                  <label>
                    <span>Status</span>
                    <button type="button" className={`plan-toggle-status ${draftInactive ? 'is-inactive' : 'is-active'}`} onClick={() => setDraftInactive(!draftInactive)}>
                      {draftInactive ? 'Inativo' : 'Ativo'}
                    </button>
                  </label>
                </div>
              ) : (
                <div className="plan-modal-goal-read">
                  <span>Nv. {curLevel} → {goalLevel}</span>
                  <span>·</span><span>C{cons}</span>
                  <span>·</span><span>{char.is_inactive ? 'Inativo' : 'Ativo'}</span>
                </div>
              )}
            </section>

            <section className="plan-modal-section">
              <h3 className="plan-modal-section-title"><Gem size={16} /> Ascensões</h3>
              {editing ? (
                <>
                  <MilestoneCheckboxes current={draftCurLevel} goal={draftGoalLevel} active={charActivePhases} onChange={setCharActivePhases} />
                  <div className="milestone-summary">
                    {charActivePhases.length === 0 ? 'Nenhuma ascensão marcada — clique nos marcos para incluir.' : <>{charActivePhases.length} ascensão(ões) marcada(s): {charActivePhases.join(', ')}</>}
                  </div>
                </>
              ) : (
                <div className="plan-modal-milestones-read">
                  {ASCENSION_MILESTONES.map((m) => {
                    const passed = curLevel > m
                    const notReached = goalLevel <= m
                    return (
                      <span key={m} className={`milestone-chip ${passed ? 'passed' : notReached ? 'inactive' : 'active'}`}>
                        <span className="milestone-check">{passed ? '✓' : notReached ? '·' : '☑'}</span>
                        <span className="milestone-num">{m}</span>
                      </span>
                    )
                  })}
                </div>
              )}
            </section>

            <section className="plan-modal-section">
              <h3 className="plan-modal-section-title"><Sparkles size={16} /> Talentos</h3>
              <div className="plan-modal-talents">
                {(['normal', 'skill', 'burst'] as const).map((key) => {
                  const draft = key === 'normal' ? draftNa : key === 'skill' ? draftEs : draftEb
                  const setDraft = key === 'normal' ? setDraftNa : key === 'skill' ? setDraftEs : setDraftEb
                  const label = key === 'normal' ? 'Normal' : key === 'skill' ? 'Skill' : 'Burst'
                  if (editing) {
                    return (
                      <div key={key} className="plan-modal-talent-edit">
                        <span className="plan-modal-talent-label">{label}</span>
                        <select
                          aria-label={`${label} nível atual`}
                          value={draft.current}
                          onChange={(e) => {
                            const nextCur = Number(e.target.value)
                            setDraft({ current: nextCur, goal: Math.max(draft.goal, nextCur) })
                          }}
                        >
                          {TALENT_LEVELS.map((lv) => (
                            <option key={lv} value={lv}>{lv}</option>
                          ))}
                        </select>
                        <span className="plan-modal-edit-arrow">→</span>
                        <select
                          aria-label={`${label} meta`}
                          value={draft.goal}
                          onChange={(e) => {
                            const nextGoal = Number(e.target.value)
                            setDraft({ current: Math.min(draft.current, nextGoal), goal: nextGoal })
                          }}
                        >
                          {TALENT_LEVELS.map((lv) => (
                            <option key={lv} value={lv}>{lv}</option>
                          ))}
                        </select>
                      </div>
                    )
                  }
                  const t = renderChar.talent_goal?.[key]
                  const current = t?.current ?? 1
                  const goal = t?.goal ?? 1
                  const pct = Math.min(100, (current / 10) * 100)
                  const goalPct = Math.min(100, (goal / 10) * 100)
                  return (
                    <div key={key} className="plan-modal-talent">
                      <div className="plan-modal-talent-label">{label}</div>
                      <div className="plan-modal-talent-bar">
                        <div className="plan-modal-talent-fill" style={{ width: `${pct}%`, background: accent }} />
                        <div className="plan-modal-talent-goal" style={{ width: `${goalPct}%`, background: accent }} />
                      </div>
                      <div className="plan-modal-talent-range">{current >= goal ? `Nv.${current} ✓` : `${current} → ${goal}`}</div>
                    </div>
                  )
                })}
              </div>
            </section>

            <section className="plan-modal-section">
              <h3 className="plan-modal-section-title"><Sword size={16} /> Armas ({editing ? draftWeapons.length : renderChar.weapons.length})</h3>
              <div className="plan-modal-weapons">
                {(editing ? draftWeapons : renderChar.weapons).map((w, i) => {
                  const previewW = editing ? (renderChar.weapons[i] ?? w) : w
                  const effectiveTo = Math.max(w.from_level, w.to_level || 90)
                  const wXp = computeWeaponXp(w.from_level, effectiveTo, w.rarity)
                  const wAscMora = previewW.cost?.total_mora ?? 0
                  const wTotalMora = wAscMora + wXp.moraLevelUp
                  const wResin = (previewW.cost?.materials ?? []).reduce(
                    (sum: number, m: { category: string; quantity: number; slug: string }) =>
                      sum + estimateResin(m.category, Math.max(0, m.quantity - (inventory[m.slug] ?? 0))),
                    0,
                  )
                  const isMaxed = w.from_level >= effectiveTo
                  return (
                  <div key={`${w.slug}-${i}`} className="plan-modal-weapon">
                    <div className="plan-modal-weapon-header">
                      <div className="plan-modal-weapon-icon" style={{ background: RARITY_GRADIENTS[w.rarity] }}>
                        {iconUrl(w.icon) ? <img src={iconUrl(w.icon)!} alt={w.name} /> : <span>?</span>}
                      </div>
                      <div className="plan-modal-weapon-info">
                        <div className="plan-modal-weapon-name">{w.name}</div>
                        <div className="plan-modal-weapon-meta">
                          {'★'.repeat(w.rarity)} · Nv. {w.from_level} → {effectiveTo}
                          {isMaxed && ' · ✓ Concluída'}
                        </div>
                      </div>
                      {editing && (
                        <div className="plan-modal-weapon-actions">
                          <button className="btn-secondary" onClick={() => setWeaponPickerIndex(i)}>Trocar</button>
                          <button
                            className="btn-secondary"
                            style={{ color: '#f87171' }}
                            onClick={() => {
                              setDraftWeapons((prev) => prev.filter((_, idx) => idx !== i))
                              setWeaponActivePhases((prev) => {
                                const next: Record<number, number[]> = {}
                                let targetIdx = 0
                                for (let idx = 0; idx < draftWeapons.length; idx++) {
                                  if (idx === i) continue
                                  next[targetIdx] = prev[idx] ?? []
                                  targetIdx++
                                }
                                return next
                              })
                            }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                    {!isMaxed && (wTotalMora > 0 || wXp.mysticOres > 0 || wResin > 0) && (
                      <div className="plan-modal-weapon-costs">
                        {wTotalMora > 0 && (
                          <span className="plan-modal-weapon-cost-pill is-mora" title={`Ascensão: ${wAscMora.toLocaleString('pt-BR')} · Level up: ${wXp.moraLevelUp.toLocaleString('pt-BR')}`}>
                            <Coins size={12} /> {formatMoraShort(wTotalMora)} Mora
                          </span>
                        )}
                        {wXp.mysticOres > 0 && (
                          <span className="plan-modal-weapon-cost-pill is-ore" title={`${wXp.xp.toLocaleString('pt-BR')} XP total`}>
                            <Gem size={12} /> {wXp.mysticOres} Minérios (10k)
                          </span>
                        )}
                        {wResin > 0 && (
                          <span className="plan-modal-weapon-cost-pill is-resin" title="Resina estimada para materiais de ascensão faltantes desta arma">
                            <Zap size={12} /> ~{wResin}
                          </span>
                        )}
                      </div>
                    )}
                    {editing && (
                      <div className="plan-modal-weapon-body">
                        <div className="plan-modal-weapon-level-row">
                          <label>
                            <span>Nível atual</span>
                            <LevelInput
                              value={w.from_level}
                              onChange={(v) => {
                                const nextTo = Math.max(v, effectiveTo)
                                setDraftWeapons((prev) => prev.map((p, idx) => idx === i ? { ...p, from_level: v, to_level: nextTo } : p))
                                setWeaponActivePhases((prev) => ({
                                  ...prev,
                                  [i]: reconcileActiveMilestones(
                                    prev[i] ?? validMilestonesForRange(w.from_level, effectiveTo),
                                    w.from_level,
                                    effectiveTo,
                                    v,
                                    nextTo,
                                  ),
                                }))
                              }}
                              min={1}
                              max={90}
                            />
                          </label>
                          <label>
                            <span>Meta</span>
                            <LevelInput
                              value={effectiveTo}
                              onChange={(v) => {
                                const nextFrom = Math.min(w.from_level, v)
                                setDraftWeapons((prev) => prev.map((p, idx) => idx === i ? { ...p, from_level: nextFrom, to_level: v } : p))
                                setWeaponActivePhases((prev) => ({
                                  ...prev,
                                  [i]: reconcileActiveMilestones(
                                    prev[i] ?? validMilestonesForRange(w.from_level, effectiveTo),
                                    w.from_level,
                                    effectiveTo,
                                    nextFrom,
                                    v,
                                  ),
                                }))
                              }}
                              min={1}
                              max={90}
                            />
                          </label>
                        </div>
                        <MilestoneCheckboxes
                          current={w.from_level}
                          goal={effectiveTo}
                          active={weaponActivePhases[i] ?? validMilestonesForRange(w.from_level, effectiveTo)}
                          onChange={(next) => setWeaponActivePhases((prev) => ({ ...prev, [i]: next }))}
                        />
                      </div>
                    )}
                  </div>
                  )
                })}
                {editing && (
                  <button className="plan-modal-add-weapon" onClick={() => setAddingWeapon(true)}>
                    <Plus size={14} /> Adicionar arma
                  </button>
                )}
                {!editing && renderChar.weapons.length === 0 && (
                  <p className="plan-modal-empty-weapons">Nenhuma arma planejada</p>
                )}
              </div>
            </section>
          </div>

          <div className="plan-modal-col-right">
            {onSaveInventory && (ascensionMats.length > 0 || talentMats.length > 0 || weaponMats.length > 0) && (
              <div className="plan-modal-edit-hint">
                <Pencil size={12} /> Clique em qualquer material, Mora ou XP para atualizar sua mochila
              </div>
            )}
            {ascensionMats.length > 0 && (
              <section className="plan-modal-section">
                <h3 className="plan-modal-section-title"><Gem size={16} /> Ascensão & XP</h3>
                <div className="plan-modal-mats-grid">
                  {ascensionMats.map((m) => (
                    <MaterialRow
                      key={m.slug}
                      material={m}
                      have={
                        m.slug === '__hero_wit__'
                          ? getOwnedCharXp(inventory).heroWitEquivalent
                          : (inventory[canonicalInventorySlug(m.slug)] ?? 0)
                      }
                      lang={lang}
                      wl={wl}
                      resinMode={effectiveResinMode}
                      bestiary={bestiary}
                      onEdit={onSaveInventory ? setEditingMaterial : undefined}
                    />
                  ))}
                </div>
              </section>
            )}
            {talentMats.length > 0 && (
              <section className="plan-modal-section">
                <h3 className="plan-modal-section-title"><Sparkles size={16} /> Talentos</h3>
                <div className="plan-modal-mats-grid">
                  {talentMats.map((m) => (
                    <MaterialRow
                      key={m.slug}
                      material={m}
                      have={inventory[canonicalInventorySlug(m.slug)] ?? 0}
                      lang={lang}
                      wl={wl}
                      resinMode={effectiveResinMode}
                      bestiary={bestiary}
                      onEdit={onSaveInventory ? setEditingMaterial : undefined}
                    />
                  ))}
                </div>
              </section>
            )}
            {weaponMats.length > 0 && (
              <section className="plan-modal-section">
                <h3 className="plan-modal-section-title"><Sword size={16} /> Armas & XP</h3>
                <div className="plan-modal-mats-grid">
                  {weaponMats.map((m) => (
                    <MaterialRow
                      key={m.slug}
                      material={m}
                      have={
                        m.slug === '__mystic_ore__'
                          ? getOwnedWeaponXp(inventory).mysticOreEquivalent
                          : (inventory[canonicalInventorySlug(m.slug)] ?? 0)
                      }
                      lang={lang}
                      wl={wl}
                      resinMode={effectiveResinMode}
                      bestiary={bestiary}
                      onEdit={onSaveInventory ? setEditingMaterial : undefined}
                    />
                  ))}
                </div>
              </section>
            )}
            {ascensionMats.length === 0 && talentMats.length === 0 && weaponMats.length === 0 && (
              <section className="plan-modal-section">
                <p className="plan-modal-empty">Nada a fazer — personagem completo!</p>
              </section>
            )}
          </div>
        </div>

        <div className="plan-modal-footer">
          <button className="btn-secondary" onClick={onClose}>Fechar</button>
        </div>

        {editingMaterial && onSaveInventory && (
          <ItemEditModal
            name={
              editingMaterial.slug.startsWith('__mora_')
                ? 'Mora'
                : editingMaterial.slug === '__hero_wit__'
                  ? 'Experiência do Herói (Hero\'s Wit)'
                  : editingMaterial.slug === '__mystic_ore__'
                    ? 'Minério de Refinamento Místico'
                    : editingMaterial.name
            }
            icon={editingMaterial.icon}
            rarity={editingMaterial.rarity}
            currentQty={inventory[canonicalInventorySlug(editingMaterial.slug)] ?? 0}
            maxGlobal={0}
            onSave={(newQty) => {
              onSaveInventory(canonicalInventorySlug(editingMaterial.slug), newQty)
              setEditingMaterial(null)
            }}
            onClose={() => setEditingMaterial(null)}
          />
        )}

        {(weaponPickerIndex !== null || addingWeapon) && weaponsMap && (
          <PlannerWeaponPicker
            weaponsMap={weaponsMap}
            currentSlug={weaponPickerIndex !== null ? (draftWeapons[weaponPickerIndex]?.slug ?? '') : ''}
            weaponType={getPlannerDataOrNull()?.characters[char.slug]?.weapon_type}
            onSelect={(newSlug) => {
              const w = weaponsMap.get(newSlug)
              if (!w) return
              if (addingWeapon) {
                const newIdx = draftWeapons.length
                setDraftWeapons((prev) => [...prev, {
                  slug: newSlug, name: w.name, icon: w.icon, rarity: w.rarity,
                  from_level: 1, to_level: draftGoalLevel, cost: null,
                }])
                setWeaponActivePhases((prev) => ({
                  ...prev,
                  [newIdx]: validMilestonesForRange(1, draftGoalLevel),
                }))
                setAddingWeapon(false)
              } else if (weaponPickerIndex !== null) {
                setDraftWeapons((prev) => prev.map((p, idx) => idx === weaponPickerIndex
                  ? { ...p, slug: newSlug, name: w.name, icon: w.icon, rarity: w.rarity }
                  : p
                ))
                setWeaponPickerIndex(null)
              }
            }}
            onClose={() => { setWeaponPickerIndex(null); setAddingWeapon(false) }}
          />
        )}
      </div>
    </div>
  )
}
