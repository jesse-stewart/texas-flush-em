// ============================================================
// Move generator for the bot. Pure functions, zero framework deps.
// Enumerates all legal poker hands from a set of held cards, plus
// picks a sensible discard. ISMCTS uses these to build its action space.
// ============================================================

import type { Card, Rank } from './card'
import { rankValue, RANKS } from './card'
import { evaluateHand, beats } from './hand-eval'
import type { EvaluatedHand } from './hand-eval'

// ============================================================
// Plays — enumerate every legal poker hand from a set of cards,
// optionally filtered to those that beat the current top play.
// ============================================================

export function generatePlays(hand: Card[], currentTopPlay: EvaluatedHand | null): EvaluatedHand[] {
  const result: EvaluatedHand[] = []
  const seenKeys = new Set<string>()

  const tryAdd = (cards: Card[]) => {
    const h = evaluateHand(cards)
    if (!h) return
    if (currentTopPlay && !beats(h, currentTopPlay)) return
    const key = playKey(cards)
    if (seenKeys.has(key)) return
    seenKeys.add(key)
    result.push(h)
  }

  // Group by rank and by suit
  const byRank = new Map<Rank, Card[]>()
  const bySuit = new Map<string, Card[]>()
  for (const c of hand) {
    const r = byRank.get(c.rank) ?? []
    r.push(c); byRank.set(c.rank, r)
    const s = bySuit.get(c.suit) ?? []
    s.push(c); bySuit.set(c.suit, s)
  }

  // Singles — one per distinct (rank, suit) pair (multi-deck duplicates collapse)
  const singleSeen = new Set<string>()
  for (const c of hand) {
    const k = `${c.rank}|${c.suit}`
    if (singleSeen.has(k)) continue
    singleSeen.add(k)
    tryAdd([c])
  }

  // Pairs (any two of same rank — covers PAIR and FLUSH_PAIR)
  for (const g of byRank.values()) {
    if (g.length < 2) continue
    for (const combo of combinations(g, 2)) tryAdd(combo)
  }

  // Three of a kind
  for (const g of byRank.values()) {
    if (g.length < 3) continue
    for (const combo of combinations(g, 3)) tryAdd(combo)
  }

  // Two pair
  const pairableRanks = [...byRank.values()].filter(g => g.length >= 2)
  for (let a = 0; a < pairableRanks.length; a++) {
    for (let b = a + 1; b < pairableRanks.length; b++) {
      const ga = pairableRanks[a], gb = pairableRanks[b]
      for (const ca of combinations(ga, 2))
        for (const cb of combinations(gb, 2))
          tryAdd([...ca, ...cb])
    }
  }

  // Four of a kind
  for (const g of byRank.values()) {
    if (g.length < 4) continue
    for (const combo of combinations(g, 4)) tryAdd(combo)
  }

  // Five of a kind (multi-deck only)
  for (const g of byRank.values()) {
    if (g.length < 5) continue
    for (const combo of combinations(g, 5)) tryAdd(combo)
  }

  // Full house (triple of rank A + pair of rank B, A ≠ B)
  for (const [rA, gA] of byRank) {
    if (gA.length < 3) continue
    for (const [rB, gB] of byRank) {
      if (rA === rB || gB.length < 2) continue
      for (const triple of combinations(gA, 3))
        for (const pair of combinations(gB, 2))
          tryAdd([...triple, ...pair])
    }
  }

  // Straights — pick one card per rank across 5 consecutive ranks
  const ranksPresent = RANKS.filter(r => byRank.has(r))
  for (let i = 0; i + 4 < ranksPresent.length; i++) {
    let ok = true
    for (let j = 1; j < 5; j++) {
      if (rankValue(ranksPresent[i + j]) - rankValue(ranksPresent[i + j - 1]) !== 1) { ok = false; break }
    }
    if (!ok) continue
    const choices = ranksPresent.slice(i, i + 5).map(r => byRank.get(r)!)
    enumerateProduct(choices, combo => tryAdd(combo))
  }

  // Flushes — any 5 same-suit cards (covers FLUSH, STRAIGHT_FLUSH, ROYAL_FLUSH, FLUSH_FULL_HOUSE)
  for (const g of bySuit.values()) {
    if (g.length < 5) continue
    for (const combo of combinations(g, 5)) tryAdd(combo)
  }

  return result
}

