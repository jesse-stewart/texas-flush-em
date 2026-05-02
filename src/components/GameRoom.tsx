import { useEffect, useState } from 'react'
import { useGame } from '../hooks/useGame'
import { WaitingRoom } from './Lobby/WaitingRoom'
import { GameScreen } from './GameScreen'
import { SpectatorScreen } from './SpectatorScreen'
import type { ClientGameState } from '@shared/engine/state-machine'
import type { GameState } from '@shared/engine/game-state'
import type { Card } from '@shared/engine/card'

interface GameRoomProps {
  roomId: string
  playerId: string
  playerName: string
  spectatorMode?: boolean
  onLeave: () => void
}

export function GameRoom({ roomId, playerId, playerName, spectatorMode, onLeave }: GameRoomProps) {
  const { state, isConnected, send, presence, debugState, requestDebugState } = useGame({ roomId, playerId })
  const [debugOpen, setDebugOpen] = useState(false)
  const [roundModalDismissed, setRoundModalDismissed] = useState(false)
  const [spectating, setSpectating] = useState(false)

  // Reset modal and spectating each time a new round ends
  useEffect(() => {
    if (state?.phase === 'round_end') {
      setRoundModalDismissed(false)
      setSpectating(false)
    }
  }, [state?.phase])

  useEffect(() => {
    if (!import.meta.env.DEV) return
    function onKey(e: KeyboardEvent) {
      if (e.key === '`') {
        requestDebugState()
        setDebugOpen(prev => !prev)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Send JOIN every time we connect (handles initial connect + reconnects).
  // Server-side ADD_PLAYER is idempotent in lobby and a no-op once playing.
  // Spectators do not send JOIN — they receive state without being added as players.
  useEffect(() => {
    if (isConnected && !spectatorMode) {
      send({ type: 'JOIN', playerName })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected])

  function handleLeave() {
    if (!window.confirm('Leave the game? You will be eliminated and the game will continue without you.')) return
    send({ type: 'LEAVE' })
    onLeave()
  }

  let content: React.ReactNode = (
    <div style={loadingStyle}><span>Connecting…</span></div>
  )

  if (state) {
    const mePlayer = state.players.find(p => p.id === playerId)
    const isEliminated = mePlayer?.eliminated ?? false
    const isActiveParticipant = !!mePlayer && !isEliminated

    if (spectatorMode) {
      if (state.phase === 'lobby') {
        content = <SpectatorLobbyScreen state={state} roomId={roomId} onLeave={onLeave} />
      } else {
        content = <SpectatorScreen state={state} presence={presence} onLeave={onLeave} />
      }
    } else if (state.phase === 'abandoned') {
      content = <AbandonedScreen abandonedByName={state.abandonedByName} onLeave={onLeave} />
    } else if (state.phase === 'game_end') {
      content = <GameEndScreen state={state} myPlayerId={playerId} onLeave={onLeave} />
    } else if (state.phase === 'lobby') {
      content = (
        <WaitingRoom
          state={state}
          roomId={roomId}
          myPlayerId={playerId}
          isConnected={isConnected}
          onStart={() => send({ type: 'START_GAME' })}
          onAddCpu={() => send({ type: 'JOIN_CPU' })}
          onLeave={onLeave}
        />
      )
    } else if (state.phase === 'playing') {
      content = isActiveParticipant
        ? <GameScreen state={state} myPlayerId={playerId} roomId={roomId} send={send} presence={presence} onLeave={handleLeave} />
        : <SpectatorScreen state={state} presence={presence} onLeave={onLeave} />
    } else if (state.phase === 'round_end') {
      if (spectating) {
        content = <SpectatorScreen state={state} presence={presence} onLeave={handleLeave} eliminated />
      } else if (!roundModalDismissed) {
        content = (
          <div style={{ position: 'relative' }}>
            <GameScreen state={state} myPlayerId={playerId} roomId={roomId} send={send} presence={presence} onLeave={handleLeave} />
            <RoundEndModal
              state={state}
              myPlayerId={playerId}
              onNext={() => setRoundModalDismissed(true)}
            />
          </div>
        )
      } else {
        content = (
          <RoundEndScreen
            state={state}
            myPlayerId={playerId}
            isEliminated={isEliminated}
            canStartRound={isActiveParticipant}
            onNextRound={() => send({ type: 'NEXT_ROUND' })}
            onSpectate={() => setSpectating(true)}
            onLeave={handleLeave}
          />
        )
      }
    }
  }

  return (
    <>
      {content}
      {import.meta.env.DEV && debugOpen && debugState && (
        <DebugOverlay state={debugState} myPlayerId={playerId} onClose={() => setDebugOpen(false)} />
      )}
    </>
  )
}

function SpectatorLobbyScreen({ state, roomId, onLeave }: { state: ClientGameState; roomId: string; onLeave: () => void }) {
  return (
    <div style={{ ...loadingStyle, flexDirection: 'column', gap: 16 }}>
      <h2 style={{ color: '#fff', margin: 0, fontSize: 22, fontWeight: 800 }}>Spectating — {roomId}</h2>
      <p style={{ color: '#9ca3af', margin: 0, fontSize: 15 }}>
        Waiting for the game to start… ({state.players.length}/4 players joined)
      </p>
      <button onClick={onLeave} style={roundBtn('rgba(255,255,255,0.1)')}>Leave</button>
    </div>
  )
}

function AbandonedScreen({ abandonedByName, onLeave }: { abandonedByName: string | null; onLeave: () => void }) {
  return (
    <div style={{ ...loadingStyle, flexDirection: 'column', gap: 16 }}>
      <h2 style={{ color: '#fff', margin: 0, fontSize: 24 }}>Game over</h2>
      <p style={{ color: '#d1d5db', margin: 0 }}>
        {abandonedByName ? `${abandonedByName} left the game.` : 'A player left the game.'}
      </p>
      <button onClick={onLeave} style={roundBtn('#16a34a')}>Back to lobby</button>
    </div>
  )
}

function RoundEndModal({
  state, myPlayerId, onNext,
}: {
  state: ClientGameState
  myPlayerId: string
  onNext: () => void
}) {
  const isWinner = state.roundWinnerId === myPlayerId
  const winner = state.players.find(p => p.id === state.roundWinnerId)
  const myDelta = state.roundScoreDelta[myPlayerId] ?? 0

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.6)',
    }}>
      <div style={{
        backgroundColor: '#1a2e1a',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 16,
        padding: '36px 48px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
        boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
        minWidth: 280,
      }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: '#fff', textAlign: 'center' }}>
          {winner?.name ?? 'Someone'} wins the round!
        </div>
        <div style={{ fontSize: 16, fontWeight: 600, color: isWinner ? '#6ee7b7' : '#fca5a5' }}>
          {isWinner ? 'No chips lost' : `-${myDelta} chips`}
        </div>
        <button onClick={onNext} style={{
          marginTop: 12,
          padding: '10px 32px',
          fontSize: 15, fontWeight: 700,
          borderRadius: 8, border: 'none',
          backgroundColor: '#16a34a', color: '#fff',
          cursor: 'pointer',
        }}>
          See scores →
        </button>
      </div>
    </div>
  )
}

