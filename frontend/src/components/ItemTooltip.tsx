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
import { Check, Swords } from 'lucide-react'
import { categoryInfo } from '../utils/categories'
import { formatResin, type ResinRange } from '../utils/resin'

const RARITY_COLORS: Record<number, string> = {
  1: '#8b8b8b',
  2: '#5fa860',
  3: '#5a8fd8',
  4: '#a35bd8',
  5: '#e0a647',
}

export interface ItemTooltipData {
  name: string
  icon?: string | null
  rarity?: number | null
  category: string
  description?: string | null
  source?: string | null
  resinRange?: ResinRange
  killsNeeded?: {
    monsterName: string;
    kills: number;
    dropRate?: number;
  } | null;
  customFooter?: ReactNode
}

function formatCategory(cat: string): string {
  return cat.replace(/_/g, ' ')
}

function normalizeText(s: string | null | undefined): string | null {
  if (!s) return null
  return s.replace(/\\n/g, '\n').trim()
}

function ResinBlock({ range }: { range: ResinRange }) {
  if (range.kind === 'complete') {
    return (
      <div className="item-tooltip-resin">
        <div className="item-tooltip-resin-complete">
          <Check size={14} />
          <span>Já possui {range.quantity.toLocaleString('pt-BR')} na mochila</span>
        </div>
      </div>
    )
  }

  if (range.kind === 'mora') {
    return (
      <div className="item-tooltip-resin">
        <div className="item-tooltip-resin-free">
          <span>Farmável em qualquer atividade</span>
          <span>Sem custo de resina</span>
        </div>
      </div>
    )
  }

  if (range.kind === 'free') {
    return (
      <div className="item-tooltip-resin">
        <div className="item-tooltip-resin-free">
          <span>Farmável grátis</span>
          <span>Sem custo de resina</span>
        </div>
      </div>
    )
  }

  const qtyLabel = range.have > 0 ? 'que falta' : 'no total'
  return (
    <div className="item-tooltip-resin">
      <div className="item-tooltip-resin-header">
        <span>{range.tier.emoji}</span>
        <span>{range.tier.label}</span>
        <span>{range.tier.resinPerRun} resina/run</span>
      </div>
      <div className="item-tooltip-resin-runs">
        <div>
          <span>Com sorte</span>
          <strong>{range.minRuns} {range.minRuns === 1 ? 'run' : 'runs'}</strong>
          <small>{formatResin(range.minResin)} resina</small>
        </div>
        <div className="is-avg">
          <span>Média</span>
          <strong>{range.avgRuns} {range.avgRuns === 1 ? 'run' : 'runs'}</strong>
          <small>{formatResin(range.avgResin)} resina</small>
        </div>
        <div>
          <span>Sem sorte</span>
          <strong>{range.maxRuns} {range.maxRuns === 1 ? 'run' : 'runs'}</strong>
          <small>{formatResin(range.maxResin)} resina</small>
        </div>
      </div>
      <div className="item-tooltip-resin-meta">
        Calculado para {qtyLabel} ({range.have > 0 ? range.quantity - range.have : range.quantity} un.)
      </div>
      {range.tier.key === 'weekly' && (
        <div className="item-tooltip-resin-warn">
          ⚠ Limitado a 1x por semana por boss
        </div>
      )}
    </div>
  )
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

  const { refs, floatingStyles, context, isPositioned } = useFloating({
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
    hover, focus, dismiss, role,
  ])

  const rarity = data.rarity ?? 1
  const accent = RARITY_COLORS[rarity] ?? RARITY_COLORS[1]
  const description = normalizeText(data.description)
  const source = normalizeText(data.source)

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
            style={{
              ...floatingStyles,
              opacity: isPositioned ? 1 : 0,
              pointerEvents: isPositioned ? 'auto' : 'none',
              zIndex: 20000,
            }}
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
                <div className="item-tooltip-category" style={{ color: categoryInfo(data.category).color }}>{categoryInfo(data.category).label}</div>
              </div>
            </div>

            {description && <p className="item-tooltip-description">{description}</p>}

            {data.resinRange && <ResinBlock range={data.resinRange} />}

            {data.killsNeeded && data.killsNeeded.kills > 0 && (
              <div className="item-tooltip-kills">
                <div className="item-tooltip-kills-header">
                  <Swords size={14} />
                  <span>Farm de monstros</span>
                </div>
                <div className="item-tooltip-kills-body">
                  Mate <strong>~{data.killsNeeded.kills}</strong> {data.killsNeeded.monsterName}
                  {data.killsNeeded.dropRate !== undefined && (
                    <div className="item-tooltip-kills-rate">
                      Chance de drop: {data.killsNeeded.dropRate.toFixed(1)}%
                    </div>
                  )}
                </div>
              </div>
            )}

            {source && (
              <div className="item-tooltip-source">
                <span className="item-tooltip-source-label">Fonte</span>
                <span>{source}</span>
              </div>
            )}

            {data.customFooter && (
              <div className="item-tooltip-custom-footer">
                {data.customFooter}
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
