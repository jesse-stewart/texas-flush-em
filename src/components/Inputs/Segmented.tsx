import { Button } from 'react95'

interface SegmentedProps<T extends string | number> {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}

// Row of inset/outset Win95 buttons acting as a single-select control.
export function Segmented<T extends string | number>({
  options, value, onChange,
}: SegmentedProps<T>) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {options.map(opt => {
        const active = opt.value === value
        return (
          <Button
            key={String(opt.value)}
            onClick={() => onChange(opt.value)}
            active={active}
            size="sm"
            style={{ minWidth: 50 }}
          >
            {opt.label}
          </Button>
        )
      })}
    </div>
  )
}
