import { artifactIconUrl, artifactPieceIconUrl, iconUrl } from '../config'
import { formatStatLabel } from './stats'
import {
  BUILD_CARD_THEMES,
  loadSavedCustomArt,
  type BuildCardTheme,
  type ThemePalette,
} from './build-card-png'
import {
  formatCanonicalStatValue,
  STAT_SHORT_LABEL_PT,
  type ComputedCharStats,
} from './char-stats-calc'
import type {
  ArtifactSetSummary,
  CharacterBuild,
  CharacterSummary,
  WeaponSummary,
} from '../types'

export type TeamCardLayout = 'wide' | 'grid2x2'
export type TeamCardSourceMode = 'account' | 'guide'

export interface MemberArtOverride {
  customImageUrl?: string | null
  scale?: number
  offsetX?: number
  offsetY?: number
}

export interface MemberTalentIcons {
  na?: string | null
  es?: string | null
  eb?: string | null
}

export interface TeamCardMemberInput {
  position: number
  character: CharacterSummary
  role?: string | null
  guideBuild?: CharacterBuild | null
  accountStats?: ComputedCharStats | null
  talentIcons?: MemberTalentIcons
}

export interface TeamCardData {
  name: string
  description?: string | null
  archetypeLabel?: string | null
  tier?: string | null
  synergyScore?: number | null
  reactions?: string[]
  members: TeamCardMemberInput[]
  weaponsLookup: Map<string, WeaponSummary>
  artifactsLookup: Map<string, ArtifactSetSummary>
}

export interface TeamCardOptions {
  layout?: TeamCardLayout
  sourceMode?: TeamCardSourceMode
  theme?: BuildCardTheme
  customTitle?: string
  customNotes?: string
  nickname?: string
  uid?: string
  showUid?: boolean
  showMeta?: boolean
  showNotes?: boolean
  /** Overrides de arte (imagem customizada + zoom/pan) por slug de personagem */
  artOverrides?: Record<string, MemberArtOverride>
}

export function getTeamCardDimensions(
  layout: TeamCardLayout,
  hasNotes: boolean,
): { width: number; height: number } {
  if (layout === 'grid2x2') {
    return { width: 1580, height: hasNotes ? 1420 : 1340 }
  }
  return { width: 1920, height: hasNotes ? 1060 : 980 }
}

const ELEMENT_ACCENT: Record<string, { main: string; soft: string; deep: string }> = {
  pyro:    { main: '#fb923c', soft: '#fed7aa', deep: '#431407' },
  hydro:   { main: '#38bdf8', soft: '#bae6fd', deep: '#082f49' },
  cryo:    { main: '#67e8f9', soft: '#cffafe', deep: '#083344' },
  electro: { main: '#c084fc', soft: '#e9d5ff', deep: '#2e1065' },
  anemo:   { main: '#34d399', soft: '#a7f3d0', deep: '#022c22' },
  geo:     { main: '#fbbf24', soft: '#fef08a', deep: '#422006' },
  dendro:  { main: '#a3e635', soft: '#d9f99d', deep: '#1a2e05' },
}

const ROLE_LABELS: Record<string, string> = {
  dps: 'MAIN DPS',
  sub: 'SUB-DPS',
  healer: 'HEALER',
  shielder: 'SHIELDER',
  support: 'SUPORTE',
}

const TIER_PALETTE: Record<string, { main: string; soft: string; bg: string }> = {
  SS: { main: '#fbbf24', soft: '#fef08a', bg: 'rgba(245, 158, 11, 0.22)' },
  S:  { main: '#f472b6', soft: '#fbcfe8', bg: 'rgba(236, 72, 153, 0.22)' },
  A:  { main: '#818cf8', soft: '#c7d2fe', bg: 'rgba(99, 102, 241, 0.22)' },
  B:  { main: '#38bdf8', soft: '#bae6fd', bg: 'rgba(14, 165, 233, 0.22)' },
  C:  { main: '#94a3b8', soft: '#cbd5e1', bg: 'rgba(148, 163, 184, 0.18)' },
}

function getThemePalette(mainElement: string, theme: BuildCardTheme = 'auto'): ThemePalette {
  if (theme !== 'auto' && BUILD_CARD_THEMES[theme]) {
    return BUILD_CARD_THEMES[theme]
  }
  const elKey = (mainElement || '').toLowerCase() as Exclude<BuildCardTheme, 'auto'>
  return BUILD_CARD_THEMES[elKey] ?? BUILD_CARD_THEMES.astral
}

const imageCache = new Map<string, Promise<HTMLImageElement | null>>()

function loadImageSafe(src: string | null | undefined): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null)
  // Data URLs não precisam ser cacheadas infinitamente com risco de memória
  if (!src.startsWith('data:')) {
    const cached = imageCache.get(src)
    if (cached) return cached
  }
  const p = new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image()
    if (!src.startsWith('data:')) {
      img.crossOrigin = 'anonymous'
    }
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
  if (!src.startsWith('data:')) {
    imageCache.set(src, p)
  }
  return p
}

function roundRectPath(
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

function fillRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string | CanvasGradient,
  stroke?: string | CanvasGradient,
  strokeWidth = 1,
) {
  roundRectPath(ctx, x, y, w, h, r)
  ctx.fillStyle = fill
  ctx.fill()
  if (stroke) {
    ctx.strokeStyle = stroke
    ctx.lineWidth = strokeWidth
    ctx.stroke()
  }
}

function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (!text) return ''
  if (ctx.measureText(text).width <= maxWidth) return text
  let out = text
  while (out.length > 1 && ctx.measureText(`${out}…`).width > maxWidth) {
    out = out.slice(0, -1)
  }
  return `${out}…`
}

