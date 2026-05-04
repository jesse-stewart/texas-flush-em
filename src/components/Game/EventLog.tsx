import type { GameEvent } from '@shared/engine/game-state'
import type { PlayerView } from '@shared/engine/state-machine'
import { formatEvent } from './eventFormat'

interface EventLogProps {
  events: GameEvent[]
  players: Pick<PlayerView, 'id' | 'name'>[]
  myPlayerId: string
}

// Reviewable game log shown at game end. Renders chronologically with a relative
// timestamp from kickoff and a divider when each round starts.
export function EventLog({ events, players, myPlayerId }: EventLogProps) {
  if (events.length === 0) return null

  const start = events[0].ts

  return (
    <div style={styles.container}>
      <div style={styles.header}>Game log</div>
      <div style={styles.list}>
        {events.map((e, i) => {
          const formatted = formatEvent(e, players, myPlayerId)
          if (!formatted) return null
          const isDivider = e.type === 'round_started' || e.type === 'game_started'
          return (
            <div key={i} style={isDivider ? styles.divider : styles.row}>
              <span style={styles.ts}>{relTime(e.ts - start)}</span>
              <span style={isDivider ? styles.dividerText : { ...styles.text, ...toneColor(formatted.tone) }}>
                {formatted.text}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function relTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function toneColor(tone: 'neutral' | 'positive' | 'negative'): React.CSSProperties {
  switch (tone) {
    case 'positive': return { color: '#86efac' }
    case 'negative': return { color: '#fca5a5' }
    default: return { color: '#d1d5db' }
  }
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: 'rgba(0,0,0,0.25)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 10,
    padding: '14px 18px',
  },
  header: {
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#9ca3af',
    marginBottom: 10,
    paddingBottom: 8,
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    maxHeight: 280,
    overflowY: 'auto',
    fontSize: 13,
  },
  row: {
    display: 'flex',
    gap: 12,
    alignItems: 'baseline',
  },
  divider: {
    display: 'flex',
    gap: 12,
    alignItems: 'baseline',
    marginTop: 8,
    paddingTop: 8,
    borderTop: '1px solid rgba(255,255,255,0.06)',
  },
  ts: {
    color: '#6b7280',
    fontFamily: 'ui-monospace, SFMono-Regular, monospace',
    fontSize: 11,
    minWidth: 36,
    flexShrink: 0,
  },
  text: {
    fontWeight: 500,
  },
  dividerText: {
    fontWeight: 700,
    color: '#fde68a',
    fontSize: 12,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
}
