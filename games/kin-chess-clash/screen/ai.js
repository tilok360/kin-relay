// Chess Clash: the computer opponent. Iterative deepening alpha-beta on top of engine.js, searched one root move at a
// time with a yield between moves so the screen never freezes. Runs entirely on the screen: no network, no Kin.
(function (root) {
  "use strict";
  const E = root.ChessEngine || (typeof require === "function" ? require("./engine.js") : null);
  const LEVELS = {
    beginner: { depth: 1, ms: 300, noise: 260, label: "Beginner" },
    easy: { depth: 2, ms: 700, noise: 90, label: "Easy" },
    normal: { depth: 3, ms: 1400, noise: 18, label: "Normal" },
    hard: { depth: 5, ms: 2600, noise: 0, label: "Hard" },
  };
  const tick = () => new Promise((r) => setTimeout(r, 0));
  const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

  // Scores every root move at increasing depth until the time runs out. Returns [{m, score}] best first.
  async function scoreMoves(S, maxDepth, budgetMs, onProgress) {
    const moves = E.order(E.legal(S));
    if (!moves.length) return [];
    let done = moves.map((m) => ({ m, score: 0 }));
    const t0 = now();
    for (let d = 1; d <= maxDepth; d++) {
      const out = []; let alpha = -1e9, aborted = false;
      for (let i = 0; i < done.length; i++) {
        const m = done[i].m, n = E.make(S, m);
        // Full window for honest scores at shallow depth (used for variety); narrow after that.
        let v = -E.search(n, d - 1, -1e9, d <= 2 ? 1e9 : -alpha + 1, 1);
        const k = E.key(n); if (S.keys && S.keys.filter((x) => x === k).length >= 2) v = Math.min(v, 0); // avoid needless repetition draws
        out.push({ m, score: v });
        if (v > alpha) alpha = v;
        if (i % 2 === 1) { await tick(); if (onProgress) onProgress(d, i / done.length); }
        if (d > 1 && now() - t0 > budgetMs) { aborted = true; break; }
      }
      if (aborted) {
        // Keep the deeper result only for the moves already searched, if the best of them beats the old best.
        out.sort((a, b) => b.score - a.score);
        if (out.length && out[0].m === done[0].m) done = out.concat(done.filter((x) => !out.some((o) => o.m === x.m)));
        break;
      }
      done = out.sort((a, b) => b.score - a.score);
      if (Math.abs(done[0].score) > 90000) break; // a forced mate was found
      if (now() - t0 > budgetMs * 0.45 && d < maxDepth) break; // the next depth won't finish in time
    }
    return done;
  }

  // The computer's move at a level. Noise in centipawns makes the lower levels human-ish.
  async function think(S, level, opts) {
    const L = LEVELS[level] || LEVELS.normal, speed = (opts && opts.speed) || 1;
    const scored = await scoreMoves(S, L.depth, L.ms * speed, opts && opts.onProgress);
    if (!scored.length) return null;
    if (!L.noise) return scored[0].m;
    let best = null, bv = -Infinity;
    for (const x of scored) { const v = x.score + (Math.random() * 2 - 1) * L.noise; if (v > bv) { bv = v; best = x; } }
    // Never miss a mate in one at Normal, and don't hang mates at any level above Beginner.
    if (level !== "beginner" && scored[0].score > 90000) return scored[0].m;
    return best.m;
  }

  // Ranked options for the Kin to pick from, like engine.ranked but without blocking the screen.
  async function ranked(S, depth) {
    const all = E.legal(S), scored = await scoreMoves(S, depth || 3, 2500);
    return scored.map((x) => { const t = E.san(S, x.m, all); return { m: x.m, san: t, score: x.score, label: `${t} (${E.words(x.m, t)})` }; });
  }

  const AI = { think, ranked, scoreMoves, LEVELS };
  if (typeof module === "object" && module.exports) module.exports = AI;
  root.ChessAI = AI;
})(typeof self !== "undefined" ? self : this);
