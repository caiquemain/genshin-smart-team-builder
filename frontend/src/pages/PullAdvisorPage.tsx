import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Sparkles, Target, Compass, Flame, Users, ChevronDown, ChevronUp,
  ArrowRight, AlertTriangle, RefreshCw,
} from 'lucide-react'
import { api } from '../api/client'
import { useLanguage } from '../context/LanguageContext'
import { iconUrl } from '../config'
import { useRoster } from '../utils/roster'
import type {
  CharacterSummary,
  PullAdvisorResponse,
  PullCandidate,
  PullGoal,
} from '../types'

const ELEMENT_COLORS: Record<string, string> = {
  pyro: '#f97316',
  hydro: '#38bdf8',
  cryo: '#67e8f9',
  electro: '#c084fc',
  anemo: '#34d399',
  geo: '#fbbf24',
  dendro: '#84cc16',
}

const GOALS: { key: PullGoal; label: string; labelEn: string; desc: string }[] = [
  { key: 'meta', label: 'Meta Geral', labelEn: 'General Meta', desc: 'Equilíbrio entre Consenso Geral (7 fontes), times e lacunas' },
  { key: 'unlock_teams', label: 'Fechar Times', labelEn: 'Unlock Teams', desc: 'Prioriza personagens que fecham times 3/4 → 4/4 na sua conta' },
  { key: 'endgame', label: 'Endgame (30d)', labelEn: 'Endgame (30d)', desc: 'Foco no ciclo atual do Abismo Espiral + Stygian Onslaught' },
  { key: 'imaginarium', label: 'Teatro Imaginário', labelEn: 'Imaginarium Theater', desc: 'Prioriza elementos carentes e cobertura de funções da conta' },
]

const ELEMENTS = ['all', 'pyro', 'hydro', 'cryo', 'electro', 'anemo', 'geo', 'dendro']

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
  const accent = ELEMENT_COLORS[candidate.element] ?? '#38bdf8'
  const img = iconUrl(candidate.icon)

  return (
    <div
      className={`pa-card ${highlight ? 'is-highlight' : ''}`}
      style={{ borderLeftColor: accent }}
    >
      <div className="pa-card-head">
        {rank !== undefined && <div className="pa-rank">#{rank}</div>}
        <div className="pa-avatar" style={{ borderColor: accent }}>
          {img ? <img src={img} alt={candidate.name} loading="lazy" /> : <span>?</span>}
        </div>
        <div className="pa-char-info">
          <div className="pa-char-name-row">
            <Link to={`/characters/${candidate.slug}`} className="pa-char-name">
              {candidate.name}
            </Link>
            <span className="pa-rarity">{'★'.repeat(candidate.rarity)}</span>
            {candidate.already_owned && (
              <span className="pa-owned-pill">Você já tem</span>
            )}
          </div>
          <div className="pa-tier-pills">
            {candidate.general_tier && (
              <span className="pa-tier-pill" title={`Consenso em ${candidate.general_sites} fontes gerais`}>
                Geral <strong>{candidate.general_tier}</strong>
              </span>
            )}
            {candidate.abyss_tier && (
              <span className="pa-tier-pill" title="YS Helper — Abismo 30d">
                Abismo <strong>{candidate.abyss_tier}</strong>
              </span>
            )}
            {candidate.stygian_tier && (
              <span className="pa-tier-pill" title="Stygian Onslaught 30d (YS + Chefes)">
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
        <ul className="pa-reasons">
          {candidate.reasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
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
              {candidate.unlocked_teams.map((t) => (
                <div key={t.id} className="pa-unlock-row">
                  <div className="pa-unlock-info">
                    <div className="pa-unlock-name" title={t.name}>{t.name}</div>
                    <div className="pa-unlock-meta">
                      {t.archetype} · {t.sources_count > 1 ? `${t.sources_count} fontes` : (t.source ?? 'Curado')}
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
              ))}
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

  // Lista ordenada para o Simulador de Banner (não-possuídos primeiro, depois possuídos)
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
            Análise personalizada da sua conta combinando Consenso Geral (7 fontes), times desbloqueados (3/4 → 4/4), lacunas e Endgame 30d.
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
            <div className="pa-stat-label">Cobertura Elemental (Teatro)</div>
            <div className="pa-elem-pills">
              {Object.entries(summary.element_counts).map(([el, cnt]) => (
                <span
                  key={el}
                  className={`pa-elem-pill ${summary.weak_elements.includes(el) ? 'is-weak' : ''}`}
                  title={summary.weak_elements.includes(el) ? 'Elemento com poucos personagens na conta' : undefined}
                >
                  {el}: {cnt}
                </span>
              ))}
            </div>
          </div>

          <div className="pa-stat-card">
            <div className="pa-stat-label">Lacunas Detectadas</div>
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
                style={{ '--pill-color': ELEMENT_COLORS[el] ?? '#a78bfa', textTransform: 'capitalize' } as React.CSSProperties}
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
