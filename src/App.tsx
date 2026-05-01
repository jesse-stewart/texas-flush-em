import { useState } from 'react'
import { JoinScreen } from './components/Lobby/JoinScreen'
import { GameRoom } from './components/GameRoom'

interface Session {
  roomId: string
  playerId: string
  playerName: string
  spectatorMode?: boolean
}

const SESSION_KEY = 'flushem_session'

function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) as Session : null
  } catch {
    return null
  }
}

function saveSession(session: Session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

function getOrCreatePlayerId(existing?: string): string {
  if (existing) return existing
  const id = Math.random().toString(36).slice(2, 10)
  return id
}

export default function App() {
  const [session, setSession] = useState<Session | null>(() => loadSession())

  function handleJoin(roomId: string, playerName: string) {
    const playerId = getOrCreatePlayerId(session?.playerId)
    const s: Session = { roomId, playerId, playerName }
    saveSession(s)
    setSession(s)
  }

  function handleSpectate(roomId: string) {
    const playerId = getOrCreatePlayerId(session?.playerId)
    const s: Session = { roomId, playerId, playerName: '', spectatorMode: true }
    saveSession(s)
    setSession(s)
  }

  function handleLeave() {
    localStorage.removeItem(SESSION_KEY)
    setSession(null)
  }

  if (!session) {
    const prefilledRoom = new URLSearchParams(window.location.search).get('room') ?? undefined
    return <JoinScreen onJoin={handleJoin} onSpectate={handleSpectate} prefilledRoom={prefilledRoom} />
  }

  return (
    <GameRoom
      roomId={session.roomId}
      playerId={session.playerId}
      playerName={session.playerName}
      spectatorMode={session.spectatorMode}
      onLeave={handleLeave}
    />
  )
}
