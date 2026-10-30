import { useEffect, useState } from 'react'
import { Save, Library } from 'lucide-react'
import { api } from '../api/client'
import { useLanguage } from '../context/LanguageContext'
import { iconUrl, artifactIconUrl } from '../config'
import { formatStatLabel } from '../utils/stats'
import WeaponPickerModal from './WeaponPickerModal'
import ArtifactPickerModal from './ArtifactPickerModal'
import BuildReferencesEditor from './BuildReferencesEditor'
import type {
  CharacterBuild, CharacterSummary, WeaponSummary, ArtifactSetSummary,
  WeaponSlot, ArtifactSlot, ArtifactPair, BuildReference, Substitute, BuildPreset,
} from '../types'

const SANDS_OPTIONS = ['hp_pct', 'atk_pct', 'def_pct', 'em', 'er']
const GOBLET_OPTIONS = [
  'hp_pct', 'atk_pct', 'def_pct', 'em',
  'pyro_dmg', 'hydro_dmg', 'electro_dmg', 'cryo_dmg',
  'anemo_dmg', 'geo_dmg', 'dendro_dmg', 'physical_dmg',
]
const CIRCLET_OPTIONS = [
  'hp_pct', 'atk_pct', 'def_pct', 'em',
  'crit_rate', 'crit_dmg', 'healing_bonus',
]
const SUBSTAT_OPTIONS = [
  'hp_pct', 'atk_pct', 'def_pct', 'em', 'er',
  'crit_rate', 'crit_dmg', 'healing_bonus',
]

const EMPTY_BUILD: CharacterBuild = {
  weapons: [],
  artifacts_4pc: [],
  artifacts_2pc: [],
  sands_stat: [],
  goblet_stat: [],
  circlet_stat: [],
  substat_priority: [],
  er_requirement: null,
  talent_priority: null,
  notes: null,
  references: [],
  substitutes: [],
  combos: [],
}

type Picker =
  | { kind: 'weapon-add' }
  | { kind: 'weapon-replace'; index: number }
  | { kind: 'artifact-4pc-add' }
  | { kind: 'artifact-4pc-replace'; index: number }
  | { kind: 'artifact-2pc-set1'; index: number }
  | { kind: 'artifact-2pc-set2'; index: number }

