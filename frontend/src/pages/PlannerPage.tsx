import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { useLanguage } from '../context/LanguageContext'
import { iconUrl } from '../config'
import ItemTooltip from '../components/ItemTooltip'
import { categoryInfo } from '../utils/categories'
import { tierOf, estimateResin, formatDays, formatResin, TIERS } from '../utils/resin'
import type {
  AscensionCost,
  TalentCost,
  AscensionMaterial,
  CharacterSummary,
} from '../types'
import type {
  SeelieData,
  SeelieCharacterGoal,
  SeelieTalentGoal,
} from '../types/seelie'

const STORAGE_KEY = 'gsb.planner.v3'

const SLUG_ALIASES: Record<string, string> = {
  'shogun': 'raiden-shogun',
  'heizou': 'shikanoin-heizou',
  'kokomi': 'sangonomiya-kokomi',
  'hutao': 'hu-tao',
  'ayaka': 'kamisato-ayaka',
  'shinobu': 'kuki-shinobu',
  'mizuki': 'yumemizuki-mizuki',
  'traveler_anemo': 'traveler',
  'traveler_geo': 'traveler',
  'traveler_electro': 'traveler',
  'traveler_dendro': 'traveler',
  'traveler_hydro': 'traveler',
  'traveler_pyro': 'traveler',
  'traveler_cryo': 'traveler',
}

interface AggregateMaterial {
  slug: string
  name: string
  icon: string | null
  rarity: number | null
  category: string
  description: string | null
  source: string | null
  quantity: number
  resin_estimate: number
}

interface CharBreakdown {
  slug: string
  name: string
  icon: string | null
  ascension: AscensionCost | null
  talents: TalentCost | null
  char_goal: SeelieCharacterGoal | null
  talent_goal: SeelieTalentGoal | null
}

interface TierGroup {
  tier: typeof TIERS[number]
  materials: AggregateMaterial[]
  resin_total: number
}

interface Plan {
  chars: CharBreakdown[]
  grand_mora: number
  grand_resin: number
  tier_groups: TierGroup[]
  warnings: string[]
  not_mapped: string[]
}

function resolveSlug(seelieSlug: string, chars: Map<string, CharacterSummary>): string | null {
  if (chars.has(seelieSlug)) return seelieSlug
  const alias = SLUG_ALIASES[seelieSlug]
  if (alias && chars.has(alias)) return alias
  return null
}

function mergeMats(target: Map<string, AggregateMaterial>, mats: AscensionMaterial[]) {
  for (const m of mats) {
    const existing = target.get(m.slug)
    if (existing) {
      existing.quantity += m.quantity
      existing.resin_estimate = estimateResin(existing.category, existing.quantity)
    } else {
      target.set(m.slug, {
        slug: m.slug,
        name: m.name,
        icon: m.icon,
        rarity: m.rarity,
        category: m.category,
        description: m.description,
        source: m.source,
        quantity: m.quantity,
        resin_estimate: estimateResin(m.category, m.quantity),
      })
    }
  }
}

function MaterialCard({ material }: { material: AggregateMaterial }) {
  const img = iconUrl(material.icon)
  const ci = categoryInfo(material.category)
  const tier = tierOf(material.category)
  return (
    <ItemTooltip
      data={{
        name: material.name,
        icon: img,
        rarity: material.rarity,
        category: material.category,
        description: material.description,
        source: material.source,
      }}
    >
      <div className="ascension-item tier-{tier.key}">
        <div className="ascension-icon">
          {img ? <img src={img} alt={material.name} loading="lazy" /> : <span>?</span>}
        </div>
        <div className="ascension-info">
          <div className="ascension-name">{material.name}</div>
          <div className="ascension-meta">
            <span className="stars">{'★'.repeat(material.rarity ?? 0)}</span>
            {material.resin_estimate > 0 && (
              <span className="resin-badge">≈{formatResin(material.resin_estimate)} ⚡</span>
            )}
          </div>
        </div>
        <div className="ascension-qty">×{material.quantity}</div>
      </div>
    </ItemTooltip>
  )
}

