// Slide & Bump: a card-driven race round a 60-square track with slides. Four colours, three pawns each.
// Progress per pawn: null = at start, -2..57 on the track (from its exit square), 58..62 safety lane, 63 = home.
(function (root) {
  "use strict";
  const T = 60, HOME = 63, SAFE0 = 58;
  const EXIT = (c) => 15 * c + 4;
  const absOf = (c, p) => (p == null || p >= SAFE0 ? -1 : (EXIT(c) + p + T) % T);
  const progOf = (c, a) => { let p = (a - EXIT(c) + T) % T; if (p >= SAFE0) p -= T; return p; };
  // Slides belong to the colour of their side: short (4 squares) and long (5).
  const SLIDES = []; for (let c = 0; c < 4; c++) { SLIDES.push({ c, from: 15 * c + 1, to: 15 * c + 4 }); SLIDES.push({ c, from: 15 * c + 9, to: 15 * c + 13 }); }
  const DECK = []; for (const [v, n] of [[1, 5], [2, 4], [3, 4], [4, 4], [5, 4], [7, 4], [8, 4], [10, 4], [11, 4], [12, 4], ["S", 4]]) for (let k = 0; k < n; k++) DECK.push(v);
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const CARDTXT = { 1: "Start a pawn, or move 1.", 2: "Start a pawn, or move 2 — then draw again.", 3: "Move 3.", 4: "Move 4 backwards.", 5: "Move 5.", 7: "Move 7, or split it between two pawns.", 8: "Move 8.", 10: "Move 10, or 1 backwards.", 11: "Move 11, or swap places with an enemy pawn.", 12: "Move 12.", S: "Bump! Take a pawn from start onto any enemy pawn and send it back." };
  function setup(first, names) {
    return { seats: ["you", "bot", "kin", "bot"], names: names || [null, "Blue", null, "Green"], turn: first === "you" ? 0 : 2, pawns: [0, 1, 2, 3].map(() => [null, null, null]), deck: shuffle(DECK.slice()), card: null, ply: 0, last: null, done: [] };
  }
  const occupant = (S, a) => { for (let c = 0; c < 4; c++) for (let k = 0; k < 3; k++) if (absOf(c, S.pawns[c][k]) === a) return [c, k]; return null; };
  function fwd(S, c, p, n) { if (p == null) return null; if (p < 0 && p + n >= 0) return p + n; const q = p + n; return q > HOME ? null : q; }
  function back(c, p, n) { if (p == null || p === HOME) return null; let q = p - n; if (p >= SAFE0 && q < SAFE0) return q; if (q < -2) q += T; return q; }
  function landOk(S, c, k, q) { if (q == null) return false; if (q === HOME) return true; if (q >= SAFE0) return !S.pawns[c].some((x, j) => j !== k && x === q); const o = occupant(S, absOf(c, q)); return !o || o[0] !== c || o[1] === k; }
  function simple(S, c, card) {
    const out = [], P = S.pawns[c];
    P.forEach((p, k) => {
      if ((card === 1 || card === 2) && p == null) { if (landOk(S, c, k, 0) && !out.some((m) => m.start)) out.push({ k, to: 0, start: true }); return; }
      if (p == null || p === HOME) return;
      const steps = card === 4 ? [-4] : card === 10 ? [10, -1] : card === "S" ? [] : card === 7 ? [7] : card === 11 ? [11] : [card];
      for (const s of steps) { const q = s > 0 ? fwd(S, c, p, s) : back(c, p, -s); if (landOk(S, c, k, q)) out.push({ k, to: q }); }
      if (card === 11 && p >= 0 && p < SAFE0) for (let o = 0; o < 4; o++) if (o !== c) S.pawns[o].forEach((x, j) => { if (x != null && x < SAFE0) out.push({ k, swap: [o, j] }); });
    });
    if (card === "S") { const k = P.indexOf(null); if (k >= 0) for (let o = 0; o < 4; o++) if (o !== c) S.pawns[o].forEach((x, j) => { if (x != null && x < SAFE0) out.push({ k, bump: [o, j] }); }); }
    if (card === 7) for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) { if (a === b || P[a] == null || P[b] == null || P[a] === HOME || P[b] === HOME) continue; for (let n = 1; n <= 6; n++) { if (a > b && false) continue; const qa = fwd(S, c, P[a], n), qb = fwd(S, c, P[b], 7 - n); if (qa == null || qb == null) continue; if (a < b || true) { const T2 = { ...S, pawns: S.pawns.map((x) => x.slice()) }; T2.pawns[c][a] = qa; if (landOk(S, c, a, qa) && landOk(T2, c, b, qb) && !(qa === qb && qa !== HOME)) { if (!out.some((m) => m.split && ((m.split[0] === a && m.split[1] === n && m.split[2] === b) || (m.split[0] === b && m.split[1] === 7 - n && m.split[2] === a)))) out.push({ k: a, to: qa, split: [a, n, b, 7 - n], k2: b, to2: qb }); } } } }
    return out;
  }
  function moves(S) { if (over(S)) return []; if (S.card == null) return [{ draw: true }]; const m = simple(S, S.turn, S.card); return m.length ? m : [{ pass: true }]; }
  function bumpAt(S, a, except) { const o = occupant(S, a); if (o && !(o[0] === except[0] && o[1] === except[1])) { S.pawns[o[0]][o[1]] = null; return o; } return null; }
  function place(S, c, k, q, hits) {
    S.pawns[c][k] = q; if (q == null || q >= SAFE0) return;
    let a = absOf(c, q); const h = bumpAt(S, a, [c, k]); if (h) hits.push(h);
    const sl = SLIDES.find((x) => x.from === a && x.c !== c);
    if (sl) { for (let s = sl.from + 1; s <= sl.to; s++) { const h2 = bumpAt(S, s % T, [c, k]); if (h2) hits.push(h2); } S.pawns[c][k] = progOf(c, sl.to); hits.slide = true; }
  }
  function nextTurn(S) { let t = S.turn; for (let k = 0; k < 4; k++) { t = (t + 1) % 4; if (!S.pawns[t].every((p) => p === HOME)) break; } return t; }
  function apply(S0, m) {
    const S = { ...S0, pawns: S0.pawns.map((x) => x.slice()), done: S0.done.slice(), ply: S0.ply + 1 };
    if (m.draw) { let deck = S0.deck.slice(); if (!deck.length) deck = shuffle(DECK.slice()); const card = m.card || deck.pop(); if (m.card) deck.splice(deck.lastIndexOf(m.card), 1); return { ...S, deck, card, last: { c: S0.turn, drew: card } }; }
    const c = S0.turn, hits = []; let info = { c, card: S0.card };
    if (m.pass) info.pass = true;
    else if (m.bump) { const [o, j] = m.bump, a = absOf(o, S.pawns[o][j]); S.pawns[o][j] = null; hits.push([o, j]); place(S, c, m.k, progOf(c, a), hits); }
    else if (m.swap) { const [o, j] = m.swap, a1 = absOf(c, S.pawns[c][m.k]), a2 = absOf(o, S.pawns[o][j]); S.pawns[o][j] = progOf(o, a1); place(S, c, m.k, progOf(c, a2), hits); }
    else { place(S, c, m.k, m.to, hits); if (m.split) place(S, c, m.k2, fwd(S0, c, S0.pawns[c][m.k2], m.split[3]), hits); }
    info = { ...info, k: m.k, hits, slide: !!hits.slide, m };
    if (S.pawns[c].every((p) => p === HOME) && !S.done.includes(c)) S.done.push(c);
    const again = S0.card === 2 && !over(S);
    return { ...S, card: null, last: info, turn: again ? c : nextTurn(S) };
  }
  function over(S) { const w = S.done.find((c) => c === 0 || c === 2); return w == null ? null : { result: S.seats[w], detail: `${w === 0 ? "you" : "they"} got all three pawns home` }; }
  const progress = (p) => (p == null ? -6 : p);
  function rank(S, level) {
    const ms = moves(S); if (ms[0].draw || ms[0].pass) return ms.map((m) => ({ m, label: m.draw ? "draw a card" : "no move: pass", score: 0 }));
    const c = S.turn;
    return ms.map((m) => {
      const T2 = apply(S, m); let sc = 0;
      for (let k = 0; k < 3; k++) sc += progress(T2.pawns[c][k]) - progress(S.pawns[c][k]) + (T2.pawns[c][k] === HOME && S.pawns[c][k] !== HOME ? 12 : 0) + (T2.pawns[c][k] >= SAFE0 && !(S.pawns[c][k] >= SAFE0) ? 6 : 0);
      for (let o = 0; o < 4; o++) if (o !== c) for (let k = 0; k < 3; k++) if (S.pawns[o][k] != null && T2.pawns[o][k] == null) sc += 8 + progress(S.pawns[o][k]) * 0.5 + (o === 0 || o === 2 ? 5 : 0);
      for (let k = 0; k < 3; k++) if (S.pawns[c][k] != null && T2.pawns[c][k] == null) sc -= 10 + progress(S.pawns[c][k]);
      if (level !== "beginner") for (let k = 0; k < 3; k++) { const p = T2.pawns[c][k]; if (p == null || p >= SAFE0) continue; const a = absOf(c, p); for (let o = 0; o < 4; o++) if (o !== c) T2.pawns[o].forEach((x) => { if (x != null && x < SAFE0) { const d = (a - absOf(o, x) + T) % T; if (d >= 1 && d <= 12) sc -= 0.5 + p * 0.03; } }); }
      const L = m.start ? "start a pawn" : m.bump ? `bump an enemy pawn with a pawn from start` : m.swap ? `swap pawn ${m.k + 1} with an enemy pawn` : m.split ? `split 7: pawn ${m.split[0] + 1} moves ${m.split[1]}, pawn ${m.split[2] + 1} moves ${m.split[3]}` : `move pawn ${m.k + 1} ${m.to < S.pawns[c][m.k] ? "back" : "forward"}`;
      return { m, label: L, score: sc + Math.random() * 0.4 };
    }).sort((x, y) => y.score - x.score);
  }
  const autoMove = (S) => { const ms = moves(S); if (!ms.length) return null; if (ms[0].pass) return ms[0]; if (ms[0].draw && S.seats[S.turn] !== "you") return ms[0]; return null; };
  const E = { T, HOME, SAFE0, SLIDES, EXIT, DECK, CARDTXT, absOf, progOf, setup, moves, apply, over, rank, autoMove };
  if (typeof module === "object" && module.exports) { module.exports = E; return; }
  const K = root.Kit, COL = ["#e5483b", "#2f7fe0", "#f2c23d", "#2fae5a"], NAMES = [null, "Blue", null, "Green"];
  const U = 300 / 16;
  const rot = ([r, c], k) => { for (let i = 0; i < k; i++) [r, c] = [c, 15 - r]; return [r, c]; };
  const cellOf = (a) => { const side = Math.floor(a / 15), o = a % 15; return rot([0, o], side); };
  const xy = ([r, c]) => [c * U + U / 2, r * U + U / 2];
  const safeCell = (c, j) => rot([1 + j, 2], c), homeCell = (c) => rot([7, 2], c), startCell = (c) => rot([1.6, 4], c);
  function spot(c, k, p) {
    if (p == null) { const [x, y] = xy(startCell(c)); return [x + (k - 1) * 7, y + (k === 1 ? -5 : 2)]; }
    if (p === HOME) { const [x, y] = xy(homeCell(c)); return [x + (k - 1) * 7, y]; }
    if (p >= SAFE0) return xy(safeCell(c, p - SAFE0));
    return xy(cellOf(absOf(c, p)));
  }
  root.KG.add({
    id: "slide", title: "Slide & Bump", icon: "🃏",
    rules: "Four colours, three pawns each: you (red), your opponent (yellow, across) and two computer colours. Draw a card and do what it says (each card shows its rule). Land on an enemy pawn and it goes back to its start. Land on the first square of another colour's slide and you whizz to the end, bumping everyone on it. You can't land on your own pawn. After going round, pawns enter their coloured safety lane and need the exact count to reach home. If a card gives you no move, you lose the turn. Get all three home before your opponent to win.",
    achievements: [
      { id: "bumped", icon: "😬", name: "Bumped Off", about: "Play a Bump! card on your opponent." },
      { id: "slide", icon: "🛝", name: "Wheee", about: "Ride a slide and bump someone off it." },
      { id: "back4", icon: "↩", name: "Backdoor", about: "Go backwards 4 straight to the edge of your safety lane." },
    ],
    mount(api) {
      return K.turnGame(api, {
        ...E, setup: (first) => setup(first, NAMES), autoForYou: true, autoDelay: 350, botMs: 420, thinkMs: 450,
        mount(el, H) {
          const v = { bar: K.el("div"), wrap: K.el("div", "slidebox"), opts: K.el("div", "ctrl") }; el.append(v.bar, v.wrap, v.opts);
          v.svgHost = K.el("div"); v.center = K.el("div", "slidecenter"); v.wrap.append(v.svgHost, v.center);
          v.pile = K.btn("cardpile"); v.pile.onclick = () => H.mine() && (H.legal()[0] || {}).draw && H.play({ draw: true }); v.face = K.el("div", "cardface"); v.center.append(v.pile, v.face);
          K.onPick(v.svgHost, (i) => { if (!H.mine()) return; const opts = H.legal().filter((m) => m.k === i && !m.split && !m.swap && !m.bump); if (opts.length === 1) H.play(opts[0]); });
          el.addEventListener("keydown", (e) => { if ((e.key === " " || e.key === "Enter") && H.mine() && (H.legal()[0] || {}).draw) { e.preventDefault(); H.play({ draw: true }); } });
          return v;
        },
        draw(v, S, H) {
          v.bar.replaceChildren(K.players(H, (i) => `${S.pawns[i].filter((p) => p === HOME).length}/3 home`));
          let s = `<svg class="svgboard" viewBox="0 0 300 300"><rect width="300" height="300" rx="12" fill="#f3ead4"/><rect x="${U}" y="${U}" width="${300 - 2 * U}" height="${300 - 2 * U}" fill="#2a5aa0" opacity=".12"/>`;
          for (let a = 0; a < T; a++) { const [x, y] = xy(cellOf(a)); s += `<rect x="${x - U / 2 + 0.6}" y="${y - U / 2 + 0.6}" width="${U - 1.2}" height="${U - 1.2}" rx="2.5" fill="#fffdf6" stroke="#cbbf9f" stroke-width=".8"/>`; }
          for (const sl of SLIDES) { const [x1, y1] = xy(cellOf(sl.from)), [x2, y2] = xy(cellOf(sl.to)); s += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${COL[sl.c]}" stroke-width="6" stroke-linecap="round" opacity=".8"/><polygon points="${x1 - 5},${y1 - 5} ${x1 + 5},${y1 - 5} ${x1},${y1 + 5}" fill="${COL[sl.c]}" transform="rotate(${Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI - 90} ${x1} ${y1})"/><circle cx="${x2}" cy="${y2}" r="5" fill="${COL[sl.c]}"/>`; }
          for (let c = 0; c < 4; c++) { for (let j = 0; j < 5; j++) { const [x, y] = xy(safeCell(c, j)); s += `<rect x="${x - U / 2 + 1}" y="${y - U / 2 + 1}" width="${U - 2}" height="${U - 2}" rx="3" fill="${COL[c]}" opacity=".55"/>`; } const [hx, hy] = xy(homeCell(c)); s += `<circle cx="${hx}" cy="${hy}" r="17" fill="${COL[c]}" opacity=".85"/><text x="${hx}" y="${hy + 3}" text-anchor="middle" font-size="7" font-weight="800" fill="#fff">HOME</text>`; const [sx, sy] = xy(startCell(c)); s += `<circle cx="${sx}" cy="${sy}" r="15" fill="none" stroke="${COL[c]}" stroke-width="3"/><text x="${sx}" y="${sy + 21}" text-anchor="middle" font-size="5.5" fill="${COL[c]}" font-weight="800">START</text>`; }
          const mine = H.mine(), L = mine && !(H.legal()[0] || {}).draw ? H.legal() : [], lm = S.last;
          for (let c = 0; c < 4; c++) S.pawns[c].forEach((p, k) => { const [x, y] = spot(c, k, p); s += K.place(K.token(COL[c], "peg"), x - 8, y - 12, 16, lm && lm.c === c && lm.k === k && !lm.drew ? "appear" : ""); if (c === 0 && L.some((m) => m.k === k && !m.split && !m.swap && !m.bump)) s += `<circle class="hot" data-i="${k}" cx="${x}" cy="${y}" r="9.5" fill="#ffffff22" stroke="#ffd76a" stroke-width="2"/>`; });
          v.svgHost.innerHTML = s + "</svg>";
          const card = S.card != null ? S.card : lm && lm.card != null ? lm.card : null;
          v.face.innerHTML = card == null ? "" : `<b>${card === "S" ? "BUMP!" : card}</b><span>${CARDTXT[card]}</span>`; v.face.classList.toggle("live", S.card != null);
          v.pile.disabled = !(mine && (H.legal()[0] || {}).draw); v.pile.classList.toggle("ready", !v.pile.disabled);
          v.opts.replaceChildren();
          if (mine && L.length) { const fancy = L.filter((m) => m.split || m.swap || m.bump || L.filter((x) => x.k === m.k && !x.split && !x.swap && !x.bump).length > 1); for (const m of fancy.slice(0, 14)) { const r = rank({ ...S }, "normal").find((x) => x.m === m); v.opts.append(K.btn("btn alt small", m.bump ? `Bump ${H.nameOf(m.bump[0])}'s pawn` : m.swap ? `Swap pawn ${m.k + 1} with ${H.nameOf(m.swap[0])}'s` : m.split ? `Pawn ${m.split[0] + 1} +${m.split[1]}, pawn ${m.split[2] + 1} +${m.split[3]}` : `Pawn ${m.k + 1} ${m.to < S.pawns[0][m.k] ? "back" : "forward"} to ${m.to >= SAFE0 ? (m.to === HOME ? "home" : "safety") : "square " + (m.to + 1)}`, () => H.play(m))); void r; } }
        },
        animate: async (v, S0, m, S1) => { if (m.draw) { K.sfx.flip(); return; } if (m.pass) { K.sfx.buzz(); return; } if (S1.last.slide) K.sfx.swish(); else K.sfx.clack(); if (S1.last.hits.length) { await K.wait(120); K.sfx.pop(); } },
        feats(S0, m, S1, who) {
          if (who === "bot" || m.draw) return; const foe = who === "you" ? 2 : 0;
          if (m.bump && m.bump[0] === foe) api.achieve("bumped", who);
          if (S1.last.slide && S1.last.hits.length) api.achieve("slide", who);
          if (S0.card === 4 && S1.pawns[S0.turn][m.k] >= 54 && S1.pawns[S0.turn][m.k] <= 57 && S0.pawns[S0.turn][m.k] <= 3) api.achieve("back4", who);
        },
        situation: (S) => `You are yellow. Card: ${S.card === "S" ? "Bump!" : S.card} (${CARDTXT[S.card] || ""}).`,
        yourTurn: (S) => (S.card == null ? "Your turn: tap the deck to draw (or Space)." : "Tap a glowing pawn, or pick an option below."),
      });
    },
  });
})(typeof self !== "undefined" ? self : this);
