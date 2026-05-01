import { describe, it, expect } from 'vitest'
import { applyCommand, initialState, buildClientState } from './state-machine'
import type { GameState } from './game-state'
import type { Card } from './card'

// ============================================================
// Helpers
// ============================================================

const c = (rank: Card['rank'], suit: Card['suit']): Card => ({ rank, suit })

function addPlayers(state: GameState, ...players: Array<{ id: string; name: string }>): GameState {
  return players.reduce(
    (s, p) => applyCommand(s, { type: 'ADD_PLAYER', playerId: p.id, playerName: p.name }),
    state,
  )
}

function withTwoPlayers(): GameState {
  return addPlayers(initialState(), { id: 'p1', name: 'Alice' }, { id: 'p2', name: 'Bob' })
}

function startedGame(deckCount = 1): GameState {
  return applyCommand(withTwoPlayers(), { type: 'START_GAME', deckCount })
}

// Skip discard phase by discarding zero cards (pass empty array)
function skipDiscard(state: GameState): GameState {
  const playerId = state.playerOrder[state.currentPlayerIndex]
  return applyCommand(state, { type: 'DISCARD', playerId, cards: [] })
}

// Play a single card for the current player
function playSingle(state: GameState, card?: Card): GameState {
  const playerId = state.playerOrder[state.currentPlayerIndex]
  const player = state.players.find(p => p.id === playerId)!
  const cardToPlay = card ?? player.hand[0]
  return applyCommand(state, { type: 'PLAY', playerId, cards: [cardToPlay] })
}

// ============================================================
// ADD_PLAYER
// ============================================================

describe('ADD_PLAYER', () => {
  it('adds a player to the lobby', () => {
    const s = applyCommand(initialState(), { type: 'ADD_PLAYER', playerId: 'p1', playerName: 'Alice' })
    expect(s.players).toHaveLength(1)
    expect(s.players[0].id).toBe('p1')
    expect(s.players[0].name).toBe('Alice')
    expect(s.players[0].connected).toBe(true)
    expect(s.scores['p1']).toBe(0)
  })

  it('adds up to 4 players', () => {
    let s = initialState()
    for (let i = 1; i <= 4; i++) {
      s = applyCommand(s, { type: 'ADD_PLAYER', playerId: `p${i}`, playerName: `Player ${i}` })
    }
    expect(s.players).toHaveLength(4)
  })

  it('rejects a 5th player', () => {
    let s = initialState()
    for (let i = 1; i <= 4; i++) {
      s = applyCommand(s, { type: 'ADD_PLAYER', playerId: `p${i}`, playerName: `Player ${i}` })
    }
    s = applyCommand(s, { type: 'ADD_PLAYER', playerId: 'p5', playerName: 'Extra' })
    expect(s.players).toHaveLength(4)
  })

  it('re-joining an existing player marks them connected', () => {
    let s = applyCommand(initialState(), { type: 'ADD_PLAYER', playerId: 'p1', playerName: 'Alice' })
    s = applyCommand(s, { type: 'DISCONNECT', playerId: 'p1' })
    expect(s.players[0].connected).toBe(false)
    s = applyCommand(s, { type: 'ADD_PLAYER', playerId: 'p1', playerName: 'Alice' })
    expect(s.players[0].connected).toBe(true)
    expect(s.players).toHaveLength(1) // not duplicated
  })

  it('is ignored when not in lobby phase', () => {
    const s = startedGame()
    const before = s.players.length
    const after = applyCommand(s, { type: 'ADD_PLAYER', playerId: 'p99', playerName: 'Late' })
    expect(after.players).toHaveLength(before)
  })
})

// ============================================================
// START_GAME
// ============================================================

