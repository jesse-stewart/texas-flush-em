import type { Card } from './card'
import { createDeck, createMultiDeck, shuffle, dealAll, drawFromTop, insertToBottom } from './deck'
import { evaluateHand } from './hand-eval'
import type { EvaluatedHand } from './hand-eval'
import { validatePlay, validateDiscard, scoreRound } from './rules'
import type { GameState, GameOptions, PlayerState, HandPlay } from './game-state'
import { DEFAULT_OPTIONS, MIN_CARDS_PER_PLAYER } from './game-state'

// ============================================================
// Dealing — branches by dealMode. Returns one full pile (deck + initial hand) per player.
// ============================================================

function dealForMode(options: GameOptions, playerCount: number): Card[][] {
  if (options.dealMode === 'personal') {
    // Each player has their own independently-shuffled private deck.
    return Array.from({ length: playerCount }, () =>
      shuffle(createDeck()).slice(0, options.cardsPerPlayer)
    )
  }
  if (options.dealMode === 'mixed') {
    // mixedDeckCount × 52 shared pool; each player drawn cardsPerPlayer; leftovers discarded.
    const pool = shuffle(createMultiDeck(options.mixedDeckCount))
    const piles: Card[][] = []
    for (let i = 0; i < playerCount; i++) {
      piles.push(pool.slice(i * options.cardsPerPlayer, (i + 1) * options.cardsPerPlayer))
    }
    return piles
  }
  // classic: single 52-card deck dealt round-robin (remainder to early players).
  return dealAll(shuffle(createDeck()), playerCount)
}

// "Logical" deck count for the bot's hidden-card reasoning.
function effectiveDeckCount(options: GameOptions, playerCount: number): number {
  if (options.dealMode === 'mixed') return options.mixedDeckCount
  if (options.dealMode === 'personal') return playerCount
  return 1
}

// ============================================================
// Commands — server-side actions (playerId added by the server)
// ============================================================

export type GameCommand =
  | { type: 'ADD_PLAYER'; playerId: string; playerName: string }
  | { type: 'ADD_BOT'; playerId: string; playerName: string }
  | { type: 'REMOVE_BOT'; playerId: string }
  | { type: 'START_GAME'; options?: Partial<GameOptions> }
  | { type: 'NEXT_ROUND' }
  | { type: 'DISCARD'; playerId: string; cards: Card[] }
  | { type: 'PLAY'; playerId: string; cards: Card[] }
  | { type: 'FOLD'; playerId: string }
  | { type: 'LEAVE'; playerId: string }
  | { type: 'RECONNECT'; playerId: string }
  | { type: 'DISCONNECT'; playerId: string }
  | { type: 'DEBUG_SET_HAND'; playerId: string; count: number }

// ============================================================
// Client view — what each player sees (opponents' hands hidden)
// ============================================================

export interface PlayerView {
  id: string
  name: string
  handSize: number
  deckSize: number
  folded: boolean
  isConnected: boolean
  eliminated: boolean
  isBot: boolean
}

export interface ClientGameState {
  phase: 'lobby' | 'playing' | 'round_end' | 'game_end' | 'abandoned'
  abandonedByName: string | null
  players: PlayerView[]
  myHand: Card[]
  myDeckSize: number
  turnPhase: 'discard' | 'play'
  currentTopPlay: EvaluatedHand | null
  currentTopPlayerId: string | null
  currentHandPlays: HandPlay[]
  currentPlayerId: string | null
  leadPlayerId: string | null
  roundWinnerId: string | null
  gameWinnerId: string | null
  scores: Record<string, number>
  roundScoreDelta: Record<string, number>
  middlePileCount: number
  options: GameOptions
}

