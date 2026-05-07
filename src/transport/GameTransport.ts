import type { ClientMessage, GameEvent } from './types'

export interface ConnectOptions {
  password?: string
}

// Server-rejected connection: surfaced via a 4xxx WebSocket close code with
// an application-defined reason (e.g. wrong password).
export interface ConnectionError {
  code: number
  reason: string
}

export interface GameTransport {
  connect(roomId: string, playerId: string, options?: ConnectOptions): void
  disconnect(): void
  send(message: ClientMessage): void
  onEvent(handler: (event: GameEvent) => void): () => void      // returns unsubscribe fn
  onConnect(handler: () => void): () => void
  onDisconnect(handler: () => void): () => void
  onError(handler: (err: ConnectionError) => void): () => void
}

export interface TransportOptions {
  host: string
}

export type TransportFactory = (options: TransportOptions) => GameTransport
