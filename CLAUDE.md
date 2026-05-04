# Texas Flush'em — CLAUDE.md


## What This Is
A multiplayer card game called "Deck Poker" (working title: Flush Em). Shedding game with poker hands and personal decks, 2–4 players. Full rules are in the project memory.

## Stack
- **Frontend:** Vite + React 18 + TypeScript (not Next.js — pure client-side)
- **Multiplayer:** PartyKit (WebSockets, one party/room per game)
- **Component dev:** Storybook 8
- **Testing:** Vitest (for shared/engine logic)

## Dev Commands
```bash
npm run dev          # Vite dev server (frontend)
npm run party:dev    # PartyKit local server (port 1999)
npm run storybook    # Storybook on port 6006
npm test             # Vitest (run once: npx vitest run)
```
Run `npm run dev` AND `npm run party:dev` together for full local development.

Set `VITE_PARTYKIT_HOST` in `.env.local` for a custom PartyKit host (defaults to `localhost:1999`).

## Architecture — Critical to Understand

### Layer separation
```
shared/engine/     ← pure TypeScript, zero framework deps, runs on client AND server
src/transport/     ← WebSocket abstraction layer
src/hooks/         ← React hooks (consume transport)
src/components/    ← React UI (consume hooks)
party/game.ts      ← PartyKit server entry (thin wrapper only)
```

### Transport swap point
To switch from PartyKit to Socket.io (or anything else), change **one import** in `src/hooks/useGame.ts`. Nothing else touches transport.

### Server is authoritative
Game state lives in `party/game.ts`. Clients send actions, server validates + broadcasts. Each player receives only their own hand — opponents' cards are hidden server-side in `buildClientState()`.

## Key Files

| File | Purpose |
|------|---------|
| `shared/engine/card.ts` | Card/Rank/Suit types, rank/suit ordering |
| `shared/engine/deck.ts` | shuffle, deal, draw, insertToBottom |
| `shared/engine/hand-eval.ts` | Full hand evaluator — 16 categories, compareHands, beats |
| `shared/engine/game-state.ts` | GameState + PlayerState types |
| `shared/engine/rules.ts` | validatePlay, validateDiscard, scoreRound |
| `shared/engine/state-machine.ts` | Game reducer: applyCommand, initialState, buildClientState |
| `src/transport/GameTransport.ts` | Transport interface (the swap contract) |
| `src/transport/partykit.ts` | PartyKit implementation |
| `src/hooks/useGame.ts` | React hook — connects to PartyKit, exposes state + send |
| `party/game.ts` | PartyKit server — fully wired to state machine |

## Game State Machine

Commands (all validated before applying):
- `ADD_PLAYER` — lobby only, max 4 players
- `START_GAME` — accepts a `Partial<GameOptions>`; deals according to `dealMode`, each player draws top 10
- `DISCARD` — up to 5 cards to bottom of own deck, then draws back to 10; if deck empty, skips
- `PLAY` — validates hand beats current top play, replenishes, checks round/hand end
- `FOLD` — marks folded, ends hand if ≤1 player remains
- `RECONNECT` / `DISCONNECT` — marks player connected/disconnected

Turn phases: `discard` → (DISCARD action) → `play` → (PLAY or FOLD) → next player's `discard`

## Game Options (frozen at START_GAME)

Selected in the lobby ([WaitingRoom.tsx](src/components/Lobby/WaitingRoom.tsx)), passed via `START_GAME`, stored on `GameState.options`. Defined in [shared/engine/game-state.ts](shared/engine/game-state.ts).

**Scoring:**
- `scoringMode: 'points' | 'chips'` — points (default) accumulate as penalties, lower = better. Chips start at `threshold` per player and transfer.
- `threshold: number` — points target / chips per player (default 26 points / 13 chips, no upper cap).
- `pointsThresholdAction: 'eliminate' | 'end_game'` — points-only. Eliminate (default) = continue until 1 left; end_game = whole game ends, lowest cumulative wins.

**Dealing:**
- `dealMode: 'classic' | 'personal' | 'mixed'` — controls how cards reach players.
  - **classic** (default) — single shuffled 52-card deck dealt round-robin (remainder to early players). `cardsPerPlayer` ignored.
  - **personal** — each player has their own independently-shuffled private 52-card deck (or `cardsPerPlayer` ≤ 52). Multi-deck hand categories impossible because no player ever holds duplicates.
  - **mixed** — `mixedDeckCount × 52` cards shuffled into one shared pool; each player dealt `cardsPerPlayer`; leftovers discarded. Multi-deck hand categories become possible due to duplicates.
- `cardsPerPlayer: number` — Personal: 10–52. Mixed: 10–`floor(mixedDeckCount × 52 / playerCount)` (lobby clamps).
- `mixedDeckCount: number` — Mixed only, 1–4.

`GameState.deckCount` is now a **derived** "logical decks worth of cards in play" used by the bot's hidden-card reasoning: classic = 1, mixed = `mixedDeckCount`, personal = `playerCount`. It's set in `applyStartGame`/`applyNextRound` via `effectiveDeckCount(...)`.

## Hand Categories (low → high)
Single-deck: HIGH_CARD, PAIR, TWO_PAIR, THREE_OF_A_KIND, STRAIGHT, FLUSH, FULL_HOUSE, FOUR_OF_A_KIND, STRAIGHT_FLUSH, ROYAL_FLUSH

Multi-deck adds (at correct positions): FLUSH_PAIR, FLUSH_TWO_PAIR, FLUSH_THREE_OF_A_KIND, FLUSH_FULL_HOUSE, FLUSH_FOUR_OF_A_KIND, FIVE_OF_A_KIND

Tiebreaking: category → rank → suit (clubs < diamonds < hearts < spades). Straights do not wrap around Ace.

## What's Done
- [x] Full project scaffold + all config
- [x] Hand evaluator with 45 passing tests
- [x] Game state machine (full turn loop, hand/round lifecycle)
- [x] PartyKit server wired to state machine
- [x] Transport abstraction layer
- [x] Card component + Storybook stories

## What's Next (priority order)
1. **State machine tests** — `shared/engine/state-machine.test.ts` — test ADD_PLAYER, START_GAME, full turn sequences, hand-end edge cases
2. **Lobby UI** — create game / join game by room ID
3. **GameScreen** — main game layout, connects `useGame` hook to UI
4. **PlayerHand component** — displays own hand, card selection, discard/play controls
5. **TableCenter component** — shows current top play, whose turn it is
6. **ActionBar component** — Discard, Play, Fold buttons with validation state

## Conventions
- All shared engine code: pure functions, no side effects, no framework imports
- Components: inline styles for now (no CSS framework decided yet)
- Stories live next to components: `Component.tsx` + `Component.stories.tsx`
- State machine is a reducer: `applyCommand(state, cmd) => GameState` — never mutates
- `@shared/*` path alias maps to `shared/` (configured in vite.config.ts + tsconfig.json)

Game rules are at `./public/deck-poker-rules.md`