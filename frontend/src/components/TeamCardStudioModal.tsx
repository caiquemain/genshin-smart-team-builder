import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Check,
  Columns4,
  Copy,
  Download,
  LayoutGrid,
  Sparkles,
  UserCheck,
  BookOpen,
  X,
} from 'lucide-react'
import { api } from '../api/client'
import { useLanguage } from '../context/LanguageContext'
import { getSavedEnkaUid } from '../utils/planner-storage'
import { useRoster } from '../utils/roster'
import {
  BUILD_CARD_THEMES,
  loadCardPrefs,
  saveCardPrefs,
  type BuildCardTheme,
} from '../utils/build-card-png'
import {
  buildArtifactSetLookup,
  buildWeaponLookup,
  computeCharacterBuildStats,
  loadCharacterStatsDataset,
  type CharacterStatsDataset,
  type ComputedCharStats,
} from '../utils/char-stats-calc'
import {
  copyTeamCardToClipboard,
  downloadTeamCardPng,
  renderTeamCardToCanvas,
  type TeamCardData,
  type TeamCardLayout,
  type TeamCardMemberInput,
  type TeamCardOptions,
  type TeamCardSourceMode,
} from '../utils/team-card-png'
import type {
  ArtifactSetSummary,
  CharacterBuild,
  CharacterSummary,
  WeaponSummary,
} from '../types'

export interface TeamStudioMemberProp {
  position: number
  character: CharacterSummary
  role?: string | null
  guideBuild?: CharacterBuild | null
}

export interface TeamCardStudioModalProps {
  teamName: string
  description?: string | null
  archetypeLabel?: string | null
  tier?: string | null
  synergyScore?: number | null
  reactions?: string[]
  members: TeamStudioMemberProp[]
  initialWeapons?: Map<string, WeaponSummary>
  initialArtifacts?: Map<string, ArtifactSetSummary>
  onClose: () => void
}

const THEME_OPTIONS: Array<{ id: BuildCardTheme; label: string; color: string }> = [
  { id: 'auto', label: 'Elemento', color: 'linear-gradient(135deg, #38bdf8, #c084fc, #fbbf24)' },
  { id: 'pyro', label: 'Pyro', color: BUILD_CARD_THEMES.pyro.accent },
  { id: 'hydro', label: 'Hydro', color: BUILD_CARD_THEMES.hydro.accent },
  { id: 'cryo', label: 'Cryo', color: BUILD_CARD_THEMES.cryo.accent },
  { id: 'electro', label: 'Electro', color: BUILD_CARD_THEMES.electro.accent },
  { id: 'anemo', label: 'Anemo', color: BUILD_CARD_THEMES.anemo.accent },
  { id: 'geo', label: 'Geo', color: BUILD_CARD_THEMES.geo.accent },
  { id: 'dendro', label: 'Dendro', color: BUILD_CARD_THEMES.dendro.accent },
  { id: 'astral', label: 'Astral', color: BUILD_CARD_THEMES.astral.accent },
  { id: 'gold', label: 'Ouro', color: BUILD_CARD_THEMES.gold.accent },
]

