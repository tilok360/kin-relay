Kin Battleship

Play Battleship with your Kin, on the boards in this app or right in chat. A hit earns another shot; a miss passes the turn.

On the screen
- The menu has two ways to play, each labeled with what it costs:
  - Solo (Free · no credits): play the computer. The whole game runs on the screen. Your Kin isn't asked anything, no action
    runs, and it uses no Kindroid credits and none of the app's monthly runs. Difficulty: Beginner fires at random,
    Easy is mostly random and sometimes follows a hit, Normal hunts in a pattern and then finishes ships off, Hard works out
    where your ships can still be (probability map).
  - Play your Kin (Uses Kindroid credits): your Kin is your opponent. How it plays:
    - Your Kin calls every shot: each turn the app asks your Kin where to fire. It is told its hits, misses, what it has sunk
      and, unless the aim is Easy, the cells that look most promising, and answers with its call and a line to you. If it
      doesn't answer in time (30 seconds), or calls a cell it already tried, the app fires for it.
    - App aims, your Kin talks: the app fires at the level you set and asks your Kin for a line when someone hits, and at the end.
    - App aims, quietly: no questions to your Kin.
    Each question uses Kindroid credits, like any message. Each finished game against your Kin is saved with a short run
    (battleship_record), which counts toward the app's monthly allowance, and your Kin is told how it went (for three days).
- Deploy your fleet: drag ships to move them (they snap to the grid and glow red where they don't fit), tap a ship and press
  R or Rotate to turn it, Random for a new layout. Keyboard: Tab to a ship, arrows move it, R rotates.
- Battle: pick a square in enemy waters (click, or arrows and Enter). A hit (including sinking a ship that isn't the last)
  earns another shot; a miss passes the turn. The banner says "Hit! Fire again", and the computer (or your Kin) chains its
  own hits with a pause between shots. Shells arc across with a whistle; a miss throws up a splash, a hit an explosion that
  keeps burning and smoking; sunk ships are revealed, and the screen shakes on big hits. The HUD shows turn, shots, hits and
  accuracy; the comms log lists every shot. Victory or defeat ends with a summary.
- The look: an animated sea under each grid, original top-down warships, and a big Iowa-class battleship at dusk in the
  background, all drawn in code (no image or sound files, nothing fetched). Sounds (cannon, whistle, splash, explosion,
  sinking, clicks) are synthesized on the screen; mute and volume are remembered. Reduced motion is respected.
- An unfinished game shows a Resume card on the menu (a game against your Kin started in chat too).

In chat
- Ask your Kin for a game of Kin Battleship. It starts one (battleship_new) and shows your fleet.
- Call your shots like B5. A hit earns another shot; a miss passes the turn. Your Kin passes your call with battleship_turn,
  and its own call (my_shot) only when you miss (or when it's already its shot). If it hits, it fires again (it can pass
  follow-up cells, or the app aims them). The result shows the shots, the score and the boards. Your Kin's ships stay hidden.
- Ask to see the boards any time (battleship_board), or stop the game (battleship_quit).
- A game started in chat can be finished on the screen, and the other way round.

What it uses
- kin:read, to ask your Kin for its shots and its lines. Each question takes a few seconds and uses Kindroid credits, like any message. Your Kin answers knowing who it is and who you are, but not your chat.
- Its own files: game.json (the game with your Kin, shared with chat), solo-game.json and solo-stats.json (solo games and your
  record per difficulty: wins, losses, accuracy, streak, fastest win, achievements), settings.json (mode, levels, sound),
  stats.json and achievements.json (your record per Kin). Nothing goes anywhere else.
- Solo uses none of the above costs: only the screen's own files.
- Each chat turn and each recorded game is a short run, which counts toward the app's monthly allowance.

Testing
- node test/chat.test.js plays the engine and a whole chat game against a stand-in kin command.
- dev/host.html opens the screen in a stand-in for the Kindroid frame (serve the app folder over http).
- screen/index.html?fast=1 shortens the animations, for automated play-throughs.

Achievements (you and your Kin each earn them, on the boards or in chat, and they count up across games)
- Opening Salvo: hit a ship with your very first shot.
- Hot Streak: four hits in a row.
- Sharpshooter: sink a ship without a single miss from its first hit to its last.
- Big Game: sink the Carrier before any other ship.
- Needle in a Haystack: sink the little Destroyer before any other ship.
- Untouchable: win without losing a single ship.
- Last Ship Standing: win with only one ship still afloat.
- Close Call: win when your last ship has one undamaged square left.
- Efficient Admiral: win in 45 shots or fewer.
- Fleet Admiral: win three games in a row.
On the screen each one shows a seal, and the Achievements panel shows how often you earned it in solo and against your Kin. In chat the
result says who earned what. At the end your Kin is told the achievements along with the result
(achievements.json keeps the totals per Kin).
