import { useState } from 'react'
import { Frame, TitleBar, Button, Input } from '@react95/core'
import { RulesModal } from '../RulesModal'

interface JoinScreenProps {
  onJoin: (roomId: string, playerName: string, password?: string) => void
  onSpectate: (roomId: string, password?: string) => void
  prefilledRoom?: string
  prefilledName?: string
  prefilledPassword?: string
  error?: string | null
}

function randomRoomId(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

export function JoinScreen({ onJoin, onSpectate, prefilledRoom, prefilledName, prefilledPassword, error: externalError }: JoinScreenProps) {
  const [name, setName] = useState(prefilledName ?? '')
  const [roomInput, setRoomInput] = useState(prefilledRoom ?? '')
  const [password, setPassword] = useState(prefilledPassword ?? '')
  const [error, setError] = useState('')
  const [rulesOpen, setRulesOpen] = useState(false)

  const hasRoom = roomInput.trim().length > 0
  const displayError = error || externalError || ''

  function handleSubmit() {
    if (!name.trim()) { setError('Enter your name first.'); return }
    const pw = password.trim() || undefined
    if (hasRoom) {
      onJoin(roomInput.trim().toUpperCase(), name.trim(), pw)
    } else {
      onJoin(randomRoomId(), name.trim(), pw)
    }
  }

  function handleSpectate() {
    if (!hasRoom) { setError('Enter a room code to spectate.'); return }
    onSpectate(roomInput.trim().toUpperCase(), password.trim() || undefined)
  }

  return (
    <div style={pageStyle}>
      <Frame
        bgColor="$material"
        boxShadow="$out"
        p="$2"
        style={{ width: 360 }}
      >
        <TitleBar title="Texas Flush'em - Join Game" active />
        <div style={{ padding: 16 }}>
          <p style={{ margin: '0 0 16px', fontSize: 12 }}>Deck poker for 2-4 players</p>

          <Field label="Your name">
            <Input
              value={name}
              onChange={e => { setName(e.target.value); setError('') }}
              placeholder="e.g. Alice"
              maxLength={20}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              autoFocus
              style={{ width: '100%' }}
            />
          </Field>

          <Field label="Room code">
            <Input
              value={roomInput}
              onChange={e => { setRoomInput(e.target.value); setError('') }}
              placeholder="e.g. A3BC9F"
              maxLength={6}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              style={{ width: '100%' }}
            />
          </Field>

          <Field label={<>Password <span style={{ color: '#666', fontWeight: 400 }}>(optional)</span></>}>
            <Input
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError('') }}
              placeholder={hasRoom ? 'If the room has one' : 'Lock this room'}
              maxLength={32}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              style={{ width: '100%' }}
            />
          </Field>

          {displayError && (
            <Frame
              bgColor="$inputBackground"
              boxShadow="$in"
              p="$4"
              style={{ marginBottom: 12, color: '#a00', fontSize: 12 }}
            >
              {displayError}
            </Frame>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            <Button onClick={handleSubmit} style={{ width: '100%' }}>
              {hasRoom ? 'Join game' : 'Create game'}
            </Button>
            {hasRoom && (
              <Button onClick={handleSpectate} style={{ width: '100%' }}>
                Watch as spectator
              </Button>
            )}
            <Button onClick={() => setRulesOpen(true)} style={{ width: '100%' }}>
              How to play
            </Button>
          </div>
        </div>
      </Frame>
      {rulesOpen && <RulesModal onClose={() => setRulesOpen(false)} />}
    </div>
  )
}

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
        {label}
      </label>
      {children}
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
