import { useEffect } from 'react'
import { Frame } from '@react95/core'
import { Button, TextInput } from 'react95'
import type { ClientGameState } from '@shared/engine/state-machine'
import type { Card } from '@shared/engine/card'
import { evaluateHand, beats, handCategoryName } from '@shared/engine/hand-eval'
import { ChipStack } from '../Chips/ChipStack'
import { palette } from '../../palette'

interface ActionBarProps {
  state: ClientGameState
  myPlayerId: string
  selected: Card[]
  onDiscard: () => void
  onPlay: () => void
  onFold: () => void
  onCheck?: () => void
  onCall?: () => void
  onBet?: (amount: number) => void
  onRaise?: (amount: number) => void
  // Controlled bet/raise target for the betting phase. `null` = not staging.
  bettingTarget?: number | null
  onBettingTargetChange?: (target: number | null) => void
}

export function ActionBar({ state, myPlayerId, selected, onDiscard, onPlay, onFold, onCheck, onCall, onBet, onRaise, bettingTarget, onBettingTargetChange }: ActionBarProps) {
  const isMyTurn = state.currentPlayerId === myPlayerId
  const inDiscard = state.turnPhase === 'discard'
  const inBet = state.turnPhase === 'bet'
  const deckEmpty = state.myDeckSize === 0

  if (inBet) {
    return (
      <BettingActionBar
        state={state}
        myPlayerId={myPlayerId}
        isMyTurn={isMyTurn}
        onCheck={onCheck}
        onCall={onCall}
        onBet={onBet}
        onRaise={onRaise}
        onFold={onFold}
        target={bettingTarget ?? null}
        onTargetChange={onBettingTargetChange ?? (() => { })}
      />
    )
  }

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
    hint = `${handCategoryName(evaluated!.category)} - doesn't beat the current play`
  } else if (state.currentTopPlay === null) {
    hint = `${handCategoryName(evaluated!.category)} - leads the hand`
  } else {
    hint = `${handCategoryName(evaluated!.category)} - beats it`
  }

  return (
    <Frame
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        flexShrink: 0,
        backgroundColor: 'transparent',
        padding: 0,
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
        <Button onClick={onPlay} disabled={!canPlay} style={{ minWidth: 80 }}>
          Play
        </Button>
        <Button onClick={onDiscard} disabled={!canDiscard} style={{ minWidth: 90 }}>
          Discard {selected.length > 0 ? selected.length : ''}
        </Button>
        <Button onClick={onFold} disabled={!canFold} className="r95-red" style={{ minWidth: 80, background: palette.lose, color: palette.white }}>
          Fold
        </Button>
      </div>
    </Frame>
  )
}

interface BettingProps {
  state: ClientGameState
  myPlayerId: string
  isMyTurn: boolean
  onCheck?: () => void
  onCall?: () => void
  onBet?: (amount: number) => void
  onRaise?: (amount: number) => void
  onFold: () => void
  // Controlled chips-this-turn count. null = not staged (parent shows 0 chips
  // moved). Wire format: total committed once submitted = myCommitted + this.
  target: number | null
  onTargetChange: (target: number | null) => void
}

