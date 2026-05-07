import type { CSSProperties } from 'react'

export type ChipDenom = 1 | 5 | 10 | 25 | 100
export type ChipSize = 18 | 36

const DENOM_COL: Record<ChipDenom, number> = {
  1:   0,
  5:   1,
  10:  2,
  25:  3,
  100: 4,
}

const SHEETS: Record<ChipSize, { url: string; w: number; h: number }> = {
  18: { url: '/chips-mini_18_18.png', w: 90,  h: 36 },
  36: { url: '/chips_36_36.png',      w: 180, h: 72 },
}

interface ChipProps {
  denom: ChipDenom
  size?: ChipSize
  variant?: 0 | 1
  style?: CSSProperties
}

// Single chip sprite, rendered 1:1 from the matching sheet — no scaling.
export function Chip({ denom, size = 36, variant = 0, style }: ChipProps) {
  const sheet = SHEETS[size]
  return (
    <span
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        backgroundImage: `url(${sheet.url})`,
        backgroundSize: `${sheet.w}px ${sheet.h}px`,
        backgroundPosition: `-${DENOM_COL[denom] * size}px -${variant * size}px`,
        backgroundRepeat: 'no-repeat',
        imageRendering: 'pixelated',
        verticalAlign: 'middle',
        ...style,
      }}
    />
  )
}
