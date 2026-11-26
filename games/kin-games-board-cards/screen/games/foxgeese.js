// Fox & Geese on the 33-hole cross. Seventeen geese try to trap the fox; the fox jumps geese to take them.
(function (root) {
  "use strict";
  const N = 7, ok = (r, c) => r >= 0 && r < N && c >= 0 && c < N && !((r < 2 || r > 4) && (c < 2 || c > 4));
  const PTS = []; for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (ok(r, c)) PTS.push(r * N + c);
  const dirsAt = (i) => { const r = Math.floor(i / N), c = i % N, d = [[0, 1], [0, -1], [1, 0], [-1, 0]]; if ((r + c) % 2 === 0) d.push([1, 1], [1, -1], [-1, 1], [-1, -1]); return d; };
  const step = (i, d, k) => { const r = Math.floor(i / N) + d[0] * k, c = (i % N) + d[1] * k; return ok(r, c) ? r * N + c : -1; };
  const NAME = (i) => "abcdefg"[i % N] + (N - Math.floor(i / N));
  const FOX_WINS_AT = 9; // the fox wins when the geese are down to this many
  function setup(first) {
    const b = Array(N * N).fill(""); PTS.forEach((i) => { const r = Math.floor(i / N), c = i % N; if (r <= 2 || (r === 3 && (c < 2 || c > 4))) b[i] = "g"; }); b[4 * N + 3] = "f";
    // Seat 0 plays the geese (they go first); whoever starts this time takes the geese.
    return { seats: first === "you" ? ["you", "kin"] : ["kin", "you"], turn: 0, b, ply: 0, last: null };
  }
  const isFox = (S) => S.turn === 1;
  function foxJumps(b, at, seen, path, caps, out) {
    for (const d of dirsAt(at)) { const mid = step(at, d, 1), to = step(at, d, 2); if (mid < 0 || to < 0 || b[mid] !== "g" || b[to] || caps.includes(mid)) continue; const key = to + ":" + [...caps, mid].sort().join(); if (seen.has(key)) continue; seen.add(key); const nb = b.slice(); nb[at] = ""; nb[mid] = ""; nb[to] = "f"; const p2 = [...path, to], c2 = [...caps, mid]; out.push({ f: path[0], path: p2, caps: c2 }); foxJumps(nb, to, seen, p2, c2, out); }
  }
  function moves(S) {
    if (over(S)) return [];
    const b = S.b, out = [];
    if (isFox(S)) { const f = b.indexOf("f"); for (const d of dirsAt(f)) { const t = step(f, d, 1); if (t >= 0 && !b[t]) out.push({ f, path: [f, t], caps: [] }); } foxJumps(b, f, new Set(), [f], [], out); }
    else PTS.forEach((i) => { if (b[i] !== "g") return; for (const d of dirsAt(i)) { if (d[0] < 0) continue; const t = step(i, d, 1); if (t >= 0 && !b[t]) out.push({ f: i, path: [i, t], caps: [] }); } });
    return out;
  }
  function apply(S, m) { const b = S.b.slice(), p = b[m.f]; b[m.f] = ""; for (const c of m.caps) b[c] = ""; b[m.path[m.path.length - 1]] = p; const side = S.turn === 0 ? (Math.floor(m.path[1] / N) > Math.floor(m.f / N) ? 0 : (S.side || 0) + 1) : S.side || 0; return { ...S, b, turn: 1 - S.turn, ply: S.ply + 1, last: m, side }; }
  const geese = (b) => b.filter((x) => x === "g").length;
  function anyMove(S) { const T = { ...S }; return movesRaw(T).length > 0; }
  function movesRaw(S) { const save = S.ply; S.ply = 0; const o = S._noOver; S._noOver = true; const r = movesNoOver(S); S._noOver = o; S.ply = save; return r; }
  function movesNoOver(S) {
    const b = S.b, out = [];
    if (isFox(S)) { const f = b.indexOf("f"); for (const d of dirsAt(f)) { const t = step(f, d, 1), t2 = step(f, d, 2); if (t >= 0 && !b[t]) out.push(1); else if (t >= 0 && b[t] === "g" && t2 >= 0 && !b[t2]) out.push(1); } }
    else PTS.forEach((i) => { if (b[i] === "g") for (const d of dirsAt(i)) { if (d[0] >= 0) { const t = step(i, d, 1); if (t >= 0 && !b[t]) out.push(1); } } });
    return out;
  }
  function over(S) {
    const gs = S.seats[0], fs = S.seats[1];
    if (geese(S.b) <= FOX_WINS_AT) return { result: fs, detail: "the fox thinned the flock" };
    const fr = Math.floor(S.b.indexOf("f") / N); if (PTS.every((i) => S.b[i] !== "g" || Math.floor(i / N) > fr)) return { result: fs, detail: "the fox slipped past the flock" };
    if ((S.side || 0) >= 12) return { result: fs, detail: "the geese stalled: twelve goose moves without one forward" };
    if (!anyMove(S)) return isFox(S) ? { result: gs, detail: "the fox is trapped" } : { result: fs, detail: "the geese are stuck" };
    if (S.ply >= 240) return { result: "draw", detail: "the chase ran long" };
    return null;
  }
  function foxMob(b) { const f = b.indexOf("f"); let n = 0; for (const d of dirsAt(f)) { const t = step(f, d, 1), t2 = step(f, d, 2); if (t >= 0 && !b[t]) n++; else if (t >= 0 && b[t] === "g" && t2 >= 0 && !b[t2]) n += 3; } return n; }
  // From the fox's side: geese taken count most, then room to run.
  const foxEval = (b) => { const fr = Math.floor(b.indexOf("f") / N), behind = PTS.filter((i) => b[i] === "g" && Math.floor(i / N) <= fr).length; return (17 - geese(b)) * 10 + foxMob(b) * 1.5 + (6 - fr) * 1.5 + (behind === 0 ? 60 : behind === 1 ? 18 : behind === 2 ? 7 : behind === 3 ? 2 : 0) - PTS.filter((i) => b[i] === "g").reduce((t, i) => t + Math.floor(i / N), 0) * 0.3; };
  function search(S, d, a, beta) {
    const o = over(S); if (o) { const me = S.seats[S.turn]; return o.result === "draw" ? 0 : o.result === me ? 900 + d : -900 - d; }
    if (!d) return isFox(S) ? foxEval(S.b) : -foxEval(S.b);
    let best = -1e9;
    for (const m of moves(S)) { const v = -search(apply(S, m), d - 1, -beta, -a); if (v > best) best = v; if (v > a) a = v; if (a >= beta) break; }
    return best;
  }
  const DEPTH = { beginner: 1, easy: 2, normal: 3, hard: 4 };
  function rank(S, level) {
    const d = DEPTH[level] || 3;
    return moves(S).map((m) => ({ m, label: (isFox(S) ? "fox " : "goose ") + m.path.map(NAME).join(m.caps.length ? "×" : "→") + (m.caps.length ? ` taking ${m.caps.length}` : ""), score: -search(apply(S, m), d - 1, -1e9, 1e9) + (!isFox(S) && Math.floor(m.path[1] / N) === Math.floor(m.f / N) ? -0.3 - (S.side || 0) * 0.4 : 0) + Math.random() * 0.05 })).sort((x, y) => y.score - x.score);
  }
  const E = { PTS, setup, moves, apply, rank, over, geese };
  if (typeof module === "object" && module.exports) { module.exports = E; return; }
  const K = root.Kit;
  const GOOSE = `<svg viewBox="0 0 100 100"><ellipse cx="52" cy="62" rx="40" ry="30" fill="#000" opacity=".25"/><ellipse cx="50" cy="56" rx="38" ry="28" fill="#fbfaf4" stroke="#b9b2a0" stroke-width="3"/><path d="M60 40C62 20 74 14 82 22c4 4 0 10-6 8-5 6-4 10-6 14z" fill="#fbfaf4" stroke="#b9b2a0" stroke-width="3"/><path d="M82 22l12 4-11 4z" fill="#f29a2e"/><circle cx="79" cy="21" r="2.4" fill="#222"/><path d="M22 52c10 10 26 12 40 6" stroke="#d8d2c2" stroke-width="4" fill="none"/></svg>`;
  const FOX = `<svg viewBox="0 0 100 100"><ellipse cx="50" cy="64" rx="38" ry="28" fill="#000" opacity=".25"/><path d="M18 18 34 40 66 40 82 18 74 52C70 72 60 84 50 86 40 84 30 72 26 52z" fill="#e06a1e" stroke="#7a330a" stroke-width="3"/><path d="M50 86C42 84 36 76 34 66l16 6 16-6c-2 10-8 18-16 20z" fill="#fff4e6"/><path d="M24 24l8 12M76 24l-8 12" stroke="#2b1306" stroke-width="5"/><circle cx="38" cy="54" r="4" fill="#1b1006"/><circle cx="62" cy="54" r="4" fill="#1b1006"/><ellipse cx="50" cy="76" rx="5" ry="4" fill="#1b1006"/></svg>`;
  root.KG.add({
    id: "foxgeese", title: "Fox & Geese", icon: "🦊",
    rules: "One side has seventeen geese, the other a single fox. Geese move one step along a line, forward or sideways but never back. The fox moves one step any way along a line, or jumps over a goose to an empty point right behind it, taking it; it can chain jumps. The geese win by trapping the fox. The fox wins by taking eight geese, by slipping behind every goose (they can't turn back), if the geese can't move, or if the geese make twelve moves in a row without any goose stepping forward. Whoever starts plays the geese; it swaps each game.",
    achievements: [
      { id: "trap", icon: "🪤", name: "Penned In", about: "Trap the fox as the geese." },
      { id: "double", icon: "🦊", name: "Double Dinner", about: "Take two or more geese in one fox move." },
      { id: "intact", icon: "🪿", name: "Whole Flock", about: "Win as the geese losing two or fewer." },
    ],
    mount(api) {
      return K.turnGame(api, {
        ...E,
        mount(el, H) {
          const v = { bar: K.el("div"), box: K.el("div", "foxboard wood"), sel: null }; el.append(v.bar, v.box);
          K.onPick(v.box, (i) => {
            if (!H.mine()) return; const L = H.legal(), b = H.S.b, mineP = isFox(H.S) ? "f" : "g";
            if (b[i] === mineP && L.some((m) => m.f === i)) { v.sel = v.sel === i ? null : i; K.sfx.click(); H.redraw(); return; }
            if (v.sel == null) return;
            const c = L.filter((m) => m.f === v.sel && m.path[m.path.length - 1] === i).sort((x, y) => y.caps.length - x.caps.length);
            if (c.length) { v.sel = null; H.play(c[0]); }
          });
          return v;
        },
        draw(v, S, H) {
          v.bar.replaceChildren(K.players(H, (i) => (i === 0 ? `geese · ${geese(S.b)} left` : "fox")));
          const mine = H.mine(), L = mine ? H.legal() : [], sc = 40, P = (i) => [30 + (i % N) * sc, 30 + Math.floor(i / N) * sc];
          if (mine && v.sel == null && isFox(S)) v.sel = S.b.indexOf("f");
          let s = `<svg class="svgboard" viewBox="0 0 300 300"><g stroke="#2b1808" stroke-width="2.4" stroke-linecap="round">`;
          for (const i of PTS) for (const d of dirsAt(i)) { if (d[0] < 0 || (d[0] === 0 && d[1] < 0)) continue; const t = step(i, d, 1); if (t >= 0) { const [x1, y1] = P(i), [x2, y2] = P(t); s += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`; } }
          s += "</g>";
          const tgt = new Set(mine && v.sel != null ? L.filter((m) => m.f === v.sel).map((m) => m.path[m.path.length - 1]) : []), lm = S.last;
          for (const i of PTS) {
            const [x, y] = P(i), p = S.b[i];
            s += `<circle cx="${x}" cy="${y}" r="5" fill="#2b1808"/>`;
            if (lm && lm.caps.includes(i)) s += `<circle cx="${x}" cy="${y}" r="10" fill="#ff6b5755"/>`;
            if (p) s += K.place(p === "f" ? FOX : GOOSE, x - 17, y - 17, 34, lm && lm.path[lm.path.length - 1] === i ? "appear" : "");
            if (v.sel === i && mine) s += `<circle cx="${x}" cy="${y}" r="18" fill="none" stroke="#5ee6d0" stroke-width="3"/>`;
            if (tgt.has(i)) s += `<circle class="hot" data-i="${i}" cx="${x}" cy="${y}" r="16" fill="#ffd76a55" stroke="#ffd76a" stroke-width="2"/>`;
            else if (mine && p && L.some((m) => m.f === i)) s += `<circle class="hot" data-i="${i}" cx="${x}" cy="${y}" r="18" fill="transparent"/>`;
          }
          v.box.innerHTML = s + "</svg>";
        },
        yourTurn: (S) => (isFox(S) ? "You're the fox: tap where to go (jumps take geese)." : "You're the geese: tap a goose, then where it steps."),
        animate: async (v, S0, m) => { if (m.caps.length) { for (const _ of m.caps) { K.sfx.pop(); await K.wait(140); } } else K.sfx.clack(); },
        feats(S0, m, S1, who) {
          if (m.caps.length >= 2) api.achieve("double", who);
          const o = over(S1); if (o && o.result === S1.seats[0]) { api.achieve("trap", o.result); if (geese(S1.b) >= 15) api.achieve("intact", o.result); }
        },
        situation: (S) => `You are the ${isFox(S) ? "fox" : "geese"}. Geese left: ${geese(S.b)}. Fox at ${NAME(S.b.indexOf("f"))}.`,
      });
    },
  });
})(typeof self !== "undefined" ? self : this);