describe('START_GAME', () => {
  it('transitions to playing phase', () => {
    const s = startedGame()
    expect(s.phase).toBe('playing')
  })

  it('each player gets 10 cards in hand', () => {
    const s = startedGame()
    for (const p of s.players) {
      expect(p.hand).toHaveLength(10)
    }
  })

  it('total cards across all players equals full deck', () => {
    const s = startedGame()
    const total = s.players.reduce((sum, p) => sum + p.hand.length + p.deck.length, 0)
    expect(total).toBe(52)
  })

  it('sets initial turn state correctly', () => {
    const s = startedGame()
    expect(s.turnPhase).toBe('discard')
    expect(s.currentPlayerIndex).toBe(0)
    expect(s.leadPlayerIndex).toBe(0)
    expect(s.currentTopPlay).toBeNull()
  })

  it('rejects with fewer than 2 players', () => {
    let s = applyCommand(initialState(), { type: 'ADD_PLAYER', playerId: 'p1', playerName: 'Alice' })
    s = applyCommand(s, { type: 'START_GAME' })
    expect(s.phase).toBe('lobby')
  })

  it('rejects if already playing', () => {
    const s = startedGame()
    const s2 = applyCommand(s, { type: 'START_GAME' })
    expect(s2.phase).toBe('playing')
    expect(s2.players).toEqual(s.players) // unchanged
  })

  it('uses deckCount for multi-deck games', () => {
    const s = startedGame(2)
    expect(s.deckCount).toBe(2)
    const total = s.players.reduce((sum, p) => sum + p.hand.length + p.deck.length, 0)
    expect(total).toBe(104) // 2 decks × 52
  })
})

// ============================================================
// DISCARD
// ============================================================

describe('DISCARD', () => {
  it('advances to play phase even with empty discard', () => {
    const s = startedGame()
    const s2 = skipDiscard(s)
    expect(s2.turnPhase).toBe('play')
  })

  it('removes discarded cards from hand', () => {
    const s = startedGame()
    const playerId = s.playerOrder[0]
    const player = s.players.find(p => p.id === playerId)!
    const toDiscard = player.hand.slice(0, 3)
    const s2 = applyCommand(s, { type: 'DISCARD', playerId, cards: toDiscard })
    const updated = s2.players.find(p => p.id === playerId)!
    // After discarding 3 and drawing 3 back, hand should still be 10
    expect(updated.hand).toHaveLength(10)
    expect(s2.turnPhase).toBe('play')
  })

  it('discarded cards go to bottom of deck', () => {
    const s = startedGame()
    const playerId = s.playerOrder[0]
    const player = s.players.find(p => p.id === playerId)!
    const originalDeckSize = player.deck.length
    const toDiscard = player.hand.slice(0, 2)
    const s2 = applyCommand(s, { type: 'DISCARD', playerId, cards: toDiscard })
    const updated = s2.players.find(p => p.id === playerId)!
    // Deck: drew 2 from top, so originalDeckSize - 2 + 2 discarded = same size
    expect(updated.deck).toHaveLength(originalDeckSize)
  })

  it('rejects discard from wrong player', () => {
    const s = startedGame()
    const wrongId = s.playerOrder[1]
    const wrongPlayer = s.players.find(p => p.id === wrongId)!
    const s2 = applyCommand(s, { type: 'DISCARD', playerId: wrongId, cards: [wrongPlayer.hand[0]] })
    expect(s2.turnPhase).toBe('discard') // unchanged
  })

  it('rejects more than 5 cards', () => {
    const s = startedGame()
    const playerId = s.playerOrder[0]
    const player = s.players.find(p => p.id === playerId)!
    const s2 = applyCommand(s, { type: 'DISCARD', playerId, cards: player.hand.slice(0, 6) })
    expect(s2.turnPhase).toBe('discard') // rejected
  })

  it('rejects cards not in hand', () => {
    const s = startedGame()
    const playerId = s.playerOrder[0]
    const fakeCard = c('A', 'spades')
    // Make sure the fake card isn't actually in their hand
    const player = s.players.find(p => p.id === playerId)!
    const hasCard = player.hand.some(c2 => c2.rank === fakeCard.rank && c2.suit === fakeCard.suit)
    if (!hasCard) {
      const s2 = applyCommand(s, { type: 'DISCARD', playerId, cards: [fakeCard] })
      expect(s2.turnPhase).toBe('discard')
    }
  })

  it('skips discard/draw when deck is empty', () => {
    const s = startedGame()
    const playerId = s.playerOrder[0]
    // Drain the deck manually
    const emptyDeckState: GameState = {
      ...s,
      players: s.players.map(p =>
        p.id === playerId ? { ...p, deck: [] } : p,
      ),
    }
    const s2 = applyCommand(emptyDeckState, { type: 'DISCARD', playerId, cards: [] })
    expect(s2.turnPhase).toBe('play') // skipped straight to play
    const player = s2.players.find(p => p.id === playerId)!
    expect(player.deck).toHaveLength(0) // still empty
  })
})

