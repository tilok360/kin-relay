// Free Solo play: you against 1 to 5 computer players, run entirely inside this screen. It uses Poker (rules) and
// Bots (the opponents), makes no Kin request, starts no app run and writes no file: nothing here can use credits.
const Solo = (() => {
  let S = null, timer = 0, onChange = () => {};
  const rm = () => !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) || window.NOMOTION;
  const seat = (id) => S.seats.find((s) => s.id === id);
  const running = () => !!(S && S.hand && S.hand.street !== "done");

  function start(o) {
    clearTimeout(timer);
    const bots = Bots.roster(o.n, o.level, o.mix);
    S = { sb: o.sb, bb: o.bb, chips: o.chips, level: o.level, handNo: 0, buttonId: "", hand: null, ach: {}, achNew: [], log: [], result: null,
      seats: [{ id: "me", owner: "me", kind: "person", name: o.name || "You", stack: o.chips }].concat(bots.map((b, i) => ({ id: "b" + i, owner: "cpu", kind: "bot", name: b.name, style: b.style, level: b.level, stack: o.chips }))) };
    onChange(S);
  }
  function deal() {
    if (!S || running()) return;
    for (const b of S.seats) if (b.kind === "bot" && b.stack === 0) { b.stack = S.chips; S.log.push(`${b.name} buys back in for ${S.chips}.`); }
    const ready = S.seats.filter((s) => s.stack > 0);
    if (ready.length < 2 || seat("me").stack === 0) return;
    const order = S.seats.map((s) => s.id), prev = order.indexOf(S.buttonId);
    let btn = ready[0].id;
    for (let k = 1; k <= order.length; k++) { const s = S.seats[(Math.max(prev, -1) + k) % order.length]; if (s.stack > 0) { btn = s.id; break; } }
    S.buttonId = btn; S.handNo++; S.result = null; S.achNew = []; S.log = [];
    S.hand = Poker.startHand({ seats: S.seats, buttonId: btn, sb: S.sb, bb: S.bb, no: S.handNo });
    S.log = S.hand.log.slice();
    step();
  }
  // After every move: pay out a finished hand, or let the next computer player think, or wait for you.
  function step() {
    clearTimeout(timer);
    const h = S.hand;
    if (h.street === "done") { settle(); onChange(S); return; }
    const p = h.players[h.toAct];
    onChange(S);
    if (p.id === "me") return;
    timer = setTimeout(() => {
      if (!running()) return;
      const s = seat(p.id), d = Bots.decide(h, h.toAct, { style: s.style, level: s.level }) || { type: "fold" };
      Poker.act(h, h.toAct, d.type, d.to); S.log = h.log.slice(); step();
    }, rm() ? 150 : 700 + Math.random() * 800);
  }
  function settle() {
    const h = S.hand;
    for (const p of h.players) seat(p.id).stack = p.stack;
    S.result = h.result; S.log = h.log.slice();
    for (const a of Poker.handAchievements(h, { start: S.chips, bb: S.bb }, S.seats)) {
      const s = seat(a.playerId), def = Poker.ACH.find((x) => x.id === a.id); if (!s || !def) continue;
      const rec = S.ach[s.id] || (S.ach[s.id] = { name: s.name, owner: s.owner, kind: s.kind, got: {} });
      rec.got[a.id] = (rec.got[a.id] || 0) + 1; S.achNew.push({ seat: s.id, name: s.name, id: a.id, hand: S.handNo });
    }
  }
  function act(type, to) {
    if (!running() || S.hand.players[S.hand.toAct].id !== "me") return;
    Poker.act(S.hand, S.hand.toAct, type, to); S.log = S.hand.log.slice(); step();
  }
  function rebuy() { const m = seat("me"); if (m && m.stack === 0 && !running()) { m.stack = S.chips; onChange(S); } }
  function stop() { clearTimeout(timer); S = null; }

  // The same picture a table host sends (see publicView in main.js), so one renderer draws both.
  function view() {
    if (!S) return null;
    const h = S.hand, done = !h || h.street === "done", shown = {};
    if (h && h.result) for (const s of h.result.showdown) shown[s.id] = { hole: s.hole, hand: s.hand, cards: s.cards };
    const seats = S.seats.map((s) => {
      const p = h ? h.players.find((x) => x.id === s.id) : null;
      return { id: s.id, owner: s.owner, ownerName: s.owner === "me" ? s.name : "Computer", kind: s.kind, style: s.style || "", name: s.name, stack: p && !done ? p.stack : s.stack, inHand: !!p,
        bet: p && !done ? p.bet : 0, folded: !!(p && p.folded), allIn: !!(p && p.allIn && !done), lastAction: p ? p.lastAction : "", shown: shown[s.id] || null, cards: p && !p.folded && !done ? 2 : 0 };
    });
    const turn = h && !done ? h.players[h.toAct] : null, me = h ? h.players.find((p) => p.id === "me") : null;
    return {
      mode: "solo", joined: true, me: { id: "me", name: seat("me").name }, kins: [], chat: [], ooc: [],
      table: { name: "Solo table", local: true, settings: { sb: S.sb, bb: S.bb, start: S.chips, timer: 0, autoDeal: false, rebuys: true, paused: false }, handNo: S.handNo, street: h ? h.street : "waiting",
        board: h ? h.board : [], pot: h ? Poker.potTotal(h) : 0, bb: S.bb, dealer: h ? h.players[h.button].id : S.buttonId, toAct: turn ? turn.id : "", deadline: 0, seats,
        log: S.log.slice(-40), result: h && h.result ? h.result : null, ach: S.ach, achNew: done ? S.achNew : [], nextDealAt: 0, humans: 1, maxHumans: 1, people: [] },
      mine: me && !done ? { hole: me.hole } : null, legal: turn && turn.id === "me" ? Poker.legal(h) : null,
    };
  }
  return { start, deal, act, rebuy, stop, view, running, set onChange(f) { onChange = f; }, get active() { return !!S; } };
})();
