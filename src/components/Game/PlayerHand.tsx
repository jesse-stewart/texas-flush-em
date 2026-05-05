import { motion } from 'framer-motion'
import { Frame } from '@react95/core'
import { Button } from 'react95'
import type { Card as CardType } from '@shared/engine/card'
import { Card } from '../Card/Card'
import { Hand } from '../Hand/Hand'
import { palette } from '../../palette'

interface DiscardingSlot { id: number; card: CardType }

interface PlayerHandProps {
  cards: CardType[]
  ids: string[]
  selectedIndices: number[]
  onToggle: (index: number) => void
  onReorder: (newOrder: CardType[]) => void
  onSortByRank: () => void
  onSortBySuit: () => void
  disabled: boolean
  deckSize: number
  discardingCards: DiscardingSlot[]
  isDealer?: boolean
}

export function PlayerHand({
  cards, ids, selectedIndices, onToggle, onReorder, onSortByRank, onSortBySuit, disabled, deckSize, discardingCards, isDealer,
}: PlayerHandProps) {
  return (
    <Frame
      px="$6"
      pt="$4"
      pb="$5"
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        backgroundColor: 'transparent',
      }}
    >
      <div style={toolbarStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <span style={{ fontWeight: 700, color: palette.white }}>hand</span>
          <Frame bgColor="$inputBackground" boxShadow="$in" px="$2" py="$1" style={{ minWidth: 24, textAlign: 'center', fontFamily: 'monospace', color: palette.black }}>
            {cards.length}
          </Frame>
          <span style={{ fontWeight: 700, color: palette.white }}>deck</span>
          <Frame bgColor="$inputBackground" boxShadow="$in" px="$2" py="$1" style={{ minWidth: 24, textAlign: 'center', fontFamily: 'monospace', color: palette.black }}>
            {deckSize}
          </Frame>
          {isDealer && (
            <span style={dealerBadgeStyle} title="You are the dealer this round">D</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <Button onClick={onSortByRank}>Sort by rank</Button>
          <Button onClick={onSortBySuit}>Sort by suit</Button>
        </div>
      </div>

      <div style={cardRowStyle}>
        <DeckStack count={deckSize} discardingCards={discardingCards} />
        <div style={pileDividerStyle} />
        <Hand
          overlap={24}
          cards={cards}
          ids={ids}
          selectedIndices={selectedIndices}
          onToggle={onToggle}
          onReorder={onReorder}
          disabled={disabled}
        />
      </div>
    </Frame>
  )
}

function DeckStack({ count, discardingCards }: { count: number; discardingCards: DiscardingSlot[] }) {
  const layers = Math.min(count, 6)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0, alignSelf: 'flex-end', paddingBottom: 4 }}>
      <div style={{ position: 'relative', width: 80 + layers * 3, height: 112 + layers * 3 }}>
        {count === 0 ? (
          <div style={{
            width: 80, height: 112,
            border: `2px dashed ${palette.midGray}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 11, color: palette.ltGray }}>empty</span>
          </div>
        ) : (
          Array.from({ length: layers }).map((_, i) => (
            <div key={i} style={{
              position: 'absolute',
              left: i * 3,
              top: (layers - 1 - i) * 3,
              zIndex: i,
            }}>
              <Card card={{ rank: 2, suit: 'clubs' }} faceDown />
            </div>
          ))
        )}

        {discardingCards.map((slot, i) => (
          <motion.div
            key={slot.id}
            layoutId={`slot-${slot.id}`}
            style={{ position: 'absolute', top: 0, left: 0, zIndex: 200 + i }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <Card card={slot.card} />
          </motion.div>
        ))}
      </div>
    </div>
  )
}

const toolbarStyle: React.CSSProperties = {
  position: 'absolute',
  top: 6,
  left: 12,
  right: 12,
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  justifyContent: 'space-between',
  zIndex: 5,
}

const cardRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'safe center',
  overflow: 'visible',
  gap: 12,
  marginTop: 32,
}

const pileDividerStyle: React.CSSProperties = {
  width: 1,
  height: 100,
  backgroundColor: 'rgba(255,255,255,0.2)',
  alignSelf: 'flex-end',
  marginBottom: 4,
}

const dealerBadgeStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 18,
  height: 18,
  borderRadius: '50%',
  fontSize: 10,
  fontWeight: 700,
  color: palette.black,
  backgroundColor: palette.dealerYellow,
  border: `1px solid ${palette.black}`,
  marginLeft: 4,
}
