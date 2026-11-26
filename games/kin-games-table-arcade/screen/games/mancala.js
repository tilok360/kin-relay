// Mancala (Kalah, four seeds a pit). Pits 0-5 are yours (left to right as you look), 6 your store; 7-12 your Kin's
// (from its own left, so they run right to left along the top), 13 its store. Seeds go round counter-clockwise.
(function (root) {
  "use strict";
  const start = () => [4, 4, 4, 4, 4, 4, 0, 4, 4, 4, 4, 4, 4, 0];
  const pitsOf = (who) => (who === "you" ? [0, 1, 2, 3, 4, 5] : [7, 8, 9, 10, 11, 12]);
  const store = (who) => (who === "you" ? 6 : 13);
  const other = (w) => (w === "you" ? "kin" : "you");
  // Sow from pit i. Returns {b, again, captured, last, over}.
  function sow(b0, who, i) {
    const b = b0.slice(); let n = b[i], k = i; b[i] = 0;
    const skip = store(other(who));
    while (n > 0) { k = (k + 1) % 14; if (k === skip) continue; b[k]++; n--; }
    let captured = 0;
    if (pitsOf(who).includes(k) && b[k] === 1 && b[12 - k] > 0) { captured = b[12 - k] + 1; b[store(who)] += captured; b[k] = 0; b[12 - k] = 0; }
    const again = k === store(who);
    let over = false;
    if (pitsOf("you").every((p) => !b[p]) || pitsOf("kin").every((p) => !b[p])) {
      over = true;
      for (const w of ["you", "kin"]) for (const p of pitsOf(w)) { b[store(w)] += b[p]; b[p] = 0; }
    }
    return { b, again: again && !over, captured, last: k, over };
  }
  const legal = (b, who) => pitsOf(who).filter((p) => b[p] > 0);
  function search(b, who, depth, alpha, beta) {
    const ms = legal(b, who);
    if (!ms.length || depth <= 0) return b[store(who)] - b[store(other(who))];
    let best = -1e9;
    for (const p of ms) {
      const r = sow(b, who, p);
      const v = r.over ? r.b[store(who)] - r.b[store(other(who))] : r.again ? search(r.b, who, depth - 1, alpha, beta) : -search(r.b, other(who), depth - 1, -beta, -alpha);
      if (v > best) best = v;
      if (v > alpha) alpha = v;
      if (alpha >= beta) break;
    }
    return best;
  }
  const pitNo = (who, p) => (who === "you" ? p + 1 : p - 6);
  function ranked(b, who, depth) {
    return legal(b, who).map((p) => {
      const r = sow(b, who, p);
      const score = r.over ? r.b[store(who)] - r.b[store(other(who))] : r.again ? search(r.b, who, (depth || 8) - 1, -1e9, 1e9) : -search(r.b, other(who), (depth || 8) - 1, -1e9, 1e9);
      const note = r.again ? ", ends in your store for another turn" : r.captured ? `, captures ${r.captured} seeds` : "";
      return { pit: p, score, label: `pit ${pitNo(who, p)} (${b[p]} seeds${note})` };
    }).sort((x, y) => y.score - x.score);
  }
  const E = { start, sow, legal, ranked, store, pitsOf };
  if (typeof module === "object" && module.exports) { module.exports = E; return; }

  root.KG.add({
    id: "mancala", title: "Mancala", icon: "🥜", blurb: "Sow, capture, fill your store.",
    rules: "Kalah with four seeds in each pit. On your turn pick up all the seeds in one of your pits (the bottom row) and sow them one by one to the right and around, into your store at the right end but never into your Kin's. If the last seed lands in your store, go again. If it lands in an empty pit on your side, you capture it and everything in the pit opposite. When one side runs out of seeds, each player keeps what's left on their own side, and the fuller store wins. You and your Kin take turns going first.",
    achievements: [
      { id: "big_capture", icon: "🫳", name: "Big Capture", about: "Capture six or more seeds in one move." },
      { id: "free_turns", icon: "🔁", name: "Free Turn Frenzy", about: "Land in your store three times in a row." },
      { id: "landslide", icon: "🌊", name: "Landslide", about: "Win by fifteen seeds or more." },
    ],
    mount(api) {
      let S = null, busy = false, dead = false;
      const info = document.createElement("div"); info.className = "score";
      const board = document.createElement("div"); board.className = "mancala";
      api.el.append(info, board);
      const el = {};
      const mk = (i, cls, style) => { const b = document.createElement("button"); b.type = "button"; b.className = "pit " + cls; Object.assign(b.style, style); b.onclick = () => tap(i); board.append(b); el[i] = b; };
      mk(13, "store", { gridColumn: "1" });
      for (let k = 0; k < 6; k++) mk(12 - k, "", { gridColumn: String(2 + k), gridRow: "1" });
      mk(6, "store", { gridColumn: "8" });
      for (let k = 0; k < 6; k++) mk(k, "", { gridColumn: String(2 + k), gridRow: "2" });
      function draw() {
        const can = !busy && S.turn === "you" && !api.ended() ? legal(S.b, "you") : [];
        for (let i = 0; i < 14; i++) {
          const b = el[i], n = S.b[i];
          b.className = "pit" + (i === 6 || i === 13 ? " store" : "") + (can.includes(i) ? " can" : "") + (S.last === i ? " last" : "");
          b.textContent = "";
          b.append(String(n));
          if (n && i !== 6 && i !== 13) b.append(Object.assign(document.createElement("span"), { className: "seeds", textContent: "•".repeat(Math.min(n, 12)) }));
          if (i === 6 || i === 13) b.append(Object.assign(document.createElement("small"), { textContent: i === 6 ? "you" : "kin" }));
          b.setAttribute("aria-label", (i === 6 ? "your store" : i === 13 ? "your Kin's store" : i < 6 ? `your pit ${i + 1}` : `your Kin's pit ${i - 6}`) + `, ${n} seeds`);
        }
        info.innerHTML = `<span><b class="you">You</b> ${S.b[6]}</span><span><b class="kinc"></b> ${S.b[13]}</span>`;
        info.querySelector(".kinc").textContent = api.kinName();
        if (!busy && S.turn === "you" && !api.ended()) api.status("Your turn: tap one of your pits (the bottom row).");
      }
      async function animate(who, p) {
        // Show the seeds going round one at a time, then settle on the true result.
        const r = sow(S.b, who, p), b = S.b.slice(); let n = b[p], k = p; b[p] = 0;
        const skip = store(other(who)), shown = S.b;
        S.b = b;
        while (n > 0) { k = (k + 1) % 14; if (k === skip) continue; b[k]++; n--; S.last = k; draw(); await new Promise((res) => setTimeout(res, 140)); if (dead) return r; }
        S.b = r.b; S.last = r.last; draw();
        void shown;
        return r;
      }
      let again = { who: "", n: 0 };
      function feats(who, r) {
        if (r.captured >= 6) api.achieve("big_capture", who);
        if (r.again) { again = again.who === who ? { who, n: again.n + 1 } : { who, n: 1 }; if (again.n === 3) api.achieve("free_turns", who); }
        else again = { who: "", n: 0 };
      }
      function end() {
        const y = S.b[6], k = S.b[13];
        if (y - k >= 15) api.achieve("landslide", "you"); if (k - y >= 15) api.achieve("landslide", "kin");
        api.over(y > k ? "you" : k > y ? "kin" : "draw", `${y} to ${k}`);
      }
      async function tap(i) {
        if (busy || dead || S.turn !== "you" || api.ended() || !legal(S.b, "you").includes(i)) return;
        busy = true;
        const r = await animate("you", i);
        if (dead) return;
        feats("you", r);
        busy = false;
        if (r.over) { S.turn = "done"; api.save(S); draw(); return end(); }
        S.turn = r.again ? "you" : "kin"; api.save(S); draw();
        if (r.again) api.status("Your last seed landed in your store: go again.");
        else kinTurn();
      }
      async function kinTurn() {
        while (!dead && S.turn === "kin" && !api.ended()) {
          busy = true; draw();
          await new Promise((res) => setTimeout(res, 400));
          const lvl = api.settings.level, rk = ranked(S.b, "kin", lvl === "beginner" ? 2 : lvl === "easy" ? 4 : lvl === "normal" ? 7 : 9);
          const situation = `Your pits are numbered 1 to 6 from your own left; seeds go round counter-clockwise into your store. Your pits: ${[7, 8, 9, 10, 11, 12].map((p) => S.b[p]).join(", ")}. Their pits opposite yours: ${[5, 4, 3, 2, 1, 0].map((p) => S.b[p]).join(", ")}. Stores: you ${S.b[13]}, them ${S.b[6]}.`;
          const pick = await api.kinMove({ ranked: rk, situation });
          if (dead || !pick) return;
          const r = await animate("kin", pick.pit);
          if (dead) return;
          feats("kin", r);
          if (r.over) { S.turn = "done"; busy = false; api.save(S); draw(); return end(); }
          S.turn = r.again ? "kin" : "you"; api.save(S);
          if (r.again) api.status(`${api.kinName()}'s last seed landed in its store: it goes again.`);
          if (api.settings.mode === "talk" && r.captured >= 4) api.line(`You just captured ${r.captured} seeds.`);
        }
        busy = false; draw();
      }
      (async () => {
        S = api.state && api.state.b ? api.state : null;
        if (!S) { const first = await api.firstMover(); S = { v: 1, b: start(), turn: first, last: -1 }; api.save(S); }
        draw();
        if (S.turn === "kin") kinTurn();
      })();
      return { destroy() { dead = true; } };
    },
  });
})(typeof self !== "undefined" ? self : this);
