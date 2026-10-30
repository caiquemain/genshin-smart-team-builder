import { useState, type ReactNode } from 'react'
import {
  useFloating, autoUpdate, offset, flip, shift,
  useHover, useInteractions, safePolygon,
  FloatingPortal,
} from '@floating-ui/react'
import { iconUrl } from '../config'
import type { CharacterSummary } from '../types'
import type { AggregatedTier, TierlistSite } from '../types/tierlist'

const TIER_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'S+': { bg: 'rgba(239,68,68,0.15)',  text: '#f87171', border: 'rgba(239,68,68,0.5)' },
  'S':  { bg: 'rgba(251,146,60,0.15)', text: '#fb923c', border: 'rgba(251,146,60,0.5)' },
  'A':  { bg: 'rgba(251,191,36,0.15)', text: '#fbbf24', border: 'rgba(251,191,36,0.5)' },
  'B':  { bg: 'rgba(74,222,128,0.15)', text: '#4ade80', border: 'rgba(74,222,128,0.5)' },
  'C':  { bg: 'rgba(96,165,250,0.15)', text: '#60a5fa', border: 'rgba(96,165,250,0.5)' },
  'D':  { bg: 'rgba(148,163,184,0.15)', text: '#94a3b8', border: 'rgba(148,163,184,0.5)' },
}

const ELEMENT_COLORS: Record<string, {
  border: string
  glow: string
  bg: string
  portrait: string
}> = {
  pyro: {
    border:   'rgba(255, 123, 92, 0.55)',
    glow:     'rgba(255, 123, 92, 0.18)',
    bg:       'rgba(255, 100, 50, 0.07)',
    portrait: 'radial-gradient(circle, rgba(255, 100, 50, 0.35) 0%, rgba(15, 18, 24, 1) 100%)',
  },
  hydro: {
    border:   'rgba(74, 144, 226, 0.55)',
    glow:     'rgba(74, 144, 226, 0.20)',
    bg:       'rgba(74, 144, 226, 0.07)',
    portrait: 'radial-gradient(circle, rgba(74, 144, 226, 0.35) 0%, rgba(15, 18, 24, 1) 100%)',
  },
  electro: {
    border:   'rgba(183, 123, 232, 0.55)',
    glow:     'rgba(183, 123, 232, 0.20)',
    bg:       'rgba(183, 123, 232, 0.07)',
    portrait: 'radial-gradient(circle, rgba(183, 123, 232, 0.35) 0%, rgba(15, 18, 24, 1) 100%)',
  },
  cryo: {
    border:   'rgba(107, 213, 255, 0.55)',
    glow:     'rgba(107, 213, 255, 0.18)',
    bg:       'rgba(107, 213, 255, 0.07)',
    portrait: 'radial-gradient(circle, rgba(107, 213, 255, 0.35) 0%, rgba(15, 18, 24, 1) 100%)',
  },
  anemo: {
    border:   'rgba(93, 212, 160, 0.55)',
    glow:     'rgba(93, 212, 160, 0.18)',
    bg:       'rgba(93, 212, 160, 0.07)',
    portrait: 'radial-gradient(circle, rgba(93, 212, 160, 0.35) 0%, rgba(15, 18, 24, 1) 100%)',
  },
  geo: {
    border:   'rgba(224, 180, 74, 0.55)',
    glow:     'rgba(224, 180, 74, 0.20)',
    bg:       'rgba(224, 180, 74, 0.07)',
    portrait: 'radial-gradient(circle, rgba(224, 180, 74, 0.35) 0%, rgba(15, 18, 24, 1) 100%)',
  },
  dendro: {
    border:   'rgba(125, 212, 74, 0.55)',
    glow:     'rgba(125, 212, 74, 0.18)',
    bg:       'rgba(125, 212, 74, 0.07)',
    portrait: 'radial-gradient(circle, rgba(125, 212, 74, 0.35) 0%, rgba(15, 18, 24, 1) 100%)',
  },
}

const ROLE_LABELS: Record<string, string> = {
  main_dps: 'Main DPS',
  sub_dps: 'Sub-DPS',
  support: 'Support',
  general: 'General',
}

function tierStyle(t: string) {
  return TIER_COLORS[t] ?? TIER_COLORS['D']
}

interface Props {
  item: AggregatedTier
  char: CharacterSummary | undefined
  sites: TierlistSite[]
  children: ReactNode
}

