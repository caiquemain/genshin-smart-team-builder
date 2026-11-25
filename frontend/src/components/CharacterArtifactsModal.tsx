import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  X, Gem, Plus, Trash2, Pencil, Save, ExternalLink, Swords, Copy, Check, Share2,
} from 'lucide-react'
import { artifactPieceIconUrl, iconUrl } from '../config'
import type { GoodArtifact, GoodSlotKey, GoodSubstat } from '../types/good'
import type { GoodCharState } from '../utils/good-parser'
import {
  analyzeStatTargets,
  buildArtifactSetLookup,
  buildWeaponLookup,
  computeArtifactCritValue,
  computeCharacterBuildStats,
  formatCanonicalStatValue,
  getArtifactMainStatValue,
  normalizeGoodStatKey,
  SLOT_LABEL_PT,
  type CharacterStatsDataset,
} from '../utils/char-stats-calc'
import ArtifactPickerModal from './ArtifactPickerModal'
import BuildCardStudioModal from './BuildCardStudioModal'
import WeaponPickerModal from './WeaponPickerModal'
import { saveManualCharacterGear } from '../utils/planner-storage'
import { normKey } from '../utils/slug-resolver'
import type { ArtifactSetSummary, CharacterSummary, WeaponSummary } from '../types'

const SLOTS: GoodSlotKey[] = ['flower', 'plume', 'sands', 'goblet', 'circlet']

const MAIN_STAT_OPTIONS: Record<GoodSlotKey, { key: string; label: string }[]> = {
  flower: [{ key: 'hp', label: 'Vida (Flat)' }],
  plume: [{ key: 'atk', label: 'ATQ (Flat)' }],
  sands: [
    { key: 'atk_', label: 'ATQ%' },
    { key: 'hp_', label: 'Vida%' },
    { key: 'def_', label: 'DEF%' },
    { key: 'eleMas', label: 'Proficiência Elemental (EM)' },
    { key: 'enerRech_', label: 'Recarga de Energia (ER%)' },
  ],
  goblet: [
    { key: 'pyro_dmg_', label: 'Bônus de Dano Pyro%' },
    { key: 'hydro_dmg_', label: 'Bônus de Dano Hydro%' },
    { key: 'cryo_dmg_', label: 'Bônus de Dano Cryo%' },
    { key: 'electro_dmg_', label: 'Bônus de Dano Electro%' },
    { key: 'anemo_dmg_', label: 'Bônus de Dano Anemo%' },
    { key: 'geo_dmg_', label: 'Bônus de Dano Geo%' },
    { key: 'dendro_dmg_', label: 'Bônus de Dano Dendro%' },
    { key: 'physical_dmg_', label: 'Bônus de Dano Físico%' },
    { key: 'atk_', label: 'ATQ%' },
    { key: 'hp_', label: 'Vida%' },
    { key: 'def_', label: 'DEF%' },
    { key: 'eleMas', label: 'Proficiência Elemental (EM)' },
  ],
  circlet: [
    { key: 'critRate_', label: 'Taxa Crítica%' },
    { key: 'critDMG_', label: 'Dano Crítico%' },
    { key: 'heal_', label: 'Bônus de Cura%' },
    { key: 'atk_', label: 'ATQ%' },
    { key: 'hp_', label: 'Vida%' },
    { key: 'def_', label: 'DEF%' },
    { key: 'eleMas', label: 'Proficiência Elemental (EM)' },
  ],
}

const SUBSTAT_OPTIONS: { key: string; label: string; isPct: boolean }[] = [
  { key: 'critRate_', label: 'Taxa Crítica%', isPct: true },
  { key: 'critDMG_', label: 'Dano Crítico%', isPct: true },
  { key: 'atk_', label: 'ATQ%', isPct: true },
  { key: 'hp_', label: 'Vida%', isPct: true },
  { key: 'def_', label: 'DEF%', isPct: true },
  { key: 'enerRech_', label: 'Recarga (ER%)', isPct: true },
  { key: 'eleMas', label: 'Proficiência (EM)', isPct: false },
  { key: 'atk', label: 'ATQ (Flat)', isPct: false },
  { key: 'hp', label: 'Vida (Flat)', isPct: false },
  { key: 'def', label: 'DEF (Flat)', isPct: false },
]

