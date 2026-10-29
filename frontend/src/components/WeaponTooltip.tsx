import { useRef, useState, type ReactNode } from 'react'
import {
  autoUpdate,
  flip,
  FloatingArrow,
  FloatingPortal,
  arrow as floatingArrow,
  offset,
  shift,
  useDismiss,
  useFloating,
  useFocus,
  useHover,
  useInteractions,
  useRole,
  safePolygon,
} from '@floating-ui/react'
import { iconUrl } from '../config'
import { formatStatLabel, formatStatValue } from '../utils/stats'
import type { WeaponSummary } from '../types'

const RARITY_COLORS: Record<number, string> = {
  1: '#8b8b8b', 2: '#5fa860', 3: '#5a8fd8', 4: '#a35bd8', 5: '#e0a647',
}

const WEAPON_TYPE_LABEL: Record<string, string> = {
  sword: 'Espada', claymore: 'Espadão', polearm: 'Lança', bow: 'Arco', catalyst: 'Catalisador',
}

function stripHtml(s: string | null | undefined): string {
  if (!s) return ''
  return s
    .replace(/<color=[^>]+>/g, '').replace(/<\/color>/g, '')
    .replace(/<i>/g, '').replace(/<\/i>/g, '')
    .replace(/\\n/g, '\n')
    .trim()
}

export default function WeaponTooltip({
  weapon,
  children,
}: {
  weapon: WeaponSummary
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const arrowRef = useRef<SVGSVGElement>(null)

  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    placement: 'top',
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(12),
      flip({ padding: 8 }),
      shift({ padding: 8 }),
      floatingArrow({ element: arrowRef }),
    ],
  })

  const hover = useHover(context, { delay: { open: 150, close: 60 }, handleClose: safePolygon() })
  const focus = useFocus(context)
  const dismiss = useDismiss(context)
  const role = useRole(context, { role: 'tooltip' })
  const { getReferenceProps, getFloatingProps } = useInteractions([hover, focus, dismiss, role])

  const accent = RARITY_COLORS[weapon.rarity] ?? RARITY_COLORS[1]
  const img = iconUrl(weapon.icon)

  return (
    <>
      <span ref={refs.setReference} {...getReferenceProps()} style={{ display: 'contents' }}>
        {children}
      </span>
      {open && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            {...getFloatingProps()}
            className="weapon-tooltip"
          >
            <div className="weapon-tooltip-header">
              <div className="weapon-tooltip-icon" style={{ borderColor: accent }}>
                {img ? <img src={img} alt={weapon.name} /> : <span>?</span>}
              </div>
              <div className="weapon-tooltip-title">
                <div className="weapon-tooltip-name" style={{ color: accent }}>
                  {weapon.name}
                </div>
                <div className="weapon-tooltip-stars" style={{ color: accent }}>
                  {'★'.repeat(weapon.rarity)}
                </div>
                <div className="weapon-tooltip-type">
                  {WEAPON_TYPE_LABEL[weapon.weapon_type] ?? weapon.weapon_type}
                </div>
              </div>
            </div>

            <div className="weapon-tooltip-stats">
              <div className="weapon-tooltip-stat">
                <span className="weapon-tooltip-stat-label">ATK Base (Lv.90)</span>
                <span className="weapon-tooltip-stat-value">
                  {weapon.max_base_atk ?? weapon.base_atk}
                  {weapon.max_base_atk != null && (
                    <span className="weapon-tooltip-stat-lv1">Lv.1: {weapon.base_atk}</span>
                  )}
                </span>
              </div>
              {weapon.secondary_stat && weapon.secondary_stat_value != null && (
                <div className="weapon-tooltip-stat">
                  <span className="weapon-tooltip-stat-label">
                    {formatStatLabel(weapon.secondary_stat)} (Lv.90)
                  </span>
                  <span className="weapon-tooltip-stat-value">
                    {formatStatValue(weapon.secondary_stat, weapon.max_secondary_stat_value ?? weapon.secondary_stat_value)}
                    {weapon.max_secondary_stat_value != null && weapon.max_secondary_stat_value !== weapon.secondary_stat_value && (
                      <span className="weapon-tooltip-stat-lv1">
                        Lv.1: {formatStatValue(weapon.secondary_stat, weapon.secondary_stat_value)}
                      </span>
                    )}
                  </span>
                </div>
              )}
            </div>

            {weapon.passive_name && (
              <div className="weapon-tooltip-passive">
                <div className="weapon-tooltip-passive-name">
                  {weapon.passive_name}
                  <span className="weapon-tooltip-passive-r5">R5</span>
                </div>
                {weapon.passive_description_r5 && (
                  <p className="weapon-tooltip-passive-desc">
                    {stripHtml(weapon.passive_description_r5)}
                  </p>
                )}
              </div>
            )}

            <FloatingArrow
              ref={arrowRef}
              context={context}
              width={14}
              height={7}
              tipRadius={2}
              className="weapon-tooltip-arrow"
            />
          </div>
        </FloatingPortal>
      )}
    </>
  )
}