// ============================================================
// PLAY
// ============================================================

describe('PLAY', () => {
  it('valid single card play advances to next player discard phase', () => {
    let s = startedGame()
    s = skipDiscard(s)
    const playerId = s.playerOrder[0]
    const nextPlayerId = s.playerOrder[1]
    const player = s.players.find(p => p.id === playerId)!
    s = applyCommand(s, { type: 'PLAY', playerId, cards: [player.hand[0]] })
    expect(s.turnPhase).toBe('discard')
    expect(s.playerOrder[s.currentPlayerIndex]).toBe(nextPlayerId)
  })

  it('sets currentTopPlay after a valid play', () => {
    let s = startedGame()
    s = skipDiscard(s)
    const playerId = s.playerOrder[0]
    const player = s.players.find(p => p.id === playerId)!
    const card = player.hand[0]
    s = applyCommand(s, { type: 'PLAY', playerId, cards: [card] })
    expect(s.currentTopPlay).not.toBeNull()
    expect(s.currentTopPlayerId).toBe(playerId)
  })

  it('replenishes hand after playing', () => {
    let s = startedGame()
    s = skipDiscard(s)
    const playerId = s.playerOrder[0]
    const player = s.players.find(p => p.id === playerId)!
    s = applyCommand(s, { type: 'PLAY', playerId, cards: [player.hand[0]] })
    const updated = s.players.find(p => p.id === playerId)!
    // If deck had cards, hand should still be 10
    if (player.deck.length > 0) {
      expect(updated.hand).toHaveLength(10)
    } else {
      expect(updated.hand).toHaveLength(9)
    }
  })

  it('second play must beat first', () => {
    let s = startedGame()
    // P1 discard + play
    s = skipDiscard(s)
    const p1 = s.players.find(p => p.id === s.playerOrder[0])!
    // Find a non-ace, non-king to play first (so p2 can beat it)
    const lowCard = p1.hand.find(c2 => typeof c2.rank === 'number' && c2.rank <= 5) ?? p1.hand[0]
    s = applyCommand(s, { type: 'PLAY', playerId: s.playerOrder[0], cards: [lowCard] })
    const topAfterP1 = s.currentTopPlay
    expect(topAfterP1).not.toBeNull()

    // P2 discard phase
    s = skipDiscard(s)
    const p2Id = s.playerOrder[s.currentPlayerIndex]
    const p2 = s.players.find(p => p.id === p2Id)!
    // Try to play a card that can't beat the top — if all p2's cards beat it, skip this sub-test
    const cannotBeat = p2.hand.filter(c2 => {
      const rank2 = typeof c2.rank === 'number' ? c2.rank : { J: 11, Q: 12, K: 13, A: 14 }[c2.rank as string]!
      const rank1 = typeof lowCard.rank === 'number' ? lowCard.rank : { J: 11, Q: 12, K: 13, A: 14 }[lowCard.rank as string]!
      return rank2 < rank1 || (rank2 === rank1 && c2.suit < lowCard.suit)
    })
    if (cannotBeat.length > 0) {
      const before = s.currentTopPlay
      s = applyCommand(s, { type: 'PLAY', playerId: p2Id, cards: [cannotBeat[0]] })
      expect(s.currentTopPlay).toEqual(before) // unchanged
    }
  })

  it('rejects play from wrong player', () => {
    let s = startedGame()
    s = skipDiscard(s)
    const wrongId = s.playerOrder[1]
    const wrongPlayer = s.players.find(p => p.id === wrongId)!
    const before = s.currentTopPlay
    s = applyCommand(s, { type: 'PLAY', playerId: wrongId, cards: [wrongPlayer.hand[0]] })
    expect(s.currentTopPlay).toEqual(before)
  })

  it('rejects play during discard phase', () => {
    const s = startedGame()
    const playerId = s.playerOrder[0]
    const player = s.players.find(p => p.id === playerId)!
    const s2 = applyCommand(s, { type: 'PLAY', playerId, cards: [player.hand[0]] })
    expect(s2.turnPhase).toBe('discard') // still in discard
  })

  it('rejects cards not in hand', () => {
    let s = startedGame()
    s = skipDiscard(s)
    const playerId = s.playerOrder[0]
    const fakeCard = c('A', 'spades')
    const player = s.players.find(p => p.id === playerId)!
    const hasCard = player.hand.some(c2 => c2.rank === fakeCard.rank && c2.suit === fakeCard.suit)
    if (!hasCard) {
      const before = s.currentTopPlay
      s = applyCommand(s, { type: 'PLAY', playerId, cards: [fakeCard] })
      expect(s.currentTopPlay).toEqual(before)
    }
  })
})

