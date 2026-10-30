import { useState } from 'react'
import {
  useFloating, autoUpdate, offset, flip, shift,
  useHover, useInteractions, safePolygon,
  FloatingPortal,
} from '@floating-ui/react'
import type { TeamTierInfo } from '../types'

const TIER_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'S+': { bg: 'rgba(239,68,68,0.15)',   text: '#f87171', border: 'rgba(239,68,68,0.5)' },
  'S':  { bg: 'rgba(251,146,60,0.15)',  text: '#fb923c', border: 'rgba(251,146,60,0.5)' },
  'A':  { bg: 'rgba(251,191,36,0.15)',  text: '#fbbf24', border: 'rgba(251,191,36,0.5)' },
  'B':  { bg: 'rgba(74,222,128,0.15)',  text: '#4ade80', border: 'rgba(74,222,128,0.5)' },
  'C':  { bg: 'rgba(96,165,250,0.15)',  text: '#60a5fa', border: 'rgba(96,165,250,0.5)' },
  'D':  { bg: 'rgba(148,163,184,0.15)', text: '#94a3b8', border: 'rgba(148,163,184,0.5)' },
}

function tierStyle(tier: string | null) {
  return tier ? (TIER_COLORS[tier] ?? TIER_COLORS['D']) : TIER_COLORS['D']
}

interface Props {
  teamTier: TeamTierInfo | null
  size?: 'sm' | 'lg'
  showTooltip?: boolean
}

export default function TeamTierBadge({
  teamTier, size = 'sm', showTooltip = true,
}: Props) {
  const [open, setOpen] = useState(false)

  const { refs, floatingStyles, context, isPositioned } = useFloating({
    open: showTooltip && open,
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

  if (!teamTier || !teamTier.tier) {
    return (
      <span
        className={`team-tier-badge team-tier-badge--${size} team-tier-badge--empty`}
        title="Sem tier consolidado"
      >
        —
      </span>
    )
  }

  const style = tierStyle(teamTier.tier)

  return (
    <>
      <span
        ref={refs.setReference}
        {...(showTooltip ? getReferenceProps() : {})}
        className={`team-tier-badge team-tier-badge--${size}`}
        style={{
          background: style.bg,
          color: style.text,
          borderColor: style.border,
        }}
      >
        {teamTier.tier}
      </span>
      {showTooltip && open && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={{
              ...floatingStyles,
              opacity: isPositioned ? 1 : 0,
              zIndex: 20000,
            }}
            className="team-tier-tooltip"
            {...getFloatingProps()}
          >
            <div className="team-tier-tooltip-header">
              <div className="team-tier-tooltip-label">Tier do time</div>
              <div
                className="team-tier-tooltip-tier"
                style={{
                  background: style.bg,
                  color: style.text,
                  borderColor: style.border,
                }}
              >
                {teamTier.tier}
              </div>
            </div>
            <div className="team-tier-tooltip-stats">
              <span>
                Média: <strong>{teamTier.value.toFixed(2)}</strong>
              </span>
              <span style={{ color: '#64748b' }}>
                {teamTier.filled}/4 chars
              </span>
            </div>
            {teamTier.missing > 0 && (
              <div className="team-tier-tooltip-warn">
                ⚠ {teamTier.missing} slot{teamTier.missing > 1 ? 's' : ''} vazio{teamTier.missing > 1 ? 's' : ''}
              </div>
            )}
            <div className="team-tier-tooltip-chars">
              {teamTier.char_tiers.map((c) => {
                const cs = tierStyle(c.tier)
                return (
                  <div key={c.slug} className="team-tier-tooltip-char">
                    <span className="team-tier-tooltip-char-name">{c.name}</span>
                    <span
                      className="team-tier-tooltip-char-pill"
                      style={{
                        background: cs.bg,
                        color: cs.text,
                        borderColor: cs.border,
                      }}
                    >
                      {c.tier ?? '—'}
                    </span>
                    <span className="team-tier-tooltip-char-value">
                      {c.value ?? '—'}
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
