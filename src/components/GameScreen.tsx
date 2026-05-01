import { useState, useEffect, useRef } from 'react'
import { RulesModal } from './RulesModal'
import { LayoutGroup } from 'framer-motion'
import type { ClientGameState } from '@shared/engine/state-machine'
import type { GameAction } from '../transport/types'
import type { PlayerPresence } from '../transport/presence'
import type { Card } from '@shared/engine/card'
import { rankValue, suitValue } from '@shared/engine/card'
import { OpponentArea } from './Game/OpponentArea'
import { TableCenter } from './Game/TableCenter'
import { ActionBar } from './Game/ActionBar'
import { PlayerHand } from './Game/PlayerHand'
import { DebugPanel } from './Game/DebugPanel'

interface GameScreenProps {
  state: ClientGameState
  myPlayerId: string
  roomId: string
  send: (action: GameAction) => void
  presence: Map<string, PlayerPresence>
  onLeave: () => void
}

function cardKey(c: Card) { return `${c.rank}-${c.suit}` }

export function GameScreen({ state, myPlayerId, roomId, send, presence, onLeave }: GameScreenProps) {
  const [selected, setSelected] = useState<Card[]>([])
  const [rulesOpen, setRulesOpen] = useState(false)
  const [cardOrder, setCardOrder] = useState<Card[]>(state.myHand)
  // Cards currently animating from hand to deck (targets rendered inside DeckStack)
  const [discardingCards, setDiscardingCards] = useState<Card[]>([])

  // Stable slot IDs: each card gets an integer ID when it first enters the hand.
  // These IDs let opponents animate our face-down cards reordering via Framer Motion.
  const slotIds = useRef(new Map<string, number>())
  const nextSlot = useRef(0)

  // Sync cardOrder when hand changes (cards played/drawn/discarded).
  // Preserve existing order; append new cards at the end.
  useEffect(() => {
    setCardOrder(prev => {
      const handKeys = new Set(state.myHand.map(cardKey))
      const kept = prev.filter(c => handKeys.has(cardKey(c)))
      const keptKeys = new Set(kept.map(cardKey))
      const added = state.myHand.filter(c => !keptKeys.has(cardKey(c)))
      return [...kept, ...added]
    })
  }, [state.myHand])

  // Clear selection when it's no longer our turn or phase advances
  useEffect(() => {
    setSelected([])
  }, [state.currentPlayerId, state.turnPhase])

  // Broadcast presence (selection + hand order) to opponents whenever either changes.
  useEffect(() => {
    // Assign stable slot IDs to any new cards; remove IDs for cards no longer in hand
    const currentKeys = new Set(cardOrder.map(cardKey))
    for (const key of slotIds.current.keys()) {
      if (!currentKeys.has(key)) slotIds.current.delete(key)
    }
    for (const card of cardOrder) {
      const key = cardKey(card)
      if (!slotIds.current.has(key)) slotIds.current.set(key, nextSlot.current++)
    }

    const handOrder = cardOrder.map(card => slotIds.current.get(cardKey(card))!)
    const selectedPositions = selected
      .map(card => cardOrder.findIndex(c => cardKey(c) === cardKey(card)))
      .filter(i => i >= 0)

    // Cast needed until TS language server picks up the updated GameAction union
    send({ type: 'PRESENCE', handOrder, selectedPositions } as unknown as GameAction)
  }, [selected, cardOrder]) // eslint-disable-line react-hooks/exhaustive-deps

  const opponents = state.players.filter(p => p.id !== myPlayerId)

  function toggleCard(card: Card) {
    setSelected(prev => {
      const idx = prev.findIndex(c => cardKey(c) === cardKey(card))
      if (idx >= 0) return prev.filter((_, i) => i !== idx)
      if (prev.length >= 5) return prev
      return [...prev, card]
    })
  }

  function handleDiscard() {
    const toDiscard = selected
    const toDiscardKeys = new Set(toDiscard.map(cardKey))
    // Same render: remove from hand AND add targets at deck → Framer Motion captures the FLIP
    setCardOrder(prev => prev.filter(c => !toDiscardKeys.has(cardKey(c))))
    setDiscardingCards(toDiscard)
    setSelected([])
    send({ type: 'DISCARD', cards: toDiscard })
    // Clear targets after animation completes
    setTimeout(() => setDiscardingCards([]), 600)
  }

  function handlePlay() {
    if (state.turnPhase === 'discard') send({ type: 'DISCARD', cards: [] })
    send({ type: 'PLAY', cards: selected })
    setSelected([])
  }

  function handleFold() {
    if (state.turnPhase === 'discard') send({ type: 'DISCARD', cards: [] })
    send({ type: 'FOLD' })
    setSelected([])
  }

  function sortByRank() {
    setCardOrder(prev =>
      [...prev].sort((a, b) => rankValue(a.rank) - rankValue(b.rank) || suitValue(a.suit) - suitValue(b.suit))
    )
  }

  function sortBySuit() {
    setCardOrder(prev =>
      [...prev].sort((a, b) => suitValue(a.suit) - suitValue(b.suit) || rankValue(a.rank) - rankValue(b.rank))
    )
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <span style={styles.logo}>Texas Flush'em <span style={styles.roomId}>{roomId}</span></span>
        <div style={styles.scores}>
          {state.players.map(p => (
            <span key={p.id} style={{ ...styles.score, color: p.id === myPlayerId ? '#fde68a' : '#9ca3af' }}>
              {p.name}: {52 - (state.scores[p.id] ?? 0)}
            </span>
          ))}
        </div>
        <div style={styles.headerRight}>
          <button style={styles.rulesLink} onClick={() => setRulesOpen(true)}>Rules</button>
          <button style={styles.leaveBtn} onClick={onLeave}>Leave</button>
        </div>
      </div>

      <LayoutGroup>
        <OpponentArea opponents={opponents} currentPlayerId={state.currentPlayerId} presence={presence} />

        <TableCenter state={state} myPlayerId={myPlayerId} />

        <ActionBar
          state={state}
          myPlayerId={myPlayerId}
          selected={selected}
          onDiscard={handleDiscard}
          onPlay={handlePlay}
          onFold={handleFold}
        />

        <PlayerHand
          cards={cardOrder}
          selected={selected}
          onToggle={toggleCard}
          onReorder={setCardOrder}
          onSortByRank={sortByRank}
          onSortBySuit={sortBySuit}
          disabled={state.currentPlayerId !== myPlayerId}
          deckSize={state.myDeckSize}
          discardingCards={discardingCards}
        />
      </LayoutGroup>

      {import.meta.env.DEV && (
        <DebugPanel state={state} myPlayerId={myPlayerId} send={send} />
      )}
      {rulesOpen && <RulesModal onClose={() => setRulesOpen(false)} />}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#0f4c2a',
    fontFamily: 'system-ui, sans-serif',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 20px',
    backgroundColor: 'rgba(0,0,0,0.3)',
    color: '#fff',
    flexShrink: 0,
  },
  logo: {
    fontSize: 18,
    fontWeight: 800,
    letterSpacing: '-0.5px',
    color: '#fff',
  },
  roomId: {
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: '0.1em',
    color: '#6ee7b7',
    marginLeft: 8,
  },
  scores: {
    display: 'flex',
    gap: 16,
    fontSize: 13,
  },
  score: {
    fontWeight: 600,
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  rulesLink: {
    fontSize: 12,
    fontWeight: 600,
    color: '#9ca3af',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
  },
  leaveBtn: {
    padding: '4px 12px',
    fontSize: 12,
    fontWeight: 600,
    borderRadius: 6,
    border: '1px solid rgba(255,255,255,0.2)',
    backgroundColor: 'transparent',
    color: '#9ca3af',
    cursor: 'pointer',
  },
}
