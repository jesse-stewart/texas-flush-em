import { useState } from 'react'
import { RulesModal } from '../RulesModal'

interface JoinScreenProps {
  onJoin: (roomId: string, playerName: string) => void
  onSpectate: (roomId: string) => void
  prefilledRoom?: string
}

function randomRoomId(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

export function JoinScreen({ onJoin, onSpectate, prefilledRoom }: JoinScreenProps) {
  const [name, setName] = useState('')
  const [roomInput, setRoomInput] = useState(prefilledRoom ?? '')
  const [error, setError] = useState('')
  const [rulesOpen, setRulesOpen] = useState(false)

  const hasRoom = roomInput.trim().length > 0

  function handleSubmit() {
    if (!name.trim()) { setError('Enter your name first.'); return }
    if (hasRoom) {
      onJoin(roomInput.trim().toUpperCase(), name.trim())
    } else {
      onJoin(randomRoomId(), name.trim())
    }
  }

  function handleSpectate() {
    if (!hasRoom) { setError('Enter a room code to spectate.'); return }
    onSpectate(roomInput.trim().toUpperCase())
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>Texas Flush'em</h1>
        <p style={styles.subtitle}>Deck poker for 2–4 players</p>

        <label style={styles.label}>Your name</label>
        <input
          style={styles.input}
          value={name}
          onChange={e => { setName(e.target.value); setError('') }}
          placeholder="e.g. Alice"
          maxLength={20}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          autoFocus
        />

        <label style={styles.label}>Room code</label>
        <input
          style={styles.input}
          value={roomInput}
          onChange={e => { setRoomInput(e.target.value); setError('') }}
          placeholder="e.g. A3BC9F"
          maxLength={6}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
        />

        {error && <p style={styles.error}>{error}</p>}

        <button style={styles.btn} onClick={handleSubmit}>
          {hasRoom ? 'Join game' : 'Create game'}
        </button>

        {hasRoom && (
          <button style={styles.spectateBtn} onClick={handleSpectate}>
            Watch as spectator
          </button>
        )}

        <button style={styles.rulesLink} onClick={() => setRulesOpen(true)}>
          How to play
        </button>
      </div>
      {rulesOpen && <RulesModal onClose={() => setRulesOpen(false)} />}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f4c2a',
    fontFamily: 'system-ui, sans-serif',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: '40px 48px',
    width: 360,
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    display: 'flex',
    flexDirection: 'column',
  },
  title: {
    margin: '0 0 4px',
    fontSize: 32,
    fontWeight: 800,
    color: '#1a1a1a',
    letterSpacing: '-1px',
  },
  subtitle: {
    margin: '0 0 28px',
    fontSize: 14,
    color: '#6b7280',
  },
  label: {
    fontSize: 13,
    fontWeight: 600,
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    padding: '10px 12px',
    fontSize: 15,
    borderRadius: 6,
    border: '1.5px solid #d1d5db',
    outline: 'none',
    marginBottom: 12,
    width: '100%',
    boxSizing: 'border-box',
  },
  btn: {
    padding: '11px 20px',
    fontSize: 15,
    fontWeight: 600,
    borderRadius: 6,
    border: 'none',
    cursor: 'pointer',
    marginTop: 4,
    backgroundColor: '#16a34a',
    color: '#fff',
  },
  error: {
    color: '#dc2626',
    fontSize: 13,
    margin: '0 0 12px',
  },
  spectateBtn: {
    padding: '9px 20px',
    fontSize: 14,
    fontWeight: 600,
    borderRadius: 6,
    border: '1.5px solid #d1d5db',
    cursor: 'pointer',
    marginTop: 8,
    backgroundColor: '#fff',
    color: '#374151',
  },
  rulesLink: {
    marginTop: 16,
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    textDecoration: 'underline',
  },
}
