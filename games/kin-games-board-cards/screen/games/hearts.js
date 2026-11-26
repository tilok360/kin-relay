// Hearts for four: you (south), your opponent (north) and two computer players. Avoid hearts (1 each) and the queen of spades (13).
// Take them all and you shoot the moon. When anyone reaches 50, the lower of you and your opponent wins.
(function (root) {
  "use strict";
  const TARGET = 50;
  const RN = { 11: "J", 12: "Q", 13: "K", 14: "A" }, SN = { h: "♥", d: "♦", s: "♠", c: "♣" };
  const nm = (c) => (RN[c.r] || c.r) + SN[c.s], eq = (a, b) => a.r === b.r && a.s === b.s;
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const sortH = (h) => h.sort((a, b) => "cdsh".indexOf(a.s) - "cdsh".indexOf(b.s) || a.r - b.r);
  const pts = (c) => (c.s === "h" ? 1 : c.s === "s" && c.r === 12 ? 13 : 0);
  const DIRS = [1, 3, 2, 0], DNAME = ["left", "right", "across", "keep"];
  function deal(S) { const d = []; for (const s of "hdsc") for (let r = 2; r <= 14; r++) d.push({ r, s }); shuffle(d); const hands = [0, 1, 2, 3].map((i) => sortH(d.slice(i * 13, i * 13 + 13))); const dir = DIRS[S.hand % 4]; const S2 = { ...S, hands, taken: [[], [], [], []], trick: [], lead: -1, broken: false, passing: dir ? [null, null, null, null] : null, phase: dir ? "pass" : "play", turn: 0, lastTrick: null, handPts: null, tricks: 0 }; if (!dir) S2.turn = holder2c(S2); return S2; }
  const holder2c = (S) => S.hands.findIndex((h) => h.some((c) => c.r === 2 && c.s === "c"));
  const setup = (first) => deal({ seats: ["you", "bot", "kin", "bot"], names: [null, "Wren", null, "Otto"], score: [0, 0, 0, 0], hand: first === "you" ? 0 : 1, ply: 0 });
  function legal(S, p) {
    const h = S.hands[p], first = S.tricks === 0;
    if (!S.trick.length) { if (first) return h.filter((c) => c.r === 2 && c.s === "c"); const nh = h.filter((c) => c.s !== "h"); return S.broken || !nh.length ? h : nh; }
    const led = S.trick[0].c.s, f = h.filter((c) => c.s === led); if (f.length) return f;
    if (first) { const safe = h.filter((c) => !pts(c)); if (safe.length) return safe; }
    return h;
  }
  function moves(S) {
    if (over(S)) return [];
    if (S.phase === "done") return [{ next: true }];
    if (S.phase === "pass") return [{ pass: null }];
    return legal(S, S.turn).map((c) => ({ c }));
  }
  function apply(S0, m) {
    if (m.next) { const S = deal({ ...S0, hand: S0.hand + 1 }); return S; }
    const S = { ...S0, hands: S0.hands.map((h) => h.slice()), ply: S0.ply + 1 }, p = S.turn;
    if (S.phase === "pass") {
      const pick = m.pass || passPick(S.hands[p]); const passing = S.passing.slice(); passing[p] = pick; S.hands[p] = S.hands[p].filter((c) => !pick.some((x) => eq(x, c)));
      if (passing.every(Boolean)) { const dir = DIRS[S.hand % 4]; passing.forEach((cs, i) => { S.hands[(i + dir) % 4].push(...cs); }); S.hands.forEach(sortH); S.received = passing[(4 - dir) % 4]; return { ...S, passing: null, phase: "play", turn: holder2c(S), last: { passed: true } }; }
      return { ...S, passing, turn: (p + 1) % 4 };
    }
    S.hands[p] = S.hands[p].filter((c) => !eq(c, m.c)); const trick = [...S0.trick, { p, c: m.c }]; let broken = S.broken || m.c.s === "h";
    if (trick.length < 4) return { ...S, trick, broken, turn: (p + 1) % 4, last: { p, c: m.c } };
    const led = trick[0].c.s; let w = trick[0]; for (const t of trick) if (t.c.s === led && t.c.r > w.c.r) w = t;
    const taken = S.taken.map((x) => x.slice()); taken[w.p].push(...trick.map((t) => t.c));
    const T = { ...S, trick: [], broken, taken, tricks: S.tricks + 1, turn: w.p, lastTrick: { cards: trick, winner: w.p }, last: { p, c: m.c, won: w.p } };
    if (T.tricks < 13) return T;
    let hp = taken.map((cs) => cs.reduce((t, c) => t + pts(c), 0)); const moon = hp.indexOf(26); if (moon >= 0) hp = hp.map((x, i) => (i === moon ? 0 : 26));
    return { ...T, score: S.score.map((x, i) => x + hp[i]), handPts: hp, moon, phase: "done" };
  }
  function over(S) { if (S.phase !== "done" || Math.max(...S.score) < TARGET) return null; const a = S.score[0], b = S.score[2]; return { result: a < b ? "you" : b < a ? "kin" : "draw", detail: `${Math.min(a, b)} points to ${Math.max(a, b)} (lowest wins)` }; }
  function passPick(h) {
    const sc = (c) => { const n = h.filter((x) => x.s === c.s).length; let v = c.r; if (c.s === "s" && c.r >= 12) v += h.filter((x) => x.s === "s" && x.r < 12).length >= 4 ? -20 : 20; if (c.s === "h") v += 4; if (n <= 2) v += 3; return v; };
    return h.slice().sort((a, b) => sc(b) - sc(a)).slice(0, 3);
  }
  function rank(S, level) {
    const p = S.turn, ms = moves(S); if (!ms[0] || !ms[0].c) return ms.map((m) => ({ m, label: m.next ? "next hand" : `pass three cards ${DNAME[S.hand % 4]}`, score: 0 }));
    const T = S.trick, led = T.length ? T[0].c.s : null, onTable = T.reduce((t, x) => t + pts(x.c), 0), win = T.length ? T.filter((x) => x.c.s === led).reduce((a, b) => (b.c.r > a.c.r ? b : a)) : null, lastSeat = T.length === 3;
    const qOut = S.taken.flat().some((c) => c.s === "s" && c.r === 12) || T.some((x) => x.c.s === "s" && x.c.r === 12);
    return ms.map(({ c }) => {
      let sc = 0;
      if (!T.length) { sc = -c.r - (c.s === "h" ? 6 : 0) - (c.s === "s" && c.r >= 12 && !qOut ? 20 : 0); const n = S.hands[p].filter((x) => x.s === c.s).length; sc += (5 - n) * 0.6; }
      else if (c.s === led) { const beats = c.r > win.c.r; if (beats) sc = lastSeat && !onTable && !(c.s === "s" && c.r === 12) ? c.r * 0.5 : -20 - onTable * 3 - c.r; else sc = c.r; if (c.s === "s" && c.r === 12 && !beats) sc += 30; }
      else { sc = pts(c) * 4 + c.r * 0.5 + (c.s === "s" && c.r > 12 && !qOut ? 8 : 0); }
      if (level === "beginner") sc *= 0.3;
      return { m: { c }, label: `play the ${nm(c)}`, score: sc + Math.random() * 0.3 };
    }).sort((a, b) => b.score - a.score);
  }
  const autoMove = (S) => { if (over(S)) return null; if (S.phase === "done") return { next: true }; if (S.phase === "pass" && S.seats[S.turn] !== "you") return { pass: passPick(S.hands[S.turn]) }; return null; };
  const E = { TARGET, setup, moves, apply, over, rank, autoMove, legal, passPick, pts, nm };
  if (typeof module === "object" && module.exports) { module.exports = E; return; }
  const K = root.Kit, SEATCLS = ["s", "w", "n", "e"];
  root.KG.add({
    id: "hearts", title: "Hearts", icon: "♥",
    rules: "Four players, thirteen cards each: you (south), your opponent (north) and two computer players. Before each hand pass three cards (left, right, across, then keep). The 2♣ leads the first trick. Follow suit if you can; otherwise play anything (no points on the very first trick). Highest card of the suit led takes the trick. Each heart taken costs 1 point and the Q♠ 13. Hearts can't be led until one has been played. Take every heart and the queen and you shoot the moon: everyone else gets 26. When anyone reaches 50, whichever of you and your opponent has fewer points wins.",
    achievements: [
      { id: "moon", icon: "🌙", name: "Shoot the Moon", about: "Take all 26 points in one hand." },
      { id: "clean", icon: "🧼", name: "Clean Hands", about: "Take no points in a hand." },
      { id: "dump", icon: "🗑", name: "Special Delivery", about: "Slip the Q♠ to your opponent." },
    ],
    mount(api) {
      return K.turnGame(api, {
        ...E, autoForYou: true, autoDelay: 2400, botMs: 420, thinkMs: 480,
        mount(el, H) { const v = { bar: K.el("div"), table: K.el("div", "tricktable"), info: K.el("div", "hint big"), hand: K.el("div", "hand fan"), ctl: K.el("div", "ctrl"), pick: [] }; el.append(v.bar, v.table, v.info, v.hand, v.ctl); return v; },
        draw(v, S, H) {
          v.bar.replaceChildren(K.players(H, (i) => `${S.score[i]} pts${S.phase !== "done" ? ` · ${S.taken[i].reduce((t, c) => t + pts(c), 0)} this hand` : ""}`));
          const mine = H.mine(), show = S.trick.length ? S.trick : v.hold ? v.hold.cards : [];
          v.table.replaceChildren(...[1, 2, 3].map((i) => { const s = K.el("div", "tseat " + SEATCLS[i] + (S.turn === i ? " on" : "")); s.append(K.el("b", "", H.nameOf(i))); const f = K.el("div", "hand fan mini"); S.hands[i].forEach(() => f.append(K.card(null, { back: true, hue: 350 }))); s.append(f); return s; }));
          const pile = K.el("div", "trick"); show.forEach((t) => { const c = K.card(t.c, { k: "t" + t.c.r + t.c.s }); c.classList.add("tp" + SEATCLS[t.p]); if (v.hold && v.hold.winner === t.p && !S.trick.length) c.classList.add("win"); pile.append(c); }); v.table.append(pile);
          const passing = mine && S.phase === "pass", L = mine && S.phase === "play" ? legal(S, 0) : [];
          v.info.textContent = S.phase === "done" ? `Hand over: ${S.handPts.map((x, i) => `${H.nameOf(i)} +${x}`).join(" · ")}${S.moon >= 0 && S.moon != null ? ` — ${H.nameOf(S.moon)} shot the moon!` : ""}` : S.phase === "pass" ? `Pass three cards ${DNAME[S.hand % 4]}.` : S.received && S.tricks === 0 && !S.trick.length ? `You received ${S.received.map(nm).join(" ")}.` : "";
          K.flip(v.hand, () => v.hand.replaceChildren(...S.hands[0].map((c) => { const ok = passing || L.some((x) => eq(x, c)), sel = v.pick.some((x) => eq(x, c)); return K.card(c, { k: "h" + c.r + c.s, cls: (ok ? "ok" : mine ? "dim" : "") + (sel ? " sel" : ""), onClick: () => { if (!ok) return; if (passing) { v.pick = sel ? v.pick.filter((x) => !eq(x, c)) : [...v.pick, c].slice(-3); K.sfx.click(); H.redraw(); } else H.play({ c }); } }); })), { lift: true });
          v.ctl.replaceChildren(); if (passing) { const b = K.btn("btn", `Pass ${DNAME[S.hand % 4]}`, () => { const pk = v.pick; v.pick = []; H.play({ pass: pk }); }); b.disabled = v.pick.length !== 3; v.ctl.append(b); } else v.pick = [];
        },
        animate: async (v, S0, m, S1) => { if (m.c) { K.sfx.flip(); if (S1.lastTrick && S1.tricks !== S0.tricks) { v.hold = S1.lastTrick; v.hold.cards = S1.lastTrick.cards; } } else if (m.next) { v.hold = null; K.sfx.shuffle(); } else if (m.pass) K.sfx.deal(); },
        feats(S0, m, S1, who) {
          if (m.c && S1.tricks !== S0.tricks) { const t = S1.lastTrick, q = t.cards.find((x) => x.c.s === "s" && x.c.r === 12); if (q && ((q.p === 0 && t.winner === 2) || (q.p === 2 && t.winner === 0))) api.achieve("dump", S1.seats[q.p]); }
          if (S1.phase === "done" && S0.phase !== "done") { [0, 2].forEach((i) => { if (S1.moon === i) api.achieve("moon", S1.seats[i]); else if (S1.handPts[i] === 0 && S1.moon < 0) api.achieve("clean", S1.seats[i]); }); }
          void who;
        },
        situation: (S) => `Your hand: ${S.hands[S.turn].map(nm).join(" ")}. On the table: ${S.trick.map((t) => nm(t.c)).join(" ") || "nothing (you lead)"}. Hearts ${S.broken ? "are" : "aren't"} broken.`,
        yourTurn: (S) => (S.phase === "pass" ? "Pick three cards to pass." : S.trick.length ? "Follow suit if you can." : "Your lead."),
      });
    },
  });
})(typeof self !== "undefined" ? self : this);
