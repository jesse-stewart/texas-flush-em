import { useEffect, useState } from 'react'
import { Frame, TitleBar, Button, Fieldset } from '@react95/core'
import { useGame } from '../hooks/useGame'
import { WaitingRoom } from './Lobby/WaitingRoom'
import { GameScreen } from './GameScreen'
import { SpectatorScreen } from './SpectatorScreen'
import { EventLog } from './Game/EventLog'
import type { ClientGameState } from '@shared/engine/state-machine'
import type { GameState } from '@shared/engine/game-state'
import type { Card } from '@shared/engine/card'

interface GameRoomProps {
  roomId: string
  playerId: string
  playerName: string
  password?: string
  spectatorMode?: boolean
  onLeave: () => void
  onAuthFailed: (reason: string) => void
}

export function GameRoom({ roomId, playerId, playerName, password, spectatorMode, onLeave, onAuthFailed }: GameRoomProps) {
  const { state, isConnected, connectionError, send, presence, debugState, requestDebugState } = useGame({ roomId, playerId, password })

  useEffect(() => {
    if (connectionError) onAuthFailed(connectionError.reason || 'rejected')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionError])
  const [debugOpen, setDebugOpen] = useState(false)
  const [roundModalDismissed, setRoundModalDismissed] = useState(false)
  const [spectating, setSpectating] = useState(false)

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
    <CenterPanel title="Connecting...">
      <p style={{ margin: 0, fontSize: 12 }}>Connecting to room {roomId}...</p>
    </CenterPanel>
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
          password={password}
          myPlayerId={playerId}
          onStart={(options) => send({ type: 'START_GAME', options })}
          onLeave={onLeave}
          onAddBot={(difficulty) => send({ type: 'ADD_BOT', difficulty })}
          onRemoveBot={(id) => send({ type: 'REMOVE_BOT', playerId: id })}
          onSetBotDifficulty={(id, difficulty) => send({ type: 'SET_BOT_DIFFICULTY', playerId: id, difficulty })}
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
            canReady={isActiveParticipant}
            onReady={() => send({ type: 'READY_FOR_NEXT_ROUND' })}
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

function CenterPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={pageStyle}>
      <Frame bgColor="$material" boxShadow="$out" p="$2" style={{ minWidth: 320 }}>
        <TitleBar title={title} active />
        <div style={{ padding: 16 }}>
          {children}
        </div>
      </Frame>
    </div>
  )
}

function SpectatorLobbyScreen({ state, roomId, onLeave }: { state: ClientGameState; roomId: string; onLeave: () => void }) {
  return (
    <CenterPanel title={`Spectating - ${roomId}`}>
      <p style={{ margin: '0 0 12px', fontSize: 12 }}>
        Waiting for the game to start... ({state.players.length}/4 players joined)
      </p>
      <Button onClick={onLeave}>Leave</Button>
    </CenterPanel>
  )
}

function AbandonedScreen({ abandonedByName, onLeave }: { abandonedByName: string | null; onLeave: () => void }) {
  return (
    <CenterPanel title="Game over">
      <p style={{ margin: '0 0 12px', fontSize: 12 }}>
        {abandonedByName ? `${abandonedByName} left the game.` : 'A player left the game.'}
      </p>
      <Button onClick={onLeave}>Back to lobby</Button>
    </CenterPanel>
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
      backgroundColor: 'rgba(0,0,0,0.4)',
    }}>
      <Frame bgColor="$material" boxShadow="$out" p="$2" style={{ minWidth: 320 }}>
        <TitleBar title="Round Result" active />
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>
            {winner?.name ?? 'Someone'} wins the round!
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: isWinner ? '#080' : '#a00' }}>
            {isWinner ? 'No chips lost' : `-${myDelta} chips`}
          </div>
          <Button onClick={onNext} style={{ marginTop: 8, minWidth: 120 }}>
            See scores
          </Button>
        </div>
      </Frame>
    </div>
  )
}

