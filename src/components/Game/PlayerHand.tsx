import { motion } from 'framer-motion'
import { Frame } from '@react95/core'
import { Button } from 'react95'
import type { Card as CardType } from '@shared/engine/card'
import { Card } from '../Card/Card'
import { CardStack } from '../Card/CardStack'
import { Hand } from '../Hand/Hand'
import { ChipStack } from '../Chips/ChipStack'
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
  disabled?: boolean
  deckSize: number
  discardingCards: DiscardingSlot[]
  isDealer?: boolean
  chipCount?: number | null
  playerName?: string
  // Optional element rendered between hand/deck info (left) and sort buttons (right)
  // in the top toolbar — used to inline the ActionBar so buttons sit on one row.
  actionSlot?: React.ReactNode
}

export function PlayerHand({
  cards, ids, selectedIndices, onToggle, onReorder, onSortByRank, onSortBySuit, disabled = false, deckSize, discardingCards, isDealer, chipCount, playerName, actionSlot,
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
        {isDealer && (
          <span style={dealerBadgeStyle} title="You are the dealer this round">D</span>
        )}
        {actionSlot != null && (
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
            {actionSlot}
          </div>
        )}
      </div>

      <div style={cardRowStyle}>
        {chipCount != null && (
          <div style={{ alignSelf: 'flex-end', paddingBottom: 4 }}>
            <ChipStack count={chipCount} playerName={playerName} />
          </div>
        )}
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
        <div style={sortButtonsStyle}>
          <Button onClick={onSortByRank} style={sortButtonStyle}>Sort by rank</Button>
          <Button onClick={onSortBySuit} style={sortButtonStyle}>Sort by suit</Button>
        </div>
      </div>
    </Frame>
  )
}

function DeckStack({ count, discardingCards }: { count: number; discardingCards: DiscardingSlot[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0, alignSelf: 'flex-end', paddingBottom: 4 }}>
      <span style={{ fontSize: 11, color: palette.ltGray, fontWeight: 500 }}>{count} in deck</span>
      <CardStack count={count} showEmpty>
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
      </CardStack>
    </div>
  )
}

const toolbarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-end',
  gap: 6,
  justifyContent: 'space-between',
  marginBottom: 6,
}

const cardRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'safe center',
  overflow: 'visible',
  gap: 12,
  marginTop: 32,
}

const sortButtonsStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  alignSelf: 'flex-end',
  paddingBottom: 4,
}

const sortButtonStyle: React.CSSProperties = {
  marginLeft: 24,
  whiteSpace: 'nowrap',
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
