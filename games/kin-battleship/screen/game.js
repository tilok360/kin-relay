// Kin Battleship screen. Solo games run entirely here: no question to the Kin, no action, no run.
// Games against your Kin ask it for its shots and lines (Kindroid credits) and save each result with a short run.
"use strict";
const $ = (id) => document.getElementById(id);
const Q = new URLSearchParams(location.search);
const ASK_MS = (Number(Q.get("asktimeout")) || 30) * 1000;
const SPEED = Q.get("fast") ? 0.08 : 1;                   // used by the automated test only
const wait = (ms) => new Promise((r) => setTimeout(r, ms * SPEED));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

// ---------- talking to the page around the screen ----------
let seq = 0; const waiting = {};
function send(msg, ms) {
  const id = "m" + (++seq); msg.id = id;
  return new Promise((res) => {
    waiting[id] = res; parent.postMessage(msg, "*");
    setTimeout(() => { if (waiting[id]) { delete waiting[id]; res(null); } }, ms || 10000);
  });
}
const readFile = async (p) => { const m = await send({ kin: "files.read", path: p }); try { return m && m.body ? JSON.parse(m.body) : null; } catch { return null; } };
const writeFile = (p, o) => send({ kin: "files.write", path: p, body: JSON.stringify(o) });
const askKin = async (q) => { const m = await send({ kin: "ask", question: q }, ASK_MS); return m && m.ok ? String(m.text || "") : null; };
let kins = [], current = null, kinsKnown = false;
addEventListener("message", (e) => {
  const d = e.data || {};
  if (d.id && waiting[d.id]) { const f = waiting[d.id]; delete waiting[d.id]; f(d); }
  if (d.kin === "kins") showKins(d);
});
function showKins(d) {
  kins = Array.isArray(d.kins) ? d.kins : []; kinsKnown = true;
  current = (typeof d.current === "string" && kins.find((k) => k.id === d.current)) || kins[0] || null;
  renderMenu();
}
const kinName = () => (current && current.name) || "Your Kin";

// ---------- state ----------
const LEVELS = {
  beginner: { name: "Beginner", pips: 1, about: "Fires anywhere at random." },
  easy: { name: "Easy", pips: 2, about: "Mostly random, sometimes follows a hit." },
  normal: { name: "Normal", pips: 3, about: "Hunts in a pattern, then finishes ships off." },
  hard: { name: "Hard", pips: 4, about: "Works out where your ships can still be." },
};
const MODES = {
  kin: { name: "Your Kin calls every shot", tag: "Asks each turn", about: "Each turn your Kin is asked where to fire and says a line. If it doesn't answer in time, the app fires for it." },
  talk: { name: "App aims, your Kin talks", tag: "Asks on hits", about: "The app fires at the level below and asks your Kin for a line when someone hits, and at the end." },
  quiet: { name: "App aims, quietly", tag: "No questions", about: "No questions to your Kin. The result is still saved with a short run at the end." },
};
let settings = { mode: "kin", level: "normal", solo: "normal", sound: { on: true, vol: 0.7 } };
let stats = {}, achBook = {}, solo = emptySolo();
let game = null, kind = null, busy = false, place = null, setupKind = "solo";
let savedSolo = null, savedKin = null;
function emptySolo() { return { v: 1, levels: {}, streak: 0, best: null, ach: {} }; }
const saveSettings = () => writeFile("settings.json", settings);

// ---------- scenery, effects and sound ----------
$("bgart").innerHTML = ART.iowa();
addEventListener("pointermove", (e) => {
  if (FX.reduce()) return;
  const b = $("bgart").style; b.setProperty("--px", (e.clientX / innerWidth - 0.5).toFixed(3)); b.setProperty("--py", (e.clientY / innerHeight - 0.5).toFixed(3));
}, { passive: true });
FX.initFx($("fx")); FX.start();
function applySound() {
  const s = settings.sound; FX.setVolume(s.vol, !s.on);
  $("muteicon").textContent = !s.on || s.vol === 0 ? "🔇" : s.vol < 0.4 ? "🔉" : "🔊";
  $("mute").setAttribute("aria-label", s.on ? "Sound on. Turn sound off" : "Sound off. Turn sound on");
  $("vol").value = Math.round(s.vol * 100);
}
$("mute").onclick = () => { settings.sound.on = !settings.sound.on; FX.audio(); applySound(); saveSettings(); if (settings.sound.on) FX.sfx.click(); };
$("vol").oninput = () => { settings.sound.vol = $("vol").value / 100; settings.sound.on = settings.sound.vol > 0; applySound(); };
$("vol").onchange = () => { saveSettings(); FX.sfx.click(); };
addEventListener("pointerdown", () => FX.audio(), { once: true });
addEventListener("keydown", (e) => {
  if (e.key === "m" || e.key === "M") { if (!/INPUT|SELECT/.test(document.activeElement.tagName)) $("mute").click(); }
  if (e.key === "Escape" && !$("confirm").hidden) $("cno").click();
});
let bannerT = 0;
function banner(text, cls) {
  const b = $("banner"); $("bannertext").textContent = text;
  b.className = ""; void b.offsetWidth; b.className = (cls || "") + " go";
  clearTimeout(bannerT); bannerT = setTimeout(() => { b.className = ""; }, 1400 * Math.max(SPEED, 0.3));
}
function toast(icon, t1, t2, t3) {
  const t = el("div", "toast"), s = el("div", "seal", icon), body = el("div");
  body.append(el("div", "t1", t1), el("div", "t2", t2), el("div", "t3", t3)); t.append(s, body); $("toasts").append(t);
  FX.sfx.win();
  setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 450); }, 3200);
}

