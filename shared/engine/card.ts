export type Suit = 'clubs' | 'diamonds' | 'hearts' | 'spades'
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 'J' | 'Q' | 'K' | 'A'

export interface Card {
  rank: Rank
  suit: Suit
}

export const SUITS: Suit[] = ['clubs', 'diamonds', 'hearts', 'spades']
export const RANKS: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 'J', 'Q', 'K', 'A']

// Suit order low to high per rules: clubs < diamonds < hearts < spades
export const SUIT_VALUE: Record<Suit, number> = {
  clubs: 0,
  diamonds: 1,
  hearts: 2,
  spades: 3,
}

export const RANK_VALUE: Record<string, number> = {
  '2': 0, '3': 1, '4': 2, '5': 3, '6': 4, '7': 5,
  '8': 6, '9': 7, '10': 8, 'J': 9, 'Q': 10, 'K': 11, 'A': 12,
}

export function rankValue(rank: Rank): number {
  return RANK_VALUE[String(rank)]
}

export function suitValue(suit: Suit): number {
  return SUIT_VALUE[suit]
}

export function cardEquals(a: Card, b: Card): boolean {
  return a.rank === b.rank && a.suit === b.suit
}

// Returns positive if a > b, negative if a < b, 0 if equal
export function compareCards(a: Card, b: Card): number {
  const rankDiff = rankValue(a.rank) - rankValue(b.rank)
  if (rankDiff !== 0) return rankDiff
  return suitValue(a.suit) - suitValue(b.suit)
}
