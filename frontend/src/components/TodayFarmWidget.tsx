import { useMemo, useState } from 'react'
import { CalendarDays, BookOpen, Sword, Zap, CheckCircle2 } from 'lucide-react'
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
import { formatResin } from '../utils/resin'

const RARITY_BORDER: Record<number, string> = {
  2: '#4ade80',
  3: '#60a5fa',
  4: '#c084fc',
  5: '#fbbf24',
}

function DomainCard({
  entry,
  onEditMaterial,
}: {
  entry: DailyDomainEntry
  onEditMaterial: (slug: string) => void
}) {
  const img = iconUrl(entry.icon)
  const isTalent = entry.kind === 'talent'

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

      {/* Tiers faltantes (clique para atualizar estoque) */}
      <div className="today-domain-tiers">
        {entry.tiers.map((t) => {
          const tImg = iconUrl(t.icon)
          const done = t.missing === 0
          return (
            <button
              key={t.slug}
              type="button"
              className={`today-tier-btn ${done ? 'is-done' : ''}`}
              style={{ '--tier-color': RARITY_BORDER[t.rarity] ?? '#94a3b8' } as React.CSSProperties}
              onClick={() => onEditMaterial(t.slug)}
              title={`${t.name}: você tem ${t.have} de ${t.needed} — clique para atualizar`}
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
          )
        })}
      </div>
    </div>
  )
}

export default function TodayFarmWidget({
  plan,
  data,
  onEditMaterial,
}: {
  plan: Plan
  data: PlannerData
  onEditMaterial: (slug: string) => void
}) {
  const { lang } = useLanguage()
  const todayGenshin = useMemo(() => getGenshinDayOfWeek(), [])
  const [selectedDay, setSelectedDay] = useState<number>(todayGenshin)

  const daily = useMemo(
    () => computeDailyFarmPlan(plan, data, selectedDay, lang),
    [plan, data, selectedDay, lang],
  )

  const selectedDayInfo = DAY_LABELS_PT.find((d) => d.day === selectedDay)
  const isToday = selectedDay === todayGenshin

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
                <strong>{daily.openCount}</strong> domínio(s) do seu plano aberto(s) ·{' '}
                <strong>≈{formatResin(daily.totalMissingResin)} ⚡</strong> pendentes
                {selectedDay === 0 && ' · Domingo todos os domínios abrem!'}
              </>
            ) : (
              <>
                Nenhum domínio de talento/arma do seu plano pendente {isToday ? 'hoje' : 'neste dia'}.
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

      {daily.openCount === 0 ? (
        <div className="today-farm-empty">
          <CheckCircle2 size={18} color="#4ade80" />
          <span>
            Ótimo dia para focar em <strong>Bosses Normais</strong>, <strong>Chefes Semanais</strong>,{' '}
            <strong>Linhas Ley (XP/Mora)</strong> ou <strong>Artefatos</strong>!
          </span>
        </div>
      ) : (
        <div className="today-domains-grid">
          {daily.talentDomains.map((entry) => (
            <DomainCard key={`tal-${entry.familyKey}`} entry={entry} onEditMaterial={onEditMaterial} />
          ))}
          {daily.weaponDomains.map((entry) => (
            <DomainCard key={`wpn-${entry.familyKey}`} entry={entry} onEditMaterial={onEditMaterial} />
          ))}
        </div>
      )}
    </section>
  )
}
