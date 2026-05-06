# Deck Poker — Complete Rules

*A shedding game played with poker hands and personal decks.*

## Players and Equipment

- 2 to 4 players
- At least one standard 52-card deck (no jokers); see *Deal Modes* below for variants using more
- Optional: chips or stakes for gambling play

## Deal Modes

Before play begins, agree on how cards reach each player. The digital version exposes these as a setting; for tabletop play, just decide together.

- **Classic (default).** One 52-card deck, shuffled and dealt round-robin one card at a time. With remainders (e.g. 3 players → 51 ÷ 3 = 17 each + 1 extra), the extra goes to the player(s) at the start of the deal rotation. Each player ends up with roughly `52 / playerCount` cards. Multi-deck hand categories (flush pair, five of a kind, etc.) are impossible because no duplicates exist.
- **Personal.** Each player uses their own private deck (52 cards, or fewer by agreement — e.g. 30 each for a faster game). They shuffle and draw from their own deck only. Multi-deck hand categories are still impossible because no single player ever holds duplicates of the same card.
- **Mixed.** Two, three, or four 52-card decks shuffled together into one shared pool, then each player is dealt an agreed number of cards from the top (e.g. 4 decks, 2 players, 26 cards each → 52 cards dealt, 156 set aside unused). Duplicate cards across the table make the multi-deck hand categories (flush pair, flush full house, five of a kind, etc.) possible. See *Variant: Multiple Mixed Decks* below for the expanded play list.

## Setup

1. Choose the first dealer at random (cut for high card, draw straws, dice — anything fair). The dealer shuffles the deck(s).
2. Deal according to the chosen Deal Mode (above).
3. Each player keeps their dealt cards face-down as their personal **deck**.
4. Each player draws the top 10 cards from their deck.

The deal then rotates clockwise — each round, the player to the previous dealer's left becomes the new dealer.

## Terminology

- **Hand** — a single sequence of plays in the middle, starting with a lead and ending when all players have folded. Cards are cleared after each hand.
- **Fold** — decline to play this turn (also called passing). Once you fold during a hand, you're out for the rest of that hand.
- **Round** — a full deal that continues across multiple hands until one player empties their cards and wins the round.
- **Game** — the full session, ending when all but one player are out of chips or money (gambling play) or after an agreed-upon number of rounds (non-gambling play).

## Object

Win the round by being the first to empty your cards. Win the game by taking everyone else's chips.

## Turn Structure

The player to the dealer's left always takes the first turn. Play proceeds clockwise.

On your turn, in order:

1. **Discard (optional).** Place up to 5 cards from your hand face-down on the bottom of your deck.
2. **Draw.** Draw from the top of your deck until you have 10 cards, or until your deck is empty.
3. **Play or fold.**
   - **Play:** Lay down a single legal poker hand into the middle. If a hand has already been led, your play must strictly outrank the current top hand (see *Beating a Play*).
   - **Fold:** Play no cards. You're out of this hand.
4. **Replenish.** If you played, draw from the top of your deck until you have 10 cards, or until your deck is empty.

Once your deck is empty, you may no longer discard or draw. You play out the rest of the round with whatever cards you have left.

## Legal Poker Plays (Low to High)

1. Single card
2. Pair
3. Two pair (4 cards)
4. Three of a kind
5. Straight (5 cards, sequential rank, suits irrelevant; does not wrap around the Ace)
6. Flush (5 cards, same suit)
7. Full house (three of a kind plus a pair)
8. Four of a kind
9. Straight flush (5 sequential cards of the same suit; does not wrap)
10. Royal flush (10-J-Q-K-A of the same suit)

## Beating a Play

To play on top of the current top play, yours must strictly outrank it. **Ties never stand.**

- **Higher category beats lower category.** Any pair beats any single. Any three of a kind beats any two pair. And so on up the ranking.
- **Same category, higher rank wins.** A pair of 9s beats a pair of 7s. A flush is ranked by its highest card, then next-highest, and so on. Two pair is ranked by the higher pair, then the lower pair.
- **Same category and same rank — higher suit wins.** Suit order, low to high: clubs, diamonds, hearts, spades. A pair of 7s in hearts/spades beats a pair of 7s in clubs/diamonds.
- **Identical plays cannot be made.** A 7 of hearts cannot be played on a 7 of hearts. (Only relevant in the multi-deck variant.)

## Hands

A **hand** is a sequence of plays building on each other in the middle.

- If every other player folds after a play has been led, the last player to have played wins the hand. The cards in the middle are set aside out of play, and that player leads the next hand.
- If the lead player folds and every other player also folds with no play made, the hand ends with no winner. The lead passes to the next player clockwise, who starts a new hand.

Once you fold during a hand, you're done for that hand. You rejoin on the next hand.

