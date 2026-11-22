import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Check,
  Copy,
  Download,
  ImagePlus,
  Move,
  RotateCcw,
  Sparkles,
  Upload,
  X,
} from 'lucide-react'
import { api } from '../api/client'
import { useLanguage } from '../context/LanguageContext'
import { getSavedEnkaUid } from '../utils/planner-storage'
import type { ComputedCharStats } from '../utils/char-stats-calc'
import {
  BUILD_CARD_THEMES,
  CARD_HEIGHT,
  CARD_WIDTH,
  clearCustomArt,
  copyBuildCardToClipboard,
  downloadBuildCardPng,
  loadCardPrefs,
  loadSavedCustomArt,
  processUploadedCharacterImage,
  renderBuildCardToCanvas,
  saveCardPrefs,
  type BuildCardOptions,
  type BuildCardTheme,
} from '../utils/build-card-png'
import type { CharacterSummary } from '../types'

interface BuildCardStudioModalProps {
  character: CharacterSummary
  stats: ComputedCharStats
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

export default function BuildCardStudioModal({
  character,
  stats,
  onClose,
}: BuildCardStudioModalProps) {
  const { lang } = useLanguage()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const initialPrefs = useMemo(() => loadCardPrefs(), [])
  const [customImageUrl, setCustomImageUrl] = useState<string | null>(() =>
    loadSavedCustomArt(character.slug),
  )
  const [imageScale, setImageScale] = useState(1.0)
  const [imageOffsetX, setImageOffsetX] = useState(0)
  const [imageOffsetY, setImageOffsetY] = useState(0)
  const [imageDim, setImageDim] = useState(0.12)
  const [theme, setTheme] = useState<BuildCardTheme>('auto')
  const [nickname, setNickname] = useState(() => initialPrefs.nickname ?? '')
  const [uid, setUid] = useState(() => initialPrefs.uid ?? getSavedEnkaUid())
  const [showUid, setShowUid] = useState(() => initialPrefs.showUid ?? true)
  const [showRollDots, setShowRollDots] = useState(() => initialPrefs.showRollDots ?? true)

  const [talentIcons, setTalentIcons] = useState<BuildCardOptions['talentIcons']>({})
  const [constellationIcons, setConstellationIcons] = useState<(string | null)[]>([])

  const [isDraggingFile, setIsDraggingFile] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [copyState, setCopyState] = useState<'idle' | 'copying' | 'copied' | 'unsupported'>('idle')

  // Estado de arraste direto no preview para reposicionar a arte do personagem
  const panStateRef = useRef<{
    active: boolean
    startX: number
    startY: number
    origOffX: number
    origOffY: number
  }>({ active: false, startX: 0, startY: 0, origOffX: 0, origOffY: 0 })

  // Carrega ícones reais de talentos e constelações do personagem
  useEffect(() => {
    let active = true
    api
      .getCharacter(character.slug, lang)
      .then((detail) => {
        if (!active) return
        const na = detail.talents?.find((t) => t.talent_type === 'normal_attack')?.icon ?? null
        const es = detail.talents?.find((t) => t.talent_type === 'elemental_skill')?.icon ?? null
        const eb = detail.talents?.find((t) => t.talent_type === 'elemental_burst')?.icon ?? null
        setTalentIcons({ na, es, eb })
        const sortedCons = [...(detail.constellations ?? [])]
          .sort((a, b) => a.level - b.level)
          .slice(0, 6)
          .map((c) => c.icon ?? null)
        setConstellationIcons(sortedCons)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [character.slug, lang])

  // Fecha no ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Persiste preferências leves (nick/uid/toggles)
  useEffect(() => {
    saveCardPrefs({ nickname, uid, showUid, showRollDots })
  }, [nickname, uid, showUid, showRollDots])

  const cardOptions: BuildCardOptions = useMemo(
    () => ({
      customImageUrl,
      imageScale,
      imageOffsetX,
      imageOffsetY,
      imageDim,
      theme,
      nickname,
      uid,
      showUid,
      showRollDots,
      talentIcons,
      constellationIcons,
    }),
    [
      customImageUrl,
      imageScale,
      imageOffsetX,
      imageOffsetY,
      imageDim,
      theme,
      nickname,
      uid,
      showUid,
      showRollDots,
      talentIcons,
      constellationIcons,
    ],
  )

  // Re-renderiza o preview ao vivo sempre que alguma opção mudar
  useEffect(() => {
    let cancelled = false
    const canvas = canvasRef.current
    if (!canvas) return
    const timer = window.setTimeout(() => {
      if (cancelled || !canvasRef.current) return
      renderBuildCardToCanvas(canvasRef.current, character, stats, cardOptions).catch(() => {})
    }, 16)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [character, stats, cardOptions])

  const handleImageFile = async (file: File | null | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setUploadError('Envie um arquivo de imagem válido (PNG, JPG, WebP ou GIF).')
      return
    }
    setUploadError(null)
    try {
      const dataUrl = await processUploadedCharacterImage(file, character.slug)
      setCustomImageUrl(dataUrl)
      setImageScale(1.0)
      setImageOffsetX(0)
      setImageOffsetY(0)
    } catch {
      setUploadError('Não foi possível carregar essa imagem.')
    }
  }

  const handleResetDefaultArt = () => {
    clearCustomArt(character.slug)
    setCustomImageUrl(null)
    setImageScale(1.0)
    setImageOffsetX(0)
    setImageOffsetY(0)
    setImageDim(0.12)
    setUploadError(null)
  }

  const handleDownload = async () => {
    setDownloading(true)
    try {
      await downloadBuildCardPng(character, stats, cardOptions)
    } finally {
      setDownloading(false)
    }
  }

  const handleCopy = async () => {
    setCopyState('copying')
    const ok = await copyBuildCardToClipboard(character, stats, cardOptions)
    if (ok) {
      setCopyState('copied')
      setTimeout(() => setCopyState('idle'), 2200)
    } else {
      setCopyState('unsupported')
      setTimeout(() => setCopyState('idle'), 3000)
    }
  }

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    panStateRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      origOffX: imageOffsetX,
      origOffY: imageOffsetY,
    }
  }

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!panStateRef.current.active) return
    const dx = e.clientX - panStateRef.current.startX
    const dy = e.clientY - panStateRef.current.startY
    const nextX = Math.max(-100, Math.min(100, Math.round(panStateRef.current.origOffX + dx * 0.45)))
    const nextY = Math.max(-100, Math.min(100, Math.round(panStateRef.current.origOffY + dy * 0.45)))
    setImageOffsetX(nextX)
    setImageOffsetY(nextY)
  }

