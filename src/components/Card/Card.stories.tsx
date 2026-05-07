import type { Meta, StoryObj } from '@storybook/react'
import { Card } from './Card'
import { palette } from '../../palette'

const meta: Meta<typeof Card> = {
  title: 'Components/Card',
  component: Card,
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'felt', values: [{ name: 'felt', value: palette.felt }] },
  },
  tags: ['autodocs'],
  argTypes: {
    onClick: { action: 'clicked' },
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const AceOfSpades: Story = {
  args: { card: { rank: 'A', suit: 'spades' } },
}

export const TenOfHearts: Story = {
  args: { card: { rank: 10, suit: 'hearts' } },
}

export const TwoOfClubs: Story = {
  args: { card: { rank: 2, suit: 'clubs' } },
}

export const KingOfDiamonds: Story = {
  args: { card: { rank: 'K', suit: 'diamonds' } },
}

export const Selected: Story = {
  args: { card: { rank: 'Q', suit: 'hearts' }, selected: true },
}

export const FaceDown: Story = {
  args: { card: { rank: 'A', suit: 'spades' }, faceDown: true },
}

export const HandOfCards: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 8 }}>
      <Card card={{ rank: 2, suit: 'clubs' }} />
      <Card card={{ rank: 7, suit: 'diamonds' }} />
      <Card card={{ rank: 'J', suit: 'hearts' }} selected />
      <Card card={{ rank: 'K', suit: 'spades' }} />
      <Card card={{ rank: 'A', suit: 'spades' }} />
    </div>
  ),
}
