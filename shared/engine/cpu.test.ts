import { describe, it, expect } from 'vitest'
import { decideCpuDiscard, decideCpuPlay, allValidHands } from './cpu'
import { applyCommand, initialState, buildClientState } from './state-machine'
import { evaluateHand, beats } from './hand-eval'
import type { GameState } from './game-state'
import type { Card } from './card'

// ============================================================
// Helpers
// ============================================================

const c = (rank: Card['rank'], suit: Card['suit']): Card => ({ rank, suit })

/** Build a minimal playing state with two players, one of which is a CPU. */
function makeCpuGame(humanHand: Card[], cpuHand: Card[]): GameState {
  let s = initialState()
  s = applyCommand(s, { type: 'ADD_PLAYER', playerId: 'human', playerName: 'Human' })
  s = applyCommand(s, { type: 'ADD_CPU_PLAYER', playerId: 'cpu-1', playerName: 'CPU 1' })
  s = applyCommand(s, { type: 'START_GAME' })

  // Overwrite both players' hands with the supplied cards (keep empty decks to avoid draw side-effects)
  s = {
    ...s,
    players: s.players.map(p => {
      if (p.id === 'human') return { ...p, hand: humanHand, deck: [] }
      if (p.id === 'cpu-1') return { ...p, hand: cpuHand, deck: [] }
      return p
    }),
  }
  return s
}

// ============================================================
// allValidHands
// ============================================================

describe('allValidHands', () => {
  it('returns single-card hands for any non-empty hand', () => {
    const hand = [c(7, 'hearts'), c('K', 'spades')]
    const hands = allValidHands(hand)
    expect(hands.length).toBeGreaterThanOrEqual(2)
    hands.forEach(h => expect(h).toBeDefined())
  })

  it('detects a pair', () => {
    const hand = [c(7, 'hearts'), c(7, 'spades')]
    const hands = allValidHands(hand)
    const categories = hands.map(h => h.category)
    // Should have PAIR (and also two HIGH_CARD singles)
    expect(categories).toContain(1) // HandCategory.PAIR = 1
  })

  it('sorts weakest first', () => {
    const hand = [c(7, 'hearts'), c(7, 'spades'), c('A', 'clubs')]
    const hands = allValidHands(hand)
    for (let i = 1; i < hands.length; i++) {
      const prev = hands[i - 1]
      const curr = hands[i]
      // curr should not be strictly weaker than prev
      expect(curr.category).toBeGreaterThanOrEqual(prev.category)
    }
  })

  it('returns empty for empty hand', () => {
    expect(allValidHands([])).toHaveLength(0)
  })

  it('finds a flush among 5 cards of the same suit', () => {
    const hand = [
      c(2, 'hearts'), c(5, 'hearts'), c(8, 'hearts'), c('J', 'hearts'), c('A', 'hearts'),
    ]
    const hands = allValidHands(hand)
    const hasFlush = hands.some(h => h.category === 8) // HandCategory.FLUSH = 8
    expect(hasFlush).toBe(true)
  })
})

// ============================================================
// decideCpuPlay — leading (no top play)
// ============================================================

describe('decideCpuPlay — leading', () => {
  it('returns a valid card when leading', () => {
    const cpuHand = [c(3, 'clubs'), c('K', 'spades'), c('A', 'hearts')]
    const state = makeCpuGame([], cpuHand)

    // Override so CPU leads (currentTopPlay is null by default in a fresh hand)
    const cpuState = {
      ...state,
      playerOrder: ['cpu-1', 'human'],
      currentPlayerIndex: 0,
      leadPlayerIndex: 0,
      turnPhase: 'play' as const,
      currentTopPlay: null,
    }

    const cards = decideCpuPlay(cpuState, 'cpu-1')
    expect(cards).not.toBeNull()
    expect(cards!.length).toBeGreaterThanOrEqual(1)
  })

  it('plays the weakest available hand when leading', () => {
    // Hand has a pair of 7s and a high Ace — should lead with a single low card, not the pair
    const cpuHand = [c(7, 'hearts'), c(7, 'spades'), c('A', 'clubs')]
    const cpuState = {
      ...makeCpuGame([], cpuHand),
      playerOrder: ['cpu-1', 'human'],
      currentPlayerIndex: 0,
      leadPlayerIndex: 0,
      turnPhase: 'play' as const,
      currentTopPlay: null,
    }
    const cards = decideCpuPlay(cpuState, 'cpu-1')!
    // Should play a single card (weakest possible hand), not the pair
    expect(cards.length).toBe(1)
  })
})

// ============================================================
// decideCpuPlay — responding
// ============================================================

describe('decideCpuPlay — responding', () => {
  it('beats a low single with a higher card', () => {
    const topPlay = evaluateHand([c(2, 'clubs')])!
    const cpuHand = [c('A', 'spades'), c(3, 'clubs')]

    const cpuState = {
      ...makeCpuGame([], cpuHand),
      playerOrder: ['cpu-1', 'human'],
      currentPlayerIndex: 0,
      turnPhase: 'play' as const,
      currentTopPlay: topPlay,
    }
    const cards = decideCpuPlay(cpuState, 'cpu-1')
    expect(cards).not.toBeNull()
    expect(cards!.length).toBe(1)
    // The played card must beat the top play
    const played = evaluateHand(cards!)!
    expect(beats(played, topPlay)).toBe(true)
  })

  it('folds when nothing beats the top play', () => {
    const topPlay = evaluateHand([c('A', 'spades')])! // highest single card
    const cpuHand = [c(2, 'clubs'), c(3, 'diamonds')] // nothing can beat it as a single; no pairs

    const cpuState = {
      ...makeCpuGame([], cpuHand),
      playerOrder: ['cpu-1', 'human'],
      currentPlayerIndex: 0,
      turnPhase: 'play' as const,
      currentTopPlay: topPlay,
    }
    const cards = decideCpuPlay(cpuState, 'cpu-1')
    expect(cards).toBeNull()
  })
})

