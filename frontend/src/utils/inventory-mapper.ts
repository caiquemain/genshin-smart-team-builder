// Mapeia o inventory[] do Seelie export pra slugs do nosso Material.

export interface SeelieInventoryItem {
  type: string
  item: string
  tier: number
  value: number
}

export interface MaterialLike {
  slug: string
  name: string
  rarity: number | null
  category: string
}

export interface ResolveResult {
  resolved: Record<string, number>   // materialSlug -> qty total
  unmapped: SeelieInventoryItem[]
  ambiguous: Array<{ item: SeelieInventoryItem; candidates: string[] }>
}

// Seelie `type` → nossas categorias candidatas
const TYPE_TO_CATEGORIES: Record<string, string[]> = {
  local: ['local_specialty'],
  boss: ['weekly_boss', 'boss_material'],  // weekly bosses > character bosses
  talent: ['talent_book'],
  element_1: ['ascension_gem'],
  element_2: ['boss_material'],
  wam: ['weapon_ascension'],
  common: ['common_drop'],
  common_rare: ['common_drop'],
  special: ['crown'],
  xp: ['character_exp'],
  wep_xp: ['weapon_exp'],
  mora: ['mora'],
}

function tierToRarity(tier: number): number {
  // Seelie: tier 0..4 → nossa rarity 1..5
  return Math.min(Math.max(tier + 1, 1), 5)
}

function normalizeSlug(s: string): string {
  return s.toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-')
}

function slugToWords(s: string): string {
  return s.replace(/[_-]/g, ' ').toLowerCase().trim()
}


// Mapa explícito: Seelie item key + tier → nosso slug.
// Cobre os casos onde a heurística de nome/slug falha.
const SEELIE_ITEM_ALIASES: Record<string, Record<number, string>> = {
  // === Fatui Insignias (f_insignia) ===
  f_insignia: {
    0: 'insignia-de-recruta',
    1: 'insignia-de-sargento',
    2: 'insignia-de-oficial',
  },
  // === Treasure Hoarder Insignias (th_insignia) ===
  th_insignia: {
    0: 'insignia-dos-ladroes-de-tesouro',
    1: 'insignia-do-corvo-prateado',
    2: 'insignia-de-corvo-dourado',
  },
  // === Scrolls ===
  scroll: {
    0: 'pergaminho-guia',
    1: 'pergaminho-do-encantamento',
    2: 'pergaminho-da-maldicao',
  },
  // === Ley Line parts ===
  ley_line: {
    0: 'folha-morta-de-linha-ley',
    1: 'ramo-seco-de-linha-ley',
    2: 'broto-de-linha-ley',
  },
  // === Chaos components (Caos) ===
  chaos: {
    0: 'circuito-do-caos',
    1: 'dispositivo-do-caos',
    2: 'fornalha-do-caos',
  },
  chaos_g: {
    0: 'mecanismo-do-caos',
    1: 'processador-do-caos',
    2: 'olho-do-caos',
  },
  // === Horns ===
  horn: {
    0: 'chifre-pesado',
    1: 'chifre-de-bronze-negro',
    2: 'chifre-de-cristal-preto',
  },
  // === Red Satin ===
  red_satin: {
    0: 'cetim-vermelho-desbotado',
    1: 'seda-vermelha-bordada',
    2: 'cetim-vermelho',
  },
  // === Mist/Fog crystal parts ===
  mist: {
    0: 'pólen-de-névoa',
    1: 'pavio-do-nevoeiro',
    2: 'grama-do-nevoeiro',
  },
  // === Sacrificial Knife (Abyss) ===
  sacrificial_knife: {
    0: 'faca-sacrificial-lamina-cruel',  // tier 0
    1: 'faca-sacrificial-lamina-afiada',
    2: 'faca-sacrificial-lamina-completa',
  },
  // === Prism (Mirror Maiden) ===
  prism: {
    0: 'prisma-do-relampago-sombrio',
    1: 'prisma-do-relampago-cristalino',
    2: 'prisma-do-relampago',
  },
  // === Statuette (Hilichurl) ===
  statuette: {
    0: 'estatueta-pesada',      // heavy
    1: 'estatueta-negra',        // black
    2: 'estatueta-dourada',      // golden
  },
  // === Arrowheads (Hilichurl) ===
  arrowhead: {
    0: 'ponta-de-flecha-usada',
    1: 'ponta-de-flecha-afiada',
    2: 'ponta-de-flecha-robusta',
  },
  // === Masks (Hilichurl) ===
  mask: {
    0: 'mascara-danificada',
    1: 'mascara-suja',
    2: 'mascara-ominosa',
  },
  // === Slimes ===
  slime: {
    0: 'condensado-de-slime',
    1: 'secrecao-de-slime',
    2: 'essencia-de-slime',
  },
  // === Spectral husk ===
  spectral_husk: {
    0: 'casca-espectral',
    1: 'coracao-espectral',
    2: 'nucleo-espectral',
  },
  // === Bones (Sumeru desert) ===
  bone_shard: {
    0: 'fragmento-de-osso-quebrado',
    1: 'fragmento-de-osso-turquesa',
    2: 'fragmento-de-osso-dourado',
  },
  // === Fungal spores ===
  spores: {
    0: 'esporo-de-cogumelo-flutuante',
    1: 'nucleo-flutuante-luminoso',
    2: 'nucleo-flutuante-cristalino',
  },
  // === Nectar (Whopperflower) ===
  nectar: {
    0: 'nectar-da-flor-gigante',
    1: 'nectar-brilhante',
    2: 'nectar-elemental',
  },
}

