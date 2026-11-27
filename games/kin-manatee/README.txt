Cards Against Kin-manatee
=========================
A fill-in-the-blank party card game for people and their Kins. The name is a parody; the deck (screen/cards.js: 104 prompts,
236 answers) and all art are original. Every card has a manatee on it. Nothing to buy, no real money, no accounts.

Ways to play (the menu says which cost credits)
- Solo (FREE, no credits): you against 2 to 5 computer players, each with its own taste (wordy, punchy, fitting, wild, crowd-pleasing,
  weird). Runs entirely inside the screen (screen/solo.js, screen/bots.js): no Kin, no app run, no file, no message to Kindroid.
  Nothing here can use credits. Optional rule twists: Gambling, Random Manatee, Wheaton's Law, Packing Heat, Meritocracy,
  Rebooting the Universe, Never Have I Ever. First to 3, 5 or 7 points.
- My Kins (uses credits): you and up to 10 of your own Kins at a table. Kins play cards, judge as Czar and may draft a chat line.
- Host a table (uses credits): up to five people, each may bring one Kin. No server: the host's copy of the app is the table.
  It shuffles with a cryptographic random generator, deals and holds every card, so play with people you trust. Guests join with the
  invite code and the host admits each one; someone who left can come back with the same code and sits straight back down.
  Every delivery is signed (HMAC-SHA256) with the table key inside the invite code; bad, stale or replayed ones are dropped, and
  removing someone rotates the key. Each person is sent only their own hand; answers are shuffled and anonymous until the Czar picks.
  A timer sits out anyone who is away (90 seconds to play and to judge by default; a Kin gets longer); a Czar who is away gets a random pick.
- Join a table (uses credits): paste the invite code, optionally bring one Kin.
- Empty seats at any hosted table can be filled by computer players (0 to 4). They move inside the host's run, free, with no Kin request.

How a round works
- Everyone holds 10 answer cards. The Manatee Czar reveals a prompt; everyone else plays an answer face down (two or three, in
  reading order, for a Pick 2 or 3). The Czar sees them anonymously, crowns the funniest, and its player scores. First to the target wins.
- Gambling: after playing, bet a point on an extra answer; if you lose, the round's winner takes your point.
- Happy Ending (host): the next round is the last, played with the closing haiku card.
- Custom cards (host): your own prompts and answers join the deck at the next new game (kept safe for work).
- Seven awards, judged each round for people, Kins and computer players alike: Opening Laugh, Hat Trick, Jackpot, Double or Nothing,
  Czar's Darling, Manatee Champion, Landslide.
- Controls: tap or press 1-9 and 0 to pick a card, Enter plays (or crowns, as Czar), N next round, M sound, T chat. Works on a phone.
  Animations follow the device's reduced-motion setting and can be switched off. Sounds are made with Web Audio.

What uses credits
- Solo uses none. Hosting or joining runs this app on Kindroid to carry cards, chat and check-ins, so it may use Kindroid credits.
- Each card a Kin plays, each pick it makes as Czar and each chat line it drafts is a Kin request on its owner's account (about one per
  Kin per round). "Most Kin requests per hour" (30 to 480, 60 by default) caps it; past the cap, or when nobody is around, a Kin plays
  and judges like a free computer player and does not answer @mentions. A Kin deciding a card sees only its hand and the scores, never chat.
- No scheduled trigger. The app wakes itself only for a due timer, a due next round, a delivery retry or a presence check-in, and only
  while a person has used it in the last 10 minutes (a screen action, a move, a chat line or a join; a computer player, a Kin or a
  heartbeat does not count). After 10 quiet minutes: no check-ins, no timer or next-round wake-ups, no Kin requests. At most 16
  self-wakes in a row without a person, then the chain ends and the run ends without asking to be woken. A round left half-played is
  finished by its timers the next time anyone opens it.

Chat: the table chat is read by Kins (@Name a Kin and it drafts a reply only its owner sees; it reaches the table only if they tap Post).
OOC chat is people only, never shown to a Kin. Chats and custom cards are kept safe for work. Your Kins remember a session through one
short note (at most every 30 minutes and when it ends, kept 3 days).

Files: screen/ (index.html, style.css, app.js, art.js, sound.js, solo.js, bots.js, game.js rules, cards.js deck), main.js (the table host and
deliveries). Tests live in test/ and are not shipped: node test/game.test.js, flow.test.js, solo.test.js, memory.test.js, credits.test.js,
bots.test.js, achievements.test.js (run the ones that use main.js with < /dev/null). Grants: kin:read, inbound:table, net:in.kinusercontent.com.
