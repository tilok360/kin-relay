/* Kin Casino round controller: seats, chip stacks, bets and turns for one table.
   Pure state over a plain object T, shared by Solo on the screen and by the host app.
   Seat kinds: "person", "kin" (bets by its chosen style, free) and "bot" (computer, free). */
(function (root, make) {
  if (typeof module === "object" && module.exports) module.exports = make(require("./games.js"));
  else root.Table = make(root.Games);
})(this, function (Games) {
  "use strict";
  var START = 1000, LOG = 40;

  function create(game, opts) {
    opts = opts || {};
    return { game: game, start: opts.start || START, seats: [], persist: {}, log: [],
      round: { no: 1, phase: "bets", bets: {}, ready: {}, R: null, last: null } };
  }
  function G(T) { return Games.by[T.game]; }
  function find(T, id) { for (var i = 0; i < T.seats.length; i++) if (T.seats[i].id === id) return T.seats[i]; return null; }
  function say(T, text) { T.log.push(text); if (T.log.length > LOG) T.log.splice(0, T.log.length - LOG); }

  function addSeat(T, s) {
    if (find(T, s.id)) return find(T, s.id);
    var seat = { id: s.id, name: s.name, kind: s.kind || "person", owner: s.owner || "", style: s.style || "steady",
      lucky: s.lucky == null ? -1 : s.lucky, stack: s.stack == null ? T.start : s.stack, net: 0 };
    T.seats.push(seat); return seat;
  }
  // Leaving returns chips still on the felt this round (and standing craps bets).
  function removeSeat(T, id, rng) {
    var s = find(T, id); if (!s) return;
    var r = T.round;
    if (r.phase === "play" && r.R && !r.R.done && r.R.turn === id) act(T, id, G(T).fallback(r.R, id), rng);
    if (r.phase === "bets") unbet(T, id);
    var P = T.persist && T.persist.bets;
    if (P && P[id]) { s.stack += Games.total(P[id]); delete P[id]; }
    T.seats.splice(T.seats.indexOf(s), 1);
    delete r.ready[id];
  }
  function unbet(T, id) {
    var b = T.round.bets[id], s = find(T, id);
    if (b && s) s.stack += Games.total(b.bets);
    delete T.round.bets[id];
  }
  // Place (or replace) this round's bets. Returns "" or a short reason.
  function placeBets(T, id, bets, picks) {
    var g = G(T), s = find(T, id), r = T.round, sum = 0, clean = {};
    if (!s) return "not seated";
    if (r.phase !== "bets") return "bets are closed";
    bets = bets || {};
    for (var k in bets) {
      var a = Math.floor(+bets[k]);
      if (!a) continue;
      if (!g.spots[k]) return "unknown bet";
      if (g.allowed && !g.allowed(k, T.persist, id)) return g.spots[k].label + " is not open now";
      if (a < g.min || a > g.max) return "bets are " + g.min + " to " + g.max;
      if (g.step && g.step[k] && a % g.step[k]) return g.spots[k].label + " goes on in multiples of " + g.step[k];
      clean[k] = a; sum += a;
    }
    var have = s.stack + (r.bets[id] ? Games.total(r.bets[id].bets) : 0);
    if (sum > have) return "not enough chips";
    if (g.picks) {
      if (sum) {
        var seen = {};
        picks = (picks || []).map(Number).filter(function (x) {
          if (!(x >= 1 && x <= g.picks.n) || seen[x]) return false; seen[x] = 1; return true;
        });
        if (!picks.length || picks.length > g.picks.max) return "pick 1 to " + g.picks.max + " numbers";
      }
    } else picks = null;
    unbet(T, id);
    if (sum) { r.bets[id] = { bets: clean, picks: picks }; s.stack -= sum; }
    r.ready[id] = true;
    return "";
  }
  // Computer and Kin seats bet by their style; broke ones get a free refill first.
  function autoBets(T, rng) {
    var g = G(T);
    T.seats.forEach(function (s) {
      if (s.kind === "person" || T.round.ready[s.id]) return;
      if (s.stack < g.min) refill(T, s.id);
      var b = Games.autoBet(T.game, s.style, s.stack, T.persist, s.id, rng, s.lucky);
      if (!b || placeBets(T, s.id, b.bets, b.picks)) T.round.ready[s.id] = true;
    });
  }
  function refill(T, id) {
    var s = find(T, id); if (!s || s.stack >= START) return false;
    s.stack = START; say(T, s.name + " took a free refill to " + START + " chips"); return true;
  }
  function hasAction(T) {
    var P = T.persist && T.persist.bets;
    return Object.keys(T.round.bets).length > 0 || !!(P && Object.keys(P).some(function (id) { return find(T, id); }));
  }
  function allReady(T) {
    return T.seats.every(function (s) { return s.kind !== "person" || T.round.ready[s.id]; });
  }
  function startRound(T, rng) {
    var r = T.round, g = G(T);
    if (r.phase !== "bets" || !hasAction(T)) return false;
    var entries = T.seats.filter(function (s) { return r.bets[s.id]; })
      .map(function (s) { return { id: s.id, bets: r.bets[s.id].bets, picks: r.bets[s.id].picks }; });
    r.phase = "play";
    r.R = g.start(rng, entries, T.persist);
    r.R.no = r.no;
    run(T, rng);
    return true;
  }
  // Let computer and Kin seats take their turns until a person must act or the round ends.
  function run(T, rng) {
    var R = T.round.R, g = G(T), guard = 50;
    while (R && !R.done && R.turn && guard--) {
      var s = find(T, R.turn);
      if (s && s.kind === "person") return;
      act(T, R.turn, s ? g.decide(R, R.turn, s.stack) : g.fallback(R, R.turn), rng);
    }
    if (R && R.done && T.round.phase === "play") finish(T);
  }
  function options(T, id) {
    var R = T.round.R, s = find(T, id);
    if (!R || R.done || R.turn !== id || !s) return [];
    return G(T).options(R, id, s.stack);
  }
  function act(T, id, a, rng) {
    var R = T.round.R, s = find(T, id), g = G(T);
    if (!R || R.done || R.turn !== id) return "not your turn";
    var opts = g.options(R, id, s ? s.stack : 0);
    if (opts.indexOf(a) < 0) a = g.fallback(R, id);
    var rs = R.seats.filter(function (x) { return x.id === id; })[0], before = rs.extra;
    g.act(R, id, a, rng);
    if (s) s.stack -= rs.extra - before;
    if (s && s.kind !== "person") { /* computer turns continue below */ }
    run(T, rng);
    return "";
  }
  function finish(T) {
    var r = T.round, R = r.R;
    R.seats.forEach(function (x) {
      var s = find(T, x.id), net = x.back - x.stake - x.extra + Games.total(x.stay || {}) - (x.held || 0);
      x.net = net;
      if (!s) return;
      s.stack += x.back; s.net += net;
      if (net) say(T, s.name + (net > 0 ? " won " + net : " lost " + (-net)));
    });
    if (R.persist) T.persist = R.persist;
    r.phase = "done";
  }
  function nextRound(T) {
    var r = T.round;
    T.round = { no: r.no + 1, phase: "bets", bets: {}, ready: {}, R: null, last: r.R || r.last };
  }
  function switchGame(T, game) {
    if (!Games.by[game] || T.round.phase === "play") return false;
    T.seats.forEach(function (s) { unbet(T, s.id); });
    var P = T.persist && T.persist.bets;
    if (P) for (var id in P) { var s = find(T, id); if (s) s.stack += Games.total(P[id]); }
    T.game = game; T.persist = {};
    T.round = { no: T.round.no + 1, phase: "bets", bets: {}, ready: {}, R: null, last: null };
    return true;
  }
  // Timer ran out: people who have not bet sit this round out; a pending turn takes the safe default.
  function timeout(T, rng) {
    var r = T.round;
    if (r.phase === "bets") { T.seats.forEach(function (s) { r.ready[s.id] = true; }); return startRound(T, rng); }
    if (r.phase === "play" && r.R && !r.R.done && r.R.turn) { act(T, r.R.turn, G(T).fallback(r.R, r.R.turn), rng); return true; }
    return false;
  }
  function pub(T) {
    var g = G(T), c = JSON.parse(JSON.stringify(T)), R = c.round.R;
    if (R && g.hide) c.round.R = g.hide(R);
    if (R) delete c.round.R.deck;
    return c;
  }
  return { create: create, find: find, addSeat: addSeat, removeSeat: removeSeat, placeBets: placeBets, unbet: unbet,
    autoBets: autoBets, refill: refill, hasAction: hasAction, allReady: allReady, startRound: startRound, run: run,
    options: options, act: act, nextRound: nextRound, switchGame: switchGame, timeout: timeout, pub: pub, say: say, START: START };
});
