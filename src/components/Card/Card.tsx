import type { Card as CardType, Rank, Suit } from '@shared/engine/card'

interface CardProps {
  card: CardType
  selected?: boolean
  faceDown?: boolean
  onClick?: () => void
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

// Static back for now: palm tree at row 6, col 4 (zero-indexed: row 5, col 3)
const BACK_ROW = 5
const BACK_COL = 3

const SPRITE_URL = '/cards.png'

function spritePosition(row: number, col: number): React.CSSProperties {
  return {
    backgroundImage: `url(${SPRITE_URL})`,
    backgroundSize: `${COLS * CARD_W}px ${ROWS * CARD_H}px`,
    backgroundPosition: `-${col * CARD_W}px -${row * CARD_H}px`,
    backgroundRepeat: 'no-repeat',
    imageRendering: 'pixelated',
  }
}

function faceSpritePosition(rank: Rank, suit: Suit): React.CSSProperties {
  return spritePosition(SUIT_ROW[suit], RANK_COL[String(rank)])
}

export function Card({ card, selected = false, faceDown = false, onClick }: CardProps) {
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

  const sprite = faceDown
    ? spritePosition(BACK_ROW, BACK_COL)
    : faceSpritePosition(card.rank, card.suit)

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      aria-label={faceDown ? 'face-down card' : `${card.rank} of ${card.suit}`}
      style={{ ...base, ...sprite }}
    />
  )
}
