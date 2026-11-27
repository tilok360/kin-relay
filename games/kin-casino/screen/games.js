/* Kin Casino game engines. Shared by the screen (Solo) and the host app (tables).
   Every engine works on a round object R:
     start(rng, entries, persist) -> R    entries: [{id, bets:{spot:amount}, picks}]
     options(R, id, stack) -> actions for the seat whose turn it is (R.turn)
     act(R, id, action, rng)              may add to seat.extra (more chips at risk)
   When R.done, every seat has back (chips returned, stake included) and lines.
   rng(n) returns a fair whole number 0..n-1 (crypto on both sides). */
(function (root, make) {
  if (typeof module === "object" && module.exports) module.exports = make();
  else root.Games = make();
})(this, function () {
  "use strict";
  var RANKS = "23456789TJQKA";
  function rv(c) { return RANKS.indexOf(c[0]) + 2; }
  function shoe(rng, decks) {
    var d = [], k, i;
    for (k = 0; k < decks; k++) for (i = 0; i < 52; i++) d.push(RANKS[i % 13] + "shdc"[i / 13 | 0]);
    for (i = d.length - 1; i > 0; i--) { var j = rng(i + 1), t = d[i]; d[i] = d[j]; d[j] = t; }
    return d;
  }
  function dice(rng, n) { var a = []; while (a.length < n) a.push(1 + rng(6)); return a; }
  function sum(a) { var t = 0; for (var i = 0; i < a.length; i++) t += a[i]; return t; }
  function total(b) { var t = 0; for (var k in b) t += b[k]; return t; }
  function draw(rng, n, k) { // k distinct numbers from 1..n, in draw order
    var a = []; for (var i = 1; i <= n; i++) a.push(i);
    for (i = 0; i < k; i++) { var j = i + rng(n - i), t = a[i]; a[i] = a[j]; a[j] = t; }
    return a.slice(0, k);
  }
  function seatsOf(entries) {
    return entries.map(function (e) {
      return { id: e.id, bets: Object.assign({}, e.bets), picks: e.picks || null,
        stake: total(e.bets), extra: 0, back: 0, lines: [] };
    });
  }
  // mult is the total return per chip bet: 0 loses, 1 pushes, 2 pays 1:1, 36 pays 35:1.
  function pay(s, spot, mult, note) {
    var amt = s.bets[spot]; if (!amt) return;
    var back = Math.floor(amt * mult + 1e-9);
    s.back += back; s.lines.push({ spot: spot, amt: amt, back: back, note: note || "" });
  }
  function seat(R, id) { for (var i = 0; i < R.seats.length; i++) if (R.seats[i].id === id) return R.seats[i]; return null; }
  function nextTurn(R) {
    R.turn = null;
    for (var i = 0; i < R.seats.length; i++) if (!R.seats[i].fin) { R.turn = R.seats[i].id; return true; }
    return false;
  }
  function oneShot(R) { R.done = true; R.turn = null; return R; }
  function spotsFrom(list) { var o = {}; list.forEach(function (s) { o[s[0]] = { id: s[0], label: s[1], pays: s[2] }; }); return o; }

  /* ---------------- Roulette (European, single zero) ---------------- */
  var RED = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  var WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
  function colorOf(n) { return n === 0 ? "green" : RED.indexOf(n) >= 0 ? "red" : "black"; }
  var rlList = [];
  for (var n = 0; n <= 36; n++) rlList.push(["n" + n, String(n), "35:1"]);
  rlList.push(["red", "Red", "1:1"], ["black", "Black", "1:1"], ["odd", "Odd", "1:1"], ["even", "Even", "1:1"],
    ["low", "1–18", "1:1"], ["high", "19–36", "1:1"], ["d1", "1st 12", "2:1"], ["d2", "2nd 12", "2:1"], ["d3", "3rd 12", "2:1"],
    ["c1", "Col 1", "2:1"], ["c2", "Col 2", "2:1"], ["c3", "Col 3", "2:1"]);
  function rlWins(spot, n) {
    if (spot[0] === "n") return +spot.slice(1) === n ? 36 : 0;
    if (n === 0) return 0;
    switch (spot) {
      case "red": return colorOf(n) === "red" ? 2 : 0;
      case "black": return colorOf(n) === "black" ? 2 : 0;
      case "odd": return n % 2 ? 2 : 0;
      case "even": return n % 2 ? 0 : 2;
      case "low": return n <= 18 ? 2 : 0;
      case "high": return n >= 19 ? 2 : 0;
    }
    if (spot[0] === "d") return Math.ceil(n / 12) === +spot[1] ? 3 : 0;
    if (spot[0] === "c") return ((n - 1) % 3) + 1 === +spot[1] ? 3 : 0;
    return 0;
  }
  var roulette = {
    id: "roulette", name: "Roulette", kind: "wheel", min: 5, max: 500,
    about: "European wheel, one zero. Straight up pays 35:1, dozens and columns 2:1, red/black, odd/even and 1–18/19–36 pay 1:1. Zero loses outside bets.",
    spots: spotsFrom(rlList),
    start: function (rng, entries) {
      var R = { seats: seatsOf(entries), n: rng(37) };
      R.color = colorOf(R.n);
      R.seats.forEach(function (s) { for (var k in s.bets) pay(s, k, rlWins(k, R.n)); });
      return oneShot(R);
    }
  };

  /* ---------------- Craps ---------------- */
  var crList = [["pass", "Pass Line", "1:1"], ["dpass", "Don't Pass", "1:1"], ["odds", "Pass Odds", "true odds"],
    ["field", "Field", "1:1, 2 pays 2:1, 12 pays 3:1"], ["p6", "Place 6", "7:6"], ["p8", "Place 8", "7:6"],
    ["any7", "Any 7", "4:1"], ["craps", "Any Craps", "7:1"], ["yo", "Eleven", "15:1"]];
  var ODDS = { 4: 3, 10: 3, 5: 2.5, 9: 2.5, 6: 2.2, 8: 2.2 };
  var craps = {
    id: "craps", name: "Craps", kind: "dice", min: 5, max: 500, standing: true,
    about: "Pass and Don't Pass on the come-out roll, then odds at true odds once a point is set. Field, Place 6/8 (7:6) and one-roll Any 7, Any Craps and Eleven.",
    spots: spotsFrom(crList), step: { p6: 6, p8: 6 }, // place 6 and 8 go on in sixes so 7:6 pays whole chips
    // Which spots can take new chips right now (line bets only on the come-out, odds only behind a pass bet).
    allowed: function (spot, P, id) {
      P = P || {}; var mine = (P.bets || {})[id] || {};
      if (spot === "pass" || spot === "dpass") return !P.point;
      if (spot === "odds") return !!P.point && !!mine.pass;
      return !!this.spots[spot];
    },
    start: function (rng, entries, P) {
      P = P || {}; var point = P.point || 0, standing = P.bets || {}, ids = {};
      entries.forEach(function (e) { ids[e.id] = e; });
      Object.keys(standing).forEach(function (id) { if (!ids[id]) ids[id] = { id: id, bets: {} }; });
      var R = { seats: [], dice: dice(rng, 2), was: point }, t = R.dice[0] + R.dice[1], keep = {};
      Object.keys(ids).forEach(function (id) {
        var e = ids[id], b = Object.assign({}, standing[id] || {});
        for (var k in e.bets) b[k] = (b[k] || 0) + e.bets[k];
        var s = { id: id, bets: b, picks: null, stake: total(e.bets), held: total(standing[id] || {}), extra: 0, back: 0, lines: [] }, stay = {};
        function hold(k) { if (b[k]) stay[k] = b[k]; }
        pay(s, "field", t === 2 ? 3 : t === 12 ? 4 : [3, 4, 9, 10, 11].indexOf(t) >= 0 ? 2 : 0);
        pay(s, "any7", t === 7 ? 5 : 0); pay(s, "craps", [2, 3, 12].indexOf(t) >= 0 ? 8 : 0); pay(s, "yo", t === 11 ? 16 : 0);
        ["p6", "p8"].forEach(function (k) {
          var num = +k[1];
          if (t === num) pay(s, k, 1 + 7 / 6, "hit"); else if (t === 7) pay(s, k, 0); else hold(k);
        });
        if (!point) {
          if (t === 7 || t === 11) { pay(s, "pass", 2); pay(s, "dpass", 0); }
          else if (t === 2 || t === 3) { pay(s, "pass", 0); pay(s, "dpass", 2); }
          else if (t === 12) { pay(s, "pass", 0); pay(s, "dpass", 1, "bar 12"); }
          else { hold("pass"); hold("dpass"); }
          if (b.odds) { pay(s, "odds", 1, "no point"); }
        } else if (t === point) { pay(s, "pass", 2); pay(s, "odds", ODDS[point]); pay(s, "dpass", 0); }
        else if (t === 7) { pay(s, "pass", 0); pay(s, "odds", 0); pay(s, "dpass", 2); }
        else { hold("pass"); hold("dpass"); hold("odds"); }
        if (Object.keys(stay).length) keep[id] = stay;
        s.stay = stay;
        R.seats.push(s);
      });
      var np = !point ? ([4, 5, 6, 8, 9, 10].indexOf(t) >= 0 ? t : 0) : (t === point || t === 7 ? 0 : point);
      R.point = np;
      R.persist = { point: np, bets: keep };
      return oneShot(R);
    }
  };

  /* ---------------- Baccarat (Punto Banco) ---------------- */
  function bv(c) { var r = rv(c); return r === 14 ? 1 : r >= 10 ? 0 : r; }
  function bt(h) { return sum(h.map(bv)) % 10; }
  var baccarat = {
    id: "baccarat", name: "Baccarat", kind: "cards", min: 5, max: 500,
    about: "Punto Banco from an 8-deck shoe, standard third-card rules. Player pays 1:1, Banker 1:1 less 5% commission, Tie 8:1 (Player and Banker push on a tie).",
    spots: spotsFrom([["player", "Player", "1:1"], ["banker", "Banker", "0.95:1"], ["tie", "Tie", "8:1"]]),
    start: function (rng, entries) {
      var d = shoe(rng, 8), p = [d.pop(), d.pop()], b = [d.pop(), d.pop()], p3 = null;
      if (bt(p) < 8 && bt(b) < 8) {
        if (bt(p) <= 5) { p3 = d.pop(); p.push(p3); }
        var bs = bt(b), x = p3 ? bv(p3) : -1, draws;
        if (!p3) draws = bs <= 5;
        else draws = bs <= 2 || (bs === 3 && x !== 8) || (bs === 4 && x >= 2 && x <= 7) ||
          (bs === 5 && x >= 4 && x <= 7) || (bs === 6 && (x === 6 || x === 7));
        if (draws) b.push(d.pop());
      }
      var R = { seats: seatsOf(entries), player: p, banker: b, pt: bt(p), bt: bt(b) };
      R.win = R.pt > R.bt ? "player" : R.bt > R.pt ? "banker" : "tie";
      R.seats.forEach(function (s) {
        pay(s, "tie", R.win === "tie" ? 9 : 0);
        pay(s, "player", R.win === "player" ? 2 : R.win === "tie" ? 1 : 0);
        // Banker wins pay 1:1 less 5% commission, rounded to the nearest chip (exact halves round down).
        if (s.bets.banker && R.win === "banker") pay(s, "banker", 1 + Math.ceil(s.bets.banker * 0.95 - 0.5) / s.bets.banker, "less 5%");
        else pay(s, "banker", R.win === "tie" ? 1 : 0);
      });
      return oneShot(R);
    }
  };

  /* ---------------- Casino War ---------------- */
  var war = {
    id: "war", name: "Casino War", kind: "cards", min: 5, max: 500, decisions: true,
    about: "Your card against the dealer's, aces high, 1:1. On a tie go to war (match your bet: a win pays the raise and the first bet pushes) or surrender half. Tie side bet pays 10:1.",
    spots: spotsFrom([["bet", "War bet", "1:1"], ["tie", "Tie bet", "10:1"]]),
    start: function (rng, entries) {
      var d = shoe(rng, 6), R = { seats: seatsOf(entries), dealer: d.pop() };
      R.deck = d;
      R.seats.forEach(function (s) {
        s.card = d.pop();
        var a = rv(s.card), b = rv(R.dealer);
        pay(s, "tie", a === b ? 11 : 0);
        if (!s.bets.bet || a !== b) { pay(s, "bet", a > b ? 2 : 0); s.fin = true; }
      });
      if (!nextTurn(R)) { delete R.deck; oneShot(R); }
      return R;
    },
    options: function (R, id, stack) { var s = seat(R, id); return stack >= s.bets.bet ? ["war", "surrender"] : ["surrender"]; },
    act: function (R, id, a) {
      var s = seat(R, id), d = R.deck;
      if (a === "war") {
        s.extra = s.bets.bet; d.pop(); d.pop(); d.pop();
        s.war = [d.pop(), d.pop()]; // [yours, dealer's]
        var win = rv(s.war[0]) >= rv(s.war[1]);
        s.back += win ? s.bets.bet + 2 * s.extra : 0;
        s.lines.push({ spot: "bet", amt: s.bets.bet + s.extra, back: win ? s.bets.bet + 2 * s.extra : 0, note: "war" });
      } else { s.back += Math.floor(s.bets.bet / 2); s.lines.push({ spot: "bet", amt: s.bets.bet, back: Math.floor(s.bets.bet / 2), note: "surrender" }); }
      s.fin = true; s.did = a;
      if (!nextTurn(R)) { delete R.deck; oneShot(R); }
    },
    decide: function () { return "war"; },
    fallback: function () { return "surrender"; }
  };

  /* ---------------- Red Dog ---------------- */
  var SPREAD = { 1: 6, 2: 5, 3: 3 };
  var reddog = {
    id: "reddog", name: "Red Dog", kind: "cards", min: 5, max: 500, decisions: true,
    about: "Two cards are dealt. Bet the third lands between them. Spread 1 pays 5:1, 2 pays 4:1, 3 pays 2:1, 4+ pays 1:1. You may raise up to your bet. Consecutive cards push; a pair draws a third card and three of a kind pays 11:1.",
    spots: spotsFrom([["bet", "Red Dog bet", "by spread"]]),
    start: function (rng, entries) {
      var d = shoe(rng, 6), R = { seats: seatsOf(entries), cards: [d.pop(), d.pop()] };
      var a = rv(R.cards[0]), b = rv(R.cards[1]);
      R.deck = d;
      if (a === b) {
        R.cards.push(d.pop()); var trip = rv(R.cards[2]) === a;
        R.seats.forEach(function (s) { pay(s, "bet", trip ? 12 : 1, trip ? "three of a kind" : "pair pushes"); s.fin = true; });
      } else if (Math.abs(a - b) === 1) {
        R.spread = 0; R.seats.forEach(function (s) { pay(s, "bet", 1, "consecutive pushes"); s.fin = true; });
      } else R.spread = Math.abs(a - b) - 1;
      if (!nextTurn(R)) { delete R.deck; oneShot(R); }
      return R;
    },
    options: function (R, id, stack) { var s = seat(R, id); return stack >= s.bets.bet ? ["raise", "stay"] : ["stay"]; },
    act: function (R, id, a) {
      var s = seat(R, id); if (a === "raise") s.extra = s.bets.bet;
      s.fin = true; s.did = a;
      if (nextTurn(R)) return;
      R.cards.push(R.deck.pop()); delete R.deck;
      var lo = Math.min(rv(R.cards[0]), rv(R.cards[1])), hi = Math.max(rv(R.cards[0]), rv(R.cards[1])), c = rv(R.cards[2]);
      var m = c > lo && c < hi ? (SPREAD[R.spread] || 2) : 0;
      R.seats.forEach(function (s) {
        var amt = s.bets.bet + s.extra, back = amt * m;
        s.back += back; s.lines.push({ spot: "bet", amt: amt, back: back, note: m ? "in between" : "outside" });
      });
      oneShot(R);
    },
    decide: function (R) { return R.spread >= 7 ? "raise" : "stay"; },
    fallback: function () { return "stay"; }
  };

  /* ---------------- Blackjack (kept simple) ---------------- */
  function bjTotal(h) {
    var t = 0, aces = 0;
    h.forEach(function (c) { var r = rv(c); if (r === 14) { aces++; t += 11; } else t += r > 10 ? 10 : r; });
    while (t > 21 && aces) { t -= 10; aces--; }
    return { t: t, soft: aces > 0 };
  }
  function isBJ(h) { return h.length === 2 && bjTotal(h).t === 21; }
  function bjFinish(R) {
    var d = R.deck, live = R.seats.some(function (s) { return !s.bust && !s.bj; });
    if (live && !R.dealerBJ) while (bjTotal(R.dealer).t < 17) R.dealer.push(d.pop());
    var dt = bjTotal(R.dealer).t, dBust = dt > 21;
    R.seats.forEach(function (s) {
      var amt = s.bets.bet + s.extra, t = bjTotal(s.hand).t, m, note;
      if (R.dealerBJ) { m = s.bj ? 1 : 0; note = s.bj ? "push" : "dealer blackjack"; }
      else if (s.bj) { m = 2.5; note = "blackjack 3:2"; }
      else if (s.bust) { m = 0; note = "bust"; }
      else if (dBust || t > dt) { m = 2; note = "win"; }
      else if (t === dt) { m = 1; note = "push"; }
      else { m = 0; note = "dealer wins"; }
      var back = Math.round(amt * m); s.back += back; // 3:2 on an odd bet rounds up to the next chip s.lines.push({ spot: "bet", amt: amt, back: back, note: note });
    });
    R.dt = dt; delete R.deck; oneShot(R);
  }
  var blackjack = {
    id: "blackjack", name: "Blackjack", kind: "cards", min: 5, max: 500, decisions: true,
    about: "Six decks. Hit, stand or double on your first two cards. Dealer stands on all 17s and checks for blackjack. Blackjack pays 3:2, wins 1:1. No splits or insurance in this simple version.",
    spots: spotsFrom([["bet", "Bet", "1:1, blackjack 3:2"]]),
    start: function (rng, entries) {
      var d = shoe(rng, 6), R = { seats: seatsOf(entries), dealer: [] };
      R.deck = d;
      R.seats.forEach(function (s) { s.hand = [d.pop()]; });
      R.dealer.push(d.pop());
      R.seats.forEach(function (s) { s.hand.push(d.pop()); s.bj = isBJ(s.hand); s.fin = s.bj; });
      R.dealer.push(d.pop());
      var up = rv(R.dealer[0]);
      if ((up === 14 || up >= 10) && isBJ(R.dealer)) { R.dealerBJ = true; bjFinish(R); return R; }
      if (!nextTurn(R)) bjFinish(R);
      return R;
    },
    options: function (R, id, stack) {
      var s = seat(R, id), o = ["hit", "stand"];
      if (s.hand.length === 2 && stack >= s.bets.bet) o.push("double");
      return o;
    },
    act: function (R, id, a) {
      var s = seat(R, id);
      if (a === "hit" || a === "double") {
        s.hand.push(R.deck.pop());
        if (a === "double") { s.extra = s.bets.bet; s.fin = true; s.doubled = true; }
        var t = bjTotal(s.hand).t;
        if (t > 21) { s.bust = true; s.fin = true; } else if (t === 21) s.fin = true;
      } else s.fin = true;
      if (s.fin && !nextTurn(R)) bjFinish(R);
    },
    // Basic strategy, simplified for hit/stand/double.
    decide: function (R, id, stack) {
      var s = seat(R, id), h = bjTotal(s.hand), up = rv(R.dealer[0]), u = up === 14 ? 11 : up > 10 ? 10 : up;
      var can = s.hand.length === 2 && stack >= s.bets.bet;
      if (h.soft) {
        if (can && h.t >= 15 && h.t <= 18 && u >= 4 && u <= 6) return "double";
        if (h.t >= 19 || (h.t === 18 && u <= 8)) return "stand";
        return "hit";
      }
      if (can && (h.t === 11 || (h.t === 10 && u <= 9) || (h.t === 9 && u >= 3 && u <= 6))) return "double";
      if (h.t >= 17) return "stand";
      if (h.t >= 13 && u <= 6) return "stand";
      if (h.t === 12 && u >= 4 && u <= 6) return "stand";
      return "hit";
    },
    fallback: function () { return "stand"; },
    hide: function (R) { if (R.done) return R; var c = Object.assign({}, R); c.dealer = [R.dealer[0], null]; delete c.deck; return c; },
    total: bjTotal
  };

  /* ---------------- Sic Bo ---------------- */
  var TOT = { 4: 60, 17: 60, 5: 30, 16: 30, 6: 17, 15: 17, 7: 12, 14: 12, 8: 8, 13: 8, 9: 6, 12: 6, 10: 6, 11: 6 };
  var sbList = [["small", "Small 4–10", "1:1"], ["big", "Big 11–17", "1:1"], ["odd", "Odd", "1:1"], ["even", "Even", "1:1"], ["triple", "Any triple", "30:1"]];
  for (n = 4; n <= 17; n++) sbList.push(["t" + n, String(n), TOT[n] + ":1"]);
  for (n = 1; n <= 6; n++) sbList.push(["s" + n, "Single " + n, "1:1, 2:1, 3:1"]);
  var sicbo = {
    id: "sicbo", name: "Sic Bo", kind: "dice", min: 5, max: 500,
    about: "Three dice. Small and Big pay 1:1 (they lose on any triple), totals pay 6:1 to 60:1, a single number pays 1:1 per die showing it, any triple pays 30:1.",
    spots: spotsFrom(sbList),
    start: function (rng, entries) {
      var R = { seats: seatsOf(entries), dice: dice(rng, 3) }, d = R.dice, t = sum(d), trip = d[0] === d[1] && d[1] === d[2];
      R.seats.forEach(function (s) {
        for (var k in s.bets) {
          var m = 0;
          if (k === "small") m = !trip && t <= 10 ? 2 : 0;
          else if (k === "big") m = !trip && t >= 11 ? 2 : 0;
          else if (k === "odd") m = !trip && t % 2 ? 2 : 0;
          else if (k === "even") m = !trip && t % 2 === 0 ? 2 : 0;
          else if (k === "triple") m = trip ? 31 : 0;
          else if (k[0] === "t") m = +k.slice(1) === t ? TOT[t] + 1 : 0;
          else if (k[0] === "s") { var c = d.filter(function (x) { return x === +k[1]; }).length; m = c ? 1 + c : 0; }
          pay(s, k, m);
        }
      });
      return oneShot(R);
    }
  };

  /* ---------------- Chuck-a-Luck ---------------- */
  var calList = []; for (n = 1; n <= 6; n++) calList.push(["c" + n, String(n), "1:1, 2:1, 10:1"]);
  var chuck = {
    id: "chuck", name: "Chuck-a-Luck", kind: "dice", min: 5, max: 500,
    about: "Pick a number and three dice tumble in the birdcage. One match pays 1:1, two pay 2:1, three pay 10:1.",
    spots: spotsFrom(calList),
    start: function (rng, entries) {
      var R = { seats: seatsOf(entries), dice: dice(rng, 3) };
      R.seats.forEach(function (s) {
        for (var k in s.bets) {
          var c = R.dice.filter(function (x) { return x === +k[1]; }).length;
          pay(s, k, c === 3 ? 11 : c ? 1 + c : 0);
        }
      });
      return oneShot(R);
    }
  };

  /* ---------------- Big Six money wheel ---------------- */
  // 54 segments: 24 x 1, 15 x 2, 7 x 5, 4 x 10, 2 x 20, star 40, moon 40.
  var B6 = [1, 2, 1, 5, 1, 2, 1, 10, 1, 2, 1, 5, 1, 2, 1, 20, 1, 2, 1, 5, 1, 2, 1, "star", 1, 2, 1, 10, 2, 5, 1, 2, 1, 10, 1, 2, 1, 20, 1, 2, 1, 5, 1, 2, 1, 10, 2, 5, 1, 2, 1, "moon", 2, 5];
  var big6 = {
    id: "big6", name: "Big Six Wheel", kind: "wheel", min: 5, max: 500,
    about: "A 54-segment money wheel. Bet a symbol: 1 pays 1:1, 2 pays 2:1, 5 pays 5:1, 10 pays 10:1, 20 pays 20:1, Star and Moon pay 40:1.",
    spots: spotsFrom([["w1", "1", "1:1"], ["w2", "2", "2:1"], ["w5", "5", "5:1"], ["w10", "10", "10:1"], ["w20", "20", "20:1"], ["wstar", "Star", "40:1"], ["wmoon", "Moon", "40:1"]]),
    segs: B6,
    start: function (rng, entries) {
      var R = { seats: seatsOf(entries), i: rng(B6.length) }, v = B6[R.i];
      R.v = v;
      R.seats.forEach(function (s) {
        for (var k in s.bets) pay(s, k, k.slice(1) === String(v) ? (typeof v === "number" ? v : 40) + 1 : 0);
      });
      return oneShot(R);
    }
  };

  /* ---------------- Slots ---------------- */
  // One weighted strip used on all three reels. Pays are total return per chip (x).
  var SYM = ["cherry", "lemon", "bell", "star", "bar", "seven", "gem"];
  var WT = [7, 10, 6, 5, 3, 2, 1];
  var THREE = { gem: 500, seven: 100, bar: 50, star: 25, bell: 15, lemon: 8, cherry: 10 };
  function slotPay(r) {
    if (r[0] === r[1] && r[1] === r[2]) return THREE[r[0]];
    var ch = r.filter(function (x) { return x === "cherry"; }).length;
    return ch === 2 ? 3 : ch === 1 && r[0] === "cherry" ? 1 : 0;
  }
  function spinReel(rng) { var x = rng(sum(WT)), i = 0; while (x >= WT[i]) x -= WT[i++]; return SYM[i]; }
  var slots = {
    id: "slots", name: "Slots", kind: "slots", min: 1, max: 100, solo: true,
    about: "Three reels. Three gems pay 500x, sevens 100x, bars 50x, stars 25x, bells 15x, cherries 10x, lemons 8x; two cherries pay 3x and a cherry on the first reel returns your bet. About 95% return.",
    spots: spotsFrom([["spin", "Spin", "see paytable"]]),
    sym: SYM, three: THREE, weights: WT, pays: slotPay,
    start: function (rng, entries) {
      var R = { seats: seatsOf(entries) };
      R.seats.forEach(function (s) { s.reels = [spinReel(rng), spinReel(rng), spinReel(rng)]; pay(s, "spin", slotPay(s.reels)); });
      return oneShot(R);
    }
  };

  /* ---------------- Keno ---------------- */
  // KENO[picks][catches] = total return per chip.
  var KENO = {
    1: { 1: 3 }, 2: { 2: 12 }, 3: { 2: 1, 3: 42 }, 4: { 2: 1, 3: 4, 4: 120 },
    5: { 3: 2, 4: 15, 5: 750 }, 6: { 3: 1, 4: 5, 5: 70, 6: 1500 },
    7: { 3: 1, 4: 2, 5: 18, 6: 380, 7: 5000 }, 8: { 5: 10, 6: 90, 7: 1500, 8: 10000 },
    9: { 4: 1, 5: 5, 6: 40, 7: 300, 8: 4000, 9: 10000 }, 10: { 0: 2, 5: 2, 6: 20, 7: 130, 8: 1000, 9: 5000, 10: 10000 }
  };
  var keno = {
    id: "keno", name: "Keno", kind: "balls", min: 1, max: 100, picks: { n: 80, max: 10 },
    about: "Pick 1 to 10 numbers from 80. Twenty balls are drawn; the more you catch, the more you win, by the paytable for your number of picks.",
    spots: spotsFrom([["ticket", "Ticket", "by paytable"]]), table: KENO,
    start: function (rng, entries) {
      var R = { seats: seatsOf(entries), drawn: draw(rng, 80, 20) };
      R.seats.forEach(function (s) {
        var p = (s.picks || []).slice(0, 10), hit = p.filter(function (x) { return R.drawn.indexOf(x) >= 0; }).length;
        s.hits = hit; pay(s, "ticket", p.length ? (KENO[p.length][hit] || 0) : 0, hit + " of " + p.length);
      });
      return oneShot(R);
    }
  };

  /* ---------------- Bingo (75-ball) ---------------- */
  var BALLS = 30, BINGO = { 1: 5, 2: 12, 3: 60, 4: 300 }; // lines -> total return per chip (4 or more lines pay 100x)
  function bingoCard(rng) {
    var c = [];
    for (var col = 0; col < 5; col++) c.push(draw(rng, 15, 5).map(function (x) { return x + col * 15; }));
    c[2][2] = 0; // free space
    return c; // c[col][row]
  }
  function bingoLines(c, drawn) {
    var m = function (col, row) { var v = c[col][row]; return v === 0 || drawn.indexOf(v) >= 0; }, L = 0, i, j, ok;
    for (i = 0; i < 5; i++) {
      for (ok = true, j = 0; j < 5; j++) ok = ok && m(i, j); if (ok) L++;
      for (ok = true, j = 0; j < 5; j++) ok = ok && m(j, i); if (ok) L++;
    }
    for (ok = true, j = 0; j < 5; j++) ok = ok && m(j, j); if (ok) L++;
    for (ok = true, j = 0; j < 5; j++) ok = ok && m(j, 4 - j); if (ok) L++;
    return L;
  }
  var bingo = {
    id: "bingo", name: "Bingo", kind: "balls", min: 1, max: 100,
    about: "A 75-ball card with a free center. Thirty balls are called. One line pays 5x, two lines 12x, three 60x, four or more 300x (row, column or diagonal).",
    spots: spotsFrom([["card", "Card", "by lines"]]), balls: BALLS, table: BINGO, lines: bingoLines, card: bingoCard,
    start: function (rng, entries) {
      var R = { seats: seatsOf(entries), drawn: draw(rng, 75, BALLS) };
      R.seats.forEach(function (s) {
        s.card = bingoCard(rng); s.lines2 = bingoLines(s.card, R.drawn);
        pay(s, "card", BINGO[Math.min(4, s.lines2)] || 0, s.lines2 + " lines");
      });
      return oneShot(R);
    }
  };

  /* ---------------- Scratch cards ---------------- */
  // Odds per ticket of each prize (total return per chip); everything else loses. About 65% return.
  var PRIZES = [[1000, 100000], [100, 2500], [20, 250], [5, 40], [3, 30], [2, 12], [1, 8]];
  var SCR_SYM = ["coin", "clover", "horseshoe", "star", "bell", "gem", "crown"];
  function ticket(rng) {
    var x = rng(100000) / 100000, acc = 0, prize = 0, cells = [], i;
    for (i = 0; i < PRIZES.length; i++) { acc += 1 / PRIZES[i][1]; if (x < acc) { prize = PRIZES[i][0]; break; } }
    var symbolFor = function (p) { return SCR_SYM[PRIZES.findIndex(function (q) { return q[0] === p; })]; };
    var others = SCR_SYM.slice(), count = {};
    if (prize) { var w = symbolFor(prize); cells = [w, w, w]; others.splice(others.indexOf(w), 1); count[w] = 3; }
    while (cells.length < 9) {
      var s = others[rng(others.length)];
      if ((count[s] || 0) < 2) { cells.push(s); count[s] = (count[s] || 0) + 1; }
    }
    for (i = cells.length - 1; i > 0; i--) { var j = rng(i + 1), t = cells[i]; cells[i] = cells[j]; cells[j] = t; }
    return { cells: cells, prize: prize };
  }
  var scratch = {
    id: "scratch", name: "Scratch Cards", kind: "scratch", min: 1, max: 50, solo: true,
    about: "Scratch nine spots. Three matching symbols win that symbol's prize: crown 1x, gem 2x, bell 3x, star 5x, horseshoe 20x, clover 100x, coin 1000x. Every ticket is decided when it is bought.",
    spots: spotsFrom([["ticket", "Ticket", "match three"]]), prizes: PRIZES, sym: SCR_SYM, ticket: ticket,
    start: function (rng, entries) {
      var R = { seats: seatsOf(entries) };
      R.seats.forEach(function (s) { var t = ticket(rng); s.cells = t.cells; s.prize = t.prize; pay(s, "ticket", t.prize); });
      return oneShot(R);
    }
  };

  var LIST = [blackjack, roulette, craps, baccarat, war, reddog, sicbo, big6, chuck, slots, keno, bingo, scratch];
  var BY = {}; LIST.forEach(function (g) { BY[g.id] = g; });

  /* ---------------- Computer and Kin betting styles (free, no Kin calls) ---------------- */
  var STYLES = {
    careful: { unit: 10, say: "plays it safe" },
    steady: { unit: 25, say: "bets steady" },
    bold: { unit: 50, say: "chases big payouts" }
  };
  var SAFE = { roulette: ["red", "black", "odd", "even", "low", "high"], craps: ["pass", "dpass"], baccarat: ["banker", "player"],
    sicbo: ["small", "big"], big6: ["w1", "w2"], chuck: ["c1", "c2", "c3", "c4", "c5", "c6"] };
  var WILD = { roulette: ["d1", "d2", "d3", "c1", "c2", "c3"], craps: ["field", "p6", "p8", "any7", "yo"], baccarat: ["tie", "banker"],
    sicbo: ["t9", "t10", "t11", "t12", "s1", "s6", "triple"], big6: ["w5", "w10", "w20", "wstar"], war: ["tie"] };
  function autoBet(gid, style, stack, P, id, rng, lucky) {
    var g = BY[gid], st = STYLES[style] || STYLES.steady, unit = Math.max(g.min, Math.min(g.max, gid === "slots" || gid === "scratch" || gid === "keno" || gid === "bingo" ? st.unit / 5 : st.unit));
    if (stack < g.min) return null;
    unit = Math.min(unit, stack); var bets = {}, picks = null, pick = function (a) { return a[rng(a.length)]; };
    if (gid === "craps") {
      var mine = (P && P.bets && P.bets[id]) || {};
      if (!P || !P.point) bets[style === "careful" ? "pass" : pick(SAFE.craps.concat(["pass", "pass"]))] = unit;
      else if (mine.pass && !mine.odds && stack >= unit * 2) bets.odds = unit;
      else if (style === "bold") bets[pick(WILD.craps)] = Math.min(unit, stack);
      else if (style === "steady" && rng(2)) bets[pick(["p6", "p8"])] = Math.min(unit, stack);
      else return {};
      ["p6", "p8"].forEach(function (k) { if (bets[k]) bets[k] = Math.max(6, Math.floor(bets[k] / 6) * 6); });
    } else if (gid === "keno") {
      picks = draw(rng, 80, style === "bold" ? 8 : style === "careful" ? 4 : 6);
      if (lucky >= 1 && lucky <= 80 && picks.indexOf(lucky) < 0) picks[0] = lucky;
      bets.ticket = unit;
    } else if (!SAFE[gid] && !WILD[gid] || gid === "war") {
      bets[Object.keys(g.spots)[0]] = unit;
      if (gid === "war" && style === "bold" && stack >= unit * 2) bets.tie = Math.max(g.min, unit / 5 | 0);
    } else if (gid === "roulette" && lucky >= 0 && lucky <= 36 && style !== "careful") {
      bets["n" + lucky] = Math.max(g.min, unit / 5 | 0);
      if (stack >= unit * 2) bets[pick(SAFE.roulette)] = unit;
    } else bets[pick(style === "bold" && WILD[gid] ? WILD[gid] : SAFE[gid])] = unit;
    return { bets: bets, picks: picks };
  }

  return { list: LIST, by: BY, styles: STYLES, autoBet: autoBet, total: total,
    util: { rv: rv, shoe: shoe, colorOf: colorOf, wheel: WHEEL, bjTotal: bjTotal, bv: bv, bt: bt, draw: draw } };
});
