Kin Casino
==========
Thirteen casino games for play chips: Blackjack, Roulette, Craps, Baccarat, Casino War, Red Dog, Sic Bo,
Big Six money wheel, Chuck-a-Luck, Slots, Keno, Bingo and Scratch Cards. Nothing to buy, no real money.
One shared chip bank; a free refill to 1,000 whenever you run low.

Ways to play
- Solo (free): everything runs on the screen against the house, with optional computer players.
  No Kin requests, no app runs, nothing sent.
- With my Kin: your Kin takes a seat with its own chips. It is asked once when it first sits down
  (its betting style, a lucky number and a hello) and once each time you tap Talk or message it.
  Its bets and moves come from its style for free. Each ask uses Kindroid credits.
- Host or Join a table (up to 5 people; each may bring one Kin; computer players are free).
  The host's copy of this app is the table: it draws every card, die, ball, wheel stop and ticket
  with a crypto RNG and sends the table to each player's copy over the inbound trigger "table".
  Deliveries are signed with HMAC-SHA256 using the table key inside the invite code; bad, stale or
  replayed deliveries are dropped. Removing someone rotates the key.
  A Kin at a table is asked when it sits down and when someone asks it to talk or @mentions it;
  its chat lines are drafts its owner posts or discards. Hourly Kin request cap (10-80).
  Credits: no scheduled triggers. The app wakes itself only for bet/turn timers and heartbeats while a
  person used it in the last 10 minutes, and a chain of 16 self-wakes in a row ends by itself.

Rules (real casino payouts)
- Roulette: European single zero. Straight 35:1, dozens/columns 2:1, even-money 1:1.
- Craps: Pass/Don't Pass (bar 12), Pass Odds at true odds, Field (2 pays 2:1, 12 pays 3:1),
  Place 6/8 at 7:6 (in sixes), Any 7 4:1, Any Craps 7:1, Eleven 15:1.
- Baccarat: Punto Banco tableau, 8 decks. Banker 1:1 less 5%, Tie 8:1.
- Casino War: tie -> war (raise wins 1:1, first bet pushes) or surrender half; tie bet 10:1.
- Red Dog: spread 1/2/3/4+ pays 5/4/2/1:1, raise up to the bet, pair -> trips 11:1.
- Blackjack (kept simple): 6 decks, hit/stand/double, dealer stands on all 17s and peeks,
  blackjack 3:2. No split or insurance.
- Sic Bo: Small/Big/Odd/Even 1:1 (lose on triples), totals 6:1-60:1, singles 1/2/3:1, any triple 30:1.
- Big Six: 54 segments (24x1, 15x2, 7x5, 4x10, 2x20, Star, Moon) paying 1:1 up to 40:1.
- Chuck-a-Luck: 1:1, 2:1, 10:1.  Slots: about 95% return.  Keno: pick 1-10 of 80, 20 drawn.
  Bingo: 75-ball card, 30 balls, paid by lines.  Scratch: match three of nine, about 65% return.

Files: main.js (tables), screen/games.js (the 13 engines), screen/table.js (rounds, bets, turns;
shared by the screen and main.js), screen/kit.js (cards, chips, dice, symbols, sounds),
screen/stage.js (wheels, dice, dealing, reels, ball draws, scratch ticket), screen/app.js (screen).
Grants: kin:read, inbound:table, net:in.kinusercontent.com.
