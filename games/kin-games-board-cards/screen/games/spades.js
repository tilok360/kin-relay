// Spades for four in partnerships: you and Wren (computer) against your opponent and Otto (computer). Bid tricks, make them, avoid bags.
(function (root) {
  "use strict";
  const TARGET = 250;
  const RN = { 11: "J", 12: "Q", 13: "K", 14: "A" }, SN = { h: "♥", d: "♦", s: "♠", c: "♣" };
  const nm = (c) => (RN[c.r] || c.r) + SN[c.s], eq = (a, b) => a.r === b.r && a.s === b.s;
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const sortH = (h) => h.sort((a, b) => "dchs".indexOf(a.s) - "dchs".indexOf(b.s) || a.r - b.r);
  // Seats clockwise: 0 you (south), 1 your opponent (west), 2 Wren (north, your partner), 3 Otto (east). Teams are 0+2 and 1+3.
  const team = (p) => p % 2;
  function deal(S) { const d = []; for (const s of "hdsc") for (let r = 2; r <= 14; r++) d.push({ r, s }); shuffle(d); return { ...S, hands: [0, 1, 2, 3].map((i) => sortH(d.slice(i * 13, i * 13 + 13))), bids: [null, null, null, null], won: [0, 0, 0, 0], trick: [], broken: false, phase: "bid", turn: (S.dealer + 1) % 4, tricks: 0, lastTrick: null, handRes: null }; }
  const setup = (first) => deal({ seats: ["you", "kin", "bot", "bot"], names: [null, null, "Wren", "Otto"], score: [0, 0], bags: [0, 0], dealer: first === "you" ? 3 : 0, ply: 0 });
  function legal(S, p) { const h = S.hands[p]; if (!S.trick.length) { const ns = h.filter((c) => c.s !== "s"); return S.broken || !ns.length ? h : ns; } const f = h.filter((c) => c.s === S.trick[0].c.s); return f.length ? f : h; }
  function moves(S) { if (over(S)) return []; if (S.phase === "done") return [{ next: true }]; if (S.phase === "bid") { const o = []; for (let b = 0; b <= 13; b++) o.push({ bid: b }); return o; } return legal(S, S.turn).map((c) => ({ c })); }
  function estimate(h) {
    let t = 0; const sp = h.filter((c) => c.s === "s");
    for (const s of "hdc") { const su = h.filter((c) => c.s === s), n = su.length; if (su.some((c) => c.r === 14)) t += n <= 5 ? 1 : 0.6; if (su.some((c) => c.r === 13)) t += n >= 2 && n <= 4 ? 0.8 : n === 1 ? 0.1 : 0.4; if (su.some((c) => c.r === 12) && n >= 3 && n <= 4) t += 0.25; if (n <= 1) t += Math.max(0, sp.length - 2) * (n === 0 ? 0.6 : 0.35); }
    for (const c of sp) t += c.r >= 13 ? 1 : c.r === 12 ? 0.8 : c.r === 11 ? 0.55 : 0.32;
    return t;
  }
  function apply(S0, m) {
    if (m.next) return deal({ ...S0, dealer: (S0.dealer + 1) % 4 });
    const S = { ...S0, hands: S0.hands.map((h) => h.slice()), ply: S0.ply + 1 }, p = S.turn;
    if (m.bid != null) { const bids = S.bids.slice(); bids[p] = m.bid; const T = { ...S, bids, turn: (p + 1) % 4, last: { p, bid: m.bid } }; if (bids.every((b) => b != null)) { T.phase = "play"; T.turn = (S.dealer + 1) % 4; } return T; }
    S.hands[p] = S.hands[p].filter((c) => !eq(c, m.c)); const trick = [...S0.trick, { p, c: m.c }], broken = S.broken || m.c.s === "s";
    if (trick.length < 4) return { ...S, trick, broken, turn: (p + 1) % 4, last: { p, c: m.c } };
    const led = trick[0].c.s; let w = trick[0]; for (const t of trick.slice(1)) { const a = w.c, b = t.c; if ((b.s === a.s && b.r > a.r) || (b.s === "s" && a.s !== "s")) w = t; }
    const won = S.won.slice(); won[w.p]++;
    const T = { ...S, trick: [], broken, won, tricks: S.tricks + 1, turn: w.p, lastTrick: { cards: trick, winner: w.p }, last: { p, c: m.c, wonBy: w.p } };
    void led; if (T.tricks < 13) return T;
    const score = S.score.slice(), bags = S.bags.slice(), res = [];
    for (const tm of [0, 1]) {
      const a = tm, b = tm + 2; let d = 0, notes = [], need = 0, got = 0;
      for (const q of [a, b]) { if (S.bids[q] === 0) { if (won[q] === 0) { d += 100; notes.push(`nil made +100`); } else { d -= 100; notes.push(`nil broken −100`); got += won[q]; } } else { need += S.bids[q]; got += won[q]; } }
      if (need) { if (got >= need) { d += need * 10 + (got - need); bags[tm] += got - need; notes.push(`made ${need} (+${need * 10})${got > need ? `, ${got - need} bag${got - need > 1 ? "s" : ""}` : ""}`); } else { d -= need * 10; notes.push(`set! −${need * 10}`); } } else if (got) { bags[tm] += got; d += got; }
      if (bags[tm] >= 10) { bags[tm] -= 10; d -= 100; notes.push("ten bags −100"); }
      score[tm] += d; res.push({ d, notes });
    }
    return { ...T, score, bags, handRes: res, phase: "done" };
  }
  function over(S) { if (S.phase !== "done") return null; const [a, b] = S.score; if (Math.max(a, b) < TARGET && Math.min(a, b) > -200) return null; if (a === b) return null; return { result: a > b ? "you" : "kin", detail: `${Math.max(a, b)} to ${Math.min(a, b)}` }; }
  function rank(S, level) {
    const p = S.turn, ms = moves(S); if (S.phase === "done") return ms.map((m) => ({ m, label: "next hand", score: 0 }));
    if (S.phase === "bid") {
      const e = estimate(S.hands[p]), mate = S.bids[(p + 2) % 4], hiSp = S.hands[p].filter((c) => c.s === "s" && c.r >= 12).length, lows = S.hands[p].filter((c) => c.r <= 9).length;
      const nilOk = e < 1.4 && !hiSp && lows >= 8 && mate !== 0 && level !== "beginner"; let tgt = Math.max(1, Math.round(e + (level === "beginner" ? (Math.random() - 0.5) * 2 : 0)));
      if (mate != null && mate !== 0 && mate + tgt > 12) tgt = Math.max(1, 12 - mate);
      return ms.map((m) => ({ m, label: m.bid === 0 ? "bid nil" : `bid ${m.bid}`, score: m.bid === 0 ? (nilOk ? 10 : -50) : -Math.abs(m.bid - tgt) })).sort((a, b) => b.score - a.score);
    }
    const T = S.trick, mate = (p + 2) % 4, teamNeed = (S.bids[p] || 0) + (S.bids[mate] || 0), teamGot = S.won[p] + S.won[mate], needMore = teamGot < teamNeed, myNil = S.bids[p] === 0, mateNil = S.bids[mate] === 0;
    const beats = (c, w) => (c.s === w.s && c.r > w.r) || (c.s === "s" && w.s !== "s");
    let win = null; for (const t of T) if (!win || beats(t.c, win.c)) win = t;
    return ms.map(({ c }) => {
      let sc;
      if (myNil) sc = win ? (beats(c, win.c) ? -30 - c.r : c.r) : -c.r * 2;
      else if (!T.length) { const n = S.hands[p].filter((x) => x.s === c.s).length; sc = needMore ? (c.r === 14 ? 8 : c.r === 13 && S.hands[p].some((x) => x.s === c.s && x.r === 14) ? 5 : c.s === "s" ? c.r * 0.2 : -c.r * 0.2 + (n <= 2 ? 1 : 0)) : -c.r * 0.4 - (c.s === "s" ? 4 : 0); if (mateNil) sc = c.r * 0.4 + (c.s === "s" ? 2 : 0); }
      else { const mateWins = win.p === mate, b = beats(c, win.c), last = T.length === 3, cheap = -c.r * 0.3 - (c.s === "s" ? 3 : 0);
        if (mateNil && mateWins) sc = b ? 10 - c.r * 0.1 : -10;
        else if (needMore && !mateWins) sc = b ? 6 - (last ? c.r * 0.3 : (14 - c.r) * -0.1) - (c.s === "s" && T[0].c.s !== "s" ? 1 : 0) : cheap;
        else if (mateWins) sc = b ? -6 : cheap + 2;
        else sc = b ? -3 - c.r * 0.1 : cheap + 1; }
      if (level === "beginner") sc *= 0.3;
      return { m: { c }, label: `play the ${nm(c)}`, score: sc + Math.random() * 0.3 };
    }).sort((a, b) => b.score - a.score);
  }
  const autoMove = (S) => (over(S) ? null : S.phase === "done" ? { next: true } : null);
  const E = { TARGET, setup, moves, apply, over, rank, autoMove, legal, estimate, nm, team };
  if (typeof module === "object" && module.exports) { module.exports = E; return; }
  const K = root.Kit, SEAT = ["s", "w", "n", "e"];
  root.KG.add({
    id: "spades", title: "Spades", icon: "♠",
    rules: "Partners sit across: you with Wren (computer) against your opponent with Otto (computer). Everyone bids how many tricks they'll take; a nil bid promises none (±100). Follow suit if you can; spades are always trump and can't be led until one has been played. Make your team's bid: 10 points per trick bid plus 1 per extra trick (a bag). Fall short and lose 10 per trick bid. Every ten bags costs 100. First team to 250 wins (or drop to −200 and lose).",
    achievements: [
      { id: "nil", icon: "0️⃣", name: "Nothing Doing", about: "Make a nil bid." },
      { id: "set", icon: "✂️", name: "Set 'Em", about: "Stop the other team making their bid." },
      { id: "exact", icon: "🎯", name: "On the Nose", about: "Make your team's bid exactly." },
    ],
    mount(api) {
      return K.turnGame(api, {
        ...E, autoForYou: true, autoDelay: 2400, botMs: 420, thinkMs: 480,
        mount(el, H) { const v = { bar: K.el("div"), table: K.el("div", "tricktable"), info: K.el("div", "hint big"), hand: K.el("div", "hand fan"), ctl: K.el("div", "ctrl bids") }; el.append(v.bar, v.table, v.info, v.hand, v.ctl); return v; },
        draw(v, S, H) {
          const tn = ["You & Wren", `${H.nameOf(1)} & Otto`];
          v.bar.replaceChildren(K.players(H, (i) => `bid ${S.bids[i] == null ? "–" : S.bids[i] === 0 ? "nil" : S.bids[i]} · took ${S.won[i]}`), K.el("div", "hint", `${tn[0]}: ${S.score[0]} (${S.bags[0]} bags) · ${tn[1]}: ${S.score[1]} (${S.bags[1]} bags)`));
          const mine = H.mine(), show = S.trick.length ? S.trick : v.hold || [];
          v.table.replaceChildren(...[1, 2, 3].map((i) => { const s = K.el("div", "tseat " + SEAT[i] + (S.turn === i ? " on" : "")); s.append(K.el("b", "", `${H.nameOf(i)}${i === 2 ? " (partner)" : ""}`)); const f = K.el("div", "hand fan mini"); S.hands[i].forEach(() => f.append(K.card(null, { back: true, hue: 220 }))); s.append(f); return s; }));
          const pile = K.el("div", "trick"); show.forEach((t) => { const c = K.card(t.c); c.classList.add("tp" + SEAT[t.p]); pile.append(c); }); v.table.append(pile);
          const L = mine && S.phase === "play" ? legal(S, 0) : [];
          v.info.textContent = S.phase === "done" ? S.handRes.map((r, t) => `${tn[t]}: ${r.d >= 0 ? "+" : ""}${r.d} (${r.notes.join(", ") || "no bid"})`).join(" · ") : S.phase === "bid" ? (mine ? `How many tricks will you take? (my guess: about ${Math.round(estimate(S.hands[0]))})` : "Bidding…") : S.broken ? "Spades are broken." : "";
          K.flip(v.hand, () => v.hand.replaceChildren(...S.hands[0].map((c) => { const ok = L.some((x) => eq(x, c)); return K.card(c, { k: "h" + c.r + c.s, cls: ok ? "ok" : mine && S.phase === "play" ? "dim" : "", onClick: () => ok && H.play({ c }) }); })), { lift: true });
          v.ctl.replaceChildren(); if (mine && S.phase === "bid") for (let b = 0; b <= 13; b++) v.ctl.append(K.btn("btn sm", b ? String(b) : "Nil", () => H.play({ bid: b })));
        },
        animate: async (v, S0, m, S1) => { if (m.c) { K.sfx.flip(); if (S1.tricks !== S0.tricks) v.hold = S1.lastTrick.cards; } else if (m.next) { v.hold = null; K.sfx.shuffle(); } else if (m.bid != null) K.sfx.chip(); },
        feats(S0, m, S1) {
          if (S1.phase !== "done" || S0.phase === "done") return;
          [0, 1].forEach((tm) => { const who = S1.seats[tm], r = S1.handRes[tm], o = S1.handRes[1 - tm]; if ([tm, tm + 2].some((q) => q !== 2 && q !== 3 && S1.bids[q] === 0 && S1.won[q] === 0)) api.achieve("nil", who); if (o.notes.some((x) => x.startsWith("set"))) api.achieve("set", who); const need = S1.bids[tm] + S1.bids[tm + 2], got = S1.won[tm] + S1.won[tm + 2]; if (need && got === need && !r.notes.some((x) => x.includes("broken"))) api.achieve("exact", who); });
        },
        situation: (S) => `Your hand: ${S.hands[S.turn].map(nm).join(" ")}. ${S.phase === "bid" ? `Bids so far: ${S.bids.map((b) => (b == null ? "–" : b)).join(", ")}.` : `On the table: ${S.trick.map((t) => nm(t.c)).join(" ") || "nothing (you lead)"}. Your team bid ${S.bids[S.turn] + S.bids[(S.turn + 2) % 4]} and has ${S.won[S.turn] + S.won[(S.turn + 2) % 4]}.`}`,
        yourTurn: (S) => (S.phase === "bid" ? "Make your bid." : "Play a card."),
      });
    },
  });
})(typeof self !== "undefined" ? self : this);
