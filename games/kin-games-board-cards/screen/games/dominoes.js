// Dominoes, the draw game with a double-six set: match an open end, draw from the boneyard when you can't.
// Empty your hand (or have the lighter hand when it blocks) to score the other hand's pips. First to 50 wins.
(function (root) {
  "use strict";
  const TARGET = 50;
  const SET = []; for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) SET.push([a, b]);
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pips = (h) => h.reduce((t, d) => t + d[0] + d[1], 0);
  function deal(S, starter) { const bone = shuffle(SET.map((d) => d.slice())); return { ...S, hands: [bone.splice(0, 7), bone.splice(0, 7)], bone, chain: [], turn: starter, passes: 0, round: null, last: null, cant: [[], []] }; }
  function setup(first) { return deal({ seats: first === "you" ? ["you", "kin"] : ["kin", "you"], score: [0, 0], ply: 0, rounds: 0 }, 0); }
  const ends = (S) => (S.chain.length ? [S.chain[0][0], S.chain[S.chain.length - 1][1]] : null);
  function plays(S, p) {
    const h = S.hands[p], e = ends(S), out = [];
    h.forEach((d, k) => { if (!e) { out.push({ k, end: "R" }); return; } if (d[0] === e[0] || d[1] === e[0]) out.push({ k, end: "L" }); if ((d[0] === e[1] || d[1] === e[1]) && !(e[0] === e[1] && out.some((x) => x.k === k))) out.push({ k, end: "R" }); });
    return out;
  }
  function moves(S) {
    if (over(S)) return [];
    if (S.round) return [{ next: true }];
    const pl = plays(S, S.turn); if (pl.length) return pl;
    return S.bone.length ? [{ draw: true }] : [{ pass: true }];
  }
  function apply(S, m) {
    if (m.next) return deal({ ...S, rounds: S.rounds + 1 }, S.round.winner >= 0 ? S.round.winner : 1 - S.turn);
    const p = S.turn, hands = S.hands.map((h) => h.slice()), cant = S.cant.map((c) => c.slice());
    let T = { ...S, hands, cant, ply: S.ply + 1 };
    if (m.draw) { const bone = S.bone.slice(); hands[p].push(bone.pop()); const e = ends(S); if (e) for (const x of e) if (!cant[p].includes(x)) cant[p].push(x); return { ...T, bone, last: { p, draw: true } }; }
    if (m.pass) { T = { ...T, passes: S.passes + 1, turn: 1 - p, last: { p, pass: true } }; if (T.passes >= 2) return endRound(T, -1); return T; }
    const d = hands[p].splice(m.k, 1)[0], chain = S.chain.slice(), e = ends(S);
    if (!e) chain.push(d.slice()); else if (m.end === "L") chain.unshift(d[1] === e[0] ? [d[0], d[1]] : [d[1], d[0]]); else chain.push(d[0] === e[1] ? [d[0], d[1]] : [d[1], d[0]]);
    cant[p] = [];
    T = { ...T, chain, passes: 0, turn: 1 - p, last: { p, d, end: m.end } };
    if (!hands[p].length) return endRound(T, p);
    return T;
  }
  function endRound(T, w) {
    const a = pips(T.hands[0]), b = pips(T.hands[1]); let winner = w, pts = 0;
    if (w < 0) { winner = a < b ? 0 : b < a ? 1 : -1; pts = winner < 0 ? 0 : Math.abs(a - b); } else pts = pips(T.hands[1 - w]);
    const score = T.score.slice(); if (winner >= 0) score[winner] += pts;
    return { ...T, score, round: { winner, pts, blocked: w < 0 } };
  }
  function over(S) {
    if (!S.round) return null;
    const [a, b] = S.score; if (a < TARGET && b < TARGET) return null;
    return { result: S.seats[a > b ? 0 : 1], detail: `${Math.max(a, b)} to ${Math.min(a, b)}` };
  }
  const autoMove = (S) => { const m = moves(S); return m.length === 1 && (m[0].draw || m[0].pass || m[0].next) ? m[0] : null; };
  function rank(S) {
    const p = S.turn, h = S.hands[p], foeCant = S.cant[1 - p];
    return moves(S).map((m) => {
      if (!("k" in m)) return { m, label: m.draw ? "draw a tile" : m.pass ? "pass" : "next round", score: 0 };
      const d = h[m.k], e = ends(S), rest = h.filter((_, k) => k !== m.k);
      let ne; if (!e) ne = [d[0], d[1]]; else if (m.end === "L") ne = [d[1] === e[0] ? d[0] : d[1], e[1]]; else ne = [e[0], d[0] === e[1] ? d[1] : d[0]];
      let sc = d[0] + d[1] + (d[0] === d[1] ? 4 : 0) + rest.filter((x) => ne.some((v) => x.includes(v))).length * 1.5 + ne.filter((v) => foeCant.includes(v)).length * 5;
      if (!rest.length) sc += 100;
      return { m, label: `play ${d[0]}|${d[1]} on the ${m.end === "L" ? "left" : "right"}${e ? ` (open ends become ${ne[0]} and ${ne[1]})` : ""}`, score: sc + Math.random() * 0.3 };
    }).sort((x, y) => y.score - x.score);
  }
  const E = { SET, setup, moves, apply, rank, over, plays, ends, pips, autoMove, TARGET };
  if (typeof module === "object" && module.exports) { module.exports = E; return; }
  const K = root.Kit;
  const tileEl = (d, opts) => { const o = opts || {}, dbl = d[0] === d[1] && o.chain, e = K.el(o.onClick ? "button" : "span", "domino" + (dbl ? " dbl" : "") + (o.cls ? " " + o.cls : "")); if (o.onClick) { e.type = "button"; e.onclick = o.onClick; e.setAttribute("aria-label", `domino ${d[0]} and ${d[1]}`); } e.innerHTML = o.back ? `<svg viewBox="0 0 50 100"><rect x="1" y="1" width="48" height="98" rx="7" fill="#1f3b5c" stroke="#0b1a2b"/><circle cx="25" cy="50" r="8" fill="none" stroke="#e8c871" stroke-width="2"/></svg>` : K.dominoSVG(d[0], d[1], o.vertical != null ? o.vertical : dbl); if (o.k) e.dataset.k = o.k; return e; };
  root.KG.add({
    id: "dominoes", title: "Dominoes", icon: "🁫",
    rules: "Double-six set, seven tiles each. On your turn lay a tile whose end matches one of the two open ends of the line. Can't match? Draw from the boneyard until you can; if it's empty, pass. Empty your hand to win the round and score the pips left in the other hand. If nobody can play, the lighter hand scores the difference. First to 50 points wins.",
    achievements: [
      { id: "domino", icon: "🁢", name: "Domino!", about: "Go out with a double." },
      { id: "big", icon: "💰", name: "Heavy Haul", about: "Score 25 or more in one round." },
      { id: "nodraw", icon: "✋", name: "Never Drew", about: "Win a round without drawing a tile." },
    ],
    mount(api) {
      const v_drew = { you: false, kin: false };
      return K.turnGame(api, {
        ...E, autoForYou: true, autoDelay: 500, botMs: 450,
        mount(el, H) {
          const v = { bar: K.el("div"), opp: K.el("div", "dhand opp"), line: K.el("div", "dline"), info: K.el("div", "hint"), hand: K.el("div", "dhand"), sel: null }; el.append(v.bar, v.opp, v.line, v.info, v.hand);
          return v;
        },
        draw(v, S, H) {
          if (S.ply === 0 && !S.round) v.drew = false;
          v.bar.replaceChildren(K.players(H, (i) => `${S.score[i]} pts`));
          const you = S.seats.indexOf("you"), foe = 1 - you, mine = H.mine(), pl = mine ? plays(S, you) : [];
          v.opp.replaceChildren(...S.hands[foe].map((d, k) => tileEl(d, { back: !S.round, vertical: true, k: "o" + k })));
          K.flip(v.line, () => {
            v.line.replaceChildren();
            if (mine && v.sel != null && pl.filter((x) => x.k === v.sel).length > 1) v.line.append(K.btn("endbtn", "◀ here", () => { const k = v.sel; v.sel = null; H.play(pl.find((x) => x.k === k && x.end === "L")); }));
            S.chain.forEach((d) => v.line.append(tileEl(d, { chain: true, k: "c" + Math.min(d[0], d[1]) + Math.max(d[0], d[1]) })));
            if (mine && v.sel != null && pl.filter((x) => x.k === v.sel).length > 1) v.line.append(K.btn("endbtn", "here ▶", () => { const k = v.sel; v.sel = null; H.play(pl.find((x) => x.k === k && x.end === "R")); }));
          });
          v.hand.replaceChildren(...S.hands[you].map((d, k) => { const ok = pl.some((x) => x.k === k); return tileEl(d, { vertical: true, cls: (ok ? "ok" : "no") + (v.sel === k ? " sel" : ""), k: "h" + d[0] + d[1], onClick: () => { if (!ok) { K.shake(v.hand.children[k]); return; } const opts = pl.filter((x) => x.k === k); if (opts.length === 1) { v.sel = null; H.play(opts[0]); } else { v.sel = k; K.sfx.click(); H.redraw(); } } }); }));
          const r = S.round;
          v.info.textContent = r ? (r.winner < 0 ? "Blocked, and the hands tie: no score." : `${H.nameOf(r.winner)} ${r.winner === you ? "win" : "wins"} the round${r.blocked ? " (blocked)" : ""}: +${r.pts}. Next round…`) : `Boneyard: ${S.bone.length}` + (S.last && S.last.draw ? ` · ${H.nameOf(S.last.p)} drew` : S.last && S.last.pass ? ` · ${H.nameOf(S.last.p)} passed` : "");
        },
        animate: async (v, S0, m) => { if (m.draw) K.sfx.slide(); else if (m.next) K.sfx.shuffle(); else if (!m.pass) K.sfx.clack(); },
        feats(S0, m, S1, who) {
          const p = S0.turn; if (m.draw && S0.seats[p] === "you") v_drew.you = true; if (m.draw && S0.seats[p] === "kin") v_drew.kin = true;
          if (m.next) { v_drew.you = v_drew.kin = false; return; }
          const r = S1.round; if (!r || S0.round || r.winner < 0) return; const w = S1.seats[r.winner];
          if (r.pts >= 25) api.achieve("big", w); if (!r.blocked && S1.last.d && S1.last.d[0] === S1.last.d[1]) api.achieve("domino", w); if (!v_drew[w]) api.achieve("nodraw", w);
        },
        situation: (S) => { const e = ends(S); return `Open ends: ${e ? e.join(" and ") : "none yet"}. Your hand: ${S.hands[S.turn].map((d) => d.join("|")).join(", ")}. Score: you ${S.score[S.turn]}, them ${S.score[1 - S.turn]} (to ${TARGET}).`; },
        yourTurn: () => "Your turn: tap a glowing tile.",
      });
    },
  });
})(typeof self !== "undefined" ? self : this);
