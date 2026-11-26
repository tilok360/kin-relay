// Foosball: real time. Move your mouse or finger up and down to slide all your rods; your men kick the ball when it
// touches them (hold the button or finger down to spin for a harder shot). First to 5 goals.
(function (root) {
  "use strict";
  const W = 520, H = 300, BR = 8, GOAL = 92, TO = 5, MW = 6, MH = 10;
  // rods: x, men, spacing. "you" attack to the right.
  const RODS = { you: [[40, 1, 0], [110, 2, 120], [250, 5, 54], [390, 3, 88]], kin: [[480, 1, 0], [410, 2, 120], [270, 5, 54], [130, 3, 88]] };
  const LV = { beginner: { sp: 160, react: 0.32, err: 40 }, easy: { sp: 230, react: 0.22, err: 26 }, normal: { sp: 330, react: 0.14, err: 14 }, hard: { sp: 460, react: 0.08, err: 6 } };
  const menY = (rod, off) => { const [, n, sp] = rod, o = []; for (let i = 0; i < n; i++) o.push(H / 2 + off + (i - (n - 1) / 2) * sp); return o; };
  const range = (rod) => { const [, n, sp] = rod, half = ((n - 1) / 2) * sp; return [-(H / 2 - half - MH - 4), H / 2 - half - MH - 4]; };
  function fresh(toward) { return { b: { x: W / 2, y: H / 2 + (Math.random() - 0.5) * 60, vx: toward === "you" ? -60 : 60, vy: (Math.random() - 0.5) * 120 }, off: { you: [0, 0, 0, 0], kin: [0, 0, 0, 0] } }; }
  function step(S, dt, spin) {
    const b = S.b; b.x += b.vx * dt; b.y += b.vy * dt; const f = Math.pow(0.995, dt * 60); b.vx *= f; b.vy *= f; let ev = null;
    if (b.y < BR) { b.y = BR; b.vy = Math.abs(b.vy); ev = "wall"; } if (b.y > H - BR) { b.y = H - BR; b.vy = -Math.abs(b.vy); ev = "wall"; }
    const mouth = Math.abs(b.y - H / 2) < GOAL / 2 - BR * 0.5;
    if (b.x < BR && !mouth) { b.x = BR; b.vx = Math.abs(b.vx) * 0.8; ev = "wall"; } if (b.x > W - BR && !mouth) { b.x = W - BR; b.vx = -Math.abs(b.vx) * 0.8; ev = "wall"; }
    if (b.x < -BR) return "kin"; if (b.x > W + BR) return "you";
    for (const side of ["you", "kin"]) RODS[side].forEach((rod, k) => {
      if (Math.abs(b.x - rod[0]) > MW + BR) return;
      for (const my of menY(rod, S.off[side][k])) if (Math.abs(b.y - my) < MH + BR) {
        const dir = side === "you" ? 1 : -1; if (S.cool && S.cool[side + k] > 0) continue;
        const hard = side === "you" ? spin.you : spin.kin, aimY = side === "you" ? (b.y - my) * 9 + (S.vyou || 0) * 0.3 : (S.aim != null ? (S.aim - b.y) * 2.2 : 0);
        const sp = hard ? 640 : 380 + Math.random() * 120;
        b.vx = dir * sp; b.vy = Math.max(-420, Math.min(420, aimY + (Math.random() - 0.5) * 40)); b.x = rod[0] + dir * (MW + BR + 1);
        S.cool = S.cool || {}; S.cool[side + k] = 0.12; ev = "kick"; S.last = side; return;
      }
    });
    if (S.cool) for (const k in S.cool) S.cool[k] -= dt;
    return ev;
  }
  // The computer's rods follow the ball (with a little lag and wobble) and aim at the open side of the goal.
  function brain(S, side, lv, dt, mem) {
    mem.t = (mem.t || 0) - dt; if (mem.t <= 0) { mem.t = lv.react; mem.err = (Math.random() - 0.5) * 2 * lv.err; mem.by = S.b.y + S.b.vy * lv.react; }
    const ty = mem.by + mem.err;
    RODS[side].forEach((rod, k) => { const ys = menY(rod, 0); let best = ys[0]; for (const y of ys) if (Math.abs(y - ty) < Math.abs(best - ty)) best = y; const want = ty - best + (k === 0 ? 0 : 0), [lo, hi] = range(rod), cur = S.off[side][k], d = Math.max(lo, Math.min(hi, want)) - cur, lim = lv.sp * dt; S.off[side][k] = cur + Math.max(-lim, Math.min(lim, d)); });
    const opp = S.off[side === "you" ? "kin" : "you"][0] + H / 2; S.aim = opp > H / 2 ? H / 2 - 30 : H / 2 + 30;
  }
  const E = { W, H, TO, RODS, LV, fresh, step, brain, menY, range };
  if (typeof module === "object" && module.exports) { module.exports = E; return; }
  const PH = root.PH, AR = root.AR, K = root.Kit;
  root.KG.add({
    id: "foosball", title: "Foosball", icon: "⚽",
    rules: "Slide your mouse or finger up and down to move all four of your rods at once (orange, shooting right). A man kicks the ball when it touches him; where it hits him steers the shot. Hold the mouse button or keep your finger down to spin the rods for a harder shot. First to 5 goals wins. Real time: the app plays the blue rods at the level you set.",
    achievements: [
      { id: "goalie", icon: "🥅", name: "Goalie Goal", about: "Score straight from your goalie." },
      { id: "shutout", icon: "🧱", name: "Clean Sheet", about: "Win without letting in a goal." },
    ],
    mount(api) {
      const lv = LV[api.settings.level] || LV.normal, to = K.fast ? 2 : TO;
      const bar = AR.scoreBar(api, api.el), v = PH.view(api.el, W, H, 0.6), ctx = v.ctx, P = AR.pointer(v);
      let S = api.state && api.state.b ? api.state : null, stop = null, dead = false, pause = 1, flash = null, lastKick = null, prevPY = null;
      if (!S) S = { score: [0, 0], ...fresh(Math.random() < 0.5 ? "you" : "kin") };
      const memK = {}, memY = {};
      function draw() {
        bar(S.score[0], S.score[1], `First to ${to}`);
        AR.rails(ctx, 0, 0, W, H, 0, 6);
        const g = ctx.createLinearGradient(0, 0, W, 0); g.addColorStop(0, "#2f8f46"); g.addColorStop(0.5, "#3aa553"); g.addColorStop(1, "#2f8f46"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        for (let x = 0; x < W; x += 52) { ctx.fillStyle = (x / 52) % 2 ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.04)"; ctx.fillRect(x, 0, 52, H); }
        ctx.strokeStyle = "rgba(255,255,255,.75)"; ctx.lineWidth = 2; ctx.strokeRect(3, 3, W - 6, H - 6); ctx.beginPath(); ctx.moveTo(W / 2, 3); ctx.lineTo(W / 2, H - 3); ctx.stroke(); ctx.beginPath(); ctx.arc(W / 2, H / 2, 40, 0, 7); ctx.stroke();
        ctx.strokeRect(3, H / 2 - 70, 60, 140); ctx.strokeRect(W - 63, H / 2 - 70, 60, 140);
        ctx.fillStyle = "#111"; ctx.fillRect(0, H / 2 - GOAL / 2, 4, GOAL); ctx.fillRect(W - 4, H / 2 - GOAL / 2, 4, GOAL);
        AR.glossy(ctx, S.b.x, S.b.y, BR, "#fff", "#9a9a9a");
        for (const side of ["kin", "you"]) RODS[side].forEach((rod, k) => {
          const gr = ctx.createLinearGradient(rod[0] - 3, 0, rod[0] + 3, 0); gr.addColorStop(0, "#777"); gr.addColorStop(0.5, "#f2f2f2"); gr.addColorStop(1, "#666"); ctx.fillStyle = gr; ctx.fillRect(rod[0] - 2.5, -4, 5, H + 8);
          for (const my of menY(rod, S.off[side][k])) { const c = side === "you" ? ["#ff8a3d", "#a8400d"] : ["#4aa3ff", "#174e96"]; ctx.fillStyle = "rgba(0,0,0,.3)"; ctx.fillRect(rod[0] - MW + 3, my - MH + 3, MW * 2, MH * 2); const gm = ctx.createLinearGradient(rod[0] - MW, 0, rod[0] + MW, 0); gm.addColorStop(0, c[1]); gm.addColorStop(0.5, c[0]); gm.addColorStop(1, c[1]); ctx.fillStyle = gm; ctx.beginPath(); ctx.roundRect(rod[0] - MW, my - MH, MW * 2, MH * 2, 4); ctx.fill(); ctx.fillStyle = "#f3d2b0"; ctx.beginPath(); ctx.arc(rod[0], my, 3.6, 0, 7); ctx.fill(); }
        });
        if (flash) AR.glowText(ctx, flash.t, W / 2, H / 2, 38, flash.c);
      }
      function goal(by) {
        const i = by === "you" ? 0 : 1; S.score[i]++; K.sfx.goal(); flash = { t: by === "you" ? "GOAL!" : `${api.kinName()} scores`, c: by === "you" ? "#ff8a3d" : "#4aa3ff" }; setTimeout(() => (flash = null), 900);
        if (by === "you" && lastKick === "you0") api.achieve("goalie", "you"); if (by === "kin" && lastKick === "kin0") api.achieve("goalie", "kin");
        api.save(S);
        if (S.score[i] >= to) { stop(); const [a, b] = S.score; if ((by === "you" ? b : a) === 0) api.achieve("shutout", by); api.over(by, `${Math.max(a, b)} goals to ${Math.min(a, b)}`); return; }
        if (by === "kin" || S.score[0] % 2 === 0) api.line(`Foosball: it's ${S.score[0]}–${S.score[1]} (you have ${S.score[1]}).`);
        Object.assign(S, fresh(by === "you" ? "kin" : "you")); pause = 0.8;
      }
      function tick(dt) {
        if (dead || api.ended()) return;
        if (K.autoplay) brain(S, "you", LV.hard, dt, memY);
        else if (P.y != null) { const vy = prevPY == null ? 0 : (P.y - prevPY) / dt; prevPY = P.y; S.vyou = vy; RODS.you.forEach((rod, k) => { const ys = menY(rod, 0); let best = ys[0]; for (const y of ys) if (Math.abs(y - P.y) < Math.abs(best - P.y)) best = y; const [lo, hi] = range(rod); S.off.you[k] = Math.max(lo, Math.min(hi, P.y - best)); }); }
        brain(S, "kin", lv, dt, memK);
        if (pause > 0) { pause -= dt; return; }
        const before = S.cool ? { ...S.cool } : {}, r = step(S, dt, { you: K.autoplay ? Math.random() < 0.3 : P.down, kin: Math.random() < (lv === LV.hard ? 0.5 : 0.25) });
        if (r === "kick") { K.sfx.clack(); for (const k in S.cool) if (S.cool[k] > 0.11 && !(before[k] > 0)) lastKick = k; } else if (r === "wall") K.sfx.wall(); else if (r === "you" || r === "kin") goal(r);
        if (Math.hypot(S.b.vx, S.b.vy) < 25) { S.b.vx += (Math.random() - 0.5) * 30; S.b.vy += (Math.random() - 0.5) * 30; }
      }
      stop = AR.loop(tick, draw, { speed: K.fast ? 3 : 1 });
      api.status("Slide up and down to move your rods; hold to spin.");
      const onResize = () => { v.fit(); draw(); }; addEventListener("resize", onResize);
      return { destroy() { dead = true; stop(); removeEventListener("resize", onResize); } };
    },
  });
})(typeof self !== "undefined" ? self : this);
