// Backgammon, without the doubling cube. Points are numbered 1-24 from your side: you move from 24 down to 1 and bear
// off from your home board (1-6); your Kin moves from 1 up to 24 and bears off from 19-24. p[q] > 0 are your checkers,
// p[q] < 0 your Kin's. A turn must use as many dice as it can, and the larger die when only one can be used.
(function (root) {
  "use strict";
  const sgn = (who) => (who === "you" ? 1 : -1);
  const other = (who) => (who === "you" ? "kin" : "you");
  function start() {
    const p = Array(26).fill(0);
    p[24] = 2; p[13] = 5; p[8] = 3; p[6] = 5; p[1] = -2; p[12] = -5; p[17] = -3; p[19] = -5;
    return { p, bar: { you: 0, kin: 0 }, off: { you: 0, kin: 0 } };
  }
  const clone = (x) => ({ p: x.p.slice(), bar: { ...x.bar }, off: { ...x.off } });
  const keyOf = (x) => x.p.join(",") + "|" + x.bar.you + "," + x.bar.kin + "|" + x.off.you + "," + x.off.kin;
  const mine = (x, q, who) => (who === "you" ? x.p[q] > 0 : x.p[q] < 0);
  function allHome(x, who) {
    if (x.bar[who]) return false;
    for (let q = 1; q <= 24; q++) if (mine(x, q, who) && (who === "you" ? q > 6 : q < 19)) return false;
    return true;
  }
  // Single moves with one die: {from: point | "bar", to: point | "off", hit}
  function single(x, who, d) {
    const out = [], s = sgn(who), open = (t) => x.p[t] * s >= -1, hit = (t) => x.p[t] * s === -1;
    if (x.bar[who]) { const t = who === "you" ? 25 - d : d; if (open(t)) out.push({ from: "bar", to: t, hit: hit(t) }); return out; }
    const home = allHome(x, who);
    for (let q = 1; q <= 24; q++) {
      if (!mine(x, q, who)) continue;
      const t = q - d * s;
      if (t >= 1 && t <= 24) { if (open(t)) out.push({ from: q, to: t, hit: hit(t) }); continue; }
      if (!home) continue;
      if (t === 0 || t === 25) { out.push({ from: q, to: "off", hit: false }); continue; }
      // Over the edge: only from the checker farthest back.
      let farther = false;
      if (who === "you") { for (let z = q + 1; z <= 6; z++) if (x.p[z] > 0) farther = true; }
      else { for (let z = 19; z < q; z++) if (x.p[z] < 0) farther = true; }
      if (!farther) out.push({ from: q, to: "off", hit: false });
    }
    return out;
  }
  function step(x, who, st) {
    const n = clone(x), s = sgn(who);
    if (st.from === "bar") n.bar[who]--; else n.p[st.from] -= s;
    if (st.to === "off") n.off[who]++;
    else { if (st.hit) { n.p[st.to] = 0; n.bar[other(who)]++; } n.p[st.to] += s; }
    return n;
  }
  const without = (a, i) => a.slice(0, i).concat(a.slice(i + 1));
  // The most dice that can still be used from here.
  function most(x, who, dice, memo) {
    if (!dice.length) return 0;
    const k = keyOf(x) + "#" + dice.join(""); if (memo.has(k)) return memo.get(k);
    let best = 0;
    const tried = new Set();
    for (let i = 0; i < dice.length && best < dice.length; i++) {
      if (tried.has(dice[i])) continue; tried.add(dice[i]);
      for (const st of single(x, who, dice[i])) { best = Math.max(best, 1 + most(step(x, who, st), who, without(dice, i), memo)); if (best === dice.length) break; }
    }
    memo.set(k, best); return best;
  }
  // The single moves allowed now, given the dice left, the steps already played this turn and the rules above.
  function allowed(x, who, dice, need) {
    const memo = new Map(), out = [], tried = new Set();
    for (let i = 0; i < dice.length; i++) {
      if (tried.has(dice[i])) continue; tried.add(dice[i]);
      for (const st of single(x, who, dice[i])) if (1 + most(step(x, who, st), who, without(dice, i), memo) >= need) out.push({ ...st, die: dice[i] });
    }
    if (need === 1 && dice.length === 2 && dice[0] !== dice[1]) {
      const big = Math.max(...dice);
      if (out.some((m) => m.die === big)) return out.filter((m) => m.die === big);
    }
    return out;
  }
  // Every different way the whole turn can end, with one way of playing it.
  function turns(x, who, dice) {
    const memo = new Map(), need = most(x, who, dice, memo), seen = new Map(), visited = new Set();
    const rec = (pos, left, seq) => {
      if (seq.length === need) { const k = keyOf(pos); if (!seen.has(k)) seen.set(k, { seq, pos }); return; }
      const vk = keyOf(pos) + "#" + left.join(""); if (visited.has(vk)) return; visited.add(vk);
      for (const st of allowed(pos, who, left, need - seq.length)) rec(step(pos, who, st), without(left, left.indexOf(st.die)), seq.concat([st]));
    };
    rec(x, dice.slice(), []);
    return { need, list: [...seen.values()] };
  }
  const pips = (x, who) => { let t = x.bar[who] * 25; for (let q = 1; q <= 24; q++) if (mine(x, q, who)) t += Math.abs(x.p[q]) * (who === "you" ? q : 25 - q); return t; };
  function evaluate(x, who) {
    const me = who, foe = other(who), s = sgn(me);
    let sc = (pips(x, foe) - pips(x, me)) * 1.0 + (x.off[me] - x.off[foe]) * 6 + (x.bar[foe] - x.bar[me]) * 14;
    const foeBehind = (q) => { let n = x.bar[foe] ? 2 : 0; for (let z = 1; z <= 24; z++) if (mine(x, z, foe)) { const dist = me === "you" ? q - z : z - q; if (dist < 0 && -dist <= 12) n += 1; } return n; };
    let run = 0;
    for (let q = 1; q <= 24; q++) {
      const n = x.p[q] * s, myHome = me === "you" ? q <= 6 : q >= 19, foeHome = me === "you" ? q >= 19 : q <= 6;
      if (n >= 2) { sc += 5 + (myHome ? 7 : 0) + (foeHome ? 4 : 0); run++; sc += run * run * 0.8; }
      else { run = 0; }
      if (n === 1) {
        const exposure = foeBehind(q), progress = me === "you" ? 25 - q : q;
        if (exposure) sc -= 4 + Math.min(exposure, 6) * 1.6 + progress * 0.45;
      }
    }
    return sc;
  }
  const P = (q, who) => (q === "bar" || q === "off" ? q : who === "you" ? q : 25 - q);
  const stepText = (st, who) => `${P(st.from, who)}/${P(st.to, who)}${st.hit ? "*" : ""}`;
  function ranked(x, who, dice) {
    const { list } = turns(x, who, dice);
    return list.map((t) => ({ seq: t.seq, pos: t.pos, score: evaluate(t.pos, who), label: t.seq.map((s) => stepText(s, who)).join(" ") + (t.seq.some((s) => s.hit) ? " (hits)" : "") })).sort((a, b) => b.score - a.score);
  }
  function result(x) {
    for (const w of ["you", "kin"]) if (x.off[w] === 15) {
      const l = other(w);
      let kind = "a single game";
      if (!x.off[l]) { kind = "a gammon"; let back = x.bar[l] > 0; for (let q = 1; q <= 24; q++) if (mine(x, q, l) && (w === "you" ? q <= 6 : q >= 19)) back = true; if (back) kind = "a backgammon"; }
      return { winner: w, kind };
    }
    return null;
  }
  const E = { start, single, step, allowed, turns, ranked, evaluate, pips, result, most, stepText };
  if (typeof module === "object" && module.exports) { module.exports = E; return; }

  root.KG.add({
    id: "backgammon", title: "Backgammon", icon: "🎲", blurb: "Race your checkers home.",
    rules: "Standard backgammon without the doubling cube. Roll, then move a checker the number on each die (doubles are played four times). You move from 24 down to 1, your Kin the other way. A point with two or more of your Kin's checkers is closed; landing on a lone one hits it to the bar, and a checker on the bar must come back in before anything else moves. Once all your checkers are in your home board (1 to 6) you can bear them off. You must use both dice when you can, and the larger one when you can only use one. First to bear off all fifteen wins. Tap a checker, then where it goes; Undo puts this turn back.",
    achievements: [
      { id: "double_hit", icon: "💥", name: "Double Hit", about: "Send two checkers to the bar in one turn." },
      { id: "boxcars", icon: "🎲", name: "Boxcars", about: "Roll double sixes." },
      { id: "gammon", icon: "🏆", name: "Gammon", about: "Win before your Kin (or you) bear off a single checker." },
    ],
    mount(api) {
      let S = null, sel = null, dead = false, busy = false, turnStart = null;
      const top = document.createElement("div"); top.className = "row"; top.style.justifyContent = "space-between";
      const diceEl = document.createElement("div"); diceEl.className = "dice";
      const btns = document.createElement("div"); btns.className = "row"; btns.style.marginTop = "0";
      const roll = Object.assign(document.createElement("button"), { type: "button", className: "btn", textContent: "Roll" });
      const undo = Object.assign(document.createElement("button"), { type: "button", className: "btn alt", textContent: "Undo" });
      btns.append(undo, roll); top.append(diceEl, btns);
      const cv = document.createElement("canvas"); cv.className = "cv";
      const info = document.createElement("div"); info.className = "score";
      api.el.append(top, cv, info);
      const ctx = cv.getContext("2d");
      let W = 0, H = 0, colW = 0;
      function size() {
        const w = Math.min(api.el.clientWidth || 360, 560), dpr = window.devicePixelRatio || 1;
        W = w; H = Math.round(w * 0.82); colW = W / 14;
        cv.width = W * dpr; cv.height = H * dpr; cv.style.height = H + "px"; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); draw();
      }
      // Column of a point on screen: bottom row 12..1 (left to right) with the bar between 7 and 6; top row 13..24.
      function colOf(q) { const top = q >= 13, i = top ? q - 13 : 12 - q; return i + (i >= 6 ? 1 : 0); }
      function hitTest(x, y) {
        const c = Math.floor(x / colW);
        if (c === 13) return "off";
        if (c === 6) return "bar";
        const i = c > 6 ? c - 1 : c;
        if (i < 0 || i > 11) return null;
        return y < H / 2 ? 13 + i : 12 - i;
      }
      const left = () => S.dice ? S.dice.filter((d, i) => !S.used[i]) : [];
      const need = () => S.need - S.steps.length;
      const allowedNow = () => (S.turn === "you" && S.dice && need() > 0 ? allowed(S.pos, "you", left(), need()) : []);
      function draw() {
        if (!S || !W) return;
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = "#3b2a1c"; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#24683f"; ctx.fillRect(0, 0, colW * 13, H);
        ctx.fillStyle = "#4a3523"; ctx.fillRect(colW * 6, 0, colW, H); ctx.fillRect(colW * 13, 0, colW, H);
        const triH = H * 0.42, moves = allowedNow(), targets = sel != null ? moves.filter((m) => m.from === sel) : [];
        const sources = new Set(moves.map((m) => m.from));
        for (let q = 1; q <= 24; q++) {
          const c = colOf(q), x = c * colW, topRow = q >= 13;
          ctx.beginPath();
          if (topRow) { ctx.moveTo(x, 0); ctx.lineTo(x + colW, 0); ctx.lineTo(x + colW / 2, triH); }
          else { ctx.moveTo(x, H); ctx.lineTo(x + colW, H); ctx.lineTo(x + colW / 2, H - triH); }
          ctx.closePath(); ctx.fillStyle = q % 2 ? "#d9b98c" : "#8e3b2e"; ctx.fill();
          if (targets.some((m) => m.to === q)) { ctx.fillStyle = "rgba(255,220,90,.45)"; ctx.fill(); }
          ctx.fillStyle = "rgba(255,255,255,.55)"; ctx.font = `${Math.max(8, colW * 0.28)}px system-ui`; ctx.textAlign = "center";
          ctx.fillText(String(q), x + colW / 2, topRow ? triH + colW * 0.35 : H - triH - colW * 0.15);
          const n = Math.abs(S.pos.p[q]);
          if (n) stack(x + colW / 2, topRow, n, S.pos.p[q] > 0 ? "you" : "kin", q === sel, sources.has(q), S.last && S.last.includes(q));
        }
        if (S.pos.bar.kin) stack(colW * 6.5, true, S.pos.bar.kin, "kin", false, false, false, H * 0.22);
        if (S.pos.bar.you) stack(colW * 6.5, false, S.pos.bar.you, "you", sel === "bar", sources.has("bar"), false, H * 0.22);
        // the off tray: your Kin's at the top, yours at the bottom
        const tray = (n, topRow, who) => { for (let k = 0; k < n; k++) { ctx.fillStyle = who === "you" ? "#f3e4c6" : "#2b2d36"; const h = Math.max(3, (H * 0.42) / 15 - 1); const y = topRow ? 4 + k * (h + 1) : H - 4 - (k + 1) * (h + 1); ctx.fillRect(colW * 13 + 4, y, colW - 8, h); } };
        tray(S.pos.off.kin, true, "kin"); tray(S.pos.off.you, false, "you");
        if (targets.some((m) => m.to === "off")) { ctx.fillStyle = "rgba(255,220,90,.45)"; ctx.fillRect(colW * 13, H / 2, colW, H / 2); }
        dice();
        info.innerHTML = `<span><b class="you">You</b> ${S.pos.off.you}/15 off · ${pips(S.pos, "you")} pips</span><span><b class="kinc"></b> ${S.pos.off.kin}/15 off · ${pips(S.pos, "kin")} pips</span>`;
        info.querySelector(".kinc").textContent = api.kinName();
        roll.disabled = !(S.turn === "you" && !S.dice && !busy && !api.ended());
        undo.disabled = !(S.turn === "you" && S.steps.length && !busy);
      }
      function stack(cx, topRow, n, who, selected, canMove, last, offset) {
        const r = colW * 0.45, show = Math.min(n, 5);
        for (let k = 0; k < show; k++) {
          const cy = topRow ? (offset || 0) + r + 2 + k * r * 1.9 : H - (offset || 0) - r - 2 - k * r * 1.9;
          ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.fillStyle = who === "you" ? "#f3e4c6" : "#2b2d36"; ctx.fill();
          ctx.lineWidth = 2; ctx.strokeStyle = who === "you" ? "#b58a4a" : "#8fb8ff"; ctx.stroke();
          if (k === show - 1) {
            if (selected) { ctx.lineWidth = 3; ctx.strokeStyle = "#3aa0ff"; ctx.stroke(); }
            else if (canMove) { ctx.lineWidth = 2.5; ctx.strokeStyle = "#ffd65a"; ctx.stroke(); }
            else if (last) { ctx.lineWidth = 2; ctx.strokeStyle = "rgba(255,214,90,.6)"; ctx.stroke(); }
            if (n > 5) { ctx.fillStyle = who === "you" ? "#222" : "#fff"; ctx.font = `700 ${r}px system-ui`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(String(n), cx, cy); ctx.textBaseline = "alphabetic"; }
          }
        }
      }
      function dice() {
        diceEl.textContent = "";
        if (!S.dice) { diceEl.append(Object.assign(document.createElement("span"), { textContent: S.turn === "you" ? "Your roll" : `${api.kinName()}'s roll`, style: "font-size:13px;color:var(--muted)" })); return; }
        S.dice.forEach((d, i) => { const e = document.createElement("span"); e.className = "die" + (S.used[i] ? " used" : "") + (S.turn === "kin" ? " k" : ""); e.textContent = d; diceEl.append(e); });
      }
      const rollDice = () => { const a = 1 + Math.floor(Math.random() * 6), b = 1 + Math.floor(Math.random() * 6); return a === b ? [a, a, a, a] : [a, b]; };
      function newTurn(who) {
        S.turn = who; S.dice = null; S.used = []; S.steps = []; S.need = 0; sel = null; turnStart = null; api.save(S); draw();
        if (who === "kin") setTimeout(kinTurn, 500);
        else api.status("Your turn: roll the dice.");
      }
      function finish() {
        const r = result(S.pos); if (!r) return false;
        if (/gammon/.test(r.kind)) api.achieve("gammon", r.winner);
        draw(); api.over(r.winner, r.kind); return true;
      }
      roll.onclick = () => {
        if (S.turn !== "you" || S.dice || busy) return;
        S.dice = rollDice(); S.used = S.dice.map(() => false); S.steps = []; turnStart = clone(S.pos);
        if (S.dice.length === 4 && S.dice[0] === 6) api.achieve("boxcars", "you");
        S.need = most(S.pos, "you", S.dice, new Map()); api.save(S);
        if (!S.need) { api.status("No legal move with that roll. Your Kin's turn."); draw(); setTimeout(() => newTurn("kin"), 1400); return; }
        api.status(`You rolled ${S.dice.slice(0, 2).join(" and ")}${S.dice.length === 4 ? " (doubles: four moves)" : ""}. Tap a checker to move.`); draw();
      };
      undo.onclick = () => { if (!turnStart || busy) return; S.pos = clone(turnStart); S.used = S.dice.map(() => false); S.steps = []; sel = null; api.save(S); draw(); };
      function tapAt(ev) {
        if (S.turn !== "you" || !S.dice || busy || api.ended()) return;
        const r = cv.getBoundingClientRect(), t = hitTest(ev.clientX - r.left, ev.clientY - r.top);
        if (t == null) return;
        const moves = allowedNow();
        if (sel != null) {
          let opts = moves.filter((m) => m.from === sel && m.to === t);
          if (opts.length) {
            opts.sort((a, b) => a.die - b.die);
            const m = opts[0]; if (!turnStart) turnStart = clone(S.pos);
            S.pos = step(S.pos, "you", m); S.used[S.dice.findIndex((d, i) => !S.used[i] && d === m.die)] = true; S.steps.push(m); S.last = [m.from, m.to];
            sel = null; api.save(S); draw();
            if (S.steps.filter((s) => s.hit).length >= 2) api.achieve("double_hit", "you");
            if (finish()) return;
            if (need() === 0 || !allowedNow().length) { busy = true; setTimeout(() => { busy = false; newTurn("kin"); }, 700); }
            return;
          }
        }
        sel = moves.some((m) => m.from === t) ? (sel === t ? null : t) : null;
        draw();
      }
      cv.addEventListener("click", tapAt);
      async function kinTurn() {
        if (dead || api.ended()) return;
        busy = true;
        S.dice = rollDice(); S.used = S.dice.map(() => false); S.steps = []; draw();
        if (S.dice.length === 4 && S.dice[0] === 6) api.achieve("boxcars", "kin");
        api.status(`${api.kinName()} rolled ${S.dice.slice(0, 2).join(" and ")}.`);
        await new Promise((r) => setTimeout(r, 700));
        const r = ranked(S.pos, "kin", S.dice);
        if (!r.length || !r[0].seq.length) { api.status(`${api.kinName()} rolled ${S.dice.slice(0, 2).join(" and ")} and can't move. Your turn.`); busy = false; await new Promise((res) => setTimeout(res, 1200)); return newTurn("you"); }
        const situation = `You play the dark checkers. Points are numbered from your own side: you move from 24 down to 1 and bear off from your home board (1 to 6). You rolled ${S.dice.slice(0, 2).join(" and ")}${S.dice.length === 4 ? " (doubles, four moves)" : ""}. Pip counts: you ${pips(S.pos, "kin")}, your person ${pips(S.pos, "you")}. Borne off: you ${S.pos.off.kin}, them ${S.pos.off.you}.${S.pos.bar.kin ? " You have " + S.pos.bar.kin + " on the bar." : ""} Moves are written from/to, "*" is a hit.`;
        const pick = await api.kinMove({ ranked: r, situation });
        if (dead || !pick) return;
        for (const st of pick.seq) {
          S.pos = step(S.pos, "kin", st); S.used[S.dice.findIndex((d, i) => !S.used[i] && d === st.die)] = true; S.last = [st.from, st.to]; draw();
          await new Promise((res) => setTimeout(res, 450)); if (dead) return;
        }
        busy = false; api.save(S);
        if (pick.seq.filter((s) => s.hit).length >= 2) api.achieve("double_hit", "kin");
        if (finish()) return;
        if (api.settings.mode === "talk" && pick.seq.some((s) => s.hit)) api.line("You just hit one of their checkers and sent it to the bar.");
        newTurn("you");
      }
      const ro = new ResizeObserver(size); ro.observe(api.el);
      (async () => {
        S = api.state && api.state.pos ? api.state : null;
        if (!S) { const first = await api.firstMover(); S = { v: 1, pos: start(), turn: first, dice: null, used: [], steps: [], need: 0 }; }
        size();
        if (S.turn === "kin") { S.dice = null; newTurn("kin"); }
        else if (S.dice) { turnStart = null; api.status("Your move."); draw(); }
        else newTurn("you");
      })();
      return { destroy() { dead = true; ro.disconnect(); } };
    },
  });
})(typeof self !== "undefined" ? self : this);
