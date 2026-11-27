// Table shuffleboard: slide four weights each down the board. After every round, only the player whose weight is
// farthest down scores: each of their weights beyond the other's best counts its zone (1, 2, 3, or 4 hanging off the end).
(function (root) {
  "use strict";
  const PHm = typeof module === "object" && module.exports ? require("./physics.js") : root.PH, AR = typeof module === "object" && module.exports ? require("./arcade.js") : root.AR;
  const W = 100, L = 560, R = 7, START = 520, FOUL = 330, PER = 4, TARGET = 15;
  const zone = (y) => (y < 0 ? -1 : y < 18 ? 4 : y < 58 ? 3 : y < 108 ? 2 : y < 168 ? 1 : 0);
  const SPREAD = { beginner: { a: 0.035, p: 0.09 }, easy: { a: 0.02, p: 0.055 }, normal: { a: 0.011, p: 0.032 }, hard: { a: 0.005, p: 0.016 }, you: { a: 0.002, p: 0.006 } };
  const speedOf = (p) => 164 + p * 165;
  function setup(first) { return { seats: first === "you" ? ["you", "kin"] : ["kin", "you"], score: [0, 0], pucks: [], thrown: [0, 0], turn: 0, round: 1, phase: "play", seed: (Math.random() * 1e9) | 0, ply: 0, res: null }; }
  // The weight as it leaves the hand, wobble included (the same every time for the same shot).
  function launch(S, m) { const r = AR.rng(S.seed + S.ply * 7919), sd = SPREAD[m.lv] || SPREAD.you, a = m.a + AR.gaussR(r) * sd.a, p = Math.max(0.02, Math.min(1.05, m.p + AR.gaussR(r) * sd.p)), v = speedOf(p); return { id: "n" + S.ply, own: S.turn, x: m.x == null ? W / 2 : m.x, y: START, r: R, m: 1, vx: Math.cos(a) * v, vy: Math.sin(a) * v }; }
  function world(S, extra) { return { balls: [...S.pucks.map((b) => ({ ...b, vx: 0, vy: 0 })), ...(extra ? [extra] : [])], walls: [], pockets: [], friction: 90, wallRest: 0.5, ballRest: 0.82, stopSpeed: 2 }; }
  // Steps a world, dropping weights off the sides and the end; onFrame lets the screen draw along.
  function run(w, each) { const ev = []; for (let k = 0; k < 240 * 14 && PHm.moving(w); k++) { PHm.step(w, ev); for (const b of w.balls) if (!b.gone && (b.x < -R * 0.3 || b.x > W + R * 0.3 || b.y < -R * 0.6)) { b.gone = true; b.vx = b.vy = 0; ev.push({ type: "off", id: b.id }); } if (each && each(k)) break; } return ev; }
  function settle(w) { return w.balls.filter((b) => !b.gone && b.y < FOUL).map((b) => ({ id: b.id, own: b.own, x: b.x, y: b.y, r: R, m: 1 })); }
  function roundScore(pucks) { const best = [0, 1].map((o) => Math.min(Infinity, ...pucks.filter((b) => b.own === o).map((b) => b.y))); if (best[0] === Infinity && best[1] === Infinity) return null; const w = best[0] < best[1] ? 0 : 1; const pts = pucks.filter((b) => b.own === w && b.y < best[1 - w]).reduce((t, b) => t + Math.max(0, zone(b.y)), 0); return { w, pts }; }
  function moves(S) { return over(S) ? [] : S.phase === "scored" ? [{ next: true }] : [{ a: -Math.PI / 2, p: 0.8 }]; }
  function apply(S0, m) {
    if (m.next) { const first = 1 - S0.first0; return { ...S0, pucks: [], thrown: [0, 0], phase: "play", round: S0.round + 1, turn: S0.res && S0.res.w != null ? S0.res.w : (S0.round % 2), res: null, ply: S0.ply + 1, first0: first }; }
    const w = world(S0, launch(S0, m)); run(w); const pucks = settle(w), thrown = S0.thrown.slice(); thrown[S0.turn]++;
    const S = { ...S0, pucks, thrown, ply: S0.ply + 1, turn: 1 - S0.turn, last: { p: S0.turn } };
    if (thrown[0] >= PER && thrown[1] >= PER) { const r = roundScore(pucks), score = S.score.slice(); if (r && r.pts) score[r.w] += r.pts; return { ...S, score, phase: "scored", res: r || { w: null, pts: 0 } }; }
    return S;
  }
  function over(S) { if (S.phase !== "scored") return null; const [a, b] = S.score; if (Math.max(a, b) < TARGET || a === b) return null; return { result: S.seats[a > b ? 0 : 1], detail: `${Math.max(a, b)} to ${Math.min(a, b)}` }; }
  function evalPucks(pucks, me) { const r = roundScore(pucks); let v = r ? (r.w === me ? r.pts + 0.5 : -r.pts - 0.5) : 0; for (const b of pucks) v += (b.own === me ? 1 : -1) * (zone(b.y) > 0 ? 0.15 : 0); return v; }
  function rank(S, level) {
    if (S.phase === "scored") return [{ m: { next: true }, label: "next round", score: 0 }];
    const me = S.turn, out = [], their = S.pucks.filter((b) => b.own !== me);
    for (const da of [-0.04, -0.02, 0, 0.02, 0.04]) for (const p of [0.6, 0.68, 0.74, 0.79, 0.83, 0.87, 0.92]) {
      const m = { a: -Math.PI / 2 + da, p, lv: level }, w = world(S, { ...launch({ ...S, seed: 1 }, { ...m, lv: "you" }), vx: Math.cos(m.a) * speedOf(p), vy: Math.sin(m.a) * speedOf(p) }); run(w); const after = settle(w);
      const mine = after.find((b) => b.id === "n" + S.ply), knocked = their.filter((t) => !after.some((b) => b.id === t.id)).length;
      const z = mine ? zone(mine.y) : -1;
      out.push({ m, label: knocked ? `knock ${knocked > 1 ? knocked + " of their weights" : "their weight"} off` : z >= 3 ? `slide it into the ${z} zone` : z > 0 ? `lay it up in the ${z} zone` : mine ? "a short guard weight" : "go for broke off the end", score: evalPucks(after, me) + Math.random() * 0.05 });
    }
    return out.sort((a, b) => b.score - a.score);
  }
  const autoMove = (S) => (over(S) ? null : S.phase === "scored" ? { next: true } : null);
  const E = { W, L, START, FOUL, TARGET, zone, setup, moves, apply, over, rank, autoMove, launch, world, run, settle, roundScore };
  if (typeof module === "object" && module.exports) { module.exports = E; return; }
  const K = root.Kit, PH = root.PH, COL = [["#ff7a3d", "#a8360d"], ["#4aa3ff", "#174e96"]];
  root.KG.add({
    id: "shuffleboard", title: "Shuffleboard", icon: "🥌",
    rules: "Take turns sliding four weights each down the board: pull back from your weight and let go (pull farther for more speed, and slide left or right before you aim). Weights that stop short of the foul line or fall off are out. When all eight are down, only the weight farthest down scores, along with any more of the same colour that beat the other side's best: 1, 2 or 3 points by zone, 4 for one hanging over the end. Knock theirs off! First to 15 wins.",
    achievements: [
      { id: "hanger", icon: "🪝", name: "Hanger", about: "Leave a weight hanging over the end for 4." },
      { id: "sweep", icon: "🧹", name: "Clean Sweep", about: "Score 8 or more in one round." },
      { id: "knock", icon: "💥", name: "Knock-Off", about: "Knock two of their weights off with one shot." },
    ],
    mount(api) {
      let aim = null, sx = W / 2, anim = null;
      return K.turnGame(api, {
        ...E, autoDelay: 1600, thinkMs: 700,
        mount(el, H) {
          const v = { bar: K.el("div"), info: K.el("div", "hint big") }; el.append(v.bar); v.pv = PH.view(el, W + 40, L * 0.75 + 20, 0.66); el.append(v.info);
          const toW = (p) => ({ x: p.x - 20, y: (p.y - 10) / 0.75 });
          const view = { cv: v.pv.cv, toWorld: (e) => toW(v.pv.toWorld(e)) };
          PH.aim(view, { enabled: () => H.mine() && H.S.phase === "play", ball: () => ({ x: sx, y: START }), reach: 90, grab: (p) => { if (p.y > START - 30 && Math.abs(p.x - sx) > R * 1.6) { sx = Math.max(R, Math.min(W - R, p.x)); H.redraw(); return true; } return false; }, onAim: (a) => { aim = a; H.redraw(); }, onShoot: (a, pw) => H.play({ a, p: pw, x: sx }) });
          return v;
        },
        draw(v, S, H) {
          v.bar.replaceChildren(K.players(H, (i) => `${S.score[i]} pts · ${PER - S.thrown[i]} left`), K.el("div", "hint", `Round ${S.round} · to ${TARGET}`));
          const ctx = v.pv.ctx, sc = 0.75; ctx.save(); ctx.clearRect(0, 0, W + 40, L * sc + 20); ctx.translate(20, 10); ctx.scale(1, sc);
          ctx.fillStyle = "#2a1a0c"; ctx.fillRect(-20, -14, W + 40, L + 30);
          const g = ctx.createLinearGradient(0, 0, W, 0); g.addColorStop(0, "#c8955a"); g.addColorStop(0.5, "#e6bd84"); g.addColorStop(1, "#c8955a"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, L);
          for (let x = 8; x < W; x += 12) { ctx.fillStyle = "rgba(120,70,20,.12)"; ctx.fillRect(x, 0, 1, L); }
          [[0, 18, "4", "#e5483b"], [18, 58, "3", "#f2b134"], [58, 108, "2", "#3d9be9"], [108, 168, "1", "#4cbb6a"]].forEach(([a, b2, t, c]) => { ctx.fillStyle = c + "33"; ctx.fillRect(0, a, W, b2 - a); ctx.strokeStyle = "#5a3315"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, b2); ctx.lineTo(W, b2); ctx.stroke(); ctx.fillStyle = "#5a3315"; ctx.font = "700 14px Georgia"; ctx.textAlign = "center"; ctx.fillText(t, W / 2, (a + b2) / 2 + 5); });
          ctx.strokeStyle = "#e5483b"; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(0, FOUL); ctx.lineTo(W, FOUL); ctx.stroke(); ctx.setLineDash([]);
          const list = anim ? anim.balls.filter((b) => !b.gone) : S.pucks; ctx.restore();
          const P = (b) => [20 + b.x, 10 + b.y * sc];
          for (const b of list) { const [x, y] = P(b); AR.puck(ctx, x, y, R, COL[b.own][0], COL[b.own][1]); }
          if (!anim && H.mine() && S.phase === "play") { const [x, y] = P({ x: sx, y: START }); AR.puck(ctx, x, y, R, COL[S.turn][0], COL[S.turn][1]); if (aim) PH.aimLine(ctx, { x, y, r: R }, aim.angle, aim.power, 120, 0.9); }
          const r = S.res; v.info.textContent = S.phase === "scored" ? (r && r.w != null && r.pts ? `${H.nameOf(r.w)} scores ${r.pts}` : "No score this round") : H.mine() ? "Pull back from your weight and let go. Tap beside it to move it sideways." : "";
        },
        async animate(v, S0, m, S1, who, H) {
          if (m.next || K.fast) return;
          const w = world(S0, launch(S0, m)); anim = w; K.sfx.slide();
          await new Promise((res) => { const go = () => { if (H.dead) return res(); let n = 0; const ev = []; for (; n < 4 && PH.moving(w); n++) { for (let k = 0; k < 10; k++) { PH.step(w, ev); for (const b of w.balls) if (!b.gone && (b.x < -R * 0.3 || b.x > W + R * 0.3 || b.y < -R * 0.6)) { b.gone = true; b.vx = b.vy = 0; } } } if (ev.some((e) => e.type === "hit")) K.sfx.clack(); this.draw(v, S0, H); if (PH.moving(w)) setTimeout(go, 16); else res(); }; go(); });
          anim = null;
        },
        feats(S0, m, S1, who) { if (m.next) return; const gone = S0.pucks.filter((b) => b.own !== S0.turn && !S1.pucks.some((x) => x.id === b.id)).length; if (gone >= 2) api.achieve("knock", who); if (S1.phase === "scored" && S1.res && S1.res.w != null) { const w = S1.seats[S1.res.w]; if (S1.res.pts >= 8) api.achieve("sweep", w); if (S1.pucks.some((b) => b.own === S1.res.w && zone(b.y) === 4)) api.achieve("hanger", w); } },
        situation: (S) => `Shuffleboard, first to ${TARGET}. Score: you ${S.score[S.turn]}, them ${S.score[1 - S.turn]}. You have ${PER - S.thrown[S.turn]} weights left this round, they have ${PER - S.thrown[1 - S.turn]}. Pick your shot; the app slides it.`,
        yourTurn: () => "Your shot: pull back and let go.",
      });
    },
  });
})(typeof self !== "undefined" ? self : this);
