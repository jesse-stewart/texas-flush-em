import { Frame } from '@react95/core'
import { Hourglass } from 'react95'
import type { PlayerView } from '@shared/engine/state-machine'
import type { PlayerPresence } from '../../transport/presence'
import type { Card as CardType } from '@shared/engine/card'
import type { BotDifficulty, GameEvent } from '@shared/engine/game-state'
import { Card } from '../Card/Card'
import { Hand } from '../Hand/Hand'
import { EventBubble } from './EventBubble'
import { palette } from '../../palette'

const DIFFICULTY_BADGE: Record<BotDifficulty, { label: string; bg: string; fg: string }> = {
  easy:   { label: 'Easy',   bg: palette.navy,      fg: palette.white },
  medium: { label: 'Medium', bg: palette.botMedium, fg: palette.white },
  hard:   { label: 'Hard',   bg: palette.lose,      fg: palette.white },
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

  // Opponents shown at the top are always across the table from me, so flip
  // them 180° regardless of how many there are.
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
          orientation="across"
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

export function OpponentSeat({
  player, isActive, isDealer, presence, events, myPlayerId, allPlayers,
  orientation = 'horizontal',
}: {
  player: PlayerView
  isActive: boolean
  isDealer: boolean
  presence: PlayerPresence | null
  events: GameEvent[]
  myPlayerId: string
  allPlayers: PlayerView[]
  orientation?: 'horizontal' | 'across' | 'left' | 'right'
}) {
  const isVertical = orientation === 'left' || orientation === 'right'
  const isAcross = orientation === 'across'
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
          color: isActive ? palette.white : palette.black,
          fontSize: 12,
        }}
      >
        <span style={{
          width: 8, height: 8,
          backgroundColor: player.isConnected ? palette.lime : palette.midGray,
          flexShrink: 0,
        }} />
        <span style={{ fontWeight: 700 }}>
          {player.name}
        </span>
        {isActive && <Hourglass size={20} />}
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
        {player.isApi && (
          <span style={{ fontSize: 10, fontWeight: 700, padding: '0 5px', backgroundColor: palette.win, color: palette.white }}>
            API
          </span>
        )}
      </Frame>

      <div style={
        orientation === 'left' ? pilesVerticalLeftStyle :
        orientation === 'right' ? pilesVerticalRightStyle :
        pilesStyle
      }>
        <div style={pileGroupStyle}>
          {handCount === 0 ? (
            <span style={emptyLabelStyle}>empty</span>
          ) : isVertical ? (
            <VerticalCardStack count={handCount} direction={orientation as 'left' | 'right'} />
          ) : (
            // For 'across' the entire Hand is rotated 180° so each card visually
            // flips upside-down (matches an opponent across the table), while the
            // surrounding pile group / labels stay readable.
            <div style={isAcross ? { transform: 'rotate(180deg)' } : undefined}>
              <Hand
                cards={fakeCards}
                ids={handOrder.map(id => `${player.id}-${id}`)}
                selectedIndices={selectedIndices}
                onToggle={() => {}}
                disabled
                faceDown
                flip
              />
            </div>
          )}
        </div>

        <div style={isVertical ? pileDividerVerticalStyle : pileDividerStyle} />

        <div style={pileGroupStyle}>
          <div
            style={{
              position: 'relative',
              width: (isVertical ? 112 : 80) + deckLayers * 3,
              height: (isVertical ? 80 : 112) + deckLayers * 3,
            }}
          >
            {deckCount === 0 ? (
              <div style={isVertical ? deckPlaceholderVerticalStyle : deckPlaceholderStyle}>
                <span style={emptyLabelStyle}>empty</span>
              </div>
            ) : (
              Array.from({ length: deckLayers }).map((_, i) =>
                isVertical ? (
                  <div
                    key={i}
                    style={{
                      position: 'absolute',
                      top: i * 3,
                      left: (deckLayers - 1 - i) * 3,
                      width: 80,
                      height: 112,
                      transformOrigin: 'top left',
                      transform: orientation === 'left'
                        ? 'translateX(112px) rotate(90deg)'
                        : 'translateY(80px) rotate(-90deg)',
                      zIndex: i,
                    }}
                  >
                    <Card card={{ rank: 2, suit: 'clubs' }} faceDown />
                  </div>
                ) : (
                  <div
                    key={i}
                    style={{
                      position: 'absolute',
                      left: i * 3,
                      top: (deckLayers - 1 - i) * 3,
                      zIndex: i,
                      transform: isAcross ? 'rotate(180deg)' : undefined,
                    }}
                  >
                    <Card card={{ rank: 2, suit: 'clubs' }} faceDown />
                  </div>
                )
              )
            )}
          </div>
          <span style={{ fontSize: 11, color: palette.ltGray, fontWeight: 500 }}>{deckCount} in deck</span>
        </div>
      </div>
    </div>
  )
}

// Vertical face-down hand for side-seated opponents — each card is rotated 90deg
// and overlaps the next, stacking down the column. Rotation pivots at top-left;
// for 'left' we translate +H on X to bring the visual back into positive coords,
// for 'right' we rotate the opposite way and translate +W on Y.
function VerticalCardStack({ count, direction = 'left' }: { count: number; direction?: 'left' | 'right' }) {
  const STEP = 22
  const CARD_W = 80
  const CARD_H = 112
  return (
    <div style={{
      position: 'relative',
      width: CARD_H,
      height: (count - 1) * STEP + CARD_W,
    }}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            top: i * STEP,
            left: 0,
            width: CARD_W,
            height: CARD_H,
            transformOrigin: 'top left',
            transform: direction === 'left'
              ? `translateX(${CARD_H}px) rotate(90deg)`
              : `translateY(${CARD_W}px) rotate(-90deg)`,
            zIndex: i,
          }}
        >
          <Card card={{ rank: 2, suit: 'clubs' }} faceDown />
        </div>
      ))}
    </div>
  )
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'safe center',
  gap: 96,
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
  color: palette.black,
  backgroundColor: palette.dealerYellow,
  border: `1px solid ${palette.black}`,
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

const pilesVerticalLeftStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column-reverse',
  alignItems: 'center',
  gap: 12,
}

const pilesVerticalRightStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 12,
}

const pileDividerVerticalStyle: React.CSSProperties = {
  width: 40,
  height: 1,
  backgroundColor: 'rgba(255,255,255,0.2)',
  alignSelf: 'center',
}

const emptyLabelStyle: React.CSSProperties = {
  fontSize: 11,
  color: palette.ltGray,
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

const deckPlaceholderVerticalStyle: React.CSSProperties = {
  ...deckPlaceholderStyle,
  width: 112,
  height: 80,
}
