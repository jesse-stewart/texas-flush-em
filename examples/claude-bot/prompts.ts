// ============================================================
// Prompt construction. The system prompt is large and stable
// (cached); the user message is the per-turn game state.
//
// We embed the canonical rules file (public/deck-poker-rules.md)
// verbatim at module load so the bot stays aligned with any rule
// changes without paraphrasing drift.
// ============================================================

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import type { Card, ClientGameState, PlayerView } from '../../bot-sdk'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RULES = readFileSync(join(__dirname, '../../public/deck-poker-rules.md'), 'utf-8')

export const SYSTEM_PROMPT = `You are an expert AI bot playing Texas Flush'em (a.k.a. "Deck Poker"). The full canonical rules are below — read them carefully; they govern legal plays and scoring.

----- BEGIN RULES -----

${RULES}

----- END RULES -----

# Card representation in this API
Cards are JSON objects \`{rank, suit}\`. Numeric ranks 2-10 are JSON **numbers**; face cards "J", "Q", "K", "A" are JSON **strings**. Suits are lowercase strings: "clubs", "diamonds", "hearts", "spades".

# Hand category names (matches \`category\` strings in game state)
Single-deck: HIGH_CARD, PAIR, TWO_PAIR, THREE_OF_A_KIND, STRAIGHT, FLUSH, FULL_HOUSE, FOUR_OF_A_KIND, STRAIGHT_FLUSH, ROYAL_FLUSH.
Mixed-deck variants (only when \`dealMode\` is "mixed" with 2+ decks): FLUSH_PAIR, FLUSH_TWO_PAIR, FLUSH_THREE_OF_A_KIND, FLUSH_FULL_HOUSE, FLUSH_FOUR_OF_A_KIND, FIVE_OF_A_KIND. These slot into the rankings as documented above.

# Strategic guidance (your judgment, not the rules)
- Win condition is emptying your **hand AND deck**. Cards in your deck still count as "yours" until they're drawn and played.
- The discard phase is OPTIONAL. Skip it (empty cards array) when your hand has good combos. Don't break up pairs/flushes/straights without a reason — discarding a duplicate-rank card you're not using to *bottom-of-deck* lets you redraw and possibly cycle through your deck.
- "Hand" ≠ "round". Folding only takes you out of the current **hand** (one sequence of plays in the middle). You'll rejoin on the next hand within the same round. Don't burn strong cards just to stay in a hand you can fold cheaply.
- When LEADING (no top play), the floor is yours — prefer cheap singles or low pairs to bait opponents into spending their strong cards.
- When FOLLOWING, fold if beating the top play would cost you more than it saves. Don't break up a four-of-a-kind to beat a single 9.
- Scoring penalizes cards LEFT IN HAND at round end (capped at 10), not cards in your deck. Late in a round with many cards left, multi-card plays (full houses, straights) shed faster than singles.
- Once your deck is empty, you can no longer discard or draw — your remaining hand is all you have.

# Your action this turn
You'll be told the current phase. Call exactly ONE tool:
- DISCARD phase → call \`discard\` (\`cards\` may be an empty array).
- PLAY phase → call \`play\` (with a legal hand that strictly beats the top play) OR \`fold\`.

Do not emit prose outside the tool call. Use the \`reasoning\` field on the tool to record your strategic justification — this is logged for the operator.`

// ----------------------------------------------------------------------------

const RANK_ORDER: Record<string, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
  J: 11, Q: 12, K: 13, A: 14,
}
const SUIT_LABEL: Record<string, string> = {
  clubs: '♣', diamonds: '♦', hearts: '♥', spades: '♠',
}

function fmtCard(c: Card): string {
  return `${c.rank}${SUIT_LABEL[c.suit] ?? c.suit}`
}

function fmtCards(cards: Card[]): string {
  if (cards.length === 0) return '(none)'
  // Sort by rank then suit for readability — doesn't change meaning.
  const sorted = [...cards].sort((a, b) => {
    const ra = RANK_ORDER[String(a.rank)] ?? 0
    const rb = RANK_ORDER[String(b.rank)] ?? 0
    return ra - rb || a.suit.localeCompare(b.suit)
  })
  return sorted.map(fmtCard).join(' ')
}

function fmtPlayer(p: PlayerView, isMe: boolean, isCurrent: boolean): string {
  const tags: string[] = []
  if (isMe) tags.push('YOU')
  if (isCurrent) tags.push('to play')
  if (p.isBot) tags.push('CPU')
  if (p.isApi) tags.push('API')
  if (p.folded) tags.push('folded')
  if (p.eliminated) tags.push('out')
  if (!p.isConnected) tags.push('disconnected')
  const tagStr = tags.length > 0 ? ` [${tags.join(', ')}]` : ''
  return `- ${p.name}${tagStr}: hand=${p.handSize}, deck=${p.deckSize}`
}

export interface TurnPrompt {
  systemBlocks: { type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }[]
  userText: string
}

