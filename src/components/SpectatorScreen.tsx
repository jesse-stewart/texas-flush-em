import { Frame, TitleBar, contract } from '@react95/core'
import { Button } from 'react95'
import type { ClientGameState } from '@shared/engine/state-machine'
import type { PlayerPresence } from '../transport/presence'
import { OpponentArea } from './Game/OpponentArea'
import { TableCenter } from './Game/TableCenter'
import { EventLog } from './Game/EventLog'
import { palette } from '../palette'

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
      style={{ height: '100dvh', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', overflow: 'hidden' }}
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
          gap: 16,
          alignItems: 'center',
          borderBottom: `1px solid ${contract.colors.borderDark}`,
          flexShrink: 0,
          fontSize: 12,
        }}
      >
        <span style={{ fontWeight: 700 }}>Spectating</span>
        {state.players.map(p => (
          <span key={p.id}>
            {p.name}: {state.scores[p.id] ?? 0}
            {state.options.scoringMode === 'points' && `/${state.options.threshold}`}
          </span>
        ))}
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
          backgroundColor: palette.felt,
          overflow: 'auto',
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

        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8, padding: 12 }}>
          <EventLog events={state.events} players={state.players} myPlayerId="" />
          <div style={{ textAlign: 'center', fontSize: 11, color: palette.ltGray, fontStyle: 'italic' }}>
            {eliminated ? "You've been eliminated - watching the rest of the game" : 'Game in progress - you joined late'}
          </div>
        </div>
      </Frame>
    </Frame>
  )
}
