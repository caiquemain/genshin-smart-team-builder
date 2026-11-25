import { artifactPieceIconUrl, iconUrl } from '../config'
import {
  formatCanonicalStatValue,
  STAT_SHORT_LABEL_PT,
  type ComputedCharStats,
} from './char-stats-calc'
import type { CharacterSummary } from '../types'

type ComputedPiece = ComputedCharStats['pieces'][number]

export type BuildCardTheme =
  | 'auto'
  | 'pyro'
  | 'hydro'
  | 'cryo'
  | 'electro'
  | 'anemo'
  | 'geo'
  | 'dendro'
  | 'astral'
  | 'gold'

export interface BuildCardOptions {
  customImageUrl?: string | null
  imageScale?: number
  imageOffsetX?: number
  imageOffsetY?: number
  imageDim?: number
  theme?: BuildCardTheme
  nickname?: string
  uid?: string
  showUid?: boolean
  showRollDots?: boolean
  talentIcons?: { na?: string | null; es?: string | null; eb?: string | null }
  constellationIcons?: (string | null)[]
}

export interface ThemePalette {
  bgDeep: string
  bgMid: string
  bgEdge: string
  accent: string
  accentSoft: string
  glow: string
  label: string
}

export const BUILD_CARD_THEMES: Record<Exclude<BuildCardTheme, 'auto'>, ThemePalette> = {
  pyro: {
    bgDeep: '#1a0b0c',
    bgMid: '#2c1112',
    bgEdge: '#0b0d16',
    accent: '#fb923c',
    accentSoft: '#fdba74',
    glow: 'rgba(251, 146, 60, 0.34)',
    label: 'Pyro',
  },
  hydro: {
    bgDeep: '#071426',
    bgMid: '#0d2645',
    bgEdge: '#080e1a',
    accent: '#38bdf8',
    accentSoft: '#7dd3fc',
    glow: 'rgba(56, 189, 248, 0.32)',
    label: 'Hydro',
  },
  cryo: {
    bgDeep: '#081a24',
    bgMid: '#103142',
    bgEdge: '#080f1a',
    accent: '#67e8f9',
    accentSoft: '#a5f3fc',
    glow: 'rgba(103, 232, 249, 0.30)',
    label: 'Cryo',
  },
  electro: {
    bgDeep: '#150c26',
    bgMid: '#261447',
    bgEdge: '#0b0a18',
    accent: '#c084fc',
    accentSoft: '#e9d5ff',
    glow: 'rgba(192, 132, 252, 0.32)',
    label: 'Electro',
  },
  anemo: {
    bgDeep: '#071d1b',
    bgMid: '#0f3530',
    bgEdge: '#081016',
    accent: '#34d399',
    accentSoft: '#6ee7b7',
    glow: 'rgba(52, 211, 153, 0.30)',
    label: 'Anemo',
  },
  geo: {
    bgDeep: '#1c1508',
    bgMid: '#30230c',
    bgEdge: '#0d0d14',
    accent: '#fbbf24',
    accentSoft: '#fde68a',
    glow: 'rgba(251, 191, 36, 0.32)',
    label: 'Geo',
  },
  dendro: {
    bgDeep: '#0e1d0b',
    bgMid: '#1b3412',
    bgEdge: '#090f12',
    accent: '#a3e635',
    accentSoft: '#d9f99d',
    glow: 'rgba(163, 230, 53, 0.28)',
    label: 'Dendro',
  },
  astral: {
    bgDeep: '#0c1026',
    bgMid: '#1b1d45',
    bgEdge: '#070914',
    accent: '#818cf8',
    accentSoft: '#c7d2fe',
    glow: 'rgba(129, 140, 248, 0.34)',
    label: 'Astral',
  },
  gold: {
    bgDeep: '#17120c',
    bgMid: '#2b2114',
    bgEdge: '#0b0b12',
    accent: '#f59e0b',
    accentSoft: '#fef08a',
    glow: 'rgba(245, 158, 11, 0.34)',
    label: 'Ouro',
  },
}

export const CARD_WIDTH = 1560
export const CARD_HEIGHT = 780

const CUSTOM_ART_PREFIX = 'gsb.buildCard.customArt.'
const CARD_PREFS_KEY = 'gsb.buildCard.prefs.v1'

export interface SavedCardPrefs {
  nickname?: string
  uid?: string
  showUid?: boolean
  showRollDots?: boolean
}

export function loadCardPrefs(): SavedCardPrefs {
  try {
    const raw = localStorage.getItem(CARD_PREFS_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as SavedCardPrefs
  } catch {
    return {}
  }
}

export function saveCardPrefs(prefs: SavedCardPrefs): void {
  try {
    localStorage.setItem(CARD_PREFS_KEY, JSON.stringify(prefs))
  } catch {
    // ignore storage quota errors
  }
}

export function loadSavedCustomArt(slug: string): string | null {
  try {
    return localStorage.getItem(`${CUSTOM_ART_PREFIX}${slug}`)
  } catch {
    return null
  }
}

export function clearCustomArt(slug: string): void {
  try {
    localStorage.removeItem(`${CUSTOM_ART_PREFIX}${slug}`)
  } catch {
    // ignore
  }
}

/**
 * Converte um arquivo enviado do computador para Data URL otimizada e tenta persistir
 * localmente por personagem (sem estourar localStorage).
 */
export async function processUploadedCharacterImage(file: File, slug: string): Promise<string> {
  const rawUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Falha ao ler arquivo de imagem'))
    reader.readAsDataURL(file)
  })

  // Redimensiona apenas se for muito grande (> 1600px) para manter nitidez HD e leveza
  const img = await loadImageSafe(rawUrl)
  if (!img) return rawUrl

  const maxSide = 1600
  const ratio = Math.min(1, maxSide / Math.max(img.naturalWidth || 1, img.naturalHeight || 1))
  const w = Math.max(1, Math.round(img.naturalWidth * ratio))
  const h = Math.max(1, Math.round(img.naturalHeight * ratio))

  const tmp = document.createElement('canvas')
  tmp.width = w
  tmp.height = h
  const tctx = tmp.getContext('2d')
  if (!tctx) return rawUrl
  tctx.drawImage(img, 0, 0, w, h)

  // Preserva transparência se for PNG/WebP, mas compacta para salvar no localStorage
  const optimized = tmp.toDataURL('image/webp', 0.9)
  const finalUrl = optimized.startsWith('data:image/webp') ? optimized : rawUrl

  try {
    // Evita lotar localStorage com arquivos enormes (> 900KB)
    if (finalUrl.length < 950_000) {
      localStorage.setItem(`${CUSTOM_ART_PREFIX}${slug}`, finalUrl)
    }
  } catch {
    // Se quota estourar, ainda usa na sessão atual normalmente
  }
  return finalUrl
}