// ---------- screens ----------
function show(id) {
  for (const s of ["menu", "setup", "battle"]) $(s).hidden = s !== id;
  document.body.classList.toggle("inplay", id !== "menu");
  $("subline").textContent = id === "menu" ? "Naval command" : id === "setup" ? "Fleet deployment" : kind === "solo" ? "Solo · free" : "Versus " + kinName();
  requestAnimationFrame(() => boards.forEach((b) => b.sea.resize()));
  scrollTo({ top: 0, behavior: FX.reduce() ? "auto" : "smooth" });
}
$("home").onclick = () => { if (busy) return; FX.sfx.click(); goMenu(); };
async function goMenu() { place = null; show("menu"); await loadAll(); }

// ---------- boards ----------
const boards = [];
function makeBoard(box, fire) {
  box.textContent = "";
  const cl = el("div", "cl"), rl = el("div", "rl");
  for (let c = 1; c <= 10; c++) cl.append(el("span", "", c));
  for (let r = 0; r < 10; r++) rl.append(el("span", "", BS.ROWS[r]));
  const water = el("div", "water" + (fire ? " fire" : "")), canvas = el("canvas", "sea"), ships = el("div", "ships"), cells = el("div", "cells");
  water.append(canvas, el("div", "gridlines"), ships, cells);
  box.append(el("div"), cl, rl, water);
  const list = [];
  for (let i = 0; i < 100; i++) {
    const c = fire ? el("button", "cell") : el("div", "cell");
    if (fire) { c.type = "button"; c.tabIndex = i === 0 ? 0 : -1; c.addEventListener("click", () => fire(i)); }
    c.dataset.i = i; cells.append(c); list.push(c);
  }
  if (fire) cells.addEventListener("keydown", (e) => {
    const i = Number(e.target.dataset.i); if (isNaN(i)) return;
    const d = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -10, ArrowDown: 10 }[e.key]; if (d == null) return;
    e.preventDefault();
    let j = i + d; if (d === -1 && i % 10 === 0) j = i + 9; if (d === 1 && i % 10 === 9) j = i - 9; j = (j + 100) % 100;
    list[i].tabIndex = -1; list[j].tabIndex = 0; list[j].focus();
  });
  const b = { box, water, ships, cells: list, sea: new FX.Sea(canvas) };
  if (typeof ResizeObserver === "function") new ResizeObserver(() => b.sea.resize()).observe(water);
  boards.push(b); return b;
}
const center = (b, i) => { const r = b.cells[i].getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }; };
function shipNode(s, tag) {
  const n = el(tag || "div", "ship"), c0 = Math.min(...s.cells), across = s.len === 1 || s.cells[1] - s.cells[0] === 1;
  n.style.setProperty("--len", s.len);
  posShip(n, Math.floor(c0 / 10), c0 % 10, s.len, across);
  const h = el("div", "hull"); h.innerHTML = ART.ship(s.name, s.len); n.append(h);
  return n;
}
function posShip(n, r, c, len, across) {
  n.classList.toggle("v", !across);
  Object.assign(n.style, { left: c * 10 + "%", top: r * 10 + "%", width: (across ? len * 10 : 10) + "%", height: (across ? 10 : len * 10) + "%" });
}
const isAcross = (s) => s.len === 1 || s.cells[1] - s.cells[0] === 1;
const miniShip = (s, cls) => { const sp = el("span", cls || ""); sp.style.width = s.len * (innerWidth < 520 ? 8 : 12) + "px"; sp.innerHTML = ART.ship(s.name, s.len); sp.title = s.name; return sp; };

