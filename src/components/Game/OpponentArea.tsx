import type { PlayerView } from '@shared/engine/state-machine'
import type { PlayerPresence } from '../../transport/presence'
import type { Card as CardType } from '@shared/engine/card'
import { Card } from '../Card/Card'
import { Hand } from '../Hand/Hand'

interface OpponentAreaProps {
  opponents: PlayerView[]
  currentPlayerId: string | null
  presence: Map<string, PlayerPresence>
}

export function OpponentArea({ opponents, currentPlayerId, presence }: OpponentAreaProps) {
  if (opponents.length === 0) return null

  return (
    <div style={styles.row}>
      {opponents.map(p => (
        <OpponentSeat
          key={p.id}
          player={p}
          isActive={p.id === currentPlayerId}
          presence={presence.get(p.id) ?? null}
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
  player, isActive, presence,
}: {
  player: PlayerView
  isActive: boolean
  presence: PlayerPresence | null
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

  return (
    <div style={styles.seat}>
      <div style={styles.nameRow}>
        <span style={{ ...styles.dot, backgroundColor: player.isConnected ? '#4ade80' : '#6b7280' }} />
        <span style={{ ...styles.name, color: isActive ? '#fde68a' : '#e5e7eb' }}>
          {player.name}
          {player.folded && <span style={styles.foldedTag}> · folded</span>}
        </span>
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
              <span style={styles.emptyLabel}>empty</span>
            ) : (
              Array.from({ length: deckLayers }).map((_, i) => (
                <div key={i} style={{ position: 'absolute', left: i * 3, top: (deckLayers - 1 - i) * 3, zIndex: i }}>
                  <Card card={{ rank: 2, suit: 'clubs' }} faceDown />
                </div>
              ))
            )}
          </div>
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
}