export default function CharacterBuildEditor({
  character,
  initialBuild,
  onSave,
  onClose,
}: {
  character: CharacterSummary
  initialBuild: CharacterBuild | null
  onSave: (build: CharacterBuild) => void
  onClose: () => void
}) {
  const { lang } = useLanguage()
  const [build, setBuild] = useState<CharacterBuild>(initialBuild ?? EMPTY_BUILD)
  const [weapons, setWeapons] = useState<WeaponSummary[]>([])
  const [artifacts, setArtifacts] = useState<ArtifactSetSummary[]>([])
  const [picker, setPicker] = useState<Picker | null>(null)
  const [activeTab, setActiveTab] = useState<'build' | 'references' | 'combos'>('build')
  const [presets, setPresets] = useState<BuildPreset[]>([])
  const [isSavingPreset, setIsSavingPreset] = useState(false)
  const [newSubstat, setNewSubstat] = useState('atk_pct')
  const [editingNotes, setEditingNotes] = useState<string | null>(null)
  const [artifactMode, setArtifactMode] = useState<'4pc' | '2+2'>(
    build.artifacts_2pc.length > 0 ? '2+2' : '4pc',
  )

  // Carregar weapons/artifacts pra resolver nomes/ícones
  useEffect(() => {
    // O api já está importado no topo
      api.listWeapons(lang, { weapon_type: character.weapon_type, limit: 200 })
        .then((d) => setWeapons(d.items)).catch(() => {})
      api.listArtifacts(lang, { rarity: 5, limit: 200 })
        .then((d) => setArtifacts(d.items)).catch(() => {})
      api.listPresets(character.slug)
        .then(setPresets).catch(() => {})
  }, [lang, character.weapon_type])

  // ESC fecha o modal principal (se não tem picker aberto)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !picker) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [picker, onClose])

  const weaponsBySlug = new Map(weapons.map((w) => [w.slug, w]))
  const artifactsBySlug = new Map(artifacts.map((a) => [a.slug, a]))

  const setField = <K extends keyof CharacterBuild>(k: K, v: CharacterBuild[K]) => {
    setBuild((b) => ({ ...b, [k]: v }))
  }

  // === Weapons ===
  const handleWeaponSelected = (w: WeaponSummary) => {
    if (!picker) return
    const slot: WeaponSlot = { weapon_slug: w.slug, weapon_refinement: 1, notes: null }
    if (picker.kind === 'weapon-add') {
      setField('weapons', [...build.weapons, slot])
    } else if (picker.kind === 'weapon-replace') {
      const next = [...build.weapons]
      next[picker.index] = { ...next[picker.index], weapon_slug: w.slug }
      setField('weapons', next)
    }
    setPicker(null)
  }

  const setWeaponRefinement = (i: number, r: number | null) => {
    const next = [...build.weapons]
    next[i] = { ...next[i], weapon_refinement: r }
    setField('weapons', next)
  }

  const setWeaponNotes = (i: number, notes: string) => {
    const next = [...build.weapons]
    next[i] = { ...next[i], notes: notes || null }
    setField('weapons', next)
  }

  const removeWeapon = (i: number) => {
    setField('weapons', build.weapons.filter((_, idx) => idx !== i))
  }

  // === Artifacts 4pc ===
  const handleArtifact4pcSelected = (a: ArtifactSetSummary) => {
    if (!picker) return
    const slot: ArtifactSlot = { artifact_set_slug: a.slug, notes: null }
    if (picker.kind === 'artifact-4pc-add') {
      setField('artifacts_4pc', [...build.artifacts_4pc, slot])
    } else if (picker.kind === 'artifact-4pc-replace') {
      const next = [...build.artifacts_4pc]
      next[picker.index] = { ...next[picker.index], artifact_set_slug: a.slug }
      setField('artifacts_4pc', next)
    }
    setPicker(null)
  }

  const setArtifact4pcNotes = (i: number, notes: string) => {
    const next = [...build.artifacts_4pc]
    next[i] = { ...next[i], notes: notes || null }
    setField('artifacts_4pc', next)
  }

  const removeArtifact4pc = (i: number) => {
    setField('artifacts_4pc', build.artifacts_4pc.filter((_, idx) => idx !== i))
  }

  // === Artifact 2+2 ===
  const handleArtifact2pcSelected = (a: ArtifactSetSummary) => {
    if (!picker) return
    if (picker.kind === 'artifact-2pc-set1' || picker.kind === 'artifact-2pc-set2') {
      const idx = picker.index
      const next = [...build.artifacts_2pc]
      const cur = next[idx] ?? { set1_slug: null, set2_slug: null, notes: null }
      if (picker.kind === 'artifact-2pc-set1') next[idx] = { ...cur, set1_slug: a.slug }
      else next[idx] = { ...cur, set2_slug: a.slug }
      setField('artifacts_2pc', next)
    }
    setPicker(null)
  }

  const addArtifactPair = () => {
    setField('artifacts_2pc', [
      ...build.artifacts_2pc,
      { set1_slug: null, set2_slug: null, notes: null },
    ])
  }

  const setArtifactPairNotes = (i: number, notes: string) => {
    const next = [...build.artifacts_2pc]
    next[i] = { ...next[i], notes: notes || null }
    setField('artifacts_2pc', next)
  }

  const removeArtifactPair = (i: number) => {
    setField('artifacts_2pc', build.artifacts_2pc.filter((_, idx) => idx !== i))
  }

  // === Substats ===
  const addSubstat = () => {
    if (!build.substat_priority.includes(newSubstat)) {
      setField('substat_priority', [...build.substat_priority, newSubstat])
    }
  }
  const removeSubstat = (i: number) => {
    setField('substat_priority', build.substat_priority.filter((_, idx) => idx !== i))
  }
  const moveSubstat = (i: number, dir: -1 | 1) => {
    const next = [...build.substat_priority]
    const target = i + dir
    if (target < 0 || target >= next.length) return
    ;[next[i], next[target]] = [next[target], next[i]]
    setField('substat_priority', next)
  }

  // === Save ===
  const handleSave = () => {
    const final: CharacterBuild = { ...build }
    if (artifactMode === '4pc') final.artifacts_2pc = []
    else final.artifacts_4pc = []
    onSave(final)
  }

  const renderWeaponRow = (w: WeaponSlot, i: number) => {
    const info = w.weapon_slug ? weaponsBySlug.get(w.weapon_slug) : null
    const img = info ? iconUrl(info.icon) : null
    const isEditingNotes = editingNotes === `weapon-${i}`
    return (
      <div key={i} className="build-item">
        <button
          className="build-item-picker"
          onClick={() => setPicker({ kind: 'weapon-replace', index: i })}
        >
          <div className={`build-item-icon rarity-${info?.rarity ?? 1}`}>
            {img ? <img src={img} alt={info?.name ?? ''} /> : <span>?</span>}
          </div>
          <div className="build-item-info">
            <div className="build-item-name">{info?.name ?? 'Sem arma'}</div>
            {info && <div className="build-item-meta">{'★'.repeat(info.rarity)} · {info.weapon_type}</div>}
          </div>
        </button>
        <select
          value={w.weapon_refinement ?? ''}
          onChange={(e) => setWeaponRefinement(i, e.target.value ? Number(e.target.value) : null)}
          disabled={!w.weapon_slug}
          className="build-item-select-small"
        >
          <option value="">R—</option>
          {[1, 2, 3, 4, 5].map((r) => <option key={r} value={r}>R{r}</option>)}
        </select>
        <button
          className="build-item-action"
          onClick={() => setEditingNotes(isEditingNotes ? null : `weapon-${i}`)}
          title="Notas"
        >
          📝
        </button>
        <button
          className="build-item-remove"
          onClick={() => removeWeapon(i)}
          title="Remover"
        >
          ✕
        </button>
        {isEditingNotes && (
          <textarea
            className="build-item-notes"
            placeholder="Por que essa arma? Condições especiais?"
            value={w.notes ?? ''}
            onChange={(e) => setWeaponNotes(i, e.target.value)}
            rows={2}
          />
        )}
      </div>
    )
  }

  const renderArtifact4pcRow = (a: ArtifactSlot, i: number) => {
    const info = a.artifact_set_slug ? artifactsBySlug.get(a.artifact_set_slug) : null
    const img = info ? artifactIconUrl(info.icon) : null
    const isEditingNotes = editingNotes === `artifact4-${i}`
    return (
      <div key={i} className="build-item">
        <button
          className="build-item-picker"
          onClick={() => setPicker({ kind: 'artifact-4pc-replace', index: i })}
        >
          <div className={`build-item-icon rarity-${info?.rarity_max ?? 4}`}>
            {img ? <img src={img} alt={info?.name ?? ''} /> : <span>?</span>}
          </div>
          <div className="build-item-info">
            <div className="build-item-name">{info?.name ?? 'Sem set'}</div>
            {info && <div className="build-item-meta">{'★'.repeat(info.rarity_max)} · 4 peças</div>}
          </div>
        </button>
        <button
          className="build-item-action"
          onClick={() => setEditingNotes(isEditingNotes ? null : `artifact4-${i}`)}
          title="Notas"
        >
          📝
        </button>
        <button
          className="build-item-remove"
          onClick={() => removeArtifact4pc(i)}
          title="Remover"
        >
          ✕
        </button>
        {isEditingNotes && (
          <textarea
            className="build-item-notes"
            placeholder="Por que esse set 4pc?"
            value={a.notes ?? ''}
            onChange={(e) => setArtifact4pcNotes(i, e.target.value)}
            rows={2}
          />
        )}
      </div>
    )
  }

  const renderArtifactPair = (p: ArtifactPair, i: number) => {
    const set1 = p.set1_slug ? artifactsBySlug.get(p.set1_slug) : null
    const set2 = p.set2_slug ? artifactsBySlug.get(p.set2_slug) : null
    const img1 = set1 ? artifactIconUrl(set1.icon) : null
    const img2 = set2 ? artifactIconUrl(set2.icon) : null
    const isEditingNotes = editingNotes === `pair-${i}`
    return (
      <div key={i} className="build-pair">
        <div className="build-pair-sets">
          <button
            className="build-item-picker build-pair-set"
            onClick={() => setPicker({ kind: 'artifact-2pc-set1', index: i })}
          >
            <div className={`build-item-icon rarity-${set1?.rarity_max ?? 4}`}>
              {img1 ? <img src={img1} alt={set1?.name ?? ''} /> : <span>?</span>}
            </div>
            <div className="build-item-info">
              <div className="build-item-name">{set1?.name ?? 'Set 1'}</div>
              <div className="build-item-meta">2 peças</div>
            </div>
          </button>
          <button
            className="build-item-picker build-pair-set"
            onClick={() => setPicker({ kind: 'artifact-2pc-set2', index: i })}
          >
            <div className={`build-item-icon rarity-${set2?.rarity_max ?? 4}`}>
              {img2 ? <img src={img2} alt={set2?.name ?? ''} /> : <span>?</span>}
            </div>
            <div className="build-item-info">
              <div className="build-item-name">{set2?.name ?? 'Set 2'}</div>
              <div className="build-item-meta">2 peças</div>
            </div>
          </button>
        </div>
        <div className="build-pair-actions">
          <button
            className="build-item-action"
            onClick={() => setEditingNotes(isEditingNotes ? null : `pair-${i}`)}
            title="Notas"
          >
            📝
          </button>
          <button
            className="build-item-remove"
            onClick={() => removeArtifactPair(i)}
            title="Remover"
          >
            ✕
          </button>
        </div>
        {isEditingNotes && (
          <textarea
            className="build-item-notes"
            placeholder="Por que esse par 2+2?"
            value={p.notes ?? ''}
            onChange={(e) => setArtifactPairNotes(i, e.target.value)}
            rows={2}
          />
        )}
      </div>
    )
  }

  return (
    <>
      <div className="build-editor-overlay" onClick={onClose}>
        <div className="build-editor-modal" onClick={(e) => e.stopPropagation()}>
          <div className="build-editor-header">
            <div className="build-editor-char">
              {iconUrl(character.icon) && (
                <img src={iconUrl(character.icon)!} alt={character.name} />
              )}
              <div>
                <div className="build-editor-title">Build de {character.name}</div>
                <div className="build-editor-subtitle">
                  {'★'.repeat(character.rarity)} · {character.element} · {character.weapon_type}
                </div>
              </div>
            </div>
            <button className="build-editor-close" onClick={onClose} aria-label="Fechar">✕</button>
          </div>

          <div className="build-editor-body">
            <div className="build-editor-tabs">
              <button
                className={`build-editor-tab ${activeTab === 'build' ? 'active' : ''}`}
                onClick={() => setActiveTab('build')}
              >
                Build
              </button>
              <button
                className={`build-editor-tab ${activeTab === 'references' ? 'active' : ''}`}
                onClick={() => setActiveTab('references')}
              >
                Referências {build.references.length > 0 && <span className="tab-count">{build.references.length}</span>}
              </button>
              <button
                className={`build-editor-tab ${activeTab === 'combos' ? 'active' : ''}`}
                onClick={() => setActiveTab('combos')}
              >
                Combos {build.combos.length > 0 && <span className="tab-count">{build.combos.length}</span>}
              </button>
            </div>
            {activeTab === 'build' && (
            <>
            <div className="preset-actions-bar">
              <select
                className="build-editor-select"
                onChange={(e) => {
                  const preset = presets.find(p => p.id === Number(e.target.value))
                  if (preset) setBuild(preset.build_data)
                }}
              >
                <option value="">Carregar da biblioteca...</option>
                {presets.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <button
                className="btn-secondary"
                onClick={async () => {
                  const name = prompt("Nome do preset (ex: BIS Freeze, F2P):")
                  if (!name) return
                  setIsSavingPreset(true)
                  try {
                    const newPreset = await api.createPreset({
                      character_slug: character.slug,
                      name,
                      build_data: build
                    })
                    setPresets([...presets, newPreset])
                    alert("Preset salvo!")
                  } catch (err) {
                    alert("Erro ao salvar preset.")
                  } finally {
                    setIsSavingPreset(false)
                  }
                }}
                disabled={isSavingPreset}
              >
                <Save size={16} /> Salvar como Preset
              </button>
            </div>
            {/* === Armas === */}
            <section className="build-editor-section">
              <div className="build-section-header">
                <h3>Armas recomendadas</h3>
                <button className="build-add-btn" onClick={() => setPicker({ kind: 'weapon-add' })}>
                  + Adicionar
                </button>
              </div>
              {build.weapons.length === 0 ? (
                <p className="build-empty">Nenhuma arma. Clique "+ Adicionar" pra escolher com imagens e tooltips.</p>
              ) : (
                <div className="build-list">
                  {build.weapons.map(renderWeaponRow)}
                </div>
              )}
            </section>

            {/* === Artefatos === */}
            <section className="build-editor-section">
              <div className="build-section-header">
                <h3>Artefatos</h3>
                <div className="build-mode-toggle">
                  <button
                    className={`build-mode-btn ${artifactMode === '4pc' ? 'active' : ''}`}
                    onClick={() => setArtifactMode('4pc')}
                  >
                    4 peças
                  </button>
                  <button
                    className={`build-mode-btn ${artifactMode === '2+2' ? 'active' : ''}`}
                    onClick={() => { setArtifactMode('2+2'); if (build.artifacts_2pc.length === 0) addArtifactPair() }}
                  >
                    2 + 2
                  </button>
                </div>
              </div>

              {artifactMode === '4pc' ? (
                <>
                  {build.artifacts_4pc.length === 0 ? (
                    <p className="build-empty">Nenhum set 4pc. Clique "+ Adicionar".</p>
                  ) : (
                    <div className="build-list">
                      {build.artifacts_4pc.map(renderArtifact4pcRow)}
                    </div>
                  )}
                  <button className="build-add-btn build-add-btn-block" onClick={() => setPicker({ kind: 'artifact-4pc-add' })}>
                    + Adicionar set 4pc
                  </button>
                </>
              ) : (
                <>
                  {build.artifacts_2pc.length === 0 && (
                    <p className="build-empty">Nenhum par configurado.</p>
                  )}
                  <div className="build-list">
                    {build.artifacts_2pc.map(renderArtifactPair)}
                  </div>
                  <button className="build-add-btn build-add-btn-block" onClick={addArtifactPair}>
                    + Adicionar par 2+2
                  </button>
                </>
              )}
            </section>

            {/* === Main stats === */}
            <section className="build-editor-section">
              <h3>Main stats</h3>
              <div className="build-editor-stats-grid">
                {[
                  { label: 'Ampulheta', field: 'sands_stat' as const, opts: SANDS_OPTIONS },
                  { label: 'Cálice', field: 'goblet_stat' as const, opts: GOBLET_OPTIONS },
                  { label: 'Coroa', field: 'circlet_stat' as const, opts: CIRCLET_OPTIONS },
                ].map(({ label, field, opts }) => (
                  <div key={field}>
                    <label className="build-editor-label">{label}</label>
                    <div className="build-tags">
                      {build[field].map((val) => (
                        <span key={val} className="build-tag">
                          {formatStatLabel(val)}
                          <button
                            type="button"
                            onClick={() => {
                              const next = build[field].filter((v) => v !== val);
                              setField(field, next);
                            }}
                          >✕</button>
                        </span>
                      ))}
                    </div>
                    <select
                      value=""
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val && !build[field].includes(val)) {
                          setField(field, [...build[field], val]);
                        }
                      }}
                      className="build-editor-select"
                    >
                      <option value="">+ Adicionar stat...</option>
                      {opts.filter((o) => !build[field].includes(o)).map((s) => (
                        <option key={s} value={s}>{formatStatLabel(s)}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </section>

            {/* === Substats === */}
            <section className="build-editor-section">
              <h3>Substats (prioridade)</h3>
              {build.substat_priority.length > 0 && (
                <div className="build-editor-substats">
                  {build.substat_priority.map((s, i) => (
                    <div key={i} className="build-editor-substat-row">
                      <span className="build-editor-substat-order">{i + 1}</span>
                      <span className="build-editor-substat-label">{formatStatLabel(s)}</span>
                      <div className="build-editor-substat-actions">
                        <button onClick={() => moveSubstat(i, -1)} disabled={i === 0}>↑</button>
                        <button onClick={() => moveSubstat(i, 1)} disabled={i === build.substat_priority.length - 1}>↓</button>
                        <button onClick={() => removeSubstat(i)} className="build-editor-remove">✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="build-editor-row">
                <select
                  value={newSubstat}
                  onChange={(e) => setNewSubstat(e.target.value)}
                  className="build-editor-select"
                >
                  {SUBSTAT_OPTIONS.map((s) => <option key={s} value={s}>{formatStatLabel(s)}</option>)}
                </select>
                <button className="btn-secondary" onClick={addSubstat}>+ Adicionar</button>
              </div>
            </section>

            {/* === Requisitos === */}
            <section className="build-editor-section">
              <h3>Requisitos e prioridade</h3>
              <div className="build-editor-stats-grid">
                <div>
                  <label className="build-editor-label">ER necessário</label>
                  <input
                    type="text"
                    value={build.er_requirement ?? ''}
                    onChange={(e) => setField('er_requirement', e.target.value || null)}
                    placeholder="ex: 130-150%"
                    className="build-editor-input"
                  />
                </div>
                <div>
                  <label className="build-editor-label">Prioridade de talentos</label>
                  <input
                    type="text"
                    value={build.talent_priority ?? ''}
                    onChange={(e) => setField('talent_priority', e.target.value || null)}
                    placeholder="ex: Burst > Skill > NA"
                    className="build-editor-input"
                  />
                </div>
              </div>
            </section>

            {/* === Notas gerais === */}
            <section className="build-editor-section">
              <h3>Notas gerais</h3>
              <textarea
                value={build.notes ?? ''}
                onChange={(e) => setField('notes', e.target.value || null)}
                placeholder="Condições especiais, C6 necessário, etc"
                className="build-editor-textarea"
                rows={3}
              />
            </section>
          </>
            )}
            {activeTab === 'references' && (
              <section className="build-editor-section">
                <h3>Referências</h3>
                <BuildReferencesEditor
                  references={build.references}
                  onChange={(refs) => setField('references', refs)}
                />
              </section>
            )}
            
            {activeTab === 'combos' && (
              <section className="build-editor-section">
                <h3>Combos / Rotação</h3>
                <p className="build-editor-hint">
                  Adicione os combos do guia (ex: tE N5Q N5D N5) ou a rotação do time.
                </p>
                <div className="combos-editor">
                  {build.combos.length === 0 && (
                    <p className="build-empty">Nenhum combo adicionado.</p>
                  )}
                  {build.combos.map((combo, i) => (
                    <div key={i} className="combo-row">
                      <input
                        type="text"
                        value={combo}
                        onChange={(e) => {
                          const next = [...build.combos];
                          next[i] = e.target.value;
                          setField('combos', next);
                        }}
                        className="build-editor-input"
                        placeholder="Ex: tE N5Q N5D N5"
                      />
                      <button
                        className="build-item-remove"
                        onClick={() => setField('combos', build.combos.filter((_, idx) => idx !== i))}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <button
                    className="build-add-btn build-add-btn-block"
                    onClick={() => setField('combos', [...build.combos, ''])}
                  >
                    + Adicionar combo
                  </button>
                </div>
              </section>
            )}
          </div>

          <div className="build-editor-footer">
            <button className="btn-secondary" onClick={onClose}>Cancelar</button>
            <button className="btn-primary" onClick={handleSave}>Salvar build</button>
          </div>
        </div>
      </div>

      {picker && (picker.kind === 'weapon-add' || picker.kind === 'weapon-replace') && (
        <WeaponPickerModal
          character={character}
          onSelect={handleWeaponSelected}
          onClose={() => setPicker(null)}
        />
      )}
      {picker && (
        picker.kind === 'artifact-4pc-add' ||
        picker.kind === 'artifact-4pc-replace' ||
        picker.kind === 'artifact-2pc-set1' ||
        picker.kind === 'artifact-2pc-set2'
      ) && (
        <ArtifactPickerModal
          onSelect={
            picker.kind === 'artifact-4pc-add' || picker.kind === 'artifact-4pc-replace'
              ? handleArtifact4pcSelected
              : handleArtifact2pcSelected
          }
          onClose={() => setPicker(null)}
          title={
            picker.kind === 'artifact-2pc-set1' ? 'Escolher set 1 (2pc)'
            : picker.kind === 'artifact-2pc-set2' ? 'Escolher set 2 (2pc)'
            : 'Escolher set 4pc'
          }
        />
      )}
    </>
  )
}
