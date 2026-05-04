// ============================================================
// ISMCTS bot — Information Set Monte Carlo Tree Search.
//
// Single-tree variant per Cowling/Powley/Whitehouse 2012:
//   - Tree edges keyed by action (not state).
//   - Each iteration: re-determinize the hidden info, walk the tree using
//     UCB1 over actions legal in this determinization, expand+rollout, backprop.
//   - UCB uses per-action visit counts AND per-action availability counts
//     so actions that were legal less often get a fair chance.
//
// The bot's "action" at a turn is { discard, play|fold }. To keep branching
// tight, the discard is a deterministic heuristic; ISMCTS only chooses the
// play/fold. Discard policy: 0 cards if leading, 2 if responding, 5 if folding.
// ============================================================

import type { Card } from './card'
import { createMultiDeck } from './deck'
import type { GameState, BotDifficulty } from './game-state'
import { applyCommand } from './state-machine'
import { generatePlays, chooseDiscard } from './bot-moves'

// ============================================================
// Difficulty presets — map BotDifficulty → ISMCTS knobs.
// "randomActionProb" is a post-search override: with that probability the bot
// picks a uniformly random legal action instead of the searched best, which
// makes weak bots feel beatable rather than just slow.
// ============================================================

interface DifficultyPreset {
  iterations: number
  timeBudgetMs: number
  rolloutTurnLimit: number
  explorationC: number
  randomActionProb: number
}

const DIFFICULTY_PRESETS: Record<BotDifficulty, DifficultyPreset> = {
  easy:   { iterations: 1500,  timeBudgetMs: 150,  rolloutTurnLimit: 30, explorationC: Math.SQRT2, randomActionProb: 0.3 },
  medium: { iterations: 8000,  timeBudgetMs: 700,  rolloutTurnLimit: 40, explorationC: Math.SQRT2, randomActionProb: 0 },
  hard:   { iterations: 20000, timeBudgetMs: 3000, rolloutTurnLimit: 60, explorationC: 1.0,        randomActionProb: 0 },
}

export function presetForDifficulty(difficulty: BotDifficulty): IsmctsConfig {
  const p = DIFFICULTY_PRESETS[difficulty]
  return {
    iterations: p.iterations,
    timeBudgetMs: p.timeBudgetMs,
    rolloutTurnLimit: p.rolloutTurnLimit,
    explorationC: p.explorationC,
    randomActionProb: p.randomActionProb,
  }
}

// ============================================================
// Public API
// ============================================================

export interface BotAction {
  type: 'PLAY' | 'FOLD'
  cards: Card[]   // PLAY: the cards to play; FOLD: empty
}

export interface BotDecision {
  discard: Card[]
  action: BotAction
  iterations: number
  topActionVisits: number
  topActionWinRate: number
  durationMs: number
}

export interface IsmctsConfig {
  iterations?: number       // hard cap on tree iterations (default 1500)
  timeBudgetMs?: number     // wall-clock cap (default 1500ms)
  rolloutTurnLimit?: number // max plies per random rollout (default 40)
  explorationC?: number     // UCB1 exploration constant (default sqrt(2))
  randomActionProb?: number // 0-1: probability of overriding the search with a random legal action (easy mode)
  randomSeed?: number       // for reproducibility in tests
}

export function chooseBotMove(
  state: GameState,
  botId: string,
  config: IsmctsConfig = {},
): BotDecision {
  const cfg = {
    iterations: config.iterations ?? 8000,    // upper cap; the wall-clock budget usually bites first
    timeBudgetMs: config.timeBudgetMs ?? 1500,
    rolloutTurnLimit: config.rolloutTurnLimit ?? 40,
    explorationC: config.explorationC ?? Math.SQRT2,
    randomActionProb: config.randomActionProb ?? 0,
  }
  const rng = makeRng(config.randomSeed ?? Math.floor(Math.random() * 0xffffffff))

  const root: Node = makeNode()
  const start = Date.now()
  let iterations = 0

  while (iterations < cfg.iterations && Date.now() - start < cfg.timeBudgetMs) {
    iterate(root, state, botId, cfg, rng)
    iterations++
  }

  // Pick the action with most visits at root. (Robust to high-variance reward.)
  let bestKey: string | null = null
  let bestVisits = -1
  let bestReward = 0
  for (const [k, e] of root.edges) {
    if (e.visits > bestVisits) {
      bestVisits = e.visits
      bestReward = e.reward
      bestKey = k
    }
  }

  // Fall back to enumerating actions on real state if the tree was empty
  // (e.g. zero iterations completed within the time budget).
  const realActions = enumerateActions(state, botId)
  let chosen: BotAction
  if (bestKey !== null) {
    const found = realActions.find(a => actionKey(a) === bestKey)
    chosen = found ?? realActions[0] ?? { type: 'FOLD', cards: [] }
  } else {
    chosen = realActions[0] ?? { type: 'FOLD', cards: [] }
  }

  // Easy-mode override: occasionally swap the searched best for a random legal action.
  // This is the difference between "weak because it didn't think long" and "weak because it sometimes plays badly".
  if (cfg.randomActionProb > 0 && realActions.length > 1 && rng() < cfg.randomActionProb) {
    chosen = realActions[Math.floor(rng() * realActions.length)]
  }

  // Compute the discard the same way ISMCTS internally would.
  const player = state.players.find(p => p.id === botId)!
  const discardCount = chosen.type === 'FOLD'
    ? 5
    : (state.currentTopPlay === null ? 0 : 2)
  const discard = chooseDiscard(player.hand, player.deck.length, chosen.cards, discardCount)

  return {
    discard,
    action: chosen,
    iterations,
    topActionVisits: Math.max(0, bestVisits),
    topActionWinRate: bestVisits > 0 ? bestReward / bestVisits : 0,
    durationMs: Date.now() - start,
  }
}

