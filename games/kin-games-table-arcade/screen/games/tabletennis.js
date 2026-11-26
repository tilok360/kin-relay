// Table Tennis: real time, seen from above. Your paddle follows your finger at the near end; return the ball after
// it bounces once on your side and land it on theirs. Serve changes every two points. First to 11, win by 2.
(function (root) {
  "use strict";
  const W = 300, H = 560, TX = 30, TY = 60, TW = 240, TH = 440, NET = TY + TH / 2, G = 900, PR = 26, TO = 11;
  const LV = { beginner: { sp: 220, react: 0.3, err: 46, out: 0.16 }, easy: { sp: 300, react: 0.2, err: 32, out: 0.09 }, normal: { sp: 400, react: 0.12, err: 20, out: 0.05 }, hard: { sp: 540, react: 0.07, err: 10, out: 0.02 } };
  const onTable = (x, y) => x >= TX && x <= TX + TW && y >= TY && y <= TY + TH;
  const half = (y) => (y > NET ? "you" : "kin");
  // Send the ball from where it is to land at (tx, ty) after flying at forward speed vy.
  function aimShot(b, tx, ty, speed) { const T = Math.abs(ty - b.y) / speed; b.vy = Math.sign(ty - b.y) * speed; b.vx = (tx - b.x) / T; b.vz = (G * T) / 2 - b.z / T; b.bounces = 0; }
  function serve(S) { const who = S.server, p = S[who]; S.b = { x: p.x, y: who === "you" ? TY + TH - 10 : TY + 10, z: 30, vx: 0, vy: 0, vz: 0, by: who, bounces: 0, live: false }; S.wait = 0.9; }
  function fresh(server) { const S = { score: [0, 0], server, served: 0, you: { x: W / 2, y: TY + TH + 20, vx: 0 }, kin: { x: W / 2, y: TY - 20, vx: 0 } }; serve(S); return S; }
  // Returns the side that won the point, or an event.
  function step(S, dt) {
    const b = S.b; if (!b.live) return null;
    b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; b.vz -= G * dt;
    if (b.z <= 0 && b.vz < 0) {
      if (!onTable(b.x, b.y)) return b.bounces === 0 ? other(b.by) : other(half(b.y));
      const side = half(b.y);
      if (side === b.by) return other(b.by); // landed on your own side
      b.bounces++; if (b.bounces >= 2) return b.by; // the receiver let it bounce twice
      b.z = 0; b.vz = -b.vz * 0.82; return "bounce";
    }
    if (b.y < -20 || b.y > H + 20 || b.x < -40 || b.x > W + 40) return b.bounces ? b.by : other(b.by);
    return null;
  }
  const other = (s) => (s === "you" ? "kin" : "you");
  // A paddle hits when the ball, after bouncing on its side, comes within reach.
  function tryHit(S, who, aim) {
    const b = S.b, p = S[who]; if (!b.live || b.by === who || b.bounces !== 1 || half(b.y) !== who) return false;
    if (Math.abs(b.y - p.y) > 22 || Math.abs(b.x - p.x) > PR + 6 || b.z > 90) return false;
    const off = (b.x - p.x) / PR, dir = who === "you" ? -1 : 1, tgt = aim(off, dir);
    aimShot(b, tgt.x, tgt.y, tgt.speed); b.by = who; return true;
  }
  function aiAim(lv) { return (off, dir) => { const ty = dir < 0 ? TY + 40 + Math.random() * (TH / 2 - 70) : NET + 30 + Math.random() * (TH / 2 - 70); let tx = TX + 20 + Math.random() * (TW - 40) + (Math.random() - 0.5) * lv.err; if (Math.random() < lv.out) tx = Math.random() < 0.5 ? TX - 20 : TX + TW + 20; return { x: tx, y: ty, speed: 360 + Math.random() * 160 }; }; }
  function brain(S, who, lv, dt, mem) {
    const p = S[who], b = S.b; mem.t = (mem.t || 0) - dt;
    if (mem.t <= 0) { mem.t = lv.react; let tx = W / 2; if (b.live && b.by !== who) { // predict where it crosses our hitting line
        const ly = p.y, T = (ly - b.y) / (b.vy || 1); tx = T > 0 ? b.x + b.vx * T : b.x; } mem.tx = tx + (Math.random() - 0.5) * lv.err * 0.6; }
    const d = mem.tx - p.x, lim = lv.sp * dt, nx = p.x + Math.max(-lim, Math.min(lim, d)); p.vx = (nx - p.x) / dt; p.x = nx;
  }
  const E = { W, H, TX, TY, TW, TH, NET, TO, LV, fresh, serve, step, tryHit, aimShot, aiAim, brain, other };
  if (typeof module === "object" && module.exports) { module.exports = E; return; }
  const PH = root.PH, AR = root.AR, K = root.Kit;
  root.KG.add({
    id: "tabletennis", title: "Table Tennis", icon: "🏓",
    rules: "Your paddle follows your finger or mouse at the near end. Let the ball bounce once on your side, then meet it: hitting it with the edge of the paddle angles the shot, and moving the paddle forward as you hit drives it deeper. The ball has to land on the far side. Serve changes every two points. First to 11 wins (by two clear). Real time: the app plays the far paddle at the level you set.",
    achievements: [
      { id: "rally", icon: "🔁", name: "Long Rally", about: "Win a point after a rally of ten hits." },
      { id: "ace", icon: "🎯", name: "Ace", about: "Win a point on your serve without a return." },
      { id: "love", icon: "🥚", name: "Bagel", about: "Win a game with your opponent on 3 points or fewer." },
    ],
    mount(api) {
      const lv = LV[api.settings.level] || LV.normal, to = K.fast ? 3 : TO;
      const bar = AR.scoreBar(api, api.el), v = PH.view(api.el, W, H, 0.7), ctx = v.ctx, P = AR.pointer(v);
      let S = api.state && api.state.b ? api.state : null, stop = null, dead = false, flash = null, hits = 0, lastPY = null;
      if (!S) S = fresh(Math.random() < 0.5 ? "you" : "kin");
      const memK = {}, memY = {}, kinAim = aiAim(lv);
      const youAim = (off, dir) => { if (K.autoplay) return aiAim(LV.normal)(off, dir); const push = Math.max(0, -(S.pvy || 0)); return { x: S.b.x + off * 150 + (S.you.vx || 0) * 0.12, y: TY + 40 + Math.max(0, TH / 2 - 80 - push * 0.08), speed: 380 + Math.min(260, push * 0.25) }; };
      function draw() {
        bar(S.score[0], S.score[1], `${S.server === "you" ? "Your" : api.kinName() + "'s"} serve · to ${to}`);
        ctx.fillStyle = "#1c2a3a"; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.fillRect(TX + 6, TY + 8, TW, TH);
        const g = ctx.createLinearGradient(0, TY, 0, TY + TH); g.addColorStop(0, "#1d5fa6"); g.addColorStop(1, "#2a76c6"); ctx.fillStyle = g; ctx.fillRect(TX, TY, TW, TH);
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 3; ctx.strokeRect(TX, TY, TW, TH); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(W / 2, TY); ctx.lineTo(W / 2, TY + TH); ctx.stroke();
        ctx.fillStyle = "#eee"; ctx.fillRect(TX - 10, NET - 2, TW + 20, 4); ctx.fillStyle = "rgba(255,255,255,.3)"; for (let x = TX - 10; x < TX + TW + 10; x += 6) ctx.fillRect(x, NET - 6, 1, 10);
        const b = S.b; ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.beginPath(); ctx.ellipse(b.x, b.y, 5, 3.5, 0, 0, 7); ctx.fill();
        AR.glossy(ctx, b.x, b.y - b.z * 0.45, 5 + b.z * 0.025, "#ffb347", "#c06a00");
        for (const [who, c] of [["kin", "#1d1d24"], ["you", "#d32f2f"]]) { const p = S[who]; ctx.save(); ctx.translate(p.x, p.y); ctx.fillStyle = "#c9a06b"; ctx.fillRect(-4, who === "you" ? PR - 4 : -PR - 14, 8, 18); ctx.fillStyle = "rgba(0,0,0,.3)"; ctx.beginPath(); ctx.ellipse(3, 4, PR, PR * 0.8, 0, 0, 7); ctx.fill(); const gp = ctx.createRadialGradient(-6, -6, 3, 0, 0, PR); gp.addColorStop(0, who === "you" ? "#ff6b6b" : "#555"); gp.addColorStop(1, c); ctx.fillStyle = gp; ctx.beginPath(); ctx.ellipse(0, 0, PR, PR * 0.8, 0, 0, 7); ctx.fill(); ctx.strokeStyle = who === "you" ? "#ffd0c0" : "#9fb6d0"; ctx.lineWidth = 2; ctx.stroke(); ctx.restore(); }
        if (flash) AR.glowText(ctx, flash.t, W / 2, NET, 30, flash.c);
      }
      function point(w) {
        const i = w === "you" ? 0 : 1; S.score[i]++; flash = { t: w === "you" ? "Your point" : `${api.kinName()}'s point`, c: w === "you" ? "#ff6b6b" : "#9ad" }; setTimeout(() => (flash = null), 800);
        w === "you" ? K.sfx.score() : K.sfx.thock();
        if (hits >= 10) api.achieve("rally", w); if (hits <= 1 && S.server === w) api.achieve("ace", w);
        hits = 0; const [a, c] = S.score;
        if (Math.max(a, c) >= to && Math.abs(a - c) >= 2) { stop(); api.save(S); if (Math.min(a, c) <= 3) api.achieve("love", w); api.over(w, `${Math.max(a, c)}–${Math.min(a, c)}`); return; }
        S.served++; const every = a >= to - 1 && c >= to - 1 ? 1 : 2; if (S.served >= every) { S.served = 0; S.server = other(S.server); }
        if (w === "kin" && (a + c) % 4 === 0) api.line(`Table tennis: it's ${a}–${c} (you have ${c}).`);
        serve(S); api.save(S);
      }
      function tick(dt) {
        if (dead || api.ended()) return;
        if (K.autoplay) brain(S, "you", LV.hard, dt, memY);
        else if (P.x != null) { const nx = Math.max(10, Math.min(W - 10, P.x)), ny = Math.max(NET + 60, Math.min(H - 10, P.y)); S.you.vx = (nx - S.you.x) / dt; S.pvy = lastPY == null ? 0 : (ny - lastPY) / dt; lastPY = ny; S.you.x = nx; S.you.y = ny; }
        brain(S, "kin", lv, dt, memK);
        if (S.wait > 0) { S.wait -= dt; const p = S[S.server]; S.b.x = p.x; if (S.wait <= 0) { S.b.live = true; S.b.by = S.server; const tgt = S.server === "you" ? (K.autoplay ? aiAim(LV.normal)(0, -1) : { x: TX + 30 + Math.random() * (TW - 60), y: TY + 60 + Math.random() * 100, speed: 400 }) : kinAim(0, 1); tgt.x = Math.max(TX + 10, Math.min(TX + TW - 10, tgt.x)); E.aimShot(S.b, tgt.x, tgt.y, tgt.speed); hits = 1; K.sfx.hit(); } return; }
        if (tryHit(S, "you", youAim) || tryHit(S, "kin", kinAim)) { hits++; K.sfx.hit(); return; }
        const r = step(S, dt);
        if (r === "bounce") K.sfx.tick(); else if (r === "you" || r === "kin") point(r);
      }
      stop = AR.loop(tick, draw, { speed: K.fast ? 3 : 1 });
      api.status("Move your paddle with your finger or mouse.");
      const onResize = () => { v.fit(); draw(); }; addEventListener("resize", onResize);
      return { destroy() { dead = true; stop(); removeEventListener("resize", onResize); } };
    },
  });
})(typeof self !== "undefined" ? self : this);
