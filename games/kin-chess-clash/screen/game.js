// Chess Clash: the app around the scene. Menu, Solo (free, all on this screen) and Kin mode (asks your Kin, uses credits).
"use strict";
(function () {
const C = ChessEngine, AI = ChessAI, SFX = ClashSfx;
const Q = new URLSearchParams(location.search), FAST = Q.get("fast") === "1", ASK_MS = (Number(Q.get("asktimeout")) || 30) * 1000;
const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const wait = (ms) => new Promise((r) => setTimeout(r, FAST ? Math.min(ms, 20) : ms));
const LV = ["beginner", "easy", "normal", "hard"], LVN = { beginner: "Beginner", easy: "Easy", normal: "Normal", hard: "Hard" };
const LVD = { beginner: "Learning the moves", easy: "Casual", normal: "A real fight", hard: "Thinks five moves deep" };
const SIDE = (w) => (w ? "Light" : "Dark");

// ---------- talking to the page around the screen ----------
let seq = 0; const waiting = {};
function send(msg, ms) {
  const id = "m" + (++seq); msg.id = id;
  return new Promise((res) => { waiting[id] = res; parent.postMessage(msg, "*"); setTimeout(() => { if (waiting[id]) { delete waiting[id]; res(null); } }, ms || 10000); });
}
const read = async (p) => { const m = await send({ kin: "files.read", path: p }); try { return m && m.body ? JSON.parse(m.body) : null; } catch { return null; } };
const write = (p, o) => send({ kin: "files.write", path: p, body: JSON.stringify(o) });
const ask = async (q) => { const m = await send({ kin: "ask", question: q.slice(0, 7900) }, ASK_MS); return m && m.ok && m.text ? String(m.text) : null; };
let kins = [], current = null;
const kinName = () => (current && current.name) || "Your Kin";
addEventListener("message", (e) => {
  const d = e.data || {};
  if (d.id && waiting[d.id]) { const f = waiting[d.id]; delete waiting[d.id]; f(d); }
  if (d.kin === "kins") {
    kins = Array.isArray(d.kins) ? d.kins : [];
    current = (typeof d.current === "string" && kins.find((k) => k.id === d.current)) || kins[0] || null;
    $("kintitle").textContent = current ? `Play ${current.name}` : "Play your Kin";
    $("kinbar").textContent = current ? `${current.name} takes the other side. Pick how they play.` : "No Kin is attached yet. Attach one in the app's settings → Kins and they'll play you; until then the app plays their side.";
    renderMenu();
  }
});

// ---------- settings ----------
const settings = { mode: "kin", level: "normal", solo: "normal", color: "w", anim: "full", sound: { on: true, vol: 0.7 } };
function loadSettings(s) {
  if (!s) return;
  for (const k of ["mode", "level", "solo", "color", "anim"]) if (typeof s[k] === "string") settings[k] = s[k];
  if (!s.anim && s.fights) settings.anim = s.fights === "quick" ? "fast" : s.fights === "off" ? "off" : "full"; // older settings
  if (typeof s.sound === "boolean") settings.sound.on = s.sound;
  else if (s.sound && typeof s.sound === "object") settings.sound = { on: s.sound.on !== false, vol: Math.max(0, Math.min(1, Number(s.sound.vol) || 0)) };
  if (!LV.includes(settings.level)) settings.level = "normal";
  if (!LV.includes(settings.solo)) settings.solo = "normal";
  if (!["full", "fast", "off"].includes(settings.anim)) settings.anim = "full";
}
const saveSettings = () => write("settings.json", settings);
function applySound() {
  SFX.setVolume(settings.sound.vol, !settings.sound.on);
  $("muteicon").textContent = !settings.sound.on || settings.sound.vol === 0 ? "🔇" : settings.sound.vol < 0.4 ? "🔉" : "🔊";
  $("mute").setAttribute("aria-label", settings.sound.on ? "Sound on. Press to mute." : "Sound off. Press to turn it on.");
  $("vol").value = Math.round(settings.sound.vol * 100);
}
function applyAnim() {
  Scene.setAnim(settings.anim);
  if (FAST) Scene.state.speed = 0.06;
  $("animsel").value = settings.anim; renderSeg();
}

// ---------- state ----------
// G is the game being played. kind "solo" or "kin". Solo games are stored as a move line and replayed (makes undo easy).
let G = null, busy = false, over = false, sel = -1, promoWait = null, flipped = false, view = "menu", talking = false, lastLine = 0, gen = 0;
let soloStats = { v: 1, levels: {}, streak: 0, best: 0 }, ACHV = {}, kinStats = null;
const youW = () => G && G.you === "w";
const mine = (p) => p && C.isW(p) === youW();
const foeLabel = () => (G.kind === "solo" ? "Computer" : kinName());

// ---------- layout ----------
const stage = $("stage");
Scene.init(stage);
function layout() {
  if (view === "menu") { Scene.setArea({ x: innerWidth * 0.12, y: innerHeight * 0.34, w: innerWidth * 0.76, h: innerHeight * 0.62 }); return; }
  const r = $("boardarea").getBoundingClientRect();
  Scene.setArea({ x: r.left, y: r.top, w: r.width, h: r.height });
}
addEventListener("resize", () => requestAnimationFrame(layout));

function show(v) {
  view = v;
  $("menu").hidden = v !== "menu"; $("game").hidden = v !== "game";
  document.body.dataset.view = v;
  Scene.state.menu = v === "menu";
  if (v === "menu") { Scene.settle(C.fromFen(C.START).b); Scene.setFlip(false); Scene.state.hl = { sel: -1, targets: [], last: null, check: -1, cursor: -1, hover: -1 }; }
  requestAnimationFrame(layout);
}

// ---------- menu ----------
function radioGroup(box, items, value, onPick) {
  box.textContent = "";
  for (const it of items) {
    const b = el("button", "opt" + (it.v === value ? " on" : ""));
    b.type = "button"; b.setAttribute("role", "radio"); b.setAttribute("aria-checked", it.v === value ? "true" : "false");
    b.append(el("b", "", it.name)); if (it.sub) b.append(el("small", "", it.sub));
    b.onclick = () => { SFX.select(); onPick(it.v); };
    box.append(b);
  }
  box.onkeydown = (e) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
    const i = items.findIndex((x) => x.v === value), n = (i + (e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 1) + items.length) % items.length;
    e.preventDefault(); onPick(items[n].v); box.children[n] && box.children[n].focus();
  };
}
function renderSeg() {
  radioGroup($("animseg"), [{ v: "full", name: "Full" }, { v: "fast", name: "Fast" }, { v: "off", name: "Off" }], settings.anim, (v) => { settings.anim = v; applyAnim(); saveSettings(); });
}
function renderMenu() {
  radioGroup($("sololevels"), LV.map((v) => ({ v, name: LVN[v], sub: LVD[v] })), settings.solo, (v) => { settings.solo = v; saveSettings(); renderMenu(); });
  radioGroup($("colors"), [{ v: "w", name: "Light", sub: "moves first" }, { v: "b", name: "Dark" }, { v: "random", name: "Random" }], settings.color, (v) => { settings.color = v; saveSettings(); renderMenu(); });
  radioGroup($("kinmodes"), [
    { v: "kin", name: `${current ? current.name : "Your Kin"} picks`, sub: "They choose every move and talk. Uses the most credits." },
    { v: "talk", name: "App moves, Kin talks", sub: "They comment on big moments. Fewer credits." },
    { v: "quiet", name: "Quiet", sub: "The app plays their side; no questions to your Kin." },
  ], settings.mode, (v) => { settings.mode = v; saveSettings(); renderMenu(); });
  $("level").value = settings.level;
  renderSeg(); renderRecords(); renderAchievements(); renderResumes();
}
let resumeSolo = null, resumeKin = null;
function renderResumes() {
  const box = $("resumes"); box.textContent = "";
  const card = (title, sub, go) => { const b = el("button", "resume"); b.type = "button"; b.append(el("span", "rk", "Resume"), el("b", "", title), el("small", "", sub)); b.onclick = go; box.append(b); };
  const rs = resumeSolo, rk = resumeKin;
  if (rs) card(`Solo · ${LVN[rs.level] || "Normal"}`, `${rs.line.length} moves played · free`, () => { SFX.unlock(); startSoloFrom(rs); });
  if (rk) card(`Against ${kinName()}`, `${(rk.S.moves || []).length} moves played · uses credits`, () => { SFX.unlock(); startKinFrom(rk); });
}
function renderRecords() {
  const box = $("records"); box.textContent = "";
  const t = el("table", "rec"), hd = el("tr"); ["", "Won", "Lost", "Drawn"].forEach((h) => hd.append(el("th", "", h))); t.append(hd);
  for (const v of LV) { const r = soloStats.levels[v] || { w: 0, l: 0, d: 0 }, tr = el("tr"); tr.append(el("td", "", "Computer · " + LVN[v]), el("td", "", r.w), el("td", "", r.l), el("td", "", r.d)); t.append(tr); }
  const r = kinStats ? kinStats[(current && current.id) || "any"] : null;
  if (r) { const tr = el("tr", "kinrow"); tr.append(el("td", "", kinName()), el("td", "", r.lost || 0), el("td", "", r.won || 0), el("td", "", r.draw || 0)); t.append(tr); }
  box.append(t);
  if (soloStats.streak > 1) box.append(el("p", "fine", `Current winning streak: ${soloStats.streak}`));
  if (soloStats.best) box.append(el("p", "fine", `Fastest solo win: ${soloStats.best} moves`));
}

// ---------- achievements (shared with Kin mode; solo ones are kept in solo-stats.json) ----------
const ACH = [
  { id: "first_blood", icon: "⚔", name: "First Blood", about: "Win the first fight of the game." },
  { id: "pawn_revenge", icon: "♟", name: "Pawn's Revenge", about: "Checkmate the enemy king with a pawn move." },
  { id: "two_queens", icon: "♛", name: "Two Queens", about: "Have two queens of your own on the board at once." },
  { id: "giant_slayer", icon: "🗡", name: "Giant Slayer", about: "A pawn wins a fight against a queen." },
  { id: "royal_brawl", icon: "♚", name: "Royal Brawl", about: "Your king wins a fight himself." },
  { id: "fork", icon: "♞", name: "The Fork", about: "A knight checks the king and attacks the queen in one move." },
  { id: "humble_crown", icon: "🐴", name: "Humble Crown", about: "Promote a pawn to a knight instead of a queen." },
  { id: "in_passing", icon: "👣", name: "In Passing", about: "Take a pawn en passant." },
  { id: "rampage", icon: "🔥", name: "Rampage", about: "Win four fights in a row, with no fight lost between." },
  { id: "warlord", icon: "🛡", name: "Warlord", about: "Win ten fights in one game." },
  { id: "swift_mate", icon: "⏳", name: "Swift Victory", about: "Checkmate within your first 20 moves." },
  { id: "smothered", icon: "🏰", name: "Smothered", about: "Checkmate with a knight while the king is boxed in by his own pieces." },
  { id: "comeback", icon: "🌅", name: "Comeback", about: "Win after being down five pawns' worth or more." },
  { id: "crown_jewel", icon: "💎", name: "Crown Jewel", about: "Win without ever losing your queen." },
];
const achKey = () => (current && current.id) || "any";
function renderAchievements() {
  const box = $("achs"); box.textContent = "";
  const book = ACHV[achKey()] || { you: {}, kin: {} }, solo = soloStats.ach || {};
  let got = 0;
  for (const a of ACH) {
    const n = (solo[a.id] ? solo[a.id].n : 0) + (book.you[a.id] ? book.you[a.id].n : 0), k = book.kin[a.id] ? book.kin[a.id].n : 0;
    if (n) got++;
    const c = el("div", "ach" + (n ? " got" : ""));
    c.append(el("span", "ai", a.icon), el("b", "", a.name), el("small", "", a.about));
    c.append(el("span", "an", n ? (n > 1 ? `×${n}` : "✔") : "–"));
    if (k) c.title = `${kinName()} has earned this ×${k}`;
    box.append(c);
  }
  $("achsum").textContent = `${got} of ${ACH.length}`;
}
function award(id, who) {
  if (!G || G.got.includes(who + ":" + id)) return;
  G.got.push(who + ":" + id); G.fresh.push(who + ":" + id);
  const a = ACH.find((x) => x.id === id);
  if (G.kind === "solo") {
    if (who !== "you") return; // the computer doesn't collect achievements
    const book = soloStats.ach || (soloStats.ach = {}), rec = book[id] || (book[id] = { n: 0, first: new Date().toISOString() }); rec.n++;
    write("solo-stats.json", soloStats);
    toast(a.icon, "Achievement" + (rec.n > 1 ? ` ×${rec.n}` : ""), a.name, a.about, true);
    return;
  }
  const book = ACHV[achKey()] || (ACHV[achKey()] = { you: {}, kin: {} });
  const rec = book[who][id] || (book[who][id] = { n: 0, first: new Date().toISOString() }); rec.n++;
  write("achievements.json", ACHV);
  toast(a.icon, (who === "you" ? "You earned" : kinName() + " earned") + (rec.n > 1 ? ` ×${rec.n}` : ""), a.name, a.about, true);
  if (who === "you" && settings.mode !== "quiet") speak(`Your person just earned the "${a.name}" achievement (${a.about.toLowerCase()})`, true);
}
function achNote() {
  const nm = (k) => ACH.find((a) => a.id === k.split(":")[1]).name;
  const mineNew = (G.fresh || []).filter((k) => k.startsWith("kin:")).map(nm), theirs = (G.fresh || []).filter((k) => k.startsWith("you:")).map(nm);
  G.fresh = [];
  return (mineNew.length ? ` You just earned the achievement${mineNew.length > 1 ? "s" : ""} ${mineNew.join(", ")}!` : "") + (theirs.length ? ` They just earned ${theirs.join(", ")}.` : "");
}
const KN = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
function checkAchievements(m, who, st) {
  const S = G.S, t = m.p.toLowerCase(), white = C.isW(m.p), took = m.c || (m.flag === "ep" ? "p" : ""), other = who === "you" ? "kin" : "you";
  if (took) {
    if (!G.anyCapture) award("first_blood", who);
    G.anyCapture = true;
    if (G.streak.who === who) G.streak.n++; else G.streak = { who, n: 1 };
    if (G.streak.n === 4) award("rampage", who);
    if (G.fights[who] === 10) award("warlord", who);
    if (t === "p" && took.toLowerCase() === "q") award("giant_slayer", who);
    if (t === "k") award("royal_brawl", who);
    if (took.toLowerCase() === "q") G.queenLost[other] = true;
  }
  if (m.flag === "ep") award("in_passing", who);
  if (m.promo === "n") award("humble_crown", who);
  if (S.b.filter((x) => x === (white ? "Q" : "q")).length >= 2) award("two_queens", who);
  if (t === "n" && st.check) {
    const f = m.to & 7, r = m.to >> 3, q = white ? "q" : "Q";
    if (KN.some(([df, dr]) => f + df >= 0 && f + df < 8 && r + dr >= 0 && r + dr < 8 && S.b[(r + dr) * 8 + f + df] === q)) award("fork", who);
  }
  if (st.over && st.why === "checkmate") {
    if (t === "p") award("pawn_revenge", who);
    if (Math.ceil(S.moves.length / 2) <= 20) award("swift_mate", who);
    if (t === "n") {
      const k = S.b.indexOf(white ? "k" : "K"), kf = k & 7, kr = k >> 3; let boxed = true;
      for (let df = -1; df <= 1; df++) for (let dr = -1; dr <= 1; dr++) { if (!df && !dr) continue; const ff = kf + df, rr = kr + dr; if (ff < 0 || ff > 7 || rr < 0 || rr > 7) continue; const x = S.b[rr * 8 + ff]; if (!x || C.isW(x) === white) boxed = false; }
      if (boxed) award("smothered", who);
    }
  }
  const bal = S.b.reduce((a, x) => a + (x && x.toLowerCase() !== "k" ? (C.isW(x) === youW() ? 1 : -1) * C.VAL[x.toLowerCase()] : 0), 0);
  G.worst.you = Math.min(G.worst.you, bal); G.worst.kin = Math.min(G.worst.kin, -bal);
}

// ---------- toasts, status, speech ----------
function toast(icon, t1, t2, t3, horn) {
  const box = $("toasts"), t = el("div", "toast");
  t.append(el("span", "ti", icon)); const tx = el("div"); tx.append(el("small", "", t1), el("b", "", t2)); if (t3) tx.append(el("span", "", t3)); t.append(tx);
  box.append(t); if (horn) SFX.horn([392, 523, 659]);
  setTimeout(() => t.classList.add("out"), FAST ? 300 : 3200); setTimeout(() => t.remove(), FAST ? 600 : 3700);
}
function status(text, tone) { $("status").textContent = text; $("statusbox").dataset.tone = tone || ""; }
const live = (t) => { $("live").textContent = ""; setTimeout(() => ($("live").textContent = t), 30); };
let bubbleT = 0;
function say(line, who) {
  const b = $("bubble"); clearTimeout(bubbleT);
  if (!line) { b.hidden = true; return; }
  b.textContent = ""; b.append(el("b", "", who + ": "), document.createTextNode(line)); b.hidden = false; live(`${who} says: ${line}`);
  bubbleT = setTimeout(() => (b.hidden = true), 14000);
}
const cleanLine = (t) => String(t || "").trim().replace(/^```[a-z]*|```$/g, "").replace(/^["“]+|["”]+$/g, "").replace(/\s+/g, " ").slice(0, 240);

// ---------- the board UI ----------
function caps(b) {
  const start = { p: 8, n: 2, b: 2, r: 2, q: 1 }, cnt = { w: {}, b: {} };
  for (const x of b) if (x && x.toLowerCase() !== "k") { const s = C.isW(x) ? "w" : "b", t = x.toLowerCase(); cnt[s][t] = (cnt[s][t] || 0) + 1; }
  const lost = (s) => { const out = []; for (const t of ["q", "r", "b", "n", "p"]) for (let i = 0; i < Math.max(0, start[t] - (cnt[s][t] || 0)); i++) out.push(t); return out; };
  return { w: lost("w"), b: lost("b") }; // pieces each side has lost
}
const portraitCache = {};
function portrait(t, side) { const k = t + side; if (!portraitCache[k]) portraitCache[k] = Rigs.portrait(t, side, 34).toDataURL(); return portraitCache[k]; }
function fillTray(box, list, side, adv) {
  box.textContent = "";
  for (const t of list) { const i = el("img"); i.src = portrait(t, side); i.alt = `${SIDE(side === "w")} ${C.NAMES[t]}`; box.append(i); }
  if (adv > 0) box.append(el("span", "adv", "+" + adv));
}
function hud() {
  if (!G) return;
  const lost = caps(G.S.b), me = G.you, foe = me === "w" ? "b" : "w";
  const val = (l) => l.reduce((a, t) => a + ({ p: 1, n: 3, b: 3, r: 5, q: 9 })[t], 0), diff = val(lost[foe]) - val(lost[me]);
  fillTray($("trayYou"), lost[foe], foe, diff); fillTray($("trayFoe"), lost[me], me, -diff);
  $("foename").textContent = foeLabel();
  $("foetag").textContent = G.kind === "solo" ? `${LVN[G.level]} · ${SIDE(foe === "w")} · free` : `${SIDE(foe === "w")} · ${settings.mode === "quiet" ? "the app plays for them" : "uses credits"}`;
  $("youtag").textContent = `${SIDE(me === "w")} pieces`;
  $("undo").hidden = G.kind !== "solo";
  $("undo").disabled = busy || G.kind !== "solo" || !(G.line || []).some((_, i) => (i % 2 === 0) === (G.you === "w"));
  $("subline").textContent = G.kind === "solo" ? `Solo vs Computer · ${LVN[G.level]} · free, no credits` : `Against ${kinName()} · uses Kindroid credits`;
  // move list
  const ol = $("moves"); ol.textContent = "";
  const mv = G.S.moves || [];
  for (let i = 0; i < mv.length; i += 2) {
    const li = el("li"); li.append(el("span", "w", mv[i])); if (mv[i + 1]) li.append(el("span", "b", mv[i + 1]));
    if (i >= mv.length - 2) li.className = "cur"; ol.append(li);
  }
  ol.scrollTop = ol.scrollHeight; ol.scrollLeft = ol.scrollWidth;
}
function sync() {
  if (!G) return;
  const hl = Scene.state.hl, st = C.status(G.S);
  hl.last = G.S.last || null;
  hl.check = !st.over && C.inCheck(G.S) || (st.over && st.why === "checkmate") ? G.S.b.indexOf(G.S.turn === "w" ? "K" : "k") : -1;
  hl.sel = sel;
  hl.targets = sel >= 0 ? C.legal(G.S).filter((m) => m.from === sel).filter((m, i, a) => a.findIndex((x) => x.to === m.to) === i).map((m) => ({ sq: m.to, cap: !!m.c || m.flag === "ep" })) : [];
  Scene.select(sel);
  hud();
}
function setTurnStatus() {
  if (over || !G) return;
  const st = C.status(G.S);
  if (G.S.turn === G.you) status(st.check ? "Check! Protect your king" : "Your move", st.check ? "warn" : "you");
  else status(G.kind === "solo" ? "The computer is thinking…" : `${kinName()} is thinking…`, "foe");
}

// ---------- input ----------
function tap(sq) {
  if (!G || busy || over || G.S.turn !== G.you || promoWait || sq < 0) return;
  const p = G.S.b[sq];
  if (sel >= 0) {
    const ms = C.legal(G.S).filter((m) => m.from === sel && m.to === sq);
    if (ms.length) {
      const from = sel; sel = -1; sync();
      if (ms.length > 1) return askPromo(ms);
      return doMove(ms[0], "", false, from);
    }
  }
  if (p && mine(p)) {
    if (sel === sq) { sel = -1; sync(); return; }
    const has = C.legal(G.S).some((m) => m.from === sq);
    sel = has ? sq : -1; sync();
    if (has) { SFX.select(); live(`${SIDE(C.isW(p))} ${C.NAMES[p.toLowerCase()]} on ${C.sqName(sq)} picked. ${Scene.state.hl.targets.length} squares it can go to.`); }
    else { SFX.deny(); live(`That ${C.NAMES[p.toLowerCase()]} has no moves.`); }
    return;
  }
  if (sel >= 0) { SFX.deny(); sel = -1; sync(); }
}
function askPromo(ms) {
  promoWait = ms; const box = $("promopick"); box.textContent = "";
  for (const t of ["q", "r", "b", "n"]) {
    const m = ms.find((x) => x.promo === t); if (!m) continue;
    const b = el("button", "pk"); b.type = "button"; const i = el("img"); i.src = Rigs.portrait(t, G.you, 72).toDataURL(); i.alt = "";
    b.append(i, el("span", "", C.NAMES[t])); b.onclick = () => { $("promo").hidden = true; promoWait = null; doMove(m, "", false); };
    box.append(b);
  }
  $("promo").hidden = false; box.firstChild.focus();
}
function pointer(e) { const r = stage.getBoundingClientRect(); return Scene.pick(e.clientX - r.left, e.clientY - r.top); }
stage.addEventListener("pointerdown", (e) => {
  SFX.unlock();
  if (Scene.playing) { Scene.skip(); return; }
  if (view !== "game") return;
  const sq = pointer(e); Scene.state.hl.cursor = -1; tap(sq);
});
stage.addEventListener("pointermove", (e) => { if (view === "game" && e.pointerType === "mouse") { const sq = pointer(e); Scene.state.hl.hover = sq; stage.style.cursor = G && !busy && sq >= 0 && (mine(G.S.b[sq]) || Scene.state.hl.targets.some((t) => t.sq === sq)) ? "pointer" : "default"; } });
stage.addEventListener("pointerleave", () => (Scene.state.hl.hover = -1));
function moveCursor(df, dr) {
  const hl = Scene.state.hl; let c = hl.cursor >= 0 ? hl.cursor : sel >= 0 ? sel : G && G.you === "w" ? 12 : 52;
  if (flipped) { df = -df; dr = -dr; }
  const f = Math.max(0, Math.min(7, (c & 7) + df)), r = Math.max(0, Math.min(7, (c >> 3) + dr)); c = r * 8 + f; hl.cursor = c;
  const p = G.S.b[c]; live(`${C.sqName(c)}${p ? ", " + SIDE(C.isW(p)) + " " + C.NAMES[p.toLowerCase()] : ", empty"}${hl.targets.some((t) => t.sq === c) ? ", a legal move" : ""}`);
}
addEventListener("keydown", (e) => {
  if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
  if (e.key === "Escape") {
    if (Scene.playing) { Scene.skip(); e.preventDefault(); return; }
    if (!$("confirm").hidden) { $("confirm").hidden = true; return; }
    if (sel >= 0) { sel = -1; sync(); return; }
  }
  if (e.key === "m" || e.key === "M") { toggleMute(); return; }
  if (view !== "game" || !G || !$("promo").hidden || !$("result").hidden || !$("confirm").hidden) return;
  if (e.key === "u" || e.key === "U") { undo(); return; }
  if (e.key === "f" || e.key === "F") { doFlip(); return; }
  if (document.activeElement !== stage) return;
  const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
  if (d) { e.preventDefault(); moveCursor(d[0], d[1]); return; }
  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (Scene.state.hl.cursor < 0) moveCursor(0, 0); else tap(Scene.state.hl.cursor); }
});

