import type { Meta, StoryObj } from '@storybook/react'
import { LayoutGroup } from 'framer-motion'
import { TableCenter } from './TableCenter'
import { c, mockState, mockHandPlay } from '../../storybook/fixtures'
import { palette } from '../../palette'

const meta: Meta<typeof TableCenter> = {
  title: 'Game/TableCenter',
  component: TableCenter,
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'felt', values: [{ name: 'felt', value: palette.felt }] },
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

export const BettingPhaseWithPot: Story = {
  args: {
    state: mockState({
      turnPhase: 'bet',
      currentPlayerId: 'p1',
      currentHandPlays: [],
      currentTopPlay: null,
      currentTopPlayerId: null,
      pot: 30,
      betToMatch: 10,
      committed: { p1: 5, p2: 10 },
      scores: { p1: 45, p2: 40 },
    }),
    myPlayerId: 'p1',
    myLastPlaySlotIds: null,
  },
  parameters: {
    docs: { description: { story: 'Betting phase, $30 in the pot, $10 to call. Pot chips render to the left of the play area; turn-status row shows the call amount.' } },
  },
}

export const OpponentTurnWithPot: Story = {
  args: {
    state: (() => {
      const top = mockHandPlay([c('K', 'hearts'), c('K', 'clubs')], 'p1')
      return mockState({
        turnPhase: 'play',
        currentPlayerId: 'p2',
        currentHandPlays: [top],
        currentTopPlay: top.hand,
        currentTopPlayerId: 'p1',
        pot: 50,
      })
    })(),
    myPlayerId: 'p1',
    myLastPlaySlotIds: null,
  },
  parameters: {
    docs: { description: { story: 'Opponent (Bob) is acting against my pair of Kings. Pot of $50 still showing on the side.' } },
  },
}
