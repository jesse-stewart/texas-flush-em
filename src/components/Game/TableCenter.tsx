import { motion, AnimatePresence } from 'framer-motion'
import { Frame } from '@react95/core'
import type { ClientGameState } from '@shared/engine/state-machine'
import type { HandPlay } from '@shared/engine/game-state'
import { handCategoryName } from '@shared/engine/hand-eval'
import { Card } from '../Card/Card'
import { ChipStack } from '../Chips/ChipStack'
import { palette } from '../../palette'

const CARD_WIDTH = 71
const CARD_HEIGHT = 96
const CARD_GAP = 6
const STACK_OFFSET = CARD_HEIGHT * 0.1

interface PlayStackProps {
  plays: HandPlay[]
  myPlayerId: string
  myLastPlaySlotIds: number[] | null
}

function PlayStack({ plays, myPlayerId, myLastPlaySlotIds }: PlayStackProps) {
  if (plays.length === 0) return null
  const height = (plays.length - 1) * STACK_OFFSET + CARD_HEIGHT
  const maxCards = plays.reduce((m, p) => Math.max(m, p.hand.cards.length), 1)
  const width = maxCards * CARD_WIDTH + (maxCards - 1) * CARD_GAP
  const lastIndex = plays.length - 1
  return (
    <div style={{ position: 'relative', height, width, flexShrink: 0 }}>
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
                gap: CARD_GAP,
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
              Your turn - {
                state.turnPhase === 'bet' ? 'place a bet, call, or fold'
                : state.turnPhase === 'discard' ? 'select cards to discard, or skip'
                : 'play a hand or fold'
              }
            </span>
          : <span style={{ color: palette.black, fontSize: 12 }}>
              {currentPlayer?.name ?? '...'}&apos;s turn
            </span>
        }
      </Frame>

      {state.turnPhase === 'bet' && state.betToMatch > 0 && (
        <Frame bgColor="$material" boxShadow="$out" px="$4" py="$1" style={{ minWidth: 120, textAlign: 'center' }}>
          <span style={{ fontSize: 11, color: palette.vdkGray }}>to call ${state.betToMatch}</span>
        </Frame>
      )}

      <div style={tableRowStyle}>
        <div style={potAreaStyle}>
          {state.options.scoringMode === 'chips' && state.options.anteAmount > 0 && state.pot > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <ChipStack count={state.pot} />
              <span style={{ fontSize: 11, fontWeight: 700, color: palette.white, textShadow: '1px 1px 0 rgba(0,0,0,0.6)' }}>
                Pot ${state.pot}
              </span>
            </div>
          )}
        </div>

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
                  {handCategoryName(state.currentTopPlay!.category)}
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

const potAreaStyle: React.CSSProperties = {
  width: 86,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'flex-end',
  minHeight: 140,
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