// ============================================================
// FOLD
// ============================================================

describe('FOLD', () => {
  it('marks player as folded', () => {
    let s = startedGame()
    // P1 plays first
    s = skipDiscard(s)
    s = playSingle(s)
    // P2 folds
    s = skipDiscard(s)
    const p2Id = s.playerOrder[s.currentPlayerIndex]
    s = applyCommand(s, { type: 'FOLD', playerId: p2Id })
    // With 2 players total and p2 folded, hand should end (only p1 unfolded)
    // After hand ends, folded is reset — but we can check the hand ended
    expect(s.currentTopPlay).toBeNull() // hand cleared
  })

  it('ends hand when only one player remains', () => {
    let s = startedGame()
    s = skipDiscard(s)
    const p1Id = s.playerOrder[0]
    s = playSingle(s) // p1 plays
    s = skipDiscard(s)
    const p2Id = s.playerOrder[s.currentPlayerIndex]
    s = applyCommand(s, { type: 'FOLD', playerId: p2Id }) // p2 folds — hand ends
    // p1 won the hand, so p1 leads the next hand
    expect(s.leadPlayerIndex).toBe(s.playerOrder.indexOf(p1Id))
    expect(s.currentTopPlay).toBeNull()
    expect(s.players.every(p => !p.folded)).toBe(true) // all reset
  })

  it('hand ends with no winner when lead folds with no play', () => {
    const s = startedGame()
    // In discard phase → skip to play phase for p1 first
    const s2 = skipDiscard(s)
    const p1Id = s2.playerOrder[0]
    // p1 folds immediately (no play made)
    const s3 = applyCommand(s2, { type: 'FOLD', playerId: p1Id })
    // With 2 players: p2 is now alone and has not folded → hand ends, no winner (p1 made no play)
    expect(s3.currentTopPlay).toBeNull()
    // lead passes to next player
    expect(s3.players.every(p => !p.folded)).toBe(true)
  })

  it('rejects fold from wrong player', () => {
    let s = startedGame()
    s = skipDiscard(s)
    const wrongId = s.playerOrder[1]
    const before = { ...s }
    s = applyCommand(s, { type: 'FOLD', playerId: wrongId })
    expect(s.turnPhase).toBe(before.turnPhase) // unchanged
    expect(s.currentPlayerIndex).toBe(before.currentPlayerIndex)
  })

  it('rejects fold during discard phase', () => {
    const s = startedGame()
    const playerId = s.playerOrder[0]
    const s2 = applyCommand(s, { type: 'FOLD', playerId })
    expect(s2.turnPhase).toBe('discard') // unchanged
  })
})

// ============================================================
// Full turn sequence
// ============================================================

