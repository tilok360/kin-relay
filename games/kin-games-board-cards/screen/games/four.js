// Four in a Row: drop discs into a 7 x 6 rack; four in a line (any direction) wins.
(function (root) {
  "use strict";
  const C = 7, R = 6, other = (p) => (p === "you" ? "kin" : "you");
  const setup = (first) => ({ seats: first === "you" ? ["you", "kin"] : ["kin", "you"], turn: 0, b: Array(C * R).fill(""), last: -1, ply: 0 });
  const who = (S) => S.seats[S.turn];
  const moves = (S) => (winner(S.b) ? [] : [...Array(C).keys()].filter((c) => !S.b[c]));
  function dropRow(b, c) { for (let r = R - 1; r >= 0; r--) if (!b[r * C + c]) return r; return -1; }
  function apply(S, c) { const b = S.b.slice(), r = dropRow(b, c); b[r * C + c] = who(S); return { ...S, b, turn: 1 - S.turn, last: r * C + c, ply: S.ply + 1 }; }
  const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];
  function winner(b) {
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      const p = b[r * C + c]; if (!p) continue;
      for (const [dr, dc] of DIRS) { const line = [r * C + c]; for (let k = 1; k < 4; k++) { const rr = r + dr * k, cc = c + dc * k; if (rr < 0 || rr >= R || cc < 0 || cc >= C || b[rr * C + cc] !== p) break; line.push(rr * C + cc); } if (line.length === 4) return { p, line }; }
    }
    return null;
  }
  function evalFor(b, me) {
    let s = 0; const foe = other(me);
    for (let r = 0; r < R; r++) s += (b[r * C + 3] === me ? 3 : b[r * C + 3] === foe ? -3 : 0);
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) for (const [dr, dc] of DIRS) {
      const er = r + dr * 3, ec = c + dc * 3; if (er < 0 || er >= R || ec < 0 || ec >= C) continue;
      let m = 0, f = 0; for (let k = 0; k < 4; k++) { const v = b[(r + dr * k) * C + c + dc * k]; if (v === me) m++; else if (v === foe) f++; }
      if (m && !f) s += m === 3 ? 12 : m === 2 ? 3 : 0.5; else if (f && !m) s -= f === 3 ? 14 : f === 2 ? 3 : 0.5;
    }
    return s;
  }
  const ORDER = [3, 2, 4, 1, 5, 0, 6];
  function nega(b, me, d, a, beta) {
    const w = winner(b); if (w) return w.p === me ? 1000 + d : -1000 - d;
    if (b.slice(0, C).every(Boolean)) return 0;
    if (!d) return evalFor(b, me);
    let best = -1e9;
    for (const c of ORDER) { if (b[c]) continue; const r = dropRow(b, c); b[r * C + c] = me; const v = -nega(b, other(me), d - 1, -beta, -a); b[r * C + c] = ""; if (v > best) best = v; if (v > a) a = v; if (a >= beta) break; }
    return best;
  }
  const DEPTH = { beginner: 1, easy: 2, normal: 4, hard: 6 };
  function rank(S, level) {
    const me = who(S), d = DEPTH[level] || 4, out = [];
    for (const c of moves(S)) { const b = S.b.slice(), r = dropRow(b, c); b[r * C + c] = me; out.push({ m: c, label: `column ${c + 1}`, score: -nega(b, other(me), d - 1, -1e9, 1e9) + (3 - Math.abs(3 - c)) * 0.01 }); }
    return out.sort((x, y) => y.score - x.score);
  }
  function over(S) {
    const w = winner(S.b); if (w) return { result: w.p, detail: "four in a row" };
    if (S.b.every(Boolean)) return { result: "draw", detail: "the rack is full" };
    return null;
  }
  const E = { C, R, setup, moves, apply, rank, over, winner, dropRow };
  if (typeof module === "object" && module.exports) { module.exports = E; return; }
  const K = root.Kit, COL = { you: "#e5483b", kin: "#f2c23d" };
  root.KG.add({
    id: "four", title: "Four in a Row", icon: "🔴",
    rules: "Take turns dropping a disc into one of the seven columns; it falls to the lowest empty slot. Four of your discs in a line across, down or diagonally wins. A full rack with no line is a draw. You're red.",
    achievements: [
      { id: "diag", icon: "↗", name: "Slant Master", about: "Win with a diagonal four." },
      { id: "quick", icon: "⚡", name: "Speed Drop", about: "Win using seven discs or fewer." },
      { id: "full", icon: "🧱", name: "Packed Rack", about: "Fill the rack for a draw." },
    ],
    mount(api) {
      return K.turnGame(api, {
        ...E,
        mount(el, H) {
          const v = { bar: K.el("div"), wrap: K.el("div", "c4") }; el.append(v.bar, v.wrap);
          v.g = K.grid(v.wrap, R, C, "c4grid", (r, c) => `column ${c + 1}`);
          v.g.cells.forEach((b, i) => { b.onclick = () => H.mine() && !H.S.b[i % C] && H.play(i % C); b.onmouseenter = () => { v.hover = i % C; H.redraw(); }; });
          v.wrap.onmouseleave = () => { v.hover = -1; H.redraw(); };
          el.addEventListener("keydown", (e) => { if (!H.mine()) return; if (e.key >= "1" && e.key <= "7") H.play(Number(e.key) - 1); if (e.key === "ArrowLeft" || e.key === "ArrowRight") { v.hover = Math.max(0, Math.min(6, (v.hover < 0 ? 3 : v.hover) + (e.key === "ArrowLeft" ? -1 : 1))); H.redraw(); } if ((e.key === "Enter" || e.key === " ") && v.hover >= 0) { e.preventDefault(); H.play(v.hover); } });
          v.hover = -1; return v;
        },
        draw(v, S, H) {
          v.bar.replaceChildren(K.players(H, (i) => (S.seats[i] === "you" ? "red" : "yellow")));
          const w = winner(S.b), can = H.mine();
          v.g.cells.forEach((b, i) => {
            const p = S.b[i], c = i % C; b.className = "cell" + (can && c === v.hover && !S.b[c] ? " col" : "") + (w && w.line.includes(i) ? " win" : "");
            if (b.dataset.p !== p) { b.dataset.p = p; b.innerHTML = p ? `<span class="tok${i === S.last ? " drop" : ""}" style="--fall:-${(Math.floor(i / C) + 1) * 112}%">${K.token(COL[p], "checker")}</span>` : ""; }
            b.disabled = !can || !!S.b[c];
          });
        },
        animate: async () => { K.sfx.clack(); },
        feats(S0, m, S1, who) {
          const w = winner(S1.b);
          if (w) { const [a, b2] = w.line; if (Math.floor(a / C) !== Math.floor(b2 / C) && a % C !== b2 % C) H_ach(who, "diag"); if (S1.b.filter((x) => x === w.p).length <= 7) H_ach(who, "quick"); }
          else if (S1.b.every(Boolean)) { H_ach("you", "full"); H_ach("kin", "full"); }
          function H_ach(x, id) { api.achieve(id, x); }
        },
        situation: (S) => `You drop ${S.seats[S.turn] === "kin" ? "yellow" : "red"} discs. Rows from top: ${[...Array(R).keys()].map((r) => S.b.slice(r * C, r * C + C).map((x) => (x === "kin" ? "Y" : x === "you" ? "R" : ".")).join("")).join(" / ")}.`,
        yourTurn: () => "Your turn: tap a column (or keys 1–7).",
        thinkMs: 450,
      });
    },
  });
})(typeof self !== "undefined" ? self : this);
