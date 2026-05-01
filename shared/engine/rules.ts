import type { Card } from './card'
import type { GameState } from './game-state'
import { getPlayerById } from './game-state'
import { evaluateHand, beats } from './hand-eval'

export type RuleViolation =
  | 'NOT_YOUR_TURN'
  | 'ALREADY_FOLDED'
  | 'INVALID_HAND'
  | 'MUST_BEAT_CURRENT_PLAY'
  | 'CARDS_NOT_IN_HAND'
  | 'TOO_MANY_DISCARDS'

export type ActionResult =
  | { ok: true }
  | { ok: false; violation: RuleViolation }

function playerOwnsCards(player: { hand: Card[] }, cards: Card[]): boolean {
  const handCopy = [...player.hand]
  for (const card of cards) {
    const idx = handCopy.findIndex(c => c.rank === card.rank && c.suit === card.suit)
    if (idx === -1) return false
    handCopy.splice(idx, 1)
  }
  return true
}

export function validatePlay(state: GameState, playerId: string, cards: Card[]): ActionResult {
  if (state.playerOrder[state.currentPlayerIndex] !== playerId) {
    return { ok: false, violation: 'NOT_YOUR_TURN' }
  }

  const player = getPlayerById(state, playerId)
  if (!player) return { ok: false, violation: 'NOT_YOUR_TURN' }
  if (player.folded) return { ok: false, violation: 'ALREADY_FOLDED' }
  if (!playerOwnsCards(player, cards)) return { ok: false, violation: 'CARDS_NOT_IN_HAND' }

  const hand = evaluateHand(cards)
  if (!hand) return { ok: false, violation: 'INVALID_HAND' }

  if (state.currentTopPlay !== null && !beats(hand, state.currentTopPlay)) {
    return { ok: false, violation: 'MUST_BEAT_CURRENT_PLAY' }
  }

  return { ok: true }
}

export function validateDiscard(state: GameState, playerId: string, cards: Card[]): ActionResult {
  if (state.playerOrder[state.currentPlayerIndex] !== playerId) {
    return { ok: false, violation: 'NOT_YOUR_TURN' }
  }
  if (cards.length > 5) return { ok: false, violation: 'TOO_MANY_DISCARDS' }

  const player = getPlayerById(state, playerId)
  if (!player) return { ok: false, violation: 'NOT_YOUR_TURN' }
  if (!playerOwnsCards(player, cards)) return { ok: false, violation: 'CARDS_NOT_IN_HAND' }

  return { ok: true }
}

// Score a finished round: cards remaining in hand (not deck), capped at 10
// Already-eliminated players are skipped (score 0) to prevent chips going negative
export function scoreRound(state: GameState, winnerId: string): Record<string, number> {
  const delta: Record<string, number> = {}
  for (const player of state.players) {
    if (player.eliminated) { delta[player.id] = 0; continue }
    delta[player.id] = player.id === winnerId ? 0 : Math.min(player.hand.length, 10)
  }
  return delta
}
