// Yacht Dice: five dice, up to three rolls a turn, then fill one of thirteen boxes. Highest total wins.
(function (root) {
  "use strict";
  const CATS = ["ones", "twos", "threes", "fours", "fives", "sixes", "three", "four", "full", "small", "large", "yacht", "chance"];
  const CNAME = { ones: "Ones", twos: "Twos", threes: "Threes", fours: "Fours", fives: "Fives", sixes: "Sixes", three: "Three of a kind", four: "Four of a kind", full: "Full house", small: "Small straight", large: "Large straight", yacht: "Yacht", chance: "Chance" };
  const AVG = { ones: 2.1, twos: 5.3, threes: 8.6, fours: 12.2, fives: 15.7, sixes: 19.2, three: 15, four: 6, full: 9, small: 18, large: 11, yacht: 4, chance: 22 };
  function score(cat, d) {
    const cnt = [0, 0, 0, 0, 0, 0, 0]; d.forEach((v) => cnt[v]++); const sum = d.reduce((a, b) => a + b, 0), mx = Math.max(...cnt);
    const has = (a) => a.every((v) => cnt[v]);
    switch (cat) {
      case "ones": case "twos": case "threes": case "fours": case "fives": case "sixes": { const f = CATS.indexOf(cat) + 1; return cnt[f] * f; }
      case "three": return mx >= 3 ? sum : 0; case "four": return mx >= 4 ? sum : 0;
      case "full": return cnt.includes(3) && cnt.includes(2) ? 25 : 0;
      case "small": return has([1, 2, 3, 4]) || has([2, 3, 4, 5]) || has([3, 4, 5, 6]) ? 30 : 0;
      case "large": return has([1, 2, 3, 4, 5]) || has([2, 3, 4, 5, 6]) ? 40 : 0;
      case "yacht": return mx === 5 ? 50 : 0; case "chance": return sum;
    }
    return 0;
  }
  const upper = (sh) => CATS.slice(0, 6).reduce((t, c) => t + (sh[c] || 0), 0);
  const total = (sh) => Object.values(sh).reduce((a, b) => a + b, 0) + (upper(sh) >= 63 ? 35 : 0);
  const setup = (first) => ({ seats: first === "you" ? ["you", "kin"] : ["kin", "you"], turn: 0, sheet: [{}, {}], dice: [1, 2, 3, 4, 5], rolls: 0, ply: 0, last: null });
  const open = (S, p) => CATS.filter((c) => S.sheet[p][c] == null);
  function over(S) { if (open(S, 0).length || open(S, 1).length) return null; const a = total(S.sheet[0]), b = total(S.sheet[1]); return { result: a > b ? S.seats[0] : b > a ? S.seats[1] : "draw", detail: `${Math.max(a, b)} to ${Math.min(a, b)}` }; }
  function moves(S) { if (over(S)) return []; const out = []; if (S.rolls < 3) out.push({ roll: true }); if (S.rolls) for (const c of open(S, S.turn)) out.push({ cat: c }); return out; }
  function apply(S, m) {
    if (m.roll) { const keep = m.keep || [0, 0, 0, 0, 0], dice = S.dice.map((v, i) => (S.rolls && keep[i] ? v : (m.vals && m.vals[i]) || 1 + Math.floor(Math.random() * 6))); return { ...S, dice, rolls: S.rolls + 1, last: { roll: true, keep, p: S.turn } }; }
    const sheet = S.sheet.map((x) => ({ ...x })), v = score(m.cat, S.dice); sheet[S.turn][m.cat] = v;
    return { ...S, sheet, rolls: 0, turn: 1 - S.turn, ply: S.ply + 1, last: { cat: m.cat, v, p: S.turn, dice: S.dice.slice() } };
  }
  // What a box is worth to fill now: its score against what it usually gives, with an eye on the upper bonus.
  function boxValue(S, p, cat, d) {
    const v = score(cat, d), i = CATS.indexOf(cat); let val = v - AVG[cat] * 0.85;
    if (i < 6) { const f = i + 1, need = 63 - upper(S.sheet[p]); if (need > 0) val += (v - 3 * f) * 0.6; }
    if (cat === "yacht" && !v) val -= 6; if (cat === "chance") val -= 4;
    return val;
  }
  const bestBox = (S, p, d) => { let b = -1e9, c0 = null; for (const c of open(S, p)) { const v = boxValue(S, p, c, d); if (v > b) { b = v; c0 = c; } } return [b, c0]; };
  function rank(S, level) {
    const p = S.turn, out = [];
    if (!S.rolls) return [{ m: { roll: true, keep: [0, 0, 0, 0, 0] }, label: "roll all five", score: 0 }];
    for (const c of open(S, p)) out.push({ m: { cat: c }, label: `score ${score(c, S.dice)} in ${CNAME[c]}`, score: boxValue(S, p, c, S.dice) });
    if (S.rolls < 3) {
      const N = level === "hard" ? 90 : level === "normal" ? 50 : 20, seen = new Set();
      for (let mask = 0; mask < 32; mask++) {
        const keep = [0, 1, 2, 3, 4].map((i) => (mask >> i) & 1), key = S.dice.filter((_, i) => keep[i]).sort().join(); if (seen.has(key) || mask === 31) continue; seen.add(key);
        let tot = 0; for (let k = 0; k < N; k++) { const d = S.dice.map((v, i) => (keep[i] ? v : 1 + Math.floor(Math.random() * 6))); tot += bestBox(S, p, d)[0]; }
        const ev = tot / N + (S.rolls === 1 ? 2.2 : 0), kept = S.dice.filter((_, i) => keep[i]);
        out.push({ m: { roll: true, keep }, label: kept.length ? `keep ${kept.join(", ")} and roll the rest` : "roll all five again", score: ev });
      }
    }
    return out.sort((a, b) => b.score - a.score);
  }
  const autoMove = (S) => (S.seats[S.turn] !== "you" && !S.rolls && !over(S) ? { roll: true, keep: [0, 0, 0, 0, 0] } : null);
  const E = { CATS, CNAME, score, total, upper, setup, moves, apply, over, rank, autoMove };
  if (typeof module === "object" && module.exports) { module.exports = E; return; }
  const K = root.Kit;
  root.KG.add({
    id: "yacht", title: "Yacht Dice", icon: "🎲",
    rules: "Each turn roll five dice up to three times; between rolls tap dice to hold them. Then pick one empty box on your card to score. Top boxes score the matching faces (63 or more across them earns a 35 bonus). Three or four of a kind score all five dice, a full house 25, a small straight (four in a run) 30, a large straight 40, a yacht (five the same) 50, and chance the total. Every box gets filled once, even with a zero. Highest total after thirteen turns wins.",
    achievements: [
      { id: "yacht", icon: "⛵", name: "Set Sail", about: "Score a Yacht." },
      { id: "bonus", icon: "🎁", name: "Top Shelf", about: "Earn the upper-section bonus." },
      { id: "two50", icon: "🏆", name: "Captain", about: "Finish with 250 points or more." },
    ],
    mount(api) {
      return K.turnGame(api, {
        ...E, autoDelay: 300, thinkMs: 500, botMs: 500,
        mount(el, H) {
          const v = { bar: K.el("div"), tray: K.el("div", "tray"), ctl: K.el("div", "ctrl"), card: K.el("div"), keep: [0, 0, 0, 0, 0] }; el.append(v.bar, v.tray, v.ctl, v.card);
          v.dice = [0, 1, 2, 3, 4].map((i) => K.die(1 + i, { onClick: () => { if (!H.mine() || !H.S.rolls || H.S.rolls >= 3) return; v.keep[i] ^= 1; K.sfx.click(); H.redraw(); } }));
          v.tray.append(...v.dice);
          v.btn = K.btn("btn", "Roll", async () => { if (!H.mine() || H.S.rolls >= 3) return; const keep = H.S.rolls ? v.keep.slice() : [0, 0, 0, 0, 0], vals = [0, 1, 2, 3, 4].map(() => 1 + Math.floor(Math.random() * 6)); const fin = H.S.dice.map((d, i) => (keep[i] ? d : vals[i])); v.rolling = true; await K.roll(v.dice.filter((_, i) => !keep[i]), fin.filter((_, i) => !keep[i])); v.rolling = false; H.play({ roll: true, keep, vals }); });
          v.ctl.append(v.btn);
          el.addEventListener("keydown", (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); v.btn.click(); } if (e.key >= "1" && e.key <= "5") v.dice[Number(e.key) - 1].click(); });
          return v;
        },
        draw(v, S, H) {
          v.bar.replaceChildren(K.players(H, (i) => `${total(S.sheet[i])} pts`));
          const mine = H.mine(); if (!mine || !S.rolls) v.keep = [0, 0, 0, 0, 0];
          const held = S.seats[S.turn] === "you" ? v.keep : (S.last && S.last.roll && S.last.keep) || [0, 0, 0, 0, 0];
          if (!v.rolling) v.dice.forEach((d, i) => { d.innerHTML = K.dieSVG(S.dice[i]); d.classList.toggle("held", !!held[i] && S.rolls > 0 && S.rolls < 3); d.style.visibility = S.rolls || (S.last && S.last.cat) ? "" : "hidden"; d.disabled = !mine || !S.rolls || S.rolls >= 3; });
          v.btn.disabled = !mine || S.rolls >= 3; v.btn.textContent = S.rolls ? `Roll again (${3 - S.rolls} left)` : "Roll";
          const t = K.el("table", "scorecard"), hr = K.el("tr"); hr.append(K.el("th", "", "Box"), ...S.seats.map((_, i) => K.el("th", "", H.nameOf(i)))); t.append(hr);
          const you = S.seats.indexOf("you");
          CATS.forEach((c, k) => {
            const tr = K.el("tr"); tr.append(K.el("td", "", CNAME[c]));
            S.seats.forEach((_, i) => { const td = K.el("td"); const val = S.sheet[i][c]; if (val != null) { td.textContent = val; if (S.last && S.last.cat === c && S.last.p === i) td.className = "fresh"; } else if (i === you && mine && S.rolls) { const b = K.btn("", "+" + score(c, S.dice), () => H.play({ cat: c })); td.append(b); } else td.textContent = "·"; tr.append(td); });
            t.append(tr); if (k === 5) { const b = K.el("tr", "sub"); b.append(K.el("td", "", "Bonus (63+)"), ...S.seats.map((_, i) => K.el("td", "", upper(S.sheet[i]) >= 63 ? "35" : `${upper(S.sheet[i])}/63`))); t.append(b); }
          });
          const tot = K.el("tr", "sub"); tot.append(K.el("td", "", "Total"), ...S.seats.map((_, i) => K.el("td", "", String(total(S.sheet[i]))))); t.append(tot);
          v.card.replaceChildren(t);
        },
        animate: async (v, S0, m, S1, who) => { if (m.roll && who !== "you") { const keep = m.keep || [0, 0, 0, 0, 0], idx = [0, 1, 2, 3, 4].filter((i) => !(S0.rolls && keep[i])); v.dice.forEach((d, i) => d.classList.toggle("held", !!(S0.rolls && keep[i]))); v.rolling = true; v.dice.forEach((d) => (d.style.visibility = "")); await K.roll(idx.map((i) => v.dice[i]), idx.map((i) => S1.dice[i])); v.rolling = false; } else if (m.cat) { if (S1.last.v) K.sfx.score(); else K.sfx.buzz(); } },
        feats(S0, m, S1, who) { if (m.cat === "yacht" && S1.last.v === 50) api.achieve("yacht", who); if (m.cat && upper(S1.sheet[S0.turn]) >= 63 && upper(S0.sheet[S0.turn]) < 63) api.achieve("bonus", who); const o = over(S1); if (o) S1.seats.forEach((w, i) => total(S1.sheet[i]) >= 250 && api.achieve("two50", w)); },
        situation: (S) => `Your dice: ${S.dice.join(", ")} (roll ${S.rolls} of 3). Your score ${total(S.sheet[S.turn])}, theirs ${total(S.sheet[1 - S.turn])}.`,
        yourTurn: (S) => (!S.rolls ? "Your turn: roll the dice." : S.rolls < 3 ? "Tap dice to hold them, roll again, or score a box." : "Pick a box to score."),
      });
    },
  });
})(typeof self !== "undefined" ? self : this);
