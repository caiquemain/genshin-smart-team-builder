import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  DndContext, DragOverlay, useDraggable, useDroppable,
  PointerSensor, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core'
import { api } from '../api/client'
import { useLanguage } from '../context/LanguageContext'
import { iconUrl } from '../config'
import CharacterBuildEditor from '../components/CharacterBuildEditor'
import TeamTierBadge from '../components/TeamTierBadge'
import type {
  CharacterSummary, Enums, TeamAnalysisResponse, CharacterBuild, TeamTierInfo,
} from '../types'

const SLOT_COUNT = 4

const ROLE_LABEL: Record<string, string> = {
  dps: 'DPS', sub: 'Sub-DPS', support: 'Suporte', healer: 'Healer', shielder: 'Shielder',
}
const ROLE_EMOJI: Record<string, string> = {
  dps: '⚔️', sub: '🗡️', support: '🎯', healer: '💚', shielder: '🛡️',
}

function scoreColor(score: number): string {
  if (score >= 75) return '#4ade80'
  if (score >= 50) return '#fbbf24'
  return '#f87171'
}
function scoreLabel(score: number): string {
  if (score >= 85) return 'Excelente'
  if (score >= 70) return 'Bom'
  if (score >= 50) return 'Ok'
  if (score >= 30) return 'Fraco'
  return 'Ruim'
}

function DraggableChar({ char, disabled }: { char: CharacterSummary; disabled: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `char-${char.slug}`,
    data: { slug: char.slug, char },
    disabled,
  })
  const img = iconUrl(char.icon)
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`draggable-char ${isDragging ? 'dragging' : ''} ${disabled ? 'disabled' : ''}`}
    >
      <div className="draggable-char-icon">
        {img ? <img src={img} alt={char.name} loading="lazy" /> : <span>?</span>}
      </div>
      <div className="draggable-char-name">{char.name}</div>
      <div className="draggable-char-meta">{char.element}</div>
    </div>
  )
}

function TeamSlot({ index, char, hasBuild }: { index: number; char: CharacterSummary | null; hasBuild: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: `slot-${index}` })
  const img = char ? iconUrl(char.icon) : null
  return (
    <div
      ref={setNodeRef}
      className={`team-slot ${isOver ? 'over' : ''} ${char ? 'filled' : ''}`}
    >
      <span className="team-slot-num">{index + 1}</span>
      {hasBuild && <span className="team-slot-build-indicator" title="Build configurada">⚙</span>}
      {char ? (
        <>
          {img ? <img src={img} alt={char.name} /> : <span>?</span>}
          <span className="team-slot-name">{char.name}</span>
        </>
      ) : (
        <span className="team-slot-empty">solte aqui</span>
      )}
    </div>
  )
}

function TeamAnalysisPanel({
  analysis,
  onAddSuggestion,
  currentSlugs,
}: {
  analysis: TeamAnalysisResponse | null
  onAddSuggestion: (slug: string) => void
  currentSlugs: Set<string>
}) {
  if (!analysis || analysis.roles.length === 0) return null
  const color = scoreColor(analysis.score)

  return (
    <section className="analysis-panel">
      <div className="analysis-header">
        <h2>Análise do time</h2>
        <div className="analysis-score" style={{ color }}>
          {analysis.score}<span className="score-max">/100</span>
          <span className="score-label">{scoreLabel(analysis.score)}</span>
        </div>
      </div>
      <div className="score-bar">
        <div className="score-bar-fill" style={{ width: `${analysis.score}%`, background: color }} />
      </div>

      <div className="analysis-roles">
        {analysis.roles.map((r) => (
          <div key={r.slug} className={`role-chip role-${r.role}`}>
            <span className="role-emoji">{ROLE_EMOJI[r.role]}</span>
            <span className="role-name">{r.name}</span>
            <span className="role-badge">{ROLE_LABEL[r.role]}</span>
          </div>
        ))}
      </div>

      {analysis.reactions.length > 0 && (
        <div className="analysis-section">
          <div className="analysis-section-title">Reações viáveis</div>
          <div className="reactions-pills">
            {analysis.reactions.map((r) => (
              <span key={r.slug} className="reaction-pill">{r.name}</span>
            ))}
          </div>
        </div>
      )}

      {analysis.warnings.length > 0 && (
        <div className="analysis-section">
          <div className="analysis-section-title">⚠️ Alertas</div>
          <div className="analysis-warnings">
            {analysis.warnings.map((w, i) => <div key={i} className="warning-line">{w}</div>)}
          </div>
        </div>
      )}

      {analysis.suggestions.length > 0 && (
        <div className="analysis-section">
          <div className="analysis-section-title">💡 Sugestões</div>
          <div className="suggestions-list">
            {analysis.suggestions
              .filter((s) => !currentSlugs.has(s.slug))
              .map((s) => {
                const img = iconUrl(s.icon)
                return (
                  <div key={s.slug} className="suggestion-card">
                    <div className="suggestion-icon">
                      {img ? <img src={img} alt={s.name} /> : <span>?</span>}
                    </div>
                    <div className="suggestion-body">
                      <div className="suggestion-name">{s.name}</div>
                      <div className="suggestion-reason">{s.reason}</div>
                    </div>
                    <button
                      className="suggestion-add"
                      onClick={() => onAddSuggestion(s.slug)}
                      disabled={currentSlugs.size >= 4}
                    >
                      + Adicionar
                    </button>
                  </div>
                )
              })}
          </div>
        </div>
      )}

      <details className="analysis-breakdown">
        <summary>Ver detalhes do score</summary>
        <div className="breakdown-list">
          {analysis.breakdown.map((b, i) => (
            <div key={i} className="breakdown-row">
              <span className={b.delta > 0 ? 'breakdown-pos' : 'breakdown-neg'}>
                {b.delta > 0 ? '+' : ''}{b.delta}
              </span>
              <span>{b.factor}</span>
            </div>
          ))}
        </div>
      </details>
    </section>
  )
}

