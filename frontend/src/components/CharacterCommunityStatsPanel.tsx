import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart3, Crown, Gem, Sparkles, Swords, TrendingUp, Users } from 'lucide-react'
import { api } from '../api/client'
import { artifactIconUrl, iconUrl } from '../config'
import { useLanguage } from '../context/LanguageContext'
import type { ComputedCharStats } from '../utils/char-stats-calc'
import type {
  CharacterCommunityStatsResponse,
  CharacterDetail,
  CommunityCharStats,
} from '../types'

interface Props {
  slug: string
  /** Opcional: quando já temos os dados carregados (ex.: no Dashboard), evita nova chamada API */
  preloaded?: CommunityCharStats | null
  totalPlayers?: number
  /** Opcional: detalhes do personagem (para exibir ícones reais de constelações e talentos) */
  characterDetail?: CharacterDetail | null
  /** Opcional: stats reais calculados da build do usuário para comparar contra a mediana global */
  userStats?: ComputedCharStats | null
}

function fmtStat(key: string, val: number): string {
  if (key === 'crit_rate' || key === 'crit_dmg' || key === 'er' || key === 'elem_dmg') {
    return `${val.toFixed(1)}%`
  }
  return Math.round(val).toLocaleString('pt-BR')
}

function deltaBadge(userVal: number, medianVal: number, isPercent: boolean): {
  text: string
  cls: 'is-high' | 'is-mid' | 'is-low'
} {
  if (medianVal <= 0) return { text: '—', cls: 'is-mid' }
  if (isPercent) {
    const diff = userVal - medianVal
    if (Math.abs(diff) < 1.5) return { text: 'Na média', cls: 'is-mid' }
    return {
      text: `${diff > 0 ? '+' : ''}${diff.toFixed(1)} pp`,
      cls: diff > 0 ? 'is-high' : 'is-low',
    }
  }
  const pct = ((userVal - medianVal) / medianVal) * 100
  if (Math.abs(pct) < 3) return { text: 'Na média', cls: 'is-mid' }
  return {
    text: `${pct > 0 ? '+' : ''}${Math.round(pct)}%`,
    cls: pct > 0 ? 'is-high' : 'is-low',
  }
}

