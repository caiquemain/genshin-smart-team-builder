import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api/client'
import { useLanguage } from '../context/LanguageContext'
import { iconUrl } from '../config'
import { categoryInfo } from '../utils/categories'
import ItemTooltip from '../components/ItemTooltip'
import type { WeaponDetail, WeaponAscensionResponse } from '../types'

const WEAPON_TYPE_LABEL: Record<string, string> = {
  sword: 'Espada', claymore: 'Espadão', polearm: 'Lança', bow: 'Arco', catalyst: 'Catalisador',
}

const RARITY_COLORS: Record<number, string> = {
  1: '#8b8b8b', 2: '#5fa860', 3: '#5a8fd8', 4: '#a35bd8', 5: '#e0a647',
}

function stripHtml(s: string | null | undefined): string {
  if (!s) return ''
  return s
    .replace(/<color=[^>]+>/g, '').replace(/<\/color>/g, '')
    .replace(/<i>/g, '').replace(/<\/i>/g, '')
    .replace(/\\n/g, '\n')
    .replace(/\{param\d+:[^}]+\}/g, '···')
    .trim()
}

function AscensionSection({ slug }: { slug: string }) {
  const { lang } = useLanguage()
  const [fromLevel, setFromLevel] = useState(1)
  const [data, setData] = useState<WeaponAscensionResponse | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    api.getWeaponAscension(slug, fromLevel, 90, lang)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [slug, fromLevel, lang])

  const moraIcon = iconUrl('UI_ItemIcon_202')

  return (
    <section className="ascension-section">
      <h2>Materiais de Ascensão</h2>
      <div className="ascension-controls">
        <label>
          Nível atual:{' '}
          <select value={fromLevel} onChange={(e) => setFromLevel(Number(e.target.value))}>
            {[1, 20, 40, 50, 60, 70, 80].map((l) => (
              <option key={l} value={l}>{l === 1 ? '1 (do zero)' : l}</option>
            ))}
          </select>
        </label>
        <span className="ascension-target">→ 90</span>
      </div>

      {loading && <p className="status">Calculando...</p>}

      {data && data.materials.length === 0 && (
        <p className="status">Nenhuma ascensão necessária.</p>
      )}

      {data && data.materials.length > 0 && (
        <>
          <p className="status">{data.materials.length} tipo(s) · fases: {data.phases_included.join(', ')}</p>
          <div className="ascension-grid">
            {data.materials.map((m) => {
              const img = iconUrl(m.icon)
              const ci = categoryInfo(m.category)
              return (
                <ItemTooltip key={m.slug} data={{
                  name: m.name, icon: img, rarity: m.rarity, category: m.category,
                  description: m.description, source: m.source,
                }}>
                  <div className="ascension-item">
                    <div className="ascension-icon">
                      {img ? <img src={img} alt={m.name} loading="lazy" /> : <span>?</span>}
                    </div>
                    <div className="ascension-info">
                      <div className="ascension-name">{m.name}</div>
                      <div className="ascension-meta">
                        <span className="stars">{'★'.repeat(m.rarity ?? 0)}</span>
                        <span className="category-badge" style={{ color: ci.color, backgroundColor: ci.bg }}>
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
          <div className="ascension-mora">
            <div className="ascension-mora-left">
              <img className="ascension-mora-icon" src={moraIcon!} alt="Mora" />
              <span className="ascension-mora-label">Mora total</span>
            </div>
            <span className="ascension-mora-value">{data.total_mora.toLocaleString('pt-BR')}</span>
          </div>
        </>
      )}
    </section>
  )
}

export default function WeaponDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const { lang } = useLanguage()
  const [weapon, setWeapon] = useState<WeaponDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [passiveLevel, setPassiveLevel] = useState('0')

  useEffect(() => {
    if (!slug) return
    setWeapon(null)
    setError(null)
    api.getWeapon(slug, lang).then(setWeapon).catch((e) => setError(String(e)))
  }, [slug, lang])

  if (error) return <p className="error">Erro: {error}</p>
  if (!weapon) return <p className="status">Carregando...</p>

  const img = iconUrl(weapon.icon)
  const accent = RARITY_COLORS[weapon.rarity] ?? '#94a3b8'
  const passiveLevels = weapon.passive_levels || {}
  const passiveKeys = Object.keys(passiveLevels).sort()

  return (
    <div className="weapon-page">
      <Link to="/weapons" className="back">← Armas</Link>

      <div className="weapon-hero">
        <div className="weapon-hero-glow" style={{ background: `radial-gradient(circle, ${accent} 0%, transparent 70%)` }} />
        <div className="weapon-hero-icon" style={{ borderColor: accent }}>
          {img ? <img src={img} alt={weapon.name} /> : <span>?</span>}
        </div>
        <div className="weapon-hero-info">
          <div className="weapon-hero-rarity" style={{ color: accent }}>{'★'.repeat(weapon.rarity)}</div>
          <h1>{weapon.name}</h1>
          <p className="weapon-hero-type">
            {WEAPON_TYPE_LABEL[weapon.weapon_type] ?? weapon.weapon_type}
          </p>
          {weapon.description && <p className="weapon-hero-desc">{stripHtml(weapon.description)}</p>}
        </div>
      </div>

      <div className="weapon-stats">
        <div className="weapon-stat-card">
          <div className="weapon-stat-card-label">ATK Base</div>
          <div className="weapon-stat-card-value">{weapon.base_atk}</div>
        </div>
        {weapon.secondary_stat && (
          <div className="weapon-stat-card">
            <div className="weapon-stat-card-label">{weapon.secondary_stat.replace(/_/g, ' ')}</div>
            <div className="weapon-stat-card-value">
              {weapon.secondary_stat_value?.toFixed(1)}{weapon.secondary_stat.endsWith('_pct') || weapon.secondary_stat.includes('dmg') || weapon.secondary_stat === 'crit_rate' || weapon.secondary_stat === 'crit_dmg' || weapon.secondary_stat === 'er' || weapon.secondary_stat === 'healing_bonus' ? '%' : ''}
            </div>
          </div>
        )}
      </div>

      {weapon.passive_name && (
        <section className="weapon-passive-section">
          <h2>Passiva — {weapon.passive_name}</h2>
          {passiveKeys.length > 0 && (
            <div className="passive-level-tabs">
              {passiveKeys.map((k) => (
                <button
                  key={k}
                  className={`passive-level-tab ${k === passiveLevel ? 'active' : ''}`}
                  onClick={() => setPassiveLevel(k)}
                >
                  R{Number(k) + 1}
                </button>
              ))}
            </div>
          )}
          <p className="weapon-passive-desc">
            {stripHtml(passiveLevels[passiveLevel] || weapon.passive_description)}
          </p>
        </section>
      )}

      {slug && <AscensionSection slug={slug} />}
    </div>
  )
}
