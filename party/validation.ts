// Wire-format validators for the WebSocket boundary. The server cannot trust
// JSON straight off the socket — a malformed payload would corrupt state if
// it reached applyCommand. These validators narrow `unknown` to a concrete
// action shape, returning null on any deviation.

import type { GameAction } from '../src/transport/types'
import type { PresenceClientMessage } from '../src/transport/presence'
import type { Card, Rank, Suit } from '../shared/engine/card'
import type { BotDifficulty, GameOptions } from '../shared/engine/game-state'

const VALID_RANKS: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 'J', 'Q', 'K', 'A']
const VALID_SUITS: Suit[] = ['clubs', 'diamonds', 'hearts', 'spades']
const VALID_DIFFICULTIES: BotDifficulty[] = ['easy', 'medium', 'hard']

function isCard(v: unknown): v is Card {
  if (typeof v !== 'object' || v === null) return false
  const c = v as { rank?: unknown; suit?: unknown }
  return (
    (VALID_RANKS as unknown[]).includes(c.rank) &&
    (VALID_SUITS as unknown[]).includes(c.suit)
  )
}

function isCardArray(v: unknown): v is Card[] {
  return Array.isArray(v) && v.every(isCard)
}

function isNumberArray(v: unknown): v is number[] {
  return Array.isArray(v) && v.every(n => typeof n === 'number' && Number.isFinite(n))
}

function isDifficulty(v: unknown): v is BotDifficulty {
  return typeof v === 'string' && (VALID_DIFFICULTIES as unknown[]).includes(v)
}

// Game options are whitelisted by key + primitive type; unknown keys are dropped silently.
// We don't validate semantic ranges here — applyStartGame already clamps/normalizes.
function sanitizeOptions(v: unknown): Partial<GameOptions> | undefined {
  if (typeof v !== 'object' || v === null) return undefined
  const o = v as Record<string, unknown>
  const out: Partial<GameOptions> = {}
  if (o.scoringMode === 'points' || o.scoringMode === 'chips') out.scoringMode = o.scoringMode
  if (typeof o.threshold === 'number' && Number.isFinite(o.threshold)) out.threshold = o.threshold
  if (o.pointsThresholdAction === 'eliminate' || o.pointsThresholdAction === 'end_game') out.pointsThresholdAction = o.pointsThresholdAction
  if (typeof o.chipValuePerCard === 'number' && Number.isFinite(o.chipValuePerCard)) out.chipValuePerCard = o.chipValuePerCard
  if (o.dealMode === 'classic' || o.dealMode === 'personal' || o.dealMode === 'mixed') out.dealMode = o.dealMode
  if (typeof o.cardsPerPlayer === 'number' && Number.isFinite(o.cardsPerPlayer)) out.cardsPerPlayer = o.cardsPerPlayer
  if (typeof o.mixedDeckCount === 'number' && Number.isFinite(o.mixedDeckCount)) out.mixedDeckCount = o.mixedDeckCount
  if (typeof o.anteAmount === 'number' && Number.isFinite(o.anteAmount)) out.anteAmount = o.anteAmount
  return out
}

export function parseGameAction(raw: unknown): GameAction | null {
  if (typeof raw !== 'object' || raw === null) return null
  const a = raw as Record<string, unknown>
  if (typeof a.type !== 'string') return null

  switch (a.type) {
    case 'JOIN':
      if (typeof a.playerName !== 'string' || a.playerName.length === 0) return null
      return { type: 'JOIN', playerName: a.playerName, client: a.client === 'api' ? 'api' : 'browser' }

    case 'ADD_BOT':
      return { type: 'ADD_BOT', difficulty: isDifficulty(a.difficulty) ? a.difficulty : undefined }

    case 'REMOVE_BOT':
      if (typeof a.playerId !== 'string') return null
      return { type: 'REMOVE_BOT', playerId: a.playerId }

    case 'SET_BOT_DIFFICULTY':
      if (typeof a.playerId !== 'string' || !isDifficulty(a.difficulty)) return null
      return { type: 'SET_BOT_DIFFICULTY', playerId: a.playerId, difficulty: a.difficulty }

    case 'START_GAME':
      return { type: 'START_GAME', options: a.options !== undefined ? sanitizeOptions(a.options) : undefined }

    case 'READY_FOR_NEXT_ROUND': return { type: 'READY_FOR_NEXT_ROUND' }
    case 'CHECK':                return { type: 'CHECK' }
    case 'CALL':                 return { type: 'CALL' }
    case 'FOLD':                 return { type: 'FOLD' }
    case 'LEAVE':                return { type: 'LEAVE' }
    case 'DEBUG_FULL_STATE':     return { type: 'DEBUG_FULL_STATE' }

    case 'BET':
      if (typeof a.amount !== 'number' || !Number.isFinite(a.amount)) return null
      return { type: 'BET', amount: a.amount }

    case 'RAISE':
      if (typeof a.amount !== 'number' || !Number.isFinite(a.amount)) return null
      return { type: 'RAISE', amount: a.amount }

    case 'DISCARD':
      if (!isCardArray(a.cards)) return null
      return { type: 'DISCARD', cards: a.cards }

    case 'PLAY':
      if (!isCardArray(a.cards)) return null
      return { type: 'PLAY', cards: a.cards }

    case 'DEBUG_SET_HAND':
      if (typeof a.count !== 'number' || !Number.isFinite(a.count)) return null
      return { type: 'DEBUG_SET_HAND', count: a.count }

    case 'DEBUG_ADJUST_CHIPS':
      if (typeof a.delta !== 'number' || !Number.isFinite(a.delta)) return null
      return { type: 'DEBUG_ADJUST_CHIPS', delta: a.delta }
  }
  return null
}

export function parsePresenceMessage(raw: unknown): PresenceClientMessage | null {
  if (typeof raw !== 'object' || raw === null) return null
  const m = raw as Record<string, unknown>
  if (m.type !== 'PRESENCE') return null
  if (!isNumberArray(m.handOrder) || !isNumberArray(m.selectedPositions)) return null
  const bettingTarget = typeof m.bettingTarget === 'number' && Number.isFinite(m.bettingTarget) && m.bettingTarget > 0
    ? m.bettingTarget
    : undefined
  return { type: 'PRESENCE', handOrder: m.handOrder, selectedPositions: m.selectedPositions, bettingTarget }
}
