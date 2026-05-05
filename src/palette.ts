// 8-bit (256-color) palette. Every value is either a web-safe cube color
// (each channel in {0x00, 0x33, 0x66, 0x99, 0xCC, 0xFF}) or one of the 20
// Win95 reserved system colors (#000080, #008080, #C0C0C0, #808080, ...).
//
// react95's framework chrome (Frame, Button, TitleBar) renders in slightly
// off-palette values that ship with the library. We accept that and only
// constrain colors *we* introduce via inline styles. When something is meant
// to match the framework chrome (e.g. a panel bg matching `material`), use
// `contract.colors.*` directly instead of a token here.
//
// Translucent overlays kept as raw `rgba(...)` literals — alpha compositing
// is a separate axis from the static palette.

export const palette = {
  // Greys
  black:    '#000000',
  vdkGray:  '#333333',
  dkGray:   '#666666',
  gray:     '#808080', // Win95 system "dark gray"
  midGray:  '#999999',
  silver:   '#c0c0c0', // Win95 system "light gray"
  ltGray:   '#cccccc',
  white:    '#ffffff',

  // Hues
  navy:     '#000080', // Win95 system "navy" — used for headings, accents
  blue:     '#0000ff', // Win95 system "blue" — used for selected-card ring
  teal:     '#008080', // Win95 system "teal" — desktop background
  lime:     '#00ff00', // Win95 system "green" — online dot

  // Game roles (felt + status)
  felt:         '#006600', // green felt
  win:          '#009900', // positive deltas, "winner" badge
  lose:         '#990000', // negative deltas, error text, "your turn" prompt
  dealerYellow: '#ffff99', // dealer chip

  // Bot difficulty badges (easy reuses navy, hard reuses lose)
  botMedium: '#660066',

  // Action-bar hint colors (on green felt)
  hintGood: '#99ff99', // valid play / beats current
  hintBad:  '#ff9999', // invalid / doesn't beat

  // Event bubbles
  bubblePosBg:    '#ccffcc',
  bubblePosText:  '#003300',
  bubbleNegBg:    '#ffcccc',
  bubbleNegText:  '#330000',
} as const
