import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api/client'
import { useLanguage } from '../context/LanguageContext'
import { iconUrl } from '../config'
import type { CharacterDetail, Constellation, Talent, Passive, TalentScalings, WeaponSummary } from '../types'
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
    .trim()
}

function TalentCard({ talent }: { talent: Talent }) {
  const img = iconUrl(talent.icon)
  const hasSc = talent.scalings && Object.keys(talent.scalings).length > 0
  const levels = useMemo(() => {
    if (!talent.scalings) return []
    return Object.keys(talent.scalings).sort((a, b) => Number(a) - Number(b))
  }, [talent.scalings])
  const [level, setLevel] = useState(levels[0] ?? '1')
  const rows = talent.scalings?.[level] ?? []

  return (
    <div className="talent-card-v2">
      <div className="talent-card-v2-header">
        <div className="talent-card-v2-icon">
          {img ? <img src={img} alt={talent.name} /> : <span>?</span>}
        </div>
        <div className="talent-card-v2-title">
          <div className="talent-card-v2-type">{TALENT_LABELS[talent.talent_type]}</div>
          <h3>{talent.name}</h3>
        </div>
      </div>

      {talent.description && (
        <p className="talent-card-v2-desc">{stripHtml(talent.description)}</p>
      )}

      {hasSc && (
        <details className="talent-card-v2-sc" open={false}>
          <summary>
            <span className="sc-label">Escalonamento por nível</span>
            <span className="sc-hint">{levels.length} níveis</span>
          </summary>
          <div className="sc-body">
            <div className="sc-level-tabs">
              {levels.map((l) => (
                <button
                  key={l}
                  className={`sc-level-tab ${l === level ? 'active' : ''}`}
                  onClick={() => setLevel(l)}
                >
                  {l}
                </button>
              ))}
            </div>
            <table className="sc-table">
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td>{r.label}</td>
                    <td className="sc-val">{r.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  )
}

function ConstellationCard({ c }: { c: Constellation }) {
  const img = iconUrl(c.icon)
  return (
    <div className="const-card-v2">
      <div className="const-card-v2-badge">C{c.level}</div>
      <div className="const-card-v2-icon">
        {img ? <img src={img} alt={c.name} /> : <span>?</span>}
      </div>
      <div className="const-card-v2-body">
        <h3>{c.name}</h3>
        {c.description && (
          <p>{stripHtml(c.description)}</p>
        )}
      </div>
    </div>
  )
}

function PassiveCard({ passive }: { passive: Passive }) {
  const img = iconUrl(passive.icon)
  return (
    <div className="passive-card-v2">
      <div className="passive-card-v2-icon">
        {img ? <img src={img} alt={passive.name} /> : <span>?</span>}
      </div>
      <div className="passive-card-v2-body">
        <h3>{passive.name}</h3>
        {passive.description && (
          <p>{stripHtml(passive.description)}</p>
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
  const [recommendedWeapons, setRecommendedWeapons] = useState<WeaponSummary[]>([])
  const [activeId, setActiveId] = useState<string>('visao-geral')

  useEffect(() => {
    if (!slug) return
    setChar(null)
    setError(null)
    api.getCharacter(slug, lang).then(setChar).catch((e) => setError(String(e)))
  }, [slug, lang])

  // Buscar armas recomendadas quando o personagem carregar
  useEffect(() => {
    if (!char) return
    api.listWeapons(lang, { weapon_type: char.weapon_type, limit: 50 })
      .then((d) => setRecommendedWeapons(d.items))
      .catch(() => setRecommendedWeapons([]))
  }, [char?.weapon_type, lang])

  const basePassives = useMemo(
    () => (char?.passives ?? []).filter((p) => p.kind !== 'constellation_upgrade'),
    [char?.passives],
  )

  const sections = useMemo(() => {
    if (!char) return []
    return [
      { id: 'visao-geral', label: 'Visão Geral' },
      char.talents.length > 0 && { id: 'talentos-info', label: 'Talentos' },
      basePassives.length > 0 && { id: 'passivos', label: 'Passivos' },
      char.constellations.length > 0 && { id: 'constelacoes', label: 'Constelações' },
      { id: 'stats', label: 'Stats' },
      { id: 'ascensao', label: 'Ascensão' },
      { id: 'talentos-custos', label: 'Custo de Talentos' },
    ].filter(Boolean) as { id: string; label: string }[]
  }, [char, basePassives])

  // Scroll spy
  useEffect(() => {
    if (!char || sections.length === 0) return
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible.length > 0) setActiveId(visible[0].target.id)
      },
      { rootMargin: '-120px 0px -55% 0px', threshold: 0 },
    )
    sections.forEach((s) => {
      const el = document.getElementById(s.id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [char, sections])

  if (error) return <p className="error">Erro: {error}</p>
  if (!char) return <p className="status">Carregando...</p>

  const img = iconUrl(char.icon)
  const releaseFmt = formatRelease(char.release_date)

  return (
    <div className={`character-page element-${char.element}`}>
      <div className="char-page-layout">
        <aside className="char-toc-v2">
          <div className="char-toc-v2-title">Nesta página</div>
          <nav className="char-toc-v2-list">
            {sections.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className={`char-toc-v2-link ${activeId === s.id ? 'active' : ''}`}
              >
                {s.label}
              </a>
            ))}
          </nav>
        </aside>

        <div>
          <Link to="/" className="back">← Voltar</Link>

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
            <section id="talentos-info" className="talents-v2-section char-section-anchor">
              <h2>Talentos</h2>
              <div className="talents-v2-list">
                {char.talents.map((t) => <TalentCard key={t.talent_type} talent={t} />)}
              </div>
            </section>
          )}

          {basePassives.length > 0 && (
            <section id="passivos" className="passives-v2-section char-section-anchor">
              <h2>Passivos</h2>
              <div className="passives-v2-grid">
                {basePassives.map((p, i) => (
                  <PassiveCard key={`${p.name}-${i}`} passive={p} />
                ))}
              </div>
            </section>
          )}

          {char.constellations.length > 0 && (
            <section id="constelacoes" className="consts-v2-section char-section-anchor">
              <h2>Constelações — {char.constellation_name}</h2>
              <div className="consts-v2-grid">
                {char.constellations.map((c) => <ConstellationCard key={c.level} c={c} />)}
              </div>
            </section>
          )}

          <section id="stats" className="char-section-anchor">
            <h2>Stats (nível 1)</h2>
            <table className="stats">
              <tbody>
                <tr><th>HP</th><td>{char.base_hp}</td></tr>
                <tr><th>ATK</th><td>{char.base_atk}</td></tr>
                <tr><th>DEF</th><td>{char.base_def}</td></tr>
              </tbody>
            </table>
          </section>

          {recommendedWeapons.length > 0 && (
            <section id="armas" className="recommended-weapons-section char-section-anchor">
              <h2>Armas ({char.weapon_type})</h2>
              <div className="recommended-weapons-grid">
                {recommendedWeapons.filter(w => w.rarity >= 4).slice(0, 12).map((w) => {
                  const wImg = iconUrl(w.icon)
                  return (
                    <Link key={w.slug} to={`/weapons/${w.slug}`} className={`weapon-card-mini rarity-${w.rarity}`}>
                      <div className="weapon-card-mini-icon">
                        {wImg ? <img src={wImg} alt={w.name} loading="lazy" /> : <span>?</span>}
                      </div>
                      <div className="weapon-card-mini-name">{w.name}</div>
                      <div className="weapon-card-mini-rarity">{'★'.repeat(w.rarity)}</div>
                    </Link>
                  )
                })}
              </div>
            </section>
          )}

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