// ---------- menu ----------
function pips(n) { const p = el("span", "pips"); for (let k = 1; k <= 4; k++) p.append(el("i", k <= n ? "on" : "")); return p; }
function renderMenu() {
  const lv = $("sololevels"); lv.textContent = "";
  for (const [id, L] of Object.entries(LEVELS)) {
    const b = el("button", "lv"); b.type = "button"; b.setAttribute("role", "radio"); b.setAttribute("aria-checked", settings.solo === id);
    const t = el("b"); t.append(L.name, pips(L.pips)); b.append(t, el("small", "", L.about));
    b.onclick = () => { settings.solo = id; saveSettings(); FX.sfx.click(); renderMenu(); };
    lv.append(b);
  }
  const km = $("kinmodes"); km.textContent = "";
  for (const [id, M] of Object.entries(MODES)) {
    const b = el("button", "opt"); b.type = "button"; b.setAttribute("role", "radio"); b.setAttribute("aria-checked", settings.mode === id);
    const t = el("b"); t.append(M.name, el("span", "tag", M.tag)); b.append(t, el("small", "", M.about));
    b.onclick = () => { settings.mode = id; saveSettings(); FX.sfx.click(); renderMenu(); };
    km.append(b);
  }
  $("level").value = settings.level;
  const bar = $("kinbar");
  if (!kinsKnown) bar.textContent = "Looking for your Kin…";
  else if (!current) bar.textContent = "No Kin is attached to this app yet. Attach one in the app's settings → Kins to play it. Solo works without one.";
  else { bar.textContent = ""; bar.append("Your Kin plays you, calls its shots and talks while you play. Opponent: "); bar.append(el("strong", "", current.name || "your Kin")); bar.append("."); }
  $("kintitle").textContent = current ? "Play " + (current.name || "your Kin") : "Play your Kin";
  $("playkin").disabled = !current;
  $("playkin").firstChild.textContent = current ? "Challenge " + (current.name || "your Kin") + " " : "Challenge your Kin ";
  // unfinished games
  const rs = $("resumes"); rs.textContent = "";
  const card = (title, sub, label, fn, cls) => { const c = el("div", "resume"), t = el("div"); t.append(el("b", "", title), el("small", "", sub)); const b = el("button", "btn sm " + (cls || "")); b.type = "button"; b.textContent = label; b.onclick = fn; c.append(t, b); rs.append(c); };
  if (savedSolo && !savedSolo.over) card("Solo battle in progress", `${(LEVELS[savedSolo.level] || LEVELS.normal).name} · ${savedSolo.you.shots.length} shots fired · free`, "Resume", () => resume(savedSolo, "solo"));
  if (savedKin && savedKin.v === 1 && !savedKin.over) card(`Battle with ${kinName()} in progress`, (savedKin.via === "chat" ? "Started in chat · " : "") + `${savedKin.you.shots.length} shots fired · uses credits`, "Resume", () => resume(savedKin, "kin"), "alt");
  renderRecords(); renderAch();
}
function renderRecords() {
  const box = $("records"); box.textContent = "";
  const g = el("div", "rec");
  g.append(el("span", "h", "Solo"), el("span", "h", "Won"), el("span", "h", "Lost"), el("span", "h", "Accuracy"));
  let any = false;
  for (const [id, L] of Object.entries(LEVELS)) {
    const r = solo.levels[id] || { won: 0, lost: 0, shots: 0, hits: 0 };
    if (r.won || r.lost) any = true;
    g.append(el("span", "", L.name), el("b", "w", r.won), el("b", "l", r.lost), el("b", "", r.shots ? Math.round(100 * r.hits / r.shots) + "%" : "–"));
  }
  g.append(el("span", "sep"));
  const k = current && stats[current.id] || stats.any;
  g.append(el("span", "", "vs " + kinName()), el("b", "w", k ? k.lost : 0), el("b", "l", k ? k.won : 0), el("b", "", ""));
  box.append(g);
  const foot = el("p", "fine", any ? `Win streak in solo: ${solo.streak || 0}` + (solo.best ? ` · fastest win: ${solo.best} shots` : "") : "No solo battles yet. Your record here is kept in this app's files.");
  box.append(foot);
}
function renderAch() {
  const box = $("achs"); box.textContent = "";
  const book = (current && achBook[current.id]) || achBook.any || { you: {}, kin: {} };
  let got = 0;
  for (const a of BS.ACH) {
    const ns = solo.ach[a.id] || 0, nk = book.you && book.you[a.id] ? book.you[a.id].n : 0;
    const c = el("div", "ach" + (ns || nk ? " got" : "")); if (ns || nk) got++;
    const t = el("div"); t.append(el("b", "", a.name), el("small", "", a.about));
    if (ns || nk) t.append(el("span", "cnt", [ns ? "Solo ×" + ns : "", nk ? "vs Kin ×" + nk : ""].filter(Boolean).join(" · ")));
    c.append(el("span", "ai", a.icon), t); box.append(c);
  }
  $("achsum").textContent = `${got} of ${BS.ACH.length}`;
}
$("level").onchange = () => { settings.level = $("level").value; saveSettings(); };
$("playsolo").onclick = () => { FX.sfx.click(); startSetup("solo"); };
$("playkin").onclick = () => { if (!current) return; FX.sfx.click(); startSetup("kin"); };

