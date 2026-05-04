import type { Meta, StoryObj } from '@storybook/react'
import { LayoutGroup } from 'framer-motion'
import { TableCenter } from './TableCenter'
import { c, mockState, mockHandPlay } from '../../storybook/fixtures'

const meta: Meta<typeof TableCenter> = {
  title: 'Game/TableCenter',
  component: TableCenter,
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'felt', values: [{ name: 'felt', value: '#0f4c2a' }] },
  },
  decorators: [
    Story => (
      <div style={{ minHeight: 400, padding: 24 }}>
        <LayoutGroup>{Story()}</LayoutGroup>
      </div>
    ),
  ],
}
export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {
  args: {
    state: mockState({ currentHandPlays: [], currentTopPlay: null, currentTopPlayerId: null }),
    myPlayerId: 'p1',
    myLastPlaySlotIds: null,
  },
}

export const SinglePlay: Story = {
  args: {
    state: (() => {
      const play = mockHandPlay([c(7, 'hearts'), c(7, 'clubs')], 'p2')
      return mockState({
        currentHandPlays: [play],
        currentTopPlay: play.hand,
        currentTopPlayerId: 'p2',
        currentPlayerId: 'p1',
        turnPhase: 'discard',
      })
    })(),
    myPlayerId: 'p1',
    myLastPlaySlotIds: null,
  },
}

export const StackedHistory: Story = {
  args: {
    state: (() => {
      const a = mockHandPlay([c(4, 'hearts'), c(4, 'spades')], 'p1')
      const b = mockHandPlay([c(9, 'clubs'), c(9, 'diamonds')], 'p2')
      const top = mockHandPlay([c('Q', 'hearts'), c('Q', 'spades')], 'p1')
      return mockState({
        currentHandPlays: [a, b, top],
        currentTopPlay: top.hand,
        currentTopPlayerId: 'p1',
        currentPlayerId: 'p2',
        turnPhase: 'discard',
      })
    })(),
    myPlayerId: 'p1',
    myLastPlaySlotIds: null,
  },
  parameters: {
    docs: {
      description: { story: 'Multiple plays in one hand, stacked. Each later play strictly beats the prior.' },
    },
  },
}

// Regression coverage: when a multi-deck hand contains identical cards, both must render
// (with distinct layoutIds via myLastPlaySlotIds, when it's the player's own latest play).
export const DuplicateCardsInPlay: Story = {
  args: {
    state: (() => {
      const flushPair = mockHandPlay([c('J', 'hearts'), c('J', 'hearts')], 'p1')
      return mockState({
        currentHandPlays: [flushPair],
        currentTopPlay: flushPair.hand,
        currentTopPlayerId: 'p1',
        currentPlayerId: 'p2',
        turnPhase: 'discard',
        options: { ...mockState().options, dealMode: 'mixed', mixedDeckCount: 2 },
      })
    })(),
    myPlayerId: 'p1',
    // Pretend these were the slot ids when the cards left the player's hand
    myLastPlaySlotIds: [12, 17],
  },
  parameters: {
    docs: {
      description: {
        story:
          'Flush pair (J♥ + J♥) from a multi-deck game. Both cards must render — earlier the duplicate layoutId would collapse them into one.',
      },
    },
  },
}

export const WithMiddlePile: Story = {
  args: {
    state: mockState({
      currentHandPlays: [],
      currentTopPlay: null,
      currentTopPlayerId: null,
      middlePileCount: 12,
    }),
    myPlayerId: 'p1',
    myLastPlaySlotIds: null,
  },
  parameters: {
    docs: { description: { story: 'After several hands have completed, cards collect in the side pile.' } },
  },
}
