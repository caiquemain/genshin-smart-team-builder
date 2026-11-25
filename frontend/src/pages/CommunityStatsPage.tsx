import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Award,
  BarChart3,
  Crown,
  Database,
  Flame,
  Gem,
  Network,
  Search,
  Sparkles,
  Swords,
  Trophy,
  Users,
} from 'lucide-react'
import { api } from '../api/client'
import { artifactIconUrl, iconUrl } from '../config'
import { useLanguage } from '../context/LanguageContext'
import CharacterCommunityStatsPanel from '../components/CharacterCommunityStatsPanel'
import CommunityDataScienceLab, {
  type UserAccountBenchmarkItem,
} from '../components/CommunityDataScienceLab'
import {
  analyzeCommunityDataset,
  findNearestNeighbors,
} from '../utils/community-analytics'
import {
  buildArtifactSetLookup,
  buildWeaponLookup,
  computeCharacterBuildStats,
  loadCharacterStatsDataset,
  type CharacterStatsDataset,
  type ComputedCharStats,
} from '../utils/char-stats-calc'
import { useRoster } from '../utils/roster'
import type {
  ArtifactSetSummary,
  CommunityStatsResponse,
  WeaponSummary,
} from '../types'

type RankingTab = 'popular' | 'c6' | 'cv' | 'weapons' | 'artifacts'