// ============================================================
// decideCpuDiscard
// ============================================================

describe('decideCpuDiscard', () => {
  it('returns empty array when deck is empty (no discard allowed)', () => {
    const cpuHand = [c(2, 'clubs'), c(3, 'diamonds')]
    // deck is already empty (makeCpuGame sets deck to [])
    const state = makeCpuGame([], cpuHand)
    const cpuState = {
      ...state,
      playerOrder: ['cpu-1', 'human'],
      currentPlayerIndex: 0,
      turnPhase: 'discard' as const,
    }
    const discards = decideCpuDiscard(cpuState, 'cpu-1')
    expect(discards).toHaveLength(0)
  })

  it('discards isolated low cards and keeps pairs', () => {
    const cpuHand = [
      c(2, 'clubs'),   // isolated low — should discard
      c(3, 'diamonds'),// isolated low — should discard
      c(7, 'hearts'),  // paired
      c(7, 'spades'),  // paired
      c('A', 'clubs'), // isolated high — should discard (high value but no combo)
    ]
    // Give the CPU a non-empty deck so discard is allowed
    const state: GameState = {
      ...makeCpuGame([], cpuHand),
      players: makeCpuGame([], cpuHand).players.map(p =>
        p.id === 'cpu-1' ? { ...p, hand: cpuHand, deck: [c('K', 'clubs')] } : p,
      ),
      playerOrder: ['cpu-1', 'human'],
      currentPlayerIndex: 0,
      turnPhase: 'discard' as const,
    }
    const discards = decideCpuDiscard(state, 'cpu-1')
    // Should not discard the paired 7s
    const discardRanks = discards.map(c => c.rank)
    expect(discardRanks).not.toContain(7)
    // Should discard at most 5
    expect(discards.length).toBeLessThanOrEqual(5)
  })

  it('keeps flush draw cards (3+ same suit)', () => {
    const cpuHand = [
      c(2, 'hearts'),
      c(5, 'hearts'),
      c(9, 'hearts'),
      c(3, 'clubs'),  // isolated
      c('K', 'diamonds'), // isolated
    ]
    const state: GameState = {
      ...makeCpuGame([], cpuHand),
      players: makeCpuGame([], cpuHand).players.map(p =>
        p.id === 'cpu-1' ? { ...p, hand: cpuHand, deck: [c('K', 'clubs')] } : p,
      ),
      playerOrder: ['cpu-1', 'human'],
      currentPlayerIndex: 0,
      turnPhase: 'discard' as const,
    }
    const discards = decideCpuDiscard(state, 'cpu-1')
    // Hearts cards should be kept (flush draw)
    const discardSuits = discards.map(c => c.suit)
    const heartDiscards = discardSuits.filter(s => s === 'hearts')
    expect(heartDiscards).toHaveLength(0)
  })

  it('discards at most 5 cards', () => {
    // 10-card hand with no combos — all candidates but capped at 5
    const cpuHand = [
      c(2, 'clubs'), c(4, 'diamonds'), c(6, 'hearts'), c(8, 'spades'),
      c(10, 'clubs'), c('J', 'diamonds'), c('Q', 'hearts'), c('K', 'spades'),
      c('A', 'clubs'), c(3, 'hearts'),
    ]
    const state: GameState = {
      ...makeCpuGame([], cpuHand),
      players: makeCpuGame([], cpuHand).players.map(p =>
        p.id === 'cpu-1' ? { ...p, hand: cpuHand, deck: [c(5, 'clubs')] } : p,
      ),
      playerOrder: ['cpu-1', 'human'],
      currentPlayerIndex: 0,
      turnPhase: 'discard' as const,
    }
    const discards = decideCpuDiscard(state, 'cpu-1')
    expect(discards.length).toBeLessThanOrEqual(5)
  })
})

// ============================================================
// ADD_CPU_PLAYER command
// ============================================================

describe('ADD_CPU_PLAYER', () => {
  it('adds a CPU player with isCpu = true', () => {
    let s = initialState()
    s = applyCommand(s, { type: 'ADD_PLAYER', playerId: 'p1', playerName: 'Alice' })
    s = applyCommand(s, { type: 'ADD_CPU_PLAYER', playerId: 'cpu-1', playerName: 'CPU 1' })
    const cpu = s.players.find(p => p.id === 'cpu-1')
    expect(cpu).toBeDefined()
    expect(cpu!.isCpu).toBe(true)
  })

  it('human player has isCpu = false', () => {
    let s = initialState()
    s = applyCommand(s, { type: 'ADD_PLAYER', playerId: 'p1', playerName: 'Alice' })
    expect(s.players[0].isCpu).toBe(false)
  })

  it('CPU player appears in client state with isCpu = true', () => {
    let s = initialState()
    s = applyCommand(s, { type: 'ADD_PLAYER', playerId: 'p1', playerName: 'Alice' })
    s = applyCommand(s, { type: 'ADD_CPU_PLAYER', playerId: 'cpu-1', playerName: 'CPU 1' })
    const clientState = buildClientState(s, 'p1')
    const cpuView = clientState.players.find(p => p.id === 'cpu-1')
    expect(cpuView?.isCpu).toBe(true)
  })
})
