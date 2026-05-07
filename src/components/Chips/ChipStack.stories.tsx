import type { Meta, StoryObj } from '@storybook/react'
import { ChipStack, MiniChipRow } from './ChipStack'
import { palette } from '../../palette'

const meta: Meta<typeof ChipStack> = {
  title: 'Components/ChipStack',
  component: ChipStack,
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'felt', values: [{ name: 'felt', value: palette.felt }] },
  },
  tags: ['autodocs'],
  argTypes: {
    size: { control: { type: 'inline-radio' }, options: [18, 36] },
    stagger: { control: 'boolean' },
  },
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

export const Mini: Story = {
  args: { count: 137, size: 18 },
}

export const StaggerCompare: Story = {
  render: () => (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 32, color: palette.white }}>
      {[5, 13, 50, 137].map(n => (
        <div key={n} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12 }}>{n}</span>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
            <ChipStack count={n} stagger={false} />
            <ChipStack count={n} stagger />
          </div>
          <span style={{ fontSize: 10, opacity: 0.7 }}>off / on</span>
        </div>
      ))}
    </div>
  ),
}

export const SizeCompare: Story = {
  render: () => (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 32, color: palette.white }}>
      {[5, 26, 137].map(n => (
        <div key={n} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12 }}>{n}</span>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
            <ChipStack count={n} size={18} />
            <ChipStack count={n} size={36} />
          </div>
        </div>
      ))}
    </div>
  ),
}

export const MiniRow: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, color: palette.white }}>
      {[1, 5, 13, 26, 50, 137, 250].map(n => (
        <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ width: 40, textAlign: 'right' }}>{n}</span>
          <MiniChipRow count={n} />
        </div>
      ))}
    </div>
  ),
}