export default function PlannerPage() {
  const { lang } = useLanguage()
  const [seelieData, setSeelieData] = useState<SeelieData | null>(null)
  const [plan, setPlan] = useState<Plan | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [chars, setChars] = useState<Map<string, CharacterSummary>>(new Map())
  const [currentResin, setCurrentResin] = useState(200)

  useEffect(() => {
    api.listCharacters(lang, { limit: 200 })
      .then((d) => {
        const m = new Map<string, CharacterSummary>()
        d.items.forEach((c) => m.set(c.slug, c))
        setChars(m)
      })
      .catch(() => {})
  }, [lang])

  useEffect(() => {
    try { localStorage.removeItem('gsb.planner.v1'); localStorage.removeItem('gsb.planner.v2') } catch {}
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return
    try {
      const parsed = JSON.parse(saved)
      if (parsed?.seelieData && Array.isArray(parsed.seelieData.goals)) {
        setSeelieData(parsed.seelieData)
      } else {
        localStorage.removeItem(STORAGE_KEY)
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [])

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setPlan(null)
    try {
      const text = await file.text()
      const parsed = JSON.parse(text) as SeelieData
      if (!Array.isArray(parsed.goals)) {
        throw new Error('Arquivo não parece ser um export do Seelie (falta `goals`)')
      }
      setSeelieData(parsed)
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ seelieData: parsed }))
    } catch (err) {
      setError(String(err))
    }
  }

  const handleCompute = async () => {
    if (!seelieData) return
    if (chars.size === 0) {
      setError('Lista de personagens ainda carregando. Aguarde 1s e tente de novo.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const charGoals = seelieData.goals.filter(
        (g): g is SeelieCharacterGoal =>
          g.type === 'character' && g.current.level < g.goal.level,
      )
      const talentGoals = seelieData.goals.filter(
        (g): g is SeelieTalentGoal =>
          g.type === 'talent' &&
          (g.normal.current < g.normal.goal ||
            g.skill.current < g.skill.goal ||
            g.burst.current < g.burst.goal),
      )

      const warnings: string[] = []
      const notMapped = new Set<string>()

      const weaponGoals = seelieData.goals.filter((g) => g.type === 'weapon')
      const artifactGoals = seelieData.goals.filter((g) => g.type === 'artifact')
      if (weaponGoals.length > 0)
        warnings.push(`${weaponGoals.length} goal(s) de arma ignorado(s) — armas ainda não importadas`)
      if (artifactGoals.length > 0)
        warnings.push(`${artifactGoals.length} goal(s) de artefato ignorado(s) — artefatos ainda não importados`)

      interface ResolvedGoal {
        slug: string
        char_goal: SeelieCharacterGoal | null
        talent_goal: SeelieTalentGoal | null
      }
      const bySlug = new Map<string, ResolvedGoal>()

      for (const g of charGoals) {
        const resolved = resolveSlug(g.character, chars)
        if (!resolved) { notMapped.add(g.character); continue }
        const cur = bySlug.get(resolved) ?? { slug: resolved, char_goal: null, talent_goal: null }
        cur.char_goal = g
        bySlug.set(resolved, cur)
      }
      for (const g of talentGoals) {
        const resolved = resolveSlug(g.character, chars)
        if (!resolved) { notMapped.add(g.character); continue }
        const cur = bySlug.get(resolved) ?? { slug: resolved, char_goal: null, talent_goal: null }
        cur.talent_goal = g
        bySlug.set(resolved, cur)
      }

      const ascMap = new Map<string, AscensionCost>()
      const talMap = new Map<string, TalentCost>()
      const fetchJobs: Promise<void>[] = []

      for (const [slug, g] of bySlug.entries()) {
        if (g.char_goal) {
          fetchJobs.push(
            api.getAscensionCost(slug, g.char_goal.current.level, g.char_goal.goal.level, lang)
              .then((d) => { ascMap.set(slug, d) })
              .catch((e) => { warnings.push(`Ascensão de ${slug} falhou: ${String(e)}`) }),
          )
        }
        if (g.talent_goal) {
          const tg = g.talent_goal
          const target = Math.max(tg.normal.goal, tg.skill.goal, tg.burst.goal)
          fetchJobs.push(
            api.getTalentCost(slug, tg.normal.current, tg.skill.current, tg.burst.current, target, lang)
              .then((d) => { talMap.set(slug, d) })
              .catch((e) => { warnings.push(`Talentos de ${slug} falhou: ${String(e)}`) }),
          )
        }
      }
      await Promise.all(fetchJobs)

      const grand_mats = new Map<string, AggregateMaterial>()
      let grand_mora = 0
      const charBreakdowns: CharBreakdown[] = []

      for (const [slug, g] of bySlug.entries()) {
        const char = chars.get(slug)
        const ascension = ascMap.get(slug) ?? null
        const talents = talMap.get(slug) ?? null
        charBreakdowns.push({
          slug,
          name: char?.name ?? slug,
          icon: char?.icon ?? null,
          ascension,
          talents,
          char_goal: g.char_goal,
          talent_goal: g.talent_goal,
        })
        if (ascension) {
          grand_mora += ascension.total_mora
          mergeMats(grand_mats, ascension.materials)
        }
        if (talents) {
          grand_mora += talents.grand_total_mora
          mergeMats(grand_mats, talents.grand_total_materials)
        }
      }

      charBreakdowns.sort((a, b) => {
        const costA = (a.ascension?.total_mora ?? 0) + (a.talents?.grand_total_mora ?? 0)
        const costB = (b.ascension?.total_mora ?? 0) + (b.talents?.grand_total_mora ?? 0)
        return costB - costA
      })

      const allMats = Array.from(grand_mats.values())
      const tierGroups: TierGroup[] = TIERS.map((tier) => {
        const mats = allMats
          .filter((m) => tierOf(m.category).key === tier.key)
          .sort((a, b) => b.resin_estimate - a.resin_estimate || a.name.localeCompare(b.name))
        const resin = mats.reduce((s, m) => s + m.resin_estimate, 0)
        return { tier, materials: mats, resin_total: resin }
      }).filter((tg) => tg.materials.length > 0)

      const grand_resin = tierGroups.reduce((s, tg) => s + tg.resin_total, 0)

      const finalPlan: Plan = {
        chars: charBreakdowns.filter((c) => c.ascension || c.talents),
        grand_mora,
        grand_resin,
        tier_groups: tierGroups,
        warnings,
        not_mapped: Array.from(notMapped).sort(),
      }
      setPlan(finalPlan)
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  const handleClear = () => {
    setSeelieData(null)
    setPlan(null)
    localStorage.removeItem(STORAGE_KEY)
    setError(null)
  }

  const summary = useMemo(() => {
    if (!seelieData) return null
    const characters = seelieData.goals.filter((g) => g.type === 'character').length
    const talents = seelieData.goals.filter((g) => g.type === 'talent').length
    const weapons = seelieData.goals.filter((g) => g.type === 'weapon').length
    const artifacts = seelieData.goals.filter((g) => g.type === 'artifact').length
    return { characters, talents, weapons, artifacts, inventory: seelieData.inventory?.length ?? 0 }
  }, [seelieData])

  const daysRemaining = plan
    ? formatDays(Math.max(0, plan.grand_resin - currentResin))
    : null

  return (
    <div>
      <div className="page-header">
        <h1>Planejador</h1>
        {seelieData && (
          <button className="btn-danger" onClick={handleClear}>Limpar importação</button>
        )}
      </div>

      {!seelieData && (
        <>
          <p className="status">
            Importe o JSON do <strong>seelie.me</strong> para calcular o custo total em mora,
            materiais e resina.
          </p>
          <div className="import-card">
            <h2>Importar do Seelie</h2>
            <p>No seelie.me, exporte sua conta e selecione o arquivo <code>.json</code> abaixo.</p>
            <input
              type="file"
              accept="application/json,.json"
              onChange={handleFile}
              className="file-input"
            />
          </div>
        </>
      )}

      {seelieData && summary && (
        <>
          <div className="import-summary">
            <div><strong>{summary.characters}</strong> goals de personagem</div>
            <div><strong>{summary.talents}</strong> goals de talento</div>
            <div className="muted"><strong>{summary.weapons}</strong> armas <em>(ignoradas)</em></div>
            <div className="muted"><strong>{summary.artifacts}</strong> artefatos <em>(ignorados)</em></div>
            <div><strong>{summary.inventory}</strong> itens no inventário</div>
          </div>

          <button
            className="btn-primary"
            onClick={handleCompute}
            disabled={loading || chars.size === 0}
            style={{ marginTop: 16 }}
          >
            {loading
              ? 'Calculando...'
              : chars.size === 0
                ? 'Carregando personagens...'
                : 'Calcular custo total'}
          </button>
        </>
      )}

      {error && <p className="error">Erro: {error}</p>}

      {plan && (
        <>
          {plan.not_mapped.length > 0 && (
            <div className="planner-notmapped">
              <strong>⚠️ {plan.not_mapped.length} personagens não mapeados:</strong>{' '}
              <span>{plan.not_mapped.join(', ')}</span>
            </div>
          )}

          {plan.warnings.length > 0 && (
            <details className="planner-warnings">
              <summary>{plan.warnings.length} aviso(s) — clique para expandir</summary>
              {plan.warnings.map((w, i) => <div key={i}>⚠️ {w}</div>)}
            </details>
          )}

          <div className="planner-stats">
            <div className="planner-stat">
              <div className="planner-stat-label">Mora total</div>
              <div className="planner-stat-value mora">{formatResin(plan.grand_mora)}</div>
            </div>
            <div className="planner-stat">
              <div className="planner-stat-label">Resina estimada</div>
              <div className="planner-stat-value resin">{formatResin(plan.grand_resin)} ⚡</div>
            </div>
            <div className="planner-stat">
              <div className="planner-stat-label">Personagens a melhorar</div>
              <div className="planner-stat-value">{plan.chars.length}</div>
            </div>
          </div>

          <div className="resin-counter">
            <label>
              Resina atual:
              <input
                type="number"
                min={0}
                max={2000}
                value={currentResin}
                onChange={(e) => setCurrentResin(Math.max(0, parseInt(e.target.value) || 0))}
              />
            </label>
            <div className="resin-days">
              Falta farmar: <strong>{formatDays(Math.max(0, plan.grand_resin - currentResin))}</strong>
              <span className="resin-hint">({formatResin(Math.max(0, plan.grand_resin - currentResin))} ⚡ @ 180/dia)</span>
            </div>
          </div>

          <h2>Materiais por resina</h2>
          {plan.tier_groups.map((tg) => (
            <details key={tg.tier.key} className="tier-group" open>
              <summary>
                <span className="tier-title">
                  <span className="tier-emoji">{tg.tier.emoji}</span>
                  <span style={{ color: tg.tier.color }}>{tg.tier.label}</span>
                </span>
                <span className="tier-meta">
                  {tg.materials.length} tipo(s)
                  {tg.resin_total > 0 && ` · ≈${formatResin(tg.resin_total)} ⚡ · ${formatDays(tg.resin_total)}`}
                </span>
              </summary>
              <div className="ascension-grid">
                {tg.materials.map((m) => <MaterialCard key={m.slug} material={m} />)}
              </div>
            </details>
          ))}

          <h2>Personagens ({plan.chars.length})</h2>
          <div className="planner-chars">
            {plan.chars.map((c) => {
              const img = iconUrl(c.icon)
              const mora = (c.ascension?.total_mora ?? 0) + (c.talents?.grand_total_mora ?? 0)
              const lines: string[] = []
              if (c.char_goal) lines.push(`Nv. ${c.char_goal.current.level} → ${c.char_goal.goal.level}`)
              if (c.talent_goal) {
                const tg = c.talent_goal
                lines.push(`Tal. ${tg.normal.current}/${tg.skill.current}/${tg.burst.current} → ${tg.normal.goal}/${tg.skill.goal}/${tg.burst.goal}`)
              }
              return (
                <Link key={c.slug} to={`/characters/${c.slug}`} className="planner-char">
                  <div className="planner-char-icon">
                    {img ? <img src={img} alt={c.name} /> : <span>?</span>}
                  </div>
                  <div className="planner-char-info">
                    <div className="planner-char-name">{c.name}</div>
                    {lines.map((l, i) => <div key={i} className="planner-char-meta">{l}</div>)}
                    <div className="planner-char-cost">
                      {mora > 0 ? `${formatResin(mora)} Mora` : 'sem upgrade'}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