// Build the per-turn prompt. The system prompt is reused (and cached); the user message
// describes the current state and tells Claude which phase it's in.
export function buildTurnPrompt(state: ClientGameState, myPlayerId: string): TurnPrompt {
  const me = state.players.find(p => p.id === myPlayerId)
  if (!me) throw new Error('My player not found in state')

  const opts = state.options
  const lines: string[] = []

  // Multi-deck flush variants are only unlocked in MIXED mode (shared pool of 2+ decks
   // can put duplicates in one player's hand). Classic uses one deck; personal gives each
   // player their own private deck so a single player never holds duplicates.
  const flushVariantsActive = opts.dealMode === 'mixed' && opts.mixedDeckCount >= 2
  const dealDescription =
    opts.dealMode === 'classic' ? 'classic — single 52-card deck dealt round-robin' :
    opts.dealMode === 'personal' ? `personal — each player has their own private ${opts.cardsPerPlayer}-card deck` :
    `mixed — ${opts.mixedDeckCount} decks shuffled together (${opts.mixedDeckCount * 52} total cards), ${opts.cardsPerPlayer} dealt to each player`

  lines.push(`# Game configuration`)
  lines.push(`- Deal mode: ${dealDescription}`)
  lines.push(`- Cards per player at start: ${opts.dealMode === 'classic' ? `~${Math.ceil(52 / state.players.length)}` : opts.cardsPerPlayer}`)
  if (flushVariantsActive) {
    const variantsAvailable: string[] = ['FLUSH_PAIR', 'FLUSH_TWO_PAIR', 'FLUSH_FULL_HOUSE', 'FIVE_OF_A_KIND']
    if (opts.mixedDeckCount >= 3) variantsAvailable.push('FLUSH_THREE_OF_A_KIND')
    if (opts.mixedDeckCount >= 4) variantsAvailable.push('FLUSH_FOUR_OF_A_KIND')
    lines.push(`- Multi-deck flush variants: ENABLED — duplicate cards can appear in your hand. Available variants: ${variantsAvailable.join(', ')}.`)
  } else {
    lines.push(`- Multi-deck flush variants: DISABLED — every card in your hand is unique. Use only single-deck categories.`)
  }
  lines.push(`- Scoring: ${opts.scoringMode} (threshold ${opts.threshold})`)
  if (opts.scoringMode === 'points') lines.push(`- On reach: ${opts.pointsThresholdAction}`)
  lines.push('')

  lines.push(`# Players`)
  for (const p of state.players) {
    lines.push(fmtPlayer(p, p.id === myPlayerId, state.currentPlayerId === p.id))
  }
  lines.push('')

  lines.push(`# Scores`)
  for (const p of state.players) {
    const score = state.scores[p.id] ?? 0
    const delta = state.roundScoreDelta[p.id]
    const deltaStr = delta != null && delta !== 0 ? ` (Δ ${delta > 0 ? '+' : ''}${delta} this round)` : ''
    lines.push(`- ${p.name}: ${score}${deltaStr}`)
  }
  lines.push('')

  lines.push(`# Your hand (${state.myHand.length} cards)`)
  lines.push(fmtCards(state.myHand))
  lines.push(`Your deck has ${state.myDeckSize} cards remaining.`)
  lines.push('')

  if (state.currentTopPlay) {
    const tp = state.currentTopPlay
    const player = state.players.find(p => p.id === state.currentTopPlayerId)
    lines.push(`# Current top play (you must STRICTLY beat this to play)`)
    lines.push(`- Played by: ${player?.name ?? 'unknown'}`)
    lines.push(`- Category: ${tp.category}`)
    lines.push(`- Cards: ${fmtCards(tp.cards)}`)
    lines.push('')
  } else {
    lines.push(`# No top play yet`)
    lines.push(`You are LEADING this hand — any legal poker hand is allowed.`)
    lines.push('')
  }

  if (state.currentHandPlays.length > 0) {
    lines.push(`# Plays this hand (oldest → newest)`)
    for (const hp of state.currentHandPlays) {
      const pname = state.players.find(p => p.id === hp.playerId)?.name ?? hp.playerId
      lines.push(`- ${pname}: ${hp.hand.category} — ${fmtCards(hp.hand.cards)}`)
    }
    lines.push('')
  }

  lines.push(`# Your turn`)
  if (state.turnPhase === 'discard') {
    if (state.myDeckSize === 0) {
      lines.push(`Your deck is empty — discard is automatically skipped. Call 'discard' with an empty cards array to advance.`)
    } else {
      lines.push(`Phase: **DISCARD**. Choose 0-5 cards from your hand to send to the bottom of your deck (and replace by drawing). Discarding is optional — pass an empty array to skip.`)
    }
  } else {
    lines.push(`Phase: **PLAY**. Either play a legal hand (call 'play') or give up this hand (call 'fold').`)
  }
  lines.push(``)
  lines.push(`Call exactly one tool. No prose outside the tool call.`)

  // Cache the system prompt — it's stable across all turns.
  return {
    systemBlocks: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    userText: lines.join('\n'),
  }
}
