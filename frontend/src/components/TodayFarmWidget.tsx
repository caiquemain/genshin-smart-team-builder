import { useMemo, useState } from 'react'
import { CalendarDays, BookOpen, Sword, Zap, CheckCircle2, Coins, Pencil } from 'lucide-react'
import { iconUrl } from '../config'
import { useLanguage } from '../context/LanguageContext'
import type { Plan } from '../types/planner'
import type { PlannerData } from '../utils/planner-data'
import {
  DAY_LABELS_PT,
  computeDailyFarmPlan,
  getGenshinDayOfWeek,
  type DailyDomainEntry,
} from '../utils/domain-schedule'
import { estimateResinRange, formatResin } from '../utils/resin'
import {
  ADVENTURER_EXP_SLUG,
  getOwnedCharXp,
  HERO_WIT_SLUG,
  WANDERER_ADVICE_SLUG,
} from '../utils/xp-costs'
import { getXpMaterials } from '../utils/planner-recompute'
import ItemTooltip from './ItemTooltip'

const RARITY_BORDER: Record<number, string> = {
  2: '#4ade80',
  3: '#60a5fa',
  4: '#c084fc',
  5: '#fbbf24',
}

const MORA_ICON = 'UI_ItemIcon_202'
const HERO_WIT_ICON = 'UI_ItemIcon_104003'
const ADVENTURER_EXP_ICON = 'UI_ItemIcon_104002'
const WANDERER_ADVICE_ICON = 'UI_ItemIcon_104001'

function DomainCard({
  entry,
  wl,
  onEditMaterial,
}: {
  entry: DailyDomainEntry
  wl: number
  onEditMaterial: (slug: string) => void
}) {
  const img = iconUrl(entry.icon)
  const isTalent = entry.kind === 'talent'
  const category = isTalent ? 'talent_book' : 'weapon_ascension'

  return (
    <div className="today-domain-card">
      <div className="today-domain-header">
        <div
          className="today-domain-icon"
          style={{ borderColor: RARITY_BORDER[entry.rarity] ?? '#c084fc' }}
        >
          {img ? <img src={img} alt={entry.displayName} loading="lazy" /> : <span>?</span>}
        </div>
        <div className="today-domain-title-wrap">
          <div className="today-domain-name">{entry.displayName}</div>
          <div className="today-domain-meta">
            <span className={`today-kind-pill ${isTalent ? 'is-talent' : 'is-weapon'}`}>
              {isTalent ? <><BookOpen size={11} /> Talento</> : <><Sword size={11} /> Arma</>}
            </span>
            <span>{entry.region}</span>
            <span>·</span>
            <span>{entry.scheduleLabel}</span>
          </div>
        </div>
        <div className="today-domain-resin" title="Resina estimada restante neste domínio">
          <Zap size={13} /> {formatResin(entry.resinMissing)}
        </div>
      </div>

      {/* Quem usa este domínio */}
      <div className="today-domain-users">
        {entry.usedBy.slice(0, 8).map((u) => {
          const uImg = iconUrl(u.icon)
          return (
            <span key={`${u.kind}-${u.slug}`} className="today-user-chip" title={u.name}>
              {uImg && <img src={uImg} alt={u.name} loading="lazy" />}
              <span>{u.name}</span>
            </span>
          )
        })}
        {entry.usedBy.length > 8 && (
          <span className="today-user-more">+{entry.usedBy.length - 8}</span>
        )}
      </div>

      {/* Tiers faltantes (hover = tooltip de runs, clique = atualizar estoque) */}
      <div className="today-domain-tiers">
        {entry.tiers.map((t) => {
          const tImg = iconUrl(t.icon)
          const done = t.missing === 0
          const resinRange = estimateResinRange(category, t.needed, t.have, {
            rarity: t.rarity,
            wl,
          })
          return (
            <ItemTooltip
              key={t.slug}
              data={{
                name: t.name,
                icon: tImg,
                rarity: t.rarity,
                category,
                source: `${entry.displayName} (${entry.region}) · ${entry.scheduleLabel}`,
                resinRange,
              }}
            >
              <button
                type="button"
                className={`today-tier-btn ${done ? 'is-done' : ''}`}
                style={{ '--tier-color': RARITY_BORDER[t.rarity] ?? '#94a3b8' } as React.CSSProperties}
                onClick={() => onEditMaterial(t.slug)}
              >
                {tImg && <img src={tImg} alt={t.name} loading="lazy" />}
                <span className="today-tier-counts">
                  {done ? (
                    <>✓ {t.have}/{t.needed}</>
                  ) : (
                    <><strong>-{t.missing}</strong> <small>({t.have}/{t.needed})</small></>
                  )}
                </span>
              </button>
            </ItemTooltip>
          )
        })}
      </div>
    </div>
  )
}

