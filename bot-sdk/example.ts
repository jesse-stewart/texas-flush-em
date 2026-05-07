// ============================================================
// RandoBot — a minimal example bot.
//
// On every turn it skips the discard, then either plays a random single card
// (when leading) or folds (when following). The point is to show the SDK shape,
// not to play well.
//
// Run with: npx tsx bot-sdk/example.ts
// (Requires `npm i -D tsx` if not already installed.)
// ============================================================

import { createBot, isMyTurn } from './index'
import type { ClientGameState, Card } from './index'

const HOST = process.env.PARTYKIT_HOST ?? 'localhost:1999'
const ROOM = process.env.ROOM ?? 'TESTBOT'
const NAME = process.env.NAME ?? 'RandoBot'

const bot = createBot({
  host: HOST,
  roomId: ROOM,
  playerName: NAME,
})

bot.onConnect(() => console.log(`[${NAME}] connected as ${bot.playerId}`))
bot.onDisconnect(() => console.log(`[${NAME}] disconnected`))
bot.onError(err => console.error(`[${NAME}] connection error:`, err))

bot.onState((state: ClientGameState) => {
  if (state.phase === 'lobby') return
  if (state.phase !== 'playing') return
  if (!isMyTurn(state, bot.playerId)) return

  // Betting phase (only present when the room is chips mode with anteAmount > 0).
  // Naive policy: check when we can, otherwise call. A real bot would weigh hand strength
  // and pot odds — see ApiSpecModal for the betting flow.
  if (state.turnPhase === 'bet') {
    const myCommitted = state.committed[bot.playerId] ?? 0
    if (myCommitted >= state.betToMatch) {
      bot.check()
    } else {
      bot.call()
    }
    return
  }

  if (state.turnPhase === 'discard') {
    bot.discard([])
    return
  }

  // turnPhase === 'play'
  const isLeading = state.currentTopPlay === null
  if (!isLeading) {
    // Real bots would compare hands and try to beat the top play.
    bot.fold()
    return
  }

  const card = pickRandom(state.myHand)
  if (card) {
    bot.play([card])
  } else {
    // Empty hand shouldn't happen mid-turn, but fold defensively.
    bot.fold()
  }
})

bot.connect()

function pickRandom<T>(arr: T[]): T | undefined {
  if (arr.length === 0) return undefined
  return arr[Math.floor(Math.random() * arr.length)] as T
}

// Type-only re-export so this file can serve as a doctest of the public surface.
export type _ExampleSurface = Card
