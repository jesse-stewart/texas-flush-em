import { describe, it, expect } from 'vitest'
import type { Card } from './card'
import { generatePlays, chooseDiscard } from './bot-moves'
import { evaluateHand, HandCategory } from './hand-eval'

const c = (rank: Card['rank'], suit: Card['suit']): Card => ({ rank, suit })

describe('generatePlays', () => {
  it('generates singles for each distinct card', () => {
    const hand = [c(2, 'clubs'), c(7, 'hearts'), c('K', 'spades')]
    const plays = generatePlays(hand, null)
    const singles = plays.filter(p => p.cards.length === 1)
    expect(singles).toHaveLength(3)
  })

  it('generates a pair when two same-rank cards present', () => {
    const hand = [c(7, 'clubs'), c(7, 'hearts'), c(2, 'spades')]
    const plays = generatePlays(hand, null)
    const pairs = plays.filter(p => p.category === HandCategory.PAIR)
    expect(pairs.length).toBe(1)
    expect(pairs[0].cards.every(card => card.rank === 7)).toBe(true)
  })

  it('generates a flush from 5 same-suit cards', () => {
    const hand = [c(2, 'hearts'), c(5, 'hearts'), c(8, 'hearts'), c('J', 'hearts'), c('K', 'hearts'), c(3, 'clubs')]
    const plays = generatePlays(hand, null)
    expect(plays.some(p => p.category === HandCategory.FLUSH)).toBe(true)
  })

  it('generates a straight from 5 sequential ranks', () => {
    const hand = [c(4, 'clubs'), c(5, 'diamonds'), c(6, 'hearts'), c(7, 'spades'), c(8, 'clubs')]
    const plays = generatePlays(hand, null)
    expect(plays.some(p => p.category === HandCategory.STRAIGHT)).toBe(true)
  })

  it('generates straight flush and royal flush', () => {
    const royal = [c(10, 'spades'), c('J', 'spades'), c('Q', 'spades'), c('K', 'spades'), c('A', 'spades')]
    const plays = generatePlays(royal, null)
    expect(plays.some(p => p.category === HandCategory.ROYAL_FLUSH)).toBe(true)

    const sf = [c(5, 'hearts'), c(6, 'hearts'), c(7, 'hearts'), c(8, 'hearts'), c(9, 'hearts')]
    const plays2 = generatePlays(sf, null)
    expect(plays2.some(p => p.category === HandCategory.STRAIGHT_FLUSH)).toBe(true)
  })

  it('generates a full house', () => {
    const hand = [c(7, 'clubs'), c(7, 'hearts'), c(7, 'spades'), c('K', 'diamonds'), c('K', 'hearts')]
    const plays = generatePlays(hand, null)
    expect(plays.some(p => p.category === HandCategory.FULL_HOUSE)).toBe(true)
  })

  it('filters out plays that do not beat current top', () => {
    const hand = [c(5, 'clubs'), c(9, 'hearts')]
    const top = evaluateHand([c(7, 'spades')])!
    const plays = generatePlays(hand, top)
    // Only the 9 of hearts beats 7 of spades
    expect(plays).toHaveLength(1)
    expect(plays[0].cards[0].rank).toBe(9)
  })

  it('returns no plays when hand cannot beat top', () => {
    const hand = [c(2, 'clubs'), c(3, 'clubs')]
    const top = evaluateHand([c(7, 'hearts'), c(7, 'spades')])!
    const plays = generatePlays(hand, top)
    expect(plays).toHaveLength(0)
  })

  it('deduplicates equivalent plays in multi-deck (same cards different combo path)', () => {
    // Two identical 7♥ + 7♥ doesn't happen with single deck, but a flush of 5 hearts where
    // we'd also detect the straight should not double up
    const hand = [c(2, 'hearts'), c(3, 'hearts'), c(4, 'hearts'), c(5, 'hearts'), c(6, 'hearts')]
    const plays = generatePlays(hand, null)
    // Should appear exactly once even though it's both a straight and a flush (but evaluateHand
    // resolves it as STRAIGHT_FLUSH)
    const sf = plays.filter(p => p.category === HandCategory.STRAIGHT_FLUSH)
    expect(sf).toHaveLength(1)
  })

  it('handles a typical 10-card hand without exploding', () => {
    const hand: Card[] = [
      c(2, 'clubs'), c(5, 'hearts'), c(7, 'spades'), c(7, 'diamonds'),
      c(9, 'hearts'), c('J', 'clubs'), c('Q', 'diamonds'), c('K', 'spades'),
      c('A', 'hearts'), c(3, 'clubs'),
    ]
    const plays = generatePlays(hand, null)
    expect(plays.length).toBeGreaterThan(10)
    expect(plays.length).toBeLessThan(2000)
  })
})

describe('chooseDiscard', () => {
  it('returns empty array when deck is empty', () => {
    const hand = [c(2, 'clubs'), c(3, 'hearts')]
    expect(chooseDiscard(hand, 0, [], 5)).toEqual([])
  })

  it('returns empty array when count is 0', () => {
    const hand = [c(2, 'clubs'), c(3, 'hearts')]
    expect(chooseDiscard(hand, 10, [], 0)).toEqual([])
  })

  it('does not discard reserved play cards', () => {
    const hand = [c(2, 'clubs'), c(3, 'hearts'), c('A', 'spades'), c('K', 'spades')]
    const reserved = [c('A', 'spades'), c('K', 'spades')]
    const out = chooseDiscard(hand, 10, reserved, 4)
    for (const r of reserved) {
      expect(out.find(o => o.rank === r.rank && o.suit === r.suit)).toBeUndefined()
    }
  })

  it('prefers discarding low cards over high cards', () => {
    const hand = [c(2, 'clubs'), c(3, 'hearts'), c('A', 'spades'), c('K', 'diamonds')]
    const out = chooseDiscard(hand, 10, [], 2)
    expect(out).toHaveLength(2)
    expect(out.every(card => card.rank === 2 || card.rank === 3)).toBe(true)
  })

  it('keeps cards that form pairs', () => {
    const hand = [c(2, 'clubs'), c(2, 'hearts'), c(3, 'spades'), c(4, 'diamonds')]
    const out = chooseDiscard(hand, 10, [], 2)
    // Should NOT discard the pair of 2s; discard 3 and 4
    expect(out.find(o => o.rank === 2)).toBeUndefined()
  })

  it('keeps cards that contribute to a flush', () => {
    const hand = [
      c(2, 'hearts'), c(5, 'hearts'), c(8, 'hearts'), c('J', 'hearts'), c('K', 'hearts'),
      c(3, 'clubs'), c(4, 'diamonds'), c(6, 'spades'),
    ]
    const out = chooseDiscard(hand, 10, [], 3)
    // The 3 discarded should be the non-heart cards (3♣, 4♦, 6♠)
    expect(out.every(card => card.suit !== 'hearts')).toBe(true)
  })
})
