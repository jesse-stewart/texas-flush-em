// ============================================================
// Texas Flush'em bot powered by Claude AI.
//
// Each turn, the bot sends the full game state to Claude as a
// stateless prompt and asks it to call one of three tools:
// `discard`, `play`, or `fold`. The system prompt (game rules
// and strategy guidance) is cached, so per-turn cost is mostly
// the variable game state.
//
// Run:
//   1. cp .env.example .env  (and fill in ANTHROPIC_API_KEY + PARTYKIT_HOST + ROOM_ID)
//   2. npm install
//   3. npm start
// ============================================================

import Anthropic from '@anthropic-ai/sdk'
import { createBot, isMyTurn } from '../../bot-sdk'
import type { Card, ClientGameState } from '../../bot-sdk'
import { config } from './config'
import { buildTurnPrompt } from './prompts'
import { discardTool, playTool, foldTool } from './tools'

const anthropic = new Anthropic()  // reads ANTHROPIC_API_KEY from env

// ---------------- Token accounting ----------------

// Per-million-token pricing for the models we expect to see. Cache read = 0.1× input,
// cache write (5-min TTL) = 1.25× input — the API doesn't tell us the TTL used so we
// assume the SDK default. Falls back to Opus 4.7 pricing for unknown models with a warning.
interface ModelPricing { inputPerM: number; outputPerM: number }
const PRICING: Record<string, ModelPricing> = {
  'claude-opus-4-7':   { inputPerM: 5,  outputPerM: 25 },
  'claude-opus-4-6':   { inputPerM: 5,  outputPerM: 25 },
  'claude-opus-4-5':   { inputPerM: 5,  outputPerM: 25 },
  'claude-sonnet-4-6': { inputPerM: 3,  outputPerM: 15 },
  'claude-sonnet-4-5': { inputPerM: 3,  outputPerM: 15 },
  'claude-haiku-4-5':  { inputPerM: 1,  outputPerM: 5 },
}
const CACHE_READ_MULTIPLIER = 0.1
const CACHE_WRITE_MULTIPLIER = 1.25  // 5-minute TTL (SDK default)

const stats = {
  turns: 0,
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
}

function pricingFor(model: string): ModelPricing {
  // Strip "[1m]" suffix and any other non-pricing modifiers when looking up.
  const base = model.replace(/\[.*?\]$/, '')
  const p = PRICING[base]
  if (p) return p
  console.warn(`[stats] no pricing entry for model "${model}" — falling back to Opus 4.7 rates`)
  return PRICING['claude-opus-4-7']
}

function fmtUsd(amount: number): string {
  if (amount < 0.01) return `$${amount.toFixed(5)}`
  return `$${amount.toFixed(4)}`
}

function fmtNum(n: number): string {
  return n.toLocaleString('en-US')
}

function printSessionSummary(reason: string) {
  if (stats.turns === 0) return
  const p = pricingFor(config.model)
  const inputCost = (stats.inputTokens / 1_000_000) * p.inputPerM
  const outputCost = (stats.outputTokens / 1_000_000) * p.outputPerM
  const cacheReadCost = (stats.cacheReadTokens / 1_000_000) * p.inputPerM * CACHE_READ_MULTIPLIER
  const cacheWriteCost = (stats.cacheWriteTokens / 1_000_000) * p.inputPerM * CACHE_WRITE_MULTIPLIER
  const total = inputCost + outputCost + cacheReadCost + cacheWriteCost
  // What the cache_read tokens would have cost at full input price.
  const cacheReadHypothetical = (stats.cacheReadTokens / 1_000_000) * p.inputPerM
  const savings = cacheReadHypothetical - cacheReadCost

  console.log(`\n=== Session summary (${reason}) ===`)
  console.log(`Model:           ${config.model}`)
  console.log(`Turns played:    ${stats.turns}`)
  console.log(`Tokens:`)
  console.log(`  input:         ${fmtNum(stats.inputTokens).padStart(10)}   ${fmtUsd(inputCost)}`)
  console.log(`  output:        ${fmtNum(stats.outputTokens).padStart(10)}   ${fmtUsd(outputCost)}`)
  console.log(`  cache reads:   ${fmtNum(stats.cacheReadTokens).padStart(10)}   ${fmtUsd(cacheReadCost)}   (saved ~${fmtUsd(savings)} vs uncached)`)
  console.log(`  cache writes:  ${fmtNum(stats.cacheWriteTokens).padStart(10)}   ${fmtUsd(cacheWriteCost)}`)
  console.log(`Estimated total: ${fmtUsd(total)}`)
  console.log(`Per-turn avg:    ${fmtUsd(total / stats.turns)}`)
  console.log(`================================`)
}

