// Mini golf: nine holes on a 100 x 150 course. You and your Kin take turns putting, both balls on the course at once
// (they pass through each other). Fewest strokes over nine holes wins; a hole is picked up at seven.
(function (root) {
  "use strict";
  const PH = typeof module === "object" && module.exports ? require("./physics.js") : root.PH;
  const R = 1.6, CUP = 3.2, MAXV = 170, CAP = 7;
  const rect = (x1, y1, x2, y2) => [[x1, y1], [x2, y1], [x2, y2], [x1, y2]];
  const diamond = (x, y, s) => [[x, y - s], [x + s, y], [x, y + s], [x - s, y]];
  const HOLES = [
    { par: 2, poly: rect(20, 10, 80, 140), tee: [50, 125], cup: [50, 25] },
    { par: 2, poly: rect(15, 10, 85, 140), blocks: [rect(35, 65, 65, 85)], tee: [50, 128], cup: [50, 22] },
    { par: 3, poly: [[10, 10], [90, 10], [90, 50], [45, 50], [45, 140], [10, 140]], tee: [27, 125], cup: [75, 28] },
    { par: 2, poly: rect(15, 10, 85, 140), sand: [[25, 58, 75, 82]], tee: [50, 128], cup: [50, 25] },
    { par: 3, poly: rect(10, 10, 90, 140), water: [[10, 70, 40, 86], [60, 70, 90, 86]], tee: [50, 128], cup: [28, 25] },
    { par: 3, poly: rect(10, 10, 90, 140), lines: [[10, 98, 64, 98], [36, 55, 90, 55]], tee: [20, 128], cup: [78, 24] },
    { par: 2, poly: rect(15, 10, 85, 140), blocks: [diamond(35, 78, 7), diamond(65, 78, 7), diamond(50, 50, 7)], tee: [50, 128], cup: [50, 22] },
    { par: 2, poly: [[10, 140], [90, 140], [90, 92], [60, 52], [60, 10], [40, 10], [40, 52], [10, 92]], tee: [50, 128], cup: [50, 22] },
    { par: 3, poly: rect(10, 10, 90, 140), water: [[10, 56, 68, 72]], sand: [[58, 18, 90, 40]], tee: [25, 128], cup: [35, 25] },
  ];
  function segs(h) {
    const out = [], ring = (pts) => pts.forEach((p, i) => { const q = pts[(i + 1) % pts.length]; out.push({ x1: p[0], y1: p[1], x2: q[0], y2: q[1] }); });
    ring(h.poly); (h.blocks || []).forEach(ring); (h.lines || []).forEach((l) => out.push({ x1: l[0], y1: l[1], x2: l[2], y2: l[3] }));
    return out;
  }
  function world(h, balls) {
    const zones = (h.sand || []).map((s) => ({ x1: s[0], y1: s[1], x2: s[2], y2: s[3], friction: 150 })).concat((h.water || []).map((w) => ({ x1: w[0], y1: w[1], x2: w[2], y2: w[3], water: true })));
    return { balls: balls.map((b) => ({ ...b, r: R, m: 1, vx: 0, vy: 0, ghost: true, wet: false })), walls: segs(h), pockets: [{ x: h.cup[0], y: h.cup[1], r: CUP, maxSpeed: 70 }], zones, ghosts: true, friction: 36, wallRest: 0.75, ballRest: 0.9 };
  }
  // The app's look at putts from (x, y): every direction at a range of strengths, run in the engine. Best first.
  function putts(h, x, y) {
    const out = [];
    for (let deg = 0; deg < 360; deg += 4) for (const pw of [0.14, 0.22, 0.32, 0.45, 0.6, 0.78, 1]) {
      const a = (deg * Math.PI) / 180, w = world(h, [{ id: "p", x, y }]), b = w.balls[0];
      b.vx = Math.cos(a) * MAXV * pw; b.vy = Math.sin(a) * MAXV * pw;
      const ev = PH.simulate(w, 12), holed = ev.some((e) => e.type === "pocket"), wet = ev.some((e) => e.type === "water"), banks = ev.filter((e) => e.type === "wall").length;
      const d = holed ? 0 : Math.hypot(b.x - h.cup[0], b.y - h.cup[1]);
      const inSand = (h.sand || []).some((s) => b.x > s[0] && b.x < s[2] && b.y > s[1] && b.y < s[3]);
      out.push({ angle: a, power: pw, holed, wet, banks, d, score: holed ? 1000 - pw * 10 : wet ? -500 : -d - (inSand ? 6 : 0) - banks * 0.3 });
    }
    return out.sort((p, q) => q.score - p.score);
  }
  function describe(p, x, y, h) {
    const toCup = Math.atan2(h.cup[1] - y, h.cup[0] - x);
    let off = ((p.angle - toCup) * 180) / Math.PI; off = ((off + 540) % 360) - 180;
    const dir = Math.abs(off) < 6 ? "straight at the cup" : `${Math.round(Math.abs(off))}° to the ${off < 0 ? "left" : "right"} of the cup`;
    const how = p.power < 0.25 ? "a gentle tap" : p.power < 0.5 ? "a medium putt" : p.power < 0.8 ? "a firm putt" : "a hard putt";
    const bank = p.banks ? `, banking off ${p.banks === 1 ? "a wall" : p.banks + " walls"}` : "";
    const end = p.holed ? "should drop in" : `should stop about ${Math.max(1, Math.round(p.d / 2))} ball-lengths away`;
    return `${how} ${dir}${bank}: it ${end}`;
  }
  const E = { HOLES, world, putts, describe, segs };
  if (typeof module === "object" && module.exports) { module.exports = E; return; }

  root.KG.add({
    id: "minigolf", title: "Mini golf", icon: "⛳", blurb: "Nine holes, fewest strokes.",
    rules: "Nine holes. You and your Kin take turns putting, both balls on the course at once; they roll through each other. Pull back from your ball and let go: the farther you pull, the harder the putt. A ball rolling too fast skips over the cup. Sand slows the ball; water costs a stroke and puts the ball back where it was. A hole is picked up at seven strokes. Fewest strokes over the nine holes wins.",
    achievements: [
      { id: "ace", icon: "⛳", name: "Hole in One", about: "Sink a putt from the tee." },
      { id: "birdie", icon: "🐦", name: "Birdie", about: "Finish a hole one or more under par." },
      { id: "under_par", icon: "🏆", name: "Under Par", about: "Finish the nine holes at or under par." },
    ],
    mount(api) {
      let S = null, dead = false, busy = false, aimNow = null, W = null;
      const info = document.createElement("div"); info.className = "score";
      api.el.append(info);
      const PAD = 4, v = PH.view(api.el, 100 + 2 * PAD, 150 + 2 * PAD, 0.64), ctx = v.ctx;
      const card = document.createElement("div"); card.className = "movelist"; api.el.append(card);
      const hole = () => HOLES[S.hole];
      const total = (who) => S.scores[who].reduce((a, b) => a + b, 0);
      function draw() {
        const h = hole();
        ctx.save(); ctx.clearRect(0, 0, 108, 158); ctx.translate(PAD, PAD);
        ctx.fillStyle = "#14301f"; ctx.fillRect(-PAD, -PAD, 108, 158);
        const path = (pts) => { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); };
        path(h.poly); ctx.fillStyle = "#3f9a52"; ctx.fill();
        for (const s of h.sand || []) { ctx.fillStyle = "#e3cf8f"; ctx.fillRect(s[0], s[1], s[2] - s[0], s[3] - s[1]); }
        for (const w of h.water || []) { ctx.fillStyle = "#2f7fc4"; ctx.fillRect(w[0], w[1], w[2] - w[0], w[3] - w[1]); }
        ctx.strokeStyle = "#7a4a26"; ctx.lineWidth = 1.6; ctx.lineJoin = "round";
        path(h.poly); ctx.stroke();
        for (const b of h.blocks || []) { path(b); ctx.fillStyle = "#7a4a26"; ctx.fill(); }
        for (const l of h.lines || []) { ctx.beginPath(); ctx.moveTo(l[0], l[1]); ctx.lineTo(l[2], l[3]); ctx.stroke(); }
        ctx.beginPath(); ctx.arc(h.cup[0], h.cup[1], CUP * 0.8, 0, 7); ctx.fillStyle = "#0b0b0b"; ctx.fill();
        ctx.strokeStyle = "#ddd"; ctx.lineWidth = 0.4; ctx.beginPath(); ctx.moveTo(h.cup[0], h.cup[1]); ctx.lineTo(h.cup[0], h.cup[1] - 10); ctx.stroke();
        ctx.fillStyle = "#e33"; ctx.beginPath(); ctx.moveTo(h.cup[0], h.cup[1] - 10); ctx.lineTo(h.cup[0] + 5, h.cup[1] - 8.5); ctx.lineTo(h.cup[0], h.cup[1] - 7); ctx.fill();
        for (const b of W.balls) if (!b.gone && !S.done[b.id]) PH.ball(ctx, b, "#fbfbf6", b.id === "you" ? "#f0b35a" : "#8fb8ff");
        if (aimNow) PH.aimLine(ctx, W.balls.find((b) => b.id === "you"), aimNow.angle, aimNow.power, 30, 0.35);
        ctx.restore();
        info.innerHTML = `<span>Hole ${S.hole + 1} of 9 · par ${h.par}</span><span><b class="you">You</b> ${total("you") + (S.done.you ? 0 : S.strokes.you)} · <b class="kinc"></b> ${total("kin") + (S.done.kin ? 0 : S.strokes.kin)}</span>`;
        info.querySelector(".kinc").textContent = api.kinName();
        card.textContent = S.scores.you.length ? `Card  you: ${S.scores.you.join(" ")}  ·  ${api.kinName()}: ${S.scores.kin.join(" ")}` : "";
      }
      function freshHole() {
        const h = hole();
        S.pos = { you: { x: h.tee[0] - 3, y: h.tee[1] }, kin: { x: h.tee[0] + 3, y: h.tee[1] } };
        S.strokes = { you: 0, kin: 0 }; S.done = { you: false, kin: false };
        S.turn = S.hole % 2 === 0 ? S.first : S.first === "you" ? "kin" : "you";
      }
      const build = () => { W = world(hole(), ["you", "kin"].map((id) => ({ id, x: S.pos[id].x, y: S.pos[id].y }))); };
      PH.aim(v, {
        enabled: () => !busy && S.turn === "you" && !api.ended(),
        ball: () => { const b = W.balls.find((x) => x.id === "you"); return { x: b.x + PAD, y: b.y + PAD }; },
        reach: 34, onAim: (a) => { aimNow = a; draw(); }, onShoot: (a, pw) => putt("you", a, pw),
      });
      async function putt(who, angle, power) {
        busy = true; aimNow = null;
        const b = W.balls.find((x) => x.id === who), from = { x: b.x, y: b.y };
        W.balls.forEach((x) => { x.vx = x.vy = 0; x.wet = false; });
        b.vx = Math.cos(angle) * MAXV * power; b.vy = Math.sin(angle) * MAXV * power;
        S.strokes[who]++;
        const ev = await PH.animate(W, draw, () => dead);
        if (dead) return;
        const name = who === "you" ? "You" : api.kinName();
        let msg;
        if (ev.some((e) => e.type === "pocket" && e.id === who)) {
          S.done[who] = true;
          if (S.strokes[who] === 1) api.achieve("ace", who);
          if (S.strokes[who] <= hole().par - 1) api.achieve("birdie", who);
          msg = `${name} holed out in ${S.strokes[who]}${S.strokes[who] === 1 ? " (a hole in one!)" : ""}.`;
          if (who === "kin" && api.settings.mode !== "quiet" && S.strokes.kin <= hole().par - 1) api.line(`You just made ${S.strokes.kin === 1 ? "a hole in one" : "a birdie"} on hole ${S.hole + 1}.`);
        } else if (ev.some((e) => e.type === "water" && e.id === who)) {
          S.strokes[who]++; b.x = from.x; b.y = from.y; b.wet = false; msg = `${name} found the water: one stroke penalty.`;
        } else msg = "";
        if (!S.done[who] && S.strokes[who] >= CAP) { S.done[who] = true; msg = `${name} picked up at ${CAP}.`; }
        S.pos[who] = { x: b.x, y: b.y };
        if (msg) api.status(msg);
        if (S.done.you && S.done.kin) {
          S.scores.you.push(S.strokes.you); S.scores.kin.push(S.strokes.kin);
          if (S.hole === 8) { busy = false; draw(); api.save(S); const y = total("you"), k = total("kin"), par = HOLES.reduce((a, h) => a + h.par, 0);
            if (y <= par) api.achieve("under_par", "you"); if (k <= par) api.achieve("under_par", "kin"); return api.over(y < k ? "you" : k < y ? "kin" : "draw", `${y} strokes to ${k} over nine holes`); }
          await PH.wait(1300); if (dead) return;
          S.hole++; freshHole(); build(); api.status(`Hole ${S.hole + 1}, par ${hole().par}.`);
        } else {
          const other = who === "you" ? "kin" : "you";
          S.turn = S.done[other] ? who : other;
        }
        api.save(S); busy = false; draw();
        if (S.turn === "kin") setTimeout(kinTurn, 700);
        else if (!msg) api.status("Your putt: pull back from your ball and let go.");
      }
      async function kinTurn() {
        if (dead || api.ended()) return;
        busy = true; api.status(`${api.kinName()} is reading the green…`, true);
        await PH.wait(60);
        const b = W.balls.find((x) => x.id === "kin"), h = hole(), all = putts(h, b.x, b.y);
        // A few different ideas, not the same putt three ways.
        const ranked = [];
        for (const p of all) { if (ranked.length >= 8) break; if (ranked.some((q) => Math.abs(q.angle - p.angle) < 0.2 && Math.abs(q.power - p.power) < 0.3)) continue; ranked.push({ ...p, label: describe(p, b.x, b.y, h) }); }
        const situation = `Mini golf, hole ${S.hole + 1} of 9 (par ${h.par}). This is your stroke ${S.strokes.kin + 1}. Total so far: you ${total("kin")}, your person ${total("you")}. Pick the putt you want; the app will hit it.`;
        const pick = await api.kinMove({ ranked, situation });
        if (dead || !pick) return;
        aimNow = null; await PH.wait(300);
        const sp = PH.spread(api.settings.level);
        putt("kin", pick.angle + PH.gauss() * sp.a, Math.min(1, Math.max(0.05, pick.power * (1 + PH.gauss() * sp.p * 0.7))));
      }
      const onResize = () => { v.fit(); draw(); };
      addEventListener("resize", onResize);
      (async () => {
        S = api.state && api.state.pos ? api.state : null;
        if (!S) { const first = await api.firstMover(); S = { v: 1, hole: 0, first, scores: { you: [], kin: [] } }; freshHole(); api.save(S); }
        build(); draw();
        if (S.turn === "kin") setTimeout(kinTurn, 600); else api.status(`Hole ${S.hole + 1}, par ${hole().par}. Your putt: pull back from your ball and let go.`);
      })();
      return { destroy() { dead = true; removeEventListener("resize", onResize); } };
    },
  });
})(typeof self !== "undefined" ? self : this);
