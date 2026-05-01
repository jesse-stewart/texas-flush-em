import type { Card, Rank } from './card'
import { rankValue, suitValue } from './card'

// All categories ordered low to high.
// Single-deck games only use: HIGH_CARD, PAIR, TWO_PAIR, THREE_OF_A_KIND, STRAIGHT,
//   FLUSH, FULL_HOUSE, FOUR_OF_A_KIND, STRAIGHT_FLUSH, ROYAL_FLUSH.
// Multi-deck games add the FLUSH_ variants and FIVE_OF_A_KIND.
export enum HandCategory {
  HIGH_CARD = 0,
  PAIR = 1,
  FLUSH_PAIR = 2,             // multi-deck: two identical cards (same rank + suit)
  TWO_PAIR = 3,
  FLUSH_TWO_PAIR = 4,         // multi-deck: two flush pairs of different ranks
  THREE_OF_A_KIND = 5,
  FLUSH_THREE_OF_A_KIND = 6,  // multi-deck: three identical cards
  STRAIGHT = 7,
  FLUSH = 8,
  FULL_HOUSE = 9,
  FLUSH_FULL_HOUSE = 10,      // multi-deck: full house all one suit
  FOUR_OF_A_KIND = 11,
  FLUSH_FOUR_OF_A_KIND = 12,  // multi-deck: four identical cards (requires 4 decks)
  STRAIGHT_FLUSH = 13,
  FIVE_OF_A_KIND = 14,        // multi-deck: five same rank, mixed suits
  ROYAL_FLUSH = 15,
}

export interface EvaluatedHand {
  category: HandCategory
  cards: Card[]
  // Compared in order — higher value wins at each position
  tiebreakers: number[]
}