export function buildClientState(state: GameState, forPlayerId: string): ClientGameState {
  const me = state.players.find(p => p.id === forPlayerId)
  return {
    phase: state.phase,
    players: state.players.map(p => ({
      id: p.id,
      name: p.name,
      handSize: p.hand.length,
      deckSize: p.deck.length,
      folded: p.folded,
      isConnected: p.connected,
      eliminated: p.eliminated,
      isBot: p.isBot,
    })),
    myHand: me?.hand ?? [],
    myDeckSize: me?.deck.length ?? 0,
    turnPhase: state.turnPhase,
    currentTopPlay: state.currentTopPlay,
    currentTopPlayerId: state.currentTopPlayerId,
    currentHandPlays: state.currentHandPlays ?? [],
    currentPlayerId: state.playerOrder[state.currentPlayerIndex] ?? null,
    leadPlayerId: state.playerOrder[state.leadPlayerIndex] ?? null,
    roundWinnerId: state.roundWinnerId,
    gameWinnerId: state.gameWinnerId,
    scores: state.scores,
    roundScoreDelta: state.roundScoreDelta,
    abandonedByName: state.abandonedByName,
    middlePileCount: state.middlePile.length,
    options: state.options,
  }
}

// ============================================================
// Initial state
// ============================================================

export function initialState(): GameState {
  return {
    phase: 'lobby',
    players: [],
    playerOrder: [],
    currentPlayerIndex: 0,
    leadPlayerIndex: 0,
    turnPhase: 'discard',
    currentTopPlay: null,
    currentTopPlayerId: null,
    currentHandPlays: [],
    middlePile: [],
    roundWinnerId: null,
    gameWinnerId: null,
    scores: {},
    roundScoreDelta: {},
    deckCount: 1,
    options: { ...DEFAULT_OPTIONS },
    abandonedByName: null,
  }
}

// ============================================================
// Reducer — pure, returns new state (never mutates)
// ============================================================

export function applyCommand(state: GameState, cmd: GameCommand): GameState {
  switch (cmd.type) {
    case 'ADD_PLAYER':  return applyAddPlayer(state, cmd, false)
    case 'ADD_BOT':     return applyAddPlayer(state, cmd, true)
    case 'REMOVE_BOT':  return applyRemoveBot(state, cmd)
    case 'START_GAME':  return applyStartGame(state, cmd)
    case 'NEXT_ROUND':  return applyNextRound(state)
    case 'DISCARD':     return applyDiscard(state, cmd)
    case 'PLAY':        return applyPlay(state, cmd)
    case 'FOLD':        return applyFold(state, cmd)
    case 'LEAVE':            return applyLeave(state, cmd)
    case 'RECONNECT':        return applyReconnect(state, cmd)
    case 'DISCONNECT':       return applyDisconnect(state, cmd)
    case 'DEBUG_SET_HAND':   return applyDebugSetHand(state, cmd)
  }
}

// ============================================================
// Internal helpers
// ============================================================

function updatePlayer(state: GameState, updated: PlayerState): GameState {
  return {
    ...state,
    players: state.players.map(p => p.id === updated.id ? updated : p),
  }
}

function drawUpTo10(player: PlayerState): PlayerState {
  const needed = Math.max(0, 10 - player.hand.length)
  if (needed === 0 || player.deck.length === 0) return player
  const { drawn, remaining } = drawFromTop(player.deck, needed)
  return { ...player, hand: [...player.hand, ...drawn], deck: remaining }
}

// Next player index clockwise who hasn't folded, starting after fromIndex
function nextActiveIndex(state: GameState, fromIndex: number): number {
  const len = state.playerOrder.length
  for (let i = 1; i < len; i++) {
    const idx = (fromIndex + i) % len
    const player = state.players.find(p => p.id === state.playerOrder[idx])
    if (player && !player.folded) return idx
  }
  return fromIndex
}

function removeCardsFromHand(hand: Card[], toRemove: Card[]): Card[] | null {
  const result = [...hand]
  for (const card of toRemove) {
    const idx = result.findIndex(c => c.rank === card.rank && c.suit === card.suit)
    if (idx === -1) return null
    result.splice(idx, 1)
  }
  return result
}

// Wrap up the current hand: set aside played cards, reset folded, set new lead
function endHand(
  state: GameState,
  players: PlayerState[],
  winnerId: string | null,
): GameState {
  const resetPlayers = players.map(p => ({ ...p, folded: false }))

  const newLeadIndex = winnerId !== null
    ? state.playerOrder.indexOf(winnerId)
    : (state.leadPlayerIndex + 1) % state.playerOrder.length

  const sweptCards = state.currentTopPlay?.cards ?? []

  return {
    ...state,
    players: resetPlayers,
    currentTopPlay: null,
    currentTopPlayerId: null,
    currentHandPlays: [],
    currentPlayerIndex: newLeadIndex,
    leadPlayerIndex: newLeadIndex,
    turnPhase: 'discard',
    middlePile: [...state.middlePile, ...sweptCards],
  }
}

