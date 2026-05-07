import type { Card } from './card'
import { createDeck, createMultiDeck, shuffle, dealAll, drawFromTop, insertToBottom } from './deck'
import { evaluateHand, beats as handBeats } from './hand-eval'
import type { EvaluatedHand } from './hand-eval'
import { validatePlay, validateDiscard, scoreRound } from './rules'
import type { GameState, GameOptions, PlayerState, HandPlay, BotDifficulty, GameEvent } from './game-state'
import { DEFAULT_OPTIONS, MIN_CARDS_PER_PLAYER, MIN_CHIP_VALUE_PER_CARD, MAX_CHIP_VALUE_PER_CARD, DEFAULT_BOT_DIFFICULTY } from './game-state'

// Distributive Omit so the discriminated union survives ts-stripping.
type EventInput = GameEvent extends infer E ? (E extends GameEvent ? Omit<E, 'ts'> : never) : never

// Append events to the log without mutating state. Pass a partial event (no ts) — we stamp it.
function withEvents(state: GameState, ...events: EventInput[]): GameState {
  if (events.length === 0) return state
  const ts = Date.now()
  const stamped = events.map(e => ({ ...e, ts })) as GameEvent[]
  return { ...state, events: [...(state.events ?? []), ...stamped] }
}

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

// Pick a random integer in [0, n) using Math.random — same source already used by shuffle().
function randomIndex(n: number): number {
  return Math.floor(Math.random() * n)
}

// Find the next dealer for the upcoming round. The dealer rotates clockwise; if the previous
// dealer is no longer in the active order (eliminated, left), we use their old seat to find
// the next clockwise active player from the prior order. `prevPlayerOrder` is the player order
// *before* eliminations were applied for the new round, so we can locate the prior dealer's seat.
function rotateDealer(
  prevDealerId: string | null,
  prevPlayerOrder: string[],
  newPlayerOrder: string[],
): string {
  if (newPlayerOrder.length === 0) return ''
  if (!prevDealerId) return newPlayerOrder[0]

  const prevSeatIdx = prevPlayerOrder.indexOf(prevDealerId)
  if (prevSeatIdx === -1) {
    // Shouldn't normally happen, but if the prior dealer isn't in the prior order, fall back.
    return newPlayerOrder[0]
  }
  // Walk clockwise from the seat *after* the previous dealer until we hit someone in the new order.
  for (let i = 1; i <= prevPlayerOrder.length; i++) {
    const candidate = prevPlayerOrder[(prevSeatIdx + i) % prevPlayerOrder.length]
    const idxInNew = newPlayerOrder.indexOf(candidate)
    if (idxInNew !== -1) return candidate
  }
  return newPlayerOrder[0]
}

// ============================================================
// Commands — server-side actions (playerId added by the server)
// ============================================================

export type GameCommand =
  | { type: 'ADD_PLAYER'; playerId: string; playerName: string; isApi?: boolean }
  | { type: 'ADD_BOT'; playerId: string; playerName: string; difficulty?: BotDifficulty }
  | { type: 'REMOVE_BOT'; playerId: string }
  | { type: 'SET_BOT_DIFFICULTY'; playerId: string; difficulty: BotDifficulty }
  | { type: 'START_GAME'; options?: Partial<GameOptions> }
  | { type: 'NEXT_ROUND' }
  | { type: 'READY_FOR_NEXT_ROUND'; playerId: string }
  | { type: 'CHECK'; playerId: string }
  | { type: 'BET'; playerId: string; amount: number }
  | { type: 'CALL'; playerId: string }
  | { type: 'RAISE'; playerId: string; amount: number }
  | { type: 'DISCARD'; playerId: string; cards: Card[] }
  | { type: 'PLAY'; playerId: string; cards: Card[] }
  | { type: 'FOLD'; playerId: string }
  | { type: 'LEAVE'; playerId: string }
  | { type: 'RECONNECT'; playerId: string }
  | { type: 'DISCONNECT'; playerId: string }
  | { type: 'DEBUG_SET_HAND'; playerId: string; count: number }
  | { type: 'DEBUG_ADJUST_CHIPS'; playerId: string; delta: number }

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
  isApi: boolean
  botDifficulty?: BotDifficulty
}

