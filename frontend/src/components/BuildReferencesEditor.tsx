import type { BuildReference } from '../types'

export default function BuildReferencesEditor({
  references,
  onChange,
}: {
  references: BuildReference[]
  onChange: (refs: BuildReference[]) => void
}) {
  const add = () => onChange([...references, { url: '', title: null }])
  const update = (i: number, patch: Partial<BuildReference>) => {
    const next = [...references]
    next[i] = { ...next[i], ...patch }
    onChange(next)
  }
  const remove = (i: number) => onChange(references.filter((_, idx) => idx !== i))

  return (
    <div className="references-editor">
      {references.length === 0 && (
        <p className="build-empty">
          Nenhuma referência. Adicione links de guias (KQM, YouTube, planilhas...).
        </p>
      )}
      {references.map((r, i) => (
        <div key={i} className="reference-row">
          <input
            type="text"
            placeholder="Título (ex: KQM Diluc Guide)"
            value={r.title ?? ''}
            onChange={(e) => update(i, { title: e.target.value || null })}
            className="build-editor-input"
          />
          <input
            type="url"
            placeholder="https://..."
            value={r.url}
            onChange={(e) => update(i, { url: e.target.value })}
            className="build-editor-input"
          />
          {r.url && (
            <a
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              className="reference-open"
              title="Abrir"
            >
              ↗
            </a>
          )}
          <button
            className="build-item-remove"
            onClick={() => remove(i)}
            title="Remover"
          >
            ✕
          </button>
        </div>
      ))}
      <button className="build-add-btn build-add-btn-block" onClick={add}>
        + Adicionar referência
      </button>
    </div>
  )
}
