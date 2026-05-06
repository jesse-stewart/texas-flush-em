import { useState } from 'react'
import { Frame, TitleBar } from '@react95/core'
import { Button, TextInput } from 'react95'
import { RulesModal } from '../RulesModal'
import { AboutModal } from '../AboutModal'
import { ApiSpecModal } from '../ApiSpecModal'
import { MenuBar } from '../MenuBar'
import { palette } from '../../palette'

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
  const [aboutOpen, setAboutOpen] = useState(false)
  const [apiOpen, setApiOpen] = useState(false)

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
        style={{ width: '100%', maxWidth: 360 }}
      >
        <TitleBar title="Texas Flush'em - Join Game" active />
        <MenuBar
          menus={[
            {
              name: '&Help',
              items: [
                { label: '&Rules', onClick: () => setRulesOpen(true) },
                { label: 'Bot &API…', onClick: () => setApiOpen(true) },
                { divider: true, label: '' },
                { label: '&About Texas Flush\'em', onClick: () => setAboutOpen(true) },
              ],
            },
          ]}
        />
        <div style={{ padding: 16 }}>
          <p style={{ margin: '0 0 16px', fontSize: 12 }}>Deck poker for 2-4 players</p>

          <Field label="Your name">
            <TextInput
              value={name}
              onChange={e => { setName(e.target.value); setError('') }}
              placeholder="e.g. Alice"
              maxLength={20}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              autoFocus
              fullWidth
            />
          </Field>

          <Field label="Room code">
            <TextInput
              value={roomInput}
              onChange={e => { setRoomInput(e.target.value); setError('') }}
              placeholder="e.g. A3BC9F"
              maxLength={6}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              fullWidth
            />
          </Field>

          <Field label={<>Password <span style={{ color: palette.dkGray, fontWeight: 400 }}>(optional)</span></>}>
            <TextInput
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError('') }}
              placeholder={hasRoom ? 'If the room has one' : 'Lock this room'}
              maxLength={32}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              fullWidth
            />
          </Field>

          {displayError && (
            <Frame
              bgColor="$inputBackground"
              boxShadow="$in"
              p="$4"
              style={{ marginBottom: 12, color: palette.lose, fontSize: 12 }}
            >
              {displayError}
            </Frame>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            <Button onClick={handleSubmit} primary fullWidth>
              {hasRoom ? 'Join game' : 'Create game'}
            </Button>
            {hasRoom && (
              <Button onClick={handleSpectate} fullWidth>
                Watch as spectator
              </Button>
            )}
            <Button onClick={() => setRulesOpen(true)} size="sm" fullWidth>
              Rules
            </Button>
          </div>
        </div>
      </Frame>

      <div style={footerStyle}>
        (c) {new Date().getFullYear()}{' '}
        <a
          href="https://jessestewart.com"
          target="_blank"
          rel="noopener noreferrer"
          style={footerLinkStyle}
        >
          Jesse Stewart
        </a>
      </div>

      {rulesOpen && <RulesModal onClose={() => setRulesOpen(false)} />}
      {aboutOpen && <AboutModal onClose={() => setAboutOpen(false)} />}
      {apiOpen && <ApiSpecModal onClose={() => setApiOpen(false)} />}
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
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 20,
  gap: 16,
}

const footerStyle: React.CSSProperties = {
  fontSize: 11,
  color: palette.white,
  textShadow: '1px 1px 0 #000',
  textAlign: 'center',
}

const footerLinkStyle: React.CSSProperties = {
  color: palette.white,
  textDecoration: 'underline',
}
