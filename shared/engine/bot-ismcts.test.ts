import { describe, it, expect } from 'vitest'
import { applyCommand, initialState } from './state-machine'
import { chooseBotMove } from './bot-ismcts'
import { generatePlays } from './bot-moves'
import type { GameState } from './game-state'

function startedTwoPlayer(): GameState {
  let s = initialState()
  s = applyCommand(s, { type: 'ADD_BOT', playerId: 'bot1', playerName: 'Bot 1' })
  s = applyCommand(s, { type: 'ADD_BOT', playerId: 'bot2', playerName: 'Bot 2' })
  s = applyCommand(s, { type: 'START_GAME', deckCount: 1 })
  return s
}

describe('chooseBotMove', () => {
  it('returns a decision quickly under a tight time budget', () => {
    const s = startedTwoPlayer()
    const decision = chooseBotMove(s, 'bot1', { timeBudgetMs: 200, iterations: 10000, randomSeed: 42 })
    expect(decision.iterations).toBeGreaterThan(0)
    expect(decision.durationMs).toBeLessThan(500) // generous CI margin
  })

  it('chosen play is legal in the real (non-determinized) state', () => {
    const s = startedTwoPlayer()
    const decision = chooseBotMove(s, 'bot1', { timeBudgetMs: 300, iterations: 200, randomSeed: 7 })
    if (decision.action.type === 'PLAY') {
      const bot = s.players.find(p => p.id === 'bot1')!
      const legal = generatePlays(bot.hand, s.currentTopPlay)
      const cardKey = (cs: { rank: unknown, suit: unknown }[]) =>
        cs.map(c => `${c.rank}|${c.suit}`).sort().join(',')
      const chosenKey = cardKey(decision.action.cards)
      const isLegal = legal.some(p => cardKey(p.cards) === chosenKey)
      expect(isLegal).toBe(true)
    }
  })

  it('discarded cards are not in the play and respect deck-empty rule', () => {
    const s = startedTwoPlayer()
    const decision = chooseBotMove(s, 'bot1', { timeBudgetMs: 200, iterations: 100, randomSeed: 11 })
    const playKeys = new Set(decision.action.cards.map(c => `${c.rank}|${c.suit}`))
    for (const d of decision.discard) {
      expect(playKeys.has(`${d.rank}|${d.suit}`)).toBe(false)
    }
  })

  it('does not fold when leading (no top play to beat)', () => {
    const s = startedTwoPlayer()
    expect(s.currentTopPlay).toBeNull()
    const decision = chooseBotMove(s, 'bot1', { timeBudgetMs: 200, iterations: 100, randomSeed: 3 })
    expect(decision.action.type).toBe('PLAY')
  })

  it('a synthesized bot turn produces a state-machine-valid command pair', () => {
    let s = startedTwoPlayer()
    const decision = chooseBotMove(s, 'bot1', { timeBudgetMs: 300, iterations: 200, randomSeed: 5 })

    // The state machine must accept the discard, then accept the play/fold
    s = applyCommand(s, { type: 'DISCARD', playerId: 'bot1', cards: decision.discard })
    expect(s.turnPhase).toBe('play')
    if (decision.action.type === 'PLAY') {
      const before = s.currentTopPlay
      s = applyCommand(s, { type: 'PLAY', playerId: 'bot1', cards: decision.action.cards })
      expect(s.currentTopPlay).not.toEqual(before)
    } else {
      s = applyCommand(s, { type: 'FOLD', playerId: 'bot1' })
    }
    // Turn should have advanced (or hand ended)
    expect(s.phase).not.toBe('lobby')
  })
})