// ---------- moves ----------
// Plays a move with its walk/fight, updates the game, then hands the turn over.
async function doMove(m, line, byFoe, fromSq) {
  const myGen = gen; busy = true; sel = -1; sync();
  if (line && byFoe) say(line, kinName());
  const att = m.p.toLowerCase(), took = m.c || (m.flag === "ep" ? (C.isW(m.p) ? "p" : "P") : "");
  const who = byFoe ? (G.kind === "solo" ? "kin" : "kin") : "you";
  if (took) G.fights[who]++;
  const fight = !!took && settings.anim !== "off";
  $("skip").hidden = !fight; document.body.classList.toggle("fighting", fight);
  await Scene.play(m);
  $("skip").hidden = true; document.body.classList.remove("fighting");
  if (myGen !== gen || !G) return;
  const all = C.legal(G.S), san = C.san(G.S, m, all);
  G.S = C.play(G.S, m); G.S.you = G.you;
  if (G.line) G.line.push({ from: m.from, to: m.to, promo: m.promo || "" });
  if (took) G.lastFight = `Last capture: ${byFoe ? "you" : "they"} won a fight; ${byFoe ? "your" : "their"} ${C.NAMES[att]} beat ${byFoe ? "their" : "your"} ${C.NAMES[took.toLowerCase()]}.`;
  Scene.settle(G.S.b);
  const st = C.status(G.S);
  live(`${byFoe ? foeLabel() : "You"}: ${C.words(m, san)}${st.over ? "" : st.check ? ". Check!" : ""}`);
  checkAchievements(m, who, st);
  save(); busy = false; sync();
  if (st.over) return finish(st);
  if (st.check) SFX.check();
  setTurnStatus();
  if (!byFoe) {
    if (G.kind === "kin" && settings.mode === "talk" && (took || st.check)) speak(`Your person just played ${san}${took ? `; their ${C.NAMES[att]} beat your ${C.NAMES[took.toLowerCase()]} in the fight` : ""}.`);
    setTimeout(foeTurn, FAST ? 10 : 250);
  } else if (line && !took) say(line, kinName());
}
function foeTurn() { if (!G || over || G.S.turn === G.you) return; return G.kind === "solo" ? computerTurn() : kinTurn(); }
async function computerTurn() {
  const myGen = gen, S = G.S; busy = true; setTurnStatus(); hud();
  const t0 = performance.now();
  const m = await AI.think(S, G.level, { speed: FAST ? 0.05 : 1 });
  const left = (FAST ? 0 : 450) - (performance.now() - t0); if (left > 0) await wait(left);
  if (myGen !== gen || !G || G.S !== S || over || !m) { busy = false; return; }
  await doMove(m, "", true);
}

