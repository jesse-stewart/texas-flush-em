import type { Meta, StoryObj } from '@storybook/react'
import { Icon, ICON_NAMES } from './Icon'
import { palette } from '../../palette'

const meta: Meta<typeof Icon> = {
  title: 'Components/Icon',
  component: Icon,
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'felt', values: [{ name: 'felt', value: palette.felt }] },
  },
  argTypes: {
    name: { control: { type: 'select' }, options: ICON_NAMES },
    size: { control: { type: 'number', min: 8, max: 128, step: 4 } },
    label: { control: 'text' },
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof meta>

export const Printer: Story = {
  args: { name: 'printer' },
}

// Native 32×32 size (no scaling).
export const PrinterNative: Story = {
  args: { name: 'printer', size: 32 },
}

// Common in-button size — what the rules modal uses.
export const PrinterSmall: Story = {
  args: { name: 'printer', size: 16 },
}

// Scaled up to make pixel-art rendering visible.
export const PrinterLarge: Story = {
  args: { name: 'printer', size: 96 },
}

// Catalog of every registered icon — handy for visually verifying coordinates
// when adding new entries to ICON_COORDS.
export const Catalog: Story = {
  render: () => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
      {ICON_NAMES.map(name => (
        <div key={name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <Icon name={name} size={48} />
          <span style={{ fontSize: 11, color: palette.white, fontFamily: 'monospace' }}>{name}</span>
        </div>
      ))}
    </div>
  ),
}
