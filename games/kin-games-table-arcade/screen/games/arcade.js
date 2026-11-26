// Shared bits for the table & arcade games: a fixed-step game loop, a pointer tracker, seeded noise for
// repeatable shots, and drawing helpers (wood rails, glossy pucks and balls, glow text).
(function (root) {
  "use strict";
  // Seeded random so a shot's wobble is the same when it's animated and when it's recorded.
  function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
  function gaussR(r) { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const AR = { rng, gaussR, clamp };
  if (typeof module === "object" && module.exports) { module.exports = AR; return; }
  // A loop that steps the world at a fixed rate (timer-driven so it keeps going in the background). Returns stop().
  AR.loop = function (step, draw, opts) {
    const o = opts || {}, DT = o.dt || 1 / 120, speed = o.speed || 1; let last = performance.now(), acc = 0, on = true;
    const frame = () => { if (!on) return; const t = performance.now(); acc += Math.min(0.1, (t - last) / 1000) * speed; last = t; while (acc >= DT) { step(DT); acc -= DT; if (!on) return; } draw(); setTimeout(frame, 16); };
    setTimeout(frame, 16); return () => { on = false; };
  };
  // Tracks where the pointer is over a canvas, in world units.
  AR.pointer = function (view) {
    const P = { x: null, y: null, down: false }, upd = (e) => { const p = view.toWorld(e); P.x = p.x; P.y = p.y; };
    view.cv.style.touchAction = "none";
    view.cv.addEventListener("pointermove", upd); view.cv.addEventListener("pointerdown", (e) => { upd(e); P.down = true; try { view.cv.setPointerCapture(e.pointerId); } catch {} });
    view.cv.addEventListener("pointerup", () => (P.down = false)); view.cv.addEventListener("pointercancel", () => (P.down = false));
    return P;
  };
  AR.glossy = function (ctx, x, y, r, col, rim) {
    ctx.save(); ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.beginPath(); ctx.ellipse(x + r * 0.15, y + r * 0.3, r, r * 0.9, 0, 0, 7); ctx.fill();
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r); g.addColorStop(0, "#fff"); g.addColorStop(0.25, col); g.addColorStop(1, rim || "#000");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.restore();
  };
  AR.puck = function (ctx, x, y, r, col, dark) {
    ctx.save(); ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.beginPath(); ctx.arc(x + 2, y + 3, r, 0, 7); ctx.fill();
    ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(x, y + 1.5, r, 0, 7); ctx.fill();
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r); g.addColorStop(0, "#ffffffcc"); g.addColorStop(0.3, col); g.addColorStop(1, dark);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.lineWidth = r * 0.12; ctx.beginPath(); ctx.arc(x, y, r * 0.62, 0, 7); ctx.stroke(); ctx.restore();
  };
  AR.rails = function (ctx, x, y, w, h, t, r) {
    ctx.save(); const g = ctx.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, "#7a4a22"); g.addColorStop(0.5, "#a06a35"); g.addColorStop(1, "#5a3315");
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(x - t, y - t, w + 2 * t, h + 2 * t, r || 10); ctx.fill();
    ctx.strokeStyle = "rgba(255,230,190,.35)"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.roundRect(x - t + 1.5, y - t + 1.5, w + 2 * t - 3, h + 2 * t - 3, r || 10); ctx.stroke(); ctx.restore();
  };
  AR.glowText = function (ctx, txt, x, y, size, col) { ctx.save(); ctx.font = `800 ${size}px Georgia,serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.shadowColor = col; ctx.shadowBlur = size * 0.6; ctx.fillStyle = "#fff"; ctx.fillText(txt, x, y); ctx.restore(); };
  AR.scoreBar = function (api, el) { const bar = document.createElement("div"); bar.className = "pbar"; el.append(bar); return (a, b, extra) => { bar.innerHTML = `<div class="pchip you"><b>You</b><span>${a}</span></div><div class="pchip kin"><b></b><span>${b}</span></div>${extra ? `<div class="hint">${extra}</div>` : ""}`; bar.querySelector(".kin b").textContent = api.kinName(); }; };
  root.AR = AR;
})(typeof self !== "undefined" ? self : this);
