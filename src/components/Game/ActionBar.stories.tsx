import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { ActionBar } from './ActionBar'
import { c, mockState, mockHandPlay } from '../../storybook/fixtures'
import { palette } from '../../palette'
import type { ClientGameState } from '@shared/engine/state-machine'
import type { Card } from '@shared/engine/card'

const meta: Meta<typeof ActionBar> = {
  title: 'Game/ActionBar',
  component: ActionBar,
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'felt', values: [{ name: 'felt', value: palette.felt }] },
  },
  decorators: [
    Story => <div style={{ padding: 32, minWidth: 600 }}>{Story()}</div>,
  ],
}
export default meta
type Story = StoryObj<typeof meta>

const actions = {
  onDiscard: () => console.log('discard'),
  onPlay: () => console.log('play'),
  onFold: () => console.log('fold'),
  onCheck: () => console.log('check'),
  onCall: () => console.log('call'),
  onBet: (n: number) => console.log('bet', n),
  onRaise: (n: number) => console.log('raise', n),
}

// Betting phase has a controlled `bettingTarget` — wrap in a stateful harness
// so the +/− stepper and input field actually move.
function BettingHarness({ state, myPlayerId = 'p1', selected = [] }: {
  state: ClientGameState
  myPlayerId?: string
  selected?: Card[]
}) {
  const [target, setTarget] = useState<number | null>(null)
  return (
    <ActionBar
      state={state}
      myPlayerId={myPlayerId}
      selected={selected}
      bettingTarget={target}
      onBettingTargetChange={setTarget}
      {...actions}
    />
  )
}

export const DiscardPhaseNoSelection: Story = {
  args: {
    state: mockState({ turnPhase: 'discard', currentPlayerId: 'p1' }),
    myPlayerId: 'p1',
    selected: [],
    ...actions,
  },
}

export const DiscardPhaseWithCards: Story = {
  args: {
    state: mockState({ turnPhase: 'discard', currentPlayerId: 'p1' }),
    myPlayerId: 'p1',
    selected: [c(3, 'clubs'), c(8, 'diamonds')],
    ...actions,
  },
}

export const PlayPhaseValidLeading: Story = {
  args: {
    state: mockState({ turnPhase: 'play', currentPlayerId: 'p1', currentTopPlay: null }),
    myPlayerId: 'p1',
    selected: [c('K', 'hearts'), c('K', 'clubs')],
    ...actions,
  },
  parameters: {
    docs: { description: { story: 'Pair of kings — valid lead, Play is enabled.' } },
  },
}

export const PlayPhaseDoesNotBeat: Story = {
  args: {
    state: (() => {
      const top = mockHandPlay([c('A', 'hearts'), c('A', 'clubs')], 'p2')
      return mockState({
        turnPhase: 'play',
        currentPlayerId: 'p1',
        currentTopPlay: top.hand,
        currentTopPlayerId: 'p2',
      })
    })(),
    myPlayerId: 'p1',
    selected: [c(7, 'hearts'), c(7, 'clubs')],
    ...actions,
  },
  parameters: {
    docs: { description: { story: 'Pair of 7s under pair of aces — Play is disabled, hint explains why.' } },
  },
}

export const PlayPhaseInvalidHand: Story = {
  args: {
    state: mockState({ turnPhase: 'play', currentPlayerId: 'p1' }),
    myPlayerId: 'p1',
    selected: [c(7, 'hearts'), c(8, 'clubs'), c(10, 'spades')],
    ...actions,
  },
  parameters: {
    docs: { description: { story: 'Three random cards aren\'t a legal poker hand.' } },
  },
}

export const WaitingForOpponent: Story = {
  args: {
    state: mockState({ turnPhase: 'play', currentPlayerId: 'p2' }),
    myPlayerId: 'p1',
    selected: [],
    ...actions,
  },
}

// ─── Betting phase ───────────────────────────────────────────────────────────

export const BettingCheckOrOpen: Story = {
  render: () => (
    <BettingHarness
      state={mockState({
        turnPhase: 'bet',
        currentPlayerId: 'p1',
        scores: { p1: 50, p2: 50 },
        committed: { p1: 5, p2: 5 },          // ante already in
        betToMatch: 5,                         // matches my committed → I owe 0 → check
        minRaise: 5,
      })}
    />
  ),
  parameters: {
    docs: { description: { story: 'No outstanding bet — Check, or open the betting with the +/− stepper.' } },
  },
}

export const BettingCallOrRaise: Story = {
  render: () => (
    <BettingHarness
      state={mockState({
        turnPhase: 'bet',
        currentPlayerId: 'p1',
        scores: { p1: 50, p2: 30 },
        committed: { p1: 5, p2: 15 },          // I owe $10
        betToMatch: 15,
        minRaise: 5,
      })}
    />
  ),
  parameters: {
    docs: { description: { story: 'Owe $10 to call. Stepper opens to a raise (must cover the $10 call + min-raise step).' } },
  },
}

export const BettingAllInToCall: Story = {
  render: () => (
    <BettingHarness
      state={mockState({
        turnPhase: 'bet',
        currentPlayerId: 'p1',
        scores: { p1: 6, p2: 80 },             // only $6 in stack
        committed: { p1: 5, p2: 25 },          // owe $20, but only have $6
        betToMatch: 25,
        minRaise: 5,
      })}
    />
  ),
  parameters: {
    docs: { description: { story: 'Stack is short — Call collapses to the all-in amount, no raise option.' } },
  },
}

export const BettingNotMyTurn: Story = {
  render: () => (
    <BettingHarness
      state={mockState({
        turnPhase: 'bet',
        currentPlayerId: 'p2',
        scores: { p1: 50, p2: 50 },
        committed: { p1: 5, p2: 5 },
        betToMatch: 5,
        minRaise: 5,
      })}
    />
  ),
  parameters: {
    docs: { description: { story: 'Waiting for the other player to act — all controls disabled.' } },
  },
}

export const BettingNoAnte: Story = {
  render: () => (
    <BettingHarness
      state={mockState({
        turnPhase: 'bet',
        currentPlayerId: 'p1',
        scores: { p1: 50, p2: 50 },
        committed: {},
        betToMatch: 0,
        minRaise: 1,
        options: { ...mockState().options, anteAmount: 0 },
      })}
    />
  ),
  parameters: {
    docs: { description: { story: 'No ante in play — open with any amount, +/− steps by 1.' } },
  },
}
