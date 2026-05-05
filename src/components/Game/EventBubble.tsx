import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { GameEvent } from '@shared/engine/game-state'
import type { PlayerView } from '@shared/engine/state-machine'
import { formatEvent, latestEventForPlayer, type FormattedEvent } from './eventFormat'

const BUBBLE_TTL_MS = 3500

interface EventBubbleProps {
  events: GameEvent[]
  playerId: string
  myPlayerId: string
  players: PlayerView[]
  isCurrentTurn: boolean
}

export function EventBubble({ events, playerId, myPlayerId, players, isCurrentTurn }: EventBubbleProps) {
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
            style={{ ...bubbleStyle, ...toneStyle(content.tone) }}
          >
            {content.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Win95 chiseled-frame look: gray surface with raised border, except colored variants for tone.
function toneStyle(tone: FormattedEvent['tone']): React.CSSProperties {
  switch (tone) {
    case 'positive': return { backgroundColor: '#c0e0c0', color: '#003300', borderTop: '1px solid #fff', borderLeft: '1px solid #fff', borderRight: '1px solid #404040', borderBottom: '1px solid #404040' }
    case 'negative': return { backgroundColor: '#e0c0c0', color: '#330000', borderTop: '1px solid #fff', borderLeft: '1px solid #fff', borderRight: '1px solid #404040', borderBottom: '1px solid #404040' }
    case 'neutral':
    default: return { backgroundColor: '#c3c7cb', color: '#000', borderTop: '1px solid #fff', borderLeft: '1px solid #fff', borderRight: '1px solid #404040', borderBottom: '1px solid #404040' }
  }
}

const wrapStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  minHeight: 26,
  pointerEvents: 'none',
}

const bubbleStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  padding: '3px 10px',
  whiteSpace: 'nowrap',
}