function LeylineCard({
  kind,
  needed,
  have,
  wl,
  xpBooks,
  onEditMaterial,
}: {
  kind: 'mora' | 'xp'
  needed: number
  have: number
  wl: number
  xpBooks?: { heroWits: number; adventurerExp: number; wandererAdvice: number }
  onEditMaterial: (slug: string) => void
}) {
  const isMora = kind === 'mora'
  const missing = Math.max(0, needed - have)
  const icon = iconUrl(isMora ? MORA_ICON : HERO_WIT_ICON)
  const title = isMora ? 'Linha Ley — Flor da Riqueza' : 'Linha Ley — Flor da Revelação'
  const itemName = isMora ? 'Mora' : "Livros de XP (eq. Hero's Wit)"
  const category = isMora ? 'mora' : 'character_exp'
  const resinRange = estimateResinRange(category, needed, have, { rarity: isMora ? 3 : 4, wl })

  const fmtQty = (n: number) =>
    isMora && n >= 1_000_000
      ? `${(n / 1_000_000).toFixed(2)}M`
      : isMora && n >= 10_000
        ? `${Math.round(n / 1_000)}k`
        : n.toLocaleString('pt-BR')

  const xpBookTiers = !isMora && xpBooks
    ? [
        { slug: HERO_WIT_SLUG, name: "Experiência do Herói (20k XP)", icon: HERO_WIT_ICON, rarity: 4, count: xpBooks.heroWits },
        { slug: ADVENTURER_EXP_SLUG, name: 'Experiência do Aventureiro (5k XP)', icon: ADVENTURER_EXP_ICON, rarity: 3, count: xpBooks.adventurerExp },
        { slug: WANDERER_ADVICE_SLUG, name: 'Conselho do Andarilho (1k XP)', icon: WANDERER_ADVICE_ICON, rarity: 2, count: xpBooks.wandererAdvice },
      ]
    : null

  return (
    <ItemTooltip
      data={{
        name: itemName,
        icon,
        rarity: isMora ? 3 : 4,
        category,
        source: `${title} · Aberto todos os dias (20 resina/run)`,
        resinRange,
      }}
    >
      <div
        className={`today-domain-card today-leyline-card ${isMora ? 'is-mora' : 'is-xp'}`}
        onClick={isMora ? () => onEditMaterial('mora') : undefined}
        role={isMora ? 'button' : undefined}
        tabIndex={isMora ? 0 : undefined}
        onKeyDown={
          isMora
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onEditMaterial('mora')
                }
              }
            : undefined
        }
      >
        <div className="today-domain-header">
          <div
            className="today-domain-icon"
            style={{ borderColor: isMora ? '#fbbf24' : '#a78bfa' }}
          >
            {icon ? <img src={icon} alt={itemName} loading="lazy" /> : <span>?</span>}
          </div>
          <div className="today-domain-title-wrap">
            <div className="today-domain-name">{title}</div>
            <div className="today-domain-meta">
              <span className={`today-kind-pill ${isMora ? 'is-mora' : 'is-xp'}`}>
                {isMora ? <><Coins size={11} /> Mora</> : <><BookOpen size={11} /> XP</>}
              </span>
              <span>Todos os dias</span>
              <span>·</span>
              <span>{resinRange.avgRuns} {resinRange.avgRuns === 1 ? 'run' : 'runs'}</span>
            </div>
          </div>
          <div className="today-domain-resin" title="Resina estimada na Linha Ley">
            <Zap size={13} /> {formatResin(resinRange.avgResin)}
          </div>
        </div>

        {xpBookTiers && (
          <div className="today-domain-tiers">
            {xpBookTiers.map((b) => (
              <button
                key={b.slug}
                type="button"
                className="today-tier-btn"
                style={{ '--tier-color': RARITY_BORDER[b.rarity] ?? '#c084fc' } as React.CSSProperties}
                onClick={(e) => {
                  e.stopPropagation()
                  onEditMaterial(b.slug)
                }}
                title={`${b.name} — clique para atualizar quantidade`}
              >
                <img src={iconUrl(b.icon)!} alt={b.name} loading="lazy" />
                <span className="today-tier-counts">
                  <strong>{b.count.toLocaleString('pt-BR')}</strong>
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="today-leyline-foot">
          <span>
            Falta <strong>{fmtQty(missing)}</strong>{' '}
            <small>
              (eq. {fmtQty(have)} / {fmtQty(needed)})
            </small>
          </span>
          {isMora && (
            <span className="today-leyline-edit">
              <Pencil size={11} /> Atualizar
            </span>
          )}
        </div>
      </div>
    </ItemTooltip>
  )
}

export default function TodayFarmWidget({
  plan,
  data,
  wl = 9,
  onEditMaterial,
}: {
  plan: Plan
  data: PlannerData
  wl?: number
  onEditMaterial: (slug: string) => void
}) {
  const { lang } = useLanguage()
  const todayGenshin = useMemo(() => getGenshinDayOfWeek(), [])
  const [selectedDay, setSelectedDay] = useState<number>(todayGenshin)

  const daily = useMemo(
    () => computeDailyFarmPlan(plan, data, selectedDay, lang),
    [plan, data, selectedDay, lang],
  )

  const leylines = useMemo(() => {
    let heroWitsNeeded = 0
    for (const c of plan.chars) {
      if (c.is_inactive) continue
      heroWitsNeeded += getXpMaterials(c, wl).heroWits
    }
    const moraHave = plan.inventory_resolved['mora'] ?? 0
    const ownedXp = getOwnedCharXp(plan.inventory_resolved)
    const moraMissing = Math.max(0, plan.grand_mora - moraHave)
    const xpMissing = Math.max(0, heroWitsNeeded - ownedXp.heroWitEquivalent)
    return {
      moraNeeded: plan.grand_mora,
      moraHave,
      moraMissing,
      xpNeeded: heroWitsNeeded,
      xpHave: ownedXp.heroWitEquivalent,
      xpMissing,
      xpBooks: {
        heroWits: ownedXp.heroWits,
        adventurerExp: ownedXp.adventurerExp,
        wandererAdvice: ownedXp.wandererAdvice,
      },
    }
  }, [plan, wl])

  const selectedDayInfo = DAY_LABELS_PT.find((d) => d.day === selectedDay)
  const isToday = selectedDay === todayGenshin
  const hasLeylines = leylines.moraMissing > 0 || leylines.xpMissing > 0

  return (
    <section className="today-farm-widget">
      <div className="today-farm-top">
        <div>
          <h2 className="today-farm-heading">
            <CalendarDays size={18} />
            {isToday ? 'O que farmar HOJE' : `Domínios de ${selectedDayInfo?.full}`}
          </h2>
          <p className="today-farm-sub">
            {daily.openCount > 0 ? (
              <>
                <strong>{daily.openCount}</strong> domínio(s) aberto(s) ·{' '}
                <strong>≈{formatResin(daily.totalMissingResin)} ⚡</strong> pendentes
                {hasLeylines && ' · + Linhas Ley (Mora/XP)'}
                {selectedDay === 0 && ' · Domingo todos os domínios abrem!'}
              </>
            ) : (
              <>
                Nenhum domínio de talento/arma pendente {isToday ? 'hoje' : 'neste dia'}.
                {daily.otherDaysCount > 0 && ` (${daily.otherDaysCount} domínio(s) pendente(s) em outros dias)`}
              </>
            )}
          </p>
        </div>

        <div className="today-day-pills" role="tablist" aria-label="Dia da semana">
          {DAY_LABELS_PT.map((d) => (
            <button
              key={d.day}
              type="button"
              role="tab"
              aria-selected={selectedDay === d.day}
              className={`today-day-pill ${selectedDay === d.day ? 'active' : ''} ${d.day === todayGenshin ? 'is-today' : ''}`}
              onClick={() => setSelectedDay(d.day)}
              title={d.day === todayGenshin ? `${d.full} (Hoje — reset às 04h)` : d.full}
            >
              {d.short}
              {d.day === todayGenshin && <span className="today-dot" />}
            </button>
          ))}
        </div>
      </div>

      {daily.openCount === 0 && !hasLeylines ? (
        <div className="today-farm-empty">
          <CheckCircle2 size={18} color="#4ade80" />
          <span>
            Ótimo dia para focar em <strong>Bosses Normais</strong>, <strong>Chefes Semanais</strong> ou{' '}
            <strong>Artefatos</strong>!
          </span>
        </div>
      ) : (
        <div className="today-domains-grid">
          {daily.talentDomains.map((entry) => (
            <DomainCard key={`tal-${entry.familyKey}`} entry={entry} wl={wl} onEditMaterial={onEditMaterial} />
          ))}
          {daily.weaponDomains.map((entry) => (
            <DomainCard key={`wpn-${entry.familyKey}`} entry={entry} wl={wl} onEditMaterial={onEditMaterial} />
          ))}
          {leylines.xpMissing > 0 && (
            <LeylineCard
              kind="xp"
              needed={leylines.xpNeeded}
              have={leylines.xpHave}
              wl={wl}
              xpBooks={leylines.xpBooks}
              onEditMaterial={onEditMaterial}
            />
          )}
          {leylines.moraMissing > 0 && (
            <LeylineCard
              kind="mora"
              needed={leylines.moraNeeded}
              have={leylines.moraHave}
              wl={wl}
              onEditMaterial={onEditMaterial}
            />
          )}
        </div>
      )}
    </section>
  )
}

