// Ludo: four colours race four tokens around the cross. You, your opponent across the board, and two computer colours.
(function (root) {
  "use strict";
  const R = typeof module === "object" && module.exports ? require("./race.js") : root.KGRace;
  const E = R.make({ track: 52, lap: 51, homeLen: 5, starts: [0, 13, 26, 39], safe: [0, 13, 26, 39, 8, 21, 34, 47], leave: [6] });
  if (typeof module === "object" && module.exports) { module.exports = E; return; }
  const K = root.Kit, COL = ["#e5483b", "#2fae5a", "#f2c23d", "#2f7fe0"], NAMES = [null, "Green", null, "Blue"];
  const PATH = []; [[6, 1], [6, 2], [6, 3], [6, 4], [6, 5], [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6], [0, 7], [0, 8], [1, 8], [2, 8], [3, 8], [4, 8], [5, 8], [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14], [7, 14], [8, 14], [8, 13], [8, 12], [8, 11], [8, 10], [8, 9], [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8], [14, 7], [14, 6], [13, 6], [12, 6], [11, 6], [10, 6], [9, 6], [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0], [7, 0], [6, 0]].forEach((x) => PATH.push(x));
  const LANE = [[[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]], [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]], [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]], [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]]];
  const BASE = [[1.5, 1.5], [1.5, 10.5], [10.5, 10.5], [10.5, 1.5]];
  const CENTER = [[7, 6.2], [6.2, 7], [7, 7.8], [7.8, 7]];
  function spot(c, k, p) {
    if (p < 0) { const [r, cc] = BASE[c]; return [cc + (k % 2) * 2 + 0.5, r + Math.floor(k / 2) * 2 + 0.5]; }
    if (p < 51) { const [r, cc] = PATH[E.abs(c, p)]; return [cc + 0.5, r + 0.5]; }
    if (p < 56) { const [r, cc] = LANE[c][p - 51]; return [cc + 0.5, r + 0.5]; }
    const [r, cc] = CENTER[c]; return [cc + 0.5 + (k - 1.5) * 0.22, r + 0.5];
  }
  root.KG.add({
    id: "ludo", title: "Ludo", icon: "🎲",
    rules: "Four colours race four tokens each: you (red), your opponent (yellow, across the board) and two computer colours. Roll a six to bring a token out. Move one token by the roll; a six rolls again (three sixes in a row ends the turn). Land on an enemy token to send it back to base, except on the starred and starting squares, which are safe. After a full lap a token turns up its home lane; it needs the exact roll to finish. You win if you get all four home before your opponent does.",
    achievements: [
      { id: "bump3", icon: "💥", name: "Bowling Ball", about: "Send three tokens back to base in one game." },
      { id: "sixes", icon: "🎲", name: "Triple Six", about: "Roll three sixes in a row." },
      { id: "first", icon: "🥇", name: "Clean Sweep", about: "Finish first of all four colours." },
    ],
    mount(api) {
      const bumps = { you: 0, kin: 0 };
      return K.turnGame(api, {
        ...E, setup: (first) => E.setup(first, NAMES), autoForYou: true, autoDelay: 350, botMs: 380, thinkMs: 420,
        mount(el, H) {
          const v = { bar: K.el("div"), box: K.el("div", "ludobox"), ctl: K.el("div", "ctrl dicebar") }; el.append(v.bar, v.box, v.ctl);
          v.die = K.die(1, { onClick: () => roll() }); v.rollBtn = K.btn("btn", "Roll", () => roll()); v.ctl.append(v.die, v.rollBtn);
          const roll = async () => { if (!H.mine() || !("roll" in (H.legal()[0] || {}))) return; const val = 1 + Math.floor(Math.random() * 6); v.rolling = true; await K.roll([v.die], [val]); v.rolling = false; H.play({ roll: val }); };
          el.addEventListener("keydown", (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); roll(); } if (e.key >= "1" && e.key <= "4" && H.mine()) { const m = H.legal().find((x) => x.t === Number(e.key) - 1); if (m) H.play(m); } });
          K.onPick(v.box, (i) => { if (!H.mine()) return; const m = H.legal().find((x) => x.t === i) || (H.S.tok[0][i] < 0 && H.legal().find((x) => x.t != null && H.S.tok[0][x.t] < 0)); if (m) H.play(m); });
          return v;
        },
        draw(v, S, H) {
          v.bar.replaceChildren(K.players(H, (i) => `${S.tok[i].filter((p) => p === E.FIN).length}/4 home`));
          const u = 20; let s = `<svg class="svgboard" viewBox="0 0 300 300"><rect width="300" height="300" rx="14" fill="#fbf6ea"/>`;
          BASE.forEach(([r, c], k) => { s += `<rect x="${(c - 1.5) * u + 4}" y="${(r - 1.5) * u + 4}" width="${6 * u - 8}" height="${6 * u - 8}" rx="16" fill="${COL[k]}"/><rect x="${(c - 0.5) * u}" y="${(r - 0.5) * u}" width="${4 * u}" height="${4 * u}" rx="12" fill="#fffdf6"/>`; for (let j = 0; j < 4; j++) s += `<circle cx="${(c + (j % 2) * 2 + 0.5) * u}" cy="${(r + Math.floor(j / 2) * 2 + 0.5) * u}" r="7" fill="${COL[k]}" opacity=".35"/>`; });
          PATH.forEach(([r, c], a) => { const st = [0, 13, 26, 39].indexOf(a), star = [8, 21, 34, 47].includes(a); s += `<rect x="${c * u + 0.5}" y="${r * u + 0.5}" width="${u - 1}" height="${u - 1}" rx="3" fill="${st >= 0 ? COL[st] : "#fff"}" stroke="#c9bfa8" stroke-width=".8"/>`; if (star) s += `<path d="M${c * u + 10} ${r * u + 3}l2 5 5 .4-4 3.4 1.3 5-4.3-2.8-4.3 2.8 1.3-5-4-3.4 5-.4z" fill="#d8cfb8"/>`; });
          LANE.forEach((l, k) => l.forEach(([r, c]) => (s += `<rect x="${c * u + 0.5}" y="${r * u + 0.5}" width="${u - 1}" height="${u - 1}" rx="3" fill="${COL[k]}" opacity=".85"/>`)));
          s += `<polygon points="120,120 180,120 150,150" fill="${COL[1]}"/><polygon points="180,120 180,180 150,150" fill="${COL[2]}"/><polygon points="180,180 120,180 150,150" fill="${COL[3]}"/><polygon points="120,180 120,120 150,150" fill="${COL[0]}"/>`;
          const mine = H.mine(), L = mine && "t" in (H.legal()[0] || {}) ? H.legal() : [], lm = S.last;
          for (let c = 0; c < 4; c++) S.tok[c].forEach((p, k) => {
            const [x, y] = spot(c, k, p), stack = S.tok[c].filter((q, j) => j < k && q === p && p >= 0 && p < E.FIN).length;
            const can = c === 0 && L.some((m) => m.t === k || (p < 0 && S.tok[0][m.t] < 0));
            s += K.place(K.token(COL[c], "peg"), x * u - 9 + stack * 3, y * u - 13 - stack * 3, 18, lm && lm.c === c && lm.k === k ? "appear" : "");
            if (can) s += `<circle class="hot" data-i="${k}" cx="${x * u}" cy="${y * u}" r="10" fill="#ffffff22" stroke="#ffd76a" stroke-width="2"/>`;
          });
          v.box.innerHTML = s + "</svg>";
          if (!v.rolling) { const rv = (lm && lm.roll) || 1; v.die.innerHTML = K.dieSVG(rv, { face: ["#ffe1dc", "#dcf5e2", "#fff3c4", "#dde9ff"][(lm && lm.c) || 0], edge: "#c9bfa8", pip: "#222" }); }
          const canRoll = mine && "roll" in (H.legal()[0] || {}); v.rollBtn.disabled = !canRoll; v.die.disabled = !canRoll;
        },
        animate: async (v, S0, m, S1, who) => { if ("roll" in m) { if (who !== "you") await K.roll([v.die], [S1.roll]); return; } if (m.t != null) { K.sfx.clack(); if (S1.last.hit.length) { await K.wait(120); K.sfx.pop(); } } },
        feats(S0, m, S1, who) {
          if ("roll" in m && S1.sixes >= 3 && S0.seats[S0.turn] !== "bot") api.achieve("sixes", S0.seats[S0.turn]);
          if (m.t != null && (who === "you" || who === "kin")) { bumps[who] += S1.last.hit.length; if (bumps[who] >= 3) api.achieve("bump3", who); }
          const o = E.over(S1); if (o && S1.done[0] === S1.seats.indexOf(o.result)) api.achieve("first", o.result);
        },
        situation: (S) => `You are yellow. You rolled ${S.roll}. Your tokens: ${S.tok[2].map((p) => (p < 0 ? "base" : p === E.FIN ? "home" : p + " along")).join(", ")}.`,
        yourTurn: (S) => (S.roll ? "Tap a glowing token to move it." : "Your roll: tap the die (or Space)."),
      });
    },
  });
})(typeof self !== "undefined" ? self : this);