// Print summary on Ctrl-C so usage isn't lost mid-game.
let summaryPrinted = false
function exitWithSummary(reason: string) {
  if (!summaryPrinted) {
    summaryPrinted = true
    printSessionSummary(reason)
  }
  process.exit(0)
}
process.on('SIGINT', () => exitWithSummary('interrupted'))
process.on('SIGTERM', () => exitWithSummary('terminated'))

// ---------------- Bot setup ----------------

const bot = createBot({
  host: config.host,
  roomId: config.roomId,
  password: config.password,
  playerName: config.playerName,
  botId: config.playerId,
})

// Guards against re-entering the Claude path while a previous decision is in flight.
// Stateless turns means we should only have one outstanding request at a time per phase.
let inFlight = false
let lastHandledTurnKey = ''
// Track whether we've already topped up the lobby with CPU bots, so we don't keep
// re-adding them on every state broadcast (or after a human removes one).
let lobbyTopUpDone = false
// One-shot flag: schedule the auto-start timer at most once per session.
let autoStartScheduled = false

// A "turn key" identifies one (player, phase, top play) so we don't re-decide
// on every state broadcast — only when the turn actually changes.
function turnKey(state: ClientGameState): string {
  return `${state.currentPlayerId ?? ''}::${state.turnPhase}::${state.currentTopPlayerId ?? ''}::${state.currentHandPlays.length}`
}

bot.onConnect(() => {
  console.log(`[${config.playerName}] connected as ${bot.playerId}`)
  console.log(`[${config.playerName}] room=${config.roomId} model=${config.model} effort=${config.effort}`)
})

bot.onDisconnect(() => {
  console.log(`[${config.playerName}] disconnected — partysocket will reconnect automatically`)
})

bot.onError(err => {
  console.error(`[${config.playerName}] connection error:`, err)
  // Hard-fatal close codes: don't bother retrying.
  if (err.code === 4001) console.error('  → wrong password')
  if (err.code === 4002) console.error('  → rate limited; back off and retry later')
  process.exit(1)
})

bot.onState(async (state: ClientGameState) => {
  // Lobby — optionally top up with CPU bots so a solo human + Claude can play a full table.
  // Each entry in config.extraBots is one bot with its own difficulty. Only happens once per
  // session: if a human removes a CPU later, we don't re-add.
  if (state.phase === 'lobby' && !lobbyTopUpDone && config.extraBots.length > 0) {
    const slotsAvailable = 4 - state.players.length
    const toAdd = config.extraBots.slice(0, slotsAvailable)
    const skipped = config.extraBots.length - toAdd.length
    if (toAdd.length > 0) {
      console.log(`[${config.playerName}] adding ${toAdd.length} CPU bot(s): ${toAdd.join(', ')}`)
      for (const difficulty of toAdd) bot.addBot(difficulty)
    }
    if (skipped > 0) {
      console.warn(`[${config.playerName}] could not add ${skipped} bot(s) — only ${slotsAvailable} slot(s) available`)
    }
    lobbyTopUpDone = true
  }

  // Auto-start: if configured, schedule a one-shot timer. After the delay, if still in
  // lobby with ≥2 players, send START_GAME. The delay gives humans time to join and any
  // ADD_BOT actions we just sent time to register on the server.
  if (state.phase === 'lobby' && config.autoStart && !autoStartScheduled) {
    autoStartScheduled = true
    console.log(`[${config.playerName}] auto-start armed — will start in ${config.autoStartDelayMs}ms if ≥2 players`)
    setTimeout(() => {
      const current = bot.state
      if (!current || current.phase !== 'lobby') {
        console.log(`[${config.playerName}] auto-start: lobby no longer active, skipping`)
        return
      }
      if (current.players.length < 2) {
        console.log(`[${config.playerName}] auto-start: only ${current.players.length} player(s), need ≥2 — skipping`)
        return
      }
      console.log(`[${config.playerName}] auto-start: starting game with ${current.players.length} players`)
      bot.startGame()  // uses engine defaults; pass a Partial<GameOptions> here to customize
    }, config.autoStartDelayMs)
  }

  // Between rounds — auto-ready so the game keeps moving.
  if (state.phase === 'round_end') {
    if (!state.nextRoundReady[bot.playerId]) {
      console.log(`[${config.playerName}] round ended — readying for next round`)
      bot.readyForNextRound()
    }
    return
  }

  if (state.phase === 'game_end') {
    const winner = state.players.find(p => p.id === state.gameWinnerId)
    console.log(`[${config.playerName}] game over — winner: ${winner?.name ?? 'none'}`)
    if (!summaryPrinted) {
      summaryPrinted = true
      printSessionSummary('game over')
    }
    return
  }

  if (state.phase !== 'playing') return
  if (!isMyTurn(state, bot.playerId)) return

  const key = turnKey(state)
  if (key === lastHandledTurnKey) return  // already acted on this turn
  if (inFlight) return                     // a previous call hasn't returned yet

  lastHandledTurnKey = key
  inFlight = true
  try {
    await takeTurn(state)
  } catch (err) {
    console.error(`[${config.playerName}] turn failed — folding/skipping:`, err)
    safeFallback(state)
  } finally {
    inFlight = false
  }
})

