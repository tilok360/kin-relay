// Alley Roll: a ramp-and-rings rolling game. Roll nine balls each up the lane; they hop the ramp and drop into the rings
// (10 to 50, with 100-point pockets in the top corners). Highest total wins.
(function (root) {
  "use strict";
  const AR = typeof module === "object" && module.exports ? require("./arcade.js") : root.AR;
  const W = 200, L = 520, START = 490, HUMP = 230, CX = 100, CY = 96, BALLS = 9, BR = 9;
  const RINGS = [[13, 50], [29, 40], [45, 30], [61, 20], [80, 10]], CORNERS = [[26, 26, 11], [174, 26, 11]];
  const SPREAD = { beginner: { a: 0.05, p: 0.08 }, easy: { a: 0.032, p: 0.05 }, normal: { a: 0.02, p: 0.032 }, hard: { a: 0.011, p: 0.018 }, you: { a: 0.003, p: 0.006 } };
  // Where a roll lands: it climbs the lane, leaves the ramp at the hump and flies farther the faster it's going.
  function landing(a, p) { const dx = Math.cos(a), dy = Math.sin(a), t = (HUMP - START) / dy, hx = CX + dx * t, fly = 30 + p * 200, lx = hx + dx / -dy * fly, ly = HUMP - fly; return { hx, lx, ly }; }
  function holeAt(x, y) { for (const [cx, cy, r] of CORNERS) if (Math.hypot(x - cx, y - cy) < r) return 100; const d = Math.hypot(x - CX, y - CY); for (const [r, v] of RINGS) if (d < r) return v; if (x < BR || x > W - BR || y < 0) return 0; return 10; }
  function roll(S, m) { const r = AR.rng(S.seed + S.ply * 31337), sd = SPREAD[m.lv] || SPREAD.you, a = m.a + AR.gaussR(r) * sd.a, p = Math.max(0.05, Math.min(1.1, m.p + AR.gaussR(r) * sd.p)), L2 = landing(a, p); if (L2.hx < BR + 2 || L2.hx > W - BR - 2) return { ...L2, pts: 0, gutter: true }; return { ...L2, pts: holeAt(L2.lx, L2.ly) }; }
  const setup = (first) => ({ seats: first === "you" ? ["you", "kin"] : ["kin", "you"], score: [0, 0], left: [BALLS, BALLS], turn: 0, seed: (Math.random() * 1e9) | 0, ply: 0, marks: [] });
  const moves = (S) => (over(S) ? [] : [{ a: -Math.PI / 2, p: 0.5 }]);
  function apply(S0, m) { const res = roll(S0, m), p = S0.turn, score = S0.score.slice(), left = S0.left.slice(); score[p] += res.pts; left[p]--; return { ...S0, score, left, ply: S0.ply + 1, turn: left[1 - p] > 0 ? 1 - p : p, last: { p, ...res }, marks: [...S0.marks.slice(-5), { x: res.lx, y: res.ly, p, pts: res.pts }] }; }
  function over(S) { if (S.left[0] || S.left[1]) return null; const [a, b] = S.score; return { result: a === b ? "draw" : S.seats[a > b ? 0 : 1], detail: `${Math.max(a, b)} to ${Math.min(a, b)}` }; }
  // Aim for a spot: work out the angle and power that land there.
  function aimFor(x, y) { const fly = HUMP - y, p = (fly - 30) / 200; let lo = -Math.PI / 2 - 0.4, hi = -Math.PI / 2 + 0.4; for (let k = 0; k < 40; k++) { const mid = (lo + hi) / 2; if (landing(mid, p).lx < x) lo = mid; else hi = mid; } return { a: (lo + hi) / 2, p }; }
  function rank(S, level) {
    const sd = SPREAD[level] || SPREAD.normal, out = [];
    const spots = [["the 50 cup", CX, CY], ["the 40 ring", CX, CY - 21], ["the 40 ring (low)", CX, CY + 21], ["a safe 30", CX + 37, CY], ["the left 100 pocket", 26, 26], ["the right 100 pocket", 174, 26]];
    for (const [label, x, y] of spots) { const m = aimFor(x, y); let ev = 0; for (let k = 0; k < 60; k++) { const r = AR.rng(k * 977 + 3), a = m.a + AR.gaussR(r) * sd.a, p = m.p + AR.gaussR(r) * sd.p, L2 = landing(a, p); ev += L2.hx < BR + 2 || L2.hx > W - BR - 2 ? 0 : holeAt(L2.lx, L2.ly); } out.push({ m: { ...m, lv: level }, label: `roll for ${label}`, score: ev / 60 }); }
    // late in the game, chase if behind
    const me = S.turn, gap = S.score[1 - me] - S.score[me], left = S.left[me];
    if (gap > 0 && left <= 3) out.forEach((o) => { if (o.label.includes("100")) o.score += gap / left / 4; });
    return out.sort((a, b) => b.score - a.score);
  }
  const E = { W, L, START, HUMP, landing, holeAt, roll, setup, moves, apply, over, rank, aimFor };
  if (typeof module === "object" && module.exports) { module.exports = E; return; }
  const K = root.Kit, PH = root.PH;
  root.KG.add({
    id: "alleyroll", title: "Alley Roll", icon: "🎱",
    rules: "Nine balls each, taking turns. Pull back from the ball and let go to roll it up the lane: the angle steers it, and the harder you roll, the farther it flies off the ramp. Land in the rings for 10, 20, 30, 40 or the 50 cup in the middle — or the tiny 100 pockets in the top corners. Highest total wins.",
    achievements: [
      { id: "hundred", icon: "💯", name: "Corner Pocket", about: "Land a 100." },
      { id: "fifties", icon: "🎯", name: "Fifty Fifty", about: "Two 50s in a row." },
      { id: "big", icon: "🏆", name: "High Score", about: "Score 300 or more in a game." },
    ],
    mount(api) {
      let aim = null, anim = null;
      return K.turnGame(api, {
        ...E, thinkMs: 700,
        mount(el, H) {
          const v = { bar: K.el("div"), info: K.el("div", "hint big") }; el.append(v.bar); v.pv = PH.view(el, W, L, 0.68); el.append(v.info);
          PH.aim(v.pv, { enabled: () => H.mine(), ball: () => ({ x: CX, y: START }), reach: 110, onAim: (a) => { aim = a; H.redraw(); }, onShoot: (a, pw) => H.play({ a, p: pw }) });
          return v;
        },
        draw(v, S, H) {
          v.bar.replaceChildren(K.players(H, (i) => `${S.score[i]} · ${S.left[i]} balls`));
          const ctx = v.pv.ctx; ctx.clearRect(0, 0, W, L);
          AR.rails(ctx, 0, 0, W, L, 0, 8);
          const lane = ctx.createLinearGradient(0, HUMP, 0, L); lane.addColorStop(0, "#9b6a3a"); lane.addColorStop(1, "#d7a96b"); ctx.fillStyle = lane; ctx.fillRect(8, HUMP, W - 16, L - HUMP);
          for (let y = HUMP + 10; y < L; y += 14) { ctx.fillStyle = "rgba(255,255,255,.05)"; ctx.fillRect(8, y, W - 16, 1); }
          ctx.fillStyle = "#2a1a40"; ctx.fillRect(0, 0, W, HUMP);
          const neon = (r, c) => { ctx.save(); ctx.shadowColor = c; ctx.shadowBlur = 10; ctx.strokeStyle = c; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(CX, CY, r, 0, 7); ctx.stroke(); ctx.restore(); };
          ctx.fillStyle = "#140c22"; ctx.beginPath(); ctx.arc(CX, CY, 82, 0, 7); ctx.fill();
          RINGS.slice().reverse().forEach(([r, val], k) => { neon(r, ["#ff4d6d", "#ffb703", "#3ddc97", "#4cc9f0", "#c77dff"][k]); ctx.fillStyle = "#fff"; ctx.font = "800 10px system-ui"; ctx.textAlign = "center"; ctx.fillText(String(val), CX, CY - r + 11); });
          ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(CX, CY, 10, 0, 7); ctx.fill();
          for (const [x, y, r] of CORNERS) { ctx.save(); ctx.shadowColor = "#ffd60a"; ctx.shadowBlur = 12; ctx.strokeStyle = "#ffd60a"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke(); ctx.restore(); ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(x, y, r - 3, 0, 7); ctx.fill(); ctx.fillStyle = "#ffd60a"; ctx.font = "800 9px system-ui"; ctx.fillText("100", x, y + r + 10); }
          const hump = ctx.createLinearGradient(0, HUMP - 8, 0, HUMP + 8); hump.addColorStop(0, "#3a2a10"); hump.addColorStop(0.5, "#f3c77a"); hump.addColorStop(1, "#6b4423"); ctx.fillStyle = hump; ctx.fillRect(8, HUMP - 6, W - 16, 12);
          for (const mk of S.marks) { ctx.globalAlpha = 0.5; AR.glossy(ctx, mk.x, mk.y, 4, mk.p === S.seats.indexOf("you") ? "#ff7a3d" : "#4aa3ff", "#222"); ctx.globalAlpha = 1; }
          const mine = S.seats.indexOf("you") === S.turn;
          if (anim) AR.glossy(ctx, anim.x, anim.y, BR * anim.s, anim.c, "#3a1a00"); else if (H.mine()) { AR.glossy(ctx, CX, START, BR, "#ff9a5a", "#7a2a00"); if (aim) PH.aimLine(ctx, { x: CX, y: START, r: BR }, aim.angle, aim.power, 160, 1); }
          void mine;
          const L2 = S.last; v.info.textContent = L2 && !anim ? `${H.nameOf(L2.p)}: ${L2.gutter ? "off the side — 0" : L2.pts === 100 ? "100!!" : L2.pts}` : H.mine() ? "Pull back from the ball and let go." : "";
        },
        async animate(v, S0, m, S1, who, H) {
          if (K.fast) return; const res = roll(S0, m), c = who === "you" ? "#ff9a5a" : "#5aa8ff"; K.sfx.rumble();
          const T1 = 26, T2 = 22; for (let k = 0; k <= T1; k++) { if (H.dead) return; anim = { x: CX + (res.hx - CX) * (k / T1), y: START + (HUMP - START) * (k / T1), s: 1, c }; this.draw(v, S0, H); await K.wait(16); }
          for (let k = 0; k <= T2; k++) { if (H.dead) return; const t = k / T2; anim = { x: res.hx + (res.lx - res.hx) * t, y: HUMP + (res.ly - HUMP) * t, s: 1 + Math.sin(t * Math.PI) * 0.6, c }; this.draw(v, S0, H); await K.wait(16); }
          if (res.pts >= 50) K.sfx.ding(); else if (res.pts) K.sfx.pocket(); else K.sfx.thock(); await K.wait(250); anim = null;
        },
        feats(S0, m, S1, who) { const L2 = S1.last; if (L2.pts === 100) api.achieve("hundred", who); const mine = S1.marks.filter((x) => x.p === L2.p).slice(-2); if (mine.length === 2 && mine.every((x) => x.pts === 50)) api.achieve("fifties", who); if (!S1.left[L2.p] && S1.score[L2.p] >= 300) api.achieve("big", who); },
        situation: (S) => `Alley Roll (roll the ball up a ramp into scoring rings). You have ${S.score[S.turn]} with ${S.left[S.turn]} balls left; they have ${S.score[1 - S.turn]} with ${S.left[1 - S.turn]}. Pick where to roll; the app rolls it.`,
        yourTurn: () => "Your roll: pull back and let go.",
      });
    },
  });
})(typeof self !== "undefined" ? self : this);
