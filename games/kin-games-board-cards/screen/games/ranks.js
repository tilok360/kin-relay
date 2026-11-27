// Battle of the Ranks: a hidden-army capture-the-flag game on a 10 x 10 field with two lakes.
// Ranks: 10 Marshal (highest) … 2 Scout, 1 Spy; B Bomb and F Flag never move. You only see enemy ranks after a clash.
(function (root) {
  "use strict";
  const N = 10, LAKE = new Set([42, 43, 52, 53, 46, 47, 56, 57]);
  const ARMY = { F: 1, B: 6, 1: 1, 2: 8, 3: 5, 4: 4, 5: 4, 6: 4, 7: 3, 8: 2, 9: 1, 10: 1 };
  const RNAME = { F: "Flag", B: "Bomb", 1: "Spy", 2: "Scout", 3: "Miner", 4: "Sergeant", 5: "Lieutenant", 6: "Captain", 7: "Major", 8: "Colonel", 9: "General", 10: "Marshal" };
  const VAL = { F: 1000, B: 3, 1: 6, 2: 1.5, 3: 3.5, 4: 2, 5: 2.6, 6: 3.4, 7: 4.5, 8: 6, 9: 8, 10: 10 };
  const SQ = (i) => "abcdefghij"[i % N] + (N - Math.floor(i / N));
  const other = (o) => (o === "you" ? "kin" : "you");
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  // Places one army: the flag on the back row tucked behind bombs, the rest shuffled with scouts leaning forward.
  function deploy(b, o) {
    const rows = o === "you" ? [6, 7, 8, 9] : [3, 2, 1, 0], back = rows[3], slots = new Set(); for (const r of rows) for (let c = 0; c < N; c++) slots.add(r * N + c);
    const put = (i, r) => { b[i] = { o, r, seen: false, moved: false }; slots.delete(i); };
    const fc = Math.floor(Math.random() * N), fi = back * N + fc; put(fi, "F");
    const guard = [fi - 1, fi + 1, (o === "you" ? fi - N : fi + N)].filter((i) => slots.has(i) && Math.floor(i / N) === Math.floor(fi / N) || (slots.has(i) && i % N === fc));
    let bombs = ARMY.B; for (const g of guard) if (bombs && slots.has(g)) { put(g, "B"); bombs--; }
    const rest = []; for (const [r, n] of Object.entries(ARMY)) { if (r === "F") continue; for (let k = 0; k < (r === "B" ? bombs : n); k++) rest.push(r); }
    const front = shuffle([...slots].filter((i) => Math.floor(i / N) === rows[0])), others = shuffle([...slots].filter((i) => Math.floor(i / N) !== rows[0]));
    shuffle(rest).sort((a, c) => (a === "2" ? -1 : 0) - (c === "2" ? -1 : 0) + (a === "B" ? 1 : 0) - (c === "B" ? 1 : 0));
    const order = [];
    for (const r of rest) { const pref = (r === "2" || r === "3" || r === "4") && front.length && Math.random() < 0.7 ? front : others.length ? others : front; order.push([pref.pop(), r]); }
    for (const [i, r] of order) put(i, r);
  }
  function setup(first) { const b = Array(N * N).fill(null); deploy(b, "you"); deploy(b, "kin"); return { seats: first === "you" ? ["you", "kin"] : ["kin", "you"], turn: 0, b, ply: 0, last: null, lost: { you: [], kin: [] }, lastFrom: {} }; }
  const who = (S) => S.seats[S.turn];
  const movable = (p) => p && p.r !== "B" && p.r !== "F";
  function movesFor(b, o) {
    const out = [];
    b.forEach((p, f) => {
      if (!p || p.o !== o || !movable(p)) return;
      const r = Math.floor(f / N), c = f % N;
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (let k = 1; k < N; k++) {
        const rr = r + dr * k, cc = c + dc * k; if (rr < 0 || rr >= N || cc < 0 || cc >= N) break; const t = rr * N + cc; if (LAKE.has(t)) break;
        const q = b[t]; if (q && q.o === o) break; out.push({ f, t }); if (q || p.r !== "2") break;
      }
    });
    return out;
  }
  const moves = (S) => (over(S) ? [] : movesFor(S.b, who(S)));
  // 1 = attacker wins, 0 = both fall, -1 = defender wins.
  function clash(a, d) {
    if (d === "F") return 1; if (d === "B") return a === "3" ? 1 : -1;
    if (a === "1" && d === "10") return 1;
    const x = Number(a), y = Number(d); return x > y ? 1 : x === y ? 0 : -1;
  }
  function apply(S, m) {
    const b = S.b.slice(), p = { ...b[m.f], moved: true }, q = b[m.t], lost = { you: S.lost.you.slice(), kin: S.lost.kin.slice() };
    if (p.r === "2" && Math.abs(m.t - m.f) !== 1 && Math.abs(m.t - m.f) !== N) p.seen = true; // a long scout run gives it away
    let fight = null; b[m.f] = null;
    if (!q) b[m.t] = p;
    else {
      const res = clash(p.r, q.r); fight = { a: p.r, d: q.r, res, ao: p.o, at: m.t };
      if (res === 1) { b[m.t] = { ...p, seen: true }; lost[q.o].push(q.r); }
      else if (res === 0) { b[m.t] = null; lost[p.o].push(p.r); lost[q.o].push(q.r); }
      else { b[m.t] = { ...q, seen: true }; lost[p.o].push(p.r); }
    }
    return { ...S, b, turn: 1 - S.turn, ply: S.ply + 1, last: { ...m, fight }, lost, lastFrom: { ...S.lastFrom, [p.o]: [m.f, m.t] } };
  }
  function over(S) {
    for (const o of ["you", "kin"]) if (S.lost[o].includes("F")) return { result: other(o), detail: "the flag was captured" };
    const me = who(S); if (!movesFor(S.b, me).length) return { result: other(me), detail: "no pieces left that can move" };
    if (S.ply >= 500) return { result: "draw", detail: "an armistice after 500 moves" };
    return null;
  }
  // What the mover could believe an unseen enemy piece is: everything of theirs not yet seen.
  function unknownPool(S, foe, moved) {
    const left = { ...ARMY }; for (const r of S.lost[foe]) left[r]--; S.b.forEach((p) => { if (p && p.o === foe && p.seen) left[p.r]--; });
    if (moved) { left.B = 0; left.F = 0; } return left;
  }
  function rank(S, level) {
    const me = who(S), foe = other(me), b = S.b, ms = moves(S), pools = {};
    const pool = (moved) => pools[moved] || (pools[moved] = unknownPool(S, foe, moved));
    const fwd = me === "you" ? -1 : 1;
    const threatAt = (t, myR) => { let d = 0; const r = Math.floor(t / N), c = t % N; for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const rr = r + dr, cc = c + dc; if (rr < 0 || rr >= N || cc < 0 || cc >= N) continue; const q = b[rr * N + cc]; if (q && q.o === foe && q.seen && movable(q) && clash(q.r, myR) === 1) d = Math.max(d, VAL[myR]); } return d; };
    return ms.map((m) => {
      const p = b[m.f], q = b[m.t]; let sc = 0;
      if (q) {
        if (q.seen) { const res = clash(p.r, q.r); sc = res === 1 ? VAL[q.r] + (q.r === "F" ? 1000 : 0) : res === 0 ? VAL[q.r] - VAL[p.r] : -VAL[p.r]; }
        else { const L = pool(q.moved); let tot = 0, ev = 0; for (const [r, n] of Object.entries(L)) { if (n <= 0) continue; tot += n; const res = clash(p.r, r); ev += n * (res === 1 ? VAL[r] + (r === "F" ? 60 : 0) : res === 0 ? VAL[r] - VAL[p.r] : -VAL[p.r] * 0.9); } sc = tot ? ev / tot + (p.r === "2" ? 0.8 : 0) : 0; }
      } else {
        const dr = (Math.floor(m.t / N) - Math.floor(m.f / N)) * fwd; sc = dr * (p.r === "2" ? 0.12 : 0.3) + (p.r === "3" ? 0.1 : 0) - (["10", "9", "1"].includes(p.r) ? 0.2 : 0);
        if (!p.seen && Number(p.r) >= 8) sc -= 0.3; // big pieces stay quiet until needed
      }
      if (level !== "beginner") sc -= threatAt(m.t, p.r) * (level === "hard" ? 0.9 : 0.5);
      const lf = S.lastFrom[me]; if (lf && lf[1] === m.f && lf[0] === m.t) sc -= 1.5;
      const tgt = q ? (q.seen || q.o === me ? `the enemy ${RNAME[q.r]}` : "an unknown enemy piece") : "";
      return { m, label: `${RNAME[p.r]} ${SQ(m.f)} → ${SQ(m.t)}${q ? ` attacking ${tgt}` : ""}`, score: sc + Math.random() * 0.25 };
    }).sort((x, y) => y.score - x.score);
  }
  const E = { N, LAKE, ARMY, RNAME, setup, moves, apply, rank, over, clash, deploy };
  if (typeof module === "object" && module.exports) { module.exports = E; return; }
  const K = root.Kit;
  const ICON = { F: "🚩", B: "💣", 1: "🕵", 2: "👣", 3: "⛏" };
  const tile = (p, mine) => (mine || p.seen ? `<span class="rk ${p.o}${p.seen && !mine ? " shown" : ""}"><b>${p.r === "F" || p.r === "B" ? ICON[p.r] : p.r === "1" ? "S" : p.r}</b><i>${RNAME[p.r]}</i></span>` : `<span class="rk ${p.o} hid"><b>✦</b></span>`);
  root.KG.add({
    id: "ranks", title: "Battle of the Ranks", icon: "🚩",
    rules: "Both armies start hidden: you see your own ranks, not theirs. Move one piece a square up, down or sideways (not into the lakes). Scouts (2) can run any distance in a straight line. Move onto an enemy to attack: both ranks are shown and the higher wins (equal ranks both fall). The Spy beats the Marshal only when the Spy attacks. Bombs destroy any attacker except a Miner (3). Bombs and the Flag never move. Capture the enemy Flag, or leave them with nothing that can move, to win. Before your first move you can reshuffle your army.",
    achievements: [
      { id: "spy", icon: "🕵", name: "Silent Knife", about: "Take the enemy Marshal with your Spy." },
      { id: "miner", icon: "⛏", name: "Sapper", about: "Clear a bomb with a Miner." },
      { id: "scoutflag", icon: "👣", name: "Lucky Scout", about: "Capture the flag with a Scout." },
    ],
    mount(api) {
      return K.turnGame(api, {
        ...E, botMs: 350, thinkMs: 400,
        mount(el, H) {
          const v = { bar: K.el("div"), wrap: K.el("div", "rankfield"), ctl: K.el("div", "ctrl"), log: K.el("div", "hint"), sel: null }; el.append(v.bar, v.wrap, v.log, v.ctl);
          v.g = K.grid(v.wrap, N, N, "rkgrid", (r, c) => "abcdefghij"[c] + (N - r));
          v.shuf = K.btn("btn alt", "Reshuffle my army", () => { const S = H.S; if (S.ply > 0) return; const b = S.b.map((p) => (p && p.o === "you" ? null : p)); deploy(b, "you"); K.sfx.shuffle(); H.set({ ...S, b }); });
          v.ctl.append(v.shuf);
          K.onPick(v.wrap, (i) => {
            if (!H.mine()) return; const p = H.S.b[i];
            if (p && p.o === "you") { v.sel = v.sel === i ? null : i; K.sfx.click(); H.redraw(); return; }
            if (v.sel == null) return; const m = H.legal().find((x) => x.f === v.sel && x.t === i); if (m) { v.sel = null; H.play(m); }
          });
          return v;
        },
        draw(v, S, H) {
          const alive = (o) => S.b.filter((p) => p && p.o === o).length;
          v.bar.replaceChildren(K.players(H, (i) => `${alive(S.seats[i])} pieces`));
          const mine = H.mine(), L = mine ? H.legal() : [], tg = new Set(mine && v.sel != null ? L.filter((m) => m.f === v.sel).map((m) => m.t) : []), lm = S.last;
          v.g.cells.forEach((c, i) => {
            const p = S.b[i]; let cls = "cell" + (LAKE.has(i) ? " lake" : "") + ((Math.floor(i / N) + i) % 2 ? " sh1" : " sh2");
            if (tg.has(i)) cls += p ? " atk" : " can"; if (v.sel === i) cls += " sel"; if (lm && (lm.t === i || lm.f === i)) cls += " last";
            c.className = cls; c.innerHTML = p ? tile(p, p.o === "you") : ""; c.disabled = !mine;
          });
          v.shuf.hidden = S.ply > 0;
          const f = lm && lm.fight;
          v.log.textContent = f ? `${f.ao === "you" ? "Your" : "Their"} ${RNAME[f.a]} attacked ${f.ao === "you" ? "their" : "your"} ${RNAME[f.d]}: ${f.res === 1 ? "the attacker won" : f.res === 0 ? "both fell" : "the defender held"}.` : "";
        },
        animate: async (v, S0, m, S1) => {
          const f = S1.last.fight; if (!f) { K.sfx.slide(); return; }
          const c = v.g.cells[m.t], a = S0.b[m.f], d = S0.b[m.t];
          c.innerHTML = `<span class="clash">${tile({ ...a, seen: true }, true)}<em>⚔</em>${tile({ ...d, seen: true }, true)}</span>`; K.sfx.hit();
          await K.wait(650); if (f.d === "B" && f.res !== 1) K.sfx.rumble(); else if (f.res === 1) K.sfx.score();
        },
        feats(S0, m, S1, who) {
          const f = S1.last.fight; if (!f || f.res !== 1) return;
          if (f.a === "1" && f.d === "10") api.achieve("spy", who); if (f.a === "3" && f.d === "B") api.achieve("miner", who); if (f.a === "2" && f.d === "F") api.achieve("scoutflag", who);
        },
        situation: (S) => { const me = who(S); return `You command the ${me === "kin" ? "top" : "bottom"} army. You've lost ${S.lost[me].length} pieces, they've lost ${S.lost[other(me)].length}.`; },
        yourTurn: (S) => (S.ply === 0 ? "Your move (or reshuffle first). Tap a piece, then a square." : "Your move: tap a piece, then where it goes."),
      });
    },
  });
})(typeof self !== "undefined" ? self : this);
