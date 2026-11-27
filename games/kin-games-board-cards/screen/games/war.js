// War: split the deck, flip together, high card takes both. Ties mean war: three face down, one up.
// One pass through the deck; whoever won more cards wins.
(function (root) {
  "use strict";
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const deck = () => { const d = []; for (const s of "hdsc") for (let r = 2; r <= 14; r++) d.push({ r, s }); return shuffle(d); };
  // Everyone flips on your tap, so your opponent never takes a turn of its own.
  function setup(first) { const d = deck(); const seats = first === "you" ? ["you", "kin"] : ["kin", "you"]; return { seats, turn: seats.indexOf("you"), piles: [d.slice(0, 26), d.slice(26)], won: [0, 0], ply: 0, last: null, wars: 0 }; }
  const you = (S) => S.seats.indexOf("you");
  function moves(S) { return over(S) ? [] : [{ flip: true }]; }
  function apply(S0, m) {
    const piles = S0.piles.map((p) => p.slice()), won = S0.won.slice(), shown = [[], []], down = [[], []]; let wars = 0, pot = 0, winner = -1;
    for (;;) {
      if (!piles[0].length || !piles[1].length) break;
      const a = piles[0].pop(), b = piles[1].pop(); shown[0].push(a); shown[1].push(b); pot += 2;
      if (a.r !== b.r) { winner = a.r > b.r ? 0 : 1; break; }
      wars++; for (let k = 0; k < 3; k++) for (const i of [0, 1]) if (piles[i].length > 1) { down[i].push(piles[i].pop()); pot++; }
    }
    if (winner < 0) { won[0] += pot / 2; won[1] += pot / 2; } else won[winner] += pot;
    return { ...S0, piles, won, ply: S0.ply + 1, last: { shown, down, winner, wars, pot }, wars: Math.max(S0.wars, wars) };
  }
  function over(S) { if (S.piles[0].length && S.piles[1].length) return null; const [a, b] = S.won; return { result: a > b ? S.seats[0] : b > a ? S.seats[1] : "draw", detail: `${Math.max(a, b)} cards to ${Math.min(a, b)}` }; }
  const rank = () => [{ m: { flip: true }, label: "flip", score: 0 }];
  const E = { setup, moves, apply, over, rank, you };
  if (typeof module === "object" && module.exports) { module.exports = E; return; }
  const K = root.Kit;
  root.KG.add({
    id: "war", title: "War", icon: "⚔",
    rules: "The deck is split in two. Tap Flip: you both turn over your top card and the higher one (aces high) wins both. A tie means war: each puts three cards face down and flips another; the winner takes the lot. One pass through the deck; whoever won more cards wins. Pure luck, so cheer.",
    achievements: [
      { id: "war", icon: "⚔", name: "To War!", about: "Win a war." },
      { id: "double", icon: "💣", name: "World War", about: "Win a double war (two ties in a row)." },
      { id: "big", icon: "👑", name: "Landslide", about: "Win with 34 cards or more." },
    ],
    mount(api) {
      return K.turnGame(api, {
        ...E,
        mount(el, H) {
          const v = { bar: K.el("div"), field: K.el("div", "warfield"), msg: K.el("div", "hint big"), ctl: K.el("div", "ctrl") }; el.append(v.bar, v.field, v.msg, v.ctl);
          v.btn = K.btn("btn", "Flip", () => H.mine() && H.play({ flip: true })); v.ctl.append(v.btn);
          el.addEventListener("keydown", (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); v.btn.click(); } });
          return v;
        },
        draw(v, S, H) {
          const y = you(S), k = 1 - y;
          v.bar.replaceChildren(K.players(H, (i) => `${S.won[i]} won · ${S.piles[i].length} left`));
          const side = (i) => { const d = K.el("div", "warside"); const stack = K.el("div", "warstack"); const n = Math.min(6, Math.ceil(S.piles[i].length / 5)); for (let j = 0; j < n; j++) { const c = K.card(null, { back: true, hue: i === y ? 350 : 220 }); c.style.transform = `translate(${j * 1.5}px,${-j * 1.5}px)`; stack.append(c); } d.append(stack); const row = K.el("div", "warrow"); const L = S.last; if (L) { L.shown[i].forEach((c, j) => { if (j) for (const _ of L.down[i].slice((j - 1) * 3, j * 3)) row.append(K.card(null, { back: true, hue: 30, cls: "tiny" })); row.append(K.card(c, { cls: j === L.shown[i].length - 1 && L.winner === i ? "win" : "" })); }); } d.append(row); return d; };
          v.field.replaceChildren(side(k), side(y));
          const L = S.last; v.msg.textContent = L ? (L.wars ? `${L.wars > 1 ? "Double war! " : "War! "}` : "") + (L.winner < 0 ? "Out of cards mid-war: split." : `${H.nameOf(L.winner)} ${L.winner === y ? "take" : "takes"} ${L.pot}.`) : "Tap Flip (or Space).";
          v.btn.disabled = !H.mine();
        },
        animate: async (v, S0, m, S1) => { K.sfx.flip(); if (S1.last.wars) { await K.wait(200); K.sfx.thock(); await K.wait(200); K.sfx.flip(); } },
        feats(S0, m, S1) { const L = S1.last, w = L.winner >= 0 ? S1.seats[L.winner] : null; if (w && L.wars >= 1) api.achieve("war", w); if (w && L.wars >= 2) api.achieve("double", w); const o = over(S1); if (o && o.result !== "draw" && S1.won[S1.seats.indexOf(o.result)] >= 34) api.achieve("big", o.result); if (L.wars && !api.solo) api.line(`War! ${w === "you" ? "Your person" : "You"} won it, taking ${L.pot} cards.`); },
        yourTurn: () => "Tap Flip (or Space).",
      });
    },
  });
})(typeof self !== "undefined" ? self : this);