/** Estrela de 4 pontas (sparkle estilo Genshin / Astral) */
function drawFourPointStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  color: string,
  alpha = 1,
) {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = color
  ctx.beginPath()
  for (let i = 0; i < 8; i++) {
    const r = i % 2 === 0 ? outerR : innerR
    const angle = (i * Math.PI) / 4 - Math.PI / 2
    const px = cx + Math.cos(angle) * r
    const py = cy + Math.sin(angle) * r
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

/** Ornamento de canto refinado (filigrana geométrica estilo HoYoverse) */
function drawCornerOrnament(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  dx: 1 | -1,
  dy: 1 | -1,
  color: string,
) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = 1.6
  ctx.globalAlpha = 0.65
  ctx.beginPath()
  ctx.moveTo(x, y + dy * 28)
  ctx.lineTo(x, y)
  ctx.lineTo(x + dx * 28, y)
  ctx.stroke()

  ctx.lineWidth = 1
  ctx.globalAlpha = 0.35
  ctx.beginPath()
  ctx.moveTo(x + dx * 6, y + dy * 18)
  ctx.lineTo(x + dx * 6, y + dy * 6)
  ctx.lineTo(x + dx * 18, y + dy * 6)
  ctx.stroke()

  drawFourPointStar(ctx, x + dx * 6, y + dy * 6, 4.2, 1.3, color, 0.85)
  ctx.restore()
}

/** Fundo estelar requintado com constelações sutis, bokeh e estrelas de 4 pontas */
function drawAstralBackdrop(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  palette: ThemePalette,
) {
  ctx.save()
  let seed = 9187
  const rand = () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }

  // Raios de luz diagonais suaves (God Rays)
  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  for (let i = 0; i < 3; i++) {
    const rx = w * (0.12 + i * 0.34)
    const rayGrad = ctx.createLinearGradient(rx, 0, rx + 260, h * 0.65)
    rayGrad.addColorStop(0, `${palette.accent}12`)
    rayGrad.addColorStop(0.5, `${palette.accentSoft}08`)
    rayGrad.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = rayGrad
    ctx.beginPath()
    ctx.moveTo(rx - 70, 0)
    ctx.lineTo(rx + 90, 0)
    ctx.lineTo(rx + 360, h * 0.72)
    ctx.lineTo(rx + 140, h * 0.72)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()

  // Anéis astrais sutis atrás do cabeçalho
  ctx.save()
  ctx.strokeStyle = `${palette.accentSoft}1a`
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(w * 0.82, 76, 175, 0, Math.PI * 2)
  ctx.stroke()
  ctx.setLineDash([4, 8])
  ctx.beginPath()
  ctx.arc(w * 0.82, 76, 215, 0, Math.PI * 2)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.restore()

  // Pontos estelares + poeira luminosa
  for (let i = 0; i < 110; i++) {
    const sx = rand() * w
    const sy = rand() * h
    const sr = 0.6 + rand() * 1.6
    const isAccent = i % 4 === 0
    ctx.fillStyle = isAccent
      ? `${palette.accentSoft}`
      : '#ffffff'
    ctx.globalAlpha = 0.08 + rand() * 0.28
    ctx.beginPath()
    ctx.arc(sx, sy, sr, 0, Math.PI * 2)
    ctx.fill()
  }

  // Estrelas de 4 pontas (brilhos maiores espalhados)
  for (let i = 0; i < 16; i++) {
    const sx = 40 + rand() * (w - 80)
    const sy = 30 + rand() * (h - 60)
    const size = 4 + rand() * 6
    drawFourPointStar(
      ctx,
      sx,
      sy,
      size,
      size * 0.26,
      i % 2 === 0 ? palette.accentSoft : '#ffffff',
      0.22 + rand() * 0.35,
    )
  }

  ctx.restore()
}

/** Mini-ícone vetorial nítido para a tabela de stats */
function drawStatMiniGlyph(
  ctx: CanvasRenderingContext2D,
  kind: 'hp' | 'atk' | 'cr' | 'cd' | 'er' | 'em' | 'elem' | 'heal',
  cx: number,
  cy: number,
  color: string,
) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = 1.4
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  switch (kind) {
    case 'hp':
      // Coração simplificado
      ctx.beginPath()
      ctx.moveTo(cx, cy + 4.2)
      ctx.bezierCurveTo(cx - 5.5, cy + 0.5, cx - 5.5, cy - 4.2, cx - 2.4, cy - 4.2)
      ctx.bezierCurveTo(cx - 0.8, cy - 4.2, cx, cy - 2.6, cx, cy - 1.8)
      ctx.bezierCurveTo(cx, cy - 2.6, cx + 0.8, cy - 4.2, cx + 2.4, cy - 4.2)
      ctx.bezierCurveTo(cx + 5.5, cy - 4.2, cx + 5.5, cy + 0.5, cx, cy + 4.2)
      ctx.fill()
      break
    case 'atk':
      // Espada diagonal
      ctx.beginPath()
      ctx.moveTo(cx - 4, cy + 4)
      ctx.lineTo(cx + 4.2, cy - 4.2)
      ctx.moveTo(cx - 2.8, cy + 0.2)
      ctx.lineTo(cx + 0.2, cy + 3.2)
      ctx.stroke()
      break
    case 'cr':
      // Alvo / Mira
      ctx.beginPath()
      ctx.arc(cx, cy, 4.2, 0, Math.PI * 2)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(cx, cy, 1.5, 0, Math.PI * 2)
      ctx.fill()
      break
    case 'cd':
      // Estrela brilhante
      drawFourPointStar(ctx, cx, cy, 5.2, 1.8, color, 1)
      break
    case 'er':
      // Raio de energia
      ctx.beginPath()
      ctx.moveTo(cx + 1.2, cy - 5)
      ctx.lineTo(cx - 3.2, cy + 0.5)
      ctx.lineTo(cx + 0.3, cy + 0.5)
      ctx.lineTo(cx - 1.2, cy + 5)
      ctx.lineTo(cx + 3.2, cy - 0.5)
      ctx.lineTo(cx - 0.3, cy - 0.5)
      ctx.closePath()
      ctx.fill()
      break
    case 'em':
      // Losango com anel
      ctx.beginPath()
      ctx.moveTo(cx, cy - 4.6)
      ctx.lineTo(cx + 4.4, cy)
      ctx.lineTo(cx, cy + 4.6)
      ctx.lineTo(cx - 4.4, cy)
      ctx.closePath()
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(cx, cy, 1.4, 0, Math.PI * 2)
      ctx.fill()
      break
    case 'heal':
      // Cruz de cura
      ctx.beginPath()
      ctx.moveTo(cx, cy - 4.2)
      ctx.lineTo(cx, cy + 4.2)
      ctx.moveTo(cx - 4.2, cy)
      ctx.lineTo(cx + 4.2, cy)
      ctx.stroke()
      break
    default:
      // Bônus elemental (losango preenchido)
      ctx.beginPath()
      ctx.moveTo(cx, cy - 4.8)
      ctx.lineTo(cx + 3.8, cy)
      ctx.lineTo(cx, cy + 4.8)
      ctx.lineTo(cx - 3.8, cy)
      ctx.closePath()
      ctx.fill()
      break
  }
  ctx.restore()
}

function drawPill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  bg: string,
  border: string,
  textColor: string,
  font = '700 12px "Inter", system-ui, sans-serif',
  height = 28,
  padX = 12,
  dotColor?: string,
): number {
  ctx.save()
  ctx.font = font
  const dotSpace = dotColor ? 11 : 0
  const tw = ctx.measureText(text).width
  const w = Math.ceil(tw + padX * 2 + dotSpace)
  fillRoundedRect(ctx, x, y, w, height, height / 2, bg, border, 1.1)
  if (dotColor) {
    ctx.fillStyle = dotColor
    ctx.shadowColor = dotColor
    ctx.shadowBlur = 6
    ctx.beginPath()
    ctx.arc(x + padX + 2.5, y + height / 2, 3, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0
  }
  ctx.fillStyle = textColor
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x + padX + dotSpace, y + height / 2 + 0.5)
  ctx.restore()
  return w
}

function hasGuideContent(b?: CharacterBuild | null): boolean {
  if (!b) return false
  return Boolean(
    b.weapons?.length ||
      b.artifacts_4pc?.length ||
      b.artifacts_2pc?.length ||
      b.sands_stat?.length ||
      b.goblet_stat?.length ||
      b.circlet_stat?.length ||
      b.substat_priority?.length ||
      b.er_requirement ||
      b.talent_priority,
  )
}

function resolveMemberMode(
  member: TeamCardMemberInput,
  preferred: TeamCardSourceMode,
): 'account' | 'guide' | 'empty' {
  const hasAcc = Boolean(member.accountStats && (member.accountStats.hasArtifacts || member.accountStats.weapon))
  const hasGuide = hasGuideContent(member.guideBuild)
  if (preferred === 'account') {
    if (hasAcc) return 'account'
    if (hasGuide) return 'guide'
    return member.accountStats ? 'account' : 'empty'
  }
  if (hasGuide) return 'guide'
  if (hasAcc) return 'account'
  return 'empty'
}

interface MemberAssets {
  heroImg: HTMLImageElement | null
  heroIsSplash: boolean
  isCustomArt: boolean
  avatarImg: HTMLImageElement | null
  weaponImg: HTMLImageElement | null
  setImgs: (HTMLImageElement | null)[]
  pieceImgs: (HTMLImageElement | null)[]
  talentImgs: {
    na: HTMLImageElement | null
    es: HTMLImageElement | null
    eb: HTMLImageElement | null
  }
}