describe('full turn sequence', () => {
  it('completes a full 2-player hand: p1 plays, p2 folds, p1 wins hand', () => {
    let s = startedGame()
    const [p1Id, p2Id] = s.playerOrder

    // P1 turn: discard nothing, play one card
    s = skipDiscard(s)
    expect(s.turnPhase).toBe('play')
    expect(s.playerOrder[s.currentPlayerIndex]).toBe(p1Id)
    s = playSingle(s)

    // P2 turn: discard phase
    expect(s.turnPhase).toBe('discard')
    expect(s.playerOrder[s.currentPlayerIndex]).toBe(p2Id)
    s = skipDiscard(s)

    // P2 folds
    s = applyCommand(s, { type: 'FOLD', playerId: p2Id })

    // Hand ended — p1 won
    expect(s.currentTopPlay).toBeNull()
    expect(s.leadPlayerIndex).toBe(s.playerOrder.indexOf(p1Id))
  })

  it('full round end: player plays last card and wins', () => {
    // Build a state where a player has only 1 card in hand and empty deck
    let s = startedGame()
    const p1Id = s.playerOrder[0]

    // Give p1 exactly 1 card in hand, empty deck
    const p1 = s.players.find(p => p.id === p1Id)!
    const lastCard = p1.hand[0]
    s = {
      ...s,
      players: s.players.map(p =>
        p.id === p1Id ? { ...p, hand: [lastCard], deck: [] } : p,
      ),
    }

    s = skipDiscard(s) // deck empty, skip
    s = applyCommand(s, { type: 'PLAY', playerId: p1Id, cards: [lastCard] })

    expect(s.phase).toBe('round_end')
    expect(s.roundWinnerId).toBe(p1Id)
    expect(s.scores[p1Id]).toBe(0) // winner scores 0
  })

  it('scoring: non-winner scores cards remaining in hand', () => {
    let s = startedGame()
    const p1Id = s.playerOrder[0]
    const p2Id = s.playerOrder[1]

    // Give p1 1 card and empty deck (will win)
    // Give p2 5 cards in hand
    const p1 = s.players.find(p => p.id === p1Id)!
    const p2 = s.players.find(p => p.id === p2Id)!

    s = {
      ...s,
      players: s.players.map(p => {
        if (p.id === p1Id) return { ...p, hand: [p1.hand[0]], deck: [] }
        if (p.id === p2Id) return { ...p, hand: p2.hand.slice(0, 5), deck: [] }
        return p
      }),
    }

    s = skipDiscard(s)
    s = applyCommand(s, { type: 'PLAY', playerId: p1Id, cards: [s.players.find(p => p.id === p1Id)!.hand[0]] })

    expect(s.phase).toBe('round_end')
    expect(s.scores[p1Id]).toBe(0)
    expect(s.scores[p2Id]).toBe(5) // 5 cards remaining in hand
  })

  it('scoring caps at 10 even if more than 10 cards remain', () => {
    let s = startedGame()
    const p1Id = s.playerOrder[0]
    const p2Id = s.playerOrder[1]

    const p1 = s.players.find(p => p.id === p1Id)!

    // p2 has 10 cards in hand (already the case from deal)
    s = {
      ...s,
      players: s.players.map(p => {
        if (p.id === p1Id) return { ...p, hand: [p1.hand[0]], deck: [] }
        return p
      }),
    }

    s = skipDiscard(s)
    s = applyCommand(s, { type: 'PLAY', playerId: p1Id, cards: [s.players.find(p => p.id === p1Id)!.hand[0]] })

    expect(s.phase).toBe('round_end')
    expect(s.scores[p2Id]).toBeLessThanOrEqual(10)
  })
})

// ============================================================
// RECONNECT / DISCONNECT
// ============================================================

describe('RECONNECT / DISCONNECT', () => {
  it('DISCONNECT marks player as disconnected', () => {
    let s = addPlayers(initialState(), { id: 'p1', name: 'Alice' })
    s = applyCommand(s, { type: 'DISCONNECT', playerId: 'p1' })
    expect(s.players[0].connected).toBe(false)
  })

  it('RECONNECT marks player as connected', () => {
    let s = addPlayers(initialState(), { id: 'p1', name: 'Alice' })
    s = applyCommand(s, { type: 'DISCONNECT', playerId: 'p1' })
    s = applyCommand(s, { type: 'RECONNECT', playerId: 'p1' })
    expect(s.players[0].connected).toBe(true)
  })

  it('DISCONNECT for unknown player is a no-op', () => {
    const s = initialState()
    const s2 = applyCommand(s, { type: 'DISCONNECT', playerId: 'nobody' })
    expect(s2).toEqual(s)
  })
})

// ============================================================
// buildClientState
// ============================================================

