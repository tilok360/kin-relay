// Gin Rummy for two: draw, discard, build melds (sets and runs), knock at 10 or less deadwood, or go gin. First to 100.
(function (root) {
  "use strict";
  const TARGET = 100;
  const RN = { 1: "A", 11: "J", 12: "Q", 13: "K" }, SN = { h: "♥", d: "♦", s: "♠", c: "♣" };
  const nm = (c) => (RN[c.r] || c.r) + SN[c.s], val = (c) => Math.min(10, c.r), key = (c) => c.r + c.s;
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const deck = () => { const d = []; for (const s of "hdsc") for (let r = 1; r <= 13; r++) d.push({ r, s }); return shuffle(d); };
  // Every possible meld in a hand, as bitmasks over its cards.
  function allMelds(h) {
    const out = [], n = h.length;
    const byR = {}; h.forEach((c, i) => (byR[c.r] = byR[c.r] || []).push(i));
    for (const r in byR) { const ix = byR[r]; if (ix.length >= 3) { if (ix.length === 4) out.push(ix.reduce((m, i) => m | (1 << i), 0)); for (let a = 0; a < ix.length; a++) for (let b = a + 1; b < ix.length; b++) for (let c = b + 1; c < ix.length; c++) out.push((1 << ix[a]) | (1 << ix[b]) | (1 << ix[c])); } }
    for (const s of "hdsc") { const at = {}; h.forEach((c, i) => c.s === s && (at[c.r] = i)); for (let r = 1; r <= 11; r++) { let m = 0, len = 0; for (let q = r; q <= 13 && at[q] != null; q++) { m |= 1 << at[q]; len++; if (len >= 3) out.push(m); } } }
    void n; return out;
  }
  function best(h) {
    const ms = allMelds(h), vals = h.map(val), total = vals.reduce((a, b) => a + b, 0); let bestSave = 0, bestSet = [];
    const go = (i, used, save, chosen) => { if (save > bestSave) { bestSave = save; bestSet = chosen.slice(); } for (let k = i; k < ms.length; k++) { if (ms[k] & used) continue; let s = 0; for (let j = 0; j < h.length; j++) if (ms[k] & (1 << j)) s += vals[j]; chosen.push(ms[k]); go(k + 1, used | ms[k], save + s, chosen); chosen.pop(); } };
    go(0, 0, 0, []);
    const inM = bestSet.reduce((a, b) => a | b, 0);
    return { dead: total - bestSave, melds: bestSet.map((m) => h.filter((_, j) => m & (1 << j))), loose: h.filter((_, j) => !(inM & (1 << j))) };
  }
  function deal(S, dealer) { const d = deck(), hands = [d.splice(0, 10), d.splice(0, 10)]; return { ...S, hands, stock: d, pile: [d.pop()], turn: 1 - dealer, dealer, phase: "draw", picked: null, round: null, seen: [[], []], last: null }; }
  const setup = (first) => deal({ seats: first === "you" ? ["you", "kin"] : ["kin", "you"], score: [0, 0], hands_played: 0, ply: 0 }, 1);
  function moves(S) {
    if (over(S)) return [];
    if (S.round) return [{ next: true }];
    if (S.phase === "draw") { if (S.stock.length <= 2) return [{ dead: true }]; const m = [{ from: "stock" }]; if (S.pile.length) m.push({ from: "pile" }); return m; }
    const h = S.hands[S.turn], out = [];
    h.forEach((c, k) => { if (S.picked && key(c) === key(S.picked)) return; out.push({ k }); const rest = h.filter((_, j) => j !== k); if (best(rest).dead <= 10) out.push({ k, knock: true }); });
    return out;
  }
  // Defender lays loose cards onto the knocker's melds where they fit.
  function layoff(melds, loose) {
    melds = melds.map((m) => m.slice()); let left = loose.slice(), moved = true;
    while (moved) { moved = false; for (const c of left.slice()) for (const m of melds) { const set = m.every((x) => x.r === m[0].r); const fits = set ? c.r === m[0].r && m.length < 4 : c.s === m[0].s && (c.r === Math.min(...m.map((x) => x.r)) - 1 || c.r === Math.max(...m.map((x) => x.r)) + 1); if (fits) { m.push(c); left = left.filter((x) => x !== c); moved = true; break; } } }
    return left;
  }
  function apply(S0, m) {
    if (m.next) return deal({ ...S0, hands_played: S0.hands_played + 1 }, 1 - S0.dealer);
    const S = { ...S0, hands: S0.hands.map((h) => h.slice()), stock: S0.stock.slice(), pile: S0.pile.slice(), seen: S0.seen.map((x) => x.slice()), ply: S0.ply + 1 }, p = S.turn;
    if (m.dead) return { ...S, round: { dead: true, pts: 0, winner: -1 } };
    if (m.from) { const c = m.from === "pile" ? S.pile.pop() : S.stock.pop(); S.hands[p].push(c); if (m.from === "pile") S.seen[p].push(c); return { ...S, phase: "discard", picked: m.from === "pile" ? c : null, last: { p, from: m.from, card: m.from === "pile" ? c : null } }; }
    const c = S.hands[p].splice(m.k, 1)[0];
    if (!m.knock) { S.pile.push(c); return { ...S, phase: "draw", picked: null, turn: 1 - p, last: { p, discard: c } }; }
    S.pile.push(c);
    const K1 = best(S.hands[p]), D1 = best(S.hands[1 - p]); let winner, pts, how;
    if (K1.dead === 0) { winner = p; pts = 25 + D1.dead; how = "gin"; }
    else { const left = layoff(K1.melds, D1.loose), dd = left.reduce((t, x) => t + val(x), 0); if (dd <= K1.dead) { winner = 1 - p; pts = 25 + K1.dead - dd; how = "undercut"; } else { winner = p; pts = dd - K1.dead; how = "knock"; } }
    const score = S.score.slice(); score[winner] += pts;
    return { ...S, score, round: { winner, pts, how, knocker: p, hands: S.hands.map((h) => best(h)) }, last: { p, discard: c, knock: true } };
  }
  function over(S) { if (!S.round) return null; const w = S.score.findIndex((x) => x >= TARGET); return w < 0 ? null : { result: S.seats[w], detail: `${S.score[w]} to ${S.score[1 - w]}` }; }
  function rank(S, level) {
    const ms = moves(S), p = S.turn, h = S.hands[p];
    if (S.round || ms[0].dead) return ms.map((m) => ({ m, label: m.next ? "next hand" : "the stock ran out: no score", score: 0 }));
    const knockAt = { beginner: 3, easy: 6, normal: 9, hard: 10 }[level] || 9;
    if (S.phase === "draw") {
      const now = Math.min(...h.map((_, k) => best(h.filter((_, j) => j !== k)).dead)), top = S.pile[S.pile.length - 1];
      const withTop = top ? Math.min(...h.map((_, k) => best([...h.filter((_, j) => j !== k), top]).dead)) : 99;
      return ms.map((m) => ({ m, label: m.from === "pile" ? `take the ${nm(top)} from the discard pile` : "draw from the stock", score: m.from === "pile" ? now - withTop - 2.5 : 0 })).sort((a, b) => b.score - a.score);
    }
    const foeWants = (c) => S.seen[1 - p].some((x) => (x.r === c.r) || (x.s === c.s && Math.abs(x.r - c.r) <= 2)) ? 2 : 0;
    return ms.map((m) => {
      const c = h[m.k], rest = h.filter((_, j) => j !== m.k), d = best(rest).dead;
      let sc = -d - (level !== "beginner" ? foeWants(c) : 0) + val(c) * 0.05;
      if (m.knock) sc += d === 0 ? 50 : d <= knockAt ? 8 - d * 0.5 + (S.stock.length < 12 ? 4 : 0) : -50;
      return { m, label: `${m.knock ? (d === 0 ? "go GIN, discarding" : `knock with ${d} deadwood, discarding`) : "discard"} the ${nm(c)}`, score: sc + Math.random() * 0.2 };
    }).sort((a, b) => b.score - a.score);
  }
  const autoMove = (S) => { const ms = moves(S); return ms.length === 1 && (ms[0].next || ms[0].dead) ? ms[0] : null; };
  const E = { TARGET, best, allMelds, layoff, setup, moves, apply, over, rank, autoMove, nm, val };
  if (typeof module === "object" && module.exports) { module.exports = E; return; }
  const K = root.Kit;
  root.KG.add({
    id: "ginrummy", title: "Gin Rummy", icon: "🂡",
    rules: "Ten cards each. On your turn draw one (from the stock or the top of the discard pile), then discard one. Build melds: three or four of a rank, or three or more in a row of one suit (ace low). Unmatched cards are deadwood (pictures 10, aces 1). With 10 or less deadwood you may knock: hands are shown and your opponent lays off what fits your melds. Lower deadwood scores the difference; if the defender ties or beats the knocker, that's an undercut (+25). Zero deadwood is Gin (+25 plus their deadwood). First to 100 wins. A card picked up from the pile can't be thrown straight back.",
    achievements: [
      { id: "gin", icon: "🍸", name: "Gin!", about: "Go gin." },
      { id: "undercut", icon: "🔪", name: "Undercut", about: "Undercut a knock." },
      { id: "big", icon: "💯", name: "Big Hand", about: "Score 40 or more in one hand." },
    ],
    mount(api) {
      return K.turnGame(api, {
        ...E, autoForYou: true, autoDelay: 3200, thinkMs: 600, botMs: 600,
        mount(el, H) { const v = { bar: K.el("div"), opp: K.el("div", "hand fan oppfan"), mid: K.el("div", "olmid"), info: K.el("div", "hint"), hand: K.el("div", "ginhand"), ctl: K.el("div", "ctrl"), knock: false }; el.append(v.bar, v.opp, v.mid, v.info, v.hand, v.ctl); return v; },
        draw(v, S, H) {
          v.bar.replaceChildren(K.players(H, (i) => `${S.score[i]} / ${TARGET}`));
          const you = S.seats.indexOf("you"), foe = 1 - you, mine = H.mine(), R = S.round;
          if (R && R.hands) { const b = R.hands[foe]; v.opp.className = "ginhand opp"; v.opp.replaceChildren(...b.melds.map((m) => { const g = K.el("div", "meld"); m.forEach((c) => g.append(K.card(c))); return g; }), ...(b.loose.length ? [(() => { const g = K.el("div", "meld loose"); b.loose.forEach((c) => g.append(K.card(c))); return g; })()] : [])); }
          else { v.opp.className = "hand fan oppfan"; v.opp.replaceChildren(...S.hands[foe].map(() => K.card(null, { back: true, hue: 140 }))); }
          const topC = S.pile[S.pile.length - 1], canDraw = mine && S.phase === "draw" && !R;
          const st = K.btn("pilebtn", "", () => canDraw && H.play({ from: "stock" })); st.append(K.card(null, { back: true, hue: 140 }), K.el("small", "", `${S.stock.length}`)); st.disabled = !canDraw;
          const pb = K.btn("pilebtn", "", () => canDraw && topC && H.play({ from: "pile" })); if (topC) pb.append(K.card(topC)); pb.disabled = !canDraw || !topC; if (canDraw) { st.classList.add("ready"); pb.classList.add("ready"); }
          v.mid.replaceChildren(st, pb);
          const b = best(S.hands[you]);
          v.info.textContent = R ? (R.dead ? "The stock ran out: no score this hand." : `${H.nameOf(R.winner)} ${R.winner === you ? "score" : "scores"} ${R.pts} (${R.how === "gin" ? "gin" : R.how === "undercut" ? "undercut!" : "knock"}).`) : `Your deadwood: ${S.hands[you].length === 11 ? "pick a discard" : b.dead}` + (S.last && S.last.from && S.last.p === foe ? ` · ${H.nameOf(foe)} drew from the ${S.last.from === "pile" ? "pile" : "stock"}` : "");
          const L = mine && S.phase === "discard" ? H.legal() : [], ord = [...b.melds.flat(), ...b.loose.sort((a, c) => a.s.localeCompare(c.s) || a.r - c.r)];
          K.flip(v.hand, () => { v.hand.replaceChildren(); const groups = [...b.melds, b.loose]; groups.forEach((g, gi) => { if (!g.length) return; const w = K.el("div", "meld" + (gi === groups.length - 1 ? " loose" : "")); g.forEach((c) => { const k = S.hands[you].indexOf(c), ok = L.some((m) => m.k === k && (!v.knock || m.knock)); w.append(K.card(c, { k: "g" + key(c), cls: ok ? "ok" : "", onClick: () => { if (!ok) return; H.play({ k, knock: v.knock }); v.knock = false; } })); }); v.hand.append(w); }); void ord; });
          v.ctl.replaceChildren(); if (mine && L.some((m) => m.knock)) { const kb = K.btn("btn" + (v.knock ? "" : " alt"), v.knock ? "Knocking: tap a card to discard" : "Knock…", () => { v.knock = !v.knock; H.redraw(); }); v.ctl.append(kb); }
        },
        animate: async (v, S0, m, S1) => { if (m.from) K.sfx.deal(); else if (m.knock) { K.sfx.thock(); await K.wait(150); K.sfx.thock(); } else if (m.k != null) K.sfx.flip(); else if (m.next) K.sfx.shuffle(); },
        feats(S0, m, S1, who) { const R = S1.round; if (!m.knock || !R) return; const w = S1.seats[R.winner]; if (R.how === "gin") api.achieve("gin", w); if (R.how === "undercut") api.achieve("undercut", w); if (R.pts >= 40) api.achieve("big", w); void who; },
        situation: (S) => { const b = best(S.hands[S.turn]); return `Your hand: ${S.hands[S.turn].map(nm).join(" ")} (deadwood ${b.dead}). Discard pile top: ${S.pile.length ? nm(S.pile[S.pile.length - 1]) : "empty"}. Score: you ${S.score[S.turn]}, them ${S.score[1 - S.turn]}.`; },
        yourTurn: (S) => (S.phase === "draw" ? "Draw from the stock or take the top discard." : "Tap a card to discard it (or knock)."),
      });
    },
  });
})(typeof self !== "undefined" ? self : this);
