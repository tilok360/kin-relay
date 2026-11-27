// One Left: a colour-matching shedding game for four (you, your opponent across, two computer players).
// Match the top card's colour or symbol; skips, reverses, draw-twos and wilds shake things up. Shout "One left!" on your last card.
(function (root) {
  "use strict";
  const COLS = ["r", "y", "g", "b"], CNAME = { r: "red", y: "yellow", g: "green", b: "blue" };
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  function deck() { const d = []; let id = 0; for (const c of COLS) { d.push({ c, v: "0", id: id++ }); for (const v of ["1", "2", "3", "4", "5", "6", "7", "8", "9", "skip", "rev", "+2"]) for (let k = 0; k < 2; k++) d.push({ c, v, id: id++ }); } for (let k = 0; k < 4; k++) { d.push({ c: "w", v: "wild", id: id++ }); d.push({ c: "w", v: "+4", id: id++ }); } return shuffle(d); }
  const label = (x) => (x.c === "w" ? (x.v === "+4" ? "wild draw four" : "wild") : `${CNAME[x.c]} ${x.v === "rev" ? "reverse" : x.v === "skip" ? "skip" : x.v === "+2" ? "draw two" : x.v}`);
  const PTS = (x) => (x.c === "w" ? 50 : /^\d$/.test(x.v) ? Number(x.v) : 20);
  function setup(first) {
    const d = deck(), hands = [0, 1, 2, 3].map(() => d.splice(0, 7));
    let top; do { top = d.pop(); if (top.c === "w") { d.unshift(top); top = null; } } while (!top);
    return { seats: ["you", "bot", "kin", "bot"], names: [null, "Moss", null, "Pip"], turn: first === "you" ? 0 : 2, dir: 1, hands, draw: d, pile: [top], color: top.c, drew: false, ply: 0, last: null, out: [] };
  }
  const top = (S) => S.pile[S.pile.length - 1];
  const playable = (S, x) => x.c === "w" || x.c === S.color || x.v === top(S).v;
  const alive = (S, p) => !S.out.includes(p);
  function step(S, from, n) { let t = from; for (let k = 0; k < n; ) { t = (t + S.dir + 4) % 4; if (alive(S, t)) k++; } return t; }
  function moves(S) {
    if (over(S)) return [];
    const h = S.hands[S.turn], out = [];
    const cands = S.drew ? [h.length - 1] : h.map((_, k) => k);
    for (const k of cands) if (playable(S, h[k])) { if (h[k].c === "w") for (const c of COLS) out.push({ k, color: c }); else out.push({ k }); }
    out.push(S.drew ? { pass: true } : { take: true });
    return out;
  }
  function drawN(S, p, n) { for (let i = 0; i < n; i++) { if (!S.draw.length) { const t = S.pile.pop(); S.draw = shuffle(S.pile); S.pile = [t]; if (!S.draw.length) break; } S.hands[p].push(S.draw.pop()); } }
  function apply(S0, m) {
    const S = { ...S0, hands: S0.hands.map((h) => h.slice()), draw: S0.draw.slice(), pile: S0.pile.slice(), out: S0.out.slice(), ply: S0.ply + 1 };
    const p = S.turn;
    if (m.take) { drawN(S, p, 1); const got = S.hands[p][S.hands[p].length - 1]; S.last = { p, take: true }; if (got && playable(S, got)) return { ...S, drew: true }; return { ...S, drew: false, turn: step(S, p, 1) }; }
    if (m.pass) return { ...S, drew: false, last: { p, pass: true }, turn: step(S, p, 1) };
    const card = S.hands[p].splice(m.k, 1)[0]; S.pile.push(card); S.color = card.c === "w" ? m.color : card.c; S.drew = false;
    let penalty = 0; if (S.hands[p].length === 1 && !m.shout) { drawN(S, p, 2); penalty = 2; }
    S.last = { p, card, color: S.color, penalty };
    if (!S.hands[p].length) { S.out.push(p); if (p === 0 || p === 2) return S; }
    let skip = 0;
    if (card.v === "rev") { S.dir = -S.dir; if (S.seats.filter((_, i) => alive(S, i)).length === 2) skip = 1; }
    if (card.v === "skip") skip = 1;
    if (card.v === "+2") { drawN(S, step(S, p, 1), 2); skip = 1; }
    if (card.v === "+4") { drawN(S, step(S, p, 1), 4); skip = 1; }
    return { ...S, turn: step(S, p, 1 + skip) };
  }
  function over(S) { const w = S.out.find((p) => p === 0 || p === 2); if (w == null) return null; const foe = 2 - w; return { result: S.seats[w], detail: `${w === 0 ? "you" : "they"} went out first (${S.hands[foe].reduce((t, x) => t + PTS(x), 0)} points left in the other hand)` }; }
  function rank(S, level) {
    const p = S.turn, h = S.hands[p], nxt = step(S, p, 1), danger = S.hands[nxt].length <= 2, foes = [0, 2].includes(nxt) || nxt !== (p + 2) % 4;
    const count = {}; h.forEach((x) => x.c !== "w" && (count[x.c] = (count[x.c] || 0) + 1));
    return moves(S).map((m) => {
      if (m.take || m.pass) return { m, label: m.take ? "draw a card" : "keep it and pass", score: m.pass ? -1 : -5 };
      const x = h[m.k]; let sc = 10 + PTS(x) * 0.1;
      if (x.c === "w") sc -= h.length > 3 ? 12 : 0; if (x.c === "w") sc += (count[m.color] || 0) * 2;
      if (["skip", "+2", "+4", "rev"].includes(x.v) && danger && foes) sc += 15;
      if (x.v === "+4" && !danger) sc -= 6;
      if (x.c !== "w") sc += (count[x.c] || 0) * 0.8;
      const mm = { ...m, shout: h.length === 2 ? level !== "beginner" || Math.random() < 0.7 : false };
      return { m: mm, label: `play the ${label(x)}${x.c === "w" ? `, calling ${CNAME[m.color]}` : ""}`, score: sc + Math.random() };
    }).sort((a, b) => b.score - a.score);
  }
  const autoMove = (S) => { const ms = moves(S); return ms.length === 1 && (ms[0].take || ms[0].pass) ? ms[0] : null; };
  const E = { deck, setup, moves, apply, over, rank, autoMove, playable, label };
  if (typeof module === "object" && module.exports) { module.exports = E; return; }
  const K = root.Kit, HEX = { r: "#e2402f", y: "#f2c23d", g: "#2fa95a", b: "#2f74d8", w: "#1b1b22" };
  const SYM = { skip: "⦸", rev: "⇄", "+2": "+2", "+4": "+4", wild: "★" };
  const cardSVG = (x) => {
    const col = HEX[x.c], s = SYM[x.v] || x.v, big = x.v.length > 1 && !SYM[x.v] ? 40 : 52;
    const wild = x.c === "w" ? `<g transform="rotate(-28 50 70)"><path d="M50 36a28 34 0 0 1 28 34H50z" fill="${HEX.r}"/><path d="M78 70a28 34 0 0 1-28 34V70z" fill="${HEX.b}"/><path d="M50 104a28 34 0 0 1-28-34h28z" fill="${HEX.g}"/><path d="M22 70a28 34 0 0 1 28-34v34z" fill="${HEX.y}"/></g>` : `<ellipse cx="50" cy="70" rx="30" ry="46" transform="rotate(-28 50 70)" fill="#fff"/>`;
    return `<svg viewBox="0 0 100 140" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="98" height="138" rx="10" fill="#fff"/><rect x="6" y="6" width="88" height="128" rx="7" fill="${col}"/>${wild}<text x="50" y="${70 + big * 0.36}" text-anchor="middle" font-family="Georgia,serif" font-weight="900" font-size="${big}" fill="${x.c === "w" ? "#fff" : col}" stroke="${x.c === "w" ? "#000" : "#0003"}" stroke-width="1.5">${s}</text><text x="15" y="25" font-family="Georgia,serif" font-weight="900" font-size="17" fill="#fff">${s}</text><text x="85" y="128" text-anchor="end" font-family="Georgia,serif" font-weight="900" font-size="17" fill="#fff">${s}</text></svg>`;
  };
  const back = `<svg viewBox="0 0 100 140"><rect x="1" y="1" width="98" height="138" rx="10" fill="#fff"/><rect x="6" y="6" width="88" height="128" rx="7" fill="#1b1b22"/><ellipse cx="50" cy="70" rx="30" ry="46" transform="rotate(-28 50 70)" fill="#e2402f"/><text x="50" y="76" text-anchor="middle" font-family="Georgia,serif" font-weight="900" font-size="20" fill="#ffe14a" transform="rotate(-28 50 70)">ONE</text></svg>`;
  const cardEl = (x, o) => { const e = K.el(o && o.onClick ? "button" : "div", "pcard" + (o && o.cls ? " " + o.cls : "")); if (o && o.onClick) { e.type = "button"; e.onclick = o.onClick; } e.innerHTML = x ? cardSVG(x) : back; e.setAttribute(o && o.onClick ? "aria-label" : "title", x ? label(x) : "a face-down card"); if (x && o && o.k) e.dataset.k = o.k; return e; };
  root.KG.add({
    id: "oneleft", title: "One Left", icon: "🟥",
    rules: "Four players: you, your opponent (across) and two computer players, seven cards each. Play a card matching the top card's colour, number or symbol, or a wild (pick the next colour). Skip jumps the next player, Reverse flips direction, Draw Two and Wild Draw Four make the next player draw and miss their turn. Can't play? Draw one; if it fits you may play it. When you play your second-to-last card, tap \"One left!\" first or you draw two. Go out before your opponent to win.",
    achievements: [
      { id: "four", icon: "➕", name: "Pile On", about: "Hit your opponent with a Wild Draw Four." },
      { id: "colour", icon: "🌈", name: "Colour Change", about: "Go out on a wild card." },
      { id: "nodraw", icon: "✋", name: "Never Drew", about: "Win without drawing a single card." },
    ],
    mount(api) {
      const drew = { you: false, kin: false };
      return K.turnGame(api, {
        ...E, autoForYou: true, autoDelay: 400, botMs: 480, thinkMs: 520,
        mount(el, H) {
          const v = { bar: K.el("div"), opp: K.el("div", "olseats"), mid: K.el("div", "olmid"), hand: K.el("div", "hand fan"), ctl: K.el("div", "ctrl"), shout: false }; el.append(v.bar, v.opp, v.mid, v.hand, v.ctl);
          v.pickC = K.el("div", "olpick"); v.pickC.hidden = true;
          v.shoutB = K.btn("btn shout", "One left!", () => { v.shout = !v.shout; K.sfx.ding(); H.redraw(); }); v.drawB = K.btn("btn alt", "Draw", () => H.mine() && H.play({ take: true })); v.passB = K.btn("btn alt", "Keep & pass", () => H.mine() && H.play({ pass: true }));
          v.ctl.append(v.drawB, v.passB, v.shoutB, v.pickC);
          return v;
        },
        draw(v, S, H) {
          v.bar.replaceChildren(K.players(H, (i) => (S.out.includes(i) ? "out!" : `${S.hands[i].length} cards`)));
          const mine = H.mine(), L = mine ? H.legal() : [];
          v.opp.replaceChildren(...[1, 2, 3].map((i) => { const w = K.el("div", "olseat s" + i + (S.turn === i ? " on" : "")); w.append(K.el("b", "", H.nameOf(i))); const f = K.el("div", "hand fan mini"); S.hands[i].slice(0, 12).forEach(() => f.append(cardEl(null))); w.append(f); return w; }));
          v.mid.replaceChildren(); const pileEl = cardEl(top(S), { k: "pile" + top(S).id }); pileEl.classList.add("top"); const dk = cardEl(null); dk.classList.add("deck");
          const ring = K.el("div", "olcolor"); ring.style.background = HEX[S.color]; ring.title = "colour to match: " + CNAME[S.color]; const dir = K.el("div", "oldir", S.dir > 0 ? "↻" : "↺");
          v.mid.append(dk, pileEl, ring, dir);
          const you = S.hands[0];
          K.flip(v.hand, () => v.hand.replaceChildren(...you.map((x, k) => { const ok = L.some((m) => m.k === k); return cardEl(x, { k: "c" + x.id, cls: ok ? "ok" : mine ? "dim" : "", onClick: () => { if (!ok) { K.shake(v.hand.children[k]); return; } if (x.c === "w") { v.pickK = k; H.redraw(); return; } H.play({ k, shout: v.shout }); v.shout = false; } }); })), { lift: true });
          v.pickC.hidden = !(mine && v.pickK != null && you[v.pickK] && you[v.pickK].c === "w");
          if (!v.pickC.hidden) v.pickC.replaceChildren(K.el("span", "", "Pick a colour:"), ...["r", "y", "g", "b"].map((c) => { const b = K.btn("cdot", "", () => { const k = v.pickK; v.pickK = null; H.play({ k, color: c, shout: v.shout }); v.shout = false; }); b.style.background = HEX[c]; b.setAttribute("aria-label", CNAME[c]); return b; }));
          if (!mine) v.pickK = null;
          v.drawB.hidden = !(mine && L.some((m) => m.take)); v.passB.hidden = !(mine && L.some((m) => m.pass));
          v.shoutB.hidden = !(mine && you.length === 2); v.shoutB.classList.toggle("on", v.shout);
          const lm = S.last; api.status(lm && lm.penalty ? `${H.nameOf(lm.p)} forgot to shout and drew two!` : "");
        },
        animate: async (v, S0, m, S1) => { if (m.take) K.sfx.deal(); else if (m.k != null) { K.sfx.flip(); const c = S1.last.card; if (c.v === "+4" || c.v === "+2") { await K.wait(120); K.sfx.deal(); } } },
        feats(S0, m, S1, who) {
          if (who === "bot") return; if (m.take) drew[who] = true;
          const c = S1.last && S1.last.card; if (m.k != null && c.v === "+4" && step(S0, S0.turn, 1) === (S0.turn === 0 ? 2 : 0)) api.achieve("four", who);
          const o = over(S1); if (o && o.result === who) { if (c && c.c === "w") api.achieve("colour", who); if (!drew[who]) api.achieve("nodraw", who); }
        },
        situation: (S) => `Top card: ${label(top(S))}${top(S).c === "w" ? ` (colour now ${CNAME[S.color]})` : ""}. Your hand: ${S.hands[2].map(label).join(", ")}.`,
        yourTurn: (S) => (S.drew ? "You drew a card that fits: play it or keep it." : "Your turn: play a glowing card, or draw."),
      });
    },
  });
})(typeof self !== "undefined" ? self : this);
