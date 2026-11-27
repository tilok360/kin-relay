// A small table physics engine shared by carrom, pool and mini golf, plus the aiming control and drawing helpers.
// Balls slide with steady friction, bounce off wall segments and each other, and drop into pockets.
(function (root) {
  "use strict";
  const DT = 1 / 240;
  function clone(world) { return { ...world, balls: world.balls.map((b) => ({ ...b })) }; }
  const speed = (b) => Math.hypot(b.vx, b.vy);
  function moving(world) { return world.balls.some((b) => !b.gone && (b.vx || b.vy)); }
  function step(world, ev) {
    const balls = world.balls;
    for (const b of balls) {
      if (b.gone || (!b.vx && !b.vy)) continue;
      let fr = world.friction;
      if (world.zones) for (const z of world.zones) if (b.x > z.x1 && b.x < z.x2 && b.y > z.y1 && b.y < z.y2) { if (z.friction) fr = z.friction; if (z.water && !b.wet) { b.wet = true; b.vx = 0; b.vy = 0; ev.push({ type: "water", id: b.id }); } }
      if (b.wet) continue;
      const s = speed(b), ns = Math.max(0, s - fr * DT);
      if (ns < (world.stopSpeed || 0.6)) { b.vx = 0; b.vy = 0; continue; }
      b.vx *= ns / s; b.vy *= ns / s;
      b.x += b.vx * DT; b.y += b.vy * DT;
      for (let k = 0; k < world.pockets.length; k++) {
        const p = world.pockets[k];
        if (Math.hypot(b.x - p.x, b.y - p.y) < p.r && (p.maxSpeed == null || ns <= p.maxSpeed)) { b.gone = true; b.vx = b.vy = 0; ev.push({ type: "pocket", id: b.id, pocket: k }); break; }
      }
      if (b.gone) continue;
      for (const w of world.walls) {
        const ex = w.x2 - w.x1, ey = w.y2 - w.y1, L2 = ex * ex + ey * ey;
        let t = L2 ? ((b.x - w.x1) * ex + (b.y - w.y1) * ey) / L2 : 0; t = Math.max(0, Math.min(1, t));
        const cx = w.x1 + t * ex, cy = w.y1 + t * ey, dx = b.x - cx, dy = b.y - cy, d = Math.hypot(dx, dy);
        if (d < b.r && d > 1e-9) {
          const nx = dx / d, ny = dy / d, vn = b.vx * nx + b.vy * ny;
          if (vn < 0) { const e = world.wallRest; b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny; ev.push({ type: "wall", id: b.id }); }
          b.x = cx + nx * b.r; b.y = cy + ny * b.r;
        }
      }
    }
    for (let i = 0; i < balls.length; i++) {
      const a = balls[i]; if (a.gone) continue;
      for (let j = i + 1; j < balls.length; j++) {
        const b = balls[j]; if (b.gone) continue;
        if (world.ghosts && (a.ghost || b.ghost)) continue;
        const dx = b.x - a.x, dy = b.y - a.y, rr = a.r + b.r;
        if (dx > rr || dx < -rr || dy > rr || dy < -rr) continue;
        const d = Math.hypot(dx, dy); if (d >= rr || d < 1e-9) continue;
        const nx = dx / d, ny = dy / d, rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
        const ma = a.m || 1, mb = b.m || 1;
        if (rel > 0) {
          const J = (1 + world.ballRest) * rel / (1 / ma + 1 / mb);
          a.vx -= (J / ma) * nx; a.vy -= (J / ma) * ny; b.vx += (J / mb) * nx; b.vy += (J / mb) * ny;
          ev.push({ type: "hit", a: a.id, b: b.id });
        }
        const over = rr - d, ta = mb / (ma + mb), tb = ma / (ma + mb);
        a.x -= nx * over * ta; a.y -= ny * over * ta; b.x += nx * over * tb; b.y += ny * over * tb;
      }
    }
  }
  // Runs a shot to the end (or `limit` seconds). Returns the events.
  function simulate(world, limit) {
    const ev = [], n = Math.round((limit || 25) / DT);
    for (let k = 0; k < n && moving(world); k++) step(world, ev);
    return ev;
  }
  const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const firstHit = (ev, id) => { const h = ev.find((e) => e.type === "hit" && (e.a === id || e.b === id)); return h ? (h.a === id ? h.b : h.a) : null; };
  const E = { DT, clone, step, simulate, moving, speed, gauss, firstHit };
  if (typeof module === "object" && module.exports) { module.exports = E; return; }

  // ---------- on screen ----------
  // A canvas that fits its world (w x h units) into the stage, no taller than most of the window.
  E.view = function (stage, w, h, maxH) {
    const cv = document.createElement("canvas"); cv.className = "cv"; stage.append(cv);
    const ctx = cv.getContext("2d"), v = { cv, ctx, s: 1, W: 0, H: 0 };
    v.fit = () => {
      const room = Math.min(stage.clientWidth || 360, 560), tall = (maxH || 0.72) * (window.innerHeight || 800);
      v.s = Math.min(room / w, tall / h); v.W = Math.round(w * v.s); v.H = Math.round(h * v.s);
      const dpr = window.devicePixelRatio || 1;
      cv.width = v.W * dpr; cv.height = v.H * dpr; cv.style.width = v.W + "px"; cv.style.height = v.H + "px"; cv.style.margin = "0 auto";
      ctx.setTransform(dpr * v.s, 0, 0, dpr * v.s, 0, 0);
    };
    v.toWorld = (ev) => { const r = cv.getBoundingClientRect(); return { x: (ev.clientX - r.left) / v.s, y: (ev.clientY - r.top) / v.s }; };
    v.fit();
    return v;
  };
  // Pull back from the ball and let go: the shot goes the other way, harder the farther you pull.
  E.aim = function (view, opts) {
    let drag = null;
    const cv = view.cv;
    const down = (ev) => {
      if (!opts.enabled()) return;
      const p = view.toWorld(ev), b = opts.ball();
      if (opts.grab && opts.grab(p)) return;
      drag = { x0: p.x, y0: p.y, b }; (() => { try { cv.setPointerCapture(ev.pointerId); } catch {} })(); move(ev);
    };
    const move = (ev) => {
      if (!drag) return;
      const p = view.toWorld(ev), b = drag.b, dx = b.x - p.x, dy = b.y - p.y, len = Math.hypot(dx, dy);
      const power = Math.min(1, len / (opts.reach || 40));
      drag.angle = Math.atan2(dy, dx); drag.power = power;
      opts.onAim({ angle: drag.angle, power });
    };
    const up = () => {
      if (!drag) return;
      const d = drag; drag = null; opts.onAim(null);
      if (d.power > 0.04) opts.onShoot(d.angle, d.power);
    };
    cv.addEventListener("pointerdown", down); cv.addEventListener("pointermove", move);
    cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", () => { drag = null; opts.onAim(null); });
  };
  E.ball = function (ctx, b, fill, rim, label, stripe) {
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fillStyle = stripe ? "#f7f3ea" : fill; ctx.fill();
    if (stripe) { ctx.save(); ctx.clip(); ctx.fillStyle = fill; ctx.fillRect(b.x - b.r, b.y - b.r * 0.55, b.r * 2, b.r * 1.1); ctx.restore(); }
    ctx.lineWidth = b.r * 0.14; ctx.strokeStyle = rim || "rgba(0,0,0,.35)"; ctx.stroke();
    // a soft shadow side and a glossy highlight, so balls look round
    ctx.save(); const sh = ctx.createRadialGradient(b.x - b.r * 0.35, b.y - b.r * 0.4, b.r * 0.05, b.x, b.y, b.r * 1.05); sh.addColorStop(0, "rgba(255,255,255,.75)"); sh.addColorStop(0.25, "rgba(255,255,255,.08)"); sh.addColorStop(0.75, "rgba(0,0,0,0)"); sh.addColorStop(1, "rgba(0,0,0,.35)");
    ctx.fillStyle = sh; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    if (label) { ctx.fillStyle = stripe || fill === "#f7f3ea" ? "#222" : "#fff"; ctx.font = `700 ${b.r * 1.05}px system-ui`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(label, b.x, b.y + b.r * 0.05); ctx.textBaseline = "alphabetic"; }
  };
  E.aimLine = function (ctx, b, a, power, len, width) {
    ctx.save(); ctx.setLineDash([1.5, 2.5]); ctx.lineWidth = width || 0.6; ctx.strokeStyle = "rgba(255,255,255,.8)";
    ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x + Math.cos(a) * len, b.y + Math.sin(a) * len); ctx.stroke(); ctx.restore();
    ctx.save(); ctx.lineWidth = (width || 0.6) * 2; ctx.strokeStyle = `hsl(${120 - power * 120},80%,60%)`;
    ctx.beginPath(); ctx.moveTo(b.x - Math.cos(a) * (b.r + 1), b.y - Math.sin(a) * (b.r + 1)); ctx.lineTo(b.x - Math.cos(a) * (b.r + 1 + power * 18), b.y - Math.sin(a) * (b.r + 1 + power * 18)); ctx.stroke(); ctx.restore();
  };
  // Plays a world forward on screen until it stops; `draw` paints each frame. Resolves with the events.
  E.animate = function (world, draw, isDead) {
    return new Promise((res) => {
      const ev = []; let last = performance.now(), acc = 0;
      // A timer rather than animation frames, so a shot still finishes if the screen is in the background.
      const frame = () => {
        if (isDead && isDead()) return res(ev);
        const t = performance.now();
        acc += Math.min(0.5, (t - last) / 1000); last = t;
        while (acc >= DT) { step(world, ev); acc -= DT; }
        draw();
        if (moving(world)) setTimeout(frame, 16); else res(ev);
      };
      setTimeout(frame, 16);
    });
  };
  // How far off the app's own shots go, by level: angle (radians) and power spread.
  E.spread = (level) => (level === "beginner" ? { a: 0.08, p: 0.2 } : level === "easy" ? { a: 0.045, p: 0.12 } : level === "hard" ? { a: 0.006, p: 0.03 } : { a: 0.018, p: 0.06 });
  E.wait = (ms) => new Promise((r) => setTimeout(r, ms));
  root.PH = E;
})(typeof self !== "undefined" ? self : this);
