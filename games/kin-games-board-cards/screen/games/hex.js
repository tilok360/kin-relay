// Hex on a 9 x 9 rhombus. Red links top to bottom, blue links left to right. There are no draws.
(function (root) {
  "use strict";
  const N = 9, NB = [[0, 1], [0, -1], [-1, 0], [-1, 1], [1, 0], [1, -1]];
  const nbrs = [...Array(N * N).keys()].map((i) => { const r = Math.floor(i / N), c = i % N; return NB.map(([dr, dc]) => [r + dr, c + dc]).filter(([a, b]) => a >= 0 && a < N && b >= 0 && b < N).map(([a, b]) => a * N + b); });
  const NAME = (i) => "abcdefghi"[i % N] + (Math.floor(i / N) + 1);
  // Seat 0 (who starts) is red and links top to bottom.
  const setup = (first) => ({ seats: first === "you" ? ["you", "kin"] : ["kin", "you"], turn: 0, b: Array(N * N).fill(-1), ply: 0, last: -1 });
  const moves = (S) => (over(S) ? [] : S.b.map((x, i) => (x < 0 ? i : -1)).filter((i) => i >= 0));
  const apply = (S, i) => { const b = S.b.slice(); b[i] = S.turn; return { ...S, b, turn: 1 - S.turn, ply: S.ply + 1, last: i }; };
  const startSide = (p) => (p === 0 ? [...Array(N).keys()] : [...Array(N).keys()].map((r) => r * N));
  const atEnd = (p, i) => (p === 0 ? Math.floor(i / N) === N - 1 : i % N === N - 1);
  function path(b, p) {
    const seen = new Set(), q = [], from = {};
    for (const i of startSide(p)) if (b[i] === p) { seen.add(i); q.push(i); from[i] = -1; }
    while (q.length) { const i = q.shift(); if (atEnd(p, i)) { const line = []; for (let k = i; k >= 0; k = from[k]) line.push(k); return line; } for (const j of nbrs[i]) if (!seen.has(j) && b[j] === p) { seen.add(j); from[j] = i; q.push(j); } }
    return null;
  }
  function over(S) { for (const p of [0, 1]) { const l = path(S.b, p); if (l) return { result: S.seats[p], detail: `${p ? "blue" : "red"} linked across`, line: l }; } return null; }
  // Fewest empty cells p still needs to link its sides (0-1 BFS: own cells cost 0, empty 1, enemy blocked).
  function dist(b, p) {
    const D = Array(N * N).fill(1e9), dq = [];
    for (const i of startSide(p)) if (b[i] !== 1 - p) { D[i] = b[i] === p ? 0 : 1; dq.push(i); }
    dq.sort((a, c) => D[a] - D[c]);
    while (dq.length) { let k = 0; for (let j = 1; j < dq.length; j++) if (D[dq[j]] < D[dq[k]]) k = j; const i = dq.splice(k, 1)[0]; if (atEnd(p, i)) return D[i]; for (const j of nbrs[i]) { if (b[j] === 1 - p) continue; const nd = D[i] + (b[j] === p ? 0 : 1); if (nd < D[j]) { D[j] = nd; dq.push(j); } } }
    return 1e9;
  }
  const value = (b, p) => { const a = dist(b, p), f = dist(b, 1 - p); if (a === 0) return 1e6; if (f === 0) return -1e6; return f - a; };
  function rank(S, level) {
    const p = S.turn, b = S.b, empties = moves(S);
    if (S.ply === 0) { const c = Math.floor(N * N / 2); return [{ m: c, label: "the center " + NAME(c), score: 1 }, ...empties.filter((i) => i !== c).map((i) => ({ m: i, label: NAME(i), score: 0 }))]; }
    const sc = empties.map((i) => { b[i] = p; const v = value(b, p); b[i] = -1; const near = nbrs[i].filter((j) => b[j] >= 0).length; return { m: i, v: v + near * 0.05 - Math.abs(Math.floor(i / N) - 4) * 0.01 - Math.abs((i % N) - 4) * 0.01 }; }).sort((x, y) => y.v - x.v);
    if (level === "hard" || level === "normal") {
      const top = sc.slice(0, level === "hard" ? 10 : 6);
      for (const t of top) { b[t.m] = p; let worst = 1e9; for (const j of moves(S)) { if (b[j] >= 0) continue; b[j] = 1 - p; worst = Math.min(worst, value(b, p)); b[j] = -1; if (worst < -1e5) break; } b[t.m] = -1; t.v = worst + t.v * 0.01; }
      top.sort((x, y) => y.v - x.v); sc.splice(0, top.length, ...top);
    }
    return sc.map((x) => ({ m: x.m, label: NAME(x.m), score: x.v }));
  }
  const E = { N, setup, moves, apply, rank, over, dist, path };
  if (typeof module === "object" && module.exports) { module.exports = E; return; }
  const K = root.Kit, COL = ["#e5483b", "#3b7fe5"];
  root.KG.add({
    id: "hex", title: "Hex", icon: "⬢",
    rules: "Take turns claiming one empty hexagon. Red wants an unbroken chain from the top edge to the bottom edge; blue wants one from left to right. Someone always gets there: Hex can't end in a draw. Whoever starts plays red.",
    achievements: [
      { id: "short", icon: "📏", name: "Straight Shot", about: "Win with a chain of ten hexes or fewer." },
      { id: "quick", icon: "⚡", name: "Lightning Link", about: "Win within your first fifteen hexes." },
      { id: "long", icon: "🐍", name: "The Long Way", about: "Win with a winding chain of eighteen or more." },
    ],
    mount(api) {
      return K.turnGame(api, {
        ...E,
        mount(el, H) { const v = { bar: K.el("div"), box: K.el("div", "hexbox") }; el.append(v.bar, v.box); K.onPick(v.box, (i) => H.mine() && H.S.b[i] < 0 && H.play(i)); return v; },
        draw(v, S, H) {
          v.bar.replaceChildren(K.players(H, (i) => (i === 0 ? "red · top ↔ bottom" : "blue · left ↔ right")));
          const o = over(S), line = new Set(o ? o.line : []), mine = H.mine(), R = 10, w = Math.sqrt(3) * R, X = (r, c) => 30 + c * w + r * w / 2, Y = (r) => 30 + r * 1.5 * R;
          const W = X(N - 1, N - 1) + 30, Ht = Y(N - 1) + 30;
          const hexP = (x, y, s) => [...Array(6).keys()].map((k) => { const a = Math.PI / 6 + k * Math.PI / 3; return `${(x + s * Math.cos(a)).toFixed(1)},${(y + s * Math.sin(a)).toFixed(1)}`; }).join(" ");
          let s = `<svg class="svgboard" viewBox="0 0 ${W.toFixed(0)} ${Ht.toFixed(0)}">`;
          const tl = [X(0, 0), Y(0)], tr = [X(0, N - 1), Y(0)], bl = [X(N - 1, 0), Y(N - 1)], br = [X(N - 1, N - 1), Y(N - 1)];
          s += `<path d="M${tl[0] - 14} ${tl[1] - 14}L${tr[0] + 14} ${tr[1] - 14}" stroke="${COL[0]}" stroke-width="7" stroke-linecap="round"/><path d="M${bl[0] - 14} ${bl[1] + 14}L${br[0] + 14} ${br[1] + 14}" stroke="${COL[0]}" stroke-width="7" stroke-linecap="round"/>`;
          s += `<path d="M${tl[0] - 16} ${tl[1] - 8}L${bl[0] - 16} ${bl[1] + 8}" stroke="${COL[1]}" stroke-width="7" stroke-linecap="round"/><path d="M${tr[0] + 16} ${tr[1] - 8}L${br[0] + 16} ${br[1] + 8}" stroke="${COL[1]}" stroke-width="7" stroke-linecap="round"/>`;
          for (let i = 0; i < N * N; i++) {
            const r = Math.floor(i / N), c = i % N, x = X(r, c), y = Y(r), p = S.b[i];
            s += `<polygon points="${hexP(x, y, R - 0.6)}" fill="${p < 0 ? "#efe2c4" : COL[p]}" stroke="#6b4a24" stroke-width="1"${p < 0 && mine ? ` class="hot" data-i="${i}"` : ""}/>`;
            if (p >= 0) s += `<polygon points="${hexP(x, y - 1, R - 3.5)}" fill="#fff" opacity="${line.has(i) ? ".55" : ".18"}" pointer-events="none" class="${i === S.last ? "appear" : ""}" style="transform-box:fill-box;transform-origin:center"/>`;
            if (i === S.last) s += `<circle cx="${x}" cy="${y}" r="2.2" fill="#fff" pointer-events="none"/>`;
          }
          v.box.innerHTML = s + "</svg>";
        },
        animate: async () => K.sfx.place(),
        feats(S0, m, S1, who) { const o = over(S1); if (!o) return; const n = o.line.length; if (n <= 10) api.achieve("short", who); if (n >= 18) api.achieve("long", who); if (S1.b.filter((x) => x === S0.turn).length <= 15) api.achieve("quick", who); },
        situation: (S) => `You are ${S.turn ? "blue (link left to right)" : "red (link top to bottom)"}. You need ${dist(S.b, S.turn)} more hexes at best; your opponent needs ${dist(S.b, 1 - S.turn)}.`,
        yourTurn: (S) => `Your turn: claim a hex (you're ${S.seats[0] === "you" ? "red, top to bottom" : "blue, left to right"}).`,
      });
    },
  });
})(typeof self !== "undefined" ? self : this);
