import { useEffect } from 'react'
import { Frame, TitleBar } from '@react95/core'
import { Button } from 'react95'

interface RulesModalProps {
  onClose: () => void
}

export function RulesModal({ onClose }: RulesModalProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div style={backdropStyle} onClick={onClose}>
      <Frame
        bgColor="$material"
        boxShadow="$out"
        p="$2"
        style={{ width: '100%', maxWidth: 640, maxHeight: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}
      >
        <TitleBar
          title="Deck Poker - Rules"
          active
        >
          <TitleBar.OptionsBox>
            <TitleBar.Close onClick={onClose} />
          </TitleBar.OptionsBox>
        </TitleBar>

        <Frame
          bgColor="$inputBackground"
          boxShadow="$in"
          p="$8"
          style={{ overflowY: 'auto', flex: 1, fontSize: 12, lineHeight: 1.5 }}
        >
          <Section title="Object">
            <p>Be the first player to empty all your cards. Win the game by taking everyone else&apos;s chips.</p>
          </Section>

          <Section title="Players & Setup">
            <ul>
              <li>2-4 players, one standard 52-card deck (no jokers)</li>
              <li>Dealer shuffles and deals the entire deck one card at a time, clockwise from their left. With 3 players, the first player gets the extra card.</li>
              <li>Each player keeps their dealt cards face-down as their personal <b>deck</b>.</li>
              <li>Each player draws the top 10 cards from their deck into their hand.</li>
            </ul>
          </Section>

          <Section title="Turn Structure">
            <p>On your turn, in order:</p>
            <ol>
              <li><b>Discard (optional).</b> Place up to 5 cards face-down on the bottom of your deck.</li>
              <li><b>Draw.</b> Draw from the top of your deck until you have 10 cards, or until your deck is empty.</li>
              <li><b>Play or fold.</b>
                <ul style={{ marginTop: 4 }}>
                  <li><b>Play:</b> Lay down a legal poker hand. If someone has already played this hand, yours must strictly outrank it.</li>
                  <li><b>Fold:</b> Pass. You&apos;re out of this hand.</li>
                </ul>
              </li>
              <li><b>Replenish.</b> If you played, draw back up to 10 cards.</li>
            </ol>
            <p style={{ color: '#444', fontSize: 11 }}>Once your deck is empty you can no longer discard or draw - play out the round with what you have.</p>
          </Section>

          <Section title="Legal Plays (Low to High)">
            <ol style={rankListStyle}>
              <li>Single card</li>
              <li>Pair</li>
              <li>Two pair <Dim>(4 cards)</Dim></li>
              <li>Three of a kind</li>
              <li>Straight <Dim>(5 sequential cards, any suits; Ace does not wrap)</Dim></li>
              <li>Flush <Dim>(5 cards, same suit)</Dim></li>
              <li>Full house <Dim>(three of a kind + a pair)</Dim></li>
              <li>Four of a kind</li>
              <li>Straight flush <Dim>(5 sequential, same suit)</Dim></li>
              <li>Royal flush <Dim>(10-J-Q-K-A, same suit)</Dim></li>
            </ol>
          </Section>

          <Section title="Beating a Play">
            <ul>
              <li><b>Higher category always wins.</b> Any pair beats any single card, etc.</li>
              <li><b>Same category - higher rank wins.</b> A flush ranks by its highest card, then next-highest, etc. Two pair ranks by the higher pair, then the lower.</li>
              <li><b>Same category and rank - higher suit wins.</b> Suit order low to high: clubs, diamonds, hearts, spades.</li>
              <li>Ties never stand. Identical plays cannot beat each other.</li>
            </ul>
          </Section>

          <Section title="Hands & Scoring">
            <ul>
              <li>A <b>hand</b> ends when all but one player folds. The last player to play wins the hand, clears the middle, and leads next.</li>
              <li>If the lead player and everyone else folds with no play made, the hand ends with no winner and the lead passes clockwise.</li>
              <li>The <b>round</b> ends when one player empties all their cards. That player wins and scores 0.</li>
              <li>Non-winners score points equal to cards remaining in their <b>hand</b> (not deck), capped at 10. Lower is better.</li>
            </ul>
          </Section>

          <Divider />

          <Section title="Variant: Multiple Mixed Decks">
            <p>Shuffle 2-4 standard decks together. Deal one card at a time clockwise until all cards are dealt. Duplicate cards (same rank and suit) unlock <b>flush plays</b> - every card the exact same suit.</p>
            <p style={{ marginBottom: 4 }}>Updated ranking inserts flush plays at their correct positions:</p>
            <ol style={rankListStyle}>
              <li>Single card</li>
              <li>Pair</li>
              <li>Flush pair <Dim>(2 identical cards; 2+ decks)</Dim></li>
              <li>Two pair</li>
              <li>Flush two pair <Dim>(2 flush pairs of different ranks; 2+ decks)</Dim></li>
              <li>Three of a kind</li>
              <li>Flush three of a kind <Dim>(3 identical cards; 3+ decks)</Dim></li>
              <li>Straight</li>
              <li>Flush</li>
              <li>Full house</li>
              <li>Flush full house <Dim>(full house, all one suit; 2+ decks)</Dim></li>
              <li>Four of a kind</li>
              <li>Flush four of a kind <Dim>(4 identical cards; 4 decks)</Dim></li>
              <li>Straight flush</li>
              <li>Five of a kind <Dim>(5 cards same rank, mixed suits; 2+ decks)</Dim></li>
              <li>Royal flush</li>
            </ol>
          </Section>

          <Divider />

          <Section title="Variant: Personal Decks (The Long Game)">
            <p>Each player brings their own 52-card deck. <b>Use decks with visibly different backs</b> so cards can be sorted back to their owners.</p>
            <p>Each player shuffles their own deck and draws the top 10 cards. No initial dealing - everyone starts with a full 52-card personal deck.</p>
            <p>Play categories are <b>identical to the single-deck base game</b> - no flush pairs, no five of a kind, because each player only draws from their own deck.</p>
          </Section>
        </Frame>

        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 4px 0' }}>
          <Button onClick={onClose} style={{ minWidth: 75 }}>OK</Button>
        </div>
      </Frame>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 16 }}>
      <h3 style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700, color: '#000080' }}>
        {title}
      </h3>
      <div>{children}</div>
    </section>
  )
}

function Dim({ children }: { children: React.ReactNode }) {
  return <span style={{ color: '#666', fontWeight: 400 }}>{children}</span>
}

function Divider() {
  return <hr style={{ border: 'none', borderTop: '1px solid #888', borderBottom: '1px solid #fff', margin: '8px 0 16px' }} />
}

const backdropStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 200,
  backgroundColor: 'rgba(0,0,0,0.4)',
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  padding: '40px 16px',
}

const rankListStyle: React.CSSProperties = {
  margin: 0,
  paddingLeft: 20,
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
}
