import type { Preview } from '@storybook/react'
import '@react95/core/GlobalStyle'
import '@react95/core/themes/win95.css'
import '../src/win95-overrides.css'

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: 'win95-desktop',
      values: [
        { name: 'win95-desktop', value: '#008080' },
        { name: 'felt', value: '#006600' },
      ],
    },
    options: {
      storySort: {
        order: [
          'Components',
          ['Card', 'CardStack', 'Chip', 'ChipStack', 'Icon'],
          'Game',
          'Lobby',
        ],
      },
    },
  },
}

export default preview
