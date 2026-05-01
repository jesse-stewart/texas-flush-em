import type { Card as CardType } from '@shared/engine/card'

interface CardProps {
  card: CardType
  selected?: boolean
  faceDown?: boolean
  onClick?: () => void
}

const SUIT_LETTER: Record<string, string> = {
  clubs: 'c',
  diamonds: 'd',
  hearts: 'h',
  spades: 's',
}

function cardImageUrl(card: CardType): string {
  const suitLetter = SUIT_LETTER[card.suit]
  const rank = card.rank
  let rankStr: string
  if (rank === 'A') rankStr = '1'
  else if (rank === 'J') rankStr = 'j'
  else if (rank === 'Q') rankStr = 'q'
  else if (rank === 'K') rankStr = 'k'
  else rankStr = String(rank)
  return `/${card.suit}/${rankStr}${suitLetter}.svg`
}

export function Card({ card, selected = false, faceDown = false, onClick }: CardProps) {
  const base: React.CSSProperties = {
    width: 80,
    height: 112,
    borderRadius: 8,
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
        style={{
          ...base,
          backgroundColor: '#1e40af',
          backgroundImage: 'repeating-linear-gradient(45deg, #1d3a9e 0px, #1d3a9e 2px, #1e40af 2px, #1e40af 8px)',
        }}
      />
    )
  }

  return (
    <div onClick={onClick} style={base}>
      <img
        src={cardImageUrl(card)}
        alt={`${card.rank} of ${card.suit}`}
        style={{ width: '100%', height: '100%', display: 'block' }}
        draggable={false}
      />
    </div>
  )
}
