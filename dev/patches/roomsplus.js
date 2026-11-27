// Makes the Kindroid app "kin-roomsPlus" chat the way a Kin Relay room should: a flowing group conversation.
// Applied to a pristine copy (pulled with `kin code get`) to make games/kin-roomsplus. Every change is behind `KR`,
// which is true only when the app runs inside Kin Relay (KGR_SLUG is set), so the same code still works on Kindroid.
//   node dev/patches/roomsplus.js <pristine dir> <out dir>
"use strict";
const fs = require("fs"), path = require("path");
const [src, out] = process.argv.slice(2);
let main = fs.readFileSync(path.join(src, "main.js"), "utf8");
let html = fs.readFileSync(path.join(src, "screen/index.html"), "utf8");
function rep(s, a, b, what) { const n = s.split(a).length - 1; if (n !== 1) throw new Error(`patch "${what}": expected 1 match, found ${n}`); return s.replace(a, () => b); }
const M = (a, b, w) => (main = rep(main, a, b, w)), H = (a, b, w) => (html = rep(html, a, b, w));

// ---- constants, defaults ----
M(`const field = (s) => clean(s, FIELD_MAX);`,
`const field = (s) => clean(s, FIELD_MAX);
// ----- Kin Relay: the room runs on this PC; Kin replies are normal Kin messages through the owner's own API key -----
const KR = !!process.env.KGR_SLUG;
const PLAYER = KR ? clean(process.env.KGR_PLAYER || "", NAME_MAX) : "";
const firstWord = (n) => String(n || "").trim().split(/\\s+/)[0] || "";
const escRe = (n) => String(n).replace(/[.*+?^\${}()|[\\]\\\\]/g, "\\\\$&");
const mentions = (name, text) => {
  const full = new RegExp("(^|[^\\\\w])@?" + escRe(name) + "(?![\\\\w])", "i");
  const fw = firstWord(name), first = fw.length >= 3 ? new RegExp("(^|[^\\\\w])@?" + escRe(fw) + "(?![\\\\w])", "i") : null;
  return full.test(text) || !!(first && first.test(text));
};
const KR_CHAIN = process.env.KGR_ROOM_CHAIN !== undefined && process.env.KGR_ROOM_CHAIN !== "" && Number(process.env.KGR_ROOM_CHAIN) >= 0 ? Number(process.env.KGR_ROOM_CHAIN) : 0.55; // chance a Kin's line draws another Kin's reply
const pickRand = (seed, p) => { let h = 0; for (const ch of String(seed)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return (h % 1000) / 1000 < p; };`, "KR constants");
M(`const DEF_CFG = () => ({ mode: "off", myId: rid(8), name: "",`, `const DEF_CFG = () => ({ mode: "off", myId: rid(8), name: PLAYER,`, "default name");
M(`  .map((k) => ({ id: k.id, name: k.name, auto: (cfg.kins[k.id] || {}).auto === true }));`,
`  .map((k) => ({ id: k.id, name: k.name, auto: autoOn(k.id) }));`, "myKins auto");
M(`const enabledKins = `, `// In Kin Relay a Kin joins the conversation by default (its owner can switch that off per Kin); on Kindroid it starts off.
const autoOn = (id) => { const a = (cfg.kins[id] || {}).auto; return KR ? a !== false : a === true; };
const enabledKins = `, "autoOn");
M(`auto: (cfg.kins[k.id] || {}).auto === true })),
    activeKins`, `auto: autoOn(k.id) })),
    activeKins`, "view auto");
M(`const mayPost = autoPost && (cfg.kins[kinId] || {}).auto === true;`, `const mayPost = autoPost && autoOn(kinId);`, "mayPost");
M(`const AUTO_GAP = 15000;
const AUTO_CAPS = [10, 20, 40, 80];
const autoCap = () => (AUTO_CAPS.includes(+cfg.autoCap) ? +cfg.autoCap : 20);`,
`const AUTO_GAP = KR ? 4000 : 15000;
const AUTO_CAPS = KR ? [30, 60, 120, 240] : [10, 20, 40, 80];
const autoCap = () => (AUTO_CAPS.includes(+cfg.autoCap) ? +cfg.autoCap : KR ? 60 : 20);`, "auto caps");
M(`  if (cfg.autoReplyConsentVersion !== 2) {`, `  if (cfg.autoReplyConsentVersion !== 2 && !KR) {`, "consent cfg");
M(`  if (room.autoReplyConsentVersion !== 2) {`, `  if (room.autoReplyConsentVersion !== 2 && !KR) {`, "consent room");
M(`let hostSeen = 0, viewKey = "", busy = false;`, `let hostSeen = 0, viewKey = "", busy = false;
let lastErr = "";            // why the last Kin request failed (shown to the person, never silent)
const TYPING_MS = 100000;    // a Kin "is typing" for at most this long
const typingMap = () => (cfg.typing = cfg.typing && typeof cfg.typing === "object" ? cfg.typing : {});
const setTyping = (id, who, on) => { const t = typingMap(); if (on) t[id] = { who, until: now() + TYPING_MS }; else delete t[id]; };
const typingNow = () => Object.entries(typingMap()).filter(([, v]) => v && v.until > now()).map(([id, v]) => ({ id, who: clean(v.who, NAME_MAX) }));`, "typing state");

