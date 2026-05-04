# How to Build a Multiplayer Card Game in a Weekend with PartyKit

I'd designed a card game and wanted to playtest it with friends. The fastest way to put a new game in front of three or four people, iterate on the rules between sessions, and run a round whenever someone had an hour free, is to build the online version. So I did.

A weekend later I had a working prototype: a real-time card game with hidden hands, validated turns, presence indicators, and reconnect-after-refresh, running on a single PartyKit room with a React client. Most of that time wasn't spent on networking. It was spent on the rules of the game itself, which was the whole point.

- **Play:** https://texas-flush-em.vercel.app/
- **Source:** https://github.com/jesse-stewart/texas-flush-em

This is a walkthrough of how PartyKit got me out of the multiplayer-plumbing business so I could focus on shedding poker hands instead.

## The game (briefly)

Texas Flush'em is a shedding game I designed, partially inspired by Balatro. The pitch: take Balatro's "build poker hands from a personal deck" hook, swap the solo score-chase for a multiplayer shedding game (think President or Big Two), and you have it. You and 2–3 opponents each play from your own deck, build pairs, flushes, full houses, etc., and beat the previous play with a strictly higher hand. First player to empty their cards wins the round.

That's enough setup. The interesting part is the architecture.

## What PartyKit gives you

PartyKit is "rooms as a service" on top of Cloudflare Durable Objects. You write a small server class, it runs one stateful instance per room, and clients connect to it over WebSockets. It comes without the usual supporting infrastructure of a broker, message queue, or signaling layer to plug in. Each room is a little stateful Node-ish process that lives next to its connections.

For a turn-based game where the whole interesting state fits in memory and one room equals one game, this is *exactly* the shape you want. No impedance mismatch.

The entire server entry point is one file. Here's the actual skeleton from [party/game.ts](party/game.ts):

```ts
// party/game.ts
import type * as Party from 'partykit/server'

export default class GameParty implements Party.Server {
  private state: GameState = initialState()

  constructor(readonly room: Party.Room) {}

  onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) { /* ... */ }
  onMessage(message: string, sender: Party.Connection) { /* ... */ }
  onClose(conn: Party.Connection) { /* ... */ }
}
```

Three lifecycle hooks. That's the whole API surface I needed for the core game.

## The decision that mattered: a pure engine layer

The single best decision I made, before writing any networking code, was to build the game logic as a pure reducer with zero framework or transport dependencies.

```
shared/engine/     ← pure TypeScript, runs on client AND server
src/transport/     ← WebSocket abstraction
src/hooks/         ← React hooks
src/components/    ← React UI
party/game.ts      ← PartyKit server (thin wrapper only)
```

Everything in [shared/engine/](shared/engine/) is pure functions. `applyCommand(state, command) => GameState`. No imports from React, no imports from PartyKit, no `Date.now()` outside event timestamps, no `Math.random()` outside of explicit shuffle utilities. It's testable with Vitest and runs identically on the server (authoritative) and on the client (for predictive UI, replay, or, in my case, Storybook fixtures).

Forty-five tests for the hand evaluator alone, and none of them know what a WebSocket is.