export default function CommunityStatsPage() {
  const { lang } = useLanguage()
  const roster = useRoster()
  const explorerRef = useRef<HTMLElement | null>(null)
  const [data, setData] = useState<CommunityStatsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rankTab, setRankTab] = useState<RankingTab>('popular')
  const [charSearch, setCharSearch] = useState('')
  const [selectedSlug, setSelectedSlug] = useState<string>('')
  const [statsDataset, setStatsDataset] = useState<CharacterStatsDataset | null>(null)
  const [weaponsList, setWeaponsList] = useState<WeaponSummary[]>([])
  const [artifactsList, setArtifactsList] = useState<ArtifactSetSummary[]>([])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    api
      .getCommunityStats(lang)
      .then((res) => {
        if (!active) return
        setData(res)
        setSelectedSlug((prev) => {
          if (prev && res.characters[prev]) return prev
          return res.rankings.top_popular[0]?.slug ?? Object.keys(res.characters)[0] ?? ''
        })
      })
      .catch((err) => {
        if (active) setError(String(err))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [lang])

  // Carrega lookups leves apenas se o usuário tiver builds GOOD/Enka importadas
  useEffect(() => {
    if (!roster.hasGoodData) return
    let active = true
    Promise.all([
      loadCharacterStatsDataset().catch(() => null),
      api.listWeapons(lang, { limit: 300 }).then((r) => r.items).catch(() => [] as WeaponSummary[]),
      api.listArtifacts(lang, { limit: 200 }).then((r) => r.items).catch(() => [] as ArtifactSetSummary[]),
    ]).then(([ds, weaps, arts]) => {
      if (!active) return
      if (ds) setStatsDataset(ds)
      setWeaponsList(weaps)
      setArtifactsList(arts)
    })
    return () => {
      active = false
    }
  }, [roster.hasGoodData, lang])

  const analytics = useMemo(() => {
    if (!data) return null
    return analyzeCommunityDataset(Object.values(data.characters), 6)
  }, [data])

  const { userStatsBySlug, userBenchmarks } = useMemo(() => {
    const map = new Map<string, ComputedCharStats>()
    const benches: UserAccountBenchmarkItem[] = []
    if (!data || !roster.hasGoodData || !statsDataset) {
      return { userStatsBySlug: map, userBenchmarks: benches }
    }
    const weaponLookup = buildWeaponLookup(weaponsList)
    const artifactSetLookup = buildArtifactSetLookup(artifactsList)

    for (const c of Object.values(data.characters)) {
      const goodState = roster.getGoodState(c.slug)
      if (!goodState || goodState.artifacts.length === 0) continue
      const computed = computeCharacterBuildStats({
        slug: c.slug,
        element: c.element,
        goodState,
        statsDataset,
        weaponLookup,
        artifactSetLookup,
      })
      map.set(c.slug, computed)
      if (computed.hasArtifacts) {
        const medCr = c.stats.crit_rate?.median ?? 0
        const medCd = c.stats.crit_dmg?.median ?? 0
        const medCv = medCr * 2 + medCd
        const userCv = computed.critRate * 2 + computed.critDmg
        if (medCv > 80) {
          const ratio = userCv / medCv
          const tier: UserAccountBenchmarkItem['tier'] =
            ratio >= 1.15 ? 'elite' : ratio >= 1.03 ? 'high' : ratio >= 0.92 ? 'mid' : 'low'
          benches.push({
            slug: c.slug,
            name: c.name,
            icon: c.icon,
            rarity: c.rarity,
            userCv,
            medianCv: medCv,
            ratio,
            tier,
          })
        }
      }
    }
    return { userStatsBySlug: map, userBenchmarks: benches }
  }, [data, roster, statsDataset, weaponsList, artifactsList])

  const handleSelectAndScroll = (slug: string) => {
    setSelectedSlug(slug)
    explorerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const sortedChars = useMemo(() => {
    if (!data) return []
    const q = charSearch.trim().toLowerCase()
    return Object.values(data.characters)
      .filter((c) => !q || c.name.toLowerCase().includes(q) || c.slug.includes(q))
      .sort((a, b) => b.count - a.count)
  }, [data, charSearch])

  const selectedChar = data && selectedSlug ? data.characters[selectedSlug] ?? null : null
  const selectedEnriched = analytics && selectedSlug ? analytics.bySlug.get(selectedSlug) ?? null : null
  const nearestNeighbors = useMemo(() => {
    if (!analytics || !selectedSlug) return []
    return findNearestNeighbors(selectedSlug, analytics.items, 6)
  }, [analytics, selectedSlug])

  const formattedDate = data?.updated_at
    ? new Date(data.updated_at).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : null

  return (
    <div className="cs-page">
      <div className="cs-page-header">
        <div>
          <h1 className="cs-page-title">
            <BarChart3 size={24} /> Estatísticas da Comunidade
          </h1>
          <p className="cs-page-sub">
            Análise estatística de <strong>{data?.census.total_players.toLocaleString('pt-BR') ?? '40.000'}</strong> contas reais (Paimon.plus)
            {formattedDate ? ` · Snapshot de ${formattedDate}` : ''} · {data?.total_characters ?? 0} personagens mapeados
          </p>
        </div>

        {formattedDate && (
          <div className="cs-snapshot-badge" title="Snapshot local atualizado periodicamente pelo servidor">
            <Database size={14} />
            <span>Snapshot · {formattedDate}</span>
          </div>
        )}
      </div>

      {error && <div className="error-box">{error}</div>}
      {loading && <div className="loading">Carregando censo comunitário...</div>}

      {data && !loading && (
        <>
          {/* 1. KPIs Globais do Censo */}
          <div className="cs-kpi-grid">
            <div className="cs-kpi-card">
              <div className="cs-kpi-icon"><Users size={18} /></div>
              <div>
                <span className="cs-kpi-label">Contas na Amostra</span>
                <strong className="cs-kpi-val">{data.census.total_players.toLocaleString('pt-BR')}</strong>
              </div>
            </div>
            <div className="cs-kpi-card">
              <div className="cs-kpi-icon is-purple"><Sparkles size={18} /></div>
              <div>
                <span className="cs-kpi-label">Jogadores no AR 60</span>
                <strong className="cs-kpi-val">{data.census.ar60_pct}%</strong>
              </div>
            </div>
            <div className="cs-kpi-card">
              <div className="cs-kpi-icon is-gold"><Trophy size={18} /></div>
              <div>
                <span className="cs-kpi-label">Abismo Andar 12</span>
                <strong className="cs-kpi-val">{data.census.abyss_floor12_pct}%</strong>
              </div>
            </div>
            <div className="cs-kpi-card">
              <div className="cs-kpi-icon is-cyan"><Crown size={18} /></div>
              <div>
                <span className="cs-kpi-label">Teatro Ato 10</span>
                <strong className="cs-kpi-val">{data.census.theater_act10_pct}%</strong>
              </div>
            </div>
            <div className="cs-kpi-card">
              <div className="cs-kpi-icon is-green"><Award size={18} /></div>
              <div>
                <span className="cs-kpi-label">Conquistas (Mediana)</span>
                <strong className="cs-kpi-val">
                  {data.census.achievements_median.toLocaleString('pt-BR')}
                  <small> / máx {data.census.achievements_top.toLocaleString('pt-BR')}</small>
                </strong>
              </div>
            </div>
            <div className="cs-kpi-card">
              <div className="cs-kpi-icon is-pink"><Users size={18} /></div>
              <div>
                <span className="cs-kpi-label">Amizade 10 (Mediana)</span>
                <strong className="cs-kpi-val">{data.census.friendship10_median} chars</strong>
              </div>
            </div>
          </div>

          {/* 2. 3 Gráficos de Distribuição do Censo */}
          <div className="cs-census-charts">
            {[
              { title: 'Distribuição de Adventure Rank (AR)', items: data.census.ar_distribution, color: '#818cf8' },
              { title: 'Progresso no Abismo Espiral', items: data.census.abyss_distribution, color: '#fbbf24' },
              { title: 'Progresso no Teatro Imaginário', items: data.census.theater_distribution, color: '#38bdf8' },
            ].map((chart) => (
              <div key={chart.title} className="cs-card">
                <div className="cs-card-title">{chart.title}</div>
                <div className="cs-dist-list">
                  {chart.items.map((b) => (
                    <div key={b.label} className="cs-dist-row">
                      <span className="cs-dist-label">{b.label}</span>
                      <div className="cs-bar-bg">
                        <div
                          className="cs-bar-fg"
                          style={{ width: `${Math.min(100, b.pct)}%`, background: chart.color }}
                        />
                      </div>
                      <strong className="cs-dist-pct">{b.pct.toFixed(1)}%</strong>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* 3. Rankings Globais (4 abas) */}
          <section className="cs-rankings-section">
            <div className="cs-tabs">
              <button
                type="button"
                className={`cs-tab ${rankTab === 'popular' ? 'is-active' : ''}`}
                onClick={() => setRankTab('popular')}
              >
                <Users size={14} /> Mais Populares (Top 15)
              </button>
              <button
                type="button"
                className={`cs-tab ${rankTab === 'c6' ? 'is-active' : ''}`}
                onClick={() => setRankTab('c6')}
              >
                <Crown size={14} /> Índice C6 — 5★ (Top 15)
              </button>
              <button
                type="button"
                className={`cs-tab ${rankTab === 'cv' ? 'is-active' : ''}`}
                onClick={() => setRankTab('cv')}
              >
                <Flame size={14} /> Elite Crítica — CV (Top 15)
              </button>
              <button
                type="button"
                className={`cs-tab ${rankTab === 'weapons' ? 'is-active' : ''}`}
                onClick={() => setRankTab('weapons')}
              >
                <Swords size={14} /> Armas Mais Equipadas
              </button>
              <button
                type="button"
                className={`cs-tab ${rankTab === 'artifacts' ? 'is-active' : ''}`}
                onClick={() => setRankTab('artifacts')}
              >
                <Gem size={14} /> Sets Mais Usados
              </button>
            </div>

            {rankTab === 'popular' && (
              <div className="cs-rank-grid">
                {data.rankings.top_popular.map((c, idx) => (
                  <button
                    key={c.slug}
                    type="button"
                    className={`cs-rank-card ${selectedSlug === c.slug ? 'is-selected' : ''}`}
                    onClick={() => setSelectedSlug(c.slug)}
                  >
                    <span className="cs-rank-badge">#{idx + 1}</span>
                    <div className={`cs-rank-avatar rarity-${c.rarity}`}>
                      {iconUrl(c.icon) ? <img src={iconUrl(c.icon)!} alt={c.name} loading="lazy" /> : null}
                    </div>
                    <div className="cs-rank-info">
                      <strong>{c.name}</strong>
                      <span>{c.count.toLocaleString('pt-BR')} builds ({c.popularity_pct}%)</span>
                      <div className="cs-rank-sub">
                        Const. média C{c.avg_constellation.toFixed(1)} · C6: {c.c6_pct}%
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {rankTab === 'c6' && (
              <div className="cs-rank-grid">
                {data.rankings.top_c6_5star.map((c, idx) => (
                  <button
                    key={c.slug}
                    type="button"
                    className={`cs-rank-card ${selectedSlug === c.slug ? 'is-selected' : ''}`}
                    onClick={() => setSelectedSlug(c.slug)}
                  >
                    <span className="cs-rank-badge is-gold">#{idx + 1}</span>
                    <div className={`cs-rank-avatar rarity-${c.rarity}`}>
                      {iconUrl(c.icon) ? <img src={iconUrl(c.icon)!} alt={c.name} loading="lazy" /> : null}
                    </div>
                    <div className="cs-rank-info">
                      <strong>{c.name}</strong>
                      <span className="cs-gold-text">{c.c6_pct.toFixed(1)}% possuem C6</span>
                      <div className="cs-rank-sub">
                        Const. média C{c.avg_constellation.toFixed(2)} ({c.count.toLocaleString('pt-BR')} builds)
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {rankTab === 'cv' && analytics && (
              <div className="cs-rank-grid">
                {analytics.topCritValue.map((c, idx) => (
                  <button
                    key={c.slug}
                    type="button"
                    className={`cs-rank-card ${selectedSlug === c.slug ? 'is-selected' : ''}`}
                    onClick={() => setSelectedSlug(c.slug)}
                  >
                    <span className="cs-rank-badge is-cyan">#{idx + 1}</span>
                    <div className={`cs-rank-avatar rarity-${c.rarity}`}>
                      {iconUrl(c.icon) ? <img src={iconUrl(c.icon)!} alt={c.name} loading="lazy" /> : null}
                    </div>
                    <div className="cs-rank-info">
                      <strong>{c.name}</strong>
                      <span className="cs-cyan-text">{c.cvEff.toFixed(1)} CV Efetivo</span>
                      <div className="cs-rank-sub">
                        CR {c.crMed.toFixed(1)}% · CD {c.cdMed.toFixed(1)}% ({c.count.toLocaleString('pt-BR')} builds)
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {rankTab === 'weapons' && (
              <div className="cs-rank-grid">
                {data.rankings.top_weapons.map((w, idx) => (
                  <Link key={w.ambr_id} to={`/weapons/${w.slug}`} className="cs-rank-card">
                    <span className="cs-rank-badge">#{idx + 1}</span>
                    <div className={`cs-rank-avatar rarity-${w.rarity}`}>
                      {iconUrl(w.icon) ? <img src={iconUrl(w.icon)!} alt={w.name} loading="lazy" /> : <Swords size={18} />}
                    </div>
                    <div className="cs-rank-info">
                      <strong>{w.name}</strong>
                      <span>{w.count.toLocaleString('pt-BR')} vezes equipada</span>
                      <div className="cs-rank-sub">{w.share_pct}% do total global de armas</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {rankTab === 'artifacts' && (
              <div className="cs-rank-grid">
                {data.rankings.top_artifact_sets.map((s, idx) => (
                  <Link key={s.ambr_id} to={`/artifacts/${s.slug}`} className="cs-rank-card">
                    <span className="cs-rank-badge">#{idx + 1}</span>
                    <div className={`cs-rank-avatar rarity-5`}>
                      {artifactIconUrl(s.icon) ? (
                        <img src={artifactIconUrl(s.icon)!} alt={s.name} loading="lazy" />
                      ) : (
                        <Gem size={18} />
                      )}
                    </div>
                    <div className="cs-rank-info">
                      <strong>{s.name}</strong>
                      <span>{s.count.toLocaleString('pt-BR')} builds equipadas</span>
                      <div className="cs-rank-sub">{s.share_pct}% do uso global de sets</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* 3.5 Laboratório de Ciência de Dados (K-Means, PCA 2D, Entropia, Bimodal, Spearman & Sua Conta) */}
          {analytics && (
            <CommunityDataScienceLab
              analytics={analytics}
              selectedSlug={selectedSlug}
              onSelectChar={handleSelectAndScroll}
              totalPlayers={data.census.total_players}
              userBenchmarks={userBenchmarks}
            />
          )}

          {/* 4. Explorador Interativo de Qualquer Personagem */}
          <section ref={explorerRef} className="cs-explorer">
            <div className="cs-explorer-bar">
              <div>
                <h2>Explorar Estatísticas por Personagem</h2>
                <p className="muted">
                  Selecione qualquer um dos {data.total_characters} personagens para ver constelações, armas, sets, talentos, radar e vizinhos mais parecidos.
                </p>
              </div>
              <div className="cs-search-wrap">
                <Search size={14} />
                <input
                  type="text"
                  placeholder="Filtrar personagem..."
                  value={charSearch}
                  onChange={(e) => setCharSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="cs-char-picker-strip">
              {sortedChars.slice(0, 48).map((c) => (
                <button
                  key={c.slug}
                  type="button"
                  className={`cs-char-chip ${selectedSlug === c.slug ? 'is-active' : ''}`}
                  onClick={() => setSelectedSlug(c.slug)}
                >
                  {iconUrl(c.icon) ? <img src={iconUrl(c.icon)!} alt={c.name} loading="lazy" /> : null}
                  <span>{c.name}</span>
                </button>
              ))}
            </div>

            {selectedChar && (
              <div className="cs-explorer-detail">
                <div className="cs-explorer-char-link">
                  {selectedEnriched && (
                    <span className="cs-cluster-pill is-static">
                      <span
                        className="cs-cluster-dot"
                        style={{ background: selectedEnriched.clusterColor }}
                      />
                      <span>Arquétipo K-Means: <strong>{selectedEnriched.clusterName}</strong></span>
                    </span>
                  )}
                  <Link to={`/characters/${selectedChar.slug}`} className="btn-primary">
                    Abrir Página Completa de {selectedChar.name} →
                  </Link>
                </div>
                <CharacterCommunityStatsPanel
                  slug={selectedChar.slug}
                  preloaded={selectedChar}
                  totalPlayers={data.census.total_players}
                  userStats={userStatsBySlug.get(selectedChar.slug) ?? null}
                />

                {nearestNeighbors.length > 0 && (
                  <div className="cs-card cs-neighbors-card">
                    <div className="cs-card-title">
                      <Network size={13} /> 6 Personagens com Perfil de Build Mais Parecido com {selectedChar.name} (Distância Euclidiana em 8D)
                    </div>
                    <div className="cs-neighbors-grid">
                      {nearestNeighbors.map(({ item, distance }) => (
                        <button
                          key={item.slug}
                          type="button"
                          className="cs-neighbor-chip"
                          onClick={() => setSelectedSlug(item.slug)}
                        >
                          <div className={`cs-bench-avatar rarity-${item.rarity}`}>
                            {iconUrl(item.icon) ? (
                              <img src={iconUrl(item.icon)!} alt={item.name} loading="lazy" />
                            ) : null}
                          </div>
                          <div className="cs-neighbor-info">
                            <strong>{item.name}</strong>
                            <span>
                              CV {item.cvEff.toFixed(0)} · ER {Math.round(item.erMed)}% · EM {Math.round(item.emMed)}
                            </span>
                          </div>
                          <span className="cs-neighbor-dist" title="Distância euclidiana nos 8 stats padronizados">
                            d={distance.toFixed(2)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
