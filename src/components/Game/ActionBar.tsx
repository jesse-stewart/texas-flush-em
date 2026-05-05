import { Frame } from '@react95/core'
import { Button } from 'react95'
import type { ClientGameState } from '@shared/engine/state-machine'
import type { Card } from '@shared/engine/card'
import { evaluateHand, beats, HandCategory } from '@shared/engine/hand-eval'
import { palette } from '../../palette'

const CATEGORY_LABEL: Record<number, string> = {
  [HandCategory.HIGH_CARD]: 'High Card',
  [HandCategory.PAIR]: 'Pair',
  [HandCategory.FLUSH_PAIR]: 'Flush Pair',
  [HandCategory.TWO_PAIR]: 'Two Pair',
  [HandCategory.FLUSH_TWO_PAIR]: 'Flush Two Pair',
  [HandCategory.THREE_OF_A_KIND]: 'Three of a Kind',
  [HandCategory.FLUSH_THREE_OF_A_KIND]: 'Flush Three of a Kind',
  [HandCategory.STRAIGHT]: 'Straight',
  [HandCategory.FLUSH]: 'Flush',
  [HandCategory.FULL_HOUSE]: 'Full House',
  [HandCategory.FLUSH_FULL_HOUSE]: 'Flush Full House',
  [HandCategory.FOUR_OF_A_KIND]: 'Four of a Kind',
  [HandCategory.FLUSH_FOUR_OF_A_KIND]: 'Flush Four of a Kind',
  [HandCategory.STRAIGHT_FLUSH]: 'Straight Flush',
  [HandCategory.FIVE_OF_A_KIND]: 'Five of a Kind',
  [HandCategory.ROYAL_FLUSH]: 'Royal Flush',
}

interface ActionBarProps {
  state: ClientGameState
  myPlayerId: string
  selected: Card[]
  onDiscard: () => void
  onPlay: () => void
  onFold: () => void
}

export function ActionBar({ state, myPlayerId, selected, onDiscard, onPlay, onFold }: ActionBarProps) {
  const isMyTurn = state.currentPlayerId === myPlayerId
  const inDiscard = state.turnPhase === 'discard'
  const deckEmpty = state.myDeckSize === 0

  const evaluated = selected.length > 0 ? evaluateHand(selected) : null
  const isValidHand = evaluated !== null
  const doesBeat = isValidHand && (state.currentTopPlay === null || beats(evaluated, state.currentTopPlay))

  const canDiscard = isMyTurn && inDiscard && selected.length > 0 && !deckEmpty
  const canPlay = isMyTurn && isValidHand && doesBeat
  const canFold = isMyTurn

  let hint = ''
  if (!isMyTurn) {
    hint = 'Waiting for other players...'
  } else if (selected.length === 0) {
    hint = inDiscard && !deckEmpty
      ? 'Select cards to discard, or select cards to play directly'
      : 'Select cards to play, or fold'
  } else if (!isValidHand) {
    hint = deckEmpty
      ? 'Not a valid hand - your deck is empty, keep selecting or fold'
      : 'Not a valid hand - keep selecting or discard instead'
  } else if (!doesBeat) {
    hint = `${CATEGORY_LABEL[evaluated!.category]} - doesn't beat the current play`
  } else if (state.currentTopPlay === null) {
    hint = `${CATEGORY_LABEL[evaluated!.category]} - leads the hand`
  } else {
    hint = `${CATEGORY_LABEL[evaluated!.category]} - beats it`
  }

  return (
    <Frame
      px="$6"
      py="$4"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        flexShrink: 0,
        backgroundColor: 'transparent',
      }}
    >
      <span style={{
        fontSize: 12,
        textAlign: 'center',
        minHeight: 16,
        color: !isMyTurn ? palette.ltGray
          : canPlay ? palette.hintGood
          : isValidHand && !doesBeat ? palette.hintBad
          : palette.ltGray,
      }}>
        {hint}
      </span>
      <div style={{ display: 'flex', gap: 6 }}>
        <Button onClick={onPlay} disabled={!canPlay} style={{ minWidth: 80, fontWeight: 700 }}>
          Play
        </Button>
        <Button onClick={onDiscard} disabled={!canDiscard} style={{ minWidth: 90 }}>
          Discard {selected.length > 0 ? selected.length : ''}
        </Button>
        <Button onClick={onFold} disabled={!canFold} style={{ minWidth: 80 }}>
          Fold
        </Button>
      </div>
    </Frame>
  )
}
