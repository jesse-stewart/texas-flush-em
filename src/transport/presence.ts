// Ephemeral UI presence — bypasses the game state machine entirely.
// The server relays these to other clients without touching GameState.

export interface PlayerPresence {
  handOrder: number[]         // stable slot IDs in current display order
  selectedPositions: number[] // which display positions (indices into handOrder) are raised
}

// Raw shape of a PRESENCE message received from the server
export interface PresenceEvent {
  type: 'PRESENCE'
  playerId: string
  handOrder: number[]
  selectedPositions: number[]
}

export function isPresenceEvent(event: { type: string }): event is PresenceEvent {
  return event.type === 'PRESENCE'
}
