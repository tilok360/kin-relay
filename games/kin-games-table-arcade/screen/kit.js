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

  // ---------------- dice ----------------
  const DP = { 1: [[1, 1]], 2: [[0, 0], [2, 2]], 3: [[0, 0], [1, 1], [2, 2]], 4: [[0, 0], [2, 0], [0, 2], [2, 2]], 5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]], 6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]] };
  K.dieSVG = function (v, col) {
    const c = col || { face: "#fbf7ee", edge: "#d9cfbd", pip: "#1c1a20" };
    let s = `<svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="2" width="56" height="56" rx="11" fill="${c.edge}"/><rect x="3" y="3" width="54" height="52" rx="10" fill="${c.face}"/><rect x="7" y="6" width="46" height="10" rx="5" fill="#fff" opacity=".35"/>`;
    for (const [x, y] of DP[v] || []) s += `<circle cx="${15 + x * 15}" cy="${15 + y * 14.5}" r="5" fill="${c.pip}"/><circle cx="${14 + x * 15}" cy="${13.6 + y * 14.5}" r="1.6" fill="#fff" opacity=".35"/>`;
    return s + "</svg>";
  };
  K.die = function (v, opts) {
    const o = opts || {}, e = K.el(o.onClick ? "button" : "div", "die3" + (o.held ? " held" : "") + (o.cls ? " " + o.cls : ""));
    if (o.onClick) { e.type = "button"; e.onclick = o.onClick; }
    e.innerHTML = K.dieSVG(v, o.color); e.setAttribute("aria-label", `die showing ${v}${o.held ? ", held" : ""}`); e.dataset.v = v;
    return e;
  };
  // Tumbles dice elements through random faces before landing on their values.
  K.roll = async function (els, vals, color) {
    K.sfx.roll();
    if (RM() || K.fast) { els.forEach((e, i) => (e.innerHTML = K.dieSVG(vals[i], color))); K.sfx.land(); return; }
    els.forEach((e) => e.classList.add("rolling"));
    for (let k = 0; k < 8; k++) { els.forEach((e) => (e.innerHTML = K.dieSVG(1 + Math.floor(Math.random() * 6), color))); await K.wait(55 + k * 10); }
    els.forEach((e, i) => { e.innerHTML = K.dieSVG(vals[i], color); e.classList.remove("rolling"); e.dataset.v = vals[i]; });
    K.sfx.land();
  };
  K.d6 = () => 1 + Math.floor(Math.random() * 6);

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

  K.onPick = (host, fn) => host.addEventListener("click", (e) => { const t = e.target.closest("[data-i]"); if (t && host.contains(t)) fn(Number(t.dataset.i), t, e); });
  // Places a piece's SVG at (x, y) with size w inside another SVG, optionally animated (cls like "appear").
  K.place = (svg, x, y, w, cls) => `<g class="${cls || ""}" style="transform-box:fill-box;transform-origin:center">` + svg.replace("<svg ", `<svg x="${x}" y="${y}" width="${w}" height="${w}" `) + "</g>";
  root.Kit = K;
})(typeof self !== "undefined" ? self : this);
