export const ASSET_BASE = '/icons/'

export function iconUrl(icon: string | null | undefined): string | null {
  if (!icon) return null
  if (icon.startsWith('http://') || icon.startsWith('https://')) return icon
  if (icon.startsWith('/')) return icon
  // Adicionado ?v=3 para ignorar o cache de erro do navegador
  return `${ASSET_BASE}${icon}.webp?v=3`
}

export const ARTIFACT_ASSET_BASE = '/icons/'

export function artifactIconUrl(icon: string | null | undefined): string | null {
  if (!icon) return null
  return `${ARTIFACT_ASSET_BASE}${icon}.webp?v=3`
}

const RELIC_SLOT_SUFFIX: Record<string, string> = {
  flower: '4',
  plume: '2',
  sands: '5',
  goblet: '1',
  circlet: '3',
  EQUIP_BRACER: '4',
  EQUIP_NECKLACE: '2',
  EQUIP_SHOES: '5',
  EQUIP_RING: '1',
  EQUIP_DRESS: '3',
}

/**
 * Resolve a URL do ícone específico de cada peça de artefato a partir do ícone do set.
 * Convenção Genshin: Flor=_4, Pena=_2, Ampulheta=_5, Cálice=_1, Tiara=_3.
 */
export function artifactPieceIconUrl(
  setIcon: string | null | undefined,
  slotKey: string | null | undefined,
): string | null {
  if (!setIcon) return null
  if (!slotKey || setIcon.endsWith('_3')) return artifactIconUrl(setIcon)
  const suffix = RELIC_SLOT_SUFFIX[slotKey] ?? RELIC_SLOT_SUFFIX[slotKey.toLowerCase()]
  if (!suffix) return artifactIconUrl(setIcon)
  const pieceIcon = setIcon.replace(/^(UI_RelicIcon_\d+)_\d+$/, `$1_${suffix}`)
  return artifactIconUrl(pieceIcon)
}
