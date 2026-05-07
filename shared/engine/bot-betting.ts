// ============================================================
// Heuristic betting layer for the in-process bot. Runs during turnPhase === 'bet'.
// ISMCTS handles play decisions; betting is fast and pot-odds based, with a
// difficulty-tuned aggression knob.
//
// Approach:
//   1. Estimate hand strength as (best playable category index / max category index).
//      The bot's current hand maps to a value in [0, 1].
//   2. Pot odds: required call ÷ (pot + required call). Call when strength > pot odds × aggression.
//   3. Sometimes raise when strength is high; rarely bluff (hard only).
// ============================================================

import type { GameState, BotDifficulty } from './game-state'
import { generatePlays } from './bot-moves'
import { HandCategory } from './hand-eval'

export type BettingAction =
  | { type: 'CHECK' }
  | { type: 'CALL' }
  | { type: 'BET'; amount: number }
  | { type: 'RAISE'; amount: number }
  | { type: 'FOLD' }

interface DifficultyKnobs {
  // Multiplier applied to pot odds when deciding whether to call. <1 = looser, >1 = tighter.
  callTightness: number
  // Strength threshold above which the bot raises instead of just calling.
  raiseStrength: number
  // Probability of bluff-raising with a weak hand. Hard mode only.
  bluffProb: number
}

const KNOBS: Record<BotDifficulty, DifficultyKnobs> = {
  easy:   { callTightness: 0.7, raiseStrength: 0.85, bluffProb: 0 },
  medium: { callTightness: 1.0, raiseStrength: 0.65, bluffProb: 0 },
  hard:   { callTightness: 1.1, raiseStrength: 0.55, bluffProb: 0.05 },
}

// Hand strength in [0, 1] — calibrated to P(this category beats a random opponent's
// best-of-10). A linear category/14 scale undervalues real hands (a STRAIGHT in this
// game wins ~90% of showdowns, not 50%), which made bots fold to all-in shoves with
// hands that were actually crushing the bluff range.
const STRENGTH_BY_CATEGORY: Record<HandCategory, number> = {
  [HandCategory.HIGH_CARD]:               0.01,
  [HandCategory.PAIR]:                    0.10,
  [HandCategory.FLUSH_PAIR]:              0.18,
  [HandCategory.TWO_PAIR]:                0.30,
  [HandCategory.FLUSH_TWO_PAIR]:          0.42,
  [HandCategory.THREE_OF_A_KIND]:         0.55,
  [HandCategory.FLUSH_THREE_OF_A_KIND]:   0.65,
  [HandCategory.STRAIGHT]:                0.76,
  [HandCategory.FLUSH]:                   0.85,
  [HandCategory.FULL_HOUSE]:              0.92,
  [HandCategory.FLUSH_FULL_HOUSE]:        0.95,
  [HandCategory.FOUR_OF_A_KIND]:          0.97,
  [HandCategory.FLUSH_FOUR_OF_A_KIND]:    0.98,
  [HandCategory.STRAIGHT_FLUSH]:          0.99,
  [HandCategory.FIVE_OF_A_KIND]:          1.00,
  [HandCategory.ROYAL_FLUSH]:             1.00,
}

function handStrength(hand: import('./card').Card[]): number {
  const plays = generatePlays(hand, null)
  if (plays.length === 0) return 0
  let bestCat = HandCategory.HIGH_CARD
  for (const p of plays) {
    if (p.category > bestCat) bestCat = p.category
  }
  return STRENGTH_BY_CATEGORY[bestCat] ?? 0
}

export function chooseBettingAction(
  state: GameState,
  botId: string,
  difficulty: BotDifficulty,
): BettingAction {
  const player = state.players.find(p => p.id === botId)
  if (!player) return { type: 'FOLD' }

  const stack = state.scores[botId] ?? 0
  const myCommitted = state.committed[botId] ?? 0
  const owe = state.betToMatch - myCommitted
  const knobs = KNOBS[difficulty]
  const strength = handStrength(player.hand)

  // No outstanding bet to call.
  if (owe === 0) {
    // Strong hand → open the betting. Otherwise check.
    if (strength >= knobs.raiseStrength && stack >= state.options.anteAmount) {
      // Bet a fraction of pot, sized by strength.
      const target = state.betToMatch + Math.max(state.options.anteAmount, Math.floor(state.pot * strength))
      return { type: 'BET', amount: Math.min(target, myCommitted + stack) }
    }
    // Occasional bluff-bet on weak hands (hard only).
    if (knobs.bluffProb > 0 && Math.random() < knobs.bluffProb && stack >= state.options.anteAmount) {
      return { type: 'BET', amount: state.betToMatch + state.options.anteAmount }
    }
    return { type: 'CHECK' }
  }

  // There's a bet to call. Compute pot odds and compare to strength.
  const potOdds = owe / (state.pot + owe)
  const callThreshold = potOdds * knobs.callTightness

  // Strength clearly above pot odds → consider a raise.
  if (strength >= knobs.raiseStrength && stack > owe) {
    const raiseTo = state.betToMatch + Math.max(state.minRaise, Math.floor(state.pot * (strength - 0.4)))
    return { type: 'RAISE', amount: Math.min(raiseTo, myCommitted + stack) }
  }

  // Strength meets pot odds → call.
  if (strength >= callThreshold) {
    return { type: 'CALL' }
  }

  // Cards persist across hands within a round. Folding to a small bet on a weak
  // hand traps the bot — same weak hand next time, fold again, forever. Calling
  // gets us to the discard phase to refresh. So always call when the cost is
  // tiny relative to our stack, regardless of strength.
  if (stack >= owe * 20) {
    return { type: 'CALL' }
  }

  return { type: 'FOLD' }
}