// ---- say clearly why a Kin could not answer ----
M("  if (!r.ok) { note = `${k.name} could not answer right now.`; return null; }",
  "  if (!r.ok) { lastErr = String(r.err || \"\").trim().split(\"\\n\")[0].replace(/^kin: /, \"\").slice(0, 200); note = `${k.name} could not answer${KR && lastErr ? \": \" + lastErr : \" right now.\"}`; return null; }\n  lastErr = \"\";", "speakAs error");

// ---- voice and selfies: say plainly when this device can't make them ----
const why = `(KR && r.err ? " " + String(r.err).trim().split("\\n")[0].replace(/^kin: /, "").slice(0, 200) : "")`;
M(`note = "Voice could not be made right now."; return; }`, `note = "Voice could not be made right now." + ${why}; return; }`, "voice err");
M(`note = "The selfie could not be started. Check your selfie credits and try again."; return; }`,
  `note = "The selfie could not be started." + (KR ? (result.err ? " " + String(result.err).trim().split("\\n")[0].replace(/^kin: /, "").slice(0, 200) : "") : " Check your selfie credits and try again."); return; }`, "selfie err");

// ---- typing around a Kin's own reply, and reporting a failure to the room ----
M(`  const text = await speakAs(k, extra);
  if (mayPost) cfg.autoTimes.push(now()); // the request was made, even if the Kin had nothing to add`,
`  if (KR) { setTyping(k.id, k.name, true); await saveCfg(); await writeView(); announceTyping(k, true); await flush(true); }
  lastErr = "";
  let text; try { text = await speakAs(k, extra); } finally { if (KR) { setTyping(k.id, k.name, false); announceTyping(k, false); } }
  if (KR && !text && lastErr) await tellRoomFailed(k, lastErr);
  if (mayPost) cfg.autoTimes.push(now()); // the request was made, even if the Kin had nothing to add`, "kinTurn typing");
M(`// Free mode: the host picks ONE Kin per burst`, `// Kin Relay: show everyone "X is typing…" while a Kin's copy is asking its owner's Kin, and say so when that fails.
function announceTyping(k, on) {
  if (cfg.mode === "member" && cfg.joined) enqueue(cfg.hostAddr, { t: "typing", kinId: k.id, who: k.name, on });
  else if (cfg.mode === "host") { for (const [id, m] of inMembers()) enqueue(m.addr, { t: "typing", kinId: k.id, who: k.name, on, until: now() + TYPING_MS }); }
}
async function tellRoomFailed(k, why) {
  const line = \`\${k.name} couldn't answer: \${why}\`;
  const last = cfg.lastFail || (cfg.lastFail = {});
  if (now() - (last[k.id] || 0) < 60000) return; last[k.id] = now();
  if (cfg.mode === "host") await systemNote(line);
  else if (cfg.mode === "member" && cfg.joined) enqueue(cfg.hostAddr, { t: "kinerr", kinId: k.id, text: clean(why, 200) });
}
// Free mode: the host picks ONE Kin per burst`, "announce helpers");

// ---- the host: who answers whom ----
M(`  if (m.kind === "person") {
    humanThisRun = true;
    if (!room.paused && room.turnMode !== "pick") {`,
`  if (KR) { room.chain = m.kind === "person" ? 0 : m.kind === "kin" ? (room.chain || 0) + 1 : room.chain || 0; if (m.kind === "kin") { (room.kinLast = room.kinLast || {})[m.kinId] = now(); setTyping(m.kinId, "", false); } }
  if (KR && m.kind === "kin" && (room.chain || 0) < 3 && !room.paused && room.turnMode === "free") {
    // A Kin's line can start another Kin's reply (a conversation), up to 3 Kin lines in a row.
    const ids = room.replyDue && Array.isArray(room.replyDue.ids) ? room.replyDue.ids : [];
    room.replyDue = { ids: ids.concat(entry.id).slice(-10) };
  }
  if (m.kind === "person") {
    humanThisRun = true;
    if (!room.paused && room.turnMode !== "pick") {`, "hostPost chain");
