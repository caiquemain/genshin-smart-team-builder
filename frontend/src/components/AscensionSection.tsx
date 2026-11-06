import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { useLanguage } from '../context/LanguageContext'
import { iconUrl } from '../config'
import type { AscensionCost } from '../types'
import ItemTooltip from './ItemTooltip'
import { categoryInfo } from '../utils/categories'
import { 
  computeCharXp, 
  computeMoraLeyline, 
  getLeylineXpPerRun, 
  getLeylineMoraPerRun,
  XP_BOOK_HERO,
  CHAR_MORA_PER_XP
} from '../utils/xp-costs'
import { BookOpen, Coins, Zap, Sparkles } from 'lucide-react'

const LEVEL_OPTIONS = [1, 20, 40, 50, 60, 70, 80]
const TARGET_LEVEL = 90
const MORA_ICON = 'UI_ItemIcon_202'
const HERO_WIT_ICON = 'UI_ItemIcon_104003'

function formatMora(n: number): string {
  return n.toLocaleString('pt-BR')
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`
  return String(n)
}

export default function AscensionSection({ slug }: { slug: string }) {
  const { lang } = useLanguage()
  const [fromLevel, setFromLevel] = useState(1)
  const [wl, setWl] = useState(9)
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

  const xp = computeCharXp(fromLevel, TARGET_LEVEL, wl)
  const moraLeyline = computeMoraLeyline(xp.moraLevelUp, wl)
  const moraTotal = (data?.total_mora ?? 0) + xp.moraLevelUp

  return (
    <section className="ascension-section">
      <h2>Materiais de Ascensão & Level Up</h2>
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
        <label>
          Nível do Mundo:{' '}
          <select value={wl} onChange={(e) => setWl(Number(e.target.value))}>
            {[0,1,2,3,4,5,6,7,8,9].map((l) => (
              <option key={l} value={l}>WL {l}</option>
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
              const ci = categoryInfo(m.category)
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
                  <div className="ascension-item">
                    <div className="ascension-icon">
                      {img ? <img src={img} alt={m.name} loading="lazy" /> : <span>?</span>}
                    </div>
                    <div className="ascension-info">
                      <div className="ascension-name">{m.name}</div>
                      <div className="ascension-meta">
                        <span className="stars">{'★'.repeat(m.rarity ?? 0)}</span>
                        <span
                          className="category-badge"
                          style={{ color: ci.color, backgroundColor: ci.bg }}
                        >
                          {ci.label}
                        </span>
                      </div>
                    </div>
                    <div className="ascension-qty">×{m.quantity}</div>
                  </div>
                </ItemTooltip>
              )
            })}
          </div>

          {/* Bloco de XP e Level Up */}
          <h3 style={{ marginTop: 32, marginBottom: 16, fontSize: 18, fontWeight: 700 }}>
            XP & Level Up
          </h3>
          <div className="ascension-grid">
            <ItemTooltip
              data={{
                name: "Experiência do Herói",
                icon: iconUrl(HERO_WIT_ICON),
                rarity: 4,
                category: 'character_exp',
                description: `Livro de XP grande (20.000 XP cada). Você precisa de ${xp.heroWits} unidades.`,
              }}
            >
              <div className="ascension-item">
                <div className="ascension-icon">
                  <img src={iconUrl(HERO_WIT_ICON)!} alt="Experiência do Herói" />
                </div>
                <div className="ascension-info">
                  <div className="ascension-name">Experiência do Herói</div>
                  <div className="ascension-meta">
                    <span style={{ color: '#4ade80' }}>{formatNumber(xp.xp)} XP total</span>
                  </div>
                </div>
                <div className="ascension-qty">×{xp.heroWits}</div>
              </div>
            </ItemTooltip>

            <div className="ascension-item">
              <div className="ascension-icon" style={{ background: 'rgba(251, 191, 36, 0.1)' }}>
                <Coins size={24} color="#fbbf24" />
              </div>
              <div className="ascension-info">
                <div className="ascension-name">Mora de Level Up</div>
                <div className="ascension-meta">
                  <span>Inclui apenas a mora de subir de nível</span>
                </div>
              </div>
              <div className="ascension-qty">{formatMora(xp.moraLevelUp)}</div>
            </div>

            <div className="ascension-item">
              <div className="ascension-icon" style={{ background: 'rgba(125, 211, 252, 0.1)' }}>
                <BookOpen size={24} color="#7dd3fc" />
              </div>
              <div className="ascension-info">
                <div className="ascension-name">Ley Line XP</div>
                <div className="ascension-meta">
                  <span>{getLeylineXpPerRun(wl).toLocaleString('pt-BR')} XP por run</span>
                </div>
              </div>
              <div className="ascension-qty">{xp.leylineRuns} runs</div>
            </div>

            <div className="ascension-item">
              <div className="ascension-icon" style={{ background: 'rgba(251, 191, 36, 0.1)' }}>
                <Coins size={24} color="#fbbf24" />
              </div>
              <div className="ascension-info">
                <div className="ascension-name">Ley Line Mora</div>
                <div className="ascension-meta">
                  <span>{getLeylineMoraPerRun(wl).toLocaleString('pt-BR')} Mora por run</span>
                </div>
              </div>
              <div className="ascension-qty">{moraLeyline.runs} runs</div>
            </div>
          </div>

          <div className="ascension-mora">
            <div className="ascension-mora-left">
              <img className="ascension-mora-icon" src={iconUrl(MORA_ICON)!} alt="Mora" />
              <span className="ascension-mora-label">Mora total (Ascensão + Level Up)</span>
            </div>
            <span className="ascension-mora-value">{formatMora(moraTotal)}</span>
          </div>

          <p className="ascension-mora-note">
            Resina total estimada em Ley Lines: {(xp.leylineResin + moraLeyline.resin).toLocaleString('pt-BR')} ⚡
          </p>
        </>
      )}
    </section>
  )
}
