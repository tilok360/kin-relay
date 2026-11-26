Kin Games: Board & Cards

26 games, each one playable free against the computer (Solo) or against your Kin. This is one of two sister
apps; Kin Games: Table & Arcade has the rest. They are separate apps with separate scores and settings.

Two ways to play (the two cards at the top of the lounge)
- Solo · Free, no credits: the computer plays the other side at the level you pick. Nothing is asked of your
  Kin, no actions or runs happen, and no Kindroid credits are used. Solo wins, losses, streaks, achievements and
  a game in progress are kept in the app's own files (solo-stats.json, solo-<game>.json).
- With your Kin · Uses Kindroid credits: your Kin is your opponent. Depending on the setting, the app asks your
  Kin to choose its moves (each question takes a few seconds and uses credits, like a message), or plays for it
  and lets it say a line on big moments, or plays quietly. When a game ends the app records it (board_game_over, a
  short run that counts toward the app's monthly allowance) and tells your Kin how it went, for three days.

The shelves
- Board: Chess, Checkers, Reversi, Go, Four in a Row, Chinese Checkers, Nine Men's Morris, Battle of the Ranks, Swarm, Fox & Geese, Hex, Capture Five, Dominoes.
- Cards: One Left, Crazy Eights, Go Fish, War, Gin Rummy, Cribbage, Hearts, Spades, Blackjack.
- Word & Puzzle: Hangman Duel, Word Duel, Code Breaker, Battle Sudoku.

The lounge
- Search, category chips, favourites, box art drawn by the app, sound with mute and volume, reduced motion when your
  device asks for it, and keyboard play. Game code loads only when a game is opened.
- Every game has its rules and achievements under "Rules & awards", and a difficulty from Beginner to Hard.
- A game in progress is saved after every move and picks up where you left it.
- Names are generic; none of these games is affiliated with the makers of the branded versions.
- Word lists for Word Duel and Hangman are bundled with the app; nothing is fetched.

What it uses
- kin:read, only in "With your Kin" mode, to ask your Kin for its moves and lines (uses Kindroid credits).
- Its own files: settings.json, scores.json, achievements.json, solo-stats.json, game-<name>.json and
  solo-<name>.json. Nothing goes anywhere else, and the screen uses no network.
- Actions: kin_board_record (your Kin can look up its record) and board_game_over (the screen records a finished game).
