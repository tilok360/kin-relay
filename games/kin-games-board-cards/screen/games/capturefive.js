// Capture Five (five in a row with captures) on a 13 x 13 board: five in a row wins, and so does capturing five pairs.
// Flank exactly two enemy stones in a line with your stones and they come off.
(function (root) {
  "use strict";
  const N = 13, DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]], ALL8 = [[0, 1], [1, 0], [1, 1], [1, -1], [0, -1], [-1, 0], [-1, -1], [-1, 1]];
  const at = (r, c) => (r >= 0 && r < N && c >= 0 && c < N ? r * N + c : -1);
  const NAME = (i) => "ABCDEFGHJKLMN"[i % N] + (N - Math.floor(i / N));
  const setup = (first) => ({ seats: first === "you" ? ["you", "kin"] : ["kin", "you"], turn: 0, b: Array(N * N).fill(-1), caps: [0, 0], ply: 0, last: -1, took: [] });
  function capturesAt(b, i, p) {
    const r = Math.floor(i / N), c = i % N, out = [];
    for (const [dr, dc] of ALL8) { const a = at(r + dr, c + dc), b2 = at(r + 2 * dr, c + 2 * dc), e = at(r + 3 * dr, c + 3 * dc); if (e >= 0 && b[a] === 1 - p && b[b2] === 1 - p && b[e] === p) out.push(a, b2); }
    return out;
  }
  function moves(S) { if (over(S)) return []; if (S.ply === 0) return [at(6, 6)]; return S.b.map((x, i) => (x < 0 ? i : -1)).filter((i) => i >= 0); }
  function apply(S, i) { const b = S.b.slice(), p = S.turn; b[i] = p; const took = capturesAt(b, i, p); for (const k of took) b[k] = -1; const caps = S.caps.slice(); caps[p] += took.length / 2; return { ...S, b, caps, turn: 1 - p, ply: S.ply + 1, last: i, took }; }
  function line5(b, p) {
    for (let i = 0; i < N * N; i++) { if (b[i] !== p) continue; const r = Math.floor(i / N), c = i % N; for (const [dr, dc] of DIRS) { const l = [i]; for (let k = 1; k < 9; k++) { const j = at(r + dr * k, c + dc * k); if (j < 0 || b[j] !== p) break; l.push(j); } if (l.length >= 5) return l; } }
    return null;
  }
  function over(S) {
    for (const p of [0, 1]) { if (S.caps[p] >= 5) return { result: S.seats[p], detail: "five pairs captured" }; const l = line5(S.b, p); if (l) return { result: S.seats[p], detail: "five in a row", line: l }; }
    if (S.b.every((x) => x >= 0)) return { result: "draw", detail: "the board filled" };
    return null;
  }
  // How strong a stone at i would be for p: runs and open ends in each direction.
  function lineScore(b, i, p) {
    const r = Math.floor(i / N), c = i % N; let s = 0;
    for (const [dr, dc] of DIRS) {
      let n = 1, open = 0, gap = 0;
      for (const sg of [1, -1]) { let k = 1; for (; k < 5; k++) { const j = at(r + dr * k * sg, c + dc * k * sg); if (j < 0 || b[j] !== p) { if (j >= 0 && b[j] < 0) { open++; const j2 = at(r + dr * (k + 1) * sg, c + dc * (k + 1) * sg); if (j2 >= 0 && b[j2] === p) gap++; } break; } n++; } }
      if (n >= 5) s += 1e6; else if (n === 4) s += open === 2 ? 6e4 : open ? 9e3 : 0; else if (n === 3) s += open === 2 ? 4e3 + gap * 2e3 : open ? 500 : 0; else if (n === 2) s += open === 2 ? 220 + gap * 600 : open ? 40 : 0; else s += open * 4 + gap * 150;
    }
    return s;
  }
  // Would a stone at i leave a pair of p's that the enemy can flank next turn?
  function exposed(b, i, p) { const r = Math.floor(i / N), c = i % N; let n = 0; for (const [dr, dc] of ALL8) { const a = at(r + dr, c + dc), e = at(r + 2 * dr, c + 2 * dc), back = at(r - dr, c - dc); if (a >= 0 && b[a] === p && ((e >= 0 && b[e] === 1 - p && back >= 0 && b[back] < 0) || (e >= 0 && b[e] < 0 && back >= 0 && b[back] === 1 - p))) n++; } return n; }
  function rank(S, level) {
    const p = S.turn, b = S.b, ms = moves(S);
    if (S.ply === 0) return [{ m: ms[0], label: "the center", score: 1 }];
    const near = (i) => { const r = Math.floor(i / N), c = i % N; for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) { const j = at(r + dr, c + dc); if (j >= 0 && b[j] >= 0) return true; } return false; };
    const def = level === "beginner" ? 0.4 : level === "easy" ? 0.7 : 1.05;
    return ms.filter(near).map((i) => {
      const capMe = capturesAt(b, i, p).length / 2, capFoe = capturesAt(b, i, 1 - p).length / 2;
      let sc = lineScore(b, i, p) + def * lineScore(b, i, 1 - p) * 0.95;
      sc += capMe * (S.caps[p] + capMe >= 5 ? 2e6 : 1800 + S.caps[p] * 900) + capFoe * (S.caps[1 - p] + capFoe >= 5 ? 1.5e6 : 1500 + S.caps[1 - p] * 700) * def;
      b[i] = p; sc -= exposed(b, i, p) * (S.caps[1 - p] >= 4 ? 5e5 : 1400); b[i] = -1;
      return { m: i, label: NAME(i) + (capMe ? `, capturing ${capMe} pair${capMe > 1 ? "s" : ""}` : ""), score: sc + Math.random() };
    }).sort((x, y) => y.score - x.score);
  }
  const E = { N, setup, moves, apply, rank, over, capturesAt };
  if (typeof module === "object" && module.exports) { module.exports = E; return; }
  const K = root.Kit;
  root.KG.add({
    id: "capturefive", title: "Capture Five", icon: "⚫",
    rules: "Take turns placing a stone on an empty point; whoever starts plays black and opens in the center. Five or more in a row (across, down or diagonal) wins. If your stone flanks exactly two enemy stones in a line, those two are captured. Capture five pairs and you win too. Placing your own stone between two enemies is safe.",
    achievements: [
      { id: "fivepairs", icon: "🎯", name: "Pair Collector", about: "Win by capturing five pairs." },
      { id: "double", icon: "✂", name: "Double Snip", about: "Capture two pairs with one stone." },
      { id: "clean", icon: "🧊", name: "Untouchable", about: "Win without losing a single pair." },
    ],
    mount(api) {
      return K.turnGame(api, {
        ...E,
        mount(el, H) { const v = { bar: K.el("div"), box: K.el("div", "gobox") }; el.append(v.bar, v.box); K.onPick(v.box, (i) => H.mine() && H.legal().includes(i) && H.play(i)); return v; },
        draw(v, S, H) {
          v.bar.replaceChildren(K.players(H, (i) => `${i ? "white" : "black"} · ${S.caps[i]}/5 pairs`));
          const st = S.b.map((x) => (x < 0 ? "" : x ? "w" : "b")), o = over(S), marks = {};
          if (o && o.line) o.line.forEach((i) => (marks[i] = "#ffd76a"));
          v.box.innerHTML = K.goSVG(N, st, { last: S.last, fresh: S.last, hot: H.mine() ? H.legal() : [], marks });
        },
        animate: async (v, S0, m, S1) => { K.sfx.place(); if (S1.took.length) { await K.wait(150); K.sfx.pop(); } },
        feats(S0, m, S1, who) {
          if (S1.took.length >= 4) api.achieve("double", who);
          const o = over(S1); if (o && o.result === who) { const p = S0.turn; if (S1.caps[p] >= 5) api.achieve("fivepairs", who); if (!S1.caps[1 - p]) api.achieve("clean", who); }
        },
        situation: (S) => `You are ${S.turn ? "white" : "black"}. Pairs captured: you ${S.caps[S.turn]}, them ${S.caps[1 - S.turn]}.`,
        yourTurn: (S) => (S.ply === 0 ? "You open: tap the center point." : "Your turn: place a stone."),
      });
    },
  });
})(typeof self !== "undefined" ? self : this);
