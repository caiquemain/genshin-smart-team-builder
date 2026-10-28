import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api/client'
import { useLanguage } from '../context/LanguageContext'
import { iconUrl } from '../config'
import type { CharacterDetail, Constellation, Talent } from '../types'
import AscensionSection from '../components/AscensionSection'
import TalentSection from '../components/TalentSection'
import ItemTooltip from '../components/ItemTooltip'

const TALENT_LABELS: Record<string, string> = {
  normal_attack: 'Ataque Normal',
  elemental_skill: 'Habilidade Elemental',
  elemental_burst: 'Explosão Elemental',
}

const LANG_LABELS: Record<string, string> = {
  EN: 'Inglês',
  JP: 'Japonês',
  KR: 'Coreano',
  CHS: 'Chinês',
}

function formatRelease(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
}

function stripHtml(s: string | null | undefined): string {
  if (!s) return ''
  return s
    .replace(/<color=[^>]+>/g, '')
    .replace(/<\/color>/g, '')
    .replace(/\\n/g, '\n')
    .replace(/\{param\d+:[^}]+\}/g, '···')
}

function TalentCard({ talent }: { talent: Talent }) {
  const img = iconUrl(talent.icon)
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
  const elementEmoji: Record<string, string> = {
    pyro: '🔥', hydro: '💧', electro: '⚡', cryo: '❄️',
    anemo: '🌀', geo: '🪨', dendro: '🌿',
  }

  return (
    <div className={`character-page element-${char.element}`}>
      <Link to="/" className="back">← Voltar</Link>

      <div className="char-hero">
        <div className="char-hero-glow" />
        <div className="char-hero-avatar">
          {img ? <img src={img} alt={char.name} /> : <span className="card-emoji">{elementEmoji[char.element]}</span>}
        </div>
        <div className="char-hero-info">
          <div className="char-hero-rarity">{'★'.repeat(char.rarity)}</div>
          <h1>{char.name}</h1>
          {char.title && <p className="char-hero-title">{char.title}</p>}
          <div className="char-hero-meta">
            <span className="char-tag">{elementEmoji[char.element]} {char.element}</span>
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
        <section className="talents-info-section">
          <h2>Talentos</h2>
          <div className="talent-cards-grid">
            {char.talents.map((t) => <TalentCard key={t.talent_type} talent={t} />)}
          </div>
        </section>
      )}

      {char.constellations.length > 0 && (
        <section className="constellations-section">
          <h2>Constelações — {char.constellation_name}</h2>
          <div className="const-cards-grid">
            {char.constellations.map((c) => <ConstellationCard key={c.level} c={c} />)}
          </div>
        </section>
      )}

      <h2>Stats (nível 1)</h2>
      <table className="stats">
        <tbody>
          <tr><th>HP</th><td>{char.base_hp}</td></tr>
          <tr><th>ATK</th><td>{char.base_atk}</td></tr>
          <tr><th>DEF</th><td>{char.base_def}</td></tr>
        </tbody>
      </table>

      {char.slug && <AscensionSection slug={char.slug} />}
      {char.slug && <TalentSection slug={char.slug} />}
    </div>
  )
}
