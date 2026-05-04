// ============================================================
// PartyKit transport implementation.
// To swap transports, write a new file implementing GameTransport
// and change the import in src/hooks/useGame.ts — nothing else changes.
// ============================================================

import PartySocket from 'partysocket'
import type { ConnectionError, GameTransport, TransportOptions } from './GameTransport'
import type { GameAction, GameEvent } from './types'

export function createTransport(options: TransportOptions): GameTransport {
  let socket: PartySocket | null = null
  const eventHandlers = new Set<(event: GameEvent) => void>()
  const connectHandlers = new Set<() => void>()
  const disconnectHandlers = new Set<() => void>()
  const errorHandlers = new Set<(err: ConnectionError) => void>()

  return {
    connect(roomId, playerId, opts) {
      socket = new PartySocket({
        host: options.host,
        room: roomId,
        id: playerId,
        query: opts?.password ? { p: opts.password } : undefined,
      })

      socket.addEventListener('message', (e) => {
        const event = JSON.parse(e.data as string) as GameEvent
        eventHandlers.forEach(h => h(event))
      })

      socket.addEventListener('open', () => {
        connectHandlers.forEach(h => h())
      })

      socket.addEventListener('close', (e) => {
        // 4xxx codes are server-rejected (auth fail, etc.) — bubble up so the UI
        // can surface a meaningful error and stop reconnect loops.
        if (e.code >= 4000 && e.code < 5000) {
          errorHandlers.forEach(h => h({ code: e.code, reason: e.reason }))
          socket?.close()
        }
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

    onError(handler) {
      errorHandlers.add(handler)
      return () => errorHandlers.delete(handler)
    },
  }
}
