// Ephemeral UI presence — bypasses the game state machine entirely.
// The server relays these to other clients without touching GameState.

export interface PlayerPresence {
  handOrder: number[]         // stable slot IDs in current display order
  selectedPositions: number[] // which display positions (indices into handOrder) are raised
  bettingTarget?: number      // chips staged for bet/raise this turn, not yet committed
}

// Outbound: client → server. Wire format for "I'm rearranging cards / changing selection."
export interface PresenceClientMessage {
  type: 'PRESENCE'
  handOrder: number[]
  selectedPositions: number[]
  bettingTarget?: number
}

// Inbound: server → client. The server tags the originating player and re-broadcasts.
export interface PresenceServerEvent extends PresenceClientMessage {
  playerId: string
}

export function isPresenceEvent(event: { type: string }): event is PresenceServerEvent {
  return event.type === 'PRESENCE'
}
