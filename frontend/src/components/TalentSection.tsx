import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { useLanguage } from '../context/LanguageContext'
import { iconUrl } from '../config'
import ItemTooltip from './ItemTooltip'
import { categoryInfo } from '../utils/categories'
import type { TalentCost } from '../types'
import { computeMoraLeyline, getLeylineMoraPerRun } from '../utils/xp-costs'
import { Coins } from 'lucide-react'

const LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
const TARGET = 10
const MORA_ICON = 'UI_ItemIcon_202'

const TALENT_LABELS: Record<string, string> = {
  normal_attack: 'Ataque Normal',
  elemental_skill: 'Habilidade Elemental',
  elemental_burst: 'Explosão Elemental',
}

function formatMora(n: number): string {
  return n.toLocaleString('pt-BR')
}

export default function TalentSection({ slug }: { slug: string }) {
  const { lang } = useLanguage()
  const [na, setNa] = useState(1)
  const [es, setEs] = useState(1)
  const [eb, setEb] = useState(1)
  const [wl, setWl] = useState(9)
  const [data, setData] = useState<TalentCost | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api
      .getTalentCost(slug, na, es, eb, TARGET, lang)
      .then((d) => { if (!cancelled) { setData(d); setError(null) } })
      .catch((e) => { if (!cancelled) setError(String(e)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [slug, na, es, eb, lang])

  const moraLeyline = data ? computeMoraLeyline(data.grand_total_mora, wl) : { runs: 0, resin: 0 }

  return (
    <section className="talent-section">
      <h2>Materiais de Talento</h2>
      <p className="talent-hint">
        Selecione o nível atual de cada talento. Calculamos o custo para chegar ao nível {TARGET}.
      </p>

      <div className="talent-controls">
        <label>
          Ataque Normal:{' '}
          <select value={na} onChange={(e) => setNa(Number(e.target.value))}>
            {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </label>
        <label>
          Habilidade Elemental:{' '}
          <select value={es} onChange={(e) => setEs(Number(e.target.value))}>
            {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </label>
        <label>
          Explosão Elemental:{' '}
          <select value={eb} onChange={(e) => setEb(Number(e.target.value))}>
            {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </label>
        <label>
          WL:{' '}
          <select value={wl} onChange={(e) => setWl(Number(e.target.value))}>
            {[0,1,2,3,4,5,6,7,8,9].map((l) => (
              <option key={l} value={l}>WL {l}</option>
            ))}
          </select>
        </label>
        <span className="talent-target">→ {TARGET}</span>
      </div>

      {loading && <p className="status">Calculando...</p>}
      {error && <p className="error">Erro: {error}</p>}

      {data && data.grand_total_mora === 0 && (
        <p className="status">Nenhum upgrade necessário — todos os talentos já estão no alvo.</p>
      )}

      {data && data.grand_total_mora > 0 && (
        <>
          <div className="talent-breakdown">
            {Object.entries(data.talents).map(([key, t]) => (
              <div key={key} className="talent-block">
                <h3>{TALENT_LABELS[key] ?? key}</h3>
                {t.levels_included.length === 0 ? (
                  <p className="status">Sem upgrade</p>
                ) : (
                  <>
                    <p className="talent-block-meta">
                      Níveis {t.levels_included[0]}–{t.levels_included[t.levels_included.length - 1]} ·{' '}
                      <strong>{formatMora(t.total_mora)}</strong> Mora
                    </p>
                    <div className="talent-mats-mini">
                      {t.materials.map((m) => {
                        const img = iconUrl(m.icon)
                        return (
                          <ItemTooltip
                            key={m.slug}
                            data={{
                              name: m.name,
                              icon: img,
                              rarity: m.rarity,
                              category: m.category,
                              description: m.description,
                              source: m.source,
                            }}
                          >
                            <div className="talent-mat-mini">
                              <div className="talent-mat-mini-icon">
                                {img ? <img src={img} alt={m.name} loading="lazy" /> : <span>?</span>}
                              </div>
                              <div className="talent-mat-mini-qty">×{m.quantity}</div>
                            </div>
                          </ItemTooltip>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>

          <h3 className="talent-total-title">Total consolidado</h3>
          <div className="talent-grid">
            {data.grand_total_materials.map((m) => {
              const img = iconUrl(m.icon)
              return (
                <ItemTooltip
                  key={m.slug}
                  data={{
                    name: m.name,
                    icon: img,
                    rarity: m.rarity,
                    category: m.category,
                    description: m.description,
                    source: m.source,
                  }}
                >
                  <div className="talent-item">
                    <div className="talent-icon">
                      {img ? <img src={img} alt={m.name} loading="lazy" /> : <span>?</span>}
                    </div>
                    <div className="talent-info">
                      <div className="talent-name">{m.name}</div>
                      <div className="talent-meta">
                        <span className="stars">{'★'.repeat(m.rarity ?? 0)}</span>
                        <span
                          className="category-badge"
                          style={{
                            color: categoryInfo(m.category).color,
                            backgroundColor: categoryInfo(m.category).bg,
                          }}
                        >
                          {categoryInfo(m.category).label}
                        </span>
                      </div>
                    </div>
                    <div className="talent-qty">×{m.quantity}</div>
                  </div>
                </ItemTooltip>
              )
            })}
          </div>

          <div className="talent-mora">
            <div className="talent-mora-left">
              <img className="talent-mora-icon" src={iconUrl(MORA_ICON)!} alt="Mora" />
              <span className="talent-mora-label">Mora total (talentos)</span>
            </div>
            <span className="talent-mora-value">{formatMora(data.grand_total_mora)}</span>
          </div>

          <div className="talent-mora" style={{ marginTop: 12, borderColor: 'rgba(125, 211, 252, 0.3)', background: 'rgba(125, 211, 252, 0.05)' }}>
            <div className="talent-mora-left">
              <Coins size={24} color="#7dd3fc" />
              <span className="talent-mora-label">Ley Line Mora (para cobrir a Mora)</span>
            </div>
            <span className="talent-mora-value" style={{ color: '#7dd3fc' }}>{moraLeyline.runs} runs</span>
          </div>

          <p className="talent-hint" style={{ marginTop: 8 }}>
            {getLeylineMoraPerRun(wl).toLocaleString('pt-BR')} Mora por run · {moraLeyline.resin} resina total
          </p>
        </>
      )}
    </section>
  )
}
