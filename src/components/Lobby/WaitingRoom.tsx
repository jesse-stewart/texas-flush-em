import { useState, useEffect, useMemo } from 'react'
import { Frame, TitleBar, Button, Input, Fieldset } from '@react95/core'
import type { ClientGameState } from '@shared/engine/state-machine'
import type { GameOptions, DealMode, BotDifficulty } from '@shared/engine/game-state'
import { DEFAULT_OPTIONS, MIN_CARDS_PER_PLAYER, PERSONAL_MAX_CARDS, MIXED_DEFAULT_CARDS, DEFAULT_BOT_DIFFICULTY } from '@shared/engine/game-state'
import { CardBackPicker } from '../CardBackPicker/CardBackPicker'
import { CardBackVisual } from '../Card/Card'
import { useCardBackId } from '../../contexts/CardBackContext'
import { getCardBack } from '../../cardBacks'

const SETTINGS_KEY = 'flushem_settings'

interface PersistedSettings {
  scoringMode: GameOptions['scoringMode']
  pointsTarget: number
  chipsStarting: number
  pointsThresholdAction: GameOptions['pointsThresholdAction']
  dealMode: DealMode
  personalCards: number
  mixedDeckCount: number
  mixedCards: number
}

function NumberStepper({
  value, min, max, onChange,
}: {
  value: number
  min: number
  max?: number
  onChange: (v: number) => void
}) {
  const [draft, setDraft] = useState(String(value))
  useEffect(() => { setDraft(String(value)) }, [value])

  const clamp = (v: number) => {
    if (max !== undefined) v = Math.min(max, v)
    return Math.max(min, v)
  }

  function commit() {
    const v = parseInt(draft, 10)
    if (isNaN(v)) setDraft(String(value))
    else onChange(clamp(v))
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      <Button onClick={() => onChange(clamp(value - 1))} aria-label="decrease" style={{ minWidth: 24, padding: '0 6px' }}>−</Button>
      <Input
        type="number"
        min={min}
        max={max}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
        style={{ width: 56, textAlign: 'center' }}
      />
      <Button onClick={() => onChange(clamp(value + 1))} aria-label="increase" style={{ minWidth: 24, padding: '0 6px' }}>+</Button>
    </div>
  )
}

function Segmented<T extends string | number>({
  options, value, onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {options.map(opt => {
        const active = opt.value === value
        return (
          <Button
            key={String(opt.value)}
            onClick={() => onChange(opt.value)}
            className={active ? 'r95-pressed' : undefined}
            style={{ minWidth: 56 }}
          >
            {opt.label}
          </Button>
        )
      })}
    </div>
  )
}

interface WaitingRoomProps {
  state: ClientGameState
  roomId: string
  password?: string
  myPlayerId: string
  onStart: (options: GameOptions) => void
  onLeave: () => void
  onAddBot: (difficulty: BotDifficulty) => void
  onRemoveBot: (playerId: string) => void
  onSetBotDifficulty: (playerId: string, difficulty: BotDifficulty) => void
}

const BOT_DIFFICULTY_LABELS: Record<BotDifficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
}

const DEFAULT_POINTS_TARGET = 26
const DEFAULT_CHIPS_STARTING = 13

const DEFAULT_SETTINGS: PersistedSettings = {
  scoringMode: DEFAULT_OPTIONS.scoringMode,
  pointsTarget: DEFAULT_POINTS_TARGET,
  chipsStarting: DEFAULT_CHIPS_STARTING,
  pointsThresholdAction: DEFAULT_OPTIONS.pointsThresholdAction,
  dealMode: DEFAULT_OPTIONS.dealMode,
  personalCards: PERSONAL_MAX_CARDS,
  mixedDeckCount: DEFAULT_OPTIONS.mixedDeckCount,
  mixedCards: MIXED_DEFAULT_CARDS,
}

function loadSettings(): PersistedSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return DEFAULT_SETTINGS
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) as Partial<PersistedSettings> }
  } catch {
    return DEFAULT_SETTINGS
  }
}

function saveSettings(s: PersistedSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
  } catch { /* quota / private mode */ }
}

const HUMAN_MIN_PER_ROUND = 2.5
const BOT_MIN_PER_ROUND = 0.05
const AVG_CARDS_PER_LOSS = 3

