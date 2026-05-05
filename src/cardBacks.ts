// Card-back catalog. Each cell on the sprite (cards.png) is 71x96 in source, but
// every consumer scales the sprite to the rendered card size, so coordinates
// here are simply (row, col) into the 13x6 grid.
//
// Animations:
//   - 'loop': cycles through `frames` continuously at `frameMs` per frame.
//   - 'trigger': sits at `rest` for `intervalMs`, then plays `frames` once at
//     `frameMs` per frame, then returns to rest.

export interface SpriteCell {
  row: number
  col: number
}

export type CardBackAnimation =
  | { type: 'loop'; frames: SpriteCell[]; frameMs: number }
  | { type: 'trigger'; frames: SpriteCell[]; frameMs: number; intervalMs: number }

export interface CardBackDef {
  id: string
  label: string
  rest: SpriteCell
  animation?: CardBackAnimation
}

export const CARD_BACKS: CardBackDef[] = [
  { id: 'crosshatch',      label: 'Crosshatch',      rest: { row: 4, col: 0 } },
  { id: 'weave',           label: 'Weave',           rest: { row: 4, col: 1 } },
  { id: 'clownfish_light', label: 'Clownfish',       rest: { row: 4, col: 2 } },
  { id: 'clownfish_dark',  label: 'Clownfish (dark)',rest: { row: 4, col: 3 } },
  { id: 'acorns',          label: 'Acorns',          rest: { row: 4, col: 4 } },
  { id: 'acorns_blue',     label: 'Acorns (blue)',   rest: { row: 4, col: 5 } },
  {
    id: 'robot',
    label: 'Robot',
    rest: { row: 4, col: 6 },
    animation: {
      type: 'loop',
      frames: [{ row: 4, col: 6 }, { row: 4, col: 7 }, { row: 4, col: 8 }],
      frameMs: 280,
    },
  },
  { id: 'roses',           label: 'Roses',           rest: { row: 4, col: 9 } },
  { id: 'conch',           label: 'Conch',           rest: { row: 5, col: 0 } },
  {
    id: 'castle',
    label: 'Castle',
    rest: { row: 5, col: 1 },
    animation: {
      type: 'loop',
      frames: [{ row: 5, col: 1 }, { row: 5, col: 2 }],
      frameMs: 220,
    },
  },
  {
    id: 'palm',
    label: 'Palm Tree',
    rest: { row: 5, col: 3 },
    animation: {
      type: 'trigger',
      frames: [{ row: 5, col: 4 }, { row: 5, col: 5 }, { row: 5, col: 4 }],
      frameMs: 200,
      intervalMs: 30_000,
    },
  },
  {
    id: 'sleeve',
    label: 'Ace Up the Sleeve',
    rest: { row: 5, col: 6 },
    animation: {
      type: 'trigger',
      frames: [{ row: 5, col: 7 }, { row: 5, col: 8 }, { row: 5, col: 7 }],
      frameMs: 250,
      intervalMs: 15_000,
    },
  },
]

export const CARD_BACK_BY_ID: Record<string, CardBackDef> = Object.fromEntries(
  CARD_BACKS.map(b => [b.id, b]),
)

export const DEFAULT_CARD_BACK_ID = 'palm'

export function getCardBack(id: string | undefined | null): CardBackDef {
  if (id && CARD_BACK_BY_ID[id]) return CARD_BACK_BY_ID[id]
  return CARD_BACK_BY_ID[DEFAULT_CARD_BACK_ID]
}

// Compute the visible sprite cell for a back at the given timestamp (ms).
export function backFrameAt(back: CardBackDef, nowMs: number): SpriteCell {
  const anim = back.animation
  if (!anim) return back.rest
  if (anim.type === 'loop') {
    if (anim.frames.length === 0) return back.rest
    const cycle = anim.frames.length * anim.frameMs
    const t = nowMs % cycle
    const idx = Math.floor(t / anim.frameMs)
    return anim.frames[idx] ?? back.rest
  }
  // trigger
  const animDuration = anim.frames.length * anim.frameMs
  const cycle = anim.intervalMs + animDuration
  const t = nowMs % cycle
  if (t < anim.intervalMs) return back.rest
  const idx = Math.floor((t - anim.intervalMs) / anim.frameMs)
  return anim.frames[idx] ?? back.rest
}

// Shared 100ms ticker so animated cards re-render in lockstep without each
// owning its own setInterval.
type Listener = () => void
const listeners = new Set<Listener>()
let timer: ReturnType<typeof setInterval> | null = null

export function subscribeAnimationTick(fn: Listener): () => void {
  listeners.add(fn)
  if (timer === null) {
    timer = setInterval(() => listeners.forEach(l => l()), 100)
  }
  return () => {
    listeners.delete(fn)
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer)
      timer = null
    }
  }
}