// Cache leve em memória para evitar piscar imagens ao arrastar sliders no estúdio
const imageCache = new Map<string, HTMLImageElement | null>()

function loadImageSafe(src: string | null | undefined): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null)
  if (imageCache.has(src)) return Promise.resolve(imageCache.get(src) ?? null)
  return new Promise((resolve) => {
    const img = new Image()
    if (!src.startsWith('data:')) {
      img.crossOrigin = 'anonymous'
    }
    img.onload = () => {
      // Não acumula dezenas de data URLs gigantes no cache
      if (!src.startsWith('data:') || imageCache.size < 16) {
        imageCache.set(src, img)
      }
      resolve(img)
    }
    img.onerror = () => {
      if (!src.startsWith('data:')) imageCache.set(src, null)
      resolve(null)
    }
    img.src = src
  })
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

function truncateText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text
  let out = text
  while (out.length > 2 && ctx.measureText(`${out}…`).width > maxW) {
    out = out.slice(0, -1)
  }
  return `${out}…`
}

function resolvePalette(element: string, theme: BuildCardTheme = 'auto'): ThemePalette {
  if (theme !== 'auto' && BUILD_CARD_THEMES[theme]) {
    return BUILD_CARD_THEMES[theme]
  }
  const el = element.toLowerCase() as Exclude<BuildCardTheme, 'auto'>
  return BUILD_CARD_THEMES[el] ?? BUILD_CARD_THEMES.astral
}

function cvTierInfo(cv: number): { label: string; color: string; bg: string; border: string } {
  if (cv >= 220) {
    return {
      label: 'MÍTICO',
      color: '#fde047',
      bg: 'rgba(234, 179, 8, 0.22)',
      border: 'rgba(250, 204, 21, 0.72)',
    }
  }
  if (cv >= 190) {
    return {
      label: 'ELITE',
      color: '#fdba74',
      bg: 'rgba(249, 115, 22, 0.20)',
      border: 'rgba(251, 146, 60, 0.65)',
    }
  }
  if (cv >= 150) {
    return {
      label: 'ÓTIMO',
      color: '#d8b4fe',
      bg: 'rgba(168, 85, 247, 0.20)',
      border: 'rgba(192, 132, 252, 0.60)',
    }
  }
  if (cv >= 110) {
    return {
      label: 'BOM',
      color: '#7dd3fc',
      bg: 'rgba(56, 189, 248, 0.16)',
      border: 'rgba(56, 189, 248, 0.50)',
    }
  }
  return {
    label: 'EM EVOLUÇÃO',
    color: '#cbd5e1',
    bg: 'rgba(148, 163, 184, 0.14)',
    border: 'rgba(148, 163, 184, 0.38)',
  }
}

function pieceCvColor(cv: number): { text: string; bg: string; border: string } {
  if (cv >= 40) {
    return { text: '#fde047', bg: 'rgba(234, 179, 8, 0.22)', border: 'rgba(250, 204, 21, 0.65)' }
  }
  if (cv >= 30) {
    return { text: '#d8b4fe', bg: 'rgba(168, 85, 247, 0.22)', border: 'rgba(192, 132, 252, 0.58)' }
  }
  if (cv >= 20) {
    return { text: '#7dd3fc', bg: 'rgba(56, 189, 248, 0.18)', border: 'rgba(56, 189, 248, 0.48)' }
  }
  return { text: '#94a3b8', bg: 'rgba(148, 163, 184, 0.12)', border: 'rgba(148, 163, 184, 0.25)' }
}

/** Estima quantidade de rolls (1..6) de um substat 5★ para exibir pontinhos estilo Akasha. */
function estimateSubstatRolls(statKey: string | null, value: number): number {
  if (!statKey) return 1
  const avgRoll: Record<string, number> = {
    crit_rate: 3.3,
    crit_dmg: 6.6,
    atk_pct: 5.0,
    hp_pct: 5.0,
    def_pct: 6.2,
    er: 5.5,
    em: 19.8,
    atk_flat: 16.5,
    hp_flat: 254,
    def_flat: 19.7,
  }
  const avg = avgRoll[statKey]
  if (!avg || value <= 0) return 1
  return Math.max(1, Math.min(6, Math.round(value / avg)))
}

