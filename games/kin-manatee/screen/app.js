// Cards Against Kin-manatee screen. Three situations share one table renderer:
//   menu   : choose Solo (free), My Kins, Host or Join
//   solo   : Free play against computer players, entirely in this screen (solo.js): no Kin, no app runs, no files
//   online : a hosted or joined table, or play with your Kins: the app's run writes view.json, this screen sends commands
const App = (() => {
  const $ = (i) => document.getElementById(i);
  const el = (tag, txt, cls) => { const e = document.createElement(tag); if (txt != null) e.textContent = txt; if (cls) e.className = cls; return e; };
  const btn = (txt, fn, cls) => { const b = el("button", txt, cls); b.onclick = (e) => { e.stopPropagation(); fn(e); }; return b; };
  const store = { get: (k, d) => { try { const v = localStorage.getItem("manatee-" + k); return v == null ? d : JSON.parse(v); } catch { return d; } }, set: (k, v) => { try { localStorage.setItem("manatee-" + k, JSON.stringify(v)); } catch {} } };
  const RULES = [["gambling", "Gambling"], ["rando", "Random Manatee"], ["wheaton", "Wheaton's Law"], ["packingHeat", "Packing Heat"], ["meritocracy", "Meritocracy"], ["reboot", "Rebooting the Universe"], ["neverHave", "Never Have I Ever"]];
  const RULE_ABOUT = { gambling: "Bet a point on an extra answer", rando: "An imaginary player plays a random card", wheaton: "The Czar picks one of two prompts", packingHeat: "An extra card before a Pick 2", meritocracy: "The winner is the next Czar", reboot: "Trade a point to swap cards", neverHave: "Discard cards you don't get" };

  let mode = "menu", V = null, SV = null, lastBody = "", lastChange = 0, loadAt = Date.now(), pressAt = 0, startAt = 0;
  let wakeBusy = false, wakeAgain = false, wakeAt = 0, lastUse = Date.now(), lastNudge = 0, flashText = "", flashAt = 0;
  let chan = "chat", seenTs = { chat: 0, ooc: 0 }, settingsLoaded = false, panelOpen = false;
  let sel = [], selKey = "", selRound = -1, chosenKin = null, soloSel = null;
  const opts = Object.assign({ n: 3, target: 5, rules: { gambling: true } }, store.get("solo", {}));
  const prefs = Object.assign({ motion: true }, store.get("prefs", {}));
  const rmq = window.matchMedia ? matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
  const animOn = () => prefs.motion && !rmq.matches;
  const view = () => (mode === "solo" ? SV : V);

  // ---------- talking to the app (online only) ----------
  function requestWake() { if (wakeBusy && Date.now() - wakeAt < 30000) { wakeAgain = true; return; } wakeBusy = true; wakeAt = Date.now(); parent.postMessage({ kin: "action", name: "wake", input: {} }, "*"); }
  const send = (c) => { pressAt = Date.now(); parent.postMessage({ kin: "files.write", path: "cmds/" + Date.now() + "-" + Math.random().toString(36).slice(2, 8) + ".json", body: JSON.stringify(c) }, "*"); };
  const poll = () => { if (mode !== "solo") parent.postMessage({ kin: "files.read", path: "view.json" }, "*"); };
  function flash(t) { flashText = t; flashAt = Date.now(); $("note0").textContent = t; showNote(); if (mode !== "solo") setTimeout(showNote, 5200); }
  const showNote = () => { const v = view(); $("note").textContent = Date.now() - flashAt < 5000 ? flashText : v && v.note ? v.note : ""; };
  function copyText(t) {
    try { const a = document.createElement("textarea"); a.value = t; a.setAttribute("readonly", ""); a.style.cssText = "position:fixed;top:0;left:0;opacity:0"; document.body.append(a); a.select(); a.setSelectionRange(0, t.length); const ok = document.execCommand("copy"); a.remove(); if (ok) return flash("Copied."); } catch {}
    if (navigator.clipboard) navigator.clipboard.writeText(t).then(() => flash("Copied."), () => flash("Copy blocked: select the code and copy it."));
  }
  window.addEventListener("message", (e) => {
    const d = e.data || {};
    if (d.kin === "files.write" && d.path && d.path.startsWith("cmds/") && d.ok) { requestWake(); return; }
    if (d.kin === "action" && d.name === "wake") { wakeBusy = false; if (!d.ok && d.summary) flash(d.summary); poll(); if (wakeAgain) { wakeAgain = false; requestWake(); } return; }
    if (d.kin === "files.read" && d.path === "view.json" && d.body && mode !== "solo") {
      if (d.body === lastBody) return;
      lastBody = d.body; lastChange = Date.now();
      try { V = JSON.parse(d.body); } catch { return; }
      sync();
    }
  });

  // ---------- menu ----------
  function seg(box, items, isOn, pick) { box.replaceChildren(...items.map(([val, label]) => btn(label, () => { pick(val); refresh(); }, isOn(val) ? "on" : ""))); }
  const refresh = () => { buildMenu(); if (mode !== "menu") draw(true); };
  const saveOpts = () => store.set("solo", opts);
  const nums = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => [a + i, String(a + i)]);
  let kBots = 0, hBots = 0;
  function buildMenu() {
    seg($("oN"), nums(2, 5), (n) => n === opts.n, (n) => { opts.n = n; saveOpts(); });
    seg($("oPts"), [3, 5, 7].map((n) => [n, n + " points"]), (n) => n === opts.target, (n) => { opts.target = n; saveOpts(); });
    $("oRules").replaceChildren(...RULES.map(([k, label]) => { const b = btn(label, () => { opts.rules[k] = !opts.rules[k]; saveOpts(); buildMenu(); }, opts.rules[k] ? "on" : ""); b.title = RULE_ABOUT[k]; b.setAttribute("aria-pressed", String(!!opts.rules[k])); return b; }));
    $("oPreview").replaceChildren(...Bots.CAST.slice(0, opts.n).map((b) => { const s = el("span"); s.innerHTML = Art.avatar(b.name, "bot", b.id); s.append(document.createTextNode(`${b.name} · likes ${b.taste} answers`)); return s; }));
    seg($("kBots"), nums(0, 4), (n) => n === kBots, (n) => { kBots = n; });
    seg($("hBots"), nums(0, 4), (n) => n === hBots, (n) => { hBots = n; });
  }
  const TABS = { tSolo: "pSolo", tKins: "pKins", tHost: "pHost", tJoin: "pJoin" };
  function setTab(t) {
    for (const [b, p] of Object.entries(TABS)) { $(p).hidden = b !== t; $(b).className = b === t ? "on" : ""; $(b).setAttribute("aria-selected", String(b === t)); }
    $("bringBox").hidden = !(t === "tHost" || t === "tJoin");
    $("menuBar").hidden = t === "tSolo"; $("note0").hidden = t === "tSolo"; // Solo never talks to the app, so it has no run status
  }
  for (const t of Object.keys(TABS)) $(t).onclick = () => setTab(t);
  const myName = () => $("myname").value.trim() || "Player";
  $("doSolo").onclick = () => {
    Sfx.unlock(); lastUse = Date.now();
    Solo.start({ name: myName(), n: opts.n, rules: { target: opts.target, ...Object.fromEntries(RULES.map(([k]) => [k, !!opts.rules[k]])) } });
    mode = "solo"; seen.reset(); closePanels(); sync(); Sfx.play("shuffle"); setTimeout(() => Solo.deal(), 450);
  };
  function pickKin(id, atTable) { chosenKin = id; send({ t: "bring", kinId: id }); if (atTable) flash(id ? "Seating your Kin…" : "Standing your Kin up…"); build(); }
  function toggleSolo(id) { const cur = (soloSel || (V && V.kinIds) || []).slice(), i = cur.indexOf(id); if (i >= 0) cur.splice(i, 1); else if (cur.length < 10) cur.push(id); else return flash("Ten Kins is the most a table can hold."); soloSel = cur; send({ t: "soloKins", kinIds: cur }); build(); }
  $("doKins").onclick = () => { const ids = soloSel || (V && V.kinIds) || []; if (!ids.length) return flash("Choose at least one Kin to play with."); if (ids.length + kBots < 2) return flash("A round needs three players: choose another Kin or add a computer player."); send({ t: "soloKins", kinIds: ids }); send({ t: "host", solo: true, bots: kBots, name: $("myname").value, table: "Solo with my Kins" }); flash("Opening a table with your Kins…"); };
  $("myname").onchange = () => { store.set("name", $("myname").value); if (mode !== "solo") send({ t: "name", name: $("myname").value }); };
  $("doHost").onclick = () => { send({ t: "bring", kinId: chosenKin ?? (V && V.kinId) ?? "" }); send({ t: "host", bots: hBots, name: $("myname").value, table: $("tName").value }); flash("Opening the table…"); };
  $("doJoin").onclick = () => { send({ t: "bring", kinId: chosenKin ?? (V && V.kinId) ?? "" }); send({ t: "join", name: $("myname").value, code: $("jCode").value }); flash("Asking to sit down…"); };

  // ---------- views and flow ----------
  function sync() {
    const online = mode !== "solo" && V && V.mode !== "off";
    if (mode !== "solo") mode = online ? "online" : "menu";
    $("menu").hidden = mode !== "menu"; $("game").hidden = mode === "menu";
    $("onlineTools").hidden = mode === "solo"; $("onlineBar").hidden = mode !== "online";
    document.body.classList.toggle("nomotion", !animOn());
    if (mode === "menu") { buildMenu(); buildMenuKins(); if (V && !$("myname").value) $("myname").value = V.me.name || store.get("name", ""); showNote(); $("note0").textContent = V ? V.note || "" : ""; checkAlive(); return; }
    if (mode === "solo") SV = Solo.view();
    draw();
  }
  function buildMenuKins() {
    const kins = (V && V.kins) || [], cur = chosenKin ?? ((V && V.kinId) || "");
    if (chosenKin !== null && chosenKin === ((V && V.kinId) || "")) chosenKin = null;
    $("bring").replaceChildren(...[{ id: "", name: "Just me" }].concat(kins).map((k) => btn(k.name, () => pickKin(k.id, false), k.id === cur ? "on" : "")));
    if (!kins.length) $("bring").append(el("span", "Attach a Kin to this app in Kindroid to bring one.", "note"));
    if (soloSel && JSON.stringify(soloSel) === JSON.stringify((V && V.kinIds) || [])) soloSel = null;
    const s = soloSel || (V && V.kinIds) || [];
    for (const box of [$("soloPick"), $("soloPick2")]) {
      box.replaceChildren(...kins.map((k) => btn((s.includes(k.id) ? "✓ " : "") + k.name, () => toggleSolo(k.id), s.includes(k.id) ? "on" : "")));
      if (!kins.length) box.append(el("span", "Attach Kins to this app in Kindroid to play with them.", "note"));
    }
    $("soloNote").textContent = `${s.length} of 10 chosen.`;
  }
  const build = () => { buildMenuKins(); if (mode !== "menu") draw(true); };
  function leaveForQuit() {
    if (mode === "solo") { Solo.stop(); return; }
    if (!V || V.mode === "off") return;
    return new Promise((res) => { addEventListener("message", function h(e) { const d = e.data || {}; if (d.kin === "action" && d.name === "wake") { removeEventListener("message", h); res(); } }); send({ t: "leave" }); });
  }
  let armed = 0;
  $("back").onclick = () => {
    if (Date.now() - armed > 3500) { armed = Date.now(); $("back").textContent = "Leave?"; setTimeout(() => { if (Date.now() - armed >= 3400) $("back").textContent = "←"; }, 3500); return; }
    armed = 0; $("back").textContent = "←";
    if (mode === "solo") { Solo.stop(); mode = "menu"; SV = null; seen.reset(); closePanels(); sync(); } else send({ t: "leave" });
  };
  $("leave").onclick = () => { armed = 0; $("back").onclick(); $("back").onclick(); };

  // ---------- cards ----------
  const MK = '<svg class="mk" viewBox="0 0 120 80" aria-hidden="true"><use href="#manatee"/></svg>';
  function mkCard(cls, text, tag, interactive) {
    const c = el(interactive ? "button" : "div", null, "card " + cls); if (interactive) c.type = "button";
    c.insertAdjacentHTML("beforeend", MK); const t = el("span", text); c.append(t, el("span", tag, "tag")); return c;
  }
  const promptCard = (text, pick, interactive) => { const c = mkCard("prompt", text, "Kin-manatee", interactive); if (pick > 1) c.append(el("span", "PICK " + pick, "pk")); return c; };
  const answerCard = (text, interactive) => mkCard("answer", text, "Kin-manatee", interactive);
  function backCard(mini) { const c = el("div", null, "card back" + (mini ? " mini" : "")); c.insertAdjacentHTML("beforeend", '<svg viewBox="0 0 120 80" aria-hidden="true"><use href="#manatee"/></svg>'); c.append(el("span", "Kin-manatee", "tag")); return c; }

  // ---------- animation helpers ----------
  const seen = { round: -1, phase: "", hand: new Set(), reveal: "", scores: {}, result: "", toast: new Set(),
    reset() { this.armed = false; this.round = -1; this.phase = ""; this.hand = new Set(); this.reveal = ""; this.scores = {}; this.result = ""; achPrimed = false; selRound = -1; sel = []; selKey = ""; } };
  function burst(node) {
    if (!animOn() || !node || !node.animate) return;
    const r = node.getBoundingClientRect();
    for (let i = 0; i < 16; i++) {
      const b = el("div", null, "bub"), s = 6 + Math.random() * 14; b.style.cssText = `left:${r.left + Math.random() * r.width}px;top:${r.top + r.height * (0.4 + Math.random() * 0.5)}px;width:${s}px;height:${s}px`; document.body.append(b);
      const a = b.animate([{ transform: "translate(0,0)", opacity: 0.9 }, { transform: `translate(${(Math.random() - 0.5) * 90}px,${-90 - Math.random() * 160}px)`, opacity: 0 }], { duration: 1100 + Math.random() * 900, delay: Math.random() * 250, easing: "ease-out", fill: "both" });
      a.onfinish = () => b.remove();
    }
    Sfx.play("bubble");
  }

  // ---------- drawing the table ----------
  const kindLabel = (s, v) => (s.id === "h:" + v.me.id ? "you" : s.kind === "kin" ? "Kin" : s.kind === "bot" ? "computer" : "player");
  function drawScore(T, v) {
    const box = $("score"), rows = T.seats.slice(), keep = box.scrollLeft;
    const els = rows.map((s) => {
      const d = el("div", null, "who" + (s.czar ? " czar" : "") + (s.id === "h:" + v.me.id ? " me" : "") + (T.phase === "picking" && !s.czar && s.played ? " done" : ""));
      d.innerHTML = (s.czar ? Art.crown : "") + Art.avatar(s.name, s.kind, s.botId);
      const t = el("div"); t.append(el("b", s.name), el("small", kindLabel(s, v) + (s.czar ? " · Czar" : "")));
      d.append(t, el("span", String(s.score), "pts"));
      if (seen.scores[s.id] != null && s.score > seen.scores[s.id] && animOn()) d.classList.add("pop");
      seen.scores[s.id] = s.score; return d;
    });
    if (T.rando != null) { const d = el("div", null, "who"); d.innerHTML = Art.avatar("?", "bot", "wavy"); const t = el("div"); t.append(el("b", "Random Manatee"), el("small", "imaginary")); d.append(t, el("span", String(T.rando), "pts")); els.push(d); }
    box.replaceChildren(...els); box.scrollLeft = keep;
  }
  function statusLine(T, v, isCzar, M) {
    const host = v.mode === "host" || v.mode === "solo";
    const w = T.waitingOn.join(", ") || "nobody";
    return ({ lobby: host ? "Everyone is seated. Deal the first round!" : "Waiting for the host to deal the first round.",
      choosing: isCzar ? "You're the Czar: choose a prompt card." : `${T.czarName} is choosing the prompt card.`,
      picking: isCzar ? `You're the Manatee Czar. Waiting on: ${w}.` : M && M.played ? `Card played. Waiting on: ${w}.` : "Play your funniest answer.",
      judging: isCzar ? "Pick the funniest answer!" : `${T.czarName} is picking the winner…`,
      result: T.result && T.result.void ? T.result.text : host ? "Ready for the next round?" : "Waiting for the host to deal the next round.",
      over: host ? "Start a new game to play again." : "Waiting for the host to start a new game." })[T.phase] || "";
  }
  const act = (ev) => {
    lastUse = Date.now();
    if (mode === "solo") { const e = Solo.act(ev); if (e) flash(e); }
    else send(ev);
  };
  function draw(force) {
    const v = view();
    if (!v) return;
    const T = v.table;
    $("game").hidden = false;
    showNote();
    if (!T) { $("status").textContent = v.mode === "member" ? (v.joinStage === "failed" ? v.joinError : "Waiting for the host to let you in…") : "Opening…"; $("score").replaceChildren(); $("answers").replaceChildren(); $("promptBox").replaceChildren(backCard()); $("hand").replaceChildren(); $("acts").replaceChildren(); return; }
    const meSeat = "h:" + v.me.id, isCzar = T.czar === meSeat, R = T.settings.rules, M = v.mine, host = v.mode === "host" || v.mode === "solo";
    const pick = T.prompt ? T.prompt.pick : 1, canPlay = T.phase === "picking" && !isCzar && !!M;
    if (T.round !== selRound) { sel = []; selKey = ""; selRound = T.round; }
    const newRound = seen.round !== T.round;
    $("title").textContent = v.mode === "solo" ? "Solo · free" : T.name;
    $("sub").textContent = `Round ${T.round || 0} · ${R.target ? `first to ${R.target}` : "no point limit"}${T.ending ? " · final round" : ""}${T.settings.paused ? " · paused" : ""}`;
    drawScore(T, v);
    renderAch(T);
    // the prompt card
    const c = T.prompt ? promptCard(T.prompt.text, T.prompt.pick) : backCard();
    if (T.prompt && animOn() && seen.armed && (newRound || seen.phase === "choosing")) c.classList.add("dealin");
    $("promptBox").replaceChildren(c);
    // the answers on the table
    const ans = $("answers"); ans.replaceChildren();
    const revealKey = T.reveal.map((r) => r.key).join(",") + T.phase;
    const flipNew = revealKey !== seen.reveal && T.phase === "judging" && animOn();
    if (T.phase === "picking") { for (let i = 0; i < T.answersIn; i++) { const b = backCard(true); if (animOn() && i >= (seen.played || 0)) b.classList.add("dealin"); ans.append(b); } seen.played = T.answersIn; }
    else seen.played = 0;
    if (mine_choices(M).length) M.choices.forEach((t, i) => { const c = promptCard(t, (t.match(/____/g) || []).length, true); c.classList.add("pickable"); c.onclick = () => act({ t: "choose", which: i, round: T.round }); ans.append(c); });
    T.reveal.forEach((r, i) => {
      const f = mkCard("filled", r.text, "Kin-manatee", T.phase === "judging" && isCzar);
      if (r.who) f.append(el("span", "played by " + r.who, "by"));
      if (flipNew) { f.classList.add("flipin"); f.style.animationDelay = i * 120 + "ms"; }
      if (T.result && T.result.key === r.key) f.classList.add("win"); else if (T.result && !T.result.void) f.classList.add("dim");
      if (T.phase === "judging" && isCzar) { f.classList.add("pickable"); if (selKey === r.key) { f.classList.add("sel"); f.setAttribute("aria-pressed", "true"); } f.onclick = () => { selKey = selKey === r.key ? "" : r.key; Sfx.play("pick"); draw(true); }; }
      ans.append(f);
    });
    seen.reveal = revealKey;
    // result: confetti of bubbles over the winning card, and the banner
    const resKey = T.result ? T.round + ":" + (T.result.key || "void") : "";
    if (resKey && resKey !== seen.result) { seen.result = resKey; if (seen.armed) { const w = ans.querySelector(".win"); setTimeout(() => burst(w), 60); if (mode === "online") Sfx.play(T.result.winner === meSeat ? "win" : "flip"); } }
    if (!resKey) seen.result = "";
    $("banner").replaceChildren(...(T.over ? [el("span", `🏆 ${T.over.leaders.join(" and ") || "Nobody"} ${T.over.leaders.length > 1 ? "take" : "takes"} the game!`, "win")]
      : T.result && !T.result.void ? [el("span", `🏆 ${T.result.winnerName} wins the round!`, "win")] : T.result ? [el("span", T.result.text)] : []));
    // the dock: status, timer and buttons
    $("status").textContent = statusLine(T, v, isCzar, M);
    drawActs(v, T, M, isCzar, canPlay, host, R, pick);
    // my hand
    const hand = $("hand"), keepScroll = hand.scrollLeft; hand.replaceChildren();
    $("handWrap").hidden = !M;
    if (M) {
      const prevHand = seen.hand, lim = canPlay ? pick : 10;
      M.hand.forEach((c, i) => {
        const d = answerCard(c.text, true); d.classList.add("pickable"); d.setAttribute("role", "option");
        if (i < 10) d.insertAdjacentHTML("afterbegin", `<span class="key">${(i + 1) % 10}</span>`);
        if (isCzar && ["picking", "judging"].includes(T.phase)) d.classList.add("dim");
        if (animOn() && !prevHand.has(c.id) && prevHand.size) { d.classList.add("dealin"); d.style.animationDelay = i * 40 + "ms"; }
        const at = sel.indexOf(c.id);
        if (at >= 0) { d.classList.add("sel"); d.setAttribute("aria-selected", "true"); if (pick > 1 && canPlay) d.append(el("span", String(at + 1), "ord")); }
        d.onclick = () => toggleCard(c.id, lim);
        hand.append(d);
      });
      hand.scrollLeft = keepScroll;
      seen.hand = new Set(M.hand.map((c) => c.id));
      $("handTxt").textContent = isCzar && ["picking", "judging"].includes(T.phase) ? "You're the Czar this round: no card to play." : canPlay ? (M.played ? "Your answer is in." : pick > 1 ? `Tap ${pick} cards, in the order they fill the blanks.` : "Tap the card you find funniest.") : "Your hand";
      $("keysTxt").textContent = "Keys: 1–9, 0 pick · Enter plays";
    }
    seen.round = T.round; seen.phase = T.phase; seen.armed = true;
    drawPanel(v, T, force); drawDrawer(v, T);
    if (mode === "online") checkAlive();
    timerTick();
  }
  const mine_choices = (M) => (M && M.choices) || [];
  function toggleCard(id, lim) {
    const i = sel.indexOf(id); Sfx.play("pick");
    if (i >= 0) sel.splice(i, 1); else { sel.push(id); if (sel.length > lim) sel.shift(); }
    draw(true);
  }
  function drawActs(v, T, M, isCzar, canPlay, host, R, pick) {
    const a = $("acts"); a.replaceChildren();
    const myScore = (T.seats.find((s) => s.id === "h:" + v.me.id) || {}).score || 0;
    if (host && ["lobby", "result", "over"].includes(T.phase)) {
      const b = btn(T.phase === "over" ? "Start a new game" : T.phase === "lobby" ? "Deal the first round" : "Next round", () => { act({ t: T.phase === "over" ? "newGame" : "next" }); }, "go");
      b.append(el("kbd", "N")); a.append(b);
      if (T.nextAt && T.phase === "result" && v.mode !== "solo") a.append(el("span", "The next round starts on its own in a moment.", "note"));
    }
    if (canPlay && !M.played) { const b = btn(pick > 1 ? `Play these ${pick}` : "Play this card", () => doPlay(false, T, pick), "go"); b.disabled = sel.length !== pick; b.append(el("kbd", "Enter")); a.append(b); }
    if (canPlay && M.played && R.gambling && !M.bet && myScore > 0) a.append(btn("Bet a point on an extra answer", () => doPlay(true, T, pick)));
    if (M && R.reboot && myScore > 0) { const b = btn("Reboot the universe (−1 point)", () => { act({ t: "swap", mode: "reboot", cards: sel.slice(), round: T.round }); sel = []; }); b.disabled = !sel.length; a.append(b); }
    if (M && R.neverHave) { const b = btn("Never have I ever (discard)", () => { act({ t: "swap", mode: "never", cards: sel.slice(), round: T.round }); sel = []; }); b.disabled = !sel.length; a.append(b); }
    if (T.phase === "judging" && isCzar) { const b = btn("Crown this answer", () => doJudge(T), "go"); b.disabled = !selKey; b.append(el("kbd", "Enter")); a.append(b); }
  }
  function doPlay(gamble, T, pick) { if (sel.length !== pick) return flash(`Choose ${pick} card${pick > 1 ? "s" : ""} first.`); act({ t: "play", cards: sel.slice(), gamble, round: T.round }); sel = []; if (mode !== "solo") flash(gamble ? "Extra answer sent…" : "Card played face down…"); }
  function doJudge(T) { if (!selKey) return flash("Tap an answer first."); act({ t: "judge", key: selKey, round: T.round }); selKey = ""; if (mode !== "solo") flash("Sending your pick…"); }

  // ---------- chat, awards and settings ----------
  function openPanel(on) { panelOpen = on; $("panel").hidden = !on; if (on) { $("drawer").hidden = true; drawPanel(view(), view().table, true); } }
  function closePanels() { $("panel").hidden = true; $("drawer").hidden = true; panelOpen = false; }
  $("bChat").onclick = () => openPanel(!panelOpen); $("closePanel").onclick = () => openPanel(false);
  $("gear").onclick = (e) => { e.stopPropagation(); $("drawer").hidden = !$("drawer").hidden; if (!$("drawer").hidden) { $("panel").hidden = true; panelOpen = false; settingsLoaded = false; draw(true); } };
  $("closeDrawer").onclick = () => { $("drawer").hidden = true; };
  $("ptabs").onclick = (e) => { const t = e.target.dataset && e.target.dataset.t; if (!t) return; chan = t; drawPanel(view(), view().table, true); };
  const doSend = () => { const t = $("say").value.trim(); if (!t) return; lastUse = Date.now(); send({ t: chan === "ooc" ? "ooc" : "say", text: t }); $("say").value = ""; };
  $("send").onclick = doSend; $("say").onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); doSend(); } };
  function drawPanel(v, T, force) {
    const solo = v.mode === "solo", tabs = $("ptabs").children;
    if (solo && chan === "ooc") chan = "chat";
    for (const b of tabs) { b.hidden = solo && b.dataset.t === "ooc"; b.classList.toggle("on", b.dataset.t === chan); if (b.dataset.t === "chat") b.textContent = solo ? "Log" : "Chat"; }
    const unreadOf = (c) => (c === "ooc" ? v.ooc : v.chat).filter((m) => m.ts > seenTs[c] && m.owner !== v.me.id && m.kind !== "dealer").length;
    const lastTs = (l) => (l.length ? l[l.length - 1].ts : 0);
    if (panelOpen && (chan === "chat" || chan === "ooc")) seenTs[chan] = Math.max(seenTs[chan], lastTs(chan === "ooc" ? v.ooc : v.chat));
    const badge = solo ? 0 : unreadOf("chat") + unreadOf("ooc");
    $("unread").hidden = !badge; $("unread").textContent = badge;
    $("bChat").firstChild.textContent = solo ? "Log" : "Chat";
    if (!panelOpen) return;
    $("sayRow").hidden = solo || !(chan === "chat" || chan === "ooc") || (v.mode === "member" && !v.joined);
    $("say").placeholder = chan === "ooc" ? "Out of character: people only, never a Kin" : "Say something to the table (@Name talks to a Kin)";
    const box = $("pBody"), atEnd = box.scrollTop + box.clientHeight >= box.scrollHeight - 30;
    const key = JSON.stringify([chan, v.chat.length && v.chat[v.chat.length - 1].id, v.ooc.length && v.ooc[v.ooc.length - 1].id, (v.pendingChat || []).length, (v.pendingOoc || []).length, JSON.stringify(T && T.ach).length, String((T && T.typing) || "")]);
    if (key === box.dataset.key && !force) return; box.dataset.key = key; box.replaceChildren();
    if (chan === "ach") renderAchList(box, T);
    else {
      const list = chan === "ooc" ? v.ooc : v.chat, pend = (chan === "ooc" ? v.pendingOoc : v.pendingChat) || [];
      if (chan === "ooc") box.append(el("div", "Out-of-character chat for the people at the table. The Kins never see it.", "msg dealer"));
      list.forEach((m) => { const d = el("div", null, "msg " + (m.kind === "kin" ? "kin " : "") + (m.kind === "dealer" ? "dealer " : "") + (m.owner === v.me.id && m.kind === "person" ? "mine-m" : "")); d.append(el("div", m.kind === "dealer" ? (m.who === "The Manatee" ? "" : m.who + ": ") + m.text : m.text)); if (m.kind !== "dealer") d.append(el("div", m.who + (m.kind === "kin" ? " (Kin)" : ""), "w")); box.append(d); });
      pend.forEach((m) => { const d = el("div", null, "msg wait mine-m"); d.append(el("div", m.text), el("div", m.who + " · sending…", "w")); box.append(d); });
      if (chan === "chat") for (const n of (T && T.typing) || []) box.append(el("div", n + " is typing…", "msg kin typing"));
    }
    if (atEnd || force) box.scrollTop = box.scrollHeight;
  }
  function renderAchList(box, T) {
    const book = (T && T.ach) || {}, g = el("div", null, "achs"); let total = 0;
    for (const a of Game.ACH) {
      const holders = Object.values(book).filter((r) => r.got && r.got[a.id]).map((r) => r.name + (r.got[a.id] > 1 ? " ×" + r.got[a.id] : "")); total += holders.length ? 1 : 0;
      const n = el("span", `${a.icon} ${a.name}`); n.append(el("span", a.about, "ab")); g.append(n, el("span", holders.length ? holders.join(", ") : "–", "who2"));
    }
    box.append(el("div", `Awards this session: ${total} of ${Game.ACH.length} won by someone`, "note"), g);
  }
  let toastQ = [], toasting = false, achPrimed = false;
  function renderAch(T) {
    if (!achPrimed) { for (const a of T.achNew || []) seen.toast.add(a.round + ":" + a.seat + ":" + a.id); achPrimed = true; return; }
    for (const a of T.achNew || []) { const k = a.round + ":" + a.seat + ":" + a.id; if (seen.toast.has(k)) continue; seen.toast.add(k); const d = Game.ACH.find((x) => x.id === a.id); if (d) toastQ.push({ d, name: a.name }); }
    if (toasting) return;
    const next = () => { const t = toastQ.shift(); if (!t) { toasting = false; return; } toasting = true; $("sealicon").textContent = t.d.icon; $("t1").textContent = t.name + " earned"; $("t2").textContent = t.d.name; $("t3").textContent = t.d.about; $("toast").classList.add("show"); Sfx.play("ach"); setTimeout(() => { $("toast").classList.remove("show"); setTimeout(next, 400); }, 2800); };
    next();
  }
  $("bSnd").onclick = () => { Sfx.on = !Sfx.on; $("bSnd").setAttribute("aria-pressed", String(Sfx.on)); $("sSound").checked = Sfx.on; };
  $("sSound").onchange = () => { Sfx.on = $("sSound").checked; $("bSnd").setAttribute("aria-pressed", String(Sfx.on)); };
  $("sMotion").onchange = () => { prefs.motion = $("sMotion").checked; store.set("prefs", prefs); document.body.classList.toggle("nomotion", !animOn()); };
  $("copyInvite").onclick = () => copyText($("invite").textContent);
  $("newGame").onclick = () => { act({ t: "newGame" }); flash("Shuffling a new game…"); };
  $("pauseBtn").onclick = () => send({ t: "pause", on: !(V && V.table && V.table.settings.paused) });
  $("endBtn").onclick = () => { act({ t: "happyEnding" }); flash("The next round will be the last."); };
  const chk = { gambling: "rGambling", rando: "rRando", reboot: "rReboot", packingHeat: "rPacking", meritocracy: "rMerit", wheaton: "rWheaton", neverHave: "rNever" };
  let sTarget = 7;
  $("saveS").onclick = () => { const c = { t: "settings", target: sTarget, pickTimer: $("sPick").value, judgeTimer: $("sJudge").value, autoNext: $("sAuto").checked, customPrompts: $("sCP").value, customAnswers: $("sCA").value }; for (const [k, id] of Object.entries(chk)) c[k] = $(id).checked; send(c); flash("Saving the rules…"); };
  function drawDrawer(v, T) {
    if ($("drawer").hidden) return;
    $("sSound").checked = Sfx.on; $("bSnd").setAttribute("aria-pressed", String(Sfx.on)); $("sMotion").checked = prefs.motion && !rmq.matches; $("sMotion").disabled = rmq.matches;
    if (v.mode === "solo") { $("leave").textContent = "Leave the game"; return; }
    $("leave").textContent = v.mode === "host" ? "Close the table" : "Leave the table";
    const host = v.mode === "host", R = T.settings.rules;
    $("hostTools").hidden = !host;
    $("memberInfo").textContent = host ? "" : `First to ${R.target || "∞"} · ${T.settings.pickTimer}s to play · ${T.settings.judgeTimer}s to judge. The host's copy shuffles and holds every card.`;
    const kinSolo = !!T.solo;
    $("kinPick").hidden = kinSolo || !v.kins.length; $("soloKinBox").hidden = !(kinSolo && host);
    const cur = chosenKin ?? (v.kinId || "");
    $("kinPick").replaceChildren(...[{ id: "", name: "Just me" }].concat(v.kins).map((k) => btn(k.name, () => pickKin(k.id, true), k.id === cur ? "on" : "")));
    buildMenuKins();
    const kb = $("kinBox"); kb.replaceChildren();
    const mine = T.seats.filter((s) => s.owner === v.me.id && s.kind === "kin");
    if (mine.length) {
      for (const s of mine) kb.append(btn(`Draft a line from ${s.name}`, () => { send({ t: "kinTalkNow", kinId: s.kinId }); flash(`Asking ${s.name} for a line…`); }));
      kb.append(btn(v.kinTalk ? "Drafts replies to @mentions: on" : "Drafts replies to @mentions: off", () => send({ t: "kinTalk", on: !v.kinTalk })));
      for (const d of v.drafts || []) { const r = el("div", null, "row"); r.style.width = "100%"; r.append(el("span", `Draft only you can see: ${d.name}${d.from ? ` (to ${d.from})` : ""}: ${d.text}`, "grow"), btn("Post", () => { send({ t: "postDraft", id: d.id }); flash("Posting…"); }, "sm"), btn("Discard", () => send({ t: "discardDraft", id: d.id }), "sm")); kb.append(r); }
      kb.append(el("span", "Most Kin requests per hour:", "note"));
      for (const n of [30, 60, 120, 240, 480]) kb.append(btn(n === v.kinUse.cap ? `${n} ✓` : String(n), () => send({ t: "kinCap", n }), "sm"));
    }
    $("creditNote").textContent = `Computer players are free. Hosting and joining run this app on Kindroid to carry cards, chat and check-ins, and that may use Kindroid credits; it stops checking in 10 minutes after the last person used the table. Each Kin card, pick or line is a Kin request on your account (used this hour: ${v.kinUse.used} of ${v.kinUse.cap}). Solo from the menu is always free.`;
    $("budget").textContent = `Deliveries: ${v.budget.sentThisHour} this hour, ${v.budget.sentToday} today, ${v.budget.queued} waiting.`;
    if (host && v.host) {
      const S = T.settings;
      $("invite").textContent = v.host.invite; $("pauseBtn").textContent = S.paused ? "Resume" : "Pause";
      $("hostTools").querySelector(".guests").hidden = kinSolo;
      if (!settingsLoaded) {
        settingsLoaded = true; sTarget = R.target; $("sPick").value = S.pickTimer; $("sJudge").value = S.judgeTimer; $("sAuto").checked = S.autoNext;
        for (const [k, id] of Object.entries(chk)) $(id).checked = !!R[k];
      }
      seg($("sTarget"), [3, 5, 7, 10, 0].map((n) => [n, n || "No limit"]), (n) => n === sTarget, (n) => { sTarget = n; });
      seg($("bN"), nums(0, 4), (n) => n === (S.bots | 0), (n) => send({ t: "settings", bots: n }));
      const w = $("waiting"); w.replaceChildren(); if (!v.host.waiting.length) w.textContent = "Nobody.";
      v.host.waiting.forEach((m) => { const r = el("div", null, "row"); r.append(el("span", m.name + (m.kin ? ` with ${m.kin}` : ""), "grow"), btn("Admit", () => send({ t: "admit", member: m.id }), "sm"), btn("Decline", () => send({ t: "decline", member: m.id }), "sm")); w.append(r); });
      const pe = $("people"); pe.replaceChildren(); if (!v.host.members.length) pe.append(el("p", "Nobody else yet.", "note"));
      v.host.members.forEach((m) => { const r = el("div", null, "row"); r.append(el("span", m.name, "grow"), btn("Remove", () => send({ t: "kick", member: m.id }), "sm")); pe.append(r); });
    }
  }

  // ---------- timer, keys, run status ----------
  const tStart = {};
  function timerTick() {
    const v = view(), T = v && v.table, bar = $("timer");
    if (!T || mode !== "online" || !T.deadline) { bar.hidden = true; return; }
    const k = T.round + T.phase; if (!tStart[k]) tStart[k] = Date.now();
    const total = Math.max(1000, T.deadline - tStart[k]), left = Math.max(0, T.deadline - Date.now());
    bar.hidden = false; bar.firstChild.style.width = Math.min(100, (left / total) * 100) + "%"; bar.title = Math.ceil(left / 1000) + " seconds left";
  }
  function checkAlive() {
    if (mode === "solo") return;
    const t = Date.now(), down = (!lastChange && t - loadAt > 8000) || (pressAt && lastChange < pressAt && t - pressAt > 30000);
    const txt = !lastChange && t - loadAt <= 8000 ? "Checking…" : down ? "Not running" : V && V.asleep && mode === "online" ? "Resting" : "Running";
    $("onlineBar").classList.toggle("ok", !down && !!lastChange && txt === "Running");
    ["", "0"].forEach((s) => { $("runDot" + s).className = "dot" + (down || !lastChange ? "" : " on"); $("runTxt" + s).textContent = txt; $("startBtn" + s).hidden = !down; $("startBtn" + s).textContent = startAt ? "Retry" : "Start"; });
  }
  ["startBtn", "startBtn0"].forEach((b) => ($(b).onclick = () => { startAt = pressAt = Date.now(); $("runTxt").textContent = $("runTxt0").textContent = "Starting…"; requestWake(); }));
  // A timer or the next round can come due while nobody presses anything: ask the app to check in, but only while a person is using this screen.
  function nudge() {
    const T = V && V.table; if (mode !== "online" || !T || Date.now() - lastUse > 10 * 60000) return;
    const due = (T.deadline && Date.now() > T.deadline) || (T.nextAt && Date.now() > T.nextAt);
    if (due && Date.now() - lastNudge > 15000) { lastNudge = Date.now(); send({ t: "nudge" }); }
  }
  document.addEventListener("pointerdown", () => { lastUse = Date.now(); Sfx.unlock(); }, true);
  document.addEventListener("keydown", (e) => {
    if (mode === "menu" || e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = (e.target.tagName || "").toLowerCase(), typing = tag === "input" || tag === "textarea";
    if (e.key === "Escape") return closePanels();
    if (typing) return;
    lastUse = Date.now();
    const v = view(), T = v && v.table, M = v && v.mine, k = e.key.toLowerCase();
    if (k === "m") { $("bSnd").onclick(); return; }
    if (k === "t" && mode === "online") { openPanel(!panelOpen); e.preventDefault(); return; }
    if (!T) return;
    const isCzar = T.czar === "h:" + v.me.id, host = v.mode === "host" || v.mode === "solo";
    if (/^[0-9]$/.test(k) && T.phase === "judging" && isCzar) { const r = T.reveal[(+k + 9) % 10]; if (r) { selKey = r.key; Sfx.play("pick"); draw(true); } e.preventDefault(); return; }
    if (/^[0-9]$/.test(k) && M) { const i = (+k + 9) % 10, c = M.hand[i]; if (c) { toggleCard(c.id, T.phase === "picking" && !isCzar ? (T.prompt ? T.prompt.pick : 1) : 10); e.preventDefault(); } return; }
    if (k === "n" && host && ["lobby", "result", "over"].includes(T.phase)) { act({ t: T.phase === "over" ? "newGame" : "next" }); return; }
    if (k === "enter" && tag !== "button") {
      const pick = T.prompt ? T.prompt.pick : 1;
      if (T.phase === "picking" && !isCzar && M && !M.played) doPlay(false, T, pick);
      else if (T.phase === "judging" && isCzar) doJudge(T);
      e.preventDefault();
    }
  });
  poll(); checkAlive(); setInterval(() => { poll(); checkAlive(); nudge(); timerTick(); }, 1000 * 2);
  setInterval(timerTick, 1000);
  if (!$("myname").value) $("myname").value = store.get("name", "");
  Solo.onChange = () => { if (mode === "solo") sync(); };
  setTab("tSolo"); buildMenu();
  window.KQ = {
    name: "Kin-manatee", after: ["#gear", "#menuQuit"],
    ask: () => { const m = mode === "online" && V ? V.mode : "off";
      if (m === "host") return { title: "Close the table and quit?", text: "Everyone seated is told the table closed, the game stops, and this app stops checking in. Nothing runs until you open a new table.", go: "Close the table" };
      if (m === "member") return { title: "Leave the table and quit?", text: "Your seat and your Kin's seat are given up. This app stops checking in with the table.", go: "Leave the table" };
      return { text: "Nothing is running except this screen. Quitting closes it. A Solo game in progress is lost." }; },
    before: () => leaveForQuit(),
    closedText: "You're away from the table and nothing is running. You can close this panel now."
  };
  return { mode: () => mode, state: () => ({ V, SV, sel }), leaveForQuit };
})();
