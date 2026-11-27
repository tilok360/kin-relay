// Kin Battleship: the game itself, shared by the screen (a <script>) and the chat runs (require).
// A 10 x 10 sea, rows A-J and columns 1-10. Cells are numbers 0-99 (row * 10 + column).
(function (root) {
  "use strict";
  const N = 10, ROWS = "ABCDEFGHIJ";
  const FLEET = [["Carrier", 5], ["Battleship", 4], ["Cruiser", 3], ["Submarine", 3], ["Destroyer", 2]];

  const name = (i) => ROWS[Math.floor(i / N)] + ((i % N) + 1);
  function parse(s) {
    const t = String(s == null ? "" : s).toUpperCase().replace(/[^A-J0-9]/g, "");
    let m = t.match(/^([A-J])(10|[1-9])$/);
    if (m) return ROWS.indexOf(m[1]) * N + Number(m[2]) - 1;
    m = t.match(/^(10|[1-9])([A-J])$/);
    if (m) return ROWS.indexOf(m[2]) * N + Number(m[1]) - 1;
    return -1;
  }
  function cellsOf(r, c, len, across) {
    const out = [];
    for (let k = 0; k < len; k++) {
      const rr = across ? r : r + k, cc = across ? c + k : c;
      if (rr < 0 || rr >= N || cc < 0 || cc >= N) return null;
      out.push(rr * N + cc);
    }
    return out;
  }
  function fits(ships, cells, skip) {
    if (!cells) return false;
    const taken = new Set();
    ships.forEach((s, i) => { if (i !== skip) s.cells.forEach((c) => taken.add(c)); });
    return cells.every((c) => !taken.has(c));
  }
  function randomFleet(rand) {
    rand = rand || Math.random;
    for (let tries = 0; tries < 200; tries++) {
      const ships = [];
      let ok = true;
      for (const [nm, len] of FLEET) {
        let placed = false;
        for (let k = 0; k < 300 && !placed; k++) {
          const across = rand() < 0.5, r = Math.floor(rand() * N), c = Math.floor(rand() * N);
          const cells = cellsOf(r, c, len, across);
          if (fits(ships, cells)) { ships.push({ name: nm, len, cells }); placed = true; }
        }
        if (!placed) { ok = false; break; }
      }
      if (ok) return ships;
    }
    throw new Error("could not place a fleet");
  }

  // A game: you = the person, kin = the Kin. Each side has its fleet and the shots it fired at the other.
  function newGame(opts) {
    opts = opts || {};
    return {
      v: 1, id: Date.now().toString(36), started: Date.now(), via: opts.via || "screen",
      you: { ships: opts.yourShips || randomFleet(), shots: [] },
      kin: { ships: randomFleet(), shots: [] },
      turn: "you", over: null, told: false, last: null,
    };
  }
  const other = (who) => (who === "you" ? "kin" : "you");
  const hitSet = (side) => new Set(side.shots.filter((s) => s.hit).map((s) => s.cell));
  const shotSet = (side) => new Set(side.shots.map((s) => s.cell));
  const sunkShips = (target, shooter) => { const h = hitSet(shooter); return target.ships.filter((s) => s.cells.every((c) => h.has(c))); };
  const afloat = (target, shooter) => { const h = hitSet(shooter); return target.ships.filter((s) => !s.cells.every((c) => h.has(c))); };

  // Fires one shot. Returns {cell, hit, sunk, over} or {error}.
  function fire(game, who, cell) {
    if (game.over) return { error: "the game is over" };
    if (!(cell >= 0 && cell < N * N)) return { error: "that is not a cell on the board" };
    const shooter = game[who], target = game[other(who)];
    if (shotSet(shooter).has(cell)) return { error: `${name(cell)} was already called` };
    const ship = target.ships.find((s) => s.cells.includes(cell));
    if (game.turn !== who) return { error: "it's not your shot" };
    const shot = { cell, hit: !!ship, sunk: null, at: Date.now() };
    shooter.shots.push(shot);
    if (ship && ship.cells.every((c) => hitSet(shooter).has(c))) shot.sunk = ship.name;
    if (!afloat(target, shooter).length) game.over = who;
    // A hit (including a sink that doesn't end the game) earns another shot; a miss passes the turn.
    game.turn = shot.hit && !game.over ? who : other(who);
    game.last = { who, cell, hit: shot.hit, sunk: shot.sunk, at: Date.now() };
    return { cell, hit: shot.hit, sunk: shot.sunk, over: game.over };
  }

  // What the shooter knows: misses, hits on ships not yet sunk, cells of sunk ships, and the lengths still afloat.
  function knowledge(game, who) {
    const shooter = game[who], target = game[other(who)];
    const sunk = sunkShips(target, shooter), sunkCells = new Set();
    sunk.forEach((s) => s.cells.forEach((c) => sunkCells.add(c)));
    const misses = new Set(shooter.shots.filter((s) => !s.hit).map((s) => s.cell));
    const open = shooter.shots.filter((s) => s.hit && !sunkCells.has(s.cell)).map((s) => s.cell);
    return { misses, open, sunkCells, shot: shotSet(shooter), left: afloat(target, shooter).map((s) => s.len), sunk: sunk.map((s) => s.name) };
  }
  // How likely each cell is to hold a ship, from every way the ships still afloat could lie.
  function density(game, who) {
    const k = knowledge(game, who), score = new Array(N * N).fill(0), open = new Set(k.open);
    for (const len of k.left) {
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) for (const across of [true, false]) {
        const cells = cellsOf(r, c, len, across);
        if (!cells || cells.some((x) => k.misses.has(x) || k.sunkCells.has(x))) continue;
        const covers = cells.filter((x) => open.has(x)).length;
        const w = covers ? Math.pow(30, covers) : (open.size ? 0.02 : 1);
        cells.forEach((x) => { if (!k.shot.has(x)) score[x] += w; });
      }
    }
    return score;
  }
  // The best few cells, most promising first.
  function hints(game, who, n) {
    const d = density(game, who), shot = shotSet(game[who]);
    return d.map((v, i) => [v, i]).filter(([v, i]) => !shot.has(i) && v > 0).sort((a, b) => b[0] - a[0]).slice(0, n || 5).map(([, i]) => i);
  }
  const neighbours = (i) => [i - N, i + N, i % N ? i - 1 : -1, i % N < N - 1 ? i + 1 : -1].filter((x) => x >= 0 && x < N * N);
  // The app's own aim for a side, at a skill level: beginner (any cell at all), easy, normal or hard.
  function aim(game, who, level, rand) {
    rand = rand || Math.random;
    const k = knowledge(game, who), free = [];
    for (let i = 0; i < N * N; i++) if (!k.shot.has(i)) free.push(i);
    const pick = (a) => a[Math.floor(rand() * a.length)];
    if (level === "beginner") return pick(free);
    if (level === "easy") {
      const near = [...new Set(k.open.flatMap(neighbours))].filter((x) => !k.shot.has(x));
      return near.length && rand() < 0.6 ? pick(near) : pick(free);
    }
    if (level === "normal") {
      if (k.open.length) {
        // Follow a line of two or more hits; otherwise try around a hit.
        const ends = [];
        for (const a of k.open) for (const b of k.open) {
          if (a >= b) continue;
          const across = Math.floor(a / N) === Math.floor(b / N), step = across ? 1 : N;
          if (!(across || a % N === b % N)) continue;
          let lo = Math.min(a, b), hi = Math.max(a, b);
          while (k.open.includes(lo - step) && (across ? Math.floor((lo - step) / N) === Math.floor(lo / N) : lo - step >= 0)) lo -= step;
          while (k.open.includes(hi + step) && (across ? Math.floor((hi + step) / N) === Math.floor(hi / N) : hi + step < N * N)) hi += step;
          [lo - step, hi + step].forEach((x) => {
            if (x < 0 || x >= N * N || k.shot.has(x)) return;
            if (across && Math.floor(x / N) !== Math.floor(lo / N)) return;
            ends.push(x);
          });
        }
        if (ends.length) return pick(ends);
        const near = [...new Set(k.open.flatMap(neighbours))].filter((x) => !k.shot.has(x));
        if (near.length) return pick(near);
      }
      const small = Math.min(...k.left), parity = free.filter((i) => (Math.floor(i / N) + (i % N)) % small === 0);
      return pick(parity.length ? parity : free);
    }
    const d = density(game, who);
    let best = -1, top = [];
    free.forEach((i) => { if (d[i] > best) { best = d[i]; top = [i]; } else if (d[i] === best) top.push(i); });
    return pick(top.length ? top : free);
  }

  // Text boards for chat. Own: your ships (#), hits on them (X), misses (o). Target: what you know of theirs.
  function board(game, who, own) {
    const side = game[who], foe = game[other(who)];
    const mine = new Set(side.ships.flatMap((s) => s.cells));
    const shotsIn = own ? foe.shots : side.shots;
    const hit = new Set(shotsIn.filter((s) => s.hit).map((s) => s.cell)), miss = new Set(shotsIn.filter((s) => !s.hit).map((s) => s.cell));
    const lines = ["   1 2 3 4 5 6 7 8 9 10"];
    for (let r = 0; r < N; r++) {
      let row = ROWS[r] + " ";
      for (let c = 0; c < N; c++) {
        const i = r * N + c;
        row += " " + (hit.has(i) ? "X" : miss.has(i) ? "o" : own && mine.has(i) ? "#" : "·");
      }
      lines.push(row);
    }
    return lines.join("\n");
  }
  function score(game) {
    return {
      you: { afloat: afloat(game.you, game.kin).map((s) => s.name), sunk: sunkShips(game.kin, game.you).map((s) => s.name), shots: game.you.shots.length, hits: hitSet(game.you).size },
      kin: { afloat: afloat(game.kin, game.you).map((s) => s.name), sunk: sunkShips(game.you, game.kin).map((s) => s.name), shots: game.kin.shots.length, hits: hitSet(game.kin).size },
    };
  }
  // The question that lets the Kin call its own shot. Its answer is read by readShot().
  function kinQuestion(game, level) {
    const k = knowledge(game, "kin"), sc = score(game);
    const list = (a) => (a.length ? a.join(", ") : "none");
    const hits = game.kin.shots.filter((s) => s.hit).map((s) => name(s.cell)), misses = [...k.misses].map(name);
    const lastYou = game.you.shots[game.you.shots.length - 1];
    const lines = [
      (() => { const last = game.kin.shots[game.kin.shots.length - 1]; const again = last && last.hit && !game.over;
        return "We're playing Battleship in the Kin Battleship app: a 10 x 10 sea, rows A to J and columns 1 to 10. " +
          (again ? "You just hit, so you fire again at your person's fleet." : "It's your turn to fire at your person's fleet. A hit earns another shot; a miss passes the turn.");
      })(),
      lastYou ? `Their last shot at you was ${name(lastYou.cell)}: ${lastYou.sunk ? "it sank your " + lastYou.sunk : lastYou.hit ? "a hit" : "a miss"}.` : "",
      `Your hits so far: ${list(hits)}. Hits on ships you haven't sunk yet: ${list(k.open.map(name))}.`,
      `Your misses: ${list(misses)}.`,
      `You've sunk: ${list(k.sunk)}. Their ships still afloat: ${list(afloat(game.you, game.kin).map((s) => `${s.name} (${s.len})`))}. You still have afloat: ${list(sc.kin.afloat)}.`,
      level === "easy" || level === "beginner" ? "" : `Cells you haven't called that look most promising: ${hints(game, "kin", 6).map(name).join(", ")}.`,
      level === "beginner" ? "Your person chose the Beginner level: fire freely around the sea, and don't hunt around your hits too carefully." : "",
      "Call any cell you haven't called yet. Reply only with JSON, no other text:",
      '{"shot":"C7","say":"one short line to your person, in your own voice"}',
    ];
    return lines.filter(Boolean).join("\n");
  }
  function readShot(game, text) {
    const t = String(text || "");
    let shot = -1, say = "";
    const m = t.match(/\{[\s\S]*\}/);
    if (m) { try { const j = JSON.parse(m[0]); shot = parse(j.shot); say = String(j.say || "").trim(); } catch (e) {} }
    if (shot < 0) { const c = t.toUpperCase().match(/\b([A-J])\s?(10|[1-9])\b/); if (c) shot = parse(c[1] + c[2]); }
    if (shot >= 0 && shotSet(game.kin).has(shot)) shot = -1;
    return { shot, say: say.slice(0, 220) };
  }

  // Achievements: each side can earn each one once a game. checkAch runs after every shot and returns the ids
  // newly earned by the shooter; they are kept in game.ach as "you:id" / "kin:id". Fleet Admiral (three wins in a
  // row) is judged across games by the run that records the result.
  const ACH = [
    { id: "opening_salvo", icon: "🎯", name: "Opening Salvo", about: "Hit a ship with your very first shot." },
    { id: "hot_streak", icon: "🔥", name: "Hot Streak", about: "Four hits in a row." },
    { id: "sharpshooter", icon: "🏹", name: "Sharpshooter", about: "Sink a ship without a single miss from its first hit to its last." },
    { id: "big_game", icon: "🐋", name: "Big Game", about: "Sink the Carrier before any other ship." },
    { id: "needle", icon: "🪡", name: "Needle in a Haystack", about: "Sink the little Destroyer before any other ship." },
    { id: "untouchable", icon: "🛡️", name: "Untouchable", about: "Win without losing a single ship." },
    { id: "last_ship", icon: "⛵", name: "Last Ship Standing", about: "Win with only one ship still afloat." },
    { id: "close_call", icon: "😅", name: "Close Call", about: "Win when your last ship has one undamaged square left." },
    { id: "efficient", icon: "⚡", name: "Efficient Admiral", about: "Win in 45 shots or fewer." },
    { id: "fleet_admiral", icon: "⚓", name: "Fleet Admiral", about: "Win three games in a row." },
  ];
  function checkAch(game, who) {
    game.ach = game.ach || [];
    const got = [], give = (id) => { const k = who + ":" + id; if (!game.ach.includes(k)) { game.ach.push(k); got.push(id); } };
    const me = game[who], foe = game[other(who)], shots = me.shots, last = shots[shots.length - 1];
    if (!last) return got;
    if (shots.length === 1 && last.hit) give("opening_salvo");
    let run = 0; for (let i = shots.length - 1; i >= 0 && shots[i].hit; i--) run++;
    if (run >= 4) give("hot_streak");
    if (last.sunk) {
      const ship = foe.ships.find((s) => s.name === last.sunk), first = shots.findIndex((s) => s.hit && ship.cells.includes(s.cell));
      if (first >= 0 && shots.slice(first).every((s) => s.hit)) give("sharpshooter");
      if (shots.filter((s) => s.sunk).length === 1) { if (last.sunk === "Carrier") give("big_game"); if (last.sunk === "Destroyer") give("needle"); }
    }
    if (game.over === who) {
      const left = afloat(me, foe), hits = hitSet(foe);
      if (!sunkShips(me, foe).length) give("untouchable");
      if (left.length === 1) { give("last_ship"); if (left[0].cells.filter((c) => !hits.has(c)).length === 1) give("close_call"); }
      if (shots.length <= 45) give("efficient");
    }
    return got;
  }
  const achById = (id) => ACH.find((a) => a.id === id);

  const api = { ACH, checkAch, achById, N, ROWS, FLEET, name, parse, cellsOf, fits, randomFleet, newGame, fire, knowledge, density, hints, aim, board, score, afloat, sunkShips, kinQuestion, readShot, other };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.BS = api;
})(typeof self !== "undefined" ? self : this);