function estimateMinutes(opts: GameOptions, humansCount: number, botsCount: number): number | null {
  const playerCount = humansCount + botsCount
  if (playerCount < 2) return null
  const minPerRound = humansCount * HUMAN_MIN_PER_ROUND + botsCount * BOT_MIN_PER_ROUND
  const lossPerRound = AVG_CARDS_PER_LOSS * (playerCount - 1) / playerCount
  const roundsToFirstHit = opts.threshold / lossPerRound
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

export function WaitingRoom({ state, roomId, password, myPlayerId, onStart, onLeave, onAddBot, onRemoveBot, onSetBotDifficulty }: WaitingRoomProps) {
  const canStart = state.players.length >= 2
  const canAddBot = state.players.length < 4
  const [copied, setCopied] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const cardBackId = useCardBackId()
  const cardBack = getCardBack(cardBackId)

  const initial = useMemo(loadSettings, [])
  const [scoringMode, setScoringMode] = useState<GameOptions['scoringMode']>(initial.scoringMode)
  const [pointsTarget, setPointsTarget] = useState(initial.pointsTarget)
  const [chipsStarting, setChipsStarting] = useState(initial.chipsStarting)
  const [pointsThresholdAction, setPointsThresholdAction] = useState<GameOptions['pointsThresholdAction']>(initial.pointsThresholdAction)
  const [dealMode, setDealMode] = useState<DealMode>(initial.dealMode)
  const [personalCards, setPersonalCards] = useState(initial.personalCards)
  const [mixedDeckCount, setMixedDeckCount] = useState(initial.mixedDeckCount)
  const [mixedCards, setMixedCards] = useState(initial.mixedCards)

  useEffect(() => {
    saveSettings({
      scoringMode, pointsTarget, chipsStarting, pointsThresholdAction,
      dealMode, personalCards, mixedDeckCount, mixedCards,
    })
  }, [scoringMode, pointsTarget, chipsStarting, pointsThresholdAction, dealMode, personalCards, mixedDeckCount, mixedCards])

  const playerCount = Math.max(state.players.length, 1)
  const mixedMaxCards = Math.floor((mixedDeckCount * 52) / playerCount)
  const effectiveMixedCards = Math.min(mixedCards, mixedMaxCards)
  const cardsPerPlayer =
    dealMode === 'personal' ? personalCards :
    dealMode === 'mixed' ? effectiveMixedCards :
    Math.ceil(52 / playerCount)

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
    const base = `${window.location.origin}${window.location.pathname}?room=${roomId}`
    const url = password ? `${base}&p=${encodeURIComponent(password)}` : base
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={pageStyle}>
      <Frame bgColor="$material" boxShadow="$out" p="$2" style={{ width: 420 }}>
        <TitleBar title="Texas Flush'em - Lobby" active />
        <div style={{ padding: 12 }}>

          <Fieldset legend="Room">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 4 }}>
              <span style={{ fontSize: 12 }}>Code:</span>
              <Frame bgColor="$inputBackground" boxShadow="$in" px="$4" py="$2" style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 700, letterSpacing: '0.1em', flex: 1 }}>
                {roomId}{password && ' [LOCK]'}
              </Frame>
              <Button onClick={copyCode}>Copy</Button>
            </div>
            <div style={{ marginTop: 6 }}>
              <Button onClick={copyLink} style={{ width: '100%' }}>
                {copied ? 'Link copied!' : password ? 'Copy invite link (incl. password)' : 'Copy invite link'}
              </Button>
            </div>
          </Fieldset>

          <div style={{ height: 8 }} />

          <Fieldset legend={`Players (${state.players.length}/4)`}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 4 }}>
              {state.players.map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  <span style={{ width: 8, height: 8, backgroundColor: p.isConnected ? '#0a0' : '#888', display: 'inline-block', flexShrink: 0 }} />
                  <span style={{ fontWeight: 700 }}>{p.name}</span>
                  {p.id === myPlayerId && <span style={{ color: '#444' }}>(you)</span>}
                  {p.isBot && <span style={{ background: '#000080', color: '#fff', padding: '0 4px', fontWeight: 700 }}>CPU</span>}
                  {p.isBot && (
                    <>
                      <select
                        value={p.botDifficulty ?? DEFAULT_BOT_DIFFICULTY}
                        onChange={e => onSetBotDifficulty(p.id, e.target.value as BotDifficulty)}
                        aria-label={`${p.name} difficulty`}
                        style={{ marginLeft: 'auto', fontSize: 11 }}
                      >
                        {(['easy', 'medium', 'hard'] as BotDifficulty[]).map(d => (
                          <option key={d} value={d}>{BOT_DIFFICULTY_LABELS[d]}</option>
                        ))}
                      </select>
                      <Button onClick={() => onRemoveBot(p.id)} aria-label={`Remove ${p.name}`} style={{ minWidth: 22, padding: '0 4px' }}>×</Button>
                    </>
                  )}
                </div>
              ))}
              {Array.from({ length: 4 - state.players.length }).map((_, i) => (
                <div key={`empty-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  {i === 0 && canAddBot ? (
                    <>
                      <span style={{ flex: 1, color: '#444' }}>+ Add CPU:</span>
                      {(['easy', 'medium', 'hard'] as BotDifficulty[]).map(d => (
                        <Button key={d} onClick={() => onAddBot(d)} style={{ padding: '0 8px' }}>
                          {BOT_DIFFICULTY_LABELS[d]}
                        </Button>
                      ))}
                    </>
                  ) : (
                    <>
                      <span style={{ width: 8, height: 8, backgroundColor: '#bbb', display: 'inline-block', flexShrink: 0 }} />
                      <span style={{ color: '#888', fontStyle: 'italic' }}>Waiting for player...</span>
                    </>
                  )}
                </div>
              ))}
            </div>
          </Fieldset>

          <div style={{ height: 8 }} />

          <Fieldset legend="Game settings">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 4 }}>
              <SettingRow label="Scoring">
                <Segmented
                  options={[{ value: 'points', label: 'Points' }, { value: 'chips', label: 'Chips' }]}
                  value={scoringMode}
                  onChange={setScoringMode}
                />
              </SettingRow>

              <SettingRow label={scoringMode === 'points' ? 'Target points' : 'Starting chips'}>
                <NumberStepper
                  value={threshold}
                  min={1}
                  onChange={v => {
                    if (scoringMode === 'points') setPointsTarget(v)
                    else setChipsStarting(v)
                  }}
                />
              </SettingRow>

              {scoringMode === 'points' && (
                <SettingRow label="On reach">
                  <Segmented
                    options={[{ value: 'eliminate', label: 'Eliminate' }, { value: 'end_game', label: 'End game' }]}
                    value={pointsThresholdAction}
                    onChange={setPointsThresholdAction}
                  />
                </SettingRow>
              )}

              <SettingRow label="Card back">
                <Button
                  onClick={() => setPickerOpen(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 6px' }}
                  aria-label={`Card back: ${cardBack.label}. Click to change.`}
                >
                  <CardBackVisual backId={cardBackId} width={20} height={28} />
                  <span style={{ fontSize: 12 }}>{cardBack.label}…</span>
                </Button>
              </SettingRow>

              <SettingRow label="Deal mode">
                <Segmented
                  options={[
                    { value: 'classic', label: 'Classic' },
                    { value: 'personal', label: 'Personal' },
                    { value: 'mixed', label: 'Mixed' },
                  ]}
                  value={dealMode}
                  onChange={setDealMode}
                />
              </SettingRow>

              {dealMode === 'classic' && (
                <SettingRow label="Cards each">
                  <span style={{ fontSize: 12, fontWeight: 700 }}>{cardsPerPlayer} (auto)</span>
                </SettingRow>
              )}

              {dealMode === 'personal' && (
                <SettingRow label="Cards per player">
                  <NumberStepper
                    value={personalCards}
                    min={MIN_CARDS_PER_PLAYER}
                    max={PERSONAL_MAX_CARDS}
                    onChange={setPersonalCards}
                  />
                </SettingRow>
              )}

              {dealMode === 'mixed' && (
                <>
                  <SettingRow label="Decks">
                    <Segmented
                      options={[1, 2, 3, 4].map(n => ({ value: n, label: String(n) }))}
                      value={mixedDeckCount}
                      onChange={setMixedDeckCount}
                    />
                  </SettingRow>
                  <SettingRow label="Cards per player">
                    <NumberStepper
                      value={effectiveMixedCards}
                      min={MIN_CARDS_PER_PLAYER}
                      max={mixedMaxCards}
                      onChange={setMixedCards}
                    />
                  </SettingRow>
                  {effectiveMixedCards < mixedCards && (
                    <p style={{ margin: 0, fontSize: 11, color: '#444', textAlign: 'right' }}>
                      Capped at {mixedMaxCards} (pool size / players).
                    </p>
                  )}
                </>
              )}

              {estMin !== null && (
                <p style={{ margin: 0, fontSize: 11, color: '#444', textAlign: 'right' }}>
                  Estimated game length: <b>{formatDuration(estMin)}</b>
                </p>
              )}
            </div>
          </Fieldset>

          {!canStart && (
            <p style={{ fontSize: 12, margin: '8px 0 4px', textAlign: 'center', color: '#444' }}>
              Need at least 2 players to start.
            </p>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <Button onClick={() => onStart(options)} disabled={!canStart} style={{ flex: 1, fontWeight: 700 }}>
              Start game
            </Button>
            <Button onClick={onLeave}>Leave</Button>
          </div>
        </div>
      </Frame>
      {pickerOpen && <CardBackPicker onClose={() => setPickerOpen(false)} />}
    </div>
  )
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <span style={{ fontSize: 12 }}>{label}</span>
      {children}
    </div>
  )
}

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '20px 0',
}

