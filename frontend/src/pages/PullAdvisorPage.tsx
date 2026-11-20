import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Sparkles, Target, Compass, Flame, Users, ChevronDown, ChevronUp,
  ArrowRight, AlertTriangle, RefreshCw, Swords, Check,
} from 'lucide-react'
import { api } from '../api/client'
import { useLanguage } from '../context/LanguageContext'
import { iconUrl } from '../config'
import { archetypeInfo } from '../utils/archetypes'
import { useRoster } from '../utils/roster'
import type {
  CharacterSummary,
  PullAdvisorResponse,
  PullCandidate,
  PullGoal,
} from '../types'

const ELEMENT_PALETTE: Record<string, { text: string; bg: string; border: string }> = {
  pyro:    { text: '#fb923c', bg: 'rgba(249, 115, 22, 0.14)', border: 'rgba(249, 115, 22, 0.42)' },
  hydro:   { text: '#38bdf8', bg: 'rgba(56, 189, 248, 0.14)', border: 'rgba(56, 189, 248, 0.42)' },
  cryo:    { text: '#67e8f9', bg: 'rgba(103, 232, 249, 0.14)', border: 'rgba(103, 232, 249, 0.42)' },
  electro: { text: '#c084fc', bg: 'rgba(192, 132, 252, 0.14)', border: 'rgba(192, 132, 252, 0.42)' },
  anemo:   { text: '#34d399', bg: 'rgba(52, 211, 153, 0.14)', border: 'rgba(52, 211, 153, 0.42)' },
  geo:     { text: '#fbbf24', bg: 'rgba(251, 191, 36, 0.14)', border: 'rgba(251, 191, 36, 0.42)' },
  dendro:  { text: '#a3e635', bg: 'rgba(132, 204, 22, 0.14)', border: 'rgba(132, 204, 22, 0.42)' },
}

const TIER_PALETTE: Record<string, { text: string; bg: string; border: string }> = {
  'S+': { text: '#f87171', bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.45)' },
  'S':  { text: '#fb923c', bg: 'rgba(251, 146, 60, 0.15)', border: 'rgba(251, 146, 60, 0.45)' },
  'A':  { text: '#fbbf24', bg: 'rgba(251, 191, 36, 0.15)', border: 'rgba(251, 191, 36, 0.45)' },
  'B':  { text: '#4ade80', bg: 'rgba(74, 222, 128, 0.14)', border: 'rgba(74, 222, 128, 0.40)' },
  'C':  { text: '#60a5fa', bg: 'rgba(96, 165, 250, 0.14)', border: 'rgba(96, 165, 250, 0.40)' },
  'D':  { text: '#94a3b8', bg: 'rgba(148, 163, 184, 0.12)', border: 'rgba(148, 163, 184, 0.35)' },
}

const GOALS: { key: PullGoal; label: string; labelEn: string; desc: string }[] = [
  { key: 'meta', label: 'Meta Geral', labelEn: 'General Meta', desc: 'Equilíbrio entre Consenso Geral (7 fontes), times e lacunas' },
  { key: 'unlock_teams', label: 'Fechar Times', labelEn: 'Unlock Teams', desc: 'Prioriza personagens que fecham times 3/4 → 4/4 na sua conta' },
  { key: 'endgame', label: 'Endgame (30d)', labelEn: 'Endgame (30d)', desc: 'Foco no ciclo atual do Abismo Espiral + Stygian Onslaught' },
  { key: 'imaginarium', label: 'Teatro Imaginário', labelEn: 'Imaginarium Theater', desc: 'Prioriza elementos carentes e cobertura de funções da conta' },
]

const ELEMENTS = ['all', 'pyro', 'hydro', 'cryo', 'electro', 'anemo', 'geo', 'dendro']

function reasonTone(text: string): string {
  const low = text.toLowerCase()
  if (low.startsWith('fecha ') || low.startsWith('deixa ')) return 'tone-team'
  if (low.includes('main dps forte')) return 'tone-dps'
  if (low.includes('consenso geral')) return 'tone-meta'
  if (low.includes('endgame')) return 'tone-endgame'
  if (low.includes('elemento carente')) return 'tone-element'
  return 'tone-synergy'
}

