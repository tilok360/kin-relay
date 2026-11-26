// Kin Hold'em: moves played without asking a Kin, to save Kin requests (used by main.js).
const P = require("./screen/poker.js");

const rankNum = (c) => "23456789TJQKA".indexOf(String(c)[0]) + 2;
// Two unsuited, unpaired cards, three or more ranks apart, Jack high at best: 7-2, 9-4, J-6 ...
function junk(hole) {
  if (!Array.isArray(hole) || hole.length !== 2) return false;
  const [a, b] = hole.map(rankNum).sort((x, y) => y - x);
  return a !== b && hole[0][1] !== hole[1][1] && a - b >= 3 && a <= 11;
}
// A free check or a fold with junk before the flop, decided here. One time in five the Kin is still asked, so it can bluff.
function obviousMove(turn) {
  const L = turn.legal, v = turn.view;
  if ((v.board || []).length || !junk(turn.hole)) return null;
  if (L.canCheck) return { type: "check", to: 0, quick: true };
  if (Math.random() < 0.8) return { type: "fold", to: 0, quick: true };
  return null;
}
// Past the hourly cap: check when free; call modest bets with a decent hand; otherwise fold. Says nothing.
function steadyMove(turn) {
  const L = turn.legal, v = turn.view, board = v.board || [], hole = turn.hole || [];
  let good;
  if (!board.length) {
    const [a, b] = hole.map(rankNum).sort((x, y) => y - x);
    good = a === b || a >= 12 || (hole[0][1] === hole[1][1] && a - b <= 2);
  } else {
    // a pocket pair, a pair made with a hole card, or two pair or better
    const onBoard = board.map(rankNum), [h1, h2] = hole.map(rankNum);
    good = h1 === h2 || onBoard.includes(h1) || onBoard.includes(h2) || P.bestHand(hole.concat(board)).score[0] >= 2;
  }
  if (L.canCheck) return { type: "check", to: 0 };
  if (good && L.toCall <= Math.max(4 * (v.bb || 20), (v.pot || 0) / 2)) return { type: "call", to: 0 };
  return { type: "fold", to: 0 };
}

module.exports = { rankNum, junk, obviousMove, steadyMove };
