import { useEffect, useRef, useState } from 'react'
import { TextInput } from 'react95'

interface NumberStepperProps {
  value: number
  min: number
  max?: number
  onChange: (v: number) => void
  width?: number
  prefix?: string
}

// Typed-in number entry. Uses an internal string draft so the user can clear the field
// and type freely; the parent only sees clamped numeric values.
export function NumberStepper({
  value, min, max, onChange, width = 90, prefix,
}: NumberStepperProps) {
  const [draft, setDraft] = useState(String(value))
  const lastCommittedRef = useRef(value)
  useEffect(() => {
    if (value !== lastCommittedRef.current) {
      lastCommittedRef.current = value
      setDraft(String(value))
    }
  }, [value])

  function clamp(n: number): number {
    let v = n
    if (v < min) v = min
    if (max !== undefined && v > max) v = max
    return v
  }

  function commit(text: string) {
    const parsed = parseInt(text, 10)
    const next = Number.isFinite(parsed) ? clamp(parsed) : clamp(value)
    lastCommittedRef.current = next
    setDraft(String(next))
    if (next !== value) onChange(next)
  }

  const input = (
    <TextInput
      type="text"
      inputMode="numeric"
      value={draft}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
        const v = e.target.value
        if (/^-?\d*$/.test(v)) {
          setDraft(v)
          const parsed = parseInt(v, 10)
          if (Number.isFinite(parsed)) {
            const clamped = clamp(parsed)
            if (clamped !== value) onChange(clamped)
          }
        }
      }}
      onBlur={() => commit(draft)}
      onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
      }}
      style={{ width: prefix ? Math.max(40, width - 14) : width, textAlign: 'right' }}
    />
  )

  if (prefix) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <span>{prefix}</span>
        {input}
      </span>
    )
  }
  return input
}
