import { artifactIconUrl, iconUrl } from '../config'
import { formatStatLabel } from './stats'
import {
  BUILD_CARD_THEMES,
  loadSavedCustomArt,
  type BuildCardTheme,
  type ThemePalette,
} from './build-card-png'
import {
  formatCanonicalStatValue,
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

export interface TeamCardMemberInput {
  position: number
  character: CharacterSummary
  role?: string | null
  guideBuild?: CharacterBuild | null
  accountStats?: ComputedCharStats | null
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
}

export function getTeamCardDimensions(layout: TeamCardLayout, hasNotes: boolean): { width: number; height: number } {
  if (layout === 'grid2x2') {
    return { width: 1520, height: hasNotes ? 1290 : 1210 }
  }
  return { width: 1840, height: hasNotes ? 980 : 900 }
}

const ELEMENT_ACCENT: Record<string, string> = {
  pyro: '#fb923c',
  hydro: '#38bdf8',
  cryo: '#67e8f9',
  electro: '#c084fc',
  anemo: '#34d399',
  geo: '#fbbf24',
  dendro: '#a3e635',
}

const ROLE_LABELS: Record<string, string> = {
  dps: 'MAIN DPS',
  sub: 'SUB-DPS',
  healer: 'HEALER',
  shielder: 'SHIELDER',
  support: 'SUPORTE',
}

const TIER_COLORS: Record<string, string> = {
  SS: '#fbbf24',
  S: '#f472b6',
  A: '#818cf8',
  B: '#38bdf8',
  C: '#94a3b8',
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
  const cached = imageCache.get(src)
  if (cached) return cached
  const p = new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image()
    if (!src.startsWith('data:')) {
      img.crossOrigin = 'anonymous'
    }
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
  imageCache.set(src, p)
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
  stroke?: string,
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

function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  alignY = 0.22,
) {
  const scale = Math.max(w / img.width, h / img.height)
  const dw = img.width * scale
  const dh = img.height * scale
  const dx = x + (w - dw) / 2
  const dy = y + (h - dh) * alignY
  ctx.drawImage(img, dx, dy, dw, dh)
}

function drawStarfield(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.save()
  let seed = 7331
  const rand = () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
  for (let i = 0; i < 90; i++) {
    const sx = rand() * w
    const sy = rand() * h
    const sr = 0.7 + rand() * 1.6
    ctx.fillStyle = `rgba(255, 255, 255, ${(0.08 + rand() * 0.28).toFixed(2)})`
    ctx.beginPath()
    ctx.arc(sx, sy, sr, 0, Math.PI * 2)
    ctx.fill()
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
  height = 26,
  padX = 11,
): number {
  ctx.save()
  ctx.font = font
  const tw = ctx.measureText(text).width
  const w = Math.ceil(tw + padX * 2)
  fillRoundedRect(ctx, x, y, w, height, height / 2, bg, border, 1)
  ctx.fillStyle = textColor
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x + padX, y + height / 2 + 0.5)
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
  avatarImg: HTMLImageElement | null
  weaponImg: HTMLImageElement | null
  setImgs: (HTMLImageElement | null)[]
  pieceImgs: (HTMLImageElement | null)[]
}

async function preloadMemberAssets(
  member: TeamCardMemberInput,
  data: TeamCardData,
  mode: 'account' | 'guide' | 'empty',
): Promise<MemberAssets> {
  const customArt = loadSavedCustomArt(member.character.slug)
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
    for (const p of st.pieces.slice(0, 5)) {
      pieceUrls.push(artifactIconUrl(p.setIcon))
    }
  } else if (mode === 'guide' && member.guideBuild) {
    const b = member.guideBuild
    const primaryW = b.weapons?.[0]
    if (primaryW?.weapon_slug) {
      const wMeta = data.weaponsLookup.get(primaryW.weapon_slug)
      weaponIconUrl = iconUrl(wMeta?.icon)
    }
    if (b.artifacts_4pc?.[0]?.artifact_set_slug) {
      const aMeta = data.artifactsLookup.get(b.artifacts_4pc[0].artifact_set_slug)
      setUrls.push(artifactIconUrl(aMeta?.icon))
    } else if (b.artifacts_2pc?.[0]) {
      const s1Slug = b.artifacts_2pc[0].set1_slug
      const s2Slug = b.artifacts_2pc[0].set2_slug
      const a1 = s1Slug ? data.artifactsLookup.get(s1Slug) : undefined
      const a2 = s2Slug ? data.artifactsLookup.get(s2Slug) : undefined
      setUrls.push(artifactIconUrl(a1?.icon), artifactIconUrl(a2?.icon))
    }
  }

  const [customImg, splashImg, avatarImg, weaponImg, ...rest] = await Promise.all([
    loadImageSafe(customArt),
    loadImageSafe(splashUrl),
    loadImageSafe(avatarUrl),
    loadImageSafe(weaponIconUrl),
    ...setUrls.map((u) => loadImageSafe(u)),
    ...pieceUrls.map((u) => loadImageSafe(u)),
  ])

  const setImgs = rest.slice(0, setUrls.length)
  const pieceImgs = rest.slice(setUrls.length)
  const heroImg = customImg || splashImg || avatarImg
  const heroIsSplash = Boolean(customImg || splashImg)

  return {
    heroImg,
    heroIsSplash,
    avatarImg,
    weaponImg,
    setImgs,
    pieceImgs,
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
) {
  const elKey = (member.character.element || 'anemo').toLowerCase()
  const elColor = ELEMENT_ACCENT[elKey] ?? '#818cf8'
  const isMain = member.position === 1

  // Card base
  const cardBg = ctx.createLinearGradient(x, y, x, y + h)
  cardBg.addColorStop(0, 'rgba(20, 29, 50, 0.92)')
  cardBg.addColorStop(1, 'rgba(10, 15, 30, 0.96)')
  fillRoundedRect(ctx, x, y, w, h, 20, cardBg, isMain ? `${elColor}88` : 'rgba(148, 163, 184, 0.22)', isMain ? 1.8 : 1.1)

  // Clip inner content
  ctx.save()
  roundRectPath(ctx, x, y, w, h, 20)
  ctx.clip()

  // 1. Hero Splash Header
  const heroH = isWide ? 228 : 196
  const heroGrad = ctx.createRadialGradient(x + w * 0.5, y + heroH * 0.35, 16, x + w * 0.5, y + heroH * 0.5, w * 0.72)
  heroGrad.addColorStop(0, `${elColor}45`)
  heroGrad.addColorStop(1, 'rgba(10, 15, 30, 0.85)')
  ctx.fillStyle = heroGrad
  ctx.fillRect(x, y, w, heroH)

  if (assets.heroImg) {
    ctx.save()
    ctx.beginPath()
    ctx.rect(x, y, w, heroH)
    ctx.clip()
    if (assets.heroIsSplash) {
      drawCoverImage(ctx, assets.heroImg, x, y, w, heroH, 0.18)
    } else {
      // Avatar fallback centralizado com aura
      const avSize = heroH - 28
      ctx.drawImage(assets.heroImg, x + (w - avSize) / 2, y + 14, avSize, avSize)
    }
    ctx.restore()
  }

  // Gradiente inferior do hero para legibilidade do nome
  const fade = ctx.createLinearGradient(x, y + heroH * 0.42, x, y + heroH)
  fade.addColorStop(0, 'rgba(10, 15, 30, 0)')
  fade.addColorStop(0.65, 'rgba(12, 18, 34, 0.75)')
  fade.addColorStop(1, 'rgba(14, 21, 38, 0.98)')
  ctx.fillStyle = fade
  ctx.fillRect(x, y + heroH * 0.42, w, heroH * 0.58)

  // Linha de acento elemental no topo do card
  ctx.fillStyle = elColor
  ctx.fillRect(x, y, w, 4)

  // Badges do topo (Role à esquerda, Nível/Const ou Raridade à direita)
  const roleKey = (member.role || (isMain ? 'dps' : 'support')).toLowerCase()
  const roleLabel = ROLE_LABELS[roleKey] ?? (isMain ? 'MAIN DPS' : `SLOT ${member.position}`)
  drawPill(
    ctx,
    x + 14,
    y + 14,
    roleLabel,
    'rgba(2, 6, 23, 0.78)',
    `${elColor}80`,
    elColor,
    '800 11px "Inter", system-ui, sans-serif',
    24,
    10,
  )

  if (mode === 'account' && member.accountStats) {
    const lvCons = `Lv.${member.accountStats.level} · C${member.accountStats.cons}`
    ctx.save()
    ctx.font = '800 11.5px "Inter", system-ui, sans-serif'
    const pw = Math.ceil(ctx.measureText(lvCons).width + 20)
    ctx.restore()
    drawPill(
      ctx,
      x + w - pw - 14,
      y + 14,
      lvCons,
      'rgba(2, 6, 23, 0.82)',
      'rgba(251, 191, 36, 0.55)',
      '#fde68a',
      '800 11.5px "Inter", system-ui, sans-serif',
      24,
      10,
    )
  } else {
    const badgeTxt = mode === 'guide' ? 'GUIA' : `${'★'.repeat(member.character.rarity || 5)}`
    ctx.save()
    ctx.font = '800 11px "Inter", system-ui, sans-serif'
    const pw = Math.ceil(ctx.measureText(badgeTxt).width + 18)
    ctx.restore()
    drawPill(
      ctx,
      x + w - pw - 14,
      y + 14,
      badgeTxt,
      'rgba(2, 6, 23, 0.78)',
      'rgba(148, 163, 184, 0.45)',
      '#e2e8f0',
      '800 11px "Inter", system-ui, sans-serif',
      24,
      9,
    )
  }

  // Nome do personagem + estrelas
  ctx.save()
  ctx.fillStyle = '#fbbf24'
  ctx.font = '700 13px "Inter", system-ui, sans-serif'
  ctx.fillText('★'.repeat(member.character.rarity || 5), x + 16, y + heroH - 42)

  ctx.fillStyle = '#f8fafc'
  ctx.font = '800 22px "Inter", system-ui, sans-serif'
  ctx.fillText(truncateText(ctx, member.character.name, w - 32), x + 16, y + heroH - 16)
  ctx.restore()

  // 2. Corpo do card
  const pad = 16
  let cy = y + heroH + 12
  const innerW = w - pad * 2

  if (mode === 'account' && member.accountStats) {
    const st = member.accountStats

    // --- Arma equipada ---
    const wBoxH = 66
    fillRoundedRect(
      ctx,
      x + pad,
      cy,
      innerW,
      wBoxH,
      12,
      'rgba(2, 6, 23, 0.52)',
      'rgba(148, 163, 184, 0.16)',
      1,
    )
    const iconBox = 48
    const wRarityColor = st.weapon?.rarity === 5 ? '#f59e0b' : st.weapon?.rarity === 4 ? '#a855f7' : '#38bdf8'
    fillRoundedRect(ctx, x + pad + 9, cy + 9, iconBox, iconBox, 10, `${wRarityColor}22`, `${wRarityColor}70`, 1.2)
    if (assets.weaponImg) {
      ctx.drawImage(assets.weaponImg, x + pad + 12, cy + 12, iconBox - 6, iconBox - 6)
    }
    ctx.save()
    ctx.fillStyle = '#f8fafc'
    ctx.font = '700 14px "Inter", system-ui, sans-serif'
    const wName = st.weapon?.name ?? 'Arma não equipada'
    ctx.fillText(truncateText(ctx, wName, innerW - 76), x + pad + 68, cy + 28)

    ctx.fillStyle = '#94a3b8'
    ctx.font = '600 12px "Inter", system-ui, sans-serif'
    const wMetaStr = st.weapon
      ? `Lv.${st.weapon.level} · R${st.weapon.refinement} · ATQ ${Math.round(st.weapon.baseAtk)}`
      : 'Importe via Enka/GOOD'
    ctx.fillText(truncateText(ctx, wMetaStr, innerW - 76), x + pad + 68, cy + 48)
    ctx.restore()
    cy += wBoxH + 10

    // --- Sets de Artefatos + CV ---
    const aBoxH = 64
    fillRoundedRect(
      ctx,
      x + pad,
      cy,
      innerW,
      aBoxH,
      12,
      'rgba(2, 6, 23, 0.52)',
      'rgba(148, 163, 184, 0.16)',
      1,
    )
    const activeSets = st.activeSets.slice(0, 2)
    if (assets.setImgs[0]) {
      ctx.drawImage(assets.setImgs[0], x + pad + 10, cy + 10, 44, 44)
    } else {
      fillRoundedRect(ctx, x + pad + 10, cy + 10, 44, 44, 10, 'rgba(148,163,184,0.1)', 'rgba(148,163,184,0.2)', 1)
    }
    ctx.save()
    const setTextX = x + pad + 64
    const cvTag = st.hasArtifacts ? `CV ${st.totalCritValue.toFixed(1)}` : ''
    const maxSetW = innerW - 74 - (cvTag ? 72 : 0)
    if (activeSets.length === 0) {
      ctx.fillStyle = '#94a3b8'
      ctx.font = '600 13px "Inter", system-ui, sans-serif'
      ctx.fillText('Artefatos variados (sem bônus)', setTextX, cy + 36)
    } else if (activeSets.length === 1) {
      ctx.fillStyle = '#a3e635'
      ctx.font = '700 13.5px "Inter", system-ui, sans-serif'
      ctx.fillText(truncateText(ctx, `${activeSets[0].pieces}pc ${activeSets[0].name}`, maxSetW), setTextX, cy + 28)
      ctx.fillStyle = '#94a3b8'
      ctx.font = '600 11.5px "Inter", system-ui, sans-serif'
      ctx.fillText(`${st.pieces.length}/5 peças · média +${Math.round(st.avgArtifactLevel)}`, setTextX, cy + 47)
    } else {
      ctx.fillStyle = '#a3e635'
      ctx.font = '700 12.5px "Inter", system-ui, sans-serif'
      ctx.fillText(truncateText(ctx, `${activeSets[0].pieces}pc ${activeSets[0].name}`, maxSetW), setTextX, cy + 25)
      ctx.fillText(truncateText(ctx, `${activeSets[1].pieces}pc ${activeSets[1].name}`, maxSetW), setTextX, cy + 45)
    }
    ctx.restore()

    if (cvTag) {
      const cvColor = st.totalCritValue >= 200 ? '#fbbf24' : st.totalCritValue >= 150 ? '#38bdf8' : '#cbd5e1'
      drawPill(
        ctx,
        x + pad + innerW - 76,
        cy + 19,
        cvTag,
        'rgba(15, 23, 42, 0.9)',
        `${cvColor}66`,
        cvColor,
        '800 11.5px "Inter", system-ui, sans-serif',
        25,
        8,
      )
    }
    cy += aBoxH + 10

    // --- Talentos ---
    const talH = 34
    fillRoundedRect(ctx, x + pad, cy, innerW, talH, 10, `${elColor}14`, `${elColor}38`, 1)
    ctx.save()
    ctx.fillStyle = '#94a3b8'
    ctx.font = '700 11px "Inter", system-ui, sans-serif'
    ctx.textBaseline = 'middle'
    ctx.fillText('TALENTOS', x + pad + 12, cy + talH / 2 + 0.5)
    ctx.fillStyle = '#f8fafc'
    ctx.font = '800 13.5px "Inter", system-ui, sans-serif'
    const talStr = `NA ${st.talents.na}   ·   Skill ${st.talents.es}   ·   Burst ${st.talents.eb}`
    const talW = ctx.measureText(talStr).width
    ctx.fillText(talStr, x + pad + innerW - talW - 12, cy + talH / 2 + 0.5)
    ctx.restore()
    cy += talH + 10

    // --- Grid de 6 Stats principais ---
    const elemBonusVal = st.elemDmgBonus > 0
      ? formatCanonicalStatValue(st.elemDmgKey, st.elemDmgBonus)
      : st.physicalDmgBonus > 0
        ? `${st.physicalDmgBonus.toFixed(1)}%`
        : `${Math.round(st.totalDef).toLocaleString('pt-BR')}`
    const elemBonusLabel = st.elemDmgBonus > 0
      ? `Dano ${elKey.charAt(0).toUpperCase() + elKey.slice(1)}`
      : st.physicalDmgBonus > 0
        ? 'Dano Físico'
        : 'DEF'

    const statCells: Array<{ label: string; val: string; hi?: boolean }> = [
      { label: 'Vida Máx.', val: Math.round(st.totalHp).toLocaleString('pt-BR') },
      { label: 'ATQ', val: Math.round(st.totalAtk).toLocaleString('pt-BR') },
      { label: 'Taxa Crít.', val: `${st.critRate.toFixed(1)}%`, hi: true },
      { label: 'Dano Crít.', val: `${st.critDmg.toFixed(1)}%`, hi: true },
      { label: 'Recarga (ER)', val: `${st.er.toFixed(1)}%` },
      { label: 'Proficiência', val: Math.round(st.em).toLocaleString('pt-BR') },
      { label: elemBonusLabel, val: elemBonusVal },
      { label: 'Bônus Cura', val: st.healingBonus > 0 ? `${st.healingBonus.toFixed(1)}%` : '0.0%' },
    ]

    const cols = 2
    const rows = isWide ? 4 : 3
    const shownCells = statCells.slice(0, cols * rows)
    const gap = 8
    const cellW = (innerW - gap) / 2
    const availH = y + h - cy - 14
    const cellH = Math.max(36, Math.min(48, (availH - gap * (rows - 1)) / rows))

    shownCells.forEach((cell, idx) => {
      const col = idx % 2
      const row = Math.floor(idx / 2)
      const cx = x + pad + col * (cellW + gap)
      const rcy = cy + row * (cellH + gap)
      fillRoundedRect(
        ctx,
        cx,
        rcy,
        cellW,
        cellH,
        10,
        cell.hi ? `${elColor}16` : 'rgba(2, 6, 23, 0.45)',
        cell.hi ? `${elColor}42` : 'rgba(148, 163, 184, 0.13)',
        1,
      )
      ctx.save()
      ctx.fillStyle = '#94a3b8'
      ctx.font = '600 10.5px "Inter", system-ui, sans-serif'
      ctx.fillText(cell.label, cx + 10, rcy + 15)
      ctx.fillStyle = cell.hi ? '#ffffff' : '#e2e8f0'
      ctx.font = '800 14.5px "Inter", system-ui, sans-serif'
      ctx.fillText(cell.val, cx + 10, rcy + cellH - 9)
      ctx.restore()
    })
  } else if (mode === 'guide' && member.guideBuild) {
    const b = member.guideBuild

    // --- Arma Recomendada ---
    const wBoxH = 68
    fillRoundedRect(ctx, x + pad, cy, innerW, wBoxH, 12, 'rgba(2, 6, 23, 0.52)', 'rgba(148, 163, 184, 0.16)', 1)
    const primaryW = b.weapons?.[0]
    const wMeta = primaryW?.weapon_slug ? data.weaponsLookup.get(primaryW.weapon_slug) : undefined
    const altW = b.weapons?.[1]
    const altWMeta = altW?.weapon_slug ? data.weaponsLookup.get(altW.weapon_slug) : undefined
    const wRarityColor = wMeta?.rarity === 5 ? '#f59e0b' : wMeta?.rarity === 4 ? '#a855f7' : '#38bdf8'

    fillRoundedRect(ctx, x + pad + 9, cy + 10, 48, 48, 10, `${wRarityColor}22`, `${wRarityColor}70`, 1.2)
    if (assets.weaponImg) {
      ctx.drawImage(assets.weaponImg, x + pad + 12, cy + 13, 42, 42)
    }
    ctx.save()
    ctx.fillStyle = '#94a3b8'
    ctx.font = '700 10px "Inter", system-ui, sans-serif'
    ctx.fillText('ARMA RECOMENDADA', x + pad + 68, cy + 18)
    ctx.fillStyle = '#f8fafc'
    ctx.font = '700 14px "Inter", system-ui, sans-serif'
    const primaryName = wMeta?.name ?? (primaryW?.weapon_slug?.replace(/-/g, ' ') || 'Flexível')
    const primaryRef = (primaryW as { refinement?: number } | undefined)?.refinement
    const refStr = primaryRef ? ` R${primaryRef}` : ''
    ctx.fillText(truncateText(ctx, `${primaryName}${refStr}`, innerW - 78), x + pad + 68, cy + 36)
    if (altW?.weapon_slug) {
      ctx.fillStyle = '#94a3b8'
      ctx.font = '600 11.5px "Inter", system-ui, sans-serif'
      const altName = altWMeta?.name ?? altW.weapon_slug.replace(/-/g, ' ')
      ctx.fillText(truncateText(ctx, `Alt: ${altName}`, innerW - 78), x + pad + 68, cy + 54)
    }
    ctx.restore()
    cy += wBoxH + 10

    // --- Artefatos Recomendados ---
    const aBoxH = 66
    fillRoundedRect(ctx, x + pad, cy, innerW, aBoxH, 12, 'rgba(2, 6, 23, 0.52)', 'rgba(148, 163, 184, 0.16)', 1)
    if (assets.setImgs[0]) {
      ctx.drawImage(assets.setImgs[0], x + pad + 10, cy + 11, 44, 44)
    } else {
      fillRoundedRect(ctx, x + pad + 10, cy + 11, 44, 44, 10, 'rgba(148,163,184,0.1)', 'rgba(148,163,184,0.2)', 1)
    }
    ctx.save()
    ctx.fillStyle = '#94a3b8'
    ctx.font = '700 10px "Inter", system-ui, sans-serif'
    ctx.fillText('ARTEFATOS', x + pad + 64, cy + 18)
    ctx.fillStyle = '#a3e635'
    ctx.font = '700 13.5px "Inter", system-ui, sans-serif'
    const a4First = b.artifacts_4pc?.[0]?.artifact_set_slug
    const a4Second = b.artifacts_4pc?.[1]?.artifact_set_slug
    if (a4First) {
      const a1 = data.artifactsLookup.get(a4First)
      const a1Name = a1?.name ?? a4First.replace(/-/g, ' ')
      ctx.fillText(truncateText(ctx, `4pc ${a1Name}`, innerW - 74), x + pad + 64, cy + 37)
      if (a4Second) {
        const a2 = data.artifactsLookup.get(a4Second)
        const a2Name = a2?.name ?? a4Second.replace(/-/g, ' ')
        ctx.fillStyle = '#94a3b8'
        ctx.font = '600 11.5px "Inter", system-ui, sans-serif'
        ctx.fillText(truncateText(ctx, `Alt: 4pc ${a2Name}`, innerW - 74), x + pad + 64, cy + 54)
      }
    } else if (b.artifacts_2pc?.[0]) {
      const s1Slug = b.artifacts_2pc[0].set1_slug
      const s2Slug = b.artifacts_2pc[0].set2_slug
      const s1 = (s1Slug ? data.artifactsLookup.get(s1Slug)?.name : null) ?? s1Slug ?? 'Flex'
      const s2 = (s2Slug ? data.artifactsLookup.get(s2Slug)?.name : null) ?? s2Slug ?? 'Flex'
      ctx.fillText(truncateText(ctx, `2pc ${s1}`, innerW - 74), x + pad + 64, cy + 36)
      ctx.fillText(truncateText(ctx, `2pc ${s2}`, innerW - 74), x + pad + 64, cy + 54)
    } else {
      ctx.fillStyle = '#94a3b8'
      ctx.fillText('Flexível / 2pc + 2pc', x + pad + 64, cy + 38)
    }
    ctx.restore()
    cy += aBoxH + 10

    // --- Main Stats (Ampulheta / Cálice / Coroa) ---
    const mainRows = [
      { label: 'Ampulheta', vals: b.sands_stat?.map(formatStatLabel).join(' / ') || '—' },
      { label: 'Cálice', vals: b.goblet_stat?.map(formatStatLabel).join(' / ') || '—' },
      { label: 'Coroa', vals: b.circlet_stat?.map(formatStatLabel).join(' / ') || '—' },
    ]
    const msH = 98
    fillRoundedRect(ctx, x + pad, cy, innerW, msH, 12, 'rgba(2, 6, 23, 0.48)', 'rgba(148, 163, 184, 0.14)', 1)
    ctx.save()
    ctx.fillStyle = '#94a3b8'
    ctx.font = '700 10px "Inter", system-ui, sans-serif'
    ctx.fillText('MAIN STATS', x + pad + 12, cy + 17)
    mainRows.forEach((mr, i) => {
      const ry = cy + 38 + i * 23
      ctx.fillStyle = '#94a3b8'
      ctx.font = '600 12px "Inter", system-ui, sans-serif'
      ctx.fillText(mr.label, x + pad + 12, ry)
      ctx.fillStyle = '#f8fafc'
      ctx.font = '700 12.5px "Inter", system-ui, sans-serif'
      const txt = truncateText(ctx, mr.vals, innerW - 102)
      const tw = ctx.measureText(txt).width
      ctx.fillText(txt, x + pad + innerW - tw - 12, ry)
    })
    ctx.restore()
    cy += msH + 10

    // --- Substats + ER + Talentos ---
    const remH = Math.max(76, y + h - cy - 14)
    fillRoundedRect(ctx, x + pad, cy, innerW, remH, 12, `${elColor}10`, `${elColor}34`, 1)
    ctx.save()
    let ty = cy + 18
    if (b.substat_priority?.length) {
      ctx.fillStyle = '#94a3b8'
      ctx.font = '700 10px "Inter", system-ui, sans-serif'
      ctx.fillText('SUBSTATS', x + pad + 12, ty)
      ty += 18
      ctx.fillStyle = '#e2e8f0'
      ctx.font = '700 12px "Inter", system-ui, sans-serif'
      const subStr = b.substat_priority.map(formatStatLabel).join(' › ')
      ctx.fillText(truncateText(ctx, subStr, innerW - 24), x + pad + 12, ty)
      ty += 22
    }
    if (b.er_requirement && ty < cy + remH - 12) {
      ctx.fillStyle = '#94a3b8'
      ctx.font = '700 11.5px "Inter", system-ui, sans-serif'
      ctx.fillText('ER:', x + pad + 12, ty)
      ctx.fillStyle = '#7dd3fc'
      ctx.font = '700 12px "Inter", system-ui, sans-serif'
      ctx.fillText(truncateText(ctx, b.er_requirement, innerW - 48), x + pad + 38, ty)
      ty += 20
    }
    if (b.talent_priority && ty < cy + remH - 6) {
      ctx.fillStyle = '#94a3b8'
      ctx.font = '700 11.5px "Inter", system-ui, sans-serif'
      ctx.fillText('Talentos:', x + pad + 12, ty)
      ctx.fillStyle = '#fde68a'
      ctx.font = '700 12px "Inter", system-ui, sans-serif'
      ctx.fillText(truncateText(ctx, b.talent_priority, innerW - 82), x + pad + 72, ty)
    }
    ctx.restore()
  } else {
    // Sem build configurada nem importada
    const emptyH = Math.max(120, y + h - cy - 16)
    fillRoundedRect(ctx, x + pad, cy, innerW, emptyH, 12, 'rgba(2, 6, 23, 0.42)', 'rgba(148, 163, 184, 0.14)', 1)
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

  // Preload all member images in parallel
  const resolvedModes = members.map((m) => resolveMemberMode(m, sourceMode))
  const assetsList = await Promise.all(
    members.map((m, idx) => preloadMemberAssets(m, data, resolvedModes[idx])),
  )

  // 1. Fundo cinematográfico + brilho elemental + estrelas
  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, palette.bgDeep)
  bg.addColorStop(0.5, palette.bgMid)
  bg.addColorStop(1, palette.bgEdge)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  const glow1 = ctx.createRadialGradient(W * 0.16, 90, 20, W * 0.16, 90, W * 0.45)
  glow1.addColorStop(0, palette.glow)
  glow1.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = glow1
  ctx.fillRect(0, 0, W, H)

  const glow2 = ctx.createRadialGradient(W * 0.88, H * 0.85, 20, W * 0.88, H * 0.85, W * 0.38)
  glow2.addColorStop(0, palette.glow)
  glow2.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = glow2
  ctx.fillRect(0, 0, W, H)

  drawStarfield(ctx, W, H)

  // Moldura externa sutil
  fillRoundedRect(ctx, 14, 14, W - 28, H - 28, 26, 'rgba(2, 6, 23, 0.25)', 'rgba(255, 255, 255, 0.08)', 1.2)

  // 2. Cabeçalho do Time
  const outerPad = 36
  const headerTop = 34
  const titleText = (options.customTitle ?? data.name).trim() || 'Meu Time'

  // Linha de assinatura à direita (Nick + UID + Modo)
  let rightBlockW = 0
  const nick = (options.nickname || '').trim()
  const uid = showUid ? (options.uid || '').trim() : ''
  const modeLabel = sourceMode === 'account' ? 'MINHA CONTA' : 'GUIA DE TIME'

  ctx.save()
  ctx.textAlign = 'right'
  const rightX = W - outerPad
  if (nick || uid) {
    ctx.fillStyle = '#f8fafc'
    ctx.font = '700 15px "Inter", system-ui, sans-serif'
    const topStr = nick || `UID ${uid}`
    ctx.fillText(topStr, rightX, headerTop + 22)
    rightBlockW = Math.max(rightBlockW, ctx.measureText(topStr).width)
    if (nick && uid) {
      ctx.fillStyle = '#94a3b8'
      ctx.font = '600 12.5px "Inter", system-ui, sans-serif'
      const uidStr = `UID ${uid}`
      ctx.fillText(uidStr, rightX, headerTop + 42)
      rightBlockW = Math.max(rightBlockW, ctx.measureText(uidStr).width)
    }
  }
  ctx.restore()

  // Pill de modo no canto direito inferior do header
  ctx.save()
  ctx.font = '800 11px "Inter", system-ui, sans-serif'
  const modePillW = Math.ceil(ctx.measureText(modeLabel).width + 22)
  ctx.restore()
  drawPill(
    ctx,
    W - outerPad - modePillW,
    headerTop + (nick || uid ? 52 : 16),
    modeLabel,
    `${palette.accent}22`,
    `${palette.accent}66`,
    palette.accentSoft,
    '800 11px "Inter", system-ui, sans-serif',
    24,
    11,
  )
  rightBlockW = Math.max(rightBlockW, modePillW) + 24

  // Título do Time
  ctx.save()
  ctx.fillStyle = '#ffffff'
  ctx.font = '800 32px "Inter", system-ui, sans-serif'
  ctx.fillText(truncateText(ctx, titleText, W - outerPad * 2 - rightBlockW), outerPad, headerTop + 34)
  ctx.restore()

  // Pills de Metadados (Tier, Arquétipo, Sinergia, Reações)
  let px = outerPad
  const pillY = headerTop + 50
  if (showMeta) {
    if (data.tier) {
      const tColor = TIER_COLORS[data.tier.toUpperCase()] ?? '#fbbf24'
      px += drawPill(
        ctx,
        px,
        pillY,
        `TIER ${data.tier.toUpperCase()}`,
        `${tColor}24`,
        `${tColor}80`,
        tColor,
        '800 12px "Inter", system-ui, sans-serif',
        26,
        12,
      ) + 8
    }
    if (data.archetypeLabel) {
      px += drawPill(
        ctx,
        px,
        pillY,
        data.archetypeLabel,
        `${palette.accent}22`,
        `${palette.accent}66`,
        palette.accentSoft,
        '700 12px "Inter", system-ui, sans-serif',
        26,
        12,
      ) + 8
    }
    if (typeof data.synergyScore === 'number' && data.synergyScore > 0) {
      px += drawPill(
        ctx,
        px,
        pillY,
        `Sinergia ${data.synergyScore}/100`,
        'rgba(16, 185, 129, 0.16)',
        'rgba(52, 211, 153, 0.5)',
        '#6ee7b7',
        '700 12px "Inter", system-ui, sans-serif',
        26,
        12,
      ) + 8
    }
    for (const reac of (data.reactions ?? []).slice(0, 4)) {
      if (px > W - outerPad - rightBlockW - 130) break
      px += drawPill(
        ctx,
        px,
        pillY,
        reac,
        'rgba(15, 23, 42, 0.72)',
        'rgba(148, 163, 184, 0.28)',
        '#cbd5e1',
        '600 11.5px "Inter", system-ui, sans-serif',
        26,
        10,
      ) + 7
    }
  }

  // 3. Grade dos 4 Membros
  const gridTop = headerTop + 96
  const footerReserve = showNotes ? 104 : 44
  const gridH = H - gridTop - footerReserve
  const gridW = W - outerPad * 2

  if (layout === 'wide') {
    const count = Math.max(1, members.length)
    const gap = 18
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
      )
    })
  } else {
    const gap = 18
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
      )
    })
  }

  // 4. Rodapé (Notas/Rotação + Marca d'água)
  if (showNotes) {
    const noteY = H - 88
    fillRoundedRect(
      ctx,
      outerPad,
      noteY,
      W - outerPad * 2,
      46,
      12,
      'rgba(2, 6, 23, 0.55)',
      'rgba(148, 163, 184, 0.18)',
      1,
    )
    ctx.save()
    ctx.fillStyle = palette.accentSoft
    ctx.font = '800 11px "Inter", system-ui, sans-serif'
    ctx.textBaseline = 'middle'
    ctx.fillText('ROTAÇÃO / NOTAS', outerPad + 14, noteY + 23)
    ctx.fillStyle = '#e2e8f0'
    ctx.font = '500 13px "Inter", system-ui, sans-serif'
    ctx.fillText(truncateText(ctx, notesText, W - outerPad * 2 - 160), outerPad + 140, noteY + 23)
    ctx.restore()
  }

  ctx.save()
  ctx.fillStyle = 'rgba(148, 163, 184, 0.65)'
  ctx.font = '600 11.5px "Inter", system-ui, sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText('Genshin Smart Team Builder · Team Card HD', W - outerPad, H - 22)
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