// ---------- Kin mode: your Kin's turn (asks the Kin; uses credits) ----------
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
function pool(r) {
  if (settings.level === "hard") return r.slice(0, 3);
  if (settings.level === "normal") return r.slice(0, 6);
  if (settings.level === "easy") return shuffle(r.slice(0, Math.max(8, Math.ceil(r.length / 2)))).slice(0, 8);
  return shuffle(r.slice()).slice(0, 8);
}
function appPick(p) {
  if (settings.level === "hard" || p.length === 1) return p[0];
  if (settings.level === "normal") { const r = Math.random(); return p[r < 0.55 ? 0 : r < 0.8 ? 1 : Math.min(2, p.length - 1)]; }
  return p[Math.floor(Math.random() * p.length)];
}
async function kinTurn() {
  const myGen = gen; if (over || !G || G.S.turn === G.you) return;
  busy = true; setTurnStatus(); hud();
  const S = G.S, ranked = await AI.ranked(S, settings.level === "beginner" ? 1 : settings.level === "easy" ? 2 : 3);
  if (myGen !== gen || !ranked.length) { busy = false; return; }
  let pick = ranked[0], line = "";
  if (ranked.length > 1) {
    const p = pool(ranked); pick = appPick(p);
    if (settings.mode === "kin" && current) {
      const opts = shuffle(p.slice());
      const mat = S.b.reduce((t, x) => t + (x ? (C.isW(x) === !youW() ? 1 : -1) * C.VAL[x.toLowerCase()] : 0), 0), last = S.moves[S.moves.length - 1];
      const q = `We're playing Chess Clash: chess in a torch-lit castle hall where the pieces are armored fighters, and every capture is a short duel shown on screen. You play the ${youW() ? "dark" : "light"} pieces; your person plays the ${youW() ? "light" : "dark"}. Moves so far: ${S.moves.slice(-24).join(" ") || "none, you move first"}. ${last ? "Their last move: " + last + "." : ""} ${G.lastFight || ""} Fights won: you ${G.fights.kin}, them ${G.fights.you}.${achNote()} Material: ${mat === 0 ? "even" : mat > 0 ? "you're ahead by about " + Math.round(mat / 100) + " pawns" : "you're behind by about " + Math.round(-mat / 100) + " pawns"}.${C.inCheck(S) ? " You are in check." : ""}\nYour options:\n${opts.map((o, i) => `${i + 1}) ${o.label}`).join("\n")}\nPick one. Reply only with JSON, no other text: {"pick": number, "say": "one short line to your person, in your own voice"}`;
      const t = await ask(q);
      if (myGen !== gen) return;
      if (G && S === G.S) {
        let n = NaN;
        if (t) { const mm = t.match(/\{[\s\S]*\}/); if (mm) { try { const j = JSON.parse(mm[0]); n = Number(j.pick); line = cleanLine(j.say); } catch {} } if (!(n >= 1)) { const d = t.match(/\b(\d{1,2})\b/); if (d) n = Number(d[1]); } }
        if (n >= 1 && n <= opts.length) pick = opts[n - 1];
        else toast("⌛", `${kinName()} didn't answer in time`, "The app moved for them", "", false);
      }
    }
  }
  if (!G || S !== G.S || over || myGen !== gen) { busy = false; return; }
  await doMove(pick.m, line, true);
  if (settings.mode === "talk" && pick.m.c) speak(`You just played ${pick.san}, and your ${C.NAMES[pick.m.p.toLowerCase()]} beat their ${C.NAMES[pick.m.c.toLowerCase()]} in the fight.`);
}
async function speak(context, matters) {
  if (!G || G.kind !== "kin" || settings.mode === "quiet" || !current || talking) return;
  if (!matters && Date.now() - lastLine < 20000) return;
  talking = true; lastLine = Date.now();
  const t = await ask(`We're playing Chess Clash, chess where the pieces are armored fighters and every capture is a short duel. ${context} Say one short line to your person about it, in your own voice. Reply with just the line.`);
  talking = false;
  if (t && view === "game") say(cleanLine(t), kinName());
}

