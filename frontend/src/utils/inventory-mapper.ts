export interface SeelieInventoryItem {
  type: string
  item: string
  tier: number
  value: number
}

type Localized = string | { pt?: string; en?: string; es?: string } | null

export interface MaterialLike {
  slug: string
  name: Localized
  icon?: string | null
  category?: string
  rarity?: number | null
  description?: Localized
  source?: Localized
}

export interface InventoryMappingResult {
  resolved: Record<string, number>
  ambiguous: SeelieInventoryItem[]
  unmapped: SeelieInventoryItem[]
}

// Tipos do Seelie que NÃO são materiais do catálogo (são consumíveis/contadores)
const SKIP_TYPES = new Set(['xp', 'wep_xp', 'resin'])

function extractNames(mat: MaterialLike): string[] {
  const out: string[] = []
  const n = mat.name
  if (typeof n === 'string') out.push(n)
  else if (n) {
    if (n.pt) out.push(n.pt)
    if (n.en) out.push(n.en)
    if (n.es) out.push(n.es)
  }
  out.push(mat.slug)
  return out
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function resolveInventory(
  seelieInventory: SeelieInventoryItem[],
  catalog: MaterialLike[],
  families?: Record<string, string[]>,
): InventoryMappingResult {
  const resolved: Record<string, number> = {}
  const ambiguous: SeelieInventoryItem[] = []
  const unmapped: SeelieInventoryItem[] = []

  // Índice por nome normalizado (fallback)
  const byName = new Map<string, string[]>()
  for (const mat of catalog) {
    for (const n of extractNames(mat)) {
      const key = normalize(n)
      if (!key) continue
      if (!byName.has(key)) byName.set(key, [])
      const arr = byName.get(key)!
      if (!arr.includes(mat.slug)) arr.push(mat.slug)
    }
  }

  for (const item of seelieInventory) {
    // 0. Ignora tipos que não são materiais (xp de personagem, xp de arma, resina)
    if (SKIP_TYPES.has(item.type)) continue
    // Ignora valores zero — evita sujeira no unmapped
    if (!item.value || item.value <= 0) continue

    // 1. Casos especiais explícitos
    // Seelie bug: 'l_bone' vem triplicado com valores emprestados da Frostnight.
    // Só o tier 2 é o Lightless Bone real (2★ mas exportado fora de ordem).
    if (item.item === 'l_bone') {
      if (item.tier === 2) {
        resolved['lightless-bone'] = (resolved['lightless-bone'] ?? 0) + item.value
      }
      continue
    }

    if (item.item === 'mora') { resolved['mora'] = item.value; continue }
    if (item.item === 'dream_solvent') { resolved['dream-solvent'] = item.value; continue }
    if (item.item === 'crown') { resolved['crown-of-insight'] = item.value; continue }

    let matched = false

    // 2. Match direto pela família (ex: 'mask' + tier 2 -> ominous-mask)
    if (families) {
      const famKey = Object.keys(families).find(
        (k) =>
          k === item.item ||
          k === item.item.replace(/_/g, '-') ||
          k === item.item.replace(/-/g, '_'),
      )
      if (famKey && families[famKey] && families[famKey][item.tier]) {
        resolved[families[famKey][item.tier]] = item.value
        matched = true
        continue
      }
    }

    // 3. Match pela família que CONTÉM o item (ex: spectral_husk tier 0 -> spectral-husk)
    if (families) {
      const normalizedItem = normalize(item.item)
      for (const slugs of Object.values(families)) {
        const slug = slugs[item.tier]
        if (slug && normalize(slug) === normalizedItem) {
          resolved[slug] = item.value
          matched = true
          break
        }
      }
      if (matched) continue
    }

    // 4. Fallback: match pelo nome normalizado
    const key = normalize(item.item)
    const candidates = byName.get(key) ?? []
    if (candidates.length === 1) {
      resolved[candidates[0]] = item.value
    } else if (candidates.length > 1) {
      ambiguous.push(item)
    } else {
      unmapped.push(item)
    }
  }

  return { resolved, ambiguous, unmapped }
}