// Stable identity for a played-card set, regardless of card ordering
function playKey(cards: Card[]): string {
  return cards
    .map(c => `${c.rank}${c.suit}`)
    .sort()
    .join('|')
}

function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]]
  if (arr.length < k) return []
  const out: T[][] = []
  const cur: T[] = []
  function rec(start: number) {
    if (cur.length === k) { out.push([...cur]); return }
    const need = k - cur.length
    for (let i = start; i <= arr.length - need; i++) {
      cur.push(arr[i]); rec(i + 1); cur.pop()
    }
  }
  rec(0)
  return out
}

function enumerateProduct(choices: Card[][], cb: (combo: Card[]) => void) {
  const idx = new Array(choices.length).fill(0)
  while (true) {
    cb(idx.map((i, k) => choices[k][i]))
    let pos = choices.length - 1
    while (pos >= 0 && idx[pos] === choices[pos].length - 1) { idx[pos] = 0; pos-- }
    if (pos < 0) break
    idx[pos]++
  }
}

// ============================================================
// Discards — score every card by how worth keeping it is, then
// drop the N lowest. "Keep" considers pair/trip/quad/quint membership,
// flush membership, straight contribution, and rank.
// ============================================================

export function chooseDiscard(
  hand: Card[],
  deckSize: number,
  reservedForPlay: Card[],
  count: number,
): Card[] {
  if (deckSize === 0) return []
  if (count <= 0) return []
  const reservedKeys = new Set(reservedForPlay.map(c => `${c.rank}|${c.suit}`))
  const candidates = hand.filter(c => !reservedKeys.has(`${c.rank}|${c.suit}`))
  if (candidates.length === 0) return []

  const scores = scoreKeeping(hand)

  // Sort candidates by score ascending (worst first)
  const sorted = [...candidates].sort((a, b) => {
    const sa = scores.get(cardId(a)) ?? 0
    const sb = scores.get(cardId(b)) ?? 0
    if (sa !== sb) return sa - sb
    return rankValue(a.rank) - rankValue(b.rank)
  })
  return sorted.slice(0, Math.min(count, sorted.length))
}

function cardId(c: Card): string { return `${c.rank}|${c.suit}` }

// Keep-score per card, higher = keep. Computed once over the whole hand.
function scoreKeeping(hand: Card[]): Map<string, number> {
  const scores = new Map<string, number>()

  const byRank = new Map<Rank, Card[]>()
  const bySuit = new Map<string, Card[]>()
  for (const c of hand) {
    const r = byRank.get(c.rank) ?? []; r.push(c); byRank.set(c.rank, r)
    const s = bySuit.get(c.suit) ?? []; s.push(c); bySuit.set(c.suit, s)
  }

  for (const c of hand) {
    let s = rankValue(c.rank) * 0.1   // baseline: prefer holding higher cards
    const rg = byRank.get(c.rank)!.length
    if (rg >= 5) s += 20                // five of a kind
    else if (rg === 4) s += 12          // four of a kind
    else if (rg === 3) s += 6           // trips
    else if (rg === 2) s += 3           // pair

    const sg = bySuit.get(c.suit)!.length
    if (sg >= 5) s += 5                 // already a flush
    else if (sg === 4) s += 2           // one card off

    // Straight contribution: count cards within ±2 ranks (rough proxy for adjacency)
    const rv = rankValue(c.rank)
    let neighbors = 0
    for (const o of hand) {
      if (o === c) continue
      const d = Math.abs(rankValue(o.rank) - rv)
      if (d >= 1 && d <= 4) neighbors++
    }
    if (neighbors >= 4) s += 2          // possible straight
    else if (neighbors >= 3) s += 1

    scores.set(cardId(c), s)
  }
  return scores
}