export default function TeamBuilderPage() {
  const { lang } = useLanguage()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const templateIdParam = searchParams.get('template_id')

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const [slots, setSlots] = useState<(string | null)[]>([null, null, null, null])
  const [builds, setBuilds] = useState<Record<number, CharacterBuild>>({})
  const [editingSlot, setEditingSlot] = useState<number | null>(null)
  const [chars, setChars] = useState<CharacterSummary[]>([])
  const [enums, setEnums] = useState<Enums | null>(null)
  const [dragChar, setDragChar] = useState<CharacterSummary | null>(null)
  const [templateInfo, setTemplateInfo] = useState<{ id: number; name: string; source: string | null; source_url: string | null } | null>(null)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [author, setAuthor] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<TeamAnalysisResponse | null>(null)
  const [previewTier, setPreviewTier] = useState<TeamTierInfo | null>(null)
  const [filterElement, setFilterElement] = useState('')

  useEffect(() => {
    api.getEnums().then(setEnums).catch(() => {})
    api.listCharacters(lang, { limit: 200 })
      .then((d) => setChars(d.items))
      .catch((e) => setError(String(e)))
  }, [lang])

  // Carregar template via ?template_id
  useEffect(() => {
    if (!templateIdParam) return
    const tid = parseInt(templateIdParam)
    if (isNaN(tid)) return
    api.getTemplate(tid)
      .then((t) => {
        const initial = [...t.character_slugs, null, null, null, null].slice(0, 4) as (string | null)[]
        setSlots(initial)
        if (t.name) setName(t.name)
        if (t.description) setDescription(t.description)
        setTemplateInfo({ id: t.id, name: t.name, source: t.source, source_url: t.source_url })
      })
      .catch((e) => setError(String(e)))
  }, [templateIdParam])

  // Análise do time + preview do tier com debounce (paralelo)
  useEffect(() => {
    const filled = slots.filter(Boolean) as string[]
    if (filled.length === 0) {
      setAnalysis(null)
      setPreviewTier(null)
      return
    }
    const t = setTimeout(() => {
      api.analyzeTeam(filled, lang).then(setAnalysis).catch(() => setAnalysis(null))
      api.previewTier(filled).then(setPreviewTier).catch(() => setPreviewTier(null))
    }, 300)
    return () => clearTimeout(t)
  }, [slots, lang])

  const charsBySlug = useMemo(() => {
    const m = new Map<string, CharacterSummary>()
    chars.forEach((c) => m.set(c.slug, c))
    return m
  }, [chars])

  const usedSlugs = new Set(slots.filter(Boolean) as string[])
  const filtered = filterElement ? chars.filter((c) => c.element === filterElement) : chars

  const handleDragStart = (e: DragStartEvent) => {
    const char = e.active.data.current?.char as CharacterSummary | undefined
    setDragChar(char ?? null)
  }

  const handleDragEnd = (e: DragEndEvent) => {
    setDragChar(null)
    const { active, over } = e
    if (!over) return
    const slug = active.data.current?.slug as string | undefined
    if (!slug) return
    const overId = over.id.toString()
    if (!overId.startsWith('slot-')) return
    const slotIdx = Number(overId.replace('slot-', ''))
    if (Number.isNaN(slotIdx) || slots[slotIdx]) return
    if (usedSlugs.has(slug)) return
    const next = [...slots]
    next[slotIdx] = slug
    setSlots(next)
  }

  const addToFirstEmpty = (slug: string) => {
    if (usedSlugs.has(slug)) return
    const idx = slots.findIndex((s) => s === null)
    if (idx === -1) return
    const next = [...slots]
    next[idx] = slug
    setSlots(next)
  }

  const removeSlot = (idx: number) => {
    const next = [...slots]
    next[idx] = null
    setSlots(next)
    // limpa build do slot removido
    setBuilds((prev) => {
      const nb = { ...prev }
      delete nb[idx + 1]
      return nb
    })
  }

  const handleSaveBuild = (build: CharacterBuild) => {
    if (editingSlot === null) return
    setBuilds((prev) => ({ ...prev, [editingSlot + 1]: build }))
    setEditingSlot(null)
  }

  const filledCount = slots.filter(Boolean).length

  const handleSave = async () => {
    if (!name.trim()) { setError('Dê um nome ao time'); return }
    if (filledCount === 0) { setError('Adicione pelo menos 1 personagem'); return }
    setSaving(true)
    setError(null)
    try {
      const team = await api.createTeam({
        name: name.trim(),
        description: description.trim() || undefined,
        author_name: author.trim() || undefined,
        character_slugs: slots.filter(Boolean) as string[],
      }, lang)

      if (Object.keys(builds).length > 0) {
        try {
          await api.updateTeamBuilds(team.id, builds, lang)
        } catch (e) {
          console.error('Erro ao salvar builds:', e)
        }
      }

      navigate('/teams')
    } catch (e) {
      setError(String(e))
      setSaving(false)
    }
  }

  const editingChar = editingSlot !== null && slots[editingSlot]
    ? charsBySlug.get(slots[editingSlot] as string) ?? null
    : null

  return (
    <div>
      <Link to="/teams" className="back">← Voltar para times</Link>
      <div className="team-builder-title-row">
        <h1>Novo time</h1>
        {previewTier && <TeamTierBadge teamTier={previewTier} size="lg" />}
      </div>

      {templateInfo && (
        <div className="template-banner">
          <div className="template-banner-text">
            Baseado em: <strong>{templateInfo.name}</strong>
            {templateInfo.source && <span className="template-banner-source"> · {templateInfo.source}</span>}
          </div>
          {templateInfo.source_url && (
            <a href={templateInfo.source_url} target="_blank" rel="noopener noreferrer" className="template-banner-link">
              Ver guia ↗
            </a>
          )}
        </div>
      )}

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="team-slots">
          {slots.map((slug, idx) => (
            <div key={idx} className="team-slot-wrap">
              <TeamSlot
                index={idx}
                char={slug ? charsBySlug.get(slug) ?? null : null}
                hasBuild={!!builds[idx + 1]}
              />
              {slug && (
                <>
                  <button
                    className="slot-build-btn"
                    onClick={() => setEditingSlot(idx)}
                    aria-label="Editar build"
                    title="Editar build"
                  >
                    ⚙
                  </button>
                  <button
                    className="slot-remove"
                    onClick={() => removeSlot(idx)}
                    aria-label="Remover"
                  >
                    ✕
                  </button>
                </>
              )}
            </div>
          ))}
        </div>

        <div className="team-form">
          <input
            placeholder="Nome do time *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={150}
          />
          <input
            placeholder="Autor (opcional)"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            maxLength={100}
          />
          <input
            placeholder="Descrição (opcional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <button
            className="btn-primary"
            onClick={handleSave}
            disabled={saving || filledCount === 0}
          >
            {saving ? 'Salvando...' : `Salvar (${filledCount}/4)`}
          </button>
        </div>

        {error && <p className="error">Erro: {error}</p>}

        <TeamAnalysisPanel
          analysis={analysis}
          onAddSuggestion={addToFirstEmpty}
          currentSlugs={usedSlugs}
        />

        <h2>Escolha os personagens</h2>
        <p className="builder-hint">Arraste um card para um slot, ou clique para adicionar no próximo espaço vazio. Clique em ⚙ num slot pra configurar a build.</p>

        <div className="filters">
          <select value={filterElement} onChange={(e) => setFilterElement(e.target.value)}>
            <option value="">Todos os elementos</option>
            {enums?.elements.map((el) => <option key={el} value={el}>{el}</option>)}
          </select>
        </div>

        <div className="draggable-grid">
          {filtered.map((c) => {
            const disabled = usedSlugs.has(c.slug)
            return (
              <div key={c.slug} onClick={() => !disabled && addToFirstEmpty(c.slug)}>
                <DraggableChar char={c} disabled={disabled} />
              </div>
            )
          })}
        </div>

        <DragOverlay>
          {dragChar ? (
            <div className="drag-preview">
              {iconUrl(dragChar.icon) && <img src={iconUrl(dragChar.icon)!} alt={dragChar.name} />}
              <span>{dragChar.name}</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {editingChar && editingSlot !== null && (
        <CharacterBuildEditor
          character={editingChar}
          initialBuild={builds[editingSlot + 1] ?? null}
          onSave={handleSaveBuild}
          onClose={() => setEditingSlot(null)}
        />
      )}
    </div>
  )
}