export interface ClientGameState {
  phase: 'lobby' | 'playing' | 'round_end' | 'game_end' | 'abandoned'
  abandonedByName: string | null
  players: PlayerView[]
  myHand: Card[]
  myDeckSize: number
  turnPhase: 'bet' | 'discard' | 'play'
  // Betting view (only meaningful when betting is enabled).
  pot: number
  committed: Record<string, number>
  betToMatch: number
  minRaise: number
  bettingActedSinceRaise: string[]
  currentTopPlay: EvaluatedHand | null
  currentTopPlayerId: string | null
  currentHandPlays: HandPlay[]
  currentPlayerId: string | null
  leadPlayerId: string | null
  dealerId: string | null
  roundWinnerId: string | null
  gameWinnerId: string | null
  scores: Record<string, number>
  roundScoreDelta: Record<string, number>
  middlePileCount: number
  options: GameOptions
  events: GameEvent[]
  nextRoundReady: Record<string, boolean>
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
      isApi: p.isApi,
      botDifficulty: p.botDifficulty,
    })),
    myHand: me?.hand ?? [],
    myDeckSize: me?.deck.length ?? 0,
    turnPhase: state.turnPhase,
    currentTopPlay: state.currentTopPlay,
    currentTopPlayerId: state.currentTopPlayerId,
    currentHandPlays: state.currentHandPlays ?? [],
    currentPlayerId: state.playerOrder[state.currentPlayerIndex] ?? null,
    leadPlayerId: state.playerOrder[state.leadPlayerIndex] ?? null,
    dealerId: state.dealerId ?? null,
    roundWinnerId: state.roundWinnerId,
    gameWinnerId: state.gameWinnerId,
    scores: state.scores,
    roundScoreDelta: state.roundScoreDelta,
    abandonedByName: state.abandonedByName,
    middlePileCount: state.middlePile.length,
    options: state.options,
    pot: state.pot ?? 0,
    committed: state.committed ?? {},
    betToMatch: state.betToMatch ?? 0,
    minRaise: state.minRaise ?? 0,
    bettingActedSinceRaise: state.bettingActedSinceRaise ?? [],
    // Defaults guard against pre-schema persisted state surviving across engine upgrades.
    events: state.events ?? [],
    nextRoundReady: state.nextRoundReady ?? {},
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
    dealerId: null,
    currentPlayerIndex: 0,
    leadPlayerIndex: 0,
    turnPhase: 'discard',
    currentTopPlay: null,
    currentTopPlayerId: null,
    currentHandPlays: [],
    middlePile: [],
    pot: 0,
    committed: {},
    betToMatch: 0,
    minRaise: 0,
    bettingActedSinceRaise: [],
    roundWinnerId: null,
    gameWinnerId: null,
    scores: {},
    roundScoreDelta: {},
    deckCount: 1,
    options: { ...DEFAULT_OPTIONS },
    abandonedByName: null,
    events: [],
    nextRoundReady: {},
  }
}

// ============================================================
// Reducer — pure, returns new state (never mutates)
// ============================================================

export function applyCommand(state: GameState, cmd: GameCommand): GameState {
  switch (cmd.type) {
    case 'ADD_PLAYER':  return applyAddPlayer(state, cmd, false)
    case 'ADD_BOT':     return applyAddPlayer(state, cmd, true, cmd.difficulty)
    case 'REMOVE_BOT':  return applyRemoveBot(state, cmd)
    case 'SET_BOT_DIFFICULTY': return applySetBotDifficulty(state, cmd)
    case 'START_GAME':  return applyStartGame(state, cmd)
    case 'NEXT_ROUND':  return applyNextRound(state)
    case 'READY_FOR_NEXT_ROUND': return applyReadyForNextRound(state, cmd)
    case 'CHECK':       return applyCheck(state, cmd)
    case 'BET':         return applyBet(state, cmd)
    case 'CALL':        return applyCall(state, cmd)
    case 'RAISE':       return applyRaise(state, cmd)
    case 'DISCARD':     return applyDiscard(state, cmd)
    case 'PLAY':        return applyPlay(state, cmd)
    case 'FOLD':        return applyFold(state, cmd)
    case 'LEAVE':            return applyLeave(state, cmd)
    case 'RECONNECT':        return applyReconnect(state, cmd)
    case 'DISCONNECT':       return applyDisconnect(state, cmd)
    case 'DEBUG_SET_HAND':   return applyDebugSetHand(state, cmd)
    case 'DEBUG_ADJUST_CHIPS': return applyDebugAdjustChips(state, cmd)
  }
}

// ============================================================
// Betting helpers
// ============================================================

// True when the current game has betting enabled (chips mode + non-zero ante).
function bettingEnabled(state: GameState): boolean {
  return state.options.scoringMode === 'chips' && state.options.anteAmount > 0
}

// Players still in the hand (not folded, not eliminated). All-in players are still "in" — they
// just can't act in the betting round.
function inHandPlayers(state: GameState): PlayerState[] {
  return state.players.filter(p => !p.folded && !p.eliminated)
}

// Find the next player who can ACT in betting (not folded, not all-in, not eliminated),
// scanning clockwise from `fromIndex` (exclusive).
function nextBettorIndex(state: GameState, fromIndex: number): number {
  const len = state.playerOrder.length
  for (let i = 1; i <= len; i++) {
    const idx = (fromIndex + i) % len
    const p = state.players.find(pl => pl.id === state.playerOrder[idx])
    if (p && !p.folded && !p.eliminated && !p.allIn) return idx
  }
  return fromIndex
}

// Collect antes from each in-hand player and seed the betting round. Returns the state
// with antes posted and turnPhase = 'bet'. If only one player can play (everyone else
// can't afford even a partial ante and gets nothing dealt? — for v1 we always post a partial
// ante if a player has any chips at all, going all-in for whatever they have).
function startBettingRound(state: GameState): GameState {
  // Refuse to open a betting round with only one viable player. endHand normally catches this
  // and transitions to game_end; this is a safety net so we never get stuck dealing antes to
  // a lone survivor.
  const viable = state.players.filter(p => !p.eliminated && (state.scores[p.id] ?? 0) > 0)
  if (viable.length <= 1) {
    const gameWinnerId = viable[0]?.id ?? null
    return withEvents(
      { ...state, phase: 'game_end', gameWinnerId },
      ...(gameWinnerId ? [{ type: 'game_won' as const, playerId: gameWinnerId }] : []),
    )
  }

  const ante = state.options.anteAmount
  const scores = { ...state.scores }
  const committed: Record<string, number> = {}
  const events: EventInput[] = []
  let pot = 0

  let players = state.players.map(p => {
    if (p.eliminated || p.folded) return p
    const have = scores[p.id] ?? 0
    if (have <= 0) {
      // Already broke — should have been eliminated; keep them out of the hand.
      return { ...p, folded: true, allIn: false }
    }
    const post = Math.min(ante, have)
    scores[p.id] = have - post
    committed[p.id] = post
    pot += post
    const allIn = scores[p.id] <= 0
    events.push({ type: 'ante_posted', playerId: p.id, amount: post, allIn })
    return { ...p, allIn }
  })

  // After antes, action starts left of the dealer (= leadPlayerIndex). Skip players who
  // can't act (folded broke / all-in from a partial ante).
  const startIdx = state.leadPlayerIndex
  const startPlayer = players.find(p => p.id === state.playerOrder[startIdx])
  let actorIndex = startIdx
  if (!startPlayer || startPlayer.folded || startPlayer.eliminated || startPlayer.allIn) {
    actorIndex = nextBettorIndex({ ...state, players }, startIdx)
  }

  // If nobody can act (all in-hand players are all-in from antes), skip betting entirely.
  const canAct = players.some(p => !p.folded && !p.eliminated && !p.allIn)
  if (!canAct) {
    // No betting — proceed straight to discard.
    return withEvents(
      {
        ...state,
        players,
        scores,
        committed,
        pot,
        betToMatch: ante,
        minRaise: ante,
        bettingActedSinceRaise: [],
        currentPlayerIndex: state.leadPlayerIndex,
        turnPhase: 'discard',
      },
      ...events,
    )
  }

  return withEvents(
    {
      ...state,
      players,
      scores,
      committed,
      pot,
      betToMatch: ante,
      minRaise: ante,
      bettingActedSinceRaise: [],
      currentPlayerIndex: actorIndex,
      turnPhase: 'bet',
    },
    ...events,
  )
}

