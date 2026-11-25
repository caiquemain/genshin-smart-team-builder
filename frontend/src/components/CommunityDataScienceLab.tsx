import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  Brain,
  Flame,
  Gem,
  GitCompareArrows,
  Layers,
  Sparkles,
  Swords,
  Target,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { iconUrl } from '../config'
import type {
  CommunityAnalyticsResult,
  EnrichedCommunityChar,
} from '../utils/community-analytics'

export interface UserAccountBenchmarkItem {
  slug: string
  name: string
  icon: string | null
  rarity: number
  userCv: number
  medianCv: number
  ratio: number
  tier: 'elite' | 'high' | 'mid' | 'low'
}

interface Props {
  analytics: CommunityAnalyticsResult
  selectedSlug: string
  onSelectChar: (slug: string) => void
  totalPlayers: number
  userBenchmarks: UserAccountBenchmarkItem[]
}

type ScatterPreset = 'pca' | 'cv_er' | 'cv_em' | 'pop_c6'

const SCATTER_PRESETS: Array<{
  id: ScatterPreset
  label: string
  xLabel: string
  yLabel: string
  only5Star?: boolean
  getX: (c: EnrichedCommunityChar) => number
  getY: (c: EnrichedCommunityChar) => number
  fmtX: (v: number) => string
  fmtY: (v: number) => string
}> = [
  {
    id: 'pca',
    label: 'PCA 1 × PCA 2 (Arquétipos)',
    xLabel: 'PC1 (Eixo Principal de Stats)',
    yLabel: 'PC2 (Eixo Secundário)',
    getX: (c) => c.pca1,
    getY: (c) => c.pca2,
    fmtX: (v) => v.toFixed(1),
    fmtY: (v) => v.toFixed(1),
  },
  {
    id: 'cv_er',
    label: 'Crit Value × Recarga (ER)',
    xLabel: 'Crit Value Efetivo (2×CR + CD)',
    yLabel: 'Recarga de Energia Mediana (%)',
    getX: (c) => c.cvEff,
    getY: (c) => c.erMed,
    fmtX: (v) => `${Math.round(v)}`,
    fmtY: (v) => `${Math.round(v)}%`,
  },
  {
    id: 'cv_em',
    label: 'Crit Value × Proficiência (EM)',
    xLabel: 'Crit Value Efetivo (2×CR + CD)',
    yLabel: 'Proficiência Elemental Mediana (EM)',
    getX: (c) => c.cvEff,
    getY: (c) => c.emMed,
    fmtX: (v) => `${Math.round(v)}`,
    fmtY: (v) => `${Math.round(v)}`,
  },
  {
    id: 'pop_c6',
    label: 'Popularidade × Índice C6 (5★)',
    xLabel: 'Popularidade nas Vitrines (%)',
    yLabel: 'Jogadores com C6 (%)',
    only5Star: true,
    getX: (c) => c.popularityPct,
    getY: (c) => c.c6Pct,
    fmtX: (v) => `${v.toFixed(0)}%`,
    fmtY: (v) => `${v.toFixed(0)}%`,
  },
]

