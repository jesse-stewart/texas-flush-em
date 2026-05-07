import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { LayoutGroup } from 'framer-motion'
import { OpponentArea, OpponentSeat } from './OpponentArea'
import { TableCenter } from './TableCenter'
import { PlayerHand } from './PlayerHand'
import { ActionBar } from './ActionBar'
import { mockPlayer, mockState, mockHandPlay, c } from '../../storybook/fixtures'
import { palette } from '../../palette'
import type { Card as CardType } from '@shared/engine/card'

// These stories assemble the full play area exactly the way GameScreen does it.
// `OpponentArea` (a horizontal row across the top) is only used at 1 or 2
// opponents. With 3 opponents (4-player game) GameScreen switches to the CSS
// grid below and places three separate `OpponentSeat`s into the left/top/right
// slots. The grid template here is copied verbatim from GameScreen.tsx so the
// story matches the real layout.

const meta: Meta = {
  title: 'Game/Table Layout',
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'felt', values: [{ name: 'felt', value: palette.felt }] },
  },
}
export default meta
type Story = StoryObj

const tableGridStyle: React.CSSProperties = {
  flex: 1,
  display: 'grid',
  gridTemplateColumns: 'minmax(160px, 1fr) minmax(0, auto) minmax(160px, 1fr)',
  gridTemplateRows: 'auto 1fr auto',
  gridTemplateAreas: `
    "left   top    right"
    "left   center right"
    "bottom bottom bottom"
  `,
  gap: 12,
  padding: 12,
  minHeight: 0,
}

const feltStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  minHeight: '100vh',
  backgroundColor: palette.felt,
}

// ─── 4-player grid (3 opponents, left/top/right) ─────────────────────────────

const ME = mockPlayer({ id: 'me', name: 'You' })
const ALICE = mockPlayer({ id: 'p1', name: 'CPU Alice', handSize: 10, deckSize: 2, isBot: true, botDifficulty: 'easy' })
const BOB   = mockPlayer({ id: 'p2', name: 'CPU Bob',   handSize: 10, deckSize: 0, isBot: true, botDifficulty: 'medium' })
const CAROL = mockPlayer({ id: 'p3', name: 'CPU Carol', handSize: 10, deckSize: 3, isBot: true, botDifficulty: 'hard', folded: true })

const allPlayers = [ME, ALICE, BOB, CAROL]
const myCards: CardType[] = [
  c(4, 'diamonds'), c(7, 'clubs'), c(10, 'hearts'), c(10, 'diamonds'),
  c(9, 'clubs'), c(5, 'hearts'), c(3, 'diamonds'), c(7, 'spades'), c(7, 'diamonds'), c('K', 'hearts'),
]

