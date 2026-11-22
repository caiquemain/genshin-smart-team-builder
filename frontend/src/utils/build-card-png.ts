import { artifactIconUrl, iconUrl } from '../config'
import {
  formatCanonicalStatValue,
  STAT_SHORT_LABEL_PT,
  type ComputedCharStats,
} from './char-stats-calc'
import type { CharacterSummary } from '../types'

const ELEMENT_BG: Record<string, [string, string, string]> = {
  pyro: ['#2c1210', '#111827', '#fb923c'],
  hydro: ['#0c2238', '#0f172a', '#38bdf8'],
  cryo: ['#0e2936', '#0f172a', '#67e8f9'],
  electro: ['#221338', '#0f172a', '#c084fc'],
  anemo: ['#0c2b26', '#0f172a', '#34d399'],
  geo: ['#2b210e', '#0f172a', '#fbbf24'],
  dendro: ['#192b10', '#0f172a', '#a3e635'],
}

function loadImageSafe(src: string | null | undefined): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null)
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
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
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
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

/**
 * Gera um card PNG (1200×660) estilo Enka/Akasha direto no navegador e inicia o download.
 */
export async function downloadBuildCardPng(
  character: CharacterSummary,
  stats: ComputedCharStats,
): Promise<void> {
  const W = 1200
  const H = 660
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const [bgA, bgB, accent] = ELEMENT_BG[String(character.element).toLowerCase()] ?? [
    '#132238',
    '#0b1120',
    '#38bdf8',
  ]

  // 1. Fundo gradiente temático
  const grad = ctx.createLinearGradient(0, 0, W, H)
  grad.addColorStop(0, bgA)
  grad.addColorStop(0.55, bgB)
  grad.addColorStop(1, '#090e1a')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)

  // Brilho radial suave no canto superior esquerdo
  const glow = ctx.createRadialGradient(180, 120, 10, 180, 120, 380)
  glow.addColorStop(0, `${accent}33`)
  glow.addColorStop(1, 'transparent')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)

  // Moldura externa
  ctx.strokeStyle = `${accent}55`
  ctx.lineWidth = 2
  roundRect(ctx, 12, 12, W - 24, H - 24, 20)
  ctx.stroke()

  // Pré-carrega imagens (avatar, arma e ícones dos 5 artefatos)
  const [avatarImg, weaponImg, ...artImgs] = await Promise.all([
    loadImageSafe(iconUrl(character.icon)),
    loadImageSafe(stats.weapon ? iconUrl(stats.weapon.icon) : null),
    ...stats.pieces.slice(0, 5).map((p) => loadImageSafe(artifactIconUrl(p.setIcon))),
  ])

  // 2. Cabeçalho: Avatar + Nome + Nível/C#/Talentos + CV Badge
  const avX = 40
  const avY = 38
  const avSize = 96
  ctx.save()
  ctx.beginPath()
  ctx.arc(avX + avSize / 2, avY + avSize / 2, avSize / 2, 0, Math.PI * 2)
  ctx.closePath()
  ctx.fillStyle = '#0f172a'
  ctx.fill()
  ctx.clip()
  if (avatarImg) {
    ctx.drawImage(avatarImg, avX, avY, avSize, avSize)
  }
  ctx.restore()
  ctx.strokeStyle = accent
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(avX + avSize / 2, avY + avSize / 2, avSize / 2, 0, Math.PI * 2)
  ctx.stroke()

  ctx.fillStyle = '#f8fafc'
  ctx.font = '800 32px Inter, system-ui, sans-serif'
  ctx.fillText(character.name, 156, 74)

  ctx.fillStyle = '#fbbf24'
  ctx.font = '700 16px Inter, system-ui, sans-serif'
  ctx.fillText('★'.repeat(character.rarity), 156, 100)

  ctx.fillStyle = '#cbd5e1'
  ctx.font = '600 15px Inter, system-ui, sans-serif'
  ctx.fillText(
    `Lv. ${stats.level}  ·  C${stats.cons}  ·  Talentos ${stats.talents.na}/${stats.talents.es}/${stats.talents.eb}`,
    156 + character.rarity * 15 + 14,
    100,
  )

  const setsLabel =
    stats.activeSets.length > 0
      ? stats.activeSets.map((s) => `${s.pieces}pc ${s.name}`).join(' + ')
      : 'Sem bônus de set ativo'
  ctx.fillStyle = '#94a3b8'
  ctx.font = '600 14px Inter, system-ui, sans-serif'
  ctx.fillText(truncateText(ctx, setsLabel, 520), 156, 126)

  // Badge CV no canto superior direito
  if (stats.hasArtifacts) {
    const cvText = `${stats.totalCritValue.toFixed(1)} CV`
    ctx.fillStyle = 'rgba(251, 191, 36, 0.16)'
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.55)'
    ctx.lineWidth = 1.5
    roundRect(ctx, W - 196, 46, 156, 46, 12)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#fde68a'
    ctx.font = '800 22px Inter, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(cvText, W - 118, 76)
    ctx.textAlign = 'left'
  }

  // 3. Bloco intermediário: Stats Calculados (esquerda) + Arma Equipada (direita)
  const midY = 158
  // Stats Box
  ctx.fillStyle = 'rgba(15, 23, 42, 0.72)'
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)'
  ctx.lineWidth = 1
  roundRect(ctx, 40, midY, 720, 174, 14)
  ctx.fill()
  ctx.stroke()

  const primaryBonus =
    stats.physicalDmgBonus > stats.elemDmgBonus && stats.physicalDmgBonus >= 20
      ? { label: 'Dano Físico', value: `${stats.physicalDmgBonus.toFixed(1)}%` }
      : stats.healingBonus > stats.elemDmgBonus && stats.healingBonus >= 15
        ? { label: 'Bônus Cura', value: `${stats.healingBonus.toFixed(1)}%` }
        : {
            label: STAT_SHORT_LABEL_PT[stats.elemDmgKey] ?? 'Dano Elem.',
            value: `${stats.elemDmgBonus.toFixed(1)}%`,
          }

  const statCells = [
    { label: 'Vida', val: stats.hasBaseData ? stats.totalHp.toLocaleString('pt-BR') : '—', crit: false },
    { label: 'ATQ', val: stats.hasBaseData ? stats.totalAtk.toLocaleString('pt-BR') : '—', crit: false },
    { label: 'DEF', val: stats.hasBaseData ? stats.totalDef.toLocaleString('pt-BR') : '—', crit: false },
    { label: 'Proficiência (EM)', val: String(stats.em), crit: false },
    { label: 'Taxa Crítica', val: `${stats.critRate.toFixed(1)}%`, crit: true },
    { label: 'Dano Crítico', val: `${stats.critDmg.toFixed(1)}%`, crit: true },
    { label: 'Recarga (ER)', val: `${stats.er.toFixed(1)}%`, crit: false },
    { label: primaryBonus.label, val: primaryBonus.value, crit: false },
  ]

  statCells.forEach((cell, i) => {
    const col = i % 4
    const row = Math.floor(i / 4)
    const cx = 56 + col * 174
    const cy = midY + 16 + row * 74
    ctx.fillStyle = 'rgba(30, 41, 59, 0.65)'
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)'
    roundRect(ctx, cx, cy, 162, 62, 10)
    ctx.fill()
    ctx.stroke()

    ctx.fillStyle = '#94a3b8'
    ctx.font = '600 12px Inter, system-ui, sans-serif'
    ctx.fillText(cell.label, cx + 12, cy + 22)

    ctx.fillStyle = cell.crit ? '#fde68a' : '#f8fafc'
    ctx.font = '800 20px Inter, system-ui, sans-serif'
    ctx.fillText(cell.val, cx + 12, cy + 49)
  })

  // Arma Box (direita)
  const wBoxX = 780
  ctx.fillStyle = 'rgba(15, 23, 42, 0.72)'
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)'
  roundRect(ctx, wBoxX, midY, 380, 174, 14)
  ctx.fill()
  ctx.stroke()

  ctx.fillStyle = '#94a3b8'
  ctx.font = '700 12px Inter, system-ui, sans-serif'
  ctx.fillText('ARMA EQUIPADA', wBoxX + 18, midY + 26)

  if (stats.weapon) {
    ctx.fillStyle = 'rgba(30, 41, 59, 0.85)'
    roundRect(ctx, wBoxX + 18, midY + 42, 92, 92, 12)
    ctx.fill()
    if (weaponImg) {
      ctx.drawImage(weaponImg, wBoxX + 22, midY + 46, 84, 84)
    }

    ctx.fillStyle = '#f8fafc'
    ctx.font = '800 17px Inter, system-ui, sans-serif'
    ctx.fillText(truncateText(ctx, stats.weapon.name, 236), wBoxX + 124, midY + 66)

    ctx.fillStyle = '#fbbf24'
    ctx.font = '700 13px Inter, system-ui, sans-serif'
    ctx.fillText('★'.repeat(stats.weapon.rarity), wBoxX + 124, midY + 88)

    ctx.fillStyle = '#cbd5e1'
    ctx.font = '600 13px Inter, system-ui, sans-serif'
    ctx.fillText(
      `Lv. ${stats.weapon.level}  ·  R${stats.weapon.refinement}`,
      wBoxX + 124 + stats.weapon.rarity * 12 + 10,
      midY + 88,
    )

    ctx.fillStyle = '#e2e8f0'
    ctx.font = '700 14px Inter, system-ui, sans-serif'
    ctx.fillText(`ATQ Base: ${stats.weapon.baseAtk}`, wBoxX + 124, midY + 114)

    if (stats.weapon.subKey && stats.weapon.subVal > 0) {
      ctx.fillStyle = '#7dd3fc'
      ctx.font = '600 13px Inter, system-ui, sans-serif'
      ctx.fillText(
        `${STAT_SHORT_LABEL_PT[stats.weapon.subKey]}: ${formatCanonicalStatValue(stats.weapon.subKey, stats.weapon.subVal)}`,
        wBoxX + 124,
        midY + 136,
      )
    }
  } else {
    ctx.fillStyle = '#64748b'
    ctx.font = '600 14px Inter, system-ui, sans-serif'
    ctx.fillText('Nenhuma arma equipada', wBoxX + 18, midY + 84)
  }

  // 4. Os 5 Artefatos Equipados na parte inferior
  const artY = 354
  const cardW = 216
  const cardH = 256
  const gap = 10

  for (let idx = 0; idx < 5; idx++) {
    const px = 40 + idx * (cardW + gap)
    const piece = stats.pieces[idx]

    ctx.fillStyle = 'rgba(15, 23, 42, 0.78)'
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)'
    roundRect(ctx, px, artY, cardW, cardH, 12)
    ctx.fill()
    ctx.stroke()

    if (!piece) {
      ctx.fillStyle = '#475569'
      ctx.font = '600 13px Inter, system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('Sem peça', px + cardW / 2, artY + cardH / 2)
      ctx.textAlign = 'left'
      continue
    }

    // Ícone do artefato
    ctx.fillStyle = 'rgba(30, 41, 59, 0.9)'
    roundRect(ctx, px + 12, artY + 12, 42, 42, 8)
    ctx.fill()
    if (artImgs[idx]) {
      ctx.drawImage(artImgs[idx]!, px + 14, artY + 14, 38, 38)
    }

    ctx.fillStyle = '#94a3b8'
    ctx.font = '700 11px Inter, system-ui, sans-serif'
    ctx.fillText(piece.slotLabel.toUpperCase(), px + 62, artY + 28)

    ctx.fillStyle = '#e2e8f0'
    ctx.font = '800 11px Inter, system-ui, sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(`+${piece.level}`, px + cardW - 12, artY + 28)
    ctx.textAlign = 'left'

    ctx.fillStyle = '#cbd5e1'
    ctx.font = '600 12px Inter, system-ui, sans-serif'
    ctx.fillText(truncateText(ctx, piece.setName, cardW - 74), px + 62, artY + 47)

    // Main Stat box
    ctx.fillStyle = 'rgba(30, 41, 59, 0.72)'
    roundRect(ctx, px + 12, artY + 64, cardW - 24, 38, 8)
    ctx.fill()

    ctx.fillStyle = '#94a3b8'
    ctx.font = '600 11px Inter, system-ui, sans-serif'
    ctx.fillText(truncateText(ctx, piece.mainStatLabel, 118), px + 20, artY + 87)

    ctx.fillStyle = '#f8fafc'
    ctx.font = '800 15px Inter, system-ui, sans-serif'
    ctx.textAlign = 'right'
    const mainTxt = piece.mainStatKey
      ? formatCanonicalStatValue(piece.mainStatKey, piece.mainStatValue)
      : '—'
    ctx.fillText(mainTxt, px + cardW - 20, artY + 88)
    ctx.textAlign = 'left'

    // Substats
    piece.substats.slice(0, 4).forEach((sub, si) => {
      const sy = artY + 124 + si * 24
      const isCrit = sub.key === 'crit_rate' || sub.key === 'crit_dmg'
      ctx.fillStyle = isCrit ? '#fef08a' : '#cbd5e1'
      ctx.font = `${isCrit ? '700' : '500'} 12.5px Inter, system-ui, sans-serif`
      ctx.fillText(truncateText(ctx, sub.label, 128), px + 14, sy)
      ctx.textAlign = 'right'
      ctx.fillText(`+${sub.formatted}`, px + cardW - 14, sy)
      ctx.textAlign = 'left'
    })

    // Rodapé da peça (Estrelas + CV)
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.16)'
    ctx.beginPath()
    ctx.moveTo(px + 12, artY + cardH - 32)
    ctx.lineTo(px + cardW - 12, artY + cardH - 32)
    ctx.stroke()

    ctx.fillStyle = '#fbbf24'
    ctx.font = '700 12px Inter, system-ui, sans-serif'
    ctx.fillText('★'.repeat(piece.rarity), px + 14, artY + cardH - 12)

    ctx.fillStyle = '#94a3b8'
    ctx.font = '700 12px Inter, system-ui, sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(`${piece.critValue.toFixed(1)} CV`, px + cardW - 14, artY + cardH - 12)
    ctx.textAlign = 'left'
  }

  // Rodapé discreto
  ctx.fillStyle = '#64748b'
  ctx.font = '600 12px Inter, system-ui, sans-serif'
  ctx.fillText('Genshin Smart Team Builder · Card de Build', 40, H - 22)

  // Exporta PNG
  await new Promise<void>((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        resolve()
        return
      }
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `build-${character.slug}.png`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      resolve()
    }, 'image/png')
  })
}
