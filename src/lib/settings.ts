// Lobby-form settings persisted in localStorage. Survives page reloads so the host
// doesn't have to re-pick scoring/dealing every game. Loaded into the WaitingRoom
// component's local useState seeds; saved (debounced) whenever any setting changes.

import type { GameOptions, DealMode } from '@shared/engine/game-state'
import { DEFAULT_OPTIONS, PERSONAL_MAX_CARDS, MIXED_DEFAULT_CARDS } from '@shared/engine/game-state'

export const SETTINGS_KEY = 'flushem_settings'

export interface PersistedSettings {
  scoringMode: GameOptions['scoringMode']
  pointsTarget: number
  chipsStarting: number
  chipValuePerCard: number
  anteAmount: number
  pointsThresholdAction: GameOptions['pointsThresholdAction']
  dealMode: DealMode
  personalCards: number
  mixedDeckCount: number
  mixedCards: number
}

export const DEFAULT_POINTS_TARGET = 26
export const DEFAULT_CHIPS_STARTING = 60

export const DEFAULT_SETTINGS: PersistedSettings = {
  scoringMode: DEFAULT_OPTIONS.scoringMode,
  pointsTarget: DEFAULT_POINTS_TARGET,
  chipsStarting: DEFAULT_CHIPS_STARTING,
  chipValuePerCard: DEFAULT_OPTIONS.chipValuePerCard,
  anteAmount: DEFAULT_OPTIONS.anteAmount,
  pointsThresholdAction: DEFAULT_OPTIONS.pointsThresholdAction,
  dealMode: DEFAULT_OPTIONS.dealMode,
  personalCards: PERSONAL_MAX_CARDS,
  mixedDeckCount: DEFAULT_OPTIONS.mixedDeckCount,
  mixedCards: MIXED_DEFAULT_CARDS,
}

export function loadSettings(): PersistedSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return DEFAULT_SETTINGS
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) as Partial<PersistedSettings> }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(s: PersistedSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
  } catch { /* quota / private mode */ }
}
