import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Sparkles, Target, Compass, Flame, Users, ChevronDown, ChevronUp,
  ArrowRight, AlertTriangle, RefreshCw, Swords, Check, ArrowUpCircle,
  TrendingUp, Layers,
} from 'lucide-react'
import { api } from '../api/client'
import { useLanguage } from '../context/LanguageContext'
import { iconUrl } from '../config'
import { archetypeInfo } from '../utils/archetypes'
import { useRoster } from '../utils/roster'
import type {
  CharacterSummary,
  OwnedCharProgress,
  PullAdvisorResponse,
  PullCandidate,
  PullGoal,
  UpgradeAdvisorResponse,
  UpgradeCandidate,
  UpgradeGoal,
  UpgradeStageFilter,
} from '../types'

type AdvisorTab = 'pulls' | 'upgrades'

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

const PULL_GOALS: { key: PullGoal; label: string; labelEn: string; desc: string }[] = [
  { key: 'meta', label: 'Meta Geral', labelEn: 'General Meta', desc: 'Equilíbrio entre Consenso Geral (7 fontes), times e lacunas' },
  { key: 'unlock_teams', label: 'Fechar Times', labelEn: 'Unlock Teams', desc: 'Prioriza personagens que fecham times 3/4 → 4/4 na sua conta' },
  { key: 'endgame', label: 'Endgame (30d)', labelEn: 'Endgame (30d)', desc: 'Foco no ciclo atual do Abismo Espiral + Stygian Onslaught' },
  { key: 'imaginarium', label: 'Teatro Imaginário', labelEn: 'Imaginarium Theater', desc: 'Prioriza elementos carentes e cobertura de funções da conta' },
]

const UPGRADE_GOALS: { key: UpgradeGoal; label: string; labelEn: string; desc: string }[] = [
  { key: 'overall', label: 'Prioridade Geral', labelEn: 'Overall Priority', desc: 'Equilíbrio entre Consenso Geral, uso em times prontos e ganho real de nível/talentos' },
  { key: 'teams', label: 'Meus Times Prontos', labelEn: 'Ready Teams', desc: 'Foca nos personagens mais presentes nos seus times 4/4' },
  { key: 'quick_wins', label: 'Ganhos Rápidos', labelEn: 'Quick Wins', desc: 'Prioriza quem já está perto da meta (Lv.60–80 ou poucos talentos) com alto retorno por resina' },
  { key: 'endgame', label: 'Endgame (30d)', labelEn: 'Endgame (30d)', desc: 'Prioriza personagens fortes no ciclo atual do Abismo + Stygian' },
]

const UPGRADE_STAGES: { key: UpgradeStageFilter; label: string }[] = [
  { key: 'needs_work', label: 'Precisam Upar' },
  { key: 'needs_90', label: 'Subir p/ Lv.90' },
  { key: 'needs_talents', label: 'Subir Talentos' },
  { key: 'built', label: 'Já Prontos' },
  { key: 'all', label: 'Todos' },
]

const ELEMENTS = ['all', 'pyro', 'hydro', 'cryo', 'electro', 'anemo', 'geo', 'dendro']

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

