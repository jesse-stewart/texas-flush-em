import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { Hand } from './Hand'
import { c } from '../../storybook/fixtures'
import { palette } from '../../palette'
import type { Card } from '@shared/engine/card'

const meta: Meta<typeof Hand> = {
  title: 'Game/Hand',
  component: Hand,
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'felt', values: [{ name: 'felt', value: palette.felt }] },
  },
}
export default meta
type Story = StoryObj<typeof meta>

// Wrapper that provides selection state — Hand is fully controlled, so stories need a parent.
function Interactive({
  cards, faceDown, flip, disabled,
}: { cards: Card[]; faceDown?: boolean; flip?: boolean; disabled?: boolean }) {
  const [selected, setSelected] = useState<number[]>([])
  const ids = cards.map((_, i) => `slot-${i}`)
  return (
    <div style={{ width: 600, padding: 80 }}>
      <Hand
        cards={cards}
        ids={ids}
        selectedIndices={selected}
        onToggle={i =>
          setSelected(prev =>
            prev.includes(i) ? prev.filter(x => x !== i) : prev.length < 5 ? [...prev, i] : prev
          )
        }
        faceDown={faceDown}
        flip={flip}
        disabled={disabled}
      />
    </div>
  )
}

export const Default: Story = {
  render: () => (
    <Interactive
      cards={[
        c(2, 'clubs'),
        c(7, 'diamonds'),
        c('J', 'hearts'),
        c('Q', 'hearts'),
        c('A', 'spades'),
      ]}
    />
  ),
}

// The reason this story exists: regression test for the duplicate-card bug.
// Two J♥ in the same hand must select independently; clicking one must not select both.
export const DuplicateCards: Story = {
  render: () => (
    <Interactive
      cards={[
        c('J', 'hearts'),
        c('J', 'hearts'),
        c(4, 'spades'),
        c(4, 'spades'),
        c('K', 'clubs'),
      ]}
    />
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Two J♥ from a multi-deck game. Each card has a distinct slot id, so clicking one only selects that one.',
      },
    },
  },
}

export const FaceDown: Story = {
  render: () => (
    <Interactive
      cards={Array.from({ length: 8 }, () => c(2, 'clubs'))}
      faceDown
      disabled
    />
  ),
}

export const FaceDownFlipped: Story = {
  render: () => (
    <Interactive
      cards={Array.from({ length: 8 }, () => c(2, 'clubs'))}
      faceDown
      flip
      disabled
    />
  ),
  parameters: {
    docs: {
      description: { story: 'How an opponent\'s hand renders above the table (flipped 180°).' },
    },
  },
}

export const Disabled: Story = {
  render: () => (
    <Interactive
      cards={[c(5, 'hearts'), c(8, 'diamonds'), c(10, 'spades')]}
      disabled
    />
  ),
}
