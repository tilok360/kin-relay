// Go on 9 x 9 (or 13 or 19). Area scoring with 6.5 komi for white, simple ko. Two passes in a row end the game.
(function (root) {
  "use strict";
  const COLS = "ABCDEFGHJKLMNOPQRST";
  const NAME = (n, i) => (i < 0 ? "pass" : COLS[i % n] + (n - Math.floor(i / n)));
  const KOMI = 6.5;
  const nb = (n, i) => { const r = Math.floor(i / n), c = i % n, o = []; if (r) o.push(i - n); if (r < n - 1) o.push(i + n); if (c) o.push(i - 1); if (c < n - 1) o.push(i + 1); return o; };
  const NBC = {}; const nbs = (n) => NBC[n] || (NBC[n] = [...Array(n * n).keys()].map((i) => nb(n, i)));
  // Seat 0 plays black and moves first.
  const setup = (first, api, size) => { const n = size || (api && api.pref ? Number(api.pref("size", 9)) : 9) || 9; return { seats: first === "you" ? ["you", "kin"] : ["kin", "you"], turn: 0, n, b: Array(n * n).fill(-1), caps: [0, 0], ko: -1, passes: 0, ply: 0, last: -1, took: [] }; };
  function group(n, b, i) { const p = b[i], st = [i], seen = new Set([i]), libs = new Set(), N = nbs(n); while (st.length) { const k = st.pop(); for (const j of N[k]) { if (b[j] < 0) libs.add(j); else if (b[j] === p && !seen.has(j)) { seen.add(j); st.push(j); } } } return { stones: [...seen], libs }; }
  function tryPlay(S, i, p) {
    if (i < 0) return { b: S.b, took: [], ko: -1 };
    if (S.b[i] >= 0 || i === S.ko) return null;
    const n = S.n, b = S.b.slice(); b[i] = p; let took = [];
    for (const j of nbs(n)[i]) if (b[j] === 1 - p) { const g = group(n, b, j); if (!g.libs.size) { for (const k of g.stones) b[k] = -1; took = took.concat(g.stones); } }
    const me = group(n, b, i); if (!me.libs.size) return null;
    const ko = took.length === 1 && me.stones.length === 1 && me.libs.size === 1 ? took[0] : -1;
    return { b, took, ko };
  }
  function moves(S) { if (over(S)) return []; const out = [-1]; for (let i = 0; i < S.n * S.n; i++) if (S.b[i] < 0 && tryPlay(S, i, S.turn)) out.push(i); return out; }
  function apply(S, i) {
    const r = tryPlay(S, i, S.turn), caps = S.caps.slice(); caps[S.turn] += r.took.length;
    return { ...S, b: r.b, caps, ko: r.ko, passes: i < 0 ? S.passes + 1 : 0, turn: 1 - S.turn, ply: S.ply + 1, last: i, took: r.took };
  }
  // Area score: stones on the board plus empty regions that touch only one colour.
  function score(S) {
    const n = S.n, b = S.b, pts = [0, KOMI], terr = Array(n * n).fill(-1), seen = new Set(), N = nbs(n);
    for (let i = 0; i < n * n; i++) {
      if (b[i] >= 0) { pts[b[i]]++; continue; }
      if (seen.has(i)) continue;
      const reg = [i], st = [i], touch = new Set(); seen.add(i);
      while (st.length) { const k = st.pop(); for (const j of N[k]) { if (b[j] >= 0) touch.add(b[j]); else if (!seen.has(j)) { seen.add(j); reg.push(j); st.push(j); } } }
      if (touch.size === 1) { const o = [...touch][0]; pts[o] += reg.length; for (const k of reg) terr[k] = o; }
    }
    return { pts, terr };
  }
  function over(S) {
    if (S.passes < 2 && S.ply < S.n * S.n * 3) return null;
    const { pts } = score(S), d = pts[0] - pts[1];
    return { result: S.seats[d > 0 ? 0 : 1], detail: `black ${pts[0]} – white ${pts[1]} (komi ${KOMI})` };
  }
  function influence(S) {
    const n = S.n, f = new Float32Array(n * n);
    for (let i = 0; i < n * n; i++) { const p = S.b[i]; if (p < 0) continue; const r = Math.floor(i / n), c = i % n, sg = p === S.turn ? 1 : -1; for (let dr = -4; dr <= 4; dr++) for (let dc = -4; dc <= 4; dc++) { const d = Math.abs(dr) + Math.abs(dc); if (d > 4) continue; const rr = r + dr, cc = c + dc; if (rr < 0 || cc < 0 || rr >= n || cc >= n) continue; f[rr * n + cc] += sg / (1 + d * d * 0.6); } }
    return f;
  }
  function rank(S, level) {
    const n = S.n, p = S.turn, b = S.b, N = nbs(n), inf = influence(S), out = [];
    const gcache = new Map(); const G = (i) => { for (const [k, g] of gcache) if (g.set.has(i)) return g; const g = group(n, b, i); g.set = new Set(g.stones); gcache.set(i, g); return g; };
    const early = Math.max(0, 1 - S.ply / (n * n * 0.5));
    for (let i = 0; i < n * n; i++) {
      if (b[i] >= 0 || i === S.ko) continue;
      const r = tryPlay(S, i, p); if (!r) continue;
      const own = N[i].filter((j) => b[j] === p), foe = N[i].filter((j) => b[j] === 1 - p), empty = N[i].filter((j) => b[j] < 0);
      // never fill your own eye
      if (!r.took.length && !foe.length && !empty.length && own.length === N[i].length) { const diag = []; const rr = Math.floor(i / n), cc = i % n; for (const [a, c] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) { const x = rr + a, y = cc + c; if (x >= 0 && y >= 0 && x < n && y < n) diag.push(b[x * n + y]); } const bad = diag.filter((v) => v === 1 - p).length; if (bad < (diag.length < 4 ? 1 : 2)) continue; }
      let sc = r.took.length * 12 + (r.took.length ? 4 : 0);
      const after = group(n, r.b, i), libs = after.libs.size;
      for (const j of own) { const g = G(j); if (g.libs.size === 1) sc += libs >= 2 ? g.stones.length * 9 + 4 : 0; }
      for (const j of new Set(foe.map((j) => G(j)))) { const g = j; if (g.libs.size === 2 && !r.took.length) sc += 2.5 + g.stones.length * 0.8; }
      if (libs === 1 && !r.took.length) sc -= after.stones.length * 7 + 5; else if (libs === 2 && after.stones.length > 2) sc -= 1;
      const rr = Math.floor(i / n), cc = i % n, edge = Math.min(rr, cc, n - 1 - rr, n - 1 - cc);
      sc += early * (edge === 2 || edge === 3 ? 2 : edge === 0 ? -3 : edge === 1 ? -1.2 : 0.8);
      if (edge === 0 && !r.took.length && !foe.length) sc -= 1.5;
      const v = inf[i]; sc += v > 1.4 ? -3 : v < -1.6 ? -1.5 : 2.2 - Math.abs(v) * 1.2;
      if (S.ply > 4 && !own.length && !foe.length) { let close = false; for (let dr = -2; dr <= 2 && !close; dr++) for (let dc = -2; dc <= 2; dc++) { const x = rr + dr, y = cc + dc; if (x >= 0 && y >= 0 && x < n && y < n && b[x * n + y] >= 0) { close = true; break; } } if (!close) sc += early * 1.5 - 0.6; }
      out.push({ m: i, label: NAME(n, i) + (r.took.length ? ` (captures ${r.took.length})` : ""), score: sc + Math.random() * 0.3 });
    }
    out.sort((x, y) => y.score - x.score);
    const best = out.length ? out[0].score : -99, { pts } = score(S), ahead = pts[p] - pts[1 - p] > 0;
    const passScore = best < 0.8 || (S.passes === 1 && ahead && best < 6) ? best + 1 : -50;
    out.push({ m: -1, label: "pass", score: passScore }); out.sort((x, y) => y.score - x.score);
    if (S.passes === 1 && ahead && out[0].m !== -1 && best < 6) { const k = out.findIndex((x) => x.m === -1); out.unshift(out.splice(k, 1)[0]); }
    return out;
  }
  const E = { setup, moves, apply, rank, over, score, tryPlay, group, KOMI };
  if (typeof module === "object" && module.exports) { module.exports = E; return; }
  const K = root.Kit;
  root.KG.add({
    id: "go", title: "Go", icon: "⚫",
    rules: "Take turns placing a stone on an empty point; whoever starts plays black. A group of stones with no empty point next to it (no liberties) is captured. You can't fill your own last liberty unless it captures, and you can't retake a single stone straight back (ko). Pass when there's nothing useful left; two passes in a row end the game. Score is area: your stones plus empty points walled in only by you. White gets 6.5 points for going second. Stones left on the board count as alive, so finish off dead groups before you pass. Pick 9, 13 or 19 lines below the board.",
    achievements: [
      { id: "big", icon: "🍙", name: "Big Catch", about: "Capture five or more stones in one move." },
      { id: "twenty", icon: "🏔", name: "Landslide", about: "Win by 20 points or more." },
      { id: "nineteen", icon: "🎌", name: "Full Board", about: "Finish a 19 x 19 game." },
    ],
    mount(api) {
      return K.turnGame(api, {
        ...E, botMs: 300, thinkMs: 350,
        mount(el, H) {
          const v = { bar: K.el("div"), box: K.el("div", "gobox"), ctl: K.el("div", "ctrl") }; el.append(v.bar, v.box, v.ctl);
          K.onPick(v.box, (i) => H.mine() && H.legal().includes(i) && H.play(i));
          v.pass = K.btn("btn alt", "Pass", () => H.mine() && H.play(-1));
          const lab = K.el("label", "", "Board "), sel = K.el("select"); for (const n of [9, 13, 19]) { const o = K.el("option", "", `${n} × ${n}`); o.value = n; sel.append(o); }
          sel.value = api.pref("size", 9); sel.onchange = () => { if (H.busy) { sel.value = H.S.n; return; } api.setPref("size", Number(sel.value)); H.set(setup(H.S.seats[0], api, Number(sel.value)), true); K.sfx.open(); };
          lab.append(sel); v.ctl.append(v.pass, lab); v.sel = sel; return v;
        },
        draw(v, S, H) {
          const sc = score(S);
          v.bar.replaceChildren(K.players(H, (i) => `${i ? "white" : "black"} · ${S.caps[i]} taken · ${sc.pts[i]} pts`));
          const st = S.b.map((x) => (x < 0 ? "" : x ? "w" : "b")), o = over(S), marks = {};
          if (o) sc.terr.forEach((t, i) => { if (t >= 0) marks[i] = t ? "#fffaf0" : "#1b1b20"; });
          v.box.innerHTML = K.goSVG(S.n, st, { last: S.last, fresh: S.last, hot: H.mine() ? H.legal().filter((i) => i >= 0) : [], marks });
          v.pass.disabled = !H.mine(); v.sel.value = S.n; v.sel.disabled = S.ply > 0 && !o;
        },
        animate: async (v, S0, m, S1) => { if (m < 0) K.sfx.tick(); else { K.sfx.place(); if (S1.took.length) { await K.wait(150); K.sfx.pop(); } } },
        feats(S0, m, S1, who) { if (S1.took.length >= 5) api.achieve("big", who); const o = over(S1); if (o) { const { pts } = score(S1), wi = S1.seats.indexOf(o.result); if (pts[wi] - pts[1 - wi] >= 20) api.achieve("twenty", o.result); if (S1.n === 19) { api.achieve("nineteen", "you"); api.achieve("nineteen", "kin"); } } },
        situation: (S) => { const { pts } = score(S); return `${S.n}x${S.n} board, you are ${S.turn ? "white" : "black"}. Area count now: you ${pts[S.turn]}, them ${pts[1 - S.turn]}.${S.passes ? " They just passed." : ""}`; },
        yourTurn: (S) => (S.passes ? "They passed. Play on, or pass to end and count." : "Your turn: place a stone, or pass."),
      });
    },
  });
})(typeof self !== "undefined" ? self : this);