async function preloadMemberAssets(
  member: TeamCardMemberInput,
  data: TeamCardData,
  mode: 'account' | 'guide' | 'empty',
  artOverride?: MemberArtOverride,
): Promise<MemberAssets> {
  const explicitCustom =
    artOverride && artOverride.customImageUrl !== undefined
      ? artOverride.customImageUrl
      : loadSavedCustomArt(member.character.slug)

  const splashUrl = `/splash_arts/${member.character.slug}.webp?v=2`
  const avatarUrl = iconUrl(member.character.icon)

  let weaponIconUrl: string | null = null
  const setUrls: (string | null)[] = []
  const pieceUrls: (string | null)[] = []

  if (mode === 'account' && member.accountStats) {
    const st = member.accountStats
    weaponIconUrl = st.weapon ? iconUrl(st.weapon.icon) : null
    for (const active of st.activeSets.slice(0, 2)) {
      const sMeta = data.artifactsLookup.get(active.slug)
      setUrls.push(artifactIconUrl(active.icon || sMeta?.icon))
    }
    // Ordem fixa dos 5 slots (flower, plume, sands, goblet, circlet)
    const slotOrder = ['flower', 'plume', 'sands', 'goblet', 'circlet']
    const bySlot = new Map(st.pieces.map((p) => [p.slotKey, p]))
    for (const sk of slotOrder) {
      const p = bySlot.get(sk as any)
      pieceUrls.push(p ? artifactPieceIconUrl(p.setIcon, sk) : null)
    }
  } else if (mode === 'guide' && member.guideBuild) {
    const b = member.guideBuild
    const primaryW = b.weapons?.[0]
    if (primaryW?.weapon_slug) {
      const wMeta = data.weaponsLookup.get(primaryW.weapon_slug)
      weaponIconUrl = iconUrl(wMeta?.icon)
    }
    const a4First = b.artifacts_4pc?.[0]?.artifact_set_slug
    if (a4First) {
      const aMeta = data.artifactsLookup.get(a4First)
      setUrls.push(artifactIconUrl(aMeta?.icon))
    } else if (b.artifacts_2pc?.[0]) {
      const s1Slug = b.artifacts_2pc[0].set1_slug
      const s2Slug = b.artifacts_2pc[0].set2_slug
      const a1 = s1Slug ? data.artifactsLookup.get(s1Slug) : undefined
      const a2 = s2Slug ? data.artifactsLookup.get(s2Slug) : undefined
      setUrls.push(artifactIconUrl(a1?.icon), artifactIconUrl(a2?.icon))
    }
  }

  const [
    customImg,
    splashImg,
    avatarImg,
    weaponImg,
    naImg,
    esImg,
    ebImg,
    ...rest
  ] = await Promise.all([
    loadImageSafe(explicitCustom),
    loadImageSafe(splashUrl),
    loadImageSafe(avatarUrl),
    loadImageSafe(weaponIconUrl),
    loadImageSafe(iconUrl(member.talentIcons?.na)),
    loadImageSafe(iconUrl(member.talentIcons?.es)),
    loadImageSafe(iconUrl(member.talentIcons?.eb)),
    ...setUrls.map((u) => loadImageSafe(u)),
    ...pieceUrls.map((u) => loadImageSafe(u)),
  ])

  const setImgs = rest.slice(0, setUrls.length)
  const pieceImgs = rest.slice(setUrls.length)
  const heroImg = customImg || splashImg || avatarImg
  const heroIsSplash = Boolean(customImg || splashImg)
  const isCustomArt = Boolean(customImg)

  return {
    heroImg,
    heroIsSplash,
    isCustomArt,
    avatarImg,
    weaponImg,
    setImgs,
    pieceImgs,
    talentImgs: { na: naImg, es: esImg, eb: ebImg },
  }
}

function drawMemberCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  member: TeamCardMemberInput,
  data: TeamCardData,
  assets: MemberAssets,
  mode: 'account' | 'guide' | 'empty',
  isWide: boolean,
  artOverride?: MemberArtOverride,
) {
  const elKey = (member.character.element || 'anemo').toLowerCase()
  const el = ELEMENT_ACCENT[elKey] ?? { main: '#818cf8', soft: '#c7d2fe', deep: '#1e1b4b' }
  const isMain = member.position === 1

  // Sombra externa cinematográfica do card
  ctx.save()
  ctx.shadowColor = isMain ? `${el.main}44` : 'rgba(0, 0, 0, 0.55)'
  ctx.shadowBlur = isMain ? 28 : 20
  ctx.shadowOffsetY = 8
  const cardBg = ctx.createLinearGradient(x, y, x, y + h)
  cardBg.addColorStop(0, 'rgba(18, 27, 48, 0.94)')
  cardBg.addColorStop(0.55, 'rgba(12, 18, 34, 0.96)')
  cardBg.addColorStop(1, 'rgba(8, 12, 24, 0.98)')
  fillRoundedRect(ctx, x, y, w, h, 22, cardBg)
  ctx.restore()

  // Borda metálica com gradiente especular
  const borderGrad = ctx.createLinearGradient(x, y, x + w, y + h)
  borderGrad.addColorStop(0, isMain ? el.soft : `${el.main}78`)
  borderGrad.addColorStop(0.35, `${el.main}42`)
  borderGrad.addColorStop(1, 'rgba(148, 163, 184, 0.14)')
  fillRoundedRect(ctx, x, y, w, h, 22, 'rgba(0,0,0,0)', borderGrad, isMain ? 2 : 1.2)

  // Clip interno do card
  ctx.save()
  roundRectPath(ctx, x, y, w, h, 22)
  ctx.clip()

  // 1. HERO ART BANNER (com fusão suave + zoom/pan customizável por personagem!)
  const heroH = isWide ? 276 : 228

  // Fundo elemental radiante atrás da arte
  const heroGrad = ctx.createRadialGradient(
    x + w * 0.5,
    y + heroH * 0.42,
    18,
    x + w * 0.5,
    y + heroH * 0.45,
    w * 0.78,
  )
  heroGrad.addColorStop(0, `${el.main}52`)
  heroGrad.addColorStop(0.6, `${el.deep}90`)
  heroGrad.addColorStop(1, 'rgba(10, 15, 30, 0.95)')
  ctx.fillStyle = heroGrad
  ctx.fillRect(x, y, w, heroH + 24)

  // Anel luminoso sutil atrás do personagem
  ctx.save()
  ctx.strokeStyle = `${el.soft}28`
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.arc(x + w * 0.5, y + heroH * 0.46, Math.min(w, heroH) * 0.38, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()

  if (assets.heroImg) {
    const img = assets.heroImg
    const iw = img.naturalWidth || img.width || 1
    const ih = img.naturalHeight || img.height || 1
    const scaleMult = artOverride?.scale ?? 1.0
    const offX = ((artOverride?.offsetX ?? 0) / 100) * (w * 0.65)
    const offY = ((artOverride?.offsetY ?? 0) / 100) * (heroH * 0.65)

    // Renderiza em offscreen com máscara de fade suave na borda inferior (sem corte seco!)
    const bleedH = heroH + 34
    const artCanvas = document.createElement('canvas')
    artCanvas.width = Math.ceil(w)
    artCanvas.height = Math.ceil(bleedH)
    const actx = artCanvas.getContext('2d')
    if (actx) {
      if (assets.heroIsSplash) {
        const baseScale = Math.max(w / iw, bleedH / ih) * (assets.isCustomArt ? 1.0 : 1.08)
        const dw = iw * baseScale * scaleMult
        const dh = ih * baseScale * scaleMult
        const dx = (w - dw) / 2 + offX
        const dy = (bleedH - dh) * (assets.isCustomArt ? 0.45 : 0.18) + offY
        actx.drawImage(img, dx, dy, dw, dh)
      } else {
        const avSize = (heroH - 22) * scaleMult
        const dx = (w - avSize) / 2 + offX
        const dy = 12 + (heroH - 22 - avSize) / 2 + offY
        actx.drawImage(img, dx, dy, avSize, avSize)
      }

      actx.globalCompositeOperation = 'destination-in'
      const maskGrad = actx.createLinearGradient(0, 0, 0, bleedH)
      maskGrad.addColorStop(0, 'rgba(0,0,0,1)')
      maskGrad.addColorStop(0.68, 'rgba(0,0,0,1)')
      maskGrad.addColorStop(0.88, 'rgba(0,0,0,0.45)')
      maskGrad.addColorStop(1, 'rgba(0,0,0,0)')
      actx.fillStyle = maskGrad
      actx.fillRect(0, 0, w, bleedH)

      ctx.drawImage(artCanvas, x, y)
    }
  }

  // Vinheta superior e inferior para leitura impecável em qualquer fanart clara/escura
  const topVig = ctx.createLinearGradient(x, y, x, y + 76)
  topVig.addColorStop(0, 'rgba(6, 10, 22, 0.72)')
  topVig.addColorStop(1, 'rgba(6, 10, 22, 0)')
  ctx.fillStyle = topVig
  ctx.fillRect(x, y, w, 76)

  const botVig = ctx.createLinearGradient(x, y + heroH - 110, x, y + heroH + 16)
  botVig.addColorStop(0, 'rgba(10, 15, 30, 0)')
  botVig.addColorStop(0.58, 'rgba(11, 17, 33, 0.78)')
  botVig.addColorStop(1, 'rgba(12, 18, 34, 0.99)')
  ctx.fillStyle = botVig
  ctx.fillRect(x, y + heroH - 110, w, 126)

  // Filete superior brilhante com cor do elemento
  const topBar = ctx.createLinearGradient(x, y, x + w, y)
  topBar.addColorStop(0, `${el.main}40`)
  topBar.addColorStop(0.5, el.soft)
  topBar.addColorStop(1, `${el.main}40`)
  ctx.fillStyle = topBar
  ctx.fillRect(x, y, w, 3.5)

  // Badges do topo: Role à esquerda + Nível/Const ou Guia à direita
  const roleKey = (member.role || (isMain ? 'dps' : 'support')).toLowerCase()
  const roleLabel = ROLE_LABELS[roleKey] ?? (isMain ? 'MAIN DPS' : `SLOT ${member.position}`)
  drawPill(
    ctx,
    x + 14,
    y + 15,
    isMain ? `★ ${roleLabel}` : roleLabel,
    'rgba(5, 10, 24, 0.82)',
    `${el.main}90`,
    el.soft,
    '800 11px "Inter", system-ui, sans-serif',
    25,
    10,
  )

  if (mode === 'account' && member.accountStats) {
    const lvText = `Lv. ${member.accountStats.level} · C${member.accountStats.cons}`
    ctx.save()
    ctx.font = '800 11.5px "Inter", system-ui, sans-serif'
    const pw = Math.ceil(ctx.measureText(lvText).width + 20)
    ctx.restore()
    drawPill(
      ctx,
      x + w - pw - 14,
      y + 15,
      lvText,
      'rgba(5, 10, 24, 0.84)',
      'rgba(251, 191, 36, 0.6)',
      '#fde68a',
      '800 11.5px "Inter", system-ui, sans-serif',
      25,
      10,
    )
  } else {
    const badgeTxt = mode === 'guide' ? 'BUILD GUIA' : `${'★'.repeat(member.character.rarity || 5)}`
    ctx.save()
    ctx.font = '800 10.5px "Inter", system-ui, sans-serif'
    const pw = Math.ceil(ctx.measureText(badgeTxt).width + 18)
    ctx.restore()
    drawPill(
      ctx,
      x + w - pw - 14,
      y + 15,
      badgeTxt,
      'rgba(5, 10, 24, 0.8)',
      'rgba(148, 163, 184, 0.42)',
      '#e2e8f0',
      '800 10.5px "Inter", system-ui, sans-serif',
      25,
      9,
    )
  }

  // Orbes de Constelação (C1..C6) na lateral direita do banner (modo conta)
  if (mode === 'account' && member.accountStats) {
    const cons = member.accountStats.cons
    const orbX = x + w - 24
    const startY = y + 54
    const stepY = 20
    for (let ci = 0; ci < 6; ci++) {
      const unlocked = ci < cons
      const cyOrb = startY + ci * stepY
      ctx.save()
      ctx.beginPath()
      ctx.arc(orbX, cyOrb, 6.5, 0, Math.PI * 2)
      ctx.fillStyle = unlocked ? `${el.main}38` : 'rgba(6, 10, 22, 0.65)'
      ctx.fill()
      ctx.strokeStyle = unlocked ? el.soft : 'rgba(148, 163, 184, 0.25)'
      ctx.lineWidth = unlocked ? 1.4 : 1
      ctx.stroke()
      if (unlocked) {
        drawFourPointStar(ctx, orbX, cyOrb, 3.8, 1.3, el.soft, 0.95)
      }
      ctx.restore()
    }
  }

  // Nome do Personagem + Estrelas + Tag elemental sobre o gradiente inferior
  ctx.save()
  ctx.shadowColor = 'rgba(0, 0, 0, 0.9)'
  ctx.shadowBlur = 12
  ctx.fillStyle = '#fbbf24'
  ctx.font = '700 13px "Inter", system-ui, sans-serif'
  const starsStr = '★'.repeat(member.character.rarity || 5)
  ctx.fillText(starsStr, x + 16, y + heroH - 42)
  const starsW = ctx.measureText(starsStr).width

  ctx.fillStyle = el.soft
  ctx.font = '800 11px "Inter", system-ui, sans-serif'
  ctx.fillText(`· ${elKey.toUpperCase()}`, x + 22 + starsW, y + heroH - 42)

  ctx.fillStyle = '#ffffff'
  ctx.font = '800 24px "Inter", system-ui, sans-serif'
  ctx.fillText(truncateText(ctx, member.character.name, w - 52), x + 16, y + heroH - 15)
  ctx.restore()

  // Linha ornamental separando banner do corpo
  const sepGrad = ctx.createLinearGradient(x + 16, 0, x + w - 16, 0)
  sepGrad.addColorStop(0, `${el.main}00`)
  sepGrad.addColorStop(0.5, `${el.main}70`)
  sepGrad.addColorStop(1, `${el.main}00`)
  ctx.fillStyle = sepGrad
  ctx.fillRect(x + 16, y + heroH - 2, w - 32, 1.5)

  // 2. CORPO DO CARD
  const pad = 16
  let cy = y + heroH + 12
  const innerW = w - pad * 2

  if (mode === 'account' && member.accountStats) {
    const st = member.accountStats

    // --- A. ARMA EQUIPADA (com brilho de raridade + substat) ---
    const wBoxH = 68
    const wRarity = st.weapon?.rarity ?? 4
    const wRarityColor = wRarity === 5 ? '#f59e0b' : wRarity === 4 ? '#a855f7' : '#38bdf8'
    const wBg = ctx.createLinearGradient(x + pad, cy, x + pad + innerW, cy + wBoxH)
    wBg.addColorStop(0, 'rgba(8, 13, 28, 0.85)')
    wBg.addColorStop(1, `${wRarityColor}14`)
    fillRoundedRect(ctx, x + pad, cy, innerW, wBoxH, 13, wBg, `${wRarityColor}45`, 1.1)

    const wIconSize = 50
    const wIconBg = ctx.createRadialGradient(
      x + pad + 9 + wIconSize / 2,
      cy + 9 + wIconSize / 2,
      4,
      x + pad + 9 + wIconSize / 2,
      cy + 9 + wIconSize / 2,
      wIconSize * 0.7,
    )
    wIconBg.addColorStop(0, `${wRarityColor}44`)
    wIconBg.addColorStop(1, 'rgba(10, 15, 30, 0.9)')
    fillRoundedRect(ctx, x + pad + 9, cy + 9, wIconSize, wIconSize, 11, wIconBg, `${wRarityColor}88`, 1.2)
    if (assets.weaponImg) {
      ctx.drawImage(assets.weaponImg, x + pad + 12, cy + 12, wIconSize - 6, wIconSize - 6)
    }

    ctx.save()
    ctx.fillStyle = '#ffffff'
    ctx.font = '700 14px "Inter", system-ui, sans-serif'
    const wName = st.weapon?.name ?? 'Arma não equipada'
    ctx.fillText(truncateText(ctx, wName, innerW - 112), x + pad + 70, cy + 27)

    if (st.weapon) {
      // Badge R1-R5 no canto direito
      drawPill(
        ctx,
        x + pad + innerW - 42,
        cy + 12,
        `R${st.weapon.refinement}`,
        `${wRarityColor}28`,
        `${wRarityColor}88`,
        '#fef08a',
        '800 11px "Inter", system-ui, sans-serif',
        21,
        8,
      )
      const subText =
        st.weapon.subKey && st.weapon.subVal > 0
          ? ` · ${STAT_SHORT_LABEL_PT[st.weapon.subKey] ?? ''} ${formatCanonicalStatValue(st.weapon.subKey, st.weapon.subVal)}`
          : ''
      ctx.fillStyle = '#94a3b8'
      ctx.font = '600 11.5px "Inter", system-ui, sans-serif'
      ctx.fillText(
        truncateText(ctx, `Lv.${st.weapon.level} · ATQ ${Math.round(st.weapon.baseAtk)}${subText}`, innerW - 82),
        x + pad + 70,
        cy + 49,
      )
    } else {
      ctx.fillStyle = '#64748b'
      ctx.font = '600 11.5px "Inter", system-ui, sans-serif'
      ctx.fillText('Importe via Enka/GOOD', x + pad + 70, cy + 49)
    }
    ctx.restore()
    cy += wBoxH + 10

    // --- B. MEDALHÕES DE TALENTOS COM ÍCONES REAIS ---
    const talH = 50
    fillRoundedRect(ctx, x + pad, cy, innerW, talH, 12, 'rgba(6, 10, 22, 0.62)', `${el.main}34`, 1)
    const talItems: Array<{ label: string; lv: number; img: HTMLImageElement | null }> = [
      { label: 'NA', lv: st.talents.na, img: assets.talentImgs.na },
      { label: 'Skill', lv: st.talents.es, img: assets.talentImgs.es },
      { label: 'Burst', lv: st.talents.eb, img: assets.talentImgs.eb },
    ]
    const talSlotW = innerW / 3
    talItems.forEach((ti, idx) => {
      const tx = x + pad + idx * talSlotW
      const isCrown = ti.lv >= 10
      const iconCx = tx + 24
      const iconCy = cy + talH / 2

      ctx.save()
      ctx.beginPath()
      ctx.arc(iconCx, iconCy, 16, 0, Math.PI * 2)
      ctx.fillStyle = isCrown ? 'rgba(251, 191, 36, 0.2)' : 'rgba(30, 41, 59, 0.85)'
      ctx.fill()
      ctx.strokeStyle = isCrown ? '#fbbf24' : `${el.main}66`
      ctx.lineWidth = isCrown ? 1.5 : 1.1
      ctx.stroke()
      if (ti.img) {
        ctx.save()
        ctx.beginPath()
        ctx.arc(iconCx, iconCy, 14, 0, Math.PI * 2)
        ctx.clip()
        ctx.drawImage(ti.img, iconCx - 13, iconCy - 13, 26, 26)
        ctx.restore()
      } else {
        ctx.fillStyle = el.soft
        ctx.font = '800 10px "Inter", system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(ti.label, iconCx, iconCy)
      }

      ctx.textAlign = 'left'
      ctx.textBaseline = 'alphabetic'
      ctx.fillStyle = '#94a3b8'
      ctx.font = '700 10px "Inter", system-ui, sans-serif'
      ctx.fillText(ti.label, tx + 46, cy + 20)
      ctx.fillStyle = isCrown ? '#fde68a' : '#f8fafc'
      ctx.font = '800 15px "Inter", system-ui, sans-serif'
      ctx.fillText(`Lv.${ti.lv}`, tx + 46, cy + 38)
      ctx.restore()
    })
    cy += talH + 10

    // --- C. SETS DE ARTEFATOS + 5 MINI-PEÇAS + CV TIER BADGE ---
    const aBoxH = 88
    fillRoundedRect(ctx, x + pad, cy, innerW, aBoxH, 13, 'rgba(6, 10, 22, 0.62)', 'rgba(148, 163, 184, 0.16)', 1)

    // Linha superior: nome do(s) set(s) + Badge CV
    const activeSets = st.activeSets.slice(0, 2)
    const cvVal = st.totalCritValue
    const cvColor =
      cvVal >= 210 ? '#fbbf24' : cvVal >= 180 ? '#c084fc' : cvVal >= 140 ? '#38bdf8' : '#cbd5e1'

    ctx.save()
    const maxSetW = innerW - (st.hasArtifacts ? 102 : 24)
    if (activeSets.length === 0) {
      ctx.fillStyle = '#94a3b8'
      ctx.font = '600 12.5px "Inter", system-ui, sans-serif'
      ctx.fillText('Artefatos variados (sem bônus de set)', x + pad + 12, cy + 24)
    } else {
      ctx.fillStyle = '#a3e635'
      ctx.font = '700 12.5px "Inter", system-ui, sans-serif'
      const setLine = activeSets.map((s) => `${s.pieces}pc ${s.name}`).join(' + ')
      ctx.fillText(truncateText(ctx, setLine, maxSetW), x + pad + 12, cy + 24)
    }
    ctx.restore()

    if (st.hasArtifacts) {
      const cvLabel = `${cvVal.toFixed(1)} CV`
      ctx.save()
      ctx.font = '800 11px "Inter", system-ui, sans-serif'
      const cw = Math.ceil(ctx.measureText(cvLabel).width + 18)
      ctx.restore()
      drawPill(
        ctx,
        x + pad + innerW - cw - 10,
        cy + 9,
        cvLabel,
        `${cvColor}20`,
        `${cvColor}88`,
        cvColor,
        '800 11px "Inter", system-ui, sans-serif',
        22,
        9,
      )
    }

    // Linha inferior: 5 mini-slots de artefatos (Flor, Pena, Ampulheta, Cálice, Coroa)
    const slotOrder = ['flower', 'plume', 'sands', 'goblet', 'circlet']
    const bySlot = new Map(st.pieces.map((p) => [p.slotKey, p]))
    const pGap = 7
    const pW = (innerW - 24 - pGap * 4) / 5
    const pH = 42
    const pY = cy + 37

    slotOrder.forEach((sk, si) => {
      const piece = bySlot.get(sk as any)
      const px = x + pad + 12 + si * (pW + pGap)
      const pImg = assets.pieceImgs[si]
      const rColor = piece?.rarity === 5 ? '#f59e0b' : piece?.rarity === 4 ? '#a855f7' : '#475569'
      fillRoundedRect(
        ctx,
        px,
        pY,
        pW,
        pH,
        9,
        piece ? `${rColor}1c` : 'rgba(15, 23, 42, 0.5)',
        piece ? `${rColor}66` : 'rgba(148, 163, 184, 0.14)',
        1,
      )
      if (pImg) {
        const isz = Math.min(32, pW - 6)
        ctx.drawImage(pImg, px + (pW - isz) / 2, pY + 2, isz, isz)
      }
      if (piece) {
        ctx.save()
        ctx.fillStyle = '#f8fafc'
        ctx.font = '800 9.5px "Inter", system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(`+${piece.level}`, px + pW / 2, pY + pH - 4)
        ctx.restore()
      }
    })
    cy += aBoxH + 10

    // --- D. GRID DE STATS COM ÍCONES VETORIAIS ---
    const elemBonusVal =
      st.elemDmgBonus > 0
        ? formatCanonicalStatValue(st.elemDmgKey, st.elemDmgBonus)
        : st.physicalDmgBonus > 0
          ? `${st.physicalDmgBonus.toFixed(1)}%`
          : `${Math.round(st.totalDef).toLocaleString('pt-BR')}`
    const elemBonusLabel =
      st.elemDmgBonus > 0
        ? `Dano ${elKey.charAt(0).toUpperCase() + elKey.slice(1)}`
        : st.physicalDmgBonus > 0
          ? 'Dano Físico'
          : 'DEF'

    const statCells: Array<{
      glyph: 'hp' | 'atk' | 'cr' | 'cd' | 'er' | 'em' | 'elem' | 'heal'
      label: string
      val: string
      hi?: boolean
    }> = [
      { glyph: 'hp', label: 'Vida Máx.', val: Math.round(st.totalHp).toLocaleString('pt-BR') },
      { glyph: 'atk', label: 'ATQ', val: Math.round(st.totalAtk).toLocaleString('pt-BR') },
      { glyph: 'cr', label: 'Taxa Crít.', val: `${st.critRate.toFixed(1)}%`, hi: true },
      { glyph: 'cd', label: 'Dano Crít.', val: `${st.critDmg.toFixed(1)}%`, hi: true },
      { glyph: 'er', label: 'Recarga (ER)', val: `${st.er.toFixed(1)}%` },
      { glyph: 'em', label: 'Proficiência', val: Math.round(st.em).toLocaleString('pt-BR') },
      { glyph: 'elem', label: elemBonusLabel, val: elemBonusVal },
      {
        glyph: 'heal',
        label: 'Bônus Cura',
        val: st.healingBonus > 0 ? `${st.healingBonus.toFixed(1)}%` : '0.0%',
      },
    ]

    const rows = isWide ? 4 : 3
    const shownCells = statCells.slice(0, 2 * rows)
    const gap = 8
    const cellW = (innerW - gap) / 2
    const availH = y + h - cy - 14
    const cellH = Math.max(38, Math.min(48, (availH - gap * (rows - 1)) / rows))

    shownCells.forEach((cell, idx) => {
      const col = idx % 2
      const row = Math.floor(idx / 2)
      const cx = x + pad + col * (cellW + gap)
      const rcy = cy + row * (cellH + gap)

      const cellBg = cell.hi
        ? ctx.createLinearGradient(cx, rcy, cx + cellW, rcy + cellH)
        : 'rgba(6, 10, 22, 0.54)'
      if (typeof cellBg !== 'string') {
        cellBg.addColorStop(0, `${el.main}20`)
        cellBg.addColorStop(1, 'rgba(15, 23, 42, 0.72)')
      }
      fillRoundedRect(
        ctx,
        cx,
        rcy,
        cellW,
        cellH,
        10,
        cellBg,
        cell.hi ? `${el.main}58` : 'rgba(148, 163, 184, 0.14)',
        1,
      )
      drawStatMiniGlyph(ctx, cell.glyph, cx + 14, rcy + cellH / 2, cell.hi ? el.soft : '#94a3b8')

      ctx.save()
      ctx.fillStyle = '#94a3b8'
      ctx.font = '600 10px "Inter", system-ui, sans-serif'
      ctx.fillText(cell.label, cx + 26, rcy + 15)
      ctx.fillStyle = cell.hi ? '#ffffff' : '#e2e8f0'
      ctx.font = '800 14.5px "Inter", system-ui, sans-serif'
      ctx.fillText(cell.val, cx + 26, rcy + cellH - 8)
      ctx.restore()
    })
  } else if (mode === 'guide' && member.guideBuild) {
    const b = member.guideBuild

    // --- A. ARMA RECOMENDADA ---
    const wBoxH = 72
    const primaryW = b.weapons?.[0]
    const wMeta = primaryW?.weapon_slug ? data.weaponsLookup.get(primaryW.weapon_slug) : undefined
    const altW = b.weapons?.[1]
    const altWMeta = altW?.weapon_slug ? data.weaponsLookup.get(altW.weapon_slug) : undefined
    const wRarityColor = wMeta?.rarity === 5 ? '#f59e0b' : wMeta?.rarity === 4 ? '#a855f7' : '#38bdf8'

    const wBg = ctx.createLinearGradient(x + pad, cy, x + pad + innerW, cy + wBoxH)
    wBg.addColorStop(0, 'rgba(8, 13, 28, 0.85)')
    wBg.addColorStop(1, `${wRarityColor}14`)
    fillRoundedRect(ctx, x + pad, cy, innerW, wBoxH, 13, wBg, `${wRarityColor}45`, 1.1)

    fillRoundedRect(ctx, x + pad + 10, cy + 11, 50, 50, 11, `${wRarityColor}26`, `${wRarityColor}80`, 1.2)
    if (assets.weaponImg) {
      ctx.drawImage(assets.weaponImg, x + pad + 13, cy + 14, 44, 44)
    }
    ctx.save()
    ctx.fillStyle = '#94a3b8'
    ctx.font = '700 10px "Inter", system-ui, sans-serif'
    ctx.fillText('ARMA RECOMENDADA', x + pad + 70, cy + 19)
    ctx.fillStyle = '#ffffff'
    ctx.font = '700 14px "Inter", system-ui, sans-serif'
    const primaryName = wMeta?.name ?? (primaryW?.weapon_slug?.replace(/-/g, ' ') || 'Flexível')
    const primaryRef = (primaryW as { refinement?: number } | undefined)?.refinement
    const refStr = primaryRef ? ` R${primaryRef}` : ''
    ctx.fillText(truncateText(ctx, `${primaryName}${refStr}`, innerW - 82), x + pad + 70, cy + 38)
    if (altW?.weapon_slug) {
      ctx.fillStyle = '#94a3b8'
      ctx.font = '600 11.5px "Inter", system-ui, sans-serif'
      const altName = altWMeta?.name ?? altW.weapon_slug.replace(/-/g, ' ')
      ctx.fillText(truncateText(ctx, `Alt: ${altName}`, innerW - 82), x + pad + 70, cy + 56)
    }
    ctx.restore()
    cy += wBoxH + 10

    // --- B. ARTEFATOS RECOMENDADOS ---
    const aBoxH = 70
    fillRoundedRect(ctx, x + pad, cy, innerW, aBoxH, 13, 'rgba(6, 10, 22, 0.62)', 'rgba(148, 163, 184, 0.16)', 1)
    if (assets.setImgs[0]) {
      fillRoundedRect(ctx, x + pad + 10, cy + 11, 48, 48, 11, `${el.main}18`, `${el.main}48`, 1)
      ctx.drawImage(assets.setImgs[0], x + pad + 13, cy + 14, 42, 42)
    } else {
      fillRoundedRect(ctx, x + pad + 10, cy + 11, 48, 48, 11, 'rgba(148,163,184,0.1)', 'rgba(148,163,184,0.2)', 1)
    }
    ctx.save()
    ctx.fillStyle = '#94a3b8'
    ctx.font = '700 10px "Inter", system-ui, sans-serif'
    ctx.fillText('SET DE ARTEFATOS', x + pad + 68, cy + 19)
    ctx.fillStyle = '#a3e635'
    ctx.font = '700 13.5px "Inter", system-ui, sans-serif'
    const a4First = b.artifacts_4pc?.[0]?.artifact_set_slug
    const a4Second = b.artifacts_4pc?.[1]?.artifact_set_slug
    if (a4First) {
      const a1 = data.artifactsLookup.get(a4First)
      const a1Name = a1?.name ?? a4First.replace(/-/g, ' ')
      ctx.fillText(truncateText(ctx, `4pc ${a1Name}`, innerW - 78), x + pad + 68, cy + 38)
      if (a4Second) {
        const a2 = data.artifactsLookup.get(a4Second)
        const a2Name = a2?.name ?? a4Second.replace(/-/g, ' ')
        ctx.fillStyle = '#94a3b8'
        ctx.font = '600 11.5px "Inter", system-ui, sans-serif'
        ctx.fillText(truncateText(ctx, `Alt: 4pc ${a2Name}`, innerW - 78), x + pad + 68, cy + 56)
      }
    } else if (b.artifacts_2pc?.[0]) {
      const s1Slug = b.artifacts_2pc[0].set1_slug
      const s2Slug = b.artifacts_2pc[0].set2_slug
      const s1 = (s1Slug ? data.artifactsLookup.get(s1Slug)?.name : null) ?? s1Slug ?? 'Flex'
      const s2 = (s2Slug ? data.artifactsLookup.get(s2Slug)?.name : null) ?? s2Slug ?? 'Flex'
      ctx.fillText(truncateText(ctx, `2pc ${s1}`, innerW - 78), x + pad + 68, cy + 38)
      ctx.fillText(truncateText(ctx, `2pc ${s2}`, innerW - 78), x + pad + 68, cy + 56)
    } else {
      ctx.fillStyle = '#94a3b8'
      ctx.fillText('Flexível / 2pc + 2pc', x + pad + 68, cy + 40)
    }
    ctx.restore()
    cy += aBoxH + 10

    // --- C. MAIN STATS ---
    const mainRows = [
      { label: 'Ampulheta', vals: b.sands_stat?.map(formatStatLabel).join(' / ') || '—' },
      { label: 'Cálice', vals: b.goblet_stat?.map(formatStatLabel).join(' / ') || '—' },
      { label: 'Coroa', vals: b.circlet_stat?.map(formatStatLabel).join(' / ') || '—' },
    ]
    const msH = 104
    fillRoundedRect(ctx, x + pad, cy, innerW, msH, 13, 'rgba(6, 10, 22, 0.56)', 'rgba(148, 163, 184, 0.14)', 1)
    ctx.save()
    ctx.fillStyle = '#94a3b8'
    ctx.font = '700 10px "Inter", system-ui, sans-serif'
    ctx.fillText('MAIN STATS', x + pad + 12, cy + 18)
    mainRows.forEach((mr, i) => {
      const ry = cy + 40 + i * 24
      ctx.fillStyle = '#94a3b8'
      ctx.font = '600 12px "Inter", system-ui, sans-serif'
      ctx.fillText(mr.label, x + pad + 12, ry)
      ctx.fillStyle = '#f8fafc'
      ctx.font = '700 12.5px "Inter", system-ui, sans-serif'
      const txt = truncateText(ctx, mr.vals, innerW - 104)
      const tw = ctx.measureText(txt).width
      ctx.fillText(txt, x + pad + innerW - tw - 12, ry)
    })
    ctx.restore()
    cy += msH + 10

    // --- D. SUBSTATS + REQUISITOS ---
    const remH = Math.max(84, y + h - cy - 14)
    fillRoundedRect(ctx, x + pad, cy, innerW, remH, 13, `${el.main}12`, `${el.main}3a`, 1)
    ctx.save()
    let ty = cy + 20
    if (b.substat_priority?.length) {
      ctx.fillStyle = '#94a3b8'
      ctx.font = '700 10px "Inter", system-ui, sans-serif'
      ctx.fillText('PRIORIDADE DE SUBSTATS', x + pad + 12, ty)
      ty += 19
      ctx.fillStyle = '#ffffff'
      ctx.font = '700 12.5px "Inter", system-ui, sans-serif'
      const subStr = b.substat_priority.map(formatStatLabel).join(' › ')
      ctx.fillText(truncateText(ctx, subStr, innerW - 24), x + pad + 12, ty)
      ty += 24
    }
    if (b.er_requirement && ty < cy + remH - 12) {
      ctx.fillStyle = '#94a3b8'
      ctx.font = '700 11.5px "Inter", system-ui, sans-serif'
      ctx.fillText('Recarga:', x + pad + 12, ty)
      ctx.fillStyle = '#7dd3fc'
      ctx.font = '700 12px "Inter", system-ui, sans-serif'
      ctx.fillText(truncateText(ctx, b.er_requirement, innerW - 82), x + pad + 72, ty)
      ty += 22
    }
    if (b.talent_priority && ty < cy + remH - 6) {
      ctx.fillStyle = '#94a3b8'
      ctx.font = '700 11.5px "Inter", system-ui, sans-serif'
      ctx.fillText('Talentos:', x + pad + 12, ty)
      ctx.fillStyle = '#fde68a'
      ctx.font = '700 12px "Inter", system-ui, sans-serif'
      ctx.fillText(truncateText(ctx, b.talent_priority, innerW - 84), x + pad + 74, ty)
    }
    ctx.restore()
  } else {
    const emptyH = Math.max(120, y + h - cy - 16)
    fillRoundedRect(ctx, x + pad, cy, innerW, emptyH, 13, 'rgba(6, 10, 22, 0.45)', 'rgba(148, 163, 184, 0.14)', 1)
    ctx.save()
    ctx.fillStyle = '#94a3b8'
    ctx.font = '600 13px "Inter", system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('Build ainda não configurada', x + w / 2, cy + emptyH / 2 - 6)
    ctx.fillStyle = '#64748b'
    ctx.font = '500 11.5px "Inter", system-ui, sans-serif'
    ctx.fillText('Importe via Enka/GOOD ou edite o time', x + w / 2, cy + emptyH / 2 + 16)
    ctx.restore()
  }

  ctx.restore()
}

export async function renderTeamCardToCanvas(
  canvas: HTMLCanvasElement,
  data: TeamCardData,
  options: TeamCardOptions = {},
  scale = 1,
): Promise<void> {
  const layout: TeamCardLayout = options.layout ?? 'wide'
  const sourceMode: TeamCardSourceMode = options.sourceMode ?? 'guide'
  const notesText = (options.customNotes ?? data.description ?? '').trim()
  const showNotes = (options.showNotes ?? true) && notesText.length > 0
  const showMeta = options.showMeta ?? true
  const showUid = options.showUid ?? true

  const { width: W, height: H } = getTeamCardDimensions(layout, showNotes)
  canvas.width = Math.round(W * scale)
  canvas.height = Math.round(H * scale)

  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.save()
  ctx.scale(scale, scale)

  const members = data.members.slice(0, 4)
  const mainEl = members[0]?.character.element || 'anemo'
  const palette = getThemePalette(mainEl, options.theme ?? 'auto')

  // Preload paralelo de todas as imagens dos 4 membros
  const resolvedModes = members.map((m) => resolveMemberMode(m, sourceMode))
  const assetsList = await Promise.all(
    members.map((m, idx) =>
      preloadMemberAssets(
        m,
        data,
        resolvedModes[idx],
        options.artOverrides?.[m.character.slug],
      ),
    ),
  )

  // 1. FUNDO CINEMATOGRÁFICO + REFLEXO AMBIENTAL DA ARTE DO DPS + BRILHO ELEMENTAL POR COLUNA
  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, palette.bgMid)
  bg.addColorStop(0.42, palette.bgDeep)
  bg.addColorStop(1, palette.bgEdge)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // Reflexo ambiental desfocado da arte do Main DPS (dá profundidade e coesão de cor!)
  const mainHero = assetsList[0]?.heroImg
  if (mainHero) {
    ctx.save()
    ctx.globalAlpha = 0.15
    ctx.filter = 'blur(42px) saturate(1.3)'
    const coverScale = Math.max(W / (mainHero.naturalWidth || 1), H / (mainHero.naturalHeight || 1)) * 1.1
    const bw = (mainHero.naturalWidth || 1) * coverScale
    const bh = (mainHero.naturalHeight || 1) * coverScale
    ctx.drawImage(mainHero, (W - bw) / 2, (H - bh) / 2, bw, bh)
    ctx.restore()
  }

  // Halo elemental individual atrás de cada coluna de personagem
  members.forEach((m, idx) => {
    const elAccent = ELEMENT_ACCENT[(m.character.element || '').toLowerCase()]?.main ?? palette.accent
    const gx = ((idx + 0.5) / Math.max(1, members.length)) * W
    const gy = layout === 'wide' ? 260 : idx < 2 ? 320 : H - 300
    const rad = ctx.createRadialGradient(gx, gy, 24, gx, gy, 440)
    rad.addColorStop(0, `${elAccent}26`)
    rad.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = rad
    ctx.fillRect(0, 0, W, H)
  })

  drawAstralBackdrop(ctx, W, H, palette)

  // Moldura dupla ornamental
  const frameGrad = ctx.createLinearGradient(0, 0, W, H)
  frameGrad.addColorStop(0, `${palette.accentSoft}55`)
  frameGrad.addColorStop(0.5, 'rgba(255,255,255,0.12)')
  frameGrad.addColorStop(1, `${palette.accent}45`)
  fillRoundedRect(ctx, 14, 14, W - 28, H - 28, 28, 'rgba(2, 6, 23, 0.24)', frameGrad, 1.4)

  // Filigranas nos 4 cantos
  drawCornerOrnament(ctx, 26, 26, 1, 1, palette.accentSoft)
  drawCornerOrnament(ctx, W - 26, 26, -1, 1, palette.accentSoft)
  drawCornerOrnament(ctx, 26, H - 26, 1, -1, palette.accentSoft)
  drawCornerOrnament(ctx, W - 26, H - 26, -1, -1, palette.accentSoft)

  // 2. CABEÇALHO MONUMENTAL DO TIME
  const outerPad = 42
  const headerTop = 38
  const titleText = (options.customTitle ?? data.name).trim() || 'Meu Time'

  // Assinatura / UID em card de vidro no canto superior direito
  const nick = (options.nickname || '').trim()
  const uid = showUid ? (options.uid || '').trim() : ''
  const modeLabel = sourceMode === 'account' ? 'MINHA CONTA · ENKA/GOOD' : 'GUIA DE TIME'

  let rightReserve = 240
  if (nick || uid) {
    ctx.save()
    ctx.font = '700 15px "Inter", system-ui, sans-serif'
    const topStr = nick || `UID ${uid}`
    const w1 = ctx.measureText(topStr).width
    ctx.font = '600 12px "Inter", system-ui, sans-serif'
    const botStr = nick && uid ? `UID ${uid}` : modeLabel
    const w2 = ctx.measureText(botStr).width
    const boxW = Math.max(190, Math.ceil(Math.max(w1, w2) + 34))
    const boxH = 58
    const bx = W - outerPad - boxW
    const by = headerTop + 6
    fillRoundedRect(ctx, bx, by, boxW, boxH, 14, 'rgba(6, 10, 22, 0.65)', `${palette.accent}48`, 1.1)

    ctx.textAlign = 'right'
    ctx.fillStyle = '#ffffff'
    ctx.font = '700 15px "Inter", system-ui, sans-serif'
    ctx.fillText(topStr, bx + boxW - 14, by + 25)
    ctx.fillStyle = palette.accentSoft
    ctx.font = '700 11.5px "Inter", system-ui, sans-serif'
    ctx.fillText(botStr, bx + boxW - 14, by + 44)
    ctx.restore()
    rightReserve = boxW + 28
  } else {
    ctx.save()
    ctx.font = '800 11px "Inter", system-ui, sans-serif'
    const pw = Math.ceil(ctx.measureText(modeLabel).width + 24)
    ctx.restore()
    drawPill(
      ctx,
      W - outerPad - pw,
      headerTop + 20,
      modeLabel,
      `${palette.accent}22`,
      `${palette.accent}70`,
      palette.accentSoft,
      '800 11px "Inter", system-ui, sans-serif',
      28,
      12,
    )
    rightReserve = pw + 28
  }

  // Emblema de Tier (se existir) ao lado esquerdo do título
  let titleStartX = outerPad
  if (showMeta && data.tier) {
    const tKey = data.tier.toUpperCase()
    const tp = TIER_PALETTE[tKey] ?? TIER_PALETTE.A
    const badgeW = 64
    const badgeH = 54
    fillRoundedRect(ctx, outerPad, headerTop + 8, badgeW, badgeH, 14, tp.bg, `${tp.main}99`, 1.5)
    ctx.save()
    ctx.textAlign = 'center'
    ctx.fillStyle = tp.soft
    ctx.font = '800 9.5px "Inter", system-ui, sans-serif'
    ctx.fillText('TIER', outerPad + badgeW / 2, headerTop + 24)
    ctx.fillStyle = tp.main
    ctx.shadowColor = tp.main
    ctx.shadowBlur = 10
    ctx.font = '900 24px "Inter", system-ui, sans-serif'
    ctx.fillText(tKey, outerPad + badgeW / 2, headerTop + 50)
    ctx.restore()
    titleStartX = outerPad + badgeW + 16
  }

  // Título Principal com brilho sutil
  ctx.save()
  ctx.shadowColor = 'rgba(0, 0, 0, 0.7)'
  ctx.shadowBlur = 12
  ctx.fillStyle = '#ffffff'
  ctx.font = '800 34px "Inter", system-ui, sans-serif'
  ctx.fillText(truncateText(ctx, titleText, W - titleStartX - outerPad - rightReserve), titleStartX, headerTop + 36)
  ctx.restore()

  // Pills de Metadados (Arquétipo, Sinergia, Reações com pontinho luminoso)
  let px = titleStartX
  const pillY = headerTop + 48
  if (showMeta) {
    if (data.archetypeLabel) {
      px +=
        drawPill(
          ctx,
          px,
          pillY,
          data.archetypeLabel,
          `${palette.accent}24`,
          `${palette.accent}78`,
          palette.accentSoft,
          '700 12px "Inter", system-ui, sans-serif',
          26,
          11,
          palette.accent,
        ) + 8
    }
    if (typeof data.synergyScore === 'number' && data.synergyScore > 0) {
      px +=
        drawPill(
          ctx,
          px,
          pillY,
          `Sinergia ${data.synergyScore}/100`,
          'rgba(16, 185, 129, 0.16)',
          'rgba(52, 211, 153, 0.52)',
          '#6ee7b7',
          '700 12px "Inter", system-ui, sans-serif',
          26,
          11,
          '#34d399',
        ) + 8
    }
    for (const reac of (data.reactions ?? []).slice(0, 4)) {
      if (px > W - outerPad - rightReserve - 130) break
      px +=
        drawPill(
          ctx,
          px,
          pillY,
          reac,
          'rgba(15, 23, 42, 0.76)',
          'rgba(148, 163, 184, 0.28)',
          '#e2e8f0',
          '600 11.5px "Inter", system-ui, sans-serif',
          26,
          10,
        ) + 7
    }
  }

  // Divisor ornamental abaixo do cabeçalho (linha gradiente + losango central)
  const divY = headerTop + 88
  const divGrad = ctx.createLinearGradient(outerPad, divY, W - outerPad, divY)
  divGrad.addColorStop(0, `${palette.accent}00`)
  divGrad.addColorStop(0.2, `${palette.accent}60`)
  divGrad.addColorStop(0.5, `${palette.accentSoft}b0`)
  divGrad.addColorStop(0.8, `${palette.accent}60`)
  divGrad.addColorStop(1, `${palette.accent}00`)
  ctx.fillStyle = divGrad
  ctx.fillRect(outerPad, divY, W - outerPad * 2, 1.5)
  drawFourPointStar(ctx, W / 2, divY + 0.75, 6.5, 2, palette.accentSoft, 0.95)

  // 3. GRADE DOS 4 PERSONAGENS
  const gridTop = divY + 18
  const footerReserve = showNotes ? 104 : 46
  const gridH = H - gridTop - footerReserve
  const gridW = W - outerPad * 2

  if (layout === 'wide') {
    const count = Math.max(1, members.length)
    const gap = 20
    const cardW = (gridW - gap * (count - 1)) / count
    members.forEach((m, idx) => {
      drawMemberCard(
        ctx,
        outerPad + idx * (cardW + gap),
        gridTop,
        cardW,
        gridH,
        m,
        data,
        assetsList[idx],
        resolvedModes[idx],
        true,
        options.artOverrides?.[m.character.slug],
      )
    })
  } else {
    const gap = 20
    const cardW = (gridW - gap) / 2
    const cardH = (gridH - gap) / 2
    members.forEach((m, idx) => {
      const col = idx % 2
      const row = Math.floor(idx / 2)
      drawMemberCard(
        ctx,
        outerPad + col * (cardW + gap),
        gridTop + row * (cardH + gap),
        cardW,
        cardH,
        m,
        data,
        assetsList[idx],
        resolvedModes[idx],
        false,
        options.artOverrides?.[m.character.slug],
      )
    })
  }

  // 4. RODAPÉ REFINADO (ROTAÇÃO / NOTAS + MARCA D'ÁGUA)
  if (showNotes) {
    const noteY = H - 88
    fillRoundedRect(
      ctx,
      outerPad,
      noteY,
      W - outerPad * 2,
      46,
      13,
      'rgba(6, 10, 22, 0.72)',
      `${palette.accent}42`,
      1.1,
    )
    drawPill(
      ctx,
      outerPad + 10,
      noteY + 10,
      'ROTAÇÃO / NOTAS',
      `${palette.accent}24`,
      `${palette.accent}68`,
      palette.accentSoft,
      '800 10.5px "Inter", system-ui, sans-serif',
      26,
      10,
    )
    ctx.save()
    ctx.fillStyle = '#e2e8f0'
    ctx.font = '600 13.5px "Inter", system-ui, sans-serif'
    ctx.textBaseline = 'middle'
    ctx.fillText(truncateText(ctx, notesText, W - outerPad * 2 - 174), outerPad + 152, noteY + 23.5)
    ctx.restore()
  }

  ctx.save()
  ctx.fillStyle = 'rgba(148, 163, 184, 0.72)'
  ctx.font = '600 11.5px "Inter", system-ui, sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText('Genshin Smart Team Builder · Team Showcase HD', W - outerPad, H - 22)
  ctx.restore()

  ctx.restore()
}

async function renderToBlob(data: TeamCardData, options: TeamCardOptions): Promise<Blob | null> {
  const offscreen = document.createElement('canvas')
  await renderTeamCardToCanvas(offscreen, data, options, 2)
  return new Promise((resolve) => offscreen.toBlob((blob) => resolve(blob), 'image/png'))
}

export async function downloadTeamCardPng(
  data: TeamCardData,
  options: TeamCardOptions,
): Promise<void> {
  const blob = await renderToBlob(data, options)
  if (!blob) return
  const safeName = (options.customTitle || data.name || 'time')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `team-${safeName || 'genshin'}-${options.layout || 'wide'}.png`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function copyTeamCardToClipboard(
  data: TeamCardData,
  options: TeamCardOptions,
): Promise<'copied' | 'unsupported'> {
  if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) {
    return 'unsupported'
  }
  const blob = await renderToBlob(data, options)
  if (!blob) return 'unsupported'
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
    return 'copied'
  } catch {
    return 'unsupported'
  }
}
