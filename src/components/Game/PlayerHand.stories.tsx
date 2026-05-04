import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { LayoutGroup } from 'framer-motion'
import { PlayerHand } from './PlayerHand'
import { c } from '../../storybook/fixtures'
import type { Card } from '@shared/engine/card'

const meta: Meta<typeof PlayerHand> = {
  title: 'Game/PlayerHand',
  component: PlayerHand,
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'felt', values: [{ name: 'felt', value: '#0f4c2a' }] },
  },
}
export default meta
type Story = StoryObj<typeof meta>

interface HarnessProps {
  cards: Card[]
  deckSize?: number
  disabled?: boolean
  discardingIndices?: number[]   // simulate mid-discard animation
}

function Harness({ cards, deckSize = 8, disabled = false, discardingIndices = [] }: HarnessProps) {
  const [selected, setSelected] = useState<number[]>([])
  const ids = cards.map((_, i) => `slot-${i}`)
  const discardingCards = discardingIndices.map(i => ({ id: i, card: cards[i] }))
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
