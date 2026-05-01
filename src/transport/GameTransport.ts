import type { GameAction, GameEvent } from './types'

export interface GameTransport {
  connect(roomId: string, playerId: string): void
  disconnect(): void
  send(action: GameAction): void
  onEvent(handler: (event: GameEvent) => void): () => void      // returns unsubscribe fn
  onConnect(handler: () => void): () => void
  onDisconnect(handler: () => void): () => void
}

export interface TransportOptions {
  host: string
}

export type TransportFactory = (options: TransportOptions) => GameTransport
