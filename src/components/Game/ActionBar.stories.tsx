import type { Meta, StoryObj } from '@storybook/react'
import { ActionBar } from './ActionBar'
import { c, mockState, mockHandPlay } from '../../storybook/fixtures'

const meta: Meta<typeof ActionBar> = {
  title: 'Game/ActionBar',
  component: ActionBar,
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'felt', values: [{ name: 'felt', value: '#0f4c2a' }] },
  },
}
export default meta
type Story = StoryObj<typeof meta>

const actions = {
  onDiscard: () => console.log('discard'),
  onPlay: () => console.log('play'),
  onFold: () => console.log('fold'),
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
