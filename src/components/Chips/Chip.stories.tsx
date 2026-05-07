import type { Meta, StoryObj } from '@storybook/react'
import { Chip, type ChipDenom } from './Chip'
import { palette } from '../../palette'

const meta: Meta<typeof Chip> = {
  title: 'Components/Chip',
  component: Chip,
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'felt', values: [{ name: 'felt', value: palette.felt }] },
  },
  tags: ['autodocs'],
  argTypes: {
    denom: { control: { type: 'select' }, options: [1, 5, 10, 25, 100] },
    size: { control: { type: 'inline-radio' }, options: [18, 36] },
    variant: { control: { type: 'select' }, options: [0, 1] },
  },
}

export default meta
type Story = StoryObj<typeof meta>

const DENOMS: ChipDenom[] = [1, 5, 10, 25, 100]

export const Default: Story = {
  args: { denom: 25, size: 36, variant: 0 },
}

export const Mini: Story = {
  args: { denom: 25, size: 18, variant: 0 },
}

export const AllDenoms: Story = {
  render: () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {DENOMS.map(d => <Chip key={d} denom={d} size={36} />)}
    </div>
  ),
}

export const AllDenomsMini: Story = {
  render: () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      {DENOMS.map(d => <Chip key={d} denom={d} size={18} />)}
    </div>
  ),
}

export const Variants: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {[0, 1].map(v => (
        <div key={v} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 60, color: palette.white, fontSize: 12 }}>variant {v}</span>
          {DENOMS.map(d => <Chip key={d} denom={d} size={36} variant={v as 0 | 1} />)}
        </div>
      ))}
    </div>
  ),
}

export const BothSizes: Story = {
  render: () => (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 24 }}>
      {([18, 36] as const).map(s => (
        <div key={s} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <Chip denom={100} size={s} />
          <span style={{ color: palette.white, fontSize: 11 }}>{s}px</span>
        </div>
      ))}
    </div>
  ),
}
