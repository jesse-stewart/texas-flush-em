import { useState, useEffect, useRef } from 'react'
import { Frame, TitleBar, contract } from '@react95/core'
import { palette } from '../palette'
import { RulesModal } from './RulesModal'
import { AboutModal } from './AboutModal'
import { ApiSpecModal } from './ApiSpecModal'
import { CardBackPicker } from './CardBackPicker/CardBackPicker'
import { MenuBar } from './MenuBar'
import { LayoutGroup } from 'framer-motion'
import type { ClientGameState } from '@shared/engine/state-machine'
import type { GameAction } from '../transport/types'
import type { PlayerPresence } from '../transport/presence'
import type { Card } from '@shared/engine/card'
import { rankValue, suitValue } from '@shared/engine/card'
import { OpponentArea, OpponentSeat } from './Game/OpponentArea'
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

interface HandSlot { id: number; card: Card }

export function GameScreen({ state, myPlayerId, roomId, send, presence, onLeave }: GameScreenProps) {
  const [selected, setSelected] = useState<number[]>([])
  const [rulesOpen, setRulesOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [apiOpen, setApiOpen] = useState(false)
  const [cardBackOpen, setCardBackOpen] = useState(false)
  const [cardOrder, setCardOrder] = useState<HandSlot[]>([])
  const [discardingCards, setDiscardingCards] = useState<HandSlot[]>([])
  const [myLastPlaySlotIds, setMyLastPlaySlotIds] = useState<number[] | null>(null)

  const nextSlotId = useRef(0)

  useEffect(() => {
    setCardOrder(prev => {
      const incoming = new Map<string, number>()
      for (const c of state.myHand) incoming.set(cardKey(c), (incoming.get(cardKey(c)) ?? 0) + 1)

      const kept: HandSlot[] = []
      for (const slot of prev) {
        const k = cardKey(slot.card)
        const remaining = incoming.get(k) ?? 0
        if (remaining > 0) {
          kept.push(slot)
          incoming.set(k, remaining - 1)
        }
      }
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

  useEffect(() => {
    const validIds = new Set(cardOrder.map(s => s.id))
    setSelected(prev => prev.filter(id => validIds.has(id)))
  }, [cardOrder])

  useEffect(() => {
    setSelected([])
  }, [state.currentPlayerId, state.turnPhase])

  useEffect(() => {
    if (state.currentHandPlays.length === 0) setMyLastPlaySlotIds(null)
  }, [state.currentHandPlays.length])

  useEffect(() => {
    const handOrder = cardOrder.map(s => s.id)
    const selectedSet = new Set(selected)
    const selectedPositions = cardOrder
      .map((s, i) => selectedSet.has(s.id) ? i : -1)
      .filter(i => i >= 0)
    send({ type: 'PRESENCE', handOrder, selectedPositions } as unknown as GameAction)
  }, [selected, cardOrder]) // eslint-disable-line react-hooks/exhaustive-deps

  const opponents = state.players.filter(p => p.id !== myPlayerId)

  // Opponents in turn order starting clockwise from me, so seat assignment is stable:
  // [next-to-play, +1, +2] → [left, top, right] in the 4-player grid.
  const myIndex = state.players.findIndex(p => p.id === myPlayerId)
  const orderedOpponents = myIndex < 0 ? opponents : Array.from({ length: state.players.length - 1 }, (_, i) => state.players[(myIndex + 1 + i) % state.players.length])
  const useGridLayout = orderedOpponents.length === 3

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
      return [...out, ...remaining]
    })
  }

  function handleDiscard() {
    const toDiscard = cardOrder.filter(s => selectedSet.has(s.id))
    const discardIds = new Set(toDiscard.map(s => s.id))
    setCardOrder(prev => prev.filter(s => !discardIds.has(s.id)))
    setDiscardingCards(toDiscard)
    setSelected([])
    send({ type: 'DISCARD', cards: toDiscard.map(s => s.card) })
    setTimeout(() => setDiscardingCards([]), 600)
  }

  function handlePlay() {
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
    <Frame
      bgColor="$material"
      boxShadow="$out"
      p="$2"
      style={{
        height: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      <TitleBar
        title={`Texas Flush'em - ${roomId}`}
        active
      >
        <TitleBar.OptionsBox>
          <TitleBar.Help onClick={() => setRulesOpen(true)} />
          <TitleBar.Close onClick={onLeave} />
        </TitleBar.OptionsBox>
      </TitleBar>

      {/* Win95 menu bar */}
      <MenuBar
        menus={[
          {
            name: '&Game',
            items: [
              { label: '&Leave game', onClick: onLeave },
            ],
          },
          {
            name: '&View',
            items: [
              { label: '&Card backs...', onClick: () => setCardBackOpen(true) },
            ],
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

      {/* Score bar */}
      <Frame
        bgColor="$material"
        px="$6"
        py="$2"
        style={{
          display: 'flex',
          gap: 16,
          alignItems: 'center',
          borderBottom: `1px solid ${contract.colors.borderDark}`,
          flexShrink: 0,
          fontSize: 12,
        }}
      >
        {state.players.map(p => (
          <span key={p.id} style={{ fontWeight: p.id === myPlayerId ? 700 : 400 }}>
            {p.name}: {state.scores[p.id] ?? 0}
            {state.options.scoringMode === 'points' && `/${state.options.threshold}`}
          </span>
        ))}
      </Frame>

      {/* Play area — green felt sunken into the window */}
      <Frame
        boxShadow="$in"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: palette.felt,
          overflow: 'auto',
          position: 'relative',
          margin: 4,
        }}
      >
        <LayoutGroup>
          {useGridLayout ? (
            <div style={tableGridStyle}>
              <div style={{ gridArea: 'top', display: 'flex', justifyContent: 'center' }}>
                <OpponentSeat
                  player={orderedOpponents[1]}
                  isActive={orderedOpponents[1].id === state.currentPlayerId}
                  isDealer={orderedOpponents[1].id === state.dealerId}
                  presence={presence.get(orderedOpponents[1].id) ?? null}
                  events={state.events}
                  myPlayerId={myPlayerId}
                  allPlayers={state.players}
                  orientation="across"
                />
              </div>

              <div style={{ gridArea: 'left', display: 'flex', justifyContent: 'flex-start', alignItems: 'flex-start' }}>
                <OpponentSeat
                  player={orderedOpponents[0]}
                  isActive={orderedOpponents[0].id === state.currentPlayerId}
                  isDealer={orderedOpponents[0].id === state.dealerId}
                  presence={presence.get(orderedOpponents[0].id) ?? null}
                  events={state.events}
                  myPlayerId={myPlayerId}
                  allPlayers={state.players}
                  orientation="left"
                />
              </div>

              <div style={{ gridArea: 'center', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <TableCenter state={state} myPlayerId={myPlayerId} myLastPlaySlotIds={myLastPlaySlotIds} />
              </div>

              <div style={{ gridArea: 'right', display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-start' }}>
                <OpponentSeat
                  player={orderedOpponents[2]}
                  isActive={orderedOpponents[2].id === state.currentPlayerId}
                  isDealer={orderedOpponents[2].id === state.dealerId}
                  presence={presence.get(orderedOpponents[2].id) ?? null}
                  events={state.events}
                  myPlayerId={myPlayerId}
                  allPlayers={state.players}
                  orientation="right"
                />
              </div>

              <div style={{ gridArea: 'bottom', paddingTop: 24 }}>
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
                  isDealer={state.dealerId === myPlayerId}
                />
              </div>
            </div>
          ) : (
            <>
              <OpponentArea
                opponents={opponents}
                allPlayers={state.players}
                myPlayerId={myPlayerId}
                currentPlayerId={state.currentPlayerId}
                dealerId={state.dealerId}
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
                isDealer={state.dealerId === myPlayerId}
              />
            </>
          )}
        </LayoutGroup>

        <div style={selfBubbleOverlayStyle}>
          <EventBubble
            events={state.events}
            playerId={myPlayerId}
            myPlayerId={myPlayerId}
            players={state.players}
            isCurrentTurn={state.currentPlayerId === myPlayerId}
          />
        </div>
      </Frame>

      {import.meta.env.DEV && (
        <DebugPanel state={state} myPlayerId={myPlayerId} send={send} />
      )}
      {rulesOpen && <RulesModal onClose={() => setRulesOpen(false)} />}
      {aboutOpen && <AboutModal onClose={() => setAboutOpen(false)} />}
      {apiOpen && <ApiSpecModal onClose={() => setApiOpen(false)} />}
      {cardBackOpen && <CardBackPicker onClose={() => setCardBackOpen(false)} />}
    </Frame>
  )
}

const tableGridStyle: React.CSSProperties = {
  flex: 1,
  display: 'grid',
  gridTemplateColumns: 'minmax(160px, 1fr) minmax(0, auto) minmax(160px, 1fr)',
  gridTemplateRows: 'auto 1fr auto',
  gridTemplateAreas: `
    "left   top    right"
    "left   center right"
    "bottom bottom bottom"
  `,
  gap: 12,
  padding: 12,
  minHeight: 0,
}

const selfBubbleOverlayStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 240,
  left: 0,
  right: 0,
  display: 'flex',
  justifyContent: 'center',
  pointerEvents: 'none',
  zIndex: 10,
}
