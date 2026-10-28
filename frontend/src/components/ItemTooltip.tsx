import {
  cloneElement,
  isValidElement,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react'
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

const RARITY_COLORS: Record<number, string> = {
  1: '#8b8b8b',
  2: '#5fa860',
  3: '#5a8fd8',
  4: '#a35bd8',
  5: '#e0a647',
}

export interface ItemTooltipData {
  name: string
  icon: string | null
  rarity: number | null
  category: string
  description: string | null
  source: string | null
}

function formatCategory(cat: string): string {
  return cat.replace(/_/g, ' ')
}

function normalizeText(s: string | null | undefined): string | null {
  if (!s) return null
  // Dois cenários: string com \n real, ou com "\\n" literal (escape duplo)
  return s.replace(/\\n/g, '\n').trim()
}

export default function ItemTooltip({
  data,
  children,
}: {
  data: ItemTooltipData
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
      offset(14),
      flip({ padding: 8, fallbackAxisSideDirection: 'start' }),
      shift({ padding: 8 }),
      floatingArrow({ element: arrowRef }),
    ],
  })

  const hover = useHover(context, {
    delay: { open: 180, close: 60 },
    handleClose: safePolygon(),
  })
  const focus = useFocus(context)
  const dismiss = useDismiss(context)
  const role = useRole(context, { role: 'tooltip' })

  const { getReferenceProps, getFloatingProps } = useInteractions([
    hover,
    focus,
    dismiss,
    role,
  ])

  const rarity = data.rarity ?? 1
  const accent = RARITY_COLORS[rarity] ?? RARITY_COLORS[1]
  const description = normalizeText(data.description)
  const source = normalizeText(data.source)

  // Aplica ref + props de interação no filho REAL (não num span display:contents).
  // Sem isso, o Floating UI calcula posição a partir de (0,0).
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
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            {...getFloatingProps()}
            className="item-tooltip"
          >
            <div className="item-tooltip-header">
              <div className="item-tooltip-icon" style={{ borderColor: accent }}>
                {data.icon ? <img src={data.icon} alt={data.name} /> : <span>?</span>}
              </div>
              <div className="item-tooltip-title">
                <div className="item-tooltip-name" style={{ color: accent }}>
                  {data.name}
                </div>
                <div className="item-tooltip-stars" style={{ color: accent }}>
                  {'★'.repeat(rarity)}
                </div>
                <div className="item-tooltip-category">{formatCategory(data.category)}</div>
              </div>
            </div>

            {description && <p className="item-tooltip-description">{description}</p>}

            {source && (
              <div className="item-tooltip-source">
                <span className="item-tooltip-source-label">Fonte</span>
                <span>{source}</span>
              </div>
            )}

            <FloatingArrow
              ref={arrowRef}
              context={context}
              width={14}
              height={7}
              tipRadius={2}
              className="item-tooltip-arrow"
            />
          </div>
        </FloatingPortal>
      )}
    </>
  )
}
