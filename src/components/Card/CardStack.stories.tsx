import type { Meta, StoryObj } from '@storybook/react'
import type { Card as CardType } from '@shared/engine/card'
import { CardStack, type CardStackDirection } from './CardStack'
import { palette } from '../../palette'

const DIRECTIONS: CardStackDirection[] = ['NW', 'N', 'NE', 'W', 'E', 'SW', 'S', 'SE']

const meta: Meta<typeof CardStack> = {
  title: 'Components/CardStack',
  component: CardStack,
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'felt', values: [{ name: 'felt', value: palette.felt }] },
  },
  tags: ['autodocs'],
  argTypes: {
    count: { control: { type: 'number', min: 0, max: 30 } },
    offset: { control: { type: 'number', min: 0, max: 12 } },
    direction: { control: { type: 'select' }, options: DIRECTIONS },
    rotation: { control: { type: 'inline-radio' }, options: [0, 90, -90, 180] },
    showEmpty: { control: 'boolean' },
    emptyLabel: { control: 'text' },
  },
}

export default meta
type Story = StoryObj<typeof meta>

// --- Basics ---------------------------------------------------------------

export const Default: Story = {
  args: { count: 6 },
}

export const Empty: Story = {
  args: { count: 0, showEmpty: true },
}

const FACE_UP_HAND: CardType[] = [
  { rank: 2,   suit: 'clubs' },
  { rank: 7,   suit: 'diamonds' },
  { rank: 'J', suit: 'hearts' },
  { rank: 'Q', suit: 'spades' },
  { rank: 'A', suit: 'hearts' },
]

// Pass `cards` to render layers face-up. Index 0 is the bottom of the stack;
// the last entry sits on top and is the most visible.
export const FaceUp: Story = {
  args: { count: 5, cards: FACE_UP_HAND, offset: 6 },
}

// Common discard-pile pattern: only the top card is face-up; everything below
// is face-down filler. Achieved by leaving lower indexes undefined.
export const FaceUpTop: Story = {
  args: {
    count: 5,
    cards: [undefined, undefined, undefined, undefined, { rank: 'K', suit: 'spades' }],
  },
}

// --- Prop galleries -------------------------------------------------------

// Stagger thickness as the deck fills up.
export const CountProgression: Story = {
  render: () => (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 24, color: palette.white }}>
      {[0, 1, 2, 3, 4, 5, 6].map(n => (
        <div key={n} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12 }}>{n}</span>
          <CardStack count={n} showEmpty />
        </div>
      ))}
    </div>
  ),
}

// Sweep `offset` from tight to loose so it's easy to pick a number that reads
// well at the desired count.
export const OffsetSweep: Story = {
  render: () => (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 32, color: palette.white }}>
      {[1, 2, 3, 4, 6, 8, 12].map(o => (
        <div key={o} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12 }}>{o}px</span>
          <CardStack count={5} offset={o} />
        </div>
      ))}
    </div>
  ),
}

// All eight compass directions arranged like a 3×3 grid (the center cell is
// where the top card sits). Lower layers fan outward in each direction.
export const DirectionGrid: Story = {
  render: () => {
    const layout: (CardStackDirection | null)[][] = [
      ['NW', 'N',  'NE'],
      ['W',  null, 'E'],
      ['SW', 'S',  'SE'],
    ]
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 160px)', gap: 32, color: palette.white }}>
        {layout.flat().map((dir, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 8, minHeight: 160 }}>
            {dir == null ? (
              <span style={{ fontSize: 11, fontStyle: 'italic', opacity: 0.5 }}>top card</span>
            ) : (
              <>
                <CardStack count={5} direction={dir} offset={6} />
                <span style={{ fontSize: 12 }}>{dir}</span>
              </>
            )}
          </div>
        ))}
      </div>
    )
  },
}

// All four rotations side-by-side.
export const RotationCompare: Story = {
  render: () => (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 64, color: palette.white }}>
      {[0, 180, 90, -90].map(r => (
        <div key={r} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12 }}>{r}°</span>
          <CardStack count={4} rotation={r as 0 | 90 | -90 | 180} />
        </div>
      ))}
    </div>
  ),
}

// --- Real-world presets ---------------------------------------------------

export const Across: Story = {
  args: { count: 4, rotation: 180 },
}

export const VerticalLeft: Story = {
  args: { count: 4, rotation: 90 },
}

export const VerticalRight: Story = {
  args: { count: 4, rotation: -90 },
}

export const MiddlePile: Story = {
  args: { count: 3, offset: 2 },
}

// The four real call sites in the app, configured as they are wired in code.
export const InContext: Story = {
  render: () => (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 48, color: palette.white }}>
      <Labeled label="Own deck">
        <CardStack count={20} showEmpty />
      </Labeled>
      <Labeled label="Opponent across">
        <CardStack count={20} rotation={180} showEmpty />
      </Labeled>
      <Labeled label="Opponent left">
        <CardStack count={20} rotation={90} showEmpty />
      </Labeled>
      <Labeled label="Opponent right">
        <CardStack count={20} rotation={-90} showEmpty />
      </Labeled>
      <Labeled label="Middle pile">
        <CardStack count={5} offset={2} />
      </Labeled>
    </div>
  ),
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 11, fontStyle: 'italic', opacity: 0.8 }}>{label}</span>
      {children}
    </div>
  )
}