## Ending the Round

The round ends when one player empties their cards. That player wins the round.

## Scoring

After each round, each non-winning player counts the cards remaining in their **hand** (not their deck), capped at 10. The winner counts 0. Use one of the two scoring modes below.

### Points Mode (default)

Each non-winning player adds their card count to a running cumulative score. Lower is better. Choose a target score before play (typical: 26):

- **Eliminate at target.** A player who reaches the target is out; play continues with the rest until one remains. That last player wins the game.
- **End game at target.** As soon as anyone reaches the target, the game ends. The player with the **lowest** cumulative score wins; the highest loses.

### Chips Mode (gambling variant)

Each player starts with an agreed pile of chips (default: 78). After each round, each non-winning player pays the table's chip-per-card value for every card remaining in their hand (capped at 10 cards). The round winner takes the pot. Game ends when only one player has chips left.

The **chip-per-card value** is set before play (default 6, up to 100). Higher values mean rounds swing more chips and games end faster. A loser can never go below zero — their loss is capped at their current chip balance.

## Next Round

The deal rotates clockwise — the player to the previous dealer's left deals the next round. The player to the new dealer's left goes first. (The round's winner has no special role in seating; the deal rotates regardless of who won.)

## Three-Player Note

The player to the dealer's left receives the extra 53rd card. Them's the shits.

---

# Variant: Multiple Mixed Decks

## Setup Change

Shuffle 2, 3, or 4 standard decks together as a single combined deck. Then either:

- **Deal everything** — one card at a time clockwise until exhausted; leftovers go to the player(s) at the start of the deal rotation. Each player ends up with `(decks × 52) / playerCount` cards (rounded with remainders to early seats).
- **Deal a portion** — agree on cards-per-player (e.g. 26 each with 4 decks and 2 players). Deal that many to each player from the top of the shuffled pool; set the remaining cards aside, unused for the round.

All other rules are unchanged.

## What's New

Mixing decks introduces *duplicate cards* (same rank and same suit). A "flush" version of a play means every card is the same exact suit — which, for pairs and trips, requires duplicates of the same card.

## Updated Legal Plays (Low to High)

1. Single card
2. Pair
3. Flush pair *(2 copies of the same exact card; requires 2+ decks)*
4. Two pair
5. Flush two pair *(two flush pairs of different ranks; requires 2+ decks)*
6. Three of a kind
7. Flush three of a kind *(3 copies of the same exact card; requires 3+ decks)*
8. Straight
9. Flush
10. Full house
11. Flush full house *(full house, all one suit; requires 2+ decks)*
12. Four of a kind
13. Flush four of a kind *(4 copies of the same exact card; requires 4 decks)*
14. Straight flush
15. Five of a kind *(5 cards of the same rank, mixed suits; requires 2+ decks)*
16. Royal flush

A flush five of a kind is not possible — even with 4 decks, only 4 copies of any exact card exist.

## Tie-Breaking in the Multi-Deck Game

Same rules as the base game: higher rank wins within a category, suit breaks rank ties, and an identical play cannot be made on an identical play. Plays must always strictly beat the current top play.

For five of a kind, rank alone decides — suits are mixed, so there is no suit tiebreaker. Only a higher five of a kind or a royal flush beats it.

---

# Variant: Personal Decks (The Long Fucking Game)

## Setup Change

Each player brings their own standard 52-card deck — or, by agreement, a smaller subset (e.g. 30 cards each) for a shorter game. **Use decks with visibly different backs** (different colors, designs, or brands) so cards can be sorted back to their owners at the end of the round.

Each player shuffles their own deck and draws the top 10 cards. There is no initial dealing — every player starts with their full personal deck.

For the first round, choose the first dealer at random. The player to the dealer's left goes first. The dealer role then rotates clockwise each round; the player to the new dealer's left always goes first. Play within a turn proceeds clockwise.

## What's the Same

All standard rules apply: turn structure, discard-up-to-5-to-bottom, draw to 10, play or fold, beat the current top play or fold, shedding to win, scoring by cards left.

Play categories and rankings are **identical to the single-deck base game** — no flush pairs, no five of a kind, no flush full houses. Even though there are 2-4 decks worth of cards in play across the table, no single player can ever assemble a duplicate-card play because each player only draws from their own deck.

## End of Round Cleanup

When a hand ends and cards in the middle are set aside (or at the end of the round), sort the cards by back design and return each set to its owner. This is why mismatched backs matter — without them, sorting is impossible.

## Why This Is the Variant

Each player has a 52-card deck (or close to it) instead of ~13-26 cards. Shedding all of them takes a while. The discard-to-bottom mechanic matters less because you'll rarely cycle through your full deck. Bring snacks. Pick a smaller deck size if you want a shorter session.
