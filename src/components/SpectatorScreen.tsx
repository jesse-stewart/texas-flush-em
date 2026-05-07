import { useState } from 'react'
import { Frame, TitleBar, contract } from '@react95/core'
import { Button } from 'react95'
import type { ClientGameState } from '@shared/engine/state-machine'
import type { PlayerPresence } from '../transport/presence'
import { OpponentArea } from './Game/OpponentArea'
import { TableCenter } from './Game/TableCenter'
import { EventLog } from './Game/EventLog'
import { MenuBar } from './MenuBar'
import { RulesModal } from './RulesModal'
import { AboutModal } from './AboutModal'
import { ApiSpecModal } from './ApiSpecModal'
import { CardBackPicker } from './CardBackPicker/CardBackPicker'
import { palette } from '../palette'

interface SpectatorScreenProps {
  state: ClientGameState
  presence: Map<string, PlayerPresence>
  onLeave: () => void
  eliminated?: boolean
}

export function SpectatorScreen({ state, presence, onLeave, eliminated }: SpectatorScreenProps) {
  const [rulesOpen, setRulesOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [apiOpen, setApiOpen] = useState(false)
  const [cardBackOpen, setCardBackOpen] = useState(false)

  return (
    <Frame
      bgColor="$material"
      boxShadow="$out"
      p="$2"
      style={{ height: '100dvh', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', overflow: 'hidden' }}
    >
      <TitleBar title="Texas Flush'em - Spectating" active>
        <TitleBar.OptionsBox>
          <TitleBar.Help onClick={() => setRulesOpen(true)} />
          <TitleBar.Close onClick={onLeave} />
        </TitleBar.OptionsBox>
      </TitleBar>

      <MenuBar
        menus={[
          {
            name: '&Game',
            items: [
              { label: '&Leave game', onClick: onLeave },
            ],
          },
          {
            name: '&View',
            items: [
              { label: '&Card backs...', onClick: () => setCardBackOpen(true) },
            ],
          },
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
        {state.players.filter(p => !p.eliminated).map(p => {
          const score = state.scores[p.id] ?? 0
          const isChips = state.options.scoringMode === 'chips'
          return (
            <span key={p.id}>
              {p.name}: {isChips ? `$${score}` : `${score}/${state.options.threshold}`}
            </span>
          )
        })}
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
          opponents={state.players.filter(p => !p.eliminated)}
          allPlayers={state.players}
          myPlayerId=""
          currentPlayerId={state.currentPlayerId}
          dealerId={state.dealerId}
          presence={presence}
          events={state.events}
          chipCounts={state.options.scoringMode === 'chips'
            ? Object.fromEntries(state.players.map(p => [p.id, state.scores[p.id] ?? 0]))
            : undefined}
        />

        <TableCenter state={state} myPlayerId="" myLastPlaySlotIds={null} />

        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8, padding: 12 }}>
          <EventLog events={state.events} players={state.players} myPlayerId="" />
          <div style={{ textAlign: 'center', fontSize: 11, color: palette.ltGray, fontStyle: 'italic' }}>
            {eliminated ? "You've been eliminated - watching the rest of the game" : 'Game in progress - you joined late'}
          </div>
        </div>
      </Frame>

      {rulesOpen && <RulesModal onClose={() => setRulesOpen(false)} options={state.options} />}
      {aboutOpen && <AboutModal onClose={() => setAboutOpen(false)} />}
      {apiOpen && <ApiSpecModal onClose={() => setApiOpen(false)} />}
      {cardBackOpen && <CardBackPicker onClose={() => setCardBackOpen(false)} />}
    </Frame>
  )
}