function GameEndScreen({ state, myPlayerId, onLeave }: { state: ClientGameState; myPlayerId: string; onLeave: () => void }) {
  const winner = state.players.find(p => p.id === state.gameWinnerId)
  const isWinner = state.gameWinnerId === myPlayerId
  const isChips = state.options.scoringMode === 'chips'

  const sorted = [...state.players].sort((a, b) =>
    isChips
      ? (state.scores[b.id] ?? 0) - (state.scores[a.id] ?? 0)
      : (state.scores[a.id] ?? 0) - (state.scores[b.id] ?? 0)
  )

  return (
    <div style={pageStyle}>
      <Frame bgColor="$material" boxShadow="$out" p="$2" style={{ width: 480, maxWidth: '100%' }}>
        <TitleBar title="Game over" active />
        <div style={{ padding: 12 }}>
          <h2 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, textAlign: 'center' }}>
            {isWinner ? 'You win the game!' : `${winner?.name ?? 'Someone'} wins the game!`}
          </h2>

          <Fieldset legend="Final scores">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', paddingBottom: 6, fontWeight: 700 }}>Player</th>
                  <th style={{ textAlign: 'right', paddingBottom: 6, fontWeight: 700 }}>{isChips ? 'chips' : 'points'}</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(p => {
                  const isMe = p.id === myPlayerId
                  const isGameWinner = p.id === state.gameWinnerId
                  return (
                    <tr key={p.id} style={{ opacity: p.eliminated && !isGameWinner ? 0.5 : 1 }}>
                      <td style={{ paddingTop: 4, fontWeight: isMe ? 700 : 400 }}>
                        {p.name}
                        {isGameWinner && <span style={{ marginLeft: 6, color: '#080', fontSize: 11 }}>winner</span>}
                      </td>
                      <td style={{ paddingTop: 4, textAlign: 'right', fontWeight: 700 }}>
                        {state.scores[p.id] ?? 0}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Fieldset>

          <div style={{ height: 8 }} />
          <EventLog events={state.events} players={state.players} myPlayerId={myPlayerId} />

          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
            <Button onClick={onLeave} style={{ minWidth: 120 }}>Back to lobby</Button>
          </div>
        </div>
      </Frame>
    </div>
  )
}

function RoundEndScreen({
  state, myPlayerId, isEliminated, canReady, onReady, onSpectate, onLeave,
}: {
  state: ClientGameState
  myPlayerId: string
  isEliminated: boolean
  canReady: boolean
  onReady: () => void
  onSpectate: () => void
  onLeave: () => void
}) {
  const winner = state.players.find(p => p.id === state.roundWinnerId)
  const isChips = state.options.scoringMode === 'chips'
  const totalLabel = isChips ? 'chips' : 'points'

  const requiredReady = state.players.filter(p => !p.isBot && !p.eliminated && p.isConnected)
  const waitingFor = requiredReady.filter(p => !state.nextRoundReady[p.id])
  const meReady = !!state.nextRoundReady[myPlayerId]

  const sorted = [...state.players].sort((a, b) => {
    if (a.eliminated !== b.eliminated) return a.eliminated ? 1 : -1
    return isChips
      ? (state.scores[b.id] ?? 0) - (state.scores[a.id] ?? 0)
      : (state.scores[a.id] ?? 0) - (state.scores[b.id] ?? 0)
  })

  const roundEvents = currentRoundEvents(state.events)

  return (
    <div style={pageStyle}>
      <Frame bgColor="$material" boxShadow="$out" p="$2" style={{ width: 520, maxWidth: '100%' }}>
        <TitleBar title="Round complete" active />
        <div style={{ padding: 12 }}>
          <h2 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, textAlign: 'center' }}>
            {winner?.name ?? 'Someone'} wins the round!
          </h2>

          <Fieldset legend="Scores">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', paddingBottom: 6, fontWeight: 700 }}></th>
                  <th style={{ textAlign: 'right', paddingBottom: 6, fontWeight: 700 }}>before</th>
                  <th style={{ textAlign: 'right', paddingBottom: 6, fontWeight: 700 }}>this round</th>
                  <th style={{ textAlign: 'right', paddingBottom: 6, fontWeight: 700 }}>{totalLabel}</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(p => {
                  const delta = state.roundScoreDelta[p.id] ?? 0
                  const total = state.scores[p.id] ?? 0
                  const before = isChips ? total - delta : total - delta
                  const isMe = p.id === myPlayerId
                  const isRoundWinner = p.id === state.roundWinnerId
                  let deltaText = '-'
                  let deltaColor = '#666'
                  if (isChips) {
                    if (delta > 0) { deltaText = `+${delta}`; deltaColor = '#080' }
                    else if (delta < 0) { deltaText = `${delta}`; deltaColor = '#a00' }
                  } else {
                    if (!isRoundWinner && delta > 0) { deltaText = `+${delta}`; deltaColor = '#a00' }
                  }
                  const isRequired = !p.isBot && !p.eliminated && p.isConnected
                  const ready = !!state.nextRoundReady[p.id]
                  return (
                    <tr key={p.id} style={{ opacity: p.eliminated ? 0.5 : 1 }}>
                      <td style={{ paddingTop: 4, fontWeight: isMe ? 700 : 400 }}>
                        {p.name}
                        {p.eliminated && <span style={{ marginLeft: 6, color: '#666', fontSize: 11 }}>out</span>}
                        {isRequired && (
                          ready
                            ? <span style={{ marginLeft: 6, color: '#080', fontSize: 11 }}>ready</span>
                            : <span style={{ marginLeft: 6, color: '#666', fontSize: 11 }}>waiting...</span>
                        )}
                      </td>
                      <td style={{ paddingTop: 4, textAlign: 'right', color: '#666' }}>{before}</td>
                      <td style={{ paddingTop: 4, textAlign: 'right', color: deltaColor, fontWeight: 700 }}>
                        {deltaText}
                      </td>
                      <td style={{ paddingTop: 4, textAlign: 'right', fontWeight: 700 }}>{total}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Fieldset>

          {isEliminated && (
            <p style={{ color: '#a00', fontWeight: 700, margin: '8px 0', fontSize: 12 }}>
              You&apos;ve been eliminated - {isChips ? 'out of chips' : `${state.options.threshold} points reached`}.
            </p>
          )}

          {roundEvents.length > 0 && (
            <>
              <div style={{ height: 8 }} />
              <EventLog events={roundEvents} players={state.players} myPlayerId={myPlayerId} />
            </>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, marginTop: 12 }}>
            {canReady && !meReady && (
              <Button onClick={onReady} style={{ minWidth: 160, fontWeight: 700 }}>Start next round</Button>
            )}
            {canReady && meReady && waitingFor.length > 0 && (
              <span style={{ fontSize: 11, color: '#444' }}>
                Ready - waiting for {waitingFor.map(p => p.name).join(', ')}
              </span>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              {isEliminated && (
                <Button onClick={onSpectate}>Spectate</Button>
              )}
              <Button onClick={onLeave}>Leave</Button>
            </div>
          </div>
        </div>
      </Frame>
    </div>
  )
}

function currentRoundEvents(events: ClientGameState['events']): ClientGameState['events'] {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i]
    if (e.type === 'round_started' || e.type === 'game_started') return events.slice(i)
  }
  return events
}

const SUIT_SYMBOL: Record<string, string> = { clubs: '♣', diamonds: '♦', hearts: '♥', spades: '♠' }
const SUIT_COLOR: Record<string, string> = { clubs: '#000', diamonds: '#a00', hearts: '#a00', spades: '#000' }

function fmt(card: Card) { return `${card.rank}${SUIT_SYMBOL[card.suit]}` }

function CardList({ cards, label }: { cards: Card[]; label: string }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <span style={{ color: '#444', fontSize: 11, fontWeight: 700 }}>
        {label} ({cards.length})
      </span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 2 }}>
        {cards.length === 0
          ? <span style={{ color: '#888', fontSize: 11 }}>—</span>
          : cards.map((c, i) => (
            <span key={i} style={{
              color: SUIT_COLOR[c.suit],
              backgroundColor: '#fff',
              border: '1px solid #888',
              padding: '0 4px',
              fontSize: 11,
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
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999, overflow: 'auto', padding: 24 }} onClick={onClose}>
      <div style={{ maxWidth: 860, margin: '0 auto' }} onClick={e => e.stopPropagation()}>
        <Frame bgColor="$material" boxShadow="$out" p="$2">
          <TitleBar title="DEBUG - FULL STATE" active>
            <TitleBar.OptionsBox>
              <TitleBar.Close onClick={onClose} />
            </TitleBar.OptionsBox>
          </TitleBar>
          <div style={{ padding: 12, color: '#000' }}>
            <p style={{ margin: '0 0 12px', fontSize: 11 }}>
              phase: <b>{state.phase}</b> · turn: <b>{state.turnPhase}</b> · decks: <b>{state.deckCount}</b> · middle pile: <b>{state.middlePile.length}</b> cards
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 8 }}>
              {state.playerOrder.map(id => {
                const p = state.players.find(pl => pl.id === id)!
                const isCurrent = id === currentId
                const isMe = id === myPlayerId
                return (
                  <Frame key={id} bgColor="$material" boxShadow={isCurrent ? '$in' : '$out'} p="$4">
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 12 }}>{p.name}</span>
                      {isMe && <span style={{ fontSize: 10, backgroundColor: '#0a0', color: '#fff', padding: '0 4px' }}>you</span>}
                      {isCurrent && <span style={{ fontSize: 10, backgroundColor: '#000080', color: '#fff', padding: '0 4px' }}>{state.turnPhase}</span>}
                      {p.folded && <span style={{ fontSize: 10, backgroundColor: '#a00', color: '#fff', padding: '0 4px' }}>folded</span>}
                      {!p.connected && <span style={{ fontSize: 10, backgroundColor: '#888', color: '#fff', padding: '0 4px' }}>disconnected</span>}
                    </div>
                    <CardList cards={p.hand} label="Hand" />
                    <CardList cards={p.deck} label="Deck" />
                  </Frame>
                )
              })}
            </div>

            {state.currentHandPlays.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <Fieldset legend="Current hand plays">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 4 }}>
                    {state.currentHandPlays.map((play, i) => {
                      const name = state.players.find(p => p.id === play.playerId)?.name ?? play.playerId
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 11, minWidth: 80 }}>{name}</span>
                          <div style={{ display: 'flex', gap: 3 }}>
                            {play.hand.cards.map((c, j) => (
                              <span key={j} style={{ color: SUIT_COLOR[c.suit], backgroundColor: '#fff', border: '1px solid #888', padding: '0 4px', fontSize: 11, fontFamily: 'monospace' }}>{fmt(c)}</span>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </Fieldset>
              </div>
            )}

            {state.events.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <EventLog events={state.events} players={state.players} myPlayerId={myPlayerId} />
              </div>
            )}

            <div style={{ marginTop: 8, color: '#666', fontSize: 10, textAlign: 'center' }}>click outside or press ` to close</div>
          </div>
        </Frame>
      </div>
    </div>
  )
}

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 20,
}