M(`async function freeReplies(entries) {
  if (cfg.mode !== "host" || room.turnMode !== "free" || room.paused) return;`,
`async function krReplies(entries) {
  const last = entries[entries.length - 1];
  if (last.kind === "kin" && (room.chain || 0) + typingNow().length >= 3) return; // 3 Kin lines in a row, counting the ones already on their way
  const cand = roomKins().filter((k) => k.auto === true && k.id !== last.kinId && now() - ((room.kinLast || {})[k.id] || 0) > 5000);
  if (!cand.length) return;
  const asked = [];
  for (const e of entries) for (const k of cand) if (e.kinId !== k.id && mentions(k.name, e.text) && !asked.includes(k)) asked.push(k);
  let picks = [];
  if (asked.length) picks = asked.slice(0, 2); // the Kins spoken to answer first (one or two)
  else {
    const i0 = (room.freeIdx || 0) % cand.length;
    const rot = cand.map((_, j) => cand[(i0 + j) % cand.length]);
    if (last.kind === "person") {
      const toAll = /\\b(everyone|everybody|y'all|you all|guys|you two|both of you|anyone)\\b|\\?\\s*$/i.test(last.text);
      picks = rot.slice(0, toAll && rot.length > 1 && pickRand(last.id, 0.6) ? 2 : 1);
    } else if (pickRand(last.id, KR_CHAIN)) picks = rot.slice(0, 1); // a Kin's line sometimes draws a reply from another Kin
    if (picks.length) room.freeIdx = (i0 + picks.length) % cand.length;
  }
  for (const k of picks) {
    if (k.owner !== cfg.myId) { setTyping(k.id, k.name, true); for (const [, m] of inMembers()) enqueue(m.addr, { t: "typing", kinId: k.id, who: k.name, on: true, until: now() + TYPING_MS }); }
    await giveTurn(k, true);
    if (k.owner !== cfg.myId) await flush(true);
  }
  await saveRoom();
}
async function freeReplies(entries) {
  if (cfg.mode !== "host" || room.turnMode !== "free" || room.paused) return;
  if (KR) return krReplies(entries);`, "krReplies");
M(`  // Only a person's message starts a reply; a Kin's message never does, so Kins cannot chain.
`, `  // On Kindroid only a person's message starts a reply, so Kins cannot chain.
`, "comment");
M(`  if (now() - (room.lastAutoAt || 0) < AUTO_GAP) { await saveRoom(); return; } // kept for the wake nextWake asks for`,
  `  if (now() - (room.lastAutoAt || 0) < AUTO_GAP) { await saveRoom(); return; } // kept for the wake nextWake asks for
  if (KR) await writeView(); // show "is typing…" before the Kin's request starts`, "view before");

// ---- receiving: typing events and Kin failures ----
M(`    else if (ev.t === "leave") { m.status = "left";`, `    else if (KR && ev.t === "typing") { const k = (m.kins || []).find((x) => x.id === clean(ev.kinId, 80)); if (k) { setTyping(k.id, k.name, ev.on === true); for (const [id, mm] of inMembers()) if (id !== from) enqueue(mm.addr, { t: "typing", kinId: k.id, who: k.name, on: ev.on === true, until: now() + TYPING_MS }); } }
    else if (KR && ev.t === "kinerr") { const k = (m.kins || []).find((x) => x.id === clean(ev.kinId, 80)); if (k) { setTyping(k.id, k.name, false); await systemNote(\`\${k.name} couldn't answer: \${clean(ev.text, 200)}\`); } }
    else if (ev.t === "leave") { m.status = "left";`, "host typing");
M(`    else if (ev.t === "rewind") {`, `    else if (KR && ev.t === "typing") { setTyping(clean(ev.kinId, 80), clean(ev.who, NAME_MAX), ev.on === true); }
    else if (ev.t === "rewind") {`, "member typing");
M(`      log.push(m); await saveLog();
      if (m.kind === "person") humanThisRun = true;`, `      log.push(m); await saveLog();
      if (KR && m.kind === "kin" && m.kinId) setTyping(m.kinId, "", false);
      if (m.kind === "person") humanThisRun = true;`, "member msg clears typing");

