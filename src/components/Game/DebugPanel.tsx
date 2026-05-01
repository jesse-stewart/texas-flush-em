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
    <div style={styles.panel}>
      <span style={styles.label}>DEV — cards left: {totalCards}</span>
      <div style={styles.buttons}>
        {counts.map(n => (
          <button
            key={n}
            style={styles.btn}
            onClick={() => send({ type: 'DEBUG_SET_HAND', count: n })}
            disabled={totalCards <= n}
          >
            Kill to {n}
          </button>
        ))}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '4px 16px',
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderTop: '1px solid rgba(239,68,68,0.3)',
    flexShrink: 0,
  },
  label: {
    fontSize: 11,
    fontWeight: 700,
    color: '#f87171',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
  },
  buttons: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
  },
  btn: {
    padding: '2px 10px',
    fontSize: 11,
    fontWeight: 600,
    borderRadius: 4,
    border: '1px solid rgba(239,68,68,0.4)',
    backgroundColor: 'rgba(239,68,68,0.1)',
    color: '#fca5a5',
    cursor: 'pointer',
  },
}
