// Othello (Reversi): place a disc so it traps a straight line of your opponent's discs between it and another of
// yours, and they all flip. No move means a pass; when neither side can move, the most discs wins.
// Squares 0-63, row 0 at the top. 'y' are yours (dark), 'k' your Kin's (light). Dark moves first.
(function (root) {
  "use strict";
  const D8 = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
  const FILES = "abcdefgh";
  const name = (i) => FILES[i & 7] + ((i >> 3) + 1);
  const other = (w) => (w === "y" ? "k" : "y");
  function start(yourColour) {
    const b = Array(64).fill("");
    // The dark player gets d5 and e4 (seen from the top-left), the light player d4 and e5.
    const dark = yourColour === "dark" ? "y" : "k", light = other(dark);
    b[27] = light; b[36] = light; b[28] = dark; b[35] = dark;
    return b;
  }
  function flips(b, sq, me) {
    if (b[sq]) return [];
    const out = [], r0 = sq >> 3, c0 = sq & 7, foe = other(me);
    for (const [dr, dc] of D8) {
      const line = []; let r = r0 + dr, c = c0 + dc;
      while (r >= 0 && r < 8 && c >= 0 && c < 8 && b[r * 8 + c] === foe) { line.push(r * 8 + c); r += dr; c += dc; }
      if (line.length && r >= 0 && r < 8 && c >= 0 && c < 8 && b[r * 8 + c] === me) out.push(...line);
    }
    return out;
  }
  const moves = (b, me) => { const out = []; for (let i = 0; i < 64; i++) { const f = flips(b, i, me); if (f.length) out.push({ sq: i, flips: f }); } return out; };
  function apply(b, m, me) { const n = b.slice(); n[m.sq] = me; m.flips.forEach((i) => (n[i] = me)); return n; }
  const count = (b, me) => b.filter((x) => x === me).length;
  const W = [120, -20, 20, 5, 5, 20, -20, 120, -20, -40, -5, -5, -5, -5, -40, -20, 20, -5, 15, 3, 3, 15, -5, 20, 5, -5, 3, 3, 3, 3, -5, 5,
    5, -5, 3, 3, 3, 3, -5, 5, 20, -5, 15, 3, 3, 15, -5, 20, -20, -40, -5, -5, -5, -5, -40, -20, 120, -20, 20, 5, 5, 20, -20, 120];
  function evaluate(b, me) {
    const foe = other(me); let s = 0;
    for (let i = 0; i < 64; i++) if (b[i] === me) s += W[i]; else if (b[i] === foe) s -= W[i];
    const empty = b.filter((x) => !x).length;
    s += (moves(b, me).length - moves(b, foe).length) * 6;
    if (empty < 12) s += (count(b, me) - count(b, foe)) * 4;
    return s;
  }
  function search(b, me, depth, alpha, beta, passed) {
    const ms = moves(b, me);
    if (!ms.length) {
      if (passed || !moves(b, other(me)).length) { const d = count(b, me) - count(b, other(me)); return d * 1000; }
      return -search(b, other(me), depth, -beta, -alpha, true);
    }
    if (depth <= 0) return evaluate(b, me);
    for (const m of ms) {
      const v = -search(apply(b, m, me), other(me), depth - 1, -beta, -alpha, false);
      if (v >= beta) return v;
      if (v > alpha) alpha = v;
    }
    return alpha;
  }
  const where = (i) => ([0, 7, 56, 63].includes(i) ? "a corner" : [1, 8, 9, 6, 14, 15, 48, 49, 57, 54, 55, 62].includes(i) ? "next to a corner" : (i >> 3) % 7 === 0 || (i & 7) % 7 === 0 ? "an edge" : "");
  function ranked(b, me, depth) {
    return moves(b, me).map((m) => {
      const w = where(m.sq);
      return { m, score: -search(apply(b, m, me), other(me), (depth || 4) - 1, -1e9, 1e9, false), label: `${name(m.sq)} (flips ${m.flips.length}${w ? ", " + w : ""})` };
    }).sort((x, y) => y.score - x.score);
  }
  const E = { start, flips, moves, apply, count, ranked, name };
  if (typeof module === "object" && module.exports) { module.exports = E; return; }

  root.KG.add({
    id: "othello", title: "Reversi", icon: "⚫", blurb: "Flip their discs to your colour.",
    rules: "Also called Reversi. Place a disc so that it traps a straight line (across, down or diagonal) of your Kin's discs between it and one of yours; every trapped disc flips to your colour. A move must flip at least one disc. If you can't move you pass; when neither of you can, whoever has more discs wins. Dark moves first; you and your Kin take turns being dark. Dots show where you can play.",
    achievements: [
      { id: "big_flip", icon: "🔄", name: "Big Flip", about: "Flip eight or more discs in one move." },
      { id: "four_corners", icon: "🏰", name: "Four Corners", about: "Hold all four corners at once." },
      { id: "landslide", icon: "🌊", name: "Landslide", about: "Win by thirty discs or more." },
    ],
    mount(api) {
      let S = null, busy = false, dead = false;
      const info = document.createElement("div"); info.className = "score";
      const board = document.createElement("div"); board.className = "sq-board"; board.style.gridTemplateColumns = "repeat(8,1fr)"; board.style.borderColor = "#1d3b27";
      api.el.append(info, board);
      const cells = [];
      for (let i = 0; i < 64; i++) { const b = document.createElement("button"); b.type = "button"; b.className = "sq"; b.style.background = "#2f7a4a"; b.style.boxShadow = "inset 0 0 0 1px #1d4d30"; b.onclick = () => tap(i); board.append(b); cells.push(b); }
      const disc = (who, dark) => { const d = document.createElement("span"); d.className = "man"; d.style.background = dark ? "radial-gradient(circle at 35% 30%,#555,#0d0d0d)" : "radial-gradient(circle at 35% 30%,#fff,#cfcfcf)"; d.style.boxShadow = "0 2px 3px rgba(0,0,0,.45)" + (who === "y" ? ",0 0 0 2px var(--you)" : ""); return d; };
      function draw() {
        const can = !busy && S.turn === "y" && !api.ended() ? new Set(moves(S.b, "y").map((m) => m.sq)) : new Set();
        cells.forEach((c, i) => {
          c.textContent = "";
          const p = S.b[i];
          if (p) c.append(disc(p, (p === "y") === S.youDark));
          else if (can.has(i)) c.append(Object.assign(document.createElement("span"), { className: "dot" }));
          c.style.outline = S.last === i ? "3px solid rgba(255,214,90,.85)" : ""; c.style.outlineOffset = "-3px";
          c.setAttribute("aria-label", name(i) + (p ? (p === "y" ? " yours" : " your Kin's") : can.has(i) ? ", you can play here" : ""));
        });
        info.innerHTML = `<span><b class="you">You</b> (${S.youDark ? "dark" : "light"}) ${count(S.b, "y")}</span><span><b class="kinc"></b> ${count(S.b, "k")}</span>`;
        info.querySelector(".kinc").textContent = api.kinName();
        if (!busy && S.turn === "y" && !api.ended()) api.status("Your move: tap a square with a dot.");
      }
      function next(after) {
        // Whoever is next, unless they must pass; the game ends when neither can move.
        const want = other(after);
        if (moves(S.b, want).length) { S.turn = want; return want; }
        if (moves(S.b, after).length) { S.turn = after; api.status(want === "y" ? "You have no move, so you pass." : `${api.kinName()} has no move and passes.`); return after; }
        S.turn = "done";
        const y = count(S.b, "y"), k = count(S.b, "k");
        if (y - k >= 30) api.achieve("landslide", "you"); if (k - y >= 30) api.achieve("landslide", "kin");
        api.save(S); draw();
        api.over(y > k ? "you" : k > y ? "kin" : "draw", `${y} discs to ${k}`);
        return null;
      }
      function feats(m, me) {
        const who = me === "y" ? "you" : "kin";
        if (m.flips.length >= 8) api.achieve("big_flip", who);
        if ([0, 7, 56, 63].every((c) => S.b[c] === me)) api.achieve("four_corners", who);
      }
      function tap(i) {
        if (busy || dead || S.turn !== "y" || api.ended()) return;
        const m = moves(S.b, "y").find((x) => x.sq === i); if (!m) return;
        S.b = apply(S.b, m, "y"); S.last = i; feats(m, "y");
        const who = next("y"); api.save(S); draw();
        if (who === "k") kinTurn();
      }
      async function kinTurn() {
        while (!dead && S.turn === "k" && !api.ended()) {
          busy = true; draw();
          await new Promise((r) => setTimeout(r, 300));
          const lvl = api.settings.level, r = ranked(S.b, "k", lvl === "beginner" ? 1 : lvl === "easy" ? 2 : lvl === "normal" ? 4 : 5);
          const situation = `You play ${S.youDark ? "light" : "dark"}, your person ${S.youDark ? "dark" : "light"}. Squares are a1 (top left) to h8 (bottom right). Discs: you ${count(S.b, "k")}, them ${count(S.b, "y")}. Corners can never be flipped back; squares next to an empty corner are risky.`;
          const pick = await api.kinMove({ ranked: r, situation });
          if (dead || !pick) return;
          S.b = apply(S.b, pick.m, "k"); S.last = pick.m.sq; feats(pick.m, "k"); busy = false;
          const who = next("k"); api.save(S); draw();
          if (who && api.settings.mode === "talk" && pick.m.flips.length >= 5) api.line(`You just flipped ${pick.m.flips.length} of their discs.`);
          if (who !== "k") break;
        }
        busy = false; draw();
      }
      (async () => {
        S = api.state && api.state.b ? api.state : null;
        if (!S) { const first = await api.firstMover(); const youDark = first === "you"; S = { v: 1, b: start(youDark ? "dark" : "light"), youDark, turn: youDark ? "y" : "k", last: -1 }; api.save(S); }
        draw();
        if (S.turn === "k") kinTurn();
      })();
      return { destroy() { dead = true; } };
    },
  });
})(typeof self !== "undefined" ? self : this);
