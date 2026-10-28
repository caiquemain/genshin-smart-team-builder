import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { api } from '../api/client'
import { useLanguage } from '../context/LanguageContext'
import { iconUrl } from '../config'
import type { CharacterSummary, Enums } from '../types'

const SLOT_COUNT = 4

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

function TeamSlot({ index, char }: { index: number; char: CharacterSummary | null }) {
  const { setNodeRef, isOver } = useDroppable({ id: `slot-${index}` })
  const img = char ? iconUrl(char.icon) : null
  return (
    <div
      ref={setNodeRef}
      className={`team-slot ${isOver ? 'over' : ''} ${char ? 'filled' : ''}`}
    >
      <span className="team-slot-num">{index + 1}</span>
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

export default function TeamBuilderPage() {
  const { lang } = useLanguage()
  const navigate = useNavigate()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const [slots, setSlots] = useState<(string | null)[]>([null, null, null, null])
  const [chars, setChars] = useState<CharacterSummary[]>([])
  const [enums, setEnums] = useState<Enums | null>(null)
  const [dragChar, setDragChar] = useState<CharacterSummary | null>(null)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [author, setAuthor] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [filterElement, setFilterElement] = useState('')

  useEffect(() => {
    api.getEnums().then(setEnums).catch(() => {})
    api.listCharacters(lang, { limit: 200 })
      .then((d) => setChars(d.items))
      .catch((e) => setError(String(e)))
  }, [lang])

  const charsBySlug = useMemo(() => {
    const m = new Map<string, CharacterSummary>()
    chars.forEach((c) => m.set(c.slug, c))
    return m
  }, [chars])

  const usedSlugs = new Set(slots.filter(Boolean) as string[])
  const filtered = filterElement
    ? chars.filter((c) => c.element === filterElement)
    : chars

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
  }

  const filledCount = slots.filter(Boolean).length

  const handleSave = async () => {
    if (!name.trim()) { setError('Dê um nome ao time'); return }
    if (filledCount === 0) { setError('Adicione pelo menos 1 personagem'); return }
    setSaving(true)
    setError(null)
    try {
      await api.createTeam(
        {
          name: name.trim(),
          description: description.trim() || undefined,
          author_name: author.trim() || undefined,
          character_slugs: slots.filter(Boolean) as string[],
        },
        lang,
      )
      navigate('/teams')
    } catch (e) {
      setError(String(e))
      setSaving(false)
    }
  }

  return (
    <div>
      <Link to="/teams" className="back">← Voltar para times</Link>
      <h1>Novo time</h1>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="team-slots">
          {slots.map((slug, idx) => (
            <div key={idx} className="team-slot-wrap">
              <TeamSlot index={idx} char={slug ? charsBySlug.get(slug) ?? null : null} />
              {slug && (
                <button
                  className="slot-remove"
                  onClick={() => removeSlot(idx)}
                  aria-label="Remover"
                >
                  ✕
                </button>
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
          <button className="btn-primary" onClick={handleSave} disabled={saving || filledCount === 0}>
            {saving ? 'Salvando...' : `Salvar (${filledCount}/4)`}
          </button>
        </div>

        {error && <p className="error">Erro: {error}</p>}

        <h2>Escolha os personagens</h2>
        <p className="builder-hint">Arraste um card para um slot, ou clique para adicionar no próximo espaço vazio.</p>

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
    </div>
  )
}