function endRound(state: GameState, players: PlayerState[], winnerId: string): GameState {
  // Raw per-loser amount: cards remaining in hand, capped at 10. Winner = 0.
  // Already-eliminated players contribute 0 (they aren't playing).
  const lossPerPlayer = scoreRound(state, winnerId)
  const { scoringMode, threshold, pointsThresholdAction } = state.options

  // delta: signed change applied to scores this round (semantics differ by mode).
  const delta: Record<string, number> = {}
  const scores: Record<string, number> = { ...state.scores }

  if (scoringMode === 'chips') {
    // Losers pay chips equal to their card count; winner takes the pot.
    let pot = 0
    for (const [id, amt] of Object.entries(lossPerPlayer)) {
      if (id === winnerId) continue
      const player = players.find(p => p.id === id)
      // Already-eliminated players don't lose chips; cap loss at the player's current balance
      // so chips never go negative.
      const lost = player && !player.eliminated ? Math.min(amt, scores[id] ?? 0) : 0
      delta[id] = -lost
      scores[id] = (scores[id] ?? 0) - lost
      pot += lost
    }
    delta[winnerId] = pot
    scores[winnerId] = (scores[winnerId] ?? 0) + pot
  } else {
    // Points mode: penalty points accumulate for losers; winner is unchanged.
    for (const [id, amt] of Object.entries(lossPerPlayer)) {
      const isWinner = id === winnerId
      const pts = isWinner ? 0 : amt
      delta[id] = pts
      scores[id] = (scores[id] ?? 0) + pts
    }
  }

  // Apply elimination per mode.
  // Chips: a player with 0 chips is out. Points + eliminate: a player at/over threshold is out.
  // Points + end_game: nobody is eliminated mid-game; the whole game ends when threshold is hit.
  let updatedPlayers = players
  if (scoringMode === 'chips') {
    updatedPlayers = players.map(p =>
      !p.eliminated && (scores[p.id] ?? 0) <= 0 ? { ...p, eliminated: true } : p
    )
  } else if (pointsThresholdAction === 'eliminate') {
    updatedPlayers = players.map(p =>
      !p.eliminated && (scores[p.id] ?? 0) >= threshold ? { ...p, eliminated: true } : p
    )
  }

  const thresholdHitInEndGameMode =
    scoringMode === 'points' &&
    pointsThresholdAction === 'end_game' &&
    Object.values(scores).some(s => s >= threshold)

  // Game-end conditions:
  //  - chips / points-eliminate: ≤1 non-eliminated player remains
  //  - points-end_game: any player hit the threshold this round
  const remaining = updatedPlayers.filter(p => !p.eliminated)
  if (remaining.length <= 1 || thresholdHitInEndGameMode) {
    // Pick a game winner.
    // Single-survivor cases: that's the winner.
    // points-end_game: lowest cumulative score wins (ties broken by player order).
    let gameWinnerId: string | null
    if (thresholdHitInEndGameMode) {
      const candidates = updatedPlayers.filter(p => !p.eliminated)
      gameWinnerId = candidates.reduce<PlayerState | null>((best, p) => {
        if (!best) return p
        return (scores[p.id] ?? 0) < (scores[best.id] ?? 0) ? p : best
      }, null)?.id ?? null
    } else {
      gameWinnerId = remaining[0]?.id ?? null
    }
    return {
      ...state,
      players: updatedPlayers,
      phase: 'game_end',
      roundWinnerId: winnerId,
      gameWinnerId,
      scores,
      roundScoreDelta: delta,
    }
  }

  return {
    ...state,
    players: updatedPlayers,
    phase: 'round_end',
    roundWinnerId: winnerId,
    scores,
    roundScoreDelta: delta,
  }
}

// ============================================================
// Command handlers
// ============================================================

