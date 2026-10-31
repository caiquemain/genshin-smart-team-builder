import { useEffect, useState } from 'react'
import {
  X, Sword, Sparkles, Gem, Coins, Zap, AlertCircle, Check,
  Pencil, Save, XCircle, Plus, Trash2, Minus, BookOpen,
} from 'lucide-react'
import { iconUrl } from '../config'
import { useLanguage } from '../context/LanguageContext'
import type { AggregateMaterial, CharBreakdown, WeaponBreakdown } from '../types/planner'
import type { WeaponSummary } from '../types'
import { estimateResin, estimateResinRange } from '../utils/resin'
import { recomputeChar, getXpMaterials, type CharEdit } from '../utils/planner-recompute'
import { computeMoraLeyline } from '../utils/xp-costs'
import ItemTooltip, { type ItemTooltipData } from './ItemTooltip'
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
const HERO_WIT_ICON = 'UI_ItemIcon_104003'
const MYSTIC_ORE_ICON = 'UI_ItemIcon_104012'
const MORA_ICON = 'UI_ItemIcon_202'

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

function MaterialRow({ material, have, lang }: { material: AggregateMaterial; have: number; lang: string }) {
  const img = iconUrl(material.icon)
  const isComplete = have >= material.quantity && material.quantity > 0
  const missing = Math.max(0, material.quantity - have)
  const isMora = material.slug.startsWith('__mora_')
  const isFree = material.category === 'character_exp' || material.category === 'weapon_exp'
  const resinRange = estimateResinRange(isMora ? 'mora' : material.category, material.quantity, have)

  const tooltipData: ItemTooltipData = {
    name: material.name, icon: img, rarity: material.rarity,
    category: isMora ? 'mora' : material.category,
    description: material.description, source: material.source,
    resinRange,
  }

  const row = (
    <div className={`plan-modal-mat-row ${isComplete ? 'is-complete' : have > 0 ? 'is-partial' : ''}`} style={{ cursor: 'help' }}>
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
          {isFree && !isComplete && <span className="plan-modal-qty-free">grátis</span>}
        </div>
      </div>
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
        <button
          type="button"
          className="plan-level-step"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          aria-label="Diminuir"
        >
          <Minus size={16} />
        </button>
        <input
          type="number" min={min} max={max}
          value={value}
          onChange={(e) => onChange(Math.max(min, Math.min(max, +e.target.value || min)))}
        />
        <button
          type="button"
          className="plan-level-step"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          aria-label="Aumentar"
        >
          <Plus size={16} />
        </button>
      </div>
      <div className="plan-modal-milestones">
        {LEVEL_MILESTONES.map((l) => (
          <button
            key={l} type="button"
            className={`plan-modal-milestone ${value === l ? 'active' : ''}`}
            onClick={() => onChange(l)}
          >{l}</button>
        ))}
      </div>
    </div>
  )
}

function MilestoneCheckboxes({
  current, goal, active, onChange, disabled,
}: {
  current: number; goal: number; active: number[]; onChange: (next: number[]) => void; disabled?: boolean
}) {
  return (
    <div className="plan-modal-milestones-read">
      {ASCENSION_MILESTONES.map((m) => {
        const passed = current > m
        const notReached = goal <= m
        const isActive = active.includes(m)
        const isDisabled = passed || notReached || disabled
        return (
          <button
            key={m}
            type="button"
            disabled={isDisabled}
            className={`milestone-chip ${passed ? 'passed' : notReached ? 'inactive' : isActive ? 'active' : 'unmarked'}`}
            onClick={() => {
              if (isDisabled) return
              if (isActive) onChange(active.filter((x) => x !== m))
              else onChange([...active, m].sort((a, b) => a - b))
            }}
            title={passed ? 'Já passou desse nível' : notReached ? 'Meta não alcança esse marco' : isActive ? 'Clique para pular esta ascensão' : 'Clique para incluir esta ascensão'}
          >
            <span className="milestone-check">
              {passed ? '✓' : isActive ? '☑' : '☐'}
            </span>
            <span className="milestone-num">{m}</span>
          </button>
        )
      })}
    </div>
  )
}

interface TalentDraft { current: number; goal: number }

