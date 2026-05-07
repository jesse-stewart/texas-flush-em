import { useEffect, useRef, useState } from 'react'
// ← Swap this import to change transport (Socket.io, etc.) — nothing else changes
import { createTransport } from '../transport/partykit'
import type { ConnectionError, GameTransport } from '../transport/GameTransport'
import type { ClientGameState, ClientMessage } from '../transport/types'
import { isPresenceEvent } from '../transport/presence'
import type { PlayerPresence } from '../transport/presence'
import type { GameState } from '@shared/engine/game-state'

const PARTYKIT_HOST = import.meta.env.VITE_PARTYKIT_HOST ?? 'localhost:1999'

interface UseGameOptions {
  roomId: string
  playerId: string
  password?: string
}

interface UseGameReturn {
  state: ClientGameState | null
  isConnected: boolean
  connectionError: ConnectionError | null
  send: (message: ClientMessage) => void
  presence: Map<string, PlayerPresence>
  debugState: GameState | null
  requestDebugState: () => void
}

export function useGame({ roomId, playerId, password }: UseGameOptions): UseGameReturn {
  const [state, setState] = useState<ClientGameState | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [connectionError, setConnectionError] = useState<ConnectionError | null>(null)
  const [presence, setPresence] = useState<Map<string, PlayerPresence>>(new Map())
  const [debugState, setDebugState] = useState<GameState | null>(null)
  const transportRef = useRef<GameTransport | null>(null)

  useEffect(() => {
    const transport = createTransport({ host: PARTYKIT_HOST })
    transportRef.current = transport

    const unsubEvent = transport.onEvent((event) => {
      if (event.type === 'GAME_STATE') setState(event.state)
      if (event.type === 'DEBUG_FULL_STATE') setDebugState(event.state)
      if (isPresenceEvent(event)) {
        setPresence(prev => {
          const next = new Map(prev)
          next.set(event.playerId, { handOrder: event.handOrder, selectedPositions: event.selectedPositions })
          return next
        })
      }
    })
    const unsubConnect = transport.onConnect(() => setIsConnected(true))
    const unsubDisconnect = transport.onDisconnect(() => setIsConnected(false))
    const unsubError = transport.onError((err) => setConnectionError(err))

    transport.connect(roomId, playerId, { password })

    return () => {
      unsubEvent()
      unsubConnect()
      unsubDisconnect()
      unsubError()
      transport.disconnect()
    }
  }, [roomId, playerId, password])

  const send = (message: ClientMessage) => {
    transportRef.current?.send(message)
  }

  const requestDebugState = () => {
    transportRef.current?.send({ type: 'DEBUG_FULL_STATE' })
  }

  return { state, isConnected, connectionError, send, presence, debugState, requestDebugState }
}