// ---------- saving ----------
function save() {
  if (!G) return;
  if (G.kind === "solo") write("solo-game.json", over ? null : { v: 2, level: G.level, you: G.you, line: G.line, fights: G.fights, got: G.got, streak: G.streak, worst: G.worst, queenLost: G.queenLost, anyCapture: G.anyCapture });
  else write("game.json", over ? null : { v: 1, you: G.you, S: G.S, line: G.line, fights: G.fights, lastFight: G.lastFight, got: G.got, streak: G.streak, worst: G.worst, queenLost: G.queenLost, anyCapture: G.anyCapture, fresh: G.fresh });
}
function replay(line) {
  let S = Object.assign(C.fromFen(C.START), {});
  for (const x of line) { const m = C.legal(S).find((y) => y.from === x.from && y.to === x.to && (y.promo || "") === (x.promo || "")); if (!m) break; S = C.play(S, m); }
  return S;
}

// ---------- starting games ----------
function blankG(kind, you) { return { kind, you, line: [], fights: { you: 0, kin: 0 }, lastFight: "", got: [], streak: { who: "", n: 0 }, worst: { you: 0, kin: 0 }, queenLost: { you: false, kin: false }, anyCapture: false, fresh: [] }; }
function enter() {
  gen++; over = false; sel = -1; busy = false; promoWait = null;
  $("result").hidden = true; $("promo").hidden = true; say("");
  flipped = G.you === "b"; Scene.setFlip(flipped);
  show("game"); Scene.settle(G.S.b); sync(); setTurnStatus();
  setTimeout(() => stage.focus({ preventScroll: true }), 50);
}
function startSolo() {
  const you = settings.color === "random" ? (Math.random() < 0.5 ? "w" : "b") : settings.color;
  G = Object.assign(blankG("solo", you), { level: settings.solo, S: Object.assign(C.fromFen(C.START), { you }) });
  resumeSolo = null; enter(); save(); SFX.start();
  toast("⚔", "Solo · " + LVN[G.level], `You lead the ${SIDE(you === "w")} army`, "Free · no credits", false);
  if (G.S.turn !== G.you) setTimeout(foeTurn, FAST ? 10 : 900);
}
function startSoloFrom(g) {
  G = Object.assign(blankG("solo", g.you === "b" ? "b" : "w"), g, { kind: "solo", level: LV.includes(g.level) ? g.level : "normal", line: (g.line || []).slice() });
  G.S = replay(G.line); G.S.you = G.you; G.line = G.line.slice(0, G.S.moves.length);
  resumeSolo = null; enter();
  if (G.S.turn !== G.you) setTimeout(foeTurn, 600);
}
async function startKin() {
  const s = (await read("starts.json")) || {}, who = s.last === "you" ? "kin" : "you";
  write("starts.json", { last: who });
  const you = who === "you" ? "w" : "b";
  G = Object.assign(blankG("kin", you), { S: Object.assign(C.fromFen(C.START), { you }) });
  resumeKin = null; enter(); save(); SFX.start();
  if (G.S.turn !== G.you) setTimeout(foeTurn, FAST ? 10 : 900);
  else toast("⚔", `Against ${kinName()}`, "You have the Light pieces", "Your Kin answers each move (uses credits)", false);
}
function startKinFrom(g) {
  G = Object.assign(blankG("kin", g.you === "b" ? "b" : "w"), g, { kind: "kin" });
  if (!G.line) G.line = null; // older saves have no move line
  resumeKin = null; enter();
  if (G.S.turn !== G.you) setTimeout(foeTurn, 600);
}

