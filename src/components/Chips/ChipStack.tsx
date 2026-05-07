import { palette } from '../../palette'

interface ChipStackProps {
  count: number
  playerName?: string
}

const DENOMINATIONS = [100, 25, 10, 5, 1] as const
type Denom = typeof DENOMINATIONS[number]

const SPRITE_URL = '/cards.png'
const SHEET_W = 923
const SHEET_H = 576
const NATIVE_CHIP = 36
const ORIGIN_X = 675
const ORIGIN_Y = 480

const SCALE = 1
const CHIP_W = NATIVE_CHIP * SCALE
const CHIP_H = NATIVE_CHIP * SCALE
const SLICE = 6 * SCALE
const MAX_VISIBLE = 10

// Cluster layout:
//   0 1 2       top row, behind
//    3 4        bottom row, in front (offset by half-step)
const SLOT_GAP_X = 0
const SLOT_STEP = CHIP_W + SLOT_GAP_X
// Big enough that back-row chips peek their denomination markings above the
// front row instead of getting fully occluded.
const ROW_OFFSET_Y = 20 * SCALE

// Cluster layout — present denoms fill slots 0..N-1 left-to-right, smallest
// first, so a full 5-stack arrangement looks like:
//   $1 $5 $10        top row (z=1, behind)
//    $25 $100        bottom row (z=2, in front)
// With fewer stacks, the leftover slots are simply unused (still adjacent).
const SLOTS = [
  { left: 0,                     bottom: ROW_OFFSET_Y, z: 1 },
  { left: SLOT_STEP,             bottom: ROW_OFFSET_Y, z: 1 },
  { left: 2 * SLOT_STEP,         bottom: ROW_OFFSET_Y, z: 1 },
  { left: SLOT_STEP / 2,         bottom: 0,            z: 2 },
  { left: 3 * SLOT_STEP / 2,     bottom: 0,            z: 2 },
] as const

// Smallest first — fills back row before the front row.
const FILL_ORDER = [1, 5, 10, 25, 100] as const

// Big-chip sprite layout: cols index denomination, rows index variant.
const DENOM_COL: Record<Denom, number> = {
  1:   0,
  5:   1,
  10:  2,
  25:  3,
  100: 4,
}

// Each non-$100 stack is capped at this many chips.
const STACK_CAP = 5

// Reserve-from-smaller breakdown: walk largest → smallest, and at each step
// take only the chips smaller denoms *can't* absorb at STACK_CAP each. This
// produces an even distribution where most counts carry multiple denoms
// simultaneously, instead of one large denom hoovering all the value.
// $100 has no cap; everything else is bounded by STACK_CAP by construction.
export function breakIntoChips(count: number): Record<Denom, number> {
  let remaining = Math.max(0, Math.floor(count))
  const result: Record<Denom, number> = { 100: 0, 25: 0, 10: 0, 5: 0, 1: 0 }
  for (let i = 0; i < DENOMINATIONS.length; i++) {
    const d = DENOMINATIONS[i]
    let smallerCapacity = 0
    for (let j = i + 1; j < DENOMINATIONS.length; j++) {
      smallerCapacity += DENOMINATIONS[j] * STACK_CAP
    }
    const take = Math.max(0, Math.ceil((remaining - smallerCapacity) / d))
    result[d] = take
    remaining -= take * d
  }
  return result
}

// Stable pseudo-random variant per (denom, position).
function variantFor(denom: number, index: number): 0 | 1 {
  const h = (denom * 73856093) ^ (index * 19349663)
  return ((h >>> 0) & 1) as 0 | 1
}

function chipSpriteStyle(denom: Denom, variant: 0 | 1): React.CSSProperties {
  const x = ORIGIN_X + DENOM_COL[denom] * NATIVE_CHIP
  const y = ORIGIN_Y + variant * NATIVE_CHIP
  return {
    width: CHIP_W,
    height: CHIP_H,
    backgroundImage: `url(${SPRITE_URL})`,
    backgroundSize: `${SHEET_W * SCALE}px ${SHEET_H * SCALE}px`,
    backgroundPosition: `-${x * SCALE}px -${y * SCALE}px`,
    backgroundRepeat: 'no-repeat',
    imageRendering: 'pixelated',
  }
}

export function ChipStack({ count, playerName }: ChipStackProps) {
  if (count <= 0) {
    return (
      <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 2, verticalAlign: 'bottom' }}>
        <span style={{ fontSize: 11, color: palette.ltGray, fontStyle: 'italic' }}>
          empty
        </span>
        {playerName != null && <ChipStackLabel playerName={playerName} count={0} />}
      </span>
    )
  }

  const breakdown = breakIntoChips(count)
  const presentDenoms = FILL_ORDER.filter(d => breakdown[d] > 0)

  let topMax = 0
  let bottomMax = 0
  let maxRight = 0
  for (let i = 0; i < presentDenoms.length; i++) {
    const slot = SLOTS[i]
    const visible = Math.min(breakdown[presentDenoms[i]], MAX_VISIBLE)
    const stackHeight = (visible - 1) * SLICE + CHIP_H
    if (i >= 3) bottomMax = Math.max(bottomMax, stackHeight)
    else        topMax    = Math.max(topMax, stackHeight + ROW_OFFSET_Y)
    maxRight = Math.max(maxRight, slot.left + CHIP_W)
  }
  const containerH = Math.max(topMax, bottomMax)

  return (
    <span
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        verticalAlign: 'bottom',
      }}
    >
      <span
        style={{
          position: 'relative',
          display: 'inline-block',
          width: maxRight,
          height: containerH,
        }}
      >
        {presentDenoms.map((d, i) => {
          const { left, bottom, z } = SLOTS[i]
          return (
            <SingleStack
              key={d}
              denom={d}
              count={breakdown[d]}
              left={left}
              bottom={bottom}
              zIndex={z}
            />
          )
        })}
      </span>
      {playerName != null && <ChipStackLabel playerName={playerName} count={count} />}
    </span>
  )
}

function ChipStackLabel({ playerName, count }: { playerName: string; count: number }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        color: palette.white,
        textShadow: '1px 1px 0 rgba(0,0,0,0.6)',
        whiteSpace: 'nowrap',
        lineHeight: 1,
      }}
    >
      {playerName}: ${count}
    </span>
  )
}

function SingleStack({
  denom, count, left, bottom, zIndex,
}: {
  denom: Denom
  count: number
  left: number
  bottom: number
  zIndex: number
}) {
  const visible = Math.min(count, MAX_VISIBLE)
  const overflow = count - visible
  const stackHeight = (visible - 1) * SLICE + CHIP_H

  return (
    <span
      style={{
        position: 'absolute',
        left,
        bottom,
        width: CHIP_W + (overflow > 0 ? 20 : 0),
        height: stackHeight,
        zIndex,
      }}
      title={`${count} × $${denom}`}
    >
      {Array.from({ length: visible }).map((_, i) => (
        <span
          key={i}
          style={{
            position: 'absolute',
            left: 0,
            bottom: i * SLICE,
            ...chipSpriteStyle(denom, variantFor(denom, i)),
          }}
        />
      ))}
      {overflow > 0 && (
        <span
          style={{
            position: 'absolute',
            left: CHIP_W + 2,
            bottom: 2,
            fontSize: 11,
            fontWeight: 700,
            color: palette.white,
            textShadow: '1px 1px 0 black',
            lineHeight: 1,
          }}
        >
          +{overflow}
        </span>
      )}
    </span>
  )
}