/** Desenha micro-ícones vetoriais limpos para cada atributo da tabela de stats. */
function drawStatVectorIcon(
  ctx: CanvasRenderingContext2D,
  kind: 'hp' | 'atk' | 'def' | 'em' | 'cr' | 'cd' | 'er' | 'elem',
  cx: number,
  cy: number,
  color: string,
) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = 1.8
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  switch (kind) {
    case 'hp': {
      // Coração estilizado
      ctx.beginPath()
      ctx.moveTo(cx, cy + 6.5)
      ctx.bezierCurveTo(cx - 8, cy + 1, cx - 8, cy - 6, cx - 3.5, cy - 6)
      ctx.bezierCurveTo(cx - 1, cy - 6, cx, cy - 3.8, cx, cy - 2.6)
      ctx.bezierCurveTo(cx, cy - 3.8, cx + 1, cy - 6, cx + 3.5, cy - 6)
      ctx.bezierCurveTo(cx + 8, cy - 6, cx + 8, cy + 1, cx, cy + 6.5)
      ctx.closePath()
      ctx.fill()
      break
    }
    case 'atk': {
      // Espada diagonal
      ctx.beginPath()
      ctx.moveTo(cx - 6, cy + 6)
      ctx.lineTo(cx + 6.5, cy - 6.5)
      ctx.moveTo(cx - 4.5, cy + 1.5)
      ctx.lineTo(cx - 1.5, cy + 4.5)
      ctx.moveTo(cx + 1.5, cy - 6.5)
      ctx.lineTo(cx + 6.5, cy - 6.5)
      ctx.lineTo(cx + 6.5, cy - 1.5)
      ctx.stroke()
      break
    }
    case 'def': {
      // Escudo
      ctx.beginPath()
      ctx.moveTo(cx, cy - 7)
      ctx.lineTo(cx + 6.5, cy - 4.5)
      ctx.lineTo(cx + 5.5, cy + 2)
      ctx.quadraticCurveTo(cx, cy + 7.5, cx, cy + 7.5)
      ctx.quadraticCurveTo(cx, cy + 7.5, cx - 5.5, cy + 2)
      ctx.lineTo(cx - 6.5, cy - 4.5)
      ctx.closePath()
      ctx.stroke()
      break
    }
    case 'em': {
      // Losango elemental com ponto central
      ctx.beginPath()
      ctx.moveTo(cx, cy - 7)
      ctx.lineTo(cx + 6.5, cy)
      ctx.lineTo(cx, cy + 7)
      ctx.lineTo(cx - 6.5, cy)
      ctx.closePath()
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(cx, cy, 2, 0, Math.PI * 2)
      ctx.fill()
      break
    }
    case 'cr': {
      // Mira / Estrela de Taxa Crítica
      ctx.beginPath()
      ctx.arc(cx, cy, 5.5, 0, Math.PI * 2)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(cx, cy - 8)
      ctx.lineTo(cx, cy + 8)
      ctx.moveTo(cx - 8, cy)
      ctx.lineTo(cx + 8, cy)
      ctx.stroke()
      break
    }
    case 'cd': {
      // Estrela 4 pontas (Dano Crítico)
      ctx.beginPath()
      ctx.moveTo(cx, cy - 8)
      ctx.lineTo(cx + 2.5, cy - 2.5)
      ctx.lineTo(cx + 8, cy)
      ctx.lineTo(cx + 2.5, cy + 2.5)
      ctx.lineTo(cx, cy + 8)
      ctx.lineTo(cx - 2.5, cy + 2.5)
      ctx.lineTo(cx - 8, cy)
      ctx.lineTo(cx - 2.5, cy - 2.5)
      ctx.closePath()
      ctx.fill()
      break
    }
    case 'er': {
      // Ampulheta / Recarga
      ctx.beginPath()
      ctx.moveTo(cx - 5, cy - 6.5)
      ctx.lineTo(cx + 5, cy - 6.5)
      ctx.lineTo(cx - 5, cy + 6.5)
      ctx.lineTo(cx + 5, cy + 6.5)
      ctx.closePath()
      ctx.stroke()
      break
    }
    case 'elem': {
      // Orbe elemental com anel
      ctx.beginPath()
      ctx.arc(cx, cy, 4.2, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(cx, cy, 7.2, 0, Math.PI * 2)
      ctx.stroke()
      break
    }
  }
  ctx.restore()
}

function drawPadlockIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  ctx.save()
  ctx.strokeStyle = 'rgba(226, 232, 240, 0.72)'
  ctx.fillStyle = 'rgba(226, 232, 240, 0.72)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.arc(cx, cy - 3, 3.5, Math.PI, 0)
  ctx.stroke()
  roundRect(ctx, cx - 5, cy - 2.5, 10, 7.5, 1.8)
  ctx.fill()
  ctx.restore()
}

/**
 * Renderiza o card de build HD (1560×780) estilo Enka.Network / Akasha.cv em um `<canvas>`.
 */
