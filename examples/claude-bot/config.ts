// ============================================================
// Bot configuration. Edit values here, or override via .env.
// ============================================================

import 'dotenv/config'
import type { BotDifficulty } from '../../bot-sdk'

export interface BotRunConfig {
  // Connection
  host: string
  roomId: string
  password?: string
  playerName: string
  playerId?: string

  // Claude API
  model: string
  // Effort controls token spend / thinking depth. Sonnet/Opus 4.6+ supports low|medium|high|max (max is Opus-only).
  // Opus 4.7 also accepts 'xhigh' between high and max — pass it via the env var if your SDK version supports it.
  effort: 'low' | 'medium' | 'high' | 'max'
  // Adaptive thinking lets Claude decide when to think. 'summarized' display surfaces reasoning to the console.
  thinkingDisplay: 'omitted' | 'summarized'
  // Max output tokens per Claude call. Generous default — actions are short, but thinking can be longer.
  maxTokens: number

  // CPU bots to add when entering a fresh lobby. One entry per bot, each its own difficulty.
  // E.g. ['easy', 'hard'] adds two CPUs: one easy, one hard.
  extraBots: BotDifficulty[]

  // Auto-start the game from the lobby once at least 2 players are seated.
  // Wait `autoStartDelayMs` after entering the lobby first, to give humans time
  // to join and any extra bots to register on the server.
  autoStart: boolean
  autoStartDelayMs: number
}

function require(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required env var: ${name}. Copy .env.example to .env and set it.`)
  return value
}

export const config: BotRunConfig = {
  // --- Connection ---
  host: process.env.PARTYKIT_HOST ?? require('PARTYKIT_HOST'),
  roomId: process.env.ROOM_ID ?? require('ROOM_ID'),
  password: process.env.ROOM_PASSWORD,
  playerName: process.env.BOT_NAME ?? 'Claude',
  playerId: process.env.BOT_ID,

  // --- Claude API ---
  // Default to Opus 4.7 — the most capable model. Override here or via env if you want Sonnet/Haiku.
  model: process.env.CLAUDE_MODEL ?? 'claude-opus-4-7',
  effort: (process.env.CLAUDE_EFFORT as BotRunConfig['effort']) ?? 'high',
  thinkingDisplay: (process.env.CLAUDE_THINKING_DISPLAY as 'omitted' | 'summarized') ?? 'summarized',
  maxTokens: Number(process.env.CLAUDE_MAX_TOKENS ?? 16000),

  // --- Lobby auto-fill ---
  // Comma-separated list of difficulties. One CPU bot is added per entry.
  // E.g. EXTRA_BOTS=easy,hard,medium → 3 CPUs: easy + hard + medium.
  // Capped to 3 (the room's 4-player limit minus this bot).
  extraBots: parseExtraBots(process.env.EXTRA_BOTS),

  // --- Auto-start ---
  autoStart: parseBool(process.env.AUTO_START, false),
  autoStartDelayMs: Number(process.env.AUTO_START_DELAY_MS ?? 3000),
}

function parseBool(raw: string | undefined, fallback: boolean): boolean {
  if (raw == null) return fallback
  const v = raw.trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes' || v === 'on'
}

function parseExtraBots(raw: string | undefined): BotDifficulty[] {
  if (!raw) return []
  const valid: ReadonlySet<string> = new Set(['easy', 'medium', 'hard'])
  const parsed: BotDifficulty[] = []
  for (const part of raw.split(',').map(s => s.trim().toLowerCase())) {
    if (part.length === 0) continue
    if (valid.has(part)) {
      parsed.push(part as BotDifficulty)
    } else {
      console.warn(`[config] ignoring invalid EXTRA_BOTS entry "${part}" — must be easy|medium|hard`)
    }
  }
  if (parsed.length > 3) {
    console.warn(`[config] EXTRA_BOTS has ${parsed.length} entries; capping to 3 (room limit)`)
    return parsed.slice(0, 3)
  }
  return parsed
}
