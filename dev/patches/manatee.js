// Makes "Cards Against Kin-manatee" table chat a flowing group conversation inside Kin Relay, like the Hold'em, Casino
// and RoomsPlus tables: anyone's line (a person's or a Kin's) can get Kin replies, with "X is typing…", at most 3 Kin
// lines in a row, a visible reason when a Kin can't answer, and your name (not "Host"). Every change is behind `KR`
// (true only when the app runs inside Kin Relay), so the same code still behaves as before on Kindroid, where Kin chat
// lines stay private drafts.
//   node dev/patches/manatee.js <pristine dir> <out dir>
"use strict";
const fs = require("fs"), path = require("path");
const [src, out] = process.argv.slice(2);
let main = fs.readFileSync(path.join(src, "main.js"), "utf8");
let app = fs.readFileSync(path.join(src, "screen/app.js"), "utf8");
let css = fs.readFileSync(path.join(src, "screen/style.css"), "utf8");
function rep(s, a, b, what) { const n = s.split(a).length - 1; if (n !== 1) throw new Error(`patch "${what}": expected 1 match, found ${n}`); return s.replace(a, () => b); }
const M = (a, b, w) => (main = rep(main, a, b, w)), A = (a, b, w) => (app = rep(app, a, b, w));

M(`const MANATEE = "The Manatee"; // the dealer's name in the table chat`,
`const MANATEE = "The Manatee"; // the dealer's name in the table chat
// ----- Kin Relay: table chat is a group conversation; each Kin answers through its own person's API key -----
const KR = !!process.env.KGR_SLUG;
const KR_CHAIN = Math.min(1, Math.max(0, Number(process.env.KGR_ROOM_CHAIN) || 0.55)); // chance a Kin answers another Kin
const KR_MAX_RUN = 3, KR_TYPING_MS = 100000;
let krErr = "";`, "consts");

M(`const DEF_CFG = () => ({ mode: "off", myId: rid(8), name: "",`, `const DEF_CFG = () => ({ mode: "off", myId: rid(8), name: KR ? String(process.env.KGR_PLAYER || "").slice(0, 40) : "",`, "def name");
M(`name: clean(c.name, NAME_MAX) || cfg.name || "Host", tableName: name`, `name: clean(c.name, NAME_MAX) || cfg.name || (KR && clean(process.env.KGR_PLAYER || "", NAME_MAX)) || "Host", tableName: name`, "host name");

M(`  if (m.kind === "person") await mentions(e);
}`, `  if (KR) await krTalk(e); else if (m.kind === "person") await mentions(e);
}
// ----- Kin Relay group conversation -----
const krTyping = () => { const t = (T.typing = T.typing || {}); for (const n of Object.keys(t)) if (now() - t[n] > KR_TYPING_MS) delete t[n]; return t; };
function krNamed(name, text) {
  const esc = (n) => n.replace(/[.*+?^\${}()|[\\]\\\\]/g, "\\\\$&"), fw = String(name).trim().split(/\\s+/)[0] || "";
  if (new RegExp("(^|[^\\\\w])@?" + esc(name) + "(?![\\\\w])", "i").test(text)) return true;
  return fw.length >= 3 && new RegExp("(^|[^\\\\w])@?" + esc(fw) + "(?![\\\\w])", "i").test(text);
}
async function krFail(name, reason) {
  T.krErrAt = T.krErrAt || {}; if (now() - (T.krErrAt[name] || 0) < 60000) return; T.krErrAt[name] = now();
  await dealerSay(\`\${name} couldn't answer: \${clean(reason || "no reply came back", 160)}\`);
}
async function krTalk(e) {
  if (e.kind === "dealer") return;
  const typing = krTyping();
  if (e.kind === "kin") { delete typing[e.who]; T.krChain = (T.krChain || 0) + 1; } else T.krChain = 0;
  const busy = Object.keys(typing).length;
  if (T.krChain + busy >= KR_MAX_RUN) return;
  const seats = T.seats.filter((s) => s.kind === "kin" && s.name !== e.who && !typing[s.name]);
  if (!seats.length) return;
  let pick = seats.filter((s) => krNamed(s.name, e.text)).slice(0, 2);
  if (!pick.length) {
    if (e.kind === "kin" && rnd() >= KR_CHAIN) return;
    const n = e.kind === "person" && /\\?|\\b(everyone|everybody|all of you|you all|y'all|guys)\\b/i.test(e.text) ? 2 : 1;
    const last = T.kinLast || {};
    pick = seats.map((s) => [s, (last[s.id] || 0) + rnd() * 1000]).sort((a, b) => a[1] - b[1]).map((x) => x[0]).slice(0, n);
  }
  pick = pick.slice(0, Math.max(0, KR_MAX_RUN - T.krChain - busy));
  for (const s of pick) await krSpeak(s, e);
}
async function krSpeak(s, e) {
  const typing = krTyping(); (T.kinLast = T.kinLast || {})[s.id] = now();
  const toIt = krNamed(s.name, e.text);
  if (s.owner !== cfg.myId) { // a guest's Kin answers on its own person's copy, with their key
    const m = T.members[s.owner]; if (!m || m.status !== "in") return;
    typing[s.name] = now(); enqueue(m.addr, { t: "mention", kr: true, from: e.who, to: toIt, chatTail: recentChat(12) }); shareState(); await writeView(); await flush(true); return;
  }
  if (kinUsed() >= kinCap()) return krFail(s.name, \`its limit of \${kinCap()} Kin requests an hour at this table is used up (Settings)\`);
  const k = allKins.find((x) => x.id === s.kinId) || { id: s.kinId, name: s.name };
  typing[s.name] = now(); shareState(); await writeView(); await flush(true);
  const line = await kinChatLine(k, \`\${e.who}\${e.kind === "kin" ? " (a Kin)" : ""} just said something in the table chat\${toIt ? " to you" : ""}. Answer naturally, like a friend at the table.\`);
  delete krTyping()[s.name];
  if (line && (T.krChain || 0) < KR_MAX_RUN) await tablePost({ who: s.name, owner: cfg.myId, kind: "kin", text: line });
  else if (!line && krErr) await krFail(s.name, krErr);
  shareState(); await writeView();
}`, "tablePost");

