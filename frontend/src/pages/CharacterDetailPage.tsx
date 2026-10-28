import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api/client'
import { useLanguage } from '../context/LanguageContext'
import { iconUrl } from '../config'
import type { CharacterDetail, Constellation, Talent, Passive, TalentScalings } from '../types'
import AscensionSection from '../components/AscensionSection'
import TalentSection from '../components/TalentSection'

const TALENT_LABELS: Record<string, string> = {
  normal_attack: 'Ataque Normal',
  elemental_skill: 'Habilidade Elemental',
  elemental_burst: 'Explosão Elemental',
}

const LANG_LABELS: Record<string, string> = {
  EN: 'Inglês', JP: 'Japonês', KR: 'Coreano', CHS: 'Chinês',
}

const ELEMENT_EMOJI: Record<string, string> = {
  pyro: '🔥', hydro: '💧', electro: '⚡', cryo: '❄️',
  anemo: '🌀', geo: '🪨', dendro: '🌿',
}

function formatRelease(iso: string | null): string | null {
  if (!iso) return null
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return null
  const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
  return `${d} de ${months[m - 1]} de ${y}`
}

function stripHtml(s: string | null | undefined): string {
  if (!s) return ''
  return s
    .replace(/<color=[^>]+>/g, '')
    .replace(/<\/color>/g, '')
    .replace(/<i>/g, '').replace(/<\/i>/g, '')
    .replace(/\\n/g, '\n')
    .replace(/\{param\d+:[^}]+\}/g, '···')
}

