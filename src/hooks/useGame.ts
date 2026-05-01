import { useEffect, useRef, useState } from 'react'
// ← Swap this import to change transport (Socket.io, etc.) — nothing else changes
import { createTransport } from '../transport/partykit'
import type { GameTransport } from '../transport/GameTransport'
import type { ClientGameState, GameAction } from '../transport/types'
import { isPresenceEvent } from '../transport/presence'
import type { PlayerPresence } from '../transport/presence'
import type { GameState } from '@shared/engine/game-state'

const PARTYKIT_HOST = import.meta.env.VITE_PARTYKIT_HOST ?? 'localhost:1999'

interface UseGameOptions {
  roomId: string
  playerId: string
}

interface UseGameReturn {
  state: ClientGameState | null
  isConnected: boolean
  send: (action: GameAction) => void
  presence: Map<string, PlayerPresence>
  debugState: GameState | null
  requestDebugState: () => void
}

export function useGame({ roomId, playerId }: UseGameOptions): UseGameReturn {
  const [state, setState] = useState<ClientGameState | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [presence, setPresence] = useState<Map<string, PlayerPresence>>(new Map())
  const [debugState, setDebugState] = useState<GameState | null>(null)
  const transportRef = useRef<GameTransport | null>(null)

  useEffect(() => {
    const transport = createTransport({ host: PARTYKIT_HOST })
    transportRef.current = transport

    const unsubEvent = transport.onEvent((event) => {
      if (event.type === 'GAME_STATE') setState(event.state)
      if (event.type === 'DEBUG_FULL_STATE') setDebugState(event.state)
      const raw = event as unknown as { type: string }
      if (isPresenceEvent(raw)) {
        setPresence(prev => {
          const next = new Map(prev)
          next.set(raw.playerId, { handOrder: raw.handOrder, selectedPositions: raw.selectedPositions })
          return next
        })
      }
    })
    const unsubConnect = transport.onConnect(() => setIsConnected(true))
    const unsubDisconnect = transport.onDisconnect(() => setIsConnected(false))

    transport.connect(roomId, playerId)

    return () => {
      unsubEvent()
      unsubConnect()
      unsubDisconnect()
      transport.disconnect()
    }
  }, [roomId, playerId])

  const send = (action: GameAction) => {
    transportRef.current?.send(action)
  }

  const requestDebugState = () => {
    transportRef.current?.send({ type: 'DEBUG_FULL_STATE' })
  }

  return { state, isConnected, send, presence, debugState, requestDebugState }
}
