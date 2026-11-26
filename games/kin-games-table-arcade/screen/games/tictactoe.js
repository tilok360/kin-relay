// Tic tac toe. You are X, your Kin is O; who goes first alternates.
(function (root) {
  "use strict";
  const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
  const NAMES = ["top left", "top middle", "top right", "middle left", "center", "middle right", "bottom left", "bottom middle", "bottom right"];
  function winner(b) {
    for (const l of LINES) if (b[l[0]] && b[l[0]] === b[l[1]] && b[l[1]] === b[l[2]]) return { mark: b[l[0]], line: l };
    return b.every(Boolean) ? { mark: "draw", line: [] } : null;
  }
  // Score of the position for `me` to move: +10 win … -10 loss, sooner is better.
  function minimax(b, me, depth) {
    const w = winner(b);
    if (w) return w.mark === "draw" ? 0 : (w.mark === me ? 10 - depth : depth - 10);
    const foe = me === "X" ? "O" : "X";
    let best = -99;
    for (let i = 0; i < 9; i++) if (!b[i]) { b[i] = me; best = Math.max(best, -minimax(b, foe, depth + 1)); b[i] = ""; }
    return best;
  }
  function ranked(b, me) {
    const foe = me === "X" ? "O" : "X", out = [];
    for (let i = 0; i < 9; i++) if (!b[i]) { b[i] = me; out.push({ cell: i, score: -minimax(b, foe, 1) + (i === 4 ? 0.2 : [0, 2, 6, 8].includes(i) ? 0.1 : 0), label: NAMES[i] }); b[i] = ""; }
    return out.sort((x, y) => y.score - x.score);
  }
  const E = { winner, minimax, ranked, NAMES };
  if (typeof module === "object" && module.exports) { module.exports = E; return; }

  root.KG.add({
    id: "tictactoe", title: "Tic tac toe", icon: "⭕", blurb: "Three in a row.",
    rules: "Take turns marking a square. You're X, your Kin is O. Three in a row across, down or corner to corner wins; a full board with no line is a draw. You and your Kin take turns going first.",
    achievements: [
      { id: "diagonal", icon: "↘", name: "Corner to Corner", about: "Win with a diagonal line." },
      { id: "quick_three", icon: "⚡", name: "Three and Done", about: "Win having placed only three marks." },
      { id: "even_match", icon: "🤝", name: "Even Match", about: "Fill the whole board for a draw." },
    ],
    mount(api) {
      let S = api.state, busy = false, dead = false;
      const grid = document.createElement("div"); grid.className = "sq-board ttt"; api.el.append(grid);
      const cells = NAMES.map((n, i) => { const b = document.createElement("button"); b.type = "button"; b.className = "sq"; b.setAttribute("aria-label", n); b.onclick = () => tap(i); grid.append(b); return b; });
      function draw() {
        const w = winner(S.b);
        cells.forEach((c, i) => { c.textContent = S.b[i]; c.className = "sq" + (S.b[i] === "X" ? " x" : S.b[i] === "O" ? " o" : "") + (w && w.line.includes(i) ? " win" : ""); });
        if (!w && !busy) api.status(S.turn === "X" ? "Your move." : "");
      }
      function check() {
        const w = winner(S.b); if (!w) return false;
        if (w.mark === "draw") { api.achieve("even_match", "you"); api.achieve("even_match", "kin"); }
        else {
          const who = w.mark === "X" ? "you" : "kin";
          if (w.line.join() === "0,4,8" || w.line.join() === "2,4,6") api.achieve("diagonal", who);
          if (S.b.filter((m) => m === w.mark).length === 3) api.achieve("quick_three", who);
        }
        draw();
        const result = w.mark === "draw" ? "draw" : w.mark === "X" ? "you" : "kin";
        api.over(result, result === "draw" ? "a full board" : "three in a row");
        return true;
      }
      async function kinTurn() {
        if (dead) return;
        busy = true; draw();
        const situation = `You are O, your person is X. The board, row by row: ${[0, 3, 6].map((r) => S.b.slice(r, r + 3).map((m) => m || "_").join(" ")).join(" / ")}.`;
        const mv = await api.kinMove({ ranked: ranked(S.b, "O"), situation });
        if (dead || !mv) return;
        S.b[mv.cell] = "O"; S.turn = "X"; busy = false; api.save(S);
        if (!check()) draw();
      }
      function tap(i) {
        if (busy || S.turn !== "X" || S.b[i] || winner(S.b) || api.ended()) return;
        S.b[i] = "X"; S.turn = "O"; api.save(S);
        if (!check()) kinTurn();
      }
      (async () => {
        if (!S) { const first = await api.firstMover(); S = { v: 1, b: Array(9).fill(""), turn: first === "you" ? "X" : "O" }; api.save(S); }
        draw();
        if (S.turn === "O") kinTurn(); else api.status("Your move. You're X.");
      })();
      return { destroy() { dead = true; } };
    },
  });
})(typeof self !== "undefined" ? self : this);
