// Blackjack duel: you and your opponent each play your own hand against the same dealer. 100 chips each, 10 rounds, most chips wins.
(function (root) {
  "use strict";
  const ROUNDS = 10, BETS = [5, 10, 20, 50];
  const RN = { 1: "A", 11: "J", 12: "Q", 13: "K" }, SN = { h: "♥", d: "♦", s: "♠", c: "♣" };
  const nm = (c) => (RN[c.r] || c.r) + SN[c.s];
  const shoe = () => { const d = []; for (let k = 0; k < 4; k++) for (const s of "hdsc") for (let r = 1; r <= 13; r++) d.push({ r, s }); for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; } return d; };
  function total(h) { let t = 0, a = 0; for (const c of h) { t += Math.min(10, c.r); if (c.r === 1) a++; } const soft = a && t + 10 <= 21; return { t: soft ? t + 10 : t, soft }; }
  const isBJ = (h) => h.length === 2 && total(h).t === 21;
  const setup = (first) => ({ seats: first === "you" ? ["you", "kin"] : ["kin", "you"], chips: [100, 100], round: 1, shoe: shoe(), phase: "bet", turn: 0, bets: [0, 0], hands: [[], []], dealer: [], done: [false, false], res: null, ply: 0 });
  const draw = (S) => { if (S.shoe.length < 15) S.shoe = shoe(); return S.shoe.pop(); };
  function moves(S) {
    if (over(S)) return [];
    const p = S.turn;
    if (S.phase === "bet") return BETS.filter((b) => b <= S.chips[p]).map((b) => ({ bet: b })).concat(S.chips[p] < 5 ? [{ bet: S.chips[p] }] : []);
    if (S.phase === "play") { const h = S.hands[p], o = [{ hit: 1 }, { stand: 1 }]; if (h.length === 2 && S.chips[p] >= S.bets[p]) o.push({ double: 1 }); return o; }
    if (S.phase === "dealer") return [{ dealer: 1 }];
    return [{ next: 1 }];
  }
  function apply(S0, m) {
    const S = { ...S0, shoe: S0.shoe.slice(), hands: S0.hands.map((h) => h.slice()), dealer: S0.dealer.slice(), chips: S0.chips.slice(), bets: S0.bets.slice(), done: S0.done.slice(), ply: S0.ply + 1 }, p = S.turn;
    if (m.next) return { ...S, round: S.round + 1, phase: "bet", turn: (S.round) % 2, bets: [0, 0], hands: [[], []], dealer: [], done: [false, false], dbl: [false, false], res: null, last: null };
    if (m.bet != null) {
      S.bets[p] = m.bet; S.chips[p] -= m.bet; S.last = { p, bet: m.bet };
      if (S.bets.every((b) => b > 0) || S.bets.some((b, i) => !b && !S0.chips[i] && i !== p)) {
        for (let k = 0; k < 2; k++) for (const q of [0, 1, 2]) (q < 2 ? S.hands[q] : S.dealer).push(draw(S));
        S.done = S.hands.map((h) => isBJ(h)); S.phase = "play"; S.turn = S.round % 2 ? 0 : 1; if (S.done[S.turn]) S.turn = 1 - S.turn; if (S.done.every(Boolean) || isBJ(S.dealer)) S.phase = "dealer"; return S;
      }
      return { ...S, turn: 1 - p };
    }
    if (m.hit || m.double) {
      if (m.double) { S.chips[p] -= S.bets[p]; S.bets[p] *= 2; S.dbl = (S0.dbl || [false, false]).slice(); S.dbl[p] = true; }
      const c = draw(S); S.hands[p].push(c); const t = total(S.hands[p]).t; S.last = { p, card: c, double: !!m.double };
      if (t >= 21 || m.double) S.done[p] = true;
    }
    if (m.stand) { S.done[p] = true; S.last = { p, stand: true }; }
    if (m.dealer) { while (total(S.dealer).t < 17) S.dealer.push(draw(S)); const d = total(S.dealer).t, dbj = isBJ(S.dealer); S.res = [0, 1].map((q) => { const h = S.hands[q], t = total(h).t, b = S.bets[q]; let pay, why; if (t > 21) { pay = 0; why = "bust"; } else if (isBJ(h) && !dbj) { pay = b + Math.floor(b * 1.5); why = "blackjack!"; } else if (dbj && !isBJ(h)) { pay = 0; why = "dealer blackjack"; } else if (d > 21 || t > d) { pay = b * 2; why = d > 21 ? "dealer busts" : "wins"; } else if (t === d) { pay = b; why = "push"; } else { pay = 0; why = "loses"; } S.chips[q] += pay; return { pay, net: pay - b, why }; }); S.phase = "settle"; return S; }
    if (S.phase === "play") { if (S.done[p]) { if (!S.done[1 - p]) S.turn = 1 - p; else S.phase = "dealer"; } }
    return S;
  }
  function over(S) { if (S.phase !== "settle") return null; if (S.round < ROUNDS && S.chips.every((c) => c > 0)) return null; const [a, b] = S.chips; const w = a === b ? "draw" : S.seats[a > b ? 0 : 1]; return { result: w, detail: `${Math.max(a, b)} chips to ${Math.min(a, b)}` }; }
  // Basic strategy without splits (dealer stands on soft 17).
  function basic(h, up) { const { t, soft } = total(h), u = up.r === 1 ? 11 : Math.min(10, up.r), two = h.length === 2;
    if (soft) { if (t >= 19) return "stand"; if (t === 18) return u >= 3 && u <= 6 && two ? "double" : u >= 9 ? "hit" : "stand"; if (two && ((t >= 15 && u >= 4 && u <= 6) || (t >= 17 && u === 3))) return "double"; return "hit"; }
    if (t >= 17) return "stand"; if (t >= 13) return u <= 6 ? "stand" : "hit"; if (t === 12) return u >= 4 && u <= 6 ? "stand" : "hit"; if (t === 11) return two ? "double" : "hit"; if (t === 10) return two && u <= 9 ? "double" : "hit"; if (t === 9) return two && u >= 3 && u <= 6 ? "double" : "hit"; return "hit"; }
  function rank(S, level) {
    const ms = moves(S), p = S.turn;
    if (S.phase === "bet") { const behind = S.chips[p] + 0 < S.chips[1 - p] + S.bets[1 - p], late = S.round >= ROUNDS - 2; const want = level === "beginner" ? BETS[Math.floor(Math.random() * 3)] : late && behind ? 50 : behind ? 20 : 10; return ms.map((m) => ({ m, label: `bet ${m.bet}`, score: -Math.abs(m.bet - want) })).sort((a, b) => b.score - a.score); }
    if (S.phase === "play") { let k = basic(S.hands[p], S.dealer[0]); if (level === "beginner" && total(S.hands[p]).t < 17 && Math.random() < 0.3) k = "stand"; if (k === "double" && !ms.some((m) => m.double)) k = "hit"; return ms.map((m) => ({ m, label: Object.keys(m)[0], score: m[k] ? 1 : 0 })).sort((a, b) => b.score - a.score); }
    return ms.map((m) => ({ m, label: Object.keys(m)[0], score: 0 }));
  }
  const autoMove = (S) => (over(S) ? null : S.phase === "dealer" ? { dealer: 1 } : S.phase === "settle" ? { next: 1 } : null);
  const E = { ROUNDS, total, isBJ, basic, setup, moves, apply, over, rank, autoMove, nm };
  if (typeof module === "object" && module.exports) { module.exports = E; return; }
  const K = root.Kit;
  const chipSVG = (n) => { const col = { 5: "#d33", 10: "#2a6be0", 20: "#1d9a55", 50: "#222" }[n] || "#a57a1c"; return `<svg viewBox="0 0 40 40" class="chipsvg"><circle cx="20" cy="20" r="18" fill="${col}" stroke="#fff" stroke-width="2" stroke-dasharray="6 4"/><circle cx="20" cy="20" r="12" fill="${col}" stroke="#fff8" stroke-width="1"/><text x="20" y="25" font-size="13" font-weight="800" fill="#fff" text-anchor="middle">${n}</text></svg>`; };
  root.KG.add({
    id: "blackjack", title: "Blackjack Duel", icon: "🃏",
    rules: "You and your opponent each start with 100 chips and play your own hands against the same dealer for 10 rounds. Bet 5, 10, 20 or 50, then hit, stand or double down (one more card, twice the bet). Aces count 1 or 11, pictures 10. Go over 21 and you bust. The dealer draws to 17. Beat the dealer to win your bet; a two-card 21 pays 3 to 2. Whoever holds more chips after round 10 wins (or when one of you runs out).",
    achievements: [
      { id: "natural", icon: "🂡", name: "Natural", about: "Get a blackjack." },
      { id: "double", icon: "✌️", name: "Double Trouble", about: "Win a doubled hand." },
      { id: "high", icon: "💰", name: "High Roller", about: "Finish with 200 chips or more." },
    ],
    mount(api) {
      return K.turnGame(api, {
        ...E, autoForYou: true, autoDelay: 1600, thinkMs: 500, botMs: 500,
        mount(el, H) { const v = { bar: K.el("div"), dealer: K.el("div", "bjrow dealer"), seats: K.el("div", "bjseats"), info: K.el("div", "hint big"), ctl: K.el("div", "ctrl") }; el.append(v.bar, v.dealer, v.seats, v.info, v.ctl); return v; },
        draw(v, S, H) {
          v.bar.replaceChildren(K.players(H, (i) => `${S.chips[i]} chips`), K.el("div", "hint", `Round ${Math.min(S.round, ROUNDS)} of ${ROUNDS}`));
          const hide = S.phase === "play" || S.phase === "bet";
          const dh = K.el("div", "hand fan"); S.dealer.forEach((c, i) => dh.append(i === 1 && hide ? K.card(null, { back: true, hue: 0 }) : K.card(c)));
          v.dealer.replaceChildren(K.el("b", "", "Dealer" + (S.dealer.length && !hide ? ` · ${total(S.dealer).t}` : "")), dh);
          const you = S.seats.indexOf("you"), order = [1 - you, you];
          v.seats.replaceChildren(...order.map((q) => { const box = K.el("div", "bjrow seat" + (S.turn === q && S.phase !== "settle" ? " on" : "")), h = K.el("div", "hand fan"); S.hands[q].forEach((c) => h.append(K.card(c))); const t = S.hands[q].length ? total(S.hands[q]).t : null; const r = S.res && S.res[q]; box.append(K.el("b", "", `${H.nameOf(q)}${t != null ? ` · ${t}` : ""}${r ? ` — ${r.why} (${r.net >= 0 ? "+" : ""}${r.net})` : ""}`), h); const bet = K.el("div", "bjbet"); if (S.bets[q]) bet.innerHTML = chipSVG(S.bets[q] > 50 ? 50 : S.bets[q]) + `<span>${S.bets[q]}</span>`; box.append(bet); return box; }));
          const mine = H.mine(), ms = mine ? H.legal() : [];
          v.info.textContent = mine && S.phase === "bet" ? "Place your bet." : mine && S.phase === "play" ? `You have ${total(S.hands[you]).t}${total(S.hands[you]).soft ? " (soft)" : ""}. Dealer shows ${nm(S.dealer[0])}.` : "";
          v.ctl.replaceChildren(...ms.map((m) => { if (m.bet != null) { const b = K.btn("chipbtn", "", () => H.play(m)); b.innerHTML = chipSVG(m.bet); b.title = `Bet ${m.bet}`; return b; } const k = Object.keys(m)[0]; return K.btn("btn", { hit: "Hit", stand: "Stand", double: "Double" }[k], () => H.play(m)); }));
        },
        animate: async (v, S0, m, S1) => { if (m.bet != null) K.sfx.chip(); else if (m.hit || m.double) K.sfx.flip(); else if (m.dealer) { K.sfx.flip(); if (S1.res.some((r) => r.net > 0)) { await K.wait(150); K.sfx.score(); } } else if (m.next) K.sfx.shuffle(); },
        feats(S0, m, S1) { if (m.dealer) S1.res.forEach((r, q) => { if (r.why === "blackjack!") api.achieve("natural", S1.seats[q]); if (r.net > 0 && S1.dbl && S1.dbl[q]) api.achieve("double", S1.seats[q]); }); const o = over(S1); if (o) S1.chips.forEach((c, q) => c >= 200 && api.achieve("high", S1.seats[q])); },
        situation: (S) => `You have ${S.chips[S.turn]} chips, your opponent ${S.chips[1 - S.turn]}. Round ${S.round}/${ROUNDS}. ${S.phase === "play" ? `Your hand ${S.hands[S.turn].map(nm).join(" ")} = ${total(S.hands[S.turn]).t}; dealer shows ${nm(S.dealer[0])}.` : "Time to bet."}`,
        yourTurn: (S) => (S.phase === "bet" ? "Pick your bet." : "Hit, stand or double?"),
      });
    },
  });
})(typeof self !== "undefined" ? self : this);