function applyAddPlayer(
  state: GameState,
  cmd: { playerId: string; playerName: string },
  isBot: boolean,
): GameState {
  if (state.phase !== 'lobby') return state
  if (state.players.length >= 4) return state
  if (state.players.some(p => p.id === cmd.playerId)) {
    // Already joined — mark as reconnected (humans only; bots are always connected)
    if (isBot) return state
    return updatePlayer(state, {
      ...state.players.find(p => p.id === cmd.playerId)!,
      connected: true,
    })
  }

  const newPlayer: PlayerState = {
    id: cmd.playerId,
    name: cmd.playerName,
    deck: [],
    hand: [],
    folded: false,
    connected: true,
    eliminated: false,
    isBot,
  }

  return {
    ...state,
    players: [...state.players, newPlayer],
    scores: { ...state.scores, [cmd.playerId]: 0 },
  }
}

function applyRemoveBot(state: GameState, cmd: { playerId: string }): GameState {
  if (state.phase !== 'lobby') return state
  const target = state.players.find(p => p.id === cmd.playerId)
  if (!target || !target.isBot) return state
  return {
    ...state,
    players: state.players.filter(p => p.id !== cmd.playerId),
    scores: Object.fromEntries(Object.entries(state.scores).filter(([id]) => id !== cmd.playerId)),
  }
}

function applyStartGame(state: GameState, cmd: { options?: Partial<GameOptions> }): GameState {
  if (state.phase !== 'lobby') return state
  if (state.players.length < 2) return state

  const merged: GameOptions = { ...DEFAULT_OPTIONS, ...(cmd.options ?? {}) }
  // Defense in depth: the lobby UI clamps these, but a malformed action shouldn't be able to
  // start a game where the initial draw-to-10 can't be satisfied.
  const options: GameOptions = {
    ...merged,
    cardsPerPlayer: Math.max(MIN_CARDS_PER_PLAYER, merged.cardsPerPlayer),
  }
  const piles = dealForMode(options, state.players.length)

  const players = state.players.map((p, i) => {
    const { drawn, remaining } = drawFromTop(piles[i], 10)
    return { ...p, deck: remaining, hand: drawn, folded: false }
  })

  const playerOrder = players.map(p => p.id)
  // Chips mode starts each player with `threshold` chips; points mode starts at 0.
  const initialScore = options.scoringMode === 'chips' ? options.threshold : 0
  const scores: Record<string, number> = {}
  for (const p of players) scores[p.id] = initialScore

  return {
    ...state,
    phase: 'playing',
    players,
    playerOrder,
    currentPlayerIndex: 0,
    leadPlayerIndex: 0,
    turnPhase: 'discard',
    currentTopPlay: null,
    currentTopPlayerId: null,
    currentHandPlays: [],
    middlePile: [],
    roundWinnerId: null,
    scores,
    roundScoreDelta: {},
    deckCount: effectiveDeckCount(options, players.length),
    options,
  }
}

function applyNextRound(state: GameState): GameState {
  if (state.phase !== 'round_end') return state

  // Only non-eliminated players participate in the next round
  const activePlayers = state.players.filter(p => !p.eliminated)
  const piles = dealForMode(state.options, activePlayers.length)

  const updatedActive = activePlayers.map((p, i) => {
    const { drawn, remaining } = drawFromTop(piles[i], 10)
    return { ...p, deck: remaining, hand: drawn, folded: false }
  })

  const players = state.players.map(p => {
    if (p.eliminated) return p
    return updatedActive.find(a => a.id === p.id)!
  })

  const newPlayerOrder = activePlayers.map(p => p.id)

  // Winner's left goes first; fall back to index 0
  const winnerIndex = state.roundWinnerId ? newPlayerOrder.indexOf(state.roundWinnerId) : -1
  const leadIndex = winnerIndex !== -1 ? (winnerIndex + 1) % newPlayerOrder.length : 0

  return {
    ...state,
    phase: 'playing',
    players,
    playerOrder: newPlayerOrder,
    currentPlayerIndex: leadIndex,
    leadPlayerIndex: leadIndex,
    turnPhase: 'discard',
    currentTopPlay: null,
    currentTopPlayerId: null,
    currentHandPlays: [],
    middlePile: [],
    roundWinnerId: null,
    // Personal mode's effective deck count tracks playerCount, which can shrink after eliminations.
    deckCount: effectiveDeckCount(state.options, activePlayers.length),
  }
}

