import { useState, useEffect } from 'react'
import type { ClientGameState } from '@shared/engine/state-machine'
import type { GameOptions, DealMode } from '@shared/engine/game-state'
import { DEFAULT_OPTIONS, MIN_CARDS_PER_PLAYER, PERSONAL_MAX_CARDS, MIXED_DEFAULT_CARDS } from '@shared/engine/game-state'

// Numeric input with +/- buttons. Typed input is held as a draft string and only
// clamped/committed on blur or Enter, so editing "52" → "26" doesn't re-clamp on each keystroke.
function NumberStepper({
  value, min, max, onChange,
}: {
  value: number
  min: number
  max?: number
  onChange: (v: number) => void
}) {
  const [draft, setDraft] = useState(String(value))
  // Sync draft when value changes externally (+/-, prop change, parent clamp)
  useEffect(() => { setDraft(String(value)) }, [value])

  const clamp = (v: number) => {
    if (max !== undefined) v = Math.min(max, v)
    return Math.max(min, v)
  }

  function commit() {
    const v = parseInt(draft, 10)
    if (isNaN(v)) setDraft(String(value))   // revert empty / non-numeric
    else onChange(clamp(v))
  }

  return (
    <div style={styles.stepper}>
      <button type="button" style={styles.stepBtn} onClick={() => onChange(clamp(value - 1))} aria-label="decrease">−</button>
      <input
        style={styles.stepperValue}
        type="number"
        min={min}
        max={max}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
      />
      <button type="button" style={styles.stepBtn} onClick={() => onChange(clamp(value + 1))} aria-label="increase">+</button>
    </div>
  )
}

interface WaitingRoomProps {
  state: ClientGameState
  roomId: string
  myPlayerId: string
  onStart: (options: GameOptions) => void
  onLeave: () => void
  onAddBot: () => void
  onRemoveBot: (playerId: string) => void
}

// Per-mode threshold defaults so toggling modes doesn't lose the user's chosen number.
const DEFAULT_POINTS_TARGET = 26
const DEFAULT_CHIPS_STARTING = 13

// Estimator constants — per-player time per round, calibrated from real play.
// Humans deliberate; bots return decisions in roughly a couple of seconds.
const HUMAN_MIN_PER_ROUND = 2.5
const BOT_MIN_PER_ROUND = 0.05
const AVG_CARDS_PER_LOSS = 3   // typical hand size of a losing player at round end

function estimateMinutes(opts: GameOptions, humansCount: number, botsCount: number): number | null {
  const playerCount = humansCount + botsCount
  if (playerCount < 2) return null
  const minPerRound = humansCount * HUMAN_MIN_PER_ROUND + botsCount * BOT_MIN_PER_ROUND
  // Avg points/chips a player gains-or-loses per round (probability of losing × cards lost).
  const lossPerRound = AVG_CARDS_PER_LOSS * (playerCount - 1) / playerCount
  // Rounds for one player to hit threshold (points) or hit zero from threshold chips.
  const roundsToFirstHit = opts.threshold / lossPerRound
  // Tail factor — "play continues until 1 remains" modes need to elim (n-1) players,
  // but later eliminations happen faster as the field shrinks. Sub-linear in playerCount.
  const isFirstHitOnly =
    opts.scoringMode === 'points' && opts.pointsThresholdAction === 'end_game'
  const tail = isFirstHitOnly ? 1 : 1 + 0.5 * (playerCount - 2)
  return Math.round(roundsToFirstHit * minPerRound * tail)
}