// ---------- setup: drag, rotate, random ----------
let setupBoard = null;
function startSetup(k) {
  setupKind = k; game = null; kind = null;
  place = { ships: BS.randomFleet(), sel: 0 };
  if (!setupBoard) setupBoard = makeBoard($("setupboard"), null);
  $("setupkicker").textContent = k === "solo" ? `Solo · ${LEVELS[settings.solo].name} · Free, no credits` : `Versus ${kinName()} · Uses Kindroid credits`;
  show("setup"); drawSetup();
}
function drawSetup(focusIdx) {
  const p = place, layer = setupBoard.ships; layer.textContent = "";
  p.ships.forEach((s, i) => {
    const n = shipNode(s, "button"); n.type = "button"; n.classList.add("drag"); if (i === p.sel) n.classList.add("sel");
    n.setAttribute("aria-label", `${s.name}, ${s.len} squares, ${isAcross(s) ? "across" : "down"} from ${BS.name(Math.min(...s.cells))}. Arrows move, R rotates.`);
    n.addEventListener("pointerdown", (e) => dragStart(e, i, n));
    n.addEventListener("keydown", (e) => shipKey(e, i));
    n.addEventListener("focus", () => { if (p.sel !== i) { p.sel = i; markSel(); } });
    layer.append(n);
  });
  const ro = $("roster"); ro.textContent = "";
  p.ships.forEach((s, i) => {
    const li = el("li"), b = el("button", i === p.sel ? "sel" : ""); b.type = "button";
    const pic = el("span", "rs"); pic.style.width = s.len * 22 + "px"; pic.innerHTML = ART.ship(s.name, s.len);
    b.append(el("b", "", s.name), el("small", "", `${s.len} · ${BS.name(Math.min(...s.cells))} ${isAcross(s) ? "→" : "↓"}`), pic);
    b.onclick = () => { p.sel = i; FX.sfx.click(); drawSetup(i); };
    li.append(b); ro.append(li);
  });
  if (focusIdx != null) layer.children[focusIdx] && layer.children[focusIdx].focus({ preventScroll: true });
}
function markSel() {
  [...setupBoard.ships.children].forEach((n, i) => n.classList.toggle("sel", i === place.sel));
  [...$("roster").querySelectorAll("button")].forEach((b, i) => b.classList.toggle("sel", i === place.sel));
}
function moveTo(i, r, c, across) {
  const s = place.ships[i], cells = BS.cellsOf(r, c, s.len, across);
  if (!BS.fits(place.ships, cells, i)) return false;
  s.cells = cells; return true;
}
function rotate(i) {
  const s = place.ships[i], c0 = Math.min(...s.cells), r0 = Math.floor(c0 / 10), k0 = c0 % 10, across = !isAcross(s);
  // turn about the first square; if that's blocked, the nearest spot that fits
  const tries = [];
  for (let r = 0; r < 10; r++) for (let c = 0; c < 10; c++) tries.push([Math.abs(r - r0) + Math.abs(c - k0), r, c]);
  tries.sort((a, b) => a[0] - b[0]);
  for (const [, r, c] of tries) if (moveTo(i, r, c, across)) { FX.sfx.rotate(); return true; }
  return false;
}
function shipKey(e, i) {
  const s = place.ships[i], c0 = Math.min(...s.cells), r = Math.floor(c0 / 10), c = c0 % 10;
  if (e.key === "r" || e.key === "R") { e.preventDefault(); rotate(i); drawSetup(i); return; }
  const d = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }[e.key];
  if (!d) return;
  e.preventDefault();
  for (let k = 1; k < 10; k++) if (moveTo(i, r + d[0] * k, c + d[1] * k, isAcross(s))) { FX.sfx.place(); break; }
  drawSetup(i);
}
let drag = null;
function cellAt(x, y) { const r = setupBoard.water.getBoundingClientRect(), cs = r.width / 10; return { r: Math.floor((y - r.top) / cs), c: Math.floor((x - r.left) / cs), cs }; }
function dragStart(e, i, n) {
  if (e.button > 0) return;
  e.preventDefault();
  const s = place.ships[i], c0 = Math.min(...s.cells), across = isAcross(s), at = cellAt(e.clientX, e.clientY);
  const seg = across ? at.c - c0 % 10 : at.r - Math.floor(c0 / 10);
  drag = { i, n, seg, across, x0: e.clientX, y0: e.clientY, moved: false, r: Math.floor(c0 / 10), c: c0 % 10, ok: true };
  place.sel = i; markSel(); n.classList.add("dragging");
  try { n.setPointerCapture(e.pointerId); } catch {}
  const foot = el("div", "foot ok"); setupBoard.ships.append(foot); drag.foot = foot;
  n.addEventListener("pointermove", dragMove); n.addEventListener("pointerup", dragEnd); n.addEventListener("pointercancel", dragEnd);
  dragMove(e);
}
function dragMove(e) {
  if (!drag) return;
  const d = drag, s = place.ships[d.i];
  if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > 4) d.moved = true;
  const at = cellAt(e.clientX, e.clientY);
  let r = d.across ? at.r : at.r - d.seg, c = d.across ? at.c - d.seg : at.c;
  r = Math.max(0, Math.min(d.across ? 9 : 10 - s.len, r)); c = Math.max(0, Math.min(d.across ? 10 - s.len : 9, c));
  const ok = BS.fits(place.ships, BS.cellsOf(r, c, s.len, d.across), d.i);
  if (r !== d.r || c !== d.c) { d.r = r; d.c = c; if (d.moved) FX.sfx.click(); }
  d.ok = ok; posShip(d.n, r, c, s.len, d.across); d.n.classList.toggle("bad", !ok);
  posShip(d.foot, r, c, s.len, d.across); d.foot.className = "foot " + (ok ? "ok" : "bad"); d.foot.classList.remove("v");
}
function dragEnd() {
  const d = drag; if (!d) return; drag = null;
  d.n.removeEventListener("pointermove", dragMove); d.n.removeEventListener("pointerup", dragEnd); d.n.removeEventListener("pointercancel", dragEnd);
  if (!d.moved) { FX.sfx.click(); drawSetup(d.i); return; }
  if (d.ok && moveTo(d.i, d.r, d.c, d.across)) FX.sfx.place();
  drawSetup(d.i);
}
$("rotate").onclick = () => { if (place && place.sel >= 0) { rotate(place.sel); drawSetup(place.sel); } };
$("shuffle").onclick = () => { place.ships = BS.randomFleet(); FX.sfx.place(); drawSetup(); };
$("backmenu").onclick = () => { FX.sfx.click(); goMenu(); };
addEventListener("keydown", (e) => {
  if ($("setup").hidden || !place || !(e.key === "r" || e.key === "R")) return;
  if (document.activeElement && document.activeElement.classList.contains("drag")) return;   // handled on the ship
  rotate(place.sel); drawSetup(place.sel);
});
$("start").onclick = async () => {
  const ships = place.ships.map((s) => ({ name: s.name, len: s.len, cells: s.cells.slice() }));
  if (setupKind === "solo") {
    game = BS.newGame({ yourShips: ships, via: "solo" }); game.level = settings.solo; kind = "solo";
  } else {
    game = BS.newGame({ yourShips: ships, via: "screen" }); kind = "kin";
  }
  place = null; FX.sfx.click();
  await save();
  enterBattle();
  banner("Battle stations"); FX.sfx.turn();
  say((kind === "solo" ? "The enemy fleet is out there somewhere. You fire first: pick a square in enemy waters." : `<b>${esc(kinName())}</b>'s fleet is out there somewhere. You fire first: pick a square in enemy waters.`) + " A hit earns another shot; a miss passes the turn.");
};
const save = () => game && writeFile(kind === "solo" ? "solo-game.json" : "game.json", game);

