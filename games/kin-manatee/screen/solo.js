// Free Solo play: you against 2 to 5 computer players, run entirely inside this screen. No Kin, no app run, no file
// and no message to Kindroid, so nothing here can use credits. It builds the same "table" and "mine" pictures the
// app's host sends, so the screen draws a Solo game and an online game with one renderer.
const Solo = (() => {
  const rng = Game.secureRng, ME = "h:you";
  let G = null, seats = [], name = "Player", timers = [], ach = {}, achNew = [], feed = [], busy = false;
  const api = { onChange: () => {} };
  const later = (ms, fn) => { const t = setTimeout(() => { timers = timers.filter((x) => x !== t); fn(); }, ms); timers.push(t); };
  const seat = (id) => seats.find((s) => s.id === id);
  const sname = (id) => (id === Game.RANDO ? "the Random Manatee" : (seat(id) || {}).name || "someone");
  const text = (c) => G.answers[c];
  let liked = [];
  const say = (t) => { feed.push({ id: String(feed.length), ts: Date.now(), who: "The Manatee", owner: "", kind: "dealer", text: t }); if (feed.length > 120) feed.shift(); };
  const scoresText = () => seats.map((s) => `${s.name} ${G.scores[s.id] || 0}`).join(", ");

  function start(o) {
    stop();
    name = (o.name || "Player").slice(0, 40); lastKey = ""; ach = {}; achNew = []; feed = []; liked = [];
    seats = [{ id: ME, owner: "you", kind: "person", name }].concat(Bots.CAST.slice(0, o.n).map((b) => ({ id: "b:" + b.id, owner: "you", kind: "bot", botId: b.id, name: b.name })));
    G = Game.newGame(seats, o.rules, rng);
    say("Welcome to the lagoon! " + seats.slice(1).map((s) => s.name).join(", ") + (seats.length > 2 ? " are" : " is") + " at the table. First to " + (G.rules.target || "…") + " points wins.");
    api.onChange();
  }
  function stop() { timers.forEach(clearTimeout); timers = []; G = null; busy = false; }
  const phaseKey = () => G.round + ":" + G.phase;
  let lastKey = "";

  function deal() {
    if (!G || busy) return "";
    if (G.phase === "over") { G = Game.newGame(seats, G.rules, rng); say("New game! Fresh decks, everyone back to zero."); ach = {}; achNew = []; }
    const why = Game.startRound(G, seats, rng);
    if (why) { say(why); api.onChange(); return why; }
    Sfx.play("deal"); advance();
    return "";
  }
  // Move the round along: computer players answer and judge on short, staggered timers so the table feels alive.
  function advance() {
    if (!G) return;
    const key = phaseKey(), fresh = key !== lastKey; lastKey = key;
    const czar = seat(G.czar), p = Game.promptOf(G);
    if (fresh) {
      if (G.phase === "choosing") say(`Round ${G.round}. ${czar.name} is the Manatee Czar and is choosing the prompt card.`);
      if (G.phase === "picking") say(G.prompt === "haiku" ? `The final round! ${czar.name} reads the closing haiku card.` : `Round ${G.round}. ${czar.name} is the Manatee Czar. The prompt: "${p.text}"`);
      if (G.phase === "judging") say(`All answers are in. ${czar.name}, pick the funniest!`);
      if (G.phase === "result" || G.phase === "over") announce();
    }
    if (G.phase === "choosing" && czar.kind === "bot") later(900, () => { Game.timeoutChoosing(G, seats, rng); advance(); api.onChange(); });
    if (G.phase === "picking") {
      Game.players(G, seats).filter((s) => s.kind === "bot" && !(G.plays[s.id] || []).length).forEach((s, i) => later(500 + i * 450 + rng() * 500, () => {
        if (!G || G.phase !== "picking" || (G.plays[s.id] || []).length) return;
        const hand = G.hands[s.id], idx = Bots.choose(s.botId, p.text, p.pick, hand.map(text), rng, liked);
        Game.play(G, s.id, idx.map((k) => hand[k])); Sfx.play("play");
        if (Game.allPlayed(G, seats)) later(600, () => { if (G && G.phase === "picking") { Game.toJudging(G, seats, rng); Sfx.play("shuffle"); advance(); api.onChange(); } });
        api.onChange();
      }));
      if (Game.allPlayed(G, seats)) later(300, () => { if (G && G.phase === "picking") { Game.toJudging(G, seats, rng); advance(); api.onChange(); } });
    }
    if (G.phase === "judging" && czar.kind === "bot") later(1500 + G.reveal.length * 350, () => {
      if (!G || G.phase !== "judging") return;
      const i = Bots.judge(czar.botId, G.reveal.map((r) => Game.fill(p.text, r.cards.map(text))), p.text, rng, liked);
      Game.judge(G, czar.id, G.reveal[i].key, seats, rng); advance(); api.onChange();
    });
  }
  function announce() {
    const r = G.result;
    if (r && !r.void) {
      say(`${sname(G.czar)} picked: "${r.text}" Point to ${sname(r.winner)}!`);
      if (r.paid && r.paid.length) say(`${r.paid.map(sname).join(" and ")} lost a bet and paid a point to ${sname(r.winner)}.`);
      if (r.winner === Game.RANDO) say("The Random Manatee wins this one. Everyone, reflect on your choices.");
      const cz = seat(G.czar); if (cz && cz.kind === "bot") say(`${cz.name}: "${Bots.quip(cz.botId, rng)}"`);
      liked = liked.concat(Bots.words(r.text)).slice(-80);
      if (r.winner === ME) Sfx.play("win");
    } else if (r) say(r.text);
    achNew = [];
    for (const a of Game.roundAchievements(G)) {
      const s = seat(a.seat), def = Game.ACH.find((x) => x.id === a.id); if (!s || !def) continue;
      const rec = ach[s.id] || (ach[s.id] = { name: s.name, owner: s.owner, kind: s.kind, got: {} });
      rec.got[a.id] = (rec.got[a.id] || 0) + 1; achNew.push({ seat: s.id, name: s.name, id: a.id, round: G.round });
      say(`🏅 ${s.name} earned ${def.name}: ${def.about.replace(/\.$/, "").toLowerCase()}.`);
    }
    if (G.phase === "over") say(G.over.leaders.includes(Game.RANDO) ? "The Random Manatee wins the game. Everyone goes home in everlasting shame." : `Game over! ${G.over.leaders.map(sname).join(" and ")} win${G.over.leaders.length > 1 ? "" : "s"}. Final scores: ${scoresText()}.`);
  }
  // What the person does. Same event shapes as the online screen sends.
  function act(ev) {
    if (!G) return "";
    let err = "";
    if (ev.round != null && Number(ev.round) !== G.round && ev.t !== "next") return "";
    if (ev.t === "play") { err = Game.play(G, ME, ev.cards, !!ev.gamble); if (!err) { Sfx.play("play"); if (!ev.gamble && Game.allPlayed(G, seats)) later(500, () => { if (G && G.phase === "picking") { Game.toJudging(G, seats, rng); Sfx.play("shuffle"); advance(); api.onChange(); } }); } }
    else if (ev.t === "choose") { err = Game.choosePrompt(G, ME, Number(ev.which), seats, rng); if (!err) advance(); }
    else if (ev.t === "judge") { err = Game.judge(G, ME, String(ev.key), seats, rng); if (!err) advance(); }
    else if (ev.t === "swap") {
      const reboot = ev.mode === "reboot";
      if (reboot ? !G.rules.reboot : !G.rules.neverHave) return "";
      const texts = (ev.cards || []).filter((c) => (G.hands[ME] || []).includes(c)).map(text);
      err = Game.swapCards(G, ME, ev.cards, rng, reboot ? 1 : 0);
      if (!err) say(reboot ? `${name} trades a point to reboot the universe (${texts.length} new card${texts.length > 1 ? "s" : ""}).` : `${name} confesses they don't understand: ${texts.map((t) => `"${t}"`).join(", ")}.`);
    }
    else if (ev.t === "next" || ev.t === "newGame") { if (ev.t === "newGame") { G.phase = "over"; } err = deal(); }
    else if (ev.t === "happyEnding") { if (G.phase !== "over") { G.ending = true; say("Happy Ending: the next round is the last one, with the closing haiku card."); } }
    if (err) say(err);
    api.onChange();
    return err;
  }
  const players = () => Game.players(G, seats);
  function view() {
    if (!G) return null;
    const g = G, p = Game.promptOf(g), showReveal = ["judging", "result", "over"].includes(g.phase) && g.reveal.length;
    const pub = {
      name: "Solo", solo: true, settings: { rules: g.rules, paused: false, bots: seats.length - 1, pickTimer: 0, judgeTimer: 0 }, round: g.round, phase: g.phase, czar: g.czar, czarName: g.czar ? sname(g.czar) : "",
      prompt: p && g.phase !== "choosing" ? p : null,
      seats: seats.map((s) => ({ id: s.id, owner: s.owner, ownerName: name, kind: s.kind, name: s.name, botId: s.botId, score: g.scores[s.id] || 0, played: !!(g.plays[s.id] || []).length, czar: g.czar === s.id })),
      rando: g.rules.rando ? g.scores[Game.RANDO] || 0 : null,
      answersIn: Object.keys(g.plays).length, waitingOn: g.phase === "picking" ? players().filter((s) => !(g.plays[s.id] || []).length).map((s) => s.name) : [],
      reveal: showReveal ? g.reveal.map((r) => ({ key: r.key, cards: r.cards.map(text), text: Game.fill(p.text, r.cards.map(text)), who: g.phase === "judging" ? "" : sname(r.seat) })) : [],
      result: g.result ? { ...g.result, winnerName: g.result.winner ? sname(g.result.winner) : "", paid: (g.result.paid || []).map(sname), cards: undefined } : null,
      over: g.over ? { reason: g.over.reason, leaders: g.over.leaders.map(sname) } : null,
      ach, achNew: g.phase === "result" || g.phase === "over" ? achNew : [], ending: !!g.ending, deadline: 0, nextAt: 0, humans: 1, maxHumans: 1,
      people: [{ id: "you", name, host: true, online: true }],
    };
    const hand = g.hands[ME];
    const mine = hand ? { hand: hand.map((c) => ({ id: c, text: text(c) })), played: (g.plays[ME] || []).length, bet: !!g.bets[ME], round: g.round, choices: g.phase === "choosing" && g.czar === ME ? g.choices.map((c) => g.prompts[c].text) : [] } : null;
    return { mode: "solo", joined: true, me: { id: "you", name }, table: pub, mine, chat: feed.slice(), ooc: [], pendingChat: [], pendingOoc: [], kins: [], drafts: [], kinUse: { used: 0, cap: 0 } };
  }
  Object.assign(api, { start, stop, deal, act, view, get active() { return !!G; } });
  return api;
})();
