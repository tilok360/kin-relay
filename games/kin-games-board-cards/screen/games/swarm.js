// Swarm: a 7 x 7 clone-and-leap game. Grow into a next-door square (copy) or leap two squares (move);
// every enemy piece touching where you land turns to your colour. Most pieces when the board fills wins.
(function (root) {
  "use strict";
  const N = 7, other = (p) => (p === "you" ? "kin" : "you");
  const near = (i, d) => { const r = Math.floor(i / N), c = i % N, out = []; for (let dr = -d; dr <= d; dr++) for (let dc = -d; dc <= d; dc++) { const rr = r + dr, cc = c + dc; if ((dr || dc) && Math.max(Math.abs(dr), Math.abs(dc)) === d && rr >= 0 && rr < N && cc >= 0 && cc < N) out.push(rr * N + cc); } return out; };
  const N1 = [...Array(N * N).keys()].map((i) => near(i, 1)), N2 = [...Array(N * N).keys()].map((i) => near(i, 2));
  const NAME = (i) => "abcdefg"[i % N] + (N - Math.floor(i / N));
  function setup(first) {
    const b = Array(N * N).fill(""); b[0] = b[48] = "you"; b[6] = b[42] = "kin";
    if (Math.random() < 0.5) for (const i of [16, 18, 30, 32].slice(0, 2)) b[i] = "x"; // a couple of blocked squares for variety
    return { seats: first === "you" ? ["you", "kin"] : ["kin", "you"], turn: 0, b, ply: 0, last: null };
  }
  const who = (S) => S.seats[S.turn];
  function raw(b, me) {
    const out = [], seen = new Set();
    b.forEach((x, f) => { if (x !== me) return; for (const t of N1[f]) if (!b[t] && !seen.has(t)) { seen.add(t); out.push({ f: -1, t }); } for (const t of N2[f]) if (!b[t]) out.push({ f, t }); });
    return out;
  }
  const count = (b, p) => b.filter((x) => x === p).length;
  function moves(S) { if (over(S)) return []; const m = raw(S.b, who(S)); return m.length ? m : [{ pass: true }]; }
  function play(b, m, me) { const nb = b.slice(); if (m.pass) return nb; if (m.f >= 0) nb[m.f] = ""; nb[m.t] = me; for (const j of N1[m.t]) if (nb[j] === other(me)) nb[j] = me; return nb; }
  const apply = (S, m) => ({ ...S, b: play(S.b, m, who(S)), turn: 1 - S.turn, ply: S.ply + 1, last: m });
  function over(S) {
    const y = count(S.b, "you"), k = count(S.b, "kin"), empty = S.b.filter((x) => !x).length;
    const end = !y || !k || !empty || (!raw(S.b, "you").length && !raw(S.b, "kin").length) || S.ply >= 400;
    if (!end) return null;
    // Empty squares nobody can reach go to whoever can still move there.
    let fy = y, fk = k; if (empty && y && k) { if (raw(S.b, "you").length) fy += empty; else if (raw(S.b, "kin").length) fk += empty; }
    return { result: fy > fk ? "you" : fk > fy ? "kin" : "draw", detail: `${fy}–${fk}` };
  }
  const score = (b, me) => count(b, me) - count(b, other(me));
  function search(b, me, d, a, beta) {
    if (!d) return score(b, me);
    const ms = raw(b, me); if (!ms.length) return score(b, me) - (raw(b, other(me)).length ? 0 : 0);
    let best = -1e9;
    for (const m of ms) { const v = -search(play(b, m, me), other(me), d - 1, -beta, -a); if (v > best) best = v; if (v > a) a = v; if (a >= beta) break; }
    return best;
  }
  const DEPTH = { beginner: 1, easy: 1, normal: 2, hard: 3 };
  function rank(S, level) {
    const me = who(S), d = DEPTH[level] || 2, ms = moves(S);
    if (ms[0].pass) return [{ m: ms[0], label: "pass (no moves)", score: 0 }];
    const quick = ms.map((m) => ({ m, q: score(play(S.b, m, me), me) })).sort((x, y) => y.q - x.q).slice(0, d >= 3 ? 14 : 40);
    return quick.map(({ m }) => ({ m, label: `${m.f < 0 ? "grow into" : "leap from " + NAME(m.f) + " to"} ${NAME(m.t)}`, score: -search(play(S.b, m, me), other(me), d - 1, -1e9, 1e9) + (m.f < 0 ? 0.3 : 0) })).sort((x, y) => y.score - x.score);
  }
  const autoMove = (S) => { const m = moves(S); return m.length === 1 && m[0].pass ? m[0] : null; };
  const E = { N, setup, moves, apply, rank, over, count, autoMove };
  if (typeof module === "object" && module.exports) { module.exports = E; return; }
  const K = root.Kit, COL = { you: "#ff8a3d", kin: "#4fc3f7" };
  root.KG.add({
    id: "swarm", title: "Swarm", icon: "🟧",
    rules: "Pick one of your pieces, then a square. One square away (even diagonally) and you grow: a new piece appears there. Two squares away and you leap: the piece jumps there. Either way, every enemy piece touching where you land turns to your colour. If you can't move you pass. When the board is full, or someone is wiped out, the most pieces wins.",
    achievements: [
      { id: "five", icon: "💥", name: "Chain Reaction", about: "Turn five or more pieces in one move." },
      { id: "wipe", icon: "🧹", name: "Clean Sweep", about: "Win by wiping out every enemy piece." },
      { id: "thirty", icon: "🐝", name: "The Hive", about: "Finish with 30 or more pieces." },
    ],
    mount(api) {
      return K.turnGame(api, {
        ...E, autoForYou: true,
        mount(el, H) {
          const v = { bar: K.el("div"), wrap: K.el("div", "swarm"), sel: null }; el.append(v.bar, v.wrap);
          v.g = K.grid(v.wrap, N, N, "swgrid", (r, c) => "abcdefg"[c] + (N - r));
          K.onPick(v.wrap, (i) => {
            if (!H.mine()) return; const L = H.legal(), b = H.S.b;
            if (b[i] === "you") { v.sel = v.sel === i ? null : i; K.sfx.click(); H.redraw(); return; }
            if (v.sel == null) { const g = L.find((m) => m.f < 0 && m.t === i); if (g) H.play(g); return; }
            const m = L.find((x) => x.t === i && (x.f === v.sel || (x.f < 0 && N1[v.sel].includes(i)))); if (m) { v.sel = null; H.play(m); }
          });
          return v;
        },
        draw(v, S, H) {
          v.bar.replaceChildren(K.players(H, (i) => String(count(S.b, S.seats[i]))));
          const mine = H.mine(), L = mine ? H.legal() : [], lm = S.last && !S.last.pass ? S.last : null;
          v.g.cells.forEach((c, i) => {
            const p = S.b[i]; let cls = "cell" + (p === "x" ? " block" : "");
            if (mine && v.sel != null) { if (N1[v.sel].includes(i) && !p) cls += " grow"; else if (L.some((m) => m.f === v.sel && m.t === i)) cls += " leap"; }
            if (v.sel === i) cls += " sel"; if (lm && lm.t === i) cls += " last";
            c.className = cls;
            const key = p === "you" || p === "kin" ? p : "";
            if (c.dataset.p !== key) { const flip = c.dataset.p && key; c.dataset.p = key; c.innerHTML = key ? `<span class="tok ${flip ? "flipc" : "appear"}">${K.token(COL[key], "stone")}</span>` : ""; }
          });
        },
        animate: async (v, S0, m) => { if (!m.pass) { K.sfx.place(); const n = N1[m.t].filter((j) => S0.b[j] && S0.b[j] !== "x" && S0.b[j] !== S0.seats[S0.turn]).length; if (n) { await K.wait(90); K.sfx.pop(); } } },
        feats(S0, m, S1, who) {
          if (!m.pass) { const n = N1[m.t].filter((j) => S0.b[j] === other(who)).length; if (n >= 5) api.achieve("five", who); }
          const o = over(S1); if (o && o.result !== "draw") { if (!count(S1.b, other(o.result))) api.achieve("wipe", o.result); if (count(S1.b, o.result) >= 30) api.achieve("thirty", o.result); }
        },
        situation: (S) => `You are ${S.seats[S.turn] === "kin" ? "blue" : "orange"}: ${count(S.b, S.seats[S.turn])} pieces vs ${count(S.b, other(S.seats[S.turn]))}.`,
        yourTurn: () => "Tap one of your pieces, then a square one (grow) or two (leap) away.",
      });
    },
  });
})(typeof self !== "undefined" ? self : this);
