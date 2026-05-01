import { describe, it, expect } from 'vitest'
import { evaluateHand, compareHands, beats, HandCategory } from './hand-eval'
import type { Card } from './card'

// --- Helpers ---

const c = (rank: Card['rank'], suit: Card['suit']): Card => ({ rank, suit })

function hand(...cards: Card[]) {
  const result = evaluateHand(cards)
  if (!result) throw new Error(`Not a valid hand: ${JSON.stringify(cards)}`)
  return result
}

// ============================================================
// evaluateHand — category detection
// ============================================================

describe('evaluateHand — invalid', () => {
  it('returns null for 0 cards', () => expect(evaluateHand([])).toBeNull())
  it('returns null for 6 cards', () => {
    expect(evaluateHand([
      c(2,'clubs'), c(3,'clubs'), c(4,'clubs'), c(5,'clubs'), c(6,'clubs'), c(7,'clubs')
    ])).toBeNull()
  })
  it('returns null for 2 cards of different rank', () => {
    expect(evaluateHand([c(2,'clubs'), c(3,'clubs')])).toBeNull()
  })
  it('returns null for 3 cards not all same rank', () => {
    expect(evaluateHand([c(2,'clubs'), c(2,'hearts'), c(3,'clubs')])).toBeNull()
  })
  it('returns null for 4 cards with 3 unique ranks', () => {
    expect(evaluateHand([c(2,'clubs'), c(2,'hearts'), c(3,'clubs'), c(4,'diamonds')])).toBeNull()
  })
  it('returns null for 5 random non-hand cards', () => {
    expect(evaluateHand([c(2,'clubs'), c(4,'hearts'), c(7,'diamonds'), c(9,'spades'), c('J','clubs')])).toBeNull()
  })
})

describe('evaluateHand — single card (HIGH_CARD)', () => {
  it('any single card is HIGH_CARD', () => {
    expect(hand(c('A','spades')).category).toBe(HandCategory.HIGH_CARD)
    expect(hand(c(2,'clubs')).category).toBe(HandCategory.HIGH_CARD)
  })
})

describe('evaluateHand — pair', () => {
  it('same rank different suit → PAIR', () => {
    expect(hand(c(7,'clubs'), c(7,'hearts')).category).toBe(HandCategory.PAIR)
  })
  it('same rank same suit → FLUSH_PAIR', () => {
    expect(hand(c(7,'clubs'), c(7,'clubs')).category).toBe(HandCategory.FLUSH_PAIR)
  })
})

describe('evaluateHand — three of a kind', () => {
  it('same rank mixed suits → THREE_OF_A_KIND', () => {
    expect(hand(c(5,'clubs'), c(5,'hearts'), c(5,'spades')).category).toBe(HandCategory.THREE_OF_A_KIND)
  })
  it('three identical cards → FLUSH_THREE_OF_A_KIND', () => {
    expect(hand(c(5,'clubs'), c(5,'clubs'), c(5,'clubs')).category).toBe(HandCategory.FLUSH_THREE_OF_A_KIND)
  })
})

describe('evaluateHand — two pair / four of a kind', () => {
  it('two pairs different ranks → TWO_PAIR', () => {
    expect(hand(c(7,'clubs'), c(7,'hearts'), c('K','clubs'), c('K','hearts')).category).toBe(HandCategory.TWO_PAIR)
  })
  it('two flush pairs → FLUSH_TWO_PAIR', () => {
    expect(hand(c(7,'clubs'), c(7,'clubs'), c('K','hearts'), c('K','hearts')).category).toBe(HandCategory.FLUSH_TWO_PAIR)
  })
  it('mixed flush pairs (only one is flush) → TWO_PAIR', () => {
    expect(hand(c(7,'clubs'), c(7,'clubs'), c('K','hearts'), c('K','spades')).category).toBe(HandCategory.TWO_PAIR)
  })
  it('four same rank mixed suits → FOUR_OF_A_KIND', () => {
    expect(hand(c(9,'clubs'), c(9,'diamonds'), c(9,'hearts'), c(9,'spades')).category).toBe(HandCategory.FOUR_OF_A_KIND)
  })
  it('four identical cards → FLUSH_FOUR_OF_A_KIND', () => {
    expect(hand(c(9,'clubs'), c(9,'clubs'), c(9,'clubs'), c(9,'clubs')).category).toBe(HandCategory.FLUSH_FOUR_OF_A_KIND)
  })
})

