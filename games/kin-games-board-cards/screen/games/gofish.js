// Go Fish for two: ask for a rank you hold; collect books of four. Most books when the cards run out wins.
(function (root) {
  "use strict";
  const RN = { 1: "aces", 11: "jacks", 12: "queens", 13: "kings" }, rn = (r) => RN[r] || r + "s";
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const deck = () => { const d = []; for (const s of "hdsc") for (let r = 1; r <= 13; r++) d.push({ r, s }); return shuffle(d); };
  function books(S, p) { const h = S.hands[p], c = {}; h.forEach((x) => (c[x.r] = (c[x.r] || 0) + 1)); for (const r in c) if (c[r] === 4) { S.hands[p] = S.hands[p].filter((x) => x.r !== Number(r)); S.books[p].push(Number(r)); } }
  function setup(first) { const d = deck(); const S = { seats: first === "you" ? ["you", "kin"] : ["kin", "you"], turn: 0, hands: [d.splice(0, 7), d.splice(0, 7)], stock: d, books: [[], []], known: [[], []], ply: 0, last: null }; books(S, 0); books(S, 1); return S; }
  function moves(S) { if (over(S)) return []; const h = S.hands[S.turn]; if (!h.length) return [{ fish: true }]; return [...new Set(h.map((c) => c.r))].sort((a, b) => a - b).map((r) => ({ ask: r })); }
  function apply(S0, m) {
    const S = { ...S0, hands: S0.hands.map((h) => h.slice()), stock: S0.stock.slice(), books: S0.books.map((b) => b.slice()), known: S0.known.map((k) => k.slice()), ply: S0.ply + 1 }, p = S.turn, o = 1 - p;
    if (m.fish) { if (S.stock.length) S.hands[p].push(S.stock.pop()); books(S, p); return { ...S, turn: o, last: { p, empty: true } }; }
    const got = S.hands[o].filter((c) => c.r === m.ask);
    S.known[p] = [...new Set([...S.known[p], m.ask])];
    if (got.length) { S.hands[o] = S.hands[o].filter((c) => c.r !== m.ask); S.hands[p].push(...got); S.known[o] = S.known[o].filter((r) => r !== m.ask); const nb = S.books[p].length; books(S, p); if (S.books[p].length > nb) S.known[p] = S.known[p].filter((r) => r !== m.ask); return { ...S, last: { p, ask: m.ask, got: got.length, book: S.books[p].length > nb } }; }
    let drew = null; if (S.stock.length) { drew = S.stock.pop(); S.hands[p].push(drew); }
    const nb = S.books[p].length; books(S, p);
    const lucky = drew && drew.r === m.ask;
    return { ...S, turn: lucky ? p : o, last: { p, ask: m.ask, got: 0, drew: !!drew, lucky, book: S.books[p].length > nb } };
  }
  function over(S) { if (S.books[0].length + S.books[1].length < 13) return null; const a = S.books[0].length, b = S.books[1].length; return { result: a > b ? S.seats[0] : b > a ? S.seats[1] : "draw", detail: `${Math.max(a, b)} books to ${Math.min(a, b)}` }; }
  // The asker only uses what it could know: its own hand and what the other player has asked for.
  function rank(S, level) {
    const me = S.turn, h = S.hands[me], foeAsked = S.known[1 - me], cnt = {}; h.forEach((c) => (cnt[c.r] = (cnt[c.r] || 0) + 1));
    const memory = level === "hard" ? 1 : level === "normal" ? 0.75 : level === "easy" ? 0.4 : 0;
    return moves(S).map((m) => m.fish ? { m, label: "draw from the pond", score: 0 } : { m, label: `ask for ${rn(m.ask)}`, score: cnt[m.ask] + (foeAsked.includes(m.ask) && Math.random() < memory ? 10 : 0) + Math.random() * 0.5 }).sort((a, b) => b.score - a.score);
  }
  const autoMove = (S) => (moves(S).length === 1 && moves(S)[0].fish ? { fish: true } : null);
  const E = { setup, moves, apply, over, rank, autoMove };
  if (typeof module === "object" && module.exports) { module.exports = E; return; }
  const K = root.Kit;
  root.KG.add({
    id: "gofish", title: "Go Fish", icon: "🐟",
    rules: "Seven cards each. On your turn ask for a rank you hold. If your opponent has any, they hand them all over and you go again. If not, \"Go fish!\": draw from the pond, and if it's the rank you asked for you go again. Four of a rank make a book and are laid down. When all thirteen books are made, most books wins.",
    achievements: [
      { id: "lucky", icon: "🍀", name: "Lucky Catch", about: "Fish the very rank you asked for." },
      { id: "three", icon: "🎣", name: "Big Haul", about: "Take three cards in one ask." },
      { id: "seven", icon: "📚", name: "Librarian", about: "Win with seven or more books." },
    ],
    mount(api) {
      return K.turnGame(api, {
        ...E, autoForYou: true, thinkMs: 700, botMs: 600,
        mount(el, H) { const v = { bar: K.el("div"), opp: K.el("div", "hand fan oppfan"), mid: K.el("div", "fishmid"), msg: K.el("div", "hint big"), hand: K.el("div", "hand fan"), ctl: K.el("div", "ctrl") }; el.append(v.bar, v.opp, v.mid, v.msg, v.hand, v.ctl); return v; },
        draw(v, S, H) {
          v.bar.replaceChildren(K.players(H, (i) => `${S.books[i].length} books`));
          const you = S.seats.indexOf("you"), mine = H.mine();
          v.opp.replaceChildren(...S.hands[1 - you].map(() => K.card(null, { back: true, hue: 190 })));
          const pond = K.el("div", "pond"); pond.append(K.el("span", "", `🐟 ${S.stock.length}`));
          const bk = (i) => { const d = K.el("div", "books"); d.append(K.el("small", "", H.nameOf(i))); S.books[i].forEach((r) => { const c = K.card({ r, s: "hdsc"[r % 4] }); c.classList.add("book"); d.append(c); }); return d; };
          v.mid.replaceChildren(bk(1 - you), pond, bk(you));
          const lm = S.last; v.msg.textContent = lm ? (lm.empty ? `${H.nameOf(lm.p)} had no cards and drew.` : `${H.nameOf(lm.p)} asked for ${rn(lm.ask)}: ${lm.got ? `got ${lm.got}!` : lm.lucky ? "Go fish… and fished one!" : "Go fish!"}${lm.book ? " Book!" : ""}`) : "";
          const ranks = new Set(S.hands[you].map((c) => c.r));
          K.flip(v.hand, () => v.hand.replaceChildren(...S.hands[you].slice().sort((a, b) => a.r - b.r).map((c) => K.card(c, { k: "h" + c.r + c.s, cls: mine ? "ok" : "", onClick: () => mine && H.play({ ask: c.r }) }))), { lift: true });
          v.ctl.replaceChildren(...(mine ? [...ranks].sort((a, b) => a - b).map((r) => K.btn("btn alt small", `Ask for ${rn(r)}`, () => H.play({ ask: r }))) : []));
        },
        animate: async (v, S0, m, S1) => { const l = S1.last; if (l.got) { K.sfx.deal(); await K.wait(80); K.sfx.deal(); } else K.sfx.swish(); if (l.book) { await K.wait(150); K.sfx.score(); } },
        feats(S0, m, S1, who) { const l = S1.last; if (l.lucky) api.achieve("lucky", who); if (l.got >= 3) api.achieve("three", who); const o = over(S1); if (o && o.result !== "draw") { const i = S1.seats.indexOf(o.result); if (S1.books[i].length >= 7) api.achieve("seven", o.result); } },
        situation: (S) => `Your hand: ${S.hands[S.turn].map((c) => c.r).join(", ")}. Books: you ${S.books[S.turn].length}, them ${S.books[1 - S.turn].length}. They have asked for: ${S.known[1 - S.turn].map(rn).join(", ") || "nothing yet"}.`,
        yourTurn: () => "Your turn: tap a card (or a button) to ask for that rank.",
      });
    },
  });
})(typeof self !== "undefined" ? self : this);