export default function CommunityDataScienceLab({
  analytics,
  selectedSlug,
  onSelectChar,
  totalPlayers,
  userBenchmarks,
}: Props) {
  const [presetId, setPresetId] = useState<ScatterPreset>('pca')
  const [activeCluster, setActiveCluster] = useState<number | null>(null)
  const [hoveredSlug, setHoveredSlug] = useState<string | null>(null)
  const [entropyMode, setEntropyMode] = useState<'locked' | 'flexible'>('locked')

  const preset = SCATTER_PRESETS.find((p) => p.id === presetId) ?? SCATTER_PRESETS[0]

  const scatterPoints = useMemo(() => {
    const base = preset.only5Star
      ? analytics.items.filter((it) => it.rarity === 5)
      : analytics.items
    const xs = base.map(preset.getX)
    const ys = base.map(preset.getY)
    const minX = Math.min(...xs, 0)
    const maxX = Math.max(...xs, 1)
    const minY = Math.min(...ys, 0)
    const maxY = Math.max(...ys, 1)
    const padX = (maxX - minX) * 0.08 || 1
    const padY = (maxY - minY) * 0.1 || 1
    const loX = minX - padX
    const hiX = maxX + padX
    const loY = minY - padY
    const hiY = maxY + padY

    const vbW = 720
    const vbH = 340
    const ml = 54
    const mr = 20
    const mt = 18
    const mb = 42
    const plotW = vbW - ml - mr
    const plotH = vbH - mt - mb

    const toSvgX = (v: number) => ml + ((v - loX) / (hiX - loX)) * plotW
    const toSvgY = (v: number) => mt + plotH - ((v - loY) / (hiY - loY)) * plotH

    const ticksX = [0, 0.25, 0.5, 0.75, 1].map((t) => {
      const val = loX + t * (hiX - loX)
      return { val, x: toSvgX(val) }
    })
    const ticksY = [0, 0.25, 0.5, 0.75, 1].map((t) => {
      const val = loY + t * (hiY - loY)
      return { val, y: toSvgY(val) }
    })

    const points = base.map((item) => {
      const vx = preset.getX(item)
      const vy = preset.getY(item)
      return {
        item,
        vx,
        vy,
        sx: toSvgX(vx),
        sy: toSvgY(vy),
      }
    })

    return { vbW, vbH, ml, mr, mt, mb, plotW, plotH, ticksX, ticksY, points }
  }, [analytics.items, preset])

  const hoveredPoint = hoveredSlug
    ? scatterPoints.points.find((p) => p.item.slug === hoveredSlug) ?? null
    : null

  const pcaTotalPct = Math.round((analytics.pcaVariance[0] + analytics.pcaVariance[1]) * 100)

  // Resumo da conta do usuário vs censo de 40k
  const accountSummary = useMemo(() => {
    if (userBenchmarks.length === 0) return null
    const sorted = [...userBenchmarks].sort((a, b) => b.ratio - a.ratio)
    const above = sorted.filter((b) => b.tier === 'elite' || b.tier === 'high').length
    const mid = sorted.filter((b) => b.tier === 'mid').length
    const below = sorted.filter((b) => b.tier === 'low').length
    const topStrong = sorted.slice(0, 3)
    const farmPriority = [...sorted].reverse().slice(0, 3)
    return { total: sorted.length, above, mid, below, topStrong, farmPriority }
  }, [userBenchmarks])

  const setList = entropyMode === 'locked' ? analytics.mostLockedSets : analytics.mostFlexibleSets
  const weapList = entropyMode === 'locked' ? analytics.mostLockedWeapons : analytics.mostFlexibleWeapons

  return (
    <section className="cs-ds-section">
      <div className="cs-ds-header">
        <div>
          <h2 className="cs-ds-title">
            <Brain size={20} /> Laboratório de Ciência de Dados
          </h2>
          <p className="muted">
            Clusterização K-Means, projeção PCA 2D, Entropia de Shannon, detecção de builds bimodais e correlações de Spearman sobre os {analytics.items.length} personagens ({totalPlayers.toLocaleString('pt-BR')} contas).
          </p>
        </div>
      </div>

      {/* 1. Sua Conta vs. Censo de 40k Jogadores */}
      {accountSummary ? (
        <div className="cs-card cs-account-bench-card">
          <div className="cs-ds-card-head">
            <div className="cs-card-title">
              <Target size={13} /> Sua Conta vs. Censo Global ({totalPlayers.toLocaleString('pt-BR')} contas)
            </div>
            <div className="cs-account-kpis">
              <span className="cs-pill">
                <strong>{accountSummary.total}</strong> builds comparadas
              </span>
              <span className="cs-benchmark-badge is-high">
                <TrendingUp size={12} /> {accountSummary.above} acima da mediana
              </span>
              <span className="cs-benchmark-badge is-mid">
                {accountSummary.mid} na média
              </span>
              <span className="cs-benchmark-badge is-low">
                <TrendingDown size={12} /> {accountSummary.below} abaixo da mediana
              </span>
            </div>
          </div>

          <div className="cs-grid-2">
            <div className="cs-bench-col">
              <div className="cs-bench-sub is-high">
                <TrendingUp size={13} /> Suas Builds Mais Fortes vs. Comunidade
              </div>
              <div className="cs-bench-list">
                {accountSummary.topStrong.map((b) => {
                  const pctDiff = Math.round((b.ratio - 1) * 100)
                  return (
                    <button
                      key={b.slug}
                      type="button"
                      className={`cs-bench-row ${selectedSlug === b.slug ? 'is-selected' : ''}`}
                      onClick={() => onSelectChar(b.slug)}
                    >
                      <div className={`cs-bench-avatar rarity-${b.rarity}`}>
                        {iconUrl(b.icon) ? <img src={iconUrl(b.icon)!} alt={b.name} loading="lazy" /> : null}
                      </div>
                      <div className="cs-bench-info">
                        <strong>{b.name}</strong>
                        <span>
                          CV {b.userCv.toFixed(0)} vs. mediana {b.medianCv.toFixed(0)}
                        </span>
                      </div>
                      <span className={`cs-delta-chip ${b.tier === 'low' ? 'is-low' : b.tier === 'mid' ? 'is-mid' : 'is-high'}`}>
                        {pctDiff >= 0 ? `+${pctDiff}%` : `${pctDiff}%`}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="cs-bench-col">
              <div className="cs-bench-sub is-low">
                <TrendingDown size={13} /> Prioridades de Farm (Mais Abaixo da Mediana)
              </div>
              <div className="cs-bench-list">
                {accountSummary.farmPriority.map((b) => {
                  const pctDiff = Math.round((b.ratio - 1) * 100)
                  return (
                    <button
                      key={b.slug}
                      type="button"
                      className={`cs-bench-row ${selectedSlug === b.slug ? 'is-selected' : ''}`}
                      onClick={() => onSelectChar(b.slug)}
                    >
                      <div className={`cs-bench-avatar rarity-${b.rarity}`}>
                        {iconUrl(b.icon) ? <img src={iconUrl(b.icon)!} alt={b.name} loading="lazy" /> : null}
                      </div>
                      <div className="cs-bench-info">
                        <strong>{b.name}</strong>
                        <span>
                          CV {b.userCv.toFixed(0)} vs. mediana {b.medianCv.toFixed(0)}
                        </span>
                      </div>
                      <span className={`cs-delta-chip ${b.tier === 'low' ? 'is-low' : b.tier === 'mid' ? 'is-mid' : 'is-high'}`}>
                        {pctDiff >= 0 ? `+${pctDiff}%` : `${pctDiff}%`}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="cs-card cs-account-cta">
          <div className="cs-account-cta-text">
            <Target size={16} />
            <span>
              Importe seu <strong>GOOD JSON</strong> ou <strong>UID Enka</strong> para ver em qual percentil global estão suas builds e quais personagens são prioridade de farm.
            </span>
          </div>
          <Link to="/roster" className="rb-detail-btn">
            Importar na Minha Conta →
          </Link>
        </div>
      )}

      {/* 2. Mapa 2D de Arquétipos (Scatter Plot Interativo + Clusters K-Means) */}
      <div className="cs-card">
        <div className="cs-ds-card-head">
          <div>
            <div className="cs-card-title">
              <Layers size={13} /> Mapa 2D de Arquétipos (K-Means + PCA)
            </div>
            <p className="cs-ds-sub">
              {presetId === 'pca'
                ? `Projeção PCA dos 8 atributos medianos (${pcaTotalPct}% da variância explicada). Clique em qualquer ponto para inspecionar no explorador.`
                : `Distribuição interativa dos personagens por ${preset.label}. Clique em qualquer ponto para abrir no explorador.`}
            </p>
          </div>
          <div className="cs-ds-preset-bar">
            {SCATTER_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`cs-mini-tab ${presetId === p.id ? 'is-active' : ''}`}
                onClick={() => setPresetId(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Filtros por Cluster */}
        <div className="cs-cluster-pills">
          <button
            type="button"
            className={`cs-cluster-pill ${activeCluster === null ? 'is-active' : ''}`}
            onClick={() => setActiveCluster(null)}
          >
            Todos ({analytics.items.length})
          </button>
          {analytics.clusters.map((cl) => (
            <button
              key={cl.id}
              type="button"
              className={`cs-cluster-pill ${activeCluster === cl.id ? 'is-active' : ''}`}
              onClick={() => setActiveCluster(activeCluster === cl.id ? null : cl.id)}
            >
              <span className="cs-cluster-dot" style={{ background: cl.color }} />
              <span>{cl.name}</span>
              <small>({cl.count})</small>
            </button>
          ))}
        </div>

        <div className="cs-scatter-stage" onMouseLeave={() => setHoveredSlug(null)}>
          <svg
            className="cs-scatter-svg"
            viewBox={`0 0 ${scatterPoints.vbW} ${scatterPoints.vbH}`}
            role="img"
            aria-label={`Gráfico de dispersão: ${preset.label}`}
          >
            {/* Grade horizontal e vertical */}
            {scatterPoints.ticksY.map((t, i) => (
              <g key={`gy-${i}`}>
                <line
                  x1={scatterPoints.ml}
                  y1={t.y}
                  x2={scatterPoints.vbW - scatterPoints.mr}
                  y2={t.y}
                  className="cs-scatter-grid"
                />
                <text x={scatterPoints.ml - 8} y={t.y + 3} textAnchor="end" className="cs-scatter-tick">
                  {preset.fmtY(t.val)}
                </text>
              </g>
            ))}
            {scatterPoints.ticksX.map((t, i) => (
              <g key={`gx-${i}`}>
                <line
                  x1={t.x}
                  y1={scatterPoints.mt}
                  x2={t.x}
                  y2={scatterPoints.mt + scatterPoints.plotH}
                  className="cs-scatter-grid"
                />
                <text
                  x={t.x}
                  y={scatterPoints.mt + scatterPoints.plotH + 16}
                  textAnchor="middle"
                  className="cs-scatter-tick"
                >
                  {preset.fmtX(t.val)}
                </text>
              </g>
            ))}

            {/* Títulos dos eixos */}
            <text
              x={scatterPoints.ml + scatterPoints.plotW / 2}
              y={scatterPoints.vbH - 6}
              textAnchor="middle"
              className="cs-scatter-axis-title"
            >
              {preset.xLabel}
            </text>
            <text
              x={14}
              y={scatterPoints.mt + scatterPoints.plotH / 2}
              textAnchor="middle"
              transform={`rotate(-90 14 ${scatterPoints.mt + scatterPoints.plotH / 2})`}
              className="cs-scatter-axis-title"
            >
              {preset.yLabel}
            </text>

            {/* Pontos */}
            {scatterPoints.points.map(({ item, sx, sy }) => {
              const isDimmed = activeCluster !== null && item.clusterId !== activeCluster
              const isSelected = item.slug === selectedSlug
              const isHovered = item.slug === hoveredSlug
              const baseR = Math.max(4, Math.min(8.5, 3.6 + Math.sqrt(item.popularityPct) * 0.9))
              const r = isHovered || isSelected ? baseR + 2.5 : baseR
              return (
                <g
                  key={item.slug}
                  className={`cs-scatter-pt ${isDimmed ? 'is-dimmed' : ''}`}
                  onMouseEnter={() => setHoveredSlug(item.slug)}
                  onClick={() => onSelectChar(item.slug)}
                >
                  {(isSelected || isHovered) && (
                    <circle
                      cx={sx}
                      cy={sy}
                      r={r + 5}
                      fill={item.clusterColor}
                      fillOpacity={0.22}
                    />
                  )}
                  <circle
                    cx={sx}
                    cy={sy}
                    r={r}
                    fill={item.clusterColor}
                    fillOpacity={isDimmed ? 0.14 : 0.85}
                    stroke={isSelected || isHovered ? '#ffffff' : '#090e1c'}
                    strokeWidth={isSelected || isHovered ? 2 : 1}
                  />
                </g>
              )
            })}
          </svg>

          {hoveredPoint && (
            <div
              className={`cs-scatter-tooltip ${hoveredPoint.sx > scatterPoints.vbW * 0.62 ? 'is-left' : 'is-right'} ${hoveredPoint.sy < scatterPoints.vbH * 0.35 ? 'is-below' : 'is-above'}`}
              style={{
                left: `${(hoveredPoint.sx / scatterPoints.vbW) * 100}%`,
                top: `${(hoveredPoint.sy / scatterPoints.vbH) * 100}%`,
              }}
            >
              <div className="cs-scatter-tt-head">
                <div className={`cs-scatter-tt-av rarity-${hoveredPoint.item.rarity}`}>
                  {iconUrl(hoveredPoint.item.icon) ? (
                    <img src={iconUrl(hoveredPoint.item.icon)!} alt={hoveredPoint.item.name} />
                  ) : null}
                </div>
                <div>
                  <strong>{hoveredPoint.item.name}</strong>
                  <span style={{ color: hoveredPoint.item.clusterColor }}>
                    {hoveredPoint.item.clusterName}
                  </span>
                </div>
              </div>
              <div className="cs-radar-tt-grid">
                <span>CV Efetivo</span>
                <strong className="is-user">{hoveredPoint.item.cvEff.toFixed(1)}</strong>
                <span>CR / CD</span>
                <strong>
                  {hoveredPoint.item.crMed.toFixed(1)}% / {hoveredPoint.item.cdMed.toFixed(1)}%
                </strong>
                <span>HP / EM / ER</span>
                <strong>
                  {Math.round(hoveredPoint.item.hpMed / 1000)}k · {Math.round(hoveredPoint.item.emMed)} · {Math.round(hoveredPoint.item.erMed)}%
                </strong>
                <span>Popularidade · C6</span>
                <strong className="is-med">
                  {hoveredPoint.item.popularityPct.toFixed(1)}% · C6 {hoveredPoint.item.c6Pct.toFixed(1)}%
                </strong>
              </div>
            </div>
          )}
        </div>

        {/* Mini-cards dos Clusters K-Means */}
        <div className="cs-cluster-cards">
          {analytics.clusters.map((cl) => (
            <div
              key={cl.id}
              className={`cs-cluster-card ${activeCluster === cl.id ? 'is-active' : ''}`}
              onClick={() => setActiveCluster(activeCluster === cl.id ? null : cl.id)}
            >
              <div className="cs-cluster-card-top">
                <span className="cs-cluster-dot" style={{ background: cl.color }} />
                <strong>{cl.name}</strong>
                <span className="cs-cluster-count">{cl.count}</span>
              </div>
              <div className="cs-cluster-stats">
                <span>HP {Math.round(cl.medianHp / 1000)}k</span>
                <span>CR/CD {Math.round(cl.medianCr)}/{Math.round(cl.medianCd)}%</span>
                <span>EM {Math.round(cl.medianEm)}</span>
                <span>ER {Math.round(cl.medianEr)}%</span>
              </div>
              <div className="cs-cluster-avatars">
                {cl.examples.map((ex) => (
                  <button
                    key={ex.slug}
                    type="button"
                    className="cs-cluster-mini-av"
                    title={ex.name}
                    onClick={(e) => {
                      e.stopPropagation()
                      onSelectChar(ex.slug)
                    }}
                  >
                    {iconUrl(ex.icon) ? <img src={iconUrl(ex.icon)!} alt={ex.name} loading="lazy" /> : ex.name[0]}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Entropia de Shannon: Dependência de Set & Arma */}
      <div className="cs-card">
        <div className="cs-ds-card-head">
          <div>
            <div className="cs-card-title">
              <Sparkles size={13} /> Concentração vs. Flexibilidade de Build (Entropia de Shannon)
            </div>
            <p className="cs-ds-sub">
              Entropia próxima de <strong>0.00</strong> indica personagens "presos" a um único set ou arma; próxima de <strong>1.00</strong> indica alta flexibilidade.
            </p>
          </div>
          <div className="cs-ds-preset-bar">
            <button
              type="button"
              className={`cs-mini-tab ${entropyMode === 'locked' ? 'is-active' : ''}`}
              onClick={() => setEntropyMode('locked')}
            >
              Mais Presos (Menor H)
            </button>
            <button
              type="button"
              className={`cs-mini-tab ${entropyMode === 'flexible' ? 'is-active' : ''}`}
              onClick={() => setEntropyMode('flexible')}
            >
              Mais Flexíveis (Maior H)
            </button>
          </div>
        </div>

        <div className="cs-grid-2">
          <div className="cs-entropy-col">
            <div className="cs-bench-sub">
              <Gem size={13} /> Sets de Artefatos ({entropyMode === 'locked' ? 'Maior Dominância' : 'Maior Diversidade'})
            </div>
            <div className="cs-entropy-list">
              {setList.map((it) => (
                <button
                  key={it.slug}
                  type="button"
                  className={`cs-entropy-row ${selectedSlug === it.slug ? 'is-selected' : ''}`}
                  onClick={() => onSelectChar(it.slug)}
                >
                  <div className={`cs-bench-avatar rarity-${it.rarity}`}>
                    {iconUrl(it.icon) ? <img src={iconUrl(it.icon)!} alt={it.name} loading="lazy" /> : null}
                  </div>
                  <div className="cs-entropy-info">
                    <div className="cs-usage-top">
                      <strong>{it.name}</strong>
                      <span className="cs-entropy-badge">H = {it.setEntropy.toFixed(2)}</span>
                    </div>
                    <div className="cs-entropy-sub">
                      <span>{it.top1SetName}</span>
                      <strong>{it.top1SetPct.toFixed(1)}%</strong>
                    </div>
                    <div className="cs-bar-bg">
                      <div
                        className="cs-bar-fg is-art"
                        style={{ width: `${Math.min(100, it.top1SetPct)}%` }}
                      />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="cs-entropy-col">
            <div className="cs-bench-sub">
              <Swords size={13} /> Armas ({entropyMode === 'locked' ? 'Maior Dominância' : 'Maior Diversidade'})
            </div>
            <div className="cs-entropy-list">
              {weapList.map((it) => (
                <button
                  key={it.slug}
                  type="button"
                  className={`cs-entropy-row ${selectedSlug === it.slug ? 'is-selected' : ''}`}
                  onClick={() => onSelectChar(it.slug)}
                >
                  <div className={`cs-bench-avatar rarity-${it.rarity}`}>
                    {iconUrl(it.icon) ? <img src={iconUrl(it.icon)!} alt={it.name} loading="lazy" /> : null}
                  </div>
                  <div className="cs-entropy-info">
                    <div className="cs-usage-top">
                      <strong>{it.name}</strong>
                      <span className="cs-entropy-badge">H = {it.weaponEntropy.toFixed(2)}</span>
                    </div>
                    <div className="cs-entropy-sub">
                      <span>{it.top1WeaponName}</span>
                      <strong>{it.top1WeaponPct.toFixed(1)}%</strong>
                    </div>
                    <div className="cs-bar-bg">
                      <div
                        className="cs-bar-fg"
                        style={{ width: `${Math.min(100, it.top1WeaponPct)}%` }}
                      />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Builds Bimodais / Polarizadas + Correlações de Spearman */}
      <div className="cs-grid-2">
        <div className="cs-card">
          <div className="cs-card-title">
            <GitCompareArrows size={13} /> Builds Bimodais / Polarizadas (Média vs. Mediana)
          </div>
          <p className="cs-ds-sub">
            Maior desvio entre a mediana e a média indica personagens que a comunidade divide em <strong>2 estilos de build</strong> (ex.: Full EM vs. Crítico ou Healer vs. DPS).
          </p>
          <div className="cs-pol-list">
            {analytics.mostPolarized.map((it) => (
              <button
                key={it.slug}
                type="button"
                className={`cs-pol-row ${selectedSlug === it.slug ? 'is-selected' : ''}`}
                onClick={() => onSelectChar(it.slug)}
              >
                <div className={`cs-bench-avatar rarity-${it.rarity}`}>
                  {iconUrl(it.icon) ? <img src={iconUrl(it.icon)!} alt={it.name} loading="lazy" /> : null}
                </div>
                <div className="cs-pol-info">
                  <strong>{it.name}</strong>
                  <div className="cs-pol-deltas">
                    <span>
                      EM: <b>{Math.round(it.emMed)}</b> → <b>{Math.round(it.emMean)}</b>
                    </span>
                    <span>
                      CD: <b>{it.cdMed.toFixed(0)}%</b> → <b>{it.cdMean.toFixed(0)}%</b>
                    </span>
                  </div>
                </div>
                <span className="cs-pol-score" title="Índice composto de polarização">
                  <Flame size={11} /> {it.polarizationScore.toFixed(2)}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="cs-card">
          <div className="cs-card-title">
            <Activity size={13} /> Correlações Estatísticas da Comunidade (Spearman ρ)
          </div>
          <p className="cs-ds-sub">
            Testes de correlação de postos entre investimento, popularidade, constelações e poder crítico das builds.
          </p>
          <div className="cs-corr-list">
            {analytics.correlations.map((c) => {
              const cls = !c.significant ? 'is-mid' : c.rho >= 0 ? 'is-high' : 'is-low'
              return (
                <div key={c.id} className="cs-corr-card">
                  <div className="cs-corr-top">
                    <strong>
                      {c.labelA} × {c.labelB}
                    </strong>
                    <span className={`cs-delta-chip ${cls}`}>
                      ρ = {c.rho >= 0 ? `+${c.rho.toFixed(3)}` : c.rho.toFixed(3)}
                    </span>
                  </div>
                  <div className="cs-corr-meta">
                    <span>
                      Correlação <strong>{c.strength} {c.direction}</strong>{' '}
                      ({c.significant ? 'estatisticamente significativa' : 'não significativa'})
                    </span>
                    <small>p = {c.pValue < 0.001 ? c.pValue.toExponential(1) : c.pValue.toFixed(3)}</small>
                  </div>
                  <p className="cs-corr-desc">{c.explanation}</p>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