bot.connect()

// ----------------------------------------------------------------------------

async function takeTurn(state: ClientGameState) {
  const phase = state.turnPhase
  console.log(`\n[${config.playerName}] my turn — phase=${phase}, hand=${state.myHand.length} cards`)

  // Short-circuit: in the discard phase with an empty deck, the engine auto-skips discard
  // anyway — no real choice to make. Skip the API call entirely.
  if (phase === 'discard' && state.myDeckSize === 0) {
    console.log(`  deck empty — auto-skipping discard (no API call)`)
    bot.discard([])
    return
  }

  const { systemBlocks, userText } = buildTurnPrompt(state, bot.playerId)

  // Constrain the available tools to the current phase. The model can ONLY call
  // these — preventing e.g. fold during the discard phase.
  const tools =
    phase === 'discard'
      ? [discardTool]
      : [playTool, foldTool]

  // 'auto' (not 'any'/'tool'): forced tool_choice is incompatible with adaptive thinking.
  // The phase-restricted tools array + system prompt instruction reliably steer Claude to
  // call a tool; if it ever returns text instead, our fallback folds/skips the turn.
  const tool_choice: Anthropic.Messages.ToolChoice = { type: 'auto' }

  // Build the thinking parameter: 'off' disables thinking entirely (cheapest);
  // 'quiet' / 'summarized' enable adaptive thinking with the corresponding display mode.
  const thinking: Anthropic.Messages.ThinkingConfigParam =
    config.thinking === 'off'
      ? { type: 'disabled' }
      : { type: 'adaptive', display: config.thinking === 'summarized' ? 'summarized' : 'omitted' }

  let response: Anthropic.Message
  try {
    response = await anthropic.messages.create({
      model: config.model,
      max_tokens: config.maxTokens,
      thinking,
      output_config: { effort: config.effort },
      system: systemBlocks,
      tools,
      tool_choice,
      messages: [{ role: 'user', content: userText }],
    })
  } catch (err) {
    // Out-of-credits is fatal: every subsequent turn would hit the same error.
    // Anthropic returns this as a generic 400 with a billing-flavored message
    // (not a dedicated error type), so we string-match on the message — exit cleanly
    // with the session summary instead of looping until the user kills the bot.
    if (err instanceof Anthropic.BadRequestError && /credit balance/i.test(err.message)) {
      console.error(`\n[${config.playerName}] Anthropic credit balance exhausted.`)
      console.error(`  Add credits at https://console.anthropic.com/settings/billing`)
      exitWithSummary('out of credits')
    }
    if (err instanceof Anthropic.AuthenticationError) {
      console.error(`\n[${config.playerName}] Anthropic auth failed — check ANTHROPIC_API_KEY in .env`)
      exitWithSummary('auth failed')
    }
    if (err instanceof Anthropic.RateLimitError) {
      console.error(`[${config.playerName}] Anthropic rate limited — folding to keep the game moving`)
    } else if (err instanceof Anthropic.APIError) {
      console.error(`[${config.playerName}] Anthropic API error ${err.status}: ${err.message}`)
    }
    throw err
  }

  logUsage(response)
  logThinking(response)

  const toolUse = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
  )
  if (!toolUse) {
    throw new Error(`Claude returned no tool call (stop_reason=${response.stop_reason})`)
  }

  console.log(`[${config.playerName}] Claude chose: ${toolUse.name}`)
  dispatch(state, toolUse)
}