function UpgradeCard({
  candidate,
  rank,
  charsMap,
}: {
  candidate: UpgradeCandidate
  rank: number
  charsMap: Map<string, CharacterSummary>
}) {
  const [expanded, setExpanded] = useState(false)
  const elPal = ELEMENT_PALETTE[candidate.element] ?? { text: '#38bdf8', bg: 'rgba(56,189,248,0.14)', border: 'rgba(56,189,248,0.4)' }
  const img = iconUrl(candidate.icon)
  const levelDone = candidate.current_level !== null && candidate.current_level >= candidate.recommended_level

  return (
    <div className="pa-card" style={{ borderLeftColor: elPal.text }}>
      <div className="pa-card-head">
        <div className="pa-rank">#{rank}</div>
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
            {candidate.cons !== null && (
              <span className="pa-cons-pill">C{candidate.cons}</span>
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

      {/* Plano de Nível & Talentos */}
      <div className="pa-upgrade-plan">
        <div className="pa-upgrade-level-row">
          <div className="pa-upgrade-level-main">
            <TrendingUp size={14} color={levelDone ? '#86efac' : '#7dd3fc'} />
            {candidate.current_level !== null ? (
              levelDone ? (
                <span className="is-done">Lv. {candidate.current_level} ✓ (Meta: {candidate.recommended_level_label})</span>
              ) : (
                <span>
                  Lv. {candidate.current_level} → <strong className="is-target-90">{candidate.recommended_level_label}</strong>
                </span>
              )
            ) : (
              <span>
                Meta de Nível: <strong className="is-target-90">{candidate.recommended_level_label}</strong>
              </span>
            )}
          </div>
          <span className="pa-upgrade-scaling-note">{candidate.level_scaling_tag}</span>
        </div>

        <div className="pa-talents-grid">
          {candidate.talents.map((t) => {
            const isOptional = t.recommended <= 1
            const isDone = !isOptional && t.current !== null && t.current >= t.recommended
            const cls = isOptional ? 'is-optional' : isDone ? 'is-done' : t.needs_upgrade ? 'needs-upgrade' : ''
            return (
              <div key={t.key} className={`pa-talent-box ${cls}`}>
                <span className="pa-talent-label">{t.label}</span>
                <span className="pa-talent-val">
                  {isOptional ? (
                    t.current !== null ? `Lv.${t.current} (opcional)` : 'Opcional'
                  ) : isDone ? (
                    `Lv.${t.current} ✓`
                  ) : t.current !== null ? (
                    `${t.current} → ${t.recommended}`
                  ) : (
                    `Meta Lv.${t.recommended}`
                  )}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* 4 sinais transparentes */}
      <div className="pa-bars">
        <div className="pa-bar-item">
          <div className="pa-bar-top">
            <span>Valor de Meta</span>
            <strong>{Math.round(candidate.breakdown.meta_value)}</strong>
          </div>
          <div className="pa-bar-track">
            <div className="pa-bar-fill" style={{ width: `${candidate.breakdown.meta_value}%`, background: '#38bdf8' }} />
          </div>
        </div>
        <div className="pa-bar-item">
          <div className="pa-bar-top">
            <span>Uso nos Times</span>
            <strong>{Math.round(candidate.breakdown.team_usage)}</strong>
          </div>
          <div className="pa-bar-track">
            <div className="pa-bar-fill" style={{ width: `${candidate.breakdown.team_usage}%`, background: '#4ade80' }} />
          </div>
        </div>
        <div className="pa-bar-item">
          <div className="pa-bar-top">
            <span>Retorno do Upgrade</span>
            <strong>{Math.round(candidate.breakdown.upgrade_gain)}</strong>
          </div>
          <div className="pa-bar-track">
            <div className="pa-bar-fill" style={{ width: `${candidate.breakdown.upgrade_gain}%`, background: '#c084fc' }} />
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

      {candidate.ready_teams.length > 0 && (
        <div>
          <button
            type="button"
            className="pa-unlocks-toggle"
            onClick={() => setExpanded((v) => !v)}
          >
            <span>Times prontos na sua conta ({candidate.ready_teams_count})</span>
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>

          {expanded && (
            <div className="pa-unlocks-list">
              {candidate.ready_teams.map((t) => {
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

      <div className="pa-card-actions">
        <Link to={`/characters/${candidate.slug}`} className="pa-card-link">
          Ver Build & Materiais <ArrowRight size={12} />
        </Link>
        <Link to="/planner" className="pa-card-link">
          Planejar Farm <ArrowRight size={12} />
        </Link>
      </div>
    </div>
  )
}

export default function PullAdvisorPage() {
  const { lang } = useLanguage()
  const roster = useRoster()

  const [activeTab, setActiveTab] = useState<AdvisorTab>('pulls')
  const [chars, setChars] = useState<CharacterSummary[]>([])

  // Estado — Aba 1: Quem Pegar (Pulls)
  const [goal, setGoal] = useState<PullGoal>('meta')
  const [rarityFilter, setRarityFilter] = useState<number | null>(5)
  const [elementFilter, setElementFilter] = useState<string>('all')
  const [targetSlug, setTargetSlug] = useState<string>('')
  const [result, setResult] = useState<PullAdvisorResponse | null>(null)
  const [loading, setLoading] = useState(true)

  // Estado — Aba 2: Quem Upar (Lv.90 & Talentos)
  const [upgradeGoal, setUpgradeGoal] = useState<UpgradeGoal>('overall')
  const [stageFilter, setStageFilter] = useState<UpgradeStageFilter>('needs_work')
  const [upgradeRarity, setUpgradeRarity] = useState<number | null>(null)
  const [upgradeElement, setUpgradeElement] = useState<string>('all')
  const [upgradeResult, setUpgradeResult] = useState<UpgradeAdvisorResponse | null>(null)
  const [upgradeLoading, setUpgradeLoading] = useState(false)

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

  const charactersProgress = useMemo<OwnedCharProgress[]>(() => {
    const out: OwnedCharProgress[] = []
    for (const slug of ownedSlugs) {
      const g = roster.getGoodState(slug)
      const r = roster.get(slug)
      if (g) {
        out.push({
          slug,
          level: g.level,
          cons: g.cons,
          na: g.talents.na,
          es: g.talents.es,
          eb: g.talents.eb,
        })
      } else {
        out.push({ slug, cons: r.cons })
      }
    }
    return out
  }, [ownedSlugs, roster])

  const progressKey = useMemo(
    () => charactersProgress.map((p) => `${p.slug}:${p.level ?? ''}:${p.na ?? ''}:${p.es ?? ''}:${p.eb ?? ''}`).join('|'),
    [charactersProgress],
  )

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

  const loadPullRecommendations = async () => {
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

  const loadUpgradeRecommendations = async () => {
    if (chars.length === 0) return
    setUpgradeLoading(true)
    try {
      const data = await api.recommendUpgrades(
        {
          owned_slugs: ownedSlugs,
          characters_progress: charactersProgress,
          goal: upgradeGoal,
          stage_filter: stageFilter,
          rarity_filter: upgradeRarity,
          element_filter: upgradeElement === 'all' ? null : upgradeElement,
          limit: 40,
        },
        lang,
      )
      setUpgradeResult(data)
      setError(null)
    } catch (e) {
      setError(String(e))
    } finally {
      setUpgradeLoading(false)
    }
  }

  useEffect(() => {
    loadPullRecommendations()
  }, [chars.length, ownedSlugs.join(','), goal, rarityFilter, elementFilter, targetSlug, lang])

  useEffect(() => {
    if (activeTab === 'upgrades' || upgradeResult !== null) {
      loadUpgradeRecommendations()
    }
  }, [activeTab, chars.length, progressKey, upgradeGoal, stageFilter, upgradeRarity, upgradeElement, lang])

  const summary = result?.account_summary
  const upgradeSummary = upgradeResult?.summary

  const handleRefresh = () => {
    if (activeTab === 'pulls') loadPullRecommendations()
    else loadUpgradeRecommendations()
  }

  return (
    <div className="pull-advisor-page">
      <div className="pa-header">
        <div>
          <h1 className="pa-title">
            <Sparkles size={28} color="#7dd3fc" /> Pull & Upgrade Advisor
          </h1>
          <p className="pa-subtitle">
            {activeTab === 'pulls'
              ? 'Análise personalizada da sua conta combinando Consenso Geral (7 fontes), times desbloqueados (3/4 → 4/4), cobertura de Main DPS por elemento e Endgame 30d.'
              : 'Descubra em quais personagens da sua conta vale focar resina agora para subir até Lv.90 (ou 80/90) e quais talentos priorizar.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link to="/roster" className="btn-secondary">
            <Users size={14} /> Editar Roster ({ownedSlugs.length})
          </Link>
          <button
            className="btn-secondary"
            onClick={handleRefresh}
            disabled={activeTab === 'pulls' ? loading : upgradeLoading}
          >
            <RefreshCw size={14} /> Atualizar
          </button>
        </div>
      </div>

      {/* Abas principais */}
      <div className="pa-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'pulls'}
          className={`pa-tab ${activeTab === 'pulls' ? 'active' : ''}`}
          onClick={() => setActiveTab('pulls')}
        >
          <Sparkles size={15} />
          Quem Pegar (Pulls)
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'upgrades'}
          className={`pa-tab ${activeTab === 'upgrades' ? 'active' : ''}`}
          onClick={() => setActiveTab('upgrades')}
        >
          <ArrowUpCircle size={15} />
          Quem Upar (Lv.90 & Talentos)
          {upgradeSummary && upgradeSummary.needs_upgrade_count > 0 && (
            <span className="pa-tab-count">{upgradeSummary.needs_upgrade_count}</span>
          )}
        </button>
      </div>

      {ownedSlugs.length === 0 && chars.length > 0 && (
        <div className="pa-stat-card" style={{ marginBottom: 18, borderColor: 'rgba(251, 191, 36, 0.4)' }}>
          <AlertTriangle size={16} color="#fbbf24" style={{ verticalAlign: 'middle', marginRight: 8 }} />
          Seu Roster está vazio. Marque os personagens que você possui em <Link to="/roster">Meu Roster</Link> (ou importe seu GOOD JSON no <Link to="/planner">Planejador</Link>) para recomendações sob medida.
        </div>
      )}

      {error && <p className="status error">Erro: {error}</p>}

      {/* ===================== ABA 1: QUEM PEGAR (PULLS) ===================== */}
      {activeTab === 'pulls' && (
        <>
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
              {PULL_GOALS.map((g) => (
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
        </>
      )}

      {/* ===================== ABA 2: QUEM UPAR (LV.90 & TALENTOS) ===================== */}
      {activeTab === 'upgrades' && (
        <>
          {ownedSlugs.length > 0 && !roster.hasGoodData && (
            <div className="pa-stat-card" style={{ marginBottom: 18, borderColor: 'rgba(56, 189, 248, 0.35)' }}>
              <AlertTriangle size={15} color="#7dd3fc" style={{ verticalAlign: 'middle', marginRight: 8 }} />
              Você ainda não importou seu <strong>GOOD JSON</strong> (nível e talentos reais dos personagens). Ainda assim estamos priorizando quem vale Lv.90 e quais talentos focar — importe o GOOD JSON no <Link to="/planner">Planejador</Link> para esconder quem já está pronto e ver o progresso exato (ex.: <code>6 → 9</code>).
            </div>
          )}

          {upgradeSummary && (
            <div className="pa-account-strip">
              <div className="pa-stat-card">
                <div className="pa-stat-label">Personagens na Conta</div>
                <div className="pa-stat-value">
                  {upgradeSummary.owned_count} <span className="pa-stat-sub">possuídos</span>
                </div>
                <div className="pa-stat-sub" style={{ marginTop: 4 }}>
                  {upgradeSummary.with_progress_count > 0
                    ? `${upgradeSummary.with_progress_count} com nível/talentos lidos do GOOD JSON`
                    : 'Sem dados de nível (usando lista do Roster)'}
                </div>
              </div>

              <div className="pa-stat-card">
                <div className="pa-stat-label">Pendentes de Upgrade</div>
                <div className="pa-stat-value">
                  {upgradeSummary.needs_upgrade_count} <span className="pa-stat-sub">para evoluir</span>
                </div>
                <div className="pa-stat-sub" style={{ marginTop: 4 }}>
                  {upgradeSummary.needs_90_count} pedem Lv.90 · {upgradeSummary.needs_talents_count} com talentos pendentes
                </div>
              </div>

              <div className="pa-stat-card">
                <div className="pa-stat-label">Já Prontos</div>
                <div className="pa-stat-value" style={{ color: '#86efac' }}>
                  {upgradeSummary.built_count} <span className="pa-stat-sub">buildados</span>
                </div>
                <div className="pa-stat-sub" style={{ marginTop: 4 }}>
                  Nível alvo atingido e talentos principais completos
                </div>
              </div>
            </div>
          )}

          <section className="pa-controls">
            <div className="pa-goal-row">
              <span className="filter-label" style={{ marginRight: 4 }}>
                <Compass size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Foco:
              </span>
              {UPGRADE_GOALS.map((g) => (
                <button
                  key={g.key}
                  className={`filter-pill ${upgradeGoal === g.key ? 'active' : ''}`}
                  style={{ '--pill-color': g.key === 'endgame' ? '#fb923c' : '#38bdf8' } as React.CSSProperties}
                  onClick={() => setUpgradeGoal(g.key)}
                  title={g.desc}
                >
                  {lang === 'en' ? g.labelEn : g.label}
                </button>
              ))}
            </div>

            <div className="pa-goal-row">
              <span className="filter-label" style={{ marginRight: 4 }}>
                <Layers size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Estágio:
              </span>
              {UPGRADE_STAGES.map((st) => (
                <button
                  key={st.key}
                  className={`filter-pill ${stageFilter === st.key ? 'active' : ''}`}
                  style={{ '--pill-color': st.key === 'built' ? '#4ade80' : '#a78bfa' } as React.CSSProperties}
                  onClick={() => setStageFilter(st.key)}
                >
                  {st.label}
                </button>
              ))}
            </div>

            <div className="pa-subfilters">
              <div className="filter-pills">
                <span className="filter-label">Raridade:</span>
                {[
                  { val: null, label: 'Todos' },
                  { val: 5, label: '5★' },
                  { val: 4, label: '4★' },
                ].map((r) => (
                  <button
                    key={String(r.val)}
                    className={`filter-pill ${upgradeRarity === r.val ? 'active' : ''}`}
                    style={{ '--pill-color': '#fbbf24' } as React.CSSProperties}
                    onClick={() => setUpgradeRarity(r.val)}
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
                    className={`filter-pill ${upgradeElement === el ? 'active' : ''}`}
                    style={{ '--pill-color': ELEMENT_PALETTE[el]?.text ?? '#a78bfa', textTransform: 'capitalize' } as React.CSSProperties}
                    onClick={() => setUpgradeElement(el)}
                  >
                    {el === 'all' ? 'Todos' : el}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {upgradeLoading && !upgradeResult && (
            <p className="status">Analisando níveis e talentos da sua conta...</p>
          )}

          {upgradeResult && upgradeResult.recommendations.length === 0 && (
            <div className="pa-stat-card" style={{ textAlign: 'center', padding: 28 }}>
              {ownedSlugs.length === 0
                ? 'Adicione seus personagens no Roster (ou importe seu GOOD JSON) para ver em quem focar agora.'
                : 'Nenhum personagem encontrado nesse filtro. Tente mudar o estágio para "Todos" ou limpar o elemento.'}
            </div>
          )}

          {upgradeResult && upgradeResult.recommendations.length > 0 && (
            <div className="pa-grid">
              {upgradeResult.recommendations.map((cand, idx) => (
                <UpgradeCard
                  key={cand.slug}
                  candidate={cand}
                  rank={idx + 1}
                  charsMap={charsMap}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
