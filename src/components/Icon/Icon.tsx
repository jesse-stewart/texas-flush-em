// Pixel-art icon sourced from /public/cards.png. Add new icons by registering
// them in ICON_COORDS — each entry is the (x, y) of the top-left pixel and the
// native pixel size of the icon on the sheet.

const SHEET_URL = '/icons_32_32.png'
const SHEET_W = 64
const SHEET_H = 64

interface IconCoord {
  x: number
  y: number
  size: number  // native pixel size (square icons only — the sheet uses 32×32 tiles for utility icons)
}

const ICON_COORDS = {
  printer: { x: 0,  y: 0,  size: 32 },
  close:   { x: 32, y: 0,  size: 32 },
  app:     { x: 0,  y: 32, size: 32 },
  network: { x: 32, y: 32, size: 32 },
} as const

export type IconName = keyof typeof ICON_COORDS

interface IconProps {
  name: IconName
  // Display size in CSS pixels. Defaults to the icon's native size.
  size?: number
  // Optional accessible label. When omitted, the icon is hidden from assistive tech.
  label?: string
}

export function Icon({ name, size, label }: IconProps) {
  const coord: IconCoord = ICON_COORDS[name]
  const display = size ?? coord.size
  const scale = display / coord.size

  // The inner span renders the sprite at native pixel size — every coordinate is
  // an integer so the browser doesn't have to sample between pixels (which breaks
  // `image-rendering: pixelated` and can drop the icon entirely on some browsers).
  // The outer span resizes via `transform: scale()` for the visual display size.
  return (
    <span
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{
        display: 'inline-block',
        width: display,
        height: display,
        flexShrink: 0,
        verticalAlign: 'middle',
        overflow: 'hidden',
      }}
    >
      <span
        style={{
          display: 'block',
          width: coord.size,
          height: coord.size,
          backgroundImage: `url(${SHEET_URL})`,
          backgroundSize: `${SHEET_W}px ${SHEET_H}px`,
          backgroundPosition: `-${coord.x}px -${coord.y}px`,
          backgroundRepeat: 'no-repeat',
          imageRendering: 'pixelated',
          transformOrigin: 'top left',
          transform: scale === 1 ? undefined : `scale(${scale})`,
        }}
      />
    </span>
  )
}

// Exposed so consumers can iterate (e.g. the Storybook icon catalog).
export const ICON_NAMES = Object.keys(ICON_COORDS) as IconName[]
