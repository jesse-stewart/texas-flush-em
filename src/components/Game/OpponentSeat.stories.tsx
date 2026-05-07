import type { Meta, StoryObj } from '@storybook/react'
import { OpponentSeat } from './OpponentArea'
import { mockPlayer } from '../../storybook/fixtures'
import { palette } from '../../palette'

const meta: Meta<typeof OpponentSeat> = {
  title: 'Game/OpponentSeat',
  component: OpponentSeat,
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'felt', values: [{ name: 'felt', value: palette.felt }] },
  },
  decorators: [
    Story => <div style={{ padding: 48 }}>{Story()}</div>,
  ],
}
export default meta
type Story = StoryObj<typeof meta>

const baseArgs = {
  player: mockPlayer({ id: 'p2', name: 'Bob', handSize: 10, deckSize: 8 }),
  isActive: false,
  isDealer: false,
  presence: null,
  events: [],
  myPlayerId: 'p1',
  allPlayers: [mockPlayer({ id: 'p1', name: 'Alice' }), mockPlayer({ id: 'p2', name: 'Bob' })],
}

// One seat per orientation — this is the rotatable atom GameScreen places in
// the four sides of the table grid (top/bottom/left/right).

export const Across: Story = {
  args: { ...baseArgs, orientation: 'across' },
  parameters: {
    docs: { description: { story: 'Top-of-table seat — cards face away, deck stacks top-down. Used for the player directly opposite the spectator.' } },
  },
}

export const Horizontal: Story = {
  args: { ...baseArgs, orientation: 'horizontal' },
  parameters: {
    docs: { description: { story: 'Bottom-of-table seat used in 4-player layouts. Hand is rotated 180° so cards top-align with the deck/chips, mirroring the across seat.' } },
  },
}

export const Left: Story = {
  args: { ...baseArgs, orientation: 'left' },
  parameters: {
    docs: { description: { story: 'Left-side seat — face-down cards rotated 90° and stacked vertically.' } },
  },
}

export const Right: Story = {
  args: { ...baseArgs, orientation: 'right' },
  parameters: {
    docs: { description: { story: 'Right-side seat — mirror of the left seat.' } },
  },
}

// ─── States ──────────────────────────────────────────────────────────────────

export const ActiveDealer: Story = {
  args: {
    ...baseArgs,
    orientation: 'across',
    isActive: true,
    isDealer: true,
  },
  parameters: {
    docs: { description: { story: 'Active turn (titlebar-style nameplate + hourglass) and dealer this round (yellow "D" badge).' } },
  },
}

export const Bot: Story = {
  args: {
    ...baseArgs,
    player: mockPlayer({ id: 'p2', name: 'CarolBot', handSize: 10, deckSize: 8, isBot: true, botDifficulty: 'hard' }),
    orientation: 'across',
  },
  parameters: {
    docs: { description: { story: 'Bot opponent — colored difficulty badge ("Hard" = red).' } },
  },
}

export const Folded: Story = {
  args: {
    ...baseArgs,
    player: mockPlayer({ id: 'p2', name: 'Bob', handSize: 4, deckSize: 0, folded: true }),
    orientation: 'across',
  },
}

export const Disconnected: Story = {
  args: {
    ...baseArgs,
    player: mockPlayer({ id: 'p2', name: 'Bob', handSize: 10, deckSize: 8, isConnected: false }),
    orientation: 'across',
  },
  parameters: {
    docs: { description: { story: 'Connection light goes gray when the player drops.' } },
  },
}

export const LeftBetterPickedCards: Story = {
  args: {
    ...baseArgs,
    player: mockPlayer({ id: 'p2', name: 'Bob', handSize: 8, deckSize: 6 }),
    orientation: 'left',
    presence: { handOrder: [0, 1, 2, 3, 4, 5, 6, 7], selectedPositions: [2, 5] },
  },
  parameters: {
    docs: { description: { story: 'Vertical seat with two cards lifted (positions 2 and 5) — selected cards slide toward the table center.' } },
  },
}

export const ChipsModeBetting: Story = {
  args: {
    ...baseArgs,
    player: mockPlayer({ id: 'p2', name: 'Bob', handSize: 10, deckSize: 8 }),
    orientation: 'across',
    isActive: true,
    chipCount: 32,
    pendingBet: 6,
  },
  parameters: {
    docs: { description: { story: 'Chips mode mid-bet — main chip stack on the right, staged $6 bet floats to the side without widening the seat.' } },
  },
}
