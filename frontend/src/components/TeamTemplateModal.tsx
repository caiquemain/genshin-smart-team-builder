import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { X, ArrowRight, CheckCircle2, UserX, RefreshCw, Share2 } from 'lucide-react'
import { api } from '../api/client'
import { useLanguage } from '../context/LanguageContext'
import { iconUrl } from '../config'
import { archetypeInfo } from '../utils/archetypes'
import { useRoster } from '../utils/roster'
import TeamCardStudioModal from './TeamCardStudioModal'
import type { TeamTemplateDetail, CharacterSummary, BuildPreset } from '../types'

interface Props {
  templateId: number
  chars: Map<string, CharacterSummary>
  onClose: () => void
}

export default function TeamTemplateModal({ templateId, chars, onClose }: Props) {
  const { lang } = useLanguage()
  const roster = useRoster()
  const [template, setTemplate] = useState<TeamTemplateDetail | null>(null)
  const [presets, setPresets] = useState<Map<string, BuildPreset[]>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showStudio, setShowStudio] = useState(false)

  useEffect(() => {
    setLoading(true)
    setError(null)

    api.getTemplate(templateId, lang)
      .then((t) => {
        setTemplate(t)
        // Busca presets de cada membro em paralelo
        return Promise.all(
          t.character_slugs.map((slug) =>
            api.listPresets(slug, lang).then((p) => ({ slug, presets: p })).catch(() => ({ slug, presets: [] }))
          )
        )
      })
      .then((results) => {
        const map = new Map<string, BuildPreset[]>()
        results.forEach((r) => map.set(r.slug, r.presets))
        setPresets(map)
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [templateId, lang])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const arch = template ? archetypeInfo(template.archetype) : null
  const ArchIcon = arch?.icon

  const ownedStatus = template
    ? template.character_slugs.map((slug) => ({ slug, ...roster.get(slug) }))
    : []
  const ownedCount = ownedStatus.filter((s) => s.owned).length
  const missing = ownedStatus.filter((s) => !s.owned)

  const sourcesList = template?.sources && template.sources.length > 0
    ? template.sources
    : template?.source
      ? [{ source: template.source, url: template.source_url }]
      : []

  return (
    <div className="template-modal-overlay" onClick={onClose}>
      <div className="template-modal" onClick={(e) => e.stopPropagation()}>
        <button className="template-modal-close" onClick={onClose} aria-label="Fechar">
          <X size={20} />
        </button>

        {loading && <p className="status">Carregando detalhes...</p>}
        {error && <p className="error">{error}</p>}

        {template && arch && ArchIcon && (
          <>
            <div className="template-modal-header" style={{ borderColor: `${arch.color}40` }}>
              <div className="template-card-arch" style={{ background: `${arch.color}20`, color: arch.color, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <ArchIcon size={14} /> {arch.label}
              </div>
              <h2>{template.name}</h2>
              {template.description && <p className="template-modal-desc">{template.description}</p>}
              {sourcesList.length > 0 && (
                <div className="template-modal-source">
                  {sourcesList.length > 1 ? 'Fontes: ' : 'Fonte: '}
                  {sourcesList.map((s, i) => (
                    <span key={`${s.source}-${i}`}>
                      {i > 0 && ' · '}
                      <a href={s.url || '#'} target="_blank" rel="noopener noreferrer">
                        {s.source} ↗
                      </a>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Status de posse */}
            <div className="template-modal-owned">
              {ownedCount === template.character_slugs.length ? (
                <span className="template-modal-owned-badge is-complete">
                  <CheckCircle2 size={14} /> Você tem todos os {template.character_slugs.length} personagens
                </span>
              ) : (
                <span className="template-modal-owned-badge is-incomplete">
                  <UserX size={14} /> Você tem {ownedCount}/{template.character_slugs.length} personagens
                  {missing.length > 0 && ` — falta: ${missing.map((m) => chars.get(m.slug)?.name ?? m.slug).join(', ')}`}
                </span>
              )}
            </div>

            {/* Cards dos membros */}
            <div className="template-modal-members">
              {template.character_slugs.map((slug, idx) => {
                const pos = idx + 1
                const c = chars.get(slug)
                const isMain = slug === template.main_character
                const owned = roster.get(slug)
                const presetList = presets.get(slug) ?? []
                const preset = presetList[0]
                const slotSubs = template.slot_substitutes?.[String(pos)] ?? []

                return (
                  <div key={slug} className={`template-modal-member ${owned.owned ? '' : 'is-missing'}`}>
                    <div className="template-modal-member-header">
                      <div className="template-modal-member-avatar">
                        {c && iconUrl(c.icon) ? <img src={iconUrl(c.icon)!} alt={c.name} /> : <span>?</span>}
                      </div>
                      <div className="template-modal-member-info">
                        <div className="template-modal-member-name">
                          {c?.name ?? slug}
                          {isMain && <span className="template-modal-main-badge">Main</span>}
                        </div>
                        <div className="template-modal-member-status">
                          {owned.owned ? (
                            <span className="owned-yes">
                              <CheckCircle2 size={12} /> Tenho
                              {owned.cons > 0 && ` · C${owned.cons}`}
                              {owned.source === 'good' && <span className="owned-source">· GOOD</span>}
                              {owned.source === 'seelie' && <span className="owned-source">· Seelie</span>}
                              {owned.source === 'manual' && <span className="owned-source">· Manual</span>}
                            </span>
                          ) : (
                            <span className="owned-no"><UserX size={12} /> Não tenho</span>
                          )}
                        </div>
                      </div>
                    </div>
                    {preset ? (
                      <div className="template-modal-member-build">
                        <div className="template-modal-build-name">{preset.name}</div>
                        <div className="template-modal-build-summary">
                          {preset.build_data.weapons.length > 0 && `${preset.build_data.weapons.length} armas`}
                          {preset.build_data.artifacts_4pc.length > 0 && ` · ${preset.build_data.artifacts_4pc.length} sets`}
                          {preset.build_data.combos.length > 0 && ` · ${preset.build_data.combos.length} combos`}
                        </div>
                      </div>
                    ) : (
                      <div className="template-modal-member-empty">Sem build configurada</div>
                    )}

                    {slotSubs.length > 0 && (
                      <div className="template-modal-subs">
                        <div className="template-modal-subs-title">
                          <RefreshCw size={12} /> Substituições ({slotSubs.length})
                        </div>
                        <div className="template-modal-subs-list">
                          {slotSubs.slice(0, 5).map((sub, si) => {
                            const subSlug = sub.character_slug || ''
                            const subChar = chars.get(subSlug)
                            const subOwned = subSlug ? roster.get(subSlug).owned : false
                            const subImg = subChar ? iconUrl(subChar.icon) : null
                            return (
                              <div
                                key={`${subSlug}-${si}`}
                                className={`template-sub-chip ${subOwned ? 'is-owned' : ''}`}
                                title={[sub.build_label, sub.notes].filter(Boolean).join(' — ')}
                              >
                                {subImg && <img src={subImg} alt={subChar?.name ?? subSlug} />}
                                <span className="template-sub-name">{subChar?.name ?? subSlug}</span>
                                {sub.build_label && (
                                  <span className="template-sub-role">{sub.build_label}</span>
                                )}
                                {subOwned && <CheckCircle2 size={11} className="template-sub-owned-icon" />}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="template-modal-footer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowStudio(true)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
              >
                <Share2 size={15} /> Compartilhar Time (PNG)
              </button>
              <Link to={`/teams/new?template_id=${template.id}`} className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                Usar este time no Builder <ArrowRight size={16} />
              </Link>
            </div>
          </>
        )}
      </div>

      {showStudio && template && arch && (
        <TeamCardStudioModal
          teamName={template.name}
          description={template.description}
          archetypeLabel={arch.label}
          synergyScore={template.analysis?.score ?? null}
          reactions={template.analysis?.reactions?.map((r) => r.name) ?? []}
          members={template.character_slugs
            .map((slug, idx) => {
              const c = chars.get(slug)
              if (!c) return null
              const preset = (presets.get(slug) ?? [])[0]
              return {
                position: idx + 1,
                character: c,
                role: template.analysis?.roles?.find((r) => r.slug === slug)?.role ?? null,
                guideBuild: preset?.build_data ?? null,
              }
            })
            .filter((x): x is NonNullable<typeof x> => Boolean(x))}
          onClose={() => setShowStudio(false)}
        />
      )}
    </div>
  )
}