export default function TeamCardStudioModal({
  teamName,
  description,
  archetypeLabel,
  tier,
  synergyScore,
  reactions,
  members,
  initialWeapons,
  initialArtifacts,
  onClose,
}: TeamCardStudioModalProps) {
  const { lang } = useLanguage()
  const roster = useRoster()
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const initialPrefs = useMemo(() => loadCardPrefs(), [])

  // Conta quantos membros do time possuem build real importada (Enka/GOOD)
  const importedCount = useMemo(
    () =>
      members.filter((m) => {
        const gs = roster.getGoodState(m.character.slug)
        return Boolean(gs && (gs.artifacts.length > 0 || gs.weaponSlug))
      }).length,
    [members, roster],
  )

  const [sourceMode, setSourceMode] = useState<TeamCardSourceMode>(() =>
    importedCount >= 2 ? 'account' : 'guide',
  )
  const [layout, setLayout] = useState<TeamCardLayout>('wide')
  const [theme, setTheme] = useState<BuildCardTheme>('auto')
  const [customTitle, setCustomTitle] = useState(teamName)
  const [customNotes, setCustomNotes] = useState(description ?? '')
  const [nickname, setNickname] = useState(() => initialPrefs.nickname ?? '')
  const [uid, setUid] = useState(() => initialPrefs.uid ?? getSavedEnkaUid())
  const [showUid, setShowUid] = useState(() => initialPrefs.showUid ?? true)
  const [showMeta, setShowMeta] = useState(true)
  const [showNotes, setShowNotes] = useState(() => Boolean(description && description.trim()))

  const [statsDataset, setStatsDataset] = useState<CharacterStatsDataset | null>(null)
  const [allWeapons, setAllWeapons] = useState<WeaponSummary[]>([])
  const [allArtifacts, setAllArtifacts] = useState<ArtifactSetSummary[]>([])
  const [assetsReady, setAssetsReady] = useState(false)

  const [downloading, setDownloading] = useState(false)
  const [copyState, setCopyState] = useState<'idle' | 'copying' | 'copied' | 'unsupported'>('idle')

  // Carrega catálogos para resolver armas, sets e stats reais de todos os 4 membros
  useEffect(() => {
    let active = true
    Promise.all([
      loadCharacterStatsDataset(),
      api.listWeapons(lang, { limit: 350 }).then((r) => r.items).catch(() => [] as WeaponSummary[]),
      api.listArtifacts(lang, { limit: 200 }).then((r) => r.items).catch(() => [] as ArtifactSetSummary[]),
    ]).then(([ds, wList, aList]) => {
      if (!active) return
      setStatsDataset(ds)
      setAllWeapons(wList)
      setAllArtifacts(aList)
      setAssetsReady(true)
    })
    return () => {
      active = false
    }
  }, [lang])

  // Fecha no ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Salva preferências leves compartilhadas com o Build Card individual
  useEffect(() => {
    saveCardPrefs({ ...initialPrefs, nickname, uid, showUid })
  }, [nickname, uid, showUid, initialPrefs])

  const weaponsLookup = useMemo(() => {
    const map = new Map<string, WeaponSummary>(initialWeapons ?? [])
    for (const w of allWeapons) {
      map.set(w.slug, w)
    }
    return map
  }, [initialWeapons, allWeapons])

  const artifactsLookup = useMemo(() => {
    const map = new Map<string, ArtifactSetSummary>(initialArtifacts ?? [])
    for (const a of allArtifacts) {
      map.set(a.slug, a)
    }
    return map
  }, [initialArtifacts, allArtifacts])

  const normWeaponLookup = useMemo(
    () => buildWeaponLookup(Array.from(weaponsLookup.values())),
    [weaponsLookup],
  )
  const normArtifactLookup = useMemo(
    () => buildArtifactSetLookup(Array.from(artifactsLookup.values())),
    [artifactsLookup],
  )

  const enrichedMembers: TeamCardMemberInput[] = useMemo(() => {
    return members.slice(0, 4).map((m) => {
      let accountStats: ComputedCharStats | null = null
      const gs = roster.getGoodState(m.character.slug)
      if (gs && statsDataset) {
        accountStats = computeCharacterBuildStats({
          slug: m.character.slug,
          element: m.character.element,
          goodState: gs,
          statsDataset,
          weaponLookup: normWeaponLookup,
          artifactSetLookup: normArtifactLookup,
        })
      }
      return {
        position: m.position,
        character: m.character,
        role: m.role,
        guideBuild: m.guideBuild,
        accountStats,
      }
    })
  }, [members, roster, statsDataset, normWeaponLookup, normArtifactLookup])

  const cardData: TeamCardData = useMemo(
    () => ({
      name: teamName,
      description,
      archetypeLabel,
      tier,
      synergyScore,
      reactions,
      members: enrichedMembers,
      weaponsLookup,
      artifactsLookup,
    }),
    [
      teamName,
      description,
      archetypeLabel,
      tier,
      synergyScore,
      reactions,
      enrichedMembers,
      weaponsLookup,
      artifactsLookup,
    ],
  )

  const cardOptions: TeamCardOptions = useMemo(
    () => ({
      layout,
      sourceMode,
      theme,
      customTitle,
      customNotes,
      nickname,
      uid,
      showUid,
      showMeta,
      showNotes,
    }),
    [layout, sourceMode, theme, customTitle, customNotes, nickname, uid, showUid, showMeta, showNotes],
  )

  // Re-renderiza o preview HD ao vivo
  useEffect(() => {
    let cancelled = false
    const canvas = canvasRef.current
    if (!canvas || !assetsReady) return
    const timer = window.setTimeout(() => {
      if (cancelled || !canvasRef.current) return
      renderTeamCardToCanvas(canvasRef.current, cardData, cardOptions, 1).catch(() => {})
    }, 20)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [cardData, cardOptions, assetsReady])

  const handleDownload = async () => {
    setDownloading(true)
    try {
      await downloadTeamCardPng(cardData, cardOptions)
    } finally {
      setDownloading(false)
    }
  }

  const handleCopy = async () => {
    setCopyState('copying')
    const res = await copyTeamCardToClipboard(cardData, cardOptions)
    setCopyState(res)
    if (res === 'copied') {
      window.setTimeout(() => setCopyState('idle'), 2600)
    }
  }

  return (
    <div className="bcs-overlay" onClick={onClose}>
      <div className="bcs-modal tcs-modal" onClick={(e) => e.stopPropagation()}>
        <div className="bcs-header">
          <div className="bcs-title-group">
            <Sparkles size={18} className="bcs-title-icon" />
            <div>
              <h2>Estúdio de Card do Time (HD)</h2>
              <p>
                Compartilhe o time completo com as builds dos 4 personagens em alta definição (2x Retina)
              </p>
            </div>
          </div>
          <button type="button" className="bcs-close" onClick={onClose} aria-label="Fechar">
            <X size={20} />
          </button>
        </div>

        <div className="bcs-content tcs-content">
          {/* Preview ao vivo */}
          <div className="bcs-preview-wrap tcs-preview-wrap">
            {!assetsReady && (
              <div className="tcs-loading-banner">Carregando dados e ícones do time...</div>
            )}
            <canvas
              ref={canvasRef}
              className={`bcs-canvas tcs-canvas ${layout === 'grid2x2' ? 'is-grid' : ''}`}
            />
            <div className="bcs-preview-hint">
              <span>
                Dica: clique em <strong>Copiar Imagem</strong> e dê <strong>Ctrl+V</strong> direto no Discord ou WhatsApp!
              </span>
            </div>
          </div>

          {/* Painel de personalização */}
          <div className="bcs-controls">
            {/* Fonte das Builds */}
            <div className="bcs-section">
              <div className="bcs-section-title">Fonte das Builds</div>
              <div className="tcs-segmented">
                <button
                  type="button"
                  className={`tcs-seg-btn ${sourceMode === 'account' ? 'is-active' : ''}`}
                  onClick={() => setSourceMode('account')}
                >
                  <UserCheck size={14} />
                  <span>Minha Conta ({importedCount}/{members.length})</span>
                </button>
                <button
                  type="button"
                  className={`tcs-seg-btn ${sourceMode === 'guide' ? 'is-active' : ''}`}
                  onClick={() => setSourceMode('guide')}
                >
                  <BookOpen size={14} />
                  <span>Build do Time</span>
                </button>
              </div>
              {sourceMode === 'account' && importedCount < members.length && (
                <p className="tcs-helper-note">
                  Personagens sem build importada no Roster usam automaticamente a Build do Time como fallback.
                </p>
              )}
            </div>

            {/* Layout */}
            <div className="bcs-section">
              <div className="bcs-section-title">Formato da Imagem</div>
              <div className="tcs-segmented">
                <button
                  type="button"
                  className={`tcs-seg-btn ${layout === 'wide' ? 'is-active' : ''}`}
                  onClick={() => setLayout('wide')}
                >
                  <Columns4 size={14} />
                  <span>4 Colunas (PC/Discord)</span>
                </button>
                <button
                  type="button"
                  className={`tcs-seg-btn ${layout === 'grid2x2' ? 'is-active' : ''}`}
                  onClick={() => setLayout('grid2x2')}
                >
                  <LayoutGrid size={14} />
                  <span>Grade 2×2 (Celular)</span>
                </button>
              </div>
            </div>

            {/* Tema */}
            <div className="bcs-section">
              <div className="bcs-section-title">Tema Visual</div>
              <div className="bcs-theme-pills">
                {THEME_OPTIONS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`bcs-theme-pill ${theme === t.id ? 'is-active' : ''}`}
                    onClick={() => setTheme(t.id)}
                  >
                    <span className="bcs-theme-dot" style={{ background: t.color }} />
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Texto do Pôster */}
            <div className="bcs-section">
              <div className="bcs-section-title">Título & Rotação</div>
              <div className="bcs-field-grid">
                <label className="bcs-field tcs-field-full">
                  <span>Título do Time</span>
                  <input
                    type="text"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder="Ex.: Skirk Freeze Premium"
                    maxLength={60}
                  />
                </label>
                <label className="bcs-field tcs-field-full">
                  <span>Rotação / Nota (rodapé)</span>
                  <input
                    type="text"
                    value={customNotes}
                    onChange={(e) => {
                      setCustomNotes(e.target.value)
                      if (e.target.value.trim() && !showNotes) setShowNotes(true)
                    }}
                    placeholder="Ex.: Furina EQ > Escoffier EQ > Shenhe EQ > Skirk Combo"
                    maxLength={140}
                  />
                </label>
              </div>
            </div>

            {/* Assinatura & Exibição */}
            <div className="bcs-section">
              <div className="bcs-section-title">Assinatura & Detalhes</div>
              <div className="bcs-field-grid">
                <label className="bcs-field">
                  <span>Nickname</span>
                  <input
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="Seu apelido"
                    maxLength={24}
                  />
                </label>
                <label className="bcs-field">
                  <span>UID</span>
                  <input
                    type="text"
                    value={uid}
                    onChange={(e) => setUid(e.target.value)}
                    placeholder="600000000"
                    maxLength={12}
                  />
                </label>
              </div>
              <div className="bcs-toggles">
                <label className="bcs-check">
                  <input
                    type="checkbox"
                    checked={showUid}
                    onChange={(e) => setShowUid(e.target.checked)}
                  />
                  <span>Mostrar UID no card</span>
                </label>
                <label className="bcs-check">
                  <input
                    type="checkbox"
                    checked={showMeta}
                    onChange={(e) => setShowMeta(e.target.checked)}
                  />
                  <span>Mostrar Tier, Sinergia e Reações</span>
                </label>
                <label className="bcs-check">
                  <input
                    type="checkbox"
                    checked={showNotes}
                    onChange={(e) => setShowNotes(e.target.checked)}
                  />
                  <span>Mostrar barra de Rotação / Notas</span>
                </label>
              </div>
            </div>

            {/* Ações */}
            <div className="bcs-actions">
              <button
                type="button"
                className="bcs-btn-copy"
                onClick={handleCopy}
                disabled={copyState === 'copying' || !assetsReady}
              >
                {copyState === 'copied' ? <Check size={15} /> : <Copy size={15} />}
                <span>
                  {copyState === 'copying'
                    ? 'Copiando...'
                    : copyState === 'copied'
                      ? 'Copiado!'
                      : copyState === 'unsupported'
                        ? 'Use Baixar PNG'
                        : 'Copiar Imagem'}
                </span>
              </button>
              <button
                type="button"
                className="bcs-btn-download"
                onClick={handleDownload}
                disabled={downloading || !assetsReady}
              >
                <Download size={15} />
                <span>{downloading ? 'Gerando PNG...' : 'Baixar PNG HD'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
