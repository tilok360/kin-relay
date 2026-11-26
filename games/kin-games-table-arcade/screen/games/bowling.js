// Ten-pin bowling: ten frames each, two balls a frame, strikes and spares scored the proper way.
(function (root) {
  "use strict";
  const PHm = typeof module === "object" && module.exports ? require("./physics.js") : root.PH, AR = typeof module === "object" && module.exports ? require("./arcade.js") : root.AR;
  const W = 96, G = 10, L = 640, BR = 8, PR = 4.3, START = 600, HEAD = 90;
  const SPOTS = (() => { const o = []; for (let row = 0; row < 4; row++) for (let k = 0; k <= row; k++) o.push({ x: W / 2 + (k - row / 2) * 22, y: HEAD - row * 19 }); return o; })();
  const SPREAD = { beginner: { a: 0.03, p: 0.1, x: 8 }, easy: { a: 0.018, p: 0.06, x: 5 }, normal: { a: 0.01, p: 0.04, x: 3 }, hard: { a: 0.005, p: 0.02, x: 1.5 }, you: { a: 0.002, p: 0.01, x: 0 } };
  function setup(first) { return { seats: first === "you" ? ["you", "kin"] : ["kin", "you"], rolls: [[], []], frame: [0, 0], standing: SPOTS.map(() => true), ball: 0, turn: 0, seed: (Math.random() * 1e9) | 0, ply: 0 }; }
  function scoreRolls(r) { let t = 0, i = 0; const frames = []; for (let f = 0; f < 10 && i < r.length; f++) { if (r[i] === 10) { if (r[i + 2] == null) { frames.push(null); break; } t += 10 + r[i + 1] + r[i + 2]; i++; } else if (r[i + 1] == null) { frames.push(null); break; } else if (r[i] + r[i + 1] === 10) { if (r[i + 2] == null) { frames.push(null); break; } t += 10 + r[i + 2]; i += 2; } else { t += r[i] + r[i + 1]; i += 2; } frames.push(t); } return { total: t, frames }; }
  function frameOf(r) { let i = 0, f = 0; while (f < 9 && i < r.length) { if (r[i] === 10) i++; else { if (r[i + 1] == null) return { f, ball: 1 }; i += 2; } f++; } return { f, ball: r.length - i }; }
  function tenthDone(r) { let i = 0; for (let f = 0; f < 9; f++) i += r[i] === 10 ? 1 : 2; const t = r.slice(i); if (t.length < 2) return false; if (t.length === 2) return t[0] + t[1] < 10; return true; }
  const done = (r) => frameOf(r).f >= 9 && tenthDone(r);
  function launch(S, m) { const r = AR.rng(S.seed + S.ply * 104729), sd = SPREAD[m.lv] || SPREAD.you, a = m.a + AR.gaussR(r) * sd.a, p = Math.max(0.15, Math.min(1.05, m.p + AR.gaussR(r) * sd.p)), v = 260 + p * 300, x = Math.max(G + BR, Math.min(W - G - BR, m.x + AR.gaussR(r) * sd.x)); return { id: "ball", x, y: START, r: BR, m: 5, vx: Math.cos(a) * v, vy: Math.sin(a) * v }; }
  function world(S, ball) { const balls = [ball]; SPOTS.forEach((p, i) => S.standing[i] && balls.push({ id: "p" + i, x: p.x, y: p.y, r: PR, m: 1.5, vx: 0, vy: 0 })); return { balls, walls: [{ x1: 0, y1: -10, x2: W, y2: -10 }, { x1: 0, y1: -10, x2: 0, y2: L }, { x1: W, y1: -10, x2: W, y2: L }], pockets: [], friction: 70, wallRest: 0.3, ballRest: 0.45, stopSpeed: 3, ghosts: true }; }
  function stepB(w, ev) { PHm.step(w, ev); const b = w.balls[0]; if (!b.ghost && (b.x < G || b.x > W - G) && b.y > HEAD - 70) { b.ghost = true; b.x = b.x < G ? G / 2 : W - G / 2; b.vx = 0; ev.push({ type: "gutter" }); } if (b.ghost) b.x = b.x < W / 2 ? G / 2 : W - G / 2; if (b.y < -5) { b.vx = b.vy = 0; b.gone = true; } for (const p of w.balls) if (p !== b && !p.gone && (p.x < G - 2 || p.x > W - G + 2 || p.y < -6)) { p.gone = true; p.vx = p.vy = 0; } }
  function run(w) { const ev = []; for (let k = 0; k < 240 * 12 && PHm.moving(w); k++) stepB(w, ev); return ev; }
  function knocked(S, w) { const st = S.standing.slice(); SPOTS.forEach((p, i) => { if (!st[i]) return; const b = w.balls.find((x) => x.id === "p" + i); if (!b || b.gone || Math.hypot(b.x - p.x, b.y - p.y) > 3.5) st[i] = false; }); return st; }
  const moves = (S) => (over(S) ? [] : [{ x: W / 2, a: -Math.PI / 2, p: 0.8 }]);
  function apply(S0, m) {
    const w = world(S0, launch(S0, m)); run(w); const st = knocked(S0, w), down = S0.standing.filter(Boolean).length - st.filter(Boolean).length, p = S0.turn;
    const rolls = S0.rolls.map((r) => r.slice()); rolls[p].push(down);
    const S = { ...S0, rolls, ply: S0.ply + 1, last: { p, down, strike: S0.ball === 0 && down === 10, spare: S0.ball > 0 && st.every((x) => !x) && !(S0.ball === 2 && S0.prevStrike), split: false } };
    const fr = frameOf(rolls[p]);
    if (done(rolls[p])) { S.turn = 1 - p; S.standing = SPOTS.map(() => true); S.ball = 0; if (done(rolls[1 - p])) S.turn = p; return S; }
    if (fr.f === 9 && rolls[p].length > 0) { const tenth = rolls[p].slice(rolls[p].length - fr.ball); const reset = st.every((x) => !x); S.standing = reset ? SPOTS.map(() => true) : st; S.ball = tenth.length; void tenth; return S; }
    if (fr.ball === 0) { S.turn = done(rolls[1 - p]) ? p : 1 - p; S.standing = SPOTS.map(() => true); S.ball = 0; return S; }
    S.standing = st; S.ball = 1; return S;
  }
  function over(S) { if (!done(S.rolls[0]) || !done(S.rolls[1])) return null; const a = scoreRolls(S.rolls[0]).total, b = scoreRolls(S.rolls[1]).total; return { result: a === b ? "draw" : S.seats[a > b ? 0 : 1], detail: `${Math.max(a, b)} to ${Math.min(a, b)}` }; }
  function rank(S, level) {
    const out = [], up = SPOTS.map((p, i) => (S.standing[i] ? p : null)).filter(Boolean), cx = up.reduce((t, p) => t + p.x, 0) / up.length;
    const xs = [W / 2 - 22, W / 2 - 10, W / 2, W / 2 + 10, W / 2 + 22, cx], seen = new Set();
    for (const x0 of xs) for (const tx of [cx - 8, cx - 3, cx, cx + 3, cx + 8]) for (const p of [0.75, 0.95]) {
      const key = `${x0 | 0}:${tx | 0}:${p}`; if (seen.has(key)) continue; seen.add(key);
      const tgtY = up.length ? Math.max(...up.map((q) => q.y)) : HEAD, a = Math.atan2(tgtY - START, tx - x0), m = { x: x0, a, p, lv: level };
      const w = world(S, launch({ ...S, seed: 3 }, { ...m, lv: "you" })); run(w); const st = knocked(S, w), down = S.standing.filter(Boolean).length - st.filter(Boolean).length;
      out.push({ m, label: down === up.length ? (S.ball === 0 || up.length === 10 ? "go for the strike pocket" : "pick up the spare") : `aim ${tx < cx - 2 ? "left of" : tx > cx + 2 ? "right of" : "straight at"} the ${up.length === 10 ? "head pin" : "pins"} from ${x0 < W / 2 - 4 ? "the left" : x0 > W / 2 + 4 ? "the right" : "the middle"}`, score: down + Math.random() * 0.3 });
    }
    return out.sort((a, b) => b.score - a.score);
  }
  const E = { W, L, SPOTS, START, setup, moves, apply, over, rank, scoreRolls, frameOf, done, launch, world, run, stepB, knocked };
  if (typeof module === "object" && module.exports) { module.exports = E; return; }
  const K = root.Kit, PH = root.PH;
  function card(H, S) {
    const t = K.el("table", "bowlcard"); const hd = K.el("tr"); hd.append(K.el("th", "", "")); for (let f = 1; f <= 10; f++) hd.append(K.el("th", "", String(f))); hd.append(K.el("th", "", "Total")); t.append(hd);
    for (const i of [S.seats.indexOf("you"), 1 - S.seats.indexOf("you")]) {
      const r = S.rolls[i], sc = scoreRolls(r), tr = K.el("tr", S.turn === i ? "on" : ""); tr.append(K.el("th", "", H.nameOf(i)));
      let k = 0; for (let f = 0; f < 10; f++) { const td = K.el("td"); let marks = []; if (f < 9) { if (r[k] === 10) { marks = ["", "X"]; k++; } else if (r[k] != null) { marks = [r[k] || "–", r[k + 1] == null ? "" : r[k] + r[k + 1] === 10 ? "/" : r[k + 1] || "–"]; k += 2; } } else { const t3 = r.slice(k); marks = t3.map((x, j) => (x === 10 && (j === 0 || t3[j - 1] === 10 || (j === 2 && t3[0] + t3[1] === 10)) ? "X" : j > 0 && t3[j - 1] !== 10 && t3[j - 1] + x === 10 && !(j === 2 && t3[0] + t3[1] === 10 && t3[0] !== 10) ? "/" : x || "–")); }
        td.innerHTML = `<div class="marks">${marks.map((x) => `<i>${x}</i>`).join("")}</div><b>${sc.frames[f] != null ? sc.frames[f] : ""}</b>`; tr.append(td); }
      tr.append(K.el("td", "tot", String(sc.total))); t.append(tr);
    }
    return t;
  }
  root.KG.add({
    id: "bowling", title: "Bowling", icon: "🎳",
    rules: "Ten frames each, two balls a frame. Tap the approach to move your ball left or right, then pull back from it and let go — the angle and how far you pull decide the line and speed. A strike (all ten with the first ball) scores 10 plus your next two balls; a spare (all ten with two) scores 10 plus the next ball. Strike or spare in the tenth and you get bonus balls. Highest total wins.",
    achievements: [
      { id: "strike", icon: "❌", name: "Strike!", about: "Knock all ten down with one ball." },
      { id: "turkey", icon: "🦃", name: "Turkey", about: "Three strikes in a row." },
      { id: "spare", icon: "／", name: "Clean Up", about: "Pick up a spare." },
      { id: "two", icon: "💯", name: "Double Century", about: "Score 200 or more." },
    ],
    mount(api) {
      let aim = null, sx = W / 2, anim = null;
      return K.turnGame(api, {
        ...E, autoDelay: 1200, thinkMs: 700,
        mount(el, H) {
          const v = { bar: K.el("div"), card: K.el("div", "bowlwrap"), info: K.el("div", "hint big") }; el.append(v.bar, v.card); const sc = 0.62; v.sc = sc; v.pv = PH.view(el, W + 20, L * sc + 10, 0.62); el.append(v.info);
          const view = { cv: v.pv.cv, toWorld: (e) => { const p = v.pv.toWorld(e); return { x: p.x - 10, y: (p.y - 5) / sc }; } };
          PH.aim(view, { enabled: () => H.mine(), ball: () => ({ x: sx, y: START }), reach: 100, grab: (p) => { if (p.y > START - 30 && Math.abs(p.x - sx) > BR * 1.3) { sx = Math.max(G + BR, Math.min(W - G - BR, p.x)); H.redraw(); return true; } return false; }, onAim: (a) => { aim = a; H.redraw(); }, onShoot: (a, pw) => H.play({ x: sx, a, p: pw }) });
          return v;
        },
        draw(v, S, H) {
          v.bar.replaceChildren(K.players(H, (i) => `${scoreRolls(S.rolls[i]).total}`));
          v.card.replaceChildren(card(H, S));
          const ctx = v.pv.ctx, sc = v.sc; ctx.clearRect(0, 0, W + 20, L * sc + 10);
          ctx.save(); ctx.translate(10, 5); ctx.scale(1, sc);
          ctx.fillStyle = "#1a120b"; ctx.fillRect(-10, -10, W + 20, L + 20);
          const g = ctx.createLinearGradient(G, 0, W - G, 0); g.addColorStop(0, "#d9a868"); g.addColorStop(0.5, "#f0cf98"); g.addColorStop(1, "#d9a868"); ctx.fillStyle = g; ctx.fillRect(G, -6, W - 2 * G, L);
          for (let x = G + 4; x < W - G; x += 5.6) { ctx.fillStyle = "rgba(140,90,40,.18)"; ctx.fillRect(x, -6, 0.6, L); }
          ctx.fillStyle = "#3a3a44"; ctx.fillRect(0, -6, G, L); ctx.fillRect(W - G, -6, G, L);
          for (let k = 0; k < 7; k++) { const x = G + (W - 2 * G) * (k + 1) / 8, y = 380; ctx.fillStyle = "#7a4a22"; ctx.beginPath(); ctx.moveTo(x, y - 8); ctx.lineTo(x - 3, y + 4); ctx.lineTo(x + 3, y + 4); ctx.fill(); }
          ctx.fillStyle = "#c33"; ctx.fillRect(G, START - 30, W - 2 * G, 1.2);
          ctx.restore();
          const P = (x, y) => [10 + x, 5 + y * sc];
          const pins = anim ? anim.balls.slice(1).filter((b) => !b.gone) : SPOTS.map((p, i) => (S.standing[i] ? { ...p, r: PR } : null)).filter(Boolean);
          for (const p of pins) { const [x, y] = P(p.x, p.y), fall = anim && Math.hypot(p.vx || 0, p.vy || 0) > 5; ctx.save(); ctx.translate(x, y); if (fall) ctx.rotate(Math.atan2(p.vy, p.vx)); ctx.fillStyle = "rgba(0,0,0,.3)"; ctx.beginPath(); ctx.ellipse(1.5, 2, PR, PR * 0.7, 0, 0, 7); ctx.fill(); const gp = ctx.createRadialGradient(-1.5, -2, 0.5, 0, 0, PR); gp.addColorStop(0, "#fff"); gp.addColorStop(1, "#cfcfcf"); ctx.fillStyle = gp; ctx.beginPath(); ctx.arc(0, 0, PR, 0, 7); ctx.fill(); ctx.strokeStyle = "#d33"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(0, 0, PR * 0.55, 0, 7); ctx.stroke(); ctx.restore(); }
          const ball = anim ? anim.balls[0] : H.mine() ? { x: sx, y: START } : null;
          if (ball && !ball.gone) { const [x, y] = P(ball.x, ball.y); AR.glossy(ctx, x, y, BR * 0.8, S.turn === S.seats.indexOf("you") ? "#ff6a3d" : "#3d7cff", "#111"); if (!anim && aim) PH.aimLine(ctx, { x, y, r: BR }, aim.angle, aim.power, 140, 0.9); }
          const L2 = S.last; v.info.textContent = L2 && !anim ? `${H.nameOf(L2.p)}: ${L2.strike ? "STRIKE!" : L2.spare ? "Spare!" : L2.down ? L2.down + " down" : "gutter…"}` : H.mine() ? "Tap the approach to move sideways; pull back from the ball and let go." : "";
        },
        async animate(v, S0, m, S1, who, H) {
          if (K.fast) return; const w = world(S0, launch(S0, m)); anim = w; K.sfx.rumble(); let hit = false;
          await new Promise((res) => { const go = () => { if (H.dead) return res(); const ev = []; for (let k = 0; k < 4 && PH.moving(w); k++) stepB(w, ev); if (!hit && ev.some((e) => e.type === "hit")) { hit = true; K.sfx.pins(); } this.draw(v, S0, H); if (PH.moving(w)) setTimeout(go, 16); else res(); }; go(); });
          await K.wait(500); anim = null;
        },
        feats(S0, m, S1, who) { const L2 = S1.last; if (L2.strike) api.achieve("strike", who); if (L2.spare) api.achieve("spare", who); const r = S1.rolls[L2.p]; if (r.length >= 3 && r.slice(-3).every((x) => x === 10)) api.achieve("turkey", who); if (done(r) && scoreRolls(r).total >= 200) api.achieve("two", who); },
        situation: (S) => `Bowling, frame ${frameOf(S.rolls[S.turn]).f + 1}, ball ${S.ball + 1}. ${S.standing.filter(Boolean).length} pins standing. Your total ${scoreRolls(S.rolls[S.turn]).total}, theirs ${scoreRolls(S.rolls[1 - S.turn]).total}. Pick your line; the app rolls it.`,
        yourTurn: () => "Your ball: pull back and let go.",
      });
    },
  });
})(typeof self !== "undefined" ? self : this);