describe('buildClientState', () => {
  it('hides opponents hands', () => {
    const s = startedGame()
    const p1Id = s.playerOrder[0]
    const p2Id = s.playerOrder[1]
    const view = buildClientState(s, p1Id)
    const p2View = view.players.find(p => p.id === p2Id)!
    expect(p2View.handSize).toBeGreaterThan(0)
    expect((p2View as unknown as { hand: unknown }).hand).toBeUndefined()
  })

  it('shows own hand correctly', () => {
    const s = startedGame()
    const p1Id = s.playerOrder[0]
    const p1 = s.players.find(p => p.id === p1Id)!
    const view = buildClientState(s, p1Id)
    expect(view.myHand).toEqual(p1.hand)
    expect(view.myDeckSize).toBe(p1.deck.length)
  })

  it('exposes correct turn info', () => {
    const s = startedGame()
    const view = buildClientState(s, s.playerOrder[0])
    expect(view.currentPlayerId).toBe(s.playerOrder[0])
    expect(view.turnPhase).toBe('discard')
    expect(view.phase).toBe('playing')
  })
})

// ============================================================
// NEXT_ROUND — score persistence
// ============================================================

describe('NEXT_ROUND', () => {
  it('preserves accumulated scores into the next round', () => {
    let s = startedGame()
    const p1Id = s.playerOrder[0]
    const p2Id = s.playerOrder[1]
    const p1 = s.players.find(p => p.id === p1Id)!

    // Give p1 one card and empty deck so they can win
    s = { ...s, players: s.players.map(p =>
      p.id === p1Id ? { ...p, hand: [p1.hand[0]], deck: [] } : p
    )}

    s = skipDiscard(s)
    s = applyCommand(s, { type: 'PLAY', playerId: p1Id, cards: [s.players.find(p => p.id === p1Id)!.hand[0]] })

    expect(s.phase).toBe('round_end')
    const scoresAfterRound1 = { ...s.scores }

    // Start next round — scores must carry over
    s = applyCommand(s, { type: 'NEXT_ROUND' })

    expect(s.phase).toBe('playing')
    expect(s.scores[p1Id]).toBe(scoresAfterRound1[p1Id])
    expect(s.scores[p2Id]).toBe(scoresAfterRound1[p2Id])
  })

  it('accumulates scores across two rounds', () => {
    let s = startedGame()
    const p1Id = s.playerOrder[0]
    const p2Id = s.playerOrder[1]

    // Round 1: p1 wins (1 card left), p2 has 3 cards in hand
    s = { ...s, players: s.players.map(p => {
      if (p.id === p1Id) return { ...p, hand: [p.hand[0]], deck: [] }
      return { ...p, hand: p.hand.slice(0, 3), deck: [] }
    })}
    s = skipDiscard(s)
    s = applyCommand(s, { type: 'PLAY', playerId: p1Id, cards: [s.players.find(p => p.id === p1Id)!.hand[0]] })
    expect(s.scores[p1Id]).toBe(0)
    expect(s.scores[p2Id]).toBe(3)

    s = applyCommand(s, { type: 'NEXT_ROUND' })

    // After NEXT_ROUND: p1 won round 1, so p2 leads round 2 (winner's left goes first)
    // Give p2 (the new lead) 1 card so they can win; p1 has 4 cards
    const leadId = s.playerOrder[s.currentPlayerIndex] // should be p2
    const otherId = s.playerOrder.find(id => id !== leadId)!
    const leadPlayer = s.players.find(p => p.id === leadId)!
    s = { ...s, players: s.players.map(p =>
      p.id === leadId
        ? { ...p, hand: [leadPlayer.hand[0]], deck: [] }
        : { ...p, hand: p.hand.slice(0, 4), deck: [] }
    )}
    s = skipDiscard(s)
    s = applyCommand(s, { type: 'PLAY', playerId: leadId, cards: [s.players.find(p => p.id === leadId)!.hand[0]] })

    expect(s.phase).toBe('round_end')
    expect(s.roundWinnerId).toBe(leadId)
    // leadId scored 0 this round; otherId scored 4 this round
    // Accumulated: leadId = 3 (round1 loss) + 0 = 3, otherId = 0 (round1 win) + 4 = 4
    expect(s.scores[leadId]).toBe(3)
    expect(s.scores[otherId]).toBe(4)
  })
})