export default function PlannerCharacterModal({
  char, element, inventory, onClose, onUpdate, weaponsMap,
}: {
  char: CharBreakdown
  element: string | undefined
  inventory: Record<string, number>
  onClose: () => void
  onUpdate?: (newChar: CharBreakdown) => void
  weaponsMap?: Map<string, WeaponSummary>
}) {
  const { lang } = useLanguage()
  const canEdit = !!onUpdate && !!weaponsMap

  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [weaponPickerIndex, setWeaponPickerIndex] = useState<number | null>(null)
  const [addingWeapon, setAddingWeapon] = useState(false)

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

  const [charActivePhases, setCharActivePhases] = useState<number[]>([])
  const [weaponActivePhases, setWeaponActivePhases] = useState<Record<number, number[]>>({})

  useEffect(() => {
    const validChar = ASCENSION_MILESTONES.filter((m) => m > draftCurLevel && m <= draftGoalLevel)
    setCharActivePhases((prev) => prev.filter((m) => validChar.includes(m)))
    setWeaponActivePhases((prev) => {
      const next: Record<number, number[]> = {}
      for (let i = 0; i < draftWeapons.length; i++) {
        const w = draftWeapons[i]
        const validW = ASCENSION_MILESTONES.filter((m) => m > w.from_level && m <= draftGoalLevel)
        next[i] = (prev[i] ?? []).filter((m) => validW.includes(m))
      }
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftCurLevel, draftGoalLevel, draftWeapons.map((w) => w.from_level).join(',')])

  useEffect(() => {
    if (!editing || !weaponsMap) { setPreviewChar(char); return }
    const handler = setTimeout(async () => {
      setRecomputing(true)
      try {
        const weaponEdits = draftWeapons.map((dw, i) => {
          const orig = char.weapons[i]
          const changes: any = { index: i }
          if (!orig || dw.slug !== orig.slug) changes.weaponSlug = dw.slug
          if (!orig || dw.from_level !== orig.from_level) changes.fromLevel = dw.from_level
          changes.toLevel = draftGoalLevel
          changes.activePhases = weaponActivePhases[i] ?? []
          return changes
        })
        const edit: CharEdit = {
          isInactive: draftInactive,
          goal: { currentLevel: draftCurLevel, goalLevel: draftGoalLevel, cons: draftCons, activePhases: charActivePhases },
          talent: { na: draftNa, es: draftEs, eb: draftEb },
          weapons: weaponEdits as any,
        }
        const updated = await recomputeChar(char, edit, weaponsMap, lang)
        setPreviewChar(updated)
      } catch (e) { console.error(e) }
      finally { setRecomputing(false) }
    }, 500)
    return () => clearTimeout(handler)
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
    setCharActivePhases([])
    setWeaponActivePhases({})
  }, [char])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (weaponPickerIndex !== null || addingWeapon) { setWeaponPickerIndex(null); setAddingWeapon(false) }
      else if (editing) setEditing(false)
      else onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, editing, weaponPickerIndex, addingWeapon])

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
    setCharActivePhases([])
    setWeaponActivePhases({})
  }

  const handleSave = async () => {
    if (!onUpdate || !weaponsMap) return
    setSaving(true); setSaveError(null)
    try {
      const weaponEdits = draftWeapons.map((dw, i) => {
        const orig = char.weapons[i]
        const changes: any = { index: i }
        if (!orig || dw.slug !== orig.slug) changes.weaponSlug = dw.slug
        if (!orig || dw.from_level !== orig.from_level) changes.fromLevel = dw.from_level
        changes.toLevel = draftGoalLevel
        changes.activePhases = weaponActivePhases[i] ?? []
        return changes
      })
      const edit: CharEdit = {
        isInactive: draftInactive,
        goal: { currentLevel: draftCurLevel, goalLevel: draftGoalLevel, cons: draftCons, activePhases: charActivePhases },
        talent: { na: draftNa, es: draftEs, eb: draftEb },
        weapons: weaponEdits as any,
      }
      const final = await recomputeChar(char, edit, weaponsMap, lang)
      onUpdate(final)
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

  const xp = getXpMaterials(renderChar)

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
      slug: '__mystic_ore__', name: 'Minério Místico', icon: MYSTIC_ORE_ICON, rarity: 4,
      category: 'weapon_exp', description: 'XP de arma.', source: null,
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
  const moraLeyline = computeMoraLeyline(missingMora)

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
        {/* HEADER */}
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
              <span>Nv. {curLevel} → {goalLevel}</span>
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

        {/* TOP SUMMARY BAR */}
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
            {/* Meta única */}
            <section className="plan-modal-section">
              <h3 className="plan-modal-section-title"><Sparkles size={16} /> Nível & Meta</h3>
              {editing ? (
                <div className="plan-modal-edit-goal">
                  <label>
                    <span>Nível atual</span>
                    <LevelInput value={draftCurLevel} onChange={setDraftCurLevel} min={1} max={90} />
                  </label>
                  <label>
                    <span>Meta (char + armas)</span>
                    <LevelInput value={draftGoalLevel} onChange={setDraftGoalLevel} min={1} max={90} />
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
                    <button
                      type="button"
                      className={`plan-toggle-status ${draftInactive ? 'is-inactive' : 'is-active'}`}
                      onClick={() => setDraftInactive(!draftInactive)}
                    >
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

            {/* Marcos de Ascensão */}
            <section className="plan-modal-section">
              <h3 className="plan-modal-section-title"><Gem size={16} /> Ascensões</h3>
              {editing ? (
                <>
                  <MilestoneCheckboxes
                    current={draftCurLevel}
                    goal={draftGoalLevel}
                    active={charActivePhases}
                    onChange={setCharActivePhases}
                  />
                  <div className="milestone-summary">
                    {charActivePhases.length === 0
                      ? 'Nenhuma ascensão marcada — clique nos marcos para incluir.'
                      : <>{charActivePhases.length} ascensão(ões) marcada(s): {charActivePhases.join(', ')}</>}
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

            {/* Talentos */}
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
                        <input type="number" min={1} max={10} value={draft.current}
                          onChange={(e) => setDraft({ ...draft, current: Math.max(1, Math.min(10, +e.target.value || 1)) })} />
                        <span className="plan-modal-edit-arrow">→</span>
                        <input type="number" min={1} max={10} value={draft.goal}
                          onChange={(e) => setDraft({ ...draft, goal: Math.max(1, Math.min(10, +e.target.value || 1)) })} />
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
                      <div className="plan-modal-talent-range">{current === goal ? 'MÁX' : `${current} → ${goal}`}</div>
                    </div>
                  )
                })}
              </div>
            </section>

            {/* Armas */}
            <section className="plan-modal-section">
              <h3 className="plan-modal-section-title"><Sword size={16} /> Armas ({editing ? draftWeapons.length : renderChar.weapons.length})</h3>
              <div className="plan-modal-weapons">
                {(editing ? draftWeapons : renderChar.weapons).map((w, i) => (
                  <div key={`${w.slug}-${i}`} className="plan-modal-weapon">
                    <div className="plan-modal-weapon-header">
                      <div className="plan-modal-weapon-icon" style={{ background: RARITY_GRADIENTS[w.rarity] }}>
                        {iconUrl(w.icon) ? <img src={iconUrl(w.icon)!} alt={w.name} /> : <span>?</span>}
                      </div>
                      <div className="plan-modal-weapon-info">
                        <div className="plan-modal-weapon-name">{w.name}</div>
                        {!editing && (
                          <div className="plan-modal-weapon-meta">
                            Nv. {w.from_level} → {w.to_level}
                            {w.cost?.total_mora > 0 && ` · ${formatMoraShort(w.cost.total_mora)} Mora`}
                          </div>
                        )}
                      </div>
                      {editing && (
                        <div className="plan-modal-weapon-actions">
                          <button className="btn-secondary" onClick={() => setWeaponPickerIndex(i)}>Trocar</button>
                          <button className="btn-secondary" style={{ color: '#f87171' }}
                            onClick={() => setDraftWeapons((prev) => prev.filter((_, idx) => idx !== i))}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                    {editing && (
                      <div className="plan-modal-weapon-body">
                        <div className="plan-modal-weapon-level-row">
                          <label>
                            <span>Nível atual</span>
                            <LevelInput
                              value={w.from_level}
                              onChange={(v) => setDraftWeapons((prev) => prev.map((p, idx) => idx === i ? { ...p, from_level: v } : p))}
                              min={1}
                              max={90}
                            />
                          </label>
                          <label>
                            <span>Meta</span>
                            <div className="plan-modal-weapon-fixed-to">
                              <strong>{draftGoalLevel}</strong>
                              <small>seguindo o char</small>
                            </div>
                          </label>
                        </div>
                        <MilestoneCheckboxes
                          current={w.from_level}
                          goal={draftGoalLevel}
                          active={weaponActivePhases[i] ?? []}
                          onChange={(next) => setWeaponActivePhases((prev) => ({ ...prev, [i]: next }))}
                        />
                      </div>
                    )}
                  </div>
                ))}
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
            {ascensionMats.length > 0 && (
              <section className="plan-modal-section">
                <h3 className="plan-modal-section-title"><Gem size={16} /> Ascensão & XP</h3>
                <div className="plan-modal-mats-grid">
                  {ascensionMats.map((m) => <MaterialRow key={m.slug} material={m} have={inventory[m.slug] ?? 0} lang={lang} />)}
                </div>
              </section>
            )}
            {talentMats.length > 0 && (
              <section className="plan-modal-section">
                <h3 className="plan-modal-section-title"><Sparkles size={16} /> Talentos</h3>
                <div className="plan-modal-mats-grid">
                  {talentMats.map((m) => <MaterialRow key={m.slug} material={m} have={inventory[m.slug] ?? 0} lang={lang} />)}
                </div>
              </section>
            )}
            {weaponMats.length > 0 && (
              <section className="plan-modal-section">
                <h3 className="plan-modal-section-title"><Sword size={16} /> Armas & XP</h3>
                <div className="plan-modal-mats-grid">
                  {weaponMats.map((m) => <MaterialRow key={m.slug} material={m} have={inventory[m.slug] ?? 0} lang={lang} />)}
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

        {(weaponPickerIndex !== null || addingWeapon) && weaponsMap && (
          <PlannerWeaponPicker
            weaponsMap={weaponsMap}
            currentSlug={weaponPickerIndex !== null ? (draftWeapons[weaponPickerIndex]?.slug ?? '') : ''}
            onSelect={(newSlug) => {
              const w = weaponsMap.get(newSlug)
              if (!w) return
              if (addingWeapon) {
                setDraftWeapons((prev) => [...prev, {
                  slug: newSlug, name: w.name, icon: w.icon, rarity: w.rarity,
                  from_level: 1, to_level: draftGoalLevel, cost: null,
                }])
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
