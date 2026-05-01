// ============================================================
// PartyKit transport implementation.
// To swap transports, write a new file implementing GameTransport
// and change the import in src/hooks/useGame.ts — nothing else changes.
// ============================================================

import PartySocket from 'partysocket'
import type { GameTransport, TransportOptions } from './GameTransport'
import type { GameAction, GameEvent } from './types'

export function createTransport(options: TransportOptions): GameTransport {
  let socket: PartySocket | null = null
  const eventHandlers = new Set<(event: GameEvent) => void>()
  const connectHandlers = new Set<() => void>()
  const disconnectHandlers = new Set<() => void>()

  return {
    connect(roomId, playerId) {
      socket = new PartySocket({
        host: options.host,
        room: roomId,
        id: playerId,
      })

      socket.addEventListener('message', (e) => {
        const event = JSON.parse(e.data as string) as GameEvent
        eventHandlers.forEach(h => h(event))
      })

      socket.addEventListener('open', () => {
        connectHandlers.forEach(h => h())
      })

      socket.addEventListener('close', () => {
        disconnectHandlers.forEach(h => h())
      })
    },

    disconnect() {
      socket?.close()
      socket = null
    },

    send(action: GameAction) {
      socket?.send(JSON.stringify(action))
    },

    onEvent(handler) {
      eventHandlers.add(handler)
      return () => eventHandlers.delete(handler)
    },

    onConnect(handler) {
      connectHandlers.add(handler)
      return () => connectHandlers.delete(handler)
    },

    onDisconnect(handler) {
      disconnectHandlers.add(handler)
      return () => disconnectHandlers.delete(handler)
    },
  }
}
