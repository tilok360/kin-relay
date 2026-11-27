// Texas Hold'em rules engine: deck, blinds, betting rounds, side pots and hand ranking.
// Pure functions over plain objects so the table can be saved as JSON between runs.
// Runs both in the app's Node run (the table host) and in the screen (Solo play), so it needs no imports.
(function (root, factory) { if (typeof module === "object" && module.exports) module.exports = factory(); else root.Poker = factory(); })(typeof self !== "undefined" ? self : this, function () {
// Fair randomness: the platform's cryptographic generator, with rejection sampling so no card is favoured.
function randomInt(n) {
  const c = typeof crypto !== "undefined" && crypto.getRandomValues ? crypto : require("crypto").webcrypto;
  const buf = new Uint32Array(1), limit = Math.floor(4294967296 / n) * n;
  do c.getRandomValues(buf); while (buf[0] >= limit);
  return buf[0] % n;
}

const RANKS = "23456789TJQKA", SUITS = "shdc";
const RANK_NAME = { 2: "Twos", 3: "Threes", 4: "Fours", 5: "Fives", 6: "Sixes", 7: "Sevens", 8: "Eights", 9: "Nines", 10: "Tens", 11: "Jacks", 12: "Queens", 13: "Kings", 14: "Aces" };
const ONE_NAME = { 2: "Two", 3: "Three", 4: "Four", 5: "Five", 6: "Six", 7: "Seven", 8: "Eight", 9: "Nine", 10: "Ten", 11: "Jack", 12: "Queen", 13: "King", 14: "Ace" };

function newDeck() {
  const d = [];
  for (const r of RANKS) for (const s of SUITS) d.push(r + s);
  for (let i = d.length - 1; i > 0; i--) { const j = randomInt(i + 1); [d[i], d[j]] = [d[j], d[i]]; }
  return d;
}
const rankOf = (c) => RANKS.indexOf(c[0]) + 2;

// ---------- hand ranking ----------
// Returns [category, ...tiebreakers]; compare with cmpScore. 8 straight flush ... 0 high card.
function score5(cards) {
  const rs = cards.map(rankOf).sort((a, b) => b - a);
  const flush = cards.every((c) => c[1] === cards[0][1]);
  const uniq = [...new Set(rs)];
  let straightHigh = 0;
  if (uniq.length === 5) {
    if (rs[0] - rs[4] === 4) straightHigh = rs[0];
    else if (rs[0] === 14 && rs[1] === 5) straightHigh = 5; // A-2-3-4-5
  }
  const count = {}; for (const r of rs) count[r] = (count[r] || 0) + 1;
  const groups = Object.entries(count).map(([r, n]) => [n, +r]).sort((a, b) => b[0] - a[0] || b[1] - a[1]);
  if (straightHigh && flush) return [8, straightHigh];
  if (groups[0][0] === 4) return [7, groups[0][1], groups[1][1]];
  if (groups[0][0] === 3 && groups[1][0] === 2) return [6, groups[0][1], groups[1][1]];
  if (flush) return [5, ...rs];
  if (straightHigh) return [4, straightHigh];
  if (groups[0][0] === 3) return [3, groups[0][1], ...groups.slice(1).map((g) => g[1])];
  if (groups[0][0] === 2 && groups[1][0] === 2) return [2, groups[0][1], groups[1][1], groups[2][1]];
  if (groups[0][0] === 2) return [1, groups[0][1], ...groups.slice(1).map((g) => g[1])];
  return [0, ...rs];
}
function cmpScore(a, b) { for (let i = 0; i < Math.max(a.length, b.length); i++) { const d = (a[i] || 0) - (b[i] || 0); if (d) return d; } return 0; }
function bestHand(cards) {
  let best = null, bestCards = null;
  const n = cards.length;
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) for (let c = b + 1; c < n; c++) for (let d = c + 1; d < n; d++) for (let e = d + 1; e < n; e++) {
    const five = [cards[a], cards[b], cards[c], cards[d], cards[e]], s = score5(five);
    if (!best || cmpScore(s, best) > 0) { best = s; bestCards = five; }
  }
  return { score: best, cards: bestCards, name: handName(best) };
}
function handName(s) {
  if (!s) return "";
  switch (s[0]) {
    case 8: return s[1] === 14 ? "Royal flush" : `Straight flush, ${ONE_NAME[s[1]]} high`;
    case 7: return `Four of a kind, ${RANK_NAME[s[1]]}`;
    case 6: return `Full house, ${RANK_NAME[s[1]]} full of ${RANK_NAME[s[2]]}`;
    case 5: return `Flush, ${ONE_NAME[s[1]]} high`;
    case 4: return `Straight, ${ONE_NAME[s[1]]} high`;
    case 3: return `Three of a kind, ${RANK_NAME[s[1]]}`;
    case 2: return `Two pair, ${RANK_NAME[s[1]]} and ${RANK_NAME[s[2]]}`;
    case 1: return `Pair of ${RANK_NAME[s[1]]}`;
    default: return `${ONE_NAME[s[1]]} high`;
  }
}

// ---------- a hand ----------
// seats: [{id, name, stack}] in table order (only seats with chips are dealt in).
// buttonId: the seat id holding the dealer button this hand.
function startHand({ seats, buttonId, sb, bb, no }, deck = newDeck()) {
  const players = seats.filter((s) => s.stack > 0).map((s) => ({ id: s.id, name: s.name, stack: s.stack, hole: [], folded: false, allIn: false, bet: 0, total: 0, acted: false, lastAction: "" }));
  if (players.length < 2) throw new Error("At least two players with chips are needed to deal.");
  let btn = players.findIndex((p) => p.id === buttonId); if (btn < 0) btn = 0;
  const h = { no, sb, bb, button: btn, deck, board: [], street: "preflop", players, currentBet: 0, lastRaise: bb, toAct: -1, log: [], result: null };
  const n = players.length, at = (k) => (btn + k) % n;
  const sbI = n === 2 ? btn : at(1), bbI = n === 2 ? at(1) : at(2);
  post(h, sbI, sb, "small blind"); post(h, bbI, bb, "big blind");
  h.currentBet = Math.max(players[sbI].bet, players[bbI].bet, bb);
  h.lastRaise = bb;
  for (let r = 0; r < 2; r++) for (let k = 1; k <= n; k++) players[at(k)].hole.push(h.deck.pop());
  h.toAct = nextActor(h, bbI);
  if (h.toAct < 0) advance(h); // everyone all-in from the blinds
  return h;
}
function post(h, i, amount, what) {
  const p = h.players[i], pay = Math.min(amount, p.stack);
  p.stack -= pay; p.bet += pay; p.total += pay; if (p.stack === 0) p.allIn = true;
  h.log.push(`${p.name} posts the ${what} (${pay})`);
}
const canAct = (p) => !p.folded && !p.allIn;
const live = (h) => h.players.filter((p) => !p.folded);
function nextActor(h, from) {
  const n = h.players.length;
  for (let k = 1; k <= n; k++) { const i = (from + k) % n; const p = h.players[i]; if (canAct(p) && (!p.acted || p.bet < h.currentBet)) return i; }
  return -1;
}

// What the player to act may do.
function legal(h, i = h.toAct) {
  const p = h.players[i];
  if (!p || i !== h.toAct || h.street === "done") return null;
  const toCall = Math.max(0, h.currentBet - p.bet);
  const maxTo = p.bet + p.stack;
  const minTo = h.currentBet === 0 ? Math.min(h.bb, maxTo) : Math.min(h.currentBet + h.lastRaise, maxTo);
  const othersCanAct = h.players.some((q, j) => j !== i && canAct(q));
  return {
    toCall: Math.min(toCall, p.stack), canCheck: toCall === 0, canCall: toCall > 0,
    canRaise: !p.acted && maxTo > h.currentBet && othersCanAct, minTo, maxTo,
    word: h.currentBet === 0 ? "bet" : "raise",
  };
}

// type: fold | check | call | raise (to = total bet this street) | allin
function act(h, i, type, to) {
  const L = legal(h, i); if (!L) throw new Error("It isn't that player's turn.");
  const p = h.players[i];
  if (type === "check" && !L.canCheck) type = "fold";
  if (type === "call" && !L.canCall) type = "check";
  if (type === "allin") { if (L.canRaise) { type = "raise"; to = L.maxTo; } else type = L.canCall ? "call" : "check"; }
  if (type === "raise" && !L.canRaise) type = L.canCall ? "call" : "check";
  if (type === "fold") { p.folded = true; p.lastAction = "fold"; h.log.push(`${p.name} folds`); }
  else if (type === "check") { p.lastAction = "check"; h.log.push(`${p.name} checks`); }
  else if (type === "call") {
    const pay = L.toCall; p.stack -= pay; p.bet += pay; p.total += pay; if (p.stack === 0) p.allIn = true;
    p.lastAction = p.allIn ? "all-in" : "call"; h.log.push(`${p.name} calls ${pay}${p.allIn ? " and is all-in" : ""}`);
  } else if (type === "raise") {
    let target = Math.round(Number(to) || 0);
    target = Math.max(L.minTo, Math.min(L.maxTo, target));
    const pay = target - p.bet; p.stack -= pay; p.bet = target; p.total += pay; if (p.stack === 0) p.allIn = true;
    const size = target - h.currentBet;
    if (size >= h.lastRaise) { h.lastRaise = size; for (const q of h.players) if (q !== p) q.acted = false; } // a full raise reopens the action
    const word = h.currentBet === 0 ? "bets" : "raises to";
    h.currentBet = Math.max(h.currentBet, target);
    p.lastAction = p.allIn ? "all-in" : (word === "bets" ? "bet" : "raise");
    h.log.push(`${p.name} ${word} ${target}${p.allIn ? " (all-in)" : ""}`);
  }
  p.acted = true;
  if (live(h).length === 1) return finish(h);
  const nx = nextActor(h, i);
  if (nx >= 0) { h.toAct = nx; return h; }
  return advance(h);
}

// Ends the betting round: next street, run the board out, or showdown.
function advance(h) {
  if (live(h).length === 1) return finish(h);
  for (const p of h.players) { p.bet = 0; p.acted = false; p.lastAction = p.folded ? "fold" : p.allIn ? "all-in" : ""; }
  h.currentBet = 0; h.lastRaise = h.bb;
  const deal = (k) => { h.deck.pop(); for (let j = 0; j < k; j++) h.board.push(h.deck.pop()); }; // burn one, then deal
  if (h.street === "preflop") { deal(3); h.street = "flop"; }
  else if (h.street === "flop") { deal(1); h.street = "turn"; }
  else if (h.street === "turn") { deal(1); h.street = "river"; }
  else return finish(h);
  h.log.push(`${h.street[0].toUpperCase() + h.street.slice(1)}: ${h.board.join(" ")}`);
  // With fewer than two players able to bet, nobody acts again: deal on to the river.
  if (h.players.filter(canAct).length < 2) return advance(h);
  h.toAct = nextActor(h, h.button);
  return h;
}

// Pots from what each player put in; each pot goes to the best eligible hand, split on ties.
function pots(h) {
  const contrib = h.players.map((p) => p.total);
  const levels = [...new Set(h.players.filter((p) => !p.folded).map((p) => p.total))].sort((a, b) => a - b);
  const out = []; let prev = 0;
  for (const L of levels) {
    const amount = contrib.reduce((s, c) => s + Math.max(0, Math.min(c, L) - prev), 0);
    const eligible = h.players.map((p, i) => i).filter((i) => !h.players[i].folded && h.players[i].total >= L);
    if (amount > 0) out.push({ amount, eligible });
    prev = L;
  }
  const leftover = contrib.reduce((s, c) => s + Math.max(0, c - prev), 0);
  if (leftover && out.length) out[out.length - 1].amount += leftover;
  return out;
}
function finish(h) {
  h.toAct = -1;
  const alive = live(h);
  const result = { winners: [], showdown: [], pots: [] };
  if (alive.length === 1) {
    const w = alive[0], amount = h.players.reduce((s, p) => s + p.total, 0);
    w.stack += amount; result.winners.push({ id: w.id, name: w.name, amount, hand: "" });
    result.pots.push({ amount, winners: [w.id] });
    h.log.push(`${w.name} wins ${amount} uncontested`);
  } else {
    while (h.board.length < 5) { h.deck.pop(); h.board.push(h.deck.pop()); }
    const best = h.players.map((p) => (p.folded ? null : bestHand(p.hole.concat(h.board))));
    for (const [i, p] of h.players.entries()) if (!p.folded) result.showdown.push({ id: p.id, name: p.name, hole: p.hole, hand: best[i].name, cards: best[i].cards });
    const won = {};
    for (const pot of pots(h)) {
      let top = null; for (const i of pot.eligible) if (!top || cmpScore(best[i].score, top) > 0) top = best[i].score;
      const ws = pot.eligible.filter((i) => cmpScore(best[i].score, top) === 0);
      // odd chips go to the winner closest to the left of the button
      ws.sort((a, b) => ((a - h.button - 1 + h.players.length) % h.players.length) - ((b - h.button - 1 + h.players.length) % h.players.length));
      const share = Math.floor(pot.amount / ws.length); let rest = pot.amount - share * ws.length;
      for (const i of ws) { const amt = share + (rest > 0 ? 1 : 0); if (rest > 0) rest--; h.players[i].stack += amt; won[i] = (won[i] || 0) + amt; }
      result.pots.push({ amount: pot.amount, winners: ws.map((i) => h.players[i].id) });
    }
    for (const [i, amt] of Object.entries(won)) {
      const p = h.players[i]; result.winners.push({ id: p.id, name: p.name, amount: amt, hand: best[i].name });
      h.log.push(`${p.name} wins ${amt} with ${best[i].name.toLowerCase()}`);
    }
  }
  h.street = "done"; h.result = result;
  return h;
}

const potTotal = (h) => h.players.reduce((s, p) => s + p.total, 0);

// A player who leaves mid-hand folds; the hand ends at once if only one player is left in it.
function foldOut(h, id) {
  const i = h.players.findIndex((p) => p.id === id);
  if (i < 0 || h.street === "done" || h.players[i].folded) return h;
  if (i === h.toAct) return act(h, i, "fold");
  const p = h.players[i]; p.folded = true; p.lastAction = "fold"; h.log.push(`${p.name} leaves the table and folds`);
  if (live(h).length === 1) return finish(h);
  return h;
}

// Achievements, judged when a hand ends: [{ id, playerId }]. seatsAfter: [{ id, stack }] once the pots are paid.
const ACH = [
  { id: "full_house", icon: "🏠", name: "Full House", about: "Win a pot with a full house." },
  { id: "quads", icon: "🍀", name: "Four of a Kind", about: "Win a pot with four of a kind." },
  { id: "straight_flush", icon: "🌈", name: "Straight Flush", about: "Win a pot with a straight flush." },
  { id: "royal_flush", icon: "👑", name: "Royal Flush", about: "Win a pot with a royal flush." },
  { id: "seven_deuce", icon: "😎", name: "Seven-Deuce", about: "Win a pot holding a 7 and a 2, the worst starting hand." },
  { id: "all_in_survivor", icon: "🔥", name: "All-In Survivor", about: "Go all-in and win the showdown." },
  { id: "double_up", icon: "💰", name: "Double Up", about: "Win a single pot at least as big as the starting chips." },
  { id: "steal", icon: "🥷", name: "The Steal", about: "Win a pot of ten big blinds or more without a showdown." },
  { id: "last_standing", icon: "🏆", name: "Last One Standing", about: "Be the only player at a table of three or more with chips left." },
];
function handAchievements(h, settings, seatsAfter) {
  const out = [], give = (id, playerId) => { if (!out.some((a) => a.id === id && a.playerId === playerId)) out.push({ id, playerId }); };
  const r = h && h.result; if (!r) return out;
  const showdown = r.showdown.length > 1;
  for (const w of r.winners) {
    const p = h.players.find((x) => x.id === w.id); if (!p) continue;
    const hand = (w.hand || "").toLowerCase();
    if (hand.startsWith("royal flush")) give("royal_flush", w.id);
    else if (hand.startsWith("straight flush")) give("straight_flush", w.id);
    else if (hand.startsWith("four of a kind")) give("quads", w.id);
    else if (hand.startsWith("full house")) give("full_house", w.id);
    const ranks = p.hole.map(rankOf).sort((a, b) => a - b).join(",");
    if (ranks === "2,7") give("seven_deuce", w.id);
    if (showdown && p.allIn) give("all_in_survivor", w.id);
    if (settings && w.amount >= settings.start) give("double_up", w.id);
    if (!showdown && settings && w.amount >= 10 * settings.bb) give("steal", w.id);
  }
  const alive = (seatsAfter || []).filter((s) => s.stack > 0);
  if ((seatsAfter || []).length >= 3 && alive.length === 1) give("last_standing", alive[0].id);
  return out;
}

return { newDeck, randomInt, score5, bestHand, cmpScore, handName, startHand, legal, act, pots, potTotal, foldOut, ACH, handAchievements };
});
