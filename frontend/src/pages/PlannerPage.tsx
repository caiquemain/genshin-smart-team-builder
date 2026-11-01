import { useEffect, useMemo, useState } from 'react'
import { useLanguage } from '../context/LanguageContext'
import { iconUrl } from '../config'
import ItemTooltip from '../components/ItemTooltip'
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
import type { GoodData } from '../types/good'
import { 
  Flame, Droplets, Snowflake, Zap, Wind, Mountain, Leaf,
  Coins, Users, Sword, Calculator, CheckCircle2, AlertCircle
} from 'lucide-react'
import type { AggregateMaterial, CharBreakdown, WeaponBreakdown, TierGroup, Plan } from '../types/planner'

import { loadPlannerData, getPlannerData, pickLang } from '../utils/planner-data'
import { buildIndexes, resolveCharSlug, resolveWeaponSlug } from '../utils/slug-resolver'
import { computeAscensionCost, computeTalentCost, computeWeaponAscension } from '../utils/planner-compute'
import { parseGoodData, type GoodCharState } from '../utils/good-parser'

const STORAGE_KEY = 'gsb.planner.v5'

const ELEMENT_COLORS: Record<string, string> = {
  pyro: '#ff9c46', hydro: '#4cc2f1', electro: '#b398ff', cryo: '#93e2ff',
  anemo: '#73ffd0', geo: '#f2c869', dendro: '#a5c83b',
}
const ELEMENT_ICONS: Record<string, any> = {
  pyro: Flame, hydro: Droplets, electro: Zap, cryo: Snowflake,
  anemo: Wind, geo: Mountain, dendro: Leaf,
}