function FourPlayerHarness({
  currentPlayerId = 'me',
  dealerId = 'me',
  topPlay = null as { cards: CardType[]; playerId: string } | null,
}: {
  currentPlayerId?: string
  dealerId?: string
  topPlay?: { cards: CardType[]; playerId: string } | null
}) {
  const [selected, setSelected] = useState<number[]>([])
  const ids = myCards.map((_, i) => `slot-${i}`)
  const selectedCards = selected.map(i => myCards[i])

  const baseState = mockState({
    players: allPlayers,
    currentPlayerId,
    dealerId,
    leadPlayerId: dealerId,
    myDeckSize: 3,
    turnPhase: currentPlayerId === 'me' ? 'discard' : 'play',
    scores: { me: 0, p1: 0, p2: 0, p3: 0 },
  })

  const state = topPlay
    ? (() => {
        const play = mockHandPlay(topPlay.cards, topPlay.playerId)
        return { ...baseState, currentHandPlays: [play], currentTopPlay: play.hand, currentTopPlayerId: topPlay.playerId }
      })()
    : baseState

  const actionBar = (
    <ActionBar
      state={state}
      myPlayerId="me"
      selected={selectedCards}
      onDiscard={() => console.log('discard')}
      onPlay={() => console.log('play')}
      onFold={() => console.log('fold')}
    />
  )

  const seatProps = (player: typeof ALICE) => ({
    player,
    isActive: player.id === currentPlayerId,
    isDealer: player.id === dealerId,
    presence: null,
    events: [],
    myPlayerId: 'me',
    allPlayers,
  })

  return (
    <LayoutGroup>
      <div style={feltStyle}>
        <div style={tableGridStyle}>
          <div style={{ gridArea: 'left', display: 'flex', justifyContent: 'flex-start', alignItems: 'flex-start' }}>
            <OpponentSeat {...seatProps(ALICE)} orientation="left" />
          </div>

          <div style={{ gridArea: 'top', display: 'flex', justifyContent: 'center' }}>
            <OpponentSeat {...seatProps(BOB)} orientation="across" />
          </div>

          <div style={{ gridArea: 'right', display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-start' }}>
            <OpponentSeat {...seatProps(CAROL)} orientation="right" />
          </div>

          <div style={{ gridArea: 'center', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <TableCenter state={state} myPlayerId="me" myLastPlaySlotIds={null} />
          </div>

          <div style={{ gridArea: 'bottom', paddingTop: 24 }}>
            <PlayerHand
              cards={myCards}
              ids={ids}
              selectedIndices={selected}
              onToggle={i =>
                setSelected(prev =>
                  prev.includes(i) ? prev.filter(x => x !== i) : prev.length < 5 ? [...prev, i] : prev
                )
              }
              onReorder={() => {}}
              onSortByRank={() => console.log('sort by rank')}
              onSortBySuit={() => console.log('sort by suit')}
              deckSize={3}
              discardingCards={[]}
              isDealer={dealerId === 'me'}
              actionSlot={actionBar}
            />
          </div>
        </div>
      </div>
    </LayoutGroup>
  )
}

export const FourPlayers: Story = {
  render: () => <FourPlayerHarness />,
  parameters: {
    docs: { description: { story: 'Real 4-player table layout — 3 opponents placed at left/top/right around the felt with the player hand spanning the bottom. This is the grid GameScreen uses whenever opponents.length === 3.' } },
  },
}

export const FourPlayersOpponentTurn: Story = {
  render: () => (
    <FourPlayerHarness
      currentPlayerId="p2"
      dealerId="p1"
      topPlay={{ cards: [c(8, 'hearts'), c(8, 'spades')], playerId: 'p1' }}
    />
  ),
  parameters: {
    docs: { description: { story: 'Bob is acting (active titlebar + hourglass), Alice holds the dealer badge and led the hand with a pair of 8s.' } },
  },
}

// ─── 3-player row (2 opponents — uses OpponentArea, not the grid) ────────────

export const ThreePlayers: Story = {
  render: () => {
    const players = [ME, ALICE, BOB]
    const state = mockState({
      players,
      currentPlayerId: 'me',
      dealerId: 'p1',
      leadPlayerId: 'p1',
      turnPhase: 'discard',
      myDeckSize: 5,
    })
    const ids = myCards.map((_, i) => `slot-${i}`)
    return (
      <LayoutGroup>
        <div style={feltStyle}>
          <OpponentArea
            opponents={[ALICE, BOB]}
            allPlayers={players}
            myPlayerId="me"
            currentPlayerId="me"
            dealerId="p1"
            presence={new Map()}
            events={[]}
          />
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <TableCenter state={state} myPlayerId="me" myLastPlaySlotIds={null} />
          </div>
          <div style={{ paddingTop: 24 }}>
            <PlayerHand
              cards={myCards}
              ids={ids}
              selectedIndices={[]}
              onToggle={() => {}}
              onReorder={() => {}}
              onSortByRank={() => {}}
              onSortBySuit={() => {}}
              deckSize={5}
              discardingCards={[]}
            />
          </div>
        </div>
      </LayoutGroup>
    )
  },
  parameters: {
    docs: { description: { story: '3-player game — `OpponentArea` puts both opponents in a single horizontal row across the top. The grid layout only kicks in at 4 players.' } },
  },
}
