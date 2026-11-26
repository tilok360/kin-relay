// Kin Casino screen: the floor, every table's betting layout, Solo (free, all on this screen), Solo with your Kin
// (the Kin is asked only when it sits down and when you ask it to talk) and human tables run by the app.
const App = (() => {
  const $ = (i) => document.getElementById(i);
  const el = (tag, txt, cls) => { const e = document.createElement(tag); if (txt != null) e.textContent = txt; if (cls) e.className = cls; return e; };
  const btn = (txt, fn, cls) => { const b = el("button", txt, cls); b.onclick = (e) => { e.stopPropagation(); fn(e); }; return b; };
  const store = { get: (k, d) => { try { const v = localStorage.getItem("casino-" + k); return v == null ? d : JSON.parse(v); } catch { return d; } }, set: (k, v) => { try { localStorage.setItem("casino-" + k, JSON.stringify(v)); } catch {} } };
  const money = (n) => Number(n || 0).toLocaleString("en-US");
  const G = (id) => Games.by[id];
  // Fair draws on this screen too: crypto with rejection sampling (no modulo bias).
  const rng = (n) => { const lim = Math.floor(4294967296 / n) * n, a = new Uint32Array(1); do crypto.getRandomValues(a); while (a[0] >= lim); return a[0] % n; };
  const prefs = Object.assign({ motion: true }, store.get("prefs", {}));
  const rmq = window.matchMedia ? matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
  const animOn = () => prefs.motion && !rmq.matches && !window.NOMOTION;

  // ---------- talking to the page around the screen ----------
  let seq = 0; const waiting = {};
  function post(msg, ms) {
    const id = "m" + ++seq; msg.id = id;
    return new Promise((res) => { waiting[id] = res; parent.postMessage(msg, "*"); setTimeout(() => { if (waiting[id]) { delete waiting[id]; res(null); } }, ms || 10000); });
  }
  const ask = async (q) => { const m = await post({ kin: "ask", question: q.slice(0, 7900) }, 30000); return m && m.ok && m.text ? String(m.text) : null; };
  let wakeBusy = false, wakeAgain = false, wakeAt = 0, pressAt = 0, startAt = 0, lastBody = "", lastChange = 0, loadAt = Date.now(), lastUse = Date.now(), lastNudge = 0;
  function requestWake() { if (wakeBusy && Date.now() - wakeAt < 30000) { wakeAgain = true; return; } wakeBusy = true; wakeAt = Date.now(); parent.postMessage({ kin: "action", name: "wake", input: {} }, "*"); }
  const cmd = (c) => { pressAt = Date.now(); parent.postMessage({ kin: "files.write", path: "cmds/" + Date.now() + "-" + Math.random().toString(36).slice(2, 8) + ".json", body: JSON.stringify(c) }, "*"); };
  const poll = () => { if (mode !== "solo") parent.postMessage({ kin: "files.read", path: "view.json" }, "*"); };

  // ---------- state ----------
  let mode = "lounge", tab = "tSolo", V = null, S = null, kins = [], kinPick = store.get("kin", ""), bringId = null;
  let bank = { me: 1000, kins: {}, intros: {} }, pend = {}, picks = [], lastBets = store.get("last", {}), chipV = 5, busy = false, shownStack = null, showing = Promise.resolve(), lastShown = "", banner = null;
  const opts = Object.assign({ bots: 1 }, store.get("solo", {}));
  const saveBank = () => { store.set("bank", bank); post({ kin: "files.write", path: "bank.json", body: JSON.stringify(bank) }); };
  const ME = "h:me";
  function flash(t) { $("note0").textContent = t; $("status").dataset.flash = t; setTimeout(() => { if ($("status").dataset.flash === t) { $("status").dataset.flash = ""; draw(); } }, 4500); draw(); }

  // The table this screen shows, whichever mode: {T, me, kin, online, host}.
  function cur() {
    if (mode === "solo") return { T: Table.pub(S.T), me: ME, kin: S.kin ? "k:kin" : "", online: false };
    if (mode === "online" && V && V.table) return { T: V.table, me: "h:" + V.me.id, kin: "k:" + V.me.id, online: true, host: V.mode === "host" };
    return null;
  }
  const seatOf = (T, id) => T.seats.find((s) => s.id === id);
  const shownR = (T) => (T.round.phase === "play" ? T.round.R : T.round.last);

  // ---------- the floor ----------
  const FLOOR = [["Card tables", ["blackjack", "baccarat", "war", "reddog"]], ["Wheels", ["roulette", "big6"]], ["Dice", ["craps", "sicbo", "chuck"]], ["Machines and draws", ["slots", "keno", "bingo", "scratch"]]];
  const ICON = { blackjack: () => Art.face("As") + Art.face("Kh"), baccarat: () => Art.face("9d") + Art.face("Qs"), war: () => Art.face("Ac") + Art.back, reddog: () => Art.face("4h") + Art.face("Jc"),
    roulette: () => Art.sym("coin").replace("K", "0"), big6: () => Art.sym("star"), craps: () => Art.die(6) + Art.die(1), sicbo: () => Art.die(4, 1) + Art.die(2, 1), chuck: () => Art.die(3) + Art.die(5),
    slots: () => Art.sym("seven") + Art.sym("cherry"), keno: () => '<b class="mini">80</b>', bingo: () => '<b class="mini">B·I·N·G·O</b>', scratch: () => Art.sym("clover") + Art.sym("crown") };
  function buildFloor() {
    const f = $("floor"); f.replaceChildren();
    for (const [name, ids] of FLOOR) {
      const sec = el("div", null, "zone"); sec.append(el("h2", name));
      const row = el("div", null, "tiles");
      for (const id of ids) {
        const g = G(id), b = btn("", () => openGame(id), "tile t-" + id);
        b.innerHTML = `<span class="art">${ICON[id]()}</span><b>${g.name}</b><small>${g.min}–${g.max} chips</small>`;
        b.disabled = tab === "tJoin"; row.append(b);
      }
      sec.append(row); f.append(sec);
    }
  }
  const TABS = { tSolo: "pSolo", tKin: "pKin", tHost: "pHost", tJoin: "pJoin" };
  function setTab(t) { tab = t; for (const [k, p] of Object.entries(TABS)) { $(k).classList.toggle("on", k === t); $(p).hidden = k !== t; } $("menuBar").hidden = !(t === "tHost" || t === "tJoin"); buildFloor(); buildLounge(); }
  function kinRow(box, cur, pickFn, none) {
    box.replaceChildren(...(none ? [{ id: "", name: "Just me" }] : []).concat(kins).map((k) => btn(k.name, () => pickFn(k.id), k.id === cur ? "on" : "")));
    if (!kins.length) box.append(el("span", "Attach a Kin to Kin Casino in Kindroid to bring one.", "note")); else if (window.KRKins) window.KRKins.enhance(box, (none ? [null] : []).concat(kins.map((k) => k.id)));
  }
  function buildLounge() {
    $("bank0").textContent = money(bank.me); $("refill0").hidden = bank.me >= 5;
    $("oBots").replaceChildren(...[0, 1, 2].map((n) => btn(n ? String(n) : "None", () => { opts.bots = n; store.set("solo", opts); buildLounge(); }, opts.bots === n ? "on" : "")));
    kinRow($("soloKin"), kinPick || (kins[0] && kins[0].id), (id) => { kinPick = id; store.set("kin", id); buildLounge(); });
    const bring = bringId ?? ((V && V.kinId) || "");
    kinRow($("bringH"), bring, (id) => { bringId = id; buildLounge(); }, true); kinRow($("bringJ"), bring, (id) => { bringId = id; buildLounge(); }, true);
  }
  function openGame(id) {
    Sfx.unlock(); lastUse = Date.now();
    if (tab === "tSolo") return startSolo(id, null);
    if (tab === "tKin") { const k = kins.find((x) => x.id === kinPick) || kins[0]; if (!k) return flash("Attach a Kin to Kin Casino in Kindroid first (or play Solo for free)."); return startSolo(id, k); }
    if (tab === "tHost") { cmd({ t: "bring", kinId: bringId ?? ((V && V.kinId) || "") }); cmd({ t: "host", name: $("myname").value, table: $("tName").value, game: id }); flash("Opening your table…"); }
  }
  $("doJoin").onclick = () => { cmd({ t: "bring", kinId: bringId ?? ((V && V.kinId) || "") }); cmd({ t: "join", name: $("myname").value, code: $("jCode").value }); flash("Asking to sit down…"); };
  for (const t of Object.keys(TABS)) $(t).onclick = () => setTab(t);
  $("myname").onchange = () => { store.set("name", $("myname").value); if (S) { const s = Table.find(S.T, ME); if (s) s.name = myName(); draw(); } if (V && V.mode !== "off") cmd({ t: "name", name: $("myname").value }); };
  const myName = () => $("myname").value.trim() || "Player";
  const refillMe = () => { if (mode === "solo") { Table.refill(S.T, ME); bank.me = Table.find(S.T, ME).stack; saveBank(); shownStack = null; } else if (mode === "online") cmd({ t: "refill" }); else { bank.me = Math.max(bank.me, 1000); saveBank(); } Sfx.play("chips", 6); flash("Free refill: back to 1,000 play chips."); buildLounge(); };
  $("refill0").onclick = $("refill").onclick = refillMe;

  // ---------- Solo (free) and Solo with your Kin ----------
  async function startSolo(id, k) {
    const T = Table.create(id);
    Table.addSeat(T, { id: ME, name: myName(), kind: "person", stack: bank.me });
    S = { T, kin: null, chat: [] };
    if (k) {
      let intro = bank.intros[k.id];
      if (!intro) {
        flash(`Asking ${k.name} to sit down…`);
        const t = await ask(`You're sitting down with your person at ${G(id).name} in Kin Casino, playing for play chips only (no real money). Choose how you like to bet: "careful", "steady" or "bold", a lucky number from 0 to 36, and a short hello. Reply with one JSON object only: {"style":"careful|steady|bold","lucky":<number>,"line":"<hello, under 120 characters>"}`);
        let j = null; try { j = JSON.parse(String(t).slice(String(t).indexOf("{"), String(t).lastIndexOf("}") + 1)); } catch {}
        intro = { style: j && Games.styles[j.style] ? j.style : "steady", lucky: j && j.lucky >= 0 && j.lucky <= 36 ? Math.round(j.lucky) : 7 };
        bank.intros[k.id] = intro; saveBank();
        if (j && j.line) S.chat.push({ who: k.name, kind: "kin", text: String(j.line).slice(0, 200) });
      }
      Table.addSeat(T, { id: "k:kin", name: k.name, kind: "kin", style: intro.style, lucky: intro.lucky, stack: bank.kins[k.id] || 1000 });
      S.kin = Object.assign({ id: k.id, name: k.name }, intro);
    }
    [["Dot", "careful"], ["Max", "bold"]].slice(0, opts.bots).forEach(([n, st], i) => Table.addSeat(T, { id: "b:" + i, name: n, kind: "bot", style: st }));
    mode = "solo"; enterGame();
  }
  function soloSave() {
    const me = Table.find(S.T, ME); bank.me = me.stack;
    if (S.kin) { const k = Table.find(S.T, "k:kin"); if (k) bank.kins[S.kin.id] = k.stack; }
    saveBank();
  }
  function soloPlay() {
    const T = S.T, why = Table.placeBets(T, ME, pend, picks);
    if (why) return flash("Not yet: " + why + ".");
    if (!Table.hasAction(T) && !Object.keys(pend).length) return flash("Put some chips on the layout first.");
    if (Object.keys(pend).length) { lastBets[T.game] = { bets: pend, picks }; store.set("last", lastBets); }
    Table.autoBets(T, rng); Table.startRound(T, rng);
    pend = {}; afterSolo();
  }
  function afterSolo() {
    const T = S.T;
    if (T.round.phase === "done") { Table.nextRound(T); soloSave(); }
    draw();
  }
  const act = (a) => { lastUse = Date.now(); Sfx.play("chips", 2); if (mode === "solo") { Table.act(S.T, ME, a, rng); afterSolo(); } else { cmd({ t: "act", a }); flash("Sent to the dealer…"); } };
  function play() {
    lastUse = Date.now(); Sfx.unlock();
    if (busy) return;
    const c = cur(); if (!c || c.T.round.phase !== "bets") return;
    if (G(c.T.game).picks && Object.keys(pend).length && !picks.length) return flash("Pick 1 to 10 numbers first (or Quick pick).");
    if (mode === "solo") return soloPlay();
    cmd({ t: "bets", no: c.T.round.no, bets: pend, picks }); lastBets[c.T.game] = { bets: pend, picks }; store.set("last", lastBets);
    flash(Object.keys(pend).length ? "Bets sent to the dealer…" : "Sitting this round out…");
  }

  // ---------- entering and leaving a table ----------
  function enterGame() {
    $("lounge").hidden = true; $("game").hidden = false; pend = {}; picks = []; lastShown = ""; banner = null; shownStack = null;
    Stage.reset(); buildBoard(); draw(); window.scrollTo(0, 0);
  }
  function toLounge() {
    if (mode === "solo") {
      const P = (S.T.persist && S.T.persist.bets) || {}; // standing craps bets come back to the bank
      for (const id of Object.keys(P)) { const s = Table.find(S.T, id); if (s) s.stack += Games.total(P[id]); }
      soloSave(); S = null;
    }
    mode = "lounge"; $("game").hidden = true; $("lounge").hidden = false; closePanels(); buildLounge(); buildFloor();
  }
  $("back").onclick = () => { if (mode === "online") { $("drawer").hidden = false; drawDrawer(); return; } toLounge(); };
  $("leave").onclick = () => { if (mode === "online") { cmd({ t: "leave" }); flash("Leaving the table…"); } else toLounge(); };
  function leaveForQuit() {
    if (mode === "solo") { toLounge(); return; }
    if (!V || V.mode === "off") return;
    return new Promise((res) => { addEventListener("message", function h(e) { const d = e.data || {}; if (d.kin === "action" && d.name === "wake") { removeEventListener("message", h); res(); } }); cmd({ t: "leave" }); });
  }

  // ---------- the betting layout ----------
  const spot = (id, label, pays, cls) => { const b = el("button", null, "spot " + (cls || "")); b.dataset.s = id; b.innerHTML = `<span class="lb">${label}</span>${pays ? `<small>${pays}</small>` : ""}<i class="amt"></i>`; return b; };
  function buildBoard() {
    const c = cur(), g = G(c.T.game), B = $("board"); B.replaceChildren(); B.className = "b-" + g.id;
    const sp = g.spots, mk = (id, cls) => spot(id, sp[id].label, sp[id].pays, cls);
    if (g.id === "roulette") {
      const grid = el("div", null, "rgrid"); grid.append(mk("n0", "z green"));
      for (let r = 0; r < 3; r++) for (let col = 0; col < 12; col++) { const n = col * 3 + (3 - r), b = spot("n" + n, String(n), "", Games.util.colorOf(n)); b.style.gridArea = `${r + 1}/${col + 2}`; grid.append(b); }
      ["c3", "c2", "c1"].forEach((id, r) => { const b = spot(id, "2:1", "", "col"); b.style.gridArea = `${r + 1}/14`; grid.append(b); });
      ["d1", "d2", "d3"].forEach((id, i) => { const b = mk(id, "dz"); b.style.gridArea = `4/${2 + i * 4}/5/${6 + i * 4}`; grid.append(b); });
      ["low", "even", "red", "black", "odd", "high"].forEach((id, i) => { const b = mk(id, "out " + (id === "red" || id === "black" ? id : "")); b.style.gridArea = `5/${2 + i * 2}/6/${4 + i * 2}`; grid.append(b); });
      B.append(grid);
    } else if (g.id === "keno") {
      const grid = el("div", null, "kgrid");
      for (let n = 1; n <= 80; n++) { const b = btn(String(n), () => togglePick(n), "kn"); b.dataset.k = n; grid.append(b); }
      B.append(grid, el("div", null, "row"));
      B.lastChild.append(mk("ticket", "wide"), btn("Quick pick", () => { picks = Games.util.draw(rng, 80, 6); Sfx.play("chips", 2); draw(); }, "sm"), btn("Clear picks", () => { picks = []; draw(); }, "sm"), el("span", null, "note kpay"));
    } else if (g.id === "sicbo") {
      const r1 = el("div", null, "row g5"), r2 = el("div", null, "row tots"), r3 = el("div", null, "row g6");
      ["small", "odd", "triple", "even", "big"].forEach((id) => r1.append(mk(id)));
      for (let n = 4; n <= 17; n++) r2.append(mk("t" + n, "tot"));
      for (let n = 1; n <= 6; n++) { const b = mk("s" + n, "single"); b.querySelector(".lb").innerHTML = Art.die(n, 1); r3.append(b); }
      B.append(r1, r2, r3);
    } else if (g.id === "chuck") {
      const r = el("div", null, "row g6"); for (let n = 1; n <= 6; n++) { const b = mk("c" + n, "single"); b.querySelector(".lb").innerHTML = Art.die(n); r.append(b); } B.append(r);
    } else if (g.id === "big6") {
      const r = el("div", null, "row g7"); Object.keys(sp).forEach((id) => { const b = mk(id, "b6 v" + id.slice(1)); if (id === "wstar" || id === "wmoon") b.querySelector(".lb").innerHTML = Art.sym(id.slice(1)); r.append(b); }); B.append(r);
    } else {
      const r = el("div", null, "row spots"); Object.keys(sp).forEach((id) => r.append(mk(id, id === "pass" || id === "field" ? "wide" : ""))); B.append(r);
      if (g.id === "slots") B.append(el("div", `Pays (per chip): 3 gems 500 · 3 sevens 100 · 3 bars 50 · 3 stars 25 · 3 bells 15 · 3 cherries 10 · 3 lemons 8 · 2 cherries 3 · cherry first 1`, "note paytable"));
      if (g.id === "bingo") B.append(el("div", "Pays (per chip): 1 line 5 · 2 lines 12 · 3 lines 60 · 4 or more 300", "note paytable"));
      if (g.id === "scratch") B.append(el("div", "Three of a kind wins: crown 1× · gem 2× · bell 3× · star 5× · horseshoe 20× · clover 100× · coin 1000×", "note paytable"));
    }
    B.querySelectorAll(".spot").forEach((b) => {
      b.onclick = (e) => bet(b.dataset.s, e.shiftKey ? -1 : 1);
      b.oncontextmenu = (e) => { e.preventDefault(); bet(b.dataset.s, -1); };
    });
    const vals = [1, 5, 25, 100, 500].filter((v) => v <= g.max && v >= Math.min(g.min, 5));
    if (!vals.includes(chipV)) chipV = vals[1] || vals[0];
    $("chips").replaceChildren(...vals.map((v, i) => { const b = btn("", () => { chipV = v; Sfx.play("chips", 1); draw(); }, "chipbtn"); b.dataset.v = v; b.title = `Chip ${money(v)} (key ${i + 1})`; const d = Art.DEN.find((x) => x[0] === v); b.innerHTML = Art.chip(v, d[1], d[2]); return b; }));
  }
  function togglePick(n) {
    const c = cur(); if (!c || c.T.round.phase !== "bets") return;
    const i = picks.indexOf(n); if (i >= 0) picks.splice(i, 1); else if (picks.length < 10) picks.push(n); else return flash("Ten numbers is the most.");
    Sfx.play("tick"); draw();
  }
  function bet(id, dir) {
    lastUse = Date.now(); Sfx.unlock();
    const c = cur(); if (!c || busy || c.T.round.phase !== "bets") return;
    const g = G(c.T.game), me = seatOf(c.T, c.me); if (!me) return;
    if (g.allowed && dir > 0 && !g.allowed(id, c.T.persist, c.me)) return flash(id === "odds" ? "Odds go behind a Pass Line bet once a point is set." : "Line bets go on before the come-out roll.");
    const now = pend[id] || 0, placed = Games.total((c.T.round.bets[c.me] || {}).bets || {});
    let next = Math.max(0, now + dir * chipV);
    if (next && next < g.min) next = dir > 0 ? g.min : 0;
    const step = g.step && g.step[id]; if (step && next) next = Math.max(step, Math.round(next / step) * step);
    next = Math.min(next, g.max - (step ? g.max % step : 0));
    if (Games.total(pend) - now + next > me.stack + placed) return flash("Not enough chips for that. Take a free refill when you run low.");
    if (next) pend[id] = next; else delete pend[id];
    Sfx.play("chips", 2); draw();
  }
  const clearBets = () => { pend = {}; draw(); };
  const rebet = () => { const c = cur(), l = c && lastBets[c.T.game]; if (!l) return flash("No earlier bets at this game yet."); pend = Object.assign({}, l.bets); if (l.picks) picks = l.picks.slice(); const g = G(c.T.game); for (const k of Object.keys(pend)) if (g.allowed && !g.allowed(k, c.T.persist, c.me)) delete pend[k]; draw(); };

  // ---------- drawing ----------
  const PLAY = { roulette: "Spin", big6: "Spin", craps: "Roll", sicbo: "Roll", chuck: "Roll", slots: "Spin", keno: "Draw", bingo: "Play card", scratch: "Buy ticket" };
  const ACT = { hit: ["Hit", "H"], stand: ["Stand", "S"], double: ["Double", "D"], war: ["Go to war", "W"], surrender: ["Surrender", "U"], raise: ["Raise", "R"], stay: ["Stay", "S"] };
  function names(T) { const o = {}; T.seats.forEach((s) => (o[s.id] = s.name)); return o; }
  function draw() {
    if (mode === "lounge") return;
    const c = cur(); if (!c) return;
    const T = c.T, g = G(T.game), r = T.round, me = seatOf(T, c.me), R = shownR(T);
    if ($("board").className !== "b-" + g.id) { Stage.reset(); buildBoard(); }
    $("title").textContent = g.name;
    $("sub").textContent = mode === "solo" ? (S.kin ? `With ${S.kin.name} · bets free, talking uses credits` : "Solo · free · no credits") : `${T.name} · ${V.mode === "host" ? "you host" : "guest"} · may use credits`;
    $("bChat").hidden = mode === "solo" && !S.kin;
    // results: animate the round once, then show the outcome
    const key = R ? g.id + ":" + R.no + ":" + JSON.stringify(R.seats.map((s) => [s.hand, s.war, s.did])) + (R.done ? "d" : "") + JSON.stringify(R.dealer || 0) + (R.cards || []).length : "";
    if (R && key !== lastShown) {
      lastShown = key; busy = true; const stackBefore = shownStack;
      showing = showing.then(() => { Stage.motion = animOn(); return Stage.show(g, R, { me: c.me, names: names(T) }); }).catch(() => {}).then(() => {
        busy = false; shownStack = null;
        const mine = R.seats.find((s) => s.id === c.me);
        if (R.done && mine) { const net = mine.net != null ? mine.net : mine.back - mine.stake - mine.extra; banner = { net, text: outcome(g, R), no: R.no }; Sfx.play(net > 0 ? "win" : net < 0 ? "lose" : "chips", 3); }
        else if (R.done) banner = { net: null, text: outcome(g, R), no: R.no };
        draw();
      });
      if (stackBefore == null && me) shownStack = me.stack + (R.done && R.seats.find((s) => s.id === c.me) ? -R.seats.find((s) => s.id === c.me).back : 0);
    }
    const stack = me ? (busy && shownStack != null ? shownStack : me.stack) : 0;
    $("bank").textContent = money(stack);
    $("refill").hidden = !(me && me.stack < g.min && r.phase === "bets" && !busy);
    const ban = $("banner");
    if (banner && !busy) { ban.className = "banner on " + (banner.net > 0 ? "win" : banner.net < 0 ? "lose" : ""); ban.innerHTML = `<b>${banner.net == null ? "" : banner.net > 0 ? "+" + money(banner.net) : banner.net < 0 ? "−" + money(-banner.net) : "Even"}</b><span></span>`; ban.lastChild.textContent = banner.text; }
    else ban.className = "banner";
    // seats
    $("seats").replaceChildren(...T.seats.map((s) => {
      const d = el("div", null, "seat " + s.kind + (s.id === c.me ? " me" : "") + (r.phase === "play" && r.R && r.R.turn === s.id ? " turn" : ""));
      const placed = r.bets[s.id] ? Games.total(r.bets[s.id].bets) : 0, last = R && R.done && R.seats.find((x) => x.id === s.id);
      d.innerHTML = Art.avatar(s.name, s.kind) + `<div><b></b><small>${s.kind === "bot" ? "computer · " + s.style : s.kind === "kin" ? "Kin · " + s.style : s.id === c.me ? "you" : "player"}</small></div><span class="st">${money(s.id === c.me ? stack : s.stack)}</span>` +
        (placed ? `<span class="pl">${money(placed)} bet</span>` : last && !busy && last.net ? `<span class="pl ${last.net > 0 ? "up" : "dn"}">${last.net > 0 ? "+" : "−"}${money(Math.abs(last.net))}</span>` : r.ready[s.id] && r.phase === "bets" && s.kind === "person" ? `<span class="pl">sits out</span>` : "");
      d.querySelector(":scope > div > b").textContent = s.name; return d;
    }));
    // layout amounts
    const placedMine = (r.bets[c.me] || {}).bets || {}, standing = ((T.persist || {}).bets || {})[c.me] || {};
    const others = {}; for (const [id, b] of Object.entries(r.bets)) if (id !== c.me) for (const k of Object.keys(b.bets)) others[k] = (others[k] || 0) + 1;
    $("board").querySelectorAll(".spot").forEach((b) => {
      const s = b.dataset.s, a = pend[s] || (c.online && !Object.keys(pend).length ? placedMine[s] : 0) || 0, st = standing[s] || 0;
      b.querySelector(".amt").textContent = a || st ? money(a + st) : "";
      b.classList.toggle("has", !!(a || st)); b.classList.toggle("std", !!st && !a);
      b.dataset.o = others[s] ? "+" + others[s] : "";
      b.disabled = r.phase !== "bets" || (g.allowed && !g.allowed(s, T.persist, c.me) && !st);
      if (R && R.done && !busy) { const ln = (R.seats.find((x) => x.id === c.me) || { lines: [] }).lines.find((l) => l.spot === s); b.classList.toggle("won", !!(ln && ln.back > ln.amt)); } else b.classList.remove("won");
    });
    if (g.id === "keno") {
      const drawn = R && !busy ? R.drawn : null;
      $("board").querySelectorAll(".kn").forEach((b) => { const n = +b.dataset.k; b.classList.toggle("pick", picks.includes(n)); if (!busy) b.classList.toggle("drawn", !!(drawn && drawn.includes(n))); b.disabled = r.phase !== "bets"; });
      const t = Games.by.keno.table[picks.length]; $("board").querySelector(".kpay").textContent = picks.length ? `${picks.length} picked · pays per chip: ` + Object.entries(t).map(([h, x]) => `${h} hit${h === "1" ? "" : "s"} ${x}`).join(", ") : "Tap 1 to 10 numbers.";
    }
    $("chips").querySelectorAll(".chipbtn").forEach((b) => b.classList.toggle("on", +b.dataset.v === chipV));
    // actions
    const A = $("acts"); A.replaceChildren();
    let status = "";
    const myTurn = r.phase === "play" && r.R && r.R.turn === c.me && !busy;
    if (myTurn) {
      const o = mode === "solo" ? Table.options(S.T, ME) : g.options(r.R, c.me, me.stack);
      o.forEach((a) => { const b = btn(ACT[a][0], () => act(a), "go act-" + a); b.append(el("kbd", ACT[a][1])); A.append(b); });
      status = g.id === "blackjack" ? "Your hand: hit, stand or double." : g.id === "war" ? "A tie! Go to war (match your bet) or surrender half." : "Raise up to your bet, or stay.";
    } else if (r.phase === "play") status = busy ? "" : `Waiting for ${(seatOf(T, r.R.turn) || { name: "the dealer" }).name}…`;
    else {
      const ready = c.online && r.ready[c.me];
      A.append(btn("Clear", clearBets, "sm"), btn("Repeat bets", rebet, "sm"));
      const label = (PLAY[g.id] || "Deal") + (Object.keys(pend).length ? " · " + money(Games.total(pend)) : "");
      const main = btn(c.online ? (Object.keys(pend).length ? "Place bets · " + money(Games.total(pend)) : ready ? "Bets in" : "Sit this round out") : label, play, "go main");
      main.disabled = busy || (c.online && ready && !Object.keys(pend).length); main.append(el("kbd", "Enter")); A.append(main);
      if (g.standing && (T.persist || {}).point != null && Object.keys(standing).length && !Object.keys(pend).length && !c.online) main.textContent = "Roll", main.disabled = busy;
      status = busy ? "" : c.online ? (ready ? "Your bets are in. Waiting for the others" + (T.deadline ? ` · closes in ${Math.max(0, Math.ceil((T.deadline - Date.now()) / 1000))} s` : "") : "Place your bets" + (T.deadline ? ` · bets close in ${Math.max(0, Math.ceil((T.deadline - Date.now()) / 1000))} s` : "") + ".") :
        g.id === "craps" ? ((T.persist || {}).point ? `Point is ${T.persist.point}. Add odds or place bets, then roll.` : "Come-out roll: bet the Pass Line or Don't Pass.") : `Choose a chip, tap the layout, then ${(PLAY[g.id] || "Deal").toLowerCase()}. Shift-click or right-click takes a chip off.`;
    }
    $("status").textContent = $("status").dataset.flash || (c.online && V.note && Date.now() - lastChange < 6000 ? V.note : status);
    if (!$("panel").hidden) drawPanel();
    if (!$("drawer").hidden) drawDrawer();
    $("unread").hidden = !(mode === "online" && V.drafts && V.drafts.length);
  }
  function outcome(g, R) {
    const U = Games.util;
    switch (g.id) {
      case "roulette": return `${R.n} ${R.color}`;
      case "big6": return `The wheel stops on ${typeof R.v === "number" ? R.v : R.v === "star" ? "the Star" : "the Moon"}`;
      case "craps": { const t = R.dice[0] + R.dice[1]; return `Rolled ${t}` + (R.was && t === R.was ? " · point made" : R.was && t === 7 ? " · seven out" : !R.was && R.point ? ` · point is ${R.point}` : !R.was && (t === 7 || t === 11) ? " · natural" : !R.was && [2, 3, 12].includes(t) ? " · craps" : ""); }
      case "sicbo": case "chuck": return `Dice ${R.dice.join(" · ")} (total ${R.dice.reduce((a, b) => a + b, 0)})`;
      case "baccarat": return R.win === "tie" ? `Tie ${R.pt}–${R.bt}` : `${R.win === "player" ? "Player" : "Banker"} wins ${Math.max(R.pt, R.bt)} to ${Math.min(R.pt, R.bt)}`;
      case "blackjack": return R.dealerBJ ? "Dealer has blackjack" : `Dealer ${U.bjTotal(R.dealer).t > 21 ? "busts" : "has " + U.bjTotal(R.dealer).t}`;
      case "keno": return "Twenty balls drawn";
      case "bingo": return `${R.drawn.length} balls called`;
      default: { const s = R.seats[0]; return s && s.lines[0] && s.lines[0].note ? s.lines[0].note : ""; }
    }
  }

  // ---------- chat (Solo with Kin and tables) ----------
  function openPanel() { $("panel").hidden = false; $("drawer").hidden = true; drawPanel(); }
  function closePanels() { $("panel").hidden = true; $("drawer").hidden = true; }
  $("bChat").onclick = () => ($("panel").hidden ? openPanel() : closePanels());
  $("closePanel").onclick = $("closeDrawer").onclick = closePanels;
  $("gear").onclick = () => { $("drawer").hidden = !$("drawer").hidden; $("panel").hidden = true; drawDrawer(); };
  function drawPanel() {
    const list = mode === "solo" ? S.chat : (V.chat || []).concat((V.pendingChat || []).map((m) => ({ who: m.who, text: m.text, kind: "pending" })));
    const box = $("pBody"); box.replaceChildren(...list.slice(-80).map((m) => { const d = el("div", null, "msg " + m.kind); d.append(el("b", m.who), el("span", m.text)); return d; }));
    box.scrollTop = 1e6;
    const D = $("drafts"); D.replaceChildren();
    if (mode === "online") for (const d of V.drafts || []) {
      const x = el("div", null, "draft"); x.append(el("div", `${d.name} drafted${d.from ? " for " + d.from : ""} (only you see this):`, "note"), el("p", d.text));
      x.append(btn("Post to the table", () => cmd({ t: "postDraft", id: d.id }), "go sm"), btn("Discard", () => cmd({ t: "discardDraft", id: d.id }), "sm")); D.append(x);
    }
    const hasKin = mode === "solo" ? !!S.kin : !!(V && V.kinId);
    $("talk").hidden = !hasKin; $("kinUse").textContent = hasKin ? (mode === "solo" ? "Each Talk or message to your Kin is one Kin request (credits)." : `Kin requests this hour: ${V.kinUse.used} of ${V.kinUse.cap}.`) : "";
    $("say").placeholder = mode === "solo" ? `Say something to ${S.kin ? S.kin.name : "the table"} (asks your Kin: credits)` : "Say something to the table";
  }
  async function kinLine(why) {
    const k = S.kin, T = S.T, me = Table.find(T, "k:kin"), last = T.round.last;
    const t = await ask(`You're at ${G(T.game).name} in Kin Casino with your person, for play chips only (no real money). You have ${me ? me.stack : 0} chips (${me && me.net >= 0 ? "up " + me.net : "down " + (me ? -me.net : 0)} this session). ${last ? "Last round: " + outcome(G(T.game), last) + "." : ""} Recent chat:\n${S.chat.slice(-8).map((m) => `${m.who}: <<<${m.text.replace(/<<<|>>>/g, "")}>>>`).join("\n") || "(quiet)"}\n${why} Reply with one short chat line in your own voice (under 160 characters), safe for work.`);
    if (t) S.chat.push({ who: k.name, kind: "kin", text: t.replace(/^["“]|["”]$/g, "").slice(0, 200) }); else S.chat.push({ who: "Dealer", kind: "dealer", text: `${k.name} didn't answer just now.` });
    drawPanel();
  }
  $("talk").onclick = () => { lastUse = Date.now(); if (mode === "solo") { if (S.kin) kinLine("Your person asked you to say something."); } else { cmd({ t: "kinTalkNow" }); flash("Asking your Kin for a line (you review it before it's posted)…"); } };
  const doSay = () => {
    const t = $("say").value.trim(); if (!t) return; $("say").value = ""; lastUse = Date.now();
    if (mode === "solo") { S.chat.push({ who: myName(), kind: "person", text: t }); drawPanel(); if (S.kin) kinLine("Your person just said that to you. Answer them."); }
    else cmd({ t: "say", text: t });
  };
  $("send").onclick = doSay; $("say").onkeydown = (e) => { if (e.key === "Enter") doSay(); };

  // ---------- rules and settings ----------
  function drawDrawer() {
    const c = cur(), g = c && G(c.T.game);
    $("rTitle").textContent = g ? g.name + " rules" : ""; $("rules").textContent = g ? g.about : "";
    $("sSound").checked = Sfx.on; $("sMotion").checked = prefs.motion;
    $("leave").hidden = mode !== "online"; $("leave").textContent = V && V.mode === "host" ? "Close the table" : "Leave the table";
    $("creditNote").textContent = mode === "solo" ? (S.kin ? `Bets and moves are free. ${S.kin.name} was asked once when it first sat down; each Talk or message to it is one Kin request.` : "Solo is free: it runs only on this screen and uses no Kindroid credits or app runs.") :
      `This table runs the app on Kindroid, so it may use credits. Deliveries this hour: ${V.budget.sentThisHour}, today: ${V.budget.sentToday}. It stops checking in 10 minutes after the last bet or message${V.asleep ? " (quiet now)" : ""}. Computer players are free.`;
    const H = $("hostTools"), K = $("kinTools"); H.replaceChildren(); K.replaceChildren();
    if (mode !== "online") return;
    if (V.host) {
      H.append(el("h2", "Your table"));
      const inv = el("textarea"); inv.readOnly = true; inv.rows = 3; inv.value = V.host.invite; inv.className = "invite";
      H.append(el("div", "Invite code: send it to up to four friends. Anyone with it can ask to sit down; you admit them.", "note"), inv, btn("Copy invite code", () => { inv.select(); try { navigator.clipboard.writeText(inv.value); } catch {} try { document.execCommand("copy"); } catch {} flash("Invite code copied."); }, "sm"));
      const sel = el("select"); Games.list.forEach((x) => { const o = el("option", x.name); o.value = x.id; o.selected = x.id === c.T.game; sel.append(o); });
      sel.onchange = () => cmd({ t: "settings", game: sel.value });
      const lab = el("label", "Game (changes between rounds)"); lab.append(sel); H.append(lab);
      const bots = el("div", null, "seg"); [0, 1, 2, 3, 4].forEach((n) => bots.append(btn(String(n), () => cmd({ t: "settings", botN: n }), V.host.settings.botN === n ? "on" : "")));
      const tm = el("div", null, "seg"); [15, 30, 45, 90].forEach((n) => tm.append(btn(n + " s", () => cmd({ t: "settings", timer: n }), V.host.settings.timer === n ? "on" : "")));
      const o1 = el("div", null, "opt"); o1.append(el("span", "Computer players (free)"), bots); const o2 = el("div", null, "opt"); o2.append(el("span", "Time to bet or move"), tm); H.append(o1, o2);
      for (const w of V.host.waiting) { const r = el("div", null, "row ask"); r.append(el("b", `${w.name}${w.kin ? " with " + w.kin : ""} wants to sit down`, "grow"), btn("Admit", () => cmd({ t: "admit", member: w.id }), "go sm"), btn("Decline", () => cmd({ t: "decline", member: w.id }), "sm")); H.append(r); }
      for (const m of V.host.members) { const r = el("div", null, "row"); r.append(el("span", m.name, "grow"), btn("Remove", () => cmd({ t: "kick", member: m.id }), "sm danger")); H.append(r); }
    } else H.append(el("p", V.joined ? (V.online === false ? "The host's table hasn't been heard from in a while." : "You're seated at the host's table.") : V.joinError || "Waiting for the host to let you sit down…", "note"));
    K.append(el("h2", "Your Kin at this table"));
    const row = el("div", null, "row kinpick"); kinRow(row, V.kinId || "", (id) => { cmd({ t: "bring", kinId: id }); flash(id ? "Seating your Kin…" : "Standing your Kin up…"); }, true); K.append(row);
    K.append(el("p", "Your Kin is asked once when it sits down (style, lucky number, hello). Its bets after that are free. Its chat lines are drafts only you see until you tap Post.", "note"));
    const cap = el("div", null, "seg"); [10, 20, 40, 80].forEach((n) => cap.append(btn(String(n), () => cmd({ t: "kinCap", n }), V.kinUse.cap === n ? "on" : "")));
    const o3 = el("div", null, "opt"); o3.append(el("span", "Most Kin requests per hour"), cap); K.append(o3);
    const tk = el("label", null, "chk"), cb = el("input"); cb.type = "checkbox"; cb.checked = V.kinTalk; cb.onchange = () => cmd({ t: "kinTalk", on: cb.checked }); tk.append(cb, " Let my Kin draft replies when someone @mentions it"); K.append(tk);
  }
  $("sSound").onchange = () => { Sfx.on = $("sSound").checked; $("bSnd").setAttribute("aria-pressed", String(Sfx.on)); };
  $("sMotion").onchange = () => { prefs.motion = $("sMotion").checked; store.set("prefs", prefs); document.body.classList.toggle("nomotion", !animOn()); };
  $("bSnd").onclick = () => { Sfx.on = !Sfx.on; $("bSnd").setAttribute("aria-pressed", String(Sfx.on)); };

  // ---------- online: the app's view ----------
  function sync() {
    const online = V && V.mode !== "off" && (V.mode === "host" || V.joined) && V.table;
    if (mode !== "solo") {
      if (online && mode !== "online") { mode = "online"; enterGame(); }
      else if (!online && mode === "online") { mode = "lounge"; toLounge(); }
    }
    $("onlineBar").hidden = mode !== "online";
    if (mode === "lounge") { $("note0").textContent = V ? (V.mode === "member" && !V.joined ? (V.joinError || V.note || "Waiting for the host…") : V.note || "") : ""; buildLounge(); }
    else draw();
    checkAlive();
  }
  // Kins saved in Kin Relay arrive from the page around this screen; the table app's own list (V.kins) only fills in when that is empty.
  if (window.KRKins) window.KRKins.onChange((l) => { if (l.length) { kins = l.map((k) => ({ id: k.id, name: k.name })); buildLounge(); } });
  window.addEventListener("message", (e) => {
    const d = e.data || {};
    if (d.id && waiting[d.id]) { const f = waiting[d.id]; delete waiting[d.id]; f(d); }
    if (d.kin === "kins") { kins = Array.isArray(d.kins) ? d.kins.filter((k) => k && k.id).map((k) => ({ id: String(k.id), name: String(k.name || "Kin").slice(0, 40) })) : []; if (typeof d.current === "string" && kins.some((k) => k.id === d.current)) kinPick = d.current; buildLounge(); return; }
    if (d.kin === "files.write" && d.path && d.path.startsWith("cmds/") && d.ok) { requestWake(); return; }
    if (d.kin === "action" && d.name === "wake") { wakeBusy = false; if (!d.ok && d.summary) flash(d.summary); poll(); if (wakeAgain) { wakeAgain = false; requestWake(); } return; }
    if (d.kin === "files.read" && d.path === "view.json" && d.body && mode !== "solo") {
      if (d.body === lastBody) return;
      lastBody = d.body; lastChange = Date.now();
      try { V = JSON.parse(d.body); } catch { return; }
      if (V.kins && !kins.length) kins = V.kins;
      sync();
    }
  });
  function checkAlive() {
    const t = Date.now(), down = (!lastChange && t - loadAt > 8000) || (pressAt && lastChange < pressAt && t - pressAt > 30000);
    const txt = !lastChange && t - loadAt <= 8000 ? "Checking…" : down ? "Not running" : "Running";
    ["", "0"].forEach((s) => { $("runDot" + s).className = "dot" + (down || !lastChange ? "" : " on"); $("runTxt" + s).textContent = txt; $("startBtn" + s).hidden = !down; $("startBtn" + s).textContent = startAt ? "Retry" : "Start"; });
  }
  ["startBtn", "startBtn0"].forEach((b) => ($(b).onclick = () => { startAt = pressAt = Date.now(); $("runTxt").textContent = $("runTxt0").textContent = "Starting…"; requestWake(); }));
  // A timer can run out while nobody presses anything: ask the app to check in, only while a person uses this screen.
  function nudge() {
    const T = V && V.table; if (mode !== "online" || !T || Date.now() - lastUse > 10 * 60000) return;
    if (T.deadline && Date.now() > T.deadline + 1000 && Date.now() - lastNudge > 15000) { lastNudge = Date.now(); cmd({ t: "nudge" }); }
  }

  // ---------- keys ----------
  document.addEventListener("pointerdown", () => { lastUse = Date.now(); Sfx.unlock(); }, true);
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = (e.target.tagName || "").toLowerCase(), k = e.key.toLowerCase();
    if (tag === "textarea" || tag === "input" || tag === "select") return;
    if (k === "escape") { if (!$("panel").hidden || !$("drawer").hidden) closePanels(); else if (mode === "solo") toLounge(); return; }
    if (mode === "lounge") return;
    const c = cur(); if (!c) return; lastUse = Date.now();
    const r = c.T.round, turn = r.phase === "play" && r.R && r.R.turn === c.me && !busy;
    if (k === "m") return $("bSnd").click();
    if (k === "t") return $("bChat").hidden || $("bChat").click();
    if (turn) { const o = mode === "solo" ? Table.options(S.T, ME) : G(c.T.game).options(r.R, c.me, seatOf(c.T, c.me).stack), m = o.find((a) => ACT[a][1].toLowerCase() === k); if (m) { e.preventDefault(); act(m); } return; }
    if (/^[1-6]$/.test(k)) { const b = $("chips").children[+k - 1]; if (b) b.click(); return; }
    const onSpot = e.target.classList && e.target.classList.contains("spot");
    if (tag === "button" && (k === " " || (k === "enter" && !onSpot))) return; // Space adds a chip to a focused spot; Enter plays
    if (k === "enter" || k === " ") { e.preventDefault(); if (Stage.reveal) Stage.reveal(); else play(); }
    else if (k === "c") clearBets(); else if (k === "r") rebet();
  });

  // ---------- start ----------
  Stage.mount($("show"));
  $("sprite").innerHTML = Art.sprite;
  $("myname").value = store.get("name", "");
  bank = Object.assign(bank, store.get("bank", {}));
  post({ kin: "files.read", path: "bank.json" }).then((m) => { try { const b = m && m.body && JSON.parse(m.body); if (b && typeof b.me === "number") { bank = Object.assign({ kins: {}, intros: {} }, b); buildLounge(); } } catch {} });
  parent.postMessage({ kin: "kins" }, "*");
  document.body.classList.toggle("nomotion", !animOn());
  setTab("tSolo"); $("bSnd").setAttribute("aria-pressed", String(Sfx.on));
  poll(); checkAlive();
  setInterval(() => { poll(); checkAlive(); nudge(); if (mode === "online") draw(); }, 2000);
  return { mode: () => (mode === "online" && V ? V.mode : mode), leaveForQuit, state: () => ({ mode, V, S, bank, pend, picks, busy }), play, bet, act, open: (id, t) => { if (t) setTab(t); openGame(id); }, back: toLounge, pick: togglePick };
})();
