import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Sparkles, Target, Compass, Flame, Users, ChevronDown, ChevronUp,
  ArrowRight, AlertTriangle, RefreshCw, Swords, Check, ArrowUpCircle,
  TrendingUp, Layers, Gem, Repeat,
} from 'lucide-react'
import { api } from '../api/client'
import { useLanguage } from '../context/LanguageContext'
import { artifactIconUrl, iconUrl } from '../config'
import { archetypeInfo } from '../utils/archetypes'
import { buildArtifactSetLookup, computeArtifactCritValue } from '../utils/char-stats-calc'
import { loadPlanFromStorage, PLANNER_UPDATED_EVENT } from '../utils/planner-storage'
import { normKey } from '../utils/slug-resolver'
import { useRoster } from '../utils/roster'
import type {
  ArtifactAdvisorResponse,
  ArtifactDomainRecommendation,
  ArtifactFocus,
  ArtifactSetSummary,
  CharacterSummary,
  EquippedArtifactSummaryIn,
  OwnedCharProgress,
  PullAdvisorResponse,
  PullCandidate,
  PullGoal,
  UpgradeAdvisorResponse,
  UpgradeCandidate,
  UpgradeGoal,
  UpgradeStageFilter,
} from '../types'

type AdvisorTab = 'pulls' | 'upgrades' | 'artifacts'

const ARTIFACT_FOCUSES: { key: ArtifactFocus; label: string; desc: string }[] = [
  { key: 'all', label: 'Toda a Conta', desc: 'Analisa todos os seus personagens possuídos (com peso extra para quem está no Planejador)' },
  { key: 'planner', label: 'No Planejador', desc: 'Foca somente nos personagens ativos no seu Planejador de Farm' },
  { key: 'top_meta', label: 'Top Meta (S+/S/A)', desc: 'Considera apenas os personagens da sua conta que estão no topo do meta' },
]

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
        <Link
          to={`/planner/characters?add=${encodeURIComponent(candidate.slug)}&goal=${candidate.recommended_level}`}
          className="pa-card-link"
        >
          Planejar Farm <ArrowRight size={12} />
        </Link>
      </div>
    </div>
  )
}

