import type { ClientGameState } from '@shared/engine/state-machine'
import type { PlayerPresence } from '../transport/presence'
import { OpponentArea } from './Game/OpponentArea'
import { TableCenter } from './Game/TableCenter'

interface SpectatorScreenProps {
  state: ClientGameState
  presence: Map<string, PlayerPresence>
  onLeave: () => void
  eliminated?: boolean
}

export function SpectatorScreen({ state, presence, onLeave, eliminated }: SpectatorScreenProps) {
  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <span style={styles.logo}>Texas Flush'em</span>
        <span style={styles.badge}>Spectating</span>
        <button style={styles.leaveBtn} onClick={onLeave}>Leave</button>
      </div>

      <OpponentArea opponents={state.players} currentPlayerId={state.currentPlayerId} presence={presence} />

      <TableCenter state={state} myPlayerId="" />

      <div style={styles.footer}>
        <span style={styles.footerText}>{eliminated ? "You've been eliminated — watching the rest of the game" : 'Game in progress — you joined late'}</span>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#0f4c2a',
    fontFamily: 'system-ui, sans-serif',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 20px',
    backgroundColor: 'rgba(0,0,0,0.3)',
    color: '#fff',
    flexShrink: 0,
  },
  logo: {
    fontSize: 18,
    fontWeight: 800,
    letterSpacing: '-0.5px',
    color: '#fff',
    flex: 1,
  },
  badge: {
    fontSize: 12,
    fontWeight: 700,
    padding: '3px 10px',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
    color: '#d1d5db',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  leaveBtn: {
    padding: '4px 12px',
    fontSize: 12,
    fontWeight: 600,
    borderRadius: 6,
    border: '1px solid rgba(255,255,255,0.2)',
    backgroundColor: 'transparent',
    color: '#9ca3af',
    cursor: 'pointer',
  },
  footer: {
    marginTop: 'auto',
    padding: '16px',
    textAlign: 'center',
    flexShrink: 0,
  },
  footerText: {
    fontSize: 13,
    color: '#4b5563',
    fontStyle: 'italic',
  },
}
