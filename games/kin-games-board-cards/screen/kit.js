// Kin Games kit: sound (Web Audio, made on the spot), original art drawn in code (cards, dice, dominoes, pieces,
// box covers), small animations, and the turn harness most games run on. No files, no network.
(function (root) {
  "use strict";
  const K = {};
  const RM = () => !!(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches);
  K.reduced = RM;
  const Q = new URLSearchParams((root.location && root.location.search) || "");
  K.fast = Q.get("fast") === "1"; K.autoplay = Q.get("autoplay") === "1";
  K.wait = (ms) => new Promise((r) => setTimeout(r, K.fast ? Math.min(ms, 15) : ms));
  K.rnd = (a, b) => a + Math.random() * (b - a);
  K.shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  K.el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  K.btn = (cls, text, fn) => { const b = K.el("button", cls, text); b.type = "button"; if (fn) b.onclick = fn; return b; };

  // ---------------- sound ----------------
  let ac = null, master = null, rev = null, vol = 0.7, muted = false, noiseBuf = null;
  function ctx() {
    if (ac) { if (ac.state === "suspended") ac.resume(); return ac; }
    const AC = root.AudioContext || root.webkitAudioContext; if (!AC) return null;
    ac = new AC(); master = ac.createGain(); master.gain.value = muted ? 0 : vol; master.connect(ac.destination);
    const len = ac.sampleRate * 1.2, ir = ac.createBuffer(2, len, ac.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
    rev = ac.createConvolver(); rev.buffer = ir; const rg = ac.createGain(); rg.gain.value = 0.18; rev.connect(rg).connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    return ac;
  }
  const out = (g, wet) => { g.connect(master); if (wet) g.connect(rev); };
  function env(g, t, a, peak, d) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
  function tone(type, f0, f1, dur, peak, when, wet) {
    const a = ctx(); if (!a || muted) return; const t = a.currentTime + (when || 0), o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    env(g, t, 0.005, peak, dur); o.connect(g); out(g, wet); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, freq, q, peak, type, when, sweep) {
    const a = ctx(); if (!a || muted) return; const t = a.currentTime + (when || 0), s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    s.buffer = noiseBuf; f.type = type || "bandpass"; f.frequency.setValueAtTime(freq, t); f.Q.value = q || 1; if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + dur);
    env(g, t, 0.003, peak, dur); s.connect(f).connect(g); out(g); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }
  const notes = (fs, gap, len, type, peak) => fs.forEach((f, i) => tone(type || "triangle", f, null, len || 0.22, peak || 0.12, i * (gap || 0.1), true));
  K.sfx = {
    unlock: ctx,
    setVolume(v, m) { vol = Math.max(0, Math.min(1, v)); muted = !!m; if (master) master.gain.setTargetAtTime(muted ? 0 : vol, ac.currentTime, 0.02); },
    get muted() { return muted; }, get volume() { return vol; },
    click() { tone("triangle", 900, 700, 0.04, 0.06); },
    hover() { tone("sine", 1200, 1100, 0.03, 0.02); },
    open() { notes([392, 523, 659], 0.05, 0.16, "triangle", 0.08); noise(0.2, 1800, 0.8, 0.04, "bandpass", 0, 5000); },
    place() { noise(0.05, 1400, 3, 0.35); tone("sine", 260, 180, 0.08, 0.12); },
    clack() { noise(0.04, 2600, 4, 0.4); tone("square", 520, 400, 0.03, 0.04); },
    slide() { noise(0.18, 700, 0.8, 0.12, "bandpass", 0, 1500); },
    flip() { noise(0.06, 3500, 1.2, 0.22, "highpass"); },
    deal() { noise(0.05, 4200, 1, 0.18, "highpass"); },
    shuffle() { for (let i = 0; i < 10; i++) noise(0.04, 3800, 1, 0.14, "highpass", i * 0.035); },
    chip() { tone("sine", 2400, 2200, 0.05, 0.08); tone("sine", 3100, 2900, 0.04, 0.05, 0.02); },
    roll() { for (let i = 0; i < 7; i++) { noise(0.03, 2200 + Math.random() * 1500, 5, 0.25, "bandpass", i * 0.05 + Math.random() * 0.02); } },
    land() { noise(0.05, 1500, 3, 0.3); tone("sine", 200, 150, 0.06, 0.1); },
    pop() { tone("sine", 300, 900, 0.07, 0.18); noise(0.04, 2000, 2, 0.15); },
    hit() { noise(0.03, 3000, 3, 0.4); tone("sine", 1800, 1200, 0.04, 0.08); },
    thock() { tone("sine", 180, 90, 0.12, 0.3); noise(0.05, 900, 2, 0.2); },
    wall() { tone("sine", 140, 90, 0.08, 0.14); noise(0.03, 600, 2, 0.12); },
    pocket() { tone("sine", 140, 70, 0.25, 0.3); noise(0.15, 400, 1, 0.2, "lowpass"); },
    pins() { for (let i = 0; i < 9; i++) { noise(0.08, 900 + Math.random() * 2000, 2, 0.3, "bandpass", i * 0.025); tone("square", 300 + Math.random() * 400, 200, 0.05, 0.03, i * 0.025); } },
    rumble() { noise(0.9, 180, 0.7, 0.18, "lowpass", 0, 120); },
    swish() { noise(0.25, 600, 0.9, 0.18, "bandpass", 0, 3000); },
    buzz() { tone("square", 160, 120, 0.18, 0.06); },
    ding() { tone("sine", 1320, null, 0.6, 0.12, 0, true); tone("sine", 1980, null, 0.4, 0.05, 0, true); },
    score() { notes([659, 880], 0.07, 0.15, "triangle", 0.1); },
    goal() { notes([523, 659, 784, 1047], 0.08, 0.3, "sawtooth", 0.06); noise(0.8, 1200, 0.6, 0.1, "bandpass", 0.1, 2400); },
    win() { notes([523, 659, 784, 1047], 0.12, 0.35, "triangle", 0.13); notes([1047, 1319, 1568], 0.1, 0.5, "sine", 0.07); },
    lose() { notes([392, 349, 311, 262], 0.16, 0.35, "triangle", 0.1); },
    draw() { notes([440, 523, 440], 0.14, 0.3, "triangle", 0.09); },
    achieve() { notes([784, 988, 1175, 1568], 0.07, 0.3, "sine", 0.1); },
    tick() { tone("square", 1500, null, 0.015, 0.03); },
  };

  // ---------------- art: suits and cards ----------------
  const SUIT = {
    h: "M50 90C22 68 5 50 5 31 5 15 17 5 30 5c9 0 16 5 20 13 4-8 11-13 20-13 13 0 25 10 25 26 0 19-17 37-45 59z",
    d: "M50 3 89 50 50 97 11 50z",
    s: "M50 4C36 24 7 40 7 61c0 13 10 22 22 22 8 0 15-4 18-10-1 10-5 17-12 23h30c-7-6-11-13-12-23 3 6 10 10 18 10 12 0 22-9 22-22C93 40 64 24 50 4z",
    c: "M50 8a20 20 0 0 0-16 32 20 20 0 1 0 12 32c-1 10-5 17-12 23h32c-7-6-11-13-12-23a20 20 0 1 0 12-32A20 20 0 0 0 50 8z",
  };
  K.SUITNAME = { h: "hearts", d: "diamonds", s: "spades", c: "clubs" };
  K.RANKNAME = { 1: "ace", 11: "jack", 12: "queen", 13: "king", 14: "ace" };
  const RL = (r) => ({ 1: "A", 11: "J", 12: "Q", 13: "K", 14: "A" })[r] || String(r);
  K.rankLabel = RL;
  K.cardName = (c) => `${K.RANKNAME[c.r] || c.r} of ${K.SUITNAME[c.s]}`;
  const red = (s) => s === "h" || s === "d";
  const suitUse = (s, x, y, w, rot, col) => `<path d="${SUIT[s]}" fill="${col}" transform="translate(${x - w / 2} ${y - w / 2}) scale(${w / 100})${rot ? ` rotate(180 50 50)` : ""}"/>`;
  const PIPS = {
    1: [[.5, .5]], 2: [[.5, .2], [.5, .8]], 3: [[.5, .2], [.5, .5], [.5, .8]], 4: [[.32, .2], [.68, .2], [.32, .8], [.68, .8]],
    5: [[.32, .2], [.68, .2], [.5, .5], [.32, .8], [.68, .8]], 6: [[.32, .2], [.68, .2], [.32, .5], [.68, .5], [.32, .8], [.68, .8]],
    7: [[.32, .2], [.68, .2], [.5, .35], [.32, .5], [.68, .5], [.32, .8], [.68, .8]],
    8: [[.32, .2], [.68, .2], [.5, .35], [.32, .5], [.68, .5], [.5, .65], [.32, .8], [.68, .8]],
    9: [[.32, .2], [.68, .2], [.32, .4], [.68, .4], [.5, .5], [.32, .6], [.68, .6], [.32, .8], [.68, .8]],
    10: [[.32, .2], [.68, .2], [.5, .3], [.32, .4], [.68, .4], [.32, .6], [.68, .6], [.5, .7], [.32, .8], [.68, .8]],
  };
  const cardCache = {};
  // A playing card face as SVG (100 x 140). c = {r: 1-14 (A low or high), s: h|d|s|c}.
  K.cardSVG = function (c) {
    const key = c.r + c.s; if (cardCache[key]) return cardCache[key];
    const col = red(c.s) ? "#c8202f" : "#17171c", r = c.r === 14 ? 1 : c.r, L = RL(r);
    let s = `<svg viewBox="0 0 100 140" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="cf" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fffdf8"/><stop offset="1" stop-color="#efe8da"/></linearGradient></defs>`;
    s += `<rect x="1" y="1" width="98" height="138" rx="8" fill="url(#cf)" stroke="#bfb4a0" stroke-width="1.2"/>`;
    const corner = (rot) => `<g${rot ? ' transform="rotate(180 50 70)"' : ""}><text x="10" y="21" font-family="Georgia,serif" font-weight="700" font-size="${L === "10" ? 16 : 19}" fill="${col}" text-anchor="middle">${L}</text>${suitUse(c.s, 10, 31, 12, false, col)}</g>`;
    s += corner(false) + corner(true);
    if (r <= 10) {
      const big = r === 1;
      for (const [x, y] of PIPS[r]) s += suitUse(c.s, 20 + x * 60, 14 + y * 112, big ? 44 : 19, y > 0.55 && !big, col);
      if (big) s += `<circle cx="50" cy="70" r="30" fill="none" stroke="${col}" stroke-opacity=".18" stroke-width="1"/>`;
    } else {
      // Court cards: an original bust (crown, cap or hood) mirrored top and bottom inside a frame.
      const robe = red(c.s) ? "#c8202f" : "#24306b", gold = "#d6a531", skin = "#f2d2b0";
      const hat = r === 13 ? `<path d="M-14 -20 -14 -31 -7 -24 0 -34 7 -24 14 -31 14 -20z" fill="${gold}" stroke="#7a5a10" stroke-width="1"/>`
        : r === 12 ? `<path d="M-13 -21C-13 -32 13 -32 13 -21z" fill="${gold}"/><circle cx="0" cy="-31" r="3" fill="${col}"/>`
        : `<path d="M-14 -20C-12 -30 10 -33 16 -24l-4 4z" fill="${robe}"/><circle cx="15" cy="-25" r="2.5" fill="${gold}"/>`;
      const half = `<g>${hat}<circle cx="0" cy="-12" r="10" fill="${skin}" stroke="#6b4b2a" stroke-width=".8"/><circle cx="-3.5" cy="-13" r="1.1" fill="#222"/><circle cx="3.5" cy="-13" r="1.1" fill="#222"/><path d="M-3 -7Q0 -5 3 -7" stroke="#8a3a2a" fill="none" stroke-width="1"/><path d="M-24 0C-22 -6 -10 -3 0 -2 10 -3 22 -6 24 0z" fill="${robe}"/><path d="M-9 -2 0 0 9 -2 0 -1z" fill="${gold}"/>${suitUse(c.s, -14, -4, 9, false, red(c.s) ? gold : "#fff")}</g>`;
      s += `<rect x="20" y="22" width="60" height="96" rx="4" fill="#fbf4e2" stroke="${col}" stroke-width="1.2"/><rect x="23" y="25" width="54" height="90" rx="3" fill="none" stroke="${gold}" stroke-width="1"/>`;
      s += `<g transform="translate(50 70)"><clipPath id="cc${key}"><rect x="-27" y="-45" width="54" height="90"/></clipPath><g clip-path="url(#cc${key})">${half}<g transform="rotate(180)">${half}</g></g><line x1="-27" y1="0" x2="27" y2="0" stroke="${gold}" stroke-width=".8"/></g>`;
    }
    s += `</svg>`;
    return (cardCache[key] = s);
  };
  K.backSVG = function (hue) {
    const h = hue == null ? 350 : hue;
    return `<svg viewBox="0 0 100 140" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="bp${h}" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="10" height="10" fill="hsl(${h},55%,32%)"/><path d="M0 5h10M5 0v10" stroke="hsl(${h},60%,48%)" stroke-width="1.4"/><circle cx="5" cy="5" r="1.6" fill="hsl(${h},70%,70%)"/></pattern></defs><rect x="1" y="1" width="98" height="138" rx="8" fill="#fffdf6" stroke="#bfb4a0"/><rect x="6" y="6" width="88" height="128" rx="5" fill="url(#bp${h})"/><circle cx="50" cy="70" r="17" fill="hsl(${h},55%,26%)" stroke="#e8c871" stroke-width="2"/><path d="M50 58l4 8 9 1-7 6 2 9-8-5-8 5 2-9-7-6 9-1z" fill="#e8c871"/></svg>`;
  };
  // A card element. opts: {back, hue, w, cls, onClick, label}
  K.card = function (c, opts) {
    const o = opts || {}, e = K.el(o.onClick ? "button" : "div", "pcard" + (o.cls ? " " + o.cls : ""));
    if (o.onClick) { e.type = "button"; e.onclick = o.onClick; }
    e.innerHTML = o.back || !c ? K.backSVG(o.hue) : K.cardSVG(c);
    e.setAttribute(o.onClick ? "aria-label" : "title", o.back || !c ? "a face-down card" : o.label || K.cardName(c));
    if (o.k) e.dataset.k = o.k;
    return e;
  };
  K.deck = function (aceHigh) { const d = []; for (const s of "shdc") for (let r = 1; r <= 13; r++) d.push({ r: aceHigh && r === 1 ? 14 : r, s }); return K.shuffle(d); };
  K.suitSVG = (s, px) => `<svg viewBox="0 0 100 100" width="${px || 16}" height="${px || 16}" aria-hidden="true"><path d="${SUIT[s]}" fill="${red(s) ? "#d6283a" : "#e8e2d6"}"/></svg>`;

  // ---------------- pips (shared by the dominoes) ----------------
  const DP = { 1: [[1, 1]], 2: [[0, 0], [2, 2]], 3: [[0, 0], [1, 1], [2, 2]], 4: [[0, 0], [2, 0], [0, 2], [2, 2]], 5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]], 6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]] };
  // ---------------- dominoes ----------------
  K.dominoSVG = function (a, b, vertical) {
    const w = vertical ? 50 : 100, h = vertical ? 100 : 50, half = (v, ox, oy) => (DP[v] || []).map(([x, y]) => `<circle cx="${ox + 12.5 + x * 12.5}" cy="${oy + 12.5 + y * 12.5}" r="4.2" fill="#15151a"/>`).join("");
    const P = { 0: [], 1: DP[1], 2: DP[2], 3: DP[3], 4: DP[4], 5: DP[5], 6: DP[6] };
    const hp = (v, ox, oy) => (P[v] || []).map(([x, y]) => `<circle cx="${ox + 12.5 + x * 12.5}" cy="${oy + 12.5 + y * 12.5}" r="4.2" fill="#15151a"/>`).join("");
    return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="7" fill="#f7f2e6" stroke="#a99d86" stroke-width="1.5"/>` +
      (vertical ? `<line x1="8" y1="50" x2="42" y2="50" stroke="#8a7f6a" stroke-width="2"/><circle cx="25" cy="50" r="2.4" fill="#c9a24a"/>${hp(a, 0, 0)}${hp(b, 0, 50)}` : `<line x1="50" y1="8" x2="50" y2="42" stroke="#8a7f6a" stroke-width="2"/><circle cx="50" cy="25" r="2.4" fill="#c9a24a"/>${hp(a, 0, 0)}${hp(b, 50, 0)}`) + `</svg>`;
  };

  // ---------------- pieces and tokens ----------------
  const shade = (hex, f) => { const n = parseInt(hex.slice(1), 16); let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255; const m = (v) => Math.max(0, Math.min(255, Math.round(f > 0 ? v + (255 - v) * f : v * (1 + f)))); return `rgb(${m(r)},${m(g)},${m(b)})`; };
  K.shade = shade;
  let gid = 0;
  // A glossy round piece (stone, disc, marble, checker). kind: stone|marble|checker|peg
  K.token = function (color, kind, extra) {
    const id = "t" + (++gid), hi = shade(color, 0.55), lo = shade(color, -0.45);
    if (kind === "checker") return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="${id}" cx=".38" cy=".32" r=".75"><stop offset="0" stop-color="${hi}"/><stop offset=".6" stop-color="${color}"/><stop offset="1" stop-color="${lo}"/></radialGradient></defs><ellipse cx="50" cy="58" rx="44" ry="40" fill="${lo}"/><circle cx="50" cy="50" r="43" fill="url(#${id})"/><circle cx="50" cy="50" r="31" fill="none" stroke="${lo}" stroke-opacity=".55" stroke-width="3"/><circle cx="50" cy="50" r="22" fill="none" stroke="${hi}" stroke-opacity=".35" stroke-width="2"/>${extra || ""}</svg>`;
    if (kind === "peg") return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="${id}" cx=".38" cy=".3" r=".8"><stop offset="0" stop-color="#fff"/><stop offset=".25" stop-color="${hi}"/><stop offset=".7" stop-color="${color}"/><stop offset="1" stop-color="${lo}"/></radialGradient></defs><ellipse cx="50" cy="88" rx="30" ry="8" fill="#000" opacity=".3"/><path d="M28 88C28 60 36 52 50 52S72 60 72 88z" fill="url(#${id})"/><circle cx="50" cy="36" r="22" fill="url(#${id})"/>${extra || ""}</svg>`;
    return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="${id}" cx=".36" cy=".3" r=".78"><stop offset="0" stop-color="${kind === "marble" ? "#fff" : hi}"/><stop offset="${kind === "marble" ? ".18" : ".35"}" stop-color="${hi}"/><stop offset=".75" stop-color="${color}"/><stop offset="1" stop-color="${lo}"/></radialGradient></defs><ellipse cx="52" cy="60" rx="42" ry="38" fill="#000" opacity=".28"/><circle cx="50" cy="50" r="44" fill="url(#${id})"/><ellipse cx="36" cy="30" rx="14" ry="9" fill="#fff" opacity="${kind === "marble" ? ".55" : ".25"}"/>${extra || ""}</svg>`;
  };
  // Chess pieces: original silhouettes in a 45 x 45 box.
  const CP = {
    p: "M22.5 9a5.5 5.5 0 0 0-3.2 10C16.6 20.6 15 23 15 26c0 2 1 3.6 2.4 4.6C15.4 32.4 12 35 12 39h21c0-4-3.4-6.6-5.4-8.4C29 29.6 30 28 30 26c0-3-1.6-5.4-4.3-7A5.5 5.5 0 0 0 22.5 9z",
    r: "M11 39h23v-3l-3-2V18l3-3V9h-5v3h-3V9h-5v3h-3V9h-5v6l3 3v16l-3 2z",
    n: "M14 39h20c0-9-2-17-6-23 1-3 0-6-3-7-1 2-2 3-4 3-6 1-11 6-12 12-1 3 1 5 3 4l3-2c1 1 2 1 4 0-3 4-5 8-5 13z",
    b: "M22.5 6a2.6 2.6 0 1 0 0 5.2 2.6 2.6 0 1 0 0-5.2zM22.5 11c-5 4-8 9-7 14 0 3 2 5 4 6-3 2-6 4-6 8h18c0-4-3-6-6-8 2-1 4-3 4-6 1-5-2-10-7-14zm2 5-3 6",
    q: "M9 13a2.5 2.5 0 1 0 .1 0zm8-3a2.5 2.5 0 1 0 .1 0zm11 0a2.5 2.5 0 1 0 .1 0zm8 3a2.5 2.5 0 1 0 .1 0zM22.5 8a2.5 2.5 0 1 0 .1 0zM11 16l3 14 4-11 4.5 11L27 19l4 11 3-14-2 17c-6 2-13 2-19 0zM12 34h21v5H12z",
    k: "M21 5h3v3h3v3h-3v4h-3v-4h-3V8h3zM22.5 15c-4 0-6 2-6 5 0 2 1 3 2 4-5 1-8 4-8 8l2 3c6 2 14 2 20 0l2-3c0-4-3-7-8-8 1-1 2-2 2-4 0-3-2-5-6-5zM12 35h21v4H12z",
  };
  K.chessSVG = function (t, white) {
    const id = "c" + (++gid), f1 = white ? "#fffaf0" : "#4a4652", f2 = white ? "#cfc4ae" : "#15131a", st = white ? "#3a3326" : "#000";
    return `<svg viewBox="0 0 45 45" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${f1}"/><stop offset="1" stop-color="${f2}"/></linearGradient></defs><ellipse cx="22.5" cy="40" rx="12" ry="2.5" fill="#000" opacity=".25"/><path d="${CP[t]}" fill="url(#${id})" stroke="${st}" stroke-width="1.3" stroke-linejoin="round"/>${white ? "" : `<path d="${CP[t]}" fill="none" stroke="#8d86a0" stroke-width=".5" stroke-opacity=".6"/>`}</svg>`;
  };

  // ---------------- animation ----------------
  // Re-renders a container and slides every element that has a data-k from where it was to where it is now.
  K.flip = function (box, render, opts) {
    const o = opts || {}, old = {};
    box.querySelectorAll("[data-k]").forEach((e) => { old[e.dataset.k] = e.getBoundingClientRect(); });
    render();
    if (RM() || K.fast) return;
    box.querySelectorAll("[data-k]").forEach((e) => {
      const r0 = old[e.dataset.k], r1 = e.getBoundingClientRect();
      if (!r0) { if (o.enter !== false && e.animate) e.animate([{ transform: "scale(.4)", opacity: 0 }, { transform: "scale(1)", opacity: 1 }], { duration: 260, easing: "cubic-bezier(.2,1.4,.4,1)" }); return; }
      const dx = r0.left - r1.left, dy = r0.top - r1.top;
      if ((dx || dy) && e.animate) e.animate([{ transform: `translate(${dx}px,${dy}px)` + (o.lift ? " scale(1.12)" : "") }, { transform: "none" }], { duration: o.ms || 320, easing: "cubic-bezier(.3,.7,.3,1)" });
    });
  };
  K.pulse = (e) => { if (e && e.animate && !RM()) e.animate([{ transform: "scale(1)" }, { transform: "scale(1.12)" }, { transform: "scale(1)" }], { duration: 300 }); };
  K.shake = (e) => { if (e && e.animate && !RM()) e.animate([{ transform: "translateX(0)" }, { transform: "translateX(-6px)" }, { transform: "translateX(6px)" }, { transform: "translateX(0)" }], { duration: 260 }); };
  K.confetti = function (host) {
    if (RM() || !host) return;
    const cv = K.el("canvas", "confetti"); host.append(cv);
    const W = (cv.width = host.clientWidth), H = (cv.height = Math.max(300, host.clientHeight)), g = cv.getContext("2d");
    const P = Array.from({ length: 120 }, () => ({ x: W / 2 + K.rnd(-60, 60), y: H * 0.3, vx: K.rnd(-6, 6), vy: K.rnd(-11, -3), r: K.rnd(3, 7), c: `hsl(${Math.floor(K.rnd(0, 360))},85%,60%)`, a: K.rnd(0, 6) }));
    let n = 0; const f = () => { g.clearRect(0, 0, W, H); for (const p of P) { p.vy += 0.3; p.x += p.vx; p.y += p.vy; p.a += 0.2; g.save(); g.translate(p.x, p.y); g.rotate(p.a); g.fillStyle = p.c; g.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); g.restore(); } if (++n < 110) requestAnimationFrame(f); else cv.remove(); };
    requestAnimationFrame(f);
  };
  // A crisp canvas sized to its box (w x h world units), with pointer helpers.
  K.canvas = function (host, w, h, maxH) {
    const cv = K.el("canvas", "cv"); host.append(cv);
    const g = cv.getContext("2d"), v = { cv, g, ctx: g, s: 1, w, h };
    v.fit = () => {
      const room = Math.min(host.clientWidth || 360, 720), tall = (maxH || 0.7) * (root.innerHeight || 800);
      v.s = Math.min(room / w, tall / h); const W = Math.round(w * v.s), H = Math.round(h * v.s), dpr = Math.min(2, root.devicePixelRatio || 1);
      cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + "px"; cv.style.height = H + "px";
      g.setTransform(dpr * v.s, 0, 0, dpr * v.s, 0, 0);
    };
    v.at = (ev) => { const r = cv.getBoundingClientRect(); return { x: (ev.clientX - r.left) / v.s, y: (ev.clientY - r.top) / v.s }; };
    v.fit();
    const onR = () => v.fit(); root.addEventListener("resize", onR); v.off = () => root.removeEventListener("resize", onR);
    return v;
  };
  // A frame loop that stops when dead() is true; dt in seconds, capped.
  K.loop = function (fn, dead) {
    let last = performance.now();
    const f = (t) => { if (dead()) return; const dt = Math.min(0.05, (t - last) / 1000); last = t; fn(dt); requestAnimationFrame(f); };
    requestAnimationFrame(f);
  };
  K.gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  // How loose the computer's shots are, by level.
  K.spread = (level) => ({ beginner: 1, easy: 0.6, normal: 0.3, hard: 0.1 })[level] || 0.3;
  K.depth = (level, d) => (d || [1, 2, 3, 4])[["beginner", "easy", "normal", "hard"].indexOf(level)] || 2;

  // ---------------- the turn harness ----------------
  // Runs a turn-based game: seats are "you", "kin" (your Kin, or the computer in Solo) or "bot" (a computer player).
  // spec: setup(first) -> S (with S.seats and S.turn), moves(S), apply(S, m), rank(S, level) -> [{m, label}],
  // over(S) -> null | {result, detail}, mount(el, H) -> view, draw(view, S, H), animate?(view, S0, m, S1, who),
  // situation?(S), feats?(S0, m, S1, who), autoMove?(S) -> m (a forced step like a roll), talk?(S0, m, S1).
  K.turnGame = function (api, spec) {
    let S = null, dead = false, busy = false, view = null;
    const H = {
      api, spec, get S() { return S; }, get busy() { return busy; }, get dead() { return dead; },
      seat: () => S.seats[S.turn], mine: () => !busy && !api.ended() && S.seats[S.turn] === "you",
      legal: () => spec.moves(S),
      foe: (seat) => (seat === "kin" ? api.kinName() : seat === "you" ? "You" : (S.names && S.names[S.seats.indexOf(seat)]) || "Computer"),
      nameOf: (i) => (S.seats[i] === "you" ? "You" : S.seats[i] === "kin" ? api.kinName() : (S.names && S.names[i]) || "Computer " + i),
      play: (m) => { if (!H.mine()) return; go(m, "you"); },
      redraw: () => spec.draw(view, S, H),
      set: (S2, kick) => { S = S2; api.save(S); spec.draw(view, S, H); if (kick && !busy) next(); },
    };
    async function go(m, who) {
      if (dead) return;
      busy = true;
      const S0 = S, S1 = spec.apply(S, m);
      if (spec.animate) { try { await spec.animate(view, S0, m, S1, who, H); } catch (e) { console.error(e); } }
      if (dead) return;
      S = S1; if (spec.feats) spec.feats(S0, m, S1, who, api);
      api.save(S); busy = false; spec.draw(view, S, H);
      if (who === "you" && spec.talk && api.settings.mode === "talk") { const t = spec.talk(S0, m, S1); if (t) api.line(t); }
      next();
    }
    async function next() {
      if (dead) return;
      const o = spec.over(S);
      if (o) { spec.draw(view, S, H); api.over(o.result, o.detail || ""); return; }
      const seat = S.seats[S.turn];
      const forced = spec.autoMove ? spec.autoMove(S) : null;
      if (forced && (seat !== "you" || spec.autoForYou)) { busy = true; await K.wait(spec.autoDelay != null ? spec.autoDelay : 450); busy = false; return go(forced, seat); }
      if (seat === "you" && !K.autoplay) { api.status(spec.yourTurn ? spec.yourTurn(S, H) : "Your turn."); return; }
      busy = true; spec.draw(view, S, H);
      api.status(seat === "you" ? "Autoplay…" : `${H.foe(seat)} ${seat === "kin" && !api.solo && api.settings.mode === "kin" ? "is thinking…" : "is playing…"}`, true);
      await K.wait(seat === "kin" && api.solo ? (spec.thinkMs || 550) : spec.botMs || 500);
      if (dead) return;
      const lvl = api.settings.level, r = spec.rank(S, seat === "bot" ? spec.botLevel || "normal" : seat === "you" ? "normal" : lvl);
      if (!r.length) { busy = false; return; }
      let pick;
      if (seat === "kin") pick = await api.kinMove({ ranked: r, situation: spec.situation ? spec.situation(S, H) : "" });
      else pick = api.botPick(r, seat === "bot" ? spec.botLevel || "normal" : "normal");
      if (dead || !pick) return;
      busy = false; api.status("");
      go(pick.m, seat);
    }
    view = spec.mount(api.el, H);
    (async () => {
      S = api.state && api.state.v === 2 && api.state.seats ? api.state : null;
      if (!S) { const first = await api.firstMover(); S = spec.setup(first, api); S.v = 2; api.save(S); }
      spec.draw(view, S, H);
      next();
    })();
    return { destroy() { dead = true; if (view && view.destroy) view.destroy(); }, H };
  };
  // Small DOM helpers games share: a players bar and a felt or wood table.
  K.players = function (H, extra) {
    const bar = K.el("div", "pbar");
    H.S.seats.forEach((s, i) => {
      const p = K.el("div", "pchip" + (H.S.turn === i ? " on" : "") + " seat" + i + " " + s);
      p.append(K.el("b", "", H.nameOf(i))); const x = extra ? extra(i) : ""; if (x !== "" && x != null) p.append(K.el("span", "", x)); bar.append(p);
    });
    return bar;
  };

  // A square grid of buttons (rows x cols) for board games; returns {box, cells, at(r,c)}.
  K.grid = function (host, rows, cols, cls, label) {
    const box = K.el("div", "grid " + (cls || "")); box.style.gridTemplateColumns = `repeat(${cols},minmax(0,1fr))`; box.style.gridTemplateRows = `repeat(${rows},minmax(0,1fr))`; box.style.aspectRatio = cols + "/" + rows;
    const cells = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const b = K.btn("cell"); b.dataset.i = r * cols + c; if (label) b.setAttribute("aria-label", label(r, c)); cells.push(b); box.append(b); }
    host.append(box); return { box, cells, at: (r, c) => cells[r * cols + c] };
  };
  K.colLetter = (c) => "ABCDEFGHJKLMNOPQRST"[c];
  // A wooden board with n x n intersections and glossy stones. stones[i] = "b" | "w" | "". opts: {last, hot: [i], marks: {i: color}, dead: [i]}
  K.goSVG = function (n, stones, o) {
    o = o || {}; const g = 10, W = (n + 1) * g, hot = new Set(o.hot || []), id = "gs" + (++gid);
    let s = `<svg class="svgboard goban" viewBox="0 0 ${W} ${W}" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="${id}b" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#6a6a74"/><stop offset=".5" stop-color="#202026"/><stop offset="1" stop-color="#050507"/></radialGradient><radialGradient id="${id}w" cx=".35" cy=".3" r=".85"><stop offset="0" stop-color="#ffffff"/><stop offset=".6" stop-color="#ece6da"/><stop offset="1" stop-color="#b9b0a0"/></radialGradient><linearGradient id="${id}k" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e9bf74"/><stop offset=".5" stop-color="#d9a85a"/><stop offset="1" stop-color="#c58f43"/></linearGradient></defs>`;
    s += `<rect width="${W}" height="${W}" rx="4" fill="url(#${id}k)"/>`;
    for (let k = 0; k < 9; k++) s += `<path d="M0 ${8 + k * W / 9} Q${W / 2} ${4 + k * W / 9 + (k % 2) * 6} ${W} ${10 + k * W / 9}" stroke="#a0702e" stroke-opacity=".18" stroke-width="2.2" fill="none"/>`;
    for (let i = 0; i < n; i++) s += `<line x1="${g}" y1="${g + i * g}" x2="${n * g}" y2="${g + i * g}" stroke="#3b2a12" stroke-width=".45"/><line x1="${g + i * g}" y1="${g}" x2="${g + i * g}" y2="${n * g}" stroke="#3b2a12" stroke-width=".45"/>`;
    const star = n === 19 ? [3, 9, 15] : n === 13 ? [3, 6, 9] : n === 9 ? [2, 4, 6] : [Math.floor(n / 2)];
    for (const a of star) for (const b of star) if (n !== 9 || (a !== 4) === (b !== 4) || (a === 4 && b === 4)) s += `<circle cx="${g + a * g}" cy="${g + b * g}" r="1" fill="#3b2a12"/>`;
    for (let i = 0; i < n * n; i++) {
      const x = g + (i % n) * g, y = g + Math.floor(i / n) * g, v = stones[i];
      if (v) s += `<g class="stone${o.fresh === i ? " appear" : ""}" style="transform-origin:${x}px ${y}px"${o.dead && o.dead.includes(i) ? ' opacity=".45"' : ""}><circle cx="${x + .5}" cy="${y + .8}" r="4.6" fill="#000" opacity=".3"/><circle cx="${x}" cy="${y}" r="4.6" fill="url(#${id}${v})"/></g>`;
      if (o.last === i && v) s += `<circle cx="${x}" cy="${y}" r="1.6" fill="none" stroke="${v === "b" ? "#fff" : "#000"}" stroke-width=".7"/>`;
      if (o.marks && o.marks[i]) s += `<rect x="${x - 1.8}" y="${y - 1.8}" width="3.6" height="3.6" fill="${o.marks[i]}" opacity=".85"/>`;
      if (hot.has(i)) s += `<rect class="hot" data-i="${i}" x="${x - g / 2}" y="${y - g / 2}" width="${g}" height="${g}" fill="transparent"><title>${K.colLetter(i % n)}${n - Math.floor(i / n)}</title></rect>`;
    }
    return s + "</svg>";
  };
  // Calls fn(i) when an element with data-i inside host is clicked.
  K.onPick = (host, fn) => host.addEventListener("click", (e) => { const t = e.target.closest("[data-i]"); if (t && host.contains(t)) fn(Number(t.dataset.i), t, e); });
  // Places a piece's SVG at (x, y) with size w inside another SVG, optionally animated (cls like "appear").
  K.place = (svg, x, y, w, cls) => `<g class="${cls || ""}" style="transform-box:fill-box;transform-origin:center">` + svg.replace("<svg ", `<svg x="${x}" y="${y}" width="${w}" height="${w}" `) + "</g>";
  root.Kit = K;
})(typeof self !== "undefined" ? self : this);
