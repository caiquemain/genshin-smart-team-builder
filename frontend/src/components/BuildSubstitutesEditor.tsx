import { useEffect, useState } from 'react'
import { useLanguage } from '../context/LanguageContext'
import { api } from '../api/client'
import { iconUrl } from '../config'
import CharacterPickerModal from './CharacterPickerModal'
import type { CharacterSummary, Substitute } from '../types'

export default function BuildSubstitutesEditor({
  substitutes,
  currentCharacterSlug,
  onChange,
}: {
  substitutes: Substitute[]
  currentCharacterSlug: string
  onChange: (subs: Substitute[]) => void
}) {
  const { lang } = useLanguage()
  const [characters, setCharacters] = useState<CharacterSummary[]>([])
  const [picker, setPicker] = useState<{ index: number } | null>(null)

  useEffect(() => {
    api.listCharacters(lang, { limit: 200 })
      .then((d) => setCharacters(d.items))
      .catch((e) => console.error(e))
  }, [lang])

  const bySlug = new Map(characters.map((c) => [c.slug, c]))

  const add = () =>
    onChange([...substitutes, { character_slug: null, build_label: null, notes: null }])

  const update = (i: number, patch: Partial<Substitute>) => {
    const next = [...substitutes]
    next[i] = { ...next[i], ...patch }
    onChange(next)
  }

  const remove = (i: number) => onChange(substitutes.filter((_, idx) => idx !== i))

  const handlePick = (c: CharacterSummary) => {
    if (picker) update(picker.index, { character_slug: c.slug })
    setPicker(null)
  }

  return (
    <div className="substitutes-editor">
      {substitutes.length === 0 && (
        <p className="build-empty">
          Nenhum substituto. Adicione alternativas para este slot (outro personagem,
          ou a mesma personagem com build diferente).
        </p>
      )}
      {substitutes.map((s, i) => {
        const info = s.character_slug ? bySlug.get(s.character_slug) : null
        const img = info ? iconUrl(info.icon) : null
        const isSameChar = !s.character_slug
        return (
          <div key={i} className="substitute-row">
            <button
              className="substitute-char-picker"
              onClick={() => setPicker({ index: i })}
              title={info?.name ?? 'Mesmo personagem (build alternativa)'}
            >
              <div className="substitute-char-icon">
                {img ? <img src={img} alt={info?.name ?? ''} /> : <span>↻</span>}
              </div>
              <div className="substitute-char-label">
                {isSameChar ? 'Mesma char' : info?.name ?? 'Escolher...'}
              </div>
            </button>
            <input
              type="text"
              placeholder="Build alternativa (ex: Mono-pyro, Vape)"
              value={s.build_label ?? ''}
              onChange={(e) => update(i, { build_label: e.target.value || null })}
              className="build-editor-input"
            />
            <input
              type="text"
              placeholder="Notas (condições, C6, etc)"
              value={s.notes ?? ''}
              onChange={(e) => update(i, { notes: e.target.value || null })}
              className="build-editor-input"
            />
            <button
              className="build-item-remove"
              onClick={() => remove(i)}
              title="Remover"
            >
              ✕
            </button>
          </div>
        )
      })}
      <button className="build-add-btn build-add-btn-block" onClick={add}>
        + Adicionar substituto
      </button>
      {picker && (
        <CharacterPickerModal
          onSelect={handlePick}
          onClose={() => setPicker(null)}
          excludeSlug={currentCharacterSlug}
        />
      )}
    </div>
  )
}