The reducer itself ends up looking like this, one big switch over a discriminated command union ([state-machine.ts:211](shared/engine/state-machine.ts#L211)):

```ts
export function applyCommand(state: GameState, cmd: GameCommand): GameState {
  switch (cmd.type) {
    case 'ADD_PLAYER':  return applyAddPlayer(state, cmd, false)
    case 'ADD_BOT':     return applyAddPlayer(state, cmd, true, cmd.difficulty)
    case 'START_GAME':  return applyStartGame(state, cmd)
    case 'DISCARD':     return applyDiscard(state, cmd)
    case 'PLAY':        return applyPlay(state, cmd)
    case 'FOLD':        return applyFold(state, cmd)
    case 'RECONNECT':   return applyReconnect(state, cmd)
    case 'DISCONNECT':  return applyDisconnect(state, cmd)
    // ... a few more
  }
}
```

And the PartyKit server file ends up being almost embarrassingly thin. This is the real `onMessage` hot path:

```ts
onMessage(message: string, sender: Party.Connection) {
  const action = JSON.parse(message) as GameAction
  switch (action.type) {
    case 'PLAY':
      this.state = applyCommand(this.state, {
        type: 'PLAY', playerId: sender.id, cards: action.cards,
      })
      break
    case 'DISCARD':
      this.state = applyCommand(this.state, {
        type: 'DISCARD', playerId: sender.id, cards: action.cards,
      })
      break
    case 'FOLD':
      this.state = applyCommand(this.state, { type: 'FOLD', playerId: sender.id })
      break
    // ... other cases
  }
  this.broadcastState()
}
```

Parse, dispatch to the reducer, broadcast. The server has no game knowledge of its own; it's a transport adapter for the engine. Validation lives inside `applyDiscard` and `applyPlay`, which call into [shared/engine/rules.ts](shared/engine/rules.ts) and silently no-op if the move is illegal. A malicious client can send anything it wants and the server will just ignore it.

## Server-authoritative state, every time

The server holds the only real `GameState`. Clients send *intents* ("I want to play these cards"), and the server validates, applies, and broadcasts the result.

This matters most for hidden information. In a card game, your opponents' hands have to be invisible. If the server just shipped the full state to every client, anyone with devtools could read everyone's cards. So the engine has a `buildClientState(state, forPlayerId)` function that returns a per-player view: your hand verbatim, but opponents reduced to hand sizes only.

Here's the actual function ([state-machine.ts:141](shared/engine/state-machine.ts#L141)):

```ts
export function buildClientState(state: GameState, forPlayerId: string): ClientGameState {
  const me = state.players.find(p => p.id === forPlayerId)
  return {
    phase: state.phase,
    players: state.players.map(p => ({
      id: p.id,
      name: p.name,
      handSize: p.hand.length,    // ← just the count for opponents
      deckSize: p.deck.length,
      folded: p.folded,
      isConnected: p.connected,
      eliminated: p.eliminated,
      isBot: p.isBot,
      botDifficulty: p.botDifficulty,
    })),
    myHand: me?.hand ?? [],        // ← real cards, only for the requester
    myDeckSize: me?.deck.length ?? 0,
    // ... shared fields: turn phase, current top play, scores, etc.
  }
}
```

Notice what's *not* there: no `hand` field on the per-player records. There's no way for the client to read opponents' cards because the server never puts them in the payload.

The broadcast loop calls `buildClientState` once per connection:

```ts
private broadcastState() {
  for (const conn of this.room.getConnections()) {
    this.sendTo(conn, {
      type: 'GAME_STATE',
      state: buildClientState(this.state, conn.id),
    })
  }
}
```

Each player gets a personalized snapshot. Cheating would require breaking the server, not just opening devtools.

The part I'd most warn future-me about: **never trust the client to redact**. If your `GameState` ever leaves the server with opponent cards in it, even once, even in a debug payload, you've shipped a cheat. The `buildClientState` boundary is where that invariant lives, and it's the one place I treat as load-bearing.

## The transport swap point

I didn't want to be locked into PartyKit, so I put a one-file abstraction between the React app and the WebSocket library. This is the actual interface from [src/transport/GameTransport.ts](src/transport/GameTransport.ts):

```ts
export interface GameTransport {
  connect(roomId: string, playerId: string, options?: ConnectOptions): void
  disconnect(): void
  send(action: GameAction): void
  onEvent(handler: (event: GameEvent) => void): () => void
  onConnect(handler: () => void): () => void
  onDisconnect(handler: () => void): () => void
  onError(handler: (err: ConnectionError) => void): () => void
}
```

[src/transport/partykit.ts](src/transport/partykit.ts) implements that interface using `partysocket`. The React hook imports the implementation, not the interface, and there's a comment marking the seam:

```ts
// src/hooks/useGame.ts
// ← Swap this import to change transport (Socket.io, etc.) — nothing else changes
import { createTransport } from '../transport/partykit'
```

If I ever want to move to plain Socket.io, or to a custom signaling layer, or to a peer-to-peer mesh, I write a new file implementing `GameTransport` and change one import. The components, hooks, and engine never know.

I haven't actually swapped it. But the discipline of having the seam means the seam stays clean, and it kept me honest about what data crosses the wire vs. what's UI-only state.

## Reconnects come for free

PartyKit assigns each connection an ID, but I wanted reconnect to mean "same player, same seat, same hand." So the client generates a stable ID and stashes it in localStorage:

```ts
// src/App.tsx
function getOrCreatePlayerId(existing?: string): string {
  if (existing) return existing
  return Math.random().toString(36).slice(2, 10)
}
```

That ID is passed to PartySocket as the connection ID. PartyKit uses it as `conn.id` on the server, which means the *same* player ID lines up between disconnects and reconnects. The reducer then has straightforward `RECONNECT` and `DISCONNECT` cases:

```ts
// party/game.ts
onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
  // ... password check elided ...
  this.state = applyCommand(this.state, { type: 'RECONNECT', playerId: conn.id })
  this.broadcastState()
}

onClose(conn: Party.Connection) {
  this.state = applyCommand(this.state, { type: 'DISCONNECT', playerId: conn.id })
  this.broadcastState()
}
```

The reducer keeps the player's seat, hand, and deck intact across disconnects. Refresh the page and you reconnect to the same game in the same state. The server is the source of truth and the client just renders whatever it's told, which means I don't need operational transforms, CRDTs, or any client-side reconciliation logic.

The only twist worth calling out: `onConnect` does a *broadcast*, not a one-shot send to the reconnecting player. That's because if a human reconnects in the middle of a bot's turn, the broadcast triggers the bot scheduler again. Otherwise the bot would silently stall, having had its timer cancelled by the disconnect.

## Presence: when you don't want the state machine involved

Some things shouldn't go through the reducer. Which cards a player has *selected* (but not yet played), the order they've dragged their hand into: that's UI state. It's nice to broadcast (so opponents can see "they're picking something up..."), but it shouldn't mutate game state, shouldn't be validated, and shouldn't trigger a re-broadcast of the full game.

PartyKit gives you the basic primitive of "I have a connection, I can send a message to other connections," and that handles this trivially. Presence messages get intercepted before they hit the reducer:

```ts
// party/game.ts
const raw = JSON.parse(message) as { type: string } & Record<string, unknown>

if (raw.type === 'PRESENCE') {
  const relay = JSON.stringify({
    type: 'PRESENCE',
    playerId: sender.id,
    handOrder: raw.handOrder,
    selectedPositions: raw.selectedPositions,
  })
  for (const conn of this.room.getConnections()) {
    if (conn.id !== sender.id) conn.send(relay)
  }
  return  // ← don't fall through to the reducer
}
```

Pure relay, no state change, no persistence, no reducer invocation. The room is just a fan-out hub for that channel.

This separation surprised me with how clean it felt. Game-affecting actions go through `applyCommand` and trigger a full validate-broadcast-persist cycle. Ephemeral UI signals get relayed and forgotten, and the reducer never knows they happened.

## Bots that run on the server

Once the engine was a pure reducer, adding CPU opponents was almost free. A bot is just another player whose turn the *server* takes on their behalf, using the same `applyCommand` API a human client would hit. They also turned out to be the best playtesting partner I had: a solo session against three CPUs runs in five minutes and surfaces rule edge cases as fast as a real game does. Adding one is a single command:

```ts
// party/game.ts
case 'ADD_BOT': {
  const botId = `bot-${Math.random().toString(36).slice(2, 8)}`
  // ... pick a name like "CPU Alice" ...
  this.state = applyCommand(this.state, {
    type: 'ADD_BOT',
    playerId: botId,
    playerName: name,
    difficulty: action.difficulty ?? DEFAULT_BOT_DIFFICULTY,
  })
  break
}
```

The bot's actual move comes from an Information Set Monte Carlo Tree Search ([shared/engine/bot-ismcts.ts](shared/engine/bot-ismcts.ts)), which is the right algorithm for hidden-information games like this where you don't know what's in your opponents' hands. Three difficulty presets map to ISMCTS knobs:

```ts
const DIFFICULTY_PRESETS: Record<BotDifficulty, DifficultyPreset> = {
  easy:   { iterations: 1500,  timeBudgetMs: 150,  ..., randomActionProb: 0.3 },
  medium: { iterations: 8000,  timeBudgetMs: 700,  ..., randomActionProb: 0 },
  hard:   { iterations: 20000, timeBudgetMs: 3000, ..., randomActionProb: 0 },
}
```

The interesting trick is `randomActionProb`. Easy bots aren't just "weak because they didn't search long," because that produces a bot that's sluggish *and* weirdly sharp when it does play. Instead, easy bots search normally, and 30% of the time throw the result away to pick a uniformly-random legal move. The behaviour reads as "missed a beat" rather than "broken AI," and players notice the difference.

Now, bots run inside `setTimeout`. Between scheduling and firing, anything could happen: a human might play, fold, disconnect, or join. So every state mutation bumps a sequence counter, and the bot timer captures the number it was scheduled with:

```ts
// party/game.ts
private scheduleBotTurnIfNeeded() {
  // ... bail if it's not a bot's turn ...
  const seq = this.botSeq
  this.botTimer = setTimeout(() => {
    if (seq !== this.botSeq) return  // ← state changed; drop this run
    this.runBotTurn(currentId)
  }, BOT_THINK_DELAY_MS)
}
```

I learned this the hard way. An early version had bots occasionally playing after they'd already folded, because a fold from a different action path didn't cancel the pending turn. The `botSeq` pattern fixes a whole class of stale-async bugs in one place: any in-flight async work that captured an old `seq` checks against the current one and exits silently.

## Game options without touching the server

The lobby lets you pick a deal mode (classic, personal, mixed) and a scoring mode (points or chips). Different deal modes change the cards-in-play substantially. The `personal` mode gives every player their own private deck. The `mixed` mode shuffles 1–4 standard decks into one shared pool, which means duplicate cards become possible, which means new hand categories like FIVE_OF_A_KIND and FLUSH_FULL_HOUSE become legal.

The whole options object is just a frozen field on `GameState`:

```ts
// shared/engine/game-state.ts
export interface GameOptions {
  scoringMode: 'points' | 'chips'
  threshold: number                                 // points target / chips per player
  pointsThresholdAction: 'eliminate' | 'end_game'
  dealMode: 'classic' | 'personal' | 'mixed'
  cardsPerPlayer: number                            // personal/mixed only
  mixedDeckCount: number                            // mixed only: 1–4
}
```

Options are sent with `START_GAME`, validated by the engine, stored on the state, and never change for the duration of the game. The dealing function branches on `options.dealMode`. The hand evaluator branches on `state.deckCount` (how many duplicates a five-card hand might contain).

Nothing in the *server* code changed when these were added. The engine took the new branches, the lobby UI grew a few selects, and that was it. This is the dividend of the pure-engine separation: game variants are an engine concern, not a transport concern. A new variant doesn't touch [party/game.ts](party/game.ts), the hooks, or the components.

## Password-protected rooms in a dozen lines

I wanted a way to keep playtests private without building accounts, magic links, or a database. Shared-secret room passwords were a one-evening feature thanks to PartyKit's connection lifecycle.

The first player into a fresh room sets the password (passed as a query param). Everyone else has to match it:

```ts
// party/game.ts
onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
  const incoming = new URL(ctx.request.url).searchParams.get('p') ?? ''
  const isFreshRoom = this.password === null && this.state.players.length === 0

  if (isFreshRoom) {
    if (incoming.length > 0) {
      this.password = incoming
      this.room.storage.put('password', incoming)
    }
  } else if (this.password !== null && incoming !== this.password) {
    conn.close(CLOSE_BAD_PASSWORD, 'wrong-password')
    return
  }
  // ... reconnect handling continues ...
}
```

`CLOSE_BAD_PASSWORD` is `4001`. Application-defined WebSocket close codes live in the 4xxx range, and the transport surfaces it via the `onError` channel I quietly added to `GameTransport` earlier:

```ts
// src/transport/partykit.ts
socket.addEventListener('close', (e) => {
  // 4xxx codes are server-rejected (auth fail, etc.) — bubble up so the UI
  // can surface a meaningful error and stop reconnect loops.
  if (e.code >= 4000 && e.code < 5000) {
    errorHandlers.forEach(h => h({ code: e.code, reason: e.reason }))
    socket?.close()
  }
  disconnectHandlers.forEach(h => h())
})
```

The lobby renders "wrong password" and stops the reconnect storm. When the game ends (`game_end` or `abandoned` phase) the password is wiped along with the rest of the room storage, so the next group to use that room name starts fresh, with the option to set a new password.

It's not bank-grade auth. It's "keep randos out," and that's exactly enough.

## An event log, almost for free

The reducer pattern gave me a typed event log without much work. Every applied command appends to `state.events`:

```ts
// shared/engine/game-state.ts
export type GameEvent =
  | { ts: number; type: 'game_started' }
  | { ts: number; type: 'discarded'; playerId: string; count: number }
  | { ts: number; type: 'played'; playerId: string; category: HandCategory; cards: Card[] }
  | { ts: number; type: 'folded'; playerId: string }
  | { ts: number; type: 'hand_won'; playerId: string }
  | { ts: number; type: 'round_won'; playerId: string; emptied: boolean }
  | { ts: number; type: 'eliminated'; playerId: string }
  | { ts: number; type: 'game_won'; playerId: string }
  | { ts: number; type: 'joined'; playerId: string; playerName: string; isBot: boolean }
  | { ts: number; type: 'left'; playerId: string }
```

Inside the reducer, a small helper stamps the timestamp and appends without mutating:

```ts
// shared/engine/state-machine.ts
function withEvents(state: GameState, ...events: EventInput[]): GameState {
  if (events.length === 0) return state
  const ts = Date.now()
  const stamped = events.map(e => ({ ...e, ts })) as GameEvent[]
  return { ...state, events: [...(state.events ?? []), ...stamped] }
}
```

The events ride along inside `ClientGameState` on every broadcast, and the UI's [EventLog](src/components/Game/EventLog.tsx) component just renders the tail of `state.events`. There's no separate channel or RPC; the events use the same path as the rest of the state.

This is the kind of feature that's almost free *because* of architectural decisions made earlier. The reducer was already returning new state, so adding an events array was a one-line change at each call site. PartyKit was already broadcasting full state, so the events came along for the ride. The persistence story was already "write the whole state on every mutation," which means the event log survives hibernation too.

## Persistence and the 24-hour sweep

Durable Objects can hibernate. If your room sits idle, it gets evicted from memory. When the next connection comes in it wakes up fresh, which means your in-memory `state` field is *gone* unless you persisted it.

PartyKit gives each room a `room.storage` KV API. I write the full state on every mutation:

```ts
this.room.storage.put('state', this.state)
```

…and rehydrate it in `onStart`:

```ts
async onStart() {
  const stored = await this.room.storage.get<GameState>('state')
  if (stored) {
    this.state = {
      ...stored,
      events: stored.events ?? [],
      nextRoundReady: stored.nextRoundReady ?? {},
    }
  }
}
```

That spread-with-defaults pattern is load-bearing. When I add a new field to `GameState`, old persisted snapshots are missing it, and without the defaults a single rehydrate would crash the room. **Schema evolution in a Durable Object is a real concern**: there's no migration step, just whatever fallback you bake into the read path.

For abandoned rooms, I push a 24-hour alarm forward on every broadcast:

```ts
this.room.storage.setAlarm(Date.now() + IDLE_TTL_MS)
```

If 24 hours pass with no activity, `onAlarm` fires, wipes the room, and closes any lingering connections. The room is self-cleaning, and nothing else has to know.

## What two days got me

By the end of the weekend I had:

- A 16-category hand evaluator, fully tested.
- A reducer-based state machine handling the full turn loop (discard → play → fold), hand resolution, round scoring, and end-game.
- A PartyKit server wired to the reducer, with hidden hands, reconnects, and presence.
- A React client with a lobby, game screen, drag-to-reorder hand, and an action bar.
- Storybook stories for every component, fed by the engine's pure types.

I didn't write a single line of WebSocket reconnect logic, message queue handling, or room registry code; PartyKit handled all of that. I wrote a `GameParty` class and a transport interface and got back to figuring out whether a flush should beat a straight (it should).

Everything on top of that was added later: bots, ISMCTS, difficulty levels, deal-mode variants, the chips scoring mode, password-protected rooms, the event log, the spectator mode. Each one was cheaper than the last, not because the features got smaller but because the seams I'd already cut kept absorbing them. A new game variant fits inside the engine, and a new wire-level feature fits inside the transport. Bots, passwords, and the event log are all reuses of seams that already existed.

## Would I do it again?

Yes, for any turn-based multiplayer game where:

- The interesting state fits in memory.
- One room equals one game (no global state, no matchmaking across rooms).
- Players are mostly co-present in time. The weakness of Durable Objects is they sleep when idle, which is fine for live games but wrong for long-running async ones.

For a real-time twitch game I'd want to think harder about latency and tickrate. For a massively multiplayer world I'd want sharding and a real backend. But for "I want to playtest a card game with three or four friends," PartyKit was the right shape and the right size, and got out of the way.

The hardest part of the weekend was deciding whether a flush five-of-a-kind should be legal. (It can't be: even with 4 decks, only 4 copies of any exact card exist.)

That's the kind of problem you want to be solving. Not WebSocket reconnects.

---

- **Play:** https://texas-flush-em.vercel.app/
- **Code:** https://github.com/jesse-stewart/texas-flush-em
- **Rules:** [public/deck-poker-rules.md](public/deck-poker-rules.md)
