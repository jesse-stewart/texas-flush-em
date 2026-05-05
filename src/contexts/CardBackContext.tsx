import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { CARD_BACK_BY_ID, DEFAULT_CARD_BACK_ID } from '../cardBacks'

const STORAGE_KEY = 'flushem_card_back'

interface CardBackContextValue {
  cardBackId: string
  setCardBackId: (id: string) => void
}

const CardBackContext = createContext<CardBackContextValue | null>(null)

function loadStored(): string {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw && CARD_BACK_BY_ID[raw]) return raw
  } catch { /* private mode */ }
  return DEFAULT_CARD_BACK_ID
}

export function CardBackProvider({ children }: { children: React.ReactNode }) {
  const [cardBackId, setCardBackIdState] = useState<string>(loadStored)

  const setCardBackId = useCallback((id: string) => {
    if (!CARD_BACK_BY_ID[id]) return
    setCardBackIdState(id)
  }, [])

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, cardBackId) } catch { /* quota */ }
  }, [cardBackId])

  return (
    <CardBackContext.Provider value={{ cardBackId, setCardBackId }}>
      {children}
    </CardBackContext.Provider>
  )
}

export function useCardBackId(): string {
  const ctx = useContext(CardBackContext)
  return ctx?.cardBackId ?? DEFAULT_CARD_BACK_ID
}

export function useSetCardBackId(): (id: string) => void {
  const ctx = useContext(CardBackContext)
  return ctx?.setCardBackId ?? (() => {})
}
