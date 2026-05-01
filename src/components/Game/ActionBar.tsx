import type { ClientGameState } from '@shared/engine/state-machine'
import type { Card } from '@shared/engine/card'
import { evaluateHand, beats, HandCategory } from '@shared/engine/hand-eval'

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
  onDiscard: () => void   // sends DISCARD with selected cards (discard phase only)
  onPlay: () => void      // sends PLAY (auto-skips discard if needed)
  onFold: () => void
}

export function ActionBar({ state, myPlayerId, selected, onDiscard, onPlay, onFold }: ActionBarProps) {
  const isMyTurn = state.currentPlayerId === myPlayerId
  const inDiscard = state.turnPhase === 'discard'

  const evaluated = selected.length > 0 ? evaluateHand(selected) : null
  const isValidHand = evaluated !== null
  const doesBeat = isValidHand && (state.currentTopPlay === null || beats(evaluated, state.currentTopPlay))

  // Discard: only in discard phase, only when cards are selected
  const canDiscard = isMyTurn && inDiscard && selected.length > 0

  // Play: valid hand that beats top. Works in either phase (auto-skips discard if needed).
  const canPlay = isMyTurn && isValidHand && doesBeat

  // Fold: any time it's your turn (auto-skips discard phase if needed)
  const canFold = isMyTurn

  // Hint
  let hint = ''
  if (!isMyTurn) {
    hint = 'Waiting for other players…'
  } else if (selected.length === 0) {
    hint = inDiscard
      ? 'Select cards to discard, or select cards to play directly'
      : 'Select cards to play, or fold'
  } else if (!isValidHand) {
    hint = 'Not a valid hand — keep selecting or discard instead'
  } else if (!doesBeat) {
    hint = `${CATEGORY_LABEL[evaluated!.category]} — doesn't beat the current play`
  } else if (state.currentTopPlay === null) {
    hint = `${CATEGORY_LABEL[evaluated!.category]} — leads the hand`
  } else {
    hint = `${CATEGORY_LABEL[evaluated!.category]} — beats it`
  }

  const hintColor = !isMyTurn
    ? '#6b7280'
    : canPlay
      ? '#86efac'
      : isValidHand && !doesBeat
        ? '#fca5a5'
        : '#9ca3af'

  return (
    <div style={styles.bar}>
      <span style={{ ...styles.hint, color: hintColor }}>{hint}</span>
      <div style={styles.btnRow}>
        <Btn
          label="Play"
          enabled={canPlay}
          variant="primary"
          onClick={onPlay}
        />
        <Btn
          label={`Discard ${selected.length}`}
          enabled={canDiscard}
          variant="secondary"
          onClick={onDiscard}
        />
        <Btn
          label="Fold"
          enabled={canFold}
          variant="danger"
          onClick={onFold}
        />
      </div>
    </div>
  )
}

function Btn({ label, enabled, variant, onClick }: {
  label: string
  enabled: boolean
  variant: 'primary' | 'secondary' | 'danger'
  onClick: () => void
}) {
  const bg =    { primary: '#16a34a', secondary: 'rgba(255,255,255,0.12)', danger: 'rgba(255,255,255,0.08)' }[variant]
  const color = { primary: '#fff',    secondary: '#e5e7eb',                danger: '#fca5a5'                }[variant]

  return (
    <button
      onClick={onClick}
      disabled={!enabled}
      style={{
        padding: '10px 22px',
        fontSize: 15,
        fontWeight: 700,
        borderRadius: 8,
        border: 'none',
        cursor: enabled ? 'pointer' : 'default',
        backgroundColor: bg,
        color,
        opacity: enabled ? 1 : 0.3,
        transition: 'opacity 0.1s',
      }}
    >
      {label}
    </button>
  )
}

const styles: Record<string, React.CSSProperties> = {
  bar: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10,
    padding: '12px 24px',
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderTop: '1px solid rgba(255,255,255,0.08)',
    flexShrink: 0,
  },
  hint: {
    fontSize: 13,
    textAlign: 'center',
    minHeight: 18,
  },
  btnRow: {
    display: 'flex',
    gap: 10,
  },
}