M(`  const r = await kin(["ask", prompt.slice(0, 6000), "--kin", k.id]);
  if (!r.ok) return "";`, `  const r = await kin(["ask", prompt.slice(0, 6000), "--kin", k.id]);
  krErr = "";
  if (!r.ok) { krErr = clean(String(r.err || "").trim().split("\\n").filter(Boolean).pop() || "the request failed", 160); return ""; }`, "kinChatLine err");

M(`    ach: T.ach || {}, achNew:`, `    typing: KR ? Object.keys(krTyping()) : [], ach: T.ach || {}, achNew:`, "pub typing");

// host: a guest's Kin couldn't answer (or chose not to)
M(`    else if (ev.t === "kin") {
      const k = ev.kin`, `    else if (KR && ev.t === "kinerr") { const s = seatOf("k:" + from); if (s) { delete krTyping()[s.name]; if (ev.text) await krFail(s.name, clean(ev.text, 160)); shareState(); } }
    else if (ev.t === "kin") {
      const k = ev.kin`, "host kinerr");
// member: in Kin Relay a Kin's answer goes straight to the table (it's a normal message through your own key)
M(`      const line = await kinChatLine(k, \`\${clean(ev.from, NAME_MAX)} just spoke to you in the table chat.\`, true);
      if (line) addDraft(k, line, clean(ev.from, NAME_MAX));`, `      if (KR && ev.kr) {
        const line = await kinChatLine(k, \`\${clean(ev.from, NAME_MAX)} just said something in the table chat\${ev.to ? " to you" : ""}. Answer naturally, like a friend at the table.\`);
        if (line) { const lid = rid(6); pendingChat.push({ lid, who: k.name, text: line }); enqueue(cfg.hostAddr, { t: "kinSay", lid, text: line }); }
        else enqueue(cfg.hostAddr, { t: "kinerr", text: krErr });
        continue;
      }
      const line = await kinChatLine(k, \`\${clean(ev.from, NAME_MAX)} just spoke to you in the table chat.\`, true);
      if (line) addDraft(k, line, clean(ev.from, NAME_MAX));`, "member mention");
// "Have my Kin say something": posted straight away in Kin Relay
M(`    addDraft(k, line, ""); return;
  }`, `    if (KR && cfg.mode === "host") { await tablePost({ who: k.name, owner: cfg.myId, kind: "kin", text: line }); return; }
    if (KR && cfg.mode === "member" && cfg.joined) { const lid = rid(6); pendingChat.push({ lid, who: k.name, text: line }); enqueue(cfg.hostAddr, { t: "kinSay", lid, text: line }); return; }
    addDraft(k, line, ""); return;
  }`, "kinTalkNow");
// the Kin's "had nothing to say" vs a failure
M(`    if (!line) { note = \`\${k.name} had nothing to say.\`; return; }`, `    if (!line) { note = KR && krErr ? \`\${k.name} couldn't answer: \${krErr}\` : \`\${k.name} had nothing to say.\`; return; }`, "nothing to say");

// ---- screen: typing bubbles ----
A(`(v.pendingChat || []).length, (v.pendingOoc || []).length, JSON.stringify(T.ach).length]);`,
  `(v.pendingChat || []).length, (v.pendingOoc || []).length, JSON.stringify(T && T.ach).length, String((T && T.typing) || "")]);`, "key");
A(`      pend.forEach((m) => { const d = el("div", null, "msg wait mine-m"); d.append(el("div", m.text), el("div", m.who + " · sending…", "w")); box.append(d); });`,
  `      pend.forEach((m) => { const d = el("div", null, "msg wait mine-m"); d.append(el("div", m.text), el("div", m.who + " · sending…", "w")); box.append(d); });
      if (chan === "chat") for (const n of (T && T.typing) || []) box.append(el("div", n + " is typing…", "msg kin typing"));`, "typing render");
css += `\n.msg.typing{opacity:.75;font-style:italic}\n`;

fs.writeFileSync(path.join(out, "main.js"), main);
fs.writeFileSync(path.join(out, "screen/app.js"), app);
fs.writeFileSync(path.join(out, "screen/style.css"), css);
console.log("patched", out);
