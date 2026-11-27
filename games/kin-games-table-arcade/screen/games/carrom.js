// Carrom on a 100 x 100 board. You play the white coins and shoot from the bottom line; your Kin plays black
// from the top. The red queen must be pocketed and then covered with one of your own coins.
(function (root) {
  "use strict";
  const PH = typeof module === "object" && module.exports ? require("./physics.js") : root.PH;
  const B = 100, CR = 1.9, SR = 2.6, MAXV = 220, PAD = 5;
  const BASE = { you: 82, kin: 18 }, XMIN = 22, XMAX = 78;
  const POCKETS = [{ x: 0, y: 0, r: 5 }, { x: B, y: 0, r: 5 }, { x: 0, y: B, r: 5 }, { x: B, y: B, r: 5 }];
  const PNAME = ["the top left pocket", "the top right pocket", "the bottom left pocket", "the bottom right pocket"];
  const WALLS = [{ x1: 0, y1: 0, x2: B, y2: 0 }, { x1: B, y1: 0, x2: B, y2: B }, { x1: B, y1: B, x2: 0, y2: B }, { x1: 0, y1: B, x2: 0, y2: 0 }];
  const colourOf = (who) => (who === "you" ? "w" : "b");
  function setup() {
    const coins = [{ id: "q", c: "q", x: 50, y: 50 }];
    let w = 0, b = 0;
    for (let k = 0; k < 6; k++) { const a = (k * Math.PI) / 3, c = k % 2 ? "b" : "w"; coins.push({ id: c + (c === "w" ? w++ : b++), c, x: 50 + Math.cos(a) * 2.05 * CR, y: 50 + Math.sin(a) * 2.05 * CR }); }
    for (let k = 0; k < 12; k++) { const a = (k * Math.PI) / 6 + Math.PI / 12, c = k % 2 ? "w" : "b"; coins.push({ id: c + (c === "w" ? w++ : b++), c, x: 50 + Math.cos(a) * 4.1 * CR, y: 50 + Math.sin(a) * 4.1 * CR }); }
    return coins.map((o) => ({ ...o, r: CR, m: 1, gone: false }));
  }
  const world = (coins, striker) => ({ balls: coins.map((o) => ({ ...o, vx: 0, vy: 0 })).concat(striker ? [{ id: "s", c: "s", x: striker.x, y: striker.y, r: SR, m: 1.8, vx: 0, vy: 0, gone: false }] : []), walls: WALLS, pockets: POCKETS, friction: 34, wallRest: 0.68, ballRest: 0.88 });
  // Places a coin back near the centre where it fits.
  function respot(coins, coin) {
    for (let rad = 0; rad < 30; rad += 0.8) for (let a = 0; a < Math.PI * 2; a += 0.5) {
      const x = 50 + Math.cos(a) * rad, y = 50 + Math.sin(a) * rad;
      if (coins.every((o) => o === coin || o.gone || Math.hypot(o.x - x, o.y - y) > 2 * CR + 0.1)) { coin.x = x; coin.y = y; coin.gone = false; return; }
      if (!rad) break;
    }
  }
  // Settles a shot. S has coins (after the shot), pocketed: {w, b} counts, queen: null | "pending:<who>" | "<who>".
  function settle(S, who, ev) {
    const me = colourOf(who), foe = me === "w" ? "b" : "w";
    const potted = ev.filter((e) => e.type === "pocket").map((e) => e.id);
    const struck = potted.includes("s"), own = potted.filter((id) => id[0] === me), theirs = potted.filter((id) => id[0] === foe), queen = potted.includes("q");
    const coin = (id) => S.coins.find((o) => o.id === id);
    const out = { struck, own: own.length, theirs: theirs.length, queen, again: false, note: "" };
    if (struck) {
      // Foul: this shot's own coins and the queen come back, plus one of yours already pocketed.
      own.forEach((id) => respot(S.coins, coin(id)));
      if (queen) respot(S.coins, coin("q"));
      const back = S.coins.find((o) => o.gone && o.c === me);
      if (back) respot(S.coins, back);
      if (S.queen === "pending:" + who) { respot(S.coins, coin("q")); S.queen = null; }
      out.note = "the striker went in: a foul" + (back ? ", and one of the shooter's coins comes back" : "");
      return out;
    }
    if (S.queen === "pending:" + who) {
      if (own.length) { S.queen = who; out.note = "the queen is covered"; }
      else { respot(S.coins, coin("q")); S.queen = null; out.note = "the queen wasn't covered, so it goes back"; }
    }
    if (queen) {
      if (own.length) { S.queen = who; out.note = "queen pocketed and covered"; }
      else { S.queen = "pending:" + who; out.note = "queen pocketed: cover it with your next coin"; }
    }
    // The last coin can't go down while the queen is still on the board.
    const left = (c) => S.coins.filter((o) => !o.gone && o.c === c).length;
    for (const c of [me, foe]) if (!left(c) && !(S.queen === "you" || S.queen === "kin")) { const last = S.coins.find((o) => o.gone && o.c === c); respot(S.coins, last); out.note = "the queen must be covered before the last coin"; }
    out.again = own.length > 0 || S.queen === "pending:" + who;
    return out;
  }
  const winner = (S) => { for (const who of ["you", "kin"]) if (!S.coins.some((o) => !o.gone && o.c === colourOf(who))) return who; return null; };
  // Shots that look makeable for `who` from each place on its line, tried in the engine. Best first.
  function shots(S, who) {
    const me = colourOf(who), y = BASE[who], out = [];
    const live = S.coins.filter((o) => !o.gone), targets = live.filter((o) => o.c === me || (o.c === "q" && !S.queen));
    const clear = (ax, ay, bx, by, skip, rad) => { const ex = bx - ax, ey = by - ay, L2 = ex * ex + ey * ey || 1; return live.every((o) => { if (skip.includes(o.id)) return true; const t = Math.max(0, Math.min(1, ((o.x - ax) * ex + (o.y - ay) * ey) / L2)); return Math.hypot(o.x - ax - t * ex, o.y - ay - t * ey) > rad; }); };
    const looks = [];
    for (let x = XMIN; x <= XMAX; x += 3) {
      if (!live.every((o) => Math.hypot(o.x - x, o.y - y) > CR + SR)) continue;
      for (const t of targets) for (let k = 0; k < 4; k++) {
        const p = POCKETS[k], ux = p.x - t.x, uy = p.y - t.y, ul = Math.hypot(ux, uy);
        const gx = t.x - (ux / ul) * (CR + SR), gy = t.y - (uy / ul) * (CR + SR), dx = gx - x, dy = gy - y, dl = Math.hypot(dx, dy);
        const cut = (dx * ux + dy * uy) / (dl * ul); if (cut < 0.35) continue;
        if (!clear(x, y, gx, gy, [t.id], CR + SR - 0.05) || !clear(t.x, t.y, p.x, p.y, [t.id], 2 * CR - 0.05)) continue;
        looks.push({ x, t, k, a: Math.atan2(dy, dx), cut, geo: cut * 10 - (dl + ul) / 30 + (t.c === "q" ? 2 : 0) });
      }
    }
    looks.sort((a, b) => b.geo - a.geo);
    for (const L of looks.slice(0, 14)) for (const pw of [0.35, 0.6]) {
      const w = world(S.coins, { x: L.x, y }), s = w.balls.find((b) => b.id === "s");
      s.vx = Math.cos(L.a) * MAXV * pw; s.vy = Math.sin(L.a) * MAXV * pw;
      const ev = PH.simulate(w, 20), pot = ev.filter((e) => e.type === "pocket").map((e) => e.id);
      let sc = pot.filter((id) => id[0] === me).length * 100 - pot.filter((id) => id[0] !== me && id !== "q" && id !== "s").length * 30 + (pot.includes("q") ? 70 : 0) - (pot.includes("s") ? 160 : 0) + L.cut * 8 - pw * 4;
      out.push({ x: L.x, angle: L.a, power: pw, score: sc, target: L.t.id, pocket: L.k, label: `${L.t.c === "q" ? "the red queen" : "a " + (me === "w" ? "white" : "black") + " coin"} into ${PNAME[L.k]}${L.cut > 0.95 ? " (straight on)" : L.cut < 0.6 ? " (a thin cut)" : ""}` });
    }
    out.sort((a, b) => b.score - a.score);
    const seen = new Set();
    const best = out.filter((s) => { const k = s.target + ":" + s.pocket; if (seen.has(k)) return false; seen.add(k); return true; });
    if (!best.length || best[0].score < 20) {
      // Nothing clean: a firm shot into the thick of the coins.
      const own = live.filter((o) => o.c === me)[0] || live[0];
      const x = Math.max(XMIN, Math.min(XMAX, own ? own.x : 50));
      best.push({ x, angle: Math.atan2((own ? own.y : 50) - y, (own ? own.x : 50) - x), power: 0.55, score: 10, target: own ? own.id : "", pocket: -1, label: "a firm shot into the pack to break it up" });
    }
    return best;
  }
  const E = { setup, world, settle, winner, shots, respot, BASE };
  if (typeof module === "object" && module.exports) { module.exports = E; return; }

  root.KG.add({
    id: "carrom", title: "Carrom", icon: "🟤", blurb: "Flick the striker, pocket your coins.",
    rules: "You play the nine white coins and shoot the striker from the bottom line; your Kin plays black from the top. Slide the striker along your line, then pull back from it and let go. Pocket one of your coins and you shoot again. Pocketing the striker is a foul: the coins you pocketed that shot come back to the centre, with one more of yours. The red queen counts only once it's covered: pocket it, then pocket one of your own coins on the same or your very next shot, or it goes back to the centre. The queen must be covered before anyone's last coin can go down. First to pocket all nine of their coins wins.",
    achievements: [
      { id: "queen_cover", icon: "👑", name: "Royal Cover", about: "Pocket the red queen and cover it." },
      { id: "double_pocket", icon: "✌", name: "Double Pocket", about: "Pocket two or more of your coins with one strike." },
      { id: "hot_hand", icon: "🔥", name: "Hot Hand", about: "Pocket your coins on three strikes in a row." },
    ],
    mount(api) {
      let S = null, dead = false, busy = false, aimNow = null, W = null;
      const info = document.createElement("div"); info.className = "score";
      api.el.append(info);
      const v = PH.view(api.el, B + 2 * PAD, B + 2 * PAD, 0.62), ctx = v.ctx;
      const slideWrap = document.createElement("label"); slideWrap.textContent = "Slide your striker";
      const slide = Object.assign(document.createElement("input"), { type: "range", min: XMIN, max: XMAX, step: 0.5, value: 50 });
      slideWrap.append(slide); api.el.append(slideWrap);
      const striker = () => W.balls.find((b) => b.id === "s");
      function draw() {
        ctx.save(); ctx.clearRect(0, 0, B + 2 * PAD, B + 2 * PAD);
        ctx.fillStyle = "#3d2414"; ctx.fillRect(0, 0, B + 2 * PAD, B + 2 * PAD);
        ctx.translate(PAD, PAD);
        ctx.fillStyle = "#e9cf98"; ctx.fillRect(0, 0, B, B);
        ctx.strokeStyle = "rgba(90,50,20,.55)"; ctx.lineWidth = 0.35;
        for (const y of [BASE.kin, BASE.you]) { ctx.strokeRect(XMIN - 2, y - 2.3, XMAX - XMIN + 4, 4.6); }
        ctx.beginPath(); ctx.arc(50, 50, 9, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.arc(50, 50, 2.6, 0, 7); ctx.stroke();
        for (const p of POCKETS) { ctx.beginPath(); ctx.arc(p.x, p.y, 4.2, 0, 7); ctx.fillStyle = "#151010"; ctx.fill(); }
        for (const b of W.balls) if (!b.gone) {
          if (b.id === "s") PH.ball(ctx, b, "#f4efe4", S.turn === "you" ? "#f0b35a" : "#8fb8ff");
          else PH.ball(ctx, b, b.c === "w" ? "#f7ecd6" : b.c === "b" ? "#2a1d16" : "#c8202a", b.c === "w" ? "#b89b6a" : "rgba(0,0,0,.5)");
        }
        if (aimNow) PH.aimLine(ctx, striker(), aimNow.angle, aimNow.power, 40, 0.4);
        ctx.restore();
        const left = (c) => S.coins.filter((o) => !o.gone && o.c === c).length;
        const q = S.queen === "you" ? " · queen ✓" : "", qk = S.queen === "kin" ? " · queen ✓" : "";
        info.innerHTML = `<span><b class="you">You</b> white: ${9 - left("w")}/9${q}</span><span><b class="kinc"></b> black: ${9 - left("b")}/9${qk}</span>`;
        info.querySelector(".kinc").textContent = api.kinName();
        slideWrap.hidden = !(S.turn === "you" && !busy && !api.ended());
      }
      function placeStriker(who, x) {
        const y = BASE[who];
        let s = striker();
        if (!s) { s = { id: "s", c: "s", r: SR, m: 1.8, vx: 0, vy: 0, gone: false }; W.balls.push(s); }
        s.gone = false; s.vx = s.vy = 0; s.y = y;
        // nudge along the line until it doesn't sit on a coin
        let best = x;
        for (let d = 0; d < 60; d += 0.5) for (const sx of [x + d, x - d]) {
          if (sx < XMIN || sx > XMAX) continue;
          if (W.balls.every((o) => o === s || o.gone || Math.hypot(o.x - sx, o.y - y) > o.r + SR + 0.1)) { best = sx; d = 99; break; }
        }
        s.x = best;
      }
      slide.addEventListener("input", () => { if (busy || S.turn !== "you") return; placeStriker("you", Number(slide.value)); draw(); });
      PH.aim(v, {
        enabled: () => !busy && S.turn === "you" && !api.ended(),
        ball: () => { const s = striker(); return { x: s.x + PAD, y: s.y + PAD }; },
        reach: 30, onAim: (a) => { aimNow = a; draw(); }, onShoot: (a, pw) => shoot("you", a, pw),
      });
      const coinsNow = () => W.balls.filter((b) => b.id !== "s").map((b) => ({ id: b.id, c: b.c, x: b.x, y: b.y, r: b.r, m: 1, gone: !!b.gone }));
      let streak = { who: "", n: 0 };
      async function shoot(who, angle, power) {
        busy = true; aimNow = null; draw();
        const s = striker(); s.vx = Math.cos(angle) * MAXV * power; s.vy = Math.sin(angle) * MAXV * power;
        const ev = await PH.animate(W, draw, () => dead);
        if (dead) return;
        S.coins = coinsNow();
        const hadQueen = S.queen === who;
        const r = settle(S, who, ev), name = who === "you" ? "You" : api.kinName();
        if (S.queen === who && !hadQueen) api.achieve("queen_cover", who);
        if (r.own >= 2 && !r.struck) api.achieve("double_pocket", who);
        streak = r.own > 0 && !r.struck ? (streak.who === who ? { who, n: streak.n + 1 } : { who, n: 1 }) : { who: "", n: 0 };
        if (streak.n === 3) api.achieve("hot_hand", who);
        W = world(S.coins);
        const win = winner(S);
        if (win) { busy = false; S.turn = "done"; api.save(S); draw(); return api.over(win, `${win === "you" ? "white" : "black"} cleared first`); }
        S.turn = r.again ? who : who === "you" ? "kin" : "you";
        placeStriker(S.turn, 50); slide.value = 50;
        api.save(S); busy = false; draw();
        const bits = [];
        if (r.own) bits.push(`${name} pocketed ${r.own === 1 ? "a coin" : r.own + " coins"}`);
        if (r.theirs) bits.push(`${r.theirs === 1 ? "a coin" : r.theirs + " coins"} of the other colour went in`);
        if (r.note) bits.push(r.note);
        api.status((bits.join("; ") || `${name}: nothing in`) + (S.turn === who ? `. ${name} ${who === "you" ? "go" : "goes"} again.` : "."));
        if (who === "kin" && api.settings.mode === "talk" && (r.queen || r.struck || r.own >= 2)) api.line(r.struck ? "Your striker just went into a pocket, a foul." : r.queen ? "You just pocketed the red queen." : `You just pocketed ${r.own} coins in one shot.`);
        if (S.turn === "kin") setTimeout(kinTurn, 900);
      }
      async function kinTurn() {
        if (dead || api.ended()) return;
        busy = true; draw(); api.status(`${api.kinName()} is lining up a shot…`, true);
        await PH.wait(60);
        const ranked = shots(S, "kin");
        const situation = `Carrom. You play black and shoot from the top line; your person plays white. Coins left: you ${S.coins.filter((o) => !o.gone && o.c === "b").length}, them ${S.coins.filter((o) => !o.gone && o.c === "w").length}. ${S.queen === "pending:kin" ? "You pocketed the queen last shot: pocket a black coin now to cover it." : S.queen ? "" : "The red queen is still on the board."} Pick the shot you want; the app will flick it.`;
        const pick = await api.kinMove({ ranked, situation });
        if (dead || !pick) return;
        placeStriker("kin", pick.x); aimNow = { angle: pick.angle, power: pick.power }; draw();
        await PH.wait(700); if (dead) return;
        const sp = PH.spread(api.settings.level);
        shoot("kin", pick.angle + PH.gauss() * sp.a, Math.min(1, Math.max(0.1, pick.power * (1 + PH.gauss() * sp.p))));
      }
      const onResize = () => { v.fit(); draw(); };
      addEventListener("resize", onResize);
      (async () => {
        S = api.state && api.state.coins ? api.state : null;
        if (!S) { const first = await api.firstMover(); S = { v: 1, coins: setup(), queen: null, turn: first }; api.save(S); }
        W = world(S.coins); placeStriker(S.turn, 50);
        draw();
        if (S.turn === "kin") setTimeout(kinTurn, 600); else api.status("Your shot: slide the striker, then pull back from it and let go.");
      })();
      return { destroy() { dead = true; removeEventListener("resize", onResize); } };
    },
  });
})(typeof self !== "undefined" ? self : this);
