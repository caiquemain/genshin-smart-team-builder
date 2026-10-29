import {
  cloneElement, isValidElement, useRef, useState, type ReactElement, type ReactNode,
} from 'react'
import {
  autoUpdate, flip, FloatingArrow, FloatingPortal, arrow as floatingArrow,
  offset, shift, useDismiss, useFloating, useFocus, useHover, useInteractions, useRole, safePolygon,
} from '@floating-ui/react'
import { artifactIconUrl } from '../config'
import type { ArtifactSetSummary } from '../types'

const RARITY_COLORS: Record<number, string> = {
  3: '#5a8fd8', 4: '#a35bd8', 5: '#e0a647',
}

export default function ArtifactTooltip({ artifact, children }: { artifact: ArtifactSetSummary; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const arrowRef = useRef<SVGSVGElement>(null)

  const { refs, floatingStyles, context, isPositioned } = useFloating({
    open, onOpenChange: setOpen, placement: 'top', whileElementsMounted: autoUpdate,
    middleware: [offset(12), flip({ padding: 8 }), shift({ padding: 8 }), floatingArrow({ element: arrowRef })],
  })

  const hover = useHover(context, { delay: { open: 150, close: 60 }, handleClose: safePolygon() })
  const focus = useFocus(context)
  const dismiss = useDismiss(context)
  const role = useRole(context, { role: 'tooltip' })
  const { getReferenceProps, getFloatingProps } = useInteractions([hover, focus, dismiss, role])

  const accent = RARITY_COLORS[artifact.rarity_max] ?? '#a35bd8'
  const img = artifactIconUrl(artifact.icon)

  const child = isValidElement(children)
    ? cloneElement(children as ReactElement<any>, {
        ref: refs.setReference,
        ...getReferenceProps(),
      })
    : children

  return (
    <>
      {child}
      {open && (
        <FloatingPortal>
          <div ref={refs.setFloating} style={{ ...floatingStyles, opacity: isPositioned ? 1 : 0, pointerEvents: isPositioned ? 'auto' : 'none' }} {...getFloatingProps()} className="artifact-tooltip">
            <div className="artifact-tooltip-header">
              <div className="artifact-tooltip-icon" style={{ borderColor: accent }}>
                {img ? <img src={img} alt={artifact.name} /> : <span>?</span>}
              </div>
              <div className="artifact-tooltip-title">
                <div className="artifact-tooltip-name" style={{ color: accent }}>{artifact.name}</div>
                <div className="artifact-tooltip-stars" style={{ color: accent }}>{'★'.repeat(artifact.rarity_max)}</div>
              </div>
            </div>

            {artifact.two_piece_bonus && (
              <div className="artifact-tooltip-bonus bonus-2pc">
                <span className="artifact-tooltip-badge">2 peças</span>
                <p>{artifact.two_piece_bonus}</p>
              </div>
            )}
            {artifact.four_piece_bonus && (
              <div className="artifact-tooltip-bonus bonus-4pc">
                <span className="artifact-tooltip-badge">4 peças</span>
                <p>{artifact.four_piece_bonus}</p>
              </div>
            )}

            <FloatingArrow ref={arrowRef} context={context} width={14} height={7} tipRadius={2} className="artifact-tooltip-arrow" />
          </div>
        </FloatingPortal>
      )}
    </>
  )
}
