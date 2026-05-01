import type { Card } from './card'
import { SUITS, RANKS } from './card'

export function createDeck(): Card[] {
  const deck: Card[] = []
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit })
    }
  }
  return deck
}

export function createMultiDeck(count: number): Card[] {
  const deck: Card[] = []
  for (let i = 0; i < count; i++) {
    deck.push(...createDeck())
  }
  return deck
}

export function shuffle<T>(arr: T[]): T[] {
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export function drawFromTop(deck: Card[], count: number): { drawn: Card[]; remaining: Card[] } {
  const drawn = deck.slice(0, count)
  const remaining = deck.slice(count)
  return { drawn, remaining }
}

export function insertToBottom(deck: Card[], cards: Card[]): Card[] {
  return [...deck, ...cards]
}

// Deal one card at a time clockwise until the deck is exhausted
export function dealAll(deck: Card[], playerCount: number): Card[][] {
  const hands: Card[][] = Array.from({ length: playerCount }, () => [])
  for (let i = 0; i < deck.length; i++) {
    hands[i % playerCount].push(deck[i])
  }
  return hands
}
