// Computer players for Kin Hold'em. Used on screen for Solo play (free, no Kin involved) and by the table host
// to fill empty seats (also free). A bot sees only what a person at its seat would: its own cards, the board,
// the bets and the pot. It never looks at anyone else's hole cards or the rest of the deck.
(function (root, factory) { if (typeof module === "object" && module.exports) module.exports = factory(require("./poker.js")); else root.Bots = factory(root.Poker); })(typeof self !== "undefined" ? self : this, function (P) {
const rankNum = (c) => "23456789TJQKA".indexOf(c[0]) + 2;

// How each style plays. play: how strong a hand it needs to get involved (0..1 pseudo-equity);
// aggr: how often it raises instead of calling; bluff: how often it bets with nothing; stick: how much worse than
// the pot odds it will still call; size: bet size as a share of the pot.
const STYLES = {
  tight:      { label: "Tight",      about: "Folds most hands and bets when it has one.",       play: 0.52, aggr: 0.45, bluff: 0.04, stick: -0.02, size: 0.65 },
  loose:      { label: "Loose",      about: "Plays lots of hands and likes to see a flop.",     play: 0.40, aggr: 0.30, bluff: 0.10, stick: 0.06,  size: 0.55 },
  aggressive: { label: "Aggressive", about: "Bets and raises often, and bluffs.",               play: 0.44, aggr: 0.75, bluff: 0.22, stick: 0.00,  size: 0.85 },
  station:    { label: "Calling station", about: "Calls almost anything and rarely raises.",    play: 0.38, aggr: 0.10, bluff: 0.02, stick: 0.14,  size: 0.45 },
  balanced:   { label: "Balanced",   about: "A bit of everything, hard to read.",               play: 0.46, aggr: 0.50, bluff: 0.10, stick: 0.02,  size: 0.70 },
};
const LEVELS = {
  easy:   { label: "Easy",   iters: 0,   noise: 0.16, think: 0 },
  normal: { label: "Normal", iters: 90,  noise: 0.06, think: 1 },
  hard:   { label: "Hard",   iters: 240, noise: 0.015, think: 2 },
};
const NAMES = { tight: ["Marlowe", "Ines"], loose: ["Dex", "Pia"], aggressive: ["Rex", "Vera"], station: ["Gus", "Mabel"], balanced: ["Juno", "Theo"] };

// Rough starting-hand strength as an equity-like number: AA about .85, 72 offsuit about .32.
function preflop(hole) {
  const [a, b] = hole.map(rankNum).sort((x, y) => y - x), suited = hole[0][1] === hole[1][1], gap = a - b;
  let s = 0.30 + (a - 2) * 0.012 + (b - 2) * 0.012;
  if (a === b) s = 0.50 + (a - 2) * 0.03;
  else { if (suited) s += 0.035; if (gap === 1) s += 0.03; else if (gap === 2) s += 0.01; else if (gap >= 4) s -= 0.03; if (a >= 12) s += 0.04; }
  return Math.max(0.28, Math.min(0.88, s));
}
// Win chance against random hands, by dealing out the rest of the board many times.
function equity(hole, board, opponents, iters, rng) {
  const used = new Set(hole.concat(board)), rest = [];
  for (const r of "23456789TJQKA") for (const s of "shdc") if (!used.has(r + s)) rest.push(r + s);
  let score = 0;
  for (let n = 0; n < iters; n++) {
    const need = 5 - board.length + 2 * opponents;
    for (let i = 0; i < need; i++) { const j = i + Math.floor(rng() * (rest.length - i)); const t = rest[i]; rest[i] = rest[j]; rest[j] = t; }
    const full = board.concat(rest.slice(0, 5 - board.length));
    const mine = P.bestHand(hole.concat(full)).score; let share = 1;
    for (let o = 0; o < opponents; o++) {
      const c = P.cmpScore(mine, P.bestHand(rest.slice(5 - board.length + 2 * o, 5 - board.length + 2 * o + 2).concat(full)).score);
      if (c < 0) { share = 0; break; } if (c === 0) share = share * 0.5;
    }
    score += share;
  }
  return score / iters;
}
// Postflop strength without simulation (easy bots): made-hand category plus a nudge for the top card.
function quick(hole, board) {
  const sc = P.bestHand(hole.concat(board)).score, top = Math.max(...hole.map(rankNum));
  return Math.min(0.97, [0.28, 0.5, 0.7, 0.78, 0.84, 0.88, 0.93, 0.97, 0.99][sc[0]] + (sc[0] === 0 ? (top - 8) * 0.01 : 0));
}

// profile: { style, level }. h: the hand in progress; i: the bot's index in h.players.
// Returns { type, to } ready for Poker.act.
function decide(h, i, profile, rng = Math.random) {
  const L = P.legal(h, i), p = h.players[i], st = STYLES[profile.style] || STYLES.balanced, lv = LEVELS[profile.level] || LEVELS.normal;
  if (!L) return null;
  const foes = h.players.filter((q, j) => j !== i && !q.folded).length;
  const pot = P.potTotal(h), bbs = p.stack / h.bb;
  let s = h.board.length === 0 ? preflop(p.hole) : lv.iters ? equity(p.hole, h.board, Math.max(1, foes), lv.iters, rng) : quick(p.hole, h.board);
  if (h.board.length === 0) s -= Math.max(0, foes - 1) * 0.018;            // more opponents, weaker hands
  s += (rng() - 0.5) * 2 * lv.noise;                                       // easier bots misjudge by more
  if (lv.think === 2 && h.board.length === 0) { const late = (i - h.button + h.players.length) % h.players.length; if (late === 0) s += 0.02; } // position matters to hard bots
  const raiseTo = (frac) => Math.max(L.minTo, Math.min(L.maxTo, Math.round((h.currentBet + L.toCall + pot * frac) / (h.bb >= 20 ? 5 : 1)) * (h.bb >= 20 ? 5 : 1)));
  const shove = () => ({ type: L.canRaise ? "allin" : L.canCall ? "call" : "check" });
  if (L.toCall === 0) {                                                    // free to check or bet
    const value = s > st.play + 0.14 + (foes > 2 ? 0.05 : 0);
    if (L.canRaise && ((value && rng() < 0.55 + st.aggr * 0.4) || (rng() < st.bluff * (foes > 2 ? 0.4 : 1) && lv.think > 0))) {
      const big = s > 0.8 ? 1.0 : st.size; return { type: "raise", to: raiseTo(big * (0.8 + rng() * 0.4)) };
    }
    return { type: "check" };
  }
  const odds = L.toCall / (pot + L.toCall), faced = L.toCall / Math.max(1, p.stack + p.bet);
  if (bbs <= 10 && s > st.play + 0.08) return shove();                      // short stack: push or fold
  if (s > 0.80 && L.canRaise && rng() < 0.55 + st.aggr * 0.4) return rng() < 0.12 && lv.think ? shove() : { type: "raise", to: raiseTo(st.size * 1.4) };
  if (s > st.play + 0.12 && L.canRaise && rng() < st.aggr * 0.55) return { type: "raise", to: raiseTo(st.size * 1.2) };
  const need = Math.max(odds + st.stick * (1 - faced), h.board.length ? 0 : st.play - 0.04);
  if (s >= need + (faced > 0.5 ? 0.08 : 0)) return { type: "call" };
  if (lv.think && L.canRaise && rng() < st.bluff * 0.6 && foes <= 2) return { type: "raise", to: raiseTo(st.size * 1.3) };
  return { type: "fold" };
}

// Seat the computer players: n bots (0..5) with differing styles; `mix` lists styles to cycle through.
function roster(n, level, mix) {
  const styles = mix && mix.length ? mix : ["tight", "loose", "aggressive", "station", "balanced"];
  const used = {}; const out = [];
  for (let k = 0; k < n; k++) {
    const style = styles[k % styles.length], list = NAMES[style], used_n = used[style] = (used[style] || 0) + 1;
    out.push({ style, level, name: list[(used_n - 1) % list.length] });
  }
  return out;
}
return { STYLES, LEVELS, preflop, equity, decide, roster };
});
