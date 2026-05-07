import type { CSSProperties, ReactNode } from 'react'
import type { Card as CardType } from '@shared/engine/card'
import { Card, CARD_W, CARD_H } from './Card'
import { palette } from '../../palette'

export type CardStackRotation = 0 | 90 | -90 | 180
export type CardStackDirection = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW'

interface CardStackProps {
  count: number
  // Render the layers face-up using the supplied cards. Index 0 is the bottom
  // of the stack, index `count-1` is the top. Cards beyond `count` are ignored;
  // entries that are `undefined` (or missing) render face-down — useful for
  // showing only the top of a discard pile face-up.
  cards?: (CardType | undefined)[]
  // Rotates each card. Vertical seats use 90/-90 (with translation pivot to
  // keep the card in positive coords); the across seat uses 180.
  rotation?: CardStackRotation
  // Compass corner the top card sits in. Lower layers fan toward the opposite
  // corner. Default 'N': top card at top, deeper layers peek straight down.
  direction?: CardStackDirection
  // Pixel offset between adjacent layers along the direction vector. For
  // diagonal directions this applies on both axes.
  offset?: number
  // Render a dashed empty placeholder when count===0. The container reserves
  // the same dimensions either way so toggling doesn't shift surrounding rows.
  showEmpty?: boolean
  emptyLabel?: string
  // Overlay slot — absolutely positioned children rendered on top of the
  // stack. Used by PlayerHand to layer in framer-motion discarding cards.
  children?: ReactNode
}

// Vector points the way lower layers fan — i.e. the *opposite* of the named
// direction (which is where the top card sits).
const DIRECTION_VECTOR: Record<CardStackDirection, { x: -1 | 0 | 1; y: -1 | 0 | 1 }> = {
  N:  { x:  0, y:  1 },
  NE: { x: -1, y:  1 },
  E:  { x: -1, y:  0 },
  SE: { x: -1, y: -1 },
  S:  { x:  0, y: -1 },
  SW: { x:  1, y: -1 },
  W:  { x:  1, y:  0 },
  NW: { x:  1, y:  1 },
}

export function CardStack({
  count,
  cards,
  rotation = 0,
  direction = 'N',
  offset = 2,
  showEmpty = false,
  emptyLabel = 'empty',
  children,
}: CardStackProps) {
  const isVertical = rotation === 90 || rotation === -90
  const visible = Math.max(0, count)
  const lastFan = Math.max(visible - 1, 0)

  const baseW = isVertical ? CARD_H : CARD_W
  const baseH = isVertical ? CARD_W : CARD_H
  const vec = DIRECTION_VECTOR[direction]
  const containerW = baseW + Math.abs(vec.x) * lastFan * offset
  const containerH = baseH + Math.abs(vec.y) * lastFan * offset
  // Anchor = the top card's pre-rotation top-left within the container.
  // When the fan extends in the negative direction on an axis we shift the
  // anchor over by the full fan distance so layer 0 still lands at >= 0.
  const anchorX = vec.x < 0 ? lastFan * offset : 0
  const anchorY = vec.y < 0 ? lastFan * offset : 0

  if (count <= 0 && !showEmpty) {
    return <div style={{ width: containerW, height: containerH }} />
  }

  return (
    <div style={{ position: 'relative', width: containerW, height: containerH }}>
      {count <= 0 ? (
        <div
          style={{
            width: baseW,
            height: baseH,
            border: `2px dashed ${palette.midGray}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span style={{ fontSize: 11, color: palette.ltGray, fontStyle: 'italic' }}>
            {emptyLabel}
          </span>
        </div>
      ) : (
        Array.from({ length: visible }).map((_, i) => {
          const depth = visible - 1 - i
          const faceUp = cards?.[i]
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: anchorX + depth * vec.x * offset,
                top:  anchorY + depth * vec.y * offset,
                zIndex: i,
                ...rotationStyle(rotation),
              }}
            >
              {faceUp
                ? <Card card={faceUp} />
                : <Card card={{ rank: 2, suit: 'clubs' }} faceDown />}
            </div>
          )
        })
      )}
      {children}
    </div>
  )
}

function rotationStyle(rotation: CardStackRotation): CSSProperties {
  if (rotation === 0) return {}
  if (rotation === 180) return { transform: 'rotate(180deg)' }
  if (rotation === 90) {
    return { transformOrigin: 'top left', transform: `translateX(${CARD_H}px) rotate(90deg)` }
  }
  return { transformOrigin: 'top left', transform: `translateY(${CARD_W}px) rotate(-90deg)` }
}
