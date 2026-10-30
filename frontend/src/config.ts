// Base das imagens servidas pelo Project Amber
export const ASSET_BASE = 'https://gi.yatta.moe/assets/UI/'

export function iconUrl(icon: string | null | undefined): string | null {
  if (!icon) return null
  // URL completa (CDN externo) → usa direto
  if (icon.startsWith('http://') || icon.startsWith('https://')) return icon
  // Path absoluto local (ex: /travelers/traveler-cryo.png) → usa direto
  if (icon.startsWith('/')) return icon
  // Filename do Yatta → concatena ASSET_BASE
  return `${ASSET_BASE}${icon}.png`
}

// Ícones de artefato vivem em subpasta /reliquary/
export const ARTIFACT_ASSET_BASE = 'https://gi.yatta.moe/assets/UI/reliquary/'

export function artifactIconUrl(icon: string | null | undefined): string | null {
  return icon ? `${ARTIFACT_ASSET_BASE}${icon}.png` : null
}
