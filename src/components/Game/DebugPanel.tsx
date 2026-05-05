import { Frame, Button } from '@react95/core'
import type { ClientGameState } from '@shared/engine/state-machine'
import type { GameAction } from '../../transport/types'

interface DebugPanelProps {
  state: ClientGameState
  myPlayerId: string
  send: (action: GameAction) => void
}

export function DebugPanel({ state, myPlayerId, send }: DebugPanelProps) {
  const me = state.players.find(p => p.id === myPlayerId)
  const totalCards = (me?.handSize ?? 0) + (me?.deckSize ?? 0)

  const counts = [1, 3, 5, 10]

  return (
    <Frame
      bgColor="$material"
      px="$6"
      py="$2"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexShrink: 0,
        borderTop: '2px solid #a00',
      }}
    >
      <span style={{
        fontSize: 11,
        fontWeight: 700,
        color: '#a00',
        whiteSpace: 'nowrap',
      }}>
        DEV - cards left: {totalCards}
      </span>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {counts.map(n => (
          <Button
            key={n}
            onClick={() => send({ type: 'DEBUG_SET_HAND', count: n })}
            disabled={totalCards <= n}
            style={{ minWidth: 70 }}
          >
            Kill to {n}
          </Button>
        ))}
      </div>
    </Frame>
  )
}
