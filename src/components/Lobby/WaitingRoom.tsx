import { useState, useMemo, useEffect } from 'react'
import { Frame, TitleBar, Fieldset } from '@react95/core'
import { Button, NumberInput, Select, Tabs, Tab, TabBody } from 'react95'
import QRCode from 'react-qr-code'
import type { ClientGameState } from '@shared/engine/state-machine'
import type { GameOptions, DealMode, BotDifficulty } from '@shared/engine/game-state'
import { DEFAULT_OPTIONS, MIN_CARDS_PER_PLAYER, PERSONAL_MAX_CARDS, MIXED_DEFAULT_CARDS, DEFAULT_BOT_DIFFICULTY } from '@shared/engine/game-state'
import { CardBackPicker } from '../CardBackPicker/CardBackPicker'
import { CardBackVisual } from '../Card/Card'
import { useCardBackId } from '../../contexts/CardBackContext'
import { getCardBack } from '../../cardBacks'
import { palette } from '../../palette'
import { RulesModal } from '../RulesModal'
import { AboutModal } from '../AboutModal'
import { ApiSpecModal } from '../ApiSpecModal'
import { MenuBar } from '../MenuBar'

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
  value, min, max, onChange, width = 90,
}: {
  value: number
  min: number
  max?: number
  onChange: (v: number) => void
  width?: number
}) {
  return (
    <NumberInput
      value={value}
      min={min}
      max={max}
      onChange={onChange}
      width={width}
    />
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
            active={active}
            size="sm"
            style={{ minWidth: 50 }}
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

type PresetKey = 'quick' | 'classic' | 'long'

interface Preset {
  key: PresetKey
  label: string
  hint: string
  // Subset of PersistedSettings — only the fields the preset overrides.
  settings: Partial<PersistedSettings>
}

const PRESETS: Preset[] = [
  {
    key: 'quick',
    label: 'Quick',
    hint: 'First to 13 points ends the game.',
    settings: {
      scoringMode: 'points',
      pointsTarget: 13,
      pointsThresholdAction: 'end_game',
      dealMode: 'classic',
    },
  },
  {
    key: 'classic',
    label: 'Classic',
    hint: 'Points to 26, eliminate at threshold.',
    settings: {
      scoringMode: 'points',
      pointsTarget: 26,
      pointsThresholdAction: 'eliminate',
      dealMode: 'classic',
    },
  },
  {
    key: 'long',
    label: 'Long game',
    hint: 'Chips, take everyone to win.',
    settings: {
      scoringMode: 'chips',
      chipsStarting: 13,
      dealMode: 'classic',
    },
  },
]

// Returns the preset whose every override matches current settings, or null.
function detectActivePreset(s: PersistedSettings): PresetKey | null {
  for (const p of PRESETS) {
    const match = (Object.keys(p.settings) as (keyof PersistedSettings)[])
      .every(k => s[k] === p.settings[k])
    if (match) return p.key
  }
  return null
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
  const [rulesOpen, setRulesOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [apiOpen, setApiOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'room' | 'settings'>('room')
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

  const activePreset = detectActivePreset({
    scoringMode, pointsTarget, chipsStarting, pointsThresholdAction,
    dealMode, personalCards, mixedDeckCount, mixedCards,
  })

  function applyPreset(p: Preset) {
    const s = p.settings
    if (s.scoringMode !== undefined) setScoringMode(s.scoringMode)
    if (s.pointsTarget !== undefined) setPointsTarget(s.pointsTarget)
    if (s.chipsStarting !== undefined) setChipsStarting(s.chipsStarting)
    if (s.pointsThresholdAction !== undefined) setPointsThresholdAction(s.pointsThresholdAction)
    if (s.dealMode !== undefined) setDealMode(s.dealMode)
    if (s.personalCards !== undefined) setPersonalCards(s.personalCards)
    if (s.mixedDeckCount !== undefined) setMixedDeckCount(s.mixedDeckCount)
    if (s.mixedCards !== undefined) setMixedCards(s.mixedCards)
  }

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

  const inviteUrl = (() => {
    const base = `${window.location.origin}${window.location.pathname}?room=${roomId}`
    return password ? `${base}&p=${encodeURIComponent(password)}` : base
  })()

  function copyCode() {
    navigator.clipboard.writeText(roomId)
  }

  function copyLink() {
    navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={pageStyle}>
      <Frame bgColor="$material" boxShadow="$out" p="$2" style={{ width: '100%', maxWidth: 460 }}>
        <TitleBar title="Texas Flush'em - Lobby" active />
        <MenuBar
          menus={[
            {
              name: '&Presets',
              items: PRESETS.map(p => ({
                label: `${activePreset === p.key ? '• ' : '   '}${p.label}`,
                onClick: () => applyPreset(p),
              })),
            },
            {
              name: '&Help',
              items: [
                { label: '&Rules', onClick: () => setRulesOpen(true) },
                { label: 'Bot &API…', onClick: () => setApiOpen(true) },
                { divider: true, label: '' },
                { label: '&About Texas Flush\'em', onClick: () => setAboutOpen(true) },
              ],
            },
          ]}
        />
        <div style={{ padding: 12 }}>

          <Tabs value={activeTab} onChange={(v) => setActiveTab(v as 'room' | 'settings')}>
            <Tab value="room">Room & Players</Tab>
            <Tab value="settings">Game settings</Tab>
          </Tabs>
          <TabBody style={{ padding: 8 }}>

          {activeTab === 'room' && (
            <div style={tabColStyle}>

          <Fieldset legend="Room">
            <div style={{ display: 'flex', gap: 10, padding: 4, alignItems: 'stretch' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                <Frame
                  bgColor="$inputBackground"
                  boxShadow="$in"
                  px="$4"
                  py="$2"
                  style={{
                    fontFamily: 'monospace',
                    fontSize: 28,
                    fontWeight: 700,
                    letterSpacing: '0.15em',
                    textAlign: 'center',
                    lineHeight: 1.1,
                  }}
                >
                  {roomId}
                  {password && (
                    <span style={{ marginLeft: 8, fontSize: 14, verticalAlign: 'middle', color: palette.dkGray }}>
                      [LOCK]
                    </span>
                  )}
                </Frame>
                <div style={{ display: 'flex', gap: 4 }}>
                  <Button onClick={copyCode} size="sm" style={{ flex: 1 }}>Copy code</Button>
                  <Button onClick={copyLink} size="sm" style={{ flex: 1 }}>
                    {copied ? 'Copied!' : 'Copy link'}
                  </Button>
                </div>
              </div>
              <Frame
                bgColor="$inputBackground"
                boxShadow="$in"
                p="$2"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                aria-label="Scan to join"
              >
                <QRCode value={inviteUrl} size={88} bgColor="#ffffff" fgColor="#000000" />
              </Frame>
            </div>
          </Fieldset>

          <Fieldset legend={`Players (${state.players.length}/4)`}>
            <Frame
              bgColor="$inputBackground"
              boxShadow="$in"
              style={{ display: 'flex', flexDirection: 'column', padding: 4, gap: 2 }}
            >
              {state.players.map(p => (
                <div key={p.id} style={playerRowStyle}>
                  <span style={{ width: 8, height: 8, backgroundColor: p.isConnected ? palette.win : palette.midGray, display: 'inline-block', flexShrink: 0 }} />
                  <span style={{ fontWeight: 700 }}>{p.name}</span>
                  {p.id === myPlayerId && <span style={{ color: palette.vdkGray }}>(you)</span>}
                  {p.isBot && <span style={{ background: palette.navy, color: palette.white, padding: '0 4px', fontWeight: 700 }}>CPU</span>}
                  {p.isApi && <span style={{ background: palette.win, color: palette.white, padding: '0 4px', fontWeight: 700 }}>API</span>}
                  {p.isBot && (
                    <>
                      <Select<BotDifficulty>
                        value={p.botDifficulty ?? DEFAULT_BOT_DIFFICULTY}
                        onChange={selected => onSetBotDifficulty(p.id, selected.value)}
                        options={(['easy', 'medium', 'hard'] as BotDifficulty[]).map(d => ({
                          value: d, label: BOT_DIFFICULTY_LABELS[d],
                        }))}
                        aria-label={`${p.name} difficulty`}
                        width={90}
                        style={{ marginLeft: 'auto' }}
                      />
                      <Button onClick={() => onRemoveBot(p.id)} aria-label={`Remove ${p.name}`} size="sm" square>×</Button>
                    </>
                  )}
                </div>
              ))}
              {Array.from({ length: 4 - state.players.length }).map((_, i) => (
                <div key={`empty-${i}`} style={playerRowStyle}>
                  {i === 0 && canAddBot ? (
                    <>
                      <span style={{ flex: 1, color: palette.vdkGray }}>+ Add CPU:</span>
                      {(['easy', 'medium', 'hard'] as BotDifficulty[]).map(d => (
                        <Button key={d} onClick={() => onAddBot(d)} size="sm">
                          {BOT_DIFFICULTY_LABELS[d]}
                        </Button>
                      ))}
                    </>
                  ) : (
                    <>
                      <span style={{ width: 8, height: 8, backgroundColor: palette.ltGray, display: 'inline-block', flexShrink: 0 }} />
                      <span style={{ color: palette.midGray, fontStyle: 'italic' }}>Waiting for player...</span>
                    </>
                  )}
                </div>
              ))}
            </Frame>
          </Fieldset>

            </div>
          )}

          {activeTab === 'settings' && (
            <div style={tabColStyle}>

              <Fieldset legend="Scoring">
                <div style={settingsColStyle}>
                  <SettingRow label="Mode">
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
                </div>
              </Fieldset>

              <div style={{ height: 8 }} />

              <Fieldset legend="Dealing">
                <div style={settingsColStyle}>
                  <SettingRow label="Mode">
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
                        <p style={{ margin: 0, fontSize: 11, color: palette.vdkGray, textAlign: 'right' }}>
                          Capped at {mixedMaxCards} (pool size / players).
                        </p>
                      )}
                    </>
                  )}

                  <SettingRow label="Card back">
                    <Button
                      onClick={() => setPickerOpen(true)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 14,
                        padding: '10px 14px',
                        height: 'auto',
                        fontSize: 15,
                      }}
                      aria-label={`Card back: ${cardBack.label}. Click to change.`}
                    >
                      <CardBackVisual backId={cardBackId} width={64} height={88} />
                      <span>{cardBack.label}…</span>
                    </Button>
                  </SettingRow>
                </div>
              </Fieldset>

            </div>
          )}

          </TabBody>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 12 }}>
            <span style={{ fontSize: 13, color: palette.vdkGray }}>
              {!canStart
                ? 'Need at least 2 players to start.'
                : estMin !== null
                  ? <>Estimated game length: <b>{formatDuration(estMin)}</b></>
                  : null}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button onClick={onLeave} style={{ minWidth: 80 }}>Leave</Button>
              <Button
                onClick={() => onStart(options)}
                disabled={!canStart}
                primary
                style={{ minWidth: 110 }}
              >
                Start game
              </Button>
            </div>
          </div>
        </div>
      </Frame>

      <div style={footerStyle}>
        (c) {new Date().getFullYear()}{' '}
        <a
          href="https://jessestewart.com"
          target="_blank"
          rel="noopener noreferrer"
          style={footerLinkStyle}
        >
          Jesse Stewart
        </a>
      </div>

      {pickerOpen && <CardBackPicker onClose={() => setPickerOpen(false)} />}
      {rulesOpen && <RulesModal onClose={() => setRulesOpen(false)} />}
      {aboutOpen && <AboutModal onClose={() => setAboutOpen(false)} />}
      {apiOpen && <ApiSpecModal onClose={() => setApiOpen(false)} />}
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
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '20px 0',
  gap: 16,
}

const tabColStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
}

const settingsColStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: 4,
}

const playerRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 12,
  padding: '2px 4px',
  minHeight: 22,
}

const footerStyle: React.CSSProperties = {
  fontSize: 11,
  color: palette.white,
  textShadow: '1px 1px 0 #000',
  textAlign: 'center',
}

const footerLinkStyle: React.CSSProperties = {
  color: palette.white,
  textDecoration: 'underline',
}

