import { Frame } from '@react95/core'
import { Hourglass } from 'react95'
import type { PlayerView } from '@shared/engine/state-machine'
import type { PlayerPresence } from '../../transport/presence'
import type { Card as CardType } from '@shared/engine/card'
import type { BotDifficulty, GameEvent } from '@shared/engine/game-state'
import { Card } from '../Card/Card'
import { CardStack } from '../Card/CardStack'
import { Hand } from '../Hand/Hand'
import { ChipStack } from '../Chips/ChipStack'
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
  chipCounts?: Record<string, number>
  stagedBets?: Record<string, number>
}

export function OpponentArea({ opponents, allPlayers, myPlayerId, currentPlayerId, dealerId, presence, events, chipCounts, stagedBets }: OpponentAreaProps) {
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
          chipCount={chipCounts?.[p.id] ?? null}
          pendingBet={stagedBets?.[p.id] ?? 0}
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

// Width that holds a full 10-card opponent hand. Card width 71 + 9 gaps of 22
// (CARD_STEP from Hand.tsx). Reserved as a fixed slot so playing/discarding
// doesn't shrink the seat and shift the row.
const HAND_SLOT_WIDTH = 71 + 9 * 22

export function OpponentSeat({
  player, isActive, isDealer, presence, events, myPlayerId, allPlayers,
  orientation = 'horizontal', chipCount, pendingBet = 0,
}: {
  player: PlayerView
  isActive: boolean
  isDealer: boolean
  presence: PlayerPresence | null
  events: GameEvent[]
  myPlayerId: string
  allPlayers: PlayerView[]
  orientation?: 'horizontal' | 'across' | 'left' | 'right'
  chipCount?: number | null
  pendingBet?: number
}) {
  const isVertical = orientation === 'left' || orientation === 'right'
  const isAcross = orientation === 'across'
  // Top and bottom seats both rotate the Hand 180° so its `paddingTop: 60`
  // (reserved for the player's own lift-up animation) becomes bottom padding,
  // letting the cards top-align with the chip stack and deck. Selected cards
  // also visually lift toward the table center as a side effect.
  const flipHand = isAcross || orientation === 'horizontal'
  const handCount = player.handSize
  const deckCount = player.deckSize

  const handOrder: number[] =
    presence && presence.handOrder.length === handCount
      ? presence.handOrder
      : Array.from({ length: handCount }, (_, i) => i)

  const fakeCards = handOrder.map((_, i) => FAKE_CARDS[i % 52])
  const selectedIndices = presence?.selectedPositions ?? []

  const hasLeft = player.eliminated && !player.isBot && !player.isConnected
  const statusText = hasLeft ? 'left' : player.eliminated ? 'out' : player.folded ? 'folded' : ''

  return (
    <div style={{ ...seatStyle, opacity: hasLeft ? 0.5 : 1 }}>
      <EventBubble
        events={events}
        playerId={player.id}
        myPlayerId={myPlayerId}
        players={allPlayers}
        isCurrentTurn={isActive}
        align={orientation === 'left' ? 'left' : orientation === 'right' ? 'right' : 'center'}
      />
      {/* Win95 nameplate — the activated state mimics a focused titlebar.
          Hourglass and dealer badge live in fixed-size slots so toggling them
          (active player rotates each turn, dealer rotates each hand) doesn't
          change the nameplate's width and shift the row. */}
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
        <span>
          {player.name}
        </span>
        <span style={hourglassSlotStyle}>
          {isActive && <Hourglass size={20} />}
        </span>
        <span style={dealerSlotStyle}>
          {isDealer && <span style={dealerBadgeStyle} title="Dealer">D</span>}
        </span>
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
      <div style={statusCaptionStyle}>{statusText}</div>

      <div style={
        orientation === 'left' ? pilesVerticalLeftStyle :
        orientation === 'right' ? pilesVerticalRightStyle :
        // Bottom seat mirrors the top seat — chips, deck, hand left to right —
        // so the spectator sees a symmetric table.
        orientation === 'horizontal' ? { ...pilesStyle, flexDirection: 'row-reverse' } :
        pilesStyle
      }>
        {/* Hand slot reserves max width (10 cards) so the seat — and the row — don't
            shift as cards are played. Vertical orientations keep their natural width;
            VerticalCardStack drives that. */}
        <div style={isVertical ? pileGroupStyle : { ...pileGroupStyle, width: HAND_SLOT_WIDTH }}>
          {handCount === 0 ? (
            <span style={emptyLabelStyle}>empty</span>
          ) : isVertical ? (
            <VerticalCardStack count={handCount} direction={orientation as 'left' | 'right'} selectedIndices={selectedIndices} />
          ) : (
            // For 'across' and 'horizontal' the entire Hand is rotated 180°.
            // 'across' makes opponent cards visually face away from the spectator;
            // 'horizontal' (bottom seat) reuses the rotation to convert the Hand's
            // top-padding (reserved for lift animations) into bottom padding so
            // the cards top-align with the chip stack and deck.
            <div style={flipHand ? { transform: 'rotate(180deg)' } : undefined}>
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
          <CardStack
            count={deckCount}
            rotation={
              orientation === 'left' ? 90
              : orientation === 'right' ? -90
              : isAcross ? 180
              : 0
            }
            showEmpty
          />
          <span style={{ fontSize: 11, color: palette.ltGray, fontWeight: 500 }}>{deckCount} in deck</span>
        </div>

        {chipCount != null && (
          // Wrapper is `position: relative` so the staged-bet pile can float
          // off to the side without widening the seat (which would push the
          // chip stack off-center the moment betting starts).
          <div style={{ ...pileGroupStyle, position: 'relative' }}>
            <ChipStack count={chipCount} playerName={player.name} />
            {pendingBet > 0 && (
              <div style={{
                position: 'absolute',
                ...(orientation === 'right'
                  ? { right: '100%', bottom: 0, transform: 'translateX(-12px)' }
                  : orientation === 'horizontal'
                  ? { bottom: '100%', left: '50%', transform: 'translate(-50%, -12px)' }
                  : { left: '100%',  bottom: 0, transform: 'translateX(12px)' }),
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
              }}>
                <ChipStack count={pendingBet} />
                <span style={{ fontSize: 11, fontWeight: 700, color: palette.white, textShadow: '1px 1px 0 rgba(0,0,0,0.6)', marginTop: -3, whiteSpace: 'nowrap' }}>
                  betting ${pendingBet}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// Vertical face-down hand for side-seated opponents — each card is rotated 90deg
// and overlaps the next, stacking down the column. Rotation pivots at top-left;
// for 'left' we translate +H on X to bring the visual back into positive coords,
// for 'right' we rotate the opposite way and translate +W on Y.
// Selected cards lift toward the table center (right for left-seat, left for
// right-seat). The container reserves LIFT pixels of slack on the table-center
// side so the slide-out doesn't get clipped.
function VerticalCardStack({ count, direction = 'left', selectedIndices = [] }: { count: number; direction?: 'left' | 'right'; selectedIndices?: number[] }) {
  const STEP = 22
  const CARD_W = 71
  const CARD_H = 96
  const LIFT = 14
  const selectedSet = new Set(selectedIndices)
  return (
    <div style={{
      position: 'relative',
      width: CARD_H + LIFT,
      height: (count - 1) * STEP + CARD_W,
    }}>
      {Array.from({ length: count }).map((_, i) => {
        const lifted = selectedSet.has(i) ? LIFT : 0
        // For 'right' the cards rest offset by LIFT on the X axis so a leftward
        // lift (toward the table center) stays inside the container.
        const transform = direction === 'left'
          ? `translateX(${CARD_H + lifted}px) rotate(90deg)`
          : `translateX(${LIFT - lifted}px) translateY(${CARD_W}px) rotate(-90deg)`
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: i * STEP,
              left: 0,
              width: CARD_W,
              height: CARD_H,
              transformOrigin: 'top left',
              transform,
              transition: 'transform 120ms',
              zIndex: i,
            }}
          >
            <Card card={{ rank: 2, suit: 'clubs' }} faceDown />
          </div>
        )
      })}
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

// Fixed-size slots reserve room for the hourglass / dealer badge so toggling
// them mid-game doesn't change the nameplate's width and shift the row.
const hourglassSlotStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 20,
  height: 20,
  flexShrink: 0,
}

const dealerSlotStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 18,
  height: 18,
  flexShrink: 0,
}

// Reserved-height status caption beneath the nameplate. Folded/out/left text
// lives here instead of inside the nameplate so it can't change width.
const statusCaptionStyle: React.CSSProperties = {
  height: 14,
  fontSize: 11,
  fontStyle: 'italic',
  color: palette.ltGray,
  opacity: 0.7,
  lineHeight: '14px',
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

