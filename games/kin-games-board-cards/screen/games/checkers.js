// Checkers (American rules): men move and capture diagonally forward, kings both ways; captures are compulsory and
// a jump carries on while it can; a man reaching the far row is crowned and its move ends there.
// The board is 64 squares, row 0 at the top (your Kin's side). 'y' / 'Y' are your men / kings, 'k' / 'K' your Kin's.
(function (root) {
  "use strict";
  const FILES = "abcdefgh";
  const name = (i) => FILES[i & 7] + (8 - (i >> 3));           // seen from your side: a1 bottom left
  const side = (p) => (p === "y" || p === "Y" ? "you" : p === "k" || p === "K" ? "kin" : null);
  const isKing = (p) => p === "Y" || p === "K";
  const at = (r, c) => (r >= 0 && r < 8 && c >= 0 && c < 8 ? r * 8 + c : -1);

  function start() {
    const b = Array(64).fill("");
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if ((r + c) % 2 === 1) { if (r < 3) b[r * 8 + c] = "k"; if (r > 4) b[r * 8 + c] = "y"; }
    return b;
  }
  const dirs = (p) => (isKing(p) ? [[-1, -1], [-1, 1], [1, -1], [1, 1]] : side(p) === "you" ? [[-1, -1], [-1, 1]] : [[1, -1], [1, 1]]);
  const crownRow = (p) => (side(p) === "you" ? 0 : 7);

  // All moves for `who`: {path: [squares], caps: [squares]}. Captures only, when there are any.
  function moves(b, who) {
    const jumps = [], steps = [];
    for (let sq = 0; sq < 64; sq++) {
      const p = b[sq]; if (side(p) !== who) continue;
      const r = sq >> 3, c = sq & 7;
      const grow = (from, piece, path, caps) => {
        let more = false;
        const fr = from >> 3, fc = from & 7;
        for (const [dr, dc] of dirs(piece)) {
          const mid = at(fr + dr, fc + dc), to = at(fr + 2 * dr, fc + 2 * dc);
          if (mid < 0 || to < 0) continue;
          if (side(b[mid]) && side(b[mid]) !== who && !caps.includes(mid) && (!b[to] || to === sq)) {
            more = true;
            const np = path.concat([to]), nc = caps.concat([mid]);
            if (!isKing(piece) && (to >> 3) === crownRow(piece)) jumps.push({ path: np, caps: nc });
            else grow(to, piece, np, nc);
          }
        }
        if (!more && caps.length) jumps.push({ path, caps });
      };
      grow(sq, p, [sq], []);
      for (const [dr, dc] of dirs(p)) { const to = at(r + dr, c + dc); if (to >= 0 && !b[to]) steps.push({ path: [sq, to], caps: [] }); }
    }
    return jumps.length ? jumps : steps;
  }
  function apply(b, m) {
    const n = b.slice(), from = m.path[0], to = m.path[m.path.length - 1];
    let p = n[from]; n[from] = "";
    m.caps.forEach((c) => (n[c] = ""));
    if (!isKing(p) && (to >> 3) === crownRow(p)) p = p.toUpperCase();
    n[to] = p;
    return n;
  }
  const label = (b, m) => {
    const t = m.path.map(name).join(m.caps.length ? "x" : "-");
    const p = b[m.path[0]], to = m.path[m.path.length - 1];
    let w = m.caps.length ? `jump ${m.caps.length === 1 ? "one piece" : m.caps.length + " pieces"}` : "move";
    if (!isKing(p) && (to >> 3) === crownRow(p)) w += ", crowning a king";
    return `${t} (${isKing(p) ? "king" : "man"}: ${w})`;
  };
  function evaluate(b, who) {
    let s = 0;
    for (let sq = 0; sq < 64; sq++) {
      const p = b[sq]; if (!p) continue;
      const r = sq >> 3, c = sq & 7;
      let v = isKing(p) ? 165 : 100;
      if (!isKing(p)) v += (side(p) === "you" ? 7 - r : r) * 3;                 // advance
      if (c >= 2 && c <= 5 && r >= 2 && r <= 5) v += 4;                       // centre
      if (!isKing(p) && r === (side(p) === "you" ? 7 : 0)) v += 6;             // home row guard
      s += side(p) === who ? v : -v;
    }
    return s;
  }
  const other = (w) => (w === "you" ? "kin" : "you");
  function search(b, who, depth, alpha, beta) {
    const ms = moves(b, who);
    if (!ms.length) return -10000 - depth;
    if (depth <= 0 && !ms[0].caps.length) return evaluate(b, who);
    if (depth <= -6) return evaluate(b, who);
    for (const m of ms) {
      const v = -search(apply(b, m), other(who), depth - 1, -beta, -alpha);
      if (v >= beta) return v;
      if (v > alpha) alpha = v;
    }
    return alpha;
  }
  function ranked(b, who, depth) {
    return moves(b, who).map((m) => ({ m, score: -search(apply(b, m), other(who), (depth || 6) - 1, -1e9, 1e9), label: label(b, m) })).sort((x, y) => y.score - x.score);
  }
  const count = (b, who) => b.filter((p) => side(p) === who).length;

  const E = { start, moves, apply, ranked, evaluate, name, count, label };
  if (typeof module === "object" && module.exports) { module.exports = E; return; }

  const DRAW_PLIES = 80;
  root.KG.add({
    id: "checkers", title: "Checkers", icon: "⛀", blurb: "Jump, crown, clear the board.",
    rules: "American checkers on the dark squares. Men move one square diagonally forward; kings move forward and back. Jumping is compulsory: if you can jump you must, and a jump carries on while the same piece can jump again. A man that reaches the far row is crowned a king, and that ends its move. You win when your Kin has no pieces or no move left. Forty moves each with no jump and no crowning is a draw. You're red and start at the bottom; you and your Kin take turns going first. Tap a piece, then each square it lands on.",
    achievements: [
      { id: "king_me", icon: "👑", name: "King Me", about: "Crown one of your men." },
      { id: "triple_jump", icon: "🦘", name: "Triple Jump", about: "Take three or more pieces in one move." },
      { id: "iron_wall", icon: "🛡", name: "Iron Wall", about: "Win with nine or more of your twelve pieces left." },
    ],
    mount(api) {
      let S = null, path = [], busy = false, dead = false;
      const info = document.createElement("div"); info.className = "score";
      const board = document.createElement("div"); board.className = "sq-board"; board.style.gridTemplateColumns = "repeat(8,1fr)";
      api.el.append(info, board);
      const cells = [];
      for (let sq = 0; sq < 64; sq++) { const b = document.createElement("button"); b.type = "button"; b.className = "sq"; b.onclick = () => tap(sq); board.append(b); cells.push(b); }

      function options() { return moves(S.b, "you").filter((m) => path.every((sq, i) => m.path[i] === sq)); }
      function draw() {
        const opts = path.length ? options() : [], next = new Set(opts.map((m) => m.path[path.length]).filter((x) => x != null));
        const movable = new Set(moves(S.b, "you").map((m) => m.path[0]));
        cells.forEach((c, sq) => {
          const r = sq >> 3, col = sq & 7, p = S.b[sq];
          c.className = "sq " + ((r + col) % 2 ? "dark" : "light");
          c.textContent = "";
          if (S.last && S.last.includes(sq)) c.classList.add("last");
          if (path.includes(sq)) c.classList.add("sel");
          if (p) { const m = document.createElement("span"); m.className = "man " + (side(p) === "you" ? "y" : "k"); if (isKing(p)) m.textContent = "♛︎"; c.append(m); }
          if (next.has(sq)) c.append(Object.assign(document.createElement("span"), { className: "dot" }));
          else if (!path.length && !busy && S.turn === "you" && movable.has(sq)) c.style.cursor = "pointer";
          c.setAttribute("aria-label", name(sq) + (p ? (side(p) === "you" ? " your " : " your Kin's ") + (isKing(p) ? "king" : "man") : ""));
        });
        info.innerHTML = `<span><b class="you">You</b> ${count(S.b, "you")} pieces</span><span><b class="kinc"></b> ${count(S.b, "kin")} pieces</span>`;
        info.querySelector(".kinc").textContent = api.kinName();
        if (!busy && S.turn === "you" && !api.ended()) api.status(moves(S.b, "you")[0] && moves(S.b, "you")[0].caps.length ? "Your move: you have a jump, and you must take it." : "Your move.");
      }
      function finish() {
        const who = S.turn;
        if (!moves(S.b, who).length) { const w = other(who); if (count(S.b, w) >= 9) api.achieve("iron_wall", w); draw(); api.over(who === "you" ? "kin" : "you", count(S.b, who) ? "no moves left" : "every piece taken"); return true; }
        if (S.quiet >= DRAW_PLIES) { draw(); api.over("draw", "forty moves each without a jump"); return true; }
        return false;
      }
      function commit(m, who) {
        const crowned = !isKing(S.b[m.path[0]]) && (m.path[m.path.length - 1] >> 3) === (who === "you" ? 0 : 7);
        S.b = apply(S.b, m); S.last = m.path.slice(); S.turn = other(who);
        S.quiet = m.caps.length || crowned ? 0 : (S.quiet || 0) + 1;
        S.moves = (S.moves || []).concat([label(S.b, m).split(" ")[0]]);
        api.save(S);
        if (crowned) api.achieve("king_me", who);
        if (m.caps.length >= 3) api.achieve("triple_jump", who);
        return crowned;
      }
      function tap(sq) {
        if (busy || dead || S.turn !== "you" || api.ended()) return;
        if (!path.length) { if (moves(S.b, "you").some((m) => m.path[0] === sq)) { path = [sq]; draw(); } return; }
        if (sq === path[0] && path.length === 1) { path = []; draw(); return; }
        const opts = options().filter((m) => m.path[path.length] === sq);
        if (!opts.length) { if (path.length === 1 && moves(S.b, "you").some((m) => m.path[0] === sq)) path = [sq]; draw(); return; }
        path.push(sq);
        const done = opts.find((m) => m.path.length === path.length);
        if (done && opts.length === 1) { path = []; commit(done, "you"); draw(); if (!finish()) setTimeout(kinTurn, 30); return; }
        draw();
      }
      async function kinTurn() {
        if (dead || api.ended()) return;
        busy = true; draw(); api.status(`${api.kinName()} is thinking…`, true);
        await new Promise((r) => setTimeout(r, 30));
        const r = ranked(S.b, "kin", api.settings.level === "beginner" ? 2 : api.settings.level === "easy" ? 4 : 6);
        const situation = `You play the black pieces from the top of the board, moving down; your person plays red from the bottom. Squares are named from their side (a1 bottom left, h8 top right). You have ${count(S.b, "kin")} pieces, they have ${count(S.b, "you")}.${S.moves && S.moves.length ? " Their last move: " + S.moves[S.moves.length - 1] + "." : ""}`;
        const pick = await api.kinMove({ ranked: r, situation });
        if (dead || !pick) return;
        const crowned = commit(pick.m, "kin"); busy = false; draw();
        if (!finish() && api.settings.mode === "talk" && (pick.m.caps.length > 1 || crowned)) api.line(crowned ? "You just crowned a king." : `You just made a double jump.`);
      }
      (async () => {
        S = api.state && api.state.b ? api.state : null;
        if (!S) { const first = await api.firstMover(); S = { v: 1, b: start(), turn: first, quiet: 0, moves: [] }; api.save(S); }
        draw();
        if (S.turn === "kin") kinTurn();
      })();
      return { destroy() { dead = true; } };
    },
  });
})(typeof self !== "undefined" ? self : this);
