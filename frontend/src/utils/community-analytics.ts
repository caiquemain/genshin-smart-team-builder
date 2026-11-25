import type { CommunityCharStats } from '../types'

export const STAT_KEYS = [
  'hp',
  'atk',
  'def',
  'em',
  'crit_rate',
  'crit_dmg',
  'er',
  'elem_dmg',
] as const

export type StatKey = (typeof STAT_KEYS)[number]

export interface EnrichedCommunityChar {
  char: CommunityCharStats
  slug: string
  name: string
  rarity: number
  element: string
  icon: string | null
  count: number
  popularityPct: number
  hpMed: number
  atkMed: number
  defMed: number
  emMed: number
  emMean: number
  crMed: number
  cdMed: number
  cdMean: number
  erMed: number
  elemDmgMed: number
  cvEff: number
  avgConst: number
  c6Pct: number
  top1WeaponPct: number
  top1WeaponName: string
  weaponEntropy: number
  top1SetPct: number
  top1SetName: string
  setEntropy: number
  crownedTalents: number
  emGap: number
  cdGap: number
  polarizationScore: number
  zScores: number[]
  clusterId: number
  clusterName: string
  clusterColor: string
  pca1: number
  pca2: number
}

export interface ClusterSummary {
  id: number
  name: string
  color: string
  count: number
  medianHp: number
  medianAtk: number
  medianEm: number
  medianCr: number
  medianCd: number
  medianEr: number
  examples: Array<{ slug: string; name: string; icon: string | null }>
}

export interface CorrelationInsight {
  id: string
  labelA: string
  labelB: string
  rho: number
  pValue: number
  significant: boolean
  strength: 'forte' | 'moderada' | 'fraca'
  direction: 'positiva' | 'negativa'
  explanation: string
}

export interface CommunityAnalyticsResult {
  items: EnrichedCommunityChar[]
  bySlug: Map<string, EnrichedCommunityChar>
  clusters: ClusterSummary[]
  pcaVariance: [number, number]
  topCritValue: EnrichedCommunityChar[]
  mostLockedSets: EnrichedCommunityChar[]
  mostFlexibleSets: EnrichedCommunityChar[]
  mostLockedWeapons: EnrichedCommunityChar[]
  mostFlexibleWeapons: EnrichedCommunityChar[]
  mostPolarized: EnrichedCommunityChar[]
  correlations: CorrelationInsight[]
}

const CLUSTER_PALETTE = [
  '#38bdf8', // sky
  '#a855f7', // purple
  '#34d399', // emerald
  '#fbbf24', // amber
  '#f472b6', // pink
  '#fb7185', // rose
  '#818cf8', // indigo
  '#2dd4bf', // teal
]

/** Entropia de Shannon normalizada em [0, 1] (0 = 100% em um único item, 1 = distribuição uniforme). */
export function normalizedEntropy(counts: number[]): number {
  const vals = counts.filter((c) => c > 0)
  if (vals.length <= 1) return 0
  const total = vals.reduce((acc, v) => acc + v, 0)
  if (total <= 0) return 0
  let h = 0
  for (const v of vals) {
    const p = v / total
    h -= p * Math.log2(p)
  }
  return h / Math.log2(vals.length)
}

function medianOf(nums: number[]): number {
  if (nums.length === 0) return 0
  const sorted = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/** Atribui ranks médios em caso de empate (para Spearman). */
function averageRanks(values: number[]): number[] {
  const indexed = values.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v)
  const ranks = new Array<number>(values.length)
  let i = 0
  while (i < indexed.length) {
    let j = i
    while (j + 1 < indexed.length && indexed[j + 1].v === indexed[i].v) {
      j++
    }
    const avgRank = (i + j) / 2 + 1
    for (let k = i; k <= j; k++) {
      ranks[indexed[k].i] = avgRank
    }
    i = j + 1
  }
  return ranks
}