function tierBadgeStyle(tier: string): React.CSSProperties {
  const p = TIER_PALETTE[tier] ?? TIER_PALETTE['D']
  return { color: p.text, background: p.bg, borderColor: p.border }
}

function elementStyle(el: string): React.CSSProperties {
  const p = ELEMENT_PALETTE[el] ?? { text: '#cbd5e1', bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.3)' }
  return { color: p.text, background: p.bg, borderColor: p.border }
}

function CandidateCard({
  candidate,
  rank,
  charsMap,
  highlight = false,
  defaultExpanded = false,
}: {
  candidate: PullCandidate
  rank?: number
  charsMap: Map<string, CharacterSummary>
  highlight?: boolean
  defaultExpanded?: boolean
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const elPal = ELEMENT_PALETTE[candidate.element] ?? { text: '#38bdf8', bg: 'rgba(56,189,248,0.14)', border: 'rgba(56,189,248,0.4)' }
  const img = iconUrl(candidate.icon)

  return (
    <div
      className={`pa-card ${highlight ? 'is-highlight' : ''}`}
      style={{ borderLeftColor: elPal.text }}
    >
      <div className="pa-card-head">
        {rank !== undefined && <div className="pa-rank">#{rank}</div>}
        <div className="pa-avatar" style={{ borderColor: elPal.text }}>
          {img ? <img src={img} alt={candidate.name} loading="lazy" /> : <span>?</span>}
        </div>
        <div className="pa-char-info">
          <div className="pa-char-name-row">
            <Link to={`/characters/${candidate.slug}`} className="pa-char-name">
              {candidate.name}
            </Link>
            <span className="pa-rarity">{'★'.repeat(candidate.rarity)}</span>
            <span className="pa-element-chip" style={elementStyle(candidate.element)}>
              {candidate.element}
            </span>
            {candidate.already_owned && (
              <span className="pa-owned-pill">Você já tem</span>
            )}
          </div>
          <div className="pa-tier-pills">
            {candidate.general_tier && (
              <span
                className="pa-tier-pill"
                style={tierBadgeStyle(candidate.general_tier)}
                title={`Consenso em ${candidate.general_sites} fontes gerais`}
              >
                Geral <strong>{candidate.general_tier}</strong>
              </span>
            )}
            {candidate.abyss_tier && (
              <span
                className="pa-tier-pill"
                style={tierBadgeStyle(candidate.abyss_tier)}
                title="YS Helper — Abismo 30d"
              >
                Abismo <strong>{candidate.abyss_tier}</strong>
              </span>
            )}
            {candidate.stygian_tier && (
              <span
                className="pa-tier-pill"
                style={tierBadgeStyle(candidate.stygian_tier)}
                title="Stygian Onslaught 30d (YS + Chefes)"
              >
                Stygian <strong>{candidate.stygian_tier}</strong>
              </span>
            )}
          </div>
        </div>
        <div className="pa-score-box">
          <div className="pa-score-num">{Math.round(candidate.score)}</div>
          <span className={`pa-verdict-badge ${candidate.verdict}`}>
            {candidate.verdict_label}
          </span>
        </div>
      </div>

      {/* 4 sinais transparentes */}
      <div className="pa-bars">
        <div className="pa-bar-item">
          <div className="pa-bar-top">
            <span>Consenso Geral</span>
            <strong>{Math.round(candidate.breakdown.general_meta)}</strong>
          </div>
          <div className="pa-bar-track">
            <div className="pa-bar-fill" style={{ width: `${candidate.breakdown.general_meta}%`, background: '#38bdf8' }} />
          </div>
        </div>
        <div className="pa-bar-item">
          <div className="pa-bar-top">
            <span>Desbloqueio de Times</span>
            <strong>{Math.round(candidate.breakdown.team_unlocks)}</strong>
          </div>
          <div className="pa-bar-track">
            <div className="pa-bar-fill" style={{ width: `${candidate.breakdown.team_unlocks}%`, background: '#4ade80' }} />
          </div>
        </div>
        <div className="pa-bar-item">
          <div className="pa-bar-top">
            <span>Lacunas & Sinergia</span>
            <strong>{Math.round(candidate.breakdown.account_gaps)}</strong>
          </div>
          <div className="pa-bar-track">
            <div className="pa-bar-fill" style={{ width: `${candidate.breakdown.account_gaps}%`, background: '#c084fc' }} />
          </div>
        </div>
        <div className="pa-bar-item">
          <div className="pa-bar-top">
            <span>Endgame 30d</span>
            <strong>{Math.round(candidate.breakdown.endgame_seasonal)}</strong>
          </div>
          <div className="pa-bar-track">
            <div className="pa-bar-fill" style={{ width: `${candidate.breakdown.endgame_seasonal}%`, background: '#fb923c' }} />
          </div>
        </div>
      </div>

      {candidate.reasons.length > 0 && (
        <div className="pa-reason-tags">
          {candidate.reasons.map((r, i) => (
            <span key={i} className={`pa-reason-tag ${reasonTone(r)}`}>
              {r}
            </span>
          ))}
        </div>
      )}

      {candidate.unlocked_teams.length > 0 && (
        <div>
          <button
            type="button"
            className="pa-unlocks-toggle"
            onClick={() => setExpanded((v) => !v)}
          >
            <span>
              {candidate.already_owned ? 'Times prontos com ele(a)' : 'Times que ele(a) fecha na sua conta'} ({candidate.unlocked_teams_count})
            </span>
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>

          {expanded && (
            <div className="pa-unlocks-list">
              {candidate.unlocked_teams.map((t) => {
                const arch = archetypeInfo(t.archetype)
                return (
                  <div key={t.id} className="pa-unlock-row">
                    <div className="pa-unlock-info">
                      <div className="pa-unlock-name" title={t.name}>{t.name}</div>
                      <div className="pa-unlock-meta">
                        <span
                          className="pa-unlock-arch-pill"
                          style={{ background: `${arch.color}22`, color: arch.color }}
                        >
                          {arch.label}
                        </span>
                        <span className="pa-unlock-source-pill">
                          {t.sources_count > 1 ? `${t.sources_count} fontes` : (t.source ?? 'Curado')}
                        </span>
                      </div>
                    </div>
                    <div className="pa-unlock-avatars">
                      {t.character_slugs.map((s) => {
                        const c = charsMap.get(s)
                        const cImg = c ? iconUrl(c.icon) : null
                        return (
                          <span
                            key={s}
                            className={`pa-unlock-avatar ${s === candidate.slug ? 'is-target' : ''}`}
                            title={c?.name ?? s}
                          >
                            {cImg ? <img src={cImg} alt={c?.name ?? s} /> : null}
                          </span>
                        )
                      })}
                    </div>
                    <Link to={`/teams/new?template_id=${t.id}`} className="pa-unlock-use">
                      Montar <ArrowRight size={11} style={{ display: 'inline' }} />
                    </Link>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function PullAdvisorPage() {
  const { lang } = useLanguage()
  const roster = useRoster()

  const [chars, setChars] = useState<CharacterSummary[]>([])
  const [goal, setGoal] = useState<PullGoal>('meta')
  const [rarityFilter, setRarityFilter] = useState<number | null>(5)
  const [elementFilter, setElementFilter] = useState<string>('all')
  const [targetSlug, setTargetSlug] = useState<string>('')
  const [result, setResult] = useState<PullAdvisorResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.listCharacters(lang, { limit: 200 })
      .then((res) => setChars(res.items))
      .catch((e) => setError(String(e)))
  }, [lang])

  const charsMap = useMemo(() => {
    const m = new Map<string, CharacterSummary>()
    chars.forEach((c) => m.set(c.slug, c))
    return m
  }, [chars])

  const ownedSlugs = useMemo(() => {
    return chars.filter((c) => roster.get(c.slug).owned).map((c) => c.slug)
  }, [chars, roster])

  const simulatorOptions = useMemo(() => {
    const playable = chars.filter((c) => !c.slug.startsWith('traveler-') && c.slug !== 'aloy')
    return [...playable].sort((a, b) => {
      const aOwned = roster.get(a.slug).owned ? 1 : 0
      const bOwned = roster.get(b.slug).owned ? 1 : 0
      if (aOwned !== bOwned) return aOwned - bOwned
      if (a.rarity !== b.rarity) return b.rarity - a.rarity
      return a.name.localeCompare(b.name)
    })
  }, [chars, roster])

  const loadRecommendations = async () => {
    if (chars.length === 0) return
    setLoading(true)
    try {
      const data = await api.recommendPulls(
        {
          owned_slugs: ownedSlugs,
          goal,
          rarity_filter: rarityFilter,
          element_filter: elementFilter === 'all' ? null : elementFilter,
          target_slug: targetSlug || null,
          limit: 24,
        },
        lang,
      )
      setResult(data)
      setError(null)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRecommendations()
  }, [chars.length, ownedSlugs.join(','), goal, rarityFilter, elementFilter, targetSlug, lang])

  const summary = result?.account_summary

  return (
    <div className="pull-advisor-page">
      <div className="pa-header">
        <div>
          <h1 className="pa-title">
            <Sparkles size={28} color="#7dd3fc" /> Pull Advisor
          </h1>
          <p className="pa-subtitle">
            Análise personalizada da sua conta combinando Consenso Geral (7 fontes), times desbloqueados (3/4 → 4/4), cobertura de Main DPS por elemento e Endgame 30d.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link to="/roster" className="btn-secondary">
            <Users size={14} /> Editar Roster ({ownedSlugs.length})
          </Link>
          <button className="btn-secondary" onClick={loadRecommendations} disabled={loading}>
            <RefreshCw size={14} /> Atualizar
          </button>
        </div>
      </div>

      {ownedSlugs.length === 0 && chars.length > 0 && (
        <div className="pa-stat-card" style={{ marginBottom: 18, borderColor: 'rgba(251, 191, 36, 0.4)' }}>
          <AlertTriangle size={16} color="#fbbf24" style={{ verticalAlign: 'middle', marginRight: 8 }} />
          Seu Roster está vazio. Marque os personagens que você possui em <Link to="/roster">Meu Roster</Link> (ou importe seu GOOD JSON) para recomendações sob medida — por enquanto exibindo o ranking geral.
        </div>
      )}

      {/* Diagnóstico da Conta */}
      {summary && (
        <div className="pa-account-strip">
          <div className="pa-stat-card">
            <div className="pa-stat-label">Sua Conta</div>
            <div className="pa-stat-value">
              {summary.owned_count} <span className="pa-stat-sub">personagens</span>
            </div>
            <div className="pa-stat-sub" style={{ marginTop: 4 }}>
              {summary.ready_teams_count} times prontos (4/4) · {summary.almost_ready_teams_count} quase prontos (3/4)
            </div>
          </div>

          <div className="pa-stat-card">
            <div className="pa-stat-label">
              <Swords size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              Main DPS Forte por Elemento
            </div>
            <div className="pa-elem-pills">
              {Object.entries(summary.element_counts).map(([el, cnt]) => {
                const missingDps = (summary.missing_dps_elements ?? []).includes(el)
                const isSelected = elementFilter === el
                return (
                  <button
                    key={el}
                    type="button"
                    className={`pa-elem-pill ${missingDps ? 'is-missing-dps' : ''}`}
                    style={{
                      ...elementStyle(el),
                      boxShadow: isSelected ? `0 0 0 2px ${ELEMENT_PALETTE[el]?.text ?? '#fff'}` : undefined,
                    }}
                    onClick={() => setElementFilter(isSelected ? 'all' : el)}
                    title={
                      missingDps
                        ? `Sem Main DPS forte de ${el} (${cnt} chars no total) — clique para filtrar`
                        : `Você já tem Main DPS forte de ${el} (${cnt} chars no total) — clique para filtrar`
                    }
                  >
                    {missingDps ? '!' : <Check size={11} />}
                    {el} ({cnt})
                  </button>
                )
              })}
            </div>
            {summary.missing_dps_elements && summary.missing_dps_elements.length > 0 && (
              <div className="pa-stat-sub" style={{ marginTop: 6, color: '#fde047' }}>
                Falta Main DPS forte em: <strong>{summary.missing_dps_elements.map((e) => e.charAt(0).toUpperCase() + e.slice(1)).join(', ')}</strong>
              </div>
            )}
          </div>

          <div className="pa-stat-card">
            <div className="pa-stat-label">Lacunas de Função</div>
            {summary.missing_capabilities.length === 0 ? (
              <div className="pa-stat-sub" style={{ color: '#4ade80', marginTop: 6 }}>
                Conta bem equilibrada em cura, escudo e redução de RES!
              </div>
            ) : (
              <div className="pa-gap-tags">
                {summary.missing_capabilities.map((g, i) => (
                  <span key={i} className="pa-gap-tag">{g}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Simulador de Banner: "Vale a pena pegar X?" */}
      <section className="pa-simulator">
        <div className="pa-sim-top">
          <h2 className="pa-sim-title">
            <Target size={18} color="#38bdf8" /> Simulador de Banner — "Vale a pena pegar X?"
          </h2>
          <div className="pa-sim-controls">
            <select
              className="pa-sim-select"
              value={targetSlug}
              onChange={(e) => setTargetSlug(e.target.value)}
            >
              <option value="">Escolha um personagem para simular...</option>
              {simulatorOptions.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name} ({c.rarity}★ {c.element}){roster.get(c.slug).owned ? ' — Já possui' : ''}
                </option>
              ))}
            </select>
            {targetSlug && (
              <button className="btn-secondary" onClick={() => setTargetSlug('')}>
                Limpar
              </button>
            )}
          </div>
        </div>
        {result?.target_evaluation ? (
          <CandidateCard
            candidate={result.target_evaluation}
            charsMap={charsMap}
            highlight
            defaultExpanded
          />
        ) : (
          <p className="pa-subtitle">
            Selecione qualquer personagem (ex.: banner atual) para ver o veredito exato e quais times ele fecha na sua conta.
          </p>
        )}
      </section>

      {/* Filtros e Objetivo */}
      <section className="pa-controls">
        <div className="pa-goal-row">
          <span className="filter-label" style={{ marginRight: 4 }}>
            <Compass size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Objetivo:
          </span>
          {GOALS.map((g) => (
            <button
              key={g.key}
              className={`filter-pill ${goal === g.key ? 'active' : ''}`}
              style={{ '--pill-color': g.key === 'endgame' ? '#fb923c' : '#38bdf8' } as React.CSSProperties}
              onClick={() => setGoal(g.key)}
              title={g.desc}
            >
              {lang === 'en' ? g.labelEn : g.label}
            </button>
          ))}
        </div>

        <div className="pa-subfilters">
          <div className="filter-pills">
            <span className="filter-label">Raridade:</span>
            {[
              { val: 5, label: '5★' },
              { val: 4, label: '4★' },
              { val: null, label: 'Todos' },
            ].map((r) => (
              <button
                key={String(r.val)}
                className={`filter-pill ${rarityFilter === r.val ? 'active' : ''}`}
                style={{ '--pill-color': '#fbbf24' } as React.CSSProperties}
                onClick={() => setRarityFilter(r.val)}
              >
                {r.label}
              </button>
            ))}
          </div>

          <div className="filter-pills">
            <span className="filter-label">
              <Flame size={12} style={{ verticalAlign: 'middle', marginRight: 2 }} /> Elemento:
            </span>
            {ELEMENTS.map((el) => (
              <button
                key={el}
                className={`filter-pill ${elementFilter === el ? 'active' : ''}`}
                style={{ '--pill-color': ELEMENT_PALETTE[el]?.text ?? '#a78bfa', textTransform: 'capitalize' } as React.CSSProperties}
                onClick={() => setElementFilter(el)}
              >
                {el === 'all' ? 'Todos' : el}
              </button>
            ))}
          </div>
        </div>
      </section>

      {error && <p className="status error">Erro: {error}</p>}
      {loading && !result && <p className="status">Calculando recomendações para a sua conta...</p>}

      {result && (
        <div className="pa-grid">
          {result.recommendations.map((cand, idx) => (
            <CandidateCard
              key={cand.slug}
              candidate={cand}
              rank={idx + 1}
              charsMap={charsMap}
            />
          ))}
        </div>
      )}
    </div>
  )
}
