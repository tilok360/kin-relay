// Snakes & Ladders on a 100-square board. Pure luck: roll, climb, slide. Exact roll to land on 100 (overshoot bounces back).
(function (root) {
  "use strict";
  const JUMPS = { 4: 14, 9: 31, 20: 38, 28: 84, 40: 59, 51: 67, 63: 81, 71: 91, 17: 7, 54: 34, 62: 19, 64: 60, 87: 24, 93: 73, 95: 75, 99: 78 };
  const setup = (first) => ({ seats: first === "you" ? ["you", "kin"] : ["kin", "you"], turn: 0, pos: [0, 0], ply: 0, last: null, sixes: 0 });
  const over = (S) => { const w = S.pos.indexOf(100); return w < 0 ? null : { result: S.seats[w], detail: `reached 100 in ${Math.ceil(S.ply / 2)} rolls` }; };
  const moves = (S) => (over(S) ? [] : [{ roll: 0 }]);
  function apply(S, m) {
    const v = m.roll || 1 + Math.floor(Math.random() * 6), p = S.turn, pos = S.pos.slice(), from = pos[p];
    let to = from + v; if (to > 100) to = 200 - to; const land = to; const j = JUMPS[to]; if (j) to = j; pos[p] = to;
    const again = v === 6 && to !== 100 && S.sixes < 2;
    return { ...S, pos, ply: S.ply + 1, turn: again ? p : 1 - p, sixes: again ? S.sixes + 1 : 0, last: { p, v, from, land, to, kind: j ? (j > land ? "ladder" : "snake") : null } };
  }
  const rank = () => [{ m: { roll: 0 }, label: "roll", score: 0 }];
  const autoMove = (S) => (S.seats[S.turn] !== "you" && !over(S) ? { roll: 1 + Math.floor(Math.random() * 6) } : null);
  const E = { JUMPS, setup, moves, apply, over, rank, autoMove };
  if (typeof module === "object" && module.exports) { module.exports = E; return; }
  const K = root.Kit, COL = { you: "#e5483b", kin: "#2f7fe0" }, U = 30;
  const cxy = (n) => { const i = n - 1, r = Math.floor(i / 10), c = r % 2 ? 9 - (i % 10) : i % 10; return [c * U + U / 2, (9 - r) * U + U / 2]; };
  function boardSVG() {
    let s = `<svg class="svgboard" viewBox="0 0 300 300"><defs><linearGradient id="snk" x1="0" x2="1"><stop offset="0" stop-color="#3dbb5a"/><stop offset="1" stop-color="#1f7a3a"/></linearGradient></defs>`;
    const pal = ["#ffe7a8", "#ffd1c2", "#d6f0c6", "#c9e4ff", "#f3d2f0"];
    for (let n = 1; n <= 100; n++) { const [x, y] = cxy(n); s += `<rect x="${x - U / 2}" y="${y - U / 2}" width="${U}" height="${U}" fill="${pal[(n + Math.floor((n - 1) / 10)) % 5]}"/><text x="${x - U / 2 + 2.5}" y="${y - U / 2 + 8}" font-size="6.5" font-weight="700" fill="#0006">${n}</text>`; }
    for (const [a, b] of Object.entries(JUMPS)) {
      const [x1, y1] = cxy(Number(a)), [x2, y2] = cxy(b);
      if (b > a) { const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy), nx = (-dy / L) * 5, ny = (dx / L) * 5; s += `<g stroke="#8a5a2e" stroke-width="2.6" stroke-linecap="round"><line x1="${x1 + nx}" y1="${y1 + ny}" x2="${x2 + nx}" y2="${y2 + ny}"/><line x1="${x1 - nx}" y1="${y1 - ny}" x2="${x2 - nx}" y2="${y2 - ny}"/>`; const steps = Math.max(2, Math.round(L / 9)); for (let k = 1; k < steps; k++) { const t = k / steps, x = x1 + dx * t, y = y1 + dy * t; s += `<line x1="${x + nx}" y1="${y + ny}" x2="${x - nx}" y2="${y - ny}" stroke-width="2"/>`; } s += "</g>"; }
      else { const mx = (x1 + x2) / 2 + (y2 - y1) * 0.25, my = (y1 + y2) / 2 - (x2 - x1) * 0.25; s += `<path d="M${x1} ${y1} Q${mx} ${my} ${x2} ${y2}" stroke="#155c2b" stroke-width="7.5" fill="none" stroke-linecap="round"/><path d="M${x1} ${y1} Q${mx} ${my} ${x2} ${y2}" stroke="url(#snk)" stroke-width="5.5" fill="none" stroke-linecap="round" stroke-dasharray="4 3"/><circle cx="${x1}" cy="${y1}" r="5.5" fill="#2a9a48" stroke="#155c2b"/><circle cx="${x1 - 2}" cy="${y1 - 1.5}" r="1.2" fill="#fff"/><circle cx="${x1 + 2}" cy="${y1 - 1.5}" r="1.2" fill="#fff"/><path d="M${x1} ${y1 + 4} l0 3 m0 0 l-1.5 1.5 m1.5 -1.5 l1.5 1.5" stroke="#d22" stroke-width=".9"/>`; }
    }
    return s;
  }
  root.KG.add({
    id: "snakes", title: "Snakes & Ladders", icon: "🐍",
    rules: "Roll and move your counter along the numbers. Land at the foot of a ladder to climb it; land on a snake's head and slide down to its tail. A six rolls again (up to three in a row). You need the exact roll to land on 100: any extra bounces you back. First to 100 wins. It's all luck, so cheer loudly.",
    achievements: [
      { id: "big", icon: "🪜", name: "Sky High", about: "Climb the long ladder from 28 to 84." },
      { id: "ouch", icon: "🐍", name: "Long Way Down", about: "Slide down the snake from 87 to 24 and still win." },
      { id: "nosnake", icon: "🍀", name: "Snake Charmer", about: "Win without landing on a single snake." },
    ],
    mount(api) {
      const bit = { you: false, kin: false }, big87 = { you: false, kin: false };
      return K.turnGame(api, {
        ...E, autoDelay: 420, thinkMs: 400,
        mount(el, H) {
          const v = { bar: K.el("div"), box: K.el("div", "snakebox"), ctl: K.el("div", "ctrl dicebar"), hint: K.el("div", "hint") }; el.append(v.bar, v.box, v.ctl, v.hint);
          v.base = boardSVG(); v.die = K.die(1, { onClick: () => roll() }); v.btn = K.btn("btn", "Roll", () => roll()); v.ctl.append(v.die, v.btn);
          const roll = async () => { if (!H.mine()) return; const val = 1 + Math.floor(Math.random() * 6); v.rolling = true; await K.roll([v.die], [val]); v.rolling = false; H.play({ roll: val }); };
          el.addEventListener("keydown", (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); roll(); } });
          return v;
        },
        draw(v, S, H) {
          v.bar.replaceChildren(K.players(H, (i) => `square ${S.pos[i] || "start"}`));
          let s = v.base; const show = v.anim || S.pos;
          S.seats.forEach((who, i) => { const n = show[i]; const [x, y] = n ? cxy(n) : [-6 + i * 0, 300 - 8 - i * 12]; s += K.place(K.token(COL[who], "peg"), (n ? x : 8) - 9 + (i ? 5 : -5), (n ? y : 296 - i * 14) - 15, 18); });
          v.box.innerHTML = s + "</svg>";
          if (!v.rolling && S.last) v.die.innerHTML = K.dieSVG(S.last.v);
          v.btn.disabled = !H.mine(); v.die.disabled = !H.mine();
          const lm = S.last; v.hint.textContent = lm && lm.kind ? `${H.nameOf(lm.p)} ${lm.kind === "ladder" ? "climbed a ladder" : "hit a snake"}: ${lm.land} → ${lm.to}` : "";
        },
        animate: async (v, S0, m, S1, who, H) => {
          const L = S1.last; if (who !== "you") await K.roll([v.die], [L.v]);
          const pos = S0.pos.slice(); v.anim = pos;
          let n = L.from; const stepTo = (t) => { pos[L.p] = t; H.redraw(); K.sfx.tick(); };
          const dir = L.from + L.v > 100 ? 1 : 1; void dir;
          for (let k = 1; k <= L.v; k++) { n = L.from + k > 100 ? 200 - (L.from + k) : L.from + k; stepTo(n); await K.wait(110); }
          if (L.kind) { await K.wait(150); if (L.kind === "ladder") K.sfx.score(); else K.sfx.swish(); pos[L.p] = L.to; H.redraw(); await K.wait(250); }
          v.anim = null;
        },
        feats(S0, m, S1, who) {
          const L = S1.last, w = S0.seats[L.p];
          if (L.kind === "snake") { bit[w] = true; if (L.land === 87) big87[w] = true; if (!api.solo) api.line(`${w === "you" ? "Your person" : "You"} just slid down a snake from ${L.land} to ${L.to}.`); }
          if (L.kind === "ladder" && L.land === 28) api.achieve("big", w);
          const o = over(S1); if (o) { if (!bit[o.result]) api.achieve("nosnake", o.result); if (big87[o.result]) api.achieve("ouch", o.result); }
        },
        yourTurn: () => "Your roll: tap the die (or Space).",
      });
    },
  });
})(typeof self !== "undefined" ? self : this);
