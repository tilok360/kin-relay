// Cribbage for two, to 61 (a "short game"): discard two to the crib, peg to 31, then count fifteens, pairs, runs and flushes.
(function (root) {
  "use strict";
  const TARGET = 61;
  const RN = { 1: "A", 11: "J", 12: "Q", 13: "K" }, SN = { h: "♥", d: "♦", s: "♠", c: "♣" };
  const nm = (c) => (RN[c.r] || c.r) + SN[c.s], pv = (c) => Math.min(10, c.r);
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const deck = () => { const d = []; for (const s of "hdsc") for (let r = 1; r <= 13; r++) d.push({ r, s }); return shuffle(d); };
  // Show score of four cards plus the starter; returns the total and what made it.
  function handScore(h, st, crib) {
    const all = st ? [...h, st] : h.slice(), parts = []; let t = 0;
    let f = 0; for (let m = 1; m < 1 << all.length; m++) { let s = 0; for (let i = 0; i < all.length; i++) if (m & (1 << i)) s += pv(all[i]); if (s === 15) f++; } if (f) { t += f * 2; parts.push(`fifteens ${f * 2}`); }
    let pr = 0; for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) if (all[i].r === all[j].r) pr++; if (pr) { t += pr * 2; parts.push(`pairs ${pr * 2}`); }
    const cnt = {}; all.forEach((c) => (cnt[c.r] = (cnt[c.r] || 0) + 1));
    let runPts = 0; for (let len = 5; len >= 3 && !runPts; len--) for (let lo = 1; lo + len - 1 <= 13; lo++) { let mult = 1; for (let r = lo; r < lo + len; r++) mult *= cnt[r] || 0; if (mult) runPts += mult * len; }
    if (runPts) { t += runPts; parts.push(`runs ${runPts}`); }
    if (h.length === 4 && h.every((c) => c.s === h[0].s)) { const fl = st && st.s === h[0].s ? 5 : crib ? 0 : 4; if (fl) { t += fl; parts.push(`flush ${fl}`); } }
    if (st && h.some((c) => c.r === 11 && c.s === st.s)) { t += 1; parts.push("nobs 1"); }
    return { t, parts };
  }
  function pegPoints(seq, count) {
    let p = 0, why = []; if (count === 15) { p += 2; why.push("fifteen"); } if (count === 31) { p += 2; why.push("thirty-one"); }
    let k = 1; while (k < seq.length && seq[seq.length - 1 - k].r === seq[seq.length - 1].r) k++; if (k >= 2) { const v = { 2: 2, 3: 6, 4: 12 }[k]; p += v; why.push(k === 2 ? "a pair" : k === 3 ? "three of a kind" : "four of a kind"); }
    for (let L = seq.length; L >= 3; L--) { const rs = seq.slice(-L).map((c) => c.r).sort((a, b) => a - b); if (rs.every((r, i) => !i || r === rs[i - 1] + 1)) { p += L; why.push(`a run of ${L}`); break; } }
    return { p, why };
  }
  function deal(S, dealer) { const d = deck(); return { ...S, dealer, hands: [d.splice(0, 6), d.splice(0, 6)], deck: d, crib: [], starter: null, phase: "discard", turn: 1 - dealer, count: 0, seq: [], played: [[], []], lastP: -1, show: null, last: null }; }
  const setup = (first) => deal({ seats: first === "you" ? ["you", "kin"] : ["kin", "you"], score: [0, 0], prev: [0, 0], ply: 0 }, 1);
  const canPlay = (S, p) => S.hands[p].some((c) => S.count + pv(c) <= 31);
  function moves(S) {
    if (over(S)) return [];
    const p = S.turn, h = S.hands[p];
    if (S.phase === "discard") { const out = []; for (let i = 0; i < h.length; i++) for (let j = i + 1; j < h.length; j++) out.push({ crib: [i, j] }); return out; }
    if (S.phase === "cut") return [{ cut: true }];
    if (S.phase === "peg") { const out = h.map((c, k) => (S.count + pv(c) <= 31 ? { peg: k } : null)).filter(Boolean); return out.length ? out : [{ go: true }]; }
    if (S.phase === "show") return [{ show: true }];
    return [{ next: true }];
  }
  function add(S, p, n) { if (!n) return; S.prev = S.prev.slice(); S.score = S.score.slice(); S.prev[p] = S.score[p]; S.score[p] = Math.min(TARGET, S.score[p] + n); }
  function apply(S0, m) {
    const S = { ...S0, hands: S0.hands.map((h) => h.slice()), played: S0.played.map((x) => x.slice()), seq: S0.seq.slice(), ply: S0.ply + 1 }, p = S.turn;
    if (m.next) return deal(S, 1 - S.dealer);
    if (m.crib) { const [i, j] = m.crib, h = S.hands[p]; S.crib = [...S.crib, h[i], h[j]]; S.hands[p] = h.filter((_, k) => k !== i && k !== j); S.last = { p, crib: true }; if (S.crib.length === 4) return { ...S, phase: "cut", turn: S.dealer }; return { ...S, turn: 1 - p }; }
    if (m.cut) { const d = S0.deck.slice(), st = d.splice(Math.floor(Math.random() * d.length), 1)[0]; S.deck = d; S.starter = st; S.last = { cut: st }; if (st.r === 11) { add(S, S.dealer, 2); S.last.heels = true; } S.pegHands = S.hands.map((h) => h.slice()); return { ...S, phase: "peg", turn: 1 - S.dealer }; }
    if (m.peg != null) {
      const c = S.hands[p].splice(m.peg, 1)[0]; S.count += pv(c); S.seq.push(c); S.played[p].push(c); S.lastP = p;
      const r = pegPoints(S.seq, S.count); add(S, p, r.p); S.last = { p, peg: c, pts: r.p, why: r.why };
      if (over(S)) return S;
      const done = !S.hands[0].length && !S.hands[1].length;
      if (S.count === 31) { S.count = 0; S.seq = []; if (done) return { ...S, phase: "show" }; return { ...S, turn: S.hands[1 - p].length ? 1 - p : p }; }
      if (done) { add(S, p, 1); S.last.why = [...S.last.why, "last card"]; S.last.pts += 1; return { ...S, phase: "show" }; }
      return { ...S, turn: 1 - p };
    }
    if (m.go) {
      const o = 1 - p;
      if (canPlay(S, o)) return { ...S, turn: o, last: { p, go: true } };
      add(S, S.lastP, 1); const lp = S.lastP; S.count = 0; S.seq = []; S.last = { p, go: true, goPt: lp };
      if (over(S)) return S;
      const nx = S.hands[1 - lp].length ? 1 - lp : lp; return { ...S, turn: nx };
    }
    if (m.show) {
      const nd = 1 - S.dealer, H = S.pegHands, a = handScore(H[nd], S.starter), b = handScore(H[S.dealer], S.starter), c = handScore(S.crib, S.starter, true);
      add(S, nd, a.t); if (S.score[nd] < TARGET) { add(S, S.dealer, b.t); if (S.score[S.dealer] < TARGET) add(S, S.dealer, c.t); }
      return { ...S, phase: "done", show: { nd: a, dl: b, crib: c } };
    }
    return S;
  }
  function over(S) { const w = S.score.findIndex((x) => x >= TARGET); return w < 0 ? null : { result: S.seats[w], detail: `${S.score[w]} to ${S.score[1 - w]}${S.score[1 - w] < 31 ? " (a skunk!)" : ""}` }; }
  function rank(S, level) {
    const ms = moves(S), p = S.turn, h = S.hands[p];
    if (S.phase === "discard") {
      const rest = deck().filter((c) => !h.some((x) => x.r === c.r && x.s === c.s)), N = level === "hard" ? 46 : level === "normal" ? 20 : 8, mineCrib = S.dealer === p;
      return ms.map((m) => {
        const keep = h.filter((_, k) => !m.crib.includes(k)), toss = m.crib.map((k) => h[k]); let t = 0;
        for (let i = 0; i < N; i++) t += handScore(keep, rest[(i * 7) % rest.length]).t;
        let cv = (toss[0].r === toss[1].r ? 2 : 0) + (pv(toss[0]) + pv(toss[1]) === 15 ? 2 : 0) + toss.filter((c) => c.r === 5).length * 1.5 + (Math.abs(toss[0].r - toss[1].r) === 1 ? 0.8 : 0);
        return { m, label: `keep ${keep.map(nm).join(" ")}, give ${toss.map(nm).join(" ")} to the crib`, score: t / N + (mineCrib ? cv : -cv) + Math.random() * 0.1 };
      }).sort((a, b) => b.score - a.score);
    }
    if (S.phase === "peg") {
      return ms.map((m) => {
        if (m.go) return { m, label: "say go", score: 0 };
        const c = h[m.peg], n = S.count + pv(c), r = pegPoints([...S.seq, c], n); let sc = r.p * 3;
        if (n === 5 || n === 21) sc -= 1.5; if (n < 15 && n + 10 >= 15 && n !== 5) sc -= 0.4; if (S.seq.length && S.seq[S.seq.length - 1].r === c.r) sc -= level === "hard" ? 0.8 : 0; sc += pv(c) * 0.05;
        if (!S.seq.length && c.r <= 4) sc += 0.6;
        return { m, label: `play the ${nm(c)} (count ${n})${r.p ? ` for ${r.p}` : ""}`, score: sc + Math.random() * 0.2 };
      }).sort((a, b) => b.score - a.score);
    }
    return ms.map((m) => ({ m, label: Object.keys(m)[0], score: 0 }));
  }
  const autoMove = (S) => { if (over(S)) return null; if (["cut", "show", "done"].includes(S.phase)) return moves(S)[0]; if (S.phase === "peg" && moves(S)[0].go) return { go: true }; return null; };
  const E = { TARGET, handScore, pegPoints, setup, moves, apply, over, rank, autoMove, nm };
  if (typeof module === "object" && module.exports) { module.exports = E; return; }
  const K = root.Kit, PEG = ["#e5483b", "#2f7fe0"];
  function boardSVG(S, you) {
    let s = `<svg class="svgboard" viewBox="0 0 330 64"><rect x="1" y="1" width="328" height="62" rx="14" fill="#9a6a36" stroke="#4a2a12" stroke-width="2"/>`;
    for (const [row, p] of [[0, 1 - you], [1, you]]) { const y = 20 + row * 24; for (let n = 1; n <= 61; n++) { const x = 14 + (n - 1) * 5 + Math.floor((n - 1) / 5) * 1.6; s += `<circle cx="${x}" cy="${y}" r="1.4" fill="#2b1808"/>`; } for (const v of [S.prev[p], S.score[p]]) { if (!v) continue; const x = 14 + (v - 1) * 5 + Math.floor((v - 1) / 5) * 1.6; s += `<circle cx="${x}" cy="${y}" r="3.2" fill="${PEG[row]}" stroke="#fff" stroke-width=".8"/>`; } s += `<text x="4" y="${y + 3}" font-size="7" fill="#fff" font-weight="800">${row ? "Y" : "O"}</text>`; }
    return s + `<text x="322" y="35" font-size="6" fill="#ffe9c4" text-anchor="end" font-weight="800">61</text></svg>`;
  }
  root.KG.add({
    id: "cribbage", title: "Cribbage", icon: "🪵",
    rules: "Six cards each; both throw two into the crib, which belongs to the dealer. A starter card is cut (a jack gives the dealer 2). Pegging: take turns playing cards, keeping a running count no higher than 31. Score 2 for making 15 or 31, 2/6/12 for pairs, trips or fours in a row, and the length of any run. If you can't play, say go; the last to play gets 1. Then hands are shown with the starter: 2 per fifteen, 2 per pair, runs, flushes, and 1 for the jack of the starter's suit. The dealer also counts the crib. Dealer swaps each hand. First to 61 wins.",
    achievements: [
      { id: "twelve", icon: "🎯", name: "Twelve Up", about: "Score 12 or more in one hand." },
      { id: "thirtyone", icon: "3️⃣", name: "Thirty-One", about: "Peg exactly 31." },
      { id: "skunk", icon: "🦨", name: "Skunked", about: "Win before your opponent reaches 31." },
    ],
    mount(api) {
      return K.turnGame(api, {
        ...E, autoForYou: true, autoDelay: 700, thinkMs: 600, botMs: 550,
        mount(el, H) { const v = { bar: K.el("div"), board: K.el("div", "cribboard"), opp: K.el("div", "hand fan oppfan"), mid: K.el("div", "cribmid"), info: K.el("div", "hint big"), hand: K.el("div", "hand fan"), ctl: K.el("div", "ctrl"), pick: [] }; el.append(v.bar, v.board, v.opp, v.mid, v.info, v.hand, v.ctl); return v; },
        draw(v, S, H) {
          v.bar.replaceChildren(K.players(H, (i) => `${S.score[i]}${S.dealer === i ? " · dealer" : ""}`));
          const you = S.seats.indexOf("you"), foe = 1 - you, mine = H.mine(), shown = S.phase === "done";
          v.board.innerHTML = boardSVG(S, you);
          v.opp.replaceChildren(...(shown ? S.pegHands[foe].map((c) => K.card(c)) : S.hands[foe].map(() => K.card(null, { back: true, hue: 25 }))));
          const mid = []; const st = S.starter ? K.card(S.starter) : K.card(null, { back: true, hue: 25 }); st.classList.add("starter"); mid.push(st);
          const pile = K.el("div", "pegpile"); S.seq.forEach((c, i) => { const e = K.card(c); e.style.marginLeft = i ? "-38px" : "0"; pile.append(e); }); mid.push(pile, K.el("b", "count", S.phase === "peg" ? String(S.count) : ""));
          if (shown || S.phase === "show") { const cr = K.el("div", "hand fan mini crib"); S.crib.forEach((c) => cr.append(shown ? K.card(c) : K.card(null, { back: true, hue: 25 }))); mid.push(cr); }
          v.mid.replaceChildren(...mid);
          const L = S.last, sh = S.show;
          v.info.textContent = shown && sh ? `${H.nameOf(1 - S.dealer)}: ${sh.nd.t} (${sh.nd.parts.join(", ") || "nothing"}) · ${H.nameOf(S.dealer)}: ${sh.dl.t} (${sh.dl.parts.join(", ") || "nothing"}) · crib ${sh.crib.t}` : L && L.pts ? `${H.nameOf(L.p)}: ${L.why.join(" + ")} for ${L.pts}` : L && L.go ? (L.goPt != null ? `Go — ${H.nameOf(L.goPt)} pegs 1` : `${H.nameOf(L.p)} says go`) : L && L.heels ? "His heels: a jack cut, dealer pegs 2" : S.phase === "discard" ? `Pick two cards for ${S.dealer === you ? "your" : "their"} crib.` : "";
          const ms = mine ? H.legal() : [];
          K.flip(v.hand, () => v.hand.replaceChildren(...(shown ? S.pegHands[you] : S.hands[you]).map((c, k) => { const ok = S.phase === "discard" ? mine : ms.some((m) => m.peg === k); return K.card(c, { k: "h" + c.r + c.s, cls: (ok ? "ok" : "") + (v.pick.includes(k) ? " sel" : ""), onClick: () => { if (!ok || shown) return; if (S.phase === "discard") { v.pick = v.pick.includes(k) ? v.pick.filter((x) => x !== k) : [...v.pick, k].slice(-2); K.sfx.click(); H.redraw(); } else H.play({ peg: k }); } }); })), { lift: true });
          v.ctl.replaceChildren(); if (mine && S.phase === "discard") { const b = K.btn("btn", "To the crib", () => { const [i, j] = v.pick.slice().sort((a, b2) => a - b2); v.pick = []; H.play({ crib: [i, j] }); }); b.disabled = v.pick.length !== 2; v.ctl.append(b); } else v.pick = [];
        },
        animate: async (v, S0, m, S1) => { if (m.peg != null) { K.sfx.flip(); if (S1.last.pts) { await K.wait(100); K.sfx.score(); } } else if (m.cut) K.sfx.flip(); else if (m.show) K.sfx.chip(); else if (m.next) K.sfx.shuffle(); },
        feats(S0, m, S1, who) {
          if (m.peg != null && S1.last.why.includes("thirty-one")) api.achieve("thirtyone", who);
          if (m.show && S1.show) { const nd = 1 - S1.dealer; if (S1.show.nd.t >= 12) api.achieve("twelve", S1.seats[nd]); if (S1.show.dl.t >= 12) api.achieve("twelve", S1.seats[S1.dealer]); }
          const o = over(S1); if (o && S1.score[1 - S1.seats.indexOf(o.result)] < 31) api.achieve("skunk", o.result);
        },
        situation: (S) => `Your cards: ${S.hands[S.turn].map(nm).join(" ")}. ${S.phase === "peg" ? `Count is ${S.count}${S.seq.length ? ` (${S.seq.map(nm).join(" ")})` : ""}.` : `${S.dealer === S.turn ? "It's your crib." : "It's their crib."}`} Score: you ${S.score[S.turn]}, them ${S.score[1 - S.turn]} (to 61).`,
        yourTurn: (S) => (S.phase === "discard" ? "Pick two cards for the crib." : "Play a card (keep the count at 31 or less)."),
      });
    },
  });
})(typeof self !== "undefined" ? self : this);