describe('evaluateHand — 5-card hands', () => {
  it('5 sequential mixed suits → STRAIGHT', () => {
    expect(hand(c(5,'clubs'), c(6,'diamonds'), c(7,'hearts'), c(8,'spades'), c(9,'clubs')).category).toBe(HandCategory.STRAIGHT)
  })
  it('5 same suit non-sequential → FLUSH', () => {
    expect(hand(c(2,'hearts'), c(5,'hearts'), c(7,'hearts'), c(9,'hearts'), c('J','hearts')).category).toBe(HandCategory.FLUSH)
  })
  it('3+2 split → FULL_HOUSE', () => {
    expect(hand(c('K','clubs'), c('K','hearts'), c('K','spades'), c(3,'clubs'), c(3,'hearts')).category).toBe(HandCategory.FULL_HOUSE)
  })
  it('3+2 all same suit → FLUSH_FULL_HOUSE', () => {
    expect(hand(c('K','clubs'), c('K','clubs'), c('K','clubs'), c(3,'clubs'), c(3,'clubs')).category).toBe(HandCategory.FLUSH_FULL_HOUSE)
  })
  it('5 sequential same suit → STRAIGHT_FLUSH', () => {
    expect(hand(c(5,'spades'), c(6,'spades'), c(7,'spades'), c(8,'spades'), c(9,'spades')).category).toBe(HandCategory.STRAIGHT_FLUSH)
  })
  it('A-K-Q-J-10 same suit → ROYAL_FLUSH', () => {
    expect(hand(c('A','spades'), c('K','spades'), c('Q','spades'), c('J','spades'), c(10,'spades')).category).toBe(HandCategory.ROYAL_FLUSH)
  })
  it('5 same rank mixed suits → FIVE_OF_A_KIND', () => {
    expect(hand(c(8,'clubs'), c(8,'diamonds'), c(8,'hearts'), c(8,'spades'), c(8,'clubs')).category).toBe(HandCategory.FIVE_OF_A_KIND)
  })
  it('ace does not wrap for straights (A-2-3-4-5 is not a straight)', () => {
    expect(evaluateHand([c('A','clubs'), c(2,'diamonds'), c(3,'hearts'), c(4,'spades'), c(5,'clubs')])).toBeNull()
  })
})

// ============================================================
// compareHands — category ordering
// ============================================================

describe('compareHands — category beats lower category', () => {
  const single  = hand(c('A','spades'))
  const pair    = hand(c('A','clubs'), c('A','hearts'))
  const trips   = hand(c(2,'clubs'), c(2,'hearts'), c(2,'spades'))
  const royal   = hand(c('A','spades'), c('K','spades'), c('Q','spades'), c('J','spades'), c(10,'spades'))

  it('pair beats single',        () => expect(beats(pair, single)).toBe(true))
  it('three of a kind beats pair', () => expect(beats(trips, pair)).toBe(true))
  it('royal flush beats trips',   () => expect(beats(royal, trips)).toBe(true))
  it('single does not beat pair', () => expect(beats(single, pair)).toBe(false))
})

// ============================================================
// compareHands — rank tiebreaking within category
// ============================================================

