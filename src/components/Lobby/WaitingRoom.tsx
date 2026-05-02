import { useState } from 'react'
import type { ClientGameState } from '@shared/engine/state-machine'

interface WaitingRoomProps {
  state: ClientGameState
  roomId: string
  myPlayerId: string
  onStart: () => void
  onLeave: () => void
  onAddBot: () => void
  onRemoveBot: (playerId: string) => void
}

export function WaitingRoom({ state, roomId, myPlayerId, onStart, onLeave, onAddBot, onRemoveBot }: WaitingRoomProps) {
  const canStart = state.players.length >= 2
  const canAddBot = state.players.length < 4
  const [copied, setCopied] = useState(false)

  function copyCode() {
    navigator.clipboard.writeText(roomId)
  }

  function copyLink() {
    const url = `${window.location.origin}${window.location.pathname}?room=${roomId}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={styles.page}>
      <div style={styles.panel}>
        <h1 style={styles.title}>Texas Flush'em</h1>

        <div style={styles.roomRow}>
          <span style={styles.roomLabel}>Room code</span>
          <span style={styles.roomCode}>{roomId}</span>
          <button style={styles.copyBtn} onClick={copyCode}>
            Copy
          </button>
        </div>

        <button style={styles.shareLinkBtn} onClick={copyLink}>
          {copied ? '✓ Link copied!' : 'Copy invite link'}
        </button>

        <h2 style={styles.sectionTitle}>
          Players ({state.players.length}/4)
        </h2>

        <ul style={styles.playerList}>
          {state.players.map(p => (
            <li key={p.id} style={styles.playerRow}>
              <span style={styles.dot(p.isConnected)} />
              <span style={styles.playerName}>
                {p.name}
                {p.id === myPlayerId && <span style={styles.youTag}> (you)</span>}
                {p.isBot && <span style={styles.botTag}>CPU</span>}
              </span>
              {p.isBot && (
                <button
                  style={styles.kickBtn}
                  onClick={() => onRemoveBot(p.id)}
                  aria-label={`Remove ${p.name}`}
                >
                  ×
                </button>
              )}
            </li>
          ))}
          {Array.from({ length: 4 - state.players.length }).map((_, i) => (
            <li key={`empty-${i}`} style={styles.playerRow}>
              {i === 0 && canAddBot ? (
                <button style={styles.addBotBtn} onClick={onAddBot}>
                  + Add CPU player
                </button>
              ) : (
                <>
                  <span style={{ ...styles.dot(false), opacity: 0.35 }} />
                  <span style={{ ...styles.playerName, opacity: 0.35 }}>Waiting for player…</span>
                </>
              )}
            </li>
          ))}
        </ul>

        {!canStart && (
          <p style={styles.hint}>Need at least 2 players to start.</p>
        )}

        <button
          style={{ ...styles.startBtn, opacity: canStart ? 1 : 0.4 }}
          onClick={onStart}
          disabled={!canStart}
        >
          Start game
        </button>
        <button style={styles.leaveBtn} onClick={onLeave}>
          Leave room
        </button>
      </div>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f4c2a',
    fontFamily: 'system-ui, sans-serif',
  } as React.CSSProperties,
  panel: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: '40px 48px',
    width: 360,
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  } as React.CSSProperties,
  title: {
    margin: '0 0 20px',
    fontSize: 28,
    fontWeight: 800,
    color: '#1a1a1a',
    letterSpacing: '-1px',
  } as React.CSSProperties,
  roomRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 28,
    padding: '10px 14px',
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    border: '1px solid #e5e7eb',
  } as React.CSSProperties,
  roomLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    flex: 1,
  } as React.CSSProperties,
  roomCode: {
    fontSize: 18,
    fontWeight: 800,
    letterSpacing: '0.15em',
    color: '#111827',
    fontFamily: 'monospace',
  } as React.CSSProperties,
  copyBtn: {
    fontSize: 12,
    padding: '3px 8px',
    borderRadius: 4,
    border: '1px solid #d1d5db',
    backgroundColor: '#fff',
    cursor: 'pointer',
    color: '#374151',
  } as React.CSSProperties,
  shareLinkBtn: {
    width: '100%',
    padding: '8px',
    fontSize: 13,
    fontWeight: 600,
    borderRadius: 8,
    border: '1px solid #d1d5db',
    backgroundColor: '#f9fafb',
    color: '#374151',
    cursor: 'pointer',
    marginBottom: 20,
  } as React.CSSProperties,
  sectionTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: '#6b7280',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    margin: '0 0 12px',
  } as React.CSSProperties,
  playerList: {
    listStyle: 'none',
    margin: '0 0 24px',
    padding: 0,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 10,
  } as React.CSSProperties,
  playerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  } as React.CSSProperties,
  dot: (connected: boolean): React.CSSProperties => ({
    width: 9,
    height: 9,
    borderRadius: '50%',
    backgroundColor: connected ? '#16a34a' : '#9ca3af',
    flexShrink: 0,
  }),
  playerName: {
    fontSize: 15,
    color: '#111827',
  } as React.CSSProperties,
  youTag: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: 400,
  } as React.CSSProperties,
  botTag: {
    marginLeft: 8,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.05em',
    backgroundColor: '#ede9fe',
    color: '#6d28d9',
    padding: '2px 6px',
    borderRadius: 4,
  } as React.CSSProperties,
  kickBtn: {
    marginLeft: 'auto',
    width: 22,
    height: 22,
    fontSize: 16,
    lineHeight: 1,
    border: 'none',
    backgroundColor: 'transparent',
    color: '#9ca3af',
    cursor: 'pointer',
    borderRadius: 4,
    padding: 0,
  } as React.CSSProperties,
  addBotBtn: {
    flex: 1,
    padding: '6px 10px',
    fontSize: 13,
    fontWeight: 600,
    color: '#6d28d9',
    backgroundColor: 'transparent',
    border: '1px dashed #c4b5fd',
    borderRadius: 6,
    cursor: 'pointer',
    textAlign: 'left' as const,
  } as React.CSSProperties,
  hint: {
    fontSize: 13,
    color: '#6b7280',
    margin: '0 0 12px',
    textAlign: 'center' as const,
  } as React.CSSProperties,
  startBtn: {
    width: '100%',
    padding: '12px',
    fontSize: 16,
    fontWeight: 700,
    borderRadius: 8,
    border: 'none',
    backgroundColor: '#16a34a',
    color: '#fff',
    cursor: 'pointer',
  } as React.CSSProperties,
  leaveBtn: {
    width: '100%',
    padding: '8px',
    fontSize: 13,
    fontWeight: 600,
    borderRadius: 8,
    border: 'none',
    backgroundColor: 'transparent',
    color: '#9ca3af',
    cursor: 'pointer',
    marginTop: 4,
  } as React.CSSProperties,
}
