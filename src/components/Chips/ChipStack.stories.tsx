import type { Meta, StoryObj } from '@storybook/react'
import { ChipStack } from './ChipStack'
import { palette } from '../../palette'

const meta: Meta<typeof ChipStack> = {
  title: 'Components/ChipStack',
  component: ChipStack,
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'felt', values: [{ name: 'felt', value: palette.felt }] },
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof meta>

export const Thirteen: Story = {
  args: { count: 13 },
}

export const One: Story = {
  args: { count: 1 },
}

export const Five: Story = {
  args: { count: 5 },
}

export const Twenty: Story = {
  args: { count: 20 },
}

export const Empty: Story = {
  args: { count: 0 },
}

export const HundredPlus: Story = {
  args: { count: 137 },
}

export const Overflow: Story = {
  args: { count: 999 },
}

export const Range: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, color: palette.white }}>
      {[0, 1, 4, 5, 9, 10, 13, 26, 50, 99, 100, 137, 250].map(n => (
        <div key={n} style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
          <span style={{ width: 40, textAlign: 'right' }}>{n}</span>
          <ChipStack count={n} />
        </div>
      ))}
    </div>
  ),
}