// Decide whether the current betting round is complete: every non-folded, non-all-in player
// has acted since the last bet/raise AND their committed === betToMatch.
function bettingRoundComplete(state: GameState): boolean {
  const live = inHandPlayers(state).filter(p => !p.allIn)
  if (live.length === 0) return true
  for (const p of live) {
    if (!state.bettingActedSinceRaise.includes(p.id)) return false
    if ((state.committed[p.id] ?? 0) !== state.betToMatch) return false
  }
  return true
}

// Close the betting round: transition to the discard phase for the player left of dealer.
// If only one player remains in the hand (everyone else folded during betting), that player
// wins the pot uncontested and we end the hand immediately.
function closeBettingRound(state: GameState): GameState {
  const inHand = inHandPlayers(state)
  if (inHand.length <= 1) {
    const winnerId = inHand[0]?.id ?? null
    return endHand(state, state.players, winnerId)
  }

  // Move action to the player left of the dealer for the discard phase. Skip folded/eliminated.
  // (All-in players still take discard/play turns — they just can't bet.)
  let idx = state.leadPlayerIndex
  const startPlayer = state.players.find(p => p.id === state.playerOrder[idx])
  if (!startPlayer || startPlayer.folded || startPlayer.eliminated) {
    idx = nextActiveIndex(state, idx)
  }

  return {
    ...state,
    currentPlayerIndex: idx,
    turnPhase: 'discard',
  }
}

// Compute side-pot tiers from `committed`. Returns an array of { amount, eligiblePlayerIds },
// ordered from main pot (smallest commitment tier) to highest. Folded players' chips contribute
// to pots but they are never eligible to win.
// Exported for unit testing — production callers should use applyCommand, not this.
export function computeSidePots(state: GameState): Array<{ amount: number; eligiblePlayerIds: string[] }> {
  // Distinct positive commitment amounts among non-folded players, ascending.
  const tiers = Array.from(
    new Set(
      state.players
        .filter(p => !p.folded && !p.eliminated)
        .map(p => state.committed[p.id] ?? 0)
        .filter(amt => amt > 0)
    )
  ).sort((a, b) => a - b)

  const pots: Array<{ amount: number; eligiblePlayerIds: string[] }> = []
  let prev = 0
  for (const tier of tiers) {
    let amount = 0
    const eligible: string[] = []
    for (const p of state.players) {
      const c = state.committed[p.id] ?? 0
      if (c <= prev) continue
      // Every player who put in at least `tier` contributes (tier - prev) to this pot tier.
      amount += Math.min(c, tier) - prev
      // Only non-folded players are eligible to win.
      if (!p.folded && !p.eliminated) eligible.push(p.id)
    }
    if (amount > 0 && eligible.length > 0) {
      pots.push({ amount, eligiblePlayerIds: eligible })
    }
    prev = tier
  }

  // Orphan chips: anything committed above the deepest non-folded tier comes from
  // folded players exclusively (no non-folded player exceeds `highestTier` by definition).
  // Without this, those chips vanish — the tier loop only iterates non-folded commit levels.
  // Roll them into the top pot, which contains the deepest-stacked eligible player(s).
  // No higher tier exists where eligible players could compete for them, so this is the
  // only correct destination.
  const highestTier = tiers.length > 0 ? tiers[tiers.length - 1] : 0
  let orphan = 0
  for (const p of state.players) {
    const c = state.committed[p.id] ?? 0
    if (c > highestTier) orphan += c - highestTier
  }
  if (orphan > 0 && pots.length > 0) {
    pots[pots.length - 1].amount += orphan
  }
  return pots
}