function TalentScalingsView({ scalings }: { scalings: TalentScalings }) {
  const levels = Object.keys(scalings).sort((a, b) => Number(a) - Number(b))
  const [level, setLevel] = useState(levels[0] ?? '1')
  const rows = scalings[level] ?? []
  if (levels.length === 0) return null
  return (
    <div className="talent-scalings">
      <div className="scalings-header">
        <span className="scalings-title">Escalonamento por nível</span>
        <div className="scalings-levels">
          {levels.map((l) => (
            <button
              key={l}
              className={`scalings-level-btn ${l === level ? 'active' : ''}`}
              onClick={() => setLevel(l)}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
      <table className="scalings-table">
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td>{r.label}</td>
              <td className="scalings-value">{r.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TalentCard({ talent }: { talent: Talent }) {
  const img = iconUrl(talent.icon)
  const hasSc = talent.scalings && Object.keys(talent.scalings).length > 0
  return (
    <div className="talent-card">
      <div className="talent-card-icon">
        {img ? <img src={img} alt={talent.name} /> : <span>?</span>}
      </div>
      <div className="talent-card-body">
        <div className="talent-card-type">{TALENT_LABELS[talent.talent_type]}</div>
        <div className="talent-card-name">{talent.name}</div>
        {talent.description && (
          <p className="talent-card-desc">{stripHtml(talent.description)}</p>
        )}
        {hasSc && (
          <details className="talent-scalings-details">
            <summary>Ver escalonamento por nível</summary>
            <TalentScalingsView scalings={talent.scalings!} />
          </details>
        )}
      </div>
    </div>
  )
}

function ConstellationCard({ c }: { c: Constellation }) {
  const img = iconUrl(c.icon)
  return (
    <div className="const-card">
      <div className="const-card-level">C{c.level}</div>
      <div className="const-card-icon">
        {img ? <img src={img} alt={c.name} /> : <span>?</span>}
      </div>
      <div className="const-card-body">
        <div className="const-card-name">{c.name}</div>
        {c.description && (
          <p className="const-card-desc">{stripHtml(c.description)}</p>
        )}
      </div>
    </div>
  )
}

function PassiveCard({ passive }: { passive: Passive }) {
  const img = iconUrl(passive.icon)
  return (
    <div className="passive-card">
      <div className="passive-card-icon">
        {img ? <img src={img} alt={passive.name} /> : <span>?</span>}
      </div>
      <div className="passive-card-body">
        <div className="passive-card-name">{passive.name}</div>
        {passive.description && (
          <p className="passive-card-desc">{stripHtml(passive.description)}</p>
        )}
      </div>
    </div>
  )
}

export default function CharacterDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const { lang } = useLanguage()
  const [char, setChar] = useState<CharacterDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!slug) return
    setChar(null)
    setError(null)
    api.getCharacter(slug, lang).then(setChar).catch((e) => setError(String(e)))
  }, [slug, lang])

  if (error) return <p className="error">Erro: {error}</p>
  if (!char) return <p className="status">Carregando...</p>

  const img = iconUrl(char.icon)
  const releaseFmt = formatRelease(char.release_date)
  const basePassives = char.passives.filter((p) => p.kind !== 'constellation_upgrade')

  const sections = [
    { id: 'visao-geral', label: 'Visão Geral' },
    char.talents.length > 0 && { id: 'talentos-info', label: 'Talentos' },
    basePassives.length > 0 && { id: 'passivos', label: 'Passivos' },
    char.constellations.length > 0 && { id: 'constelacoes', label: 'Constelações' },
    { id: 'stats', label: 'Stats' },
    { id: 'ascensao', label: 'Ascensão' },
    { id: 'talentos-custos', label: 'Custo de Talentos' },
  ].filter(Boolean) as { id: string; label: string }[]

  return (
    <div className={`character-page element-${char.element}`}>
      <Link to="/" className="back">← Voltar</Link>

      <div className="char-page-layout">
        <aside className="char-toc">
          <div className="char-toc-title">Nesta página</div>
          <nav className="char-toc-list">
            {sections.map((s) => (
              <a key={s.id} href={`#${s.id}`} className="char-toc-link">{s.label}</a>
            ))}
          </nav>
        </aside>

        <div>
          <div id="visao-geral" className="char-hero char-section-anchor">
            <div className="char-hero-glow" />
            <div className="char-hero-avatar">
              {img ? <img src={img} alt={char.name} /> : <span className="card-emoji">{ELEMENT_EMOJI[char.element]}</span>}
            </div>
            <div className="char-hero-info">
              <div className="char-hero-rarity">{'★'.repeat(char.rarity)}</div>
              <h1>{char.name}</h1>
              {char.title && <p className="char-hero-title">{char.title}</p>}
              <div className="char-hero-meta">
                <span className="char-tag">{ELEMENT_EMOJI[char.element]} {char.element}</span>
                <span className="char-tag">⚔️ {char.weapon_type}</span>
                {char.region && <span className="char-tag">📍 {char.region}</span>}
              </div>
              {char.description && (
                <p className="char-hero-desc">{stripHtml(char.description)}</p>
              )}
            </div>
          </div>

          <div className="char-info-grid">
            <div className="char-info-item">
              <div className="char-info-label">Aniversário</div>
              <div className="char-info-value">{char.birthday || '—'}</div>
            </div>
            {releaseFmt && (
              <div className="char-info-item">
                <div className="char-info-label">Lançado em</div>
                <div className="char-info-value">{releaseFmt}</div>
              </div>
            )}
            <div className="char-info-item">
              <div className="char-info-label">Constelação</div>
              <div className="char-info-value">{char.constellation_name || '—'}</div>
            </div>
            {char.ascension_stat && (
              <div className="char-info-item">
                <div className="char-info-label">Stat de Ascensão</div>
                <div className="char-info-value">
                  {char.ascension_stat.replace(/_/g, ' ')}
                  {char.ascension_stat_value ? ` +${char.ascension_stat_value}` : ''}
                </div>
              </div>
            )}
          </div>

          {char.voice_actors && Object.keys(char.voice_actors).length > 0 && (
            <section className="voice-section">
              <h2>Vozes</h2>
              <div className="voice-grid">
                {(['EN', 'JP', 'KR', 'CHS'] as const).map((code) => {
                  const name = char.voice_actors?.[code]
                  if (!name) return null
                  return (
                    <div key={code} className="voice-item">
                      <div className="voice-lang">{LANG_LABELS[code]}</div>
                      <div className="voice-name">{name}</div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {char.talents.length > 0 && (
            <section id="talentos-info" className="talents-info-section char-section-anchor">
              <h2>Talentos</h2>
              <div className="talent-cards-grid">
                {char.talents.map((t) => <TalentCard key={t.talent_type} talent={t} />)}
              </div>
            </section>
          )}

          {basePassives.length > 0 && (
            <section id="passivos" className="passives-section char-section-anchor">
              <h2>Passivos</h2>
              <div className="passive-cards-grid">
                {basePassives.map((p, i) => (
                  <PassiveCard key={`${p.name}-${i}`} passive={p} />
                ))}
              </div>
            </section>
          )}

          {char.constellations.length > 0 && (
            <section id="constelacoes" className="constellations-section char-section-anchor">
              <h2>Constelações — {char.constellation_name}</h2>
              <div className="const-cards-grid">
                {char.constellations.map((c) => <ConstellationCard key={c.level} c={c} />)}
              </div>
            </section>
          )}

          <h2 id="stats" className="char-section-anchor">Stats (nível 1)</h2>
          <table className="stats">
            <tbody>
              <tr><th>HP</th><td>{char.base_hp}</td></tr>
              <tr><th>ATK</th><td>{char.base_atk}</td></tr>
              <tr><th>DEF</th><td>{char.base_def}</td></tr>
            </tbody>
          </table>

          <div id="ascensao" className="char-section-anchor">
            {char.slug && <AscensionSection slug={char.slug} />}
          </div>
          <div id="talentos-custos" className="char-section-anchor">
            {char.slug && <TalentSection slug={char.slug} />}
          </div>
        </div>
      </div>
    </div>
  )
}
