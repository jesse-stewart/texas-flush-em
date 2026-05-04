import type { Meta, StoryObj } from '@storybook/react'
import { WaitingRoom } from './WaitingRoom'
import { mockState, mockPlayer } from '../../storybook/fixtures'

const meta: Meta<typeof WaitingRoom> = {
  title: 'Lobby/WaitingRoom',
  component: WaitingRoom,
  parameters: { layout: 'fullscreen' },
}
export default meta
type Story = StoryObj<typeof meta>

const baseProps = {
  roomId: 'A3BC9F',
  myPlayerId: 'p1',
  onStart: () => console.log('start'),
  onLeave: () => console.log('leave'),
  onAddBot: (difficulty: string) => console.log('add bot', difficulty),
  onRemoveBot: (id: string) => console.log('remove bot', id),
  onSetBotDifficulty: (id: string, difficulty: string) => console.log('set bot difficulty', id, difficulty),
}

const lobby = (count: number, withBots = 0) =>
  mockState({
    phase: 'lobby',
    players: [
      ...Array.from({ length: count - withBots }, (_, i) =>
        mockPlayer({ id: `p${i + 1}`, name: ['Alice', 'Bob', 'Carol', 'Dave'][i], handSize: 0, deckSize: 0 })
      ),
      ...Array.from({ length: withBots }, (_, i) =>
        mockPlayer({
          id: `bot${i + 1}`,
          name: ['CPU Alice', 'CPU Bob', 'CPU Carol'][i],
          isBot: true,
          handSize: 0,
          deckSize: 0,
        })
      ),
    ],
    scores: {},
  })

export const TwoPlayers: Story = {
  args: { ...baseProps, state: lobby(2) },
  parameters: {
    docs: { description: { story: 'Default state — two humans, classic mode, points scoring.' } },
  },
}

export const FourPlayers: Story = {
  args: { ...baseProps, state: lobby(4) },
}

export const SoloVsThreeBots: Story = {
  args: { ...baseProps, state: lobby(4, 3) },
  parameters: {
    docs: {
      description: {
        story:
          'Estimator differentiates humans from bots: this game should clock in dramatically lower than 4 humans.',
      },
    },
  },
}

export const NotEnoughPlayers: Story = {
  args: { ...baseProps, state: lobby(1) },
  parameters: {
    docs: { description: { story: 'Start button is disabled until ≥2 players are seated.' } },
  },
}

export const FullRoomWithDisconnect: Story = {
  args: {
    ...baseProps,
    state: mockState({
      phase: 'lobby',
      players: [
        mockPlayer({ id: 'p1', name: 'Alice', handSize: 0, deckSize: 0 }),
        mockPlayer({ id: 'p2', name: 'Bob', handSize: 0, deckSize: 0, isConnected: false }),
        mockPlayer({ id: 'bot1', name: 'CPU Carol', isBot: true, handSize: 0, deckSize: 0 }),
        mockPlayer({ id: 'bot2', name: 'CPU Dave', isBot: true, handSize: 0, deckSize: 0 }),
      ],
      scores: {},
    }),
  },
}
