# Texas Flush'em

A multiplayer browser card game — "Deck Poker" (working title: Flush Em). Shedding game with poker hands and personal decks, 2–4 players.

## Stack

- **Frontend:** Vite + React 18 + TypeScript
- **Multiplayer:** PartyKit (WebSockets, one party per room)
- **Component dev:** Storybook 8
- **Testing:** Vitest

## Getting started

```bash
npm install
npm run dev          # Vite frontend
npm run party:dev    # PartyKit local server (port 1999)
```

Run both together for full local play. Open http://localhost:5173.

Optional: set `VITE_PARTYKIT_HOST` in `.env.local` to point at a custom PartyKit host (defaults to `localhost:1999`).

## Other commands

```bash
npm test             # Vitest watch
npx vitest run       # Vitest single run
npm run storybook    # Storybook on port 6006
npm run build        # Type-check + Vite production build
npm run party:deploy # Deploy PartyKit server
```

## Project layout

```
shared/engine/   Pure game logic — runs on client and server
src/transport/   WebSocket abstraction (swap point for transport)
src/hooks/       React hooks consuming the transport
src/components/  React UI
party/game.ts    PartyKit server entry (thin wrapper over the engine)
```

The server is authoritative: clients send actions, the server validates and broadcasts. Each player only sees their own hand — opponents' cards are hidden in `buildClientState()`.

## How the game plays

Quick version: each player has a personal deck and draws to 10 cards. On your turn, optionally discard up to 5 to the bottom of your deck, draw back to 10, then play a poker hand that beats the current top play — or fold. First to empty their hand wins the round.

Full rules, deal-mode variants (classic / personal / mixed), scoring modes, and the multi-deck hand categories live in [public/deck-poker-rules.md](public/deck-poker-rules.md).
