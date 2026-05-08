// Shared mocks for Storybook stories. Builds minimum-viable shapes for
// ClientGameState / PlayerView / EvaluatedHand so each story file doesn't
// have to reinvent them.

import type { Card } from '@shared/engine/card'
import type { ClientGameState, PlayerView } from '@shared/engine/state-machine'
import type { GameOptions, HandPlay } from '@shared/engine/game-state'
import { DEFAULT_OPTIONS } from '@shared/engine/game-state'
import { evaluateHand } from '@shared/engine/hand-eval'

export const c = (rank: Card['rank'], suit: Card['suit']): Card => ({ rank, suit })

export function mockPlayer(overrides: Partial<PlayerView> = {}): PlayerView {
  return {
    id: 'p1',
    name: 'Alice',
    handSize: 10,
    deckSize: 8,
    folded: false,
    isConnected: true,
    eliminated: false,
    isBot: false,
    isApi: false,
    ...overrides,
  }
}

export function mockOptions(overrides: Partial<GameOptions> = {}): GameOptions {
  return { ...DEFAULT_OPTIONS, ...overrides }
}

// Build a HandPlay from raw cards by running them through the real evaluator.
// Throws if the cards aren't a legal hand — catches mistakes in story authoring.
export function mockHandPlay(cards: Card[], playerId = 'p1'): HandPlay {
  const evaluated = evaluateHand(cards)
  if (!evaluated) throw new Error(`mockHandPlay: invalid hand ${JSON.stringify(cards)}`)
  return { hand: evaluated, playerId }
}

export function mockState(overrides: Partial<ClientGameState> = {}): ClientGameState {
  return {
    phase: 'playing',
    abandonedByName: null,
    players: [mockPlayer({ id: 'p1', name: 'Alice' }), mockPlayer({ id: 'p2', name: 'Bob' })],
    myHand: [],
    myDeckSize: 8,
    turnPhase: 'play',
    currentTopPlay: null,
    currentTopPlayerId: null,
    currentHandPlays: [],
    currentPlayerId: 'p1',
    leadPlayerId: 'p1',
    dealerId: 'p2',
    roundWinnerId: null,
    gameWinnerId: null,
    scores: { p1: 0, p2: 0 },
    roundScoreDelta: {},
    roundStartScores: {},
    middlePileCount: 0,
    options: mockOptions(),
    pot: 0,
    committed: {},
    betToMatch: 0,
    minRaise: 0,
    bettingActedSinceRaise: [],
    events: [],
    nextRoundReady: {},
    ...overrides,
  }
}
