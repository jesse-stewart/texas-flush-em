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
import { EventBubble } from './Game/EventBubble'

interface GameScreenProps {
  state: ClientGameState
  myPlayerId: string
  roomId: string
  send: (action: GameAction) => void
  presence: Map<string, PlayerPresence>
  onLeave: () => void
}

function cardKey(c: Card) { return `${c.rank}-${c.suit}` }

// Stable per-instance slot for a card in the player's hand. The id disambiguates
// duplicates in mixed-deck mode (two 4♥ from different decks need separate identities).
interface HandSlot { id: number; card: Card }

export function GameScreen({ state, myPlayerId, roomId, send, presence, onLeave }: GameScreenProps) {
  const [selected, setSelected] = useState<number[]>([])  // slot ids
  const [rulesOpen, setRulesOpen] = useState(false)
  const [cardOrder, setCardOrder] = useState<HandSlot[]>([])
  // Slots currently animating from hand → deck (FLIP targets share layoutId with the source)
  const [discardingCards, setDiscardingCards] = useState<HandSlot[]>([])
  // Slot IDs of the cards in my most recent PLAY, in the order I played them. Lets TableCenter
  // use the same layoutIds as Hand so the cards FLIP-animate from my hand to the table.
  // Cleared when the current hand resets (new lead → currentHandPlays goes back to 0).
  const [myLastPlaySlotIds, setMyLastPlaySlotIds] = useState<number[] | null>(null)

  const nextSlotId = useRef(0)

  // Sync cardOrder with state.myHand. Use multiset matching so duplicates keep distinct ids.
  useEffect(() => {
    setCardOrder(prev => {
      const incoming = new Map<string, number>()
      for (const c of state.myHand) incoming.set(cardKey(c), (incoming.get(cardKey(c)) ?? 0) + 1)

      // Keep slots whose card is still represented in the hand
      const kept: HandSlot[] = []
      for (const slot of prev) {
        const k = cardKey(slot.card)
        const remaining = incoming.get(k) ?? 0
        if (remaining > 0) {
          kept.push(slot)
          incoming.set(k, remaining - 1)
        }
      }
      // Add slots for cards that weren't matched to existing slots
      const added: HandSlot[] = []
      for (const c of state.myHand) {
        const k = cardKey(c)
        const remaining = incoming.get(k) ?? 0
        if (remaining > 0) {
          added.push({ id: nextSlotId.current++, card: c })
          incoming.set(k, remaining - 1)
        }
      }
      return [...kept, ...added]
    })
  }, [state.myHand])

  // Drop selections that point at slots no longer in the hand
  useEffect(() => {
    const validIds = new Set(cardOrder.map(s => s.id))
    setSelected(prev => prev.filter(id => validIds.has(id)))
  }, [cardOrder])

  // Clear selection when it's no longer our turn or phase advances
  useEffect(() => {
    setSelected([])
  }, [state.currentPlayerId, state.turnPhase])

  // Drop stale FLIP-source slot IDs once the current hand resets (new lead).
  useEffect(() => {
    if (state.currentHandPlays.length === 0) setMyLastPlaySlotIds(null)
  }, [state.currentHandPlays.length])

  // Broadcast presence (slot order + selected positions) to opponents whenever either changes.
  useEffect(() => {
    const handOrder = cardOrder.map(s => s.id)
    const selectedSet = new Set(selected)
    const selectedPositions = cardOrder
      .map((s, i) => selectedSet.has(s.id) ? i : -1)
      .filter(i => i >= 0)

    // Cast needed until TS language server picks up the updated GameAction union
    send({ type: 'PRESENCE', handOrder, selectedPositions } as unknown as GameAction)
  }, [selected, cardOrder]) // eslint-disable-line react-hooks/exhaustive-deps

  const opponents = state.players.filter(p => p.id !== myPlayerId)

  // Derived views
  const cards = cardOrder.map(s => s.card)
  const ids = cardOrder.map(s => `slot-${s.id}`)
  const selectedSet = new Set(selected)
  const selectedIndices = cardOrder
    .map((s, i) => selectedSet.has(s.id) ? i : -1)
    .filter(i => i >= 0)
  const selectedCards = cardOrder.filter(s => selectedSet.has(s.id)).map(s => s.card)

  function toggleCard(index: number) {
    const slot = cardOrder[index]
    if (!slot) return
    setSelected(prev => {
      const at = prev.indexOf(slot.id)
      if (at >= 0) return prev.filter((_, i) => i !== at)
      if (prev.length >= 5) return prev
      return [...prev, slot.id]
    })
  }

  function handleReorder(newCards: Card[]) {
    // Hand returns the cards in new order; map them back to slots, preserving ids.
    setCardOrder(prev => {
      const remaining = [...prev]
      const out: HandSlot[] = []
      for (const c of newCards) {
        const k = cardKey(c)
        const idx = remaining.findIndex(s => cardKey(s.card) === k)
        if (idx >= 0) {
          out.push(remaining[idx])
          remaining.splice(idx, 1)
        }
      }
      // Append any leftover slots (shouldn't happen, but be safe)
      return [...out, ...remaining]
    })
  }

  function handleDiscard() {
    const toDiscard = cardOrder.filter(s => selectedSet.has(s.id))
    const discardIds = new Set(toDiscard.map(s => s.id))
    // Same render: remove from hand AND add targets at deck → Framer Motion captures the FLIP
    setCardOrder(prev => prev.filter(s => !discardIds.has(s.id)))
    setDiscardingCards(toDiscard)
    setSelected([])
    send({ type: 'DISCARD', cards: toDiscard.map(s => s.card) })
    // Clear targets after animation completes
    setTimeout(() => setDiscardingCards([]), 600)
  }

  function handlePlay() {
    // Capture slot IDs in card order so TableCenter can use them as FLIP source layoutIds.
    const orderedSlotIds = cardOrder.filter(s => selectedSet.has(s.id)).map(s => s.id)
    setMyLastPlaySlotIds(orderedSlotIds)
    if (state.turnPhase === 'discard') send({ type: 'DISCARD', cards: [] })
    send({ type: 'PLAY', cards: selectedCards })
    setSelected([])
  }

  function handleFold() {
    if (state.turnPhase === 'discard') send({ type: 'DISCARD', cards: [] })
    send({ type: 'FOLD' })
    setSelected([])
  }

  function sortByRank() {
    setCardOrder(prev =>
      [...prev].sort((a, b) =>
        rankValue(a.card.rank) - rankValue(b.card.rank) ||
        suitValue(a.card.suit) - suitValue(b.card.suit)
      )
    )
  }

  function sortBySuit() {
    setCardOrder(prev =>
      [...prev].sort((a, b) =>
        suitValue(a.card.suit) - suitValue(b.card.suit) ||
        rankValue(a.card.rank) - rankValue(b.card.rank)
      )
    )
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <span style={styles.logo}>Texas Flush'em <span style={styles.roomId}>{roomId}</span></span>
        <div style={styles.scores}>
          {state.players.map(p => (
            <span key={p.id} style={{ ...styles.score, color: p.id === myPlayerId ? '#fde68a' : '#9ca3af' }}>
              {p.name}: {state.scores[p.id] ?? 0}
              {state.options.scoringMode === 'points' && `/${state.options.threshold}`}
            </span>
          ))}
        </div>
        <div style={styles.headerRight}>
          <button style={styles.rulesLink} onClick={() => setRulesOpen(true)}>Rules</button>
          <button style={styles.leaveBtn} onClick={onLeave}>Leave</button>
        </div>
      </div>

      <LayoutGroup>
        <OpponentArea
          opponents={opponents}
          allPlayers={state.players}
          myPlayerId={myPlayerId}
          currentPlayerId={state.currentPlayerId}
          presence={presence}
          events={state.events}
        />

        <TableCenter state={state} myPlayerId={myPlayerId} myLastPlaySlotIds={myLastPlaySlotIds} />

        <ActionBar
          state={state}
          myPlayerId={myPlayerId}
          selected={selectedCards}
          onDiscard={handleDiscard}
          onPlay={handlePlay}
          onFold={handleFold}
        />

        <PlayerHand
          cards={cards}
          ids={ids}
          selectedIndices={selectedIndices}
          onToggle={toggleCard}
          onReorder={handleReorder}
          onSortByRank={sortByRank}
          onSortBySuit={sortBySuit}
          disabled={state.currentPlayerId !== myPlayerId}
          deckSize={state.myDeckSize}
          discardingCards={discardingCards}
        />
      </LayoutGroup>

      <div style={styles.selfBubbleOverlay}>
        <EventBubble
          events={state.events}
          playerId={myPlayerId}
          myPlayerId={myPlayerId}
          players={state.players}
          isCurrentTurn={state.currentPlayerId === myPlayerId}
        />
      </div>

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
    position: 'relative',
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
  // Floats above the player's cards near the bottom of the screen, mirroring how
  // opponent bubbles sit above each opponent's seat.
  selfBubbleOverlay: {
    position: 'absolute',
    bottom: 240,
    left: 0,
    right: 0,
    display: 'flex',
    justifyContent: 'center',
    pointerEvents: 'none',
    zIndex: 10,
  },
}
