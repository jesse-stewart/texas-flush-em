// ============================================================
// Records every command applied through the engine to Supabase
// for replay + audit. Designed to be fire-and-forget — the game
// loop never waits on DB latency, and missing/misconfigured
// Supabase env vars degrade gracefully (recorder becomes a no-op).
// ============================================================

import type * as Party from 'partykit/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { GameCommand } from '../shared/engine/state-machine'
import type { GameState } from '../shared/engine/game-state'
import { createServerClient } from './supabase'

const STORAGE_GAME_ID = 'history.gameId'
const STORAGE_SEQ = 'history.seq'

// Snapshot of a connection at game-start time. Caller (game.ts) provides
// these by iterating the room's connections — the recorder doesn't know how
// to extract IP/UA from a Party.Connection itself.
export interface ConnectionSnapshot {
  playerId: string
  ip: string | null
  userAgent: string | null
}

export class HistoryRecorder {
  private client: SupabaseClient | null = null
  private clientResolved = false
  private gameId: string | null = null
  private seq = 0

  constructor(
    private room: Party.Room,
    // Returns a snapshot of every live connection. Called once on game-start
    // so we can backfill game_connections for players who joined the lobby
    // before the games row existed.
    private getLiveConnections: () => ConnectionSnapshot[],
  ) {}

  // Rehydrate after hibernation. Call from onStart.
  async load(): Promise<void> {
    this.gameId = (await this.room.storage.get<string>(STORAGE_GAME_ID)) ?? null
    this.seq = (await this.room.storage.get<number>(STORAGE_SEQ)) ?? 0
  }

  private getClient(): SupabaseClient | null {
    if (this.clientResolved) return this.client
    this.clientResolved = true
    try {
      this.client = createServerClient(this.room)
    } catch (err) {
      console.warn('[history] Supabase not configured; recording disabled:', (err as Error).message)
      this.client = null
    }
    return this.client
  }

  // Record a single command + its result. Called after applyCommand.
  // Detects game-start (lobby->playing) and game-end (->game_end/abandoned)
  // transitions and writes the games row accordingly.
  async record(cmd: GameCommand, prev: GameState, next: GameState, ip: string | null): Promise<void> {
    const sb = this.getClient()
    if (!sb) return

    // Game start: any phase -> playing.
    if (prev.phase !== 'playing' && next.phase === 'playing') {
      const playerNames: Record<string, string> = {}
      for (const p of next.players) playerNames[p.id] = p.name
      const { data, error } = await sb
        .from('games')
        .insert({
          room_id: this.room.id,
          options: next.options,
          player_ids: next.players.map((p) => p.id),
          player_names: playerNames,
        })
        .select('id')
        .single()
      if (error || !data) {
        console.error('[history] failed to create game row:', error)
        return
      }
      this.gameId = data.id as string
      this.seq = 0
      await this.room.storage.put(STORAGE_GAME_ID, this.gameId)
      await this.room.storage.put(STORAGE_SEQ, 0)

      // Backfill connection rows for everyone who joined during the lobby
      // (their onConnect fired before this.gameId existed and was a no-op).
      const live = this.getLiveConnections()
      if (live.length > 0) {
        const rows = live.map((c) => ({
          game_id: this.gameId,
          player_id: c.playerId,
          ip: c.ip,
          user_agent: c.userAgent,
        }))
        void sb
          .from('game_connections')
          .insert(rows)
          .then(({ error }) => {
            if (error) console.error('[history] initial connection backfill failed:', error)
          })
      }
    }

    // No game in progress (lobby command before START_GAME, or post-end).
    if (!this.gameId) return

    const seq = this.seq++
    // Persist seq cursor so a hibernation-then-replay doesn't re-issue the same number.
    void this.room.storage.put(STORAGE_SEQ, this.seq)

    const playerId = 'playerId' in cmd ? cmd.playerId : null
    void sb
      .from('game_events')
      .insert({
        game_id: this.gameId,
        seq,
        type: cmd.type,
        player_id: playerId,
        ip,
        payload: cmd,
        state_after: next,
      })
      .then(({ error }) => {
        if (error) console.error('[history] event insert failed:', error)
      })

    // Game end: -> game_end or abandoned.
    const ending =
      (next.phase === 'game_end' || next.phase === 'abandoned') &&
      prev.phase !== 'game_end' &&
      prev.phase !== 'abandoned'
    if (ending) {
      const finalizingId = this.gameId
      void sb
        .from('games')
        .update({
          ended_at: new Date().toISOString(),
          winner_player_id: next.gameWinnerId,
          final_state: next,
        })
        .eq('id', finalizingId)
        .then(({ error }) => {
          if (error) console.error('[history] game finalize failed:', error)
        })
      this.gameId = null
      this.seq = 0
      await this.room.storage.delete(STORAGE_GAME_ID)
      await this.room.storage.delete(STORAGE_SEQ)
    }
  }

  // Log a new connection. Only writes if a game is in progress.
  async recordConnect(playerId: string, ip: string | null, userAgent: string | null): Promise<void> {
    const sb = this.getClient()
    if (!sb || !this.gameId) return
    const { error } = await sb.from('game_connections').insert({
      game_id: this.gameId,
      player_id: playerId,
      ip,
      user_agent: userAgent,
    })
    if (error) console.error('[history] connection insert failed:', error)
  }

  // Mark the most recent still-open connection row for this player as closed.
  async recordDisconnect(playerId: string): Promise<void> {
    const sb = this.getClient()
    if (!sb || !this.gameId) return
    const { error } = await sb
      .from('game_connections')
      .update({ disconnected_at: new Date().toISOString() })
      .eq('game_id', this.gameId)
      .eq('player_id', playerId)
      .is('disconnected_at', null)
    if (error) console.error('[history] disconnect update failed:', error)
  }
}