function applyDiscard(
  state: GameState,
  cmd: { playerId: string; cards: Card[] },
): GameState {
  if (state.phase !== 'playing') return state
  if (state.playerOrder[state.currentPlayerIndex] !== cmd.playerId) return state
  if (state.turnPhase !== 'discard') return state

  const player = state.players.find(p => p.id === cmd.playerId)
  if (!player) return state

  // Deck empty: skip discard/draw per rules
  if (player.deck.length === 0) return { ...state, turnPhase: 'play' }

  // Validate discard
  const validation = validateDiscard(state, cmd.playerId, cmd.cards)
  if (!validation.ok) return state

  // Remove discarded cards from hand
  const newHand = removeCardsFromHand(player.hand, cmd.cards)
  if (!newHand) return state

  // Insert to bottom of deck, then draw up to 10
  const deckWithDiscards = insertToBottom(player.deck, cmd.cards)
  const needed = Math.max(0, 10 - newHand.length)
  const { drawn, remaining } = drawFromTop(deckWithDiscards, needed)

  const updated = { ...player, hand: [...newHand, ...drawn], deck: remaining }
  return { ...updatePlayer(state, updated), turnPhase: 'play' }
}

function applyPlay(
  state: GameState,
  cmd: { playerId: string; cards: Card[] },
): GameState {
  if (state.phase !== 'playing') return state
  if (state.playerOrder[state.currentPlayerIndex] !== cmd.playerId) return state
  if (state.turnPhase !== 'play') return state

  const validation = validatePlay(state, cmd.playerId, cmd.cards)
  if (!validation.ok) return state

  const evaluatedHand = evaluateHand(cmd.cards) as EvaluatedHand

  const player = state.players.find(p => p.id === cmd.playerId)!

  // Remove played cards from hand
  const newHand = removeCardsFromHand(player.hand, cmd.cards)
  if (!newHand) return state

  // Replenish hand from deck
  const replenished = drawUpTo10({ ...player, hand: newHand })

  let players = state.players.map(p => p.id === cmd.playerId ? replenished : p)

  const newHandPlay: HandPlay = { hand: evaluatedHand, playerId: cmd.playerId }
  const updatedHandPlays = [...state.currentHandPlays, newHandPlay]

  // Round end: player emptied all their cards
  if (replenished.hand.length === 0 && replenished.deck.length === 0) {
    return endRound({ ...state, currentTopPlay: evaluatedHand, currentTopPlayerId: cmd.playerId, currentHandPlays: updatedHandPlays }, players, cmd.playerId)
  }

  // Hand end: all other players have already folded
  const active = players.filter(p => !p.folded)
  if (active.length === 1 && active[0].id === cmd.playerId) {
    const nextState = { ...state, players, currentTopPlay: evaluatedHand, currentTopPlayerId: cmd.playerId, currentHandPlays: updatedHandPlays }
    return endHand(nextState, players, cmd.playerId)
  }

  // Continue — advance to next active player
  const nextIndex = nextActiveIndex({ ...state, players }, state.currentPlayerIndex)
  return {
    ...state,
    players,
    currentTopPlay: evaluatedHand,
    currentTopPlayerId: cmd.playerId,
    currentHandPlays: updatedHandPlays,
    currentPlayerIndex: nextIndex,
    turnPhase: 'discard',
  }
}

function applyFold(state: GameState, cmd: { playerId: string }): GameState {
  if (state.phase !== 'playing') return state
  if (state.playerOrder[state.currentPlayerIndex] !== cmd.playerId) return state
  if (state.turnPhase !== 'play') return state

  const player = state.players.find(p => p.id === cmd.playerId)
  if (!player) return state

  const players = state.players.map(p => p.id === cmd.playerId ? { ...p, folded: true } : p)
  const active = players.filter(p => !p.folded)

  // Hand ends when ≤1 player remains un-folded
  if (active.length <= 1) {
    // Winner is whoever made the last play; null if no play was made this hand
    return endHand({ ...state, players }, players, state.currentTopPlayerId)
  }

  // Continue to next active player
  const nextIndex = nextActiveIndex({ ...state, players }, state.currentPlayerIndex)
  return {
    ...state,
    players,
    currentPlayerIndex: nextIndex,
    turnPhase: 'discard',
  }
}