// ---------- undo (solo), flip, resign ----------
function undo() {
  if (!G || G.kind !== "solo" || busy || Scene.playing || !G.line.length) return;
  // Take back to the last position where it was your turn, with at least one of your moves undone.
  let line = G.line.slice(); const mineIdx = (i) => (i % 2 === 0) === (G.you === "w");
  while (line.length && !mineIdx(line.length - 1)) line.pop();
  if (!line.length) return;
  line.pop();
  gen++; over = false; $("result").hidden = true;
  G.line = line; G.S = replay(line); G.S.you = G.you; sel = -1;
  Scene.settle(G.S.b); sync(); setTurnStatus(); save(); SFX.whoosh && SFX.whoosh();
  live("Move taken back. Your move.");
}
function doFlip() { flipped = !flipped; Scene.setFlip(flipped); SFX.select(); }
function resign() {
  if (!G || over) return;
  $("ctitle").textContent = "Resign this game?";
  $("ctext").textContent = G.kind === "solo" ? "It counts as a loss against the computer." : `${kinName()} takes the win, and the game is saved with one short run.`;
  $("confirm").hidden = false; $("cno").focus();
}
$("cyes").onclick = () => { $("confirm").hidden = true; if (!G || over) return; gen++; busy = false; finish({ over: true, result: G.you === "w" ? "b" : "w", why: "resignation" }); };
$("cno").onclick = () => ($("confirm").hidden = true);

