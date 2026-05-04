import type { Card } from './card'
import type { EvaluatedHand, HandCategory } from './hand-eval'

export interface HandPlay {
  hand: EvaluatedHand
  playerId: string
}

// ============================================================
// Game event log — chronological record of everything that happened.
// Drives per-player "speech bubble" notifications during play and the
// reviewable game log shown at game end.
// ============================================================

export type GameEvent =
  | { ts: number; type: 'game_started' }
  | { ts: number; type: 'round_started' }
  | { ts: number; type: 'discarded'; playerId: string; count: number }
  | { ts: number; type: 'played'; playerId: string; category: HandCategory; cards: Card[] }
  | { ts: number; type: 'folded'; playerId: string }
  | { ts: number; type: 'hand_won'; playerId: string }
  | { ts: number; type: 'round_won'; playerId: string; emptied: boolean }
  | { ts: number; type: 'eliminated'; playerId: string }
  | { ts: number; type: 'game_won'; playerId: string }
  | { ts: number; type: 'joined'; playerId: string; playerName: string; isBot: boolean }
  | { ts: number; type: 'left'; playerId: string }

// ============================================================
// Game options — chosen in the lobby, frozen when the game starts
// ============================================================

export type ScoringMode = 'points' | 'chips'
export type PointsThresholdAction = 'eliminate' | 'end_game'

// classic   — single 52-card deck dealt round-robin (remainder to first players)
// personal  — each player has their own private deck of `cardsPerPlayer` cards
// mixed     — `mixedDeckCount` 52-card decks shuffled together; each player dealt `cardsPerPlayer`
export type DealMode = 'classic' | 'personal' | 'mixed'

// Per-bot strength setting. Mapped to ISMCTS knobs in bot-ismcts.ts.
export type BotDifficulty = 'easy' | 'medium' | 'hard'
export const DEFAULT_BOT_DIFFICULTY: BotDifficulty = 'medium'

export interface GameOptions {
  scoringMode: ScoringMode
  // Points: target — first player to hit it triggers thresholdAction. Chips: starting chips per player.
  threshold: number
  // Points-only: when a player reaches the threshold, eliminate them or end the whole game.
  pointsThresholdAction: PointsThresholdAction
  dealMode: DealMode
  // Personal/Mixed: cards each player starts with. Classic ignores this (uses all 52 / playerCount).
  cardsPerPlayer: number
  // Mixed only: how many 52-card decks shuffled together (1–4).
  mixedDeckCount: number
}

// Initial draw size — every player must start with at least this many cards or the game can't open.
export const MIN_CARDS_PER_PLAYER = 10
export const PERSONAL_MAX_CARDS = 52
export const MIXED_DEFAULT_CARDS = 26

export const DEFAULT_OPTIONS: GameOptions = {
  scoringMode: 'points',
  threshold: 26,
  pointsThresholdAction: 'eliminate',
  dealMode: 'classic',
  cardsPerPlayer: PERSONAL_MAX_CARDS,
  mixedDeckCount: 2,
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
  botDifficulty?: BotDifficulty  // bots only; undefined for humans
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
  // Points mode: cumulative penalty points (lower = better). Chips mode: current chip balance (higher = better).
  scores: Record<string, number>
  // Points mode: positive = points added this round. Chips mode: signed — winner positive, losers negative.
  roundScoreDelta: Record<string, number>
  // Total decks worth of cards in play (used by the bot for hidden-card reasoning):
  //   classic = 1, mixed = mixedDeckCount, personal = playerCount (one private deck per player)
  deckCount: number
  options: GameOptions              // frozen at START_GAME
  // Append-only event log for the entire game. Used for per-player notification bubbles
  // and the end-of-game review. Lives in memory only (no persistence yet).
  events: GameEvent[]
  // Round-end consensus: which players have clicked "Start next round". Cleared on each
  // round transition. Only humans gate the round; bots are auto-ready.
  nextRoundReady: Record<string, boolean>
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