function dispatch(state: ClientGameState, toolUse: Anthropic.ToolUseBlock) {
  const input = toolUse.input as Record<string, unknown>

  if (toolUse.name === 'discard') {
    const cards = sanitizeCards(input.cards, state.myHand, 5)
    if (typeof input.reasoning === 'string') console.log(`  reasoning: ${input.reasoning}`)
    console.log(`  discard: ${cards.length === 0 ? '(skip)' : describeCards(cards)}`)
    bot.discard(cards)
    return
  }

  if (toolUse.name === 'play') {
    const cards = sanitizeCards(input.cards, state.myHand, 5)
    if (cards.length === 0) {
      console.warn(`  → play returned no valid cards from our hand; folding instead`)
      bot.fold()
      return
    }
    if (typeof input.reasoning === 'string') console.log(`  reasoning: ${input.reasoning}`)
    if (typeof input.category === 'string') console.log(`  category: ${input.category}`)
    console.log(`  play: ${describeCards(cards)}`)
    bot.play(cards)
    return
  }

  if (toolUse.name === 'fold') {
    if (typeof input.reasoning === 'string') console.log(`  reasoning: ${input.reasoning}`)
    console.log(`  fold`)
    bot.fold()
    return
  }

  throw new Error(`Unknown tool: ${toolUse.name}`)
}

// Validate that every card Claude returned is actually in our hand. Drop ones
// that aren't (and warn). This protects against the bot hanging the game with
// an action the server will silently reject.
function sanitizeCards(input: unknown, hand: Card[], maxCount: number): Card[] {
  if (!Array.isArray(input)) return []
  const remaining: Card[] = [...hand]
  const out: Card[] = []
  for (const raw of input) {
    if (out.length >= maxCount) break
    const card = parseCard(raw)
    if (!card) continue
    const idx = remaining.findIndex(c => sameCard(c, card))
    if (idx === -1) {
      console.warn(`  → Claude tried to use ${describeCard(card)} which is not in our hand; ignoring`)
      continue
    }
    out.push(remaining[idx])  // use the canonical engine value
    remaining.splice(idx, 1)
  }
  return out
}

function parseCard(raw: unknown): Card | null {
  if (!raw || typeof raw !== 'object') return null
  const r = (raw as { rank?: unknown; suit?: unknown })
  if (typeof r.suit !== 'string') return null
  if (typeof r.rank !== 'string' && typeof r.rank !== 'number') return null
  // Normalize: numeric ranks must stay numeric; string face cards stay string.
  return { rank: r.rank as Card['rank'], suit: r.suit as Card['suit'] }
}

function sameCard(a: Card, b: Card): boolean {
  return a.rank === b.rank && a.suit === b.suit
}

const SUIT_LABEL: Record<string, string> = { clubs: '♣', diamonds: '♦', hearts: '♥', spades: '♠' }
function describeCard(c: Card): string { return `${c.rank}${SUIT_LABEL[c.suit] ?? c.suit}` }
function describeCards(cards: Card[]): string { return cards.map(describeCard).join(' ') }

// Last resort: if the Claude path errors, do something legal that doesn't hang the game.
function safeFallback(state: ClientGameState) {
  if (state.turnPhase === 'discard') {
    bot.discard([])
  } else {
    bot.fold()
  }
}

// ----------------------------------------------------------------------------

function logUsage(response: Anthropic.Message) {
  const u = response.usage
  const cacheRead = u.cache_read_input_tokens ?? 0
  const cacheWrite = u.cache_creation_input_tokens ?? 0

  // Accumulate for the end-of-session summary.
  stats.turns += 1
  stats.inputTokens += u.input_tokens
  stats.outputTokens += u.output_tokens
  stats.cacheReadTokens += cacheRead
  stats.cacheWriteTokens += cacheWrite

  console.log(
    `  tokens: in=${u.input_tokens} out=${u.output_tokens}` +
    (cacheRead > 0 ? ` cache_read=${cacheRead}` : '') +
    (cacheWrite > 0 ? ` cache_write=${cacheWrite}` : ''),
  )
}

function logThinking(response: Anthropic.Message) {
  for (const block of response.content) {
    if (block.type === 'thinking' && block.thinking) {
      // Show a one-line excerpt — full thinking can be long.
      const oneLine = block.thinking.replace(/\s+/g, ' ').trim()
      const excerpt = oneLine.length > 200 ? oneLine.slice(0, 200) + '…' : oneLine
      console.log(`  thinking: ${excerpt}`)
    }
  }
}
