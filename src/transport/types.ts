import type { Card } from '@shared/engine/card'
import type { GameOptions, BotDifficulty } from '@shared/engine/game-state'

// Re-exported from the shared engine so the client and server use identical types
export type { ClientGameState, PlayerView } from '@shared/engine/state-machine'

// Ephemeral UI state broadcast to opponents (never touches game state machine)
export interface PlayerPresence {
  handOrder: number[]         // stable slot IDs in current display order
  selectedPositions: number[] // which display positions (indices into handOrder) are raised
}

// Actions sent from client → server
export type GameAction =
  // `client` lets external bots identify themselves as API players (UI badge + log).
  // Browser clients omit it; server defaults to 'browser'.
  | { type: 'JOIN'; playerName: string; client?: 'browser' | 'api' }
  | { type: 'ADD_BOT'; difficulty?: BotDifficulty }
  | { type: 'REMOVE_BOT'; playerId: string }
  | { type: 'SET_BOT_DIFFICULTY'; playerId: string; difficulty: BotDifficulty }
  | { type: 'START_GAME'; options?: Partial<GameOptions> }
  | { type: 'READY_FOR_NEXT_ROUND' }
  | { type: 'CHECK' }
  | { type: 'BET'; amount: number }
  | { type: 'CALL' }
  | { type: 'RAISE'; amount: number }
  | { type: 'DISCARD'; cards: Card[] }
  | { type: 'PLAY'; cards: Card[] }
  | { type: 'FOLD' }
  | { type: 'LEAVE' }
  | { type: 'DEBUG_SET_HAND'; count: number }
  | { type: 'DEBUG_ADJUST_CHIPS'; delta: number }
  | { type: 'DEBUG_FULL_STATE' }
  | { type: 'PRESENCE'; handOrder: number[]; selectedPositions: number[] }

// Events sent from server → client
export type GameEvent =
  | { type: 'GAME_STATE'; state: import('@shared/engine/state-machine').ClientGameState }
  | { type: 'DEBUG_FULL_STATE'; state: import('@shared/engine/game-state').GameState }
  | { type: 'ERROR'; message: string }
  | { type: 'PRESENCE'; playerId: string; handOrder: number[]; selectedPositions: number[] }
