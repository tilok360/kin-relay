// Pool: eight-ball on a 100 x 200 table (portrait). Ball 0 is the cue ball, 1-7 solids, 8 the black, 9-15 stripes.
(function (root) {
  "use strict";
  const PH = typeof module === "object" && module.exports ? require("./physics.js") : root.PH;
  const R = 2.25, TW = 100, TH = 200, MAXV = 250, PAD = 5;
  const POCKETS = [{ x: 0, y: 0, r: 5.4 }, { x: TW, y: 0, r: 5.4 }, { x: -1, y: TH / 2, r: 4.4 }, { x: TW + 1, y: TH / 2, r: 4.4 }, { x: 0, y: TH, r: 5.4 }, { x: TW, y: TH, r: 5.4 }];
  const PNAME = ["the top left corner", "the top right corner", "the left side pocket", "the right side pocket", "the bottom left corner", "the bottom right corner"];
  const WALLS = [{ x1: 0, y1: 0, x2: TW, y2: 0 }, { x1: TW, y1: 0, x2: TW, y2: TH }, { x1: TW, y1: TH, x2: 0, y2: TH }, { x1: 0, y1: TH, x2: 0, y2: 0 }];
  const COLORS = ["#f7f3ea", "#f2c43d", "#2b59c3", "#d23a2a", "#6a3fa0", "#f08a24", "#1f8a4c", "#8a2b2b", "#111111"];
  const CNAME = ["cue", "yellow", "blue", "red", "purple", "orange", "green", "maroon", "black"];
  const group = (id) => (id >= 1 && id <= 7 ? "solids" : id >= 9 ? "stripes" : id === 8 ? "eight" : "cue");
  const ballName = (id) => (id === 8 ? "the 8 ball" : `the ${id} (${CNAME[id > 8 ? id - 8 : id]} ${group(id) === "solids" ? "solid" : "stripe"})`);
  function rack(rand) {
    rand = rand || Math.random;
    const rest = [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15].sort(() => rand() - 0.5);
    // the back corners hold one solid and one stripe, the 8 sits in the middle of the third row
    const solid = rest.find((i) => i < 8), stripe = rest.find((i) => i > 8);
    const others = rest.filter((i) => i !== solid && i !== stripe);
    const order = [], balls = [{ id: 0, x: TW / 2, y: 150, r: R, m: 1 }];
    let k = 0;
    for (let row = 0; row < 5; row++) for (let j = 0; j <= row; j++) {
      let id;
      if (row === 2 && j === 1) id = 8; else if (row === 4 && j === 0) id = solid; else if (row === 4 && j === 4) id = stripe; else id = others[k++];
      order.push(id);
      balls.push({ id, x: TW / 2 + (j - row / 2) * 2 * R * 1.005, y: 58 - row * R * Math.sqrt(3) * 1.005, r: R, m: 1 });
    }
    return balls;
  }
  const world = (balls) => ({ balls: balls.map((b) => ({ ...b, vx: 0, vy: 0 })), walls: WALLS, pockets: POCKETS, friction: 42, wallRest: 0.78, ballRest: 0.95 });
  const ownIds = (g) => (g === "solids" ? [1, 2, 3, 4, 5, 6, 7] : g === "stripes" ? [9, 10, 11, 12, 13, 14, 15] : []);
  // Judges a shot. before: balls before; ev: events; S: game state (groups, broke). Returns the outcome.
  function judge(S, who, before, ev) {
    const potted = ev.filter((e) => e.type === "pocket").map((e) => e.id);
    const scratch = potted.includes(0), first = PH.firstHit(ev, 0);
    const g = S.groups[who], live = (id) => before.some((b) => b.id === id && !b.gone);
    const cleared = g ? ownIds(g).every((id) => !live(id)) : false;
    let foul = scratch || first == null, why = scratch ? "the cue ball went in" : first == null ? "the cue ball hit nothing" : "";
    if (!foul && first != null) {
      if (!g && first === 8) { foul = true; why = "the 8 ball was hit first"; }
      else if (g && !cleared && group(first) !== g) { foul = true; why = `${ballName(first)} was hit first`; }
      else if (g && cleared && first !== 8) { foul = true; why = "the 8 ball had to be hit first"; }
    }
    const out = { potted, foul, why, scratch, win: null, assign: null, again: false, respot8: false };
    if (potted.includes(8)) {
      if (!S.broke) out.respot8 = true;
      else { out.win = !foul && cleared ? who : who === "you" ? "kin" : "you"; return out; }
    }
    let mine = g;
    if (!g && !foul) { const firstPot = potted.find((id) => id !== 0 && id !== 8); if (firstPot) { mine = group(firstPot); out.assign = mine; } }
    out.again = !foul && potted.some((id) => id !== 0 && id !== 8 && group(id) === mine);
    return out;
  }
  // The app's look at the shots open to a player: ghost-ball aims at each target into each pocket, tried in the engine.
  // Is the straight path from a to b clear of every ball but the ones named?
  function clearPath(balls, ax, ay, bx, by, skip) {
    const ex = bx - ax, ey = by - ay, L2 = ex * ex + ey * ey;
    return balls.every((o) => {
      if (o.gone || skip.includes(o.id)) return true;
      const t = Math.max(0, Math.min(1, ((o.x - ax) * ex + (o.y - ay) * ey) / L2));
      return Math.hypot(o.x - ax - t * ex, o.y - ay - t * ey) > 2 * R - 0.05;
    });
  }
  function targetsFor(S, who, balls) {
    const g = S.groups[who], live = balls.filter((b) => !b.gone && b.id !== 0);
    const cleared = g && ownIds(g).every((id) => !live.some((b) => b.id === id));
    return live.filter((b) => (g ? (cleared ? b.id === 8 : group(b.id) === g) : b.id !== 8));
  }
  // Shots that look makeable from where the cue ball is, by geometry alone (quick), best first.
  function looks(S, who, balls, cue) {
    const out = [];
    for (const t of targetsFor(S, who, balls)) for (let k = 0; k < POCKETS.length; k++) {
      const p = POCKETS[k], ux = p.x - t.x, uy = p.y - t.y, ul = Math.hypot(ux, uy);
      const gx = t.x - (ux / ul) * 2 * R, gy = t.y - (uy / ul) * 2 * R, dx = gx - cue.x, dy = gy - cue.y, dl = Math.hypot(dx, dy);
      const cut = (dx * ux + dy * uy) / (dl * ul); if (cut < 0.3) continue;
      if (!clearPath(balls, cue.x, cue.y, gx, gy, [0, t.id]) || !clearPath(balls, t.x, t.y, p.x, p.y, [0, t.id])) continue;
      out.push({ t, k, dx, dy, cut, geo: cut * 10 - (dl + ul) / 40 });
    }
    return out.sort((a, b) => b.geo - a.geo);
  }
  function shots(S, who, balls, cue) {
    const g = S.groups[who], targets = targetsFor(S, who, balls), out = [];
    if (!S.broke) {
      const apex = balls.filter((b) => !b.gone && b.id).sort((a, b) => b.y - a.y)[0];
      return [{ angle: Math.atan2(apex.y - cue.y, apex.x - cue.x), power: 1, score: 50, target: apex.id, pocket: -1, label: "a hard break into the rack" }, { angle: Math.atan2(apex.y - cue.y, apex.x + 0.6 - cue.x), power: 0.8, score: 40, target: apex.id, pocket: -1, label: "a slightly softer break, a touch off centre" }];
    }
    for (const { t, k, dx, dy, cut } of looks(S, who, balls, cue).slice(0, 10)) {
      let best = null;
      for (const pw of [0.3, 0.48, 0.7]) {
        const w = world(balls); const c = w.balls.find((b) => b.id === 0); c.x = cue.x; c.y = cue.y; c.gone = false;
        const a = Math.atan2(dy, dx); c.vx = Math.cos(a) * MAXV * pw; c.vy = Math.sin(a) * MAXV * pw;
        const ev = PH.simulate(w, 20), r = judge(S, who, balls, ev);
        let sc = r.win === who ? 1000 : r.win ? -1000 : 0;
        if (r.foul) sc -= r.scratch ? 120 : 90;
        else sc += r.potted.filter((id) => id !== 0 && id !== 8 && (g ? group(id) === g : true)).length * 100 - r.potted.filter((id) => g && id !== 0 && id !== 8 && group(id) !== g).length * 20;
        sc += cut * 10 - pw * 6;
        if (!best || sc > best.score) best = { angle: a, power: pw, score: sc };
      }
      out.push({ ...best, target: t.id, pocket: k, label: `${ballName(t.id)} into ${PNAME[k]}${cut < 0.6 ? " (a thin cut)" : cut > 0.95 ? " (nearly straight)" : ""}` });
    }
    out.sort((a, b) => b.score - a.score);
    if (!out.length || out[0].score < 20) {
      // A safe touch on the nearest legal ball.
      const near = targets.slice().sort((a, b) => Math.hypot(a.x - cue.x, a.y - cue.y) - Math.hypot(b.x - cue.x, b.y - cue.y))[0];
      if (near) out.push({ angle: Math.atan2(near.y - cue.y, near.x - cue.x), power: 0.3, score: 15, target: near.id, pocket: -1, label: `a soft safety off ${ballName(near.id)}` });
      out.sort((a, b) => b.score - a.score);
    }
    return out;
  }
  const E = { rack, world, judge, shots, looks, group, R, TW, TH };
  if (typeof module === "object" && module.exports) { module.exports = E; return; }

  root.KG.add({
    id: "pool", title: "Pool", icon: "🎱", blurb: "Eight-ball: solids or stripes.",
    rules: "Eight-ball. The first player to pot a ball after the break takes that group, solids (1 to 7) or stripes (9 to 15). Pot a ball of your group and you shoot again. It's a foul to pot the cue ball, to hit nothing, or to hit the other group (or the 8) first; after a foul the other player places the cue ball anywhere. Clear your group, then pot the 8 to win; pot the 8 early, or scratch on it, and you lose. Pull back from the cue ball and let go to shoot: the farther you pull, the harder. With the cue ball in hand, drag it where you want it first.",
    achievements: [
      { id: "break_pot", icon: "💥", name: "Pot on the Break", about: "Pot a ball on the opening break with no foul." },
      { id: "double_drop", icon: "✌", name: "Double Drop", about: "Pot two or more balls with one shot and no foul." },
      { id: "eight_ball", icon: "🎱", name: "Called It", about: "Win by potting the 8 ball." },
    ],
    mount(api) {
      let S = null, dead = false, busy = false, aimNow = null, placing = false;
      const info = document.createElement("div"); info.className = "score";
      api.el.append(info);
      const v = PH.view(api.el, TW + 2 * PAD, TH + 2 * PAD, 0.68), ctx = v.ctx;
      let W = null;
      const cueBall = () => W.balls.find((b) => b.id === 0);
      function draw() {
        ctx.save(); ctx.clearRect(0, 0, TW + 2 * PAD, TH + 2 * PAD);
        ctx.fillStyle = "#5a3b22"; ctx.fillRect(0, 0, TW + 2 * PAD, TH + 2 * PAD);
        ctx.translate(PAD, PAD);
        ctx.fillStyle = "#1d6b45"; ctx.fillRect(0, 0, TW, TH);
        ctx.strokeStyle = "rgba(255,255,255,.12)"; ctx.lineWidth = 0.4; ctx.beginPath(); ctx.moveTo(0, 150); ctx.lineTo(TW, 150); ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,.2)"; ctx.beginPath(); ctx.arc(TW / 2, 58, 0.7, 0, 7); ctx.fill();
        for (const p of POCKETS) { ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 0.85, 0, Math.PI * 2); ctx.fillStyle = "#0a0a0a"; ctx.fill(); }
        for (const b of W.balls) if (!b.gone) PH.ball(ctx, b, COLORS[b.id > 8 ? b.id - 8 : b.id], null, b.id ? String(b.id) : "", b.id > 8);
        if (aimNow) PH.aimLine(ctx, cueBall(), aimNow.angle, aimNow.power, 60, 0.5);
        if (S.inHand === S.turn && !busy) { const c = cueBall(); ctx.strokeStyle = "#ffd65a"; ctx.lineWidth = 0.5; ctx.setLineDash([1, 1]); ctx.beginPath(); ctx.arc(c.x, c.y, R + 2, 0, 7); ctx.stroke(); ctx.setLineDash([]); }
        ctx.restore();
        const gtxt = (w) => (S.groups[w] ? ` · ${S.groups[w]} ${ownIds(S.groups[w]).filter((id) => W.balls.some((b) => b.id === id && !b.gone)).length} left` : "");
        info.innerHTML = `<span><b class="you">You</b>${gtxt("you")}</span><span><b class="kinc"></b>${gtxt("kin")}</span>`;
        info.querySelector(".kinc").textContent = api.kinName();
      }
      const snapshot = () => W.balls.map((b) => ({ id: b.id, x: b.x, y: b.y, r: b.r, m: 1, gone: !!b.gone }));
      function save() { S.balls = snapshot(); api.save(S); }
      const free = (x, y) => x > R && x < TW - R && y > R && y < TH - R && W.balls.every((b) => b.gone || b.id === 0 || Math.hypot(b.x - x, b.y - y) > 2 * R + 0.2);
      v.cv.addEventListener("pointerdown", (ev) => {
        if (busy || S.turn !== "you" || S.inHand !== "you" || api.ended()) return;
        const p = v.toWorld(ev), c = cueBall(); p.x -= PAD; p.y -= PAD;
        if (Math.hypot(p.x - c.x, p.y - c.y) < R * 3.5) { placing = true; (() => { try { v.cv.setPointerCapture(ev.pointerId); } catch {} })(); }
      });
      v.cv.addEventListener("pointermove", (ev) => {
        if (!placing) return; const p = v.toWorld(ev); p.x -= PAD; p.y -= PAD;
        if (free(p.x, p.y)) { const c = cueBall(); c.x = p.x; c.y = p.y; draw(); }
      });
      v.cv.addEventListener("pointerup", () => { placing = false; });
      PH.aim(v, {
        enabled: () => !busy && S.turn === "you" && !api.ended(),
        ball: () => { const c = cueBall(); return { x: c.x + PAD, y: c.y + PAD }; },
        grab: (p) => { if (S.inHand !== "you") return false; const c = cueBall(); return Math.hypot(p.x - PAD - c.x, p.y - PAD - c.y) < R * 3.5; },
        reach: 45, onAim: (a) => { aimNow = a; draw(); }, onShoot: (a, pw) => shoot("you", a, pw),
      });
      async function shoot(who, angle, power) {
        busy = true; aimNow = null;
        const before = snapshot(), c = cueBall();
        c.vx = Math.cos(angle) * MAXV * power; c.vy = Math.sin(angle) * MAXV * power;
        const ev = await PH.animate(W, draw, () => dead);
        if (dead) return;
        const r = judge(S, who, before, ev), foe = who === "you" ? "kin" : "you";
        const balls = r.potted.filter((id) => id);
        if (!S.broke && balls.length && !r.foul) api.achieve("break_pot", who);
        if (balls.length >= 2 && !r.foul) api.achieve("double_drop", who);
        if (r.win && r.win === who) api.achieve("eight_ball", who);
        S.broke = true;
        if (r.respot8) { const b8 = W.balls.find((b) => b.id === 8); b8.gone = false; b8.x = TW / 2; b8.y = 50; }
        if (r.scratch) { c.gone = false; c.x = TW / 2; c.y = 150; let k = 0; while (!free(c.x, c.y) && k++ < 40) c.y += 2; }
        if (r.assign) { S.groups[who] = r.assign; S.groups[foe] = r.assign === "solids" ? "stripes" : "solids"; }
        const name = who === "you" ? "You" : api.kinName();
        if (r.win) { busy = false; save(); draw(); return api.over(r.win, r.win === who ? `${who === "you" ? "you" : "it"} potted the 8` : `the 8 went down early or with a foul`); }
        S.inHand = r.foul ? foe : null;
        S.turn = r.again ? who : foe;
        save(); busy = false; draw();
        const pottedTxt = r.potted.filter((id) => id).map((id) => (id === 8 ? "8" : String(id))).join(", ");
        api.status(r.foul ? `Foul: ${r.why}. ${foe === "you" ? "You have" : api.kinName() + " has"} the cue ball in hand.` : r.again ? `${name} potted ${pottedTxt}${r.assign ? ` and ${who === "you" ? "take" : "takes"} ${r.assign}` : ""}. ${name} ${who === "you" ? "shoot" : "shoots"} again.` : pottedTxt ? `${name} potted ${pottedTxt}.` : `Nothing down.`);
        if (who === "kin" && api.settings.mode === "talk" && (r.foul || r.potted.length >= 2)) api.line(r.foul ? `You just fouled: ${r.why}.` : `You just potted ${pottedTxt}.`);
        if (S.turn === "kin") setTimeout(kinTurn, 900);
        else if (!r.foul && !r.again) setTimeout(() => api.status("Your shot: pull back from the cue ball and let go."), 1500);
      }
      async function kinTurn() {
        if (dead || api.ended()) return;
        busy = true; draw(); api.status(`${api.kinName()} is lining up a shot…`, true);
        await PH.wait(60);
        const balls = snapshot();
        if (S.inHand === "kin") {
          // Ball in hand: try a few places and keep the one with the best shot.
          let best = null;
          for (let y = 12; y <= 190; y += 8) for (let x = 8; x <= 92; x += 8) {
            if (!free(x, y)) continue;
            const s = looks(S, "kin", balls, { x, y })[0];
            if (s && (!best || s.geo > best.s.geo)) best = { x, y, s };
          }
          if (best) { const c = cueBall(); c.x = best.x; c.y = best.y; draw(); await PH.wait(500); }
        }
        const cue = cueBall(), list = shots(S, "kin", snapshot(), { x: cue.x, y: cue.y });
        const seen = new Set(), ranked = list.filter((s) => { const k = s.target + ":" + s.pocket; if (seen.has(k)) return false; seen.add(k); return true; });
        const g = S.groups.kin;
        const situation = `Eight-ball. ${g ? `You have ${g}; ${ownIds(g).filter((id) => W.balls.some((b) => b.id === id && !b.gone)).length} left. Your person has ${S.groups.you}.` : "The table is open: the first ball you pot sets your group."}${S.inHand === "kin" ? " You had the cue ball in hand." : ""} Pick the shot you want; the app will strike it.`;
        const pick = await api.kinMove({ ranked, situation });
        if (dead || !pick) return;
        const sp = PH.spread(api.settings.level);
        aimNow = { angle: pick.angle, power: pick.power }; draw(); await PH.wait(700); if (dead) return;
        S.inHand = null;
        shoot("kin", pick.angle + PH.gauss() * sp.a, Math.min(1, Math.max(0.08, pick.power * (1 + PH.gauss() * sp.p))));
      }
      const onResize = () => { v.fit(); draw(); };
      addEventListener("resize", onResize);
      (async () => {
        S = api.state && api.state.balls ? api.state : null;
        if (!S) { const first = await api.firstMover(); S = { v: 1, turn: first, groups: { you: null, kin: null }, inHand: null, broke: false, balls: rack() }; api.save(S); }
        W = world(S.balls);
        draw();
        if (S.turn === "kin") setTimeout(kinTurn, 600); else api.status(S.broke ? "Your shot: pull back from the cue ball and let go." : "Your break: pull back from the cue ball and let go. A hard break spreads the rack.");
      })();
      return { destroy() { dead = true; removeEventListener("resize", onResize); } };
    },
  });
})(typeof self !== "undefined" ? self : this);
