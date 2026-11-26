Kin Hold'em

No-limit Texas Hold'em for play chips (no value, nothing to buy). Felt table, drawn cards and chips, animated dealing, sounds made with Web Audio, a hand-strength hint toggle, keyboard controls (F fold, C check/call, R raise then Enter, A all-in, N next hand, H hint, M sound, T chat) and reduced-motion support.

Four ways to play (the menu says which cost credits)
- Solo (FREE, no credits): you against 1 to 5 computer players on one screen, with Easy, Normal or Hard play and styles (tight, loose, aggressive, calling station, balanced). It runs entirely inside the screen (screen/solo.js, screen/bots.js): no Kin, no app run, no file, no message to Kindroid. Nothing here can use credits.
- Host a table (uses credits): up to five people. No server: the host's copy of the app is the table. It shuffles (cryptographic random, Fisher-Yates), deals, keeps every hand and does the pot maths, so it holds every card: play with people you trust. Guests join with the invite code and the host admits each one. Every delivery is signed with the table key inside the invite code and checked on arrival (bad, stale or replayed ones are dropped). Each person is sent only their own two cards; everyone else's stay hidden until showdown. A turn timer folds (or checks) for someone who is away. People can leave and rejoin; a leaver folds and gives up the seat.
- Empty seats can be filled by computer players (free: they move inside the host's run, with no Kin request) or by a Kin (uses Kin requests).
- My Kins (uses credits): you against up to 10 of your own Kins.

Rules: blinds rotate with the button (heads-up too), min-raise equals the last full raise, an incomplete all-in does not reopen the betting, side pots, split pots (odd chip to the left of the button), kickers, the wheel straight, busting out and rebuys.

What uses credits
- Hosting or joining runs this app on Kindroid to carry moves, chat and check-ins between copies, so it may use Kindroid credits; Solo does not.
- Each Kin move or chat line is a Kin request. Junk hands before the flop are checked or folded without asking (four times in five). "Most Kin requests per hour" caps it (30 to 480, default 60); past it a Kin plays a quiet, steady game. Computer players never use Kin requests.
- No scheduled trigger. The app wakes itself only for a due timer, a due deal, a delivery retry or a presence check-in, and only while a person has used the table in the last 10 minutes (a screen action, a move, a chat line or a join; a computer player, a Kin or a heartbeat does not count). After 10 quiet minutes: no check-ins, no timer or deal wake-ups and no Kin requests; a hand left half-played is finished by its timers the next time anyone opens it. At most 16 self-wakes in a row without a person, then the chain ends. An open screen only asks for a due timer while its person has been active in the last 10 minutes.

Chat: table chat is read by Kins (@Name a Kin and it drafts a reply only its owner sees; it reaches the table only if they tap Post). A Kin deciding a move sends only the move and never sees the table chat. OOC chat is people only. Chats are kept safe for work.
Your Kins remember the session (one short note, at most every 30 minutes and when it ends, kept 3 days).

Awards (judged by the host's table at each hand's end): Full House, Four of a Kind, Straight Flush, Royal Flush, Seven-Deuce, All-In Survivor, Double Up, The Steal, Last One Standing.

Files: screen/ (index.html, style.css, app.js table and menu, art.js cards and chips, sound.js, solo.js, poker.js rules and ranking, bots.js opponents), main.js (the table host and deliveries), savers.js (Kin-request savers). Tests live in test/ and are not shipped (node test/poker.test.js, table.test.js, people.test.js, credits.test.js, memory.test.js, solo.test.js; run with < /dev/null).