function ArtifactDomainCard({
  domain,
  rank,
}: {
  domain: ArtifactDomainRecommendation
  rank: number
}) {
  const accentColor =
    domain.strategy === 'farm_domain'
      ? '#4ade80'
      : domain.strategy === 'strongbox'
        ? '#fbbf24'
        : '#94a3b8'

  const effBarColor =
    domain.efficiency_pct >= 75
      ? '#4ade80'
      : domain.efficiency_pct >= 50
        ? '#fbbf24'
        : '#94a3b8'

  return (
    <div className="pa-card pa-domain-card" style={{ borderLeftColor: accentColor }}>
      <div className="pa-card-head">
        <div className="pa-rank">#{rank}</div>
        <div className="pa-domain-head-info">
          <div className="pa-char-name-row">
            <span className="pa-domain-name">{domain.domain_name}</span>
            <span className="pa-region-pill">{domain.region}</span>
          </div>
          <div className="pa-domain-meta">
            <span>{domain.usable_sets_count}/{domain.sets.length} set(s) úteis</span>
            <span>·</span>
            <span>{domain.unique_characters_count} personagem(ns)</span>
            {domain.bis_characters_count > 0 && (
              <>
                <span>·</span>
                <strong>{domain.bis_characters_count} BiS</strong>
              </>
            )}
          </div>
        </div>
        <div className="pa-score-box">
          <div className="pa-score-num">{Math.round(domain.score)}</div>
          <span className={`pa-verdict-badge pa-strategy-${domain.strategy}`}>
            {domain.strategy_label}
          </span>
        </div>
      </div>

      {/* Barra de Eficiência de Resina */}
      <div className="pa-eff-row">
        <div className="pa-bar-top">
          <span>Eficiência de Resina no Domínio</span>
          <strong style={{ color: effBarColor }}>{domain.efficiency_pct}%</strong>
        </div>
        <div className="pa-bar-track">
          <div
            className="pa-bar-fill"
            style={{ width: `${domain.efficiency_pct}%`, background: effBarColor }}
          />
        </div>
      </div>

      {/* Sets do Domínio */}
      <div className="pa-domain-sets">
        {domain.sets.map((s) => {
          const artImg = artifactIconUrl(s.icon)
          const hasUsers = s.total_users > 0
          return (
            <div key={s.slug} className={`pa-domain-set-box ${hasUsers ? '' : 'is-unused'}`}>
              <div className="pa-domain-set-head">
                <div className="pa-domain-set-icon">
                  {artImg ? <img src={artImg} alt={s.name} loading="lazy" /> : <Gem size={16} />}
                </div>
                <div className="pa-domain-set-title-wrap">
                  <Link to={`/artifacts/${s.slug}`} className="pa-domain-set-name">
                    {s.name}
                  </Link>
                  <div className="pa-domain-set-sub">
                    <span>
                      {hasUsers
                        ? `${s.total_users} ${s.total_users === 1 ? 'personagem' : 'personagens'}${s.bis_count > 0 ? ` (${s.bis_count} BiS)` : ''}`
                        : 'Sem demanda na sua conta'}
                    </span>
                    <span className="pa-strongbox-tag">
                      {s.in_strongbox ? 'No Strongbox' : 'Só Domínio'}
                    </span>
                  </div>
                </div>
              </div>

              {hasUsers && (
                <div className="pa-set-users">
                  {s.users.slice(0, 10).map((u) => {
                    const uImg = iconUrl(u.icon)
                    const isBuilt = u.artifact_status === 'built'
                    return (
                      <Link
                        key={u.slug}
                        to={`/characters/${u.slug}`}
                        className={`pa-set-user-chip ${u.is_bis ? 'is-bis' : ''} ${isBuilt ? 'is-art-built' : ''}`}
                        title={`${u.name} — ${u.usage_label}${u.equipped_note ? ` · ${u.equipped_note}` : ''}${u.is_in_planner ? ' · No Planejador' : ''}`}
                      >
                        <span className="pa-set-user-avatar">
                          {uImg ? <img src={uImg} alt={u.name} loading="lazy" /> : null}
                        </span>
                        <span className="pa-set-user-name">{u.name}</span>
                        {u.equipped_note ? (
                          <span className={`pa-art-note ${isBuilt ? 'is-built' : ''}`}>
                            {u.equipped_note}
                          </span>
                        ) : (
                          u.is_bis && <span className="pa-bis-dot">BiS</span>
                        )}
                        {u.is_in_planner && <span className="pa-plan-dot" title="No Planejador" />}
                      </Link>
                    )
                  })}
                  {s.users.length > 10 && (
                    <span className="pa-set-user-more">+{s.users.length - 10}</span>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {domain.reasons.length > 0 && (
        <ul className="pa-reasons">
          {domain.reasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

function readActivePlannerSlugs(): string[] {
  const plan = loadPlanFromStorage()
  if (!plan?.chars) return []
  return plan.chars
    .filter((c) => !c.is_inactive && c.slug)
    .map((c) => c.slug)
}

export default function PullAdvisorPage() {
  const { lang } = useLanguage()
  const roster = useRoster()

  const [activeTab, setActiveTab] = useState<AdvisorTab>('pulls')
  const [chars, setChars] = useState<CharacterSummary[]>([])
  const [plannerSlugs, setPlannerSlugs] = useState<string[]>(() => readActivePlannerSlugs())

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

  // Estado — Aba 3: Artefatos & Domínios
  const [artifactFocus, setArtifactFocus] = useState<ArtifactFocus>('all')
  const [artifactSetsCatalog, setArtifactSetsCatalog] = useState<ArtifactSetSummary[]>([])
  const [artifactResult, setArtifactResult] = useState<ArtifactAdvisorResponse | null>(null)
  const [artifactLoading, setArtifactLoading] = useState(false)

  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const syncPlanner = () => setPlannerSlugs(readActivePlannerSlugs())
    window.addEventListener(PLANNER_UPDATED_EVENT, syncPlanner)
    return () => window.removeEventListener(PLANNER_UPDATED_EVENT, syncPlanner)
  }, [])

  useEffect(() => {
    api.listCharacters(lang, { limit: 200 })
      .then((res) => setChars(res.items))
      .catch((e) => setError(String(e)))
    api.listArtifacts(lang)
      .then((res) => setArtifactSetsCatalog(res.items))
      .catch(() => {})
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

  const artifactSetLookup = useMemo(
    () => buildArtifactSetLookup(artifactSetsCatalog),
    [artifactSetsCatalog],
  )

  const equippedArtifactsPayload = useMemo<EquippedArtifactSummaryIn[]>(() => {
    if (!roster.hasArtifactData) return []
    const out: EquippedArtifactSummaryIn[] = []
    for (const slug of ownedSlugs) {
      const g = roster.getGoodState(slug)
      if (!g) continue
      const arts = g.artifacts ?? []
      const counts = new Map<string, number>()
      let lvSum = 0
      let fiveStars = 0
      let cv = 0
      for (const a of arts) {
        const meta = artifactSetLookup.get(normKey(a.setKey))
        const resolvedSlug = meta?.slug ?? a.setKey
        counts.set(resolvedSlug, (counts.get(resolvedSlug) ?? 0) + 1)
        lvSum += a.level ?? 0
        if ((a.rarity ?? 0) >= 5) fiveStars += 1
        cv += computeArtifactCritValue(a)
      }
      let active4pc: string | null = null
      const active2pc: string[] = []
      counts.forEach((cnt, sSlug) => {
        if (cnt >= 4) active4pc = sSlug
        if (cnt >= 2) active2pc.push(sSlug)
      })
      out.push({
        slug,
        active_4pc_slug: active4pc,
        active_2pc_slugs: active2pc,
        pieces_count: arts.length,
        avg_level: arts.length > 0 ? Math.round((lvSum / arts.length) * 10) / 10 : 0,
        five_star_count: fiveStars,
        crit_value: Math.round(cv * 10) / 10,
      })
    }
    return out
  }, [ownedSlugs, roster, artifactSetLookup])

  const equippedArtifactsKey = useMemo(
    () =>
      equippedArtifactsPayload
        .map((e) => `${e.slug}:${e.active_4pc_slug ?? ''}:${e.pieces_count}:${e.crit_value}`)
        .join('|'),
    [equippedArtifactsPayload],
  )

  const loadArtifactRecommendations = async () => {
    if (chars.length === 0) return
    setArtifactLoading(true)
    try {
      const data = await api.recommendArtifacts(
        {
          owned_slugs: ownedSlugs,
          planner_slugs: plannerSlugs,
          equipped_artifacts: equippedArtifactsPayload,
          focus: artifactFocus,
          limit: 20,
        },
        lang,
      )
      setArtifactResult(data)
      setError(null)
    } catch (e) {
      setError(String(e))
    } finally {
      setArtifactLoading(false)
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

  useEffect(() => {
    if (activeTab === 'artifacts' || artifactResult !== null) {
      loadArtifactRecommendations()
    }
  }, [activeTab, chars.length, ownedSlugs.join(','), plannerSlugs.join(','), equippedArtifactsKey, artifactFocus, lang])

  const summary = result?.account_summary
  const upgradeSummary = upgradeResult?.summary
  const artifactSummary = artifactResult?.summary

  const handleRefresh = () => {
    if (activeTab === 'pulls') loadPullRecommendations()
    else if (activeTab === 'upgrades') loadUpgradeRecommendations()
    else loadArtifactRecommendations()
  }

  const isRefreshing =
    activeTab === 'pulls'
      ? loading
      : activeTab === 'upgrades'
        ? upgradeLoading
        : artifactLoading

  return (
    <div className="pull-advisor-page">
      <div className="pa-header">
        <div>
          <h1 className="pa-title">
            <Sparkles size={28} color="#7dd3fc" /> Consultor da Conta
          </h1>
          <p className="pa-subtitle">
            {activeTab === 'pulls'
              ? 'Análise personalizada da sua conta combinando Consenso Geral (7 fontes), times desbloqueados (3/4 → 4/4), cobertura de Main DPS por elemento e Endgame 30d.'
              : activeTab === 'upgrades'
                ? 'Descubra em quais personagens da sua conta vale focar resina agora para subir até Lv.90 (ou 80/90) e quais talentos priorizar.'
                : 'Veja em qual Domínio de Artefatos sua resina rende mais (onde ambos os sets servem à sua conta) e quais sets antigos buscar no Strongbox.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link to="/roster" className="btn-secondary">
            <Users size={14} /> Editar Roster ({ownedSlugs.length})
          </Link>
          <button
            className="btn-secondary"
            onClick={handleRefresh}
            disabled={isRefreshing}
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
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'artifacts'}
          className={`pa-tab ${activeTab === 'artifacts' ? 'active' : ''}`}
          onClick={() => setActiveTab('artifacts')}
        >
          <Gem size={15} />
          Artefatos & Domínios
          {artifactSummary && artifactSummary.domains_matched > 0 && (
            <span className="pa-tab-count">{artifactSummary.domains_matched}</span>
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

      {/* ===================== ABA 3: ARTEFATOS & DOMÍNIOS ===================== */}
      {activeTab === 'artifacts' && (
        <>
          {artifactSummary && (
            <div className="pa-account-strip">
              <div className="pa-stat-card">
                <div className="pa-stat-label">Melhor Domínio p/ Farmar</div>
                <div className="pa-stat-value pa-stat-value-sm" style={{ color: '#86efac' }}>
                  {artifactSummary.best_domain_name ?? '—'}
                </div>
                <div className="pa-stat-sub" style={{ marginTop: 4 }}>
                  {artifactSummary.domains_matched} domínio(s) relevantes para a sua conta
                </div>
              </div>

              <div className="pa-stat-card">
                <div className="pa-stat-label">Melhor Alvo no Strongbox</div>
                <div className="pa-stat-value pa-stat-value-sm" style={{ color: '#fde68a' }}>
                  {artifactSummary.best_strongbox_name ?? '—'}
                </div>
                <div className="pa-stat-sub" style={{ marginTop: 4 }}>
                  Recicle peças ruins de domínios duplos na Oferenda Mística
                </div>
              </div>

              <div className="pa-stat-card">
                <div className="pa-stat-label">Escopo Avaliado</div>
                <div className="pa-stat-value">
                  {artifactSummary.evaluated_characters}{' '}
                  <span className="pa-stat-sub">personagens</span>
                </div>
                <div className="pa-stat-sub" style={{ marginTop: 4 }}>
                  {(artifactSummary.audited_characters ?? 0) > 0
                    ? `${artifactSummary.audited_characters} auditados via GOOD (${artifactSummary.already_built_characters ?? 0} com set fechado)`
                    : plannerSlugs.length > 0
                      ? `${artifactSummary.planner_characters_matched} deles ativos no Planejador`
                      : 'Importe GOOD JSON para auditar seus artefatos equipados'}
                </div>
              </div>
            </div>
          )}

          <section className="pa-controls">
            <div className="pa-goal-row">
              <span className="filter-label" style={{ marginRight: 4 }}>
                <Compass size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Foco:
              </span>
              {ARTIFACT_FOCUSES.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  className={`filter-pill ${artifactFocus === f.key ? 'active' : ''}`}
                  style={{ '--pill-color': f.key === 'planner' ? '#4ade80' : '#38bdf8' } as React.CSSProperties}
                  onClick={() => setArtifactFocus(f.key)}
                  title={f.desc}
                >
                  {f.label}
                  {f.key === 'planner' && ` (${plannerSlugs.length})`}
                </button>
              ))}
            </div>
          </section>

          {artifactLoading && !artifactResult && (
            <p className="status">Calculando eficiência de resina por domínio...</p>
          )}

          {artifactResult && artifactResult.strongbox_targets.length > 0 && (
            <section className="pa-strongbox-panel">
              <div className="pa-strongbox-head">
                <h2 className="pa-sim-title">
                  <Repeat size={17} color="#fbbf24" /> Melhores Alvos no Strongbox (Oferenda Mística)
                </h2>
                <span className="pa-strongbox-hint">
                  Sets de domínios 1/2 que valem mais reciclar do que gastar resina direta
                </span>
              </div>
              <div className="pa-strongbox-grid">
                {artifactResult.strongbox_targets.slice(0, 6).map((sb, idx) => {
                  const artImg = artifactIconUrl(sb.icon)
                  return (
                    <div key={sb.slug} className="pa-sb-card">
                      <div className="pa-sb-top">
                        <div className="pa-domain-set-icon">
                          {artImg ? <img src={artImg} alt={sb.name} loading="lazy" /> : <Gem size={16} />}
                        </div>
                        <div className="pa-sb-title-wrap">
                          <Link to={`/artifacts/${sb.slug}`} className="pa-domain-set-name">
                            #{idx + 1} {sb.name}
                          </Link>
                          <div className="pa-sb-meta">
                            {sb.total_users} personagem(ns){sb.bis_count > 0 ? ` · ${sb.bis_count} BiS` : ''}
                          </div>
                        </div>
                      </div>
                      <p className="pa-sb-why">{sb.why}</p>
                      <div className="pa-sb-avatars">
                        {sb.users.slice(0, 7).map((u) => {
                          const uImg = iconUrl(u.icon)
                          return (
                            <Link
                              key={u.slug}
                              to={`/characters/${u.slug}`}
                              className={`pa-unlock-avatar ${u.is_bis ? 'is-target' : ''}`}
                              title={`${u.name} (${u.usage_label})`}
                            >
                              {uImg ? <img src={uImg} alt={u.name} loading="lazy" /> : null}
                            </Link>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {artifactResult && artifactResult.domains.length === 0 && (
            <div className="pa-stat-card" style={{ textAlign: 'center', padding: 28 }}>
              {artifactFocus === 'planner' && plannerSlugs.length === 0 ? (
                <>
                  Você ainda não tem personagens ativos no <Link to="/planner">Planejador</Link>. Adicione personagens por lá ou mude o foco para <strong>Toda a Conta</strong>.
                </>
              ) : (
                <>
                  Marque os personagens que você possui em <Link to="/roster">Meu Roster</Link> (ou importe por UID / GOOD JSON) para ver onde sua resina rende mais.
                </>
              )}
            </div>
          )}

          {artifactResult && artifactResult.domains.length > 0 && (
            <div className="pa-grid">
              {artifactResult.domains.map((dom, idx) => (
                <ArtifactDomainCard
                  key={dom.domain_id}
                  domain={dom}
                  rank={idx + 1}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

