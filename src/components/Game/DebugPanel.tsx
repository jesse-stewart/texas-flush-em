import { Frame } from '@react95/core'
import { Button } from 'react95'
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
  const myChips = state.scores[myPlayerId] ?? 0
  const isChips = state.options.scoringMode === 'chips'

  const counts = [1, 3, 5, 10]
  const chipDeltas = [-50, -10, +10, +50]

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
        flexWrap: 'wrap',
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

      {isChips && (
        <>
          <span style={{
            fontSize: 11,
            fontWeight: 700,
            color: '#a00',
            whiteSpace: 'nowrap',
            marginLeft: 8,
          }}>
            chips: ${myChips}
          </span>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {chipDeltas.map(d => (
              <Button
                key={d}
                onClick={() => send({ type: 'DEBUG_ADJUST_CHIPS', delta: d })}
                disabled={d < 0 && myChips + d < 0}
                style={{ minWidth: 50 }}
              >
                {d > 0 ? `+$${d}` : `-$${-d}`}
              </Button>
            ))}
          </div>
        </>
      )}
    </Frame>
  )
}
