// Crazy Eights for two: match the top card's suit or rank; eights are wild. First to empty their hand wins.
(function (root) {
  "use strict";
  const SN = { h: "hearts", d: "diamonds", s: "spades", c: "clubs" }, RN = { 1: "ace", 11: "jack", 12: "queen", 13: "king" };
  const name = (c) => `${RN[c.r] || c.r} of ${SN[c.s]}`;
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const deck = () => { const d = []; for (const s of "hdsc") for (let r = 1; r <= 13; r++) d.push({ r, s }); return shuffle(d); };
  function setup(first) { const d = deck(), hands = [d.splice(0, 7), d.splice(0, 7)]; let i = d.findIndex((c) => c.r !== 8); const top = d.splice(i, 1)[0]; return { seats: first === "you" ? ["you", "kin"] : ["kin", "you"], turn: 0, hands, stock: d, pile: [top], suit: top.s, ply: 0, last: null, passes: 0 }; }
  const top = (S) => S.pile[S.pile.length - 1];
  const fits = (S, c) => c.r === 8 || c.s === S.suit || c.r === top(S).r;
  function moves(S) { if (over(S)) return []; const out = []; S.hands[S.turn].forEach((c, k) => { if (!fits(S, c)) return; if (c.r === 8) for (const s of "hdsc") out.push({ k, suit: s }); else out.push({ k }); }); if (!out.length) out.push(S.stock.length || S.pile.length > 1 ? { take: true } : { pass: true }); return out; }
  function apply(S0, m) {
    const S = { ...S0, hands: S0.hands.map((h) => h.slice()), stock: S0.stock.slice(), pile: S0.pile.slice(), ply: S0.ply + 1 }, p = S.turn;
    if (m.take) { if (!S.stock.length) { const t = S.pile.pop(); S.stock = shuffle(S.pile); S.pile = [t]; } S.hands[p].push(S.stock.pop()); return { ...S, last: { p, take: true }, passes: 0 }; }
    if (m.pass) return { ...S, turn: 1 - p, passes: S.passes + 1, last: { p, pass: true } };
    const c = S.hands[p].splice(m.k, 1)[0]; S.pile.push(c);
    return { ...S, suit: c.r === 8 ? m.suit : c.s, turn: 1 - p, passes: 0, last: { p, card: c, suit: c.r === 8 ? m.suit : null } };
  }
  const pts = (h) => h.reduce((t, c) => t + (c.r === 8 ? 50 : c.r >= 10 ? 10 : c.r), 0);
  function over(S) {
    const w = S.hands.findIndex((h) => !h.length); if (w >= 0) return { result: S.seats[w], detail: `went out first; ${S.hands[1 - w].length} cards left in the other hand` };
    if (S.passes >= 2) { const a = pts(S.hands[0]), b = pts(S.hands[1]); return { result: a < b ? S.seats[0] : b < a ? S.seats[1] : "draw", detail: "blocked: the lighter hand wins" }; }
    return null;
  }
  function rank(S, level) {
    const h = S.hands[S.turn], foeN = S.hands[1 - S.turn].length, by = {}; h.forEach((c) => (by[c.s] = (by[c.s] || 0) + 1));
    return moves(S).map((m) => {
      if (m.take || m.pass) return { m, label: m.take ? "draw a card" : "pass", score: -10 };
      const c = h[m.k]; let sc = 5 + (c.r >= 10 ? 1 : 0);
      if (c.r === 8) sc += (by[m.suit] || 0) * 2 - (h.length > 2 && foeN > 2 ? 8 : 0); else sc += (by[c.s] || 0) * 0.7;
      if (level === "hard" && c.r !== 8 && foeN <= 2) sc += c.s !== S.suit ? 2 : 0;
      return { m, label: `play the ${name(c)}${c.r === 8 ? `, calling ${SN[m.suit]}` : ""}`, score: sc + Math.random() * 0.5 };
    }).sort((a, b) => b.score - a.score);
  }
  const autoMove = (S) => { const ms = moves(S); return ms.length === 1 && (ms[0].take || ms[0].pass) ? ms[0] : null; };
  const E = { setup, moves, apply, over, rank, autoMove, fits, name };
  if (typeof module === "object" && module.exports) { module.exports = E; return; }
  const K = root.Kit;
  root.KG.add({
    id: "crazy8", title: "Crazy Eights", icon: "8️⃣",
    rules: "Seven cards each. Play a card that matches the top card's suit or rank. Eights are wild: play one any time and name the next suit. If you can't play, draw until you can. First to empty their hand wins. If the deck runs dry and nobody can play, the lighter hand wins (eights count 50, pictures 10).",
    achievements: [
      { id: "eight", icon: "8️⃣", name: "Crazy Finish", about: "Go out on an eight." },
      { id: "flawless", icon: "✋", name: "Hands Off", about: "Win without drawing." },
      { id: "run", icon: "🔥", name: "Shutout", about: "Win while your opponent still holds seven or more." },
    ],
    mount(api) {
      const drew = { you: false, kin: false };
      return K.turnGame(api, {
        ...E, autoForYou: true, autoDelay: 380, thinkMs: 520,
        mount(el, H) { const v = { bar: K.el("div"), opp: K.el("div", "hand fan oppfan"), mid: K.el("div", "olmid"), hand: K.el("div", "hand fan"), ctl: K.el("div", "ctrl") }; el.append(v.bar, v.opp, v.mid, v.hand, v.ctl); return v; },
        draw(v, S, H) {
          v.bar.replaceChildren(K.players(H, (i) => `${S.hands[i].length} cards`));
          const you = S.seats.indexOf("you"), mine = H.mine(), L = mine ? H.legal() : [];
          v.opp.replaceChildren(...S.hands[1 - you].map(() => K.card(null, { back: true, hue: 210 })));
          const t = top(S), dk = K.card(null, { back: true, hue: 210 }); dk.classList.add("deck"); const pe = K.card(t, { k: "p" + t.r + t.s }); pe.classList.add("top");
          const st = K.el("div", "suitcall"); st.innerHTML = K.suitSVG(S.suit, 30); st.title = "suit to match: " + { h: "hearts", d: "diamonds", s: "spades", c: "clubs" }[S.suit];
          v.mid.replaceChildren(dk, pe, st);
          K.flip(v.hand, () => v.hand.replaceChildren(...S.hands[you].map((c, k) => { const ok = L.some((m) => m.k === k); return K.card(c, { k: "h" + c.r + c.s, cls: (ok ? "ok" : mine ? "dim" : "") + (v.pick === k ? " sel" : ""), onClick: () => { if (!ok) { K.shake(v.hand.children[k]); return; } if (c.r === 8) { v.pick = k; H.redraw(); } else H.play({ k }); } }); })), { lift: true });
          v.ctl.replaceChildren();
          if (mine && v.pick != null && S.hands[you][v.pick] && S.hands[you][v.pick].r === 8) { v.ctl.append(K.el("span", "", "Call a suit:")); for (const s of "hdsc") { const b = K.btn("btn alt small", "", () => { const k = v.pick; v.pick = null; H.play({ k, suit: s }); }); b.innerHTML = K.suitSVG(s, 22); v.ctl.append(b); } } else v.pick = null;
          if (mine && L.some((m) => m.take)) v.ctl.append(K.btn("btn alt", "Draw", () => H.play({ take: true })));
        },
        animate: async (v, S0, m) => { if (m.take) K.sfx.deal(); else if (m.k != null) K.sfx.flip(); },
        feats(S0, m, S1, who) { if (m.take) drew[who] = true; const o = over(S1); if (o && o.result === who) { if (S1.last.card && S1.last.card.r === 8) api.achieve("eight", who); if (!drew[who]) api.achieve("flawless", who); if (S1.hands[1 - S0.turn].length >= 7) api.achieve("run", who); } },
        situation: (S) => `Top card: ${name(top(S))}${top(S).r === 8 ? ` (suit called: ${S.suit})` : ""}. Your hand: ${S.hands[S.turn].map(name).join(", ")}. They hold ${S.hands[1 - S.turn].length}.`,
        yourTurn: () => "Your turn: play a glowing card (or draw).",
      });
    },
  });
})(typeof self !== "undefined" ? self : this);
