// Farkle: roll six dice, set aside scoring dice, then bank the points or push your luck. First to 3,000 wins.
(function (root) {
  "use strict";
  const TARGET = 3000;
  // Points for a set of dice where every die must count; 0 if any die doesn't score.
  function points(vals) {
    if (!vals.length) return 0;
    const c = [0, 0, 0, 0, 0, 0, 0]; vals.forEach((v) => c[v]++);
    if (vals.length === 6 && c.slice(1).every((n) => n === 1)) return 1500;
    if (vals.length === 6 && c.filter((n) => n === 2).length === 3) return 750;
    let pts = 0;
    for (let f = 1; f <= 6; f++) { let n = c[f]; if (n >= 3) { pts += (f === 1 ? 1000 : f * 100) * (n - 2); n = 0; } if (f === 1) pts += n * 100; else if (f === 5) pts += n * 50; else if (n) return 0; }
    return pts;
  }
  const hasScore = (vals) => vals.some((v) => v === 1 || v === 5) || [2, 3, 4, 6].some((f) => vals.filter((v) => v === f).length >= 3) || points(vals) > 0;
  const setup = (first) => ({ seats: first === "you" ? ["you", "kin"] : ["kin", "you"], turn: 0, score: [0, 0], turnPts: 0, dice: [], left: 6, rolled: false, ply: 0, last: null, farkle: false });
  const roll = (n, vals) => [...Array(n).keys()].map((i) => (vals && vals[i]) || 1 + Math.floor(Math.random() * 6));
  function keeps(dice) {
    const seen = new Map();
    for (let mask = 1; mask < 1 << dice.length; mask++) { const idx = dice.map((_, i) => i).filter((i) => (mask >> i) & 1), vals = idx.map((i) => dice[i]), p = points(vals); if (!p) continue; const key = vals.slice().sort().join(); if (!seen.has(key)) seen.set(key, { idx, pts: p }); }
    return [...seen.values()];
  }
  function moves(S) {
    if (over(S)) return [];
    if (S.farkle) return [{ next: true }];
    if (!S.rolled) return [{ roll: true }];
    const out = []; for (const k of keeps(S.dice)) { out.push({ keep: k.idx, then: "roll" }); out.push({ keep: k.idx, then: "bank" }); }
    return out;
  }
  function apply(S, m) {
    if (m.next) return { ...S, farkle: false, turnPts: 0, left: 6, rolled: false, dice: [], turn: 1 - S.turn };
    if (m.roll) { const dice = roll(S.left, m.vals); return { ...S, dice, rolled: true, farkle: !hasScore(dice), last: { p: S.turn, rolled: dice.slice() } }; }
    const kept = m.keep.map((i) => S.dice[i]), gain = points(kept), tp = S.turnPts + gain; let left = S.left - kept.length; const hot = left === 0; if (hot) left = 6;
    if (m.then === "bank") { const score = S.score.slice(); score[S.turn] += tp; return { ...S, score, turnPts: 0, left: 6, rolled: false, dice: [], turn: 1 - S.turn, ply: S.ply + 1, last: { p: S.turn, kept, gain, bank: tp } }; }
    const dice = roll(left, m.vals);
    return { ...S, turnPts: tp, left, dice, rolled: true, farkle: !hasScore(dice), ply: S.ply + 1, last: { p: S.turn, kept, gain, hot, rolled: dice.slice() } };
  }
  function over(S) { const w = S.score.findIndex((x) => x >= TARGET); return w < 0 ? null : { result: S.seats[w], detail: `${S.score[w]} to ${S.score[1 - w]}` }; }
  const PF = [0, 0.667, 0.444, 0.278, 0.157, 0.077, 0.023], GAIN = [0, 75, 110, 160, 230, 320, 450];
  function rank(S, level) {
    const ms = moves(S); if (!ms[0].keep) return ms.map((m) => ({ m, label: m.roll ? "roll" : "farkle — pass the dice", score: 0 }));
    const p = S.turn, need = TARGET - S.score[p], foeClose = S.score[1 - p] >= TARGET - 600;
    return ms.map((m) => {
      const kept = m.keep.map((i) => S.dice[i]), g = points(kept), tp = S.turnPts + g; let left = S.left - kept.length; if (!left) left = 6;
      let sc;
      if (m.then === "bank") sc = tp >= need ? 1e5 : tp - (foeClose ? 120 : 0);
      else { const risk = PF[left] * (level === "hard" ? 1 : level === "normal" ? 0.9 : 0.6); sc = (1 - risk) * (tp + GAIN[left]) - (left === 6 ? 0 : 20); }
      sc += g * 0.05 - kept.length * 6;
      return { m, label: `keep ${kept.join(" ")} (+${g}) and ${m.then === "bank" ? `bank ${tp}` : `roll ${left} dice`}`, score: sc + Math.random() * 3 };
    }).sort((a, b) => b.score - a.score);
  }
  const autoMove = (S) => { if (over(S)) return null; if (S.farkle) return { next: true }; if (!S.rolled && S.seats[S.turn] !== "you") return { roll: true }; return null; };
  const E = { TARGET, points, keeps, hasScore, setup, moves, apply, over, rank, autoMove };
  if (typeof module === "object" && module.exports) { module.exports = E; return; }
  const K = root.Kit;
  root.KG.add({
    id: "farkle", title: "Farkle", icon: "🎲",
    rules: "Roll six dice. Set aside at least one scoring die, then bank your turn's points or roll the rest. Ones score 100, fives 50, three of a kind 100 × the face (three ones = 1,000), and each extra die of the kind doubles it. A straight 1–6 scores 1,500, three pairs 750. Score with all six and you get hot dice: roll all six again. Roll nothing that scores and it's a Farkle: the turn's points are lost. First to bank 3,000 wins.",
    achievements: [
      { id: "hot", icon: "🔥", name: "Hot Dice", about: "Score with all six dice and keep rolling." },
      { id: "big", icon: "💰", name: "High Roller", about: "Bank 1,500 or more in one turn." },
      { id: "straight", icon: "📐", name: "One to Six", about: "Roll a straight." },
    ],
    mount(api) {
      return K.turnGame(api, {
        ...E, autoForYou: true, autoDelay: 900, thinkMs: 600, botMs: 600,
        mount(el, H) {
          const v = { bar: K.el("div"), info: K.el("div", "score"), tray: K.el("div", "tray"), kept: K.el("div", "side"), ctl: K.el("div", "ctrl"), pick: new Set() }; el.append(v.bar, v.info, v.tray, v.kept, v.ctl);
          v.rollB = K.btn("btn", "Roll", () => act("roll")); v.bankB = K.btn("btn alt", "Bank", () => act("bank")); v.ctl.append(v.rollB, v.bankB);
          const act = async (what) => {
            if (!H.mine()) return; const S = H.S;
            if (!S.rolled) { const vals = [...Array(S.left).keys()].map(() => 1 + Math.floor(Math.random() * 6)); v.rolling = true; v.drawDice(vals.map(() => 1)); await K.roll([...v.tray.children], vals); v.rolling = false; H.play({ roll: true, vals }); return; }
            const idx = [...v.pick].sort(); if (!idx.length || !points(idx.map((i) => S.dice[i]))) { K.shake(v.tray); K.sfx.buzz(); return; }
            v.pick.clear();
            if (what === "bank") H.play({ keep: idx, then: "bank" });
            else { let left = S.left - idx.length; if (!left) left = 6; const vals = [...Array(left).keys()].map(() => 1 + Math.floor(Math.random() * 6)); v.rolling = true; v.drawDice(vals.map(() => 1)); await K.roll([...v.tray.children], vals); v.rolling = false; H.play({ keep: idx, then: "roll", vals }); }
          };
          v.drawDice = (vals, H2) => { v.tray.replaceChildren(...vals.map((d, i) => K.die(d, { held: v.pick.has(i), onClick: H2 ? () => { if (!H2.mine() || !H2.S.rolled) return; v.pick.has(i) ? v.pick.delete(i) : v.pick.add(i); K.sfx.click(); H2.redraw(); } : null }))); };
          el.addEventListener("keydown", (e) => { if (e.key === " " || e.key === "r") { e.preventDefault(); act("roll"); } if (e.key === "b") act("bank"); if (e.key >= "1" && e.key <= "6" && v.tray.children[Number(e.key) - 1]) v.tray.children[Number(e.key) - 1].click(); });
          return v;
        },
        draw(v, S, H) {
          v.bar.replaceChildren(K.players(H, (i) => `${S.score[i].toLocaleString()} / ${TARGET.toLocaleString()}`));
          const mine = H.mine(); if (!mine) v.pick.clear();
          const sel = [...v.pick].map((i) => S.dice[i]), sp = points(sel);
          v.info.innerHTML = `<span>This turn: <b>${S.turnPts}</b>${sel.length ? ` + <b>${sp || "✗"}</b>` : ""}</span><span>${S.farkle ? "<b style='color:#ff9a8a'>FARKLE!</b>" : S.rolled ? `${S.dice.length} dice rolled` : `${S.left} dice to roll`}</span>`;
          if (!v.rolling) v.drawDice(S.rolled || S.farkle ? S.dice : [...Array(S.left).keys()].map(() => 6), H);
          if (!S.rolled && !S.farkle) [...v.tray.children].forEach((d) => (d.style.opacity = ".35"));
          const lm = S.last; v.kept.textContent = lm && lm.kept && lm.p === S.turn && !lm.bank ? `Set aside: ${lm.kept.join(" ")} (+${lm.gain})${lm.hot ? " — hot dice!" : ""}` : lm && lm.bank ? `${H.nameOf(lm.p)} banked ${lm.bank}.` : "";
          v.rollB.disabled = !mine || S.farkle || (S.rolled && !sp); v.bankB.disabled = !mine || !S.rolled || !sp;
          v.rollB.textContent = !S.rolled ? `Roll ${S.left}` : `Keep & roll ${S.left - sel.length || 6}`;
        },
        animate: async (v, S0, m, S1, who) => { if (who !== "you" && (m.roll || m.then === "roll")) { v.rolling = true; v.tray.replaceChildren(...S1.dice.map(() => K.die(1))); await K.roll([...v.tray.children], S1.dice); v.rolling = false; } if (S1.farkle) K.sfx.lose(); else if (m.then === "bank") K.sfx.chip(); },
        feats(S0, m, S1, who) { if (S1.last && S1.last.hot) api.achieve("hot", who); if (m.then === "bank" && S1.last.bank >= 1500) api.achieve("big", who); if (S1.last && S1.last.rolled && S1.last.rolled.length === 6 && new Set(S1.last.rolled).size === 6) api.achieve("straight", S0.seats[S0.turn]); },
        situation: (S) => `You rolled ${S.dice.join(", ")}; this turn so far ${S.turnPts}. Score: you ${S.score[S.turn]}, them ${S.score[1 - S.turn]} (to ${TARGET}).`,
        yourTurn: (S) => (!S.rolled ? "Your turn: roll." : "Tap scoring dice to set them aside, then roll on or bank."),
      });
    },
  });
})(typeof self !== "undefined" ? self : this);
