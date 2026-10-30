import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { useLanguage } from '../context/LanguageContext'
import { iconUrl } from '../config'
import ItemTooltip from '../components/ItemTooltip'
import { categoryInfo } from '../utils/categories'
import { tierOf, estimateResin, formatDays, formatResin, TIERS } from '../utils/resin'
import { resolveInventory, type SeelieInventoryItem } from '../utils/inventory-mapper'
import type {
  AscensionCost,
  TalentCost,
  WeaponAscensionResponse,
  AscensionMaterial,
  CharacterSummary,
  WeaponSummary,
} from '../types'
import type {
  SeelieData,
  SeelieCharacterGoal,
  SeelieTalentGoal,
  SeelieWeaponGoal,
} from '../types/seelie'
import { Calculator, Upload, Trash2, Zap, Coins, Users, Sword, FlaskConical, Flame, Droplets, Snowflake, Wind, Mountain, Leaf } from 'lucide-react'

const STORAGE_KEY = 'gsb.planner.v4'

const ELEMENT_COLORS: Record<string, string> = {
  pyro: '#ff9c46', hydro: '#4cc2f1', electro: '#b398ff', cryo: '#93e2ff',
  anemo: '#73ffd0', geo: '#f2c869', dendro: '#a5c83b',
}
const ELEMENT_ICONS: Record<string, any> = {
  pyro: Flame, hydro: Droplets, electro: Zap, cryo: Snowflake,
  anemo: Wind, geo: Mountain, dendro: Leaf,
}

const SLUG_ALIASES: Record<string, string> = {
  'shogun': 'raiden-shogun',
  'heizou': 'shikanoin-heizou',
  'kokomi': 'sangonomiya-kokomi',
  'hutao': 'hu-tao',
  'ayaka': 'kamisato-ayaka',
  'shinobu': 'kuki-shinobu',
  'mizuki': 'yumemizuki-mizuki',
  'yunjin': 'yun-jin',
}

