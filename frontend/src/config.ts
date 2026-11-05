export const ASSET_BASE = '/icons/'

export function iconUrl(icon: string | null | undefined): string | null {
  if (!icon) return null
  if (icon.startsWith('http://') || icon.startsWith('https://')) return icon
  if (icon.startsWith('/')) return icon
  // Adicionado ?v=2 para ignorar o cache de erro do navegador
  return `${ASSET_BASE}${icon}.webp?v=2`
}

export const ARTIFACT_ASSET_BASE = '/icons/'

export function artifactIconUrl(icon: string | null | undefined): string | null {
  if (!icon) return null
  return `${ARTIFACT_ASSET_BASE}${icon}.webp?v=2`
}
