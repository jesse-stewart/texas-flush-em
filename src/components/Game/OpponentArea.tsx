import { Frame } from '@react95/core'
import type { PlayerView } from '@shared/engine/state-machine'
import type { PlayerPresence } from '../../transport/presence'
import type { Card as CardType } from '@shared/engine/card'
import type { BotDifficulty, GameEvent } from '@shared/engine/game-state'
import { Card } from '../Card/Card'
import { Hand } from '../Hand/Hand'
import { EventBubble } from './EventBubble'

const DIFFICULTY_BADGE: Record<BotDifficulty, { label: string; bg: string; fg: string }> = {
  easy:   { label: 'Easy',   bg: '#000080', fg: '#fff' },
  medium: { label: 'Medium', bg: '#680068', fg: '#fff' },
  hard:   { label: 'Hard',   bg: '#a00000', fg: '#fff' },
}

interface OpponentAreaProps {
  opponents: PlayerView[]
  allPlayers: PlayerView[]
  myPlayerId: string
  currentPlayerId: string | null
  dealerId: string | null
  presence: Map<string, PlayerPresence>
  events: GameEvent[]
}

export function OpponentArea({ opponents, allPlayers, myPlayerId, currentPlayerId, dealerId, presence, events }: OpponentAreaProps) {
  if (opponents.length === 0) return null

  return (
    <div style={rowStyle}>
      {opponents.map(p => (
        <OpponentSeat
          key={p.id}
          player={p}
          isActive={p.id === currentPlayerId}
          isDealer={p.id === dealerId}
          presence={presence.get(p.id) ?? null}
          events={events}
          myPlayerId={myPlayerId}
          allPlayers={allPlayers}
        />
      ))}
    </div>
  )
}

const SUITS = ['clubs', 'diamonds', 'hearts', 'spades'] as const
const FAKE_CARDS: CardType[] = Array.from({ length: 52 }, (_, i) => ({
  rank: ((i % 13) + 2) as CardType['rank'],
  suit: SUITS[Math.floor(i / 13)],
}))

function OpponentSeat({
  player, isActive, isDealer, presence, events, myPlayerId, allPlayers,
}: {
  player: PlayerView
  isActive: boolean
  isDealer: boolean
  presence: PlayerPresence | null
  events: GameEvent[]
  myPlayerId: string
  allPlayers: PlayerView[]
}) {
  const handCount = player.handSize
  const deckCount = player.deckSize
  const deckLayers = Math.min(deckCount, 4)

  const handOrder: number[] =
    presence && presence.handOrder.length === handCount
      ? presence.handOrder
      : Array.from({ length: handCount }, (_, i) => i)

  const fakeCards = handOrder.map((_, i) => FAKE_CARDS[i % 52])
  const selectedIndices = presence?.selectedPositions ?? []

  const hasLeft = player.eliminated && !player.isBot && !player.isConnected

  return (
    <div style={{ ...seatStyle, opacity: hasLeft ? 0.5 : 1 }}>
      <EventBubble
        events={events}
        playerId={player.id}
        myPlayerId={myPlayerId}
        players={allPlayers}
        isCurrentTurn={isActive}
      />
      {/* Win95 nameplate — the activated state mimics a focused titlebar */}
      <Frame
        bgColor={isActive ? '$headerBackground' : '$material'}
        boxShadow="$out"
        px="$4"
        py="$1"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          color: isActive ? '#fff' : '#000',
          fontSize: 12,
        }}
      >
        <span style={{
          width: 8, height: 8,
          backgroundColor: player.isConnected ? '#0f0' : '#888',
          flexShrink: 0,
        }} />
        <span style={{ fontWeight: 700 }}>
          {player.name}
        </span>
        {hasLeft && <span style={{ opacity: 0.7 }}>· left</span>}
        {!hasLeft && player.eliminated && <span style={{ opacity: 0.7 }}>· out</span>}
        {!player.eliminated && player.folded && <span style={{ opacity: 0.7 }}>· folded</span>}
        {isDealer && <span style={dealerBadgeStyle} title="Dealer">D</span>}
        {player.isBot && player.botDifficulty && (
          <span style={{
            fontSize: 10,
            fontWeight: 700,
            padding: '0 5px',
            backgroundColor: DIFFICULTY_BADGE[player.botDifficulty].bg,
            color: DIFFICULTY_BADGE[player.botDifficulty].fg,
          }}>
            {DIFFICULTY_BADGE[player.botDifficulty].label}
          </span>
        )}
      </Frame>

      <div style={pilesStyle}>
        <div style={pileGroupStyle}>
          {handCount === 0 ? (
            <span style={emptyLabelStyle}>empty</span>
          ) : (
            <Hand
              cards={fakeCards}
              ids={handOrder.map(id => `${player.id}-${id}`)}
              selectedIndices={selectedIndices}
              onToggle={() => {}}
              disabled
              faceDown
              flip
            />
          )}
        </div>

        <div style={pileDividerStyle} />

        <div style={pileGroupStyle}>
          <div style={{ position: 'relative', width: 80 + deckLayers * 3, height: 112 + deckLayers * 3 }}>
            {deckCount === 0 ? (
              <div style={deckPlaceholderStyle}>
                <span style={emptyLabelStyle}>empty</span>
              </div>
            ) : (
              Array.from({ length: deckLayers }).map((_, i) => (
                <div key={i} style={{ position: 'absolute', left: i * 3, top: (deckLayers - 1 - i) * 3, zIndex: i }}>
                  <Card card={{ rank: 2, suit: 'clubs' }} faceDown />
                </div>
              ))
            )}
          </div>
          <span style={{ fontSize: 11, color: '#cfd6cf', fontWeight: 500 }}>{deckCount} in deck</span>
        </div>
      </div>
    </div>
  )
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  gap: 48,
  padding: '14px 24px 8px',
  flexShrink: 0,
}

const seatStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 6,
}

const dealerBadgeStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 16,
  height: 16,
  borderRadius: '50%',
  fontSize: 10,
  fontWeight: 700,
  color: '#000',
  backgroundColor: '#fde68a',
  border: '1px solid #000',
  flexShrink: 0,
}

const pilesStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 16,
}

const pileGroupStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 4,
}

const pileDividerStyle: React.CSSProperties = {
  width: 1,
  height: 40,
  backgroundColor: 'rgba(255,255,255,0.2)',
  alignSelf: 'center',
}

const emptyLabelStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#cfd6cf',
  fontStyle: 'italic',
}

const deckPlaceholderStyle: React.CSSProperties = {
  width: 80,
  height: 112,
  border: '2px dashed rgba(255,255,255,0.25)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}
