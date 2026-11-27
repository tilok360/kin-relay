// Kin Battleship: the sea, the shells and the sound. Everything is drawn and synthesized here;
// no image or sound files are loaded and nothing is fetched.
(function (root) {
  "use strict";
  const reduce = () => root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- an animated sea on a canvas ----------
  const seas = [];
  function Sea(canvas) {
    this.c = canvas; this.ctx = canvas.getContext("2d"); this.seed = Math.random() * 1000;
    this.resize(); seas.push(this);
  }
  Sea.prototype.resize = function () {
    const r = this.c.getBoundingClientRect(), d = Math.min(2, root.devicePixelRatio || 1);
    this.w = Math.max(1, r.width); this.h = Math.max(1, r.height);
    this.c.width = Math.round(this.w * d); this.c.height = Math.round(this.h * d);
    this.ctx.setTransform(d, 0, 0, d, 0, 0);
  };
  Sea.prototype.draw = function (t) {
    const g = this.ctx, w = this.w, h = this.h, s = this.seed;
    const bg = g.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, "#0c4166"); bg.addColorStop(.5, "#0a3556"); bg.addColorStop(1, "#072640");
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    // slow light patches
    for (let k = 0; k < 4; k++) {
      const x = w * (0.5 + 0.45 * Math.sin(t * 0.00009 * (k + 1) + s + k * 2)), y = h * (0.5 + 0.45 * Math.cos(t * 0.00007 * (k + 2) + s * 0.7 + k));
      const rg = g.createRadialGradient(x, y, 0, x, y, w * 0.45);
      rg.addColorStop(0, "rgba(60,150,200,.16)"); rg.addColorStop(1, "rgba(60,150,200,0)");
      g.fillStyle = rg; g.fillRect(0, 0, w, h);
    }
    // wave crests
    g.lineCap = "round";
    const rows = 16;
    for (let r = 0; r < rows; r++) {
      const y0 = (r + 0.5) * h / rows;
      g.beginPath();
      for (let x = 0; x <= w; x += 6) {
        const y = y0 + Math.sin(x * 0.045 + t * 0.0016 + r * 1.7 + s) * 2.4 + Math.sin(x * 0.11 - t * 0.0011 + r) * 1.1;
        x === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
      }
      g.strokeStyle = `rgba(190,230,255,${0.05 + 0.05 * Math.sin(t * 0.0012 + r * 1.3 + s)})`;
      g.lineWidth = 1.2; g.stroke();
    }
    // sparkles
    for (let k = 0; k < 26; k++) {
      const px = ((Math.sin(k * 91.7 + s) * 0.5 + 0.5) * w + t * 0.004 * (k % 3 + 1)) % w;
      const py = (Math.cos(k * 53.3 + s) * 0.5 + 0.5) * h;
      const a = Math.max(0, Math.sin(t * 0.004 + k * 2.1)) * 0.55;
      if (a < 0.05) continue;
      g.fillStyle = `rgba(230,248,255,${a})`;
      g.fillRect(px, py, 2.2, 1.1);
    }
    // fog at the edges
    const v = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.75);
    v.addColorStop(0, "rgba(4,12,24,0)"); v.addColorStop(1, "rgba(4,12,24,.55)");
    g.fillStyle = v; g.fillRect(0, 0, w, h);
  };

  // ---------- shells, splashes, fire and smoke on one full-screen canvas ----------
  let fxc = null, fx = null, W = 0, H = 0, DPR = 1;
  const parts = [], shells = [], burners = [];
  function initFx(canvas) {
    fxc = canvas; fx = canvas.getContext("2d"); resizeFx();
    root.addEventListener("resize", () => { resizeFx(); seas.forEach((s) => s.resize()); });
  }
  function resizeFx() {
    if (!fxc) return;
    DPR = Math.min(2, root.devicePixelRatio || 1); W = root.innerWidth; H = root.innerHeight;
    fxc.width = Math.round(W * DPR); fxc.height = Math.round(H * DPR); fx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  const rnd = (a, b) => a + Math.random() * (b - a);
  function add(p) { if (parts.length < 900) parts.push(p); }

  function splash(x, y, scale) {
    const s = scale || 1, n = reduce() ? 8 : 34;
    add({ kind: "ring", x, y, r: 4 * s, vr: 70 * s, life: 0, max: 0.9, color: "rgba(220,245,255," });
    add({ kind: "ring", x, y, r: 2 * s, vr: 45 * s, life: 0, max: 1.1, color: "rgba(180,225,255," });
    for (let i = 0; i < n; i++) {
      const a = rnd(-Math.PI * 0.95, -Math.PI * 0.05), v = rnd(60, 260) * s;
      add({ kind: "drop", x, y, vx: Math.cos(a) * v * 0.55, vy: Math.sin(a) * v, g: 520, size: rnd(1.5, 3.6) * s, life: 0, max: rnd(.5, 1.1), color: Math.random() < .5 ? "#e9f8ff" : "#9fd6ff" });
    }
    if (!reduce()) add({ kind: "column", x, y, life: 0, max: 0.6, size: 16 * s });
  }
  function explode(x, y, scale) {
    const s = scale || 1, n = reduce() ? 10 : 46;
    add({ kind: "flash", x, y, r: 50 * s, life: 0, max: 0.28 });
    for (let i = 0; i < n; i++) {
      const a = rnd(0, Math.PI * 2), v = rnd(40, 300) * s;
      add({ kind: "spark", x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, g: 260, size: rnd(1.6, 4.2) * s, life: 0, max: rnd(.35, .95),
        color: ["#fff3c4", "#ffd27a", "#ff9b45", "#ff5a2a"][i % 4] });
    }
    for (let i = 0; i < (reduce() ? 2 : 10); i++) {
      add({ kind: "smoke", x: x + rnd(-8, 8), y: y + rnd(-6, 6), vx: rnd(-18, 18), vy: rnd(-46, -18), size: rnd(8, 16) * s, grow: rnd(18, 36), life: 0, max: rnd(1.3, 2.4), shade: rnd(30, 70) });
    }
    for (let i = 0; i < (reduce() ? 0 : 8); i++) {
      const a = rnd(-Math.PI, 0), v = rnd(90, 220) * s;
      add({ kind: "debris", x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 420, size: rnd(2, 4), rot: rnd(0, 6), vrot: rnd(-12, 12), life: 0, max: rnd(.8, 1.4) });
    }
  }
  function bubbles(x, y, w, h) {
    for (let i = 0; i < (reduce() ? 6 : 30); i++) add({ kind: "bubble", x: x + rnd(0, w), y: y + rnd(0, h), vx: rnd(-6, 6), vy: rnd(-34, -12), size: rnd(1.5, 4), life: 0, max: rnd(.9, 1.9) });
  }

  // A shell from (x0,y0) to (x1,y1) over a parabolic arc. Resolves when it lands.
  function shell(x0, y0, x1, y1, ms) {
    if (reduce() || !fx) return Promise.resolve();
    const dur = ms || 820;
    return new Promise((res) => shells.push({ x0, y0, x1, y1, t0: performance.now(), dur, peak: Math.min(260, Math.hypot(x1 - x0, y1 - y0) * 0.45 + 60), trail: [], done: res }));
  }

  // Cells that are on fire keep smoking: register a function that returns their screen boxes.
  let burnBoxes = () => [];
  function setBurning(fn) { burnBoxes = fn || (() => []); }

  let last = 0, running = false;
  function frame(now) {
    const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
    if (!reduce() || !frame.drewOnce) { for (const s of seas) s.draw(reduce() ? 0 : now); frame.drewOnce = true; }
    if (fx) {
      fx.clearRect(0, 0, W, H);
      // shells
      for (let i = shells.length - 1; i >= 0; i--) {
        const sh = shells[i], k = Math.min(1, (now - sh.t0) / sh.dur);
        const x = sh.x0 + (sh.x1 - sh.x0) * k, y = sh.y0 + (sh.y1 - sh.y0) * k - Math.sin(Math.PI * k) * sh.peak;
        sh.trail.push([x, y]); if (sh.trail.length > 18) sh.trail.shift();
        for (let t = 1; t < sh.trail.length; t++) {
          const [ax, ay] = sh.trail[t - 1], [bx, by] = sh.trail[t];
          fx.strokeStyle = `rgba(255,210,140,${t / sh.trail.length * 0.55})`; fx.lineWidth = 1 + t / sh.trail.length * 2.2;
          fx.beginPath(); fx.moveTo(ax, ay); fx.lineTo(bx, by); fx.stroke();
        }
        const glow = fx.createRadialGradient(x, y, 0, x, y, 10);
        glow.addColorStop(0, "rgba(255,250,220,1)"); glow.addColorStop(1, "rgba(255,170,80,0)");
        fx.fillStyle = glow; fx.beginPath(); fx.arc(x, y, 10, 0, Math.PI * 2); fx.fill();
        if (k >= 1) { shells.splice(i, 1); sh.done(); }
      }
      // smoke from burning cells
      if (!reduce()) for (const b of burnBoxes()) {
        if (Math.random() < dt * 5) add({ kind: "smoke", x: b.x + rnd(-b.w * .2, b.w * .2), y: b.y, vx: rnd(-6, 10), vy: rnd(-34, -16), size: b.w * rnd(.14, .24), grow: rnd(10, 22), life: 0, max: rnd(1.4, 2.6), shade: rnd(30, 60) });
        if (Math.random() < dt * 9) add({ kind: "ember", x: b.x + rnd(-b.w * .25, b.w * .25), y: b.y + b.h * .1, vx: rnd(-10, 10), vy: rnd(-50, -20), g: -10, size: rnd(1, 2.2), life: 0, max: rnd(.4, .9) });
      }
      // particles
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]; p.life += dt;
        const k = p.life / p.max;
        if (k >= 1) { parts.splice(i, 1); continue; }
        if (p.vx != null) { p.vy += (p.g || 0) * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
        fx.globalCompositeOperation = (p.kind === "spark" || p.kind === "flash" || p.kind === "ember") ? "lighter" : "source-over";
        if (p.kind === "ring") { p.r += p.vr * dt; fx.strokeStyle = p.color + (0.7 * (1 - k)) + ")"; fx.lineWidth = 2 * (1 - k) + .5; fx.beginPath(); fx.ellipse(p.x, p.y, p.r, p.r * .5, 0, 0, Math.PI * 2); fx.stroke(); }
        else if (p.kind === "drop") { fx.fillStyle = p.color; fx.globalAlpha = 1 - k; fx.beginPath(); fx.arc(p.x, p.y, p.size, 0, Math.PI * 2); fx.fill(); fx.globalAlpha = 1; }
        else if (p.kind === "column") { const hh = p.size * 5 * Math.sin(Math.PI * k); const gr = fx.createLinearGradient(p.x, p.y - hh, p.x, p.y); gr.addColorStop(0, "rgba(235,250,255,0)"); gr.addColorStop(1, `rgba(235,250,255,${.75 * (1 - k)})`); fx.fillStyle = gr; fx.beginPath(); fx.ellipse(p.x, p.y - hh / 2, p.size * (.6 + k * .5), hh / 2 + 1, 0, 0, Math.PI * 2); fx.fill(); }
        else if (p.kind === "flash") { const r = p.r * (0.6 + k); const gr = fx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r); gr.addColorStop(0, `rgba(255,245,210,${1 - k})`); gr.addColorStop(.4, `rgba(255,170,70,${.8 * (1 - k)})`); gr.addColorStop(1, "rgba(255,90,30,0)"); fx.fillStyle = gr; fx.beginPath(); fx.arc(p.x, p.y, r, 0, Math.PI * 2); fx.fill(); }
        else if (p.kind === "spark" || p.kind === "ember") { fx.fillStyle = p.color || "#ffb25a"; fx.globalAlpha = 1 - k; fx.beginPath(); fx.arc(p.x, p.y, p.size * (1 - k * .5), 0, Math.PI * 2); fx.fill(); fx.globalAlpha = 1; }
        else if (p.kind === "smoke") { const r = p.size + p.grow * k; fx.fillStyle = `rgba(${p.shade},${p.shade},${p.shade + 6},${.42 * (1 - k)})`; fx.beginPath(); fx.arc(p.x, p.y, r, 0, Math.PI * 2); fx.fill(); }
        else if (p.kind === "debris") { p.rot += p.vrot * dt; fx.save(); fx.translate(p.x, p.y); fx.rotate(p.rot); fx.fillStyle = `rgba(40,40,44,${1 - k})`; fx.fillRect(-p.size, -p.size / 2, p.size * 2, p.size); fx.restore(); }
        else if (p.kind === "bubble") { fx.strokeStyle = `rgba(200,235,255,${.7 * (1 - k)})`; fx.lineWidth = 1; fx.beginPath(); fx.arc(p.x, p.y, p.size, 0, Math.PI * 2); fx.stroke(); }
      }
      fx.globalCompositeOperation = "source-over";
    }
    root.requestAnimationFrame(frame);
  }
  function start() { if (running) return; running = true; root.requestAnimationFrame(frame); }
  const busy = () => shells.length > 0;

  // ---------- sound: synthesized with Web Audio ----------
  let ac = null, master = null, vol = 0.7, muted = false;
  function audio() {
    if (ac) { if (ac.state === "suspended") ac.resume(); return ac; }
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return null;
    try { ac = new AC(); master = ac.createGain(); master.gain.value = muted ? 0 : vol; master.connect(ac.destination); } catch (e) { ac = null; }
    return ac;
  }
  function setVolume(v, m) {
    vol = Math.max(0, Math.min(1, v)); muted = !!m;
    if (master) master.gain.setTargetAtTime(muted ? 0 : vol, ac.currentTime, 0.02);
  }
  function noise(sec) {
    const a = audio(); if (!a) return null;
    const len = Math.max(1, Math.floor(a.sampleRate * sec)), b = a.createBuffer(1, len, a.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const s = a.createBufferSource(); s.buffer = b; return s;
  }
  function env(g, t, a, peak, decay) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + decay); }
  function tone(type, f0, f1, dur, peak, when) {
    const a = audio(); if (!a || muted) return;
    const t = a.currentTime + (when || 0), o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    env(g, t, 0.008, peak || 0.3, dur); o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.05);
  }
  function burst(dur, freq, q, peak, type, when) {
    const a = audio(); if (!a || muted) return;
    const t = a.currentTime + (when || 0), s = noise(dur + 0.1), f = a.createBiquadFilter(), g = a.createGain();
    f.type = type || "lowpass"; f.frequency.setValueAtTime(freq, t); f.Q.value = q || 0.7;
    env(g, t, 0.005, peak || 0.6, dur); s.connect(f).connect(g).connect(master); s.start(t); s.stop(t + dur + 0.1);
    return f;
  }
  const sfx = {
    click() { tone("triangle", 880, 660, 0.06, 0.08); },
    place() { tone("triangle", 330, 520, 0.09, 0.12); burst(0.05, 2400, 1, 0.05, "highpass"); },
    rotate() { tone("sine", 520, 780, 0.08, 0.09); },
    cannon() { burst(0.5, 900, 0.8, 0.9); tone("sine", 120, 38, 0.6, 0.7); burst(0.08, 4200, 1, 0.25, "highpass"); },
    whistle(ms) {
      const a = audio(); if (!a || muted) return;
      const d = (ms || 800) / 1000, t = a.currentTime, o = a.createOscillator(), g = a.createGain();
      o.type = "sine"; o.frequency.setValueAtTime(1900, t); o.frequency.exponentialRampToValueAtTime(520, t + d);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09, t + d * 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g).connect(master); o.start(t); o.stop(t + d + 0.05);
    },
    splash() { const f = burst(0.7, 1800, 0.6, 0.55); if (f) f.frequency.exponentialRampToValueAtTime(300, ac.currentTime + 0.7); burst(0.25, 5200, 1, 0.12, "highpass", 0.05); tone("sine", 220, 90, 0.25, 0.12); },
    hit() { burst(0.9, 1200, 0.7, 1); tone("sawtooth", 90, 30, 0.8, 0.45); tone("sine", 60, 28, 1.0, 0.6); burst(0.4, 3000, 1, 0.25, "bandpass", 0.06); },
    sink() { const f = burst(2.2, 500, 0.6, 0.7); if (f) f.frequency.exponentialRampToValueAtTime(120, ac.currentTime + 2.2); tone("sawtooth", 140, 40, 2.0, 0.22); for (let i = 0; i < 7; i++) tone("sine", 300 + Math.random() * 500, 900, 0.08, 0.06, 0.4 + i * 0.18); },
    win() { [523, 659, 784, 1047].forEach((f, i) => tone("triangle", f, null, 0.35, 0.18, i * 0.14)); tone("triangle", 1047, null, 0.9, 0.16, 0.6); },
    lose() { [392, 330, 262, 196].forEach((f, i) => tone("sawtooth", f, f * 0.98, 0.42, 0.08, i * 0.22)); },
    turn() { tone("sine", 660, 990, 0.12, 0.07); },
  };

  // light screen shake
  function shake(el, strong) {
    if (reduce() || !el) return;
    el.classList.remove("shake", "shake2"); void el.offsetWidth; el.classList.add(strong ? "shake2" : "shake");
  }

  root.FX = { Sea, initFx, start, splash, explode, bubbles, shell, setBurning, sfx, audio, setVolume, shake, reduce, busy };
})(typeof self !== "undefined" ? self : this);