// ---------- battle ----------
let foeBoard = null, youBoard = null, shownSunk = new Set(), lastShot = { you: -1, kin: -1 };
function foeLabel() { return kind === "solo" ? "Computer" : kinName(); }
function enterBattle() {
  if (!foeBoard) { foeBoard = makeBoard($("foeboard"), playerFire); youBoard = makeBoard($("youboard"), null); }
  shownSunk = new Set(BS.sunkShips(game.kin, game.you).map((s) => "kin:" + s.name).concat(BS.sunkShips(game.you, game.kin).map((s) => "you:" + s.name)));
  lastShot = { you: -1, kin: -1 };
  $("result").hidden = true;
  $("foename").textContent = foeLabel();
  $("foetag").textContent = kind === "solo" ? `${LEVELS[game.level || "normal"].name} · free, no credits` : `${MODES[settings.mode].name} · uses credits`;
  show("battle"); draw();
}
function say(html, thinking) { const s = $("say"); s.innerHTML = html; s.classList.toggle("thinking", !!thinking); }
function sayKin(text, head) { const s = $("say"); s.classList.remove("thinking"); s.textContent = ""; s.append(el("b", "", kinName() + ": "), text); if (head) s.append(document.createElement("br"), el("small", "", head)); }
function setTurn() {
  const t = $("turnbox"), over = game && game.over;
  t.className = "hcell turn" + (over ? " done" : game.turn === "kin" ? " enemy" : "");
  const last = game && game[game.turn] && game[game.turn].shots[game[game.turn].shots.length - 1];
  const again = !!(last && last.hit && !over);
  $("turntext").textContent = over ? (over === "you" ? "Victory" : over === "quit" ? "Ended" : "Defeat")
    : game.turn === "you" ? (busy ? "Firing…" : again ? "Fire again" : "Your turn")
    : again ? (kind === "solo" ? "Enemy fires again" : kinName() + " fires again")
    : (kind === "solo" ? "Enemy firing" : kinName() + " firing");
  foeBoard.water.classList.toggle("locked", busy || game.turn !== "you" || !!over);
}
function draw() {
  if (!game || !foeBoard) return;
  const paint = (b, side, foe, own) => {
    const shots = new Map(game[foe].shots.map((s) => [s.cell, s])), sunk = BS.sunkShips(game[side], game[foe]), dead = new Set(sunk.flatMap((s) => s.cells));
    const last = game[foe].shots[game[foe].shots.length - 1];
    b.cells.forEach((c, i) => {
      const s = shots.get(i);
      c.className = "cell" + (own ? "" : (!s && !game.over ? " open" : "")) + (last && last.cell === i ? " last" : "");
      let mk = c.firstChild;
      if (s) {
        if (!mk) { mk = el("span"); c.append(mk); }
        const cls = "mk " + (s.hit ? "hit" : "miss") + (dead.has(i) ? " dead" : "");
        if (mk.dataset.k !== cls) { mk.className = cls + (lastShot[foe] === i ? " new" : ""); mk.dataset.k = cls; }
      } else if (mk) mk.remove();
      if (!own) c.setAttribute("aria-label", BS.name(i) + (s ? (s.hit ? ", hit" : ", miss") : ", open water"));
    });
    // ships: yours always; theirs once sunk (and all of them when the game is over)
    b.ships.textContent = "";
    const showList = own || game.over ? game[side].ships : sunk;
    for (const s of showList) {
      const n = shipNode(s), down = dead.has(s.cells[0]) && s.cells.every((x) => dead.has(x)), key = side + ":" + s.name;
      if (down) { n.classList.add("sunk"); if (!shownSunk.has(key)) { n.classList.add(own ? "sinking" : "reveal"); shownSunk.add(key); } }
      else if (!own) n.classList.add("ghost");
      b.ships.append(n);
    }
  };
  paint(foeBoard, "kin", "you", false);
  paint(youBoard, "you", "kin", true);
  const fleet = (box, side, foe) => { box.textContent = ""; const down = new Set(BS.sunkShips(game[side], game[foe]).map((s) => s.name)); game[side].ships.forEach((s) => box.append(miniShip(s, down.has(s.name) ? "down" : ""))); };
  fleet($("foefleet"), "kin", "you"); fleet($("youfleet"), "you", "kin");
  const sc = BS.score(game);
  $("hshots").textContent = sc.you.shots; $("hhits").textContent = sc.you.hits;
  $("hacc").textContent = sc.you.shots ? Math.round(100 * sc.you.hits / sc.you.shots) + "%" : "–";
  setTurn();
  const log = $("log"); log.textContent = "";
  const all = [...game.you.shots.map((s, k) => ({ ...s, who: "You", k: k * 2 })), ...game.kin.shots.map((s, k) => ({ ...s, who: foeLabel(), k: k * 2 + 1 }))].sort((a, b) => (b.at || 0) - (a.at || 0) || b.k - a.k).slice(0, 14);
  for (const s of all) {
    const li = el("li", s.sunk ? "s" : s.hit ? "h" : "m");
    li.append(el("span", "who", s.who), el("span", "", BS.name(s.cell).padEnd(3, " ")), el("span", "res", s.sunk ? "SANK " + s.sunk.toUpperCase() : s.hit ? "HIT" : "miss"));
    log.append(li);
  }
}
FX.setBurning(() => {
  if (!game || $("battle").hidden) return [];
  const out = [];
  for (const s of game.you.shots) if (s.hit) out.push(center(foeBoard, s.cell));
  for (const s of game.kin.shots) if (s.hit) out.push(center(youBoard, s.cell));
  return out;
});