export default function TierlistTooltip({ item, char, sites, children }: Props) {
  const [open, setOpen] = useState(false)

  const { refs, floatingStyles, context, isPositioned } = useFloating({
    open,
    onOpenChange: setOpen,
    placement: 'top',
    whileElementsMounted: autoUpdate,
    middleware: [offset(10), flip({ padding: 8 }), shift({ padding: 8 })],
  })

  const hover = useHover(context, {
    delay: { open: 100, close: 0 },
    handleClose: safePolygon(),
  })

  const { getReferenceProps, getFloatingProps } = useInteractions([hover])

  const name = char?.name ?? item.character_slug
  const consensusStyle = tierStyle(item.consensus_tier)
  const sitesMap = new Map(sites.map((s) => [s.slug, s.name]))
  const elementStyle = char?.element ? ELEMENT_COLORS[char.element] : null
  const portraitSrc: string | null = char?.icon ? iconUrl(char.icon) : null

  return (
    <>
      {/* FIX: display inline-block (com width fit-content) — display:contents
          não gera caixa, então getBoundingClientRect retorna 0 e o tooltip
          fica preso no canto superior esquerdo. */}
      <span
        ref={refs.setReference}
        {...getReferenceProps()}
        style={{ display: 'inline-block', width: 'fit-content' }}
      >
        {children}
      </span>
      {open && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={{
              ...floatingStyles,
              opacity: isPositioned ? 1 : 0,
              zIndex: 20000,
              backgroundColor: '#0f1218',
              ...(elementStyle
                ? {
                    borderColor: elementStyle.border,
                    backgroundImage: `linear-gradient(145deg, ${elementStyle.glow.replace('0.18', '0.22').replace('0.20', '0.22')}, transparent 65%)`,
                    boxShadow: `0 16px 48px rgba(0, 0, 0, 0.85), 0 0 0 1px ${elementStyle.border}, 0 0 28px ${elementStyle.glow}, inset 0 1px 0 rgba(255, 255, 255, 0.05)`,
                  }
                : {}),
            }}
            className="tierlist-tooltip"
            {...getFloatingProps()}
          >
            <div className="tierlist-tooltip-header">
              <div
                className="tierlist-tooltip-portrait"
                style={elementStyle ? { background: elementStyle.portrait } : {}}
              >
                {portraitSrc ? (
                  <img src={portraitSrc} alt={name} />
                ) : (
                  <span>?</span>
                )}
              </div>
              <div className="tierlist-tooltip-title">
                <div className="tierlist-tooltip-name">{name}</div>
                <div className="tierlist-tooltip-meta">
                  {char && <>{char.rarity}★ · {char.element} · </>}
                  {ROLE_LABELS[item.dominant_role] ?? item.dominant_role}
                </div>
              </div>
              <div
                className="tierlist-tooltip-badge"
                style={{
                  background: consensusStyle.bg,
                  color: consensusStyle.text,
                  borderColor: consensusStyle.border,
                }}
              >
                {item.consensus_tier}
              </div>
            </div>

            <div className="tierlist-tooltip-stats">
              <div>
                <span className="tierlist-tooltip-label">Consenso </span>
                <span className="tierlist-tooltip-value">
                  {item.consensus_tier}{' '}
                  <span className="tierlist-tooltip-sub">
                    ({item.consensus_votes}/{item.num_sites})
                  </span>
                </span>
              </div>
              <div>
                <span className="tierlist-tooltip-label">Média </span>
                <span className="tierlist-tooltip-value">
                  {item.tier_by_avg}{' '}
                  <span className="tierlist-tooltip-sub">
                    ({item.avg_score.toFixed(2)})
                  </span>
                </span>
              </div>
              <div>
                <span className="tierlist-tooltip-label">Spread </span>
                <span className="tierlist-tooltip-value">
                  {item.spread.toFixed(2)}
                </span>
              </div>
              <div>
                <span className="tierlist-tooltip-label">Votaram </span>
                <span className="tierlist-tooltip-value">
                  {item.tiers_voted.join(' · ') || '—'}
                </span>
              </div>
            </div>

            <div className="tierlist-tooltip-sites">
              {item.entries.map((e) => {
                const style = tierStyle(e.tier_master ?? 'D')
                const isOutlier =
                  Math.abs(e.normalized_value - item.avg_score) > 0.3
                return (
                  <div
                    key={e.site_slug}
                    className={`tierlist-tooltip-site${isOutlier ? ' outlier' : ''}`}
                  >
                    <span className="tierlist-tooltip-site-name">
                      {sitesMap.get(e.site_slug) ?? e.site_slug}
                    </span>
                    <span
                      className="tierlist-tooltip-pill"
                      style={{
                        background: style.bg,
                        color: style.text,
                        borderColor: style.border,
                      }}
                    >
                      {e.tier_label}
                    </span>
                    <div className="tierlist-tooltip-bar">
                      <div
                        className="tierlist-tooltip-bar-fill"
                        style={{
                          width: `${e.normalized_value * 100}%`,
                          ...(elementStyle
                            ? { background: `linear-gradient(90deg, ${elementStyle.border}, ${elementStyle.border})` }
                            : {}),
                        }}
                      />
                    </div>
                    <span className="tierlist-tooltip-score">
                      {e.normalized_value.toFixed(2)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </FloatingPortal>
      )}
    </>
  )
}