// `target` here is the per-turn increment ("chips I'm putting in this turn"),
// NOT the total committed. Server-side BET/RAISE expect the total, so we add
// myCommitted at submit time.
function BettingActionBar({ state, myPlayerId, isMyTurn, onCheck, onCall, onBet, onRaise, onFold, target, onTargetChange }: BettingProps) {
  const stack = state.scores[myPlayerId] ?? 0
  const myCommitted = state.committed[myPlayerId] ?? 0
  const owe = state.betToMatch - myCommitted
  const canCheck = owe === 0
  const canCall = owe > 0
  const ante = state.options.anteAmount

  // Baseline increment = chips you must put in to stay (call amount or 0 for check).
  const baselineIncrement = canCheck ? 0 : Math.min(owe, stack)
  // Min increment for a bet/raise (above baseline). For a bet, ≥ ante. For a raise,
  // ≥ owe + minRaise (cover the call AND the min-raise step). All capped at all-in.
  const minBetOrRaiseIncrement = canCheck
    ? Math.min(ante, stack)
    : Math.min(owe + state.minRaise, stack)

  // Player can put in extra chips on top of the baseline (open or raise).
  const canOpenOrRaise = canCheck
    ? stack >= ante                 // at least one ante to open
    : stack > owe                   // can call with chips left over to raise

  // Effective increment — null collapses to "doing the minimum" (call) for canCall,
  // or "no chips" for canCheck. Drives the chip-stack preview.
  const baseline = canCheck ? 0 : baselineIncrement
  const effectiveIncrement = target ?? baseline
  const pending = effectiveIncrement
  const totalCommitIfSubmitted = myCommitted + effectiveIncrement
  const isAllIn = effectiveIncrement === stack && stack > 0

  // Reset staged target if the bet line shifts under us (someone else bet/raised).
  useEffect(() => {
    onTargetChange(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.betToMatch])

  function clamp(n: number): number {
    if (!Number.isFinite(n)) return baseline
    return Math.max(baseline, Math.min(stack, Math.round(n)))
  }
  function bump(delta: number) {
    const next = clamp(effectiveIncrement + delta)
    onTargetChange(next === baseline ? null : next)
  }
  function handleInputChange(v: string) {
    if (!/^\d*$/.test(v)) return
    if (v === '') { onTargetChange(null); return }
    onTargetChange(clamp(parseInt(v, 10)))
  }
  function submitBetOrRaise() {
    if (effectiveIncrement < minBetOrRaiseIncrement && !isAllIn) return
    if (canCheck) onBet?.(totalCommitIfSubmitted)
    else onRaise?.(totalCommitIfSubmitted)
  }

  const stepUp = ante > 0 ? ante : Math.max(1, stack - effectiveIncrement)
  const stepDown = ante > 0 ? -ante : -Math.max(1, effectiveIncrement - baseline)

  const hint = !isMyTurn ? 'Waiting for other players...'
    : canCheck && !canOpenOrRaise ? `Pot $${state.pot} - no chips left, check or fold`
      : canCheck ? `Pot $${state.pot} - check, or open the betting`
        : !canOpenOrRaise ? `Pot $${state.pot} - $${owe} to call (no chips to raise)`
          : `Pot $${state.pot} - $${owe} to call`

  const isBetOrRaiseValid = effectiveIncrement >= minBetOrRaiseIncrement || (isAllIn && effectiveIncrement > baseline)
  const betOrRaiseLabel = canCheck
    ? `Bet $${effectiveIncrement}${isAllIn ? ' (all-in)' : ''}`
    : effectiveIncrement <= owe
      ? `Raise +$0`
      : `Raise to $${state.betToMatch + (effectiveIncrement - owe)}${isAllIn ? ' (all-in)' : ''}`

  return (
    <Frame
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        flexShrink: 0,
        backgroundColor: 'transparent',
        padding: 0,
      }}
    >


      {/* "Current bet" preview — chips you're about to commit this turn. */}
      <div
        style={{
          position: 'absolute',
          right: '100%',
          width: 112,
          bottom: -0,
          paddingRight: 12,
          height: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-end',
          opacity: pending > 0 ? 1 : 0,
          transition: 'opacity 120ms',
        }}
      >

        {pending > 0 && (
          <>
            <ChipStack count={pending} />
            <span style={{ fontSize: 11, fontWeight: 700, color: palette.white, textShadow: '1px 1px 0 rgba(0,0,0,0.6)', marginTop: -3 }}>
              ${pending}
            </span>
            <span style={{ fontSize: 12, textAlign: 'center', minHeight: 16, color: palette.ltGray }}>
              {hint}
            </span>
          </>
        )}
      </div>

      {/* Fixed widths everywhere so the row never reflows as values change.
          Sized to the longest possible label (e.g. "Raise to $999 (all-in)"). */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {canCheck ? (
          <Button onClick={onCheck} disabled={!isMyTurn} style={STATIC_PRIMARY}>Check</Button>
        ) : (
          <Button onClick={onCall} disabled={!isMyTurn || !canCall} primary style={STATIC_PRIMARY}>
            <span style={STATIC_LABEL}>
              Call ${Math.min(owe, stack)}{owe > stack ? ' (all-in)' : ''}
            </span>
          </Button>
        )}

        {canOpenOrRaise && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Button
                onClick={() => bump(stepDown)}
                disabled={!isMyTurn || effectiveIncrement <= baseline}
                style={STATIC_STEPPER}
              >−</Button>
              <TextInput
                type="text"
                inputMode="numeric"
                value={String(effectiveIncrement)}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange(e.target.value)}
                onBlur={() => onTargetChange(effectiveIncrement === baseline ? null : effectiveIncrement)}
                style={{ width: 64, textAlign: 'right' }}
                disabled={!isMyTurn}
              />
              <Button
                onClick={() => bump(stepUp)}
                disabled={!isMyTurn || effectiveIncrement >= stack}
                style={STATIC_STEPPER}
              >+</Button>
            </div>

            <Button
              onClick={submitBetOrRaise}
              disabled={!isMyTurn || !isBetOrRaiseValid}
              style={STATIC_BET}
            >
              <span style={STATIC_LABEL}>{betOrRaiseLabel}</span>
            </Button>
          </>
        )}

        <Button onClick={onFold} disabled={!isMyTurn} className="r95-red" style={{ ...STATIC_FOLD, background: palette.lose, color: palette.white }}>Fold</Button>
      </div>
    </Frame>
  )
}

// Fixed widths for the betting row so labels never reflow as values change.
// Sized to fit the longest label each control will display (e.g. "Call $999 (all-in)",
// "Raise to $999 (all-in)").
const STATIC_PRIMARY: React.CSSProperties = { width: 130, padding: 0, overflow: 'hidden', whiteSpace: 'nowrap' }
const STATIC_BET:     React.CSSProperties = { width: 160, padding: 0, overflow: 'hidden', whiteSpace: 'nowrap' }
const STATIC_FOLD:    React.CSSProperties = { width: 70 }
const STATIC_STEPPER: React.CSSProperties = { width: 28, padding: '0 4px' }
const STATIC_LABEL:   React.CSSProperties = {
  display: 'inline-block',
  width: '100%',
  textAlign: 'center',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}
