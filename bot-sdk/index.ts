// ============================================================
// Texas Flush'em — Bot SDK
//
// Tiny TypeScript wrapper around the public WebSocket API. Handles the
// JOIN handshake, auto-reconnect (via partysocket), and exposes typed
// helpers for every action the server accepts.
//
// Usage:
//   import { createBot } from './bot-sdk'
//   const bot = createBot({ host: 'localhost:1999', roomId: 'A3BC9F', playerName: 'MyBot' })
//   bot.onState(state => { ... })
//   bot.connect()
//
// The wire protocol is documented in the in-app "Bot API" modal (Help menu).
// ============================================================

import PartySocket from 'partysocket'
import type { Card } from '../shared/engine/card'
import type { ClientGameState } from '../shared/engine/state-machine'
import type { GameAction, GameEvent } from '../src/transport/types'

// Re-export the engine types so bot authors don't need to know the internal layout.
export type { Card } from '../shared/engine/card'
export type { Rank, Suit } from '../shared/engine/card'
export type { ClientGameState, PlayerView } from '../shared/engine/state-machine'
export type { HandCategory, EvaluatedHand } from '../shared/engine/hand-eval'
export type { GameOptions } from '../shared/engine/game-state'

export interface BotConfig {
  // PartyKit host — 'localhost:1999' for dev, '<project>.<user>.partykit.dev' for prod.
  host: string
  roomId: string
  playerName: string
  // Stable id for this bot run. Generated if omitted; same value used as the player id.
  botId?: string
  // Optional room password. On a fresh room this *sets* the password; otherwise it must match.
  password?: string
}

export interface ConnectionError {
  code: number
  reason: string
}

export interface Bot {
  readonly playerId: string
  readonly state: ClientGameState | null
  readonly isConnected: boolean
  connect(): void
  disconnect(): void

  // Actions — invalid actions (wrong turn phase, illegal hand, etc.) are silently dropped
  // by the server. Watch onState to confirm your action took effect.
  discard(cards: Card[]): void
  play(cards: Card[]): void
  fold(): void
  leave(): void
  readyForNextRound(): void

  // Subscriptions — each returns an unsubscribe function.
  onState(handler: (state: ClientGameState) => void): () => void
  onError(handler: (err: ConnectionError) => void): () => void
  onConnect(handler: () => void): () => void
  onDisconnect(handler: () => void): () => void
}

export function createBot(config: BotConfig): Bot {
  const playerId = config.botId ?? `bot-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`

  let socket: PartySocket | null = null
  let state: ClientGameState | null = null
  let isConnected = false

  const stateHandlers = new Set<(s: ClientGameState) => void>()
  const errorHandlers = new Set<(e: ConnectionError) => void>()
  const connectHandlers = new Set<() => void>()
  const disconnectHandlers = new Set<() => void>()

  function send(action: GameAction) {
    socket?.send(JSON.stringify(action))
  }

  return {
    get playerId() { return playerId },
    get state() { return state },
    get isConnected() { return isConnected },

    connect() {
      if (socket) return
      socket = new PartySocket({
        host: config.host,
        room: config.roomId,
        id: playerId,
        query: config.password ? { p: config.password } : undefined,
      })

      socket.addEventListener('open', () => {
        isConnected = true
        // Identify as an API client so other players see the badge.
        send({ type: 'JOIN', playerName: config.playerName, client: 'api' })
        connectHandlers.forEach(h => h())
      })

      socket.addEventListener('message', (e) => {
        const event = JSON.parse(e.data as string) as GameEvent
        if (event.type === 'GAME_STATE') {
          state = event.state
          stateHandlers.forEach(h => h(event.state))
        }
      })

      socket.addEventListener('close', (e) => {
        isConnected = false
        // 4xxx = server-rejected (bad password, rate-limited). Stop reconnecting and surface.
        if (e.code >= 4000 && e.code < 5000) {
          errorHandlers.forEach(h => h({ code: e.code, reason: e.reason }))
          socket?.close()
          socket = null
        }
        disconnectHandlers.forEach(h => h())
      })
    },

    disconnect() {
      socket?.close()
      socket = null
      isConnected = false
    },

    discard(cards) { send({ type: 'DISCARD', cards }) },
    play(cards) { send({ type: 'PLAY', cards }) },
    fold() { send({ type: 'FOLD' }) },
    leave() { send({ type: 'LEAVE' }) },
    readyForNextRound() { send({ type: 'READY_FOR_NEXT_ROUND' }) },

    onState(handler) { stateHandlers.add(handler); return () => stateHandlers.delete(handler) },
    onError(handler) { errorHandlers.add(handler); return () => errorHandlers.delete(handler) },
    onConnect(handler) { connectHandlers.add(handler); return () => connectHandlers.delete(handler) },
    onDisconnect(handler) { disconnectHandlers.add(handler); return () => disconnectHandlers.delete(handler) },
  }
}

// Convenience: returns true when it's this bot's turn in the given phase.
export function isMyTurn(state: ClientGameState, playerId: string, phase?: 'discard' | 'play'): boolean {
  if (state.currentPlayerId !== playerId) return false
  if (phase && state.turnPhase !== phase) return false
  return true
}
