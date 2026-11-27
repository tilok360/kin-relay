// Cup Pong: six cups of water each, set in a triangle. Take turns tossing a ball; sink one and that cup comes off.
// First to clear all of the other side's cups wins.
(function (root) {
  "use strict";
  const AR = typeof module === "object" && module.exports ? require("./arcade.js") : root.AR;
  const W = 240, TH = 460, CR = 13, SP = 27;
  const rack = (top) => { const o = []; [3, 2, 1].forEach((n, row) => { for (let k = 0; k < n; k++) o.push({ x: W / 2 + (k - (n - 1) / 2) * SP, y: top ? 40 + row * SP * 0.88 : TH - 40 - row * SP * 0.88 }); }); return o; };
  const SIG = { beginner: 17, easy: 12.5, normal: 9.5, hard: 7, you: 2.2 };
  const setup = (first) => ({ seats: first === "you" ? ["you", "kin"] : ["kin", "you"], cups: [rack(false).map(() => true), rack(true).map(() => true)], turn: 0, seed: (Math.random() * 1e9) | 0, ply: 0, trail: null });
  // Your cups are always at the near (bottom) end, your opponent's at the far end.
  const cupPos = (S, seat) => rack(S.seats[seat] !== "you");
  function toss(S, m) { const r = AR.rng(S.seed + S.ply * 7907), sg = SIG[m.lv] || SIG.you; const x = m.x + AR.gaussR(r) * sg, y = m.y + AR.gaussR(r) * sg * 1.2; const tgt = 1 - S.turn, pos = cupPos(S, tgt); let hit = -1; pos.forEach((c, i) => { if (S.cups[tgt][i] && Math.hypot(c.x - x, c.y - y) < CR - 3) hit = i; }); let rim = hit < 0 && pos.some((c, i) => S.cups[tgt][i] && Math.hypot(c.x - x, c.y - y) < CR + 2); return { x, y, hit, rim }; }
  const moves = (S) => (over(S) ? [] : [{ x: W / 2, y: 60 }]);
  function apply(S0, m) { const t = toss(S0, m), tgt = 1 - S0.turn, cups = S0.cups.map((c) => c.slice()); if (t.hit >= 0) cups[tgt][t.hit] = false; return { ...S0, cups, ply: S0.ply + 1, turn: tgt, last: { p: S0.turn, ...t } }; }
  function over(S) { for (const s of [0, 1]) if (!S.cups[s].some(Boolean)) return { result: S.seats[1 - s], detail: `with ${S.cups[1 - s].filter(Boolean).length} cup${S.cups[1 - s].filter(Boolean).length === 1 ? "" : "s"} left` }; return null; }
  function rank(S, level) {
    const tgt = 1 - S.turn, pos = cupPos(S, tgt), sg = SIG[level] || SIG.normal, out = [];
    pos.forEach((c, i) => { if (!S.cups[tgt][i]) return; let hits = 0; for (let k = 0; k < 120; k++) { const r = AR.rng(k * 131 + 7), x = c.x + AR.gaussR(r) * sg, y = c.y + AR.gaussR(r) * sg * 1.2; if (pos.some((q, j) => S.cups[tgt][j] && Math.hypot(q.x - x, q.y - y) < CR - 3)) hits++; } const row = [0, 0, 0, 1, 1, 2][i], name = row === 2 ? "the front cup" : row === 1 ? `the ${c.x < W / 2 ? "left" : "right"} middle cup` : `the back ${c.x < W / 2 - 5 ? "left" : c.x > W / 2 + 5 ? "right" : "centre"} cup`; out.push({ m: { x: c.x, y: c.y, lv: level }, label: `aim at ${name}`, score: hits / 120 }); });
    return out.sort((a, b) => b.score - a.score);
  }
  const E = { W, TH, CR, setup, moves, apply, over, rank, toss, cupPos };
  if (typeof module === "object" && module.exports) { module.exports = E; return; }
  const K = root.Kit, PH = root.PH;
  root.KG.add({
    id: "cuppong", title: "Cup Pong", icon: "🥤",
    rules: "Each side has six cups of water in a triangle. Take turns tossing: press and hold on the far table to aim (your aim drifts a little, so let go when it's on target). Sink a ball and that cup is taken away. First to clear all of the other side's cups wins.",
    achievements: [
      { id: "streak", icon: "🔥", name: "Heating Up", about: "Sink three tosses in a row." },
      { id: "last", icon: "🧊", name: "Ice Cold", about: "Win with all six of your cups still standing." },
      { id: "rim", icon: "🌀", name: "So Close", about: "Rattle the rim." },
    ],
    mount(api) {
      let hold = null, raf = 0, anim = null; const streak = [0, 0];
      return K.turnGame(api, {
        ...E, thinkMs: 800,
        mount(el, H) {
          const v = { bar: K.el("div"), info: K.el("div", "hint big") }; el.append(v.bar); v.pv = PH.view(el, W, TH, 0.7); el.append(v.info);
          const cv = v.pv.cv; cv.style.touchAction = "none";
          const ret = () => { const t = (performance.now() - hold.t0) / 1000, amp = 5 + Math.min(9, t * 3); return { x: hold.x + Math.sin(t * 2.3) * amp, y: hold.y - 22 + Math.sin(t * 3.1 + 1) * amp * 0.8 }; };
          const loop = () => { H.redraw(); if (hold) raf = requestAnimationFrame(loop); };
          v.ret = () => (hold ? ret() : null);
          cv.addEventListener("pointerdown", (e) => { if (!H.mine()) return; const p = v.pv.toWorld(e); hold = { x: p.x, y: p.y, t0: performance.now() }; try { cv.setPointerCapture(e.pointerId); } catch {} loop(); });
          cv.addEventListener("pointermove", (e) => { if (hold) { const p = v.pv.toWorld(e); hold.x = p.x; hold.y = p.y; } });
          cv.addEventListener("pointerup", () => { if (!hold) return; const p = ret(); hold = null; cancelAnimationFrame(raf); H.play({ x: p.x, y: p.y }); });
          cv.addEventListener("pointercancel", () => { hold = null; cancelAnimationFrame(raf); H.redraw(); });
          v.destroy = () => cancelAnimationFrame(raf); return v;
        },
        draw(v, S, H) {
          v.bar.replaceChildren(K.players(H, (i) => `${S.cups[i].filter(Boolean).length} cups`));
          const ctx = v.pv.ctx; ctx.clearRect(0, 0, W, TH);
          AR.rails(ctx, 0, 0, W, TH, 0, 8);
          const g = ctx.createLinearGradient(0, 0, 0, TH); g.addColorStop(0, "#0f5c3c"); g.addColorStop(0.5, "#16805a"); g.addColorStop(1, "#0f5c3c"); ctx.fillStyle = g; ctx.fillRect(6, 6, W - 12, TH - 12);
          ctx.strokeStyle = "rgba(255,255,255,.7)"; ctx.lineWidth = 2; ctx.strokeRect(10, 10, W - 20, TH - 20); ctx.beginPath(); ctx.moveTo(10, TH / 2); ctx.lineTo(W - 10, TH / 2); ctx.stroke();
          for (const s of [0, 1]) cupPos(S, s).forEach((c, i) => { if (!S.cups[s][i]) { ctx.strokeStyle = "rgba(255,255,255,.18)"; ctx.beginPath(); ctx.arc(c.x, c.y, CR, 0, 7); ctx.stroke(); return; } const col = s === S.seats.indexOf("you") ? ["#ff5a5a", "#9a1a1a"] : ["#4aa3ff", "#174e96"]; ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.beginPath(); ctx.arc(c.x + 2, c.y + 3, CR + 1, 0, 7); ctx.fill(); const gc = ctx.createRadialGradient(c.x - 4, c.y - 4, 2, c.x, c.y, CR + 1); gc.addColorStop(0, col[0]); gc.addColorStop(1, col[1]); ctx.fillStyle = gc; ctx.beginPath(); ctx.arc(c.x, c.y, CR + 1, 0, 7); ctx.fill(); ctx.fillStyle = "#f6f2ea"; ctx.beginPath(); ctx.arc(c.x, c.y, CR - 2, 0, 7); ctx.fill(); ctx.fillStyle = "#7fc8ff"; ctx.beginPath(); ctx.arc(c.x, c.y, CR - 4.5, 0, 7); ctx.fill(); ctx.fillStyle = "rgba(255,255,255,.5)"; ctx.beginPath(); ctx.arc(c.x - 3, c.y - 3, 2.4, 0, 7); ctx.fill(); });
          const r = v.ret && v.ret(); if (r) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(r.x, r.y, 7, 0, 7); ctx.moveTo(r.x - 11, r.y); ctx.lineTo(r.x + 11, r.y); ctx.moveTo(r.x, r.y - 11); ctx.lineTo(r.x, r.y + 11); ctx.stroke(); }
          if (anim) { ctx.fillStyle = "rgba(0,0,0,.3)"; ctx.beginPath(); ctx.ellipse(anim.x, anim.y, 4, 3, 0, 0, 7); ctx.fill(); AR.glossy(ctx, anim.x, anim.y - anim.z, 4 + anim.z * 0.04, "#fff", "#c9b98a"); }
          const L2 = S.last; v.info.textContent = L2 && !anim ? `${H.nameOf(L2.p)}: ${L2.hit >= 0 ? "SPLASH! Cup down." : L2.rim ? "off the rim!" : "miss"}` : H.mine() ? "Press and hold over their cups, let go to toss." : "";
        },
        async animate(v, S0, m, S1, who, H) {
          if (K.fast) return; const t = toss(S0, m), fromY = S0.seats[S0.turn] === "you" ? TH - 20 : 20, N = 34; K.sfx.swish();
          for (let k = 0; k <= N; k++) { if (H.dead) return; const s = k / N; anim = { x: W / 2 + (t.x - W / 2) * s, y: fromY + (t.y - fromY) * s, z: Math.sin(s * Math.PI) * 90 }; this.draw(v, S0, H); await K.wait(16); }
          if (t.hit >= 0) K.sfx.pop(); else if (t.rim) K.sfx.clack(); else K.sfx.tick(); await K.wait(250); anim = null;
        },
        feats(S0, m, S1, who) { const L2 = S1.last, p = L2.p; streak[p] = L2.hit >= 0 ? streak[p] + 1 : 0; if (streak[p] >= 3) api.achieve("streak", who); if (L2.rim) api.achieve("rim", who); const o = over(S1); if (o && S1.cups[p].every(Boolean)) api.achieve("last", who); },
        situation: (S) => `Cup Pong. You have ${S.cups[S.turn].filter(Boolean).length} cups left, they have ${S.cups[1 - S.turn].filter(Boolean).length}. Pick a cup to aim at; the app tosses.`,
        yourTurn: () => "Your toss: press, hold and let go.",
      });
    },
  });
})(typeof self !== "undefined" ? self : this);
