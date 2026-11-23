import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api/client'
import { useLanguage } from '../context/LanguageContext'
import { iconUrl, artifactIconUrl } from '../config'
import { formatStatLabel } from '../utils/stats'
import type { CharacterDetail, Constellation, Talent, Passive, WeaponSummary, ArtifactSetSummary, TeamTemplateSummary } from '../types'
import AscensionSection from '../components/AscensionSection'
import WeaponTooltip from '../components/WeaponTooltip'
import ArtifactTooltip from '../components/ArtifactTooltip'
import TalentSection from '../components/TalentSection'
import CharacterStatsTable from '../components/CharacterStatsTable'
import EquippedBuildPanel from '../components/EquippedBuildPanel'
import CharacterCommunityStatsPanel from '../components/CharacterCommunityStatsPanel'
import type { ComputedCharStats } from '../utils/char-stats-calc'
import { archetypeInfo } from '../utils/archetypes'
import { useRoster } from '../utils/roster'
import { CheckCircle2, XCircle, RotateCcw, Pencil, ChevronDown, ChevronUp, Search, Users } from 'lucide-react'

const TALENT_LABELS: Record<string, string> = {
  normal_attack: 'Ataque Normal',
  elemental_skill: 'Habilidade Elemental',
  elemental_burst: 'Explosão Elemental',
}

// Mapeia "Skill > Burst" (texto do KQM) para os ícones dos talentos do char
function talentPriorityToIcons(priority: string | null | undefined, talents: Talent[] | undefined) {
  if (!priority || !talents) return null
  const parts = priority.split('>').map((p) => p.trim().toLowerCase())
  const iconMap: Record<string, Talent | undefined> = {
    normal: talents.find((t) => t.talent_type === 'normal_attack'),
    skill: talents.find((t) => t.talent_type === 'elemental_skill'),
    burst: talents.find((t) => t.talent_type === 'elemental_burst'),
  }
  const resolved = parts
    .map((p) => {
      if (p.includes('normal')) return iconMap.normal
      if (p.includes('skill')) return iconMap.skill
      if (p.includes('burst')) return iconMap.burst
      return undefined
    })
    .filter((t): t is Talent => !!t)
  return resolved.length > 0 ? resolved : null
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
    .replace(/\{LINK#[^}]+\}(.*?)\{\/LINK\}/g, '$1')   // mantém conteúdo de LINK
    .replace(/<color=[^>]+>(.*?)<\/color>/g, '$1')      // mantém conteúdo de color
    .replace(/<i>(.*?)<\/i>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/\\n/g, '\n')
    .replace(/\{param\d+:[^}]+\}/g, '···')
    .trim()
}

// Remove prefixos duplicados (nome + tipo) do início da description (PT/ES)
function cleanDescription(desc: string, name: string, typeLabel?: string): string {
  if (!desc) return ''
  const cleanDesc = stripHtml(desc)
  const lines = cleanDesc.split('\n').map(l => l.trim()).filter(Boolean)
  const filtered = lines.filter((line, i) => {
    if (i >= 4) return true
    if (line === name) return false
    if (typeLabel && line.toLowerCase() === typeLabel.toLowerCase()) return false
    return true
  })
  return filtered.join('\n')
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
        <div className="talent-card-v2-icon">{img ? <img src={img} alt={talent.name} /> : <span>?</span>}</div>
        <div className="talent-card-v2-title">
          <div className="talent-card-v2-type">{TALENT_LABELS[talent.talent_type]}</div>
          <h3>{talent.name}</h3>
        </div>
      </div>
      {talent.description && (
        <p className="talent-card-v2-desc">
          {cleanDescription(talent.description, talent.name, TALENT_LABELS[talent.talent_type])}
        </p>
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
                <button key={l} className={`sc-level-tab ${l === level ? 'active' : ''}`} onClick={() => setLevel(l)}>{l}</button>
              ))}
            </div>
            <table className="sc-table"><tbody>
              {rows.map((r, i) => (
                <tr key={i}><td>{r.label}</td><td className="sc-val">{r.value}</td></tr>
              ))}
            </tbody></table>
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
      <div className="const-card-v2-icon">{img ? <img src={img} alt={c.name} /> : <span>?</span>}</div>
      <div className="const-card-v2-body">
        <h3>{c.name}</h3>
        {c.description && <p>{cleanDescription(c.description, c.name)}</p>}
      </div>
    </div>
  )
}

