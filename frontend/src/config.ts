// Base das imagens servidas pelo Project Amber
export const ASSET_BASE = 'https://gi.yatta.moe/assets/UI/'

export function iconUrl(icon: string | null | undefined): string | null {
  return icon ? `${ASSET_BASE}${icon}.png` : null
}

// Ícones de artefato vivem em subpasta /reliquary/
export const ARTIFACT_ASSET_BASE = 'https://gi.yatta.moe/assets/UI/reliquary/'

export function artifactIconUrl(icon: string | null | undefined): string | null {
  return icon ? `${ARTIFACT_ASSET_BASE}${icon}.png` : null
}