function tryAlias(invItem: SeelieInventoryItem): string | null {
  const tierMap = SEELIE_ITEM_ALIASES[invItem.item]
  if (!tierMap) return null
  const slug = tierMap[invItem.tier]
  return slug ?? null
}

function resolveOne(
  invItem: SeelieInventoryItem,
  materials: MaterialLike[],
): { slug: string | null; candidates: string[] } {
  // 0) Alias explícito (mais confiável)
  const aliased = tryAlias(invItem)
  if (aliased) {
    // Confirma que existe na lista de materiais
    const found = materials.find((m) => m.slug === aliased)
    if (found) return { slug: aliased, candidates: [aliased] }
  }

  const wantedCats = TYPE_TO_CATEGORIES[invItem.type]
  if (!wantedCats) {
    return { slug: null, candidates: [] }
  }

  const pool = materials.filter((m) => wantedCats.includes(m.category))
  if (pool.length === 0) return { slug: null, candidates: [] }

  const normalizedItem = normalizeSlug(invItem.item)
  const itemWords = slugToWords(invItem.item)
  const targetRarity = tierToRarity(invItem.tier)

  // 1) Match exato de slug
  const exactSlug = pool.find((m) => m.slug === normalizedItem)
  if (exactSlug) return { slug: exactSlug.slug, candidates: [exactSlug.slug] }

  // 2) Match exato de name (words)
  const exactName = pool.filter((m) => m.name.toLowerCase() === itemWords)
  if (exactName.length === 1) return { slug: exactName[0].slug, candidates: [exactName[0].slug] }

  // 3) Slug contains (parcial) com rarity exata
  const partialWithRarity = pool.filter(
    (m) => m.slug.includes(normalizedItem) && m.rarity === targetRarity,
  )
  if (partialWithRarity.length === 1) {
    return { slug: partialWithRarity[0].slug, candidates: [partialWithRarity[0].slug] }
  }

  // 4) Nome contém (parcial) com rarity exata
  const partialNameWithRarity = pool.filter(
    (m) => m.name.toLowerCase().includes(itemWords) && m.rarity === targetRarity,
  )
  if (partialNameWithRarity.length === 1) {
    return { slug: partialNameWithRarity[0].slug, candidates: [partialNameWithRarity[0].slug] }
  }

  // 5) Slug contains (parcial) sem rarity
  const partialSlug = pool.filter((m) => m.slug.includes(normalizedItem))
  if (partialSlug.length === 1) {
    return { slug: partialSlug[0].slug, candidates: [partialSlug[0].slug] }
  }
  if (partialSlug.length > 1) {
    return { slug: null, candidates: partialSlug.map((m) => m.slug) }
  }

  // 6) Nome contém (parcial) sem rarity
  const partialName = pool.filter((m) => m.name.toLowerCase().includes(itemWords))
  if (partialName.length === 1) {
    return { slug: partialName[0].slug, candidates: [partialName[0].slug] }
  }
  if (partialName.length > 1) {
    return { slug: null, candidates: partialName.map((m) => m.slug) }
  }

  return { slug: null, candidates: [] }
}

export function resolveInventory(
  inventory: SeelieInventoryItem[],
  materials: MaterialLike[],
): ResolveResult {
  const resolved: Record<string, number> = {}
  const unmapped: SeelieInventoryItem[] = []
  const ambiguous: Array<{ item: SeelieInventoryItem; candidates: string[] }> = []

  for (const invItem of inventory) {
    if (!invItem || invItem.value <= 0) continue
    const { slug, candidates } = resolveOne(invItem, materials)
    if (slug) {
      resolved[slug] = (resolved[slug] ?? 0) + invItem.value
    } else if (candidates.length > 1) {
      ambiguous.push({ item: invItem, candidates })
    } else {
      unmapped.push(invItem)
    }
  }

  return { resolved, unmapped, ambiguous }
}
