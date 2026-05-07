// ============================================================
// PartyKit server — one room instance per game.
// Thin transport wrapper: all logic lives in shared/engine/.
// ============================================================

import type * as Party from 'partykit/server'
import type { GameAction, GameEvent } from '../src/transport/types'
import { applyCommand, buildClientState, initialState } from '../shared/engine/state-machine'
import type { GameState } from '../shared/engine/game-state'
import { DEFAULT_BOT_DIFFICULTY } from '../shared/engine/game-state'
import { chooseBotMove, presetForDifficulty } from '../shared/engine/bot-ismcts'
import { chooseBettingAction } from '../shared/engine/bot-betting'

const BOT_THINK_DELAY_MS = 800     // pause before the bot starts computing, so UIs paint "thinking"
const IDLE_TTL_MS = 24 * 60 * 60 * 1000  // wipe room storage after 24h with no activity

// Connection close codes for client-surfaced auth failures (4xxx range = application-defined).
const CLOSE_BAD_PASSWORD = 4001
const CLOSE_RATE_LIMITED = 4002

// Per-room sliding-window rate limit on new connections per source IP.
// Sized to be a no-op for any realistic legitimate use (LAN parties, mobile carriers behind CGNAT)
// while still cutting off scripted abuse. Cross-room limits would need a singleton coordinator
// party, which is more complexity than warranted for v1.
const RATE_LIMIT_WINDOW_MS = 60 * 1000
const RATE_LIMIT_MAX_CONNECTS = 30

function getClientIp(headers: { get(name: string): string | null }): string {
  // Cloudflare sets cf-connecting-ip with the true client IP. Fall back to x-forwarded-for's
  // first hop. Dev/localhost may have neither — return '' so dev connections aren't limited.
  return headers.get('cf-connecting-ip')
    ?? (headers.get('x-forwarded-for') ?? '').split(',')[0].trim()
    ?? ''
}

export default class GameParty implements Party.Server {
  private state: GameState = initialState()
  private password: string | null = null  // null = no password required
  private botTimer: ReturnType<typeof setTimeout> | null = null
  private botSeq = 0  // bumped on every state mutation; cancels stale bot work
  // Sliding window of recent connection timestamps per source IP (this room only).
  // Pruned on each new connection; entries auto-expire when the room hibernates.
  private connectsByIp = new Map<string, number[]>()

  constructor(readonly room: Party.Room) {}

  // Restore persisted state when the room wakes from hibernation.
  // Coerce missing fields to defaults so older snapshots survive engine schema additions.
  async onStart() {
    const stored = await this.room.storage.get<GameState>('state')
    if (stored) {
      this.state = {
        ...stored,
        events: stored.events ?? [],
        nextRoundReady: stored.nextRoundReady ?? {},
      }
    }
    this.password = (await this.room.storage.get<string>('password')) ?? null
  }

  // Fires when 24h have passed with no broadcastState() call. Wipes the room
  // and closes any clients that are still hanging on so memory/storage doesn't leak.
  async onAlarm() {
    this.state = initialState()
    this.password = null
    await this.room.storage.deleteAll()
    for (const conn of this.room.getConnections()) {
      conn.close(1000, 'Room idle — closed')
    }
  }

  onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    // Per-IP connection rate limit. Empty IP (dev/localhost without proxy headers) is exempt.
    const ip = getClientIp(ctx.request.headers)
    if (ip && this.isRateLimited(ip)) {
      conn.close(CLOSE_RATE_LIMITED, 'rate-limited')
      return
    }

    // First connection on an empty, never-used room may set a password.
    // Otherwise the incoming password must match the stored one.
    const incoming = new URL(ctx.request.url).searchParams.get('p') ?? ''
    const isFreshRoom = this.password === null && this.state.players.length === 0

    if (isFreshRoom) {
      if (incoming.length > 0) {
        this.password = incoming
        this.room.storage.put('password', incoming)
      }
    } else if (this.password !== null && incoming !== this.password) {
      conn.close(CLOSE_BAD_PASSWORD, 'wrong-password')
      return
    }