/** Aproximação de erfc(x) (Abramowitz & Stegun 7.1.26) para cálculo de p-value bilateral. */
function erfcApprox(x: number): number {
  const z = Math.abs(x)
  const t = 1 / (1 + 0.5 * z)
  const ans =
    t *
    Math.exp(
      -z * z -
        1.26551223 +
        t *
          (1.00002368 +
            t *
              (0.37409196 +
                t *
                  (0.09678418 +
                    t *
                      (-0.18628806 +
                        t *
                          (0.27886807 +
                            t *
                              (-1.13520398 +
                                t *
                                  (1.48851587 +
                                    t * (-0.82215223 + t * 0.17087277)))))))),
    )
  return x >= 0 ? ans : 2 - ans
}

/** Correlação de Spearman (ρ) + p-value bilateral aproximado. */
export function spearmanCorrelation(xs: number[], ys: number[]): { rho: number; pValue: number } {
  const n = Math.min(xs.length, ys.length)
  if (n < 4) return { rho: 0, pValue: 1 }

  const rx = averageRanks(xs.slice(0, n))
  const ry = averageRanks(ys.slice(0, n))
  const meanX = rx.reduce((a, b) => a + b, 0) / n
  const meanY = ry.reduce((a, b) => a + b, 0) / n

  let cov = 0
  let varX = 0
  let varY = 0
  for (let i = 0; i < n; i++) {
    const dx = rx[i] - meanX
    const dy = ry[i] - meanY
    cov += dx * dy
    varX += dx * dx
    varY += dy * dy
  }

  if (varX <= 0 || varY <= 0) return { rho: 0, pValue: 1 }
  const rho = Math.max(-1, Math.min(1, cov / Math.sqrt(varX * varY)))
  if (Math.abs(rho) >= 0.999999) return { rho, pValue: 0 }

  // Estatística t = rho * sqrt((n - 2) / (1 - rho^2)), aproximação normal para n >= 20
  const tStat = Math.abs(rho) * Math.sqrt((n - 2) / (1 - rho * rho))
  const pValue = Math.min(1, Math.max(0, erfcApprox(tStat / Math.SQRT2)))
  return { rho, pValue }
}

/** PCA 2D por power iteration + deflação sobre matriz de covariância d×d (d=8). */
function computePca2D(X: number[][]): { coords: Array<[number, number]>; varianceRatio: [number, number] } {
  const n = X.length
  if (n === 0) return { coords: [], varianceRatio: [0, 0] }
  const d = X[0].length

  // Matriz de covariância C = (1/n) * X^T X (X já é padronizado com média 0)
  const C: number[][] = Array.from({ length: d }, () => new Array<number>(d).fill(0))
  for (let i = 0; i < n; i++) {
    const row = X[i]
    for (let a = 0; a < d; a++) {
      for (let b = a; b < d; b++) {
        C[a][b] += row[a] * row[b]
      }
    }
  }
  let trace = 0
  for (let a = 0; a < d; a++) {
    for (let b = a; b < d; b++) {
      C[a][b] /= n
      C[b][a] = C[a][b]
    }
    trace += C[a][a]
  }
  if (trace <= 1e-12) {
    return { coords: X.map(() => [0, 0]), varianceRatio: [0, 0] }
  }

  function powerIteration(mat: number[][], initVec: number[]): { eigenvalue: number; eigenvector: number[] } {
    let v = [...initVec]
    const norm0 = Math.hypot(...v) || 1
    v = v.map((x) => x / norm0)

    for (let iter = 0; iter < 60; iter++) {
      const next = new Array<number>(d).fill(0)
      for (let a = 0; a < d; a++) {
        let sum = 0
        for (let b = 0; b < d; b++) sum += mat[a][b] * v[b]
        next[a] = sum
      }
      const norm = Math.hypot(...next)
      if (norm <= 1e-12) break
      v = next.map((x) => x / norm)
    }

    // Alinha sinal determinístico (componente de maior magnitude positiva)
    let maxIdx = 0
    for (let a = 1; a < d; a++) {
      if (Math.abs(v[a]) > Math.abs(v[maxIdx])) maxIdx = a
    }
    if (v[maxIdx] < 0) v = v.map((x) => -x)

    let eigenvalue = 0
    for (let a = 0; a < d; a++) {
      let rowDot = 0
      for (let b = 0; b < d; b++) rowDot += mat[a][b] * v[b]
      eigenvalue += v[a] * rowDot
    }
    return { eigenvalue: Math.max(0, eigenvalue), eigenvector: v }
  }

  const pc1 = powerIteration(C, [0.3, 0.3, -0.2, -0.2, 0.5, 0.5, -0.2, 0.3])

  // Deflação: C2 = C - lambda1 * v1 v1^T
  const C2: number[][] = Array.from({ length: d }, (_, a) =>
    Array.from({ length: d }, (_, b) => C[a][b] - pc1.eigenvalue * pc1.eigenvector[a] * pc1.eigenvector[b]),
  )
  const pc2 = powerIteration(C2, [0.5, -0.3, 0.3, 0.4, -0.2, -0.2, 0.5, -0.1])

  const coords: Array<[number, number]> = X.map((row) => {
    let c1 = 0
    let c2 = 0
    for (let a = 0; a < d; a++) {
      c1 += row[a] * pc1.eigenvector[a]
      c2 += row[a] * pc2.eigenvector[a]
    }
    return [c1, c2]
  })

  return {
    coords,
    varianceRatio: [pc1.eigenvalue / trace, pc2.eigenvalue / trace],
  }
}

