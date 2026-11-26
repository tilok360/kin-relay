// Air Hockey: real time on a glowing rink. Your mallet follows your finger in the bottom half; the app plays your Kin's
// mallet (or the computer's) at the level set. First to 7 goals.
(function (root) {
  "use strict";
  const W = 300, H = 480, GOAL = 104, PR = 13, MR = 22, TO = 7;
  const LV = { beginner: { sp: 230, react: 0.35, aim: 0.5, def: 0.4 }, easy: { sp: 330, react: 0.22, aim: 0.35, def: 0.5 }, normal: { sp: 470, react: 0.14, aim: 0.18, def: 0.6 }, hard: { sp: 640, react: 0.07, aim: 0.06, def: 0.72 } };
  // Puck against a moving mallet: bounce off it, carrying some of the mallet's speed.
  function strike(p, m, mvx, mvy) {
    const dx = p.x - m.x, dy = p.y - m.y, d = Math.hypot(dx, dy), rr = PR + MR; if (d >= rr || d < 1e-6) return false;
    const nx = dx / d, ny = dy / d; p.x = m.x + nx * rr; p.y = m.y + ny * rr;
    const rvx = p.vx - mvx, rvy = p.vy - mvy, vn = rvx * nx + rvy * ny;
    if (vn < 0) { p.vx -= 1.9 * vn * nx; p.vy -= 1.9 * vn * ny; p.vx += mvx * 0.6; p.vy += mvy * 0.6; }
    const s = Math.hypot(p.vx, p.vy), MAX = 900; if (s > MAX) { p.vx *= MAX / s; p.vy *= MAX / s; }
    return true;
  }
  // One physics step. Returns "you" / "kin" when a goal is scored (by that side), "hit" or "wall" for sounds.
  function step(S, dt) {
    const p = S.p; p.x += p.vx * dt; p.y += p.vy * dt; const f = Math.pow(0.985, dt * 60); p.vx *= f; p.vy *= f; let ev = null;
    for (const [m, k] of [[S.you, "you"], [S.kin, "kin"]]) if (strike(p, m, m.vx, m.vy)) { ev = "hit"; S.lastHit = k; if (m.aim) { const sp = Math.max(420, Math.hypot(p.vx, p.vy)), ax = m.aim.x - p.x, ay = m.aim.y - p.y, al = Math.hypot(ax, ay) || 1; p.vx = p.vx * 0.15 + (ax / al) * sp * 0.85; p.vy = p.vy * 0.15 + (ay / al) * sp * 0.85; } }
    const inMouth = Math.abs(p.x - W / 2) < GOAL / 2 - PR * 0.3;
    if (p.x < PR) { p.x = PR; p.vx = Math.abs(p.vx) * 0.9; ev = ev || "wall"; } if (p.x > W - PR) { p.x = W - PR; p.vx = -Math.abs(p.vx) * 0.9; ev = ev || "wall"; }
    if (!inMouth) { if (p.y < PR) { p.y = PR; p.vy = Math.abs(p.vy) * 0.9; ev = ev || "wall"; } if (p.y > H - PR) { p.y = H - PR; p.vy = -Math.abs(p.vy) * 0.9; ev = ev || "wall"; } }
    if (p.y < -PR) return "you"; if (p.y > H + PR) return "kin";
    // a mallet pinning the puck to the rail gets pushed back off it
    for (const m of [S.you, S.kin]) { const dx = m.x - p.x, dy = m.y - p.y, d = Math.hypot(dx, dy), rr = PR + MR; if (d < rr && d > 1e-6) { m.x = p.x + (dx / d) * rr; m.y = p.y + (dy / d) * rr; } }
    return ev;
  }
  function moveMallet(m, tx, ty, maxSp, dt, top) {
    const dx = tx - m.x, dy = ty - m.y, d = Math.hypot(dx, dy), lim = maxSp * dt, k = d > lim ? lim / d : 1;
    const nx = m.x + dx * k, ny = m.y + dy * k, y0 = top ? MR : H / 2 + MR, y1 = top ? H / 2 - MR : H - MR;
    const cx = Math.max(MR, Math.min(W - MR, nx)), cy = Math.max(y0, Math.min(y1, ny));
    m.vx = (cx - m.x) / dt; m.vy = (cy - m.y) / dt; m.x = cx; m.y = cy;
  }
  // The computer's mallet: guard the goal, and strike when the puck is in its half and slow or coming.
  function brain(S, side, lv, dt, mem) {
    const m = S[side], p = S.p, top = side === "kin", dir = top ? 1 : -1, home = top ? 46 : H - 46, inHalf = top ? p.y < H / 2 : p.y > H / 2;
    mem.t = (mem.t || 0) - dt; mem.drive = (mem.drive || 0) - dt; if (mem.t <= 0) { mem.t = lv.react; mem.err = (Math.random() - 0.5) * 60 * lv.aim; mem.tx = null; }
    let tx, ty;
    const coming = top ? p.vy < -40 : p.vy > 40;
    if (inHalf && (!coming || (Math.abs(p.y - m.y) < 70 && Math.abs(p.vy) < 320))) {
      const opp = S[top ? "you" : "kin"], gx = W / 2 + (opp.x > W / 2 ? -40 : 40) + mem.err * 1.5, gy = top ? H + 30 : -30;
      const ux = p.x - gx, uy = p.y - gy, ul = Math.hypot(ux, uy) || 1, nx = ux / ul, ny = uy / ul; // points from the goal back through the puck
      const mx = m.x - p.x, my = m.y - p.y, ml = Math.hypot(mx, my) || 1, dot = (mx * nx + my * ny) / ml, bx = p.x + nx * (PR + MR + 10), by = p.y + ny * (PR + MR + 10);
      if (!(mem.drive > 0) && dot > 0.6 && Math.hypot(m.x - bx, m.y - by) < 16) mem.drive = 0.35;
      m.aim = null; if (mem.drive > 0) { tx = p.x - nx * 40; ty = p.y - ny * 40; m.aim = { x: gx, y: gy }; }
      else if (dot < 0.2) { const side = mx * ny - my * nx > 0 ? 1 : -1; tx = p.x + ny * side * (PR + MR + 8) + nx * 10; ty = p.y - nx * side * (PR + MR + 8) + ny * 10; }
      else { tx = bx; ty = by; }
    }
    else { m.aim = null; const t = coming ? Math.abs((home - p.y) / (p.vy || 1)) : 0; let px = p.x + p.vx * Math.min(t, 1.2); while (px < 0 || px > W) px = px < 0 ? -px : 2 * W - px; tx = W / 2 + (px - W / 2) * 0.4 + mem.err * 1.6; ty = home; return moveMallet(m, tx, ty, lv.sp * lv.def, dt, top); }
    moveMallet(m, tx, ty, lv.sp, dt, top);
  }
  const E = { W, H, GOAL, PR, MR, TO, step, strike, moveMallet, brain, LV };
  if (typeof module === "object" && module.exports) { module.exports = E; return; }
  const PH = root.PH, AR = root.AR, K = root.Kit;
  root.KG.add({
    id: "airhockey", title: "Air Hockey", icon: "🏒",
    rules: "Your mallet follows your finger or mouse in the bottom half of the rink. Hit the puck into the slot at the far end to score; guard your own slot. The puck banks off the rails. First to 7 goals wins. It's real time: the app plays the other mallet at the level you set (with your Kin, your Kin cheers along).",
    achievements: [
      { id: "shutout", icon: "🧤", name: "Brick Wall", about: "Win without letting in a goal." },
      { id: "bank", icon: "↗️", name: "Bank Shot", about: "Score off a rail." },
      { id: "comeback", icon: "🔁", name: "Comeback", about: "Win after being three goals down." },
    ],
    mount(api) {
      const lv = LV[api.settings.level] || LV.normal, to = K.fast ? 2 : TO;
      const bar = AR.scoreBar(api, api.el), v = PH.view(api.el, W, H, 0.66), ctx = v.ctx, P = AR.pointer(v);
      let S = api.state && api.state.p ? api.state : null, stop = null, dead = false, pause = 0, flash = null, deficit = 0, bankWall = false;
      const reset = (toward) => { S.p = { x: W / 2, y: H / 2 + (toward === "you" ? 40 : -40), vx: 0, vy: 0 }; S.you = { x: W / 2, y: H - 50, vx: 0, vy: 0 }; S.kin = { x: W / 2, y: 50, vx: 0, vy: 0 }; pause = 0.9; };
      if (!S) { S = { score: [0, 0] }; reset(Math.random() < 0.5 ? "you" : "kin"); }
      const memK = {}, memY = {};
      function draw() {
        bar(S.score[0], S.score[1], `First to ${to}`);
        ctx.clearRect(0, 0, W, H);
        const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#dff3ff"); g.addColorStop(0.5, "#f4fbff"); g.addColorStop(1, "#dff3ff"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "rgba(80,140,190,.12)"; for (let y = 8; y < H; y += 16) for (let x = 8 + ((y / 16) % 2) * 8; x < W; x += 16) ctx.fillRect(x, y, 1.4, 1.4);
        ctx.strokeStyle = "#e53b3b"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke();
        ctx.strokeStyle = "#3d7fd8"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(W / 2, H / 2, 46, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.arc(W / 2, 0, 64, 0, Math.PI); ctx.stroke(); ctx.beginPath(); ctx.arc(W / 2, H, 64, Math.PI, 0); ctx.stroke();
        ctx.fillStyle = "#1b2633"; ctx.fillRect(W / 2 - GOAL / 2, 0, GOAL, 6); ctx.fillRect(W / 2 - GOAL / 2, H - 6, GOAL, 6);
        ctx.save(); ctx.shadowColor = "#7cd4ff"; ctx.shadowBlur = 16; ctx.strokeStyle = "#7cd4ff"; ctx.lineWidth = 4; ctx.strokeRect(2, 2, W - 4, H - 4); ctx.restore();
        AR.puck(ctx, S.p.x, S.p.y, PR, "#2b2b33", "#0b0b10");
        for (const [m, c, d] of [[S.you, "#ff7a3d", "#a8360d"], [S.kin, "#4aa3ff", "#1a4f99"]]) { AR.puck(ctx, m.x, m.y, MR, c, d); ctx.fillStyle = d; ctx.beginPath(); ctx.arc(m.x, m.y, MR * 0.4, 0, 7); ctx.fill(); AR.glossy(ctx, m.x, m.y - 1, MR * 0.32, c, d); }
        if (flash) AR.glowText(ctx, flash.t, W / 2, H / 2, 40, flash.c);
      }
      function goal(by) {
        const i = by === "you" ? 0 : 1; S.score[i]++; K.sfx.goal(); flash = { t: by === "you" ? "GOAL!" : `${api.kinName()} scores`, c: by === "you" ? "#ff7a3d" : "#4aa3ff" }; setTimeout(() => (flash = null), 900);
        if (by === "you" && bankWall) api.achieve("bank", "you"); if (by === "kin" && bankWall) api.achieve("bank", "kin");
        deficit = Math.max(deficit, S.score[1] - S.score[0]); api.save(S);
        if (S.score[i] >= to) { stop(); const w = by, [a, b] = S.score; if ((w === "you" ? b : a) === 0) api.achieve("shutout", w); if (w === "you" && deficit >= 3) api.achieve("comeback", "you"); api.over(w, `${Math.max(a, b)} goals to ${Math.min(a, b)}`); return; }
        if (by === "kin" || S.score[0] % 3 === 0) api.line(`Air hockey: it's ${S.score[0]}–${S.score[1]} (you have ${S.score[1]}).`);
        reset(by === "you" ? "kin" : "you");
      }
      function tick(dt) {
        if (dead || api.ended()) return;
        if (K.autoplay) { if (pause <= 0) brain(S, "you", { sp: 640, react: 0.07, aim: 0.06, def: 0.3 }, dt, memY); } else if (P.x != null) moveMallet(S.you, P.x, P.y, 2200, dt, false); else moveMallet(S.you, S.you.x, S.you.y, 1, dt, false);
        if (pause > 0) { pause -= dt; S.p.vx = S.p.vy = 0; for (const m of [S.you, S.kin]) { const dx = m.x - S.p.x, dy = m.y - S.p.y, d = Math.hypot(dx, dy), rr = PR + MR + 2; if (d < rr) { const k = d > 1e-6 ? rr / d : 1; m.x = S.p.x + dx * k; m.y = S.p.y + (d > 1e-6 ? dy * k : (m === S.you ? rr : -rr)); } m.vx = m.vy = 0; } return; }
        brain(S, "kin", lv, dt, memK);
        const r = step(S, dt);
        if (r === "wall") { bankWall = true; K.sfx.wall(); } else if (r === "hit") { bankWall = false; K.sfx.clack(); }
        else if (r === "you" || r === "kin") { goal(r); bankWall = false; }
        // a puck stuck slow in a corner gets nudged
        if (Math.hypot(S.p.vx, S.p.vy) < 6 && (S.p.y < 30 || S.p.y > H - 30) && Math.abs(S.p.x - W / 2) > 60) { S.p.vx += (W / 2 - S.p.x) * 0.2; }
      }
      stop = AR.loop(tick, draw, { speed: K.fast ? 3 : 1 });
      api.status("Move your mallet with your finger or mouse.");
      const onResize = () => { v.fit(); draw(); }; addEventListener("resize", onResize);
      return { destroy() { dead = true; stop(); removeEventListener("resize", onResize); } };
    },
  });
})(typeof self !== "undefined" ? self : this);
