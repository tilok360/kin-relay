// Chess: full rules (castling, en passant, promotion, check, mate, stalemate, fifty moves, threefold repetition,
// too little material). Squares are 0-63, a1 = 0, h1 = 7, a8 = 56. White pieces are capitals.
(function (root) {
  "use strict";
  const FILES = "abcdefgh";
  const sqName = (i) => FILES[i & 7] + ((i >> 3) + 1);
  const isW = (p) => p && p === p.toUpperCase();
  const NAMES = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };
  const VAL = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
  const KN = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
  const DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]], ORTH = [[1, 0], [-1, 0], [0, 1], [0, -1]], ALL = DIAG.concat(ORTH);
  const at = (f, r) => (f >= 0 && f < 8 && r >= 0 && r < 8 ? r * 8 + f : -1);

  // Piece-square tables, written as a board seen from White (rank 8 first).
  const T = {
    p: [0,0,0,0,0,0,0,0, 50,50,50,50,50,50,50,50, 10,10,20,30,30,20,10,10, 5,5,10,25,25,10,5,5, 0,0,0,20,20,0,0,0, 5,-5,-10,0,0,-10,-5,5, 5,10,10,-20,-20,10,10,5, 0,0,0,0,0,0,0,0],
    n: [-50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,0,0,0,-20,-40, -30,0,10,15,15,10,0,-30, -30,5,15,20,20,15,5,-30, -30,0,15,20,20,15,0,-30, -30,5,10,15,15,10,5,-30, -40,-20,0,5,5,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50],
    b: [-20,-10,-10,-10,-10,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,10,10,5,0,-10, -10,5,5,10,10,5,5,-10, -10,0,10,10,10,10,0,-10, -10,10,10,10,10,10,10,-10, -10,5,0,0,0,0,5,-10, -20,-10,-10,-10,-10,-10,-10,-20],
    r: [0,0,0,0,0,0,0,0, 5,10,10,10,10,10,10,5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, 0,0,0,5,5,0,0,0],
    q: [-20,-10,-10,-5,-5,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,5,5,5,0,-10, -5,0,5,5,5,5,0,-5, 0,0,5,5,5,5,0,-5, -10,5,5,5,5,5,0,-10, -10,0,5,0,0,0,0,-10, -20,-10,-10,-5,-5,-10,-10,-20],
    k: [-30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -20,-30,-30,-40,-40,-30,-30,-20, -10,-20,-20,-20,-20,-20,-20,-10, 20,20,0,0,0,0,20,20, 20,30,10,0,0,10,30,20],
    e: [-50,-40,-30,-20,-20,-30,-40,-50, -30,-20,-10,0,0,-10,-20,-30, -30,-10,20,30,30,20,-10,-30, -30,-10,30,40,40,30,-10,-30, -30,-10,30,40,40,30,-10,-30, -30,-10,20,30,30,20,-10,-30, -30,-30,0,0,0,0,-30,-30, -50,-30,-30,-30,-30,-30,-30,-50],
  };

  function fromFen(fen) {
    const [pos, turn, castle, ep, half, full] = fen.trim().split(/\s+/);
    const b = Array(64).fill("");
    pos.split("/").forEach((row, i) => { let f = 0; for (const ch of row) { if (/\d/.test(ch)) f += Number(ch); else { b[(7 - i) * 8 + f] = ch; f++; } } });
    const s = { b, turn: turn || "w", castle: castle && castle !== "-" ? castle : "", ep: ep && ep !== "-" ? FILES.indexOf(ep[0]) + (Number(ep[1]) - 1) * 8 : -1, half: Number(half) || 0, full: Number(full) || 1, keys: [], moves: [] };
    s.keys.push(key(s));
    return s;
  }
  function toFen(s) {
    const rows = [];
    for (let r = 7; r >= 0; r--) { let row = "", e = 0; for (let f = 0; f < 8; f++) { const p = s.b[r * 8 + f]; if (!p) e++; else { if (e) row += e; e = 0; row += p; } } if (e) row += e; rows.push(row); }
    return `${rows.join("/")} ${s.turn} ${s.castle || "-"} ${s.ep >= 0 ? sqName(s.ep) : "-"} ${s.half} ${s.full}`;
  }
  const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  const key = (s) => s.b.join(",") + s.turn + s.castle + s.ep;

  function attacked(b, sq, byWhite) {
    const f = sq & 7, r = sq >> 3;
    const mine = (p, t) => p && isW(p) === byWhite && p.toLowerCase() === t;
    const pr = byWhite ? r - 1 : r + 1;
    for (const df of [-1, 1]) { const i = at(f + df, pr); if (i >= 0 && mine(b[i], "p")) return true; }
    for (const [df, dr] of KN) { const i = at(f + df, r + dr); if (i >= 0 && mine(b[i], "n")) return true; }
    for (const [df, dr] of ALL) { const i = at(f + df, r + dr); if (i >= 0 && mine(b[i], "k")) return true; }
    for (const [df, dr] of DIAG) for (let k = 1; ; k++) { const i = at(f + df * k, r + dr * k); if (i < 0) break; if (b[i]) { if (mine(b[i], "b") || mine(b[i], "q")) return true; break; } }
    for (const [df, dr] of ORTH) for (let k = 1; ; k++) { const i = at(f + df * k, r + dr * k); if (i < 0) break; if (b[i]) { if (mine(b[i], "r") || mine(b[i], "q")) return true; break; } }
    return false;
  }
  const kingSq = (b, white) => b.indexOf(white ? "K" : "k");
  const inCheck = (s) => attacked(s.b, kingSq(s.b, s.turn === "w"), s.turn !== "w");

  function pseudo(s, capturesOnly) {
    const b = s.b, w = s.turn === "w", out = [];
    const enemy = (p) => p && isW(p) !== w;
    const add = (from, to, flag) => {
      const p = b[from], c = flag === "ep" ? (w ? "p" : "P") : b[to];
      if (capturesOnly && !c && !(p.toLowerCase() === "p" && (to >> 3) % 7 === 0)) return;
      if (p.toLowerCase() === "p" && ((to >> 3) === 7 || (to >> 3) === 0)) for (const pr of ["q", "r", "b", "n"]) out.push({ from, to, p, c, promo: pr, flag: "" });
      else out.push({ from, to, p, c, promo: "", flag: flag || "" });
    };
    for (let sq = 0; sq < 64; sq++) {
      const p = b[sq]; if (!p || isW(p) !== w) continue;
      const t = p.toLowerCase(), f = sq & 7, r = sq >> 3;
      if (t === "p") {
        const dir = w ? 1 : -1, one = at(f, r + dir);
        if (one >= 0 && !b[one]) { add(sq, one); const two = at(f, r + 2 * dir); if (r === (w ? 1 : 6) && !b[two]) add(sq, two, "double"); }
        for (const df of [-1, 1]) { const i = at(f + df, r + dir); if (i < 0) continue; if (enemy(b[i])) add(sq, i); else if (i === s.ep) add(sq, i, "ep"); }
      } else if (t === "n" || t === "k") {
        for (const [df, dr] of t === "n" ? KN : ALL) { const i = at(f + df, r + dr); if (i >= 0 && (!b[i] || enemy(b[i]))) add(sq, i); }
        if (t === "k" && !capturesOnly && sq === (w ? 4 : 60)) {
          const k = w ? "K" : "k", q = w ? "Q" : "q", by = !w;
          if (s.castle.includes(k) && !b[sq + 1] && !b[sq + 2] && b[sq + 3] === (w ? "R" : "r") && !attacked(b, sq, by) && !attacked(b, sq + 1, by) && !attacked(b, sq + 2, by)) out.push({ from: sq, to: sq + 2, p, c: "", promo: "", flag: "O-O" });
          if (s.castle.includes(q) && !b[sq - 1] && !b[sq - 2] && !b[sq - 3] && b[sq - 4] === (w ? "R" : "r") && !attacked(b, sq, by) && !attacked(b, sq - 1, by) && !attacked(b, sq - 2, by)) out.push({ from: sq, to: sq - 2, p, c: "", promo: "", flag: "O-O-O" });
        }
      } else {
        for (const [df, dr] of t === "b" ? DIAG : t === "r" ? ORTH : ALL) for (let k = 1; ; k++) {
          const i = at(f + df * k, r + dr * k); if (i < 0) break;
          if (!b[i]) { add(sq, i); continue; }
          if (enemy(b[i])) add(sq, i);
          break;
        }
      }
    }
    return out;
  }
  const RIGHTS = { 4: "KQ", 0: "Q", 7: "K", 60: "kq", 56: "q", 63: "k" };
  function make(s, m) {
    const b = s.b.slice(), w = s.turn === "w";
    b[m.to] = m.promo ? (w ? m.promo.toUpperCase() : m.promo) : b[m.from]; b[m.from] = "";
    if (m.flag === "ep") b[m.to + (w ? -8 : 8)] = "";
    if (m.flag === "O-O") { b[m.from + 1] = b[m.from + 3]; b[m.from + 3] = ""; }
    if (m.flag === "O-O-O") { b[m.from - 1] = b[m.from - 4]; b[m.from - 4] = ""; }
    let castle = s.castle;
    for (const sq of [m.from, m.to]) if (RIGHTS[sq]) for (const ch of RIGHTS[sq]) castle = castle.replace(ch, "");
    return { b, turn: w ? "b" : "w", castle, ep: m.flag === "double" ? (m.from + m.to) / 2 : -1, half: m.p.toLowerCase() === "p" || m.c ? 0 : s.half + 1, full: s.full + (w ? 0 : 1), keys: s.keys, moves: s.moves };
  }
  function legal(s, capturesOnly) {
    const w = s.turn === "w";
    return pseudo(s, capturesOnly).filter((m) => { const n = make(s, m); return !attacked(n.b, kingSq(n.b, w), !w); });
  }
  // The move as written in a score sheet (SAN), and in plain words for the Kin.
  function san(s, m, all) {
    let t;
    if (m.flag === "O-O" || m.flag === "O-O-O") t = m.flag;
    else {
      const P = m.p.toUpperCase();
      if (P === "P") t = (m.c ? FILES[m.from & 7] + "x" : "") + sqName(m.to) + (m.promo ? "=" + m.promo.toUpperCase() : "");
      else {
        t = P;
        const others = (all || legal(s)).filter((o) => o !== m && o.p === m.p && o.to === m.to && o.from !== m.from);
        if (others.length) {
          const sf = others.some((o) => (o.from & 7) === (m.from & 7)), sr = others.some((o) => o.from >> 3 === m.from >> 3);
          t += !sf ? FILES[m.from & 7] : !sr ? String((m.from >> 3) + 1) : sqName(m.from);
        }
        t += (m.c ? "x" : "") + sqName(m.to);
      }
    }
    const n = make(s, m);
    if (inCheck(n)) t += legal(n).length ? "+" : "#";
    return t;
  }
  function words(m, sanText) {
    if (m.flag === "O-O") return "castle kingside";
    if (m.flag === "O-O-O") return "castle queenside";
    let t = NAMES[m.p.toLowerCase()] + (m.c ? ` takes the ${NAMES[m.c.toLowerCase()]} on ` : " to ") + sqName(m.to);
    if (m.flag === "ep") t += " (en passant)";
    if (m.promo) t += `, becoming a ${NAMES[m.promo]}`;
    if (/#$/.test(sanText)) t += ", checkmate"; else if (/\+$/.test(sanText)) t += ", check";
    return t;
  }
  function play(s, m) {
    const all = legal(s), text = san(s, m, all), n = make(s, m);
    n.moves = s.moves.concat([text]);
    n.keys = (n.half === 0 ? [] : s.keys.slice()).concat([key(n)]);
    n.last = [m.from, m.to]; n.you = s.you; n.v = s.v;
    return n;
  }
  function material(b) { let t = 0; for (const p of b) if (p && !"pPkK".includes(p)) t += VAL[p.toLowerCase()]; return t; }
  function insufficient(b) {
    const left = b.filter((p) => p && p.toLowerCase() !== "k");
    return left.length === 0 || (left.length === 1 && "nNbB".includes(left[0]));
  }
  // {over, result: "w" | "b" | "draw", why} or {over: false, check}
  function status(s) {
    const moves = legal(s), check = inCheck(s);
    if (!moves.length) return check ? { over: true, result: s.turn === "w" ? "b" : "w", why: "checkmate" } : { over: true, result: "draw", why: "stalemate" };
    if (s.half >= 100) return { over: true, result: "draw", why: "fifty moves without a capture or pawn move" };
    const k = key(s); if (s.keys.filter((x) => x === k).length >= 3) return { over: true, result: "draw", why: "the same position three times" };
    if (insufficient(s.b)) return { over: true, result: "draw", why: "too little material to mate" };
    return { over: false, check };
  }

  function evaluate(s) {
    let sc = 0; const end = material(s.b) < 1400;
    for (let sq = 0; sq < 64; sq++) {
      const p = s.b[sq]; if (!p) continue;
      const t = p.toLowerCase(), w = isW(p), idx = w ? (7 - (sq >> 3)) * 8 + (sq & 7) : (sq >> 3) * 8 + (sq & 7);
      const v = VAL[t] + (t === "k" ? (end ? T.e : T.k)[idx] : T[t][idx]);
      sc += w ? v : -v;
    }
    return s.turn === "w" ? sc : -sc;
  }
  const order = (ms) => ms.sort((a, b) => (b.c ? VAL[b.c.toLowerCase()] * 10 - VAL[b.p.toLowerCase()] : 0) + (b.promo ? 800 : 0) - ((a.c ? VAL[a.c.toLowerCase()] * 10 - VAL[a.p.toLowerCase()] : 0) + (a.promo ? 800 : 0)));
  function quiesce(s, alpha, beta, qd) {
    const stand = evaluate(s);
    if (stand >= beta) return stand;
    if (stand > alpha) alpha = stand;
    if (qd >= 6) return stand;
    for (const m of order(legal(s, true))) {
      const v = -quiesce(make(s, m), -beta, -alpha, qd + 1);
      if (v >= beta) return v;
      if (v > alpha) alpha = v;
    }
    return alpha;
  }
  function search(s, depth, alpha, beta, ply) {
    if (depth <= 0) return quiesce(s, alpha, beta, 0);
    const ms = legal(s);
    if (!ms.length) return inCheck(s) ? -100000 + ply : 0;
    for (const m of order(ms)) {
      const v = -search(make(s, m), depth - 1, -beta, -alpha, ply + 1);
      if (v >= beta) return v;
      if (v > alpha) alpha = v;
    }
    return alpha;
  }
  // Every legal move with its score for the side to move, best first.
  function ranked(s, depth) {
    const all = legal(s);
    return order(all.slice()).map((m) => {
      const n = make(s, m);
      let score = -search(n, (depth || 3) - 1, -1e9, 1e9, 1);
      const k = key(n); if (s.keys.filter((x) => x === k).length >= 2) score = Math.min(score, 0);
      const t = san(s, m, all);
      return { m, san: t, score, label: `${t} (${words(m, t)})` };
    }).sort((a, b) => b.score - a.score);
  }
  function perft(s, d) {
    if (d === 0) return 1;
    let n = 0; for (const m of legal(s)) n += perft(make(s, m), d - 1);
    return n;
  }

  const E = { fromFen, toFen, START, legal, make, play, san, status, ranked, perft, sqName, evaluate, inCheck };
  if (typeof module === "object" && module.exports) { module.exports = E; return; }

  const GLYPH = { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" };
  root.KG.add({
    id: "chess", title: "Chess", icon: "♞", blurb: "The full game, checkmate and all.",
    rules: "Standard chess: castling, en passant and promotion included. Checkmate wins; stalemate, fifty moves without a capture or pawn move, the same position three times, or too little material to mate is a draw. You and your Kin take turns playing White, who moves first. Tap a piece, then where it goes.",
    achievements: [
      { id: "two_queens", icon: "♛", name: "Two Queens", about: "Have two queens of your own on the board at once." },
      { id: "giant_slayer", icon: "🗡", name: "Giant Slayer", about: "Take a queen with a pawn." },
      { id: "swift_mate", icon: "⏳", name: "Swift Victory", about: "Checkmate within your first 20 moves." },
    ],
    mount(api) {
      let S = null, you = "w", sel = -1, busy = false, dead = false, promoWait = null;
      const wrap = api.el;
      const info = document.createElement("div"); info.className = "score";
      const board = document.createElement("div"); board.className = "sq-board"; board.style.gridTemplateColumns = "repeat(8,1fr)";
      const promo = document.createElement("div"); promo.className = "promo"; promo.hidden = true;
      const list = document.createElement("div"); list.className = "movelist";
      wrap.append(info, board, promo, list);
      const cells = [];
      for (let k = 0; k < 64; k++) { const b = document.createElement("button"); b.type = "button"; b.className = "sq"; b.onclick = () => tap(Number(b.dataset.sq)); board.append(b); cells.push(b); }

      function draw() {
        const flip = you === "b", st = status(S), targets = sel >= 0 ? legal(S).filter((m) => m.from === sel) : [];
        cells.forEach((c, k) => {
          const r = flip ? k >> 3 : 7 - (k >> 3), f = flip ? 7 - (k & 7) : k & 7, sq = r * 8 + f, p = S.b[sq];
          c.dataset.sq = sq; c.textContent = "";
          c.className = "sq " + ((r + f) % 2 ? "light" : "dark");
          if (S.last && S.last.includes(sq)) c.classList.add("last");
          if (sq === sel) c.classList.add("sel");
          if (st.check && p === (S.turn === "w" ? "K" : "k")) c.classList.add("check");
          if (p) { const s = document.createElement("span"); s.className = "pc " + (isW(p) ? "w" : "b"); if (root.Kit && root.Kit.chessSVG) s.innerHTML = root.Kit.chessSVG(p.toLowerCase(), isW(p)); else s.textContent = GLYPH[p.toLowerCase()] + "︎"; c.append(s); }
          const t = targets.find((m) => m.to === sq);
          if (t) c.append(Object.assign(document.createElement("span"), { className: p || t.flag === "ep" ? "ring" : "dot" }));
          if ((flip ? r === 7 : r === 0)) c.append(Object.assign(document.createElement("span"), { className: "coord", textContent: FILES[f] }));
          c.setAttribute("aria-label", sqName(sq) + (p ? " " + (isW(p) ? "white " : "black ") + NAMES[p.toLowerCase()] : ""));
        });
        const cap = (white) => { const start = { p: 8, n: 2, b: 2, r: 2, q: 1 }; let t = ""; for (const k of "qrbnp") { const have = S.b.filter((x) => x === (white ? k.toUpperCase() : k)).length; t += (GLYPH[k] + "︎").repeat(Math.max(0, start[k] - have)); } return t; };
        info.innerHTML = "";
        const a = document.createElement("span"); a.innerHTML = `<b class="you">You</b> (${you === "w" ? "White" : "Black"}) `; a.append(cap(you !== "w"));
        const b = document.createElement("span"); b.innerHTML = `<b class="kinc"></b> `; b.querySelector("b").textContent = api.kinName(); b.append(cap(you === "w"));
        info.append(a, b);
        let txt = ""; S.moves.forEach((m, i) => { if (i % 2 === 0) txt += `${i / 2 + 1}. `; txt += m + " "; });
        list.textContent = txt.trim(); list.scrollTop = list.scrollHeight;
        if (!busy && !st.over && S.turn === you) api.status(st.check ? "Check! Your move." : "Your move.");
      }
      function feats(m, who) {
        if (m.c && m.p.toLowerCase() === "p" && m.c.toLowerCase() === "q") api.achieve("giant_slayer", who);
        if (S.b.filter((x) => x === (isW(m.p) ? "Q" : "q")).length >= 2) api.achieve("two_queens", who);
      }
      function finish() {
        const st = status(S); if (!st.over) return false;
        draw();
        const result = st.result === "draw" ? "draw" : st.result === you ? "you" : "kin";
        if (st.why === "checkmate" && Math.ceil(S.moves.length / 2) <= 20) api.achieve("swift_mate", result);
        api.over(result, `${st.why} after ${Math.ceil(S.moves.length / 2)} moves`);
        return true;
      }
      function tap(sq) {
        if (busy || dead || S.turn !== you || api.ended() || promoWait) return;
        const p = S.b[sq];
        if (sel >= 0) {
          const ms = legal(S).filter((m) => m.from === sel && m.to === sq);
          if (ms.length) {
            if (ms.length > 1) return askPromo(ms);
            return move(ms[0]);
          }
        }
        sel = p && isW(p) === (you === "w") ? (sel === sq ? -1 : sq) : -1;
        draw();
      }
      function askPromo(ms) {
        promoWait = ms; promo.textContent = ""; promo.hidden = false;
        for (const k of ["q", "r", "b", "n"]) {
          const b = document.createElement("button"); b.type = "button"; if (root.Kit && root.Kit.chessSVG) b.innerHTML = root.Kit.chessSVG(k, you === "w"); else b.textContent = GLYPH[k] + "︎"; b.setAttribute("aria-label", NAMES[k]);
          b.className = "pc " + (you === "w" ? "w" : "b"); b.style.pointerEvents = "auto";
          b.onclick = () => { promo.hidden = true; promoWait = null; move(ms.find((m) => m.promo === k)); };
          promo.append(b);
        }
      }
      function move(m) {
        sel = -1; S = play(S, m); feats(m, "you"); api.save(S); draw();
        if (!finish()) setTimeout(kinTurn, 30);
      }
      async function kinTurn() {
        if (dead || api.ended()) return;
        busy = true; api.status(`${api.kinName()} is thinking…`, true);
        await new Promise((r) => setTimeout(r, 30));
        const lvl = api.settings.level, r = ranked(S, lvl === "beginner" ? 1 : lvl === "easy" ? 2 : 3), mat = (() => { let t = 0; for (const p of S.b) if (p) t += (isW(p) === (you !== "w") ? 1 : -1) * VAL[p.toLowerCase()]; return t; })();
        const last = S.moves[S.moves.length - 1];
        const situation = `You play ${you === "w" ? "Black" : "White"}; your person plays ${you === "w" ? "White" : "Black"}. Moves so far: ${S.moves.slice(-30).join(" ") || "none, you move first"}. ${last ? "Their last move: " + last + "." : ""} Material: ${mat === 0 ? "even" : mat > 0 ? "you're ahead by about " + Math.round(mat / 100) + " pawns" : "you're behind by about " + Math.round(-mat / 100) + " pawns"}.${inCheck(S) ? " You are in check." : ""} Position (FEN): ${toFen(S)}`;
        const pick = await api.kinMove({ ranked: r, situation });
        if (dead || !pick) return;
        S = play(S, pick.m); feats(pick.m, "kin"); busy = false; api.save(S); draw();
        if (!finish() && api.settings.mode === "talk" && (pick.m.c || /\+/.test(pick.san))) api.line(`You just played ${pick.san}${pick.m.c ? ", taking a " + NAMES[pick.m.c.toLowerCase()] : ""}.`);
      }
      (async () => {
        S = api.state && api.state.b ? api.state : null;
        if (S) you = S.you;
        else { const first = await api.firstMover(); you = first === "you" ? "w" : "b"; S = fromFen(START); S.you = you; S.v = 1; api.save(S); }
        S.you = you; S.v = 1;
        draw();
        if (S.turn !== you) kinTurn(); else api.status(`Your move. You're ${you === "w" ? "White" : "Black"}.`);
      })();
      return { destroy() { dead = true; } };
    },
  });
})(typeof self !== "undefined" ? self : this);
