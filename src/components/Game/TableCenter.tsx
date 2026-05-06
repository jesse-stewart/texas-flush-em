import { motion, AnimatePresence } from 'framer-motion'
import { Frame } from '@react95/core'
import type { ClientGameState } from '@shared/engine/state-machine'
import type { HandPlay } from '@shared/engine/game-state'
import { HandCategory } from '@shared/engine/hand-eval'
import { Card } from '../Card/Card'
import { palette } from '../../palette'

const CARD_HEIGHT = 96
const STACK_OFFSET = CARD_HEIGHT * 0.1

interface PlayStackProps {
  plays: HandPlay[]
  myPlayerId: string
  myLastPlaySlotIds: number[] | null
}

function PlayStack({ plays, myPlayerId, myLastPlaySlotIds }: PlayStackProps) {
  if (plays.length === 0) return null
  const height = (plays.length - 1) * STACK_OFFSET + CARD_HEIGHT
  const lastIndex = plays.length - 1
  return (
    <div style={{ position: 'relative', height, minWidth: 71 }}>
      <AnimatePresence>
        {plays.map((play, i) => {
          const useFlip = i === lastIndex && play.playerId === myPlayerId && myLastPlaySlotIds
          return (
            <div
              key={i}
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
                  layoutId={useFlip ? `slot-${myLastPlaySlotIds![j]}` : undefined}
                  initial={useFlip ? false : { y: -200 }}
                  animate={{ y: 0 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 28 }}
                >
                  <Card card={card} />
                </motion.div>
              ))}
            </div>
          )
        })}
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
  myLastPlaySlotIds: number[] | null
}

export function TableCenter({ state, myPlayerId, myLastPlaySlotIds }: TableCenterProps) {
  const currentPlayer = state.players.find(p => p.id === state.currentPlayerId)
  const topPlayer = state.players.find(p => p.id === state.currentTopPlayerId)
  const isMyTurn = state.currentPlayerId === myPlayerId

  return (
    <div style={areaStyle}>
      {/* Turn indicator — Win95 status panel */}
      <Frame
        bgColor="$material"
        boxShadow="$in"
        px="$6"
        py="$1"
        style={{ textAlign: 'center', minWidth: 280 }}
      >
        {isMyTurn
          ? <span style={{ color: palette.lose, fontSize: 12, fontWeight: 700 }}>
              Your turn - {state.turnPhase === 'discard' ? 'select cards to discard, or skip' : 'play a hand or fold'}
            </span>
          : <span style={{ color: palette.black, fontSize: 12 }}>
              {currentPlayer?.name ?? '...'}&apos;s turn
            </span>
        }
      </Frame>

      <div style={tableRowStyle}>
        <div style={sidePlaceholderStyle} />

        <div style={playAreaStyle}>
          {state.currentHandPlays.length === 0 ? (
            <div style={emptyPlayStyle}>
              <div style={emptyCircleStyle}>
                <span style={{ color: palette.ltGray, fontSize: 14, fontStyle: 'italic' }}>
                  Lead the hand
                </span>
              </div>
            </div>
          ) : (
            <>
              <Frame
                bgColor="$material"
                boxShadow="$out"
                px="$4"
                py="$1"
                style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}
              >
                <span style={{ color: palette.black, fontSize: 13, fontWeight: 700 }}>
                  {CATEGORY_LABEL[state.currentTopPlay!.category]}
                </span>
                <span style={{ color: palette.vdkGray, fontSize: 11 }}>by {topPlayer?.name ?? '?'}</span>
              </Frame>
              <PlayStack plays={state.currentHandPlays} myPlayerId={myPlayerId} myLastPlaySlotIds={myLastPlaySlotIds} />
            </>
          )}
        </div>

        <div style={middlePileAreaStyle}>
          {state.middlePileCount > 0 && (
            <div style={middlePileStackStyle}>
              {Array.from({ length: Math.min(state.middlePileCount, 3) }, (_, i) => (
                <div key={i} style={{ position: 'absolute', top: i * 2, left: i * 2, zIndex: i }}>
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

const areaStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  padding: '0 24px',
}

const tableRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  width: '100%',
  justifyContent: 'space-between',
}

const sidePlaceholderStyle: React.CSSProperties = {
  width: 86,
}

const playAreaStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 8,
  minHeight: 140,
  justifyContent: 'center',
}

const emptyPlayStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const emptyCircleStyle: React.CSSProperties = {
  width: 160,
  height: 100,
  border: '2px dashed rgba(255,255,255,0.25)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const middlePileAreaStyle: React.CSSProperties = {
  width: 86,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 8,
}

const middlePileStackStyle: React.CSSProperties = {
  position: 'relative',
  width: 71,
  height: 96,
}
