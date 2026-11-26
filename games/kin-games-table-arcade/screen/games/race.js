// A shared engine for roll-and-race games (Ludo, Pop-Dice Dash): four colours, four tokens each, one die.
// Token progress: -1 waiting at base, 0..lap-1 on the shared track (from the colour's own start), then the home lane,
// and lap + homeLen means finished.
(function (root) {
  "use strict";
  function make(cfg) {
    const { track, lap, homeLen, starts, safe = [], leave = [6], stackOwn = true, extra6 = true } = cfg, FIN = lap + homeLen, SAFE = new Set(safe);
    const abs = (c, p) => (p >= 0 && p < lap ? (starts[c] + p) % track : -1);
    function setup(first, names) {
      return { seats: ["you", "bot", "kin", "bot"], names: names || [null, "Green", null, "Blue"], turn: first === "you" ? 0 : 2, tok: [0, 1, 2, 3].map(() => [-1, -1, -1, -1]), roll: 0, sixes: 0, ply: 0, last: null, done: [] };
    }
    const finished = (S, c) => S.tok[c].every((p) => p === FIN);
    function target(S, c, k, r) {
      const p = S.tok[c][k];
      if (p === FIN) return null;
      if (p < 0) { if (!leave.includes(r)) return null; const a = abs(c, 0); if (!stackOwn && S.tok[c].some((q) => q >= 0 && q < lap && abs(c, q) === a)) return null; return 0; }
      const np = p + r; if (np > FIN) return null;
      if (!stackOwn) { if (np < lap ? S.tok[c].some((q, j) => j !== k && q >= 0 && q < lap && abs(c, q) === abs(c, np)) : S.tok[c].some((q, j) => j !== k && q === np && np !== FIN)) return null; }
      return np;
    }
    function moves(S) {
      if (over(S)) return [];
      if (!S.roll) return [{ roll: 0 }];
      const c = S.turn, out = []; for (let k = 0; k < 4; k++) if (target(S, c, k, S.roll) != null && !out.some((m) => S.tok[c][m.t] === S.tok[c][k] && S.tok[c][k] < 0)) out.push({ t: k });
      return out.length ? out : [{ pass: true }];
    }
    function nextTurn(S) { let t = S.turn; for (let k = 0; k < 4; k++) { t = (t + 1) % 4; if (!finished(S, t)) break; } return t; }
    function apply(S, m) {
      if ("roll" in m) { const v = m.roll || 1 + Math.floor(Math.random() * 6); return { ...S, roll: v, sixes: v === 6 ? S.sixes + 1 : 0, last: { roll: v, c: S.turn } }; }
      const tok = S.tok.map((a) => a.slice()), c = S.turn, done = S.done.slice();
      let T = { ...S, tok, ply: S.ply + 1 }, hit = [];
      if (m.t != null) {
        const from = tok[c][m.t], np = target(S, c, m.t, S.roll); tok[c][m.t] = np;
        if (np < lap) { const a = abs(c, np); if (!SAFE.has(a)) for (let o = 0; o < 4; o++) if (o !== c) tok[o].forEach((q, j) => { if (q >= 0 && q < lap && abs(o, q) === a) { tok[o][j] = -1; hit.push({ o, j, from: q }); } }); }
        if (tok[c].every((p) => p === FIN) && !done.includes(c)) done.push(c);
        T.last = { c, k: m.t, from, to: np, hit, roll: S.roll };
      } else T.last = { c, pass: true, roll: S.roll };
      const again = extra6 && S.roll === 6 && S.sixes < 3 && m.t != null && !finished(T, c);
      return { ...T, done, roll: 0, sixes: again ? S.sixes : 0, turn: again ? c : nextTurn(T) };
    }
    // The game is decided when you or your opponent (seats 0 and 2) gets all four tokens home.
    function over(S) {
      const w = S.done.find((c) => c === 0 || c === 2); if (w == null) return null;
      const place = S.done.indexOf(w) + 1;
      return { result: S.seats[w], detail: `${w === 0 ? "you" : "they"} got all four home${place > 1 ? ` (${place === 2 ? "second" : "third"} overall)` : ""}` };
    }
    function rank(S, level) {
      const ms = moves(S); if (!("t" in ms[0])) return ms.map((m) => ({ m, label: m.roll != null ? "roll" : "no move: pass", score: 0 }));
      const c = S.turn, r = S.roll;
      const danger = (a) => { let d = 0; if (SAFE.has(a)) return 0; for (let o = 0; o < 4; o++) if (o !== c) S.tok[o].forEach((q) => { if (q >= 0 && q < lap) { const dist = (a - abs(o, q) + track) % track; if (dist >= 1 && dist <= 6) d++; } else if (q < 0 && abs(o, 0) === a) d += 0.5; }); return d; };
      return ms.map((m) => {
        const p = S.tok[c][m.t], np = target(S, c, m.t, r); let sc = r * 0.5;
        if (p < 0) sc += 14; if (np === FIN) sc += 30; else if (np >= lap && p < lap) sc += 12;
        if (np < lap) { const a = abs(c, np); for (let o = 0; o < 4; o++) if (o !== c && !SAFE.has(a)) S.tok[o].forEach((q) => { if (q >= 0 && q < lap && abs(o, q) === a) sc += 18 + q * 0.4 + (o === 0 || o === 2 ? 6 : 0); }); if (level !== "beginner") sc -= danger(a) * (3 + np * 0.15); if (SAFE.has(a)) sc += 4; }
        if (p >= 0 && p < lap && level !== "beginner") sc += danger(abs(c, p)) * (2 + p * 0.12);
        return { m, label: p < 0 ? "bring a new token out" : np === FIN ? `bring token ${m.t + 1} home` : `move token ${m.t + 1} ${r} spaces`, score: sc + Math.random() * 0.5 };
      }).sort((x, y) => y.score - x.score);
    }
    const autoMove = (S) => { const ms = moves(S); if (!ms.length) return null; if (ms[0].pass) return ms[0]; if ("roll" in ms[0] && S.seats[S.turn] !== "you") return { roll: 1 + Math.floor(Math.random() * 6) }; if ("t" in ms[0] && ms.length === 1 && S.tok[S.turn].filter((p) => p >= 0 && p < FIN).length + (S.tok[S.turn].includes(-1) ? 1 : 0) <= 1) return ms[0]; return null; };
    return { cfg, FIN, abs, setup, moves, apply, over, rank, autoMove, finished, target };
  }
  const E = { make };
  if (typeof module === "object" && module.exports) { module.exports = E; return; }
  root.KGRace = E;
})(typeof self !== "undefined" ? self : this);
