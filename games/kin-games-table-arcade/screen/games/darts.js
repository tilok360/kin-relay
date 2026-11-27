// Darts: 301, straight out. Three darts a turn; land exactly on zero to win, go below and the turn is bust.
// The board is in millimetres from the centre, numbers clockwise from 20 at the top.
(function (root) {
  "use strict";
  const ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
  const RING = { bull: 6.35, outer: 15.9, t1: 99, t2: 107, d1: 162, d2: 170 };
  const START = 301;
  function score(x, y) {
    const r = Math.hypot(x, y);
    if (r <= RING.bull) return { n: 50, text: "bullseye" };
    if (r <= RING.outer) return { n: 25, text: "outer bull" };
    if (r > RING.d2) return { n: 0, text: "off the board" };
    let a = (Math.atan2(y, x) * 180) / Math.PI + 90; a = ((a % 360) + 360) % 360;
    const base = ORDER[Math.round(a / 18) % 20];
    if (r > RING.t1 && r <= RING.t2) return { n: base * 3, text: `treble ${base}` };
    if (r > RING.d1) return { n: base * 2, text: `double ${base}` };
    return { n: base, text: String(base) };
  }
  function aimPoint(t) {
    if (t.kind === "bull") return { x: 0, y: 0 };
    if (t.kind === "outer") return { x: 0, y: -11 };
    const i = ORDER.indexOf(t.n), a = ((i * 18 - 90) * Math.PI) / 180;
    const r = t.kind === "T" ? 103 : t.kind === "D" ? 166 : t.kind === "S" ? 125 : 60;
    return { x: Math.cos(a) * r, y: Math.sin(a) * r };
  }
  const tName = (t) => (t.kind === "bull" ? "the bullseye (50)" : t.kind === "outer" ? "the outer bull (25)" : t.kind === "T" ? `treble ${t.n} (${t.n * 3})` : t.kind === "D" ? `double ${t.n} (${t.n * 2})` : `single ${t.n}`);
  const SIGMA = { beginner: 46, easy: 32, normal: 20, hard: 12 };
  const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  // Targets worth aiming at with `left` to go, best first, by trying each one a few hundred times at this spread.
  function targets(left, sigma, tries) {
    const ts = [{ kind: "T", n: 20 }, { kind: "T", n: 19 }, { kind: "T", n: 18 }, { kind: "bull" }, { kind: "outer" }, { kind: "S", n: 20 }, { kind: "S", n: 19 }];
    if (left <= 40 && left % 2 === 0) ts.push({ kind: "D", n: left / 2 });
    if (left <= 20) ts.push({ kind: "S", n: left });
    if (left <= 60 && left % 3 === 0) ts.push({ kind: "T", n: left / 3 });
    if (left > 20 && left <= 40) ts.push({ kind: "S", n: left - 20 > 0 && left - 20 <= 20 ? left - 20 : 20 });
    const seen = new Set(), out = [];
    for (const t of ts) {
      const k = t.kind + (t.n || ""); if (seen.has(k)) continue; seen.add(k);
      const p = aimPoint(t); let sum = 0;
      for (let i = 0; i < (tries || 300); i++) {
        const s = score(p.x + gauss() * sigma, p.y + gauss() * sigma).n;
        sum += s === left ? 400 : s > left ? -30 : left - s === 1 ? s * 0.6 : s;
      }
      out.push({ t, score: sum / (tries || 300), label: tName(t) });
    }
    return out.sort((a, b) => b.score - a.score);
  }
  const E = { score, aimPoint, targets, tName, START, ORDER };
  if (typeof module === "object" && module.exports) { module.exports = E; return; }

  const PH = root.PH;
  root.KG.add({
    id: "darts", title: "Darts", icon: "🎯", blurb: "301 down to zero.",
    rules: "301, straight out. Each turn is three darts; what you score comes off your total. Land exactly on zero to win. Score more than you have left and the turn is bust: your total goes back to where the turn started. Trebles (the inner thin ring) count three times, doubles (the outer ring) twice, the outer bull 25 and the bullseye 50. Press on the board and hold: your aim drifts a little, so let go when it's where you want it. You and your Kin take turns throwing first.",
    achievements: [
      { id: "bullseye", icon: "🎯", name: "Bullseye", about: "Hit the inner bull." },
      { id: "ton_up", icon: "💯", name: "Ton Up", about: "Score 100 or more with one turn's three darts." },
      { id: "big_finish", icon: "🏁", name: "Big Finish", about: "Check out from 60 or more in one turn." },
    ],
    mount(api) {
      let S = null, dead = false, busy = false, hold = null, raf = 0;
      const info = document.createElement("div"); info.className = "score";
      api.el.append(info);
      const SZ = 420, v = PH.view(api.el, SZ, SZ, 0.6), ctx = v.ctx;
      const turnEl = document.createElement("div"); turnEl.className = "status"; api.el.append(turnEl);
      const C = SZ / 2;
      function board() {
        ctx.save(); ctx.clearRect(0, 0, SZ, SZ); ctx.translate(C, C);
        ctx.fillStyle = "#111"; ctx.beginPath(); ctx.arc(0, 0, 205, 0, 7); ctx.fill();
        for (let i = 0; i < 20; i++) {
          const a0 = ((i * 18 - 99) * Math.PI) / 180, a1 = ((i * 18 - 81) * Math.PI) / 180, dark = i % 2 === 0;
          const ring = (r0, r1, col) => { ctx.beginPath(); ctx.arc(0, 0, r1, a0, a1); ctx.arc(0, 0, r0, a1, a0, true); ctx.closePath(); ctx.fillStyle = col; ctx.fill(); };
          ring(RING.outer, RING.t1, dark ? "#1b1b1b" : "#efe3c4"); ring(RING.t1, RING.t2, dark ? "#c8262e" : "#1f8a4c");
          ring(RING.t2, RING.d1, dark ? "#1b1b1b" : "#efe3c4"); ring(RING.d1, RING.d2, dark ? "#c8262e" : "#1f8a4c");
          const am = ((i * 18 - 90) * Math.PI) / 180;
          ctx.fillStyle = "#f6efe6"; ctx.font = "700 17px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText(String(ORDER[i]), Math.cos(am) * 188, Math.sin(am) * 188);
        }
        ctx.beginPath(); ctx.arc(0, 0, RING.outer, 0, 7); ctx.fillStyle = "#1f8a4c"; ctx.fill();
        ctx.beginPath(); ctx.arc(0, 0, RING.bull, 0, 7); ctx.fillStyle = "#c8262e"; ctx.fill();
        for (const d of S.darts) { ctx.beginPath(); ctx.arc(d.x, d.y, 4.5, 0, 7); ctx.fillStyle = d.who === "you" ? "#f0b35a" : "#8fb8ff"; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = "#000"; ctx.stroke(); }
        if (hold) { const p = reticle(); ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, 9, 0, 7); ctx.moveTo(p.x - 14, p.y); ctx.lineTo(p.x + 14, p.y); ctx.moveTo(p.x, p.y - 14); ctx.lineTo(p.x, p.y + 14); ctx.stroke(); }
        ctx.restore();
        info.innerHTML = `<span><b class="you">You</b> ${S.left.you} left</span><span><b class="kinc"></b> ${S.left.kin} left</span>`;
        info.querySelector(".kinc").textContent = api.kinName();
        turnEl.textContent = S.darts.length ? `This turn: ${S.darts.map((d) => d.text).join(", ")}` : "";
      }
      // Where the aim is while you hold: a little above your finger, drifting in a slow loop.
      function reticle() {
        const t = (performance.now() - hold.t0) / 1000, amp = 9 + Math.min(10, t * 3);
        return { x: hold.x + Math.sin(t * 2.1) * amp, y: hold.y - 28 + Math.sin(t * 2.9 + 1) * amp * 0.8 };
      }
      const loop = () => { board(); if (hold) raf = requestAnimationFrame(loop); };
      const toBoard = (ev) => { const p = v.toWorld(ev); return { x: p.x - C, y: p.y - C }; };
      v.cv.addEventListener("pointerdown", (ev) => {
        if (busy || S.turn !== "you" || api.ended()) return;
        const p = toBoard(ev); hold = { ...p, t0: performance.now() }; (() => { try { v.cv.setPointerCapture(ev.pointerId); } catch {} })(); loop();
      });
      v.cv.addEventListener("pointermove", (ev) => { if (hold) { const p = toBoard(ev); hold.x = p.x; hold.y = p.y; } });
      v.cv.addEventListener("pointerup", () => { if (!hold) return; const p = reticle(); hold = null; cancelAnimationFrame(raf); throwAt("you", p.x + gauss() * 4, p.y + gauss() * 4); });
      v.cv.addEventListener("pointercancel", () => { hold = null; cancelAnimationFrame(raf); board(); });
      function throwAt(who, x, y) {
        const s = score(x, y);
        S.darts.push({ who, x, y, n: s.n, text: s.text });
        const used = S.darts.reduce((a, d) => a + d.n, 0), left = S.turnStart - used;
        if (s.n === 50) api.achieve("bullseye", who);
        if (left >= 0 && used >= 100) api.achieve("ton_up", who);
        if (left === 0 && S.turnStart >= 60) api.achieve("big_finish", who);
        let end = false, msg = "";
        if (left === 0) { S.left[who] = 0; board(); api.save(S); api.over(who, `checked out from ${S.turnStart}`); return "won"; }
        if (left < 0) { S.left[who] = S.turnStart; msg = `Bust! ${who === "you" ? "You go" : api.kinName() + " goes"} back to ${S.turnStart}.`; end = true; }
        else { S.left[who] = left; if (S.darts.length === 3) { end = true; msg = `${who === "you" ? "You" : api.kinName()} scored ${used}.`; } }
        api.save(S); board();
        if (end) {
          busy = true;
          api.status(msg);
          const next = who === "you" ? "kin" : "you";
          setTimeout(() => { if (dead) return; S.turn = next; S.darts = []; S.turnStart = S.left[next]; busy = false; api.save(S); board(); if (next === "kin") kinTurn(); else api.status(`Your throw: ${S.left.you} to go.`); }, 1500);
        }
        return end ? "end" : "more";
      }
      async function kinTurn() {
        if (dead || api.ended()) return;
        busy = true;
        const sigma = SIGMA[api.settings.level] || 20;
        const ranked = targets(S.left.kin, sigma);
        const situation = `Darts, 301 straight out (land exactly on zero; going below is a bust). You have ${S.left.kin} left, your person ${S.left.you}. Pick what to aim at with your three darts; the app will throw them.`;
        api.status(`${api.kinName()} steps up to the line…`, true);
        const pick = await api.kinMove({ ranked, situation });
        if (dead || !pick) return;
        let target = pick.t;
        for (let k = 0; k < 3; k++) {
          await PH.wait(900); if (dead) return;
          const left = S.turnStart - S.darts.reduce((a, d) => a + d.n, 0);
          if (k > 0) { const best = targets(left, sigma, 200)[0]; const mine = targets(left, sigma, 200).find((x) => tName(x.t) === tName(target)); if (!mine || mine.score < best.score * 0.6) target = best.t; }
          const p = aimPoint(target), r = throwAt("kin", p.x + gauss() * sigma, p.y + gauss() * sigma);
          api.status(`${api.kinName()}: ${S.darts.map((d) => d.text).join(", ")}`);
          if (r !== "more") break;
        }
        if (api.settings.mode === "talk" && S.darts.some((d) => d.n >= 50)) api.line(`You just threw ${S.darts.map((d) => d.text).join(", ")}.`);
      }
      const onResize = () => { v.fit(); board(); };
      addEventListener("resize", onResize);
      (async () => {
        S = api.state && api.state.left ? api.state : null;
        if (!S) { const first = await api.firstMover(); S = { v: 1, left: { you: START, kin: START }, turn: first, darts: [], turnStart: START }; api.save(S); }
        board();
        if (S.turn === "kin") { S.darts = []; S.turnStart = S.left.kin; kinTurn(); }
        else api.status(`Your throw: ${S.left.you} to go. Press on the board, hold, and let go.`);
      })();
      return { destroy() { dead = true; cancelAnimationFrame(raf); removeEventListener("resize", onResize); } };
    },
  });
})(typeof self !== "undefined" ? self : this);
