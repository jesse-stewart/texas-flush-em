import { useEffect } from 'react'
import { Frame, TitleBar } from '@react95/core'
import { Button } from 'react95'
import { palette } from '../palette'

interface ApiSpecModalProps {
  onClose: () => void
}

export function ApiSpecModal({ onClose }: ApiSpecModalProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Mirror the host resolution useGame.ts does, so the spec shows the user's actual endpoint.
  const host = import.meta.env.VITE_PARTYKIT_HOST ?? 'localhost:1999'
  const scheme = /^(localhost|127\.|\[?::1\]?)/.test(host) ? 'ws' : 'wss'
  const wsBase = `${scheme}://${host}`

  return (
    <div style={backdropStyle} onClick={onClose}>
      <Frame
        bgColor="$material"
        boxShadow="$out"
        p="$2"
        style={{ width: '100%', maxWidth: 720, maxHeight: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}
      >
        <TitleBar title="Bot API Reference" active>
          <TitleBar.OptionsBox>
            <TitleBar.Close onClick={onClose} />
          </TitleBar.OptionsBox>
        </TitleBar>

        <Frame
          bgColor="$inputBackground"
          boxShadow="$in"
          p="$8"
          style={{ overflowY: 'auto', flex: 1, fontSize: 12, lineHeight: 1.5 }}
        >
          <Section title="Overview">
            <p style={{ margin: '0 0 6px' }}>
              Connect a bot via WebSocket and play just like a browser client. Bots can create or
              join rooms, set or supply a password, and act on every turn. They appear to other
              players with an <Tag>API</Tag> badge.
            </p>
            <p style={{ margin: 0, color: palette.dkGray }}>
              No authentication is required today. A simple per-IP rate limit is in place; build
              bots that stay well under it.
            </p>
          </Section>

          <Section title="Connect">
            <p style={{ margin: '0 0 4px' }}>Open a WebSocket to:</p>
            <Code>{`${wsBase}/parties/main/<ROOM_ID>?_pk=<botId>&p=<password>`}</Code>
            <ul style={listStyle}>
              <li><b>ROOM_ID</b> — a 6-character code (e.g. <Mono>CLAUDE</Mono>). The join form caps at 6 chars, so anything longer can&apos;t be joined by humans. Connecting to a fresh room ID creates the room.</li>
              <li><b>_pk</b> — your bot&apos;s connection ID. Pick a stable random string per bot run; this is also your <i>player id</i>.</li>
              <li><b>p</b> — optional password. On a fresh room, the first connection&apos;s value <b>sets</b> the password. On an existing room it must match.</li>
            </ul>
            <p style={{ margin: '6px 0 0', color: palette.dkGray }}>
              Host is your current build&apos;s <Mono>VITE_PARTYKIT_HOST</Mono>; deployed clients see
              the production host automatically.
            </p>
          </Section>

          <Section title="Identify yourself">
            <p style={{ margin: '0 0 4px' }}>Immediately after the socket opens, send a JOIN message with <Mono>client: &quot;api&quot;</Mono> so other players see the API badge:</p>
            <Code>{`{ "type": "JOIN", "playerName": "MyBot", "client": "api" }`}</Code>
          </Section>

          <Section title="Actions you send">
            <p style={{ margin: '0 0 4px' }}>All messages are JSON. Per-turn actions:</p>
            <ul style={listStyle}>
              <li><Mono>{'{ "type": "DISCARD", "cards": [...] }'}</Mono> — up to 5 cards from your hand to the bottom of your deck. Send <Mono>cards: []</Mono> to skip discarding.</li>
              <li><Mono>{'{ "type": "PLAY", "cards": [...] }'}</Mono> — play a legal poker hand that strictly beats the current top play.</li>
              <li><Mono>{'{ "type": "FOLD" }'}</Mono> — fold this hand.</li>
              <li><Mono>{'{ "type": "LEAVE" }'}</Mono> — leave the game.</li>
              <li><Mono>{'{ "type": "READY_FOR_NEXT_ROUND" }'}</Mono> — between rounds, signal you&apos;re ready.</li>
            </ul>
            <p style={{ margin: '8px 0 4px' }}>Betting actions (chips mode + <Mono>anteAmount &gt; 0</Mono> only, during <Mono>turnPhase === &quot;bet&quot;</Mono>):</p>
            <ul style={listStyle}>
              <li><Mono>{'{ "type": "CHECK" }'}</Mono> — pass when there&apos;s no outstanding bet to call.</li>
              <li><Mono>{'{ "type": "BET", "amount": N }'}</Mono> — open the betting. <Mono>amount</Mono> is the TOTAL chips you&apos;ll have committed this hand after the bet. Min target = <Mono>betToMatch + anteAmount</Mono>.</li>
              <li><Mono>{'{ "type": "CALL" }'}</Mono> — match the current <Mono>betToMatch</Mono>. Auto-converts to all-in if you&apos;re short.</li>
              <li><Mono>{'{ "type": "RAISE", "amount": N }'}</Mono> — raise. <Mono>amount</Mono> is the new total to commit. Min target = <Mono>betToMatch + minRaise</Mono>.</li>
            </ul>
            <p style={{ margin: '8px 0 4px' }}>Lobby-only actions (no-ops outside the <Mono>lobby</Mono> phase):</p>
            <ul style={listStyle}>
              <li><Mono>{'{ "type": "ADD_BOT", "difficulty": "easy"|"medium"|"hard" }'}</Mono> — add a CPU bot. Difficulty defaults to medium.</li>
              <li><Mono>{'{ "type": "REMOVE_BOT", "playerId": "..." }'}</Mono> — remove a CPU bot by player ID.</li>
              <li><Mono>{'{ "type": "SET_BOT_DIFFICULTY", "playerId": "...", "difficulty": "..." }'}</Mono> — change a CPU bot&apos;s difficulty.</li>
              <li><Mono>{'{ "type": "START_GAME", "options": { ... } }'}</Mono> — start the game with the given options (see <b>Game options</b> below). Requires ≥2 players.</li>
            </ul>
            <p style={{ margin: '6px 0 0', color: palette.dkGray }}>
              Each turn requires <b>DISCARD then PLAY or FOLD</b>, in that order. When betting is enabled, a <b>BET phase</b> runs at the start of every hand: antes are auto-posted, then each player checks/bets/calls/raises/folds clockwise from the dealer&apos;s left. The hand winner takes the pot; round-end <Mono>chipValuePerCard</Mono> transfers still happen on top. Invalid actions are silently ignored.
            </p>
          </Section>

          <Section title="Game options">
            <p style={{ margin: '0 0 4px' }}>
              Sent in <Mono>START_GAME</Mono> and frozen for the rest of the game. All fields are optional; missing fields fall back to the engine defaults shown below. The server clamps out-of-range values.
            </p>
            <Code>{`{
  "scoringMode": "points" | "chips",        // default "points"
  "threshold": number,                       // points target, OR starting chips. default 26
  "pointsThresholdAction": "eliminate" | "end_game", // points-only. default "eliminate"
  "chipValuePerCard": number,                // chips-only. 1–100. default 6
  "anteAmount": number,                      // chips-only. 0 disables betting. default 0
  "dealMode": "classic" | "personal" | "mixed",      // default "classic"
  "cardsPerPlayer": number,                  // personal/mixed only; classic ignores
  "mixedDeckCount": number                   // mixed only, 1–4. default 2
}`}</Code>
            <ul style={listStyle}>
              <li><b>scoringMode</b> — <Mono>points</Mono> accumulates penalty points (lower = better); <Mono>chips</Mono> transfers chips between players.</li>
              <li><b>threshold</b> — in points mode, hitting it triggers <Mono>pointsThresholdAction</Mono>; in chips mode, the starting chip pile per player.</li>
              <li><b>chipValuePerCard</b> — chips mode only. Each remaining card a loser holds at round end is worth this many chips. Default 1, up to 100. Loss is capped at the loser&apos;s current balance so chips never go negative.</li>
              <li><b>anteAmount</b> — chips mode only. Each active player posts this much at the start of every hand. <Mono>0</Mono> disables betting (legacy flow). Lobby clamps to <Mono>floor(threshold / 2)</Mono>; players who can&apos;t afford the full ante post a partial one and go all-in.</li>
              <li><b>dealMode</b> — <Mono>classic</Mono> deals one shared 52-card deck round-robin; <Mono>personal</Mono> gives each player their own private deck; <Mono>mixed</Mono> shuffles <Mono>mixedDeckCount</Mono> decks together.</li>
            </ul>
          </Section>

          <Section title="Events you receive">
            <p style={{ margin: '0 0 4px' }}>The server pushes a <Mono>GAME_STATE</Mono> event after every state change, with your private hand visible only to you:</p>
            <Code>{`{
  "type": "GAME_STATE",
  "state": {
    "phase": "lobby" | "playing" | "round_end" | "game_end" | "abandoned",
    "players": [{ "id", "name", "handSize", "deckSize", "folded",
                  "isConnected", "eliminated", "isBot", "isApi" }],
    "myHand": [{ "rank", "suit" }],
    "myDeckSize": 42,
    "turnPhase": "bet" | "discard" | "play",
    "currentPlayerId": "...",
    "currentTopPlay": { "category", "cards": [...] } | null,
    "scores": { "<playerId>": <number> },
    // Betting fields (zero/empty when betting disabled):
    "pot": <number>,
    "committed": { "<playerId>": <number> },   // chips committed this hand
    "betToMatch": <number>,
    "minRaise": <number>,
    "options": { ... },
    ...
  }
}`}</Code>
            <p style={{ margin: '6px 0 0' }}>It&apos;s your turn when <Mono>state.currentPlayerId</Mono> equals your bot id.</p>
          </Section>

          <Section title="Cards">
            <ul style={listStyle}>
              <li><b>rank</b>: <Mono>&quot;2&quot;</Mono> through <Mono>&quot;10&quot;</Mono>, <Mono>&quot;J&quot;</Mono>, <Mono>&quot;Q&quot;</Mono>, <Mono>&quot;K&quot;</Mono>, <Mono>&quot;A&quot;</Mono></li>
              <li><b>suit</b>: <Mono>&quot;clubs&quot;</Mono>, <Mono>&quot;diamonds&quot;</Mono>, <Mono>&quot;hearts&quot;</Mono>, <Mono>&quot;spades&quot;</Mono> (low to high)</li>
              <li>Plays are tied broken by category, then rank, then suit. Straights do <b>not</b> wrap.</li>
            </ul>
          </Section>

          <Section title="Connection close codes">
            <ul style={listStyle}>
              <li><Mono>4001 wrong-password</Mono> — bad <Mono>p</Mono> query value.</li>
              <li><Mono>4002 rate-limited</Mono> — too many new connections from your IP. Back off and retry.</li>
              <li><Mono>1000 Game over</Mono> — sent ~30s after a finished game so all clients see the final state.</li>
            </ul>
          </Section>

          <Divider />

          <Section title="SDK">
            <p style={{ margin: '0 0 4px' }}>
              A TypeScript SDK lives in the repo under <Mono>bot-sdk/</Mono>. It wraps the wire protocol
              with auto-reconnect, typed events, and helpers like <Mono>bot.discard()</Mono>, <Mono>bot.play()</Mono>,
              and <Mono>bot.fold()</Mono>. Clone the repo (or copy the folder) and import locally:
            </p>
            <Code>{`import { createBot, isMyTurn } from './bot-sdk'

const bot = createBot({
  host: '${host}',
  roomId: 'A3BC9F',
  playerName: 'MyBot',
})
bot.onState((state) => {
  if (!isMyTurn(state, bot.playerId)) return
  if (state.turnPhase === 'discard') return bot.discard([])
  // ...your hand-picking logic here
  bot.fold()
})
bot.connect()`}</Code>
            <p style={{ margin: '4px 0 0', color: palette.dkGray }}>
              See <Mono>bot-sdk/example.ts</Mono> for a runnable RandoBot. Start it locally with
              <Mono> npm run sdk:example</Mono>.
            </p>
          </Section>

          <Section title="Minimal example (no SDK)">
            <Code>{`const bot = new WebSocket(
  \`${wsBase}/parties/main/MYROOM?_pk=mybot-\${Date.now()}\`
)
bot.onopen = () => bot.send(JSON.stringify({
  type: 'JOIN', playerName: 'RandoBot', client: 'api',
}))
bot.onmessage = (e) => {
  const msg = JSON.parse(e.data)
  if (msg.type !== 'GAME_STATE') return
  const s = msg.state
  if (s.currentPlayerId !== 'mybot-...') return
  if (s.turnPhase === 'discard') {
    bot.send(JSON.stringify({ type: 'DISCARD', cards: [] }))
  } else {
    // pick a legal play, or fold
    bot.send(JSON.stringify({ type: 'FOLD' }))
  }
}`}</Code>
          </Section>
        </Frame>

        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 4px 0' }}>
          <Button onClick={onClose} style={{ minWidth: 75 }}>OK</Button>
        </div>
      </Frame>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 16 }}>
      <h3 style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700, color: palette.navy }}>
        {title}
      </h3>
      <div>{children}</div>
    </section>
  )
}

function Divider() {
  return <hr style={{ border: 'none', borderTop: '1px solid #888', borderBottom: '1px solid #fff', margin: '8px 0 16px' }} />
}

function Mono({ children }: { children: React.ReactNode }) {
  return <code style={{ fontFamily: 'monospace', fontSize: 11, background: '#fff', padding: '0 3px', border: '1px solid #ccc' }}>{children}</code>
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span style={{ background: palette.win, color: palette.white, padding: '0 4px', fontWeight: 700, fontSize: 11 }}>{children}</span>
}

function Code({ children }: { children: string }) {
  return (
    <pre style={{
      margin: '4px 0',
      padding: 8,
      background: '#fff',
      border: '1px solid #ccc',
      fontFamily: 'monospace',
      fontSize: 11,
      lineHeight: 1.4,
      overflowX: 'auto',
      whiteSpace: 'pre',
    }}>{children}</pre>
  )
}

const backdropStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 200,
  backgroundColor: 'rgba(0,0,0,0.4)',
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  padding: '40px 16px',
}

const listStyle: React.CSSProperties = {
  margin: 0,
  paddingLeft: 20,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
}
