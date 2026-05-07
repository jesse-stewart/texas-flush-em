import type { Meta, StoryObj } from '@storybook/react'
import { OpponentArea } from './OpponentArea'
import { mockPlayer } from '../../storybook/fixtures'
import { palette } from '../../palette'

// `OpponentArea` is the across-only row container the game places at the top
// of the table — every seat inside is locked to `orientation="across"`. The
// rotatable atom is `OpponentSeat` (see Game/OpponentSeat stories) which
// `GameScreen` calls directly with left/right/across/horizontal.
const meta: Meta<typeof OpponentArea> = {
  title: 'Game/OpponentArea',
  component: OpponentArea,
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'felt', values: [{ name: 'felt', value: palette.felt }] },
  },
}
export default meta
type Story = StoryObj<typeof meta>

export const SingleOpponent: Story = {
  args: {
    opponents: [mockPlayer({ id: 'p2', name: 'Bob', handSize: 9, deckSize: 6 })],
    allPlayers: [mockPlayer({ id: 'p1', name: 'Alice' }), mockPlayer({ id: 'p2', name: 'Bob' })],
    myPlayerId: 'p1',
    currentPlayerId: 'p2',
    dealerId: 'p1',
    presence: new Map(),
    events: [],
  },
}

export const TwoOpponents: Story = {
  args: {
    opponents: [
      mockPlayer({ id: 'p2', name: 'Bob', handSize: 10, deckSize: 8 }),
      mockPlayer({ id: 'p3', name: 'Carol', handSize: 7, deckSize: 12, isBot: true, botDifficulty: 'medium' }),
    ],
    allPlayers: [
      mockPlayer({ id: 'p1', name: 'Alice' }),
      mockPlayer({ id: 'p2', name: 'Bob' }),
      mockPlayer({ id: 'p3', name: 'Carol' }),
    ],
    myPlayerId: 'p1',
    currentPlayerId: 'p3',
    dealerId: 'p2',
    presence: new Map(),
    events: [],
  },
  parameters: {
    docs: { description: { story: 'Two opponents (3-player game) — both seats sit across the top in a horizontal row. With 3+ opponents the game switches to the grid layout (see Game/Table Layout) and `OpponentArea` is no longer used.' } },
  },
}

export const WithPresence: Story = {
  args: {
    opponents: [mockPlayer({ id: 'p2', name: 'Bob', handSize: 8, deckSize: 6 })],
    allPlayers: [mockPlayer({ id: 'p1', name: 'Alice' }), mockPlayer({ id: 'p2', name: 'Bob' })],
    myPlayerId: 'p1',
    currentPlayerId: 'p2',
    dealerId: 'p1',
    presence: new Map([
      ['p2', { handOrder: [0, 1, 2, 3, 4, 5, 6, 7], selectedPositions: [2, 5] }],
    ]),
    events: [],
  },
  parameters: {
    docs: {
      description: {
        story: 'Opponent has lifted positions 2 and 5 — face-down cards reflect what they\'ve picked up.',
      },
    },
  },
}

export const DisconnectedOpponent: Story = {
  args: {
    opponents: [
      mockPlayer({ id: 'p2', name: 'Bob', handSize: 10, deckSize: 8, isConnected: false }),
    ],
    allPlayers: [mockPlayer({ id: 'p1', name: 'Alice' }), mockPlayer({ id: 'p2', name: 'Bob' })],
    myPlayerId: 'p1',
    currentPlayerId: 'p1',
    dealerId: 'p1',
    presence: new Map(),
    events: [],
  },
}

export const DealerBadge: Story = {
  args: {
    opponents: [
      mockPlayer({ id: 'p2', name: 'Bob', handSize: 10, deckSize: 8 }),
      mockPlayer({ id: 'p3', name: 'Carol', handSize: 10, deckSize: 8 }),
    ],
    allPlayers: [
      mockPlayer({ id: 'p1', name: 'Alice' }),
      mockPlayer({ id: 'p2', name: 'Bob' }),
      mockPlayer({ id: 'p3', name: 'Carol' }),
    ],
    myPlayerId: 'p1',
    currentPlayerId: 'p2',
    dealerId: 'p3',
    presence: new Map(),
    events: [],
  },
  parameters: {
    docs: { description: { story: 'Dealer rotation — Carol is the dealer this round (yellow "D" badge), Bob is currently acting (active nameplate + hourglass).' } },
  },
}

export const ChipsMode: Story = {
  args: {
    opponents: [
      mockPlayer({ id: 'p2', name: 'Bob', handSize: 10, deckSize: 8 }),
      mockPlayer({ id: 'p3', name: 'Carol', handSize: 10, deckSize: 8, isBot: true, botDifficulty: 'hard' }),
    ],
    allPlayers: [
      mockPlayer({ id: 'p1', name: 'Alice' }),
      mockPlayer({ id: 'p2', name: 'Bob' }),
      mockPlayer({ id: 'p3', name: 'Carol' }),
    ],
    myPlayerId: 'p1',
    currentPlayerId: 'p2',
    dealerId: 'p2',
    presence: new Map(),
    events: [],
    chipCounts: { p2: 32, p3: 11 },
    stagedBets: { p2: 6 },
  },
  parameters: {
    docs: { description: { story: 'Chips mode — opponents show chip stacks; Bob is mid-bet with $6 staged off to the side.' } },
  },
}