// ---------- the end ----------
async function finish(st) {
  over = true; busy = false; sync();
  const result = st.result === "draw" ? "draw" : st.result === G.you ? "you" : "kin";
  if (result !== "draw" && st.why !== "resignation") {
    if ((G.worst[result] || 0) <= -500) award("comeback", result);
    if (!G.queenLost[result]) award("crown_jewel", result);
  }
  const nMoves = Math.max(1, Math.ceil(G.S.moves.length / 2));
  if (result === "draw") SFX.draw(); else SFX.mate(result === "you");
  const fin = G;
  document.body.classList.add("fighting");
  const tp = st.why === "checkmate" || st.why === "resignation" ? Scene.topple(G.S.b.indexOf(st.result === "w" ? "k" : "K"), `${st.why === "checkmate" ? "Checkmate" : "Resigned"}: the ${SIDE(st.result !== "w")} King falls`) : null;
  const why = { checkmate: "Checkmate", stalemate: "Stalemate", resignation: "Resignation" }[st.why] || "Draw";
  $("rkicker").textContent = st.why === "checkmate" ? "Checkmate" : st.why === "resignation" ? "Resigned" : "Draw · " + st.why;
  $("rtitle").textContent = result === "you" ? "Victory!" : result === "kin" ? (G.kind === "solo" ? "Defeat" : `${kinName()} wins`) : "A draw";
  $("rline").textContent = result === "you" ? `${why} in ${nMoves} moves. The ${SIDE(G.you !== "w")} king yields.` : result === "kin" ? `${why} after ${nMoves} moves.` : `Drawn by ${st.why} after ${nMoves} moves.`;
  const rs = $("rstats"); rs.textContent = "";
  const stat = (n, l) => { const d = el("div"); d.append(el("b", "", n), el("small", "", l)); rs.append(d); };
  stat(nMoves, "moves"); stat(G.fights.you, "fights you won"); stat(G.fights.kin, `fights ${G.kind === "solo" ? "the computer" : kinName()} won`);
  status(result === "you" ? "You won!" : result === "kin" ? (G.kind === "solo" ? "The computer won" : `${kinName()} won`) : "Draw", result === "you" ? "you" : "foe");
  save();
  if (G.kind === "solo") {
    const r = soloStats.levels[G.level] || (soloStats.levels[G.level] = { w: 0, l: 0, d: 0 });
    if (result === "you") { r.w++; soloStats.streak = (soloStats.streak || 0) + 1; if (!soloStats.best || nMoves < soloStats.best) soloStats.best = nMoves; } else if (result === "kin") { r.l++; soloStats.streak = 0; } else r.d++;
    write("solo-stats.json", soloStats);
    stat(`${r.w}–${r.l}–${r.d}`, `record vs ${LVN[G.level]}`);
  } else {
    const detail = `${st.why} after ${nMoves} move${nMoves === 1 ? "" : "s"}; fights won: you ${G.fights.you}, ${kinName()} ${G.fights.kin}`;
    const earned = (G.got || []).map((k) => { const [who, id] = k.split(":"); return { who, id }; }).slice(0, 30);
    send({ kin: "action", name: "clash_record", input: { result, detail: detail.slice(0, 300), fights_you: G.fights.you, fights_kin: G.fights.kin, achievements: earned, ...(current ? { kin_id: current.id } : {}) } }, 60000).then(async () => { kinStats = await read("stats.json"); });
    if (settings.mode !== "quiet" && current) speak(`We just finished a game: ${result === "you" ? "your person won" : result === "kin" ? "you won" : "it was a draw"} (${detail}). Say one or two short lines about the game.`, true);
  }
  if (tp) await tp;
  document.body.classList.remove("fighting");
  await wait(settings.anim === "off" ? 400 : 500);
  if (over && view === "game" && G === fin) { $("result").hidden = false; $("again").focus(); }
}

