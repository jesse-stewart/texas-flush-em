import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { LayoutGroup } from 'framer-motion'
import { PlayerHand } from './PlayerHand'
import { ActionBar } from './ActionBar'
import { c, mockState } from '../../storybook/fixtures'
import { palette } from '../../palette'
import type { Card } from '@shared/engine/card'

const meta: Meta<typeof PlayerHand> = {
  title: 'Game/PlayerHand',
  component: PlayerHand,
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'felt', values: [{ name: 'felt', value: palette.felt }] },
  },
}
export default meta
type Story = StoryObj<typeof meta>

interface HarnessProps {
  cards: Card[]
  deckSize?: number
  disabled?: boolean
  discardingIndices?: number[]   // simulate mid-discard animation
  isDealer?: boolean
  chipCount?: number | null
  playerName?: string
  withActionSlot?: boolean
}

function Harness({
  cards, deckSize = 8, disabled = false, discardingIndices = [],
  isDealer, chipCount, playerName, withActionSlot,
}: HarnessProps) {
  const [selected, setSelected] = useState<number[]>([])
  const ids = cards.map((_, i) => `slot-${i}`)
  const discardingCards = discardingIndices.map(i => ({ id: i, card: cards[i] }))
  const selectedCards = selected.map(i => cards[i])
  const actionSlot = withActionSlot ? (
    <ActionBar
      state={mockState({ turnPhase: 'play', currentPlayerId: 'p1', myDeckSize: deckSize })}
      myPlayerId="p1"
      selected={selectedCards}
      onDiscard={() => console.log('discard')}
      onPlay={() => console.log('play')}
      onFold={() => console.log('fold')}
    />
  ) : undefined
  return (
    <LayoutGroup>
      <div style={{ height: 360, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
        <PlayerHand
          cards={cards}
          ids={ids}
          selectedIndices={selected}
          onToggle={i =>
            setSelected(prev =>
              prev.includes(i) ? prev.filter(x => x !== i) : prev.length < 5 ? [...prev, i] : prev
            )
          }
          onReorder={() => { /* stories don't persist reorder */ }}
          onSortByRank={() => console.log('sort by rank')}
          onSortBySuit={() => console.log('sort by suit')}
          disabled={disabled}
          deckSize={deckSize}
          discardingCards={discardingCards}
          isDealer={isDealer}
          chipCount={chipCount}
          playerName={playerName}
          actionSlot={actionSlot}
        />
      </div>
    </LayoutGroup>
  )
}

export const Default: Story = {
  render: () => (
    <Harness
      cards={[
        c(2, 'clubs'), c(5, 'diamonds'), c(7, 'hearts'), c(9, 'spades'),
        c(10, 'clubs'), c('J', 'diamonds'), c('Q', 'hearts'), c('K', 'spades'),
        c('A', 'spades'), c(3, 'clubs'),
      ]}
    />
  ),
}

export const DuplicateCards: Story = {
  render: () => (
    <Harness
      cards={[
        c('J', 'hearts'), c('J', 'hearts'),
        c(7, 'spades'), c(7, 'spades'),
        c('K', 'clubs'), c('A', 'spades'), c(3, 'diamonds'),
      ]}
    />
  ),
  parameters: {
    docs: { description: { story: 'Mixed-deck hand with duplicates. Each card stays selectable independently.' } },
  },
}

export const EmptyDeck: Story = {
  render: () => (
    <Harness
      cards={[c(5, 'hearts'), c(8, 'diamonds'), c(10, 'spades')]}
      deckSize={0}
    />
  ),
}

export const Disabled: Story = {
  render: () => (
    <Harness
      cards={[c(5, 'hearts'), c(8, 'diamonds'), c(10, 'spades'), c('J', 'clubs')]}
      disabled
    />
  ),
  parameters: {
    docs: { description: { story: 'Not your turn — cards locked.' } },
  },
}

export const AsDealer: Story = {
  render: () => (
    <Harness
      cards={[
        c(4, 'clubs'), c(6, 'diamonds'), c(8, 'hearts'), c(10, 'spades'),
        c('J', 'clubs'), c('Q', 'diamonds'), c('K', 'hearts'), c('A', 'spades'),
      ]}
      isDealer
    />
  ),
  parameters: {
    docs: { description: { story: 'Dealer this round — yellow "D" badge appears in the toolbar.' } },
  },
}

export const ChipsMode: Story = {
  render: () => (
    <Harness
      cards={[
        c(2, 'clubs'), c(5, 'diamonds'), c(7, 'hearts'), c(9, 'spades'),
        c('J', 'clubs'), c('Q', 'diamonds'), c('K', 'hearts'),
      ]}
      chipCount={42}
      playerName="Alice"
    />
  ),
  parameters: {
    docs: { description: { story: 'Chips mode — own chip stack rendered to the left of the deck.' } },
  },
}

export const WithInlinedActionBar: Story = {
  render: () => (
    <Harness
      cards={[
        c(7, 'hearts'), c(7, 'clubs'), c(9, 'spades'), c(10, 'diamonds'),
        c('Q', 'hearts'), c('K', 'spades'), c('A', 'clubs'),
      ]}
      withActionSlot
      isDealer
      chipCount={28}
      playerName="Alice"
    />
  ),
  parameters: {
    docs: { description: { story: 'Full bottom-of-table look: dealer badge + chips + ActionBar inlined into the toolbar via `actionSlot`. Select a pair to see the play hint.' } },
  },
}
