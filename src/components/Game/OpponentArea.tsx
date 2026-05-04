import type { PlayerView } from '@shared/engine/state-machine'
import type { PlayerPresence } from '../../transport/presence'
import type { Card as CardType } from '@shared/engine/card'
import type { BotDifficulty, GameEvent } from '@shared/engine/game-state'
import { Card } from '../Card/Card'
import { Hand } from '../Hand/Hand'
import { EventBubble } from './EventBubble'

// Color-coded by strength so the table at a glance shows who's the threat.
const DIFFICULTY_BADGE: Record<BotDifficulty, { label: string; bg: string; fg: string }> = {
  easy:   { label: 'Easy',   bg: 'rgba(96, 165, 250, 0.18)', fg: '#93c5fd' },
  medium: { label: 'Medium', bg: 'rgba(167, 139, 250, 0.18)', fg: '#c4b5fd' },
  hard:   { label: 'Hard',   bg: 'rgba(248, 113, 113, 0.20)', fg: '#fca5a5' },
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
    <div style={styles.row}>
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

// Pre-generated unique fake cards for face-down opponent hands (slot ID → unique card)
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

  // Build display slots from presence if available and count matches, else default order
  const handOrder: number[] =
    presence && presence.handOrder.length === handCount
      ? presence.handOrder
      : Array.from({ length: handCount }, (_, i) => i)

  // Map slot IDs → unique fake cards; presence carries the selected positions directly
  const fakeCards = handOrder.map((_, i) => FAKE_CARDS[i % 52])
  const selectedIndices = presence?.selectedPositions ?? []

  // A human who left mid-game is eliminated + disconnected; eliminated-by-score humans stay connected.
  const hasLeft = player.eliminated && !player.isBot && !player.isConnected

  return (
    <div style={{ ...styles.seat, opacity: hasLeft ? 0.5 : 1 }}>
      <EventBubble
        events={events}
        playerId={player.id}
        myPlayerId={myPlayerId}
        players={allPlayers}
        isCurrentTurn={isActive}
      />
      <div style={styles.nameRow}>
        <span style={{ ...styles.dot, backgroundColor: player.isConnected ? '#4ade80' : '#6b7280' }} />
        <span style={{ ...styles.name, color: isActive ? '#fde68a' : '#e5e7eb' }}>
          {player.name}
          {hasLeft && <span style={styles.foldedTag}> · left</span>}
          {!hasLeft && player.eliminated && <span style={styles.foldedTag}> · out</span>}
          {!player.eliminated && player.folded && <span style={styles.foldedTag}> · folded</span>}
        </span>
        {isDealer && <span style={styles.dealerBadge} title="Dealer">D</span>}
        {player.isBot && player.botDifficulty && (
          <span
            style={{
              ...styles.difficultyBadge,
              backgroundColor: DIFFICULTY_BADGE[player.botDifficulty].bg,
              color: DIFFICULTY_BADGE[player.botDifficulty].fg,
            }}
          >
            {DIFFICULTY_BADGE[player.botDifficulty].label}
          </span>
        )}
      </div>

      <div style={styles.piles}>
        <div style={styles.pileGroup}>
          {handCount === 0 ? (
            <span style={styles.emptyLabel}>empty</span>
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

        <div style={styles.pileDivider} />

        {/* Deck: stacked pile with count */}
        <div style={styles.pileGroup}>
          <div style={{ position: 'relative', width: 80 + deckLayers * 3, height: 112 + deckLayers * 3 }}>
            {deckCount === 0 ? (
              <div style={styles.deckPlaceholder}>
                <span style={styles.emptyLabel}>empty</span>
              </div>
            ) : (
              Array.from({ length: deckLayers }).map((_, i) => (
                <div key={i} style={{ position: 'absolute', left: i * 3, top: (deckLayers - 1 - i) * 3, zIndex: i }}>
                  <Card card={{ rank: 2, suit: 'clubs' }} faceDown />
                </div>
              ))
            )}
          </div>
          <span style={styles.deckCount}>{deckCount} in deck</span>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  row: {
    display: 'flex',
    justifyContent: 'center',
    gap: 48,
    padding: '14px 24px 8px',
    flexShrink: 0,
  },
  seat: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
  },
  nameRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    flexShrink: 0,
  },
  name: {
    fontSize: 14,
    fontWeight: 600,
  },
  foldedTag: {
    fontSize: 12,
    fontWeight: 400,
    color: '#9ca3af',
  },
  difficultyBadge: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.05em',
    padding: '2px 6px',
    borderRadius: 4,
  },
  dealerBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 18,
    height: 18,
    borderRadius: '50%',
    fontSize: 10,
    fontWeight: 700,
    color: '#1f2937',
    backgroundColor: '#fde68a',
    flexShrink: 0,
  },
  piles: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 16,
  },
  pileGroup: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
  },
  pileDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignSelf: 'center',
  },
  emptyLabel: {
    fontSize: 11,
    color: '#4b5563',
    fontStyle: 'italic',
  },
  deckPlaceholder: {
    width: 80,
    height: 112,
    borderRadius: 8,
    border: '2px dashed rgba(255,255,255,0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deckCount: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: 500,
  },
}
