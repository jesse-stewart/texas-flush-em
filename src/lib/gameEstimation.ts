// Rough wall-clock estimate of a game's duration, used in the lobby to set expectations.
// Calibrated against playtest timings: humans take ~2.5 min/round, bots are near-instant,
// average loser drops about 3 cards per round, and points-eliminate / chips modes drag
// 50% longer per extra player past the 2nd because survivors play down to one.
//
// This is a UX hint, not a billing source — small inaccuracy is fine.

import type { GameOptions } from '@shared/engine/game-state'

const HUMAN_MIN_PER_ROUND = 2.5
const BOT_MIN_PER_ROUND = 0.05
const AVG_CARDS_PER_LOSS = 3

export function estimateMinutes(opts: GameOptions, humansCount: number, botsCount: number): number | null {
  const playerCount = humansCount + botsCount
  if (playerCount < 2) return null
  const minPerRound = humansCount * HUMAN_MIN_PER_ROUND + botsCount * BOT_MIN_PER_ROUND
  const lossPerRound = AVG_CARDS_PER_LOSS * (playerCount - 1) / playerCount
  const roundsToFirstHit = opts.threshold / lossPerRound
  const isFirstHitOnly =
    opts.scoringMode === 'points' && opts.pointsThresholdAction === 'end_game'
  const tail = isFirstHitOnly ? 1 : 1 + 0.5 * (playerCount - 2)
  return Math.round(roundsToFirstHit * minPerRound * tail)
}

export function formatDuration(min: number): string {
  if (min < 60) return `~${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m === 0 ? `~${h} hr` : `~${h} hr ${m} min`
}