describe('compareHands — rank tiebreaking', () => {
  it('higher single beats lower single', () => {
    expect(beats(hand(c('K','clubs')), hand(c('Q','clubs')))).toBe(true)
  })

  it('higher pair beats lower pair', () => {
    const nines = hand(c(9,'clubs'), c(9,'hearts'))
    const sevens = hand(c(7,'clubs'), c(7,'hearts'))
    expect(beats(nines, sevens)).toBe(true)
  })

  it('two pair: higher top pair wins', () => {
    const kingsAndThrees = hand(c('K','clubs'), c('K','hearts'), c(3,'clubs'), c(3,'hearts'))
    const queensAndJacks = hand(c('Q','clubs'), c('Q','hearts'), c('J','clubs'), c('J','hearts'))
    expect(beats(kingsAndThrees, queensAndJacks)).toBe(true)
  })

  it('two pair: same top pair, higher bottom pair wins', () => {
    const ksAndJs = hand(c('K','clubs'), c('K','hearts'), c('J','clubs'), c('J','hearts'))
    const ksAnd9s = hand(c('K','clubs'), c('K','hearts'), c(9,'clubs'), c(9,'hearts'))
    expect(beats(ksAndJs, ksAnd9s)).toBe(true)
  })

  it('full house ranked by triple', () => {
    const kingsFullOfTwos = hand(c('K','clubs'), c('K','hearts'), c('K','spades'), c(2,'clubs'), c(2,'hearts'))
    const queensFullOfAces = hand(c('Q','clubs'), c('Q','hearts'), c('Q','spades'), c('A','clubs'), c('A','hearts'))
    expect(beats(kingsFullOfTwos, queensFullOfAces)).toBe(true)
  })

  it('straight ranked by high card', () => {
    const tenHigh = hand(c(6,'clubs'), c(7,'diamonds'), c(8,'hearts'), c(9,'spades'), c(10,'clubs'))
    const nineHigh = hand(c(5,'clubs'), c(6,'diamonds'), c(7,'hearts'), c(8,'spades'), c(9,'clubs'))
    expect(beats(tenHigh, nineHigh)).toBe(true)
  })

  it('flush ranked by highest card first', () => {
    const aceHigh = hand(c('A','hearts'), c(2,'hearts'), c(4,'hearts'), c(6,'hearts'), c(8,'hearts'))
    const kingHigh = hand(c('K','hearts'), c('Q','hearts'), c('J','hearts'), c(9,'hearts'), c(7,'hearts'))
    expect(beats(aceHigh, kingHigh)).toBe(true)
  })
})

// ============================================================
// compareHands — suit tiebreaking
// ============================================================

describe('compareHands — suit tiebreaking', () => {
  it('same-rank single: higher suit wins (spades > hearts)', () => {
    expect(beats(hand(c(7,'spades')), hand(c(7,'hearts')))).toBe(true)
  })

  it('same-rank single: spades > diamonds > clubs', () => {
    expect(beats(hand(c('A','spades')), hand(c('A','diamonds')))).toBe(true)
    expect(beats(hand(c('A','diamonds')), hand(c('A','clubs')))).toBe(true)
  })

  it('same-rank pair: higher suit card wins', () => {
    const heartsSpades = hand(c(7,'hearts'), c(7,'spades'))
    const clubsDiamonds = hand(c(7,'clubs'), c(7,'diamonds'))
    expect(beats(heartsSpades, clubsDiamonds)).toBe(true)
  })

  it('same royal flush suit order: spades > hearts', () => {
    const spadesRoyal = hand(c('A','spades'), c('K','spades'), c('Q','spades'), c('J','spades'), c(10,'spades'))
    const heartsRoyal = hand(c('A','hearts'), c('K','hearts'), c('Q','hearts'), c('J','hearts'), c(10,'hearts'))
    expect(beats(spadesRoyal, heartsRoyal)).toBe(true)
  })

  it('identical hands do not beat each other', () => {
    const a = hand(c('A','spades'))
    const b = hand(c('A','spades'))
    expect(beats(a, b)).toBe(false)
    expect(beats(b, a)).toBe(false)
    expect(compareHands(a, b)).toBe(0)
  })
})

// ============================================================
// multi-deck hand ordering
// ============================================================

describe('multi-deck category ordering', () => {
  const pair       = hand(c(7,'clubs'), c(7,'hearts'))
  const flushPair  = hand(c(7,'clubs'), c(7,'clubs'))
  const twoPair    = hand(c(7,'clubs'), c(7,'hearts'), c('K','clubs'), c('K','hearts'))
  const flushTwoPair = hand(c(7,'clubs'), c(7,'clubs'), c('K','hearts'), c('K','hearts'))
  const trips      = hand(c(5,'clubs'), c(5,'hearts'), c(5,'spades'))
  const flushTrips = hand(c(5,'clubs'), c(5,'clubs'), c(5,'clubs'))

  it('flush pair beats regular pair',        () => expect(beats(flushPair, pair)).toBe(true))
  it('two pair beats flush pair',            () => expect(beats(twoPair, flushPair)).toBe(true))
  it('flush two pair beats regular two pair', () => expect(beats(flushTwoPair, twoPair)).toBe(true))
  it('trips beats flush two pair',           () => expect(beats(trips, flushTwoPair)).toBe(true))
  it('flush trips beats regular trips',      () => expect(beats(flushTrips, trips)).toBe(true))
})
