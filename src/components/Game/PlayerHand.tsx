import { motion } from 'framer-motion'
import type { Card as CardType } from '@shared/engine/card'
import { Card } from '../Card/Card'
import { Hand } from '../Hand/Hand'

interface DiscardingSlot { id: number; card: CardType }

interface PlayerHandProps {
  cards: CardType[]               // display order (managed by parent)
  ids: string[]                   // stable per-instance IDs; one per `cards` entry
  selectedIndices: number[]
  onToggle: (index: number) => void
  onReorder: (newOrder: CardType[]) => void
  onSortByRank: () => void
  onSortBySuit: () => void
  disabled: boolean
  deckSize: number
  discardingCards: DiscardingSlot[]   // FLIP source IDs must match `ids` so motion can animate
  isDealer?: boolean
}

export function PlayerHand({
  cards, ids, selectedIndices, onToggle, onReorder, onSortByRank, onSortBySuit, disabled, deckSize, discardingCards, isDealer,
}: PlayerHandProps) {
  return (
    <div style={styles.container}>
      <div style={styles.toolbar}>
        <div style={styles.meta}>
          <span style={styles.metaLabel}>hand</span>
          <span style={styles.metaValue}>{cards.length}</span>
          <span style={styles.metaSep}>·</span>
          <span style={styles.metaLabel}>deck</span>
          <span style={styles.metaValue}>{deckSize}</span>
          {isDealer && <span style={styles.dealerBadge} title="You are the dealer this round">D</span>}
        </div>
        <div style={styles.sortBtns}>
          <button style={styles.sortBtn} onClick={onSortByRank}>Sort by rank</button>
          <button style={styles.sortBtn} onClick={onSortBySuit}>Sort by suit</button>
        </div>
      </div>

      <div style={styles.cardRow}>
        <DeckStack count={deckSize} discardingCards={discardingCards} />
        <Hand
          overlap={24}
          cards={cards}
          ids={ids}
          selectedIndices={selectedIndices}
          onToggle={onToggle}
          onReorder={onReorder}
          disabled={disabled}
        />
      </div>
    </div>
  )
}

function DeckStack({ count, discardingCards }: { count: number; discardingCards: DiscardingSlot[] }) {
  const layers = Math.min(count, 6)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0, alignSelf: 'flex-end', paddingBottom: 4 }}>
      <div style={{ position: 'relative', width: 80 + layers * 3, height: 112 + layers * 3 }}>
        {count === 0 ? (
          <div style={{
            width: 80, height: 112, borderRadius: 8,
            border: '2px dashed rgba(255,255,255,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 11, color: '#4b5563' }}>empty</span>
          </div>
        ) : (
          Array.from({ length: layers }).map((_, i) => (
            <div key={i} style={{
              position: 'absolute',
              left: i * 3,
              top: (layers - 1 - i) * 3,
              zIndex: i,
            }}>
              <Card card={{ rank: 2, suit: 'clubs' }} faceDown />
            </div>
          ))
        )}

        {/* FLIP targets: discarded cards arrive here from their hand position.
            layoutId must match the per-instance slot id used by Hand's SortableCard. */}
        {discardingCards.map((slot, i) => (
          <motion.div
            key={slot.id}
            layoutId={`slot-${slot.id}`}
            style={{ position: 'absolute', top: 0, left: 0, zIndex: 200 + i }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <Card card={slot.card} />
          </motion.div>
        ))}
      </div>
      <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 500 }}>{count} in deck</span>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '10px 16px 20px',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderTop: '1px solid rgba(255,255,255,0.06)',
    flexShrink: 0,
  },
  toolbar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: '10px 16px 20px',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'space-between',
  },
  meta: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  metaLabel: {
    fontSize: 11,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  metaValue: {
    fontSize: 13,
    color: '#d1d5db',
    fontWeight: 600,
  },
  metaSep: {
    color: '#4b5563',
    fontSize: 13,
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
    marginLeft: 4,
  },
  sortBtns: {
    display: 'flex',
    gap: 6,
  },
  sortBtn: {
    padding: '4px 10px',
    fontSize: 12,
    fontWeight: 600,
    borderRadius: 6,
    border: '1px solid rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.07)',
    color: '#d1d5db',
    cursor: 'pointer',
  },
  cardRow: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    overflow: 'visible',
    gap: 12,
  },
}