interface CharacterArtifactsModalProps {
  character: CharacterSummary
  initialState: GoodCharState
  statsDataset: CharacterStatsDataset
  weaponsCatalog: WeaponSummary[]
  artifactsCatalog: ArtifactSetSummary[]
  onClose: () => void
  onSaved?: () => void
}

function defaultMainStat(slot: GoodSlotKey, element: string): string {
  if (slot === 'flower') return 'hp'
  if (slot === 'plume') return 'atk'
  if (slot === 'sands') return 'atk_'
  if (slot === 'circlet') return 'critRate_'
  const elemKey = `${element.toLowerCase()}_dmg_`
  return MAIN_STAT_OPTIONS.goblet.some((o) => o.key === elemKey) ? elemKey : 'atk_'
}

function makeEmptyDraft(
  slot: GoodSlotKey,
  element: string,
  defaultSetSlug: string,
): GoodArtifact {
  return {
    setKey: defaultSetSlug,
    slotKey: slot,
    level: 20,
    rarity: 5,
    mainStatKey: defaultMainStat(slot, element),
    substats: [
      { key: 'critRate_', value: 0 },
      { key: 'critDMG_', value: 0 },
      { key: 'atk_', value: 0 },
      { key: 'enerRech_', value: 0 },
    ],
  }
}

