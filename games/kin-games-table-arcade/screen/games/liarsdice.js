// Liar's Dice for two: five hidden dice each. Bid how many of a face are on the table (ones are wild), raise or call "Liar!".
(function (root) {
  "use strict";
  const roll = (n) => [...Array(n).keys()].map(() => 1 + Math.floor(Math.random() * 6)).sort();
  const setup = (first) => ({ seats: first === "you" ? ["you", "kin"] : ["kin", "you"], turn: 0, dice: [roll(5), roll(5)], bid: null, bidder: -1, ply: 0, last: null, reveal: null, history: [] });
  const total = (S) => S.dice[0].length + S.dice[1].length;
  const countOf = (S, f) => S.dice.flat().filter((v) => v === f || v === 1).length;
  function raises(S) { const out = [], N = total(S), b = S.bid; for (let q = 1; q <= N; q++) for (let f = 2; f <= 6; f++) if (!b || q > b.q || (q === b.q && f > b.f)) out.push({ bid: { q, f } }); return out; }
  function moves(S) { if (over(S)) return []; if (S.reveal) return [{ next: true }]; const m = raises(S); if (S.bid) m.unshift({ call: true }); return m; }
  function apply(S, m) {
    if (m.next) { const loser = S.reveal.loser; return { ...S, dice: S.dice.map((d) => roll(d.length)), bid: null, bidder: -1, reveal: null, turn: S.dice[loser].length ? loser : 1 - loser, history: [] }; }
    if (m.call) { const n = countOf(S, S.bid.f), loser = n >= S.bid.q ? S.turn : S.bidder, dice = S.dice.map((d) => d.slice()); dice[loser].pop(); return { ...S, dice, reveal: { n, bid: S.bid, caller: S.turn, loser, shown: S.dice.map((d) => d.slice()) }, ply: S.ply + 1, last: { p: S.turn, call: true } }; }
    return { ...S, bid: m.bid, bidder: S.turn, turn: 1 - S.turn, ply: S.ply + 1, last: { p: S.turn, bid: m.bid }, history: [...S.history, { p: S.turn, ...m.bid }] };
  }
  function over(S) { const z = S.dice.findIndex((d) => !d.length); return z < 0 || (S.reveal && false) ? null : { result: S.seats[1 - z], detail: `${S.dice[1 - z].length} ${S.dice[1 - z].length === 1 ? "die" : "dice"} left standing` }; }
  const C = (n, k) => { let r = 1; for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1); return r; };
  const atLeast = (n, k, p) => { if (k <= 0) return 1; if (k > n) return 0; let s = 0; for (let i = k; i <= n; i++) s += C(n, i) * Math.pow(p, i) * Math.pow(1 - p, n - i); return s; };
  const FN = { 2: "twos", 3: "threes", 4: "fours", 5: "fives", 6: "sixes" };
  const said = (b) => `${b.q} ${b.q === 1 ? FN[b.f].slice(0, -1) : FN[b.f]}`;
  function rank(S, level) {
    const ms = moves(S); if (S.reveal) return [{ m: ms[0], label: "next round", score: 0 }];
    const me = S.turn, mine = S.dice[me], unk = S.dice[1 - me].length, have = (f) => mine.filter((v) => v === f || v === 1).length;
    // A bid the other player just made hints that they hold some of that face.
    const hint = (f) => S.history.filter((h) => h.p !== me && h.f === f).length * (level === "hard" ? 0.6 : 0.3);
    const P = (b) => atLeast(unk, b.q - have(b.f) - Math.round(hint(b.f)), 1 / 3);
    const out = [];
    if (S.bid) { const pt = P(S.bid); out.push({ m: { call: true }, label: `call "Liar!" on ${said(S.bid)}`, score: (1 - pt) * 1.05 - 0.02 }); }
    for (const m of ms) if (m.bid) { const p = P(m.bid); if (S.bid && m.bid.q > S.bid.q + 2) continue; const bluff = level === "hard" ? 0.08 : 0.15; out.push({ m, label: `bid ${said(m.bid)}`, score: p - (m.bid.q - (S.bid ? S.bid.q : 1)) * 0.03 + (have(m.bid.f) ? 0.03 : Math.random() * bluff) }); }
    return out.sort((a, b) => b.score - a.score);
  }
  const autoMove = (S) => (S.reveal && !over(S) ? { next: true } : null);
  const E = { setup, moves, apply, over, rank, autoMove, countOf, atLeast, raises };
  if (typeof module === "object" && module.exports) { module.exports = E; return; }
  const K = root.Kit;
  root.KG.add({
    id: "liarsdice", title: "Liar's Dice", icon: "🎲",
    rules: "Each of you shakes five dice under a cup and peeks only at your own. Take turns bidding on how many dice of one face are on the whole table, counting ones as wild (you can't bid on ones). Every bid must beat the last: more dice, or the same number of a higher face. Instead of raising you can call \"Liar!\": all dice are shown. If there are at least as many as bid, the caller loses a die; if not, the bidder does. Lose all your dice and you're out.",
    achievements: [
      { id: "exact", icon: "🎯", name: "Spot On", about: "Win a challenge where the count was exactly the bid." },
      { id: "bluff", icon: "😏", name: "Poker Face", about: "Win a challenge on a bid you held none of yourself." },
      { id: "comeback", icon: "🔄", name: "Last Die Standing", about: "Win from a single die against three or more." },
    ],
    mount(api) {
      return K.turnGame(api, {
        ...E, autoForYou: true, autoDelay: 2600, thinkMs: 700, botMs: 600,
        mount(el, H) {
          const v = { bar: K.el("div"), them: K.el("div", "cupzone"), bidbox: K.el("div", "bidbox"), you: K.el("div", "cupzone mine"), ctl: K.el("div", "ctrl bidctl"), q: 1, f: 2 }; el.append(v.bar, v.them, v.bidbox, v.you, v.ctl);
          v.qm = K.btn("btn alt small", "−", () => { v.q = Math.max(1, v.q - 1); H.redraw(); }); v.qv = K.el("b", "qv"); v.qp = K.btn("btn alt small", "+", () => { v.q = Math.min(total(H.S), v.q + 1); H.redraw(); });
          v.faces = [2, 3, 4, 5, 6].map((f) => { const b = K.die(f, { onClick: () => { v.f = f; K.sfx.click(); H.redraw(); } }); b.classList.add("fsel"); return b; });
          v.bidB = K.btn("btn", "Bid", () => H.mine() && H.play({ bid: { q: v.q, f: v.f } })); v.liar = K.btn("btn liar", "Liar!", () => H.mine() && H.S.bid && H.play({ call: true }));
          const qwrap = K.el("div", "qwrap"); qwrap.append(v.qm, v.qv, v.qp); const fw = K.el("div", "fwrap"); fw.append(...v.faces);
          v.ctl.append(qwrap, K.el("span", "", "×"), fw, v.bidB, v.liar);
          return v;
        },
        draw(v, S, H) {
          v.bar.replaceChildren(K.players(H, (i) => `${S.dice[i].length} dice`));
          const you = S.seats.indexOf("you"), foe = 1 - you, R = S.reveal, mine = H.mine();
          const show = (host, d, open, hi) => { host.replaceChildren(); const cup = K.el("div", "cup" + (open ? " up" : "")); host.append(cup); const row = K.el("div", "drow"); d.forEach((x) => row.append(K.die(open ? x : 6, { cls: (open ? "" : "hid") + (hi && hi(x) ? " held" : "") }))); host.append(row); };
          const hl = R ? (x) => x === R.bid.f || x === 1 : null;
          show(v.them, R ? R.shown[foe] : S.dice[foe], !!R, hl); show(v.you, R ? R.shown[you] : S.dice[you], true, hl);
          v.bidbox.innerHTML = R ? `<div class="bidtxt"><span>${H.nameOf(R.caller)} called liar on</span><b>${R.bid.q} × ${K.dieSVG(R.bid.f)}</b><span>There ${R.n === 1 ? "was" : "were"} <b>${R.n}</b>. ${H.nameOf(R.loser)} ${R.loser === you ? "lose" : "loses"} a die.</span></div>` : S.bid ? `<div class="bidtxt"><span>${H.nameOf(S.bidder)} ${S.bidder === you ? "bid" : "bids"}</span><b>${S.bid.q} × ${K.dieSVG(S.bid.f)}</b><span>ones are wild</span></div>` : `<div class="bidtxt"><span>Opening bid</span></div>`;
          const legal = (q, f) => !S.bid || q > S.bid.q || (q === S.bid.q && f > S.bid.f);
          if (mine && !legal(v.q, v.f)) { if (S.bid) { if (S.bid.f < 6) { v.q = S.bid.q; v.f = S.bid.f + 1; } else { v.q = S.bid.q + 1; } } }
          v.qv.textContent = v.q; v.faces.forEach((b, k) => b.classList.toggle("held", v.f === k + 2));
          v.ctl.style.visibility = mine ? "" : "hidden"; v.bidB.disabled = !legal(v.q, v.f) || v.q > total(S); v.liar.disabled = !S.bid;
        },
        animate: async (v, S0, m) => { if (m.call) { K.sfx.thock(); await K.wait(300); K.sfx.roll(); } else if (m.bid) K.sfx.chip(); else if (m.next) K.sfx.shuffle(); },
        feats(S0, m, S1, who) {
          if (!m.call) return; const R = S1.reveal, winner = S1.seats[1 - R.loser], wi = 1 - R.loser;
          if (R.n === R.bid.q) api.achieve("exact", winner);
          if (R.bid && S0.bidder === wi && !S0.dice[wi].some((x) => x === R.bid.f || x === 1)) api.achieve("bluff", winner);
          const o = over(S1); if (o && S0.dice[S1.seats.indexOf(o.result)].length === 1 && S0.dice[1 - S1.seats.indexOf(o.result)].length >= 3) api.achieve("comeback", o.result);
        },
        situation: (S) => `Your dice: ${S.dice[S.turn].join(", ")}. They have ${S.dice[1 - S.turn].length} hidden dice. ${S.bid ? `Their bid: ${S.bid.q} ${FN[S.bid.f]}.` : "You open the bidding."} Ones are wild.`,
        yourTurn: (S) => (S.bid ? "Raise the bid, or call Liar!" : "Make the opening bid."),
      });
    },
  });
})(typeof self !== "undefined" ? self : this);
