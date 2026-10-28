import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { useLanguage } from '../context/LanguageContext'
import { iconUrl } from '../config'
import type { AscensionCost } from '../types'

const LEVEL_OPTIONS = [1, 20, 40, 50, 60, 70, 80]
const TARGET_LEVEL = 90
const MORA_ICON = 'UI_ItemIcon_202'

function formatMora(n: number): string {
  return n.toLocaleString('pt-BR')
}

export default function AscensionSection({ slug }: { slug: string }) {
  const { lang } = useLanguage()
  const [fromLevel, setFromLevel] = useState(1)
  const [data, setData] = useState<AscensionCost | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api
      .getAscensionCost(slug, fromLevel, TARGET_LEVEL, lang)
      .then((d) => { if (!cancelled) { setData(d); setError(null) } })
      .catch((e) => { if (!cancelled) setError(String(e)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [slug, fromLevel, lang])

  return (
    <section className="ascension-section">
      <h2>Materiais de Ascensão</h2>
      <p className="ascension-hint">
        Selecione o nível atual do personagem. Calculamos os materiais para chegar ao nível {TARGET_LEVEL}.
      </p>

      <div className="ascension-controls">
        <label>
          Nível atual:{' '}
          <select value={fromLevel} onChange={(e) => setFromLevel(Number(e.target.value))}>
            {LEVEL_OPTIONS.map((lvl) => (
              <option key={lvl} value={lvl}>
                {lvl === 1 ? '1 (do zero)' : lvl}
              </option>
            ))}
          </select>
        </label>
        <span className="ascension-target">→ {TARGET_LEVEL}</span>
      </div>

      {loading && <p className="status">Calculando...</p>}
      {error && <p className="error">Erro: {error}</p>}

      {data && data.materials.length === 0 && (
        <p className="status">Nenhuma ascensão necessária entre estes níveis.</p>
      )}

      {data && data.materials.length > 0 && (
        <>
          <p className="status">
            {data.materials.length} tipo(s) de material · fases inclusas:{' '}
            {data.phases_included.join(', ')}
          </p>
          <div className="ascension-grid">
            {data.materials.map((m) => {
              const img = iconUrl(m.icon)
              return (
                <div key={m.slug} className="ascension-item">
                  <div className="ascension-icon">
                    {img ? <img src={img} alt={m.name} loading="lazy" /> : <span>?</span>}
                  </div>
                  <div className="ascension-info">
                    <div className="ascension-name">{m.name}</div>
                    <div className="ascension-meta">
                      {'★'.repeat(m.rarity ?? 0)} · {m.category.replace(/_/g, ' ')}
                    </div>
                  </div>
                  <div className="ascension-qty">×{m.quantity}</div>
                </div>
              )
            })}
          </div>

          <div className="ascension-mora">
            <div className="ascension-mora-left">
              <img className="ascension-mora-icon" src={iconUrl(MORA_ICON)!} alt="Mora" />
              <span className="ascension-mora-label">Mora total</span>
            </div>
            <span className="ascension-mora-value">{formatMora(data.total_mora)}</span>
          </div>

          <p className="ascension-mora-note">
            Materiais de talento virão na próxima iteração.
          </p>
        </>
      )}
    </section>
  )
}
