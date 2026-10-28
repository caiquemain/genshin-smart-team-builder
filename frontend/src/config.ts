// Base das imagens servidas pelo Project Amber
export const ASSET_BASE = 'https://gi.yatta.moe/assets/UI/'

export function iconUrl(icon: string | null | undefined): string | null {
  return icon ? `${ASSET_BASE}${icon}.png` : null
}