function GameEndScreen({ state, myPlayerId, onLeave }: { state: ClientGameState; myPlayerId: string; onLeave: () => void }) {
  const winner = state.players.find(p => p.id === state.gameWinnerId)
  const isWinner = state.gameWinnerId === myPlayerId

  const sorted = [...state.players].sort((a, b) => (state.scores[a.id] ?? 0) - (state.scores[b.id] ?? 0))

  return (
    <div style={{ ...loadingStyle, flexDirection: 'column', gap: 20 }}>
      <h2 style={{ color: '#fde68a', margin: 0, fontSize: 28, fontWeight: 800 }}>
        {isWinner ? 'You win the game!' : `${winner?.name ?? 'Someone'} wins the game!`}
      </h2>

      <table style={{ color: '#d1d5db', borderCollapse: 'collapse', textAlign: 'right', fontSize: 15 }}>
        <thead>
          <tr style={{ color: '#6b7280', fontSize: 12, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <th style={{ textAlign: 'left', paddingRight: 24, paddingBottom: 8, fontWeight: 400 }}></th>
            <th style={{ paddingBottom: 8, fontWeight: 400 }}>chips</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(p => {
            const isMe = p.id === myPlayerId
            const isGameWinner = p.id === state.gameWinnerId
            return (
              <tr key={p.id} style={{ opacity: p.eliminated && !isGameWinner ? 0.45 : 1 }}>
                <td style={{ textAlign: 'left', paddingRight: 24, paddingTop: 10, fontWeight: isMe ? 700 : 400, color: isMe ? '#fde68a' : '#d1d5db' }}>
                  {p.name}
                  {isGameWinner && <span style={{ marginLeft: 8, fontSize: 11, color: '#6ee7b7' }}>winner</span>}
                </td>
                <td style={{ paddingTop: 10, fontWeight: 700, color: isMe ? '#fde68a' : '#d1d5db' }}>
                  {52 - (state.scores[p.id] ?? 0)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <button onClick={onLeave} style={roundBtn('#16a34a')}>Back to lobby</button>
    </div>
  )
}

function RoundEndScreen({
  state, myPlayerId, isEliminated, canStartRound, onNextRound, onSpectate, onLeave,
}: {
  state: ClientGameState
  myPlayerId: string
  isEliminated: boolean
  canStartRound: boolean
  onNextRound: () => void
  onSpectate: () => void
  onLeave: () => void
}) {
  const winner = state.players.find(p => p.id === state.roundWinnerId)

  // Sort: ascending by total score (lowest penalty first); eliminated players last
  const sorted = [...state.players].sort((a, b) => {
    if (a.eliminated !== b.eliminated) return a.eliminated ? 1 : -1
    return (state.scores[a.id] ?? 0) - (state.scores[b.id] ?? 0)
  })

  return (
    <div style={{ ...loadingStyle, flexDirection: 'column', gap: 20 }}>
      <h2 style={{ color: '#fff', margin: 0, fontSize: 24, fontWeight: 800 }}>
        {winner?.name ?? 'Someone'} wins the round!
      </h2>

      <table style={{ color: '#d1d5db', borderCollapse: 'collapse', textAlign: 'right', fontSize: 15 }}>
        <thead>
          <tr style={{ color: '#6b7280', fontSize: 12, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <th style={{ textAlign: 'left', paddingRight: 24, paddingBottom: 8, fontWeight: 400 }}></th>
            <th style={{ paddingRight: 20, paddingBottom: 8, fontWeight: 400 }}>before</th>
            <th style={{ paddingRight: 20, paddingBottom: 8, fontWeight: 400 }}>this round</th>
            <th style={{ paddingBottom: 8, fontWeight: 400 }}>chips</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(p => {
            const ptsLost = state.roundScoreDelta[p.id] ?? 0
            const chipsNow = 52 - (state.scores[p.id] ?? 0)
            const chipsBefore = chipsNow + ptsLost
            const isMe = p.id === myPlayerId
            const isRoundWinner = p.id === state.roundWinnerId
            return (
              <tr key={p.id} style={{ opacity: p.eliminated ? 0.45 : 1 }}>
                <td style={{ textAlign: 'left', paddingRight: 24, paddingTop: 10, fontWeight: isMe ? 700 : 400, color: isMe ? '#fde68a' : '#d1d5db' }}>
                  {p.name}
                  {p.eliminated && <span style={{ marginLeft: 6, fontSize: 11, color: '#6b7280' }}>out</span>}
                </td>
                <td style={{ paddingRight: 20, paddingTop: 10, color: '#6b7280' }}>{chipsBefore}</td>
                <td style={{ paddingRight: 20, paddingTop: 10, color: isRoundWinner ? '#6ee7b7' : '#fca5a5', fontWeight: 600 }}>
                  {isRoundWinner ? '—' : `-${ptsLost}`}
                </td>
                <td style={{ paddingTop: 10, fontWeight: 700, color: isMe ? '#fde68a' : '#d1d5db' }}>{chipsNow}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {isEliminated && (
        <p style={{ color: '#fca5a5', fontWeight: 600, margin: 0, fontSize: 15 }}>
          You've been eliminated — 52 points reached.
        </p>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        {canStartRound && (
          <button onClick={onNextRound} style={roundBtn('#16a34a')}>Start next round</button>
        )}
        {isEliminated && (
          <button onClick={onSpectate} style={roundBtn('#16a34a')}>Spectate</button>
        )}
        <button onClick={onLeave} style={roundBtn('rgba(255,255,255,0.1)')}>Leave</button>
      </div>
    </div>
  )
}

function roundBtn(bg: string): React.CSSProperties {
  return {
    padding: '10px 24px',
    fontSize: 15,
    fontWeight: 700,
    borderRadius: 8,
    border: 'none',
    backgroundColor: bg,
    color: '#fff',
    cursor: 'pointer',
  }
}

const SUIT_SYMBOL: Record<string, string> = { clubs: '♣', diamonds: '♦', hearts: '♥', spades: '♠' }
const SUIT_COLOR: Record<string, string> = { clubs: '#9ca3af', diamonds: '#f87171', hearts: '#f87171', spades: '#9ca3af' }

function fmt(card: Card) { return `${card.rank}${SUIT_SYMBOL[card.suit]}` }

function CardList({ cards, label }: { cards: Card[]; label: string }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <span style={{ color: '#6b7280', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label} ({cards.length})
      </span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
        {cards.length === 0
          ? <span style={{ color: '#4b5563', fontSize: 12 }}>—</span>
          : cards.map((c, i) => (
            <span key={i} style={{
              color: SUIT_COLOR[c.suit],
              backgroundColor: '#1f2937',
              padding: '1px 6px',
              borderRadius: 4,
              fontSize: 12,
              fontFamily: 'monospace',
            }}>{fmt(c)}</span>
          ))
        }
      </div>
    </div>
  )
}

function DebugOverlay({ state, myPlayerId, onClose }: { state: GameState; myPlayerId: string; onClose: () => void }) {
  const currentId = state.playerOrder[state.currentPlayerIndex]
  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 9999, overflow: 'auto', padding: 24 }} onClick={onClose}>
      <div style={{ maxWidth: 860, margin: '0 auto', backgroundColor: '#111827', borderRadius: 10, padding: 24, color: '#f9fafb' }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottom: '1px solid #374151', paddingBottom: 12 }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: '#a3e635', letterSpacing: '0.05em' }}>DEBUG — FULL STATE</span>
          <span style={{ color: '#6b7280', fontSize: 11 }}>phase: <b style={{ color: '#fff' }}>{state.phase}</b> · turn: <b style={{ color: '#fff' }}>{state.turnPhase}</b> · decks: <b style={{ color: '#fff' }}>{state.deckCount}</b> · middle pile: <b style={{ color: '#fff' }}>{state.middlePile.length}</b> cards</span>
        </div>

        {/* Players */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 16 }}>
          {state.playerOrder.map(id => {
            const p = state.players.find(pl => pl.id === id)!
            const isCurrent = id === currentId
            const isMe = id === myPlayerId
            return (
              <div key={id} style={{ backgroundColor: '#1f2937', borderRadius: 8, padding: 16, border: isCurrent ? '1px solid #a3e635' : '1px solid #374151' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>{p.name}</span>
                  {isMe && <span style={{ fontSize: 10, backgroundColor: '#065f46', color: '#6ee7b7', padding: '1px 6px', borderRadius: 4 }}>you</span>}
                  {isCurrent && <span style={{ fontSize: 10, backgroundColor: '#78350f', color: '#fde68a', padding: '1px 6px', borderRadius: 4 }}>{state.turnPhase}</span>}
                  {p.folded && <span style={{ fontSize: 10, backgroundColor: '#7f1d1d', color: '#fca5a5', padding: '1px 6px', borderRadius: 4 }}>folded</span>}
                  {!p.connected && <span style={{ fontSize: 10, backgroundColor: '#374151', color: '#9ca3af', padding: '1px 6px', borderRadius: 4 }}>disconnected</span>}
                </div>
                <CardList cards={p.hand} label="Hand" />
                <CardList cards={p.deck} label="Deck" />
              </div>
            )
          })}
        </div>

        {/* Current hand plays */}
        {state.currentHandPlays.length > 0 && (
          <div style={{ marginTop: 20, borderTop: '1px solid #374151', paddingTop: 16 }}>
            <div style={{ color: '#6b7280', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Current hand plays</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {state.currentHandPlays.map((play, i) => {
                const name = state.players.find(p => p.id === play.playerId)?.name ?? play.playerId
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ color: '#6b7280', fontSize: 11, minWidth: 80 }}>{name}</span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {play.hand.cards.map((c, j) => (
                        <span key={j} style={{ color: SUIT_COLOR[c.suit], backgroundColor: '#1f2937', padding: '1px 6px', borderRadius: 4, fontSize: 12, fontFamily: 'monospace' }}>{fmt(c)}</span>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div style={{ marginTop: 16, color: '#4b5563', fontSize: 11, textAlign: 'center' }}>click outside or press ` to close</div>
      </div>
    </div>
  )
}

const loadingStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#0f4c2a',
  color: '#fff',
  fontSize: 18,
  fontFamily: 'system-ui, sans-serif',
}
