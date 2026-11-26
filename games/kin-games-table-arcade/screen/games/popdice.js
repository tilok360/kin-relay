// Pop-Dice Dash: press the bubble to pop the die, race four pegs once round the ring and up your finish lane.
(function (root) {
  "use strict";
  const R = typeof module === "object" && module.exports ? require("./race.js") : root.KGRace;
  const E = R.make({ track: 28, lap: 28, homeLen: 4, starts: [0, 7, 14, 21], safe: [], leave: [6], stackOwn: false });
  if (typeof module === "object" && module.exports) { module.exports = E; return; }
  const K = root.Kit, COL = ["#e5483b", "#2fae5a", "#f2c23d", "#2f7fe0"], NAMES = [null, "Green", null, "Blue"];
  const C = 150, RING = 118;
  const ringXY = (a) => { const ang = -Math.PI * 3 / 4 + (a / 28) * Math.PI * 2; return [C + RING * Math.cos(ang), C + RING * Math.sin(ang)]; };
  const laneXY = (c, j) => { const a = (E.cfg.starts[c] + 27) % 28, [x, y] = ringXY(a), f = 1 - (j + 1) * 0.15; return [C + (x - C) * f, C + (y - C) * f]; };
  const baseXY = (c, k) => { const corner = [[34, 34], [266, 34], [266, 266], [34, 266]][c]; return [corner[0] + ((k % 2) - 0.5) * 18, corner[1] + (Math.floor(k / 2) - 0.5) * 18]; };
  function spot(S, c, k, p) { if (p < 0) return baseXY(c, k); if (p < 28) return ringXY(E.abs(c, p)); if (p < E.FIN) return laneXY(c, p - 28); const n = S.tok[c].slice(0, k).filter((q) => q === E.FIN).length; return laneXY(c, 3 - n); }
  root.KG.add({
    id: "popdice", title: "Pop-Dice Dash", icon: "🫧",
    rules: "Four colours, four pegs each: you (red), your opponent (yellow) and two computer colours. Press the bubble to pop the die. A six brings a peg out onto your start and rolls again. Move one peg by the roll; you can't land on your own peg. Land on anyone else's and it goes back to its base. Go once round the ring, then up your finish lane by exact count. Get all four pegs home before your opponent to win.",
    achievements: [
      { id: "popper", icon: "🫧", name: "Bubble Popper", about: "Pop three sixes in a row." },
      { id: "bump", icon: "💢", name: "Back You Go", about: "Send an opponent's peg home just before it reached its lane." },
      { id: "fast", icon: "🏎", name: "Dash", about: "Win in 60 of your own moves or fewer." },
    ],
    mount(api) {
      let myMoves = 0;
      return K.turnGame(api, {
        ...E, setup: (first) => E.setup(first, NAMES), autoForYou: true, autoDelay: 330, botMs: 360, thinkMs: 400,
        mount(el, H) {
          const v = { bar: K.el("div"), box: K.el("div", "popbox"), hint: K.el("div", "hint") }; el.append(v.bar, v.box, v.hint);
          v.dome = K.btn("dome"); v.die = K.die(1); v.dome.append(v.die); v.dome.setAttribute("aria-label", "Pop the bubble to roll");
          const pop = async () => { if (!H.mine() || !("roll" in (H.legal()[0] || {}))) return; const val = 1 + Math.floor(Math.random() * 6); v.dome.classList.add("press"); K.sfx.pop(); v.rolling = true; await K.roll([v.die], [val]); v.rolling = false; v.dome.classList.remove("press"); H.play({ roll: val }); };
          v.dome.onclick = pop;
          el.addEventListener("keydown", (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); pop(); } if (e.key >= "1" && e.key <= "4" && H.mine()) { const m = H.legal().find((x) => x.t === Number(e.key) - 1); if (m) H.play(m); } });
          v.svgHost = K.el("div"); v.box.append(v.svgHost, v.dome);
          K.onPick(v.svgHost, (i) => { if (!H.mine()) return; const m = H.legal().find((x) => x.t === i) || (H.S.tok[0][i] < 0 && H.legal().find((x) => x.t != null && H.S.tok[0][x.t] < 0)); if (m) H.play(m); });
          return v;
        },
        draw(v, S, H) {
          v.bar.replaceChildren(K.players(H, (i) => `${S.tok[i].filter((p) => p === E.FIN).length}/4 home`));
          let s = `<svg class="svgboard" viewBox="0 0 300 300"><defs><radialGradient id="pdb" cx=".5" cy=".4"><stop offset="0" stop-color="#3a3f9a"/><stop offset="1" stop-color="#191c52"/></radialGradient></defs><rect width="300" height="300" rx="34" fill="url(#pdb)"/><circle cx="150" cy="150" r="134" fill="none" stroke="#ffffff22" stroke-width="18"/>`;
          [0, 1, 2, 3].forEach((c) => { const [x, y] = baseXY(c, 0); s += `<rect x="${x - 14}" y="${y - 14}" width="46" height="46" rx="12" fill="${COL[c]}" opacity=".35"/>`; for (let k = 0; k < 4; k++) { const [bx, by] = baseXY(c, k); s += `<circle cx="${bx}" cy="${by}" r="6" fill="#0008"/>`; } for (let j = 0; j < 4; j++) { const [lx, ly] = laneXY(c, j); s += `<circle cx="${lx}" cy="${ly}" r="6.5" fill="${COL[c]}" opacity=".55" stroke="#0006"/>`; } });
          for (let a = 0; a < 28; a++) { const [x, y] = ringXY(a), st = E.cfg.starts.indexOf(a); s += `<circle cx="${x}" cy="${y}" r="7.5" fill="${st >= 0 ? COL[st] : "#0b0d2e"}" stroke="#ffffff33" stroke-width="1.2"/>`; }
          const mine = H.mine(), L = mine && "t" in (H.legal()[0] || {}) ? H.legal() : [], lm = S.last;
          for (let c = 0; c < 4; c++) S.tok[c].forEach((p, k) => {
            const [x, y] = spot(S, c, k, p), can = c === 0 && L.some((m) => m.t === k || (p < 0 && S.tok[0][m.t] < 0));
            s += K.place(K.token(COL[c], "peg"), x - 9, y - 14, 18, lm && lm.c === c && lm.k === k ? "appear" : "");
            if (can) s += `<circle class="hot" data-i="${k}" cx="${x}" cy="${y}" r="11" fill="#ffffff22" stroke="#ffd76a" stroke-width="2"/>`;
          });
          v.svgHost.innerHTML = s + "</svg>";
          if (!v.rolling) v.die.innerHTML = K.dieSVG((lm && lm.roll) || 6);
          const canRoll = mine && "roll" in (H.legal()[0] || {}); v.dome.disabled = !canRoll; v.dome.classList.toggle("ready", canRoll);
          v.hint.textContent = lm && lm.hit && lm.hit.length ? `${H.nameOf(lm.c)} bumped ${lm.hit.map((h) => H.nameOf(h.o)).join(" and ")} back to base!` : "";
        },
        animate: async (v, S0, m, S1, who) => { if ("roll" in m) { if (who !== "you") { v.dome.classList.add("press"); K.sfx.pop(); await K.roll([v.die], [S1.roll]); v.dome.classList.remove("press"); } return; } if (m.t != null) { K.sfx.clack(); if (S1.last.hit.length) { await K.wait(120); K.sfx.buzz(); } } },
        feats(S0, m, S1, who) {
          if ("roll" in m && S1.sixes >= 3 && S0.seats[S0.turn] !== "bot") api.achieve("popper", S0.seats[S0.turn]);
          if (m.t != null && who !== "bot") { if (who === "you") myMoves++; if (S1.last.hit.some((h) => h.from >= 22)) api.achieve("bump", who); }
          const o = E.over(S1); if (o && o.result === "you" && myMoves <= 60) api.achieve("fast", "you");
        },
        situation: (S) => `You are yellow and popped a ${S.roll}. Your pegs: ${S.tok[2].map((p) => (p < 0 ? "base" : p === E.FIN ? "home" : p + " along")).join(", ")}.`,
        yourTurn: (S) => (S.roll ? "Tap a glowing peg to move it." : "Your turn: press the bubble (or Space)."),
      });
    },
  });
})(typeof self !== "undefined" ? self : this);
