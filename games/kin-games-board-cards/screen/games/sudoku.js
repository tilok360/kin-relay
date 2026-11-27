// Battle Sudoku: one puzzle, two solvers taking turns. A right number scores a point (finishing a row, column or box adds 2); a wrong one costs a point.
(function (root) {
  "use strict";
  const PEERS = []; for (let i = 0; i < 81; i++) { const r = Math.floor(i / 9), c = i % 9, s = new Set(); for (let k = 0; k < 9; k++) { s.add(r * 9 + k); s.add(k * 9 + c); s.add((Math.floor(r / 3) * 3 + Math.floor(k / 3)) * 9 + Math.floor(c / 3) * 3 + (k % 3)); } s.delete(i); PEERS.push([...s]); }
  const UNITS = []; for (let k = 0; k < 9; k++) { const R = [], C = [], B = []; for (let j = 0; j < 9; j++) { R.push(k * 9 + j); C.push(j * 9 + k); B.push((Math.floor(k / 3) * 3 + Math.floor(j / 3)) * 9 + (k % 3) * 3 + (j % 3)); } UNITS.push(R, C, B); }
  const cands = (g, i) => { if (g[i]) return []; const u = new Set(PEERS[i].map((j) => g[j])); const o = []; for (let d = 1; d <= 9; d++) if (!u.has(d)) o.push(d); return o; };
  function solve(g, limit) { let n = 0, sol = null; (function rec() { if (n >= limit) return; let best = -1, bc = null; for (let i = 0; i < 81; i++) if (!g[i]) { const c = cands(g, i); if (!c.length) return; if (!bc || c.length < bc.length) { best = i; bc = c; if (c.length === 1) break; } } if (best < 0) { n++; sol = g.slice(); return; } for (const d of bc.sort(() => Math.random() - 0.5)) { g[best] = d; rec(); g[best] = 0; if (n >= limit) return; } })(); return { n, sol }; }
  function generate(clues) { const full = solve(Array(81).fill(0), 1).sol, g = full.slice(), order = [...Array(81).keys()].sort(() => Math.random() - 0.5); let filled = 81; for (const i of order) { if (filled <= clues) break; const keep = g[i]; g[i] = 0; if (solve(g.slice(), 2).n !== 1) g[i] = keep; else filled--; } return { puzzle: g, solution: full }; }
  const CLUES = { beginner: 46, easy: 40, normal: 36, hard: 32 };
  function setup(first, api) { const lvl = (api && api.settings && api.settings.level) || "normal", P = generate(CLUES[lvl] || 36); return { seats: first === "you" ? ["you", "kin"] : ["kin", "you"], given: P.puzzle.map(Boolean), grid: P.puzzle, sol: P.solution, owner: Array(81).fill(-1), score: [0, 0], wrong: [], turn: 0, ply: 0 }; }
  function moves(S) { if (over(S)) return []; const o = []; for (let i = 0; i < 81; i++) if (!S.grid[i]) for (const d of cands(S.grid, i)) o.push({ i, d }); return o; }
  function apply(S0, m) {
    const S = { ...S0, grid: S0.grid.slice(), owner: S0.owner.slice(), score: S0.score.slice(), ply: S0.ply + 1 }, p = S.turn;
    if (S.sol[m.i] === m.d) { S.grid[m.i] = m.d; S.owner[m.i] = p; let pts = 1, done = 0; for (const U of UNITS) if (U.includes(m.i) && U.every((j) => S.grid[j])) done++; pts += done * 2; S.score[p] += pts; S.last = { p, i: m.i, d: m.d, ok: true, pts, done }; S.wrong = []; }
    else { S.score[p] -= 1; S.last = { p, i: m.i, d: m.d, ok: false }; S.wrong = [m.i]; S.flawed = (S0.flawed || [0, 0]).slice(); S.flawed[p] = 1; }
    return { ...S, turn: 1 - p };
  }
  function over(S) { if (S.grid.some((x) => !x)) return null; const [a, b] = S.score; return { result: a === b ? "draw" : S.seats[a > b ? 0 : 1], detail: `${Math.max(a, b)} points to ${Math.min(a, b)}` }; }
  function hiddenSingles(g) { const out = new Map(); for (const U of UNITS) for (let d = 1; d <= 9; d++) { const spots = U.filter((j) => !g[j] && cands(g, j).includes(d)); if (spots.length === 1) out.set(spots[0], d); } return out; }
  function rank(S, level) {
    const g = S.grid, hs = level === "hard" || level === "normal" ? hiddenSingles(g) : new Map(), out = [];
    for (let i = 0; i < 81; i++) { if (g[i]) continue; const c = cands(g, i); for (const d of c) { let sc = 1 / c.length; if (hs.get(i) === d) sc = 1; if (level === "beginner") sc = sc * 0.5 + Math.random() * 0.5; let fills = 0; for (const U of UNITS) if (U.includes(i) && U.filter((j) => !g[j]).length === 1) fills++; if (sc >= 1) sc += fills * (level === "hard" ? 0.5 : 0.2); out.push({ m: { i, d }, label: `put ${d} at row ${Math.floor(i / 9) + 1}, column ${(i % 9) + 1}${c.length === 1 || hs.get(i) === d ? " (certain)" : ` (one of ${c.length})`}`, score: sc + Math.random() * 0.01 }); } }
    return out.sort((a, b) => b.score - a.score).slice(0, 24);
  }
  const E = { setup, moves, apply, over, rank, generate, solve, cands };
  if (typeof module === "object" && module.exports) { module.exports = E; return; }
  const K = root.Kit;
  root.KG.add({
    id: "sudoku", title: "Battle Sudoku", icon: "🔢",
    rules: "One sudoku, two solvers. Take turns placing a single number: every row, column and 3×3 box must end up holding 1–9 once each. A right number scores 1 point, plus 2 for every row, column or box it completes. A wrong number is rejected and costs you a point. When the grid is full, the higher score wins. The difficulty setting decides how many numbers start on the board.",
    achievements: [
      { id: "triple", icon: "🎆", name: "Triple Finish", about: "Complete a row, column and box with one number." },
      { id: "flawless", icon: "💎", name: "Flawless", about: "Win without a single wrong number." },
    ],
    mount(api) {
      let sel = -1;
      return K.turnGame(api, {
        ...E, thinkMs: 700,
        mount(el, H) { const v = { bar: K.el("div"), wrap: K.el("div", "sudwrap"), info: K.el("div", "hint big"), pad: K.el("div", "sudpad") }; el.append(v.bar, v.wrap, v.info, v.pad); v.g = K.grid(v.wrap, 9, 9, "sudoku", (r, c) => `row ${r + 1} column ${c + 1}`); K.onPick(v.g.box, (i) => { if (!H.mine() || H.S.grid[i]) return; sel = i; K.sfx.click(); H.redraw(); });
          v.onKey = (e) => { if (e.ctrlKey || e.metaKey || e.altKey || e.target.closest("input,select,textarea")) return; if (/^[1-9]$/.test(e.key) && sel >= 0 && H.mine() && !H.S.grid[sel]) { e.preventDefault(); const d = +e.key; const i = sel; sel = -1; H.play({ i, d }); } else if (sel >= 0 && e.key.startsWith("Arrow")) { e.preventDefault(); const dlt = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 }[e.key]; sel = (sel + dlt + 81) % 81; H.redraw(); } };
          document.addEventListener("keydown", v.onKey); v.destroy = () => document.removeEventListener("keydown", v.onKey); return v; },
        draw(v, S, H) {
          v.bar.replaceChildren(K.players(H, (i) => `${S.score[i]} pts`));
          const you = S.seats.indexOf("you"), L = S.last;
          v.g.cells.forEach((b, i) => { const r = Math.floor(i / 9), c = i % 9; b.className = "cell" + ((Math.floor(r / 3) + Math.floor(c / 3)) % 2 ? " alt" : "") + (S.given[i] ? " given" : S.owner[i] === you ? " mine" : S.owner[i] >= 0 ? " theirs" : "") + (i === sel ? " sel" : "") + (S.wrong.includes(i) ? " wrong" : "") + (L && L.i === i && L.ok ? " fresh" : "") + (sel >= 0 && S.grid[sel] === 0 && (Math.floor(i / 9) === Math.floor(sel / 9) || i % 9 === sel % 9) ? " line" : ""); b.textContent = S.grid[i] || (S.wrong.includes(i) ? L.d : ""); });
          v.info.textContent = !L ? (H.mine() ? "Pick an empty square, then a number." : "") : L.ok ? `${H.nameOf(L.p)} placed ${L.d} (+${L.pts}${L.done ? `, finished ${L.done}` : ""})` : `${H.nameOf(L.p)} tried ${L.d} — wrong (−1)`;
          if (sel >= 0 && S.grid[sel]) sel = -1; const ok = H.mine() && sel >= 0;
          v.pad.replaceChildren(...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => { const b = K.btn("key big", String(d), () => { const i = sel; sel = -1; H.play({ i, d }); }); b.disabled = !ok; return b; }));
        },
        animate: async (v, S0, m, S1) => { if (S1.last.ok) { K.sfx.place(); if (S1.last.done) { await K.wait(120); K.sfx.score(); } } else K.sfx.buzz(); },
        feats(S0, m, S1, who) { if (S1.last.ok && S1.last.done >= 3) api.achieve("triple", who); const o = over(S1); if (o && o.result === who && !(S1.flawed && S1.flawed[S1.seats.indexOf(who)])) api.achieve("flawless", who); },
        situation: (S) => { const rows = []; for (let r = 0; r < 9; r++) rows.push(S.grid.slice(r * 9, r * 9 + 9).map((x) => x || ".").join("")); return `The grid (dots are empty): ${rows.join(" / ")}. Score: you ${S.score[S.turn]}, them ${S.score[1 - S.turn]}.`; },
        yourTurn: () => "Pick an empty square, then a number.",
      });
    },
  });
})(typeof self !== "undefined" ? self : this);
