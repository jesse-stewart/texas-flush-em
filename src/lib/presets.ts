// Lobby quick-pick presets. A preset overrides a subset of PersistedSettings;
// fields the preset doesn't set are left at the user's current value.
// `detectActivePreset` shows a • next to whichever preset matches the current settings.

import type { PersistedSettings } from './settings'

export type PresetKey = 'default' | 'quick' | 'classic' | 'long'

export interface Preset {
  key: PresetKey
  label: string
  hint: string
  settings: Partial<PersistedSettings>
}

export const PRESETS: Preset[] = [
  {
    key: 'default',
    label: 'Default',
    hint: 'Chips with $5 ante, classic deck.',
    settings: {
      scoringMode: 'chips',
      chipsStarting: 60,
      chipValuePerCard: 5,
      anteAmount: 5,
      dealMode: 'classic',
    },
  },
  {
    key: 'quick',
    label: 'Quick',
    hint: 'First to 13 points ends the game.',
    settings: {
      scoringMode: 'points',
      pointsTarget: 13,
      pointsThresholdAction: 'end_game',
      dealMode: 'classic',
    },
  },
  {
    key: 'classic',
    label: 'Classic',
    hint: 'Points to 26, eliminate at threshold.',
    settings: {
      scoringMode: 'points',
      pointsTarget: 26,
      pointsThresholdAction: 'eliminate',
      dealMode: 'classic',
    },
  },
  {
    key: 'long',
    label: 'Long game',
    hint: 'Chips, take everyone to win.',
    settings: {
      scoringMode: 'chips',
      chipsStarting: 78,
      chipValuePerCard: 6,
      dealMode: 'classic',
    },
  },
]

export function detectActivePreset(s: PersistedSettings): PresetKey | null {
  for (const p of PRESETS) {
    const match = (Object.keys(p.settings) as (keyof PersistedSettings)[])
      .every(k => s[k] === p.settings[k])
    if (match) return p.key
  }
  return null
}
