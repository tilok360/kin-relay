Chess Clash

Animated battle chess. The board stands at an angle in a torch-lit castle hall (stone arches, a stained-glass window,
banners, braziers with live flames), and every piece is an armored character that breathes, walks its move and
fights for every capture. All the art and sound is original and drawn or made on the spot: no image or sound files.

The two armies
- Light: steel, gold and azure with a sun emblem. Dark: iron, bronze and crimson with a raven emblem.
- Pawn: kettle helm, round shield and spear; marches. Knight: a lancer on a barded horse; leaps in an arc.
  Bishop: cowled with a crystal staff; glides. Rook: a stone tower golem with glowing eyes; stomps (the board shakes).
  Queen: a sorceress with an orb; floats on magic. King: crowned great helm, cape and greatsword; slow royal march.

The fights
- A capture is a short cutscene: the attacker walks up, the camera zooms in with a caption, the rest of the board
  dims, and the attacker's own move plays: the pawn's three spear jabs, the knight's rearing lance charge (the
  loser flies), the bishop's orb (the loser dissolves), the rook's fist slam (the loser crumbles to rubble), the
  queen's beam (the loser dissolves) and the king's overhead strike (the loser falls). Hit flashes, sparks, dust and
  a camera shake. At checkmate the beaten king sways and topples.
- Click or tap, Esc, or the Skip button to skip a fight. Fights: Full, Fast (shorter) or Off (pieces move straight away).
- With the device's reduce-motion setting on, there is no zoom or shake and fights are short.

Two ways to play
- Solo, free: you against the computer, Beginner, Easy, Normal or Hard (alpha-beta search, up to five moves deep on
  Hard). Pick Light, Dark or Random. It runs entirely on the screen: no questions to your Kin, no Kindroid credits,
  no runs. Undo takes back your last move (and the computer's reply). Your record per level, streak and fastest win
  are kept, and a game in progress resumes from the menu.
- Against your Kin, uses credits: you and your Kin take turns with the light pieces. Pick how your Kin plays:
  - Your Kin picks: each turn the app works out its best moves and asks your Kin to pick one (Hard: top 3, Normal:
    top 6, Easy: any 8 from the better half, Beginner: any 8), with a line to you in a bubble. If it doesn't answer
    in 30 seconds, the app moves for it.
  - App moves, Kin talks: captures, checks and achievements get a line now and then (fewer credits).
  - Quiet: the app plays its side and your Kin isn't asked anything.
  Each finished game is saved with one short run (clash_record), and your Kin is told how it went for three days
  and can look up its record when you ask (clash_score).

Rules and controls
- Standard chess: castling, en passant, promotion (pick queen, rook, bishop or knight), check, checkmate,
  stalemate, the fifty-move rule, threefold repetition and too little material.
- Click a piece, then a highlighted square. The last move, check, legal moves and captures are marked; captured
  pieces show in each side's tray with the material lead, and the move list is beside the board.
- Flip turns the board around. Resign asks first.
- Keyboard: focus the board, then arrow keys move a cursor and Enter or Space picks; Esc cancels or skips a fight;
  U undo (Solo), F flip, M mute. Moves are announced for screen readers.
- Sound: footsteps for each piece type, blades, magic, thuds and crumbling stone, a fanfare for check and at the end,
  all made with Web Audio. Mute and volume are remembered.

Achievements (14; earned once a game and counted across games; the computer doesn't collect them)
First Blood, Pawn's Revenge, Two Queens, Giant Slayer, Royal Brawl, The Fork, Humble Crown, In Passing, Rampage,
Warlord, Swift Victory, Smothered, Comeback, Crown Jewel. The menu shows which you have and how often.

What it uses
- kin:read, only in the Kin game, to ask your Kin for its moves and lines. Each question takes a few seconds and
  uses credits like a message; the Solo game never asks.
- Its own files: settings.json, solo-game.json and solo-stats.json (Solo), game.json, starts.json, stats.json and
  achievements.json (Kin game). Nothing goes anywhere else, and the screen uses no network.
- One short run per finished Kin game (clash_record). Solo games use none.

Testing
- node test/run.test.js: the rules engine's move counts and every special rule, the computer (finds mates, takes
  free pieces, plays a whole game), the screen scripts load with no network calls, and the record run against a
  stand-in kin command.
- dev/host.html opens the screen in a stand-in for the Kindroid frame (serve the app folder over http).
