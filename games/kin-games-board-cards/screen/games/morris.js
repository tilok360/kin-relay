// Nine Men's Morris: place nine men each, then move along the lines; three in a line (a mill) takes an enemy man.
(function (root) {
  "use strict";
  const XY = [[0,0],[3,0],[6,0],[1,1],[3,1],[5,1],[2,2],[3,2],[4,2],[0,3],[1,3],[2,3],[4,3],[5,3],[6,3],[2,4],[3,4],[4,4],[1,5],[3,5],[5,5],[0,6],[3,6],[6,6]];
  const MILLS = [[0,1,2],[3,4,5],[6,7,8],[9,10,11],[12,13,14],[15,16,17],[18,19,20],[21,22,23],[0,9,21],[3,10,18],[6,11,15],[1,4,7],[16,19,22],[8,12,17],[5,13,20],[2,14,23]];
  const ADJ = XY.map(() => []);
  for (const m of MILLS) for (let k = 0; k < 2; k++) { ADJ[m[k]].push(m[k + 1]); ADJ[m[k + 1]].push(m[k]); }
  const NAME = (i) => "abcdefg"[XY[i][0]] + (7 - XY[i][1]);
  const other = (p) => (p === "you" ? "kin" : "you");
  const setup = (first) => ({ seats: first === "you" ? ["you", "kin"] : ["kin", "you"], turn: 0, b: Array(24).fill(""), hand: { you: 9, kin: 9 }, ply: 0, last: null, quiet: 0 });
  const who = (S) => S.seats[S.turn];
  const inMill = (b, i) => MILLS.some((m) => m.includes(i) && m.every((j) => b[j] === b[i]));
  const count = (b, p) => b.filter((x) => x === p).length;
  function removable(b, foe) { const all = []; b.forEach((x, i) => x === foe && all.push(i)); const free = all.filter((i) => !inMill(b, i)); return free.length ? free : all; }
  function moves(S) {
    if (over(S)) return [];
    const me = who(S), foe = other(me), b = S.b, out = [], base = [];
    if (S.hand[me] > 0) b.forEach((x, i) => !x && base.push({ t: "p", to: i }));
    else { const fly = count(b, me) === 3; b.forEach((x, f) => { if (x !== me) return; (fly ? [...b.keys()] : ADJ[f]).forEach((to) => !b[to] && base.push({ t: "m", f, to })); }); }
    for (const m of base) {
      const nb = b.slice(); if (m.t === "m") nb[m.f] = ""; nb[m.to] = me;
      if (inMill(nb, m.to)) for (const r of removable(nb, foe)) out.push({ ...m, rm: r }); else out.push(m);
    }
    return out;
  }
  function apply(S, m) {
    const me = who(S), b = S.b.slice(), hand = { ...S.hand };
    if (m.t === "p") hand[me]--; else b[m.f] = "";
    b[m.to] = me; if (m.rm != null) b[m.rm] = "";
    return { ...S, b, hand, turn: 1 - S.turn, ply: S.ply + 1, last: m, quiet: m.rm != null ? 0 : S.quiet + 1 };
  }
  function over(S) {
    const me = who(S), foe = other(me);
    for (const p of [me, foe]) if (count(S.b, p) + S.hand[p] < 3) return { result: other(p), detail: "down to two men" };
    if (S.quiet >= 60 || S.ply >= 300) return { result: "draw", detail: "no mill in sixty moves" };
    if (!S.hand[me]) { const fly = count(S.b, me) === 3; if (!fly && !S.b.some((x, f) => x === me && ADJ[f].some((t) => !S.b[t]))) return { result: foe, detail: "blocked in" }; }
    return null;
  }
  function evalFor(S, me) {
    const foe = other(me); let s = (count(S.b, me) + S.hand[me] - count(S.b, foe) - S.hand[foe]) * 12;
    for (const m of MILLS) { const a = m.filter((i) => S.b[i] === me).length, f = m.filter((i) => S.b[i] === foe).length; if (a === 2 && !f) s += 2; if (f === 2 && !a) s -= 2.4; if (a === 3) s += 1; }
    const mob = (p) => S.b.reduce((t, x, i) => t + (x === p ? ADJ[i].filter((j) => !S.b[j]).length : 0), 0);
    return s + (mob(me) - mob(foe)) * 0.4;
  }
  function search(S, d, a, beta) {
    const o = over(S); if (o) return o.result === "draw" ? 0 : o.result === who(S) ? 999 : -999 - d;
    if (!d) return evalFor(S, who(S));
    let best = -1e9;
    for (const m of moves(S)) { const v = -search(apply(S, m), d - 1, -beta, -a); if (v > best) best = v; if (v > a) a = v; if (a >= beta) break; }
    return best;
  }
  const DEPTH = { beginner: 1, easy: 1, normal: 2, hard: 3 };
  const label = (m) => (m.t === "p" ? `place on ${NAME(m.to)}` : `move ${NAME(m.f)} to ${NAME(m.to)}`) + (m.rm != null ? `, making a mill and taking ${NAME(m.rm)}` : "");
  function rank(S, level) {
    const d = DEPTH[level] || 2;
    return moves(S).map((m) => ({ m, label: label(m), score: -search(apply(S, m), d - 1, -1e9, 1e9) + Math.random() * 0.1 })).sort((x, y) => y.score - x.score);
  }
  const E = { XY, MILLS, ADJ, setup, moves, apply, rank, over, inMill, count };
  if (typeof module === "object" && module.exports) { module.exports = E; return; }
  const K = root.Kit, COL = { you: "#f1e6d0", kin: "#2a2630" };
  root.KG.add({
    id: "morris", title: "Nine Men's Morris", icon: "⚪",
    rules: "Each side has nine men. First take turns placing them on empty points. Once all are placed, move a man along a line to a next-door empty point. Three of yours in a straight line is a mill: when you make one, take any enemy man that isn't in a mill (unless they all are). Down to three men, you may fly to any empty point. Leave your opponent with two men, or with no move, to win.",
    achievements: [
      { id: "double", icon: "⚙", name: "Windmill", about: "Make a mill by moving a man out of one mill and back again." },
      { id: "flawless", icon: "🛡", name: "Unbroken", about: "Win having lost two men or fewer." },
      { id: "flyer", icon: "🕊", name: "On the Wing", about: "Win while flying with three men." },
    ],
    mount(api) {
      return K.turnGame(api, {
        ...E,
        mount(el, H) {
          const v = { bar: K.el("div"), hand: K.el("div", "side"), box: K.el("div", "morris wood"), sel: null, pend: null }; el.append(v.bar, v.box, v.hand);
          K.onPick(v.box, (i) => {
            if (!H.mine()) return;
            const L = H.legal(), me = "you";
            if (v.pend) { const m = L.find((x) => x.t === v.pend.t && x.to === v.pend.to && x.f === v.pend.f && x.rm === i); if (m) { v.pend = null; H.play(m); } return; }
            const pick = (base) => { const opts = L.filter((x) => x.t === base.t && x.to === base.to && x.f === base.f); if (!opts.length) return false; if (opts[0].rm == null) H.play(opts[0]); else { v.pend = base; v.sel = null; K.sfx.ding(); H.redraw(); } return true; };
            if (H.S.hand.you > 0) { pick({ t: "p", to: i }); return; }
            if (H.S.b[i] === me) { v.sel = v.sel === i ? null : i; K.sfx.click(); H.redraw(); return; }
            if (v.sel != null && pick({ t: "m", f: v.sel, to: i })) v.sel = null;
          });
          return v;
        },
        draw(v, S, H) {
          v.bar.replaceChildren(K.players(H, (i) => { const p = S.seats[i]; return `${count(S.b, p)} on board · ${S.hand[p]} to place`; }));
          const mine = H.mine(), L = mine ? H.legal() : [], hot = new Set(), sc = 40, P = (i) => [30 + XY[i][0] * sc, 30 + XY[i][1] * sc];
          if (mine) {
            if (v.pend) L.filter((x) => x.to === v.pend.to && x.f === v.pend.f && x.rm != null).forEach((x) => hot.add(x.rm));
            else if (S.hand.you > 0) L.forEach((x) => hot.add(x.to));
            else if (v.sel != null) L.filter((x) => x.f === v.sel).forEach((x) => hot.add(x.to));
            if (!v.pend && !S.hand.you) S.b.forEach((x, i) => x === "you" && L.some((m) => m.f === i) && hot.add(i));
          }
          let s = `<svg class="svgboard" viewBox="0 0 300 300"><g stroke="#2b1808" stroke-width="3.2" fill="none" stroke-linecap="round"><rect x="30" y="30" width="240" height="240"/><rect x="70" y="70" width="160" height="160"/><rect x="110" y="110" width="80" height="80"/><path d="M150 30V110M150 190V270M30 150H110M190 150H270"/></g>`;
          const lm = S.last;
          XY.forEach((_, i) => {
            const [x, y] = P(i), p = S.b[i];
            s += `<circle cx="${x}" cy="${y}" r="5" fill="#2b1808"/>`;
            if (lm && (lm.f === i || lm.rm === i) && !p) s += `<circle cx="${x}" cy="${y}" r="9" fill="none" stroke="#ffd76a" stroke-dasharray="3 3"/>`;
            if (p) s += K.place(K.token(COL[p], "checker"), x - 15, y - 15, 30, lm && lm.to === i ? "appear" : "");
            if (v.sel === i) s += `<circle cx="${x}" cy="${y}" r="17" fill="none" stroke="#5ee6d0" stroke-width="3"/>`;
            if (hot.has(i)) s += `<circle class="hot" data-i="${i}" cx="${x}" cy="${y}" r="17" fill="${p ? "transparent" : "#ffd76a55"}" stroke="${v.pend ? "#ff6b57" : "#ffd76a"}" stroke-width="2"/>`;
          });
          v.box.innerHTML = s + "</svg>";
          v.hand.replaceChildren(...["you", "kin"].map((p) => { const d = K.el("div", "handrow"); for (let k = 0; k < S.hand[p]; k++) { const t = K.el("span", "mini"); t.innerHTML = K.token(COL[p], "checker"); d.append(t); } return d; }));
        },
        yourTurn: (S) => (S.hand.you > 0 ? "Place a man on any empty point." : "Tap one of your men, then where it goes."),
        animate: async (v, S0, m) => { if (m.rm != null) { K.sfx.ding(); await K.wait(120); K.sfx.pop(); } else K.sfx.clack(); },
        feats(S0, m, S1, who) {
          if (m.t === "m" && m.rm != null && S0.prevMill && S0.prevMill[who] === m.to) api.achieve("double", who);
          S1.prevMill = { ...(S0.prevMill || {}) }; if (m.t === "m" && inMill(S0.b, m.f)) S1.prevMill[who] = m.f; else delete S1.prevMill[who];
          const o = over(S1); if (o && o.result !== "draw") { const w = o.result; if (count(S1.b, w) + S1.hand[w] >= 7) api.achieve("flawless", w); if (!S1.hand[w] && count(S1.b, w) === 3) api.achieve("flyer", w); }
        },
        situation: (S) => `You are ${S.seats[S.turn] === "kin" ? "black" : "white"}. Your men: ${S.b.map((x, i) => (x === S.seats[S.turn] ? NAME(i) : "")).filter(Boolean).join(" ") || "none"}; theirs: ${S.b.map((x, i) => (x && x !== S.seats[S.turn] ? NAME(i) : "")).filter(Boolean).join(" ") || "none"}.`,
      });
    },
  });
})(typeof self !== "undefined" ? self : this);
