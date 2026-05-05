import { Frame, TitleBar, Button } from '@react95/core'
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
    <Frame
      bgColor="$material"
      boxShadow="$out"
      p="$2"
      style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}
    >
      <TitleBar title="Texas Flush'em - Spectating" active>
        <TitleBar.OptionsBox>
          <TitleBar.Close onClick={onLeave} />
        </TitleBar.OptionsBox>
      </TitleBar>

      <Frame
        bgColor="$material"
        px="$6"
        py="$2"
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          borderBottom: '1px solid #868a8e',
          flexShrink: 0,
          fontSize: 12,
        }}
      >
        <span style={{ fontWeight: 700 }}>Spectating</span>
        <span style={{ marginLeft: 'auto' }}>
          <Button onClick={onLeave} style={{ minWidth: 60 }}>Leave</Button>
        </span>
      </Frame>

      <Frame
        boxShadow="$in"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#006300',
          overflow: 'hidden',
          margin: 4,
        }}
      >
        <OpponentArea
          opponents={state.players}
          allPlayers={state.players}
          myPlayerId=""
          currentPlayerId={state.currentPlayerId}
          dealerId={state.dealerId}
          presence={presence}
          events={state.events}
        />

        <TableCenter state={state} myPlayerId="" myLastPlaySlotIds={null} />

        <div style={{ marginTop: 'auto', padding: 16, textAlign: 'center', fontSize: 11, color: '#cfd6cf', fontStyle: 'italic' }}>
          {eliminated ? "You've been eliminated - watching the rest of the game" : 'Game in progress - you joined late'}
        </div>
      </Frame>
    </Frame>
  )
}