// ---- the view ----
M(`    auto: { used: autoUsed(), cap: autoCap() },
  };`, `    auto: { used: autoUsed(), cap: autoCap() },
    kr: KR, typing: KR ? typingNow().filter((t) => t.who) : [],
  };`, "view fields");
M(`me: { id: cfg.myId, name: cfg.name },`, `me: { id: cfg.myId, name: cfg.name || PLAYER },`, "view name");
// a self-wake while a Kin is typing: look again soon so a stuck "typing" clears
M(`  const jobs = Array.isArray(cfg.selfieJobs) ? cfg.selfieJobs : [];
  if (jobs.some(`, `  if (KR && typingNow().length) times.push(now() + 3000);
  const jobs = Array.isArray(cfg.selfieJobs) ? cfg.selfieJobs : [];
  if (jobs.some(`, "wake while typing");

// ---- screen ----
H(`Auto replies start off. Turning them on for a Kin lets it reply and post to everyone in the room without asking you to approve each message. You can turn this off anytime.`, `Your Kins join the conversation: they answer when they are spoken to, and now and then chime in on their own. Turn Auto replies off for a Kin to keep it quiet (you can still ask it for a private draft).`, "intro text");
H(`Auto replies are controlled by each Kin’s owner. When enabled, that Kin’s automatic replies are posted to everyone in the room without individual approval. “Draft reply” stays private for review. Requesting a selfie uses your selfie credits and shares the image with the room.`, `Each Kin is controlled by its owner. With Auto replies on, a Kin answers when it is spoken to and sometimes joins in, and its lines are posted to the room without asking its owner first. “Draft reply” stays private for review. Selfies and the Kin’s own voice need Kindroid’s own services and aren’t available in Kin Relay.`, "kins text");
H(`$("autoUse").textContent = \`Each Kin reply is one Kin request on your account and uses credits. Automatic replies used: \${au.used} of \${au.cap} this hour. A burst of messages gets one reply.\`;`,
  `$("autoUse").textContent = V.kr ? \`Each Kin reply is a normal Kin message through your Kindroid API key (no Kindroid Apps credits). Kin replies used this hour: \${au.used} of \${au.cap}. Your Kins answer when they are spoken to and join in on their own now and then.\` : \`Each Kin reply is one Kin request on your account and uses credits. Automatic replies used: \${au.used} of \${au.cap} this hour. A burst of messages gets one reply.\`;`, "autoUse text");
H(`  V.pending.forEach((m) => { const d = el("div", null, "msg wait mine");`, `  (V.typing || []).forEach((t) => { const d = el("div", null, "msg kin typing"); const b = el("div", null, "bubble"); b.textContent = "…"; d.append(b, el("div", t.who + " is typing…", "who")); box.append(d); });
  V.pending.forEach((m) => { const d = el("div", null, "msg wait mine");`, "typing line");
H(`  tile("♪", "Generate voice (uses voice credits)", m.kind === "kin" && mine, () => { send({ t: "voice", mid: m.id }); flash("Making voice… (uses your voice credits)"); });`,
  `  if (V.kr) tile("🔊", "Read aloud (this device's voice)", !!m.text && typeof speechSynthesis !== "undefined", () => { try { speechSynthesis.cancel(); speechSynthesis.speak(new SpeechSynthesisUtterance(m.text)); } catch {} });
  tile("♪", V.kr ? "Kin's own voice (not available here)" : "Generate voice (uses voice credits)", m.kind === "kin" && mine, () => { send({ t: "voice", mid: m.id }); flash(V.kr ? "Asking for the Kin's voice…" : "Making voice… (uses your voice credits)"); });`, "voice tile");
H(`btn("Request selfie · uses credits", () => requestSelfie(k), "small")`, `btn(V.kr ? "Request selfie (not available here)" : "Request selfie · uses credits", () => requestSelfie(k), "small")`, "selfie btn");
H(`<style>\n:root{color-scheme:dark;`, `<style>\n.msg.typing .bubble{opacity:.7;font-style:italic;letter-spacing:.2em}\n:root{color-scheme:dark;`, "style");

fs.mkdirSync(path.join(out, "screen"), { recursive: true });
fs.writeFileSync(path.join(out, "main.js"), main); fs.writeFileSync(path.join(out, "screen/index.html"), html);
console.log("patched kin-roomsPlus for Kin Relay");