function formatDuration(min: number): string {
  if (min < 60) return `~${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m === 0 ? `~${h} hr` : `~${h} hr ${m} min`
}

export function WaitingRoom({ state, roomId, myPlayerId, onStart, onLeave, onAddBot, onRemoveBot }: WaitingRoomProps) {
  const canStart = state.players.length >= 2
  const canAddBot = state.players.length < 4
  const [copied, setCopied] = useState(false)

  // Local options state — whoever clicks Start sends their chosen settings to the server.
  const [scoringMode, setScoringMode] = useState<GameOptions['scoringMode']>(DEFAULT_OPTIONS.scoringMode)
  const [pointsTarget, setPointsTarget] = useState(DEFAULT_POINTS_TARGET)
  const [chipsStarting, setChipsStarting] = useState(DEFAULT_CHIPS_STARTING)
  const [pointsThresholdAction, setPointsThresholdAction] = useState<GameOptions['pointsThresholdAction']>(DEFAULT_OPTIONS.pointsThresholdAction)
  const [dealMode, setDealMode] = useState<DealMode>(DEFAULT_OPTIONS.dealMode)
  const [personalCards, setPersonalCards] = useState(PERSONAL_MAX_CARDS)
  const [mixedDeckCount, setMixedDeckCount] = useState(DEFAULT_OPTIONS.mixedDeckCount)
  const [mixedCards, setMixedCards] = useState(MIXED_DEFAULT_CARDS)

  const playerCount = Math.max(state.players.length, 1)

  // Mixed mode: clamp cards-per-player so the deal always succeeds.
  const mixedMaxCards = Math.floor((mixedDeckCount * 52) / playerCount)
  const effectiveMixedCards = Math.min(mixedCards, mixedMaxCards)
  const cardsPerPlayer =
    dealMode === 'personal' ? personalCards :
    dealMode === 'mixed' ? effectiveMixedCards :
    Math.ceil(52 / playerCount)  // classic — readonly display

  const threshold = scoringMode === 'points' ? pointsTarget : chipsStarting
  const options: GameOptions = {
    scoringMode,
    threshold,
    pointsThresholdAction,
    dealMode,
    cardsPerPlayer: dealMode === 'personal' ? personalCards : effectiveMixedCards,
    mixedDeckCount,
  }
  const botsCount = state.players.filter(p => p.isBot).length
  const humansCount = state.players.length - botsCount
  const estMin = estimateMinutes(options, humansCount, botsCount)

  function copyCode() {
    navigator.clipboard.writeText(roomId)
  }

  function copyLink() {
    const url = `${window.location.origin}${window.location.pathname}?room=${roomId}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={styles.page}>
      <div style={styles.panel}>
        <h1 style={styles.title}>Texas Flush'em</h1>

        <div style={styles.roomRow}>
          <span style={styles.roomLabel}>Room code</span>
          <span style={styles.roomCode}>{roomId}</span>
          <button style={styles.copyBtn} onClick={copyCode}>
            Copy
          </button>
        </div>

        <button style={styles.shareLinkBtn} onClick={copyLink}>
          {copied ? '✓ Link copied!' : 'Copy invite link'}
        </button>

        <h2 style={styles.sectionTitle}>
          Players ({state.players.length}/4)
        </h2>

        <ul style={styles.playerList}>
          {state.players.map(p => (
            <li key={p.id} style={styles.playerRow}>
              <span style={styles.dot(p.isConnected)} />
              <span style={styles.playerName}>
                {p.name}
                {p.id === myPlayerId && <span style={styles.youTag}> (you)</span>}
                {p.isBot && <span style={styles.botTag}>CPU</span>}
              </span>
              {p.isBot && (
                <button
                  style={styles.kickBtn}
                  onClick={() => onRemoveBot(p.id)}
                  aria-label={`Remove ${p.name}`}
                >
                  ×
                </button>
              )}
            </li>
          ))}
          {Array.from({ length: 4 - state.players.length }).map((_, i) => (
            <li key={`empty-${i}`} style={styles.playerRow}>
              {i === 0 && canAddBot ? (
                <button style={styles.addBotBtn} onClick={onAddBot}>
                  + Add CPU player
                </button>
              ) : (
                <>
                  <span style={{ ...styles.dot(false), opacity: 0.35 }} />
                  <span style={{ ...styles.playerName, opacity: 0.35 }}>Waiting for player…</span>
                </>
              )}
            </li>
          ))}
        </ul>

        <h2 style={styles.sectionTitle}>Game settings</h2>

        <div style={styles.settingsBlock}>
          <div style={styles.settingRow}>
            <span style={styles.settingLabel}>Scoring</span>
            <div style={styles.segmented}>
              <button
                type="button"
                style={styles.segmentBtn(scoringMode === 'points')}
                onClick={() => setScoringMode('points')}
              >
                Points
              </button>
              <button
                type="button"
                style={styles.segmentBtn(scoringMode === 'chips')}
                onClick={() => setScoringMode('chips')}
              >
                Chips
              </button>
            </div>
          </div>

          <div style={styles.settingRow}>
            <span style={styles.settingLabel}>
              {scoringMode === 'points' ? 'Target points' : 'Starting chips'}
            </span>
            <NumberStepper
              value={threshold}
              min={1}
              onChange={v => {
                if (scoringMode === 'points') setPointsTarget(v)
                else setChipsStarting(v)
              }}
            />
          </div>

          {scoringMode === 'points' && (
            <div style={styles.settingRow}>
              <span style={styles.settingLabel}>On reach</span>
              <div style={styles.segmented}>
                <button
                  type="button"
                  style={styles.segmentBtn(pointsThresholdAction === 'eliminate')}
                  onClick={() => setPointsThresholdAction('eliminate')}
                >
                  Eliminate
                </button>
                <button
                  type="button"
                  style={styles.segmentBtn(pointsThresholdAction === 'end_game')}
                  onClick={() => setPointsThresholdAction('end_game')}
                >
                  End game
                </button>
              </div>
            </div>
          )}

          <div style={styles.settingRow}>
            <span style={styles.settingLabel}>Deal mode</span>
            <div style={styles.segmented}>
              <button type="button" style={styles.segmentBtn(dealMode === 'classic')} onClick={() => setDealMode('classic')}>Classic</button>
              <button type="button" style={styles.segmentBtn(dealMode === 'personal')} onClick={() => setDealMode('personal')}>Personal</button>
              <button type="button" style={styles.segmentBtn(dealMode === 'mixed')} onClick={() => setDealMode('mixed')}>Mixed</button>
            </div>
          </div>

          {dealMode === 'classic' && (
            <div style={styles.settingRow}>
              <span style={styles.settingLabel}>Cards each</span>
              <span style={styles.readOnlyValue}>{cardsPerPlayer} (auto)</span>
            </div>
          )}

          {dealMode === 'personal' && (
            <div style={styles.settingRow}>
              <span style={styles.settingLabel}>Cards per player</span>
              <NumberStepper
                value={personalCards}
                min={MIN_CARDS_PER_PLAYER}
                max={PERSONAL_MAX_CARDS}
                onChange={setPersonalCards}
              />
            </div>
          )}

          {dealMode === 'mixed' && (
            <>
              <div style={styles.settingRow}>
                <span style={styles.settingLabel}>Decks</span>
                <div style={styles.segmented}>
                  {[1, 2, 3, 4].map(n => (
                    <button
                      key={n}
                      type="button"
                      style={styles.segmentBtn(mixedDeckCount === n)}
                      onClick={() => setMixedDeckCount(n)}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div style={styles.settingRow}>
                <span style={styles.settingLabel}>Cards per player</span>
                <NumberStepper
                  value={effectiveMixedCards}
                  min={MIN_CARDS_PER_PLAYER}
                  max={mixedMaxCards}
                  onChange={setMixedCards}
                />
              </div>
              {effectiveMixedCards < mixedCards && (
                <p style={styles.estimate}>Capped at {mixedMaxCards} (pool size ÷ players).</p>
              )}
            </>
          )}

          {estMin !== null && (
            <p style={styles.estimate}>
              Estimated game length: <b>{formatDuration(estMin)}</b>
            </p>
          )}
        </div>

        {!canStart && (
          <p style={styles.hint}>Need at least 2 players to start.</p>
        )}

        <button
          style={{ ...styles.startBtn, opacity: canStart ? 1 : 0.4 }}
          onClick={() => onStart(options)}
          disabled={!canStart}
        >
          Start game
        </button>
        <button style={styles.leaveBtn} onClick={onLeave}>
          Leave room
        </button>
      </div>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f4c2a',
    fontFamily: 'system-ui, sans-serif',
    padding: '20px 0',
  } as React.CSSProperties,
  panel: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: '40px 48px',
    width: 360,
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  } as React.CSSProperties,
  title: {
    margin: '0 0 20px',
    fontSize: 28,
    fontWeight: 800,
    color: '#1a1a1a',
    letterSpacing: '-1px',
  } as React.CSSProperties,
  roomRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 28,
    padding: '10px 14px',
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    border: '1px solid #e5e7eb',
  } as React.CSSProperties,
  roomLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    flex: 1,
  } as React.CSSProperties,
  roomCode: {
    fontSize: 18,
    fontWeight: 800,
    letterSpacing: '0.15em',
    color: '#111827',
    fontFamily: 'monospace',
  } as React.CSSProperties,
  copyBtn: {
    fontSize: 12,
    padding: '3px 8px',
    borderRadius: 4,
    border: '1px solid #d1d5db',
    backgroundColor: '#fff',
    cursor: 'pointer',
    color: '#374151',
  } as React.CSSProperties,
  shareLinkBtn: {
    width: '100%',
    padding: '8px',
    fontSize: 13,
    fontWeight: 600,
    borderRadius: 8,
    border: '1px solid #d1d5db',
    backgroundColor: '#f9fafb',
    color: '#374151',
    cursor: 'pointer',
    marginBottom: 20,
  } as React.CSSProperties,
  sectionTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: '#6b7280',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    margin: '0 0 12px',
  } as React.CSSProperties,
  playerList: {
    listStyle: 'none',
    margin: '0 0 24px',
    padding: 0,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 10,
  } as React.CSSProperties,
  playerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  } as React.CSSProperties,
  dot: (connected: boolean): React.CSSProperties => ({
    width: 9,
    height: 9,
    borderRadius: '50%',
    backgroundColor: connected ? '#16a34a' : '#9ca3af',
    flexShrink: 0,
  }),
  playerName: {
    fontSize: 15,
    color: '#111827',
  } as React.CSSProperties,
  youTag: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: 400,
  } as React.CSSProperties,
  botTag: {
    marginLeft: 8,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.05em',
    backgroundColor: '#ede9fe',
    color: '#6d28d9',
    padding: '2px 6px',
    borderRadius: 4,
  } as React.CSSProperties,
  kickBtn: {
    marginLeft: 'auto',
    width: 22,
    height: 22,
    fontSize: 16,
    lineHeight: 1,
    border: 'none',
    backgroundColor: 'transparent',
    color: '#9ca3af',
    cursor: 'pointer',
    borderRadius: 4,
    padding: 0,
  } as React.CSSProperties,
  addBotBtn: {
    flex: 1,
    padding: '6px 10px',
    fontSize: 13,
    fontWeight: 600,
    color: '#6d28d9',
    backgroundColor: 'transparent',
    border: '1px dashed #c4b5fd',
    borderRadius: 6,
    cursor: 'pointer',
    textAlign: 'left' as const,
  } as React.CSSProperties,
  settingsBlock: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 10,
    marginBottom: 20,
  } as React.CSSProperties,
  settingRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  } as React.CSSProperties,
  settingLabel: {
    fontSize: 13,
    color: '#374151',
    fontWeight: 500,
  } as React.CSSProperties,
  segmented: {
    display: 'flex',
    border: '1px solid #d1d5db',
    borderRadius: 6,
    overflow: 'hidden',
  } as React.CSSProperties,
  segmentBtn: (active: boolean): React.CSSProperties => ({
    padding: '5px 10px',
    fontSize: 12,
    fontWeight: 600,
    border: 'none',
    backgroundColor: active ? '#111827' : '#fff',
    color: active ? '#fff' : '#374151',
    cursor: 'pointer',
    borderLeft: '1px solid #d1d5db',
  }),
  stepper: {
    display: 'flex',
    alignItems: 'center',
    border: '1px solid #d1d5db',
    borderRadius: 6,
    overflow: 'hidden',
  } as React.CSSProperties,
  stepBtn: {
    padding: '4px 10px',
    fontSize: 14,
    fontWeight: 700,
    border: 'none',
    backgroundColor: '#f9fafb',
    color: '#374151',
    cursor: 'pointer',
  } as React.CSSProperties,
  stepperValue: {
    width: 48,
    textAlign: 'center' as const,
    border: 'none',
    borderLeft: '1px solid #d1d5db',
    borderRight: '1px solid #d1d5db',
    fontSize: 13,
    fontWeight: 700,
    padding: '4px 0',
    outline: 'none',
    color: '#111827',
    backgroundColor: '#fff',
    fontFamily: 'inherit',
  } as React.CSSProperties,
  estimate: {
    margin: '4px 0 0',
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'right' as const,
  } as React.CSSProperties,
  readOnlyValue: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: 600,
  } as React.CSSProperties,
  hint: {
    fontSize: 13,
    color: '#6b7280',
    margin: '0 0 12px',
    textAlign: 'center' as const,
  } as React.CSSProperties,
  startBtn: {
    width: '100%',
    padding: '12px',
    fontSize: 16,
    fontWeight: 700,
    borderRadius: 8,
    border: 'none',
    backgroundColor: '#16a34a',
    color: '#fff',
    cursor: 'pointer',
  } as React.CSSProperties,
  leaveBtn: {
    width: '100%',
    padding: '8px',
    fontSize: 13,
    fontWeight: 600,
    borderRadius: 8,
    border: 'none',
    backgroundColor: 'transparent',
    color: '#9ca3af',
    cursor: 'pointer',
    marginTop: 4,
  } as React.CSSProperties,
}
