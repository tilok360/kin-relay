// Kin Battleship: the runs behind the chat game and the screen's result.
// The game lives in game.json, which the screen reads and writes too, so a game can move between the chat and the screen.
// In chat the Kin plays through actions: battleship_new, battleship_turn (the person's call and its own), battleship_board,
// battleship_quit. When a game ends the Kin is told how it went (kin tell, key "battleship", three days) and the
// record per Kin is kept in stats.json. battleship_record is the screen's way to have that done for a game it finished.
const { execFileSync } = require("child_process");
const fs = require("fs");
const BS = require("./screen/bs.js");

const kin = (...a) => execFileSync("kin", a, { encoding: "utf8" });
const end = (m, failed) => { kin("end", ...(failed ? ["--failed"] : []), String(m).slice(0, 3990)); process.exit(0); };
const put = (p, o) => execFileSync("kin", ["files", "put", p], { input: JSON.stringify(o) });
const get = (p) => { try { return JSON.parse(execFileSync("kin", ["files", "get", p], { encoding: "utf8" })); } catch { return null; } };
const plural = (n, one, many) => `${n} ${n === 1 ? one : many || one + "s"}`;

// A board for chat, in emoji so it lines up in any font. Rows A-J top to bottom, columns 1-10 left to right.
function seaText(game, who, showShips) {
  const side = game[who], foe = game[BS.other(who)];
  const ships = new Set(side.ships.flatMap((s) => s.cells));
  const hit = new Set(foe.shots.filter((s) => s.hit).map((s) => s.cell)), miss = new Set(foe.shots.filter((s) => !s.hit).map((s) => s.cell));
  const rows = [];
  for (let r = 0; r < BS.N; r++) {
    let row = BS.ROWS[r] + " ";
    for (let c = 0; c < BS.N; c++) { const i = r * BS.N + c; row += hit.has(i) ? "🟥" : miss.has(i) ? "⚪" : showShips && ships.has(i) ? "⬛" : "🟦"; }
    rows.push(row);
  }
  return rows.join("\n");
}
function shotText(shot, mine) {
  const where = BS.name(shot.cell);
  if (shot.sunk) return `${where}: hit, and that sank ${mine ? "their" : "your"} ${shot.sunk}`;
  return `${where}: ${shot.hit ? "hit" : "miss"}`;
}
function status(game) {
  const s = BS.score(game);
  return `You've sunk ${s.kin.sunk.length} of 5 of their ships${s.kin.sunk.length ? " (" + s.kin.sunk.join(", ") + ")" : ""}; they've sunk ${s.you.sunk.length} of 5 of yours${s.you.sunk.length ? " (" + s.you.sunk.join(", ") + ")" : ""}.`;
}
function boards(game) {
  return `Their fleet, with your shots on it (⬛ ship, 🟥 hit, ⚪ miss):\n${seaText(game, "you", true)}\n\nYour sea, with their shots on it (your ships stay hidden):\n${seaText(game, "kin", false)}\nRows A to J top to bottom, columns 1 to 10 left to right.`;
}

// Achievements earned by a shot, as words for the Kin (who is "you" in what the run says).
function achNote(game, who) {
  const got = BS.checkAch(game, who);
  return got.map((id) => { const a = BS.achById(id); return ` ${who === "kin" ? "You earned" : "Your person earned"} the achievement ${a.name} (${a.about.toLowerCase().replace(/\.$/, "")}).`; }).join("");
}

