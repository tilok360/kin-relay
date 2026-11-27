Kin Games: Table & Arcade

23 games, each one playable free against the computer (Solo) or against your Kin. This is one of two sister
apps; Kin Games: Board & Cards has the rest. They are separate apps with separate scores and settings.

Two ways to play (the two cards at the top of the lounge)
- Solo · Free, no credits: the computer plays the other side at the level you pick. Nothing is asked of your
  Kin, no actions or runs happen, and no Kindroid credits are used. Solo wins, losses, streaks, achievements and
  a game in progress are kept in the app's own files (solo-stats.json, solo-<game>.json).
- With your Kin · Uses Kindroid credits: your Kin is your opponent. Depending on the setting, the app asks your
  Kin to choose its moves (each question takes a few seconds and uses credits, like a message), or plays for it
  and lets it say a line on big moments, or plays quietly. When a game ends the app records it (game_over, a
  short run that counts toward the app's monthly allowance) and tells your Kin how it went, for three days.

The shelves
- Table & Arcade: Air Hockey, Shuffleboard, Foosball, Bowling, Table Tennis, Alley Roll, Cup Pong, Carrom, Darts, Pool, Mini Golf.
- Race & Roll: Slide & Bump, Ludo, Pop-Dice Dash, Snakes & Ladders, Yacht Dice, Farkle, Liar's Dice, Backgammon.
- Classics: Tic Tac Toe, Dots & Boxes, Memory, Mancala.

The lounge
- Search, category chips, favourites, box art drawn by the app, sound with mute and volume, reduced motion when your
  device asks for it, and keyboard play. Game code loads only when a game is opened.
- Every game has its rules and achievements under "Rules & awards", and a difficulty from Beginner to Hard.
- A game in progress is saved after every move and picks up where you left it.
- Names are generic; none of these games is affiliated with the makers of the branded versions.

What it uses
- kin:read, only in "With your Kin" mode, to ask your Kin for its moves and lines (uses Kindroid credits).
- Its own files: settings.json, scores.json, achievements.json, solo-stats.json, game-<name>.json and
  solo-<name>.json. Nothing goes anywhere else, and the screen uses no network.
- Actions: kin_games_record (your Kin can look up its record) and game_over (the screen records a finished game).
