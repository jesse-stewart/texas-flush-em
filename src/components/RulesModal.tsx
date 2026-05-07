import { useEffect } from 'react'
import { Frame, TitleBar } from '@react95/core'
import { Button } from 'react95'
import type { GameOptions } from '@shared/engine/game-state'
import { Icon, type IconName } from './Icon/Icon'

interface RulesModalProps {
  onClose: () => void
  // When provided, the modal tailors its content to these settings: only the
  // chosen deal mode's setup, only the plays list it unlocks, only the relevant
  // scoring section, and (if applicable) the betting subsection.
  // When omitted, all variants are shown — used from screens where no game has
  // been configured yet (e.g. JoinScreen).
  options?: GameOptions
}

export function RulesModal({ onClose, options }: RulesModalProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // When options are present we render a tailored view. Otherwise fall back to
  // the generic "all variants" doc.
  const tailored = options !== undefined
  const dealMode = options?.dealMode ?? 'classic'
  const scoringMode = options?.scoringMode ?? 'points'
  const bettingEnabled = scoringMode === 'chips' && (options?.anteAmount ?? 0) > 0
  const flushVariants = dealMode === 'mixed' && (options?.mixedDeckCount ?? 1) >= 2

  return (
    <div style={backdropStyle} onClick={onClose} className="rules-print-root">
      <style>{PRINT_CSS}</style>
      <Frame
        bgColor="$material"
        boxShadow="$out"
        p="$2"
        style={{ width: '100%', maxWidth: 640, maxHeight: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="rules-no-print">
          <TitleBar
            title="Deck Poker - Rules"
            active
          >
            <TitleBar.OptionsBox>
              <TitleBar.Close onClick={onClose} />
            </TitleBar.OptionsBox>
          </TitleBar>

          {/* Toolbar — large icon buttons sit between the title bar and the content. */}
          <div style={{ display: 'flex', gap: 4, padding: '6px 4px', borderBottom: '1px solid #808080' }}>
            <ToolbarButton onClick={() => window.print()} iconName="printer" label="Print" />
            <ToolbarButton onClick={onClose} iconName="close" label="Close" />
          </div>
        </div>

        {/* Print-only header — hidden on screen, visible on paper. */}
        <h1 className="rules-print-title">Deck Poker — Rules</h1>

        <Frame
          bgColor="$inputBackground"
          boxShadow="$in"
          p="$8"
          style={{ overflowY: 'auto', flex: 1, fontSize: 12, lineHeight: 1.5 }}
          className="rules-print-content"
        >
          <Section title="Object">
            <p>
              Be the first player to empty all your cards.
              {scoringMode === 'chips'
                ? ' Win the game by taking everyone else’s chips.'
                : ' Win the game by avoiding the points target.'}
            </p>
          </Section>

          {/* ------------------ Players & Setup ------------------ */}
          {(!tailored || dealMode === 'classic') && (
            <Section title={tailored ? 'Players & Setup' : 'Players & Setup (Classic)'}>
              <ul>
                <li>2-4 players, one standard 52-card deck (no jokers)</li>
                <li>Dealer shuffles and deals the entire deck one card at a time, clockwise from their left. With 3 players, the first player gets the extra card.</li>
                <li>Each player keeps their dealt cards face-down as their personal <b>deck</b>.</li>
                <li>Each player draws the top 10 cards from their deck into their hand.</li>
              </ul>
            </Section>
          )}

          {tailored && dealMode === 'mixed' && (
            <Section title="Players & Setup (Mixed Decks)">
              <ul>
                <li>2-4 players. Shuffle <b>{options?.mixedDeckCount ?? 2}</b> standard 52-card decks together into one shared pool.</li>
                <li>Deal <b>{options?.cardsPerPlayer ?? 26}</b> cards from the top of the pool to each player, face-down. Leftover cards are set aside, unused for the round.</li>
                <li>Each player keeps their dealt cards as their personal <b>deck</b> and draws the top 10 into their hand.</li>
                <li>Duplicate cards across the table are possible — they unlock the multi-deck flush plays in the rankings below.</li>
              </ul>
            </Section>
          )}

          {tailored && dealMode === 'personal' && (
            <Section title="Players & Setup (Personal Decks)">
              <ul>
                <li>2-4 players. Each player uses their own private 52-card deck (or {options?.cardsPerPlayer ?? 52} cards by agreement).</li>
                <li><b>Use decks with visibly different backs</b> so cards can be sorted back to their owners between rounds.</li>
                <li>Each player shuffles their own deck and draws the top 10 into their hand. There is no initial dealing.</li>
                <li>No single player ever holds duplicate cards, so multi-deck flush plays are not possible.</li>
              </ul>
            </Section>
          )}

          {/* ------------------ Turn Structure ------------------ */}
          <Section title="Turn Structure">
            {bettingEnabled && (
              <p style={{ marginTop: 0 }}>
                <b>Before discard:</b> antes are auto-posted, then a betting round runs (see Betting below).
              </p>
            )}
            <p style={{ marginTop: bettingEnabled ? 4 : 0 }}>On your turn, in order:</p>
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

          {/* ------------------ Legal Plays ------------------ */}
          {flushVariants ? (
            <Section title="Legal Plays (Low to High)">
              <p style={{ marginTop: 0, marginBottom: 4 }}>Mixed-deck duplicates unlock <b>flush plays</b> — every card the exact same suit:</p>
              <ol style={rankListStyle}>
                <li>Single card</li>
                <li>Pair</li>
                <li>Flush pair <Dim>(2 identical cards; 2+ decks)</Dim></li>
                <li>Two pair</li>
                <li>Flush two pair <Dim>(2 flush pairs of different ranks; 2+ decks)</Dim></li>
                <li>Three of a kind</li>
                {(options?.mixedDeckCount ?? 0) >= 3 && (
                  <li>Flush three of a kind <Dim>(3 identical cards; 3+ decks)</Dim></li>
                )}
                <li>Straight</li>
                <li>Flush</li>
                <li>Full house</li>
                <li>Flush full house <Dim>(full house, all one suit; 2+ decks)</Dim></li>
                <li>Four of a kind</li>
                {(options?.mixedDeckCount ?? 0) >= 4 && (
                  <li>Flush four of a kind <Dim>(4 identical cards; 4 decks)</Dim></li>
                )}
                <li>Straight flush</li>
                <li>Five of a kind <Dim>(5 cards same rank, mixed suits; 2+ decks)</Dim></li>
                <li>Royal flush</li>
              </ol>
            </Section>
          ) : (
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
          )}

          <Section title="Beating a Play">
            <ul>
              <li><b>Higher category always wins.</b> Any pair beats any single card, etc.</li>
              <li><b>Same category - higher rank wins.</b> A flush ranks by its highest card, then next-highest, etc. Two pair ranks by the higher pair, then the lower.</li>
              <li><b>Same category and rank - higher suit wins.</b> Suit order low to high: clubs, diamonds, hearts, spades.</li>
              <li>Ties never stand. Identical plays cannot beat each other.</li>
            </ul>
          </Section>

          {/* ------------------ Hands & Scoring ------------------ */}
          <Section title="Hands & Scoring">
            <ul>
              <li>A <b>hand</b> ends when all but one player folds. The last player to play wins the hand, clears the middle, and leads next.</li>
              <li>If the lead player and everyone else folds with no play made, the hand ends with no winner and the lead passes clockwise.</li>
              <li>The <b>round</b> ends when one player empties all their cards. That player wins and {scoringMode === 'chips' ? 'collects from the losers' : 'scores 0'}.</li>
              <li>Non-winners count cards remaining in their <b>hand</b> (not deck), capped at 10.</li>
            </ul>

            {(!tailored || scoringMode === 'points') && (
              <>
                <p style={{ marginTop: 8, marginBottom: 4 }}><b>{tailored ? 'Scoring' : 'Points Mode'}</b></p>
                <p style={{ margin: 0 }}>
                  Each non-winner adds their card count to a running cumulative score (lower is better). Target:{' '}
                  <b>{tailored ? options?.threshold : 26}</b>.{' '}
                  {(!tailored || options?.pointsThresholdAction === 'eliminate')
                    ? <span><b>Eliminate at target:</b> a player who reaches the target is out; play continues with the rest until one remains.</span>
                    : <span><b>End game at target:</b> as soon as anyone reaches the target the game ends; the player with the lowest cumulative score wins.</span>}
                </p>
              </>
            )}

            {(!tailored || scoringMode === 'chips') && (
              <>
                <p style={{ marginTop: 8, marginBottom: 4 }}><b>{tailored ? 'Scoring' : 'Chips Mode'}</b></p>
                <p style={{ margin: 0 }}>
                  Each player starts with <b>${tailored ? options?.threshold : 60}</b>. After each round, every non-winner pays the round winner <b>${tailored ? options?.chipValuePerCard : 5}</b> per card remaining in their hand (capped at 10). A loser&apos;s payment is capped at their current chip balance — chips can&apos;t go negative. The game ends when only one player has chips left.
                </p>
              </>
            )}
          </Section>

          {/* ------------------ Betting (chips mode + ante > 0) ------------------ */}
          {(bettingEnabled || !tailored) && (
            <Section title={tailored ? `Betting (Ante $${options?.anteAmount})` : 'Betting (Chips Mode + Ante)'}>
              <p style={{ marginTop: 0 }}>
                {tailored
                  ? <>An <b>ante of ${options?.anteAmount}</b> is auto-posted by every active player at the start of every hand. Antes plus any bets/calls/raises form a <b>hand pot</b>, paid to the hand winner. The round-end chips-per-card transfer still happens on top.</>
                  : <>If chips mode is played with a non-zero ante, every player auto-posts the ante at the start of every hand. Antes plus any bets/calls/raises form a hand pot paid to the hand winner; the round-end chips-per-card transfer still happens on top.</>}
              </p>
              <p style={{ marginTop: 6, marginBottom: 4 }}><b>Betting round (clockwise from dealer&apos;s left):</b></p>
              <ul>
                <li><b>Check</b> — pass without putting more in. Only legal when nobody has bet beyond the ante yet.</li>
                <li><b>Bet</b> — open the betting (minimum: one ante).</li>
                <li><b>Call</b> — match the current bet-to-match. If short, you go all-in for what you have.</li>
                <li><b>Raise</b> — increase the bet-to-match (by at least the previous bet/raise size, or all-in for less).</li>
                <li><b>Fold</b> — give up the hand. Chips already committed stay in the pot.</li>
              </ul>
              <p style={{ marginTop: 6 }}>
                The round ends once every non-folded, non-all-in player has acted since the last bet/raise and either matched or gone all-in. After that, the hand proceeds to the normal discard → play sequence.
              </p>
              <p style={{ marginTop: 6 }}>
                <b>All-in / side pots.</b> If a player goes all-in for less than the current bet-to-match, the pot splits into tiers — each tier contested only by the players who paid into it. Short stacks can only win up to what they put in.
              </p>
              <p style={{ marginTop: 6 }}>
                <b>Fold to one.</b> If everyone but one player folds during betting, that player wins the entire pot uncontested and the hand ends without a discard or play phase.
              </p>
            </Section>
          )}

          {/* ------------------ Variants (only shown in generic view) ------------------ */}
          {!tailored && (
            <>
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
            </>
          )}
        </Frame>

      </Frame>
    </div>
  )
}

// Large icon-over-label button used in the modal's top toolbar. Pass either a
// registered sprite icon name or a glyph string to draw above the label.
function ToolbarButton({
  onClick,
  iconName,
  glyph,
  label,
}: {
  onClick: () => void
  iconName?: IconName
  glyph?: string
  label: string
}) {
  return (
    <Button onClick={onClick} style={{ width: 64, height: 56, padding: 0 }}>
      <span style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        lineHeight: 1,
      }}>
        {iconName ? (
          <Icon name={iconName} size={32} />
        ) : (
          <span style={{ fontSize: 22, fontWeight: 700, color: '#000', lineHeight: 1 }}>{glyph}</span>
        )}
        <span style={{ fontSize: 11 }}>{label}</span>
      </span>
    </Button>
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

// Print stylesheet. Scoped via the .rules-print-root class so it only triggers
// when this modal is mounted. Hides everything outside the modal, drops the
// Win95 chrome, and renders the content as a plain printable document.
const PRINT_CSS = `
.rules-print-title { display: none; }

@media print {
  body * { visibility: hidden; }
  .rules-print-root, .rules-print-root * { visibility: visible; }
  .rules-no-print { display: none !important; }

  .rules-print-root {
    position: absolute !important;
    inset: 0 !important;
    background: white !important;
    padding: 0 !important;
    box-shadow: none !important;
    overflow: visible !important;
    height: auto !important;
    max-height: none !important;
  }
  /* Flatten the Win95 chrome — drop drop-shadows, borders, fixed sizes. */
  .rules-print-root > * {
    background: white !important;
    box-shadow: none !important;
    max-height: none !important;
    max-width: none !important;
    padding: 0 !important;
  }
  .rules-print-content {
    background: white !important;
    box-shadow: none !important;
    overflow: visible !important;
    max-height: none !important;
    height: auto !important;
    padding: 0 !important;
    font-size: 11pt !important;
    line-height: 1.4 !important;
    color: black !important;
  }
  .rules-print-title {
    display: block !important;
    visibility: visible !important;
    font-size: 18pt;
    font-weight: 700;
    margin: 0 0 12px;
    border-bottom: 1px solid #000;
    padding-bottom: 4px;
  }
  .rules-print-root h3 {
    color: black !important;
    font-size: 12pt !important;
    page-break-after: avoid;
  }
  .rules-print-root section {
    page-break-inside: avoid;
  }
  .rules-print-root a { color: black !important; text-decoration: none !important; }
  /* Avoid clipping in browsers that compute overflow on the modal Frame. */
  .rules-print-root, .rules-print-content { display: block !important; }
}
`

