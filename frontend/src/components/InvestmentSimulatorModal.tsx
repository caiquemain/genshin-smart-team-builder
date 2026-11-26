import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertCircle,
  ArrowRight,
  ArrowUpCircle,
  BookOpen,
  Calculator,
  Check,
  Coins,
  Gem,
  Sparkles,
  Sword,
  Target,
  TrendingUp,
  X,
} from 'lucide-react'
import { iconUrl } from '../config'
import type { UpgradeCandidate } from '../types'
import type { GoodCharState } from '../utils/good-parser'
import {
  simulatePortfolioAllocation,
  type PortfolioInputEntry,
} from '../utils/investment-simulator'
import { pickLang, type PlannerData } from '../utils/planner-data'
import type { Plan } from '../types/planner'

function formatMoraCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`
  return n.toLocaleString('pt-BR')
}

type SimPreset = 'focus' | 'top5' | 'custom'

export default function InvestmentSimulatorModal({
  candidates,
  focusSlugs,
  initialSelectedSlugs,
  plan,
  plannerData,
  getGoodState,
  lang,
  onClose,
}: {
  candidates: UpgradeCandidate[]
  focusSlugs: string[]
  initialSelectedSlugs?: string[]
  plan: Plan | null
  plannerData: PlannerData
  getGoodState: (slug: string) => GoodCharState | null
  lang: string
  onClose: () => void
}) {
  const focusSet = useMemo(() => new Set(focusSlugs), [focusSlugs])

  const defaultPreset: SimPreset = initialSelectedSlugs && initialSelectedSlugs.length > 0
    ? 'custom'
    : focusSlugs.some((s) => candidates.some((c) => c.slug === s))
      ? 'focus'
      : 'top5'

  const [preset, setPreset] = useState<SimPreset>(defaultPreset)
  const [customSlugs, setCustomSlugs] = useState<string[]>(() => {
    if (initialSelectedSlugs && initialSelectedSlugs.length > 0) return initialSelectedSlugs
    const focused = candidates.filter((c) => focusSet.has(c.slug)).map((c) => c.slug)
    if (focused.length > 0) return focused
    return candidates.slice(0, 5).map((c) => c.slug)
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const selectedCandidates = useMemo(() => {
    if (preset === 'focus') {
      return candidates.filter((c) => focusSet.has(c.slug))
    }
    if (preset === 'top5') {
      return candidates.slice(0, 5)
    }
    const bySlug = new Map(candidates.map((c) => [c.slug, c]))
    return customSlugs
      .map((s) => bySlug.get(s))
      .filter((c): c is UpgradeCandidate => Boolean(c))
  }, [preset, candidates, focusSet, customSlugs])

  const inventory = plan?.inventory_resolved ?? {}

  const simulation = useMemo(() => {
    const planCharBySlug = new Map((plan?.chars ?? []).map((c) => [c.slug, c]))

    const entries: PortfolioInputEntry[] = selectedCandidates.map((cand) => {
      const g = getGoodState(cand.slug)
      const pChar = planCharBySlug.get(cand.slug)
      const curLv = cand.current_level ?? pChar?.char_goal?.current?.level ?? g?.level ?? 1
      const curAsc = pChar?.char_goal?.current?.asc ?? g?.ascension ?? null
      const recLv = cand.recommended_level ?? 80
      // Se recomendado é 80, meta padrão é 80/90 (asc = 6); se 90, 90/90 (asc = 6)
      const targetLevel = Math.max(curLv, recLv)
      const targetAsc = targetLevel >= 80 ? 6 : null

      const planWeapon = pChar?.weapons?.[0] ?? null
      const weaponSlug = planWeapon?.slug ?? g?.weaponSlug ?? null
      const wMeta = weaponSlug ? plannerData.weapons[weaponSlug] : null
      const weaponName = planWeapon?.name ?? (wMeta ? pickLang(wMeta.name, lang) : weaponSlug)
      const weaponLevel = planWeapon?.from_level ?? g?.weaponLevel ?? 1

      return {
        candidate: cand,
        currentLevel: curLv,
        currentAsc: curAsc,
        targetLevel,
        targetAsc,
        weaponSlug,
        weaponName,
        weaponLevel,
        weaponAsc: null,
      }
    })

    return simulatePortfolioAllocation(entries, inventory, plannerData, lang)
  }, [selectedCandidates, plan, getGoodState, plannerData, inventory, lang])

  const toggleCustomSlug = (slug: string) => {
    setPreset('custom')
    setCustomSlugs((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    )
  }

  const hasAnyInventory =
    simulation.initialPool.mora > 0 ||
    simulation.initialPool.heroWits > 0 ||
    simulation.initialPool.mysticOres > 0

  return (
    <div className="plan-modal-overlay" onClick={onClose}>
      <div className="plan-modal pa-sim-modal" onClick={(e) => e.stopPropagation()}>
        <div className="plan-modal-header">
          <div className="plan-modal-header-info">
            <h2 className="plan-modal-name" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Calculator size={18} /> Simulador de Investimento (com sua mochila)
            </h2>
            <p className="pa-sim-subtitle">
              Calcula até que nível dá para subir agora com sua Mora, Livros XP, Minérios e materiais — em ordem de prioridade.
            </p>
          </div>
          <div className="plan-modal-header-actions">
            <button type="button" className="plan-modal-close" onClick={onClose} title="Fechar (Esc)">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="pa-sim-body">
          {/* Estoque da mochila: Inicial -> Restante */}
          <div className="pa-sim-stock-bar">
            <div className="pa-sim-stock-card">
              <span className="pa-sim-stock-label">
                <Coins size={13} /> Mora na mochila
              </span>
              <strong className="pa-sim-stock-val is-mora">
                {formatMoraCompact(simulation.initialPool.mora)}
              </strong>
              <small>
                Resta: <strong>{formatMoraCompact(simulation.remainingPool.mora)}</strong>
              </small>
            </div>
            <div className="pa-sim-stock-card">
              <span className="pa-sim-stock-label">
                <BookOpen size={13} /> Livros XP (eq. 20k)
              </span>
              <strong className="pa-sim-stock-val is-xp">
                {simulation.initialPool.heroWits.toLocaleString('pt-BR')}
              </strong>
              <small>
                Resta: <strong>{simulation.remainingPool.heroWits.toLocaleString('pt-BR')}</strong>
              </small>
            </div>
            <div className="pa-sim-stock-card">
              <span className="pa-sim-stock-label">
                <Gem size={13} /> Minérios Arma (eq. 10k)
              </span>
              <strong className="pa-sim-stock-val is-ore">
                {simulation.initialPool.mysticOres.toLocaleString('pt-BR')}
              </strong>
              <small>
                Resta: <strong>{simulation.remainingPool.mysticOres.toLocaleString('pt-BR')}</strong>
              </small>
            </div>
          </div>

          {!hasAnyInventory && (
            <div className="pa-sim-empty-hint">
              <AlertCircle size={15} />
              <span>
                Sua Mora, Livros de XP e Minérios ainda estão zerados no Planejador. Atualize seu estoque no{' '}
                <Link to="/planner" onClick={onClose}>Planejador de Farm</Link> para ver até onde consegue subir agora.
              </span>
            </div>
          )}

          {/* Seletor de grupo */}
          <div className="pa-sim-controls">
            <button
              type="button"
              className={`pa-sim-preset-btn ${preset === 'focus' ? 'is-active' : ''}`}
              onClick={() => setPreset('focus')}
              disabled={focusSlugs.length === 0}
            >
              <Target size={13} /> Meu Foco ({candidates.filter((c) => focusSet.has(c.slug)).length})
            </button>
            <button
              type="button"
              className={`pa-sim-preset-btn ${preset === 'top5' ? 'is-active' : ''}`}
              onClick={() => setPreset('top5')}
            >
              <TrendingUp size={13} /> Top 5 Quem Upar
            </button>
            <button
              type="button"
              className={`pa-sim-preset-btn ${preset === 'custom' ? 'is-active' : ''}`}
              onClick={() => setPreset('custom')}
            >
              <Sparkles size={13} /> Personalizado ({customSlugs.length})
            </button>
          </div>

          {preset === 'custom' && (
            <div className="pa-sim-picker-chips">
              {candidates.slice(0, 24).map((c) => {
                const active = customSlugs.includes(c.slug)
                return (
                  <button
                    key={c.slug}
                    type="button"
                    className={`pa-sim-pick-chip ${active ? 'is-active' : ''}`}
                    onClick={() => toggleCustomSlug(c.slug)}
                  >
                    {iconUrl(c.icon) && <img src={iconUrl(c.icon)!} alt={c.name} />}
                    <span>{c.name}</span>
                    {active && <Check size={12} />}
                  </button>
                )
              })}
            </div>
          )}

          {/* Lista de simulação */}
          {simulation.entries.length === 0 ? (
            <div className="pa-sim-empty-hint">
              <Target size={15} />
              <span>Nenhum personagem selecionado para simular. Escolha em "Top 5" ou "Personalizado".</span>
            </div>
          ) : (
            <div className="pa-sim-list">
              {simulation.entries.map((entry, idx) => {
                const { candidate, charReach, weaponReach, weaponName, advice } = entry
                const isFocused = focusSet.has(candidate.slug)
                return (
                  <div key={candidate.slug} className={`pa-sim-card ${isFocused ? 'is-focused' : ''}`}>
                    <div className="pa-sim-card-head">
                      <span className="pa-sim-order">#{idx + 1}</span>
                      <div className="pa-sim-avatar">
                        {iconUrl(candidate.icon) ? (
                          <img src={iconUrl(candidate.icon)!} alt={candidate.name} />
                        ) : (
                          <span>?</span>
                        )}
                      </div>
                      <div className="pa-sim-char-meta">
                        <div className="pa-sim-char-name-row">
                          <strong>{candidate.name}</strong>
                          {isFocused && (
                            <span className="pa-focus-badge">
                              <Target size={11} /> No Foco
                            </span>
                          )}
                        </div>
                        <small>
                          Meta recomendada: <strong>{candidate.recommended_level_label}</strong>
                          {candidate.level_scaling_tag ? ` — ${candidate.level_scaling_tag}` : ''}
                        </small>
                      </div>
                      <Link
                        to={`/planner/characters?add=${candidate.slug}&goal=${candidate.recommended_level}`}
                        className="btn-secondary pa-sim-plan-link"
                        onClick={onClose}
                      >
                        Planejar <ArrowRight size={12} />
                      </Link>
                    </div>

                    <div className="pa-sim-metrics">
                      {/* Alcance do personagem */}
                      <div className={`pa-sim-metric-box ${charReach.canAdvanceNow ? 'is-ready' : ''}`}>
                        <div className="pa-sim-metric-title">
                          <ArrowUpCircle size={13} /> Personagem
                        </div>
                        <div className="pa-sim-metric-range">
                          Nv. {charReach.startLevel} <ArrowRight size={12} /> <strong>{charReach.reachableLabel}</strong>
                          {charReach.reachedTarget && <span className="pa-sim-done-tag"><Check size={11} /> Meta atingida</span>}
                        </div>
                        {charReach.canAdvanceNow && (
                          <div className="pa-sim-metric-cost">
                            Usa {formatMoraCompact(charReach.moraUsed)} Mora · {charReach.heroWitsUsed} livros (20k)
                          </div>
                        )}
                        {charReach.blocker && (
                          <div className="pa-sim-blocker">
                            <AlertCircle size={12} /> Trava em: falta{' '}
                            <strong>
                              {charReach.blocker.kind === 'mora'
                                ? formatMoraCompact(charReach.blocker.missing)
                                : charReach.blocker.missing.toLocaleString('pt-BR')}
                            </strong>{' '}
                            {charReach.blocker.label}
                          </div>
                        )}
                      </div>

                      {/* Alcance da arma equipada */}
                      <div className={`pa-sim-metric-box ${weaponReach?.canAdvanceNow ? 'is-ready' : ''}`}>
                        <div className="pa-sim-metric-title">
                          <Sword size={13} /> Arma equipada{weaponName ? `: ${weaponName}` : ''}
                        </div>
                        {weaponReach ? (
                          <>
                            <div className="pa-sim-metric-range">
                              Nv. {weaponReach.startLevel} <ArrowRight size={12} /> <strong>{weaponReach.reachableLabel}</strong>
                              {weaponReach.reachedTarget && <span className="pa-sim-done-tag"><Check size={11} /> Nv. 90</span>}
                            </div>
                            {weaponReach.canAdvanceNow && (
                              <div className="pa-sim-metric-cost">
                                Usa {formatMoraCompact(weaponReach.moraUsed)} Mora · {weaponReach.mysticOresUsed} minérios (10k)
                              </div>
                            )}
                            {weaponReach.blocker && (
                              <div className="pa-sim-blocker">
                                <AlertCircle size={12} /> Trava em: falta{' '}
                                <strong>
                                  {weaponReach.blocker.kind === 'mora'
                                    ? formatMoraCompact(weaponReach.blocker.missing)
                                    : weaponReach.blocker.missing.toLocaleString('pt-BR')}
                                </strong>{' '}
                                {weaponReach.blocker.label}
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="pa-sim-metric-cost">
                            Nenhuma arma equipada detectada no GOOD/Planejador.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Recomendações de Custo x Retorno */}
                    {advice.length > 0 && (
                      <div className="pa-sim-advice">
                        {advice.map((step) => (
                          <div key={step.id} className={`pa-sim-advice-row is-${step.roi}`}>
                            <span className={`pa-sim-roi-pill is-${step.roi}`}>
                              {step.roi === 'high' ? 'Alto ROI' : step.roi === 'medium' ? 'Médio ROI' : 'Opcional'}
                            </span>
                            <div className="pa-sim-advice-text">
                              <strong>{step.title}</strong>
                              <span> — {step.detail}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