// Award the pot(s) to the hand winner among eligible players for each tier. Used both at
// normal hand end (where currentTopPlayerId / lone unfolded is the natural winner) and when
// folds collapse the hand. Returns updated scores, delta map, and events.
function awardPots(
  state: GameState,
  defaultWinnerId: string | null,
): { scores: Record<string, number>; events: EventInput[] } {
  const scores = { ...state.scores }
  const events: EventInput[] = []
  const pots = computeSidePots(state)

  // For each pot tier, the "winner" is the eligible player with the best play in
  // currentHandPlays. If nobody played (everyone folded before any play) or the natural
  // hand-winner is eligible, use defaultWinnerId.
  for (let i = 0; i < pots.length; i++) {
    const pot = pots[i]
    let winnerId: string | null = null

    if (defaultWinnerId && pot.eligiblePlayerIds.includes(defaultWinnerId)) {
      winnerId = defaultWinnerId
    } else {
      // Find best play among eligible players from currentHandPlays.
      let bestPlay: HandPlay | null = null
      for (const play of state.currentHandPlays) {
        if (!pot.eligiblePlayerIds.includes(play.playerId)) continue
        if (!bestPlay) { bestPlay = play; continue }
        // higher hand wins; lib's `beats` from hand-eval would normally do this. Inline
        // comparison via category index + tiebreakers via the existing beats() helper.
        // Lazy: use the `beats` import.
        if (handBeats(play.hand, bestPlay.hand)) bestPlay = play
      }
      if (bestPlay) winnerId = bestPlay.playerId
      else if (pot.eligiblePlayerIds.length === 1) winnerId = pot.eligiblePlayerIds[0]
    }

    if (winnerId) {
      scores[winnerId] = (scores[winnerId] ?? 0) + pot.amount
      events.push({ type: 'pot_won', playerId: winnerId, amount: pot.amount, potIndex: i })
    }
  }

  return { scores, events }
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

// Next player index clockwise who hasn't folded and isn't eliminated, starting after fromIndex.
// Eliminated must be checked explicitly: endHand resets `folded: false` for everyone (including
// the just-eliminated), so without this check the turn pointer can land on an eliminated player
// and freeze the game (no bot will act for them, and a human ex-player is now spectating).
function nextActiveIndex(state: GameState, fromIndex: number): number {
  const len = state.playerOrder.length
  for (let i = 1; i < len; i++) {
    const idx = (fromIndex + i) % len
    const player = state.players.find(p => p.id === state.playerOrder[idx])
    if (player && !player.folded && !player.eliminated) return idx
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

// Mark players eliminated when `shouldEliminate(p)` is true and produce the matching
// 'eliminated' event for each player who newly transitioned. `clearCards` wipes deck
// and hand at elimination time so spectator views stop rendering chips-out players' cards
// (matches applyLeave's behavior — used in chips-mode hand end).
function applyEliminations(
  players: PlayerState[],
  shouldEliminate: (p: PlayerState) => boolean,
  options?: { clearCards?: boolean },
): { players: PlayerState[]; events: EventInput[] } {
  const updated = players.map(p => {
    if (p.eliminated || !shouldEliminate(p)) return p
    return options?.clearCards
      ? { ...p, eliminated: true, hand: [], deck: [] }
      : { ...p, eliminated: true }
  })
  const events: EventInput[] = updated
    .filter(p => p.eliminated && !players.find(prev => prev.id === p.id)?.eliminated)
    .map(p => ({ type: 'eliminated' as const, playerId: p.id }))
  return { players: updated, events }
}

// Wrap up the current hand: award the pot, set aside played cards, reset folded/all-in,
// set new lead. If betting is enabled, immediately post antes for the next hand.
function endHand(
  state: GameState,
  players: PlayerState[],
  winnerId: string | null,
): GameState {
  // Award the pot (if any) before resetting betting state.
  let scores = state.scores
  const potEvents: EventInput[] = []
  if (bettingEnabled(state) && state.pot > 0) {
    const result = awardPots({ ...state, players, scores }, winnerId)
    scores = result.scores
    potEvents.push(...result.events)
  }

  // Chips mode: any player whose chips hit zero from this hand is eliminated. Without this,
  // they'd be carried into the next hand with $0 — startBettingRound would mark them folded
  // and the remaining player would just keep collecting their own ante forever.
  const elim = bettingEnabled(state)
    ? applyEliminations(players, p => (scores[p.id] ?? 0) <= 0, { clearCards: true })
    : { players, events: [] as EventInput[] }
  const newlyEliminated = elim.events

  const resetPlayers = elim.players.map(p => ({ ...p, folded: false, allIn: false }))

  const sweptCards = state.currentTopPlay?.cards ?? []

  // If chip eliminations leave ≤1 non-eliminated player, the game is over — don't deal another hand.
  const remaining = resetPlayers.filter(p => !p.eliminated)
  if (bettingEnabled(state) && remaining.length <= 1) {
    const gameWinnerId = remaining[0]?.id ?? null
    const next: GameState = {
      ...state,
      players: resetPlayers,
      scores,
      pot: 0,
      committed: {},
      betToMatch: 0,
      minRaise: 0,
      bettingActedSinceRaise: [],
      currentTopPlay: null,
      currentTopPlayerId: null,
      currentHandPlays: [],
      phase: 'game_end',
      gameWinnerId,
      middlePile: [...state.middlePile, ...sweptCards],
    }
    return withEvents(
      next,
      ...potEvents,
      ...(winnerId ? [{ type: 'hand_won' as const, playerId: winnerId }] : []),
      ...newlyEliminated,
      ...(gameWinnerId ? [{ type: 'game_won' as const, playerId: gameWinnerId }] : []),
    )
  }

  const newLeadIndex = winnerId !== null
    ? state.playerOrder.indexOf(winnerId)
    : (state.leadPlayerIndex + 1) % state.playerOrder.length

  const next: GameState = {
    ...state,
    players: resetPlayers,
    scores,
    pot: 0,
    committed: {},
    betToMatch: 0,
    minRaise: 0,
    bettingActedSinceRaise: [],
    currentTopPlay: null,
    currentTopPlayerId: null,
    currentHandPlays: [],
    currentPlayerIndex: newLeadIndex,
    leadPlayerIndex: newLeadIndex,
    turnPhase: 'discard',
    middlePile: [...state.middlePile, ...sweptCards],
  }
  const withEv = withEvents(
    next,
    ...potEvents,
    ...(winnerId ? [{ type: 'hand_won' as const, playerId: winnerId }] : []),
    ...newlyEliminated,
  )
  return bettingEnabled(withEv) ? startBettingRound(withEv) : withEv
}

function endRound(state: GameState, players: PlayerState[], winnerId: string): GameState {
  // First, award any outstanding hand pot (the round-ender just won the hand and the pot).
  let preScores = state.scores
  const potEvents: EventInput[] = []
  if (bettingEnabled(state) && state.pot > 0) {
    const result = awardPots({ ...state, players, scores: preScores }, winnerId)
    preScores = result.scores
    potEvents.push(...result.events)
  }

  // Raw per-loser amount: cards remaining in hand, capped at 10. Winner = 0.
  // Already-eliminated players contribute 0 (they aren't playing).
  const lossPerPlayer = scoreRound(state, winnerId)
  const { scoringMode, threshold, pointsThresholdAction } = state.options

  // delta: signed change applied to scores this round (semantics differ by mode).
  const delta: Record<string, number> = {}
  const scores: Record<string, number> = { ...preScores }

  if (scoringMode === 'chips') {
    // Losers pay chips equal to (cards remaining × per-card value); winner takes the pot.
    const perCard = state.options.chipValuePerCard
    let pot = 0
    for (const [id, amt] of Object.entries(lossPerPlayer)) {
      if (id === winnerId) continue
      const player = players.find(p => p.id === id)
      // Already-eliminated players don't lose chips; cap loss at the player's current balance
      // so chips never go negative.
      const lost = player && !player.eliminated ? Math.min(amt * perCard, scores[id] ?? 0) : 0
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
  const elim = scoringMode === 'chips'
    ? applyEliminations(players, p => (scores[p.id] ?? 0) <= 0)
    : pointsThresholdAction === 'eliminate'
      ? applyEliminations(players, p => (scores[p.id] ?? 0) >= threshold)
      : { players, events: [] as EventInput[] }
  const updatedPlayers = elim.players
  const newlyEliminated = elim.events

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
    const next: GameState = {
      ...state,
      players: updatedPlayers,
      phase: 'game_end',
      roundWinnerId: winnerId,
      gameWinnerId,
      scores,
      roundScoreDelta: delta,
      pot: 0,
      committed: {},
      betToMatch: 0,
      minRaise: 0,
      bettingActedSinceRaise: [],
    }
    return withEvents(
      next,
      ...potEvents,
      { type: 'round_won', playerId: winnerId, emptied: true },
      ...newlyEliminated,
      ...(gameWinnerId ? [{ type: 'game_won' as const, playerId: gameWinnerId }] : []),
    )
  }

  const next: GameState = {
    ...state,
    players: updatedPlayers,
    phase: 'round_end',
    roundWinnerId: winnerId,
    scores,
    roundScoreDelta: delta,
    pot: 0,
    committed: {},
    betToMatch: 0,
    minRaise: 0,
    bettingActedSinceRaise: [],
  }
  return withEvents(
    next,
    ...potEvents,
    { type: 'round_won', playerId: winnerId, emptied: true },
    ...newlyEliminated,
  )
}

// ============================================================
// Command handlers
// ============================================================

function applyAddPlayer(
  state: GameState,
  cmd: { playerId: string; playerName: string; isApi?: boolean },
  isBot: boolean,
  difficulty?: BotDifficulty,
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

  const isApi = !isBot && (cmd.isApi ?? false)
  const newPlayer: PlayerState = {
    id: cmd.playerId,
    name: cmd.playerName,
    deck: [],
    hand: [],
    folded: false,
    connected: true,
    eliminated: false,
    isBot,
    isApi,
    botDifficulty: isBot ? (difficulty ?? DEFAULT_BOT_DIFFICULTY) : undefined,
    allIn: false,
  }

  return withEvents(
    {
      ...state,
      players: [...state.players, newPlayer],
      scores: { ...state.scores, [cmd.playerId]: 0 },
    },
    { type: 'joined', playerId: cmd.playerId, playerName: cmd.playerName, isBot, isApi },
  )
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

function applySetBotDifficulty(
  state: GameState,
  cmd: { playerId: string; difficulty: BotDifficulty },
): GameState {
  if (state.phase !== 'lobby') return state
  const target = state.players.find(p => p.id === cmd.playerId)
  if (!target || !target.isBot) return state
  return updatePlayer(state, { ...target, botDifficulty: cmd.difficulty })
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
    chipValuePerCard: Math.min(MAX_CHIP_VALUE_PER_CARD, Math.max(MIN_CHIP_VALUE_PER_CARD, Math.floor(merged.chipValuePerCard))),
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

  // First dealer is chosen at random; the player to the dealer's left takes the first turn.
  const dealerIndex = randomIndex(playerOrder.length)
  const firstPlayerIndex = (dealerIndex + 1) % playerOrder.length
  const dealerId = playerOrder[dealerIndex]

  const started = withEvents(
    {
      ...state,
      phase: 'playing',
      players,
      playerOrder,
      dealerId,
      currentPlayerIndex: firstPlayerIndex,
      leadPlayerIndex: firstPlayerIndex,
      turnPhase: 'discard',
      currentTopPlay: null,
      currentTopPlayerId: null,
      currentHandPlays: [],
      middlePile: [],
      pot: 0,
      committed: {},
      betToMatch: 0,
      minRaise: 0,
      bettingActedSinceRaise: [],
      roundWinnerId: null,
      scores,
      roundScoreDelta: {},
      deckCount: effectiveDeckCount(options, players.length),
      options,
      nextRoundReady: {},
    },
    { type: 'game_started' },
  )
  return bettingEnabled(started) ? startBettingRound(started) : started
}

// Mark a player as ready for the next round. When every connected, non-eliminated
// human is ready, automatically transition. Bots are not gated on (they're always
// effectively ready) and disconnected humans are skipped to avoid deadlock.
function applyReadyForNextRound(
  state: GameState,
  cmd: { playerId: string },
): GameState {
  if (state.phase !== 'round_end') return state
  const player = state.players.find(p => p.id === cmd.playerId)
  if (!player || player.eliminated) return state

  const ready = { ...(state.nextRoundReady ?? {}), [cmd.playerId]: true }
  const next: GameState = { ...state, nextRoundReady: ready }

  const required = state.players.filter(p => !p.isBot && !p.eliminated && p.connected)
  const allReady = required.every(p => ready[p.id])
  return allReady ? applyNextRound(next) : next
}

function applyNextRound(state: GameState): GameState {
  if (state.phase !== 'round_end') return state

  // Only non-eliminated players participate in the next round
  const activePlayers = state.players.filter(p => !p.eliminated)
  const piles = dealForMode(state.options, activePlayers.length)

  const updatedActive = activePlayers.map((p, i) => {
    const { drawn, remaining } = drawFromTop(piles[i], 10)
    return { ...p, deck: remaining, hand: drawn, folded: false, allIn: false }
  })

  const players = state.players.map(p => {
    if (p.eliminated) return p
    return updatedActive.find(a => a.id === p.id)!
  })

  const newPlayerOrder = activePlayers.map(p => p.id)

  // Deal rotates clockwise from the previous dealer (independent of who won the round).
  // The player to the new dealer's left takes the first turn.
  const newDealerId = rotateDealer(state.dealerId, state.playerOrder, newPlayerOrder)
  const newDealerIndex = newPlayerOrder.indexOf(newDealerId)
  const leadIndex = newDealerIndex === -1
    ? 0
    : (newDealerIndex + 1) % newPlayerOrder.length

  const started = withEvents(
    {
      ...state,
      phase: 'playing',
      players,
      playerOrder: newPlayerOrder,
      dealerId: newDealerId,
      currentPlayerIndex: leadIndex,
      leadPlayerIndex: leadIndex,
      turnPhase: 'discard',
      currentTopPlay: null,
      currentTopPlayerId: null,
      currentHandPlays: [],
      middlePile: [],
      pot: 0,
      committed: {},
      betToMatch: 0,
      minRaise: 0,
      bettingActedSinceRaise: [],
      roundWinnerId: null,
      // Personal mode's effective deck count tracks playerCount, which can shrink after eliminations.
      deckCount: effectiveDeckCount(state.options, activePlayers.length),
      nextRoundReady: {},
    },
    { type: 'round_started' },
  )
  return bettingEnabled(started) ? startBettingRound(started) : started
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
  const next = { ...updatePlayer(state, updated), turnPhase: 'play' as const }
  if (cmd.cards.length === 0) return next
  return withEvents(next, { type: 'discarded', playerId: cmd.playerId, count: cmd.cards.length })
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

  // validatePlay already evaluated the hand and rejected if it didn't form a legal play,
  // but recheck here so the type narrows naturally — and so a future validator change
  // that decouples "ok" from "evaluable" doesn't crash this path.
  const evaluatedHand = evaluateHand(cmd.cards)
  if (!evaluatedHand) return state

  const player = state.players.find(p => p.id === cmd.playerId)
  if (!player) return state

  // Remove played cards from hand
  const newHand = removeCardsFromHand(player.hand, cmd.cards)
  if (!newHand) return state

  // Replenish hand from deck
  const replenished = drawUpTo10({ ...player, hand: newHand })

  let players = state.players.map(p => p.id === cmd.playerId ? replenished : p)

  const newHandPlay: HandPlay = { hand: evaluatedHand, playerId: cmd.playerId }
  const updatedHandPlays = [...state.currentHandPlays, newHandPlay]

  const playedEvent = { type: 'played' as const, playerId: cmd.playerId, category: evaluatedHand.category, cards: evaluatedHand.cards }

  // Round end: player emptied all their cards
  if (replenished.hand.length === 0 && replenished.deck.length === 0) {
    const stateWithPlay = withEvents(
      { ...state, players, currentTopPlay: evaluatedHand, currentTopPlayerId: cmd.playerId, currentHandPlays: updatedHandPlays },
      playedEvent,
    )
    return endRound(stateWithPlay, players, cmd.playerId)
  }

  // Hand end: all other players have already folded.
  // Eliminated players keep folded=false across rounds, so exclude them explicitly —
  // otherwise they'd be counted as still in the hand.
  const active = players.filter(p => !p.folded && !p.eliminated)
  if (active.length === 1 && active[0].id === cmd.playerId) {
    const nextState = withEvents(
      { ...state, players, currentTopPlay: evaluatedHand, currentTopPlayerId: cmd.playerId, currentHandPlays: updatedHandPlays },
      playedEvent,
    )
    return endHand(nextState, players, cmd.playerId)
  }

  // Continue — advance to next active player
  const nextIndex = nextActiveIndex({ ...state, players }, state.currentPlayerIndex)
  return withEvents(
    {
      ...state,
      players,
      currentTopPlay: evaluatedHand,
      currentTopPlayerId: cmd.playerId,
      currentHandPlays: updatedHandPlays,
      currentPlayerIndex: nextIndex,
      turnPhase: 'discard',
    },
    playedEvent,
  )
}

function applyFold(state: GameState, cmd: { playerId: string }): GameState {
  if (state.phase !== 'playing') return state
  if (state.playerOrder[state.currentPlayerIndex] !== cmd.playerId) return state
  if (state.turnPhase !== 'play' && state.turnPhase !== 'bet') return state

  const player = state.players.find(p => p.id === cmd.playerId)
  if (!player) return state

  const players = state.players.map(p => p.id === cmd.playerId ? { ...p, folded: true } : p)
  // Eliminated players keep folded=false across rounds (they're not "in" the hand),
  // so exclude them when counting who's still standing.
  const active = players.filter(p => !p.folded && !p.eliminated)

  const foldedEvent = { type: 'folded' as const, playerId: cmd.playerId }

  // Hand ends when ≤1 player remains un-folded
  if (active.length <= 1) {
    // Winner is whoever made the last play; null if no play was made this hand.
    // During betting, that means the lone non-folded player wins the pot uncontested.
    const winnerId = state.turnPhase === 'bet'
      ? (active[0]?.id ?? null)
      : state.currentTopPlayerId
    return endHand(withEvents({ ...state, players }, foldedEvent), players, winnerId)
  }

  // During the betting phase, advance to the next bettor and check round completion.
  if (state.turnPhase === 'bet') {
    const next: GameState = { ...state, players }
    if (bettingRoundComplete(next)) {
      return closeBettingRound(withEvents(next, foldedEvent))
    }
    const nextIdx = nextBettorIndex(next, state.currentPlayerIndex)
    return withEvents({ ...next, currentPlayerIndex: nextIdx }, foldedEvent)
  }

  // Continue to next active player
  const nextIndex = nextActiveIndex({ ...state, players }, state.currentPlayerIndex)
  return withEvents(
    {
      ...state,
      players,
      currentPlayerIndex: nextIndex,
      turnPhase: 'discard',
    },
    foldedEvent,
  )
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

function applyDebugAdjustChips(state: GameState, cmd: { playerId: string; delta: number }): GameState {
  const player = state.players.find(p => p.id === cmd.playerId)
  if (!player) return state
  const current = state.scores[cmd.playerId] ?? 0
  const next = Math.max(0, current + cmd.delta)
  return { ...state, scores: { ...state.scores, [cmd.playerId]: next } }
}

function applyLeave(state: GameState, cmd: { playerId: string }): GameState {
  const player = state.players.find(p => p.id === cmd.playerId)
  if (!player) return state
  if (state.phase === 'game_end' || state.phase === 'abandoned') return state

  const leftEvent = { type: 'left' as const, playerId: cmd.playerId }

  if (state.phase === 'lobby') {
    // Remove from lobby entirely
    return withEvents(
      {
        ...state,
        players: state.players.filter(p => p.id !== cmd.playerId),
        scores: Object.fromEntries(Object.entries(state.scores).filter(([id]) => id !== cmd.playerId)),
      },
      leftEvent,
    )
  }

  // In-game: eliminate the player, clear their cards (they took their seat with them),
  // and remove from turn order. Without clearing, spectator views still render their hand/deck.
  const players = state.players.map(p =>
    p.id === cmd.playerId
      ? { ...p, eliminated: true, folded: true, connected: false, hand: [], deck: [] }
      : p
  )

  const leavingOrderIdx = state.playerOrder.indexOf(cmd.playerId)
  const newPlayerOrder = state.playerOrder.filter(id => id !== cmd.playerId)

  // If ≤1 active player remains, end the game
  if (newPlayerOrder.length <= 1) {
    const gameWinnerId = newPlayerOrder[0] ?? null
    return withEvents(
      {
        ...state,
        players,
        playerOrder: newPlayerOrder,
        phase: 'game_end',
        gameWinnerId,
      },
      leftEvent,
      ...(gameWinnerId ? [{ type: 'game_won' as const, playerId: gameWinnerId }] : []),
    )
  }

  if (state.phase === 'round_end') {
    return withEvents({ ...state, players, playerOrder: newPlayerOrder }, leftEvent)
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
    const stateForEnd = withEvents(
      { ...state, players, playerOrder: newPlayerOrder, leadPlayerIndex: newLeadIndex },
      leftEvent,
    )
    return endHand(stateForEnd, players, handWinnerId)
  }

  return withEvents(
    {
      ...state,
      players,
      playerOrder: newPlayerOrder,
      currentPlayerIndex: newCurrentIndex,
      leadPlayerIndex: newLeadIndex,
    },
    leftEvent,
  )
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

// ============================================================
// Betting handlers (chips mode + anteAmount > 0 only)
// ============================================================

// Common preconditions for any betting action by `playerId`.
function bettingPreconditions(state: GameState, playerId: string): PlayerState | null {
  if (state.phase !== 'playing') return null
  if (state.turnPhase !== 'bet') return null
  if (state.playerOrder[state.currentPlayerIndex] !== playerId) return null
  const player = state.players.find(p => p.id === playerId)
  if (!player) return null
  if (player.folded || player.eliminated || player.allIn) return null
  return player
}

// Common tail for CHECK / CALL: advance to next bettor or close round if everyone's matched.
function advanceAfterCheckOrCall(state: GameState, actorId: string): GameState {
  const acted = state.bettingActedSinceRaise.includes(actorId)
    ? state.bettingActedSinceRaise
    : [...state.bettingActedSinceRaise, actorId]
  const next: GameState = { ...state, bettingActedSinceRaise: acted }
  if (bettingRoundComplete(next)) return closeBettingRound(next)
  const nextIdx = nextBettorIndex(next, state.currentPlayerIndex)
  return { ...next, currentPlayerIndex: nextIdx }
}

function applyCheck(state: GameState, cmd: { playerId: string }): GameState {
  const player = bettingPreconditions(state, cmd.playerId)
  if (!player) return state
  // Check is only legal when no outstanding bet to call.
  if ((state.committed[cmd.playerId] ?? 0) !== state.betToMatch) return state
  return advanceAfterCheckOrCall(
    withEvents(state, { type: 'checked', playerId: cmd.playerId }),
    cmd.playerId,
  )
}

function applyBet(state: GameState, cmd: { playerId: string; amount: number }): GameState {
  const player = bettingPreconditions(state, cmd.playerId)
  if (!player) return state
  // BET only legal when nobody has bet beyond the ante level (committed[me] === betToMatch).
  if ((state.committed[cmd.playerId] ?? 0) !== state.betToMatch) return state

  const stack = state.scores[cmd.playerId] ?? 0
  if (stack <= 0) return state

  const myCommitted = state.committed[cmd.playerId] ?? 0
  // amount = TOTAL chips this player will have committed after the bet (matches poker UI "bet to $X").
  // Cap at all-in.
  const target = Math.min(cmd.amount, myCommitted + stack)
  const increment = target - myCommitted
  if (increment <= 0) return state

  // Min bet: must raise the bet-to-match by at least one ante (unless going all-in).
  const minTarget = state.betToMatch + state.options.anteAmount
  const allIn = increment === stack
  if (target < minTarget && !allIn) return state

  const newScores = { ...state.scores, [cmd.playerId]: stack - increment }
  const newCommitted = { ...state.committed, [cmd.playerId]: target }
  const newPlayers = allIn
    ? state.players.map(p => p.id === cmd.playerId ? { ...p, allIn: true } : p)
    : state.players

  const next: GameState = {
    ...state,
    players: newPlayers,
    scores: newScores,
    committed: newCommitted,
    pot: state.pot + increment,
    betToMatch: target,
    minRaise: target - state.betToMatch,
    bettingActedSinceRaise: [cmd.playerId],
  }
  const withEv = withEvents(next, { type: 'bet', playerId: cmd.playerId, amount: increment, allIn })
  if (bettingRoundComplete(withEv)) return closeBettingRound(withEv)
  return { ...withEv, currentPlayerIndex: nextBettorIndex(withEv, state.currentPlayerIndex) }
}

function applyCall(state: GameState, cmd: { playerId: string }): GameState {
  const player = bettingPreconditions(state, cmd.playerId)
  if (!player) return state
  const myCommitted = state.committed[cmd.playerId] ?? 0
  // Nothing to call.
  if (myCommitted >= state.betToMatch) return state

  const stack = state.scores[cmd.playerId] ?? 0
  if (stack <= 0) return state

  const owe = state.betToMatch - myCommitted
  const pay = Math.min(owe, stack)
  const allIn = pay === stack && pay < owe
  // Even if not capped by stack, going to zero chips counts as all-in.
  const becomesAllIn = allIn || (stack - pay <= 0)

  const newScores = { ...state.scores, [cmd.playerId]: stack - pay }
  const newCommitted = { ...state.committed, [cmd.playerId]: myCommitted + pay }
  const newPlayers = becomesAllIn
    ? state.players.map(p => p.id === cmd.playerId ? { ...p, allIn: true } : p)
    : state.players

  const next: GameState = {
    ...state,
    players: newPlayers,
    scores: newScores,
    committed: newCommitted,
    pot: state.pot + pay,
  }
  return advanceAfterCheckOrCall(
    withEvents(next, { type: 'called', playerId: cmd.playerId, amount: pay, allIn: becomesAllIn }),
    cmd.playerId,
  )
}

function applyRaise(state: GameState, cmd: { playerId: string; amount: number }): GameState {
  const player = bettingPreconditions(state, cmd.playerId)
  if (!player) return state
  const myCommitted = state.committed[cmd.playerId] ?? 0
  // RAISE only legal when there's a bet to raise (committed[me] < betToMatch).
  if (myCommitted >= state.betToMatch) return state

  const stack = state.scores[cmd.playerId] ?? 0
  if (stack <= 0) return state

  // amount = TOTAL chips this player will have committed after the raise.
  const target = Math.min(cmd.amount, myCommitted + stack)
  const increment = target - myCommitted
  if (increment <= 0) return state

  // Must at least call.
  if (target < state.betToMatch) return state

  const allIn = increment === stack
  const minTarget = state.betToMatch + state.minRaise
  if (target < minTarget && !allIn) return state

  const newScores = { ...state.scores, [cmd.playerId]: stack - increment }
  const newCommitted = { ...state.committed, [cmd.playerId]: target }
  const newPlayers = allIn
    ? state.players.map(p => p.id === cmd.playerId ? { ...p, allIn: true } : p)
    : state.players

  const next: GameState = {
    ...state,
    players: newPlayers,
    scores: newScores,
    committed: newCommitted,
    pot: state.pot + increment,
    betToMatch: target,
    minRaise: target - state.betToMatch,
    bettingActedSinceRaise: [cmd.playerId],
  }
  const withEv = withEvents(next, { type: 'raised', playerId: cmd.playerId, to: target, allIn })
  if (bettingRoundComplete(withEv)) return closeBettingRound(withEv)
  return { ...withEv, currentPlayerIndex: nextBettorIndex(withEv, state.currentPlayerIndex) }
}