export async function renderBuildCardToCanvas(
  canvas: HTMLCanvasElement,
  character: CharacterSummary,
  stats: ComputedCharStats,
  options: BuildCardOptions = {},
): Promise<void> {
  const W = CARD_WIDTH
  const H = CARD_HEIGHT
  if (canvas.width !== W) canvas.width = W
  if (canvas.height !== H) canvas.height = H

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const palette = resolvePalette(String(character.element), options.theme ?? 'auto')
  const imgScale = options.imageScale ?? 1.0
  const imgOffX = options.imageOffsetX ?? 0
  const imgOffY = options.imageOffsetY ?? 0
  const imgDim = options.imageDim ?? 0.12
  const showRollDots = options.showRollDots ?? true

  // 1. Pré-carrega arte do personagem (custom > splash art local > avatar fallback) + ícones
  const defaultSplash = `/splash_arts/${character.slug}.webp?v=2`
  const primaryHeroSrc = options.customImageUrl || defaultSplash

  const FIXED_SLOTS: Array<'flower' | 'plume' | 'sands' | 'goblet' | 'circlet'> = [
    'flower',
    'plume',
    'sands',
    'goblet',
    'circlet',
  ]
  const slotPieces: Array<ComputedPiece | null> = FIXED_SLOTS.map(
    (sk) => stats.pieces.find((p) => p.slotKey === sk) ?? null,
  )

  const [
    heroPrimary,
    heroFallbackSplash,
    heroFallbackAvatar,
    weaponImg,
    talentNaImg,
    talentEsImg,
    talentEbImg,
    ...restImgs
  ] = await Promise.all([
    loadImageSafe(primaryHeroSrc),
    options.customImageUrl ? Promise.resolve(null) : Promise.resolve(null),
    loadImageSafe(iconUrl(character.icon)),
    loadImageSafe(stats.weapon ? iconUrl(stats.weapon.icon) : null),
    loadImageSafe(iconUrl(options.talentIcons?.na)),
    loadImageSafe(iconUrl(options.talentIcons?.es)),
    loadImageSafe(iconUrl(options.talentIcons?.eb)),
    ...slotPieces.map((p) => loadImageSafe(p ? artifactPieceIconUrl(p.setIcon, p.slotKey) : null)),
    ...(options.constellationIcons ?? Array(6).fill(null))
      .slice(0, 6)
      .map((ic) => loadImageSafe(iconUrl(ic))),
  ])

  const heroImg = heroPrimary || heroFallbackSplash || heroFallbackAvatar
  const isCustomArt = Boolean(options.customImageUrl && heroPrimary)
  const artImgs = restImgs.slice(0, 5)
  const consImgs = restImgs.slice(5, 11)

  // 2. Fundo atmosférico temático
  ctx.clearRect(0, 0, W, H)
  const bgGrad = ctx.createLinearGradient(0, 0, W, H)
  bgGrad.addColorStop(0, palette.bgMid)
  bgGrad.addColorStop(0.45, palette.bgDeep)
  bgGrad.addColorStop(1, palette.bgEdge)
  ctx.fillStyle = bgGrad
  ctx.fillRect(0, 0, W, H)

  // Reflexo ambiental suavizado da imagem do personagem no fundo inteiro (dá coesão à fanart!)
  if (heroImg) {
    ctx.save()
    ctx.globalAlpha = 0.14
    ctx.filter = 'blur(34px) saturate(1.25)'
    const coverScale = Math.max(W / heroImg.naturalWidth, H / heroImg.naturalHeight) * 1.15
    const bw = heroImg.naturalWidth * coverScale
    const bh = heroImg.naturalHeight * coverScale
    ctx.drawImage(heroImg, (W - bw) / 2, (H - bh) / 2, bw, bh)
    ctx.restore()
  }

  // Brilhos radiais elementais sutis
  const g1 = ctx.createRadialGradient(260, 220, 20, 260, 220, 540)
  g1.addColorStop(0, palette.glow)
  g1.addColorStop(1, 'transparent')
  ctx.fillStyle = g1
  ctx.fillRect(0, 0, W, H)

  const g2 = ctx.createRadialGradient(1320, 620, 10, 1320, 620, 520)
  g2.addColorStop(0, `${palette.accent}22`)
  g2.addColorStop(1, 'transparent')
  ctx.fillStyle = g2
  ctx.fillRect(0, 0, W, H)

  // Poeira estelar determinística sutil (estilo Nod-Krai / Enka)
  ctx.save()
  for (let i = 0; i < 42; i++) {
    const sx = ((i * 197 + 83) % (W - 60)) + 30
    const sy = ((i * 131 + 47) % (H - 60)) + 30
    const sr = i % 5 === 0 ? 1.8 : 1.0
    ctx.fillStyle = i % 3 === 0 ? `${palette.accentSoft}55` : 'rgba(255,255,255,0.22)'
    ctx.beginPath()
    ctx.arc(sx, sy, sr, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()

  // 3. COLUNA ESQUERDA — HERO CHARACTER SHOWCASE (x: 0 .. 520)
  const heroW = 540
  if (heroImg) {
    ctx.save()
    // Clip no cartão inteiro com bordas arredondadas
    roundRect(ctx, 0, 0, W, H, 24)
    ctx.clip()

    const iw = heroImg.naturalWidth || 1
    const ih = heroImg.naturalHeight || 1
    // Splash arts oficiais costumam ser paisagem (ex: 2048x1024), então o enquadramento padrão
    // ajusta pela altura para destacar o personagem inteiro no painel esquerdo.
    const baseScale = isCustomArt
      ? Math.max(heroW / iw, H / ih)
      : Math.max((heroW * 1.15) / iw, (H * 1.08) / ih)
    const drawW = iw * baseScale * imgScale
    const drawH = ih * baseScale * imgScale
    const drawX = (heroW - drawW) / 2 + (imgOffX / 100) * 320
    const drawY = (H - drawH) / 2 + (imgOffY / 100) * 280

    // Máscara de gradiente suave na borda direita da arte para fundir no fundo escuro
    const artCanvas = document.createElement('canvas')
    artCanvas.width = heroW + 120
    artCanvas.height = H
    const actx = artCanvas.getContext('2d')
    if (actx) {
      actx.drawImage(heroImg, drawX, drawY, drawW, drawH)
      // Fade horizontal suave à direita (x: 340 -> 640)
      actx.globalCompositeOperation = 'destination-in'
      const fadeR = actx.createLinearGradient(0, 0, heroW + 100, 0)
      fadeR.addColorStop(0, 'rgba(0,0,0,1)')
      fadeR.addColorStop(0.62, 'rgba(0,0,0,1)')
      fadeR.addColorStop(0.84, 'rgba(0,0,0,0.42)')
      fadeR.addColorStop(1, 'rgba(0,0,0,0)')
      actx.fillStyle = fadeR
      actx.fillRect(0, 0, heroW + 120, H)
      ctx.drawImage(artCanvas, 0, 0)
    }
    ctx.restore()
  }

  // Vinheta superior/inferior sobre a arte para garantir 100% de leitura do texto em qualquer fanart
  ctx.save()
  const topVignette = ctx.createLinearGradient(0, 0, 0, 210)
  topVignette.addColorStop(0, `rgba(7, 10, 20, ${0.72 + imgDim * 0.4})`)
  topVignette.addColorStop(1, 'rgba(7, 10, 20, 0)')
  ctx.fillStyle = topVignette
  ctx.fillRect(0, 0, 560, 210)

  const botVignette = ctx.createLinearGradient(0, H - 240, 0, H)
  botVignette.addColorStop(0, 'rgba(7, 10, 20, 0)')
  botVignette.addColorStop(1, `rgba(7, 10, 20, ${0.86 + imgDim * 0.2})`)
  ctx.fillStyle = botVignette
  ctx.fillRect(0, H - 240, 560, 240)

  if (imgDim > 0.01) {
    const dimGrad = ctx.createLinearGradient(0, 0, 540, 0)
    dimGrad.addColorStop(0, `rgba(6, 9, 18, ${imgDim})`)
    dimGrad.addColorStop(1, 'rgba(6, 9, 18, 0)')
    ctx.fillStyle = dimGrad
    ctx.fillRect(0, 0, 540, H)
  }
  ctx.restore()

  // Cabeçalho do personagem (topo esquerdo)
  ctx.save()
  ctx.shadowColor = 'rgba(0, 0, 0, 0.85)'
  ctx.shadowBlur = 14
  ctx.fillStyle = '#ffffff'
  ctx.font = '800 38px Inter, system-ui, -apple-system, sans-serif'
  ctx.fillText(truncateText(ctx, character.name, 420), 34, 68)
  ctx.restore()

  // Linha secundária: Estrelas + Nível + Elemento
  ctx.fillStyle = '#fbbf24'
  ctx.font = '700 17px Inter, system-ui, sans-serif'
  const starsTxt = '★'.repeat(character.rarity)
  ctx.fillText(starsTxt, 34, 98)

  const lvBadgeX = 34 + ctx.measureText(starsTxt).width + 14
  ctx.fillStyle = 'rgba(15, 23, 42, 0.78)'
  ctx.strokeStyle = `${palette.accent}88`
  ctx.lineWidth = 1.2
  roundRect(ctx, lvBadgeX, 79, 88, 25, 8)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#f8fafc'
  ctx.font = '700 13.5px Inter, system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(`Lv. ${stats.level}`, lvBadgeX + 44, 96)

  const elemTxt = String(character.element).toUpperCase()
  const elemBadgeX = lvBadgeX + 96
  ctx.fillStyle = `${palette.accent}28`
  ctx.strokeStyle = `${palette.accent}88`
  roundRect(ctx, elemBadgeX, 79, 84, 25, 8)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = palette.accentSoft
  ctx.font = '800 12px Inter, system-ui, sans-serif'
  ctx.fillText(elemTxt, elemBadgeX + 42, 96)
  ctx.textAlign = 'left'

  // 6 Medalhões de Constelação (faixa vertical esquerda)
  const consStartY = 144
  const consStep = 66
  for (let i = 0; i < 6; i++) {
    const unlocked = i < stats.cons
    const cx = 54
    const cy = consStartY + i * consStep
    const r = 24

    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fillStyle = unlocked ? 'rgba(15, 23, 42, 0.84)' : 'rgba(9, 13, 24, 0.64)'
    ctx.fill()
    if (unlocked) {
      ctx.shadowColor = palette.accent
      ctx.shadowBlur = 12
    }
    ctx.strokeStyle = unlocked ? palette.accent : 'rgba(148, 163, 184, 0.28)'
    ctx.lineWidth = unlocked ? 2.2 : 1.2
    ctx.stroke()
    ctx.restore()

    const cImg = consImgs[i]
    if (cImg) {
      ctx.save()
      ctx.beginPath()
      ctx.arc(cx, cy, r - 3, 0, Math.PI * 2)
      ctx.clip()
      ctx.globalAlpha = unlocked ? 1.0 : 0.28
      ctx.drawImage(cImg, cx - 19, cy - 19, 38, 38)
      ctx.restore()
    } else {
      ctx.fillStyle = unlocked ? palette.accentSoft : 'rgba(148, 163, 184, 0.45)'
      ctx.font = '800 13px Inter, system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(`C${i + 1}`, cx, cy + 5)
      ctx.textAlign = 'left'
    }

    if (!unlocked) {
      drawPadlockIcon(ctx, cx, cy + 1)
    }
  }

  // 3 Medalhões de Talentos (canto inferior esquerdo)
  const talentEntries = [
    { label: 'ATQ', lv: stats.talents.na, img: talentNaImg },
    { label: 'HAB', lv: stats.talents.es, img: talentEsImg },
    { label: 'SUP', lv: stats.talents.eb, img: talentEbImg },
  ]
  const talY = H - 108
  talentEntries.forEach((t, idx) => {
    const cx = 62 + idx * 84
    const crowned = t.lv >= 10

    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, talY, 27, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(10, 15, 28, 0.88)'
    ctx.fill()
    ctx.strokeStyle = crowned ? '#fbbf24' : `${palette.accent}aa`
    ctx.lineWidth = crowned ? 2.5 : 1.8
    ctx.stroke()
    ctx.restore()

    if (t.img) {
      ctx.save()
      ctx.beginPath()
      ctx.arc(cx, talY, 23, 0, Math.PI * 2)
      ctx.clip()
      ctx.drawImage(t.img, cx - 21, talY - 21, 42, 42)
      ctx.restore()
    } else {
      ctx.fillStyle = '#e2e8f0'
      ctx.font = '700 12px Inter, system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(t.label, cx, talY + 4)
      ctx.textAlign = 'left'
    }

    // Pill de nível abaixo do talento
    ctx.fillStyle = crowned ? '#b45309' : '#0f172a'
    ctx.strokeStyle = crowned ? '#fde047' : 'rgba(226, 232, 240, 0.4)'
    ctx.lineWidth = 1.4
    roundRect(ctx, cx - 18, talY + 18, 36, 22, 10)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = crowned ? '#fef9c3' : '#ffffff'
    ctx.font = '800 13px Inter, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(String(t.lv), cx, talY + 33)
    ctx.textAlign = 'left'
  })

  // Nickname / UID opcional no rodapé esquerdo
  if (options.showUid !== false && (options.nickname?.trim() || options.uid?.trim())) {
    const parts = [
      options.nickname?.trim(),
      options.uid?.trim() ? `UID ${options.uid.trim()}` : '',
    ].filter(Boolean)
    if (parts.length > 0) {
      const label = parts.join('  ·  ')
      ctx.font = '600 13px Inter, system-ui, sans-serif'
      const tw = Math.min(390, ctx.measureText(label).width + 26)
      ctx.fillStyle = 'rgba(9, 13, 24, 0.78)'
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.28)'
      ctx.lineWidth = 1
      roundRect(ctx, 34, H - 46, tw, 26, 8)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#cbd5e1'
      ctx.fillText(truncateText(ctx, label, 365), 47, H - 28)
    }
  }

  // 4. COLUNA CENTRAL — ARMA + TABELA DE STATS + SETS & CV (x: 496 .. 978)
  const midX = 496
  const midW = 482

  // 4.1 Card da Arma Equipada (y: 34 .. 176)
  const wY = 34
  const wH = 140
  ctx.fillStyle = 'rgba(10, 15, 28, 0.76)'
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.13)'
  ctx.lineWidth = 1.2
  roundRect(ctx, midX, wY, midW, wH, 16)
  ctx.fill()
  ctx.stroke()

  if (stats.weapon) {
    const wRarity = stats.weapon.rarity
    const wGrad = ctx.createLinearGradient(midX + 14, wY + 14, midX + 124, wY + 124)
    if (wRarity >= 5) {
      wGrad.addColorStop(0, '#784814')
      wGrad.addColorStop(1, '#c87f24')
    } else if (wRarity === 4) {
      wGrad.addColorStop(0, '#44286e')
      wGrad.addColorStop(1, '#7c48b8')
    } else {
      wGrad.addColorStop(0, '#1e3a5f')
      wGrad.addColorStop(1, '#3b6ea5')
    }
    ctx.fillStyle = wGrad
    roundRect(ctx, midX + 16, wY + 16, 108, 108, 14)
    ctx.fill()
    ctx.strokeStyle = wRarity >= 5 ? 'rgba(253, 224, 71, 0.55)' : 'rgba(192, 132, 252, 0.45)'
    ctx.lineWidth = 1.4
    ctx.stroke()

    if (weaponImg) {
      ctx.drawImage(weaponImg, midX + 20, wY + 20, 100, 100)
    }

    const wx = midX + 140
    ctx.fillStyle = '#ffffff'
    ctx.font = '800 19px Inter, system-ui, sans-serif'
    ctx.fillText(truncateText(ctx, stats.weapon.name, midW - 156), wx, wY + 42)

    ctx.fillStyle = '#fbbf24'
    ctx.font = '700 14px Inter, system-ui, sans-serif'
    const wStars = '★'.repeat(wRarity)
    ctx.fillText(wStars, wx, wY + 66)

    // Pills Lv. e R#
    const pLvX = wx + ctx.measureText(wStars).width + 12
    ctx.fillStyle = 'rgba(30, 41, 59, 0.9)'
    roundRect(ctx, pLvX, wY + 50, 62, 22, 6)
    ctx.fill()
    ctx.fillStyle = '#e2e8f0'
    ctx.font = '700 12.5px Inter, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(`Lv.${stats.weapon.level}`, pLvX + 31, wY + 65)

    const pRefX = pLvX + 68
    ctx.fillStyle = 'rgba(251, 191, 36, 0.18)'
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.55)'
    roundRect(ctx, pRefX, wY + 50, 38, 22, 6)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#fde68a'
    ctx.fillText(`R${stats.weapon.refinement}`, pRefX + 19, wY + 65)
    ctx.textAlign = 'left'

    // Pills ATQ Base e Substat da arma
    const pillY = wY + 88
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)'
    roundRect(ctx, wx, pillY, 134, 32, 8)
    ctx.fill()
    ctx.fillStyle = '#94a3b8'
    ctx.font = '600 11.5px Inter, system-ui, sans-serif'
    ctx.fillText('ATQ Base', wx + 10, pillY + 20)
    ctx.fillStyle = '#ffffff'
    ctx.font = '800 15px Inter, system-ui, sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(String(stats.weapon.baseAtk), wx + 124, pillY + 21)
    ctx.textAlign = 'left'

    if (stats.weapon.subKey && stats.weapon.subVal > 0) {
      const subX = wx + 144
      const subW = midW - (subX - midX) - 16
      ctx.fillStyle = `${palette.accent}1a`
      ctx.strokeStyle = `${palette.accent}44`
      ctx.lineWidth = 1
      roundRect(ctx, subX, pillY, subW, 32, 8)
      ctx.fill()
      ctx.stroke()

      ctx.fillStyle = palette.accentSoft
      ctx.font = '600 11.5px Inter, system-ui, sans-serif'
      ctx.fillText(
        truncateText(ctx, STAT_SHORT_LABEL_PT[stats.weapon.subKey] ?? stats.weapon.subKey, subW - 70),
        subX + 10,
        pillY + 20,
      )
      ctx.fillStyle = '#ffffff'
      ctx.font = '800 14.5px Inter, system-ui, sans-serif'
      ctx.textAlign = 'right'
      ctx.fillText(
        formatCanonicalStatValue(stats.weapon.subKey, stats.weapon.subVal),
        subX + subW - 10,
        pillY + 21,
      )
      ctx.textAlign = 'left'
    }
  } else {
    ctx.fillStyle = '#64748b'
    ctx.font = '600 15px Inter, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('Nenhuma arma equipada', midX + midW / 2, wY + wH / 2 + 5)
    ctx.textAlign = 'left'
  }

  // 4.2 Tabela Enka-style de Stats Calculados (y: 190 .. 586)
  const stY = 190
  const stH = 396
  ctx.fillStyle = 'rgba(10, 15, 28, 0.74)'
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.13)'
  ctx.lineWidth = 1.2
  roundRect(ctx, midX, stY, midW, stH, 16)
  ctx.fill()
  ctx.stroke()

  const primaryBonus =
    stats.physicalDmgBonus > stats.elemDmgBonus && stats.physicalDmgBonus >= 20
      ? { label: 'Bônus de Dano Físico', value: `${stats.physicalDmgBonus.toFixed(1)}%` }
      : stats.healingBonus > stats.elemDmgBonus && stats.healingBonus >= 15
        ? { label: 'Bônus de Cura', value: `${stats.healingBonus.toFixed(1)}%` }
        : {
            label: `Bônus de ${STAT_SHORT_LABEL_PT[stats.elemDmgKey] ?? 'Dano Elem.'}`,
            value: `${stats.elemDmgBonus.toFixed(1)}%`,
          }

  const statRows: Array<{
    kind: 'hp' | 'atk' | 'def' | 'em' | 'cr' | 'cd' | 'er' | 'elem'
    label: string
    value: string
    basePart?: string
    bonusPart?: string
    highlight?: 'crit' | 'elem'
  }> = [
    {
      kind: 'hp',
      label: 'Vida Máx.',
      value: stats.hasBaseData ? stats.totalHp.toLocaleString('pt-BR') : '—',
      basePart: stats.hasBaseData ? stats.baseHp.toLocaleString('pt-BR') : undefined,
      bonusPart: stats.hasBaseData ? `+${(stats.totalHp - stats.baseHp).toLocaleString('pt-BR')}` : undefined,
    },
    {
      kind: 'atk',
      label: 'ATQ',
      value: stats.hasBaseData ? stats.totalAtk.toLocaleString('pt-BR') : '—',
      basePart: stats.hasBaseData ? stats.baseAtk.toLocaleString('pt-BR') : undefined,
      bonusPart: stats.hasBaseData ? `+${(stats.totalAtk - stats.baseAtk).toLocaleString('pt-BR')}` : undefined,
    },
    {
      kind: 'def',
      label: 'DEF',
      value: stats.hasBaseData ? stats.totalDef.toLocaleString('pt-BR') : '—',
      basePart: stats.hasBaseData ? stats.baseDef.toLocaleString('pt-BR') : undefined,
      bonusPart: stats.hasBaseData ? `+${(stats.totalDef - stats.baseDef).toLocaleString('pt-BR')}` : undefined,
    },
    { kind: 'em', label: 'Proficiência Elemental', value: String(stats.em) },
    { kind: 'cr', label: 'Taxa Crítica', value: `${stats.critRate.toFixed(1)}%`, highlight: 'crit' },
    { kind: 'cd', label: 'Dano Crítico', value: `${stats.critDmg.toFixed(1)}%`, highlight: 'crit' },
    { kind: 'er', label: 'Recarga de Energia', value: `${stats.er.toFixed(1)}%` },
    { kind: 'elem', label: primaryBonus.label, value: primaryBonus.value, highlight: 'elem' },
  ]

  const rowH = 46
  statRows.forEach((row, idx) => {
    const ry = stY + 14 + idx * rowH
    if (idx % 2 === 1) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.035)'
      roundRect(ctx, midX + 10, ry, midW - 20, rowH - 2, 8)
      ctx.fill()
    }

    const iconColor =
      row.highlight === 'crit'
        ? '#fde047'
        : row.highlight === 'elem'
          ? palette.accent
          : '#94a3b8'
    drawStatVectorIcon(ctx, row.kind, midX + 34, ry + rowH / 2 - 1, iconColor)

    ctx.fillStyle = row.highlight === 'crit' ? '#fef3c7' : '#cbd5e1'
    ctx.font = '600 15.5px Inter, system-ui, sans-serif'
    ctx.fillText(row.label, midX + 56, ry + 28)

    ctx.fillStyle =
      row.highlight === 'crit'
        ? '#fde047'
        : row.highlight === 'elem'
          ? palette.accentSoft
          : '#ffffff'
    ctx.font = '800 19px Inter, system-ui, sans-serif'
    ctx.textAlign = 'right'
    const valX = midX + midW - 24
    ctx.fillText(row.value, valX, ry + 29)

    // Breakdown Enka-style: Base +Bonus à esquerda do total (Vida / ATQ / DEF)
    if (row.basePart && row.bonusPart) {
      const valW = ctx.measureText(row.value).width
      const bonusEndX = valX - valW - 14
      ctx.font = '700 12.5px Inter, system-ui, sans-serif'
      ctx.fillStyle = '#4ade80'
      ctx.fillText(row.bonusPart, bonusEndX, ry + 28)
      const bonusW = ctx.measureText(row.bonusPart).width
      ctx.font = '600 12.5px Inter, system-ui, sans-serif'
      ctx.fillStyle = '#94a3b8'
      ctx.fillText(row.basePart, bonusEndX - bonusW - 5, ry + 28)
    }
    ctx.textAlign = 'left'
  })

  // 4.3 Painel de Conjuntos Ativos + Crit Value & Proporção (y: 600 .. 744)
  const setY = 600
  const setH = 144
  ctx.fillStyle = 'rgba(10, 15, 28, 0.76)'
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.13)'
  ctx.lineWidth = 1.2
  roundRect(ctx, midX, setY, midW, setH, 16)
  ctx.fill()
  ctx.stroke()

  // Sets ativos (topo do card)
  ctx.fillStyle = '#94a3b8'
  ctx.font = '700 11px Inter, system-ui, sans-serif'
  ctx.fillText('CONJUNTOS ATIVOS', midX + 18, setY + 24)

  if (stats.activeSets.length > 0) {
    stats.activeSets.slice(0, 2).forEach((s, i) => {
      const sy = setY + 46 + i * 24
      ctx.fillStyle = '#4ade80'
      ctx.beginPath()
      ctx.arc(midX + 24, sy - 4, 4, 0, Math.PI * 2)
      ctx.fill()

      ctx.fillStyle = '#dcfce7'
      ctx.font = '700 14.5px Inter, system-ui, sans-serif'
      ctx.fillText(truncateText(ctx, `${s.pieces}pc  ${s.name}`, midW - 190), midX + 36, sy)
    })
  } else {
    ctx.fillStyle = '#64748b'
    ctx.font = '600 13.5px Inter, system-ui, sans-serif'
    ctx.fillText('Nenhum bônus de conjunto ativo', midX + 18, setY + 48)
  }

  // Badge CV grande à direita
  const cvInfo = cvTierInfo(stats.totalCritValue)
  const cvBoxX = midX + midW - 156
  const cvBoxY = setY + 18
  ctx.fillStyle = cvInfo.bg
  ctx.strokeStyle = cvInfo.border
  ctx.lineWidth = 1.5
  roundRect(ctx, cvBoxX, cvBoxY, 140, 74, 12)
  ctx.fill()
  ctx.stroke()

  ctx.textAlign = 'center'
  ctx.fillStyle = cvInfo.color
  ctx.font = '800 24px Inter, system-ui, sans-serif'
  ctx.fillText(`${stats.totalCritValue.toFixed(1)}`, cvBoxX + 70, cvBoxY + 34)
  ctx.font = '800 11px Inter, system-ui, sans-serif'
  ctx.fillText(`CV · ${cvInfo.label}`, cvBoxX + 70, cvBoxY + 56)
  ctx.textAlign = 'left'

  // Rodapé do painel central: Proporção Crítico + Marca d'água
  const ratio = stats.critRate > 0 ? stats.critDmg / stats.critRate : 0
  ctx.fillStyle = '#94a3b8'
  ctx.font = '600 12.5px Inter, system-ui, sans-serif'
  ctx.fillText(
    ratio > 0 ? `Proporção Crítico  1 : ${ratio.toFixed(2)}` : 'Proporção Crítico  —',
    midX + 18,
    setY + setH - 18,
  )
  ctx.fillStyle = 'rgba(148, 163, 184, 0.55)'
  ctx.textAlign = 'right'
  ctx.font = '600 11.5px Inter, system-ui, sans-serif'
  ctx.fillText('Genshin Smart Team Builder', midX + midW - 18, setY + setH - 18)
  ctx.textAlign = 'left'

  // 5. COLUNA DIREITA — OS 5 ARTEFATOS EM FAIXAS HORIZONTAIS ESTILO ENKA/AKASHA (x: 998 .. 1526)
  const artX = 998
  const artW = 528
  const stripH = 132
  const stripGap = 12
  const slotFallbacks = ['Flor', 'Pluma', 'Areia', 'Cálice', 'Tiara']

  for (let idx = 0; idx < 5; idx++) {
    const sy = 34 + idx * (stripH + stripGap)
    const piece: ComputedPiece | null = slotPieces[idx]

    // Fundo glass do strip
    ctx.fillStyle = 'rgba(10, 15, 28, 0.78)'
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.13)'
    ctx.lineWidth = 1.2
    roundRect(ctx, artX, sy, artW, stripH, 14)
    ctx.fill()
    ctx.stroke()

    if (!piece) {
      ctx.fillStyle = '#475569'
      ctx.font = '600 14px Inter, system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(`${slotFallbacks[idx]} — Sem artefato equipado`, artX + artW / 2, sy + stripH / 2 + 5)
      ctx.textAlign = 'left'
      continue
    }

    // Faixa de cor de raridade na lateral esquerda
    const barColor = piece.rarity >= 5 ? '#f59e0b' : piece.rarity === 4 ? '#a855f7' : '#38bdf8'
    ctx.save()
    roundRect(ctx, artX, sy, artW, stripH, 14)
    ctx.clip()

    ctx.fillStyle = barColor
    ctx.fillRect(artX, sy, 4, stripH)

    // Ícone do artefato integrado à esquerda com fade suave (assinatura visual do Enka!)
    const aImg = artImgs[idx]
    if (aImg) {
      ctx.save()
      ctx.globalAlpha = 0.92
      ctx.drawImage(aImg, artX + 10, sy + 14, 96, 96)
      const maskGrad = ctx.createLinearGradient(artX + 55, sy, artX + 122, sy)
      maskGrad.addColorStop(0, 'rgba(10, 15, 28, 0)')
      maskGrad.addColorStop(1, 'rgba(10, 15, 28, 0.95)')
      ctx.fillStyle = maskGrad
      ctx.fillRect(artX + 55, sy, 70, stripH)
      ctx.restore()
    }
    ctx.restore()

    // Estrelas + nível + slot no lado esquerdo
    ctx.fillStyle = '#fbbf24'
    ctx.font = '700 11.5px Inter, system-ui, sans-serif'
    ctx.fillText('★'.repeat(piece.rarity), artX + 14, sy + stripH - 12)

    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)'
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.35)'
    ctx.lineWidth = 1
    roundRect(ctx, artX + 78, sy + stripH - 30, 38, 20, 6)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#f8fafc'
    ctx.font = '800 11.5px Inter, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(`+${piece.level}`, artX + 97, sy + stripH - 16)
    ctx.textAlign = 'left'

    // Coluna Main Stat + CV (meio-esquerda do strip: x = artX + 124 .. artX + 266)
    const msX = artX + 124
    ctx.fillStyle = '#94a3b8'
    ctx.font = '700 11px Inter, system-ui, sans-serif'
    ctx.fillText(truncateText(ctx, `${piece.slotLabel.toUpperCase()}`, 132), msX, sy + 26)

    ctx.fillStyle = '#cbd5e1'
    ctx.font = '600 12.5px Inter, system-ui, sans-serif'
    ctx.fillText(truncateText(ctx, piece.mainStatLabel, 136), msX, sy + 48)

    ctx.fillStyle = '#ffffff'
    ctx.font = '800 24px Inter, system-ui, sans-serif'
    const mainTxt = piece.mainStatKey
      ? formatCanonicalStatValue(piece.mainStatKey, piece.mainStatValue)
      : '—'
    ctx.fillText(mainTxt, msX, sy + 78)

    // Badge CV individual da peça
    const pcv = pieceCvColor(piece.critValue)
    ctx.fillStyle = pcv.bg
    ctx.strokeStyle = pcv.border
    ctx.lineWidth = 1
    roundRect(ctx, msX, sy + 92, 82, 24, 7)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = pcv.text
    ctx.font = '800 12px Inter, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(`${piece.critValue.toFixed(1)} CV`, msX + 41, sy + 108)
    ctx.textAlign = 'left'

    // Divisória vertical sutil antes dos substats
    const divX = artX + 268
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.10)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(divX, sy + 16)
    ctx.lineTo(divX, sy + stripH - 16)
    ctx.stroke()

    // Grid 2×2 de Substats (direita do strip: x = artX + 280 .. artX + 514)
    const subAreaX = artX + 280
    const subCellW = 114
    const subCellH = 50
    const subGapX = 8
    const subGapY = 8

    piece.substats.slice(0, 4).forEach((sub, si) => {
      const col = si % 2
      const row = Math.floor(si / 2)
      const cx = subAreaX + col * (subCellW + subGapX)
      const cy = sy + 13 + row * (subCellH + subGapY)
      const isCrit = sub.key === 'crit_rate' || sub.key === 'crit_dmg'
      const isGoodPct =
        sub.key === 'er' || sub.key === 'em' || sub.key === 'atk_pct' || sub.key === 'hp_pct' || sub.key === 'def_pct'

      ctx.fillStyle = isCrit ? 'rgba(250, 204, 21, 0.10)' : 'rgba(255, 255, 255, 0.04)'
      ctx.strokeStyle = isCrit ? 'rgba(250, 204, 21, 0.32)' : 'rgba(255, 255, 255, 0.08)'
      ctx.lineWidth = 1
      roundRect(ctx, cx, cy, subCellW, subCellH, 9)
      ctx.fill()
      ctx.stroke()

      ctx.fillStyle = isCrit ? '#fde68a' : isGoodPct ? '#cbd5e1' : '#94a3b8'
      ctx.font = '600 11px Inter, system-ui, sans-serif'
      ctx.fillText(truncateText(ctx, sub.label, subCellW - 14), cx + 9, cy + 17)

      ctx.fillStyle = isCrit ? '#fef08a' : isGoodPct ? '#f8fafc' : '#cbd5e1'
      ctx.font = `${isCrit ? '800' : '700'} 15.5px Inter, system-ui, sans-serif`
      ctx.fillText(`+${sub.formatted}`, cx + 9, cy + 37)

      if (showRollDots) {
        const rolls = estimateSubstatRolls(sub.key, sub.value)
        for (let r = 0; r < rolls; r++) {
          ctx.fillStyle = isCrit ? '#facc15' : isGoodPct ? `${palette.accentSoft}bb` : 'rgba(148,163,184,0.45)'
          ctx.beginPath()
          ctx.arc(cx + subCellW - 10 - r * 6, cy + 43, 2, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    })
  }

  // 6. Moldura externa luminosa final
  ctx.save()
  const frameGrad = ctx.createLinearGradient(0, 0, W, H)
  frameGrad.addColorStop(0, `${palette.accent}aa`)
  frameGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.16)')
  frameGrad.addColorStop(1, `${palette.accent}88`)
  ctx.strokeStyle = frameGrad
  ctx.lineWidth = 2.5
  roundRect(ctx, 1.5, 1.5, W - 3, H - 3, 22)
  ctx.stroke()
  ctx.restore()
}

export async function buildCardToBlob(
  character: CharacterSummary,
  stats: ComputedCharStats,
  options: BuildCardOptions = {},
): Promise<Blob | null> {
  const canvas = document.createElement('canvas')
  canvas.width = CARD_WIDTH
  canvas.height = CARD_HEIGHT
  await renderBuildCardToCanvas(canvas, character, stats, options)
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png')
  })
}

export async function downloadBuildCardPng(
  character: CharacterSummary,
  stats: ComputedCharStats,
  options: BuildCardOptions = {},
): Promise<void> {
  const blob = await buildCardToBlob(character, stats, options)
  if (!blob) return
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `build-${character.slug}.png`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function copyBuildCardToClipboard(
  character: CharacterSummary,
  stats: ComputedCharStats,
  options: BuildCardOptions = {},
): Promise<boolean> {
  if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) {
    return false
  }
  const blob = await buildCardToBlob(character, stats, options)
  if (!blob) return false
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
    return true
  } catch {
    return false
  }
}