function applyDebugSetHand(state: GameState, cmd: { playerId: string; count: number }): GameState {
  const player = state.players.find(p => p.id === cmd.playerId)
  if (!player) return state
  const all = [...player.hand, ...player.deck]
  const kept = all.slice(0, Math.max(0, cmd.count))
  const newHand = kept.slice(0, 10)
  const newDeck = kept.slice(10)
  return updatePlayer(state, { ...player, hand: newHand, deck: newDeck })
}

function applyLeave(state: GameState, cmd: { playerId: string }): GameState {
  const player = state.players.find(p => p.id === cmd.playerId)
  if (!player) return state
  if (state.phase === 'game_end' || state.phase === 'abandoned') return state

  if (state.phase === 'lobby') {
    // Remove from lobby entirely
    return {
      ...state,
      players: state.players.filter(p => p.id !== cmd.playerId),
      scores: Object.fromEntries(Object.entries(state.scores).filter(([id]) => id !== cmd.playerId)),
    }
  }

  // In-game: eliminate the player and remove from turn order
  const players = state.players.map(p =>
    p.id === cmd.playerId ? { ...p, eliminated: true, folded: true, connected: false } : p
  )

  const leavingOrderIdx = state.playerOrder.indexOf(cmd.playerId)
  const newPlayerOrder = state.playerOrder.filter(id => id !== cmd.playerId)

  // If ≤1 active player remains, end the game
  if (newPlayerOrder.length <= 1) {
    const gameWinnerId = newPlayerOrder[0] ?? null
    return {
      ...state,
      players,
      playerOrder: newPlayerOrder,
      phase: 'game_end',
      gameWinnerId,
    }
  }

  if (state.phase === 'round_end') {
    return { ...state, players, playerOrder: newPlayerOrder }
  }

  // phase === 'playing': fix turn indices
  const currentPlayerId = state.playerOrder[state.currentPlayerIndex]
  const leadPlayerId = state.playerOrder[state.leadPlayerIndex]

  let newCurrentIndex: number
  if (currentPlayerId === cmd.playerId) {
    // It was their turn — advance to the next slot in the new order
    newCurrentIndex = leavingOrderIdx % newPlayerOrder.length
  } else {
    newCurrentIndex = newPlayerOrder.indexOf(currentPlayerId)
    if (newCurrentIndex === -1) newCurrentIndex = 0
  }

  let newLeadIndex = newPlayerOrder.indexOf(leadPlayerId)
  if (newLeadIndex === -1) {
    newLeadIndex = leavingOrderIdx % newPlayerOrder.length
  }

  // If only one unfolded player remains in this hand, end the hand
  const unfolded = players.filter(p => newPlayerOrder.includes(p.id) && !p.folded)
  if (unfolded.length <= 1) {
    // Hand winner: sole remaining unfolded player, or whoever made the last play (if still active)
    const handWinnerId = unfolded.length === 1
      ? unfolded[0].id
      : (state.currentTopPlayerId && newPlayerOrder.includes(state.currentTopPlayerId)
          ? state.currentTopPlayerId
          : null)
    const stateForEnd = { ...state, players, playerOrder: newPlayerOrder, leadPlayerIndex: newLeadIndex }
    return endHand(stateForEnd, players, handWinnerId)
  }

  return {
    ...state,
    players,
    playerOrder: newPlayerOrder,
    currentPlayerIndex: newCurrentIndex,
    leadPlayerIndex: newLeadIndex,
  }
}

function applyReconnect(state: GameState, cmd: { playerId: string }): GameState {
  const player = state.players.find(p => p.id === cmd.playerId)
  if (!player || player.isBot) return state
  return updatePlayer(state, { ...player, connected: true })
}

function applyDisconnect(state: GameState, cmd: { playerId: string }): GameState {
  const player = state.players.find(p => p.id === cmd.playerId)
  if (!player || player.isBot) return state
  return updatePlayer(state, { ...player, connected: false })
}