// ============================================================
// ISMCTS internals
// ============================================================

interface EdgeStat {
  visits: number      // times this edge was selected
  reward: number      // total reward accumulated through this edge
  available: number   // times this edge was legal at its parent during an iteration
}

interface Node {
  edges: Map<string, EdgeStat>     // action key → stats
  children: Map<string, Node>      // action key → child node
}

function makeNode(): Node {
  return { edges: new Map(), children: new Map() }
}

function newEdge(): EdgeStat {
  return { visits: 0, reward: 0, available: 0 }
}

function iterate(
  root: Node,
  rootState: GameState,
  botId: string,
  cfg: { rolloutTurnLimit: number; explorationC: number },
  rng: () => number,
): void {
  let state = determinize(rootState, botId, rng)
  let node: Node = root
  const path: Array<{ node: Node; edgeKey: string }> = []

  // SELECTION + EXPANSION
  while (true) {
    if (state.phase !== 'playing') break

    const currentId = state.playerOrder[state.currentPlayerIndex]
    state = applyDiscardHeuristic(state, currentId)
    if (state.phase !== 'playing') break

    const actions = enumerateActions(state, currentId)
    if (actions.length === 0) break

    // Increment availability for every legal action at this node
    for (const a of actions) {
      const key = actionKey(a)
      const e = node.edges.get(key) ?? (() => {
        const x = newEdge()
        node.edges.set(key, x)
        return x
      })()
      e.available++
    }

    const unvisited: BotAction[] = []
    for (const a of actions) if (!node.children.has(actionKey(a))) unvisited.push(a)

    if (unvisited.length > 0) {
      // EXPAND
      const a = unvisited[Math.floor(rng() * unvisited.length)]
      const key = actionKey(a)
      state = applyPlayOrFold(state, currentId, a)
      const child = makeNode()
      node.children.set(key, child)
      path.push({ node, edgeKey: key })
      node = child
      break
    }

    // SELECT via UCB1
    const a = ucbSelect(node, actions, cfg.explorationC)
    const key = actionKey(a)
    state = applyPlayOrFold(state, currentId, a)
    path.push({ node, edgeKey: key })
    node = node.children.get(key)!
  }

  // ROLLOUT
  const reward = rollout(state, botId, cfg.rolloutTurnLimit, rng)

  // BACKPROP — update edge stats along the path
  for (const { node: n, edgeKey } of path) {
    const e = n.edges.get(edgeKey)
    if (e) {
      e.visits++
      e.reward += reward
    }
  }
}

function ucbSelect(node: Node, actions: BotAction[], c: number): BotAction {
  let best: BotAction = actions[0]
  let bestScore = -Infinity
  for (const a of actions) {
    const k = actionKey(a)
    const e = node.edges.get(k)
    if (!e || e.visits === 0) {
      // Should not happen at this point (all unvisited get expanded earlier),
      // but if it does, prioritize this action.
      return a
    }
    const exploit = e.reward / e.visits
    const explore = c * Math.sqrt(Math.log(Math.max(1, e.available)) / e.visits)
    const score = exploit + explore
    if (score > bestScore) {
      bestScore = score
      best = a
    }
  }
  return best
}

// ============================================================
// Determinization — sample one plausible world consistent with the bot's view.
// Bot's hand and deck contents are known (deck order is unknown → shuffled).
// Opponents get random card draws from the unseen pool, sized to their counts.
// ============================================================

function determinize(state: GameState, botId: string, rng: () => number): GameState {
  const allCards = createMultiDeck(state.deckCount)

  // Collect known cards (everything the bot can see)
  const known: Card[] = []
  const bot = state.players.find(p => p.id === botId)!
  known.push(...bot.hand, ...bot.deck, ...state.middlePile)
  for (const play of state.currentHandPlays) known.push(...play.hand.cards)

  // Multiset subtraction: allCards − known = unseen pool
  const consumed = new Map<string, number>()
  for (const c of known) {
    const k = `${c.rank}|${c.suit}`
    consumed.set(k, (consumed.get(k) ?? 0) + 1)
  }
  const unseen: Card[] = []
  for (const c of allCards) {
    const k = `${c.rank}|${c.suit}`
    const left = consumed.get(k) ?? 0
    if (left > 0) consumed.set(k, left - 1)
    else unseen.push(c)
  }

  shuffleInPlace(unseen, rng)

  let cursor = 0
  const newPlayers = state.players.map(p => {
    if (p.id === botId) {
      const deck = [...p.deck]
      shuffleInPlace(deck, rng)
      return { ...p, deck }
    }
    const hand = unseen.slice(cursor, cursor + p.hand.length)
    cursor += p.hand.length
    const deck = unseen.slice(cursor, cursor + p.deck.length)
    cursor += p.deck.length
    return { ...p, hand, deck }
  })

  return { ...state, players: newPlayers }
}