function sqDist(a: number[], b: number[]): number {
  let s = 0
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i]
    s += diff * diff
  }
  return s
}

/** K-Means determinístico com inicialização farthest-first (k-means++ determinístico). */
function runKMeans(X: number[][], k: number): number[] {
  const n = X.length
  if (n === 0) return []
  const effectiveK = Math.max(1, Math.min(k, n))
  const d = X[0].length

  // Primeiro centróide: ponto mais distante da origem
  let firstIdx = 0
  let bestNorm = -1
  for (let i = 0; i < n; i++) {
    const norm = X[i].reduce((acc, v) => acc + v * v, 0)
    if (norm > bestNorm) {
      bestNorm = norm
      firstIdx = i
    }
  }

  const centroids: number[][] = [[...X[firstIdx]]]
  while (centroids.length < effectiveK) {
    let bestIdx = 0
    let maxMinDist = -1
    for (let i = 0; i < n; i++) {
      let minD = Infinity
      for (const c of centroids) {
        const dist = sqDist(X[i], c)
        if (dist < minD) minD = dist
      }
      if (minD > maxMinDist) {
        maxMinDist = minD
        bestIdx = i
      }
    }
    centroids.push([...X[bestIdx]])
  }

  const labels = new Array<number>(n).fill(0)
  for (let iter = 0; iter < 40; iter++) {
    let changed = false
    for (let i = 0; i < n; i++) {
      let bestC = 0
      let bestD = Infinity
      for (let c = 0; c < effectiveK; c++) {
        const dist = sqDist(X[i], centroids[c])
        if (dist < bestD) {
          bestD = dist
          bestC = c
        }
      }
      if (labels[i] !== bestC) {
        labels[i] = bestC
        changed = true
      }
    }
    if (!changed && iter > 0) break

    const sums = Array.from({ length: effectiveK }, () => new Array<number>(d).fill(0))
    const counts = new Array<number>(effectiveK).fill(0)
    for (let i = 0; i < n; i++) {
      const c = labels[i]
      counts[c]++
      for (let j = 0; j < d; j++) sums[c][j] += X[i][j]
    }
    for (let c = 0; c < effectiveK; c++) {
      if (counts[c] > 0) {
        for (let j = 0; j < d; j++) centroids[c][j] = sums[c][j] / counts[c]
      }
    }
  }

  return labels
}

