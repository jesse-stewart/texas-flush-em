import { useEffect } from 'react'
import { Frame, TitleBar } from '@react95/core'
import { Button } from 'react95'
import type { GameEvent } from '@shared/engine/game-state'
import type { PlayerView } from '@shared/engine/state-machine'
import { EventLog } from './Game/EventLog'

interface GameLogModalProps {
  events: GameEvent[]
  players: Pick<PlayerView, 'id' | 'name'>[]
  myPlayerId: string
  onClose: () => void
}

export function GameLogModal({ events, players, myPlayerId, onClose }: GameLogModalProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div style={backdropStyle} onClick={onClose}>
      <Frame
        bgColor="$material"
        boxShadow="$out"
        p="$2"
        style={{ width: '100%', maxWidth: 560, maxHeight: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}
      >
        <TitleBar title="Game log" active>
          <TitleBar.OptionsBox>
            <TitleBar.Close onClick={onClose} />
          </TitleBar.OptionsBox>
        </TitleBar>

        <div style={{ padding: 4, flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <EventLog events={events} players={players} myPlayerId={myPlayerId} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 4px 0' }}>
          <Button onClick={onClose} style={{ minWidth: 75 }}>OK</Button>
        </div>
      </Frame>
    </div>
  )
}

const backdropStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 200,
  backgroundColor: 'rgba(0,0,0,0.4)',
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  padding: '40px 16px',
}