// ============================================================
// Rollout — random plausible play to terminal or turn limit, then heuristic eval
// ============================================================

function rollout(
  state: GameState,
  botId: string,
  turnLimit: number,
  rng: () => number,
): number {
  let s = state
  let turns = 0
  while (s.phase === 'playing' && turns < turnLimit) {
    turns++
    const currentId = s.playerOrder[s.currentPlayerIndex]
    s = applyDiscardHeuristic(s, currentId)
    if (s.phase !== 'playing') break

    const actions = enumerateActions(s, currentId)
    if (actions.length === 0) break

    const plays = actions.filter(a => a.type === 'PLAY')
    const folds = actions.filter(a => a.type === 'FOLD')
    let chosen: BotAction
    if (plays.length === 0) {
      chosen = folds[0] ?? actions[0]
    } else {
      // Bias: prefer playing; rare fold to mimic human caution when responding
      const foldProb = (s.currentTopPlay !== null && folds.length > 0) ? 0.12 : 0
      if (rng() < foldProb) chosen = folds[0]
      else chosen = plays[Math.floor(rng() * plays.length)]
    }
    s = applyPlayOrFold(s, currentId, chosen)
  }

  return rewardFor(s, botId)
}

function rewardFor(state: GameState, botId: string): number {
  if ((state.phase === 'round_end' || state.phase === 'game_end') && state.roundWinnerId === botId) {
    return 1.0
  }
  const bot = state.players.find(p => p.id === botId)!
  if (bot.eliminated) return 0
  const myRemaining = bot.hand.length + bot.deck.length
  const others = state.players
    .filter(p => p.id !== botId && !p.eliminated)
    .map(p => p.hand.length + p.deck.length)
  if (others.length === 0) return 0.5
  const minOther = Math.min(...others)
  if (myRemaining < minOther) return 0.7
  if (myRemaining === minOther) return 0.4
  return Math.max(0, 0.3 - (myRemaining - minOther) * 0.02)
}

// ============================================================
// Action enumeration & application
// ============================================================

function enumerateActions(state: GameState, playerId: string): BotAction[] {
  const player = state.players.find(p => p.id === playerId)
  if (!player || player.folded) return []

  const plays = generatePlays(player.hand, state.currentTopPlay)
  const actions: BotAction[] = plays.map(p => ({ type: 'PLAY' as const, cards: p.cards }))

  // Allow fold only when responding (folding while leading wastes the turn).
  // If there's no top play AND no playable hand, the player must still fold.
  if (state.currentTopPlay !== null) {
    actions.push({ type: 'FOLD', cards: [] })
  } else if (plays.length === 0) {
    actions.push({ type: 'FOLD', cards: [] })
  }
  return actions
}

function actionKey(a: BotAction): string {
  if (a.type === 'FOLD') return 'F'
  const cardKey = a.cards
    .map(c => `${c.rank}${c.suit[0]}`)
    .sort()
    .join(',')
  return `P:${cardKey}`
}

function applyDiscardHeuristic(state: GameState, playerId: string): GameState {
  if (state.turnPhase !== 'discard') return state
  const player = state.players.find(p => p.id === playerId)
  if (!player) return state
  // Default discard count: 0 if leading, 2 if responding (no fold/play info yet,
  // so use the responding default; fold path applies its own 5-card discard via applyPlayOrFold).
  const count = state.currentTopPlay === null ? 0 : 2
  const cards = chooseDiscard(player.hand, player.deck.length, [], count)
  return applyCommand(state, { type: 'DISCARD', playerId, cards })
}

function applyPlayOrFold(state: GameState, playerId: string, action: BotAction): GameState {
  // If we still need to discard (this should only happen if the action is FOLD with
  // a different discard policy than the heuristic), apply a fold-style discard first.
  let s = state
  if (s.turnPhase === 'discard') {
    const player = s.players.find(p => p.id === playerId)
    if (player) {
      const count = action.type === 'FOLD' ? 5 : (s.currentTopPlay === null ? 0 : 2)
      const reserved = action.type === 'PLAY' ? action.cards : []
      const cards = chooseDiscard(player.hand, player.deck.length, reserved, count)
      s = applyCommand(s, { type: 'DISCARD', playerId, cards })
    }
  }
  if (action.type === 'FOLD') {
    s = applyCommand(s, { type: 'FOLD', playerId })
  } else {
    s = applyCommand(s, { type: 'PLAY', playerId, cards: action.cards })
  }
  return s
}

// ============================================================
// Utilities
// ============================================================

function shuffleInPlace<T>(arr: T[], rng: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
}

// mulberry32 — fast, deterministic PRNG for reproducible test runs
function makeRng(seed: number): () => number {
  let a = seed | 0
  return () => {
    a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
