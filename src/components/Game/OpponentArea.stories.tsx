import type { Meta, StoryObj } from '@storybook/react'
import { OpponentArea } from './OpponentArea'
import { mockPlayer } from '../../storybook/fixtures'

const meta: Meta<typeof OpponentArea> = {
  title: 'Game/OpponentArea',
  component: OpponentArea,
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'felt', values: [{ name: 'felt', value: '#0f4c2a' }] },
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
    presence: new Map(),
    events: [],
  },
}

export const ThreeOpponents: Story = {
  args: {
    opponents: [
      mockPlayer({ id: 'p2', name: 'Bob', handSize: 10, deckSize: 8 }),
      mockPlayer({ id: 'p3', name: 'Carol', handSize: 7, deckSize: 12, isBot: true }),
      mockPlayer({ id: 'p4', name: 'Dave', handSize: 4, deckSize: 0, folded: true }),
    ],
    allPlayers: [
      mockPlayer({ id: 'p1', name: 'Alice' }),
      mockPlayer({ id: 'p2', name: 'Bob' }),
      mockPlayer({ id: 'p3', name: 'Carol' }),
      mockPlayer({ id: 'p4', name: 'Dave' }),
    ],
    myPlayerId: 'p1',
    currentPlayerId: 'p3',
    presence: new Map(),
    events: [],
  },
}

export const WithPresence: Story = {
  args: {
    opponents: [mockPlayer({ id: 'p2', name: 'Bob', handSize: 8, deckSize: 6 })],
    allPlayers: [mockPlayer({ id: 'p1', name: 'Alice' }), mockPlayer({ id: 'p2', name: 'Bob' })],
    myPlayerId: 'p1',
    currentPlayerId: 'p2',
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
    presence: new Map(),
    events: [],
  },
}
