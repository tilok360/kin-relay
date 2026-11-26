// Chinese Checkers for two on the 121-hole star: ten marbles each race from one point of the star to the opposite.
// Step to a next-door hole, or hop over any marble to the empty hole beyond, chaining hops as far as you like.
(function (root) {
  "use strict";
  const PTS = [], IDX = {};
  for (let r = -8; r <= 8; r++) for (let q = -8; q <= 8; q++) { const s = -q - r; const t1 = q >= -4 && r >= -4 && s >= -4, t2 = q <= 4 && r <= 4 && s <= 4; if (t1 || t2) { IDX[q + "," + r] = PTS.length; PTS.push([q, r]); } }
  const D = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]];
  const NB = PTS.map(([q, r]) => D.map(([a, b]) => IDX[q + a + "," + (r + b)]));
  const HOP = PTS.map(([q, r]) => D.map(([a, b]) => IDX[q + 2 * a + "," + (r + 2 * b)]));
  const TOP = PTS.map((p, i) => (p[1] <= -5 ? i : -1)).filter((i) => i >= 0), BOT = PTS.map((p, i) => (p[1] >= 5 ? i : -1)).filter((i) => i >= 0);
  // Seat 0 starts at the top and races to the bottom; seat 1 the other way.
  const home = (p) => (p ? BOT : TOP), goal = (p) => (p ? TOP : BOT);
  const prog = (p, i) => (p ? -PTS[i][1] : PTS[i][1]);
  const NAME = (i) => `row ${PTS[i][1] + 9}, hole ${PTS[i][0] + PTS[i][1] / 2 + 9}`;
  function setup(first) { const b = Array(PTS.length).fill(-1); TOP.forEach((i) => (b[i] = 0)); BOT.forEach((i) => (b[i] = 1)); return { seats: first === "you" ? ["you", "kin"] : ["kin", "you"], turn: 0, b, ply: 0, last: null }; }
  function movesFrom(b, f) {
    const out = [];
    for (const t of NB[f]) if (t != null && b[t] < 0) out.push({ f, path: [f, t] });
    const seen = new Set([f]), st = [[f, [f]]];
    while (st.length) { const [at, path] = st.pop(); for (let k = 0; k < 6; k++) { const mid = NB[at][k], to = HOP[at][k]; if (mid == null || to == null || b[mid] < 0 || (b[to] >= 0 && to !== f) || seen.has(to) || to === f) continue; seen.add(to); const p2 = [...path, to]; out.push({ f, path: p2 }); st.push([to, p2]); } }
    return out;
  }
  function moves(S) { if (over(S)) return []; const out = []; S.b.forEach((x, i) => { if (x === S.turn) out.push(...movesFrom(S.b, i)); }); return out; }
  const end = (m) => m.path[m.path.length - 1];
  function apply(S, m) { const b = S.b.slice(); b[m.f] = -1; b[end(m)] = S.turn; return { ...S, b, turn: 1 - S.turn, ply: S.ply + 1, last: m }; }
  // You win when your goal triangle is full and at least one marble there is yours.
  const done = (b, p) => goal(p).every((i) => b[i] >= 0) && goal(p).some((i) => b[i] === p);
  const total = (b, p) => b.reduce((t, x, i) => t + (x === p ? prog(p, i) : 0), 0);
  function over(S) {
    for (const p of [0, 1]) if (done(S.b, p)) return { result: S.seats[p], detail: "every hole of the far point filled" };
    if (S.ply >= 400) { const a = total(S.b, 0), c = total(S.b, 1); return { result: a > c ? S.seats[0] : c > a ? S.seats[1] : "draw", detail: "the race ran long: furthest along wins" }; }
    return null;
  }
  function rank(S, level) {
    const p = S.turn, b = S.b, mine = []; b.forEach((x, i) => x === p && mine.push(prog(p, i)));
    const back = Math.min(...mine), G = new Set(goal(p));
    return moves(S).map((m) => {
      const t = end(m), gain = prog(p, t) - prog(p, m.f), [q] = PTS[t];
      let sc = gain * 3 - Math.abs(q + PTS[t][1] / 2) * 0.35 + Math.abs(PTS[m.f][0] + PTS[m.f][1] / 2) * 0.2;
      if (prog(p, m.f) === back) sc += 1.2;
      if (G.has(m.f) && !G.has(t)) sc -= 12;
      if (G.has(t)) { const deep = prog(p, t); sc += deep >= 7 ? 2 : 0; }
      if (level === "hard" || level === "normal") { const b2 = b.slice(); b2[m.f] = -1; b2[t] = p; let best = 0; b2.forEach((x, i) => { if (x !== 1 - p) return; for (const mm of movesFrom(b2, i)) best = Math.max(best, prog(1 - p, end(mm)) - prog(1 - p, i)); }); sc -= best * (level === "hard" ? 0.9 : 0.4); }
      return { m, label: `marble from ${NAME(m.f)} to ${NAME(t)}${m.path.length > 2 || !NB[m.f].includes(t) ? ` (${m.path.length - 1} hop${m.path.length > 2 ? "s" : ""})` : ""}`, score: sc + Math.random() * 0.2 };
    }).sort((x, y) => y.score - x.score);
  }
  const E = { PTS, setup, moves, apply, rank, over, goal, done };
  if (typeof module === "object" && module.exports) { module.exports = E; return; }
  const K = root.Kit, COL = ["#e5483b", "#2f8be0"];
  const XY = (i) => { const [q, r] = PTS[i]; return [150 + (q + r / 2) * 16, 150 + r * 13.86]; };
  root.KG.add({
    id: "chinesecheckers", title: "Chinese Checkers", icon: "✡",
    rules: "Each side has ten marbles in a point of the star. On your turn move one marble: either one step to a next-door empty hole, or a hop over a single next-door marble (anyone's) to the empty hole straight beyond. Hops can chain as long as you like. First to fill every hole of the opposite point wins (an enemy marble left sitting there doesn't stop you if the rest are yours). Whoever starts plays red, from the top.",
    achievements: [
      { id: "chain", icon: "🦘", name: "Kangaroo", about: "Hop five or more times in one move." },
      { id: "fast", icon: "🏁", name: "Express", about: "Win in 40 moves or fewer." },
      { id: "shut", icon: "🚪", name: "Shutout", about: "Win before your opponent has a single marble home." },
    ],
    mount(api) {
      return K.turnGame(api, {
        ...E,
        mount(el, H) {
          const v = { bar: K.el("div"), box: K.el("div", "starbox"), sel: null }; el.append(v.bar, v.box);
          K.onPick(v.box, (i) => {
            if (!H.mine()) return; const L = H.legal(), b = H.S.b;
            if (b[i] === H.S.turn) { v.sel = v.sel === i ? null : i; K.sfx.click(); H.redraw(); return; }
            if (v.sel == null) return; const m = L.filter((x) => x.f === v.sel && end(x) === i).sort((a, c) => a.path.length - c.path.length)[0];
            if (m) { v.sel = null; H.play(m); }
          });
          return v;
        },
        draw(v, S, H) {
          v.bar.replaceChildren(K.players(H, (i) => `${i ? "blue" : "red"} · ${goal(i).filter((g) => S.b[g] === i).length}/10 home`));
          const mine = H.mine(), L = mine ? H.legal() : [], tg = new Set(mine && v.sel != null ? L.filter((m) => m.f === v.sel).map(end) : []);
          let s = `<svg class="svgboard" viewBox="0 0 300 300"><defs><radialGradient id="ccb"><stop offset="0" stop-color="#3a2a1a"/><stop offset="1" stop-color="#1d140b"/></radialGradient></defs>`;
          const tri = (pts, c) => `<polygon points="${pts.map((i) => XY(i).join(",")).join(" ")}" fill="${c}" opacity=".22"/>`;
          const corner = (set) => { let a = set[0], b2 = set[0], c = set[0]; for (const i of set) { if (Math.abs(PTS[i][1]) > Math.abs(PTS[a][1])) a = i; } const ends = set.filter((i) => Math.abs(PTS[i][1]) === 5); b2 = ends.reduce((x, y) => (XY(y)[0] < XY(x)[0] ? y : x)); c = ends.reduce((x, y) => (XY(y)[0] > XY(x)[0] ? y : x)); return [a, b2, c]; };
          s += `<polygon points="${[...Array(12).keys()].map((k) => { const a = -Math.PI / 2 + k * Math.PI / 6, R = k % 2 ? 78 : 140; return `${150 + R * Math.cos(a)},${150 + R * Math.sin(a)}`; }).join(" ")}" fill="#c99a5a" stroke="#6b4a24" stroke-width="3" stroke-linejoin="round"/>`;
          s += tri(corner(TOP), COL[1]) + tri(corner(BOT), COL[0]);
          const lm = S.last;
          if (lm) s += `<polyline points="${lm.path.map((i) => XY(i).join(",")).join(" ")}" fill="none" stroke="#ffd76a" stroke-width="1.6" stroke-dasharray="3 2" opacity=".8"/>`;
          PTS.forEach((_, i) => {
            const [x, y] = XY(i), p = S.b[i];
            s += `<circle cx="${x}" cy="${y}" r="5.2" fill="url(#ccb)"/>`;
            if (p >= 0) s += K.place(K.token(COL[p], "marble"), x - 6.6, y - 6.6, 13.2, lm && end(lm) === i ? "appear" : "");
            if (v.sel === i) s += `<circle cx="${x}" cy="${y}" r="8" fill="none" stroke="#5ee6d0" stroke-width="1.8"/>`;
            if (tg.has(i)) s += `<circle class="hot" data-i="${i}" cx="${x}" cy="${y}" r="7" fill="#ffd76a66" stroke="#ffd76a" stroke-width="1.2"/>`;
            else if (mine && p === S.turn) s += `<circle class="hot" data-i="${i}" cx="${x}" cy="${y}" r="7.5" fill="transparent"/>`;
          });
          v.box.innerHTML = s + "</svg>";
        },
        animate: async (v, S0, m) => { for (let k = 1; k < m.path.length; k++) { K.sfx.clack(); await K.wait(90); } },
        feats(S0, m, S1, who) { if (m.path.length >= 6) api.achieve("chain", who); const o = over(S1); if (o && o.result === who) { const p = S0.turn; if (S1.ply <= 80) api.achieve("fast", who); if (!goal(1 - p).some((g) => S1.b[g] === 1 - p)) api.achieve("shut", who); } },
        situation: (S) => `You are ${S.turn ? "blue" : "red"}; ${goal(S.turn).filter((g) => S.b[g] === S.turn).length} of 10 marbles home, they have ${goal(1 - S.turn).filter((g) => S.b[g] === 1 - S.turn).length}.`,
        yourTurn: () => "Tap one of your marbles, then a glowing hole.",
        botMs: 300,
      });
    },
  });
})(typeof self !== "undefined" ? self : this);
