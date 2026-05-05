import type { GameEvent } from '@shared/engine/game-state'
import type { PlayerView } from '@shared/engine/state-machine'
import { handCategoryName } from '@shared/engine/hand-eval'

export type Tone = 'neutral' | 'positive' | 'negative'

export interface FormattedEvent {
  text: string
  tone: Tone
}

type NamedPlayer = Pick<PlayerView, 'id' | 'name'>

// Subject phrase from the perspective of the local player. "You" if it's me, else the player's name.
function subject(playerId: string, players: NamedPlayer[], myPlayerId: string): string {
  if (playerId === myPlayerId) return 'You'
  return players.find(p => p.id === playerId)?.name ?? '?'
}

// Returns null for events that don't make sense as a per-player bubble (game_started, etc.)
// The full review log handles those separately.
export function formatEvent(
  event: GameEvent,
  players: NamedPlayer[],
  myPlayerId: string,
): FormattedEvent | null {
  const isMe = (id: string) => id === myPlayerId

  switch (event.type) {
    case 'game_started':
      return { text: 'Game started', tone: 'neutral' }
    case 'round_started':
      return { text: 'Round started', tone: 'neutral' }
    case 'discarded': {
      const subj = subject(event.playerId, players, myPlayerId)
      const noun = event.count === 1 ? 'card' : 'cards'
      return { text: `${subj} discarded ${event.count} ${noun}`, tone: 'neutral' }
    }
    case 'played': {
      const subj = subject(event.playerId, players, myPlayerId)
      return { text: `${subj} played ${handCategoryName(event.category).toLowerCase()}`, tone: 'neutral' }
    }
    case 'folded':
      return { text: `${subject(event.playerId, players, myPlayerId)} folded`, tone: 'negative' }
    case 'hand_won':
      return { text: `${subject(event.playerId, players, myPlayerId)} won the hand`, tone: 'positive' }
    case 'round_won':
      return { text: `${subject(event.playerId, players, myPlayerId)} won the round`, tone: 'positive' }
    case 'eliminated':
      return {
        text: isMe(event.playerId) ? "You're eliminated" : `${subject(event.playerId, players, myPlayerId)} eliminated`,
        tone: 'negative',
      }
    case 'game_won':
      return {
        text: isMe(event.playerId) ? 'You won the game!' : `${subject(event.playerId, players, myPlayerId)} won the game!`,
        tone: 'positive',
      }
    case 'joined':
      return { text: `${subject(event.playerId, players, myPlayerId)} joined`, tone: 'neutral' }
    case 'left':
      return { text: `${subject(event.playerId, players, myPlayerId)} left`, tone: 'negative' }
  }
}

// Latest event for a specific player, scanning newest-first. Skips events with no playerId.
export function latestEventForPlayer(events: GameEvent[] | undefined, playerId: string): GameEvent | null {
  if (!events) return null
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i]
    if ('playerId' in e && e.playerId === playerId) return e
  }
  return null
}
