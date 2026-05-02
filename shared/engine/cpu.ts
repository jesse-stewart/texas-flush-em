// ============================================================
// CPU player decision logic — pure functions, no side effects.
// Consumed by party/game.ts to drive CPU turns automatically.
// ============================================================

import type { Card, Rank, Suit } from './card'
import { rankValue, SUITS } from './card'
import type { GameState } from './game-state'
import { getPlayerById } from './game-state'
import { evaluateHand, beats } from './hand-eval'
import type { EvaluatedHand } from './hand-eval'

// ============================================================
// Enumerate all valid poker hands from a set of cards
// ============================================================

// Return every unique subset of `cards` of size `size`.
function combinations<T>(arr: T[], size: number): T[][] {
  if (size === 0) return [[]]
  if (arr.length < size) return []
  const [first, ...rest] = arr
  const withFirst = combinations(rest, size - 1).map(c => [first, ...c])
  const withoutFirst = combinations(rest, size)
  return [...withFirst, ...withoutFirst]
}

// All legal hand sizes per the rules
const HAND_SIZES = [1, 2, 3, 4, 5] as const

/**
 * Enumerate every valid evaluated hand the player can make from their current hand cards.
 * Returns them sorted weakest first.
 */
export function allValidHands(cards: Card[]): EvaluatedHand[] {
  const results: EvaluatedHand[] = []
  for (const size of HAND_SIZES) {
    if (cards.length < size) continue
    for (const combo of combinations(cards, size)) {
      const ev = evaluateHand(combo)
      if (ev) results.push(ev)
    }
  }
  // Sort weakest first: use beats() — if a beats b, a comes after b
  results.sort((a, b) => {
    if (beats(a, b)) return 1
    if (beats(b, a)) return -1
    return 0
  })
  return results
}

// ============================================================
// Decide play
// ============================================================

/**
 * Returns the cards the CPU should play, or null if it should fold.
 *
 * Strategy:
 *  - If leading (no currentTopPlay): play the weakest valid hand to conserve strong cards.
 *  - If responding: play the weakest hand that beats the current top play.
 *  - If nothing beats it: fold (return null).
 */
export function decideCpuPlay(state: GameState, playerId: string): Card[] | null {
  const player = getPlayerById(state, playerId)
  if (!player) return null

  const valid = allValidHands(player.hand)
  if (valid.length === 0) return null

  if (state.currentTopPlay === null) {
    // Leading — play the weakest hand available
    return valid[0].cards
  }

  // Responding — find weakest hand that beats the top play
  const beater = valid.find(h => beats(h, state.currentTopPlay!))
  return beater ? beater.cards : null
}

// ============================================================
// Decide discard
// ============================================================

/**
 * Returns up to 5 cards the CPU should discard.
 *
 * Strategy: keep cards that contribute to potential combos (pairs, straights,
 * flushes) and discard isolated low-value singletons.
 *
 * "Useful" cards are those that share a rank with another card in hand
 * (pairs/trips), share a suit with 2+ others (flush draw), or are part of
 * a rank run (straight draw).  Everything else is a candidate for discard,
 * and we discard the weakest candidates first, up to 5.
 */
export function decideCpuDiscard(state: GameState, playerId: string): Card[] {
  const player = getPlayerById(state, playerId)
  if (!player || player.deck.length === 0) return []

  const hand = player.hand

  // Count rank and suit frequencies
  const rankCount = new Map<Rank, number>()
  const suitCount = new Map<Suit, number>()
  for (const card of hand) {
    rankCount.set(card.rank, (rankCount.get(card.rank) ?? 0) + 1)
    suitCount.set(card.suit, (suitCount.get(card.suit) ?? 0) + 1)
  }

  // Build a set of rank values present in hand, for straight draw detection
  const rankValuesPresent = new Set(hand.map(c => rankValue(c.rank)))

  function isPartOfStraightDraw(card: Card): boolean {
    const rv = rankValue(card.rank)
    // Check every 5-rank window that contains this card's rank value
    for (let windowStart = rv - 4; windowStart <= rv; windowStart++) {
      let count = 0
      for (let offset = 0; offset < 5; offset++) {
        if (rankValuesPresent.has(windowStart + offset)) count++
      }
      if (count >= 3) return true
    }
    return false
  }

  function isUseful(card: Card): boolean {
    // Part of a pair/trip/quad
    if ((rankCount.get(card.rank) ?? 0) >= 2) return true
    // Part of a flush draw (3+ cards same suit)
    if ((suitCount.get(card.suit) ?? 0) >= 3) return true
    // Part of a straight draw (at least 3 consecutive ranks present)
    if (isPartOfStraightDraw(card)) return true
    return false
  }

  // Candidates: cards that are not useful — discard the weakest ones first
  const candidates = hand.filter(c => !isUseful(c))
  candidates.sort((a, b) => {
    const rankDiff = rankValue(a.rank) - rankValue(b.rank)
    if (rankDiff !== 0) return rankDiff
    return SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit)
  })

  return candidates.slice(0, 5)
}
