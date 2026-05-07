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

// Tightened from the looser pre-2026-05 values: low thresholds plus pot-relative raise
// sizing chained to all-in by the third raiser (4-bot STRAIGHT vs STRAIGHT could empty
// every stack in one hand). Now FLUSH-and-up raises on medium, FULL_HOUSE+ on easy.
const KNOBS: Record<BotDifficulty, DifficultyKnobs> = {
  easy:   { callTightness: 0.7, raiseStrength: 0.92, bluffProb: 0 },
  medium: { callTightness: 1.0, raiseStrength: 0.85, bluffProb: 0 },
  hard:   { callTightness: 1.1, raiseStrength: 0.75, bluffProb: 0.05 },
}

// Strength at or above which the bot is willing to commit its full stack on one action.
// FLUSH_FULL_HOUSE (0.95) and up. Below this, a single bet/raise commits at most
// `STACK_FRACTION_PER_ACTION` of the remaining stack — without this cap, pot-relative
// raise sizing compounds across the round on shallow stacks.
const SHOVE_STRENGTH = 0.95
const STACK_FRACTION_PER_ACTION = 0.5

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
      // Sized as a fraction of the pot, tempered by strength. The `- 0.4` keeps
      // moderate-strength opens (FLUSH ~0.85) at well under half-pot.
      const target = state.betToMatch + Math.max(state.options.anteAmount, Math.floor(state.pot * (strength - 0.4)))
      const stackCap = strength >= SHOVE_STRENGTH ? stack : Math.floor(stack * STACK_FRACTION_PER_ACTION)
      const capped = Math.min(target, myCommitted + stackCap)
      const isAllIn = capped === myCommitted + stack
      const minLegalBet = state.betToMatch + state.options.anteAmount
      // If the stack-cap forces the open below a legal bet (and we're not shoving),
      // fall through to check rather than bet illegally.
      if (capped >= minLegalBet || isAllIn) {
        return { type: 'BET', amount: capped }
      }
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
    // Smaller multiplier than BET because the pot is already inflated by prior action;
    // pot-sized re-raises here are what compounded to all-in in shallow-stack hands.
    const raiseTo = state.betToMatch + Math.max(state.minRaise, Math.floor(state.pot * (strength - 0.55)))
    const stackCap = strength >= SHOVE_STRENGTH ? stack : Math.floor(stack * STACK_FRACTION_PER_ACTION)
    const capped = Math.min(raiseTo, myCommitted + stackCap)
    const isAllIn = capped === myCommitted + stack
    const minLegalRaise = state.betToMatch + state.minRaise
    // If the cap forces the raise below the legal min (and we're not shoving),
    // fall through to the call/fold logic below.
    if (capped >= minLegalRaise || isAllIn) {
      return { type: 'RAISE', amount: capped }
    }
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
