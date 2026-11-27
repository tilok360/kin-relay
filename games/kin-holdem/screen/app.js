// Kin Hold'em screen. Three situations share one table renderer:
//   menu    : choose Solo, Host, Join or play with your Kins
//   solo    : Free play against computer players, entirely in this screen (solo.js): no Kin, no app runs, no files
//   online  : a hosted or joined table (or Kin play): the app's run writes view.json, this screen sends commands
const App = (() => {
  const $ = (i) => document.getElementById(i);
  const el = (tag, txt, cls) => { const e = document.createElement(tag); if (txt != null) e.textContent = txt; if (cls) e.className = cls; return e; };
  const btn = (txt, fn, cls) => { const b = el("button", txt, cls); b.onclick = (e) => { e.stopPropagation(); fn(e); }; return b; };
  const store = { get: (k, d) => { try { const v = localStorage.getItem("holdem-" + k); return v == null ? d : JSON.parse(v); } catch { return d; } }, set: (k, v) => { try { localStorage.setItem("holdem-" + k, JSON.stringify(v)); } catch {} } };
  const cap = (s) => s[0].toUpperCase() + s.slice(1);
  const money = (n) => Number(n).toLocaleString("en-US");

  let mode = "menu", V = null, SV = null, lastBody = "", lastChange = 0, loadAt = Date.now(), pressAt = 0, startAt = 0;
  let wakeBusy = false, wakeAgain = false, wakeAt = 0, lastUse = Date.now(), lastNudge = 0;
  let chan = "chat", seenTs = { chat: 0, ooc: 0 }, settingsLoaded = false, panelOpen = false;
  const view = () => (mode === "solo" ? SV : V);
  const opts = Object.assign({ n: 3, level: "normal", chips: 1000, blind: 20 }, store.get("solo", {}));
  const prefs = Object.assign({ motion: true, hint: false }, store.get("prefs", {}));
  const rmq = window.matchMedia ? matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
  const animOn = () => prefs.motion && !rmq.matches;
  const isPhone = () => window.innerWidth <= 700;

  // ---------- talking to the app (online only) ----------
  function requestWake() { if (wakeBusy && Date.now() - wakeAt < 30000) { wakeAgain = true; return; } wakeBusy = true; wakeAt = Date.now(); parent.postMessage({ kin: "action", name: "wake", input: {} }, "*"); }
  const send = (c) => { pressAt = Date.now(); parent.postMessage({ kin: "files.write", path: "cmds/" + Date.now() + "-" + String((window.__krCmd = ((window.__krCmd || 0) + 1) % 1000)).padStart(3, "0") + Math.random().toString(36).slice(2, 5) + ".json", body: JSON.stringify(c) }, "*"); };
  const poll = () => { if (mode !== "solo") parent.postMessage({ kin: "files.read", path: "view.json" }, "*"); };
  function flash(t) { $("note0").textContent = t; $("status").dataset.flash = t; if (mode !== "solo") setTimeout(() => { if ($("status").dataset.flash === t) { $("status").dataset.flash = ""; draw(true); } }, 5000); if (mode !== "menu") draw(true); }
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
  const BLINDS = [[5, 10], [10, 20], [25, 50], [50, 100]];
  function seg(box, items, isOn, pick) { box.replaceChildren(...items.map(([val, label]) => btn(label, () => { pick(val); buildMenu(); }, isOn(val) ? "on" : ""))); }
  function buildMenu() {
    seg($("oN"), [1, 2, 3, 4, 5].map((n) => [n, String(n)]), (n) => n === opts.n, (n) => { opts.n = n; store.set("solo", opts); });
    seg($("oLvl"), Object.entries(Bots.LEVELS).map(([k, v]) => [k, v.label]), (k) => k === opts.level, (k) => { opts.level = k; store.set("solo", opts); });
    seg($("oChips"), [500, 1000, 2000, 5000].map((n) => [n, money(n)]), (n) => n === opts.chips, (n) => { opts.chips = n; store.set("solo", opts); });
    seg($("oBlinds"), BLINDS.map(([s, b]) => [b, s + " / " + b]), (b) => b === opts.blind, (b) => { opts.blind = b; store.set("solo", opts); });
    $("oPreview").replaceChildren(...Bots.roster(opts.n, opts.level).map((b) => { const s = el("span"); s.innerHTML = Art.avatar(b.name, "bot"); s.append(document.createTextNode(`${b.name} · ${Bots.STYLES[b.style].label}`)); s.title = Bots.STYLES[b.style].about; return s; }));
  }
  const TABS = { tSolo: "pSolo", tHost: "pHost", tJoin: "pJoin", tKins: "pKins" };
  function setTab(t) {
    for (const [b, p] of Object.entries(TABS)) { $(p).hidden = b !== t; $(b).className = b === t ? "on" : ""; }
    $("bringBox").hidden = !(t === "tHost" || t === "tJoin");
    $("menuBar").hidden = t === "tSolo"; $("note0").hidden = t === "tSolo"; // Solo never talks to the app, so it has no run status
  }
  for (const t of Object.keys(TABS)) $(t).onclick = () => setTab(t);
  $("doSolo").onclick = () => {
    Sfx.unlock(); lastUse = Date.now();
    Solo.start({ name: $("myname").value.trim() || "Player", n: opts.n, level: opts.level, chips: opts.chips, sb: opts.blind / 2, bb: opts.blind });
    mode = "solo"; seen.reset(); sync(); setTimeout(() => Solo.deal(), 500);
  };
  let chosenKin = null, soloSel = null;
  function pickKin(id, atTable) { chosenKin = id; send({ t: "bring", kinId: id }); if (atTable) flash(id ? "Seating your Kin…" : "Standing your Kin up…"); build(); }
  function toggleSolo(id) { const cur = (soloSel || (V && V.kinIds) || []).slice(), i = cur.indexOf(id); if (i >= 0) cur.splice(i, 1); else if (cur.length < 10) cur.push(id); else return flash("Ten Kins is the most a table can hold."); soloSel = cur; send({ t: "soloKins", kinIds: cur }); build(); }
  $("doKins").onclick = () => { const ids = soloSel || (V && V.kinIds) || []; if (!ids.length) return flash("Choose at least one Kin to play against."); send({ t: "soloKins", kinIds: ids }); send({ t: "host", solo: true, name: $("myname").value, table: "Solo with my Kins" }); flash("Opening a table with your Kins…"); };
  $("myname").onchange = () => { store.set("name", $("myname").value); if (mode !== "solo") send({ t: "name", name: $("myname").value }); };
  $("doHost").onclick = () => { send({ t: "bring", kinId: chosenKin ?? (V && V.kinId) ?? "" }); send({ t: "host", name: $("myname").value, table: $("tName").value }); flash("Opening the table…"); };
  $("doJoin").onclick = () => { send({ t: "bring", kinId: chosenKin ?? (V && V.kinId) ?? "" }); send({ t: "join", name: $("myname").value, code: $("jCode").value }); flash("Asking to sit down…"); };

  // ---------- views and flow ----------
  function sync() {
    const online = mode !== "solo" && V && V.mode !== "off";
    if (mode !== "solo") mode = online ? "online" : "menu";
    $("menu").hidden = mode !== "menu"; $("game").hidden = mode === "menu";
    $("onlineTools").hidden = mode === "solo"; $("onlineBar").hidden = mode !== "online";
    if (mode === "menu") { buildMenu(); buildMenuKins(); if (V && !$("myname").value) $("myname").value = V.me.name || store.get("name", ""); $("note0").textContent = V ? V.note || "" : ""; checkAlive(); return; }
    if (mode === "solo") SV = Solo.view();
    draw();
  }
  // The Kins come from the table app's view when it has written one; until it has (it starts when this screen opens), from Kin Relay's saved Kins.
  const allKins = () => (V && V.kins && V.kins.length ? V.kins : window.KRKins ? window.KRKins.list() : []);
  const enh = (box, ks, justMe) => { if (window.KRKins) window.KRKins.enhance(box, (justMe ? [null] : []).concat(ks.map((k) => k.id))); };
  if (window.KRKins) window.KRKins.onChange(() => { if (V ? !V.kins || !V.kins.length : true) build(); else buildMenuKins(); });
  function buildMenuKins() {
    const kins = allKins(), cur = chosenKin ?? ((V && V.kinId) || "");
    if (chosenKin !== null && chosenKin === ((V && V.kinId) || "")) chosenKin = null;
    $("bring").replaceChildren(...[{ id: "", name: "Just me" }].concat(kins).map((k) => btn(k.name, () => pickKin(k.id, false), k.id === cur ? "on" : "")));
    if (!kins.length) $("bring").append(el("span", "Attach a Kin to this app in Kindroid to bring one.", "note")); else enh($("bring"), kins, true);
    if (soloSel && JSON.stringify(soloSel) === JSON.stringify((V && V.kinIds) || [])) soloSel = null;
    const sel = soloSel || (V && V.kinIds) || [];
    for (const box of [$("soloPick"), $("soloPick2")]) {
      box.replaceChildren(...kins.map((k) => btn((sel.includes(k.id) ? "✓ " : "") + k.name, () => toggleSolo(k.id), sel.includes(k.id) ? "on" : "")));
      if (!kins.length) box.append(el("span", "Attach Kins to this app in Kindroid to play with them.", "note")); else enh(box, kins);
    }
    $("soloNote").textContent = `${sel.length} of 10 chosen.`;
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
  $("leave").onclick = () => $("back").onclick();

  // ---------- table geometry ----------
  const stage = $("stage");
  function fit() {
    const W = stage.clientWidth || 600, phone = isPhone();
    const maxW = phone ? 9999 : Math.max(560, (innerHeight - 300) / 0.56);
    stage.style.maxWidth = maxW + "px";
    document.documentElement.style.setProperty("--u", (Math.min(W, maxW) / (phone ? 62 : 100)) + "px");
    document.body.classList.toggle("nomotion", !animOn());
  }
  addEventListener("resize", () => { fit(); draw(true); });
  const geo = () => (isPhone() ? { cx: 50, cy: 49, rx: 38, ry: 37 } : { cx: 50, cy: 49, rx: 42, ry: 36 });
  const seatPos = (i, n) => { const g = geo(), a = ((90 + (360 * i) / n) * Math.PI) / 180; return { x: g.cx + g.rx * Math.cos(a), y: g.cy + g.ry * Math.sin(a) }; };
  const betPos = (p) => ({ x: 50 + (p.x - 50) * 0.62, y: 50 + (p.y - 50) * 0.56 });
  const POT = { x: 50, y: 38 }, DECK = { x: 31, y: 38 };

  // ---------- animation helpers ----------
  const rectOf = (e) => { const r = e.getBoundingClientRect(), s = stage.getBoundingClientRect(); return { x: r.left - s.left + r.width / 2, y: r.top - s.top + r.height / 2 }; };
  const pctToPx = (p) => { const s = stage.getBoundingClientRect(); return { x: (p.x / 100) * s.width, y: (p.y / 100) * s.height }; };
  function flyFrom(node, from, delay = 0, dur = 420, extra = {}) {
    if (!animOn() || !node.animate) return;
    const to = rectOf(node), dx = from.x - to.x, dy = from.y - to.y;
    node.animate([{ transform: `translate(${dx}px,${dy}px) scale(.5) rotate(-25deg)`, opacity: 0.2, ...extra }, { transform: "none", opacity: 1 }], { duration: dur, delay, easing: "cubic-bezier(.2,.8,.3,1)", fill: "backwards" });
  }
  function flyChips(html, from, to, delay, then, dur = 520) {
    const f = el("div", null, "chipfly"); f.innerHTML = html; f.style.left = from.x + "px"; f.style.top = from.y + "px"; $("fly").append(f);
    if (!animOn() || !f.animate) { f.remove(); then && then(); return; }
    const a = f.animate([{ transform: "translate(-50%,-50%)", opacity: 1 }, { transform: `translate(calc(-50% + ${to.x - from.x}px),calc(-50% + ${to.y - from.y}px)) scale(.85)`, opacity: 0.95 }], { duration: dur, delay, easing: "cubic-bezier(.5,0,.3,1)", fill: "both" });
    a.onfinish = () => { f.remove(); then && then(); };
  }
  const later = (ms, fn) => (animOn() ? setTimeout(fn, ms) : fn());

  // ---------- drawing the table ----------
  const seatRecs = {}, betEls = {};
  let prev = null, prevMine = null, lastHandNo = -1, hintKey = "", shownResult = "";
  const seen = { toast: new Set(), reset() { prev = null; prevMine = null; lastHandNo = -1; shownResult = ""; for (const k of Object.keys(seatRecs)) { seatRecs[k].el.remove(); delete seatRecs[k]; } for (const k of Object.keys(betEls)) { betEls[k].remove(); delete betEls[k]; } $("board").replaceChildren(); $("pot").replaceChildren(); $("banner").className = "banner"; $("fly").replaceChildren(); boardCards = []; potAmount = 0; } };
  let boardCards = [], potAmount = 0;
  const mySeatOf = (v) => v.table.seats.find((s) => s.owner === v.me.id && s.kind === "person");
  const SAY = { fold: "Fold", check: "Check", call: "Call" };

  // Lines new since the last picture: used for speech bubbles and sounds.
  function newLines(a, b) {
    if (!a) return [];
    const last = a[a.length - 1], before = a[a.length - 2];
    for (let i = b.length - 1; i >= 0; i--) if (b[i] === last && (i === 0 || before === undefined || b[i - 1] === before)) return b.slice(i + 1);
    return b.slice(-2);
  }
  function actionOf(line, name) {
    if (!line.startsWith(name + " ")) return null;
    const r = line.slice(name.length + 1);
    if (r.startsWith("folds") || r.startsWith("leaves")) return { k: "fold", text: "Fold" };
    if (r.startsWith("checks")) return { k: "check", text: "Check" };
    if (r.startsWith("calls")) return { k: "call", text: r.includes("all-in") ? "All-in" : "Call " + (r.match(/\d+/) || [""])[0] };
    if (r.startsWith("raises to") || r.startsWith("bets")) return { k: r.includes("all-in") ? "allin" : "raise", text: (r.startsWith("bets") ? "Bet " : "Raise to ") + (r.match(/\d+/) || [""])[0] };
    return null;
  }
  function bubble(rec, a) {
    const b = rec.say; b.textContent = a.text; b.className = "say " + a.k; void b.offsetWidth; b.classList.add("show");
  }

  function ensureSeat(id) {
    if (seatRecs[id]) return seatRecs[id];
    const e = el("div", null, "seat");
    e.innerHTML = `<div class="say"></div><div class="hc"></div><div class="plate"><span class="avw"></span><div class="pl"><b></b><span></span><small></small></div><div class="tag"></div><div class="tmr" hidden><i></i></div></div>`;
    $("seats").append(e);
    return (seatRecs[id] = { el: e, hc: e.querySelector(".hc"), say: e.querySelector(".say"), name: e.querySelector("b"), stack: e.querySelector(".pl span"), sub: e.querySelector("small"), av: e.querySelector(".avw"), tag: e.querySelector(".tag"), tmr: e.querySelector(".tmr"), tmrI: e.querySelector(".tmr i"), avKey: "", cards: [], faces: ["", ""] });
  }

  function draw(still) {
    const v = view(); if (!v || !v.table) return;
    fit();
    const T = v.table, P = prev, first = !P, newHand = !P || P.handNo !== T.handNo || (P.street === "done" && T.street !== "done");
    const lines = newHand ? [] : newLines(P.log, T.log), me = mySeatOf(v), myId = me ? me.id : "", n = T.seats.length;
    const motion = !still && !first;
    // ---- header
    $("title").textContent = T.name + (T.settings.paused ? " (paused)" : "");
    $("sub").textContent = T.street === "waiting" ? `Blinds ${T.settings.sb}/${T.settings.bb}` : `Hand ${T.handNo} · blinds ${T.settings.sb}/${T.settings.bb}` + (T.humans > 1 ? ` · ${T.humans} people` : "");
    // ---- seats
    const order = T.seats.slice(), mi = me ? order.findIndex((s) => s.id === me.id) : 0;
    const rot = mi > 0 ? order.slice(mi).concat(order.slice(0, mi)) : order;
    for (const id of Object.keys(seatRecs)) if (!T.seats.some((s) => s.id === id)) { seatRecs[id].el.remove(); delete seatRecs[id]; if (betEls[id]) { betEls[id].remove(); delete betEls[id]; } }
    const won = new Set(T.result ? T.result.winners.map((w) => w.id) : []), dealerIdx = T.seats.findIndex((s) => s.id === T.dealer);
    const dealOrder = []; // seats in deal order, starting left of the button
    for (let k = 1; k <= n; k++) { const s = T.seats[(dealerIdx + k + n) % n]; if (s && s.cards) dealOrder.push(s.id); }
    const winCards = new Set(); if (T.result) for (const w of T.result.winners) { const sh = (T.seats.find((s) => s.id === w.id) || {}).shown; if (sh && sh.cards) sh.cards.forEach((c) => winCards.add(c)); }
    rot.forEach((s, i) => {
      const rec = ensureSeat(s.id), p = seatPos(i, n), isMe = s.id === myId, e = rec.el;
      e.style.left = p.x + "%"; e.style.top = p.y + "%";
      e.className = "seat" + (isMe ? " me" : "") + (s.id === T.toAct ? " turn" : "") + (s.folded || (!s.inHand && T.street !== "waiting" && T.street !== "done") ? " fold" : "") + (!s.inHand && !s.stack ? " out" : "") + (won.has(s.id) && T.street === "done" ? " won" : "");
      const kind = s.kind === "person" ? "person" : s.kind;
      if (rec.avKey !== s.name + kind) { rec.avKey = s.name + kind; rec.av.innerHTML = Art.avatar(s.name, kind); }
      rec.name.textContent = s.name; rec.stack.textContent = money(s.stack);
      rec.sub.textContent = s.allIn ? "All-in" : s.folded ? "Folded" : s.id === T.toAct ? (s.kind === "person" ? "Thinking…" : "Thinking…") : !s.inHand && !s.stack ? "Out of chips" : s.kind === "kin" ? (s.owner === v.me.id ? "Your Kin" : /^(Host|Player|someone)?$/.test(s.ownerName || "") ? "Kin" : `${s.ownerName}'s Kin`) : s.kind === "bot" ? (Bots.STYLES[s.style] || { label: "CPU" }).label + " · CPU" : isMe ? "You" : !s.inHand && T.street !== "waiting" ? "Next hand" : "";
      rec.tag.replaceChildren(); if (s.id === T.dealer && T.street !== "waiting") rec.tag.append(el("i", "D")); if (s.allIn) rec.tag.append(el("i", "ALL-IN", "a"));
      // hole cards
      const hole = isMe && v.mine ? v.mine.hole : s.shown ? s.shown.hole : null, want = hole ? 2 : s.cards ? 2 : 0;
      if (!want || (newHand && rec.cards.length)) { rec.hc.replaceChildren(); rec.cards = []; rec.faces = ["", ""]; }
      if (want && !rec.cards.length) {
        for (let k = 0; k < 2; k++) { const c = Art.card(null); rec.cards.push(c); rec.hc.append(c); }
        if (motion || (newHand && !first)) { const di = dealOrder.indexOf(s.id); rec.cards.forEach((c, k) => { const d = (k * Math.max(1, dealOrder.length) + Math.max(0, di)) * 110; flyFrom(c, pctToPx(DECK), d, 380); if (animOn() && d < 1200) setTimeout(() => Sfx.play("deal"), d); }); }
      }
      rec.hc.classList.toggle("reveal", !!s.shown);
      if (hole) rec.cards.forEach((c, k) => { if (rec.faces[k] !== hole[k]) { const wasBack = !rec.faces[k]; rec.faces[k] = hole[k]; if (wasBack && !isMe && animOn() && motion) { Art.show(c, hole[k]); Sfx.play("flip"); } else Art.show(c, hole[k]); } });
      rec.cards.forEach((c, k) => { c.classList.toggle("win", T.street === "done" && winCards.has(rec.faces[k])); c.classList.toggle("dim", T.street === "done" && winCards.size > 0 && !!rec.faces[k] && !winCards.has(rec.faces[k])); });
      // speech bubble and sounds for each new action
      for (const l of lines) { const a = actionOf(l, s.name); if (a && motion) { bubble(rec, a); Sfx.play(a.k === "fold" ? "fold" : a.k === "check" ? "check" : "chips", 3); } }
      // chips in front of the seat
      const bp = betPos(p); let be = betEls[s.id];
      if (s.bet > 0) {
        if (!be) { be = betEls[s.id] = el("div", null, "bet"); $("seats").append(be); be.dataset.v = ""; }
        be.style.left = bp.x + "%"; be.style.top = bp.y + "%";
        if (be.dataset.v !== String(s.bet)) { const grew = be.dataset.v === "" || +be.dataset.v < s.bet; be.dataset.v = s.bet; be.innerHTML = Art.stack(s.bet) + `<b>${money(s.bet)}</b>`; if (grew && motion) flyFrom(be, pctToPx(p), 0, 380); }
      } else if (be) {
        const from = pctToPx(bp), html = be.innerHTML; be.remove(); delete betEls[s.id];
        if (motion && !newHand) flyChips(html, from, pctToPx(T.street === "done" && T.result ? POT : POT), 0, null, 450);
      }
      // timer under whoever is to act
      const running = s.id === T.toAct && T.deadline > 0;
      rec.tmr.hidden = !running;
      if (running) { const key = T.deadline + ":" + s.id; if (rec.tKey !== key) { rec.tKey = key; rec.tTotal = Math.max(5000, T.deadline - Date.now()); } }
    });
    // ---- board
    const bd = $("board");
    if (newHand || T.board.length < boardCards.length) { bd.replaceChildren(); boardCards = []; $("banner").className = "banner"; shownResult = ""; }
    if (!bd.childElementCount) for (let k = 0; k < 5; k++) bd.append(el("div", null, "slot"));
    let fresh = 0;
    T.board.forEach((c, k) => {
      if (boardCards[k]) return;
      const card = Art.card(null); boardCards[k] = card; card.dataset.cc = c; bd.replaceChild(card, bd.children[k]);
      if (motion && animOn()) { const d = fresh++ * 230; flyFrom(card, pctToPx(DECK), d, 420); setTimeout(() => { Art.show(card, c); Sfx.play("flip"); }, d + 380); } else Art.show(card, c);
    });
    boardCards.forEach((card) => { if (!card) return; const c = card.dataset.cc; card.classList.toggle("win", T.street === "done" && winCards.has(c)); card.classList.toggle("dim", T.street === "done" && winCards.size > 0 && !winCards.has(c)); });
    // ---- pot
    const pot = $("pot");
    if (T.pot !== potAmount || first) { const grew = T.pot > potAmount; potAmount = T.pot; pot.innerHTML = T.pot ? Art.stack(Math.min(T.pot, 2000)) + `<span class="lab"><small>POT</small>${money(T.pot)}</span>` : ""; if (grew && motion) { pot.classList.remove("bump"); void pot.offsetWidth; pot.classList.add("bump"); } }
    // ---- new hand: shuffle
    if (newHand && !first && T.street !== "waiting") { Sfx.play("shuffle"); if (animOn()) { const d = $("deck"); d.animate([{ transform: "translate(-50%,-50%) rotate(0)" }, { transform: "translate(-50%,-50%) rotate(-8deg) scale(1.1)" }, { transform: "translate(-50%,-50%) rotate(6deg)" }, { transform: "translate(-50%,-50%)" }], { duration: 600 }); } }
    // ---- result
    const rkey = T.street === "done" && T.result ? T.handNo + ":" + T.result.winners.map((w) => w.id + w.amount).join(",") : "";
    if (rkey && rkey !== shownResult) {
      shownResult = rkey;
      const ws = T.result.winners, iWon = ws.some((w) => w.id === myId);
      const b = $("banner"); b.replaceChildren();
      if (ws.length === 1) { b.append(el("b", `${ws[0].name} wins ${money(ws[0].amount)}`), ws[0].hand ? el("span", ws[0].hand) : el("span", "everyone else folded")); }
      else { b.append(el("b", "Split pot"), el("span", ws.map((w) => `${w.name} ${money(w.amount)}`).join(" · ") + (ws[0].hand ? " · " + ws[0].hand : ""))); }
      later(motion ? 700 : 0, () => b.classList.add("on"));
      if (motion) {
        const from = pctToPx(POT);
        ws.forEach((w, k) => { const rec = seatRecs[w.id]; if (!rec) return; const to = rectOf(rec.el); later(500 + k * 150, () => flyChips(Art.stack(Math.min(w.amount, 1500)), from, to, 0, () => { const pl = el("div", "+" + money(w.amount), "plus"); pl.style.left = to.x + "px"; pl.style.top = to.y + "px"; $("fly").append(pl); setTimeout(() => pl.remove(), 1700); }, 650)); });
        later(500, () => { pot.innerHTML = ""; });
        setTimeout(() => Sfx.play(iWon ? "win" : (me && me.inHand && !me.folded ? "lose" : "chips"), 6), 600);
      }
    }
    // ---- my turn
    if (me && T.toAct === myId && (!P || P.toAct !== myId) && motion) Sfx.play("turn");
    if (me && T.toAct === myId && (!P || P.toAct !== myId)) lastUse = Date.now();
    drawDock(v, T, me); drawHint(v, T, me); drawPanel(v, T); drawDrawer(v, T);
    prev = { handNo: T.handNo, street: T.street, log: T.log.slice(), toAct: T.toAct };
    if (mode === "online") checkAlive();
    achToast(T);
  }

  // ---------- the dock: status, moves, deal ----------
  const L_of = (v) => v.legal;
  function drawDock(v, T, me) {
    const L = v.legal, host = v.mode === "host", solo = v.mode === "solo", flashText = $("status").dataset.flash;
    const who = (T.seats.find((s) => s.id === T.toAct) || {}).name || "";
    let msg = "";
    if (v.mode === "member" && !v.joined) msg = v.joinStage === "failed" ? "Couldn't reach the table: " + (v.joinError || "") : "Asked to sit down. The host admits you from their screen.";
    else if (L) msg = L.canCheck ? "<b>Your turn.</b> Check or bet." : `<b>Your turn.</b> ${money(L.toCall)} to call.`;
    else if (T.toAct) msg = `Waiting for <b>${who.replace(/[<&]/g, "")}</b>…`;
    else if (T.street === "waiting") msg = solo ? "Press Deal to start." : "Waiting for the first deal.";
    else if (T.street === "done" && T.result) msg = T.nextDealAt ? "Next hand shortly…" : "Hand over.";
    if (me && !me.inHand && T.street !== "waiting" && T.street !== "done" && !me.stack) msg = "You're out of chips this hand.";
    if (v.asleep && mode === "online") msg += " <span class='note'>(The table is resting after 10 quiet minutes. Any move or message wakes it.)</span>";
    $("status").innerHTML = (flashText ? `<span class="note">${flashText.replace(/[<&]/g, "")}</span> · ` : "") + msg;
    $("acts").hidden = !L;
    if (L) {
      $("aCall").firstChild.textContent = L.canCheck ? "Check" : L.toCall >= (me ? me.stack : 1e9) && me ? `Call ${money(L.toCall)} (all-in)` : `Call ${money(L.toCall)}`;
      $("aRaise").hidden = !L.canRaise; $("raiseBox").hidden = !L.canRaise && !(L.canCall && L.toCall > 0 && false);
      $("rSlide").parentNode.querySelector(".allin").hidden = !L.canRaise;
      if (L.canRaise) {
        const s = $("rSlide"), key = L.minTo + ":" + L.maxTo + ":" + T.handNo + ":" + T.street;
        if (s.dataset.key !== key) { s.dataset.key = key; s.min = $("rNum").min = L.minTo; s.max = $("rNum").max = L.maxTo; s.step = 1; s.value = $("rNum").value = L.minTo; }
        $("aRaise").firstChild.textContent = `${cap(L.word)}${L.word === "bet" ? " " : " to "}${money(s.value)}`;
      } else $("aRaise").firstChild.textContent = "Raise";
    }
    // deal button
    const between = T.street === "waiting" || T.street === "done";
    let canDeal = false, why = "";
    if (solo) { const m = me || {}; canDeal = between && m.stack > 0; if (between && m.stack === 0) why = "You're out of chips."; }
    else if (host && v.host) { canDeal = !v.host.handRunning && v.host.canDeal && !T.nextDealAt; why = v.host.dealBlocker || ""; }
    $("between").hidden = !(between && ((solo && (me && me.stack > 0)) || (host && v.host && !v.host.handRunning && !T.nextDealAt)));
    $("dealBtn").disabled = !canDeal; $("dealBtn").firstChild.textContent = T.handNo ? "Deal next hand" : "Deal the first hand"; $("dealWhy").textContent = why;
    // rebuy, Kin controls
    const ex = $("extra"); ex.replaceChildren();
    if (T.settings.rebuys && between) T.seats.filter((s) => s.owner === v.me.id && s.kind !== "bot" && s.stack === 0).forEach((s) => ex.append(btn(`Rebuy ${s.kind === "kin" ? s.name : ""} for ${money(T.settings.start)}`.replace("  ", " "), () => { if (solo) { Solo.rebuy(); } else send({ t: "rebuy", kin: s.kind === "kin", seat: s.id }); })));
    if (solo && me && me.stack === 0 && !T.settings.rebuys) ex.append(el("span", "Out of chips.", "note"));
    $("dock").classList.toggle("mine", !!L);
  }
  const act = (type, to) => { lastUse = Date.now(); if (mode === "solo") Solo.act(type, to); else { send({ t: "act", type, to }); flash("Move sent…"); } };
  $("aFold").onclick = () => act("fold");
  $("aCall").onclick = () => { const L = view().legal; if (L) act(L.canCheck ? "check" : "call"); };
  $("aRaise").onclick = () => act("raise", Number($("rNum").value));
  $("rSlide").oninput = () => { $("rNum").value = $("rSlide").value; refreshRaiseLabel(); };
  $("rNum").oninput = () => { $("rSlide").value = $("rNum").value; refreshRaiseLabel(); };
  $("rNum").onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); $("aRaise").click(); } };
  function refreshRaiseLabel() { const L = view().legal; if (L) $("aRaise").firstChild.textContent = `${cap(L.word)}${L.word === "bet" ? " " : " to "}${money($("rSlide").value)}`; }
  $("raiseBox").querySelector(".presets").onclick = (e) => {
    const p = e.target.dataset && e.target.dataset.p, v = view(), L = v && v.legal; if (!p || !L) return;
    if (p === "all") return act("allin");
    const me = mySeatOf(v), pot = v.table.pot;
    const to = p === "min" ? L.minTo : Math.round((me ? me.bet : 0) + L.toCall + (+p) * (pot + L.toCall));
    const x = Math.max(L.minTo, Math.min(L.maxTo, to)); $("rSlide").value = $("rNum").value = x; refreshRaiseLabel();
  };
  $("dealBtn").onclick = () => { if (mode === "solo") Solo.deal(); else { send({ t: "deal" }); flash("Dealing…"); } };

  // ---------- hand-strength hint ----------
  function drawHint(v, T, me) {
    const box = $("hint"); box.hidden = !prefs.hint || !v.mine || T.street === "done" || mode === "menu";
    $("bHint").setAttribute("aria-pressed", String(prefs.hint));
    if (box.hidden) return;
    const hole = v.mine.hole, foes = Math.max(1, T.seats.filter((s) => s.inHand && !s.folded && s.id !== (me || {}).id).length), key = hole.join("") + T.board.join("") + foes;
    if (key === hintKey) return; hintKey = key;
    const made = T.board.length >= 3 ? Poker.bestHand(hole.concat(T.board)).name : (() => { const s = Bots.preflop(hole); return s >= 0.62 ? "Premium starting hand" : s >= 0.52 ? "Strong starting hand" : s >= 0.44 ? "Playable starting hand" : "Weak starting hand"; })();
    box.textContent = made + " · working out odds…";
    setTimeout(() => {
      if (hintKey !== key) return;
      const eq = Bots.equity(hole, T.board, foes, 400, Math.random), pct = Math.round(eq * 100);
      box.innerHTML = ""; box.append(el("b", made), el("span", `about ${pct}% to win against ${foes} random hand${foes > 1 ? "s" : ""}`));
      const bar = el("span", null, "bar2"); bar.append(el("i")); bar.firstChild.style.width = pct + "%"; box.append(bar);
    }, 30);
  }
  $("bHint").onclick = () => { prefs.hint = !prefs.hint; store.set("prefs", prefs); hintKey = ""; $("sHint").checked = prefs.hint; draw(true); };

  // ---------- chat, log, awards ----------
  function openPanel(on) { panelOpen = on; $("panel").hidden = !on; if (on) { $("drawer").hidden = true; drawPanel(view(), view().table); } }
  function closePanels() { $("panel").hidden = true; $("drawer").hidden = true; panelOpen = false; }
  $("bChat").onclick = () => openPanel(!panelOpen); $("closePanel").onclick = () => openPanel(false);
  $("gear").onclick = (e) => { e.stopPropagation(); $("drawer").hidden = !$("drawer").hidden; if (!$("drawer").hidden) { $("panel").hidden = true; panelOpen = false; draw(true); } };
  $("closeDrawer").onclick = () => { $("drawer").hidden = true; };
  $("ptabs").onclick = (e) => { const t = e.target.dataset && e.target.dataset.t; if (!t) return; chan = t; drawPanel(view(), view().table, true); };
  const doSend = () => { const t = $("say").value.trim(); if (!t) return; lastUse = Date.now(); send({ t: chan === "ooc" ? "ooc" : "say", text: t }); $("say").value = ""; };
  $("send").onclick = doSend; $("say").onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); doSend(); } };
  function drawPanel(v, T, force) {
    if (!v || !T) return; // a guest who opens the panel before the host's table has arrived
    const solo = v.mode === "solo", tabs = $("ptabs").children;
    if (solo && (chan === "chat" || chan === "ooc")) chan = "log";
    for (const b of tabs) { b.hidden = solo && (b.dataset.t === "chat" || b.dataset.t === "ooc"); b.classList.toggle("on", b.dataset.t === chan); }
    const lastTs = (l) => (l.length ? l[l.length - 1].ts : 0), unread = ["chat", "ooc"].map((c) => (c === chan ? 0 : (c === "ooc" ? v.ooc : v.chat).filter((m) => m.ts > seenTs[c] && m.owner !== v.me.id && m.kind !== "dealer").length)).reduce((a, b) => a + b, 0);
    if (panelOpen && (chan === "chat" || chan === "ooc")) seenTs[chan] = Math.max(seenTs[chan], lastTs(chan === "ooc" ? v.ooc : v.chat));
    const badge = panelOpen ? unread : ["chat", "ooc"].map((c) => (c === "ooc" ? v.ooc : v.chat).filter((m) => m.ts > seenTs[c] && m.owner !== v.me.id && m.kind !== "dealer").length).reduce((a, b) => a + b, 0);
    $("unread").hidden = !badge; $("unread").textContent = badge;
    if (!panelOpen) return;
    $("sayRow").hidden = !(chan === "chat" || chan === "ooc") || (v.mode === "member" && !v.joined);
    $("say").placeholder = chan === "ooc" ? "Out of character: people only, never a Kin" : "Say something to the table. The Kins join in; @Name talks to one";
    const box = $("pBody"), atEnd = box.scrollTop + box.clientHeight >= box.scrollHeight - 30, key = JSON.stringify([chan, v.chat.length && v.chat[v.chat.length - 1].id, v.ooc.length && v.ooc[v.ooc.length - 1].id, (v.pendingChat || []).length, (v.pendingOoc || []).length, typingNow(T).map((t) => t.name + (t.slow ? "!" : "")).join("|"), T.log.length, T.log[T.log.length - 1], T.handNo, JSON.stringify(T.ach).length]);
    if (key === box.dataset.key && !force) return; box.dataset.key = key; box.replaceChildren();
    if (chan === "log") { let h = ""; for (const l of T.log) { const d = el("div", l, "logline" + (/^(Flop|Turn|River)/.test(l) ? " h" : "")); box.append(d); } if (!T.log.length) box.append(el("div", "Nothing yet.", "note")); }
    else if (chan === "ach") renderAch(box, T);
    else {
      const list = chan === "ooc" ? v.ooc : v.chat, pend = (chan === "ooc" ? v.pendingOoc : v.pendingChat) || [];
      if (chan === "ooc") box.append(el("div", "Out-of-character chat for the people at the table. The Kins never see it.", "msg dealer"));
      list.forEach((m) => { const d = el("div", null, "msg " + (chan === "ooc" ? "ooc " : "") + (m.kind === "kin" ? "kin " : "") + (m.kind === "dealer" ? "dealer " : "") + (m.owner === v.me.id && m.kind === "person" ? "mine-m" : "")); d.append(el("div", m.text, "b")); if (m.kind !== "dealer") d.append(el("div", m.who + (m.kind === "kin" ? " (Kin)" : ""), "w")); box.append(d); });
      pend.forEach((m) => { const d = el("div", null, "msg wait mine-m"); d.append(el("div", m.text, "b"), el("div", m.who + " · sending…", "w")); box.append(d); });
      if (chan === "chat") for (const t of typingNow(T)) { const d = el("div", null, "msg kin typing"); d.append(el("div", t.slow ? `${t.name} is typing… (waiting for Kindroid's limit of 10 requests per 30 seconds)` : `${t.name} is typing…`, "b")); box.append(d); }
    }
    if (atEnd || force) box.scrollTop = box.scrollHeight;
  }
  const typingNow = (T) => (T && Array.isArray(T.typing) ? T.typing : []).map((t) => ({ name: String(t.name || "A Kin"), slow: Date.now() - (Number(t.since) || Date.now()) > 12000 }));
  function renderAch(box, T) {
    const book = (T && T.ach) || {}, g = el("div", null, "achs"); let total = 0;
    for (const a of Poker.ACH) {
      const holders = Object.values(book).filter((r) => r.got && r.got[a.id]).map((r) => r.name + (r.got[a.id] > 1 ? " ×" + r.got[a.id] : "")); total += holders.length ? 1 : 0;
      const nme = el("span", `${a.icon} ${a.name}`); nme.append(el("span", a.about, "ab")); g.append(nme, el("span", holders.length ? holders.join(", ") : "–", "who"));
    }
    box.append(el("div", `Awards this session: ${total} of ${Poker.ACH.length} won by someone`, "note"), g);
  }
  let toastQ = [], toasting = false, achPrimed = false;
  function achToast(T) {
    if (!achPrimed) { for (const a of T.achNew || []) seen.toast.add(a.hand + ":" + a.seat + ":" + a.id); achPrimed = true; return; }
    for (const a of T.achNew || []) { const k = a.hand + ":" + a.seat + ":" + a.id; if (seen.toast.has(k)) continue; seen.toast.add(k); const d = Poker.ACH.find((x) => x.id === a.id); if (d) toastQ.push({ d, name: a.name }); }
    if (toasting) return;
    const next = () => { const t = toastQ.shift(); if (!t) { toasting = false; return; } toasting = true; $("sealicon").textContent = t.d.icon; $("t1").textContent = t.name + " earned"; $("t2").textContent = t.d.name; $("t3").textContent = t.d.about; $("toast").classList.add("show"); setTimeout(() => { $("toast").classList.remove("show"); setTimeout(next, 400); }, 2800); };
    setTimeout(next, 1800);
  }

  // ---------- settings drawer ----------
  $("sSound").onchange = () => { Sfx.on = $("sSound").checked; $("bSnd").setAttribute("aria-pressed", String(Sfx.on)); if (Sfx.on) Sfx.play("chips"); };
  $("bSnd").onclick = () => { Sfx.on = !Sfx.on; $("sSound").checked = Sfx.on; $("bSnd").setAttribute("aria-pressed", String(Sfx.on)); if (Sfx.on) Sfx.play("chips"); };
  $("sMotion").onchange = () => { prefs.motion = $("sMotion").checked; store.set("prefs", prefs); fit(); };
  $("sHint").onchange = () => { prefs.hint = $("sHint").checked; store.set("prefs", prefs); hintKey = ""; draw(true); };
  $("copyInvite").onclick = () => copyText($("invite").textContent);
  $("saveS").onclick = () => send({ t: "settings", sb: $("sSb").value, bb: $("sBb").value, start: $("sStart").value, timer: $("sTimer").value, autoDeal: $("sAuto").checked, rebuys: $("sRebuy").checked });
  $("pauseBtn").onclick = () => send({ t: "settings", paused: !(V && V.table && V.table.settings.paused) });
  function drawDrawer(v, T) {
    if ($("drawer").hidden) return;
    $("sSound").checked = Sfx.on; $("bSnd").setAttribute("aria-pressed", String(Sfx.on)); $("sMotion").checked = prefs.motion && !rmq.matches; $("sMotion").disabled = rmq.matches; $("sHint").checked = prefs.hint;
    if (v.mode === "solo") { $("leave").textContent = "Leave the game"; return; }
    $("leave").textContent = v.mode === "host" ? "Close the table" : "Leave the table";
    const host = v.mode === "host";
    $("hostTools").hidden = !host;
    $("memberInfo").textContent = host ? "" : `Blinds ${T.settings.sb}/${T.settings.bb} · starting chips ${T.settings.start} · ${T.settings.timer}s per move · rebuys ${T.settings.rebuys ? "allowed" : "off"}. The host's copy deals and holds every card.`;
    const kinSolo = !!T.solo;
    for (const g of [$("hostTools").querySelector("#invite").parentNode]) void g;
    const tk = allKins();
    $("kinPick").hidden = kinSolo || !tk.length; $("soloKinBox").hidden = !(kinSolo && host);
    const cur = chosenKin ?? (v.kinId || "");
    $("kinPick").replaceChildren(...[{ id: "", name: "Just me" }].concat(tk).map((k) => btn(k.name, () => pickKin(k.id, true), k.id === cur ? "on" : "")));
    enh($("kinPick"), tk, true);
    buildMenuKins();
    const kb = $("kinBox"); kb.replaceChildren();
    const mine = T.seats.filter((s) => s.owner === v.me.id && s.kind === "kin");
    if (mine.length) {
      for (const s of mine) kb.append(btn(`Ask ${s.name} to say something`, () => { send({ t: "kinTalkNow", kinId: s.kinId }); flash(`Asking ${s.name} for a line…`); }));
      kb.append(btn(v.kinTalk ? "My Kins join the chat: on" : "My Kins join the chat: off", () => send({ t: "kinTalk", on: !v.kinTalk })));
      kb.append(btn(v.kinAuto === false ? "Kin lines wait for my OK: on" : "Kin lines wait for my OK: off", () => send({ t: "kinAuto", on: v.kinAuto === false })));
      for (const d of v.drafts || []) { const r = el("div", null, "row"); r.style.width = "100%"; r.append(el("span", `Draft only you can see: ${d.name}${d.from ? ` (to ${d.from})` : ""}: ${d.text}`, "grow"), btn("Post", () => { send({ t: "postDraft", id: d.id }); flash("Posting…"); }), btn("Discard", () => send({ t: "discardDraft", id: d.id }))); kb.append(r); }
      const ku = v.kinUse || { used: 0, cap: 60 }; kb.append(el("span", "Most Kin requests per hour:", "note"));
      for (const n of [30, 60, 120, 240, 480]) kb.append(btn(n === ku.cap ? `${n} ✓` : String(n), () => send({ t: "kinCap", n })));
    }
    const ku = v.kinUse || { used: 0, cap: 60 };
    $("creditNote").textContent = `Computer players are free. Hosting and joining run on this device, and the table stops checking in 10 minutes after the last person used it. Each Kin move or chat line is a normal Kin message through your Kindroid API key (used this hour: ${ku.used} of ${ku.cap}); Kindroid allows about 10 requests per 30 seconds, so a busy table may make a Kin wait. Solo play from the menu is always free.`;
    if (host && v.host) {
      $("invite").textContent = v.host.invite; $("pauseBtn").textContent = T.settings.paused ? "Resume the table" : "Pause after this hand";
      $("hostTools").querySelectorAll(".guests").forEach((g) => (g.hidden = kinSolo));
      if (!settingsLoaded) { settingsLoaded = true; const S = T.settings; $("sSb").value = S.sb; $("sBb").value = S.bb; $("sStart").value = S.start; $("sTimer").value = S.timer; $("sAuto").checked = S.autoDeal; $("sRebuy").checked = S.rebuys; }
      $("sStart").disabled = T.handNo > 0;
      const bots = T.seats.filter((s) => s.kind === "bot").length;
      seg($("bN"), [0, 1, 2, 3, 4, 5, 6].map((k) => [k, String(k)]), (k) => k === (T.settings.botN | 0), (k) => send({ t: "settings", botN: k }));
      seg($("bLvl"), Object.entries(Bots.LEVELS).map(([k, x]) => [k, x.label]), (k) => k === (T.settings.botLevel || "normal"), (k) => send({ t: "settings", botLevel: k }));
      const w = $("waiting"); w.replaceChildren(); if (!v.host.waiting.length) w.textContent = "Nobody.";
      v.host.waiting.forEach((m) => { const r = el("div", null, "row"); r.append(el("span", m.name + (m.kin ? ` with ${m.kin}` : ""), "grow"), btn("Admit", () => send({ t: "admit", member: m.id })), btn("Decline", () => send({ t: "decline", member: m.id }))); w.append(r); });
      const pe = $("people"); pe.replaceChildren(); if (!v.host.members.length) pe.append(el("p", "Nobody else yet.", "note"));
      v.host.members.forEach((m) => { const r = el("div", null, "row"); r.append(el("span", m.name, "grow"), btn("Remove", () => send({ t: "kick", member: m.id }))); pe.append(r); });
    }
  }

  // ---------- timer, keys, run status ----------
  function timerTick() {
    const v = view(); if (!v || !v.table || mode === "menu") return; const T = v.table;
    for (const [id, rec] of Object.entries(seatRecs)) if (!rec.tmr.hidden) { const left = Math.max(0, T.deadline - Date.now()); rec.tmrI.style.width = Math.min(100, (left / (rec.tTotal || 1)) * 100) + "%"; }
  }
  function checkAlive() {
    if (mode === "solo") return;
    const t = Date.now(), down = (!lastChange && t - loadAt > 8000) || (pressAt && lastChange < pressAt && t - pressAt > 30000);
    const txt = !lastChange && t - loadAt <= 8000 ? "Checking…" : down ? "Not running" : "Running";
    ["", "0"].forEach((s) => { $("runDot" + s).className = "dot" + (down || !lastChange ? "" : " on"); $("runTxt" + s).textContent = txt; $("startBtn" + s).hidden = !down; $("startBtn" + s).textContent = startAt ? "Retry" : "Start"; });
  }
  ["startBtn", "startBtn0"].forEach((b) => ($(b).onclick = () => { startAt = pressAt = Date.now(); $("runTxt").textContent = $("runTxt0").textContent = "Starting…"; requestWake(); }));
  // A move or deal can be due while nobody presses anything: ask the app to check in, but only while a person is using this screen.
  function nudge() {
    const T = V && V.table; if (mode !== "online" || !T || Date.now() - lastUse > 10 * 60000) return;
    const due = (T.deadline && Date.now() > T.deadline) || (T.nextDealAt && Date.now() > T.nextDealAt);
    if (due && Date.now() - lastNudge > 15000) { lastNudge = Date.now(); send({ t: "nudge" }); }
  }
  document.addEventListener("pointerdown", () => { lastUse = Date.now(); Sfx.unlock(); }, true);
  document.addEventListener("keydown", (e) => {
    if (mode === "menu" || e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = (e.target.tagName || "").toLowerCase(), v = view(); if (!v) return;
    if (tag === "textarea" || (tag === "input" && e.target.id !== "rSlide")) return;
    lastUse = Date.now(); const L = v.legal, k = e.key.toLowerCase();
    if (k === "escape") { closePanels(); return; }
    if (k === "h") $("bHint").click(); else if (k === "m") $("bSnd").click(); else if (k === "t") $("bChat").click();
    else if (k === "n" && !$("between").hidden && !$("dealBtn").disabled) $("dealBtn").click();
    else if (L && k === "f") $("aFold").click(); else if (L && (k === "c" || k === " ")) { e.preventDefault(); $("aCall").click(); }
    else if (L && k === "a" && L.canRaise) act("allin"); else if (L && k === "a" && L.canCall) act("allin");
    else if (L && k === "r" && L.canRaise) { $("rNum").focus(); $("rNum").select(); }
    else if (L && L.canRaise && (k === "arrowup" || k === "arrowdown")) { e.preventDefault(); const s = $("rSlide"), step = (v.table.bb || 1) * (e.shiftKey ? 5 : 1); s.value = Math.max(L.minTo, Math.min(L.maxTo, +s.value + (k === "arrowup" ? step : -step))); $("rNum").value = s.value; refreshRaiseLabel(); }
  });

  // ---------- start ----------
  Solo.onChange = () => { if (mode === "solo") { SV = Solo.view(); draw(); } };
  $("sprite").innerHTML = Art.sprite;
  $("myname").value = store.get("name", "");
  if (window.KRKins) KRKins.onChange(() => { const n = KRKins.player && KRKins.player(); if (n && !$("myname").value.trim()) $("myname").value = n; }); // your name from Kin Relay Settings (or your Kindroid export)
  buildMenu(); setTab("tSolo"); fit(); $("bSnd").setAttribute("aria-pressed", String(Sfx.on));
  poll(); checkAlive();
  setInterval(() => { poll(); checkAlive(); nudge(); }, 2000);
  setInterval(timerTick, 500);
  return { mode: () => (mode === "online" && V ? V.mode : mode), leaveForQuit, solo: Solo, state: () => ({ mode, V, SV }) };
})();
