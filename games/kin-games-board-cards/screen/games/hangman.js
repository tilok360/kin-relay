// Hangman Duel: one hidden word, two guessers. A right letter scores a point per copy and you go again; a miss passes the turn and adds to the gallows.
(function (root) {
  "use strict";
  const ROUNDS = 3, LIVES = 8, BONUS = 3, AZ = "abcdefghijklmnopqrstuvwxyz";
  const getW = () => (typeof module === "object" && module.exports ? require("./words.js") : root.KG_WORDS);
  const pickWord = () => { const L = getW().hang.filter((w) => w.length >= 5 && w.length <= 10); return L[Math.floor(Math.random() * L.length)]; };
  const fresh = (S, word) => ({ ...S, word: word || pickWord(), guessed: [], misses: 0, roundOver: false, last: null });
  const setup = (first) => fresh({ seats: first === "you" ? ["you", "kin"] : ["kin", "you"], score: [0, 0], round: 1, turn: 0, ply: 0 });
  const solved = (S) => [...S.word].every((ch) => S.guessed.includes(ch));
  const shown = (S) => [...S.word].map((ch) => (S.guessed.includes(ch) || S.roundOver ? ch : "_")).join("");
  function moves(S) { if (over(S)) return []; if (S.roundOver) return [{ next: true }]; return [...AZ].filter((l) => !S.guessed.includes(l)).map((l) => ({ l })); }
  function apply(S0, m) {
    if (m.next) return { ...fresh(S0), round: S0.round + 1, turn: S0.round % 2, ply: S0.ply + 1 };
    const S = { ...S0, guessed: [...S0.guessed, m.l], score: S0.score.slice(), ply: S0.ply + 1 }, p = S.turn, n = [...S.word].filter((c) => c === m.l).length;
    if (n) { S.score[p] += n; S.run = (S0.last && S0.last.p === p && S0.last.n ? S0.run || 0 : 0) + 1; S.last = { p, l: m.l, n }; if (solved(S)) { S.score[p] += BONUS; S.roundOver = true; S.last.solved = true; } return S; }
    S.misses++; S.last = { p, l: m.l, n: 0 }; if (S.misses >= LIVES) { S.roundOver = true; S.last.hung = true; return S; }
    return { ...S, turn: 1 - p };
  }
  function over(S) { if (!S.roundOver || S.round < ROUNDS) return null; const [a, b] = S.score; return { result: a === b ? "draw" : S.seats[a > b ? 0 : 1], detail: `${Math.max(a, b)} points to ${Math.min(a, b)} over ${ROUNDS} words` }; }
  function rank(S, level) {
    const ms = moves(S); if (S.roundOver) return ms.map((m) => ({ m, label: "next word", score: 0 }));
    const pat = shown(S), wrong = S.guessed.filter((l) => !S.word.includes(l));
    const cands = getW().hang.filter((w) => w.length === pat.length && [...w].every((ch, i) => (pat[i] === "_" ? !S.guessed.includes(ch) : ch === pat[i])) && !wrong.some((l) => w.includes(l)));
    const freq = {}; for (const w of cands) for (const ch of new Set(w)) freq[ch] = (freq[ch] || 0) + 1;
    const base = "etaoinshrdlcumwfgypbvkjxqz";
    return ms.map((m) => { let sc = cands.length ? (freq[m.l] || 0) / cands.length : 0; if (level === "beginner") sc = (26 - base.indexOf(m.l)) / 26 * 0.6 + Math.random() * 0.4; else if (level === "easy") sc = sc * 0.6 + Math.random() * 0.4; else sc += (26 - base.indexOf(m.l)) * 0.0005; return { m, label: `guess the letter ${m.l.toUpperCase()}`, score: sc }; }).sort((a, b) => b.score - a.score);
  }
  const autoMove = (S) => (over(S) ? null : S.roundOver ? { next: true } : null);
  const E = { ROUNDS, LIVES, setup, moves, apply, over, rank, autoMove, shown };
  if (typeof module === "object" && module.exports) { module.exports = E; return; }
  const K = root.Kit;
  function gallows(n) {
    const parts = [`<circle cx="70" cy="42" r="10"/>`, `<path d="M70 52v28"/>`, `<path d="M70 60l-14 10"/>`, `<path d="M70 60l14 10"/>`, `<path d="M70 80l-12 18"/>`, `<path d="M70 80l12 18"/>`, `<path d="M64 40h1M75 40h1" stroke-width="3"/>`, `<path d="M64 47q6 -3 12 0"/>`];
    return `<svg viewBox="0 0 120 120" class="gallows"><path d="M10 112h60M24 112V10h46v22" stroke="#8a5a2b" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M24 30l18-20" stroke="#8a5a2b" stroke-width="4"/><g stroke="#f4ead8" stroke-width="3.4" fill="none" stroke-linecap="round">${parts.slice(0, n).map((p, i) => (i === n - 1 ? p.replace(/^<(\w+)/, '<$1 class="gp"') : p)).join("")}</g></svg>`;
  }
  root.KG.add({
    id: "hangman", title: "Hangman Duel", icon: "🪢",
    rules: "One hidden word, two guessers. Take turns calling letters. A right letter scores 1 point for every time it appears and you guess again; a miss passes the turn and adds a piece to the gallows. Finish the word for a 3-point bonus. Eight misses and the word is lost. Three words; most points wins.",
    achievements: [
      { id: "solve", icon: "🔤", name: "Wordsmith", about: "Finish a word." },
      { id: "streak", icon: "🔥", name: "Hot Streak", about: "Guess four right letters in a row." },
      { id: "clean", icon: "✨", name: "Clean Gallows", about: "Win a word with no misses at all." },
    ],
    mount(api) {
      return K.turnGame(api, {
        ...E, autoForYou: true, autoDelay: 1800, thinkMs: 650,
        mount(el, H) { const v = { bar: K.el("div"), wrap: K.el("div", "hangwrap"), word: K.el("div", "hangword"), info: K.el("div", "hint big"), keys: K.el("div", "kbd") }; v.pic = K.el("div", "hangpic"); v.wrap.append(v.pic, v.word); el.append(v.bar, v.wrap, v.info, v.keys);
          v.onKey = (e) => { if (e.ctrlKey || e.metaKey || e.altKey || e.target.closest("input,select,textarea")) return; const k = e.key.toLowerCase(); if (/^[a-z]$/.test(k) && H.mine() && H.legal().some((m) => m.l === k)) { e.preventDefault(); H.play({ l: k }); } };
          document.addEventListener("keydown", v.onKey); v.destroy = () => document.removeEventListener("keydown", v.onKey); return v; },
        draw(v, S, H) {
          v.bar.replaceChildren(K.players(H, (i) => `${S.score[i]} pts`), K.el("div", "hint", `Word ${S.round} of ${ROUNDS} · ${LIVES - S.misses} misses left`));
          v.pic.innerHTML = gallows(S.misses);
          v.word.replaceChildren(...[...shown(S)].map((ch, i) => K.el("span", "tile" + (ch === "_" ? "" : " on") + (S.roundOver && !S.guessed.includes(S.word[i]) ? " miss" : ""), ch === "_" ? "" : ch.toUpperCase())));
          const L = S.last; v.info.textContent = !L ? "" : L.solved ? `${H.nameOf(L.p)} finished “${S.word.toUpperCase()}” (+${BONUS})` : L.hung ? `The gallows is full — the word was “${S.word.toUpperCase()}”.` : L.n ? `${H.nameOf(L.p)}: ${L.l.toUpperCase()} ×${L.n}` : `${H.nameOf(L.p)}: no ${L.l.toUpperCase()}`;
          const mine = H.mine();
          v.keys.replaceChildren(...["qwertyuiop", "asdfghjkl", "zxcvbnm"].map((row) => { const r = K.el("div", "krow"); for (const l of row) { const g = S.guessed.includes(l), b = K.btn("key" + (g ? (S.word.includes(l) ? " hit" : " miss") : ""), l.toUpperCase(), () => H.play({ l })); b.disabled = g || !mine || S.roundOver; r.append(b); } return r; }));
        },
        animate: async (v, S0, m, S1) => { if (m.l) { if (S1.last.n) K.sfx.ding(); else K.sfx.buzz(); } else K.sfx.open(); },
        feats(S0, m, S1, who) {
          if (!m.l) return; if (S1.last.solved) { api.achieve("solve", who); if (!S1.misses) api.achieve("clean", who); }
          if (S1.last.n && S1.run >= 4) api.achieve("streak", who);
        },
        situation: (S) => `The word so far: ${shown(S).toUpperCase().split("").join(" ")} (${S.word.length} letters). Already called: ${S.guessed.map((l) => l.toUpperCase()).join(" ") || "none"}. ${LIVES - S.misses} misses left.`,
        yourTurn: () => "Call a letter (type it or tap a key).",
      });
    },
  });
})(typeof self !== "undefined" ? self : this);
