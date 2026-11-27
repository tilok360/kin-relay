// Code Breaker: each player cracks their own hidden code of four colours (six colours, repeats allowed). Black peg = right colour, right spot; white = right colour elsewhere.
(function (root) {
  "use strict";
  const TRIES = 10, N = 4, COLORS = 6;
  const ALL = []; for (let i = 0; i < COLORS ** N; i++) { const c = []; let x = i; for (let k = 0; k < N; k++) { c.push(x % COLORS); x = Math.floor(x / COLORS); } ALL.push(c.join("")); }
  function score(g, a) { let b = 0, w = 0; const cg = Array(COLORS).fill(0), ca = Array(COLORS).fill(0); for (let i = 0; i < N; i++) { if (g[i] === a[i]) b++; else { cg[g[i]]++; ca[a[i]]++; } } for (let k = 0; k < COLORS; k++) w += Math.min(cg[k], ca[k]); return b + "" + w; }
  const rnd = () => ALL[Math.floor(Math.random() * ALL.length)];
  const setup = (first) => ({ seats: first === "you" ? ["you", "kin"] : ["kin", "you"], secret: [rnd(), rnd()], rows: [[], []], turn: 0, ply: 0 });
  const solvedAt = (S, p) => S.rows[p].findIndex((r) => r.fb === N + "0");
  function over(S) {
    const a = solvedAt(S, 0), b = solvedAt(S, 1), na = S.rows[0].length, nb = S.rows[1].length;
    if (nb < na && nb < TRIES) return null;
    const ra = a >= 0 ? a + 1 : null, rb = b >= 0 ? b + 1 : null;
    if (ra || rb) { if (ra && rb) return ra === rb ? { result: "draw", detail: `both cracked it in ${ra}` } : { result: S.seats[ra < rb ? 0 : 1], detail: `in ${Math.min(ra, rb)} tries` }; return { result: S.seats[ra ? 0 : 1], detail: `cracked it in ${ra || rb}` }; }
    if (na >= TRIES && nb >= TRIES) return { result: "draw", detail: "nobody cracked it" };
    return null;
  }
  const consistent = (rows) => ALL.filter((c) => rows.every((r) => score(r.g, c) === r.fb));
  const moves = (S) => (over(S) ? [] : consistent(S.rows[S.turn]).map((g) => ({ g })));
  function apply(S0, m) { const p = S0.turn, rows = S0.rows.map((r) => r.slice()); rows[p].push({ g: m.g, fb: score(m.g, S0.secret[p]) }); const S = { ...S0, rows, ply: S0.ply + 1 }; const o = 1 - p; S.turn = S.rows[o].length < TRIES && solvedAt(S, o) < 0 ? o : p; return S; }
  const CN = ["red", "orange", "yellow", "green", "blue", "purple"], label = (g) => [...g].map((x) => CN[x]).join("-");
  function rank(S, level) {
    const rows = S.rows[S.turn], C = consistent(rows); if (!C.length) return [];
    if (!rows.length && level !== "beginner") return [{ m: { g: "0011".split("").map((x) => (+x + Math.floor(Math.random() * 3) * 2) % COLORS).join("") }, label: "open with two pairs", score: 1 }];
    if (level === "beginner") { const g = Math.random() < 0.5 ? rnd() : C[Math.floor(Math.random() * C.length)]; return [{ m: { g }, label: `try ${label(g)}`, score: 1 }]; }
    if (level === "easy" || C.length > 300) { const g = C[Math.floor(Math.random() * C.length)]; return [{ m: { g }, label: `try ${label(g)}`, score: 1 }]; }
    const pool = C.length > 80 ? C.slice().sort(() => Math.random() - 0.5).slice(0, 80) : C;
    return pool.map((g) => { const b = {}; for (const a of C) { const f = score(g, a); b[f] = (b[f] || 0) + 1; } return { m: { g }, label: `try ${label(g)}`, score: -Math.max(...Object.values(b)) + (level === "normal" ? Math.random() * 2 : 0) }; }).sort((a, b) => b.score - a.score).slice(0, 10);
  }
  const E = { TRIES, score, setup, moves, apply, over, rank, consistent };
  if (typeof module === "object" && module.exports) { module.exports = E; return; }
  const K = root.Kit, HEX = ["#e5483b", "#f08a24", "#f4cf3a", "#33b35a", "#2f7fe0", "#9b4fd6"];
  const peg = (x, cls) => { const e = K.el("span", "cpeg" + (cls ? " " + cls : "")); if (x != null) { e.style.setProperty("--c", HEX[x]); e.classList.add("set"); e.title = CN[x]; } return e; };
  root.KG.add({
    id: "codebreaker", title: "Code Breaker", icon: "🔴",
    rules: "Each of you has a hidden code of four colours (six colours to pick from; repeats allowed). Take turns guessing your own code. Each black peg means a colour in the right spot; each white peg means a right colour in the wrong spot. Ten tries each. Fewest tries wins; if the first player cracks it, the second still gets to match it.",
    achievements: [
      { id: "five", icon: "🧠", name: "Deduction", about: "Crack a code in five tries or fewer." },
      { id: "lucky", icon: "🍀", name: "Lucky Guess", about: "Crack a code in two tries or fewer." },
    ],
    mount(api) {
      let cur = [];
      return K.turnGame(api, {
        ...E, thinkMs: 800,
        mount(el, H) { const v = { bar: K.el("div"), boards: K.el("div", "cbboards"), pal: K.el("div", "cbpal"), ctl: K.el("div", "ctrl") }; el.append(v.bar, v.boards, v.pal, v.ctl); return v; },
        draw(v, S, H) {
          v.bar.replaceChildren(K.players(H, (i) => `${S.rows[i].length}/${TRIES}${solvedAt(S, i) >= 0 ? " ✓" : ""}`));
          const you = S.seats.indexOf("you"), done = !!over(S), mine = H.mine();
          v.boards.replaceChildren(...[you, 1 - you].map((q) => {
            const b = K.el("div", "cbboard" + (S.turn === q && !done ? " on" : "")); b.append(K.el("b", "", q === you ? "Your code" : `${H.nameOf(q)}'s code`));
            const sec = K.el("div", "cbrow secret"); [...S.secret[q]].forEach((x) => sec.append(done ? peg(+x) : peg(null, "hidden"))); b.append(sec);
            for (let r = 0; r < TRIES; r++) { const R = S.rows[q][r], row = K.el("div", "cbrow" + (q === you && r === S.rows[q].length && mine ? " cur" : "")); for (let i = 0; i < N; i++) { const x = R ? +R.g[i] : q === you && r === S.rows[q].length && mine ? cur[i] : null; const p = peg(x == null || isNaN(x) ? null : x); if (q === you && !R && mine && r === S.rows[q].length) p.onclick = () => { cur[i] = undefined; H.redraw(); }; row.append(p); } const kp = K.el("span", "keypegs"); if (R) { const [bk, wh] = [+R.fb[0], +R.fb[1]]; for (let k = 0; k < N; k++) kp.append(K.el("i", k < bk ? "bk" : k < bk + wh ? "wh" : "")); } row.append(kp); b.append(row); }
            return b; }));
          v.pal.replaceChildren(...HEX.map((_, x) => { const b = K.btn("cbcolor", "", () => { const i = [0, 1, 2, 3].find((k) => cur[k] == null); if (i == null) return; cur[i] = x; K.sfx.click(); H.redraw(); }); b.style.setProperty("--c", HEX[x]); b.setAttribute("aria-label", CN[x]); b.disabled = !mine; return b; }));
          const go = K.btn("btn", "Check", () => { const g = cur.join(""); cur = []; H.play({ g }); }); go.disabled = !mine || [0, 1, 2, 3].some((k) => cur[k] == null);
          const clr = K.btn("btn ghost", "Clear", () => { cur = []; H.redraw(); }); clr.disabled = !mine; v.ctl.replaceChildren(clr, go);
        },
        animate: async (v, S0, m, S1) => { K.sfx.place(); await K.wait(300); if (S1.rows[S0.turn].slice(-1)[0].fb === N + "0") K.sfx.score(); else K.sfx.tick(); },
        feats(S0, m, S1, who) { const R = S1.rows[S0.turn]; if (R.slice(-1)[0].fb !== N + "0") return; if (R.length <= 5) api.achieve("five", who); if (R.length <= 2) api.achieve("lucky", who); },
        situation: (S) => `Your tries so far: ${S.rows[S.turn].map((r) => `${label(r.g)} → ${r.fb[0]} black, ${r.fb[1]} white`).join("; ") || "none yet"}.`,
        yourTurn: () => "Pick four colours, then Check.",
      });
    },
  });
})(typeof self !== "undefined" ? self : this);
