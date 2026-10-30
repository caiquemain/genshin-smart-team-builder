import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Settings, RefreshCw, Swords, Link as LinkIcon, FileText } from 'lucide-react'
import { api } from '../api/client'
import { useLanguage } from '../context/LanguageContext'
import { iconUrl, artifactIconUrl } from '../config'
import { formatStatLabel } from '../utils/stats'
import SubstitutePickerModal from '../components/SubstitutePickerModal'
import CharacterPickerModal from '../components/CharacterPickerModal'
import CharacterBuildEditor from '../components/CharacterBuildEditor'
import WeaponTooltip from '../components/WeaponTooltip'
import ArtifactTooltip from '../components/ArtifactTooltip'
import type {
  TeamDetail, TeamAnalysisResponse, CharacterSummary,
  WeaponSummary, ArtifactSetSummary, TeamMemberWithBuild
} from '../types'

export default function TeamDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { lang } = useLanguage()
  const [team, setTeam] = useState<TeamDetail | null>(null)
  const [analysis, setAnalysis] = useState<TeamAnalysisResponse | null>(null)
  const [chars, setChars] = useState<Map<string, CharacterSummary>>(new Map())
  const [weapons, setWeapons] = useState<Map<string, WeaponSummary>>(new Map())
  const [artifacts, setArtifacts] = useState<Map<string, ArtifactSetSummary>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [replacingMember, setReplacingMember] = useState<number | null>(null)
  const [showFallbackPicker, setShowFallbackPicker] = useState(false)
  const [editingBuild, setEditingBuild] = useState<TeamMemberWithBuild | null>(null)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    
    async function loadData() {
      try {
        // 1. Carrega o time
        const t = await api.getTeam(Number(id), lang)
        setTeam(t)

        // 2. Carrega todos os personagens (para resolver avatares dos substitutos)
        const c = await api.listCharacters(lang, { limit: 100 })
        setChars(new Map(c.items.map((x) => [x.slug, x])))

        // 3. Coleta os slugs de armas e artefatos que estão sendo USADOS neste time
        const weaponSlugs = new Set<string>()
        const artifactSlugs = new Set<string>()
        
        t.members.forEach(m => {
          if (m.build) {
            m.build.weapons.forEach(w => { if (w.weapon_slug) weaponSlugs.add(w.weapon_slug) })
            m.build.artifacts_4pc.forEach(a => { if (a.artifact_set_slug) artifactSlugs.add(a.artifact_set_slug) })
            m.build.artifacts_2pc.forEach(p => {
              if (p.set1_slug) artifactSlugs.add(p.set1_slug)
              if (p.set2_slug) artifactSlugs.add(p.set2_slug)
            })
          }
        })

        // 4. Busca individualmente só as armas e artefatos usados
        const wMap = new Map<string, WeaponSummary>()
        await Promise.all(Array.from(weaponSlugs).map(async slug => {
          try {
            const w = await api.getWeapon(slug, lang)
            wMap.set(slug, w)
          } catch (e) { console.error("Arma não encontrada:", slug) }
        }))
        setWeapons(wMap)

        const aMap = new Map<string, ArtifactSetSummary>()
        await Promise.all(Array.from(artifactSlugs).map(async slug => {
          try {
            const a = await api.getArtifact(slug, lang)
            aMap.set(slug, a)
          } catch (e) { console.error("Artefato não encontrado:", slug) }
        }))
        setArtifacts(aMap)

        // 5. Análise do time
        const slugs = t.members.map((m) => m.character.slug)
        const an = await api.analyzeTeam(slugs, lang)
        setAnalysis(an)

      } catch (e) {
        setError(String(e))
      } finally {
        setLoading(false)
      }
    }
    
    loadData()
  }, [id, lang])

  if (loading) return <div className="status" style={{ padding: 40, textAlign: 'center' }}>Carregando detalhes do time...</div>
  if (error || !team) return <div className="status error" style={{ padding: 40, textAlign: 'center' }}>Erro: {error || 'Time não encontrado'}</div>

  return (
    <div className="team-detail-page">
      <div className="team-detail-header">
        <Link to="/teams" className="team-detail-back">← Voltar para times</Link>
        <h1 className="team-detail-title">{team.name}</h1>
        {team.description && <p className="team-detail-desc">{team.description}</p>}
        {team.author_name && <p className="team-detail-author">Por {team.author_name}</p>}
      </div>

      {analysis && (
        <div className="team-detail-analysis">
          <div 
            className="team-score-badge" 
            style={{ '--score': analysis.score } as React.CSSProperties}
          >
            <div className="score-inner">
              <span className="score-value">{analysis.score}</span>
              <span className="score-label">/ 100</span>
            </div>
          </div>
          <div className="analysis-content">
            {analysis.reactions.length > 0 && (
              <div className="analysis-group">
                <h4>Reações Ativas</h4>
                <div className="analysis-tags">
                  {analysis.reactions.map((r: any, i: number) => (
                    <span key={i} className="analysis-tag reaction">{r.name || r}</span>
                  ))}
                </div>
              </div>
            )}
            {analysis.warnings.length > 0 && (
              <div className="analysis-group">
                <h4>Avisos</h4>
                <ul className="analysis-warnings">
                  {analysis.warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="team-detail-members">
        {team.members.map((member) => (
          <MemberBuildCard
            key={member.character.slug}
            member={member}
            weapons={weapons}
            artifacts={artifacts}
            chars={chars}
            isMainDps={member.position === 1 || member.character.slug === 'skirk'}
            onReplaceClick={() => { setReplacingMember(member.position); setShowFallbackPicker(false) }}
            onEditBuild={() => setEditingBuild(member)}
          />
        ))}
      </div>

      {replacingMember !== null && (() => {
        const member = team.members.find(m => m.position === replacingMember)
        if (!member) return null
        
        const handleReplace = async (newSlug: string) => {
          const newSlugs = team.members.map(m => 
            m.position === replacingMember ? newSlug : m.character.slug
          )
          const newMembers = team.members.map(m => 
            m.position === replacingMember 
              ? { ...m, character: { ...m.character, slug: newSlug, name: '...' }, build: null } 
              : m
          )
          setTeam({ ...team, members: newMembers })
          setReplacingMember(null)
          
          try {
            const updated = await api.updateTeamMembers(team.id, newSlugs, lang)
            setTeam(updated)
          } catch (e) {
            console.error(e)
            alert("Erro ao salvar a substituição no servidor.")
          }
        }

        if (!showFallbackPicker && member.substitutes && member.substitutes.length > 0) {
          return (
            <SubstitutePickerModal
              substitutes={member.substitutes}
              currentCharName={member.character.name}
              currentCharSlug={member.character.slug}
              onClose={() => setReplacingMember(null)}
              onSelect={handleReplace}
              onFallback={() => setShowFallbackPicker(true)}
            />
          )
        }

        return (
          <CharacterPickerModal
            title={`Substituir ${member.character.name}`}
            excludeSlug={member.character.slug}
            onClose={() => setReplacingMember(null)}
            onSelect={(newChar) => handleReplace(newChar.slug)}
          />
        )
      })()}

      {editingBuild && (
        <CharacterBuildEditor
          character={editingBuild.character}
          initialBuild={editingBuild.build}
          onClose={() => setEditingBuild(null)}
          onSave={async (newBuild) => {
            try {
              const updated = await api.updateTeamBuilds(team.id, { [editingBuild.position]: newBuild }, lang)
              setTeam(updated)
              setEditingBuild(null)
            } catch (e) {
              console.error(e)
              alert("Erro ao salvar a build no servidor.")
            }
          }}
        />
      )}
    </div>
  )
}

function MemberBuildCard({
  member, weapons, artifacts, chars, isMainDps, onReplaceClick, onEditBuild
}: {
  member: TeamMemberWithBuild
  weapons: Map<string, WeaponSummary>
  artifacts: Map<string, ArtifactSetSummary>
  chars: Map<string, CharacterSummary>
  isMainDps: boolean
  onReplaceClick: () => void
  onEditBuild: () => void
}) {
  const c = member.character
  const b = member.build
  const img = iconUrl(c.icon)

  return (
    <div className="member-build-card">
      <div className="member-card-header">
        <div className={`member-avatar rarity-${c.rarity}`}>
          {img ? <img src={img} alt={c.name} /> : <span>?</span>}
        </div>
        <div className="member-info">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h3 style={{ margin: 0 }}>{c.name}</h3>
            {isMainDps && <span className="badge-main-dps">Main DPS</span>}
          </div>
          <span className="member-meta">{'★'.repeat(c.rarity)} · {c.element} · {c.weapon_type}</span>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button className="btn-secondary" onClick={onEditBuild} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Settings size={16} /> Build
          </button>
          {!isMainDps && (
            <button className="btn-secondary" onClick={onReplaceClick} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <RefreshCw size={16} /> Substituir
            </button>
          )}
          <Link to={`/characters/${c.slug}`} className="btn-secondary">
            Perfil
          </Link>
        </div>
      </div>

      {!b ? (
        <div className="build-empty" style={{ marginTop: 16, cursor: 'pointer', textAlign: 'center' }} onClick={onEditBuild}>
          Nenhuma build configurada. Clique para adicionar.
        </div>
      ) : (
        <div className="member-card-body">
          {b.weapons.length > 0 && (
            <div className="build-section">
              <h4>Armas</h4>
              {b.weapons.map((w, i) => {
                const info = w.weapon_slug ? weapons.get(w.weapon_slug) : null
                const row = (
                  <div className="build-item-read" style={{ cursor: 'help' }}>
                    <div className={`build-item-icon rarity-${info?.rarity ?? 1}`}>
                      {info ? <img src={iconUrl(info.icon)!} alt={info.name} /> : '?'}
                    </div>
                    <div className="build-item-text">
                      <div className="build-item-name">
                        {info?.name ?? w.weapon_slug} {w.weapon_refinement ? `R${w.weapon_refinement}` : ''}
                      </div>
                      {w.notes && <div className="build-item-notes">{w.notes}</div>}
                    </div>
                  </div>
                )
                return info ? <WeaponTooltip key={i} weapon={info}>{row}</WeaponTooltip> : <div key={i}>{row}</div>
              })}
            </div>
          )}

          {(b.artifacts_4pc.length > 0 || b.artifacts_2pc.length > 0) && (
            <div className="build-section">
              <h4>Artefatos</h4>
              {b.artifacts_4pc.map((a, i) => {
                const info = a.artifact_set_slug ? artifacts.get(a.artifact_set_slug) : null
                const row = (
                  <div className="build-item-read" style={{ cursor: 'help' }}>
                    <div className={`build-item-icon rarity-${info?.rarity_max ?? 4}`}>
                      {info ? <img src={artifactIconUrl(info.icon)!} alt={info.name} /> : '?'}
                    </div>
                    <div className="build-item-text">
                      <div className="build-item-name">{info?.name ?? a.artifact_set_slug} (4pc)</div>
                      {a.notes && <div className="build-item-notes">{a.notes}</div>}
                    </div>
                  </div>
                )
                return info ? <ArtifactTooltip key={`4pc-${i}`} artifact={info}>{row}</ArtifactTooltip> : <div key={`4pc-${i}`}>{row}</div>
              })}
              {b.artifacts_2pc.map((p, i) => {
                const s1 = p.set1_slug ? artifacts.get(p.set1_slug) : null
                const s2 = p.set2_slug ? artifacts.get(p.set2_slug) : null
                const row = (
                  <div className="build-item-read" style={{ cursor: 'help' }}>
                    <div className="build-item-icon" style={{ background: 'transparent' }}>2+2</div>
                    <div className="build-item-text">
                      <div className="build-item-name">
                        {s1?.name ?? p.set1_slug} + {s2?.name ?? p.set2_slug}
                      </div>
                      {p.notes && <div className="build-item-notes">{p.notes}</div>}
                    </div>
                  </div>
                )
                return s1 ? <ArtifactTooltip key={`2pc-${i}`} artifact={s1}>{row}</ArtifactTooltip> : <div key={`2pc-${i}`}>{row}</div>
              })}
            </div>
          )}

          {(b.sands_stat.length > 0 || b.goblet_stat.length > 0 || b.circlet_stat.length > 0) && (
            <div className="build-section">
              <h4>Main Stats</h4>
              <div className="build-stats-read">
                {b.sands_stat.length > 0 && <div><span>Ampulheta:</span> {b.sands_stat.map(formatStatLabel).join(' / ')}</div>}
                {b.goblet_stat.length > 0 && <div><span>Cálice:</span> {b.goblet_stat.map(formatStatLabel).join(' / ')}</div>}
                {b.circlet_stat.length > 0 && <div><span>Coroa:</span> {b.circlet_stat.map(formatStatLabel).join(' / ')}</div>}
              </div>
              {b.substat_priority.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <span style={{ color: '#94a3b8', fontSize: 14 }}>Substats:</span>{' '}
                  {b.substat_priority.map(formatStatLabel).join(' > ')}
                </div>
              )}
              {(b.er_requirement || b.talent_priority) && (
                <div className="build-extras-read">
                  {b.er_requirement && <div><span>ER:</span> {b.er_requirement}</div>}
                  {b.talent_priority && <div><span>Talentos:</span> {b.talent_priority}</div>}
                </div>
              )}
            </div>
          )}

          <div className="build-accordions">
            {b.combos.length > 0 && (
              <details className="build-accordion">
                <summary><Swords size={16} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'text-bottom' }}/> Combos / Rotação ({b.combos.length})</summary>
                <ul className="accordion-list combos-list">
                  {b.combos.map((c, i) => <li key={i}><code>{c}</code></li>)}
                </ul>
              </details>
            )}
            {b.references.length > 0 && (
              <details className="build-accordion">
                <summary><LinkIcon size={16} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'text-bottom' }}/> Referências ({b.references.length})</summary>
                <ul className="accordion-list">
                  {b.references.map((r, i) => (
                    <li key={i}>
                      <a href={r.url} target="_blank" rel="noopener noreferrer">
                        {r.title || r.url} ↗
                      </a>
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {b.notes && (
              <details className="build-accordion">
                <summary><FileText size={16} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'text-bottom' }}/> Notas Gerais</summary>
                <p style={{ margin: '8px 0 0', fontSize: 14, color: '#cbd5e1' }}>{b.notes}</p>
              </details>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
