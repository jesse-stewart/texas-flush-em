// ============================================================
// Claude tool schemas for the three actions the bot can take.
// Tool input cards are declared as a permissive shape; we validate
// against our actual hand server-side after Claude returns.
// ============================================================

import type Anthropic from '@anthropic-ai/sdk'

const cardSchema = {
  type: 'object',
  properties: {
    rank: {
      // The engine's Card.rank is `2..10 | 'J' | 'Q' | 'K' | 'A'` — numeric ranks are real numbers, not strings.
      // JSON Schema enums allow mixed types, so we list both forms.
      enum: [2, 3, 4, 5, 6, 7, 8, 9, 10, 'J', 'Q', 'K', 'A'],
      description: 'Numeric ranks 2-10 are JSON numbers; face cards are strings ("J", "Q", "K", "A").',
    },
    suit: { enum: ['clubs', 'diamonds', 'hearts', 'spades'] },
  },
  required: ['rank', 'suit'],
  additionalProperties: false,
} as const

export const discardTool: Anthropic.Tool = {
  name: 'discard',
  description:
    'Discard 0-5 cards from your hand to the bottom of your deck. They are replaced by drawing from the top of your deck. ' +
    'Pass an empty array to skip discarding (you may also skip when your deck is empty). ' +
    'Use this to cycle weak cards out of your hand and bring fresh ones in. ' +
    'Discarding is OPTIONAL — only discard cards that do not contribute to a strong hand.',
  input_schema: {
    type: 'object',
    properties: {
      cards: {
        type: 'array',
        items: cardSchema,
        maxItems: 5,
        description: 'The cards from your hand to send to the bottom of your deck.',
      },
      reasoning: {
        type: 'string',
        description: 'A short note explaining the choice — surfaces in the bot console for debugging.',
      },
    },
    required: ['cards', 'reasoning'],
  },
}

export const playTool: Anthropic.Tool = {
  name: 'play',
  description:
    'Play a legal poker hand from your current hand. The hand must STRICTLY beat the current top play if there is one. ' +
    'Categories from low to high: HIGH_CARD (1 card), PAIR (2), TWO_PAIR (4), THREE_OF_A_KIND (3), STRAIGHT (5 sequential), ' +
    'FLUSH (5 same suit), FULL_HOUSE (3+2), FOUR_OF_A_KIND (4), STRAIGHT_FLUSH (5 sequential same suit), ROYAL_FLUSH (10-J-Q-K-A same suit). ' +
    'Multi-deck variants add: FLUSH_PAIR (2 identical cards), FLUSH_TWO_PAIR, FLUSH_THREE_OF_A_KIND, FLUSH_FULL_HOUSE, FLUSH_FOUR_OF_A_KIND, FIVE_OF_A_KIND. ' +
    'Tiebreaking: category first, then ranks, then suits (clubs<diamonds<hearts<spades). Straights do NOT wrap around Ace.',
  input_schema: {
    type: 'object',
    properties: {
      cards: {
        type: 'array',
        items: cardSchema,
        minItems: 1,
        maxItems: 5,
        description: 'The cards forming your poker hand.',
      },
      category: {
        type: 'string',
        description: 'The hand category you intend (e.g. "PAIR", "FLUSH"). Used only for logging.',
      },
      reasoning: {
        type: 'string',
        description: 'A short note explaining the choice — surfaces in the bot console for debugging.',
      },
    },
    required: ['cards', 'category', 'reasoning'],
  },
}

export const foldTool: Anthropic.Tool = {
  name: 'fold',
  description:
    'Fold this hand — you give up trying to play and will not lay any more cards in this hand. ' +
    'Cards stay with you. Use when you cannot or do not want to beat the current top play.',
  input_schema: {
    type: 'object',
    properties: {
      reasoning: {
        type: 'string',
        description: 'A short note explaining the choice — surfaces in the bot console for debugging.',
      },
    },
    required: ['reasoning'],
  },
}
