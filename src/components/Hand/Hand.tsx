import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import type { Card } from '@shared/engine/card'
import { Card as CardComponent } from '../Card/Card'

// ─── Layout constants ─────────────────────────────────────────────────────────

const CARD_STEP            = 22         // px between adjacent card left edges
const CARD_OVERLAP         = 80 - CARD_STEP   // default (opponent hands)

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function cardKey(card: Card): string {
  return `${card.rank}-${card.suit}`
}

// ─── SortableCard ─────────────────────────────────────────────────────────────

function SortableCard({
  id, card, selected, disabled, faceDown, flip, onToggle, pos, overlap,
}: {
  id: string
  card: Card
  selected: boolean
  disabled: boolean
  faceDown: boolean
  flip: boolean
  onToggle: () => void
  pos: number
  overlap: number
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const [hovered, setHovered] = useState(false)

  const liftY = selected ? (flip ? 14 : -14) : hovered && !disabled ? (flip ? 8 : -8) : 0

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0 : 1,
        flexShrink: 0,
        marginRight: -overlap,
        cursor: disabled ? 'default' : 'grab',
        zIndex: isDragging ? 999 : pos,
      }}
    >
      <div style={{
        transform: `translateY(${liftY}px) rotateX(${flip ? 180 : 0}deg))`,
        transition: 'transform 0.12s ease',
      }}>
        <motion.div
          layoutId={id}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
          <CardComponent
            card={card}
            faceDown={faceDown}
            selected={selected}
            onClick={disabled ? undefined : onToggle}
          />
        </motion.div>
      </div>
    </div>
  )
}

// ─── Hand ─────────────────────────────────────────────────────────────────────

interface HandProps {
  cards: Card[]
  ids?: string[]                  // dnd-kit + React key IDs (one per card; required for duplicate-card disambiguation)
  selectedIndices: number[]       // positions in `cards` that are currently selected
  onToggle: (index: number) => void
  onReorder?: (newOrder: Card[]) => void
  disabled?: boolean
  faceDown?: boolean
  flip?: boolean
  overlap?: number
}

export function Hand({
  cards, ids, selectedIndices, onToggle, onReorder, disabled = false, faceDown = false,
  flip = false, overlap = CARD_OVERLAP,
}: HandProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  const itemIds = cards.map((c, i) => ids?.[i] ?? cardKey(c))
  const selectedSet = new Set(selectedIndices)

  function handleDragStart(e: DragStartEvent) {
    const idx = itemIds.indexOf(e.active.id as string)
    setActiveIndex(idx >= 0 ? idx : null)
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    setActiveIndex(null)
    if (!over || active.id === over.id) return
    const from = itemIds.indexOf(active.id as string)
    const to   = itemIds.indexOf(over.id as string)
    onReorder?.(arrayMove(cards, from, to))
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <SortableContext items={itemIds} strategy={horizontalListSortingStrategy}>
        <div style={styles.row}>
          <AnimatePresence mode="popLayout">
            {cards.map((card, i) => (
              <SortableCard
                key={itemIds[i]}
                id={itemIds[i]}
                card={card}
                selected={selectedSet.has(i)}
                disabled={disabled}
                faceDown={faceDown}
                flip={flip}
                onToggle={() => onToggle(i)}
                pos={i}
                overlap={overlap}
              />
            ))}
          </AnimatePresence>
          {cards.length === 0 && (
            <span style={styles.empty}>No cards — hand is empty.</span>
          )}
        </div>
      </SortableContext>

      <DragOverlay>
        {activeIndex !== null && cards[activeIndex] && (
          <div style={{ opacity: 0.95, cursor: 'grabbing' }}>
            <CardComponent card={cards[activeIndex]} faceDown={faceDown} selected={selectedSet.has(activeIndex)} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

const styles: Record<string, React.CSSProperties> = {
  row: {
    display: 'flex',
    flexWrap: 'nowrap',
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingTop: 60,
    overflow: 'visible',
  },
  empty: {
    color: '#6b7280',
    fontSize: 14,
    fontStyle: 'italic',
    padding: '16px 0',
  },
}