function PassiveCard({ passive }: { passive: Passive }) {
  const img = iconUrl(passive.icon)
  return (
    <div className="passive-card-v2">
      <div className="passive-card-v2-icon">{img ? <img src={img} alt={passive.name} /> : <span>?</span>}</div>
      <div className="passive-card-v2-body">
        <h3>{passive.name}</h3>
        {passive.description && <p>{cleanDescription(passive.description, passive.name)}</p>}
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
  const [recommendedArtifacts, setRecommendedArtifacts] = useState<ArtifactSetSummary[]>([])
  const [activeId, setActiveId] = useState<string>('visao-geral')
  const [kqmBuild, setKqmBuild] = useState<any>(null)
  const [kqmWeaponsInfo, setKqmWeaponsInfo] = useState<Map<string, WeaponSummary>>(new Map())
  const [kqmArtifactsInfo, setKqmArtifactsInfo] = useState<Map<string, ArtifactSetSummary>>(new Map())
  const [characterTeams, setCharacterTeams] = useState<TeamTemplateSummary[]>([])
  const [teamsOpen, setTeamsOpen] = useState(false)
  const [teamSearch, setTeamSearch] = useState('')
  const [teamArchFilter, setTeamArchFilter] = useState<string>('all')
  const [teamsVisibleCount, setTeamsVisibleCount] = useState<number>(12)
  const [allChars, setAllChars] = useState<Map<string, any>>(new Map())
  const roster = useRoster()
  const [showRosterEditor, setShowRosterEditor] = useState(false)
  const [equippedStats, setEquippedStats] = useState<ComputedCharStats | null>(null)

  useEffect(() => {
    if (!slug) return
    setChar(null); setError(null); setKqmBuild(null); setEquippedStats(null)
    setTeamsOpen(false); setTeamSearch(''); setTeamArchFilter('all'); setTeamsVisibleCount(12)
    api.getCharacter(slug, lang).then(setChar).catch((e) => setError(String(e)))
    api.getCharacterBuild(slug, lang)
      .then((data) => setKqmBuild(data))
      .catch(() => setKqmBuild(null))

    api.listTemplates({ character_slug: slug, lang })
      .then((res) => setCharacterTeams(res.items))
      .catch(() => setCharacterTeams([]))

    api.listCharacters(lang, { limit: 200 })
      .then((res) => {
        const map = new Map<string, any>()
        res.items.forEach((c) => map.set(c.slug, c))
        setAllChars(map)
      })
      .catch(() => {})
  }, [slug, lang])

  useEffect(() => {
    if (!kqmBuild || !kqmBuild.build_data) return
    const fetchKqmAssets = async () => {
      const wMap = new Map<string, WeaponSummary>()
      const aMap = new Map<string, ArtifactSetSummary>()
      if (kqmBuild.build_data.weapons) {
        await Promise.all(kqmBuild.build_data.weapons.map(async (w: any) => {
          try { wMap.set(w.weapon_slug, await api.getWeapon(w.weapon_slug, lang)) } catch (e) { console.error(e) }
        }))
      }
      if (kqmBuild.build_data.artifacts_4pc) {
        await Promise.all(kqmBuild.build_data.artifacts_4pc.map(async (a: any) => {
          try { aMap.set(a.artifact_set_slug, await api.getArtifact(a.artifact_set_slug, lang)) } catch (e) { console.error(e) }
        }))
      }
      setKqmWeaponsInfo(wMap); setKqmArtifactsInfo(aMap)
    }
    fetchKqmAssets()
  }, [kqmBuild, lang])

  useEffect(() => {
    if (!char) return
    api.listWeapons(lang, { weapon_type: char.weapon_type, limit: 50 }).then((d) => setRecommendedWeapons(d.items)).catch(() => setRecommendedWeapons([]))
  }, [char?.weapon_type, lang])

  useEffect(() => {
    if (!char) return
    const element = String(char.element)
    api.listArtifacts(lang, { rarity: 5, limit: 100 })
      .then((d) => {
        const RECOMMENDED_BY_ELEMENT: Record<string, string[]> = {
          pyro: ['crimson-witch-of-flames', 'lavawalker', 'gilded-dreams'],
          hydro: ['heart-of-depth', 'nymphs-dream', 'golden-troupe'],
          electro: ['thundering-fury', 'thundersoother', 'gilded-dreams'],
          cryo: ['blizzard-strayer', 'gladiators-finale'],
          anemo: ['viridescent-venerer', 'desert-pavilion-chronicle'],
          geo: ['archaic-petra', 'husk-of-opulent-dreams'],
          dendro: ['deepwood-memories', 'gilded-dreams'],
        }
        const slugs = RECOMMENDED_BY_ELEMENT[element] || []
        const matches = d.items.filter((a) => slugs.includes(a.slug))
        const fallback = ['noblesse-oblige', 'tenacity-of-the-millelith', 'emblem-of-severed-fate']
        const more = d.items.filter((a) => fallback.includes(a.slug) && !matches.some((m) => m.slug === a.slug))
        setRecommendedArtifacts([...matches, ...more].slice(0, 6))
      })
      .catch(() => setRecommendedArtifacts([]))
  }, [char?.element, lang])

  const basePassives = useMemo(
    () => (char?.passives ?? []).filter((p) => p.kind !== 'constellation_upgrade'),
    [char?.passives],
  )

  const rawGoodState = slug ? roster.getGoodState(slug) : null
  const ownedEntry = slug ? roster.get(slug) : null
  const effectiveGoodState = useMemo(() => {
    if (rawGoodState) return rawGoodState
    if (ownedEntry?.owned) {
      return {
        level: 90,
        ascension: 6,
        cons: ownedEntry.cons,
        talents: { na: 1, es: 1, eb: 1 },
        weaponSlug: null,
        weaponLevel: 90,
        weaponRefinement: 1,
        artifacts: [],
      }
    }
    return null
  }, [rawGoodState, ownedEntry?.owned, ownedEntry?.cons])

  const sortedCharacterTeams = useMemo(() => {
    if (!slug) return characterTeams
    return [...characterTeams].sort((a, b) => {
      const aMain = a.main_character === slug ? 0 : 1
      const bMain = b.main_character === slug ? 0 : 1
      return aMain - bMain
    })
  }, [characterTeams, slug])

  const teamArchetypes = useMemo(() => {
    const counts = new Map<string, number>()
    for (const t of sortedCharacterTeams) {
      counts.set(t.archetype, (counts.get(t.archetype) ?? 0) + 1)
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([key, count]) => ({
        key,
        count,
        info: archetypeInfo(key),
      }))
  }, [sortedCharacterTeams])

  const filteredCharacterTeams = useMemo(() => {
    const q = teamSearch.trim().toLowerCase()
    return sortedCharacterTeams.filter((t) => {
      if (teamArchFilter !== 'all' && t.archetype !== teamArchFilter) return false
      if (!q) return true
      if (t.name.toLowerCase().includes(q)) return true
      if (archetypeInfo(t.archetype).label.toLowerCase().includes(q)) return true
      return t.character_slugs.some((s) => {
        if (s.toLowerCase().includes(q)) return true
        const cName = allChars.get(s)?.name
        return typeof cName === 'string' && cName.toLowerCase().includes(q)
      })
    })
  }, [sortedCharacterTeams, teamArchFilter, teamSearch, allChars])

  const visibleCharacterTeams = useMemo(
    () => filteredCharacterTeams.slice(0, teamsVisibleCount),
    [filteredCharacterTeams, teamsVisibleCount],
  )

  const sections = useMemo(() => {
    if (!char) return []
    return [
      { id: 'visao-geral', label: 'Visão Geral' },
      effectiveGoodState && { id: 'minha-build', label: 'Minha Build' },
      { id: 'estatisticas-comunidade', label: 'Comunidade (40k)' },
      kqmBuild && { id: 'kqm-build', label: 'Build Recomendada' },
      char.talents.length > 0 && { id: 'talentos-info', label: 'Talentos' },
      basePassives.length > 0 && { id: 'passivos', label: 'Passivos' },
      char.constellations.length > 0 && { id: 'constelacoes', label: 'Constelações' },
      { id: 'stats', label: 'Stats' },
      { id: 'times', label: characterTeams.length > 0 ? `Times (${characterTeams.length})` : 'Times' },
      { id: 'ascensao', label: 'Ascensão' },
      { id: 'talentos-custos', label: 'Custo de Talentos' },
    ].filter(Boolean) as { id: string; label: string }[]
  }, [char, basePassives, kqmBuild, effectiveGoodState, characterTeams.length])

  useEffect(() => {
    if (!char || sections.length === 0) return
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible.length > 0) {
          // Pega a seção mais próxima do topo (não a mais visível)
          const topSection = visible.reduce((acc, cur) => 
            Math.abs(cur.boundingClientRect.top) < Math.abs(acc.boundingClientRect.top) ? cur : acc
          )
          setActiveId(topSection.target.id)
        }
      },
      { rootMargin: '-100px 0px -70% 0px', threshold: [0, 0.5, 1] },
    )
    sections.forEach((s) => { const el = document.getElementById(s.id); if (el) observer.observe(el) })
    return () => observer.disconnect()
  }, [char, sections, characterTeams.length])

  if (error) return <p className="error">Erro: {error}</p>
  if (!char) return <p className="status">Carregando...</p>

  const img = iconUrl(char.icon)
  const releaseFmt = formatRelease(char.release_date)
  const ownership = slug ? roster.get(slug) : null

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
                onClick={() => {
                  if (s.id === 'times' && characterTeams.length > 0) {
                    setTeamsOpen(true)
                  }
                }}
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

              {ownership && (
                <div className="char-roster-status">
                  <span className={`char-roster-pill ${ownership.owned ? 'owned' : 'not-owned'} source-${ownership.source}`}>
                    {ownership.owned ? (
                      <>
                        <CheckCircle2 size={16} />
                        <span>Tenho{ownership.cons > 0 ? ` · C${ownership.cons}` : ''}</span>
                      </>
                    ) : (
                      <>
                        <XCircle size={16} />
                        <span>{ownership.source === 'manual' ? 'Não tenho (manual)' : 'Não tenho'}</span>
                      </>
                    )}
                    {ownership.owned && ownership.source !== 'manual' && (
                      <small className="char-roster-source">{ownership.source === 'good' ? 'GOOD' : 'Seelie'}</small>
                    )}
                  </span>
                  <button
                    className="char-roster-edit-btn"
                    onClick={() => setShowRosterEditor(v => !v)}
                  >
                    <Pencil size={14} />
                    <span>{ownership.source === 'manual' ? 'Editar' : ownership.owned ? 'Personalizar' : 'Marcar'}</span>
                  </button>
                </div>
              )}

              {showRosterEditor && ownership && slug && (
                <div className="char-roster-editor">
                  <label className="char-roster-checkbox">
                    <input
                      type="checkbox"
                      checked={ownership.owned}
                      onChange={(e) => roster.set(slug, { owned: e.target.checked, cons: e.target.checked ? ownership.cons : 0 })}
                    />
                    <span>Eu tenho este personagem</span>
                  </label>
                  {ownership.owned && (
                    <div className="char-roster-cons">
                      <span>Constelação:</span>
                      <div className="cons-pills">
                        {[0, 1, 2, 3, 4, 5, 6].map((n) => (
                          <button
                            key={n}
                            className={`cons-pill ${ownership.cons === n ? 'active' : ''}`}
                            onClick={() => roster.set(slug, { owned: true, cons: n })}
                          >
                            C{n}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {ownership.source === 'manual' && (
                    <button
                      className="char-roster-reset"
                      onClick={() => { roster.remove(slug); setShowRosterEditor(false) }}
                    >
                      <RotateCcw size={14} />
                      <span>Remover override (voltar a usar Seelie/GOOD)</span>
                    </button>
                  )}
                </div>
              )}
              {char.description && <p className="char-hero-desc">{stripHtml(char.description)}</p>}
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
                <div className="char-info-value">{char.ascension_stat.replace(/_/g, ' ')}{char.ascension_stat_value ? ` +${char.ascension_stat_value}` : ''}</div>
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

          {effectiveGoodState && (
            <EquippedBuildPanel
              character={char}
              goodState={effectiveGoodState}
              recommendedBuild={kqmBuild?.build_data ?? null}
              onUpdated={() => roster.refresh()}
              onStatsComputed={setEquippedStats}
            />
          )}

          <CharacterCommunityStatsPanel
            slug={char.slug}
            characterDetail={char}
            userStats={effectiveGoodState ? equippedStats : null}
          />

          {kqmBuild && (
            <section id="kqm-build" className="char-section-anchor">
              <h2>Build Recomendada</h2>
              <div className="kqm-build-card">
                <div className="kqm-build-grid">
                  <div className="kqm-build-col">
                    <h4>Armas</h4>
                    {kqmBuild.build_data.weapons?.map((w: any, i: number) => {
                      const wInfo = kqmWeaponsInfo.get(w.weapon_slug)
                      const wImg = wInfo ? iconUrl(wInfo.icon) : null
                      const content = (
                        <div className="kqm-build-item">
                          <div className={`kqm-build-item-icon rarity-${wInfo?.rarity ?? 4}`}>
                            {wImg ? <img src={wImg} alt={wInfo?.name} /> : '?'}
                          </div>
                          <div className="kqm-build-item-info">
                            <div className="kqm-build-item-name">
                              {wInfo ? wInfo.name : w.weapon_slug.replace(/-/g, ' ')} {w.refinement ? `R${w.refinement}` : ''}
                            </div>
                          </div>
                        </div>
                      )
                      return wInfo ? (
                        <WeaponTooltip key={i} weapon={wInfo} buildNote={w.notes}>{content}</WeaponTooltip>
                      ) : <div key={i}>{content}</div>
                    })}
                  </div>

                  <div className="kqm-build-col">
                    <h4>Artefatos</h4>
                    {kqmBuild.build_data.artifacts_4pc?.map((a: any, i: number) => {
                      const aInfo = kqmArtifactsInfo.get(a.artifact_set_slug)
                      const aImg = aInfo ? artifactIconUrl(aInfo.icon) : null
                      const content = (
                        <div className="kqm-build-item">
                          <div className={`kqm-build-item-icon rarity-${aInfo?.rarity_max ?? 5}`}>
                            {aImg ? <img src={aImg} alt={aInfo?.name} /> : '?'}
                          </div>
                          <div className="kqm-build-item-info">
                            <div className="kqm-build-item-name">
                              {aInfo ? aInfo.name : a.artifact_set_slug.replace(/-/g, ' ')}
                              <span className="kqm-build-badge">4pc</span>
                            </div>
                          </div>
                        </div>
                      )
                      return aInfo ? (
                        <ArtifactTooltip key={i} artifact={aInfo} buildNote={a.notes}>{content}</ArtifactTooltip>
                      ) : <div key={i}>{content}</div>
                    })}
                  </div>
                </div>

                <div className="kqm-build-stats">
                  <div className="kqm-build-stat-block">
                    <h5>Main Stats</h5>
                    <div className="kqm-main-stats-list">
                      {kqmBuild.build_data.sands_stat?.length > 0 && (
                        <div className="kqm-main-stat-line">
                          <span className="kqm-main-stat-label">Ampulheta</span>
                          <span className="kqm-main-stat-pill">{kqmBuild.build_data.sands_stat.map(formatStatLabel).join(' / ')}</span>
                        </div>
                      )}
                      {kqmBuild.build_data.goblet_stat?.length > 0 && (
                        <div className="kqm-main-stat-line">
                          <span className="kqm-main-stat-label">Cálice</span>
                          <span className="kqm-main-stat-pill">{kqmBuild.build_data.goblet_stat.map(formatStatLabel).join(' / ')}</span>
                        </div>
                      )}
                      {kqmBuild.build_data.circlet_stat?.length > 0 && (
                        <div className="kqm-main-stat-line">
                          <span className="kqm-main-stat-label">Coroa</span>
                          <span className="kqm-main-stat-pill">{kqmBuild.build_data.circlet_stat.map(formatStatLabel).join(' / ')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="kqm-build-stat-block">
                    <h5>Substats (Prioridade)</h5>
                    {kqmBuild.build_data.substat_priority?.length > 0 && (
                      <div className="kqm-substats-list">
                        {kqmBuild.build_data.substat_priority.map((stat: string, i: number) => (
                          <span key={i} style={{display:'inline-flex', alignItems:'center', gap:6}}>
                            <span className="kqm-substat-badge">{formatStatLabel(stat)}</span>
                            {i < kqmBuild.build_data.substat_priority.length - 1 && <span className="kqm-substat-arrow">›</span>}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="kqm-build-stat-block">
                    <h5>Requisitos</h5>
                    {kqmBuild.build_data.er_requirement && <div className="kqm-build-stat-row"><span>ER:</span>{kqmBuild.build_data.er_requirement}</div>}
                    {kqmBuild.build_data.talent_priority && (() => {
                      const icons = talentPriorityToIcons(kqmBuild.build_data.talent_priority, char?.talents)
                      if (!icons) {
                        return <div className="kqm-build-stat-row"><span>Talentos:</span>{kqmBuild.build_data.talent_priority}</div>
                      }
                      return (
                        <div className="kqm-talent-priority">
                          <span className="kqm-talent-priority-label">Talentos</span>
                          <div className="kqm-talent-priority-icons">
                            {icons.map((t, i) => (
                              <span key={i} className="kqm-talent-priority-item">
                                {i > 0 && <span className="kqm-talent-priority-arrow">›</span>}
                                <span className="kqm-talent-priority-icon" title={TALENT_LABELS[t.talent_type]}>
                                  {t.icon ? <img src={iconUrl(t.icon)!} alt={TALENT_LABELS[t.talent_type]} /> : <span>?</span>}
                                </span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                </div>

                {kqmBuild.build_data.combos?.length > 0 && (
                  <div className="kqm-build-combos">
                    <h5>Combos</h5>
                    <div className="kqm-build-combos-list">
                      {kqmBuild.build_data.combos.map((c: string, i: number) => <code key={i}>{c}</code>)}
                    </div>
                  </div>
                )}
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
                {basePassives.map((p, i) => <PassiveCard key={`${p.name}-${i}`} passive={p} />)}
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
            <h2>Stats por Ascensão</h2>
            <CharacterStatsTable slug={char.slug} />
          </section>

          <section id="times" className="char-section-anchor char-teams-section">
            {characterTeams.length > 0 ? (
              <div className={`char-teams-accordion ${teamsOpen ? 'is-open' : ''}`}>
                <button
                  type="button"
                  className="char-teams-toggle"
                  aria-expanded={teamsOpen}
                  onClick={() => setTeamsOpen((v) => !v)}
                >
                  <div className="char-teams-toggle-left">
                    <div className="char-teams-toggle-title-row">
                      <Users size={18} className="char-teams-toggle-icon" />
                      <h2>Times com {char.name}</h2>
                      <span className="char-teams-count-pill">
                        {characterTeams.length} {characterTeams.length === 1 ? 'time' : 'times'}
                      </span>
                    </div>
                    {!teamsOpen && teamArchetypes.length > 0 && (
                      <div className="char-teams-preview-pills">
                        {teamArchetypes.slice(0, 5).map(({ key, count, info }) => {
                          const ArchIcon = info.icon
                          return (
                            <span
                              key={key}
                              className="char-teams-mini-arch"
                              style={{ background: `${info.color}1a`, color: info.color, borderColor: `${info.color}38` }}
                            >
                              <ArchIcon size={12} /> {info.label} <strong>{count}</strong>
                            </span>
                          )
                        })}
                        {teamArchetypes.length > 5 && (
                          <span className="char-teams-mini-more">+{teamArchetypes.length - 5} arquétipos</span>
                        )}
                      </div>
                    )}
                  </div>
                  <span className="char-teams-toggle-action">
                    {teamsOpen ? (
                      <>
                        <span>Recolher</span>
                        <ChevronUp size={16} />
                      </>
                    ) : (
                      <>
                        <span>Ver times</span>
                        <ChevronDown size={16} />
                      </>
                    )}
                  </span>
                </button>

                {teamsOpen && (
                  <div className="char-teams-body">
                    {characterTeams.length > 6 && (
                      <div className="char-teams-toolbar">
                        <div className="char-teams-search">
                          <Search size={14} />
                          <input
                            type="text"
                            placeholder="Filtrar por nome do time ou aliado..."
                            value={teamSearch}
                            onChange={(e) => {
                              setTeamSearch(e.target.value)
                              setTeamsVisibleCount(12)
                            }}
                          />
                        </div>
                        {teamArchetypes.length > 1 && (
                          <div className="char-teams-arch-filters">
                            <button
                              type="button"
                              className={`char-teams-arch-chip ${teamArchFilter === 'all' ? 'is-active' : ''}`}
                              onClick={() => {
                                setTeamArchFilter('all')
                                setTeamsVisibleCount(12)
                              }}
                            >
                              Todos ({characterTeams.length})
                            </button>
                            {teamArchetypes.map(({ key, count, info }) => {
                              const ArchIcon = info.icon
                              const active = teamArchFilter === key
                              return (
                                <button
                                  key={key}
                                  type="button"
                                  className={`char-teams-arch-chip ${active ? 'is-active' : ''}`}
                                  style={active ? { background: `${info.color}28`, borderColor: info.color, color: info.color } : undefined}
                                  onClick={() => {
                                    setTeamArchFilter(active ? 'all' : key)
                                    setTeamsVisibleCount(12)
                                  }}
                                >
                                  <ArchIcon size={12} /> {info.label} ({count})
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {filteredCharacterTeams.length > 0 ? (
                      <>
                        <div className="char-teams-grid">
                          {visibleCharacterTeams.map((t) => {
                            const arch = archetypeInfo(t.archetype)
                            const ArchIcon = arch.icon
                            return (
                              <Link
                                key={t.id}
                                to={`/teams/new?template_id=${t.id}`}
                                className="template-card"
                                style={{ borderLeftColor: arch.color }}
                              >
                                <div className="template-card-header">
                                  <div className="template-card-arch" style={{ background: `${arch.color}20`, color: arch.color, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                    <ArchIcon size={14} /> {arch.label}
                                  </div>
                                </div>
                                <div className="template-card-name">{t.name}</div>
                                <div className="template-card-members">
                                  {t.character_slugs.map((s) => (
                                    <span
                                      key={s}
                                      className={`template-member ${s === t.main_character ? 'template-member-main' : ''} ${s === slug ? 'is-current' : ''}`}
                                      title={allChars.get(s)?.name ?? s}
                                    >
                                      {(() => {
                                        const c = allChars.get(s)
                                        const cImg = c ? iconUrl(c.icon) : null
                                        return cImg ? <img src={cImg} alt={c?.name ?? s} /> : <span>?</span>
                                      })()}
                                    </span>
                                  ))}
                                </div>
                              </Link>
                            )
                          })}
                        </div>

                        <div className="char-teams-footer">
                          <span className="char-teams-footer-info">
                            Exibindo <strong>{visibleCharacterTeams.length}</strong> de <strong>{filteredCharacterTeams.length}</strong>{' '}
                            {filteredCharacterTeams.length === 1 ? 'time' : 'times'}
                          </span>
                          <div className="char-teams-footer-actions">
                            {visibleCharacterTeams.length < filteredCharacterTeams.length && (
                              <>
                                <button
                                  type="button"
                                  className="char-teams-btn"
                                  onClick={() => setTeamsVisibleCount((n) => n + 12)}
                                >
                                  Mostrar mais (+{Math.min(12, filteredCharacterTeams.length - visibleCharacterTeams.length)})
                                </button>
                                {filteredCharacterTeams.length - visibleCharacterTeams.length > 12 && (
                                  <button
                                    type="button"
                                    className="char-teams-btn is-subtle"
                                    onClick={() => setTeamsVisibleCount(filteredCharacterTeams.length)}
                                  >
                                    Ver todos ({filteredCharacterTeams.length})
                                  </button>
                                )}
                              </>
                            )}
                            <button
                              type="button"
                              className="char-teams-btn is-subtle"
                              onClick={() => {
                                setTeamsOpen(false)
                                setTeamsVisibleCount(12)
                                document.getElementById('times')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                              }}
                            >
                              <ChevronUp size={14} /> Recolher
                            </button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="char-teams-empty">
                        <span>Nenhum time encontrado com esse filtro.</span>
                        <button
                          type="button"
                          className="char-teams-btn is-subtle"
                          onClick={() => {
                            setTeamSearch('')
                            setTeamArchFilter('all')
                            setTeamsVisibleCount(12)
                          }}
                        >
                          Limpar filtros
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <p className="status" style={{ padding: 20 }}>Nenhum time encontrado com este personagem ainda.</p>
            )}
          </section>

          <div id="ascensao" className="char-section-anchor">{char.slug && <AscensionSection slug={char.slug} />}</div>
          <div id="talentos-custos" className="char-section-anchor">{char.slug && <TalentSection slug={char.slug} />}</div>
        </div>
      </div>
    </div>
  )
}
