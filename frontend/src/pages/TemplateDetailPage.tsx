import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api/client'
import { useLanguage } from '../context/LanguageContext'
import { iconUrl, artifactIconUrl } from '../config'
import { archetypeInfo } from '../utils/archetypes'
import { categoryInfo } from '../utils/categories'
import ItemTooltip from '../components/ItemTooltip'
import type { TeamTemplateDetail, CharacterSummary, WeaponSummary, ArtifactSetSummary } from '../types'

function scoreColor(score: number): string {
  if (score >= 75) return '#4ade80'
  if (score >= 50) return '#fbbf24'
  return '#f87171'
}

function scoreLabel(score: number): string {
  if (score >= 85) return 'Excelente'
  if (score >= 70) return 'Bom'
  if (score >= 50) return 'Ok'
  if (score >= 30) return 'Fraco'
  return 'Ruim'
}

export default function TemplateDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { lang } = useLanguage()
  const [template, setTemplate] = useState<TeamTemplateDetail | null>(null)
  const [chars, setChars] = useState<Map<string, CharacterSummary>>(new Map())
  const [weapons, setWeapons] = useState<Map<string, WeaponSummary>>(new Map())
  const [artifacts, setArtifacts] = useState<Map<string, ArtifactSetSummary>>(new Map())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    const tid = parseInt(id)
    if (isNaN(tid)) { setError('ID inválido'); return }

    setTemplate(null); setError(null)

    Promise.all([
      api.getTemplate(tid),
      api.listCharacters(lang, { limit: 200 }),
      api.listWeapons(lang, { limit: 500 }),
      api.listArtifacts(lang, { limit: 100 }),
    ])
      .then(([t, c, w, a]) => {
        setTemplate(t)
        const cm = new Map<string, CharacterSummary>()
        c.items.forEach((x) => cm.set(x.slug, x))
        setChars(cm)
        const wm = new Map<string, WeaponSummary>()
        w.items.forEach((x) => wm.set(x.slug, x))
        setWeapons(wm)
        const am = new Map<string, ArtifactSetSummary>()
        a.items.forEach((x) => am.set(x.slug, x))
        setArtifacts(am)
      })
      .catch((e) => setError(String(e)))
  }, [id, lang])

  if (error) return <p className="error">Erro: {error}</p>
  if (!template) return <p className="status">Carregando...</p>

  const arch = archetypeInfo(template.archetype)
  const weapon = template.weapon_slug ? weapons.get(template.weapon_slug) : null
  const artifact = template.artifact_set_slug ? artifacts.get(template.artifact_set_slug) : null
  const analysis = template.analysis

  return (
    <div className="template-detail-page">
      <Link to="/teams" className="back">← Times</Link>

      <div className="template-detail-hero" style={{ borderColor: `${arch.color}40` }}>
        <div className="template-detail-arch" style={{ background: `${arch.color}20`, color: arch.color }}>
          {arch.emoji} {arch.label}
        </div>
        <h1>{template.name}</h1>
        {template.description && <p className="template-detail-desc">{template.description}</p>}
        <div className="template-detail-source">
          Fonte: <a href={template.source_url || '#'} target="_blank" rel="noopener noreferrer">
            {template.source} ↗
          </a>
        </div>
      </div>

      <h2>Time</h2>
      <div className="template-detail-team">
        {template.character_slugs.map((slug) => {
          const c = chars.get(slug)
          const img = c ? iconUrl(c.icon) : null
          const isMain = slug === template.main_character
          return (
            <Link
              key={slug}
              to={`/characters/${slug}`}
              className={`template-char-card ${isMain ? 'template-char-main' : ''}`}
            >
              <div className="template-char-icon">
                {img ? <img src={img} alt={c?.name ?? slug} /> : <span>?</span>}
              </div>
              <div className="template-char-name">{c?.name ?? slug}</div>
              {isMain && <div className="template-char-main-badge">Main</div>}
            </Link>
          )
        })}
      </div>

      {analysis && (
        <section className="analysis-panel">
          <div className="analysis-header">
            <h2>Análise do time</h2>
            <div className="analysis-score" style={{ color: scoreColor(analysis.score) }}>
              {analysis.score}<span className="score-max">/100</span>
              <span className="score-label">{scoreLabel(analysis.score)}</span>
            </div>
          </div>
          <div className="score-bar">
            <div className="score-bar-fill" style={{ width: `${analysis.score}%`, background: scoreColor(analysis.score) }} />
          </div>

          {analysis.reactions.length > 0 && (
            <div className="analysis-section">
              <div className="analysis-section-title">Reações viáveis</div>
              <div className="reactions-pills">
                {analysis.reactions.map((r) => (
                  <span key={r.slug} className="reaction-pill">{r.name}</span>
                ))}
              </div>
            </div>
          )}

          {analysis.warnings.length > 0 && (
            <div className="analysis-section">
              <div className="analysis-section-title">⚠️ Alertas</div>
              <div className="analysis-warnings">
                {analysis.warnings.map((w, i) => (
                  <div key={i} className="warning-line">{w}</div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {(weapon || artifact || template.notes) && (
        <>
          <h2>Build recomendada</h2>
          <div className="template-detail-build">
            {weapon && (
              <Link to={`/weapons/${weapon.slug}`} className="template-build-card">
                <div className="template-build-label">Arma</div>
                <div className="template-build-icon">
                  {iconUrl(weapon.icon) ? <img src={iconUrl(weapon.icon)!} alt={weapon.name} /> : <span>?</span>}
                </div>
                <div className="template-build-name">{weapon.name}</div>
              </Link>
            )}
            {artifact && (
              <Link to={`/artifacts/${artifact.slug}`} className="template-build-card">
                <div className="template-build-label">Artefato (4pc)</div>
                <div className="template-build-icon">
                  {artifactIconUrl(artifact.icon) ? <img src={artifactIconUrl(artifact.icon)!} alt={artifact.name} /> : <span>?</span>}
                </div>
                <div className="template-build-name">{artifact.name}</div>
              </Link>
            )}
          </div>
          {template.notes && (
            <p className="template-detail-notes">
              <strong>Notas:</strong> {template.notes}
            </p>
          )}
        </>
      )}

      <div className="template-detail-cta">
        <Link to={`/teams/new?template_id=${template.id}`} className="btn-primary">
          Usar este time no builder →
        </Link>
      </div>
    </div>
  )
}
