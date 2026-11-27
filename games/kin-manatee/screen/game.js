// Cards Against Kin-manatee: the rules, with no I/O. main.js keeps the state G inside table.json.
// Basic rules: everyone holds 10 answer cards. Each round the Manatee Czar reveals a prompt card; everyone
// else plays one answer face down (two, in reading order, for a Pick 2). The Czar sees them shuffled and
// anonymous, picks the funniest, and its player gets a point. The Czar passes on; everyone draws back to 10.
// Gambling: bet a point to play an extra answer; if you lose, the round's winner takes your point.
// House rules (host's choice): Random Manatee, Rebooting the Universe, Packing Heat, Meritocracy,
// Wheaton's Law, Never Have I Ever, Happy Ending (a closing haiku card ends the game).
(function (root, factory) { if (typeof module === "object" && module.exports) module.exports = factory(typeof require === "function" ? require("./cards.js") : root.Cards); else root.Game = factory(root.Cards); })(typeof self !== "undefined" ? self : this, function (C) {

// Fair shuffles and deals: the platform's cryptographic generator, in [0, 1).
function secureRng() {
  const c = typeof crypto !== "undefined" && crypto.getRandomValues ? crypto : require("crypto").webcrypto;
  const b = new Uint32Array(2); c.getRandomValues(b);
  return (b[0] * 2097152 + (b[1] >>> 11)) / 9007199254740992;
}
const RANDO = "rando"; // the Random Manatee's seat id
const DEF_RULES = () => ({ handSize: 10, target: 7, rando: false, gambling: true, reboot: false, packingHeat: false, meritocracy: false, wheaton: false, neverHave: false });

const shuffle = (a, rng) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const range = (n) => Array.from({ length: n }, (_, i) => i);

// A new game for these seats ([{id, kind, name}]), with optional custom cards from the host.
function newGame(seats, rules, rng = secureRng, custom = {}) {
  const prompts = C.PROMPTS.concat(custom.prompts || []).map((t) => ({ text: t, pick: Math.min(3, C.blanks(t)) }));
  const answers = C.ANSWERS.concat(custom.answers || []);
  const G = {
    rules: { ...DEF_RULES(), ...(rules || {}) }, prompts, answers,
    promptDeck: shuffle(range(prompts.length), rng), promptDiscard: [],
    answerDeck: shuffle(range(answers.length), rng), answerDiscard: [],
    hands: {}, scores: {}, round: 0, czar: "", phase: "lobby", prompt: null, choices: [],
    plays: {}, bets: {}, reveal: [], result: null, ending: false, over: null, log: [],
  };
  syncSeats(G, seats, rng);
  return G;
}
function drawAnswer(G, rng) {
  if (!G.answerDeck.length) { G.answerDeck = shuffle(G.answerDiscard, rng); G.answerDiscard = []; }
  return G.answerDeck.length ? G.answerDeck.pop() : null;
}
function drawPrompt(G, rng) {
  if (!G.promptDeck.length) { G.promptDeck = shuffle(G.promptDiscard, rng); G.promptDiscard = []; }
  return G.promptDeck.pop();
}
function fillHand(G, id, rng, size = G.rules.handSize) {
  const h = (G.hands[id] = G.hands[id] || []);
  while (h.length < size) { const c = drawAnswer(G, rng); if (c == null) break; h.push(c); }
}
// Seats that joined get a hand and a score; seats that left give their cards back.
function syncSeats(G, seats, rng = secureRng) {
  const ids = new Set(seats.map((s) => s.id));
  for (const id of Object.keys(G.hands)) if (!ids.has(id)) { G.answerDiscard.push(...G.hands[id]); delete G.hands[id]; delete G.plays[id]; delete G.bets[id]; }
  for (const s of seats) { if (G.scores[s.id] == null) G.scores[s.id] = 0; fillHand(G, s.id, rng); }
  if (G.rules.rando && G.scores[RANDO] == null) G.scores[RANDO] = 0;
}
const promptOf = (G) => (G.prompt == null ? null : G.prompt === "haiku" ? { text: C.HAIKU, pick: 3 } : G.prompts[G.prompt]);
const pickOf = (G) => (promptOf(G) || { pick: 1 }).pick;
const players = (G, seats) => seats.filter((s) => s.id !== G.czar && G.hands[s.id]);
const minSeats = (G) => (G.rules.rando ? 2 : 3);

// The next Czar: the last winner under Meritocracy, otherwise the next seat around the table.
function nextCzar(G, seats, rng) {
  if (!G.czar) return seats[Math.floor(rng() * seats.length)].id;
  const w = G.result && G.result.winner;
  if (G.rules.meritocracy && w && w !== RANDO && seats.some((s) => s.id === w)) return w;
  const i = seats.findIndex((s) => s.id === G.czar);
  return seats[(i + 1) % seats.length].id;
}
// Starts the next round. Returns "" or why it cannot start.
function startRound(G, seats, rng = secureRng) {
  if (G.phase === "over") return "The game is over. Start a new game.";
  if (seats.length < minSeats(G)) return `You need at least ${minSeats(G)} players${G.rules.rando ? "" : " (or turn on the Random Manatee)"} to play.`;
  syncSeats(G, seats, rng);
  // the last round's cards go to the discard pile
  for (const id of Object.keys(G.plays)) for (const set of G.plays[id]) G.answerDiscard.push(...set);
  if (G.prompt != null && G.prompt !== "haiku") G.promptDiscard.push(G.prompt);
  G.plays = {}; G.bets = {}; G.reveal = []; G.result = null;
  G.czar = nextCzar(G, seats, rng);
  G.round++;
  if (G.ending) { G.prompt = "haiku"; G.choices = []; G.phase = "picking"; }
  else if (G.rules.wheaton) { G.choices = [drawPrompt(G, rng), drawPrompt(G, rng)]; G.prompt = null; G.phase = "choosing"; return ""; }
  else { G.prompt = drawPrompt(G, rng); G.choices = []; G.phase = "picking"; }
  beginPicking(G, seats, rng);
  return "";
}
function beginPicking(G, seats, rng) {
  // Packing Heat: everyone draws one extra card before a Pick 2 (or more).
  if (G.rules.packingHeat && pickOf(G) >= 2) for (const p of players(G, seats)) fillHand(G, p.id, rng, G.hands[p.id].length + 1);
  // a hand smaller than the pick (a small deck) is topped up so everyone can answer
  for (const p of players(G, seats)) fillHand(G, p.id, rng, Math.max(G.hands[p.id].length, pickOf(G)));
}
// Wheaton's Law: the Czar keeps one of two prompts; the other goes to the bottom of the pile.
function choosePrompt(G, seatId, which, seats, rng = secureRng) {
  if (G.phase !== "choosing" || seatId !== G.czar) return "It is not your turn to choose.";
  const i = which === 1 ? 1 : 0;
  G.prompt = G.choices[i]; G.promptDeck.unshift(G.choices[1 - i]); G.choices = []; G.phase = "picking";
  beginPicking(G, seats, rng);
  return "";
}
// A player plays cards (ids from their hand, in reading order). gamble: an extra play that bets a point.
function play(G, seatId, cardIds, gamble = false) {
  if (G.phase !== "picking") return "Answers are closed for this round.";
  if (seatId === G.czar) return "The Czar doesn't play this round.";
  const hand = G.hands[seatId]; if (!hand) return "You are not in this game.";
  const ids = (Array.isArray(cardIds) ? cardIds : [cardIds]).map(Number);
  if (ids.length !== pickOf(G) || new Set(ids).size !== ids.length || !ids.every((c) => hand.includes(c))) return `Play exactly ${pickOf(G)} card${pickOf(G) > 1 ? "s" : ""} from your hand.`;
  const done = G.plays[seatId] || [];
  if (gamble) {
    if (!G.rules.gambling) return "Gambling is off at this table.";
    if (!done.length) return "Play your first answer before betting on an extra one.";
    if (G.bets[seatId]) return "You can bet only once a round.";
    if ((G.scores[seatId] || 0) < 1) return "You need a point to bet.";
    G.bets[seatId] = true;
  } else if (done.length) return "You already played this round.";
  G.hands[seatId] = hand.filter((c) => !ids.includes(c));
  G.plays[seatId] = done.concat([ids]);
  return "";
}
const allPlayed = (G, seats) => players(G, seats).every((p) => (G.plays[p.id] || []).length);
// Answers are revealed in a shuffled, anonymous order. With nothing played, the round is void.
function toJudging(G, seats, rng = secureRng) {
  if (G.phase !== "picking") return;
  if (G.rules.rando) { const set = []; for (let i = 0; i < pickOf(G); i++) { const c = drawAnswer(G, rng); if (c != null) set.push(c); } if (set.length) G.plays[RANDO] = [set]; }
  const reveal = [];
  for (const [id, sets] of Object.entries(G.plays)) sets.forEach((set, i) => reveal.push({ key: Math.floor(rng() * 1e9).toString(36) + reveal.length, seat: id, i, cards: set }));
  if (!reveal.some((r) => r.seat !== RANDO)) { G.phase = "result"; G.result = { void: true, text: "Nobody played this round." }; refill(G, seats, rng); return; }
  G.reveal = shuffle(reveal, rng);
  G.phase = "judging";
}
// The Czar picks a winning answer by its key. Scores the round and checks for the end of the game.
function judge(G, seatId, key, seats, rng = secureRng) {
  if (G.phase !== "judging") return "There is nothing to judge right now.";
  if (seatId !== G.czar && seatId !== "*") return "Only the Czar picks the winner.";
  const r = G.reveal.find((x) => x.key === key); if (!r) return "That answer isn't on the table.";
  const w = r.seat, moved = [];
  G.scores[w] = (G.scores[w] || 0) + 1;
  // Gambling: a bettor who did not win pays a point to the winner.
  for (const b of Object.keys(G.bets)) if (b !== w) { G.scores[b] = Math.max(0, (G.scores[b] || 0) - 1); G.scores[w]++; moved.push(b); }
  G.result = { winner: w, key, i: r.i, cards: r.cards, prompt: promptOf(G).text, text: fill(promptOf(G).text, r.cards.map((c) => G.answers[c])), paid: moved };
  G.phase = "result";
  refill(G, seats, rng);
  const t = G.rules.target;
  if (G.prompt === "haiku") G.over = { reason: "haiku", leaders: leaders(G) };
  else if (t && G.scores[w] >= t) G.over = { reason: "target", leaders: [w] };
  if (G.over) G.phase = "over";
  return "";
}
function refill(G, seats, rng) { for (const s of seats) if (G.hands[s.id]) fillHand(G, s.id, rng); }
function leaders(G) { const top = Math.max(0, ...Object.values(G.scores)); return Object.keys(G.scores).filter((id) => G.scores[id] === top && top > 0); }
// Time ran out: picking closes with whatever was played; a Czar who runs out of time has a random winner picked.
function timeoutPicking(G, seats, rng = secureRng) { toJudging(G, seats, rng); }
function timeoutJudging(G, seats, rng = secureRng) { if (G.phase === "judging" && G.reveal.length) judge(G, "*", G.reveal[Math.floor(rng() * G.reveal.length)].key, seats, rng); }
function timeoutChoosing(G, seats, rng = secureRng) { if (G.phase === "choosing") choosePrompt(G, G.czar, rng() < 0.5 ? 0 : 1, seats, rng); }
// Rebooting the Universe: trade a point to swap any cards. Never Have I Ever: discard cards you don't understand.
function swapCards(G, seatId, cardIds, rng = secureRng, cost = 0) {
  const hand = G.hands[seatId]; if (!hand) return "You are not in this game.";
  const ids = (Array.isArray(cardIds) ? cardIds : [cardIds]).map(Number).filter((c) => hand.includes(c));
  if (!ids.length) return "Choose cards from your hand first.";
  if (cost && (G.scores[seatId] || 0) < cost) return "You need a point to reboot the universe.";
  G.scores[seatId] -= cost;
  G.hands[seatId] = hand.filter((c) => !ids.includes(c)); G.answerDiscard.push(...ids);
  fillHand(G, seatId, rng);
  return "";
}
// The prompt with its blanks filled in, for reading out.
function fill(text, cards) {
  let i = 0;
  const out = String(text).replace(/____/g, (m, at, s) => {
    const c = cards[i++]; if (c == null) return "____";
    let a = String(c).replace(/([.!])(["”]?)$/, "$2");
    // mid-sentence, "A spa day" reads as "a spa day" (but "I", "Mom's" and the like stay as they are)
    const start = at === 0 || /[.!?:"/]\s*$/.test(s.slice(0, at));
    if (!start && !/^(I\b|I'm|I'd|I'll|I've|Mom|Dad\b|Dad's|Kin\b|Kin's|Kindroid|Taco Tuesday|Rome|Ancient)/.test(a)) a = a[0].toLowerCase() + a.slice(1);
    return a;
  });
  return i === 0 && cards.length ? `${text} ${cards.join(" ")}` : out;
}

// Achievements, judged once per round result (and at the game's end): [{ id, seat }]. Kept in G.track.
const ACH = [
  { id: "opening_laugh", icon: "😂", name: "Opening Laugh", about: "Win the first round of a game." },
  { id: "hat_trick", icon: "🎩", name: "Hat Trick", about: "Win three rounds in a row." },
  { id: "jackpot", icon: "💰", name: "Jackpot", about: "Collect a point from someone's lost bet." },
  { id: "double_or_nothing", icon: "🎲", name: "Double or Nothing", about: "Win a round with the extra answer you bet on." },
  { id: "czars_darling", icon: "👑", name: "Czar's Darling", about: "Win twice under the same Czar in one game." },
  { id: "champion", icon: "🏆", name: "Manatee Champion", about: "Win a game." },
  { id: "landslide", icon: "🌊", name: "Landslide", about: "Win a game by four points or more." },
];
function roundAchievements(G) {
  const r = G.result, out = [];
  if (!r || r.void || !r.winner) return out;
  const t = G.track || (G.track = { rounds: 0, streak: { w: "", n: 0 }, czar: {}, last: "" });
  if (t.last === r.key) return out;      // already judged
  t.last = r.key; t.rounds++;
  const w = r.winner;
  t.streak = t.streak.w === w ? { w, n: t.streak.n + 1 } : { w, n: 1 };
  if (w === RANDO) return out;
  const give = (id, seat) => out.push({ id, seat });
  if (t.rounds === 1) give("opening_laugh", w);
  if (t.streak.n === 3) give("hat_trick", w);
  if (r.paid && r.paid.length) give("jackpot", w);
  if (r.i === 1) give("double_or_nothing", w);
  const k = G.czar + ">" + w; t.czar[k] = (t.czar[k] || 0) + 1;
  if (t.czar[k] === 2) give("czars_darling", w);
  if (G.over && G.over.leaders.length === 1 && G.over.leaders[0] !== RANDO) {
    const top = G.over.leaders[0], mine = G.scores[top] || 0, next = Math.max(0, ...Object.entries(G.scores).filter(([id]) => id !== top).map(([, s]) => s));
    give("champion", top);
    if (mine - next >= 4) give("landslide", top);
  }
  return out;
}

return { ACH, roundAchievements, secureRng, RANDO, DEF_RULES, newGame, syncSeats, startRound, choosePrompt, play, allPlayed, toJudging, judge, timeoutPicking, timeoutJudging, timeoutChoosing, swapCards, fill, promptOf, pickOf, players, leaders, shuffle };
});
