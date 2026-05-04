import { useState } from 'react'
import { JoinScreen } from './components/Lobby/JoinScreen'
import { GameRoom } from './components/GameRoom'

interface Session {
  roomId: string
  playerId: string
  playerName: string
  password?: string
  spectatorMode?: boolean
}

const SESSION_KEY = 'flushem_session'
const NAME_KEY = 'flushem_name'

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

// Persist the player's name across sessions so JoinScreen can pre-fill it next visit.
// Survives leaving a room (which clears the session) so the name input isn't blanked.
function loadName(): string {
  return localStorage.getItem(NAME_KEY) ?? ''
}

function saveName(name: string) {
  localStorage.setItem(NAME_KEY, name)
}

function getOrCreatePlayerId(existing?: string): string {
  if (existing) return existing
  const id = Math.random().toString(36).slice(2, 10)
  return id
}

export default function App() {
  // If the URL points to a different room than the saved session, discard the
  // session so JoinScreen renders with the URL's room pre-filled. Otherwise the
  // old session would silently "win" and you'd never see the room you opened.
  const [session, setSession] = useState<Session | null>(() => {
    const saved = loadSession()
    const urlRoom = new URLSearchParams(window.location.search).get('room')?.toUpperCase()
    if (urlRoom && saved && saved.roomId !== urlRoom) {
      localStorage.removeItem(SESSION_KEY)
      return null
    }
    return saved
  })
  const [joinError, setJoinError] = useState<string | null>(null)

  function handleJoin(roomId: string, playerName: string, password?: string) {
    const playerId = getOrCreatePlayerId(session?.playerId)
    const s: Session = { roomId, playerId, playerName, password }
    saveSession(s)
    saveName(playerName)
    setJoinError(null)
    setSession(s)
  }

  function handleSpectate(roomId: string, password?: string) {
    const playerId = getOrCreatePlayerId(session?.playerId)
    const s: Session = { roomId, playerId, playerName: '', password, spectatorMode: true }
    saveSession(s)
    setJoinError(null)
    setSession(s)
  }

  function handleLeave() {
    localStorage.removeItem(SESSION_KEY)
    setSession(null)
  }

  // Server rejected the connection (wrong password, etc.) — clear session and
  // bounce back to JoinScreen with the room/name pre-filled and an error shown.
  function handleAuthFailed(reason: string) {
    const prev = session
    localStorage.removeItem(SESSION_KEY)
    setSession(null)
    setJoinError(reason === 'wrong-password' ? 'Wrong password for that room.' : `Couldn't join: ${reason}`)
    // Keep room+name in URL so JoinScreen pre-fills.
    if (prev) {
      const url = new URL(window.location.href)
      url.searchParams.set('room', prev.roomId)
      window.history.replaceState({}, '', url.toString())
    }
  }

  if (!session) {
    const params = new URLSearchParams(window.location.search)
    const prefilledRoom = params.get('room') ?? undefined
    const prefilledPassword = params.get('p') ?? undefined
    return (
      <JoinScreen
        onJoin={handleJoin}
        onSpectate={handleSpectate}
        prefilledRoom={prefilledRoom}
        prefilledName={loadName()}
        prefilledPassword={prefilledPassword}
        error={joinError}
      />
    )
  }

  return (
    <GameRoom
      roomId={session.roomId}
      playerId={session.playerId}
      playerName={session.playerName}
      password={session.password}
      spectatorMode={session.spectatorMode}
      onLeave={handleLeave}
      onAuthFailed={handleAuthFailed}
    />
  )
}
