// Dots and boxes on a 4 x 4 grid of boxes (5 x 5 dots). Lines: h[r][c] runs from dot (r,c) to (r,c+1),
// v[r][c] from dot (r,c) to (r+1,c). Closing a box scores it and you draw again.
(function (root) {
  "use strict";
  const ROWS = "ABCDEFGH";
  function start(R, C) { return { R, C, h: Array((R + 1) * C).fill(""), v: Array(R * (C + 1)).fill(""), box: Array(R * C).fill("") }; }
  const clone = (g) => ({ R: g.R, C: g.C, h: g.h.slice(), v: g.v.slice(), box: g.box.slice() });
  const sides = (g, r, c) => (g.h[r * g.C + c] ? 1 : 0) + (g.h[(r + 1) * g.C + c] ? 1 : 0) + (g.v[r * (g.C + 1) + c] ? 1 : 0) + (g.v[r * (g.C + 1) + c + 1] ? 1 : 0);
  function boxesOf(g, m) {
    const out = [];
    if (m.t === "h") { if (m.r > 0) out.push([m.r - 1, m.c]); if (m.r < g.R) out.push([m.r, m.c]); }
    else { if (m.c > 0) out.push([m.r, m.c - 1]); if (m.c < g.C) out.push([m.r, m.c]); }
    return out;
  }
  const idx = (g, m) => (m.t === "h" ? m.r * g.C + m.c : m.r * (g.C + 1) + m.c);
  function free(g) {
    const out = [];
    for (let r = 0; r <= g.R; r++) for (let c = 0; c < g.C; c++) if (!g.h[r * g.C + c]) out.push({ t: "h", r, c });
    for (let r = 0; r < g.R; r++) for (let c = 0; c <= g.C; c++) if (!g.v[r * (g.C + 1) + c]) out.push({ t: "v", r, c });
    return out;
  }
  // Draws a line for `who`; returns how many boxes it closed.
  function draw(g, m, who) {
    g[m.t][idx(g, m)] = who;
    let n = 0;
    for (const [r, c] of boxesOf(g, m)) if (sides(g, r, c) === 4 && !g.box[r * g.C + c]) { g.box[r * g.C + c] = who; n++; }
    return n;
  }
  const closes = (g, m) => boxesOf(g, m).filter(([r, c]) => sides(g, r, c) === 3).length;
  const opens = (g, m) => boxesOf(g, m).some(([r, c]) => sides(g, r, c) === 2);
  // How many boxes the other side could take in a row after this line.
  function giveaway(g, m) {
    const t = clone(g); draw(t, m, "x");
    let n = 0;
    for (;;) { const c = free(t).find((x) => closes(t, x)); if (!c) break; n += draw(t, c, "z"); }
    return n;
  }
  const dot = (r, c) => ROWS[r] + (c + 1);
  const lineName = (m) => (m.t === "h" ? `${dot(m.r, m.c)}–${dot(m.r, m.c + 1)}` : `${dot(m.r, m.c)}–${dot(m.r + 1, m.c)}`);
  function ranked(g) {
    return free(g).map((m) => {
      const k = closes(g, m);
      let score, note;
      if (k) { score = 100 * k; note = k === 1 ? "closes a box" : `closes ${k} boxes`; }
      else if (!opens(g, m)) { score = 10 + Math.random(); note = "safe"; }
      else { const n = giveaway(g, m); score = -20 * n; note = `lets them take ${n} box${n === 1 ? "" : "es"}`; }
      return { m, score, label: `${lineName(m)} (${note})` };
    }).sort((a, b) => b.score - a.score);
  }
  const score = (g, who) => g.box.filter((x) => x === who).length;
  const E = { start, free, draw, closes, ranked, score, lineName, giveaway };
  if (typeof module === "object" && module.exports) { module.exports = E; return; }

  root.KG.add({
    id: "dots", title: "Dots and boxes", icon: "▦", blurb: "Close the most boxes.",
    rules: "Take turns drawing one line between two dots next to each other. Draw the fourth side of a box and it's yours, and you draw again. When every line is drawn, whoever owns more boxes wins. You and your Kin take turns going first. Tap between two dots to draw.",
    achievements: [
      { id: "chain", icon: "⛓", name: "Chain Reaction", about: "Close four or more boxes in one turn." },
      { id: "domination", icon: "🏁", name: "Domination", about: "Win with eleven or more of the sixteen boxes." },
      { id: "photo_finish", icon: "📸", name: "Photo Finish", about: "Win by a single box." },
    ],
    mount(api) {
      let S = null, busy = false, dead = false;
      const info = document.createElement("div"); info.className = "score";
      const NS = "http://www.w3.org/2000/svg";
      const svg = document.createElementNS(NS, "svg"); svg.style.width = "100%"; svg.style.display = "block"; svg.style.maxWidth = "460px"; svg.style.margin = "auto";
      api.el.append(info, svg);
      const U = 100, P = 26;
      function el(tag, attrs) { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; }
      function render() {
        const g = S.g; svg.setAttribute("viewBox", `0 0 ${g.C * U + 2 * P} ${g.R * U + 2 * P}`); svg.textContent = "";
        for (let r = 0; r < g.R; r++) for (let c = 0; c < g.C; c++) {
          const o = g.box[r * g.C + c]; if (!o) continue;
          svg.append(el("rect", { x: P + c * U + 6, y: P + r * U + 6, width: U - 12, height: U - 12, rx: 10, fill: o === "you" ? "rgba(240,179,90,.28)" : "rgba(143,184,255,.28)" }));
          const t = el("text", { x: P + c * U + U / 2, y: P + r * U + U / 2 + 12, "text-anchor": "middle", "font-size": 34, "font-weight": 700, fill: o === "you" ? "#f0b35a" : "#8fb8ff" }); t.textContent = o === "you" ? "Y" : "K"; svg.append(t);
        }
        const lines = [];
        for (let r = 0; r <= g.R; r++) for (let c = 0; c < g.C; c++) lines.push({ t: "h", r, c });
        for (let r = 0; r < g.R; r++) for (let c = 0; c <= g.C; c++) lines.push({ t: "v", r, c });
        const mine = !busy && S.turn === "you" && !api.ended();
        for (const m of lines) {
          const x1 = P + m.c * U, y1 = P + m.r * U, x2 = m.t === "h" ? x1 + U : x1, y2 = m.t === "h" ? y1 : y1 + U, who = g[m.t][m.t === "h" ? m.r * g.C + m.c : m.r * (g.C + 1) + m.c];
          const last = S.last && S.last.t === m.t && S.last.r === m.r && S.last.c === m.c;
          svg.append(el("line", { x1, y1, x2, y2, stroke: who ? (who === "you" ? "#f0b35a" : "#8fb8ff") : "rgba(255,255,255,.12)", "stroke-width": who ? (last ? 11 : 8) : 4, "stroke-linecap": "round", "stroke-dasharray": who ? "" : "2 12" }));
          if (!who && mine) {
            const hit = el("line", { x1, y1, x2, y2, stroke: "transparent", "stroke-width": 40, style: "cursor:pointer" });
            hit.addEventListener("click", () => tap(m)); svg.append(hit);
          }
        }
        for (let r = 0; r <= g.R; r++) for (let c = 0; c <= g.C; c++) svg.append(el("circle", { cx: P + c * U, cy: P + r * U, r: 8, fill: "#f6efe6" }));
        info.innerHTML = `<span><b class="you">You</b> ${score(g, "you")}</span><span><b class="kinc"></b> ${score(g, "kin")}</span>`;
        info.querySelector(".kinc").textContent = api.kinName();
        if (mine) api.status("Your line: tap between two dots.");
      }
      function finished() {
        if (free(S.g).length) return false;
        const y = score(S.g, "you"), k = score(S.g, "kin");
        if (y >= 11) api.achieve("domination", "you"); if (k >= 11) api.achieve("domination", "kin");
        if (Math.abs(y - k) === 1) api.achieve("photo_finish", y > k ? "you" : "kin");
        S.turn = "done"; api.save(S); render();
        api.over(y > k ? "you" : k > y ? "kin" : "draw", `${y} boxes to ${k}`);
        return true;
      }
      let run = { who: "", n: 0 };
      function boxes(who, n) {
        if (!n) { run = { who: "", n: 0 }; return; }
        run = run.who === who ? { who, n: run.n + n } : { who, n };
        if (run.n >= 4) api.achieve("chain", who);
      }
      function tap(m) {
        if (busy || dead || S.turn !== "you" || api.ended()) return;
        const n = draw(S.g, m, "you"); S.last = m; boxes("you", n);
        if (finished()) return;
        if (!n) S.turn = "kin";
        api.save(S); render();
        if (n) api.status(`You closed ${n === 1 ? "a box" : n + " boxes"}: draw again.`);
        else kinTurn();
      }
      async function kinTurn() {
        while (!dead && S.turn === "kin" && !api.ended()) {
          busy = true; render();
          await new Promise((r) => setTimeout(r, 450));
          const r = ranked(S.g);
          let m;
          if (r[0].score >= 100 && api.settings.level !== "easy" && api.settings.level !== "beginner") m = r[0].m;          // it always takes a free box
          else {
            const situation = `Dots are named by row (A at the top) and column (1 at the left). Boxes: you ${score(S.g, "kin")}, your person ${score(S.g, "you")}, ${S.g.box.filter((x) => !x).length} still open. Drawing a box's third side lets them take it.`;
            const pick = await api.kinMove({ ranked: r, situation });
            if (dead || !pick) return;
            m = pick.m;
          }
          const n = draw(S.g, m, "kin"); S.last = m; boxes("kin", n);
          if (finished()) return;
          if (!n) S.turn = "you";
          api.save(S);
          if (n >= 2 && api.settings.mode === "talk") api.line(`You just took ${n} boxes in a row.`);
        }
        busy = false; render();
      }
      (async () => {
        S = api.state && api.state.g ? api.state : null;
        if (!S) { const first = await api.firstMover(); S = { v: 1, g: start(4, 4), turn: first, last: null }; api.save(S); }
        render();
        if (S.turn === "kin") kinTurn();
      })();
      return { destroy() { dead = true; } };
    },
  });
})(typeof self !== "undefined" ? self : this);
