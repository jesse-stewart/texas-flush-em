import { Frame } from '@react95/core'
import type { GameEvent } from '@shared/engine/game-state'
import type { PlayerView } from '@shared/engine/state-machine'
import { formatEvent } from './eventFormat'
import { palette } from '../../palette'

interface EventLogProps {
  events: GameEvent[]
  players: Pick<PlayerView, 'id' | 'name'>[]
  myPlayerId: string
}

export function EventLog({ events, players, myPlayerId }: EventLogProps) {
  if (!events || events.length === 0) return null

  const start = events[0].ts

  return (
    <Frame
      bgColor="$inputBackground"
      boxShadow="$in"
      p="$4"
      style={{ width: '100%', maxWidth: 520, margin: '0 auto' }}
    >
      <div style={{
        fontSize: 11,
        fontWeight: 700,
        color: palette.black,
        marginBottom: 6,
        paddingBottom: 4,
        borderBottom: `1px solid ${palette.midGray}`,
      }}>
        Game log
      </div>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        maxHeight: 220,
        overflowY: 'auto',
        fontSize: 12,
      }}>
        {events.map((e, i) => {
          const formatted = formatEvent(e, players, myPlayerId)
          if (!formatted) return null
          const isDivider = e.type === 'round_started' || e.type === 'game_started'
          return (
            <div key={i} style={isDivider ? dividerStyle : rowStyle}>
              <span style={{
                color: palette.dkGray,
                fontFamily: 'monospace',
                fontSize: 11,
                minWidth: 32,
                flexShrink: 0,
              }}>
                {relTime(e.ts - start)}
              </span>
              <span style={isDivider ? dividerTextStyle : { ...textStyle, ...toneColor(formatted.tone) }}>
                {formatted.text}
              </span>
            </div>
          )
        })}
      </div>
    </Frame>
  )
}

function relTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function toneColor(tone: 'neutral' | 'positive' | 'negative'): React.CSSProperties {
  switch (tone) {
    case 'positive': return { color: palette.win }
    case 'negative': return { color: palette.lose }
    default: return { color: palette.black }
  }
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  alignItems: 'baseline',
}

const dividerStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  alignItems: 'baseline',
  marginTop: 6,
  paddingTop: 4,
  borderTop: `1px solid ${palette.midGray}`,
}

const textStyle: React.CSSProperties = {
  fontWeight: 500,
}

const dividerTextStyle: React.CSSProperties = {
  fontWeight: 700,
  color: palette.navy,
  fontSize: 11,
}
