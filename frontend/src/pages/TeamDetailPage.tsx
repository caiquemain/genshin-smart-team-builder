import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api/client'
import CharacterPickerModal from '../components/CharacterPickerModal'
import SubstitutePickerModal from '../components/SubstitutePickerModal'
import CharacterBuildEditor from '../components/CharacterBuildEditor'
import { useLanguage } from '../context/LanguageContext'
import { iconUrl, artifactIconUrl } from '../config'
import { formatStatLabel } from '../utils/stats'
import type {
  TeamDetail, TeamAnalysisResponse, CharacterSummary,
  WeaponSummary, ArtifactSetSummary, TeamMemberWithBuild, CharacterBuild
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
  const [replacingMember, setReplacingMember] = useState<number | null>(null)
  const [showFallbackPicker, setShowFallbackPicker] = useState(false)
  const [editingBuild, setEditingBuild] = useState<TeamMemberWithBuild | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    Promise.all([
      api.getTeam(Number(id), lang),
      api.listCharacters(lang, { limit: 200 }),
      api.listWeapons(lang, { limit: 200 }),
      api.listArtifacts(lang, { limit: 200 }),
    ])
      .then(([t, c, w, a]) => {
        setTeam(t)
        setChars(new Map(c.items.map((x) => [x.slug, x])))
        setWeapons(new Map(w.items.map((x) => [x.slug, x])))
        setArtifacts(new Map(a.items.map((x) => [x.slug, x])))

        // Dispara análise baseada nos slugs do time
        const slugs = t.members.map((m) => m.character.slug)
        return api.analyzeTeam(slugs, lang).then(setAnalysis)
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
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
          <div className="team-score-badge">
            <span className="score-value">{analysis.score}</span>
            <span className="score-label">/ 100</span>
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

        // Se o slot tem substitutos configurados E não pedimos o fallback, abre o modal bonito
        if (!showFallbackPicker && member.substitutes && member.substitutes.length > 0) {
          return (
            <SubstitutePickerModal
              substitutes={member.substitutes}
              currentCharName={member.character.name}
              currentCharSlug={member.character.slug}
              currentCharSlug={member.character.slug}
              onClose={() => setReplacingMember(null)}
              onSelect={handleReplace}
              onFallback={() => setShowFallbackPicker(true)}
            />
          )
        }

        // Senão, abre a lista genérica
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
            ⚙️ Build
          </button>

          {!isMainDps && (
            <button className="btn-secondary" onClick={onReplaceClick} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              🔄 Substituir
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
          {/* ARMAS */}
          {b.weapons.length > 0 && (
            <div className="build-section">
              <h4>Armas</h4>
              {b.weapons.map((w, i) => {
                const info = w.weapon_slug ? weapons.get(w.weapon_slug) : null
                return (
                  <div key={i} className="build-item-read">
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
              })}
            </div>
          )}

          {/* ARTEFATOS */}
          {(b.artifacts_4pc.length > 0 || b.artifacts_2pc.length > 0) && (
            <div className="build-section">
              <h4>Artefatos</h4>
              {b.artifacts_4pc.map((a, i) => {
                const info = a.artifact_set_slug ? artifacts.get(a.artifact_set_slug) : null
                return (
                  <div key={`4pc-${i}`} className="build-item-read">
                    <div className={`build-item-icon rarity-${info?.rarity_max ?? 4}`}>
                      {info ? <img src={artifactIconUrl(info.icon)!} alt={info.name} /> : '?'}
                    </div>
                    <div className="build-item-text">
                      <div className="build-item-name">{info?.name ?? a.artifact_set_slug} (4pc)</div>
                      {a.notes && <div className="build-item-notes">{a.notes}</div>}
                    </div>
                  </div>
                )
              })}
              {b.artifacts_2pc.map((p, i) => (
                <div key={`2pc-${i}`} className="build-item-read">
                  <div className="build-item-icon" style={{ background: 'transparent' }}>2+2</div>
                  <div className="build-item-text">
                    <div className="build-item-name">
                      {artifacts.get(p.set1_slug!)?.name ?? p.set1_slug} + {artifacts.get(p.set2_slug!)?.name ?? p.set2_slug}
                    </div>
                    {p.notes && <div className="build-item-notes">{p.notes}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* STATS */}
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
                  <span style={{ color: '#94a3b8', fontSize: 12 }}>Substats:</span>{' '}
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

          {/* ACCORDIONS: Refs, Subs, Combos, Notas */}
          <div className="build-accordions">
            {b.combos.length > 0 && (
              <details className="build-accordion">
                <summary>Combos / Rotação ({b.combos.length})</summary>
                <ul className="accordion-list combos-list">
                  {b.combos.map((c, i) => <li key={i}><code>{c}</code></li>)}
                </ul>
              </details>
            )}

            {b.references.length > 0 && (
              <details className="build-accordion">
                <summary>Referências ({b.references.length})</summary>
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
                <summary>Notas Gerais</summary>
                <p style={{ margin: '8px 0 0', fontSize: 13, color: '#cbd5e1' }}>{b.notes}</p>
              </details>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
