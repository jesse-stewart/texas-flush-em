import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { GameEvent } from '@shared/engine/game-state'
import type { PlayerView } from '@shared/engine/state-machine'
import { formatEvent, latestEventForPlayer, type FormattedEvent } from './eventFormat'
import { contract } from '@react95/core'
import { palette } from '../../palette'

const BUBBLE_TTL_MS = 3500

interface EventBubbleProps {
  events: GameEvent[]
  playerId: string
  myPlayerId: string
  players: PlayerView[]
  isCurrentTurn: boolean
  // Anchors the bubble within its slot. Use 'left'/'right' for side-seated
  // opponents so a long bubble grows toward the table center, not off-screen.
  align?: 'left' | 'center' | 'right'
}

export function EventBubble({ events, playerId, myPlayerId, players, isCurrentTurn, align = 'center' }: EventBubbleProps) {
  const [, tick] = useState(0)
  const lastEvent = latestEventForPlayer(events, playerId)

  const wasCurrentTurn = useRef(isCurrentTurn)
  const [turnStartedAt, setTurnStartedAt] = useState<number | null>(isCurrentTurn ? Date.now() : null)
  useEffect(() => {
    if (isCurrentTurn && !wasCurrentTurn.current) setTurnStartedAt(Date.now())
    wasCurrentTurn.current = isCurrentTurn
  }, [isCurrentTurn])

  const eventTs = lastEvent?.ts ?? 0
  const nextDeadline = Math.max(
    eventTs ? eventTs + BUBBLE_TTL_MS : 0,
    turnStartedAt ? turnStartedAt + BUBBLE_TTL_MS : 0,
  )
  useEffect(() => {
    if (!nextDeadline) return
    const ms = nextDeadline - Date.now()
    if (ms <= 0) return
    const id = setTimeout(() => tick(n => n + 1), ms + 30)
    return () => clearTimeout(id)
  }, [nextDeadline])

  const isMe = playerId === myPlayerId
  const now = Date.now()

  let content: FormattedEvent | null = null
  let contentTs = 0
  const eventFresh = lastEvent && now - lastEvent.ts < BUBBLE_TTL_MS
  if (eventFresh) {
    content = formatEvent(lastEvent!, players, myPlayerId)
    contentTs = lastEvent!.ts
  }
  const turnFresh = turnStartedAt && now - turnStartedAt < BUBBLE_TTL_MS
  if (turnFresh && (!content || turnStartedAt! > contentTs)) {
    const name = players.find(p => p.id === playerId)?.name ?? 'Their'
    content = { text: isMe ? 'Your turn' : `${name}'s turn`, tone: 'neutral' }
  }

  const key = content ? content.text : 'empty'
  const anchor = anchorStyle(align)

  return (
    <div style={wrapStyle} aria-live="polite">
      <AnimatePresence>
        {content && (
          <motion.div
            key={key}
            initial={{ opacity: 0, y: 6, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            style={{ ...bubbleStyle, ...anchor, ...toneStyle(content.tone) }}
          >
            {content.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Anchors the absolute-positioned bubble within its slot. Center uses
// left:50% + x:-50% (framer-motion's translateX) so y/scale animations compose.
// Left/right pin to the matching edge so a long bubble grows toward the table.
function anchorStyle(align: 'left' | 'center' | 'right'): Record<string, string | number> {
  switch (align) {
    case 'left':  return { left: 0 }
    case 'right': return { right: 0 }
    case 'center':
    default:      return { left: '50%', x: '-50%' }
  }
}

// Win95 chiseled-frame look: gray surface with raised border, except colored variants for tone.
function toneStyle(tone: FormattedEvent['tone']): React.CSSProperties {
  // Borders mimic Win95 raised-bevel: light top/left, dark bottom/right.
  // Top/left use white, bottom/right use vdkGray. Neutral surface matches
  // react95's `material` token so it sits flush with the surrounding frames.
  const lightBorder = `1px solid ${palette.white}`
  const darkBorder = `1px solid ${palette.vdkGray}`
  const bevel = { borderTop: lightBorder, borderLeft: lightBorder, borderRight: darkBorder, borderBottom: darkBorder }
  switch (tone) {
    case 'positive': return { backgroundColor: palette.bubblePosBg, color: palette.bubblePosText, ...bevel }
    case 'negative': return { backgroundColor: palette.bubbleNegBg, color: palette.bubbleNegText, ...bevel }
    case 'neutral':
    default: return { backgroundColor: contract.colors.material, color: palette.black, ...bevel }
  }
}

const wrapStyle: React.CSSProperties = {
  position: 'relative',
  height: 26,
  width: '100%',
  pointerEvents: 'none',
}

const bubbleStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  fontSize: 11,
  fontWeight: 700,
  padding: '3px 10px',
  whiteSpace: 'nowrap',
}
