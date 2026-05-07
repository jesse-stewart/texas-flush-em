import type { Card } from '@shared/engine/card'
import type { GameOptions, BotDifficulty } from '@shared/engine/game-state'
import type { PresenceClientMessage, PresenceServerEvent } from './presence'

// Re-exported from the shared engine so the client and server use identical types
export type { ClientGameState, PlayerView } from '@shared/engine/state-machine'
// Re-export so callers don't need to know about the two transport modules
export type { PlayerPresence, PresenceClientMessage, PresenceServerEvent } from './presence'

// Game actions: client → server messages that drive the state machine.
// PRESENCE is intentionally NOT in this union — it's an ephemeral relay channel
// that bypasses applyCommand. Use `ClientMessage` for "anything sendable."
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

// Anything a client can put on the wire. `send` accepts this; the server splits
// presence (relay-only) from game actions (validated, then applyCommand).
export type ClientMessage = GameAction | PresenceClientMessage

// Events sent from server → client
export type GameEvent =
  | { type: 'GAME_STATE'; state: import('@shared/engine/state-machine').ClientGameState }
  | { type: 'DEBUG_FULL_STATE'; state: import('@shared/engine/game-state').GameState }
  | { type: 'ERROR'; message: string }
  | PresenceServerEvent