// One shell, from the shooter's side to the cell on the target board.
async function volley(target, i, who) {
  const to = center(target, i);
  let from;
  if (who === "you") { const r = youBoard.water.getBoundingClientRect(); from = { x: r.left + r.width / 2, y: Math.min(innerHeight - 10, r.bottom) }; }
  else { const r = foeBoard.water.getBoundingClientRect(); from = { x: r.left + r.width * 0.5, y: Math.max(10, r.top - 30) }; }
  FX.sfx.cannon();
  const ms = 760 * Math.max(SPEED, 0.15);
  FX.sfx.whistle(ms);
  await FX.shell(from.x, from.y, to.x, to.y, ms);
  if (FX.reduce()) await wait(120);
}
function impact(target, i, r, side) {
  const p = center(target, i);
  lastShot[side] = i;
  if (r.hit) {
    FX.explode(p.x, p.y, r.sunk ? 1.5 : 1); FX.sfx.hit(); FX.shake($("app"), !!r.sunk);
    if (r.sunk) {
      const ship = game[BS.other(side)].ships.find((s) => s.name === r.sunk);
      setTimeout(() => {
        FX.sfx.sink();
        if (ship) { const a = center(target, Math.min(...ship.cells)), b = center(target, Math.max(...ship.cells)); FX.bubbles(Math.min(a.x, b.x) - a.w / 2, a.y - a.h / 2, Math.abs(b.x - a.x) + a.w, Math.abs(b.y - a.y) + a.h); }
      }, 260 * SPEED);
      banner((side === "you" ? "Sunk: " : "Lost: ") + r.sunk, side === "you" ? "sunk" : "enemy");
    }
  } else { FX.splash(p.x, p.y, 1); FX.sfx.splash(); }
}

async function playerFire(i) {
  if (!game || game.over || game.turn !== "you" || busy) return;
  if (game.you.shots.some((s) => s.cell === i)) return;
  busy = true; setTurn(); $("banner").className = "";
  await volley(foeBoard, i, "you");
  const r = BS.fire(game, "you", i);
  if (r.error) { busy = false; setTurn(); return; }
  impact(foeBoard, i, r, "you");
  if (kind === "kin") achieved(BS.checkAch(game, "you"), "you"); else soloAch(BS.checkAch(game, "you"));
  draw(); await save();
  const what = r.sunk ? `You sank ${kind === "solo" ? "the enemy" : esc(kinName()) + "'s"} ${r.sunk}!` : r.hit ? `${BS.name(i)}: direct hit!` : `${BS.name(i)}: a miss.`;
  if (game.over) { busy = false; return finish(); }
  if (r.hit) {
    say(what + " Fire again.");
    banner(r.sunk ? `Sunk: ${r.sunk} — fire again` : "Hit! Fire again", r.sunk ? "sunk" : "small");
    await wait(350);
    busy = false; draw();
    return;
  }
  say(what);
  await wait(450);
  await enemyTurn(r);
  busy = false; draw();
  if (game.over) finish();
}

