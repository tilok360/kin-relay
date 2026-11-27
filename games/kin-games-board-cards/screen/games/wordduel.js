// Word Duel: each player cracks their own secret five-letter word. Green = right letter, right spot; gold = in the word elsewhere.
// Guesses alternate; if the first player cracks it, the second gets the same number of tries to tie.
(function (root) {
  "use strict";
  const TRIES = 6;
  const getW = () => (typeof module === "object" && module.exports ? require("./words.js") : root.KG_WORDS);
  let allowSet = null; const allowed = () => allowSet || (allowSet = new Set([...getW().allowed, ...getW().answers]));
  function score(guess, ans) { const r = Array(5).fill(0), left = {}; for (let i = 0; i < 5; i++) { if (guess[i] === ans[i]) r[i] = 2; else left[ans[i]] = (left[ans[i]] || 0) + 1; } for (let i = 0; i < 5; i++) if (!r[i] && left[guess[i]]) { r[i] = 1; left[guess[i]]--; } return r.join(""); }
  const pick = () => { const A = getW().answers; return A[Math.floor(Math.random() * A.length)]; };
  function setup(first) { const a = pick(); let b = pick(); while (b === a) b = pick(); return { seats: first === "you" ? ["you", "kin"] : ["kin", "you"], secret: [a, b], rows: [[], []], turn: 0, ply: 0 }; }
  const solvedAt = (S, p) => S.rows[p].findIndex((r) => r.fb === "22222");
  function over(S) {
    const a = solvedAt(S, 0), b = solvedAt(S, 1), na = S.rows[0].length, nb = S.rows[1].length;
    if (nb < na && !(nb >= TRIES)) return null; // second player still owed their turn
    const ra = a >= 0 ? a + 1 : null, rb = b >= 0 ? b + 1 : null;
    if (ra || rb) { if (ra && rb) return ra === rb ? { result: "draw", detail: `both cracked it in ${ra}` } : { result: S.seats[ra < rb ? 0 : 1], detail: `in ${Math.min(ra, rb)} guesses` }; return { result: S.seats[ra ? 0 : 1], detail: `cracked it in ${ra || rb}` }; }
    if (na >= TRIES && nb >= TRIES) return { result: "draw", detail: `nobody cracked it (${S.secret[0].toUpperCase()} / ${S.secret[1].toUpperCase()})` };
    return null;
  }
  const consistent = (rows) => getW().answers.filter((w) => rows.every((r) => score(r.w, w) === r.fb));
  function moves(S) { if (over(S)) return []; return consistent(S.rows[S.turn]).map((w) => ({ w })); } // the human may type any allowed word (validated in apply/UI)
  function apply(S0, m) { const p = S0.turn, rows = S0.rows.map((r) => r.slice()); rows[p].push({ w: m.w, fb: score(m.w, S0.secret[p]) }); const S = { ...S0, rows, ply: S0.ply + 1, last: { p, w: m.w } }; const o = 1 - p; S.turn = S.rows[o].length < TRIES && solvedAt(S, o) < 0 ? o : p; return S; }
  function rank(S, level) {
    const rows = S.rows[S.turn], C = consistent(rows); if (!C.length) return [];
    if (level === "beginner" || level === "easy") { const loose = getW().answers.filter((w) => rows.every((r) => [...r.w].every((ch, i) => r.fb[i] !== "2" || w[i] === ch))); const pool = level === "easy" && Math.random() < 0.6 ? C : loose; const w = pool[Math.floor(Math.random() * pool.length)]; return [{ m: { w }, label: `guess ${w.toUpperCase()}`, score: 1 }]; }
    const sample = C.length > 60 ? C.slice().sort(() => Math.random() - 0.5).slice(0, 60) : C;
    return sample.map((w) => { const buckets = {}; for (const a of C) { const f = score(w, a); buckets[f] = (buckets[f] || 0) + 1; } let e = 0; for (const k in buckets) e += buckets[k] * buckets[k]; return { m: { w }, label: `guess ${w.toUpperCase()}`, score: -e / C.length + (level === "normal" ? Math.random() * 3 : 0) }; }).sort((a, b) => b.score - a.score).slice(0, 12);
  }
  const E = { TRIES, score, setup, moves, apply, over, rank, consistent, isWord: (w) => allowed().has(w) };
  if (typeof module === "object" && module.exports) { module.exports = E; return; }
  const K = root.Kit;
  root.KG.add({
    id: "wordduel", title: "Word Duel", icon: "🟩",
    rules: "Each of you has your own secret five-letter word. Take turns guessing any real word: green means right letter in the right spot, gold means the letter is in the word somewhere else, grey means it isn't there. Six tries each. Fewest guesses wins; if the first player cracks it, the second still gets to match it.",
    achievements: [
      { id: "fast", icon: "⚡", name: "Mind Reader", about: "Crack a word in three guesses or fewer." },
      { id: "hole", icon: "🕳", name: "Hole in One", about: "Crack it on the first guess." },
      { id: "clutch", icon: "😅", name: "Sixth Sense", about: "Crack it on the last try." },
    ],
    mount(api) {
      let typed = "";
      return K.turnGame(api, {
        ...E, thinkMs: 900,
        mount(el, H) {
          const v = { bar: K.el("div"), boards: K.el("div", "wdboards"), info: K.el("div", "hint big"), keys: K.el("div", "kbd") }; el.append(v.bar, v.boards, v.info, v.keys);
          v.press = (k) => { if (!H.mine()) return; if (k === "enter") { if (typed.length !== 5) return; if (!E.isWord(typed)) { v.info.textContent = `“${typed.toUpperCase()}” isn't in the word list.`; K.sfx.buzz(); return; } const w = typed; typed = ""; v.info.textContent = ""; H.play({ w }); return; } if (k === "back") typed = typed.slice(0, -1); else if (typed.length < 5) typed += k; K.sfx.click(); H.redraw(); };
          v.onKey = (e) => { if (e.ctrlKey || e.metaKey || e.altKey || e.target.closest("input,select,textarea")) return; const k = e.key.toLowerCase(); if (/^[a-z]$/.test(k)) v.press(k); else if (k === "enter") v.press("enter"); else if (k === "backspace") v.press("back"); else return; e.preventDefault(); };
          document.addEventListener("keydown", v.onKey); v.destroy = () => document.removeEventListener("keydown", v.onKey); return v;
        },
        draw(v, S, H) {
          v.bar.replaceChildren(K.players(H, (i) => `${S.rows[i].length}/${TRIES}${solvedAt(S, i) >= 0 ? " ✓" : ""}`));
          const you = S.seats.indexOf("you"), done = !!over(S);
          v.boards.replaceChildren(...[you, 1 - you].map((q) => { const b = K.el("div", "wdboard" + (S.turn === q && !done ? " on" : "")); b.append(K.el("b", "", q === you ? "Your word" : `${H.nameOf(q)}'s word${done ? ": " + S.secret[q].toUpperCase() : ""}`)); for (let r = 0; r < TRIES; r++) { const row = K.el("div", "wdrow"), R = S.rows[q][r], cur = q === you && r === S.rows[q].length && H.mine(); for (let i = 0; i < 5; i++) { const ch = R ? (q === you || done ? R.w[i] : "") : cur ? typed[i] || "" : ""; const t = K.el("span", "tile" + (R ? " f" + R.fb[i] : ch ? " typed" : ""), ch.toUpperCase()); if (R && r === S.rows[q].length - 1) t.style.animationDelay = i * 0.08 + "s"; row.append(t); } b.append(row); } return b; }));
          const st = {}; for (const R of S.rows[you]) [...R.w].forEach((ch, i) => (st[ch] = Math.max(st[ch] || 0, +R.fb[i] + 1)));
          const mine = H.mine();
          v.keys.replaceChildren(...["qwertyuiop", "asdfghjkl", "+zxcvbnm-"].map((row) => { const r = K.el("div", "krow"); for (const l of row) { const k = l === "+" ? "enter" : l === "-" ? "back" : l; const b = K.btn("key" + (st[l] ? " k" + (st[l] - 1) : "") + (k.length > 1 ? " wide" : ""), k === "enter" ? "Enter" : k === "back" ? "⌫" : l.toUpperCase(), () => v.press(k)); b.disabled = !mine; r.append(b); } return r; }));
        },
        animate: async (v, S0, m, S1) => { const fb = S1.rows[S0.turn].slice(-1)[0].fb; K.sfx.flip(); await K.wait(450); if (fb === "22222") K.sfx.score(); },
        feats(S0, m, S1, who) { const R = S1.rows[S0.turn]; if (R.slice(-1)[0].fb !== "22222") return; if (R.length <= 3) api.achieve("fast", who); if (R.length === 1) api.achieve("hole", who); if (R.length === TRIES) api.achieve("clutch", who); },
        situation: (S) => `Your guesses so far: ${S.rows[S.turn].map((r) => `${r.w.toUpperCase()} → ${[...r.fb].map((x) => ["grey", "gold", "green"][x]).join("/")}`).join("; ") || "none yet"}.`,
        yourTurn: () => "Type a five-letter word and press Enter.",
      });
    },
  });
})(typeof self !== "undefined" ? self : this);