// ---------- wiring ----------
function toggleMute() { settings.sound.on = !settings.sound.on; if (settings.sound.on && !settings.sound.vol) settings.sound.vol = 0.6; applySound(); saveSettings(); }
$("mute").onclick = () => { SFX.unlock(); toggleMute(); };
$("vol").oninput = () => { SFX.unlock(); settings.sound.vol = $("vol").value / 100; settings.sound.on = settings.sound.vol > 0; applySound(); };
$("vol").onchange = () => { saveSettings(); SFX.select(); };
$("playsolo").onclick = () => { SFX.unlock(); startSolo(); };
$("playkin").onclick = () => { SFX.unlock(); startKin(); };
$("level").onchange = () => { settings.level = $("level").value; saveSettings(); };
$("animsel").onchange = () => { settings.anim = $("animsel").value; applyAnim(); saveSettings(); };
$("undo").onclick = undo; $("flip").onclick = doFlip; $("resign").onclick = resign;
const toMenu = () => { gen++; if (G && !over) { if (G.kind === "solo") resumeSolo = { level: G.level, you: G.you, line: G.line.slice(), fights: G.fights, got: G.got, streak: G.streak, worst: G.worst, queenLost: G.queenLost, anyCapture: G.anyCapture }; else resumeKin = { v: 1, you: G.you, S: G.S, line: G.line, fights: G.fights, lastFight: G.lastFight, got: G.got, streak: G.streak, worst: G.worst, queenLost: G.queenLost, anyCapture: G.anyCapture, fresh: G.fresh }; } G = null; busy = false; $("result").hidden = true; say(""); show("menu"); renderMenu(); };
$("tomenu").onclick = toMenu; $("tomenu2").onclick = toMenu; $("home").onclick = () => { if (view === "game") toMenu(); };
$("again").onclick = () => { const k = G && G.kind; $("result").hidden = true; if (k === "kin") startKin(); else { if (G) settings.solo = G.level; startSolo(); } };
$("skip").onclick = () => Scene.skip();
// Keep focus inside dialogs.
for (const id of ["promo", "result", "confirm"]) $(id).addEventListener("keydown", (e) => { if (e.key !== "Tab") return; const f = [...$(id).querySelectorAll("button")]; if (!f.length) return; const i = f.indexOf(document.activeElement); if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); } });

// For the test host: a look at the game without changing it.
window.clashState = () => ({ G, busy, over, view, sel, playing: Scene.playing, flipped });
window.clashScreenOf = (sq) => { const p = Scene.squareScreen(sq), r = stage.getBoundingClientRect(); return { x: p.x + r.left, y: p.y + r.top }; };

(async function init() {
  parent.postMessage({ kin: "kins" }, "*");
  const [s, g, sg, ss, ach, ks] = await Promise.all([read("settings.json"), read("game.json"), read("solo-game.json"), read("solo-stats.json"), read("achievements.json"), read("stats.json")]);
  loadSettings(s); applySound(); applyAnim();
  if (ss && ss.levels) soloStats = Object.assign({ v: 1, levels: {}, streak: 0, best: 0 }, ss);
  ACHV = ach || {}; kinStats = ks || null;
  if (sg && Array.isArray(sg.line)) resumeSolo = sg;
  if (g && g.v && g.S && g.S.b) resumeKin = g;
  show("menu"); renderMenu();
  document.body.classList.add("ready");
})();
})();
