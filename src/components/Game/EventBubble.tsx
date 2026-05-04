import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { GameEvent } from '@shared/engine/game-state'
import type { PlayerView } from '@shared/engine/state-machine'
import { formatEvent, latestEventForPlayer, type FormattedEvent } from './eventFormat'

// How long any bubble (action or turn-start) sticks around before fading away.
const BUBBLE_TTL_MS = 3500

interface EventBubbleProps {
  events: GameEvent[]
  playerId: string
  myPlayerId: string
  players: PlayerView[]
  isCurrentTurn: boolean
}

export function EventBubble({ events, playerId, myPlayerId, players, isCurrentTurn }: EventBubbleProps) {
  // Force a single re-render when the active bubble hits its TTL so it can fade out.
  const [, tick] = useState(0)
  const lastEvent = latestEventForPlayer(events, playerId)

  // Capture the moment this player's turn began, so "their turn" / "Your turn"
  // shows briefly and then disappears (rather than persisting all turn long).
  const wasCurrentTurn = useRef(isCurrentTurn)
  const [turnStartedAt, setTurnStartedAt] = useState<number | null>(isCurrentTurn ? Date.now() : null)
  useEffect(() => {
    if (isCurrentTurn && !wasCurrentTurn.current) setTurnStartedAt(Date.now())
    wasCurrentTurn.current = isCurrentTurn
  }, [isCurrentTurn])

  // Schedule a single rerender at the next TTL boundary so the bubble fades on time.
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

  // Decide what (if anything) to show: whichever signal is freshest within TTL.
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

  // Stable key per "bubble episode" so AnimatePresence transitions when text changes.
  const key = content ? content.text : 'empty'

  return (
    <div style={styles.wrap} aria-live="polite">
      <AnimatePresence>
        {content && (
          <motion.div
            key={key}
            initial={{ opacity: 0, y: 6, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            style={{ ...styles.bubble, ...toneStyle(content.tone) }}
          >
            {content.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function toneStyle(tone: FormattedEvent['tone']): React.CSSProperties {
  switch (tone) {
    case 'positive': return { backgroundColor: 'rgba(22, 101, 52, 0.92)', color: '#bbf7d0', borderColor: 'rgba(74, 222, 128, 0.4)' }
    case 'negative': return { backgroundColor: 'rgba(127, 29, 29, 0.92)', color: '#fecaca', borderColor: 'rgba(248, 113, 113, 0.4)' }
    case 'neutral':
    default: return { backgroundColor: 'rgba(15, 23, 42, 0.92)', color: '#e5e7eb', borderColor: 'rgba(255, 255, 255, 0.12)' }
  }
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    display: 'flex',
    justifyContent: 'center',
    minHeight: 26,
    pointerEvents: 'none',
  },
  bubble: {
    fontSize: 12,
    fontWeight: 600,
    padding: '4px 12px',
    borderRadius: 12,
    border: '1px solid',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    whiteSpace: 'nowrap',
  },
}
