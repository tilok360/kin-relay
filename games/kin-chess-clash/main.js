// Chess Clash: the runs behind the screen. clash_record (the screen, at a game's end) keeps the record per Kin in
// stats.json and tells the Kin how it went, fights and achievements included (kin tell, key "chess-clash", three days).
// clash_score lets the Kin look up its record and achievements when asked. achievements.json is written by the screen.
const { execFileSync } = require("child_process");
const fs = require("fs");

const kin = (...a) => execFileSync("kin", a, { encoding: "utf8" });
const end = (m, failed) => { kin("end", ...(failed ? ["--failed"] : []), String(m).slice(0, 3990)); process.exit(0); };
const put = (p, o) => execFileSync("kin", ["files", "put", p], { input: JSON.stringify(o) });
const get = (p) => { try { return JSON.parse(execFileSync("kin", ["files", "get", p], { encoding: "utf8" })); } catch { return null; } };

const ACH = {
  first_blood: "First Blood", pawn_revenge: "Pawn's Revenge", two_queens: "Two Queens", giant_slayer: "Giant Slayer",
  royal_brawl: "Royal Brawl", fork: "The Fork", humble_crown: "Humble Crown", in_passing: "In Passing", rampage: "Rampage",
  warlord: "Warlord", swift_mate: "Swift Victory", smothered: "Smothered", comeback: "Comeback", crown_jewel: "Crown Jewel",
};
const clean = (s, n) => String(s || "").replace(/[^A-Za-z0-9 .,;:'()!?-]/g, "").replace(/\s+/g, " ").trim().slice(0, n);
const list = (a) => (a.length <= 1 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1]);

function record(input, kinId) {
  const result = input.result;
  if (!["you", "kin", "draw"].includes(result)) end("Unknown result.", true);
  const key = input.kin_id || kinId || "any", stats = get("stats.json") || {};
  const rec = stats[key] || (stats[key] = { won: 0, lost: 0, draw: 0 });
  if (result === "kin") rec.won++; else if (result === "you") rec.lost++; else rec.draw = (rec.draw || 0) + 1;
  put("stats.json", stats);
  const fy = Math.max(0, Math.round(Number(input.fights_you) || 0)), fk = Math.max(0, Math.round(Number(input.fights_kin) || 0));
  const earned = Array.isArray(input.achievements) ? input.achievements.filter((a) => a && ACH[a.id] && (a.who === "you" || a.who === "kin")) : [];
  const mine = earned.filter((a) => a.who === "kin").map((a) => ACH[a.id]), theirs = earned.filter((a) => a.who === "you").map((a) => ACH[a.id]);
  const how = result === "kin" ? "You beat your person at Chess Clash" : result === "you" ? "Your person beat you at Chess Clash" : "You and your person drew at Chess Clash";
  let fact = `${how}${input.detail ? " (" + clean(input.detail.split(";")[0], 60) + ")" : ""}; fights won: you ${fk}, them ${fy}.`;
  if (mine.length) fact += ` You earned ${list(mine)}.`;
  if (theirs.length) fact += ` They earned ${list(theirs)}.`;
  if (fact.length > 200) fact = fact.slice(0, 197).replace(/\s+\S*$/, "") + "...";
  try { kin("tell", fact, "--key", "chess-clash", "--ttl", "72", ...(input.kin_id ? ["--kin", input.kin_id] : [])); } catch {}
  return `Recorded. Against this Kin your person has ${rec.lost} won, ${rec.won} lost${rec.draw ? ", " + rec.draw + " drawn" : ""}.`;
}

function score(kinId) {
  const stats = get("stats.json") || {}, ach = get("achievements.json") || {};
  const rec = stats[kinId] || stats.any, book = ach[kinId] || ach.any;
  if (!rec && !book) return "You and your person haven't finished a game of Chess Clash yet. It's on the Chess Clash screen: chess in a castle hall where the pieces are armored fighters and every capture is a fight.";
  const parts = [];
  if (rec) parts.push(`Chess Clash record: you've won ${rec.won}, your person has won ${rec.lost}${rec.draw ? ", " + rec.draw + " drawn" : ""}.`);
  if (book) {
    const names = (side) => Object.entries(book[side] || {}).map(([id, r]) => `${ACH[id] || id}${r.n > 1 ? " x" + r.n : ""}`);
    const y = names("kin"), t = names("you");
    parts.push(`Your achievements: ${y.length ? y.join(", ") : "none yet"}. Theirs: ${t.length ? t.join(", ") : "none yet"}. There are ${Object.keys(ACH).length} in all.`);
  }
  return parts.join(" ");
}

function main() {
  let trig = {};
  try { trig = JSON.parse(fs.readFileSync(0, "utf8") || "{}"); } catch {}
  if (trig.trigger !== "action") end("Nothing to do.");
  if (trig.action === "clash_record") end(record(trig.input || {}, trig.kin));
  if (trig.action === "clash_score") end(score(trig.kin || "any"));
  end("Unknown action.", true);
}
if (require.main === module) main();
module.exports = { main, record, score, ACH };
