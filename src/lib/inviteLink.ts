export function buildInviteLink(roomId: string, password?: string): string {
  const base = `${window.location.origin}${window.location.pathname}?room=${roomId}`
  return password ? `${base}&p=${encodeURIComponent(password)}` : base
}

export function buildSpectatorLink(roomId: string, password?: string): string {
  return `${buildInviteLink(roomId, password)}&spectate=1`
}
