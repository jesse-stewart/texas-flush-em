import { useRef } from 'react'
import { palette } from '../../palette'
import { Chip, type ChipSize } from './Chip'

interface ChipStackProps {
  count: number
  playerName?: string
  size?: ChipSize
  stagger?: boolean
}

const DENOMINATIONS = [100, 25, 10, 5, 1] as const
type Denom = typeof DENOMINATIONS[number]

const MAX_VISIBLE = 10

// Per-size geometry. SLICE is the visible rim of each chip in a vertical stack;
// ROW_OFFSET_Y is the back-row lift so denominations peek above the front row.
// Both scale with chip size to keep the cluster proportional.
const GEOMETRY: Record<ChipSize, { slice: number; rowOffsetY: number }> = {
  18: { slice: 3, rowOffsetY: 10 },
  36: { slice: 6, rowOffsetY: 20 },
}

// Smallest first — fills back row before the front row.
const FILL_ORDER = [1, 5, 10, 25, 100] as const

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

interface Jitter {
  dx: number[]
  dy: number[]
  variant: (0 | 1)[]
}

// One random jitter table per stack instance. Computed once on mount so the
// pattern stays stable across rerenders, but every ChipStack rolls its own.
function useJitter(slots: number): Jitter {
  const ref = useRef<Jitter | null>(null)
  if (ref.current == null) {
    const dx: number[] = []
    const dy: number[] = []
    const variant: (0 | 1)[] = []
    for (let i = 0; i < slots; i++) {
      dx.push(Math.floor(Math.random() * 3) - 1)
      dy.push(Math.floor(Math.random() * 3) - 1)
      variant.push(Math.random() < 0.5 ? 0 : 1)
    }
    ref.current = { dx, dy, variant }
  }
  return ref.current
}

// Compact mini-chip row — one 18×18 chip per denomination present in the
// breakdown of `count`. Used in score callouts where a full ChipStack would
// be too tall.
export function MiniChipRow({ count }: { count: number }) {
  const jitter = useJitter(FILL_ORDER.length)
  if (count <= 0) return null
  const breakdown = breakIntoChips(count)
  const present = FILL_ORDER.filter(d => breakdown[d] > 0)
  return (
    <span style={{ display: 'inline-flex', gap: 1, alignItems: 'center' }}>
      {present.map((d, i) => (
        <Chip key={d} denom={d} size={18} variant={jitter.variant[i]} />
      ))}
    </span>
  )
}

export function ChipStack({ count, playerName, size = 36, stagger = true }: ChipStackProps) {
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

  const { slice, rowOffsetY } = GEOMETRY[size]
  const slotStep = size
  // Cluster layout — present denoms fill slots 0..N-1 left-to-right, smallest
  // first, so a full 5-stack arrangement looks like:
  //   $1 $5 $10        top row (z=1, behind)
  //    $25 $100        bottom row (z=2, in front)
  const slots = [
    { left: 0,                 bottom: rowOffsetY, z: 1 },
    { left: slotStep,          bottom: rowOffsetY, z: 1 },
    { left: 2 * slotStep,      bottom: rowOffsetY, z: 1 },
    { left: slotStep / 2,      bottom: 0,          z: 2 },
    { left: 3 * slotStep / 2,  bottom: 0,          z: 2 },
  ]

  const breakdown = breakIntoChips(count)
  const presentDenoms = FILL_ORDER.filter(d => breakdown[d] > 0)

  let topMax = 0
  let bottomMax = 0
  let maxRight = 0
  for (let i = 0; i < presentDenoms.length; i++) {
    const slot = slots[i]
    const visible = Math.min(breakdown[presentDenoms[i]], MAX_VISIBLE)
    const stackHeight = (visible - 1) * slice + size
    if (i >= 3) bottomMax = Math.max(bottomMax, stackHeight)
    else        topMax    = Math.max(topMax, stackHeight + rowOffsetY)
    maxRight = Math.max(maxRight, slot.left + size)
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
          const { left, bottom, z } = slots[i]
          return (
            <SingleStack
              key={d}
              denom={d}
              count={breakdown[d]}
              size={size}
              slice={slice}
              left={left}
              bottom={bottom}
              zIndex={z}
              stagger={stagger}
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
  denom, count, size, slice, left, bottom, zIndex, stagger,
}: {
  denom: Denom
  count: number
  size: ChipSize
  slice: number
  left: number
  bottom: number
  zIndex: number
  stagger: boolean
}) {
  const jitter = useJitter(MAX_VISIBLE)
  const visible = Math.min(count, MAX_VISIBLE)
  const overflow = count - visible
  const stackHeight = (visible - 1) * slice + size

  return (
    <span
      style={{
        position: 'absolute',
        left,
        bottom,
        width: size + (overflow > 0 ? 20 : 0),
        height: stackHeight,
        zIndex,
      }}
      title={`${count} × $${denom}`}
    >
      {Array.from({ length: visible }).map((_, i) => (
        <Chip
          key={i}
          denom={denom}
          size={size}
          variant={jitter.variant[i]}
          style={{
            position: 'absolute',
            left: stagger ? jitter.dx[i] : 0,
            bottom: i * slice + (stagger ? jitter.dy[i] : 0),
          }}
        />
      ))}
      {overflow > 0 && (
        <span
          style={{
            position: 'absolute',
            left: size + 2,
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
