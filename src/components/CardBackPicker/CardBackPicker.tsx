import { useEffect, useState } from 'react'
import { Frame, TitleBar, Button } from '@react95/core'
import { CARD_BACKS } from '../../cardBacks'
import { CardBackVisual } from '../Card/Card'
import { useCardBackId, useSetCardBackId } from '../../contexts/CardBackContext'

interface CardBackPickerProps {
  onClose: () => void
}

const PREVIEW_W = 64
const PREVIEW_H = 90

export function CardBackPicker({ onClose }: CardBackPickerProps) {
  const current = useCardBackId()
  const setCardBackId = useSetCardBackId()
  const [draft, setDraft] = useState(current)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'Enter') { setCardBackId(draft); onClose() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [draft, onClose, setCardBackId])

  function ok() {
    setCardBackId(draft)
    onClose()
  }

  return (
    <div style={backdropStyle} onClick={onClose}>
      <Frame
        bgColor="$material"
        boxShadow="$out"
        p="$2"
        style={{ width: 'min(560px, calc(100vw - 32px))' }}
        onClick={e => e.stopPropagation()}
      >
        <TitleBar title="Select Card Back" active>
          <TitleBar.OptionsBox>
            <TitleBar.Close onClick={onClose} />
          </TitleBar.OptionsBox>
        </TitleBar>

        <Frame
          bgColor="$material"
          boxShadow="$in"
          p="$8"
          style={{ marginTop: 4 }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(6, 1fr)',
              gap: 8,
              justifyItems: 'center',
            }}
          >
            {CARD_BACKS.map(back => {
              const isSelected = back.id === draft
              return (
                <button
                  key={back.id}
                  onClick={() => setDraft(back.id)}
                  onDoubleClick={() => { setCardBackId(back.id); onClose() }}
                  title={back.label}
                  aria-label={back.label}
                  aria-pressed={isSelected}
                  style={{
                    padding: 4,
                    background: 'transparent',
                    border: isSelected ? '2px solid #000080' : '2px solid transparent',
                    cursor: 'pointer',
                    lineHeight: 0,
                  }}
                >
                  <CardBackVisual backId={back.id} width={PREVIEW_W} height={PREVIEW_H} />
                </button>
              )
            })}
          </div>
        </Frame>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, padding: '8px 4px 0' }}>
          <Button onClick={ok} style={{ minWidth: 75 }}>OK</Button>
          <Button onClick={onClose} style={{ minWidth: 75 }}>Cancel</Button>
        </div>
      </Frame>
    </div>
  )
}

const backdropStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 200,
  backgroundColor: 'rgba(0,0,0,0.4)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '40px 16px',
}