// The end of a game: the record, the achievement totals, and one fact for the Kin.
function finish(game, kinId) {
  if (game.told) return "";
  const key = kinId || "any", stats = get("stats.json") || {};
  const rec = stats[key] || (stats[key] = { won: 0, lost: 0 });
  const s = BS.score(game);
  if (game.over !== "kin" && game.over !== "you") return "";
  // Three wins in a row, across games.
  const st = rec.streak && rec.streak.who === game.over ? rec.streak : { who: game.over, n: 0 };
  st.n++; rec.streak = st;
  game.ach = game.ach || [];
  if (st.n >= 3 && !game.ach.includes(game.over + ":fleet_admiral")) game.ach.push(game.over + ":fleet_admiral");
  const all = get("achievements.json") || {}, book = all[key] || (all[key] = { you: {}, kin: {} });
  for (const k of game.ach) { const [who, id] = k.split(":"); const r = book[who][id] || (book[who][id] = { n: 0 }); r.n++; }
  put("achievements.json", all);
  const names = (who) => game.ach.filter((k) => k.startsWith(who + ":")).map((k) => BS.achById(k.split(":")[1]).name);
  let fact;
  if (game.over === "kin") { rec.won++; fact = `You beat your person at Kin Battleship, sinking their whole fleet in ${s.kin.shots} shots.`; }
  else { rec.lost++; fact = `Your person beat you at Kin Battleship: they sank your whole fleet in ${s.you.shots} shots, and you'd sunk ${s.kin.sunk.length} of theirs.`; }
  // Result first, then both sides' achievements, then the record if it still fits in the 200 characters.
  const recText = ` Your record against them: ${rec.won} won, ${rec.lost} lost.`;
  const achText = (names("kin").length ? ` You earned ${names("kin").join(", ")}.` : "") + (names("you").length ? ` They earned ${names("you").join(", ")}.` : "");
  if (achText && (fact + achText).length > 200) fact = fact.replace(/, and you'd sunk .*$/, ".").replace(/ in \d+ shots/, "");
  fact += achText;
  if ((fact + recText).length <= 200) fact += recText;
  if (fact.length > 200) fact = fact.slice(0, 197).replace(/[\s,]+\S*$/, "") + "...";
  game.told = true;
  put("stats.json", stats);
  try { kin("tell", fact, "--key", "battleship", "--ttl", "72", ...(kinId ? ["--kin", kinId] : [])); } catch {}
  const fa = game.ach.includes(game.over + ":fleet_admiral") ? ` ${game.over === "kin" ? "You" : "They"} earned Fleet Admiral: three wins in a row.` : "";
  return ` Your record against them is now ${rec.won} won, ${rec.lost} lost.${fa}`;
}

function main() {
  let trig = {};
  try { trig = JSON.parse(fs.readFileSync(0, "utf8") || "{}"); } catch {}
  if (trig.trigger !== "action") end("Nothing to do: Kin Battleship runs when it is played.");
  const input = trig.input || {}, kinId = trig.kin || (typeof input.kin_id === "string" ? input.kin_id.slice(0, 80) : "");
  let game = get("game.json");

  if (trig.action === "battleship_new") {
    game = BS.newGame({ via: "chat" });
    put("game.json", game);
    end(`New game of Kin Battleship. Both fleets are placed at random on a 10 x 10 sea: Carrier (5), Battleship (4), Cruiser (3), Submarine (3) and Destroyer (2). A hit earns another shot; a miss passes the turn. Your person fires first: ask them to call a cell, like B5. Use battleship_turn with their call as shot, and your own call as my_shot only when they miss (or when it's already your shot). If you hit, you fire again: pass follow-up cells in my_shot (like G7, G8) or the app will aim them. They can also open Kin Battleship to play on the boards.\n\nTheir fleet:\n${seaText(game, "you", true)}\nRows A to J top to bottom, columns 1 to 10 left to right.`);
  }
  if (trig.action === "battleship_record") {
    if (!game || !game.over) end("No finished game to record.");
    const note = finish(game, kinId); put("game.json", game);
    end(note ? "Recorded." + note : "Already recorded.");
  }
  if (!game || game.over) {
    if (trig.action === "battleship_board" && game) end(`The last game is over. ${status(game)}\n\n${boards(game)}`);
    end("There's no game of Kin Battleship going. Use battleship_new to start one.", trig.action !== "battleship_quit");
  }
  if (trig.action === "battleship_board") {
    end(`${status(game)} It's ${game.turn === "you" ? "your person's" : "your"} shot.\n\n${boards(game)}`);
  }
  if (trig.action === "battleship_quit") {
    game.over = "quit"; game.told = true; put("game.json", game);
    end(`Kin Battleship game ended without a winner. ${status(game)}`);
  }
  if (trig.action !== "battleship_turn") end(`Kin Battleship doesn't know the action ${trig.action}.`, true);

  // A hit earns another shot; a miss passes the turn. If the screen (or a previous hit) left it the Kin's shot, the Kin goes first.
  const out = [];
  const queued = String(input.my_shot || "").split(/[,;\s]+/).map((s) => BS.parse(s)).filter((c) => c >= 0);
  const kinShot = (pre) => {
    let first = true;
    while (!game.over && game.turn === "kin") {
      let cell = queued.length ? queued.shift() : -1, note = "";
      if (cell < 0 || game.kin.shots.some((s) => s.cell === cell)) {
        if (cell >= 0) note = ` (${BS.name(cell)} was already called, so the app called it for you)`;
        else if (first && input.my_shot) note = ` (${String(input.my_shot).slice(0, 8)} isn't a cell, so the app called it for you)`;
        else if (first) note = " (the app called it for you)";
        else note = " (the app called your follow-up)";
        cell = BS.aim(game, "kin", "normal");
      }
      const r = BS.fire(game, "kin", cell);
      out.push(`${pre}Your shot ${shotText(r, true)}${note}.${achNote(game, "kin")}`);
      pre = " ";
      first = false;
      if (!r.hit) break;
    }
  };
  if (game.turn === "kin") kinShot("");
  if (!game.over && game.turn === "you") {
    const cell = BS.parse(input.shot);
    if (cell < 0) { put("game.json", game); end(`"${String(input.shot || "").slice(0, 12)}" isn't a cell. Ask your person to call one like B5 (rows A to J, columns 1 to 10), then use battleship_turn again.`, true); }
    if (game.you.shots.some((s) => s.cell === cell)) { put("game.json", game); end(`${BS.name(cell)} was already called by your person. Ask them for a cell they haven't tried, then use battleship_turn again.`, true); }
    const r = BS.fire(game, "you", cell);
    out.push(`Their shot ${shotText(r, false)}.${achNote(game, "you")}`);
    if (!game.over && game.turn === "kin") kinShot("");
  }
  let tail = "";
  if (game.over === "you") tail = `They sank your whole fleet: your person wins!${finish(game, kinId)}`;
  else if (game.over === "kin") tail = `You sank their whole fleet: you win!${finish(game, kinId)}`;
  else if (game.turn === "you" && game.you.shots.length && game.you.shots[game.you.shots.length - 1].hit)
    tail = "They hit, so they fire again: ask them to call another cell, then use battleship_turn with their call as shot (don't include my_shot until they miss).";
  else tail = "Next: they call a cell, and you use battleship_turn with their call as shot and your own as my_shot. A hit earns another shot; a miss passes the turn.";
  put("game.json", game);
  end(`${out.join(" ")}\n${status(game)} ${tail}\n\n${boards(game)}`);
}

if (require.main === module) main();
module.exports = { seaText, finish };