async function enemyTurn(mine) {
  if (!game || game.turn !== "kin") return;
  let first = true;
  while (game && !game.over && game.turn === "kin") {
    const again = !first;
    banner(again ? (kind === "solo" ? "Hit! Enemy fires again" : "Hit! " + kinName() + " fires again")
                 : (kind === "solo" ? "Enemy firing" : kinName() + " firing"), "enemy small");
    FX.sfx.turn(); setTurn();
    let cell = -1, line = "";
    if (kind === "kin" && settings.mode === "kin" && current) {
      say(`${esc(kinName())} is lining up a shot`, true);
      const text = await askKin(BS.kinQuestion(game, settings.level));
      if (text != null) { const got = BS.readShot(game, text); cell = got.shot; line = got.say; }
    } else await wait(again ? 800 : 550);
    const byApp = cell < 0;
    if (byApp) cell = BS.aim(game, "kin", kind === "solo" ? game.level || "normal" : settings.level);
    if (!game || game.turn !== "kin") return;
    await volley(youBoard, cell, "kin");
    const r = BS.fire(game, "kin", cell);
    impact(youBoard, cell, r, "kin");
    if (kind === "kin") achieved(BS.checkAch(game, "kin"), "kin");
    draw(); await save();
    const who = kind === "solo" ? "The enemy" : kinName();
    const what = r.sunk ? `sank your ${r.sunk}` : r.hit ? "hit one of your ships" : "missed";
    const more = r.hit && !game.over ? " They fire again." : (game.over ? "" : " Your shot.");
    const head = `${who} fired at ${BS.name(cell)} and ${what}.`;
    if (line) sayKin(line, head + more);
    else say(esc(head) + (kind === "kin" && settings.mode === "kin" && byApp && current ? " <small>(Your Kin didn't answer in time, so the app took its shot.)</small>" : "") + (more ? " <small>" + more.trim() + "</small>" : ""));
    if (kind === "kin" && settings.mode === "talk" && (r.hit || (mine && mine.sunk)) && !game.over)
      talk(`We're playing Battleship in the Kin Battleship app. ${!mine ? "" : mine.sunk ? "They just sank your " + mine.sunk + "." : mine.hit ? "They just hit one of your ships." : ""} You fired at ${BS.name(cell)} and ${what}${r.hit && !game.over ? " You get to fire again." : ""}. Say one short line to your person about it, in your own voice. Reply with just the line.`, head + more);
    if (r.hit && !game.over) { first = false; await wait(700); continue; }
    if (!game.over) { await wait(250); banner("Your turn", "small"); }
    break;
  }
}
let talking = false;
async function talk(q, head) {
  if (talking || !current || kind !== "kin") return; talking = true;
  const t = await askKin(q); talking = false;
  if (t && kind === "kin") sayKin(t.replace(/^["“]|["”]$/g, "").slice(0, 240), head);
}

