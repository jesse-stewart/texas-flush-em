import type { Card } from './card'
import type { EvaluatedHand } from './hand-eval'

export interface HandPlay {
  hand: EvaluatedHand
  playerId: string
}

export interface PlayerState {
  id: string
  name: string
  deck: Card[]       // personal deck (face-down draw pile)
  hand: Card[]       // held cards, max 10
  folded: boolean    // folded during the current hand
  connected: boolean
  eliminated: boolean // reached 52+ cumulative points or left the game
  isBot: boolean     // server-controlled CPU player; no real WebSocket connection
}

export interface GameState {
  phase: 'lobby' | 'playing' | 'round_end' | 'game_end' | 'abandoned'
  abandonedByName: string | null
  players: PlayerState[]
  playerOrder: string[]             // active (non-eliminated) player ids in clockwise turn order
  currentPlayerIndex: number        // index into playerOrder
  leadPlayerIndex: number           // who led this hand
  turnPhase: 'discard' | 'play'    // where we are within the current player's turn
  currentTopPlay: EvaluatedHand | null
  currentTopPlayerId: string | null // who made the currentTopPlay
  currentHandPlays: HandPlay[]      // all plays made in the current hand, oldest first
  middlePile: Card[]                // all cards set aside from completed hands
  roundWinnerId: string | null
  gameWinnerId: string | null       // set when phase === 'game_end'
  scores: Record<string, number>    // cumulative card-count scores; lower is better
  roundScoreDelta: Record<string, number> // points added in the most recent round
  deckCount: number                 // 1–4 standard decks combined
}

export function getCurrentPlayer(state: GameState): PlayerState | undefined {
  const id = state.playerOrder[state.currentPlayerIndex]
  return state.players.find(p => p.id === id)
}

export function getActivePlayers(state: GameState): PlayerState[] {
  return state.players.filter(p => !p.folded && !p.eliminated && p.connected)
}

export function getPlayerById(state: GameState, id: string): PlayerState | undefined {
  return state.players.find(p => p.id === id)
}

// How many cards a player has total (hand + deck)
export function totalCards(player: PlayerState): number {
  return player.hand.length + player.deck.length
}

// Whether a player has emptied all their cards (wins the round)
export function hasEmptiedCards(player: PlayerState): boolean {
  return player.hand.length === 0 && player.deck.length === 0
}
