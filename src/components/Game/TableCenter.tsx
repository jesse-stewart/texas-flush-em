import { motion, AnimatePresence } from 'framer-motion'
import type { ClientGameState } from '@shared/engine/state-machine'
import type { HandPlay } from '@shared/engine/game-state'
import type { Card as CardType } from '@shared/engine/card'
import { HandCategory } from '@shared/engine/hand-eval'
import { Card } from '../Card/Card'

function cardLayoutId(card: CardType) {
  return `${card.rank}-${card.suit}`
}

const CARD_HEIGHT = 112
const STACK_OFFSET = CARD_HEIGHT * 0.1   // 10% per layer within a stack

function PlayStack({ plays, myPlayerId }: { plays: HandPlay[]; myPlayerId: string }) {
  if (plays.length === 0) return null
  const height = (plays.length - 1) * STACK_OFFSET + CARD_HEIGHT
  return (
    <div style={{ position: 'relative', height, minWidth: 80 }}>
      <AnimatePresence>
        {plays.map((play, i) => (
          <div
            key={play.hand.cards.map(c => cardLayoutId(c)).join('+')}
            style={{
              position: 'absolute',
              top: i * STACK_OFFSET,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: i + 1,
              display: 'flex',
              gap: 6,
            }}
          >
            {play.hand.cards.map((card, j) => (
              <motion.div
                key={j}
                layoutId={play.playerId === myPlayerId ? cardLayoutId(card) : undefined}
                initial={play.playerId === myPlayerId ? false : { y: -200 }}
                animate={{ y: 0 }}
                transition={{ type: 'spring', stiffness: 260, damping: 28 }}
              >
                <Card card={card} />
              </motion.div>
            ))}
          </div>
        ))}
      </AnimatePresence>
    </div>
  )
}

const CATEGORY_LABEL: Record<number, string> = {
  [HandCategory.HIGH_CARD]: 'High Card',
  [HandCategory.PAIR]: 'Pair',
  [HandCategory.FLUSH_PAIR]: 'Flush Pair',
  [HandCategory.TWO_PAIR]: 'Two Pair',
  [HandCategory.FLUSH_TWO_PAIR]: 'Flush Two Pair',
  [HandCategory.THREE_OF_A_KIND]: 'Three of a Kind',
  [HandCategory.FLUSH_THREE_OF_A_KIND]: 'Flush Three of a Kind',
  [HandCategory.STRAIGHT]: 'Straight',
  [HandCategory.FLUSH]: 'Flush',
  [HandCategory.FULL_HOUSE]: 'Full House',
  [HandCategory.FLUSH_FULL_HOUSE]: 'Flush Full House',
  [HandCategory.FOUR_OF_A_KIND]: 'Four of a Kind',
  [HandCategory.FLUSH_FOUR_OF_A_KIND]: 'Flush Four of a Kind',
  [HandCategory.STRAIGHT_FLUSH]: 'Straight Flush',
  [HandCategory.FIVE_OF_A_KIND]: 'Five of a Kind',
  [HandCategory.ROYAL_FLUSH]: 'Royal Flush',
}

interface TableCenterProps {
  state: ClientGameState
  myPlayerId: string
}

export function TableCenter({ state, myPlayerId }: TableCenterProps) {
  const currentPlayer = state.players.find(p => p.id === state.currentPlayerId)
  const topPlayer = state.players.find(p => p.id === state.currentTopPlayerId)
  const isMyTurn = state.currentPlayerId === myPlayerId

  return (
    <div style={styles.area}>
      {/* Turn indicator */}
      <div style={styles.turnBanner}>
        {isMyTurn
          ? <span style={styles.myTurnText}>Your turn — {state.turnPhase === 'discard' ? 'select cards to discard, or skip' : 'play a hand or fold'}</span>
          : <span style={styles.theirTurnText}>{currentPlayer?.name ?? '…'}&apos;s turn</span>
        }
      </div>

      {/* Play area + side pile */}
      <div style={styles.tableRow}>
        {/* Spacer to balance the right-side pile */}
        <div style={styles.sidePlaceholder} />

        {/* Play area — full hand history stacked */}
        <div style={styles.playArea}>
          {state.currentHandPlays.length === 0 ? (
            <div style={styles.emptyPlay}>
              <div style={styles.emptyCircle}>
                <span style={styles.emptyText}>Lead the hand</span>
              </div>
            </div>
          ) : (
            <>
              <div style={styles.playLabel}>
                <span style={styles.categoryName}>{CATEGORY_LABEL[state.currentTopPlay!.category]}</span>
                <span style={styles.playedBy}>by {topPlayer?.name ?? '?'}</span>
              </div>
              <PlayStack plays={state.currentHandPlays} myPlayerId={myPlayerId} />
            </>
          )}
        </div>


        {/* Middle pile — off to the right, stacked flat, face down */}
        <div style={styles.middlePileArea}>
          {state.middlePileCount > 0 && (
            <div style={styles.middlePileStack}>
              {Array.from({ length: Math.min(state.middlePileCount, 3) }, (_, i) => (
                <div key={i} style={{ ...styles.middlePileCard, top: i * 2, left: i * 2, zIndex: i }}>
                  <Card card={{ rank: 2, suit: 'clubs' }} faceDown />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  area: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '0 24px',
  },
  turnBanner: {
    padding: '8px 20px',
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.3)',
    textAlign: 'center',
  },
  myTurnText: {
    color: '#fde68a',
    fontSize: 14,
    fontWeight: 600,
  },
  theirTurnText: {
    color: '#d1d5db',
    fontSize: 14,
  },
  tableRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    justifyContent: 'space-between',
  },
  sidePlaceholder: {
    width: 86,  // same width as middlePileStack + offset
  },
  playArea: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    minHeight: 140,
    justifyContent: 'center',
  },
  playLabel: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 8,
  },
  categoryName: {
    color: '#fde68a',
    fontSize: 18,
    fontWeight: 700,
  },
  playedBy: {
    color: '#9ca3af',
    fontSize: 13,
  },
  cards: {
    display: 'flex',
    gap: 8,
    justifyContent: 'center',
  },
  emptyPlay: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCircle: {
    width: 160,
    height: 100,
    borderRadius: 12,
    border: '2px dashed rgba(255,255,255,0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 14,
    fontStyle: 'italic',
  },
  middlePileArea: {
    width: 86,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
  },
  middlePileStack: {
    position: 'relative',
    width: 80,
    height: 112,
  },
  middlePileCard: {
    position: 'absolute',
    top: 0,
    left: 0,
    transformOrigin: 'center bottom',
  },
  middlePileCount: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    fontStyle: 'italic',
  },
}