// ---------- the end of a game ----------
async function finish() {
  draw();
  const won = game.over === "you", sc = BS.score(game);
  setTimeout(() => (won ? FX.sfx.win() : FX.sfx.lose()), 500 * SPEED);
  if (kind === "solo") {
    const lv = game.level || "normal", r = solo.levels[lv] = solo.levels[lv] || { won: 0, lost: 0, shots: 0, hits: 0 };
    if (!game.told) {
      if (won) { r.won++; solo.streak = (solo.streak || 0) + 1; if (!solo.best || sc.you.shots < solo.best) solo.best = sc.you.shots; } else { r.lost++; solo.streak = 0; }
      r.shots += sc.you.shots; r.hits += sc.you.hits;
      if (won && solo.streak >= 3 && !game.ach.includes("you:fleet_admiral")) { game.ach.push("you:fleet_admiral"); soloAch(["fleet_admiral"]); }
      game.told = true;
      await Promise.all([writeFile("solo-stats.json", solo), save()]);
    }
    say(won ? `You sank the enemy fleet in ${sc.you.shots} shots.` : `The enemy sank your fleet in ${sc.kin.shots} shots.`);
  } else {
    say(won ? `You sank ${esc(kinName())}'s whole fleet in ${sc.you.shots} shots!` : `${esc(kinName())} sank your whole fleet in ${sc.kin.shots} shots.`);
    send({ kin: "action", name: "battleship_record", input: current ? { kin_id: current.id } : {} }, 60000).then(async () => {
      stats = (await readFile("stats.json")) || stats;
      const g = await readFile("game.json");
      if (g && game && g.id === game.id && (g.ach || []).includes(g.over + ":fleet_admiral") && !(game.ach || []).includes(g.over + ":fleet_admiral")) achieved(["fleet_admiral"], g.over);
      achBook = (await readFile("achievements.json")) || achBook;
    });
    if (settings.mode !== "quiet" && current) talk(`We just finished a game of Battleship in the Kin Battleship app. ${won ? `Your person won: they sank your whole fleet in ${sc.you.shots} shots, and you'd sunk ${sc.kin.sunk.length} of their 5 ships.` : `You won: you sank their whole fleet in ${sc.kin.shots} shots, and they'd sunk ${sc.you.sunk.length} of your 5 ships.`} Say one or two short lines to them about the game, in your own voice. Reply with just the lines.`);
  }
  setTimeout(() => showResult(won, sc), 1100 * SPEED);
}
function showResult(won, sc) {
  $("banner").className = ""; const o = $("result"); o.className = "overlay " + (won ? "win" : "lose"); o.hidden = false;
  $("rkicker").textContent = kind === "solo" ? `Solo · ${LEVELS[game.level || "normal"].name}` : "Versus " + kinName();
  $("rtitle").textContent = won ? "Victory" : "Defeat";
  $("rline").textContent = won ? `Every enemy ship is on the bottom. ${5 - sc.kin.sunk.length} of your 5 ships made it home.` : `Your fleet is lost. You sank ${sc.you.sunk.length} of 5 enemy ships.`;
  const st = $("rstats"); st.textContent = "";
  const add = (v, l) => { const d = el("div"); d.append(el("b", "", v), el("small", "", l)); st.append(d); };
  add(sc.you.shots, "Shots"); add(sc.you.shots ? Math.round(100 * sc.you.hits / sc.you.shots) + "%" : "–", "Accuracy"); add(sc.kin.sunk.length + " / 5", "Ships lost");
  $("again").focus({ preventScroll: true });
}
$("again").onclick = () => { const k = kind; $("result").hidden = true; FX.sfx.click(); startSetup(k === "kin" && current ? "kin" : "solo"); };
$("tomenu").onclick = () => { $("result").hidden = true; FX.sfx.click(); goMenu(); };
$("quit").onclick = () => {
  if (!game || game.over || busy) return;
  $("ctext").textContent = kind === "solo" ? "This solo game counts as a loss." : "This game ends here and isn't recorded.";
  $("confirm").hidden = false; $("cno").focus();
};
$("cno").onclick = () => { $("confirm").hidden = true; };
$("cyes").onclick = async () => {
  $("confirm").hidden = true;
  if (!game || game.over) return;
  if (kind === "solo") {
    const lv = game.level || "normal", r = solo.levels[lv] = solo.levels[lv] || { won: 0, lost: 0, shots: 0, hits: 0 };
    r.lost++; r.shots += game.you.shots.length; r.hits += game.you.shots.filter((s) => s.hit).length; solo.streak = 0;
    game.over = "quit"; game.told = true; await Promise.all([writeFile("solo-stats.json", solo), save()]);
  } else { game.over = "quit"; game.told = true; await save(); }
  FX.sfx.lose(); goMenu();
};

// ---------- achievements ----------
function soloAch(ids) { for (const id of ids || []) { solo.ach[id] = (solo.ach[id] || 0) + 1; const a = BS.achById(id); toast(a.icon, "You earned", a.name, a.about); } if (ids && ids.length) writeFile("solo-stats.json", solo); }
function achieved(ids, who) { for (const id of ids || []) { const a = BS.achById(id); toast(a.icon, who === "you" ? "You earned" : kinName() + " earned", a.name, a.about); } }

// ---------- loading and resuming ----------
async function resume(g, k) {
  game = g; kind = k; FX.sfx.click(); enterBattle();
  if (game.turn === "you") {
    const last = game.you.shots[game.you.shots.length - 1];
    const again = last && last.hit;
    say(game.via === "chat" && !game.you.shots.length ? "This game started in chat. Your shot: pick a square in enemy waters. A hit earns another shot; a miss passes the turn."
      : again ? "Your last shot was a hit. Fire again: pick a square in enemy waters."
      : "Your shot: pick a square in enemy waters. A hit earns another shot; a miss passes the turn.");
  }
  else { busy = true; setTurn(); await enemyTurn(null); busy = false; draw(); if (game.over) finish(); }
}
async function loadAll() {
  const [g, sg, s, st, ab, so] = await Promise.all([readFile("game.json"), readFile("solo-game.json"), readFile("settings.json"), readFile("stats.json"), readFile("achievements.json"), readFile("solo-stats.json")]);
  if (s) { settings = Object.assign(settings, s); settings.sound = Object.assign({ on: true, vol: 0.7 }, s.sound || {}); if (!LEVELS[settings.solo]) settings.solo = "normal"; if (!MODES[settings.mode]) settings.mode = "kin"; }
  stats = st || {}; achBook = ab || {}; solo = Object.assign(emptySolo(), so || {});
  savedKin = g; savedSolo = sg && sg.v === 1 ? sg : null;
  applySound(); renderMenu();
}
// A Kin game can move between the chat and here: look again whenever the screen comes back.
document.addEventListener("visibilitychange", async () => {
  if (document.hidden || busy) return;
  if (!$("menu").hidden) return loadAll();
  if (kind === "kin" && game && !$("battle").hidden) {
    const g = await readFile("game.json");
    if (!g || g.id !== game.id || g.over) { if (!game.over) goMenu(); return; }
    if (g.you.shots.length !== game.you.shots.length || g.kin.shots.length !== game.kin.shots.length) { game = g; draw(); if (game.turn === "kin") { busy = true; await enemyTurn(null); busy = false; draw(); if (game.over) finish(); } }
  }
});
parent.postMessage({ kin: "kins" }, "*");
loadAll();
