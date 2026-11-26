// Kin Games: Table & Arcade: the runs behind the screen. game_over (from the screen) records a finished game in scores.json and
// tells the Kin how it went (kin tell, key "kin-games-<game>", three days). kin_games_record lets the Kin look up
// its record against its person when they ask.
const { execFileSync } = require("child_process");
const fs = require("fs");

const TITLES = { airhockey: "air hockey", shuffleboard: "shuffleboard", foosball: "foosball", bowling: "bowling", tabletennis: "table tennis", alleyroll: "alley roll", cuppong: "cup pong", carrom: "carrom", darts: "darts", pool: "pool", minigolf: "mini golf", slide: "slide and bump", ludo: "ludo", popdice: "Pop-Dice Dash", snakes: "snakes and ladders", yacht: "Yacht Dice", farkle: "farkle", liarsdice: "Liar's Dice", backgammon: "backgammon", tictactoe: "tic tac toe", dots: "dots and boxes", memory: "memory", mancala: "mancala" };
const kin = (...a) => execFileSync("kin", a, { encoding: "utf8" });
const end = (m, failed) => { kin("end", ...(failed ? ["--failed"] : []), String(m).slice(0, 3990)); process.exit(0); };
const put = (p, o) => execFileSync("kin", ["files", "put", p], { input: JSON.stringify(o) });
const get = (p) => { try { return JSON.parse(execFileSync("kin", ["files", "get", p], { encoding: "utf8" })); } catch { return null; } };
const clean = (s, n) => String(s == null ? "" : s).replace(/[\u0000-\u001f<>]/g, " ").trim().slice(0, n);

function recordLine(rec) {
  return Object.keys(TITLES).filter((g) => rec[g]).map((g) => { const r = rec[g]; return `${TITLES[g]}: you ${r.kin}, them ${r.you}${r.draw ? `, ${r.draw} drawn` : ""}`; }).join("; ");
}

function main() {
  let trig = {};
  try { trig = JSON.parse(fs.readFileSync(0, "utf8") || "{}"); } catch {}
  if (trig.trigger !== "action") end("Nothing to do: Kin Games runs when a game ends.");
  const input = trig.input || {}, kinId = clean(trig.kin || input.kin_id, 80);
  const scores = get("scores.json") || {};

  if (trig.action === "kin_games_record") {
    const rec = scores[kinId] || scores.any || {};
    const line = recordLine(rec), book = (get("achievements.json") || {})[kinId] || {};
    const achLine = Object.keys(book).map((g) => { const k = Object.values(book[g].kin || {}).map((a) => a.name + (a.n > 1 ? " x" + a.n : "")), y = Object.values(book[g].you || {}).map((a) => a.name + (a.n > 1 ? " x" + a.n : "")); return k.length || y.length ? `${TITLES[g] || g}: yours ${k.join(", ") || "none"}; theirs ${y.join(", ") || "none"}` : ""; }).filter(Boolean).join(". ");
    end(line ? `Your Kin Games record against your person (wins each): ${line}.${achLine ? " Achievements: " + achLine + "." : ""}` : "You haven't finished a game in Kin Games with your person yet. They can open Kin Games to play chess, checkers, Othello, backgammon, tic tac toe, memory, dots and boxes, mancala, carrom, darts, pool or mini golf with you.");
  }
  if (trig.action !== "game_over") end(`Kin Games doesn't know the action ${trig.action}.`, true);

  const game = clean(input.game, 20), result = clean(input.result, 10), detail = clean(input.detail, 200);
  if (!TITLES[game] || !["you", "kin", "draw"].includes(result)) end("That isn't a finished game Kin Games knows.", true);
  const key = kinId || "any";
  const rec = scores[key] || (scores[key] = {});
  const r = rec[game] || (rec[game] = { you: 0, kin: 0, draw: 0 });
  r[result]++;
  put("scores.json", scores);
  const name = TITLES[game];
  const how = result === "kin" ? `You beat your person at ${name}` : result === "you" ? `Your person beat you at ${name}` : `You and your person drew at ${name}`;
  const ach = Array.isArray(input.achievements) ? input.achievements.filter((a) => a && (a.who === "you" || a.who === "kin")).map((a) => ({ who: a.who, name: clean(a.name, 40) })).filter((a) => a.name) : [];
  const names = (who) => ach.filter((a) => a.who === who).map((a) => a.name);
  const achText = (names("kin").length ? ` You earned ${names("kin").join(", ")}.` : "") + (names("you").length ? ` They earned ${names("you").join(", ")}.` : "");
  const recText = ` Your record at it: you ${r.kin}, them ${r.you}${r.draw ? ", " + r.draw + " drawn" : ""}.`;
  let fact = `${how} in Kin Games${detail ? " (" + detail + ")" : ""}.`;
  if ((fact + achText + recText).length > 200) fact = `${how} in Kin Games.`;
  fact += achText;
  if ((fact + recText).length <= 200) fact += recText;
  if (fact.length > 200) fact = fact.slice(0, 197).replace(/[\s,]+\S*$/, "") + "...";
  try { kin("tell", fact.slice(0, 200), "--key", "kin-games-" + game, "--ttl", "72", ...(kinId ? ["--kin", kinId] : [])); } catch {}
  end(`Recorded: ${how.toLowerCase().replace(/^you/, "the Kin")}. ${name}: Kin ${r.kin}, person ${r.you}${r.draw ? ", drawn " + r.draw : ""}.`);
}
if (require.main === module) main();
module.exports = { recordLine };