// Returns positive if a > b, negative if a < b, 0 if identical
export function compareHands(a: EvaluatedHand, b: EvaluatedHand): number {
  if (a.category !== b.category) return a.category - b.category
  for (let i = 0; i < Math.max(a.tiebreakers.length, b.tiebreakers.length); i++) {
    const diff = (a.tiebreakers[i] ?? 0) - (b.tiebreakers[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

// Returns true only if a strictly beats b (ties are not beats per rules)
export function beats(a: EvaluatedHand, b: EvaluatedHand): boolean {
  return compareHands(a, b) > 0
}

// --- Internal helpers ---

function groupByRank(cards: Card[]): Map<Rank, Card[]> {
  const map = new Map<Rank, Card[]>()
  for (const card of cards) {
    const group = map.get(card.rank) ?? []
    group.push(card)
    map.set(card.rank, group)
  }
  return map
}

function maxSuit(cards: Card[]): number {
  return Math.max(...cards.map(c => suitValue(c.suit)))
}

function sortedByRankDesc(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => rankValue(b.rank) - rankValue(a.rank))
}

function isSequential(cards: Card[]): boolean {
  const ranks = sortedByRankDesc(cards).map(c => rankValue(c.rank))
  for (let i = 1; i < ranks.length; i++) {
    if (ranks[i - 1] - ranks[i] !== 1) return false
  }
  return true
}

function allSameSuit(cards: Card[]): boolean {
  const first = cards[0].suit
  return cards.every(c => c.suit === first)
}

// --- Per-count evaluators ---

function evaluateOne(cards: Card[]): EvaluatedHand {
  const [card] = cards
  return {
    category: HandCategory.HIGH_CARD,
    cards,
    tiebreakers: [rankValue(card.rank), suitValue(card.suit)],
  }
}

function evaluateTwo(cards: Card[]): EvaluatedHand | null {
  const [a, b] = cards
  if (a.rank !== b.rank) return null

  if (a.suit === b.suit) {
    // Flush pair: two identical cards
    return {
      category: HandCategory.FLUSH_PAIR,
      cards,
      tiebreakers: [rankValue(a.rank), suitValue(a.suit)],
    }
  }
  return {
    category: HandCategory.PAIR,
    cards,
    tiebreakers: [rankValue(a.rank), maxSuit(cards)],
  }
}

function evaluateThree(cards: Card[]): EvaluatedHand | null {
  const [a, b, c] = cards
  if (a.rank !== b.rank || b.rank !== c.rank) return null

  if (a.suit === b.suit && b.suit === c.suit) {
    return {
      category: HandCategory.FLUSH_THREE_OF_A_KIND,
      cards,
      tiebreakers: [rankValue(a.rank), suitValue(a.suit)],
    }
  }
  return {
    category: HandCategory.THREE_OF_A_KIND,
    cards,
    tiebreakers: [rankValue(a.rank), maxSuit(cards)],
  }
}

function evaluateFour(cards: Card[]): EvaluatedHand | null {
  const byRank = groupByRank(cards)

  if (byRank.size === 1) {
    // Four of a kind
    const sameSuit = allSameSuit(cards)
    if (sameSuit) {
      return {
        category: HandCategory.FLUSH_FOUR_OF_A_KIND,
        cards,
        tiebreakers: [rankValue(cards[0].rank), suitValue(cards[0].suit)],
      }
    }
    return {
      category: HandCategory.FOUR_OF_A_KIND,
      cards,
      tiebreakers: [rankValue(cards[0].rank), maxSuit(cards)],
    }
  }

  if (byRank.size === 2) {
    // Two pair: both groups must be exactly 2 cards
    const groups = [...byRank.values()]
    if (!groups.every(g => g.length === 2)) return null

    groups.sort((a, b) => rankValue(b[0].rank) - rankValue(a[0].rank))
    const [highPair, lowPair] = groups
    const highIsFlush = highPair[0].suit === highPair[1].suit
    const lowIsFlush = lowPair[0].suit === lowPair[1].suit

    if (highIsFlush && lowIsFlush) {
      return {
        category: HandCategory.FLUSH_TWO_PAIR,
        cards,
        tiebreakers: [rankValue(highPair[0].rank), rankValue(lowPair[0].rank)],
      }
    }
    return {
      category: HandCategory.TWO_PAIR,
      cards,
      tiebreakers: [
        rankValue(highPair[0].rank),
        rankValue(lowPair[0].rank),
        maxSuit(highPair),
        maxSuit(lowPair),
      ],
    }
  }

  return null
}

function evaluateFive(cards: Card[]): EvaluatedHand | null {
  const byRank = groupByRank(cards)
  const sameSuit = allSameSuit(cards)
  const sequential = isSequential(cards)
  const sorted = sortedByRankDesc(cards)
  const highCard = sorted[0]

  // Straight flush / Royal flush
  if (sameSuit && sequential) {
    const isRoyal = highCard.rank === 'A' && sorted[1].rank === 'K'
    if (isRoyal) {
      return {
        category: HandCategory.ROYAL_FLUSH,
        cards,
        tiebreakers: [suitValue(highCard.suit)],
      }
    }
    return {
      category: HandCategory.STRAIGHT_FLUSH,
      cards,
      tiebreakers: [rankValue(highCard.rank), suitValue(highCard.suit)],
    }
  }

  // Five of a kind: all same rank (multi-deck only; always mixed suits since max 4 identical)
  if (byRank.size === 1) {
    return {
      category: HandCategory.FIVE_OF_A_KIND,
      cards,
      tiebreakers: [rankValue(cards[0].rank)],
    }
  }

  // Full house / Flush full house: exactly 2 distinct ranks, 3+2 split
  if (byRank.size === 2) {
    const groups = [...byRank.values()].sort((a, b) => b.length - a.length)
    if (groups[0].length === 3 && groups[1].length === 2) {
      const triple = groups[0]
      const pair = groups[1]
      if (sameSuit) {
        return {
          category: HandCategory.FLUSH_FULL_HOUSE,
          cards,
          tiebreakers: [rankValue(triple[0].rank), rankValue(pair[0].rank), suitValue(triple[0].suit)],
        }
      }
      return {
        category: HandCategory.FULL_HOUSE,
        cards,
        tiebreakers: [rankValue(triple[0].rank), rankValue(pair[0].rank), maxSuit(triple), maxSuit(pair)],
      }
    }
  }

  // Flush (same suit, not sequential — straight flush already handled above)
  if (sameSuit) {
    return {
      category: HandCategory.FLUSH,
      cards,
      tiebreakers: [...sorted.map(c => rankValue(c.rank)), suitValue(highCard.suit)],
    }
  }

  // Straight (sequential, not same suit)
  if (sequential) {
    return {
      category: HandCategory.STRAIGHT,
      cards,
      tiebreakers: [rankValue(highCard.rank), suitValue(highCard.suit)],
    }
  }

  return null
}

// Evaluate a set of cards into a hand. Returns null if the cards don't form a legal play.
export function evaluateHand(cards: Card[]): EvaluatedHand | null {
  switch (cards.length) {
    case 1: return evaluateOne(cards)
    case 2: return evaluateTwo(cards)
    case 3: return evaluateThree(cards)
    case 4: return evaluateFour(cards)
    case 5: return evaluateFive(cards)
    default: return null
  }
}

// Convenience: return the category name as a display string
export function handCategoryName(category: HandCategory): string {
  return HandCategory[category].replace(/_/g, ' ').toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase())
}