export default function CharacterCommunityStatsPanel({
  slug,
  preloaded,
  totalPlayers,
  characterDetail,
  userStats,
}: Props) {
  const { lang } = useLanguage()
  const [data, setData] = useState<CharacterCommunityStatsResponse | null>(null)
  const [loading, setLoading] = useState(!preloaded)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    if (preloaded) {
      setLoading(false)
      setMissing(false)
      return
    }
    let active = true
    setLoading(true)
    setMissing(false)
    api
      .getCharacterCommunityStats(slug, lang)
      .then((res) => {
        if (active) {
          setData(res)
          setLoading(false)
        }
      })
      .catch(() => {
        if (active) {
          setMissing(true)
          setLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [slug, lang, preloaded])

  const charStats: CommunityCharStats | null = preloaded ?? data?.character ?? null
  const sampleTotal = totalPlayers ?? data?.total_players ?? 40000

  if (loading) {
    return (
      <section className="cs-panel">
        <div className="cs-panel-loading">Carregando estatísticas da comunidade (40k contas)...</div>
      </section>
    )
  }

  if (missing || !charStats) return null

  const consIcons = [...(characterDetail?.constellations ?? [])]
    .sort((a, b) => a.level - b.level)
    .map((c) => c.icon)
  const talNaIcon = characterDetail?.talents?.find((t) => t.talent_type === 'normal_attack')?.icon
  const talEsIcon = characterDetail?.talents?.find((t) => t.talent_type === 'elemental_skill')?.icon
  const talEbIcon = characterDetail?.talents?.find((t) => t.talent_type === 'elemental_burst')?.icon

  const statRows: Array<{
    key: string
    label: string
    isPct: boolean
    userVal: number | null
  }> = [
    { key: 'hp', label: 'Vida Máx.', isPct: false, userVal: userStats?.hasBaseData ? userStats.totalHp : null },
    { key: 'atk', label: 'ATQ', isPct: false, userVal: userStats?.hasBaseData ? userStats.totalAtk : null },
    { key: 'def', label: 'DEF', isPct: false, userVal: userStats?.hasBaseData ? userStats.totalDef : null },
    { key: 'em', label: 'Proficiência (EM)', isPct: false, userVal: userStats?.hasArtifacts ? userStats.em : null },
    { key: 'crit_rate', label: 'Taxa Crítica', isPct: true, userVal: userStats?.hasArtifacts ? userStats.critRate : null },
    { key: 'crit_dmg', label: 'Dano Crítico', isPct: true, userVal: userStats?.hasArtifacts ? userStats.critDmg : null },
    { key: 'er', label: 'Recarga (ER)', isPct: true, userVal: userStats?.hasArtifacts ? userStats.er : null },
    {
      key: 'elem_dmg',
      label: 'Bônus de Dano Elem.',
      isPct: true,
      userVal: userStats?.hasArtifacts
        ? Math.max(userStats.elemDmgBonus, userStats.physicalDmgBonus, userStats.healingBonus)
        : null,
    },
  ].filter((r) => Boolean(charStats.stats[r.key]))

  const hasUserComparison = Boolean(userStats?.hasArtifacts)

  // Calcula um índice comparativo simples baseado em CR, CD e stat principal (HP/ATK/DEF/EM)
  let benchmarkBadge: { label: string; cls: string } | null = null
  if (hasUserComparison && userStats) {
    const medCr = charStats.stats.crit_rate?.median ?? 50
    const medCd = charStats.stats.crit_dmg?.median ?? 140
    const userCvEff = userStats.critRate * 2 + userStats.critDmg
    const medCvEff = medCr * 2 + medCd
    if (medCvEff > 80) {
      const ratio = userCvEff / medCvEff
      if (ratio >= 1.15) benchmarkBadge = { label: 'Build Acima da Elite Global', cls: 'is-elite' }
      else if (ratio >= 1.03) benchmarkBadge = { label: 'Acima da Mediana Global', cls: 'is-high' }
      else if (ratio >= 0.92) benchmarkBadge = { label: 'Na Mediana da Comunidade', cls: 'is-mid' }
      else benchmarkBadge = { label: 'Abaixo da Mediana Global', cls: 'is-low' }
    }
  }

  return (
    <section id="estatisticas-comunidade" className="char-section-anchor cs-panel">
      <div className="cs-panel-head">
        <div>
          <h2 className="cs-panel-title">
            <BarChart3 size={18} /> Estatísticas Reais da Comunidade
          </h2>
          <p className="cs-panel-sub">
            Baseado em <strong>{charStats.count.toLocaleString('pt-BR')}</strong> builds reais de{' '}
            {charStats.name} (amostra de {sampleTotal.toLocaleString('pt-BR')} contas · Paimon.plus)
          </p>
        </div>

        <div className="cs-head-badges">
          <span className="cs-pill">
            <Users size={12} /> {charStats.popularity_pct}% das vitrines
          </span>
          <span className="cs-pill">
            <Sparkles size={12} /> Const. média: C{charStats.avg_constellation.toFixed(1)}
          </span>
          {benchmarkBadge && (
            <span className={`cs-benchmark-badge ${benchmarkBadge.cls}`}>
              <TrendingUp size={12} /> {benchmarkBadge.label}
            </span>
          )}
          <Link to="/community-stats" className="rb-detail-btn">
            Ver Censo Completo
          </Link>
        </div>
      </div>

      {/* Picos de constelação detectados estatisticamente */}
      {charStats.stopping_points.length > 0 && (
        <div className="cs-spikes-row">
          <span className="cs-spikes-label">Sinal empírico de constelações:</span>
          {charStats.stopping_points.map((sp) => (
            <span key={sp.constellation} className="cs-spike-chip">
              <Sparkles size={11} /> {sp.label}
            </span>
          ))}
        </div>
      )}

      {/* Grid principal: 2 colunas */}
      <div className="cs-grid-2">
        {/* 1. Comparativo / Mediana de Atributos */}
        <div className="cs-card">
          <div className="cs-card-title">
            {hasUserComparison
              ? 'Sua Build vs. Mediana da Comunidade'
              : 'Atributos Típicos da Comunidade (Mediana & Média)'}
          </div>
          <div className="cs-stats-table">
            <div className={`cs-st-row cs-st-head ${hasUserComparison ? 'has-user' : ''}`}>
              <span>Atributo</span>
              {hasUserComparison && <span>Sua Build</span>}
              <span>Mediana</span>
              <span>{hasUserComparison ? 'vs. Comunidade' : 'Média'}</span>
            </div>
            {statRows.map((row) => {
              const pair = charStats.stats[row.key]
              const delta =
                hasUserComparison && row.userVal !== null
                  ? deltaBadge(row.userVal, pair.median, row.isPct)
                  : null
              return (
                <div key={row.key} className={`cs-st-row ${hasUserComparison ? 'has-user' : ''}`}>
                  <span className="cs-st-label">{row.label}</span>
                  {hasUserComparison && (
                    <strong className="cs-st-user">
                      {row.userVal !== null ? fmtStat(row.key, row.userVal) : '—'}
                    </strong>
                  )}
                  <strong className="cs-st-med">{fmtStat(row.key, pair.median)}</strong>
                  {hasUserComparison ? (
                    <span className={`cs-delta-chip ${delta?.cls ?? 'is-mid'}`}>
                      {delta?.text ?? '—'}
                    </span>
                  ) : (
                    <span className="cs-st-mean">{fmtStat(row.key, pair.mean)}</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* 2. Constelações C0-C6 + Talentos Típicos */}
        <div className="cs-card cs-stack">
          <div>
            <div className="cs-card-title">Distribuição de Constelações (C0–C6)</div>
            <div className="cs-cons-grid">
              {charStats.consts.map((c) => {
                const cIcon = c.level > 0 ? iconUrl(consIcons[c.level - 1]) : null
                const isPeak = charStats.stopping_points.some((s) => s.constellation === c.level)
                return (
                  <div key={c.level} className={`cs-cons-item ${isPeak ? 'is-peak' : ''}`}>
                    <div className="cs-cons-circle">
                      {cIcon ? (
                        <img src={cIcon} alt={`C${c.level}`} loading="lazy" />
                      ) : (
                        <span>C{c.level}</span>
                      )}
                      <span className="cs-cons-tag">C{c.level}</span>
                    </div>
                    <div className="cs-cons-bar-track">
                      <div
                        className="cs-cons-bar-fill"
                        style={{ height: `${Math.max(4, Math.min(100, c.pct))}%` }}
                      />
                    </div>
                    <strong className="cs-cons-pct">{c.pct.toFixed(c.pct < 1 ? 1 : 0)}%</strong>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="cs-talents-box">
            <div className="cs-card-title">Nível Típico de Talentos (Mediana · Moda)</div>
            <div className="cs-talents-row">
              {[
                { label: 'Ataque Normal', data: charStats.talents.na, icon: talNaIcon },
                { label: 'Habilidade (E)', data: charStats.talents.es, icon: talEsIcon },
                { label: 'Supremo (Q)', data: charStats.talents.eb, icon: talEbIcon },
              ].map((t) => {
                const crowned = t.data.mode >= 10 || t.data.median >= 10
                return (
                  <div key={t.label} className={`cs-talent-pill ${crowned ? 'is-crowned' : ''}`}>
                    <div className="cs-talent-icon">
                      {iconUrl(t.icon) ? (
                        <img src={iconUrl(t.icon)!} alt={t.label} loading="lazy" />
                      ) : (
                        <Crown size={16} />
                      )}
                    </div>
                    <div className="cs-talent-meta">
                      <span className="cs-talent-name">{t.label}</span>
                      <div className="cs-talent-vals">
                        <strong>Nv. {t.data.median}</strong>
                        <span className="muted">
                          (moda {t.data.mode} · média {t.data.mean.toFixed(1)})
                        </span>
                      </div>
                    </div>
                    {crowned && (
                      <span className="cs-crown-tag" title="Talento frequentemente coroado pela comunidade">
                        <Crown size={11} />
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* 3. Top 5 Armas Mais Usadas */}
        <div className="cs-card">
          <div className="cs-card-title">
            <Swords size={13} /> Top 5 Armas Mais Equipadas
          </div>
          <div className="cs-usage-list">
            {charStats.weapons.map((w, idx) => {
              const wImg = iconUrl(w.icon)
              const inner = (
                <>
                  <span className="cs-rank-num">#{idx + 1}</span>
                  <div className={`cs-item-icon rarity-${w.rarity}`}>
                    {wImg ? <img src={wImg} alt={w.name} loading="lazy" /> : <Swords size={16} />}
                  </div>
                  <div className="cs-usage-info">
                    <div className="cs-usage-top">
                      <span className="cs-usage-name">{w.name}</span>
                      <strong className="cs-usage-pct">{w.pct.toFixed(1)}%</strong>
                    </div>
                    <div className="cs-bar-bg">
                      <div className="cs-bar-fg" style={{ width: `${Math.min(100, w.pct)}%` }} />
                    </div>
                  </div>
                </>
              )
              return w.slug ? (
                <Link key={w.ambr_id} to={`/weapons/${w.slug}`} className="cs-usage-row is-link">
                  {inner}
                </Link>
              ) : (
                <div key={w.ambr_id} className="cs-usage-row">
                  {inner}
                </div>
              )
            })}
          </div>
        </div>

        {/* 4. Top 5 Sets de Artefatos Mais Usados */}
        <div className="cs-card">
          <div className="cs-card-title">
            <Gem size={13} /> Top 5 Combinações de Artefatos
          </div>
          <div className="cs-usage-list">
            {charStats.artifact_sets.map((combo, idx) => {
              const label = combo.sets.map((s) => `${s.pieces}pc ${s.name}`).join(' + ')
              const firstSlug = combo.sets[0]?.slug
              return (
                <div key={idx} className="cs-usage-row">
                  <span className="cs-rank-num">#{idx + 1}</span>
                  <div className="cs-art-icons">
                    {combo.sets.slice(0, 2).map((s) => {
                      const aImg = artifactIconUrl(s.icon)
                      return (
                        <div key={`${s.ambr_id}-${s.pieces}`} className="cs-art-thumb" title={`${s.pieces}pc ${s.name}`}>
                          {aImg ? <img src={aImg} alt={s.name} loading="lazy" /> : <Gem size={14} />}
                          <span className="cs-art-pc">{s.pieces}</span>
                        </div>
                      )
                    })}
                  </div>
                  <div className="cs-usage-info">
                    <div className="cs-usage-top">
                      {firstSlug && combo.sets.length === 1 ? (
                        <Link to={`/artifacts/${firstSlug}`} className="cs-usage-name is-link-text">
                          {label}
                        </Link>
                      ) : (
                        <span className="cs-usage-name">{label}</span>
                      )}
                      <strong className="cs-usage-pct">{combo.pct.toFixed(1)}%</strong>
                    </div>
                    <div className="cs-bar-bg">
                      <div
                        className="cs-bar-fg is-art"
                        style={{ width: `${Math.min(100, combo.pct)}%` }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