const WEAPON_ALIASES: Record<string, string> = {
  'amenoma_kageuta_blade': 'amenoma-kageuchi',
  'amenoma_kageuchi': 'amenoma-kageuchi',
  'wavebreakers_fin': 'wavebreaker-s-fin',
  'staff_of_homa': 'staff-of-homa',
  'mailed_flower': 'mailed-flower',
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

interface WeaponBreakdown {
  slug: string
  name: string
  icon: string | null
  rarity: number
  from_level: number
  to_level: number
  cost: WeaponAscensionResponse | null
}

interface CharBreakdown {
  slug: string
  name: string
  icon: string | null
  ascension: AscensionCost | null
  talents: TalentCost | null
  weapons: WeaponBreakdown[]
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
  travelers_skipped: number
  weapons_processed: number
  weapons_skipped: number
  inventory_resolved: Record<string, number>
  inventory_stats: { mapped: number; unmapped: number; ambiguous: number; total: number }
  materials_complete: number
  materials_partial: number
}

function resolveSlug(seelieSlug: string, chars: Map<string, CharacterSummary>): string | null {
  if (chars.has(seelieSlug)) return seelieSlug
  const alias = SLUG_ALIASES[seelieSlug]
  if (alias && chars.has(alias)) return alias
  return null
}

function resolveWeaponSlug(seelieSlug: string, weapons: Map<string, WeaponSummary>): string | null {
  const aliased = WEAPON_ALIASES[seelieSlug]
  if (aliased && weapons.has(aliased)) return aliased
  if (weapons.has(seelieSlug)) return seelieSlug
  const normalized = seelieSlug.replace(/_/g, '-')
  if (weapons.has(normalized)) return normalized
  const stripped = normalized.replace(/-(blade|bow|spear|claymore|catalyst|sword)$/, '')
  if (weapons.has(stripped)) return stripped
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

function MaterialCard({ material, have }: { material: AggregateMaterial; have: number }) {
  const img = iconUrl(material.icon)
  const completed = have >= material.quantity
  const missing = Math.max(0, material.quantity - have)
  const unmapped = have === 0
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
      <div className={`ascension-item ${completed ? 'item-complete' : have > 0 ? 'item-partial' : 'item-unmapped'}`}>
        <div className="ascension-icon">
          {img ? <img src={img} alt={material.name} loading="lazy" /> : <span>?</span>}
        </div>
        <div className="ascension-info">
          <div className="ascension-name">
            {material.name}
            {completed && <span className="item-check">✓</span>}
            {unmapped && !completed && <span className="item-unmapped-mark" title="Sem correspondência no inventário do Seelie">?</span>}
          </div>
          <div className="ascension-meta">
            <span className="stars">{'★'.repeat(material.rarity ?? 0)}</span>
            {have > 0 && (
              <span className="have-badge">
                tem {have.toLocaleString('pt-BR')}
              </span>
            )}
          </div>
        </div>
        <div className="ascension-qty-group">
          <div className="ascension-qty">×{material.quantity}</div>
          {!completed && (
            <div className="ascension-missing">
              falta {missing.toLocaleString('pt-BR')}
            </div>
          )}
          {completed && (
            <div className="ascension-done">completo</div>
          )}
        </div>
      </div>
    </ItemTooltip>
  )
}

// ============================================================
// COMPONENTES: Card por personagem (estilo Genshin Track)
// ============================================================





export default function PlannerPage() {
  const { lang } = useLanguage()
  const [seelieData, setSeelieData] = useState<SeelieData | null>(null)
  const [plan, setPlan] = useState<Plan | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [chars, setChars] = useState<Map<string, CharacterSummary>>(new Map())
  const [weapons, setWeapons] = useState<Map<string, WeaponSummary>>(new Map())
  const [currentResin, setCurrentResin] = useState(200)
  const [elementFilter, setElementFilter] = useState('')

  useEffect(() => {
    Promise.all([
      api.listCharacters(lang, { limit: 200 }),
      api.listWeapons(lang, { limit: 200 }),
    ])
      .then(([charsRes, weaponsRes]) => {
        const cm = new Map<string, CharacterSummary>()
        charsRes.items.forEach((c) => cm.set(c.slug, c))
        setChars(cm)
        const wm = new Map<string, WeaponSummary>()
        weaponsRes.items.forEach((w) => wm.set(w.slug, w))
        setWeapons(wm)
      })
      .catch(() => {})
  }, [lang])

  useEffect(() => {
    try {
      localStorage.removeItem('gsb.planner.v1')
      localStorage.removeItem('gsb.planner.v2')
      localStorage.removeItem('gsb.planner.v3')
    } catch {}
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
    if (chars.size === 0 || weapons.size === 0) {
      setError('Dados ainda carregando. Aguarde 1s e tente de novo.')
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
      const weaponGoalsRaw = seelieData.goals.filter(
        (g): g is SeelieWeaponGoal =>
          g.type === 'weapon' &&
          g.current.level < g.goal.level &&
          g.character !== null,
      )

      const warnings: string[] = []
      const notMapped = new Set<string>()
      let travelersSkipped = 0

      const artifactGoals = seelieData.goals.filter((g) => g.type === 'artifact')
      if (artifactGoals.length > 0)
        warnings.push(`${artifactGoals.length} goal(s) de artefato ignorado(s) — artefatos ainda não importados`)

      interface ResolvedGoal {
        slug: string
        char_goal: SeelieCharacterGoal | null
        talent_goal: SeelieTalentGoal | null
        weapon_goals: SeelieWeaponGoal[]
      }
      const bySlug = new Map<string, ResolvedGoal>()

      for (const g of charGoals) {
        const resolved = resolveSlug(g.character, chars)
        if (!resolved) {
          if (g.character.startsWith('traveler')) travelersSkipped++
          else notMapped.add(g.character)
          continue
        }
        const cur = bySlug.get(resolved) ?? { slug: resolved, char_goal: null, talent_goal: null, weapon_goals: [] }
        cur.char_goal = g
        bySlug.set(resolved, cur)
      }
      for (const g of talentGoals) {
        const resolved = resolveSlug(g.character, chars)
        if (!resolved) {
          if (g.character.startsWith('traveler')) travelersSkipped++
          else notMapped.add(g.character)
          continue
        }
        const cur = bySlug.get(resolved) ?? { slug: resolved, char_goal: null, talent_goal: null, weapon_goals: [] }
        cur.talent_goal = g
        bySlug.set(resolved, cur)
      }

      // Weapon goals: resolve weapon slug + char slug
      let weaponsProcessed = 0
      let weaponsSkipped = 0
      for (const g of weaponGoalsRaw) {
        const charSlug = resolveSlug(g.character!, chars)
        const weaponSlug = resolveWeaponSlug(g.weapon, weapons)
        if (!charSlug || !weaponSlug) {
          if (g.character!.startsWith('traveler')) travelersSkipped++
          else notMapped.add(`${g.character}/${g.weapon}`)
          weaponsSkipped++
          continue
        }
        const cur = bySlug.get(charSlug) ?? { slug: charSlug, char_goal: null, talent_goal: null, weapon_goals: [] }
        cur.weapon_goals.push({ ...g, weapon: weaponSlug })
        bySlug.set(charSlug, cur)
        weaponsProcessed++
      }

      // Fetch paralelo
      const ascMap = new Map<string, AscensionCost>()
      const talMap = new Map<string, TalentCost>()
      const weaponAscMap = new Map<string, WeaponAscensionResponse>() // key: `${charSlug}::${weaponSlug}`
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
        for (const wg of g.weapon_goals) {
          const key = `${slug}::${wg.weapon}`
          fetchJobs.push(
            api.getWeaponAscension(wg.weapon, wg.current.level, wg.goal.level, lang)
              .then((d) => { weaponAscMap.set(key, d) })
              .catch((e) => { warnings.push(`Arma ${wg.weapon} falhou: ${String(e)}`) }),
          )
        }
      }
      await Promise.all(fetchJobs)

      // Agrega
      const grand_mats = new Map<string, AggregateMaterial>()
      let grand_mora = 0
      const charBreakdowns: CharBreakdown[] = []

      for (const [slug, g] of bySlug.entries()) {
        const char = chars.get(slug)
        const ascension = ascMap.get(slug) ?? null
        const talents = talMap.get(slug) ?? null

        const weaponBreakdowns: WeaponBreakdown[] = []
        for (const wg of g.weapon_goals) {
          const wInfo = weapons.get(wg.weapon)
          const key = `${slug}::${wg.weapon}`
          const cost = weaponAscMap.get(key) ?? null
          weaponBreakdowns.push({
            slug: wg.weapon,
            name: wInfo?.name ?? wg.weapon,
            icon: wInfo?.icon ?? null,
            rarity: wInfo?.rarity ?? 4,
            from_level: wg.current.level,
            to_level: wg.goal.level,
            cost,
          })
        }

        charBreakdowns.push({
          slug,
          name: char?.name ?? slug,
          icon: char?.icon ?? null,
          ascension,
          talents,
          weapons: weaponBreakdowns,
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
        for (const wb of weaponBreakdowns) {
          if (wb.cost) {
            grand_mora += wb.cost.total_mora
            mergeMats(grand_mats, wb.cost.materials)
          }
        }
      }

      charBreakdowns.sort((a, b) => {
        const costA = (a.ascension?.total_mora ?? 0) + (a.talents?.grand_total_mora ?? 0) +
          a.weapons.reduce((s, w) => s + (w.cost?.total_mora ?? 0), 0)
        const costB = (b.ascension?.total_mora ?? 0) + (b.talents?.grand_total_mora ?? 0) +
          b.weapons.reduce((s, w) => s + (w.cost?.total_mora ?? 0), 0)
        return costB - costA
      })

      // === Inventário mapeado ===
      const invRaw = (seelieData.inventory || []) as SeelieInventoryItem[]
      const allMaterials: any[] = []
      // Precisa de TODOS os materiais pra matching — fetch inicial via /materials se existir
      // Por ora, usa os materiais que vieram no grand_mats
      const invResult = resolveInventory(invRaw, allMaterials)

      // Se resolveInventory não achar nada (allMaterials vazio), usa abordagem client-side:
      // o usuário tem inventário mas não temos catálogo completo no client.
      // Simplificação: mapeia direto por slug match usando os materiais do grand_mats.
      const invResolved: Record<string, number> = {}
      const invStats = { mapped: 0, unmapped: 0, ambiguous: 0, total: invRaw.length }
      if (allMaterials.length === 0) {
        // Fallback: match direto contra materiais do grand_mats
        const matBySlug: Record<string, any> = {}
        for (const m of grand_mats.values()) matBySlug[m.slug] = m
        const matList = Object.values(matBySlug)
        const direct = resolveInventory(invRaw, matList)
        Object.assign(invResolved, direct.resolved)
        invStats.mapped = Object.keys(direct.resolved).length
        invStats.ambiguous = direct.ambiguous.length
        invStats.unmapped = direct.unmapped.length
        // Log detalhado
        console.group('[Planner] Inventário mapeado')
        console.log('Total bruto:', invRaw.length)
        console.log('Mapeados:', Object.keys(direct.resolved).length, direct.resolved)
        console.log('Ambíguos:', direct.ambiguous.length, direct.ambiguous)
        console.log('Não mapeados:', direct.unmapped.length, direct.unmapped)
        console.groupEnd()
      }

      const allMats = Array.from(grand_mats.values())
      const tierGroups: TierGroup[] = TIERS.map((tier) => {
        const mats = allMats
          .filter((m) => tierOf(m.category).key === tier.key)
          .sort((a, b) => b.resin_estimate - a.resin_estimate || a.name.localeCompare(b.name))
        const resin = mats.reduce((s, m) => s + m.resin_estimate, 0)
        return { tier, materials: mats, resin_total: resin }
      }).filter((tg) => tg.materials.length > 0)

      const grand_resin = tierGroups.reduce((s, tg) => s + tg.resin_total, 0)

      // Estatísticas de completude (tem X / falta Y)
      let materialsComplete = 0
      let materialsPartial = 0
      for (const m of allMats) {
        const have = invResolved[m.slug] ?? 0
        if (have >= m.quantity) materialsComplete++
        else if (have > 0) materialsPartial++
      }

      const finalPlan: Plan = {
        chars: charBreakdowns.filter((c) =>
          c.ascension || c.talents || c.weapons.length > 0
        ),
        grand_mora,
        grand_resin,
        tier_groups: tierGroups,
        warnings,
        not_mapped: Array.from(notMapped).sort(),
        travelers_skipped: travelersSkipped,
        weapons_processed: weaponsProcessed,
        weapons_skipped: weaponsSkipped,
        inventory_resolved: invResolved,
        inventory_stats: invStats,
        materials_complete: materialsComplete,
        materials_partial: materialsPartial,
      }
      setPlan(finalPlan)
      try { localStorage.setItem('gsb.planner.plan', JSON.stringify(finalPlan)) } catch {}
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
            <div><strong>{summary.characters}</strong> personagens</div>
            <div><strong>{summary.talents}</strong> talentos</div>
            <div><strong>{summary.weapons}</strong> armas</div>
            <div className="muted"><strong>{summary.artifacts}</strong> artefatos <em>(ignorados)</em></div>
            <div><strong>{summary.inventory}</strong> itens</div>
          </div>

          <button
            className="btn-primary"
            onClick={handleCompute}
            disabled={loading || chars.size === 0 || weapons.size === 0}
            style={{ marginTop: 16 }}
          >
            {loading
              ? 'Calculando...'
              : chars.size === 0 || weapons.size === 0
                ? 'Carregando dados...'
                : 'Calcular custo total'}
          </button>
        </>
      )}

      {error && <p className="error">Erro: {error}</p>}

      {plan && (
        <>
          {plan.travelers_skipped > 0 && (
            <div className="planner-info">
              <strong>ℹ️ {plan.travelers_skipped} goal(s) do Traveler ignorado(s)</strong>{' '}
              — o Traveler tem dados próprios no Seelie e ainda não é suportado (feature futura).
            </div>
          )}

          {plan.not_mapped.length > 0 && (
            <details className="planner-notmapped" open={plan.not_mapped.length <= 5}>
              <summary>
                <strong>⚠️ {plan.not_mapped.length} item(ns) não mapeados</strong>
                <span className="notmapped-hint">{plan.not_mapped.length <= 5 ? '' : ' — clique para expandir'}</span>
              </summary>
              <div className="notmapped-list">
                {plan.not_mapped.map((n, i) => <code key={i}>{n}</code>)}
              </div>
            </details>
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
              <div className="planner-stat-label">Personagens</div>
              <div className="planner-stat-value">{plan.chars.length}</div>
            </div>
            <div className="planner-stat">
              <div className="planner-stat-label">Armas processadas</div>
              <div className="planner-stat-value">{plan.weapons_processed}</div>
            </div>
          </div>

          {(plan.materials_complete > 0 || plan.materials_partial > 0 || plan.inventory_stats.total > 0) && (
            <div className="inventory-summary">
              <div className="inv-summary-item">
                <span className="inv-icon inv-done">✓</span>
                <span><strong>{plan.materials_complete}</strong> materiais completos</span>
              </div>
              <div className="inv-summary-item">
                <span className="inv-icon inv-partial">◐</span>
                <span><strong>{plan.materials_partial}</strong> em progresso</span>
              </div>
              <div className="inv-summary-item">
                <span className="inv-icon inv-info">ℹ</span>
                <span>
                  {plan.inventory_stats.mapped} itens mapeados
                  {plan.inventory_stats.ambiguous > 0 && ` · ${plan.inventory_stats.ambiguous} ambíguos`}
                  {plan.inventory_stats.unmapped > 0 && ` · ${plan.inventory_stats.unmapped} sem match`}
                </span>
              </div>
            </div>
          )}

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
                {tg.materials.map((m) => <MaterialCard key={m.slug} material={m} have={plan.inventory_resolved[m.slug] ?? 0} />)}
              </div>
            </details>
          ))}

          <a href="/planner/characters" className="planner-view-chars-cta">
            <div className="planner-view-chars-icon">📋</div>
            <div className="planner-view-chars-text">
              <div className="planner-view-chars-title">Ver {plan.chars.length} personagens em detalhes</div>
              <div className="planner-view-chars-desc">Cards com portrait, talentos, materiais e dias de farm por personagem</div>
            </div>
            <div className="planner-view-chars-arrow">→</div>
          </a>
        </>
      )}
    </div>
  )
}
