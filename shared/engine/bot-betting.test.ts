// Regression coverage for chooseBettingAction. The shipped behavior used to chain
// pot-relative raises across a round, emptying every stack on the first hand when
// multiple bots held even moderately strong hands. These tests exercise the full
// betting round against the live state machine so any future change that re-introduces
// the chain — or violates min-bet / min-raise legality from a too-aggressive cap —
// shows up immediately.

import { describe, it, expect } from 'vitest'
import { applyCommand, initialState } from './state-machine'
import { chooseBettingAction } from './bot-betting'
import type { GameState, BotDifficulty } from './game-state'
import type { Card } from './card'

// Deterministic 5-card hand fixtures, picked so the strength bucket is unambiguous.
const STRAIGHT_5_TO_9: Card[] = [
  { rank: 5, suit: 'clubs' }, { rank: 6, suit: 'diamonds' },
  { rank: 7, suit: 'hearts' }, { rank: 8, suit: 'spades' }, { rank: 9, suit: 'clubs' },
]
const FLUSH_HEARTS: Card[] = [
  { rank: 2, suit: 'hearts' }, { rank: 5, suit: 'hearts' },
  { rank: 7, suit: 'hearts' }, { rank: 9, suit: 'hearts' }, { rank: 'J', suit: 'hearts' },
]
const FOUR_OF_A_KIND_KS: Card[] = [
  { rank: 'K', suit: 'clubs' }, { rank: 'K', suit: 'diamonds' },
  { rank: 'K', suit: 'hearts' }, { rank: 'K', suit: 'spades' }, { rank: 2, suit: 'clubs' },
]
const HIGH_CARD: Card[] = [
  { rank: 2, suit: 'clubs' }, { rank: 4, suit: 'diamonds' },
  { rank: 7, suit: 'hearts' }, { rank: 9, suit: 'spades' }, { rank: 'J', suit: 'clubs' },
]

function startedChipsGame(playerCount: number, opts: { ante?: number; threshold?: number } = {}): GameState {
  const ids = Array.from({ length: playerCount }, (_, i) => `p${i + 1}`)
  const seeded = ids.reduce(
    (s, id) => applyCommand(s, { type: 'ADD_PLAYER', playerId: id, playerName: id }),
    initialState(),
  )
  return applyCommand(seeded, {
    type: 'START_GAME',
    options: {
      scoringMode: 'chips',
      threshold: opts.threshold ?? 60,
      anteAmount: opts.ante ?? 5,
    },
  })
}

// Force every player's hand to the same fixture so chooseBettingAction has a
// deterministic strength input for every actor.
function withHand(state: GameState, hand: Card[]): GameState {
  return { ...state, players: state.players.map(p => ({ ...p, hand })) }
}

// Drive the betting round with the bot decision function until it closes.
function playBettingRound(state: GameState, difficulty: BotDifficulty = 'medium'): GameState {
  let s = state
  // Hard limit so a buggy bot can't loop forever.
  for (let i = 0; i < 50; i++) {
    if (s.turnPhase !== 'bet') break
    const actorId = s.playerOrder[s.currentPlayerIndex]
    const action = chooseBettingAction(s, actorId, difficulty)
    s = applyCommand(s, { type: action.type, playerId: actorId, ...('amount' in action ? { amount: action.amount } : {}) } as never)
  }
  return s
}

describe('chooseBettingAction — first-hand sanity', () => {
  it('does not chain raises to all-in when 4 bots all hold STRAIGHTs', () => {
    let s = startedChipsGame(4)
    s = withHand(s, STRAIGHT_5_TO_9)
    s = playBettingRound(s, 'medium')
    expect(s.turnPhase).toBe('discard')
    // Every player should still have most of their stack — STRAIGHT is below the
    // medium raiseStrength threshold, so the round should resolve at the ante level.
    for (const p of s.players) {
      expect(s.scores[p.id]).toBeGreaterThan(40)
    }
  })

  it('caps a single bet/raise at half the actor stack with a moderate-strength hand', () => {
    let s = startedChipsGame(4)
    s = withHand(s, FLUSH_HEARTS)  // strength 0.85 — meets medium raiseStrength
    s = playBettingRound(s, 'medium')
    expect(s.turnPhase).toBe('discard')
    // No actor should have been forced all-in by sizing alone — the cap protects
    // shallow stacks from compounding raises.
    for (const p of s.players) {
      expect(s.scores[p.id]).toBeGreaterThan(0)
      expect(p.allIn).toBe(false)
    }
  })

  it('lets monster-strength hands shove past the stack cap when the pot warrants it', () => {
    // Synthetic: a fat pot with a big standing bet, so the pot-relative formula
    // wants to commit more than the bot's full stack. Monsters (≥ SHOVE_STRENGTH)
    // should bypass the half-stack cap and shove; moderate hands shouldn't.
    let base = startedChipsGame(2, { ante: 5, threshold: 60 })
    const me = base.playerOrder[base.currentPlayerIndex]
    const opp = base.players.find(p => p.id !== me)!.id
    base = {
      ...base,
      pot: 200,
      betToMatch: 50,
      minRaise: 45,
      committed: { ...base.committed, [opp]: 50 },
      scores: { ...base.scores, [opp]: 5 },
    }

    // Monster: shoves all-in.
    const monster = withHand(base, FOUR_OF_A_KIND_KS)  // strength 0.97
    const monsterAction = chooseBettingAction(monster, me, 'medium')
    expect(monsterAction.type).toBe('RAISE')
    if (monsterAction.type === 'RAISE') {
      const myCommitted = monster.committed[me] ?? 0
      const myStack = monster.scores[me] ?? 0
      expect(monsterAction.amount).toBe(myCommitted + myStack)  // all-in
    }

    // Moderate strength: cap kicks in. Capped raise is below the legal min-raise
    // (which here is 50 + 45 = 95), so the bot falls through to CALL.
    const moderate = withHand(base, FLUSH_HEARTS)  // strength 0.85
    const moderateAction = chooseBettingAction(moderate, me, 'medium')
    expect(moderateAction.type).toBe('CALL')
  })

  it('checks with a weak hand instead of opening', () => {
    let s = startedChipsGame(4)
    s = withHand(s, HIGH_CARD)
    const action = chooseBettingAction(s, s.playerOrder[s.currentPlayerIndex], 'medium')
    expect(action.type).toBe('CHECK')
  })

  it('falls through to call when the stack cap would force a sub-min-raise', () => {
    // Construct: human just bet large; bot has a strong-but-not-monster hand and a
    // small stack. Cap forces target below the legal min-raise → bot calls instead.
    let s = startedChipsGame(2, { ante: 5, threshold: 60 })
    s = withHand(s, FLUSH_HEARTS)
    const human = s.playerOrder[s.currentPlayerIndex]
    s = applyCommand(s, { type: 'BET', playerId: human, amount: 30 })
    // Bot's stack at 55 cap*0.5 = 27. Min legal raise needs target >= 30 + minRaise (25) = 55.
    // 27 < 55 → bot must fall through to CALL (not RAISE, not FOLD).
    const botId = s.playerOrder[s.currentPlayerIndex]
    const action = chooseBettingAction(s, botId, 'medium')
    expect(action.type).toBe('CALL')
  })
})
