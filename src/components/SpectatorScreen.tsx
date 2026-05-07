import { useState } from 'react'
import { Frame, TitleBar, contract } from '@react95/core'
import { Button } from 'react95'
import type { ClientGameState } from '@shared/engine/state-machine'
import type { PlayerPresence } from '../transport/presence'
import { OpponentArea, OpponentSeat } from './Game/OpponentArea'
import { TableCenter } from './Game/TableCenter'
import { MenuBar } from './MenuBar'
import { RulesModal } from './RulesModal'
import { AboutModal } from './AboutModal'
import { ApiSpecModal } from './ApiSpecModal'
import { GameLogModal } from './GameLogModal'
import { CardBackPicker } from './CardBackPicker/CardBackPicker'
import { palette } from '../palette'
import { buildSpectatorLink } from '../lib/inviteLink'

interface SpectatorScreenProps {
  state: ClientGameState
  presence: Map<string, PlayerPresence>
  onLeave: () => void
  eliminated?: boolean
  roomId: string
  password?: string
}

export function SpectatorScreen({ state, presence, onLeave, eliminated, roomId, password }: SpectatorScreenProps) {
  const [rulesOpen, setRulesOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [apiOpen, setApiOpen] = useState(false)
  const [cardBackOpen, setCardBackOpen] = useState(false)
  const [gameLogOpen, setGameLogOpen] = useState(false)

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
              { label: 'Copy &spectator link', onClick: () => navigator.clipboard.writeText(buildSpectatorLink(roomId, password)) },
              { divider: true, label: '' },
              { label: '&Leave game', onClick: onLeave },
            ],
          },
          {
            name: '&View',
            items: [
              { label: 'Game &log...', onClick: () => setGameLogOpen(true) },
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
        {(() => {
          const activePlayers = state.players.filter(p => !p.eliminated)
          const isChipsMode = state.options.scoringMode === 'chips'
          const stagedBetOf = (id: string): number => {
            const target = presence.get(id)?.bettingTarget
            if (target == null || target <= 0) return 0
            return Math.max(0, Math.min(target, state.scores[id] ?? 0))
          }
          const chipCountOf = (id: string): number | null => {
            if (!isChipsMode) return null
            const base = state.scores[id] ?? 0
            const staged = stagedBetOf(id)
            return staged > 0 ? Math.max(0, base - staged) : base
          }
          const stagedBets: Record<string, number> | undefined = isChipsMode
            ? Object.fromEntries(state.players.map(p => [p.id, stagedBetOf(p.id)]))
            : undefined
          const seatProps = (p: typeof activePlayers[number]) => ({
            player: p,
            isActive: p.id === state.currentPlayerId,
            isDealer: p.id === state.dealerId,
            presence: presence.get(p.id) ?? null,
            events: state.events,
            myPlayerId: '',
            allPlayers: state.players,
            chipCount: chipCountOf(p.id),
            pendingBet: stagedBets?.[p.id] ?? 0,
          })

          if (activePlayers.length < 2 || activePlayers.length > 4) {
            return (
              <>
                <OpponentArea
                  opponents={activePlayers}
                  allPlayers={state.players}
                  myPlayerId=""
                  currentPlayerId={state.currentPlayerId}
                  dealerId={state.dealerId}
                  presence={presence}
                  events={state.events}
                  chipCounts={isChipsMode
                    ? Object.fromEntries(state.players.map(p => [p.id, chipCountOf(p.id) ?? 0]))
                    : undefined}
                  stagedBets={stagedBets}
                />
                <TableCenter state={state} myPlayerId="" myLastPlaySlotIds={null} />
              </>
            )
          }

          const leftPlayer = activePlayers[0]
          const topPlayer = activePlayers.length >= 3 ? activePlayers[1] : null
          const rightPlayer = activePlayers.length === 2 ? activePlayers[1] : activePlayers[2]
          const bottomPlayer = activePlayers.length === 4 ? activePlayers[3] : null

          return (
            <div style={spectatorGridStyle(activePlayers.length as 2 | 3 | 4)}>
              <div style={{ gridArea: 'left', display: 'flex', justifyContent: 'flex-start', alignItems: 'flex-start' }}>
                <OpponentSeat {...seatProps(leftPlayer)} orientation="left" />
              </div>

              {topPlayer && (
                <div style={{ gridArea: 'top', display: 'flex', justifyContent: 'center' }}>
                  <OpponentSeat {...seatProps(topPlayer)} orientation="across" />
                </div>
              )}

              <div style={{ gridArea: 'center', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <TableCenter state={state} myPlayerId="" myLastPlaySlotIds={null} />
              </div>

              <div style={{ gridArea: 'right', display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-start' }}>
                <OpponentSeat {...seatProps(rightPlayer)} orientation="right" />
              </div>

              {bottomPlayer && (
                <div style={{ gridArea: 'bottom', display: 'flex', justifyContent: 'center' }}>
                  <OpponentSeat {...seatProps(bottomPlayer)} orientation="horizontal" />
                </div>
              )}
            </div>
          )
        })()}

        <div style={{ marginTop: 'auto', padding: 12, flexShrink: 0, textAlign: 'center', fontSize: 11, color: palette.ltGray, fontStyle: 'italic' }}>
          {eliminated ? "You've been eliminated - watching the rest of the game" : 'Game in progress - you joined late'}
        </div>
      </Frame>

      {rulesOpen && <RulesModal onClose={() => setRulesOpen(false)} options={state.options} />}
      {aboutOpen && <AboutModal onClose={() => setAboutOpen(false)} />}
      {apiOpen && <ApiSpecModal onClose={() => setApiOpen(false)} />}
      {cardBackOpen && <CardBackPicker onClose={() => setCardBackOpen(false)} />}
      {gameLogOpen && (
        <GameLogModal
          events={state.events}
          players={state.players}
          myPlayerId=""
          onClose={() => setGameLogOpen(false)}
        />
      )}
    </Frame>
  )
}

function spectatorGridStyle(count: 2 | 3 | 4): React.CSSProperties {
  const base: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'minmax(160px, 1fr) minmax(0, auto) minmax(160px, 1fr)',
    gap: 12,
    padding: 12,
    flex: 1,
    minHeight: 0,
  }
  if (count === 2) {
    return {
      ...base,
      gridTemplateRows: '1fr',
      gridTemplateAreas: `"left center right"`,
    }
  }
  if (count === 3) {
    return {
      ...base,
      gridTemplateRows: 'auto 1fr',
      gridTemplateAreas: `
        "left   top    right"
        "left   center right"
      `,
    }
  }
  return {
    ...base,
    gridTemplateRows: 'auto 1fr auto',
    gridTemplateAreas: `
      "left   top    right"
      "left   center right"
      "left   bottom right"
    `,
  }
}