function labelClusterFromZ(z: number[]): string {
  // Ordem: [hp, atk, def, em, crit_rate, crit_dmg, er, elem_dmg]
  const [zHp, , zDef, zEm, zCr, zCd, zEr] = z
  if (zDef > 1.15) return 'Escala em DEF (Tank / Geo)'
  if (zEm > 1.0 && zCd < 0.2) return 'Full EM / Reação Transformativa'
  if (zHp > 0.85 && zCd > 0.2) return 'Hypercarry / Sub-DPS HP'
  if (zHp > 0.85 && zCd <= 0.2) return 'Suporte / Healer / Escudo (HP)'
  if (zEr > 0.65 && zCd < 0.1) return 'Bateria / Suporte ER'
  if (zCd > 0.45 && zCr > 0.35) {
    if (zEm > 0.2) return 'DPS Crítico + Reação (ATQ/EM)'
    return 'Hypercarry Crítico (ATQ)'
  }
  return 'Sub-DPS / Híbrido Balanceado'
}

export function findNearestNeighbors(
  targetSlug: string,
  items: EnrichedCommunityChar[],
  k = 6,
): Array<{ item: EnrichedCommunityChar; distance: number }> {
  const target = items.find((i) => i.slug === targetSlug)
  if (!target) return []
  return items
    .filter((i) => i.slug !== targetSlug)
    .map((item) => ({
      item,
      distance: Math.sqrt(sqDist(target.zScores, item.zScores)),
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, k)
}

export function analyzeCommunityDataset(
  characters: CommunityCharStats[],
  kClusters = 6,
): CommunityAnalyticsResult {
  const validChars = characters.filter((c) => c.count > 0)
  const rawMatrix: number[][] = validChars.map((c) =>
    STAT_KEYS.map((k) => {
      const pair = c.stats[k]
      if (!pair) return k === 'er' ? 100 : 0
      return pair.median
    }),
  )

  // Padronização Z-score por coluna
  const n = rawMatrix.length
  const d = STAT_KEYS.length
  const means = new Array<number>(d).fill(0)
  const stds = new Array<number>(d).fill(1)

  if (n > 0) {
    for (let j = 0; j < d; j++) {
      let s = 0
      for (let i = 0; i < n; i++) s += rawMatrix[i][j]
      means[j] = s / n
      let v = 0
      for (let i = 0; i < n; i++) {
        const diff = rawMatrix[i][j] - means[j]
        v += diff * diff
      }
      const sd = Math.sqrt(v / n)
      stds[j] = sd > 1e-9 ? sd : 1
    }
  }

  const X = rawMatrix.map((row) => row.map((val, j) => (val - means[j]) / stds[j]))
  const clusterLabels = runKMeans(X, kClusters)
  const { coords: pcaCoords, varianceRatio: pcaVariance } = computePca2D(X)

  // Rótulos e cores determinísticos por cluster
  const clusterIds = Array.from(new Set(clusterLabels)).sort((a, b) => a - b)
  const clusterNameMap = new Map<number, string>()
  const clusterColorMap = new Map<number, string>()
  const usedNames = new Map<string, number>()

  for (let idx = 0; idx < clusterIds.length; idx++) {
    const cid = clusterIds[idx]
    const members = X.filter((_, i) => clusterLabels[i] === cid)
    const meanZ = new Array<number>(d).fill(0)
    for (const row of members) {
      for (let j = 0; j < d; j++) meanZ[j] += row[j] / members.length
    }
    const base = labelClusterFromZ(meanZ)
    const seen = (usedNames.get(base) ?? 0) + 1
    usedNames.set(base, seen)
    clusterNameMap.set(cid, seen === 1 ? base : `${base} #${seen}`)
    clusterColorMap.set(cid, CLUSTER_PALETTE[idx % CLUSTER_PALETTE.length])
  }

  const items: EnrichedCommunityChar[] = validChars.map((c, i) => {
    const hpMed = c.stats.hp?.median ?? 0
    const atkMed = c.stats.atk?.median ?? 0
    const defMed = c.stats.def?.median ?? 0
    const emMed = c.stats.em?.median ?? 0
    const emMean = c.stats.em?.mean ?? emMed
    const crMed = c.stats.crit_rate?.median ?? 0
    const cdMed = c.stats.crit_dmg?.median ?? 0
    const cdMean = c.stats.crit_dmg?.mean ?? cdMed
    const erMed = c.stats.er?.median ?? 100
    const elemDmgMed = c.stats.elem_dmg?.median ?? 0
    const cvEff = crMed * 2 + cdMed

    const wCounts = c.weapons.map((w) => w.count)
    const top1WeaponPct = c.weapons[0]?.pct ?? 0
    const top1WeaponName = c.weapons[0]?.name ?? '—'
    const weaponEntropy = normalizedEntropy(wCounts)

    const sCounts = c.artifact_sets.map((s) => s.count)
    const top1SetPct = c.artifact_sets[0]?.pct ?? 0
    const top1SetName =
      c.artifact_sets[0]?.sets.map((s) => `${s.pieces}pc ${s.name}`).join(' + ') ?? '—'
    const setEntropy = normalizedEntropy(sCounts)

    const talList = [c.talents.na, c.talents.es, c.talents.eb]
    const crownedTalents = talList.filter((t) => t.median >= 10 || t.mode >= 10).length

    const emGap = Math.abs(emMean - emMed)
    const cdGap = Math.abs(cdMean - cdMed)
    const polarizationScore = emGap / 80 + cdGap / 20

    const cid = clusterLabels[i] ?? 0
    const [pca1, pca2] = pcaCoords[i] ?? [0, 0]

    return {
      char: c,
      slug: c.slug,
      name: c.name,
      rarity: c.rarity,
      element: c.element,
      icon: c.icon,
      count: c.count,
      popularityPct: c.popularity_pct,
      hpMed,
      atkMed,
      defMed,
      emMed,
      emMean,
      crMed,
      cdMed,
      cdMean,
      erMed,
      elemDmgMed,
      cvEff,
      avgConst: c.avg_constellation,
      c6Pct: c.c6_pct,
      top1WeaponPct,
      top1WeaponName,
      weaponEntropy,
      top1SetPct,
      top1SetName,
      setEntropy,
      crownedTalents,
      emGap,
      cdGap,
      polarizationScore,
      zScores: X[i],
      clusterId: cid,
      clusterName: clusterNameMap.get(cid) ?? 'Outros',
      clusterColor: clusterColorMap.get(cid) ?? '#818cf8',
      pca1,
      pca2,
    }
  })

  const bySlug = new Map(items.map((it) => [it.slug, it]))

  const clusters: ClusterSummary[] = clusterIds
    .map((cid) => {
      const members = items.filter((it) => it.clusterId === cid)
      const topMembers = [...members].sort((a, b) => b.count - a.count).slice(0, 4)
      return {
        id: cid,
        name: clusterNameMap.get(cid) ?? 'Outros',
        color: clusterColorMap.get(cid) ?? '#818cf8',
        count: members.length,
        medianHp: medianOf(members.map((m) => m.hpMed)),
        medianAtk: medianOf(members.map((m) => m.atkMed)),
        medianEm: medianOf(members.map((m) => m.emMed)),
        medianCr: medianOf(members.map((m) => m.crMed)),
        medianCd: medianOf(members.map((m) => m.cdMed)),
        medianEr: medianOf(members.map((m) => m.erMed)),
        examples: topMembers.map((m) => ({ slug: m.slug, name: m.name, icon: m.icon })),
      }
    })
    .sort((a, b) => b.count - a.count)

  const reliable = items.filter((it) => it.count >= 200)
  const pool = reliable.length >= 12 ? reliable : items

  const topCritValue = [...items].sort((a, b) => b.cvEff - a.cvEff).slice(0, 15)
  const mostLockedSets = [...pool].sort((a, b) => b.top1SetPct - a.top1SetPct).slice(0, 8)
  const mostFlexibleSets = [...pool]
    .filter((it) => it.char.artifact_sets.length >= 3)
    .sort((a, b) => b.setEntropy - a.setEntropy)
    .slice(0, 8)
  const mostLockedWeapons = [...pool].sort((a, b) => b.top1WeaponPct - a.top1WeaponPct).slice(0, 8)
  const mostFlexibleWeapons = [...pool]
    .filter((it) => it.char.weapons.length >= 3)
    .sort((a, b) => b.weaponEntropy - a.weaponEntropy)
    .slice(0, 8)
  const mostPolarized = [...pool].sort((a, b) => b.polarizationScore - a.polarizationScore).slice(0, 8)

  const fiveStars = items.filter((it) => it.rarity === 5)
  const corrSpecs: Array<{
    id: string
    labelA: string
    labelB: string
    subset: EnrichedCommunityChar[]
    getA: (x: EnrichedCommunityChar) => number
    getB: (x: EnrichedCommunityChar) => number
    explanation: string
  }> = [
    {
      id: 'crowns_cv',
      labelA: 'Talentos Coroados',
      labelB: 'Crit Value Efetivo',
      subset: items,
      getA: (x) => x.crownedTalents,
      getB: (x) => x.cvEff,
      explanation: 'Personagens que recebem mais coroas também concentram os maiores investimentos em artefatos críticos.',
    },
    {
      id: 'pop_cv',
      labelA: 'Popularidade (%)',
      labelB: 'Crit Value Efetivo',
      subset: items,
      getA: (x) => x.popularityPct,
      getB: (x) => x.cvEff,
      explanation: 'Personagens mais exibidos nas vitrines tendem a ser Hypercarries/DPS com maior foco em Crítico.',
    },
    {
      id: 'pop_c6',
      labelA: 'Popularidade (%)',
      labelB: 'Índice Whale (% C6 em 5★)',
      subset: fiveStars,
      getA: (x) => x.popularityPct,
      getB: (x) => x.c6Pct,
      explanation: '5★ mais raros nas vitrines costumam aparecer justamente nas contas dedicadas que os levaram a C6.',
    },
    {
      id: 'c6_weapon',
      labelA: '% C6 (5★)',
      labelB: 'Dominância da Arma #1',
      subset: fiveStars,
      getA: (x) => x.c6Pct,
      getB: (x) => x.top1WeaponPct,
      explanation: 'Mede se personagens com maior índice C6 também ficam mais concentrados na arma assinatura.',
    },
  ]

  const correlations: CorrelationInsight[] = corrSpecs.map((spec) => {
    const { rho, pValue } = spearmanCorrelation(
      spec.subset.map(spec.getA),
      spec.subset.map(spec.getB),
    )
    const significant = pValue < 0.05
    const strength = Math.abs(rho) >= 0.5 ? 'forte' : Math.abs(rho) >= 0.3 ? 'moderada' : 'fraca'
    const direction = rho >= 0 ? 'positiva' : 'negativa'
    return {
      id: spec.id,
      labelA: spec.labelA,
      labelB: spec.labelB,
      rho,
      pValue,
      significant,
      strength,
      direction,
      explanation: spec.explanation,
    }
  })

  return {
    items,
    bySlug,
    clusters,
    pcaVariance,
    topCritValue,
    mostLockedSets,
    mostFlexibleSets,
    mostLockedWeapons,
    mostFlexibleWeapons,
    mostPolarized,
    correlations,
  }
}