export default function CharacterArtifactsModal({
  character,
  initialState,
  statsDataset,
  weaponsCatalog,
  artifactsCatalog,
  onClose,
  onSaved,
}: CharacterArtifactsModalProps) {
  const weaponLookup = useMemo(() => buildWeaponLookup(weaponsCatalog), [weaponsCatalog])
  const artifactSetLookup = useMemo(
    () => buildArtifactSetLookup(artifactsCatalog),
    [artifactsCatalog],
  )

  const charWeapons = useMemo(() => {
    return weaponsCatalog
      .filter((w) => w.weapon_type === character.weapon_type)
      .sort((a, b) => {
        if (b.rarity !== a.rarity) return b.rarity - a.rarity
        return a.name.localeCompare(b.name)
      })
  }, [weaponsCatalog, character.weapon_type])

  const sortedArtifactSets = useMemo(() => {
    return [...artifactsCatalog].sort((a, b) => {
      if (b.rarity_max !== a.rarity_max) return b.rarity_max - a.rarity_max
      return a.name.localeCompare(b.name)
    })
  }, [artifactsCatalog])

  const resolvedInitialWeaponSlug = useMemo(() => {
    if (!initialState.weaponSlug) return ''
    const matched = weaponLookup.get(normKey(initialState.weaponSlug))
    return matched?.slug ?? initialState.weaponSlug
  }, [initialState.weaponSlug, weaponLookup])

  const [level, setLevel] = useState<number>(initialState.level || 90)
  const [weaponSlug, setWeaponSlug] = useState<string>(resolvedInitialWeaponSlug)
  const [weaponLevel, setWeaponLevel] = useState<number>(initialState.weaponLevel || 90)
  const [weaponRefinement, setWeaponRefinement] = useState<number>(
    initialState.weaponRefinement || 1,
  )

  // Mapa de 5 slots -> GoodArtifact | null
  const [slotMap, setSlotMap] = useState<Record<GoodSlotKey, GoodArtifact | null>>(() => {
    const m: Record<GoodSlotKey, GoodArtifact | null> = {
      flower: null,
      plume: null,
      sands: null,
      goblet: null,
      circlet: null,
    }
    for (const a of initialState.artifacts ?? []) {
      const sk = a.slotKey as GoodSlotKey
      if (SLOTS.includes(sk)) {
        const meta = artifactSetLookup.get(normKey(a.setKey))
        m[sk] = {
          ...a,
          setKey: meta?.slug ?? a.setKey,
          substats: [...(a.substats ?? [])],
        }
      }
    }
    return m
  })

  // Atualiza resolvedWeaponSlug caso weaponLookup termine de carregar
  useEffect(() => {
    if (resolvedInitialWeaponSlug && !weaponSlug) {
      setWeaponSlug(resolvedInitialWeaponSlug)
    }
  }, [resolvedInitialWeaponSlug])

  const [editingSlot, setEditingSlot] = useState<GoodSlotKey | null>(null)
  const [dirty, setDirty] = useState(false)
  const [showCardStudio, setShowCardStudio] = useState(false)
  const [showWeaponPicker, setShowWeaponPicker] = useState(false)
  const [showArtifactPicker, setShowArtifactPicker] = useState(false)

  // Fecha com ESC apenas quando nenhum modal filho estiver aberto
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !showCardStudio && !showWeaponPicker && !showArtifactPicker) {
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, showCardStudio, showWeaponPicker, showArtifactPicker])

  const currentArtifactsList = useMemo(
    () => SLOTS.map((s) => slotMap[s]).filter((a): a is GoodArtifact => a !== null),
    [slotMap],
  )

  const liveGoodState = useMemo<GoodCharState>(
    () => ({
      level,
      ascension: initialState.ascension,
      cons: initialState.cons,
      talents: initialState.talents,
      weaponSlug: weaponSlug || null,
      weaponLevel,
      weaponRefinement,
      artifacts: currentArtifactsList,
    }),
    [level, initialState, weaponSlug, weaponLevel, weaponRefinement, currentArtifactsList],
  )

  const liveStats = useMemo(
    () =>
      computeCharacterBuildStats({
        slug: character.slug,
        element: String(character.element),
        goodState: liveGoodState,
        statsDataset,
        weaponLookup,
        artifactSetLookup,
      }),
    [character, liveGoodState, statsDataset, weaponLookup, artifactSetLookup],
  )

  const defaultSetSlug = useMemo(() => {
    const firstExisting = currentArtifactsList[0]?.setKey
    if (firstExisting) return firstExisting
    return sortedArtifactSets[0]?.slug ?? 'gladiators-finale'
  }, [currentArtifactsList, sortedArtifactSets])

  const openEditorForSlot = (slot: GoodSlotKey) => {
    if (!slotMap[slot]) {
      const created = makeEmptyDraft(slot, String(character.element), defaultSetSlug)
      setSlotMap((prev) => ({ ...prev, [slot]: created }))
      setDirty(true)
    }
    setEditingSlot(slot)
  }

  const updateSlotPiece = (slot: GoodSlotKey, updater: (prev: GoodArtifact) => GoodArtifact) => {
    setSlotMap((prev) => {
      const cur = prev[slot]
      if (!cur) return prev
      return { ...prev, [slot]: updater(cur) }
    })
    setDirty(true)
  }

  const removeSlotPiece = (slot: GoodSlotKey) => {
    setSlotMap((prev) => ({ ...prev, [slot]: null }))
    if (editingSlot === slot) setEditingSlot(null)
    setDirty(true)
  }

  const updateSubstat = (slot: GoodSlotKey, idx: number, field: 'key' | 'value', val: string | number) => {
    updateSlotPiece(slot, (prev) => {
      const nextSubs: GoodSubstat[] = [...(prev.substats ?? [])]
      while (nextSubs.length <= idx) {
        nextSubs.push({ key: '', value: 0 })
      }
      if (field === 'key') {
        nextSubs[idx] = { ...nextSubs[idx], key: String(val) }
      } else {
        const parsed = typeof val === 'number' ? val : parseFloat(String(val).replace(',', '.'))
        nextSubs[idx] = { ...nextSubs[idx], value: Number.isFinite(parsed) ? Math.max(0, parsed) : 0 }
      }
      return { ...prev, substats: nextSubs }
    })
  }

  const addSubstatRow = (slot: GoodSlotKey) => {
    updateSlotPiece(slot, (prev) => {
      const cur = prev.substats ?? []
      if (cur.length >= 4) return prev
      const used = new Set([prev.mainStatKey, ...cur.map((s) => s.key)])
      const nextOpt = SUBSTAT_OPTIONS.find((o) => !used.has(o.key)) ?? SUBSTAT_OPTIONS[0]
      return { ...prev, substats: [...cur, { key: nextOpt.key, value: 0 }] }
    })
  }

  const removeSubstatRow = (slot: GoodSlotKey, idx: number) => {
    updateSlotPiece(slot, (prev) => ({
      ...prev,
      substats: (prev.substats ?? []).filter((_, i) => i !== idx),
    }))
  }

  const copyFlowerSetToAll = (setKey: string) => {
    setSlotMap((prev) => {
      const next = { ...prev }
      for (const s of SLOTS) {
        if (next[s]) {
          next[s] = { ...next[s]!, setKey }
        }
      }
      return next
    })
    setDirty(true)
  }

  const handleSave = () => {
    saveManualCharacterGear({
      slug: character.slug,
      level,
      cons: initialState.cons,
      talents: initialState.talents,
      weaponSlug: weaponSlug || null,
      weaponLevel,
      weaponRefinement,
      artifacts: currentArtifactsList,
    })
    setDirty(false)
    onSaved?.()
    onClose()
  }

  const liveStatTargets = useMemo(
    () => analyzeStatTargets(liveStats, null),
    [liveStats],
  )

  const charImg = iconUrl(character.icon)
  const editingPiece = editingSlot ? slotMap[editingSlot] : null
  const primaryBonus =
    liveStats.physicalDmgBonus > liveStats.elemDmgBonus && liveStats.physicalDmgBonus >= 20
      ? { label: 'Dano Fís.', value: `${liveStats.physicalDmgBonus.toFixed(1)}%` }
      : liveStats.healingBonus > liveStats.elemDmgBonus && liveStats.healingBonus >= 15
        ? { label: 'Cura', value: `${liveStats.healingBonus.toFixed(1)}%` }
        : {
            label: `Dano ${String(character.element).charAt(0).toUpperCase() + String(character.element).slice(1)}`,
            value: `${liveStats.elemDmgBonus.toFixed(1)}%`,
          }

  return (
    <div className="cam-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label={`Build e Artefatos de ${character.name}`}>
      <div className="cam-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="cam-header">
          <div className="cam-char-head">
            <div className="cam-avatar">
              {charImg ? <img src={charImg} alt={character.name} /> : null}
            </div>
            <div>
              <div className="cam-title-row">
                <h2>{character.name}</h2>
                {liveStats.hasArtifacts && (
                  <span className="eb-cv-badge cv-good">
                    {liveStats.totalCritValue.toFixed(1)} CV
                  </span>
                )}
              </div>
              <div className="cam-sub-row">
                <span>Lv. {level} · C{initialState.cons}</span>
                <span>·</span>
                <span>Talentos {initialState.talents.na}/{initialState.talents.es}/{initialState.talents.eb}</span>
                {liveStats.activeSets.length > 0 && (
                  <>
                    <span>·</span>
                    <span className="eb-active-sets">
                      {liveStats.activeSets.map((s) => `${s.pieces}pc ${s.name}`).join(' + ')}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="cam-header-actions">
            <button
              type="button"
              className="btn-secondary cam-page-link rb-share-btn"
              onClick={() => setShowCardStudio(true)}
              title="Abrir Estúdio de Card da Build (trocar imagem, tema, baixar PNG ou copiar)"
            >
              <Share2 size={13} /> Compartilhar Build
            </button>
            <Link
              to={`/characters/${character.slug}#minha-build`}
              className="btn-secondary cam-page-link"
              onClick={onClose}
            >
              <ExternalLink size={13} /> Página do Personagem
            </Link>
            <button type="button" className="cam-close-btn" onClick={onClose} aria-label="Fechar">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Corpo rolável */}
        <div className="cam-body">
          {/* Stats calculados ao vivo */}
          <div className="cam-live-stats">
            <div className="rb-stat-cell">
              <span>Vida</span>
              <strong>{liveStats.hasBaseData ? liveStats.totalHp.toLocaleString('pt-BR') : '—'}</strong>
            </div>
            <div className="rb-stat-cell">
              <span>ATQ</span>
              <strong>{liveStats.hasBaseData ? liveStats.totalAtk.toLocaleString('pt-BR') : '—'}</strong>
            </div>
            <div className="rb-stat-cell">
              <span>DEF</span>
              <strong>{liveStats.hasBaseData ? liveStats.totalDef.toLocaleString('pt-BR') : '—'}</strong>
            </div>
            <div className="rb-stat-cell">
              <span>EM</span>
              <strong>{liveStats.em}</strong>
            </div>
            <div className="rb-stat-cell">
              <span>Taxa Crít.</span>
              <strong className="is-crit">{liveStats.critRate.toFixed(1)}%</strong>
            </div>
            <div className="rb-stat-cell">
              <span>Dano Crít.</span>
              <strong className="is-crit">{liveStats.critDmg.toFixed(1)}%</strong>
            </div>
            <div className="rb-stat-cell">
              <span>Recarga</span>
              <strong>{liveStats.er.toFixed(1)}%</strong>
            </div>
            <div className="rb-stat-cell">
              <span>{primaryBonus.label}</span>
              <strong>{primaryBonus.value}</strong>
            </div>
          </div>

          {liveStatTargets.length > 0 && (
            <div className="cam-target-strip">
              {liveStatTargets.map((t) => (
                <div key={t.key} className={`cam-target-note target-${t.status}`}>
                  <strong>{t.label}:</strong> {t.message}
                </div>
              ))}
            </div>
          )}

          {/* Barra rápida: Nível do Char & Arma Equipada */}
          <div className="cam-gear-bar">
            <label className="cam-field cam-field-sm">
              <span>Nível</span>
              <input
                type="number"
                min={1}
                max={90}
                value={level}
                onChange={(e) => {
                  setLevel(Math.max(1, Math.min(90, Number(e.target.value) || 1)))
                  setDirty(true)
                }}
              />
            </label>

            <div className="cam-field cam-field-grow">
              <span>
                <Swords size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                Arma Equipada
              </span>
              {(() => {
                const selectedWeapon = weaponSlug ? weaponLookup.get(normKey(weaponSlug)) : null
                const wImg = selectedWeapon ? iconUrl(selectedWeapon.icon) : null
                return (
                  <div className="cam-picker-row">
                    <button
                      type="button"
                      className="cam-picker-trigger"
                      onClick={() => setShowWeaponPicker(true)}
                      title="Abrir modal para escolher arma"
                    >
                      <span className={`cam-picker-thumb rarity-${selectedWeapon?.rarity ?? 1}`}>
                        {wImg ? <img src={wImg} alt={selectedWeapon?.name ?? ''} /> : <Swords size={14} />}
                      </span>
                      <span className="cam-picker-label">
                        <strong>{selectedWeapon ? selectedWeapon.name : 'Escolher arma...'}</strong>
                        {selectedWeapon && <small>{'★'.repeat(selectedWeapon.rarity)}</small>}
                      </span>
                      <span className="cam-picker-action">{selectedWeapon ? 'Trocar' : 'Escolher'}</span>
                    </button>
                    {weaponSlug && (
                      <button
                        type="button"
                        className="cam-mini-btn is-danger"
                        onClick={() => {
                          setWeaponSlug('')
                          setDirty(true)
                        }}
                        title="Remover arma equipada"
                        aria-label="Remover arma"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>
                )
              })()}
            </div>

            <label className="cam-field cam-field-sm">
              <span>Lv. Arma</span>
              <input
                type="number"
                min={1}
                max={90}
                value={weaponLevel}
                disabled={!weaponSlug}
                onChange={(e) => {
                  setWeaponLevel(Math.max(1, Math.min(90, Number(e.target.value) || 1)))
                  setDirty(true)
                }}
              />
            </label>

            <label className="cam-field cam-field-sm">
              <span>Refino</span>
              <select
                value={weaponRefinement}
                disabled={!weaponSlug}
                onChange={(e) => {
                  setWeaponRefinement(Number(e.target.value) || 1)
                  setDirty(true)
                }}
              >
                {[1, 2, 3, 4, 5].map((r) => (
                  <option key={r} value={r}>R{r}</option>
                ))}
              </select>
            </label>
          </div>

          {/* Grade dos 5 slots de artefatos */}
          <div className="cam-slots-grid">
            {SLOTS.map((slot) => {
              const piece = slotMap[slot]
              const isSelected = editingSlot === slot
              if (!piece) {
                return (
                  <div
                    key={slot}
                    className={`cam-slot-card is-empty ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => openEditorForSlot(slot)}
                  >
                    <div className="cam-slot-empty-label">{SLOT_LABEL_PT[slot]}</div>
                    <button
                      type="button"
                      className="cam-add-piece-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        openEditorForSlot(slot)
                      }}
                    >
                      <Plus size={14} /> Adicionar peça
                    </button>
                  </div>
                )
              }

              const meta = artifactSetLookup.get(normKey(piece.setKey))
              const artImg = artifactPieceIconUrl(meta?.icon, slot)
              const mainCanon = normalizeGoodStatKey(piece.mainStatKey)
              const mainVal = getArtifactMainStatValue(piece.mainStatKey, piece.rarity, piece.level)
              const cv = computeArtifactCritValue(piece)

              return (
                <div
                  key={slot}
                  className={`cam-slot-card ${isSelected ? 'is-selected' : ''}`}
                  onClick={() => setEditingSlot(isSelected ? null : slot)}
                >
                  <div className="eb-art-head">
                    <div className="eb-art-icon">
                      {artImg ? <img src={artImg} alt={meta?.name ?? piece.setKey} /> : <Gem size={15} />}
                    </div>
                    <div className="eb-art-head-info">
                      <div className="eb-art-slot-row">
                        <span className="eb-art-slot">{SLOT_LABEL_PT[slot]}</span>
                        <span className="eb-art-lv">+{piece.level}</span>
                      </div>
                      <div className="eb-art-set-name" title={meta?.name ?? piece.setKey}>
                        {meta?.name ?? piece.setKey}
                      </div>
                    </div>
                  </div>

                  <div className="eb-art-main">
                    <span className="eb-art-main-label">
                      {MAIN_STAT_OPTIONS[slot].find((o) => o.key === piece.mainStatKey)?.label.replace(/ \(.*\)$/, '') ??
                        piece.mainStatKey}
                    </span>
                    <strong className="eb-art-main-val">
                      {mainCanon ? formatCanonicalStatValue(mainCanon, mainVal) : '—'}
                    </strong>
                  </div>

                  <ul className="eb-art-subs">
                    {(piece.substats ?? [])
                      .filter((s) => s.key && s.value > 0)
                      .map((s, si) => {
                        const canon = normalizeGoodStatKey(s.key)
                        const isCrit = canon === 'crit_rate' || canon === 'crit_dmg'
                        const label =
                          SUBSTAT_OPTIONS.find((o) => o.key === s.key)?.label.replace(/ \(.*\)$/, '') ?? s.key
                        return (
                          <li key={si} className={isCrit ? 'is-crit-sub' : ''}>
                            <span>{label}</span>
                            <strong>+{canon ? formatCanonicalStatValue(canon, s.value) : s.value}</strong>
                          </li>
                        )
                      })}
                  </ul>

                  <div className="cam-slot-foot">
                    <span className="eb-art-cv">{cv.toFixed(1)} CV</span>
                    <div className="cam-slot-btns" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="cam-mini-btn"
                        onClick={() => setEditingSlot(isSelected ? null : slot)}
                        title="Editar esta peça"
                      >
                        <Pencil size={12} /> {isSelected ? 'Fechar' : 'Editar'}
                      </button>
                      <button
                        type="button"
                        className="cam-mini-btn is-danger"
                        onClick={() => removeSlotPiece(slot)}
                        title="Remover peça deste slot"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Editor detalhado da peça selecionada */}
          {editingSlot && editingPiece && (
            <div className="cam-editor-panel">
              <div className="cam-editor-head">
                <div>
                  <strong>Editando: {SLOT_LABEL_PT[editingSlot]}</strong>
                  <span className="cam-editor-cv">
                    CV desta peça: {computeArtifactCritValue(editingPiece).toFixed(1)}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {currentArtifactsList.length > 1 && (
                    <button
                      type="button"
                      className="cam-mini-btn"
                      onClick={() => copyFlowerSetToAll(editingPiece.setKey)}
                      title="Aplica o set desta peça em todos os slots preenchidos"
                    >
                      <Copy size={12} /> Aplicar este set nas demais peças
                    </button>
                  )}
                  <button
                    type="button"
                    className="cam-mini-btn"
                    onClick={() => setEditingSlot(null)}
                  >
                    <Check size={12} /> Concluir peça
                  </button>
                </div>
              </div>

              <div className="cam-editor-grid">
                <div className="cam-field cam-field-grow">
                  <span>Set de Artefato</span>
                  {(() => {
                    const selectedSet = artifactSetLookup.get(normKey(editingPiece.setKey))
                    const sImg = artifactPieceIconUrl(selectedSet?.icon, editingSlot)
                    return (
                      <button
                        type="button"
                        className="cam-picker-trigger"
                        onClick={() => setShowArtifactPicker(true)}
                        title="Abrir modal para buscar e escolher set de artefato"
                      >
                        <span className={`cam-picker-thumb rarity-${selectedSet?.rarity_max ?? 5}`}>
                          {sImg ? <img src={sImg} alt={selectedSet?.name ?? editingPiece.setKey} /> : <Gem size={14} />}
                        </span>
                        <span className="cam-picker-label">
                          <strong>{selectedSet?.name ?? editingPiece.setKey}</strong>
                          {selectedSet && <small>{'★'.repeat(selectedSet.rarity_max)}</small>}
                        </span>
                        <span className="cam-picker-action">Escolher Set</span>
                      </button>
                    )
                  })()}
                </div>

                <label className="cam-field cam-field-sm">
                  <span>Raridade</span>
                  <select
                    value={editingPiece.rarity}
                    onChange={(e) => {
                      const rar = Number(e.target.value)
                      const maxLv = rar >= 5 ? 20 : 16
                      updateSlotPiece(editingSlot, (p) => ({
                        ...p,
                        rarity: rar,
                        level: Math.min(p.level, maxLv),
                      }))
                    }}
                  >
                    <option value={5}>5★</option>
                    <option value={4}>4★</option>
                  </select>
                </label>

                <label className="cam-field cam-field-sm">
                  <span>Nível</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <input
                      type="number"
                      min={0}
                      max={editingPiece.rarity >= 5 ? 20 : 16}
                      value={editingPiece.level}
                      onChange={(e) => {
                        const maxLv = editingPiece.rarity >= 5 ? 20 : 16
                        const lv = Math.max(0, Math.min(maxLv, Number(e.target.value) || 0))
                        updateSlotPiece(editingSlot, (p) => ({ ...p, level: lv }))
                      }}
                    />
                    <button
                      type="button"
                      className="cam-mini-btn"
                      onClick={() =>
                        updateSlotPiece(editingSlot, (p) => ({
                          ...p,
                          level: p.rarity >= 5 ? 20 : 16,
                        }))
                      }
                      title="Colocar no nível máximo"
                    >
                      Max
                    </button>
                  </div>
                </label>

                <label className="cam-field cam-field-grow">
                  <span>Main Stat</span>
                  <select
                    value={editingPiece.mainStatKey}
                    disabled={editingSlot === 'flower' || editingSlot === 'plume'}
                    onChange={(e) =>
                      updateSlotPiece(editingSlot, (p) => ({
                        ...p,
                        mainStatKey: e.target.value,
                      }))
                    }
                  >
                    {MAIN_STAT_OPTIONS[editingSlot].map((opt) => (
                      <option key={opt.key} value={opt.key}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {/* Substats */}
              <div className="cam-substats-wrap">
                <div className="cam-substats-head">
                  <span>Substats (até 4)</span>
                  {(editingPiece.substats?.length ?? 0) < 4 && (
                    <button
                      type="button"
                      className="cam-mini-btn"
                      onClick={() => addSubstatRow(editingSlot)}
                    >
                      <Plus size={12} /> Adicionar Substat
                    </button>
                  )}
                </div>

                <div className="cam-substats-grid">
                  {(editingPiece.substats ?? []).map((sub, idx) => (
                    <div key={idx} className="cam-substat-row">
                      <select
                        value={sub.key}
                        onChange={(e) => updateSubstat(editingSlot, idx, 'key', e.target.value)}
                      >
                        <option value="">— Escolher stat —</option>
                        {SUBSTAT_OPTIONS.filter((opt) => opt.key !== editingPiece.mainStatKey).map(
                          (opt) => (
                            <option key={opt.key} value={opt.key}>
                              {opt.label}
                            </option>
                          ),
                        )}
                      </select>
                      <input
                        type="number"
                        step="0.1"
                        min={0}
                        placeholder="0.0"
                        value={sub.value === 0 ? '' : sub.value}
                        onChange={(e) => updateSubstat(editingSlot, idx, 'value', e.target.value)}
                      />
                      <button
                        type="button"
                        className="cam-mini-btn is-danger"
                        onClick={() => removeSubstatRow(editingSlot, idx)}
                        aria-label="Remover substat"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="cam-footer">
          <span className="cam-footer-hint">
            {dirty
              ? 'Você tem alterações não salvas (salva localmente e entra no Backup / Google Drive).'
              : 'Clique em qualquer peça acima para adicionar ou editar seus stats manualmente.'}
          </span>
          <div className="cam-footer-btns">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Fechar
            </button>
            <button type="button" className="btn-primary" onClick={handleSave}>
              <Save size={14} /> Salvar Build
            </button>
          </div>
        </div>
      </div>

      {showCardStudio && (
        <BuildCardStudioModal
          character={character}
          stats={liveStats}
          onClose={() => setShowCardStudio(false)}
        />
      )}

      {showWeaponPicker && (
        <WeaponPickerModal
          character={character}
          items={charWeapons}
          onSelect={(w) => {
            setWeaponSlug(w.slug)
            setDirty(true)
            setShowWeaponPicker(false)
          }}
          onClose={() => setShowWeaponPicker(false)}
        />
      )}

      {showArtifactPicker && editingSlot && (
        <ArtifactPickerModal
          title={`Escolher Set — ${SLOT_LABEL_PT[editingSlot]}`}
          items={sortedArtifactSets}
          onSelect={(a) => {
            updateSlotPiece(editingSlot, (p) => ({
              ...p,
              setKey: a.slug,
              rarity: Math.min(p.rarity, a.rarity_max),
              level: Math.min(p.level, Math.min(p.rarity, a.rarity_max) >= 5 ? 20 : 16),
            }))
            setShowArtifactPicker(false)
          }}
          onClose={() => setShowArtifactPicker(false)}
        />
      )}
    </div>
  )
}