function mergeMats(target: Map<string, AggregateMaterial>, mats: AscensionMaterial[]) {
  for (const m of mats) {
    const existing = target.get(m.slug)
    if (existing) {
      existing.quantity += m.quantity
      existing.resin_estimate = estimateResin(existing.category, existing.quantity)
    } else {
      target.set(m.slug, {
        slug: m.slug, name: m.name, icon: m.icon, rarity: m.rarity,
        category: m.category, description: m.description, source: m.source,
        quantity: m.quantity, resin_estimate: estimateResin(m.category, m.quantity),
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
    <ItemTooltip data={{ name: material.name, icon: img, rarity: material.rarity, category: material.category, description: material.description, source: material.source }}>
      <div className={`ascension-item ${completed ? 'item-complete' : have > 0 ? 'item-partial' : 'item-unmapped'}`}>
        <div className="ascension-icon">{img ? <img src={img} alt={material.name} loading="lazy" /> : <span>?</span>}</div>
        <div className="ascension-info">
          <div className="ascension-name">
            {material.name}
            {completed && <span className="item-check">✓</span>}
            {unmapped && !completed && <span className="item-unmapped-mark" title="Sem correspondência no inventário">?</span>}
          </div>
          <div className="ascension-meta">
            <span className="stars">{'★'.repeat(material.rarity ?? 0)}</span>
            {have > 0 && <span className="have-badge">tem {have.toLocaleString('pt-BR')}</span>}
          </div>
        </div>
        <div className="ascension-qty-group">
          <div className="ascension-qty">×{material.quantity}</div>
          {!completed && <div className="ascension-missing">falta {missing.toLocaleString('pt-BR')}</div>}
          {completed && <div className="ascension-done">completo</div>}
        </div>
      </div>
    </ItemTooltip>
  )
}

export default function PlannerPage() {
  const { lang } = useLanguage()
  const [seelieData, setSeelieData] = useState<SeelieData | null>(null)
  const [goodData, setGoodData] = useState<GoodData | null>(null)
  const [plan, setPlan] = useState<Plan | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [chars, setChars] = useState<Map<string, CharacterSummary>>(new Map())
  const [weapons, setWeapons] = useState<Map<string, WeaponSummary>>(new Map())
  const [currentResin, setCurrentResin] = useState(200)

  useEffect(() => {
    loadPlannerData().then((data) => {
      buildIndexes(data)
      const cm = new Map<string, CharacterSummary>()
      for (const [slug, c] of Object.entries(data.characters)) {
        cm.set(slug, { slug, name: pickLang(c.name, lang), icon: c.icon, rarity: c.rarity, element: c.element as any, weapon_type: c.weapon_type as any, region: c.region as any })
      }
      setChars(cm)
      const wm = new Map<string, WeaponSummary>()
      for (const [slug, w] of Object.entries(data.weapons)) {
        wm.set(slug, { slug, name: pickLang(w.name, lang), icon: w.icon, rarity: w.rarity, weapon_type: w.weapon_type as any } as any)
      }
      setWeapons(wm)
    }).catch(e => setError(String(e)))
  }, [lang])

  useEffect(() => {
    try {
      localStorage.removeItem('gsb.planner.v1')
      localStorage.removeItem('gsb.planner.v2')
      localStorage.removeItem('gsb.planner.v3')
      localStorage.removeItem('gsb.planner.v4')
    } catch {}
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return
    try {
      const parsed = JSON.parse(saved)
      if (parsed?.seelie) setSeelieData(parsed.seelie)
      if (parsed?.good) setGoodData(parsed.good)
    } catch {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [])

  const saveToStorage = (s: SeelieData | null, g: GoodData | null) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ seelie: s, good: g }))
    } catch {}
  }

  const handleSeelieFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null); setPlan(null)
    try {
      const text = await file.text()
      const parsed = JSON.parse(text) as SeelieData
      if (!Array.isArray(parsed.goals)) throw new Error('Arquivo inválido do Seelie (falta `goals`)')
      setSeelieData(parsed)
      saveToStorage(parsed, goodData)
    } catch (err) { setError(String(err)) }
  }

  const handleGoodFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null); setPlan(null)
    try {
      const text = await file.text()
      const parsed = JSON.parse(text) as GoodData
      if (parsed.format !== 'GOOD' || !Array.isArray(parsed.characters)) {
        throw new Error('Arquivo não parece ser um export GOOD válido (falta `characters`)')
      }
      setGoodData(parsed)
      saveToStorage(seelieData, parsed)
    } catch (err) { setError(String(err)) }
  }

  const handleCompute = async () => {
    if (!seelieData && !goodData) return
    if (chars.size === 0 || weapons.size === 0) {
      setError('Dados ainda carregando. Aguarde 1s e tente de novo.')
      return
    }
    setLoading(true); setError(null)

    try {
      const data = getPlannerData()
      const warnings: string[] = []
      const notMapped = new Set<string>()
      let travelersSkipped = 0

      // 1. Extrai dados do Seelie (Metas)
      const seelieChars = new Map<string, SeelieCharacterGoal>()
      const seelieTalents = new Map<string, SeelieTalentGoal>()
      const seelieWeapons = new Map<string, SeelieWeaponGoal[]>()

      if (seelieData) {
        const artifactGoals = seelieData.goals.filter((g) => g.type === 'artifact')
        if (artifactGoals.length > 0) warnings.push(`${artifactGoals.length} goal(s) de artefato ignorado(s)`)

        for (const g of seelieData.goals) {
          if (g.type === 'character') {
            const slug = resolveCharSlug(g.character)
            if (slug) seelieChars.set(slug, g)
            else notMapped.add(g.character)
          } else if (g.type === 'talent') {
            const slug = resolveCharSlug(g.character)
            if (slug) seelieTalents.set(slug, g)
            else notMapped.add(g.character)
          } else if (g.type === 'weapon' && g.character) {
            const slug = resolveCharSlug(g.character)
            const wSlug = resolveWeaponSlug(g.weapon)
            if (slug && wSlug) {
              if (!seelieWeapons.has(slug)) seelieWeapons.set(slug, [])
              seelieWeapons.get(slug)!.push({ ...g, weapon: wSlug })
            } else {
              notMapped.add(`${g.character}/${g.weapon}`)
            }
          }
        }
      }

      // 2. Extrai dados do GOOD (Estado Atual)
      const goodMap = goodData ? parseGoodData(goodData) : new Map<string, GoodCharState>()

      // 3. União de todos os personagens
      const allSlugs = new Set<string>()
      seelieChars.forEach((_, k) => allSlugs.add(k))
      seelieTalents.forEach((_, k) => allSlugs.add(k))
      seelieWeapons.forEach((_, k) => allSlugs.add(k))
      goodMap.forEach((_, k) => allSlugs.add(k))

      // 4. Merge de Metas e Estado Atual
      interface ResolvedGoal {
        slug: string
        char_goal: SeelieCharacterGoal | null
        talent_goal: SeelieTalentGoal | null
        weapon_goals: SeelieWeaponGoal[]
      }
      const bySlug = new Map<string, ResolvedGoal>()

      for (const slug of allSlugs) {
        const sChar = seelieChars.get(slug)
        const sTal = seelieTalents.get(slug)
        const sWeapons = seelieWeapons.get(slug) || []
        const gState = goodMap.get(slug)

        if (!sChar && !gState && !sTal && sWeapons.length === 0) continue

        // --- Merge Character ---
        let currentLevel = sChar?.current.level ?? gState?.level ?? 1
        let goalLevel = sChar?.goal.level ?? gState?.level ?? 90
        let cons = sChar?.cons ?? gState?.cons ?? 0

        if (gState) {
          if (sChar && gState.level < sChar.current.level) {
            warnings.push(`GOOD desatualizado p/ ${slug}: nível ${gState.level} (GOOD) < ${sChar.current.level} (Seelie). Usando ${gState.level}.`)
          }
          currentLevel = gState.level
        }

        const charGoal: SeelieCharacterGoal | null = (sChar || gState) ? {
          type: 'character', character: slug, id: sChar?.id ?? 0, cons,
          current: { level: currentLevel, asc: 0 },
          goal: { level: goalLevel, asc: 0 },
        } : null

        // --- Merge Talents ---
        let na = sTal?.normal ?? { current: gState?.talents.na ?? 1, goal: gState?.talents.na ?? 1 }
        let es = sTal?.skill ?? { current: gState?.talents.es ?? 1, goal: gState?.talents.es ?? 1 }
        let eb = sTal?.burst ?? { current: gState?.talents.eb ?? 1, goal: gState?.talents.eb ?? 1 }

        if (gState) {
          na.current = gState.talents.na
          es.current = gState.talents.es
          eb.current = gState.talents.eb
        }

        const talentGoal: SeelieTalentGoal | null = (sTal || gState) ? {
          type: 'talent', character: slug, id: sTal?.id ?? 0,
          normal: na, skill: es, burst: eb,
        } : null

        // --- Merge Weapons ---
        const mergedWeapons: SeelieWeaponGoal[] = []
        for (const sw of sWeapons) {
          let currentWLevel = sw.current.level
          if (gState?.weaponSlug === sw.weapon) {
            currentWLevel = gState.weaponLevel
          }
          mergedWeapons.push({ ...sw, current: { ...sw.current, level: currentWLevel } })
        }

        // Se o GOOD tem uma arma que o Seelie não planejou, adiciona como completa
        if (gState?.weaponSlug && !mergedWeapons.some(w => w.weapon === gState.weaponSlug)) {
          mergedWeapons.push({
            type: 'weapon', character: slug, weapon: gState.weaponSlug, id: 0,
            current: { level: gState.weaponLevel, asc: 0 },
            goal: { level: gState.weaponLevel, asc: 0 },
          })
        }

        bySlug.set(slug, { slug, char_goal: charGoal, talent_goal: talentGoal, weapon_goals: mergedWeapons })
      }

      // 5. Cálculos (O resto é igual à versão anterior)
      const ascMap = new Map<string, AscensionCost>()
      const talMap = new Map<string, TalentCost>()
      const weaponAscMap = new Map<string, WeaponAscensionResponse>()
      let weaponsProcessed = 0

      for (const [slug, g] of bySlug.entries()) {
        if (g.char_goal && g.char_goal.current.level < g.char_goal.goal.level) {
          ascMap.set(slug, computeAscensionCost(data, slug, g.char_goal.current.level, g.char_goal.goal.level, lang) as any)
        }
        if (g.talent_goal) {
          talMap.set(slug, computeTalentCost(data, slug, g.talent_goal.normal, g.talent_goal.skill, g.talent_goal.burst, lang) as any)
        }
        for (const wg of g.weapon_goals) {
          if (wg.current.level < wg.goal.level) {
            weaponAscMap.set(`${slug}::${wg.weapon}`, computeWeaponAscension(data, wg.weapon, wg.current.level, wg.goal.level, lang) as any)
            weaponsProcessed++
          }
        }
      }

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
          const cost = weaponAscMap.get(`${slug}::${wg.weapon}`) ?? null
          weaponBreakdowns.push({
            slug: wg.weapon, name: wInfo?.name ?? wg.weapon, icon: wInfo?.icon ?? null,
            rarity: wInfo?.rarity ?? 4, from_level: wg.current.level, to_level: wg.goal.level, cost,
          })
        }

        let displayName = char?.name || slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

        charBreakdowns.push({
          slug, name: displayName, icon: char?.icon ?? null,
          ascension, talents, weapons: weaponBreakdowns,
          char_goal: g.char_goal, talent_goal: g.talent_goal,
        })

        if (ascension) { grand_mora += ascension.total_mora; mergeMats(grand_mats, ascension.materials) }
        if (talents) { grand_mora += talents.grand_total_mora; mergeMats(grand_mats, talents.grand_total_materials) }
        for (const wb of weaponBreakdowns) {
          if (wb.cost) { grand_mora += wb.cost.total_mora; mergeMats(grand_mats, wb.cost.materials) }
        }
      }

      charBreakdowns.sort((a, b) => {
        const costA = (a.ascension?.total_mora ?? 0) + (a.talents?.grand_total_mora ?? 0) + a.weapons.reduce((s, w) => s + (w.cost?.total_mora ?? 0), 0)
        const costB = (b.ascension?.total_mora ?? 0) + (b.talents?.grand_total_mora ?? 0) + b.weapons.reduce((s, w) => s + (w.cost?.total_mora ?? 0), 0)
        return costB - costA
      })

      const invRaw = (seelieData?.inventory || []) as SeelieInventoryItem[]
      const invResolved: Record<string, number> = {}
      const invStats = { mapped: 0, unmapped: 0, ambiguous: 0, total: invRaw.length }
      if (invRaw.length > 0) {
        const matList = Array.from(grand_mats.values())
        const direct = resolveInventory(invRaw, matList)
        Object.assign(invResolved, direct.resolved)
        invStats.mapped = Object.keys(direct.resolved).length
        invStats.ambiguous = direct.ambiguous.length
        invStats.unmapped = direct.unmapped.length
      }

      const allMats = Array.from(grand_mats.values())
      const tierGroups: TierGroup[] = TIERS.map((tier) => {
        const mats = allMats
          .filter((m) => tierOf(m.category).key === tier.key)
          .sort((a, b) => b.resin_estimate - a.resin_estimate || a.name.localeCompare(b.name))
        return { tier, materials: mats, resin_total: mats.reduce((s, m) => s + m.resin_estimate, 0) }
      }).filter((tg) => tg.materials.length > 0)

      const grand_resin = tierGroups.reduce((s, tg) => s + tg.resin_total, 0)
      let materialsComplete = 0, materialsPartial = 0
      for (const m of allMats) {
        const have = invResolved[m.slug] ?? 0
        if (have >= m.quantity) materialsComplete++
        else if (have > 0) materialsPartial++
      }

      const inactiveMap = (seelieData?.inactive as Record<string, boolean>) || {}
      for (const c of charBreakdowns) {
        c.is_inactive = !!inactiveMap[c.slug]
        c.has_ascension_pending = !!(c.char_goal && c.char_goal.current.level < c.char_goal.goal.level)
        c.has_talent_pending = !!(c.talent_goal && (
          c.talent_goal.normal.current < c.talent_goal.normal.goal ||
          c.talent_goal.skill.current < c.talent_goal.skill.goal ||
          c.talent_goal.burst.current < c.talent_goal.burst.goal
        ))
        c.has_weapon_pending = c.weapons.some((w) => w.from_level < w.to_level)
        c.is_complete = !c.has_ascension_pending && !c.has_talent_pending && !c.has_weapon_pending
      }

      const finalPlan: Plan = {
        chars: charBreakdowns, grand_mora, grand_resin, tier_groups: tierGroups, warnings,
        not_mapped: Array.from(notMapped).sort(), travelers_skipped: travelersSkipped,
        weapons_processed: weaponsProcessed, weapons_skipped: 0,
        inventory_resolved: invResolved, inventory_stats: invStats,
        materials_complete: materialsComplete, materials_partial: materialsPartial,
      }
      setPlan(finalPlan)
      try { localStorage.setItem('gsb.planner.plan', JSON.stringify(finalPlan)) } catch {}

    } catch (err) { setError(String(err)) } finally { setLoading(false) }
  }

  const handleClear = () => {
    setSeelieData(null); setGoodData(null); setPlan(null)
    localStorage.removeItem(STORAGE_KEY); localStorage.removeItem('gsb.planner.plan'); setError(null)
  }

  const summary = useMemo(() => {
    if (!seelieData && !goodData) return null
    return {
      seelieChars: seelieData?.goals.filter((g) => g.type === 'character').length ?? 0,
      seelieTalents: seelieData?.goals.filter((g) => g.type === 'talent').length ?? 0,
      seelieWeapons: seelieData?.goals.filter((g) => g.type === 'weapon').length ?? 0,
      inventory: seelieData?.inventory?.length ?? 0,
      goodChars: goodData?.characters.length ?? 0,
    }
  }, [seelieData, goodData])

  return (
    <div>
      <div className="page-header">
        <h1>Planejador</h1>
        {(seelieData || goodData) && (
          <button className="btn-danger" onClick={handleClear}>Limpar importações</button>
        )}
      </div>

      {!seelieData && !goodData && (
        <p className="status">
          Importe os JSONs para calcular o custo total. O <strong>Seelie</strong> traz as metas e o inventário. O <strong>GOOD</strong> traz o nível atual real da sua conta.
        </p>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
        <div className="import-card" style={{ borderColor: seelieData ? 'var(--primary)' : 'transparent' }}>
          <h2><CheckCircle2 size={18} style={{ display: 'inline', marginRight: 8, verticalAlign: 'text-bottom' }}/> Seelie (Metas)</h2>
          {seelieData ? (
             <p style={{ color: '#4ade80' }}>Importado com sucesso.</p>
          ) : (
            <>
              <p className="muted" style={{ fontSize: '14px', marginBottom: 12 }}>Traz o inventário e as metas de level/talentos.</p>
              <input type="file" accept=".json" onChange={handleSeelieFile} className="file-input" />
            </>
          )}
        </div>

        <div className="import-card" style={{ borderColor: goodData ? 'var(--primary)' : 'transparent' }}>
          <h2><CheckCircle2 size={18} style={{ display: 'inline', marginRight: 8, verticalAlign: 'text-bottom' }}/> GOOD (Estado Atual)</h2>
          {goodData ? (
             <p style={{ color: '#4ade80' }}>Importado com sucesso.</p>
          ) : (
            <>
              <p className="muted" style={{ fontSize: '14px', marginBottom: 12 }}>Sincroniza o nível atual dos personagens e armas.</p>
              <input type="file" accept=".json" onChange={handleGoodFile} className="file-input" />
            </>
          )}
        </div>
      </div>

      {(seelieData || goodData) && summary && (
        <>
          <div className="import-summary">
            <div><strong>{summary.goodChars}</strong> chars no GOOD</div>
            <div><strong>{summary.seelieChars}</strong> metas (Seelie)</div>
            <div><strong>{summary.inventory}</strong> itens no inv.</div>
          </div>

          <button
            className="btn-primary"
            onClick={handleCompute}
            disabled={loading || chars.size === 0 || weapons.size === 0}
            style={{ marginTop: 16, display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            <Calculator size={16} />
            {loading ? 'Calculando...' : chars.size === 0 ? 'Carregando dados...' : 'Calcular plano'}
          </button>
        </>
      )}

      {error && <p className="error">Erro: {error}</p>}

      {plan && (
        <>
          {plan.warnings.length > 0 && (
            <details className="planner-warnings">
              <summary>{plan.warnings.length} aviso(s) — clique para expandir</summary>
              {plan.warnings.map((w, i) => <div key={i}>⚠️ {w}</div>)}
            </details>
          )}

          <div className="planner-stats">
            <div className="planner-stat">
              <div className="planner-stat-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Coins size={14} /> Mora total</div>
              <div className="planner-stat-value mora">{formatResin(plan.grand_mora)}</div>
            </div>
            <div className="planner-stat">
              <div className="planner-stat-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Zap size={14} /> Resina estimada</div>
              <div className="planner-stat-value resin">{formatResin(plan.grand_resin)} ⚡</div>
            </div>
            <div className="planner-stat">
              <div className="planner-stat-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Users size={14} /> Personagens</div>
              <div className="planner-stat-value">{plan.chars.length}</div>
            </div>
          </div>

          <div className="resin-counter" style={{ marginTop: 24 }}>
            <label>Resina atual: <input type="number" min={0} max={2000} value={currentResin} onChange={(e) => setCurrentResin(Math.max(0, parseInt(e.target.value) || 0))} /></label>
            <div className="resin-days">
              Falta: <strong>{formatDays(Math.max(0, plan.grand_resin - currentResin))}</strong>
              <span className="resin-hint">({formatResin(Math.max(0, plan.grand_resin - currentResin))} ⚡ @ 180/dia)</span>
            </div>
          </div>

          <h2 style={{ marginTop: 32 }}>Materiais por resina</h2>
          {plan.tier_groups.map((tg) => (
            <details key={tg.tier.key} className="tier-group" open>
              <summary>
                <span className="tier-title"><span className="tier-emoji">{tg.tier.emoji}</span><span style={{ color: tg.tier.color }}>{tg.tier.label}</span></span>
                <span className="tier-meta">{tg.materials.length} tipo(s) {tg.resin_total > 0 && ` · ≈${formatResin(tg.resin_total)} ⚡`}</span>
              </summary>
              <div className="ascension-grid">
                {tg.materials.map((m) => <MaterialCard key={m.slug} material={m} have={plan.inventory_resolved[m.slug] ?? 0} />)}
              </div>
            </details>
          ))}

          <a href="/planner/characters" className="planner-view-chars-cta" style={{ marginTop: 32 }}>
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