  const handleCanvasPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (panStateRef.current.active) {
      panStateRef.current.active = false
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        // ignore
      }
    }
  }

  return (
    <div
      className="bcs-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Compartilhar Build de ${character.name}`}
    >
      <div className="bcs-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="bcs-header">
          <div className="bcs-title-group">
            <Sparkles size={18} className="bcs-title-icon" />
            <div>
              <h2>Estúdio de Card — {character.name}</h2>
              <p>
                Card HD ({CARD_WIDTH}×{CARD_HEIGHT}) pronto para Discord, Twitter e WhatsApp · Arraste a imagem para enquadrar
              </p>
            </div>
          </div>
          <button type="button" className="cam-close-btn" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        {/* Preview + Controles */}
        <div className="bcs-content">
          {/* Preview interativo com Drag & Drop de arquivo */}
          <div
            className={`bcs-preview-wrap ${isDraggingFile ? 'is-drop-active' : ''}`}
            onDragOver={(e) => {
              e.preventDefault()
              setIsDraggingFile(true)
            }}
            onDragLeave={() => setIsDraggingFile(false)}
            onDrop={(e) => {
              e.preventDefault()
              setIsDraggingFile(false)
              handleImageFile(e.dataTransfer.files?.[0])
            }}
          >
            <canvas
              ref={canvasRef}
              width={CARD_WIDTH}
              height={CARD_HEIGHT}
              className="bcs-canvas"
              onPointerDown={handleCanvasPointerDown}
              onPointerMove={handleCanvasPointerMove}
              onPointerUp={handleCanvasPointerUp}
              onPointerCancel={handleCanvasPointerUp}
              title="Arraste para mover a imagem do personagem ou solte um arquivo de imagem aqui"
            />
            <div className="bcs-preview-hint">
              <Move size={12} /> Arraste no card para mover a arte · Ou solte uma imagem (.png / .jpg / .webp) aqui
            </div>
          </div>

          {/* Painel de customização */}
          <div className="bcs-controls">
            {/* 1. Imagem do Personagem */}
            <div className="bcs-section">
              <div className="bcs-section-title">
                <ImagePlus size={14} /> Arte do Personagem
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                  handleImageFile(e.target.files?.[0])
                  e.target.value = ''
                }}
              />

              <div className="bcs-art-actions">
                <button
                  type="button"
                  className="btn-primary bcs-upload-btn"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload size={14} />
                  {customImageUrl ? 'Trocar imagem do PC' : 'Enviar imagem do PC'}
                </button>
                {customImageUrl && (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleResetDefaultArt}
                    title="Voltar para a Splash Art padrão do personagem"
                  >
                    <RotateCcw size={13} /> Splash Art padrão
                  </button>
                )}
              </div>

              {uploadError && <div className="bcs-error">{uploadError}</div>}

              <div className="bcs-sliders">
                <label className="bcs-slider-row">
                  <span>
                    Zoom <strong>{Math.round(imageScale * 100)}%</strong>
                  </span>
                  <input
                    type="range"
                    min={0.6}
                    max={2.4}
                    step={0.05}
                    value={imageScale}
                    onChange={(e) => setImageScale(Number(e.target.value))}
                  />
                </label>

                <label className="bcs-slider-row">
                  <span>
                    Posição X <strong>{imageOffsetX}</strong>
                  </span>
                  <input
                    type="range"
                    min={-100}
                    max={100}
                    step={1}
                    value={imageOffsetX}
                    onChange={(e) => setImageOffsetX(Number(e.target.value))}
                  />
                </label>

                <label className="bcs-slider-row">
                  <span>
                    Posição Y <strong>{imageOffsetY}</strong>
                  </span>
                  <input
                    type="range"
                    min={-100}
                    max={100}
                    step={1}
                    value={imageOffsetY}
                    onChange={(e) => setImageOffsetY(Number(e.target.value))}
                  />
                </label>

                <label className="bcs-slider-row">
                  <span>
                    Escurecer arte <strong>{Math.round(imageDim * 100)}%</strong>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={0.6}
                    step={0.02}
                    value={imageDim}
                    onChange={(e) => setImageDim(Number(e.target.value))}
                  />
                </label>
              </div>

              {(imageScale !== 1 || imageOffsetX !== 0 || imageOffsetY !== 0 || imageDim !== 0.12) && (
                <button
                  type="button"
                  className="bcs-link-btn"
                  onClick={() => {
                    setImageScale(1.0)
                    setImageOffsetX(0)
                    setImageOffsetY(0)
                    setImageDim(0.12)
                  }}
                >
                  <RotateCcw size={12} /> Centralizar enquadramento
                </button>
              )}
            </div>

            {/* 2. Tema visual */}
            <div className="bcs-section">
              <div className="bcs-section-title">Paleta de Cores</div>
              <div className="bcs-theme-pills">
                {THEME_OPTIONS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`bcs-theme-pill ${theme === t.id ? 'is-active' : ''}`}
                    onClick={() => setTheme(t.id)}
                    title={t.label}
                  >
                    <span className="bcs-theme-dot" style={{ background: t.color }} />
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Assinatura / Opções */}
            <div className="bcs-section">
              <div className="bcs-section-title">Assinatura & Detalhes</div>
              <div className="bcs-inputs-row">
                <input
                  type="text"
                  placeholder="Seu nick (opcional)"
                  value={nickname}
                  maxLength={28}
                  onChange={(e) => setNickname(e.target.value)}
                />
                <input
                  type="text"
                  placeholder="UID (opcional)"
                  value={uid}
                  maxLength={14}
                  onChange={(e) => setUid(e.target.value)}
                />
              </div>
              <div className="bcs-toggles">
                <label>
                  <input
                    type="checkbox"
                    checked={showUid}
                    onChange={(e) => setShowUid(e.target.checked)}
                  />
                  Mostrar Nick / UID no card
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={showRollDots}
                    onChange={(e) => setShowRollDots(e.target.checked)}
                  />
                  Mostrar pontos de rolls nos substats (•)
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Rodapé de exportação */}
        <div className="bcs-footer">
          <div className="bcs-footer-note">
            {copyState === 'unsupported'
              ? 'Seu navegador bloqueou cópia direta em HTTP — use "Baixar PNG"!'
              : 'Dica: sua arte customizada fica salva automaticamente para este personagem.'}
          </div>
          <div className="bcs-footer-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={handleCopy}
              disabled={copyState === 'copying'}
            >
              {copyState === 'copied' ? <Check size={14} /> : <Copy size={14} />}
              {copyState === 'copied'
                ? 'Imagem copiada!'
                : copyState === 'copying'
                  ? 'Copiando...'
                  : 'Copiar Imagem'}
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={handleDownload}
              disabled={downloading}
            >
              <Download size={14} />
              {downloading ? 'Gerando PNG...' : 'Baixar PNG (HD)'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
