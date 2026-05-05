import { useEffect, useState } from 'react'
import type { Card as CardType, Rank, Suit } from '@shared/engine/card'
import { backFrameAt, getCardBack, subscribeAnimationTick } from '../../cardBacks'
import { useCardBackId } from '../../contexts/CardBackContext'

interface CardProps {
  card: CardType
  selected?: boolean
  faceDown?: boolean
  onClick?: () => void
  // Optional override for the back. If omitted, uses the user's selected back
  // from CardBackContext. Useful for the picker preview.
  backIdOverride?: string
}

const CARD_W = 80
const CARD_H = 112
const COLS = 13
const ROWS = 6

const SUIT_ROW: Record<Suit, number> = {
  spades: 0,
  hearts: 1,
  clubs: 2,
  diamonds: 3,
}

const RANK_COL: Record<string, number> = {
  A: 0, '2': 1, '3': 2, '4': 3, '5': 4, '6': 5, '7': 6,
  '8': 7, '9': 8, '10': 9, J: 10, Q: 11, K: 12,
}

const SPRITE_URL = '/cards.png'

function spritePosition(row: number, col: number, w: number, h: number): React.CSSProperties {
  return {
    backgroundImage: `url(${SPRITE_URL})`,
    backgroundSize: `${COLS * w}px ${ROWS * h}px`,
    backgroundPosition: `-${col * w}px -${row * h}px`,
    backgroundRepeat: 'no-repeat',
    imageRendering: 'pixelated',
  }
}

function faceSpritePosition(rank: Rank, suit: Suit, w: number, h: number): React.CSSProperties {
  return spritePosition(SUIT_ROW[suit], RANK_COL[String(rank)], w, h)
}

// Shared by Card and CardBackPicker so previews pick up animation too.
export function CardBackVisual({
  backId,
  width = CARD_W,
  height = CARD_H,
}: { backId: string; width?: number; height?: number }) {
  const back = getCardBack(backId)
  const animated = !!back.animation
  const [, force] = useState(0)
  useEffect(() => {
    if (!animated) return
    return subscribeAnimationTick(() => force(n => n + 1))
  }, [animated])

  const cell = animated ? backFrameAt(back, Date.now()) : back.rest
  return (
    <div
      style={{
        width,
        height,
        flexShrink: 0,
        ...spritePosition(cell.row, cell.col, width, height),
      }}
      aria-label={`card back: ${back.label}`}
    />
  )
}

export function Card({ card, selected = false, faceDown = false, onClick, backIdOverride }: CardProps) {
  const userBackId = useCardBackId()
  const backId = backIdOverride ?? userBackId

  const base: React.CSSProperties = {
    width: CARD_W,
    height: CARD_H,
    cursor: onClick ? 'pointer' : 'default',
    userSelect: 'none',
    transition: 'transform 0.1s ease, box-shadow 0.1s ease',
    flexShrink: 0,
    overflow: 'hidden',
    transform: selected ? 'translateY(-10px)' : 'none',
    boxShadow: selected
      ? '0 0 0 3px #2563eb, 0 6px 16px rgba(0,0,0,0.25)'
      : '0 2px 6px rgba(0,0,0,0.18)',
  }

  if (faceDown) {
    return (
      <div
        onClick={onClick}
        role={onClick ? 'button' : undefined}
        aria-label="face-down card"
        style={base}
      >
        <CardBackVisual backId={backId} width={CARD_W} height={CARD_H} />
      </div>
    )
  }

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      aria-label={`${card.rank} of ${card.suit}`}
      style={{ ...base, ...faceSpritePosition(card.rank, card.suit, CARD_W, CARD_H) }}
    />
  )
}