    this.state = applyCommand(this.state, { type: 'RECONNECT', playerId: conn.id })
    // Broadcast (not just send-to-one) so scheduleBotTurnIfNeeded fires —
    // if a human reconnects mid-bot-turn, the bot resumes instead of stalling.
    this.broadcastState()
  }

  onMessage(message: string, sender: Party.Connection) {
    // Parse raw first so we can intercept PRESENCE before narrowing to GameAction
    const raw = JSON.parse(message) as { type: string } & Record<string, unknown>

    // Relay presence (ephemeral UI state) to other clients — no state mutation
    if (raw.type === 'PRESENCE') {
      const relay = JSON.stringify({ type: 'PRESENCE', playerId: sender.id, handOrder: raw.handOrder, selectedPositions: raw.selectedPositions })
      for (const conn of this.room.getConnections()) {
        if (conn.id !== sender.id) conn.send(relay)
      }
      return
    }

    const action = raw as unknown as GameAction
    switch (action.type) {
      case 'JOIN':
        this.state = applyCommand(this.state, {
          type: 'ADD_PLAYER',
          playerId: sender.id,
          playerName: action.playerName,
          isApi: action.client === 'api',
        })
        break

      case 'ADD_BOT': {
        const botId = `bot-${Math.random().toString(36).slice(2, 8)}`
        const usedNames = new Set(this.state.players.map(p => p.name))
        const presets = ['CPU Alice', 'CPU Bob', 'CPU Carol', 'CPU Dave']
        const name = presets.find(n => !usedNames.has(n)) ?? `CPU ${this.state.players.length + 1}`
        this.state = applyCommand(this.state, {
          type: 'ADD_BOT',
          playerId: botId,
          playerName: name,
          difficulty: action.difficulty ?? DEFAULT_BOT_DIFFICULTY,
        })
        break
      }

      case 'REMOVE_BOT':
        this.state = applyCommand(this.state, { type: 'REMOVE_BOT', playerId: action.playerId })
        break

      case 'SET_BOT_DIFFICULTY':
        this.state = applyCommand(this.state, {
          type: 'SET_BOT_DIFFICULTY',
          playerId: action.playerId,
          difficulty: action.difficulty,
        })
        break

      case 'START_GAME':
        console.log('[party START_GAME] received options:', action.options)
        this.state = applyCommand(this.state, { type: 'START_GAME', options: action.options })
        console.log('[party START_GAME] applied options:', this.state.options)
        break

      case 'READY_FOR_NEXT_ROUND':
        this.state = applyCommand(this.state, { type: 'READY_FOR_NEXT_ROUND', playerId: sender.id })
        break

      case 'CHECK':
        this.state = applyCommand(this.state, { type: 'CHECK', playerId: sender.id })
        break

      case 'BET':
        this.state = applyCommand(this.state, { type: 'BET', playerId: sender.id, amount: action.amount })
        break

      case 'CALL':
        this.state = applyCommand(this.state, { type: 'CALL', playerId: sender.id })
        break

      case 'RAISE':
        this.state = applyCommand(this.state, { type: 'RAISE', playerId: sender.id, amount: action.amount })
        break

      case 'DISCARD':
        this.state = applyCommand(this.state, {
          type: 'DISCARD',
          playerId: sender.id,
          cards: action.cards,
        })
        break

      case 'PLAY':
        this.state = applyCommand(this.state, {
          type: 'PLAY',
          playerId: sender.id,
          cards: action.cards,
        })
        break

      case 'FOLD':
        this.state = applyCommand(this.state, { type: 'FOLD', playerId: sender.id })
        break

      case 'LEAVE':
        this.state = applyCommand(this.state, { type: 'LEAVE', playerId: sender.id })
        break

      case 'DEBUG_SET_HAND':
        if (process.env.NODE_ENV !== 'production') {
          this.state = applyCommand(this.state, { type: 'DEBUG_SET_HAND', playerId: sender.id, count: action.count })
        }
        break

      case 'DEBUG_ADJUST_CHIPS':
        if (process.env.NODE_ENV !== 'production') {
          this.state = applyCommand(this.state, { type: 'DEBUG_ADJUST_CHIPS', playerId: sender.id, delta: action.delta })
        }
        break

      case 'DEBUG_FULL_STATE':
        if (process.env.NODE_ENV !== 'production') {
          this.sendTo(sender, { type: 'DEBUG_FULL_STATE', state: this.state })
        }
        return

      case 'PRESENCE':
        // Relay ephemeral UI state to all other clients — no game state mutation
        for (const conn of this.room.getConnections()) {
          if (conn.id !== sender.id) {
            conn.send(JSON.stringify({ type: 'PRESENCE', playerId: sender.id, handOrder: action.handOrder, selectedPositions: action.selectedPositions }))
          }
        }
        return
    }

    this.broadcastState()
  }

  onClose(conn: Party.Connection) {
    this.state = applyCommand(this.state, { type: 'DISCONNECT', playerId: conn.id })
    this.broadcastState()
  }

  // Send individualized state to every connected player (each sees only their own hand)
  private broadcastState() {
    // Bump the sequence so any in-flight bot timer for a stale state is dropped.
    this.botSeq++
    if (this.botTimer) {
      clearTimeout(this.botTimer)
      this.botTimer = null
    }

    for (const conn of this.room.getConnections()) {
      this.sendTo(conn, { type: 'GAME_STATE', state: buildClientState(this.state, conn.id) })
    }

    // Persist after each mutation so the room can rehydrate after hibernation.
    if (this.state.phase === 'game_end' || this.state.phase === 'abandoned') {
      this.password = null
      this.room.storage.deleteAll()
      // Give clients time to receive and display the final state, then close all connections.
      // The room will go dormant on its own once no connections remain.
      setTimeout(() => {
        for (const conn of this.room.getConnections()) {
          conn.close(1000, 'Game over')
        }
      }, 30_000)
      return
    }
    this.room.storage.put('state', this.state)
    // Push the idle-cleanup alarm forward; if 24h pass with no further mutations,
    // onAlarm fires and wipes the room.
    this.room.storage.setAlarm(Date.now() + IDLE_TTL_MS)

    this.scheduleBotTurnIfNeeded()
  }

  private scheduleBotTurnIfNeeded() {
    if (this.state.phase !== 'playing') return
    const currentId = this.state.playerOrder[this.state.currentPlayerIndex]
    const player = this.state.players.find(p => p.id === currentId)
    if (!player || !player.isBot) return

    const seq = this.botSeq
    this.botTimer = setTimeout(() => {
      this.botTimer = null
      // Drop if state mutated between scheduling and firing
      if (seq !== this.botSeq) return
      this.runBotTurn(currentId)
    }, BOT_THINK_DELAY_MS)
  }

  private runBotTurn(botId: string) {
    if (this.state.phase !== 'playing') return
    if (this.state.playerOrder[this.state.currentPlayerIndex] !== botId) return
    const player = this.state.players.find(p => p.id === botId)
    if (!player || !player.isBot) return

    const difficulty = player.botDifficulty ?? DEFAULT_BOT_DIFFICULTY

    // Betting phase: heuristic-based decision, no MCTS.
    if (this.state.turnPhase === 'bet') {
      const action = chooseBettingAction(this.state, botId, difficulty)
      switch (action.type) {
        case 'CHECK': this.state = applyCommand(this.state, { type: 'CHECK', playerId: botId }); break
        case 'CALL':  this.state = applyCommand(this.state, { type: 'CALL', playerId: botId }); break
        case 'BET':   this.state = applyCommand(this.state, { type: 'BET', playerId: botId, amount: action.amount }); break
        case 'RAISE': this.state = applyCommand(this.state, { type: 'RAISE', playerId: botId, amount: action.amount }); break
        case 'FOLD':  this.state = applyCommand(this.state, { type: 'FOLD', playerId: botId }); break
      }
      this.broadcastState()
      return
    }

    const decision = chooseBotMove(this.state, botId, presetForDifficulty(difficulty))

    // DISCARD then PLAY/FOLD — the state machine validates each step.
    this.state = applyCommand(this.state, { type: 'DISCARD', playerId: botId, cards: decision.discard })
    if (decision.action.type === 'PLAY') {
      this.state = applyCommand(this.state, { type: 'PLAY', playerId: botId, cards: decision.action.cards })
    } else {
      this.state = applyCommand(this.state, { type: 'FOLD', playerId: botId })
    }

    this.broadcastState()
  }

  private sendTo(conn: Party.Connection, event: GameEvent) {
    conn.send(JSON.stringify(event))
  }

  // Sliding-window check + record. Returns true if this IP has exceeded the cap
  // in the last RATE_LIMIT_WINDOW_MS, in which case the caller should reject.
  private isRateLimited(ip: string): boolean {
    const now = Date.now()
    const cutoff = now - RATE_LIMIT_WINDOW_MS
    const recent = (this.connectsByIp.get(ip) ?? []).filter(ts => ts > cutoff)
    if (recent.length >= RATE_LIMIT_MAX_CONNECTS) {
      this.connectsByIp.set(ip, recent)
      return true
    }
    recent.push(now)
    this.connectsByIp.set(ip, recent)
    return false
  }
}
