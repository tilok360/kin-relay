#!/usr/bin/env node
// Kin Relay: plays Kindroid Apps games on this PC, outside Kindroid, and hosts tables for friends.
//  - Drop a game's "Get its code" download (.gz) on the window to add it; it is unpacked into games/<name>.
//  - Each game's screen runs in your browser exactly as in Kindroid; this server answers what the screen asks the
//    page around it for (its files, its Kins, asking a Kin, using an action).
//  - A game's runs (its main.js) happen here on your PC, so they use no Kindroid Apps credits.
//  - "Play with my Kin" asks your Kin through Kindroid's public API with your own API key (normal Kin messages).
//  - Tables with other people go through a relay (relay.js: run it here, or on a free host): free, and nobody shares a key.
// Only this PC can open it (it listens on 127.0.0.1). No packages to install: Node.js 22 or newer.
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");
const S = require("./lib/store");
const KD = require("./lib/kindroid");
const A = require("./lib/address");
const { Runner } = require("./lib/runtime");
const { RelayLink } = require("./lib/relay-link");
const I = require("./lib/installer");
const IO = require("./public/chario.js");

const VERSION = "1.3.0";
// Games you add go to APPS_DIR: the games/ folder next to this file when run from the zip, or your data folder in the
// Windows app (its program folder is replaced on every update). Games that come with the Windows app are read from
// BUILTIN_DIR; one you add with the same name takes its place.
const APPS_DIR = process.env.KGR_APPS || (process.env.KGR_USER_GAMES ? path.join(S.ROOT, "games") : path.join(__dirname, "games"));
const BUILTIN_DIR = process.env.KGR_BUILTIN_GAMES || "";
const PUBLIC = path.join(__dirname, "public");
const BASE_PORT = Number(process.env.KGR_PORT) || 47900;
const TOKEN = crypto.randomBytes(24).toString("hex");      // the lobby page's key to this server, new each start
const RUN_TOKEN = crypto.randomBytes(24).toString("hex");  // a game run's key to /internal/ask
const boxOf = (secret) => crypto.createHash("sha256").update("kin-relay:" + secret).digest("hex").slice(0, 32);
const log = (...a) => console.log(new Date().toTimeString().slice(0, 8), ...a.map((x) => KD.redact(x)));
let PORT = BASE_PORT;

// ---------- the games ----------
const apps = new Map(); // slug -> {slug, dir, manifest, screen, inbound: [ids]}
function loadApps() {
  apps.clear();
  const found = [];
  for (const [root, builtin] of [[APPS_DIR, false], [BUILTIN_DIR, true]]) {
    if (!root || (builtin && path.resolve(root) === path.resolve(APPS_DIR))) continue;
    try { for (const d of fs.readdirSync(root, { withFileTypes: true })) if (d.isDirectory()) found.push({ name: d.name, dir: path.join(root, d.name), builtin }); } catch {}
  }
  for (const d of found) {
    if (d.name.startsWith(".") || /\.old-\d+$/.test(d.name)) continue;
    const dir = d.dir;
    let m; try { m = JSON.parse(fs.readFileSync(path.join(dir, "kin.json"), "utf8")); } catch { continue; }
    const slug = d.name.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 60);
    if (apps.has(slug)) continue; // one you added wins over the built-in copy
    const screen = (m.screens || [])[0];
    const inbound = (m.triggers || []).filter((t) => t && t.on === "inbound" && t.id).map((t) => String(t.id));
    const report = I.analyze(m, (p) => { const f = I.cleanPath(p) && path.join(dir, I.cleanPath(p)); return f && fs.existsSync(f) ? fs.readFileSync(f, "utf8") : ""; });
    const added = S.readJSON(path.join(dir, "kinrelay-added.json"), null);
    apps.set(slug, { slug, dir, builtin: d.builtin, manifest: m, screen: screen ? String(screen.entry).replace(/\\/g, "/") : "", inbound, report, added: added && added.added, art: fs.existsSync(path.join(PUBLIC, "art", slug + ".svg")) ? slug : "default" });
  }
}
loadApps();

// ---------- sign-ins an app asks for, what apps told their Kins, and scheduled runs ----------
// grants like "secret:twitchchat@irc-ws.chat.twitch.tv": the app may use that sign-in, only toward that host
const grantedSecrets = (app) => (app.manifest.grants || []).map((g) => /^secret:([A-Za-z0-9_.-]+)@([^\s@]+)$/.exec(String(g))).filter(Boolean).map((m) => ({ name: m[1], host: m[2] }));
function secretsFor(slug) {
  const app = apps.get(slug), all = S.secretsAll(), out = {};
  if (app) for (const g of grantedSecrets(app)) { const v = all[slug + ":" + g.name]; if (v) out[g.name] = { host: g.host, value: v }; }
  return out;
}
// What an app told a Kin (kin tell) is put in front of that Kin's next questions from the same app.
function memoryFor(slug, kinId) {
  if (!slug) return "";
  const list = S.readJSON(path.join(S.appDir(slug), "tells.json"), []);
  const t = Date.now();
  const facts = (Array.isArray(list) ? list : []).filter((x) => x && x.text && (!x.kin || x.kin === kinId) && t - Date.parse(x.at) < (x.ttl ? x.ttl : 72) * 3600000).slice(-8).map((x) => String(x.text));
  return facts.join(" | ").slice(0, 900);
}
const { cronMatches } = require("./lib/cron");
const scheduleOf = (app) => (app.manifest.triggers || []).filter((t) => t && t.on === "schedule" && t.cron);
let lastCron = "";
function schedulerTick() {
  const d = new Date(), key = d.toISOString().slice(0, 16);
  if (key === lastCron) return; lastCron = key;
  for (const app of apps.values()) if (app.manifest.run && scheduleOf(app).some((t) => cronMatches(t.cron, d))) { runner(app.slug).background({ trigger: "schedule" }); markRan(app.slug); }
}
const ranFile = (slug) => path.join(S.appDir(slug), "last-scheduled.json");
const markRan = (slug) => { try { S.writeJSON(ranFile(slug), { at: Date.now() }); } catch {} };
// An app that runs on a schedule while Kin Relay was closed catches up the first time it is opened.
function catchUp(slug) {
  const app = apps.get(slug); if (!app || !app.manifest.run || !scheduleOf(app).length) return false;
  const last = S.readJSON(ranFile(slug), { at: 0 }).at || 0;
  if (Date.now() - last < 20 * 3600000) return false;
  markRan(slug); runner(slug).background({ trigger: "schedule", catchUp: true }); return true;
}
const alwaysApps = () => [...apps.values()].filter((a) => a.manifest.run && (a.manifest.triggers || []).some((t) => t && t.on === "always"));

// ---------- Kins, relay addresses ----------
function relaySecrets(slug) {
  const f = path.join(S.appDir(slug), "relay.json");
  const j = S.readJSON(f, {}); let changed = false;
  j.secrets = j.secrets || {};
  for (const id of apps.get(slug).inbound) if (!/^[0-9a-f]{64}$/.test(j.secrets[id] || "")) { j.secrets[id] = crypto.randomBytes(32).toString("hex"); changed = true; }
  if (changed) S.writeJSON(f, j, true);
  return j.secrets;
}
function envFor(slug) {
  const s = S.settings(), g = S.gameKins(s, slug);
  const kins = g.kins.map((k) => ({ id: k.id, name: k.name }));
  const current = g.current;
  const addrs = {};
  if (s.relay && apps.get(slug).inbound.length) for (const [id, sec] of Object.entries(relaySecrets(slug))) addrs[id] = A.make(s.relay, boxOf(sec));
  return { kins, current, addrs, player: s.name || "", secrets: secretsFor(slug) };
}

// ---------- runs ----------
const runners = new Map();
const runner = (slug) => { if (!runners.has(slug)) runners.set(slug, new Runner(apps.get(slug), { port: PORT, runToken: RUN_TOKEN, env: envFor, log: (s, l) => { l = l.split("\n").filter((x) => !/PERM0006|--trace-warnings/.test(x)).join("\n").trim(); if (l) log(`[${s}]`, l); } })); return runners.get(slug); };

// ---------- relay links ----------
const links = new Map(); // "slug:id" -> RelayLink
function refreshLinks() {
  for (const l of links.values()) l.stop();
  links.clear();
  const s = S.settings();
  if (!s.relay) return;
  try { new URL(s.relay); } catch { return; }
  for (const app of apps.values()) {
    if (!app.inbound.length) continue;
    const secrets = relaySecrets(app.slug);
    for (const id of app.inbound) {
      links.set(app.slug + ":" + id, new RelayLink({
        relay: s.relay, secret: secrets[id],
        onStatus: (st, why) => { if (st === "error") log(`[${app.slug}] relay: ${why}`); },
        onMessage: async (m) => {
          const name = `inbox/${Date.now()}-${crypto.randomBytes(4).toString("hex")}.json`;
          const f = S.safeFile(app.slug, name);
          fs.mkdirSync(path.dirname(f), { recursive: true });
          fs.writeFileSync(f, JSON.stringify({ body: m.body, content_type: m.ct, headers: { "content-type": m.ct } }));
          runner(app.slug).background({ trigger: "inbound", id });
        },
      }));
    }
  }
}

// ---------- a relay on this PC (optional) ----------
let ownRelay = null;
function startOwnRelay(port) {
  if (ownRelay) return;
  ownRelay = spawn(process.execPath, [path.join(__dirname, "relay.js")], { env: Object.assign({}, process.env, { PORT: String(port), HOST: "0.0.0.0", RELAY_QUIET: "1" }, process.versions.electron ? { ELECTRON_RUN_AS_NODE: "1" } : {}), stdio: "ignore", windowsHide: true });
  ownRelay.on("exit", () => { ownRelay = null; });
}
function stopOwnRelay() { if (ownRelay) { try { ownRelay.kill(); } catch {} ownRelay = null; } }
const lan = () => require("./relay").lanAddresses();

// ---------- asking a Kin ----------
async function askKin(question, kinId, slug) {
  const s = S.settings(), g = slug ? S.gameKins(s, slug) : null;
  if (g && kinId && !g.kins.some((k) => k.id === kinId)) kinId = g.current; // only the Kins you chose for this game play it
  const kin = s.kins.find((k) => k.id === kinId) || (g && s.kins.find((k) => k.id === g.current)) || s.kins.find((k) => k.id === s.currentKin) || s.kins[0];
  if (!kin) return { ok: false, error: "Add a Kin on the Characters tab first (Solo needs nothing)." };
  if (!S.apiKey()) return { ok: false, error: "Add your Kindroid API key in Settings first (Solo needs nothing)." };
  try { return { ok: true, text: await KD.ask({ apiKey: S.apiKey(), kin, question, style: s.askStyle, playerName: s.name, memory: memoryFor(slug, kin.id) }) }; }
  catch (e) { log("Kin ask:", e.message); return { ok: false, error: e.message, kind: e.kind }; }
}

async function chatOf(kinId, slug, days) {
  const s = S.settings(), g = slug ? S.gameKins(s, slug) : null;
  const kin = s.kins.find((k) => k.id === kinId) || (g && s.kins.find((k) => k.id === g.current)) || s.kins.find((k) => k.id === s.currentKin) || s.kins[0];
  if (!kin) return { ok: false, error: "Add a Kin on the Characters tab first." };
  if (!S.apiKey()) return { ok: false, error: "Add your Kindroid API key in Settings first." };
  try {
    const all = await KD.history({ apiKey: S.apiKey(), kin, limit: 100 });
    const since = Date.now() - Math.max(1, days || 1) * 86400000;
    return { ok: true, messages: all.filter((m) => !m.at || (m.at > 1e12 ? m.at : m.at * 1000) >= since).map((m) => ({ from: m.from, name: m.name, text: m.text, at: m.at })) };
  } catch (e) { log("Kin chat:", e.message); return { ok: false, error: e.message }; }
}

// ---------- HTTP ----------
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg", ".woff2": "font/woff2", ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8" };
function json(res, status, obj) { res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }); res.end(JSON.stringify(obj)); }
function sendFile(res, file, extraHeaders) {
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { "content-type": "text/plain" }); return res.end("Not found"); }
    res.writeHead(200, Object.assign({ "content-type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream", "cache-control": "no-cache" }, extraHeaders || {}));
    res.end(data);
  });
}
// A game's screen page gets Kin Relay's own small script first: it words the screen for this app (no "uses credits") and
// gives it the saved-Kin list helpers. The game's files on disk are never changed.
let SHIM_JS = null;
function shimJs() { if (SHIM_JS === null) { try { SHIM_JS = fs.readFileSync(path.join(PUBLIC, "screen-shim.js"), "utf8").replace(/<\/script/gi, "<\\/script"); } catch { SHIM_JS = ""; } } return SHIM_JS; }
function sendScreenHtml(res, file) {
  fs.readFile(file, "utf8", (err, html) => {
    if (err) { res.writeHead(404, { "content-type": "text/plain" }); return res.end("Not found"); }
    const tag = "<script>" + shimJs() + "</script>";
    html = /<head(?:\s[^>]*)?>/i.test(html) ? html.replace(/<head(?:\s[^>]*)?>/i, (m) => m + tag) : tag + html;
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" });
    res.end(html);
  });
}
function readBody(req, max = 2 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = []; let n = 0;
    req.on("data", (c) => { n += c.length; if (n > max) { reject(new Error("too large")); req.destroy(); } else chunks.push(c); });
    req.on("end", () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {}); } catch (e) { reject(e); } });
    req.on("error", reject);
  });
}
function page(res, name) {
  let html = fs.readFileSync(path.join(PUBLIC, name), "utf8").replace(/\{\{TOKEN\}\}/g, TOKEN).replace(/\{\{SCREEN_ORIGIN\}\}/g, `http://127.0.0.1:${PORT}`).replace(/\{\{VERSION\}\}/g, VERSION);
  res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-frame-options": "DENY", "referrer-policy": "no-referrer" });
  res.end(html);
}
function inside(base, rel) { const full = path.resolve(base, "." + path.sep + rel); return full.startsWith(path.resolve(base) + path.sep) ? full : null; }

function publicState() {
  const s = S.settings(), key = S.apiKey();
  const appList = [...apps.values()].map((a) => ({ slug: a.slug, builtin: !!a.builtin, name: a.manifest.name || a.slug, purpose: a.manifest.purpose || "", art: a.art, screen: !!a.screen, screenFile: a.screen ? path.posix.basename(a.screen) : "", runs: !!(a.manifest.run && a.manifest.run.entry), tables: a.inbound.length > 0, report: a.report, added: a.added || null }));
  const rl = [...links.entries()].map(([k, l]) => ({ app: k.split(":")[0], state: l.state, why: l.why || "" }));
  return {
    version: VERSION, apps: appList, lan: lan(), ownRelay: !!ownRelay,
    settings: { name: s.name, kins: s.kins.map((k) => ({ id: k.id, cid: k.cid, name: k.name, ai_id: k.ai_id, share_code: k.share_code, notes: k.notes, avatar: k.avatar, hasDetails: Object.keys(k.details || {}).length > 0 })), currentKin: s.currentKin || (s.kins[0] || {}).id || "", relay: s.relay, ownRelayPort: s.ownRelayPort, askStyle: s.askStyle, welcomeDone: !!s.welcomeDone },
    games: Object.fromEntries([...apps.keys()].map((slug) => { const g = S.gameKins(s, slug); return [slug, { kins: g.kins.map((k) => k.id), current: g.current, chosen: g.chosen }]; })),
    key: key ? { set: true, hint: "kn_…" + key.slice(-4), protection: S.keyProtection() } : { set: false, protection: S.keyProtection() === "encrypted" ? "locked" : "none" },
    desktop: !!process.versions.electron,
    relay: rl.length ? (rl.every((x) => x.state === "online") ? "online" : rl.some((x) => x.state === "error") ? "error" : "connecting") : (s.relay ? "idle" : "off"),
    relayWhy: (rl.find((x) => x.why) || {}).why || "",
    dataFolder: S.ROOT,
    secrets: [...apps.values()].flatMap((a) => grantedSecrets(a).map((g) => ({ slug: a.slug, app: a.manifest.name || a.slug, name: g.name, host: g.host, set: !!S.secretsAll()[a.slug + ":" + g.name] }))),
  };
}

async function api(req, res, url) {
  const p = url.pathname;
  if (p === "/internal/ask") {
    if (req.headers["x-run-token"] !== RUN_TOKEN) return json(res, 403, { ok: false });
    const b = await readBody(req); return json(res, 200, await askKin(String(b.question || "").slice(0, 8000), String(b.kin || ""), String(b.slug || "")));
  }
  if (p === "/internal/chat") {
    if (req.headers["x-run-token"] !== RUN_TOKEN) return json(res, 403, { ok: false });
    const b = await readBody(req); return json(res, 200, await chatOf(String(b.kin || ""), String(b.slug || ""), Number(b.days) || 1));
  }
  // Everything else only for the Kin Relay page itself (not a game's screen, not another website).
  if (req.headers["x-room-token"] !== TOKEN || (req.headers.origin && req.headers.origin !== `http://localhost:${PORT}`)) return json(res, 403, { ok: false, error: "not allowed" });
  if (p === "/api/state" && req.method === "GET") return json(res, 200, publicState());
  if (p === "/api/files/raw" && req.method === "GET") {
    const slug = url.searchParams.get("slug"); if (!apps.has(slug)) return json(res, 404, {});
    const f = S.safeFile(slug, url.searchParams.get("path")); if (!f || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    return sendFile(res, f, { "content-type": "application/octet-stream" });
  }
  if (req.method !== "POST") return json(res, 405, {});
  if (p === "/api/install") return installRoute(req, res);
  if (p === "/api/avatar") return avatarRoute(req, res);
  const b = await readBody(req, p === "/api/import" ? 24 * 1024 * 1024 : undefined);
  const app = b.slug ? apps.get(String(b.slug)) : null;
  switch (p) {
    case "/api/settings": {
      const s = S.settings(), keep = s;
      if (typeof b.name === "string") keep.name = b.name.trim().slice(0, 40);
      if (typeof b.currentKin === "string") keep.currentKin = b.currentKin;
      if (b.askStyle === "chat" || b.askStyle === "quiet") keep.askStyle = b.askStyle;
      let relayChanged = false;
      if (typeof b.relay === "string") {
        const r = b.relay.trim();
        if (r) { try { const u = new URL(r); if (!/^https?:$/.test(u.protocol)) throw 0; } catch { return json(res, 400, { ok: false, error: "A relay address starts with https:// (or http:// on a home network)." }); } }
        relayChanged = r !== keep.relay; keep.relay = r;
      }
      if (b.welcomeDone === true) keep.welcomeDone = true;
      S.saveSettings(keep);
      if (relayChanged) refreshLinks();
      return json(res, 200, { ok: true, state: publicState() });
    }
    case "/api/key": {
      // clear: forget it. test: check a typed key (or the saved one) without saving. apiKey: check, then save if Kindroid didn't refuse it.
      if (b.clear) { S.setApiKey(""); return json(res, 200, { ok: true, message: "Your key was removed from this PC.", state: publicState() }); }
      const typed = String(b.apiKey || b.test || "").replace(/[\s\u200b-\u200d\ufeff]/g, "");
      if (b.test !== undefined && !typed && !S.apiKey()) return json(res, 200, { ok: false, message: "There's no key to test yet. Paste your key first." });
      const c = await KD.checkKey(typed || S.apiKey());
      if (b.apiKey === undefined) return json(res, 200, { ok: c.ok, message: c.message, state: publicState() });
      if (!c.ok && c.refused) return json(res, 200, { ok: false, message: c.message + " It was not saved." });
      S.setApiKey(typed);
      return json(res, 200, { ok: c.ok, saved: true, message: c.ok ? "Saved. " + c.message : "Saved, but it couldn't be checked: " + c.message, state: publicState() });
    }
    case "/api/character": {
      const s = S.settings();
      if (b.op === "delete") {
        const k = s.kins.find((x) => x.cid === b.cid); if (!k) return json(res, 200, { ok: false, error: "That character is already gone." });
        s.kins = s.kins.filter((x) => x !== k); try { fs.unlinkSync(S.avatarFile(k.cid)); } catch {}
        S.saveSettings(s); return json(res, 200, { ok: true, state: publicState() });
      }
      if (b.op === "clearAvatar") {
        const k = s.kins.find((x) => x.cid === b.cid); if (k) { k.avatar = false; try { fs.unlinkSync(S.avatarFile(k.cid)); } catch {} S.saveSettings(s); }
        return json(res, 200, { ok: true, state: publicState() });
      }
      if (b.op === "get") {
        const k = s.kins.find((x) => x.cid === b.cid); if (!k) return json(res, 200, { ok: false, error: "That character is gone." });
        return json(res, 200, { ok: true, details: k.details || {} });
      }
      if (b.op === "save") {
        const inK = b.kin || {}, ai = S.cleanAiId(inK.ai_id), problem = S.aiIdProblem(ai);
        if (problem) return json(res, 200, { ok: false, field: "ai_id", error: problem });
        if (!String(inK.name || "").trim()) return json(res, 200, { ok: false, field: "name", error: "Give your Kin a name." });
        const old = s.kins.find((x) => x.cid === inK.cid);
        if (s.kins.some((x) => x !== old && x.ai_id === ai)) return json(res, 200, { ok: false, field: "ai_id", error: "Another character already uses that AI ID." });
        if (!old && s.kins.length >= 50) return json(res, 200, { ok: false, error: "That's 50 characters, the most Kin Relay keeps." });
        const c = S.cleanKin(Object.assign({}, inK, { ai_id: ai, cid: old ? old.cid : "", avatar: old ? old.avatar : false, details: inK.details === undefined && old ? old.details : inK.details }));
        if (old) Object.assign(old, c); else s.kins.push(c);
        if (!s.currentKin) s.currentKin = S.kinAlias(ai);
        S.saveSettings(s);
        return json(res, 200, { ok: true, cid: c.cid, state: publicState() });
      }
      return json(res, 400, { ok: false });
    }
    case "/api/export": return json(res, 200, exportCharacters(b));
    case "/api/import": return json(res, 200, await importCharacters(b));
    case "/api/game-kins": {
      if (!app) return json(res, 404, { ok: false });
      const s = S.settings(), ids = new Set(s.kins.map((k) => k.id));
      const list = Array.isArray(b.kins) ? b.kins.map(String).filter((id) => ids.has(id)) : [];
      s.games[app.slug] = { kins: list, current: list.includes(String(b.current)) ? String(b.current) : list[0] || "" };
      S.saveSettings(s);
      return json(res, 200, { ok: true, state: publicState() });
    }
    case "/api/own-relay": {
      const s = S.settings(), port = Math.max(1024, Math.min(65535, Number(b.port) || s.ownRelayPort || 8787));
      const keep = Object.assign({}, s, { ownRelay: !!b.on, ownRelayPort: port });
      if (b.on) { startOwnRelay(port); const ip = lan()[0] || "127.0.0.1"; if (!s.relay || s.ownRelay) keep.relay = `http://${ip}:${port}/`; }
      else { stopOwnRelay(); if (s.ownRelay && /^http:\/\/[\d.]+:\d+\/?$/.test(s.relay)) keep.relay = ""; }
      S.saveSettings(keep);
      setTimeout(() => { refreshLinks(); }, b.on ? 600 : 0);
      return setTimeout(() => json(res, 200, { ok: true, state: publicState() }), b.on ? 700 : 10);
    }
    case "/api/files/read": {
      if (!app) return json(res, 404, {});
      const f = S.safeFile(app.slug, b.path); if (!f) return json(res, 200, { body: null });
      try { return json(res, 200, { body: fs.readFileSync(f, "utf8") }); } catch { return json(res, 200, { body: null }); }
    }
    case "/api/files/write": {
      if (!app) return json(res, 404, {});
      const f = S.safeFile(app.slug, b.path); if (!f) return json(res, 200, { ok: false });
      fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, String(b.body == null ? "" : b.body).slice(0, 5 * 1024 * 1024));
      return json(res, 200, { ok: true });
    }
    case "/api/ask": {
      if (!app) return json(res, 404, {});
      return json(res, 200, await askKin(String(b.question || "").slice(0, 8000), String(b.kin || ""), app.slug));
    }
    case "/api/action": {
      if (!app) return json(res, 404, {});
      const acts = (app.manifest.actions || []).map((x) => x.name);
      if (!acts.includes(String(b.name))) return json(res, 200, { ok: false, summary: "This app has no action " + b.name });
      return json(res, 200, await runner(app.slug).action(b.name, b.input, S.gameKins(S.settings(), app.slug).current));
    }
    case "/api/open": { // a screen was opened: games that have a "wake" action start their run now (Kindroid does this when a screen opens)
      if (!app) return json(res, 404, { ok: false });
      const wakes = (app.manifest.actions || []).some((x) => x.name === "wake");
      if (wakes) runner(app.slug).action("wake", {}, S.gameKins(S.settings(), app.slug).current).catch(() => {});
      const caught = !wakes && catchUp(app.slug);
      if (alwaysApps().includes(app)) runner(app.slug).startAlways();
      return json(res, 200, { ok: true, started: wakes || caught });
    }
    case "/api/secret": { // a sign-in an app asked for (value "" removes it); the value is never sent back
      if (!app) return json(res, 404, { ok: false });
      const name = String(b.name || ""); if (!grantedSecrets(app).some((g) => g.name === name)) return json(res, 200, { ok: false, error: "This app doesn't ask for that sign-in." });
      S.setSecret(app.slug, name, typeof b.value === "string" ? b.value.trim() : "");
      if (runners.has(app.slug)) { runners.get(app.slug).stop(); runners.delete(app.slug); if (alwaysApps().includes(app)) runner(app.slug).startAlways(); } // restart with the new sign-in
      return json(res, 200, { ok: true, state: publicState() });
    }
    case "/api/reload": loadApps(); refreshLinks(); return json(res, 200, { ok: true, state: publicState() });
    case "/api/remove": {
      if (!app) return json(res, 404, { ok: false });
      if (app.builtin) return json(res, 200, { ok: false, error: "This game comes with Kin Relay, so it can't be removed." });
      if (runners.has(app.slug)) { runners.get(app.slug).stop(); runners.delete(app.slug); }
      fs.rmSync(app.dir, { recursive: true, force: true }); // its saves stay in the data folder
      loadApps(); refreshLinks();
      return json(res, 200, { ok: true, state: publicState() });
    }
  }
  return json(res, 404, { ok: false });
}

// ---------- characters in files ----------
// Export: the chosen characters (or all) as a Kin Relay file, or a Kin Studio-compatible file. Never holds an API key.
function exportCharacters(b) {
  const s = S.settings(), want = Array.isArray(b.cids) && b.cids.length ? new Set(b.cids.map(String)) : null;
  const chars = s.kins.filter((k) => !want || want.has(k.cid)).map((k) => {
    let avatar = ""; if (k.avatar) { try { const buf = fs.readFileSync(S.avatarFile(k.cid)); const t = imgType(buf); if (t) avatar = `data:${t};base64,${buf.toString("base64")}`; } catch {} }
    return { cid: k.cid, name: k.name, ai_id: k.ai_id, share_code: k.share_code, notes: k.notes, details: k.details, avatar };
  });
  if (!chars.length) return { ok: false, error: "There are no characters to export." };
  const studio = b.format === "studio";
  return { ok: true, count: chars.length, filename: studio ? "kin-studio-characters.json" : "kin-relay-characters.json", file: studio ? IO.toStudioFile(chars) : IO.toRelayFile(chars, "Kin Relay " + VERSION) };
}
// Import: the page has already read the file and let you tick characters; this validates again and stores them.
// items: [{ ai_id, name, share_code, notes, details, avatar (data URL) | avatar_url (Kindroid storage), action: "add" | "update" }]
async function fetchAvatar(u) {
  const url = IO.safeAvatarUrl(u); if (!url) return null;
  try {
    const r = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(10000), headers: { "user-agent": "KinRelay" } });
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    return buf.length <= 3 * 1024 * 1024 && imgType(buf) ? buf : null;
  } catch { return null; }
}
async function importCharacters(b) {
  const items = Array.isArray(b.items) ? b.items.slice(0, 60) : [];
  const s = S.settings(), res = { added: 0, updated: 0, skipped: 0, pictures: 0, problems: [] };
  if (!s.name && typeof b.userName === "string" && b.userName.trim()) s.name = b.userName.replace(/[\u0000-\u001f]/g, "").trim().slice(0, 40); // the persona name in a Kindroid export becomes your name at tables
  for (const it of items) {
    if (!it || typeof it !== "object") continue;
    const ai = S.cleanAiId(it.ai_id), problem = S.aiIdProblem(ai);
    if (problem || /^kn_/i.test(ai)) { res.skipped++; res.problems.push(`${String(it.name || "A character").slice(0, 40)}: ${problem || "not an AI ID"}`); continue; }
    const old = s.kins.find((x) => x.ai_id === ai);
    if (old && it.action !== "update") { res.skipped++; continue; }
    if (!old && s.kins.length >= 50) { res.skipped++; res.problems.push(`${String(it.name || "A character").slice(0, 40)}: Kin Relay keeps at most 50 characters.`); continue; }
    const fields = { name: it.name, ai_id: ai, share_code: it.share_code, notes: it.notes, details: it.details };
    let c;
    if (old) { // an update keeps your notes if the file has none, and details you filled in that the file leaves empty
      c = S.cleanKin(Object.assign({}, old, fields, { cid: old.cid, notes: it.notes ? it.notes : old.notes, share_code: it.share_code || old.share_code, details: Object.assign({}, old.details, IO.cleanDetails(it.details)), avatar: old.avatar }));
      Object.assign(old, c); res.updated++;
    } else { c = S.cleanKin(Object.assign({}, fields, { cid: "", avatar: false })); s.kins.push(c); res.added++; }
    let buf = null;
    if (typeof it.avatar === "string" && IO.isDataImage(it.avatar)) { try { buf = Buffer.from(it.avatar.split(",")[1], "base64"); } catch {} }
    else if (it.avatar_url) buf = await fetchAvatar(it.avatar_url);
    if (buf && imgType(buf)) { const f = S.avatarFile(c.cid); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, buf); (old || c).avatar = true; c.avatar = true; res.pictures++; }
    if (!s.currentKin) s.currentKin = S.kinAlias(ai);
  }
  S.saveSettings(s);
  return Object.assign({ ok: true, state: publicState() }, res);
}

// A character's picture: the page shrinks it to a small square first; here it is checked to be an image and kept.
function avatarRoute(req, res) {
  const chunks = []; let n = 0, tooBig = false;
  req.on("data", (c) => { n += c.length; if (n > 1024 * 1024) tooBig = true; else chunks.push(c); });
  req.on("end", () => {
    if (tooBig) return json(res, 200, { ok: false, error: "That picture is too big." });
    const buf = Buffer.concat(chunks), type = imgType(buf);
    if (!type) return json(res, 200, { ok: false, error: "That isn't a picture Kin Relay can use (PNG, JPEG, WebP or GIF)." });
    const s = S.settings(), k = s.kins.find((x) => x.cid === String(req.headers["x-cid"] || ""));
    if (!k) return json(res, 200, { ok: false, error: "Save the character first." });
    const f = S.avatarFile(k.cid); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, buf);
    k.avatar = true; S.saveSettings(s);
    return json(res, 200, { ok: true, state: publicState() });
  });
}
function imgType(b) {
  if (b.length < 12) return "";
  if (b[0] === 0x89 && b.toString("latin1", 1, 4) === "PNG") return "image/png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.toString("latin1", 0, 4) === "RIFF" && b.toString("latin1", 8, 12) === "WEBP") return "image/webp";
  if (b.toString("latin1", 0, 4) === "GIF8") return "image/gif";
  return "";
}

// A dropped "Get its code" download: unpacked into games/<name> without running anything in it.
function installRoute(req, res) {
  const chunks = []; let n = 0, tooBig = false;
  req.on("data", (c) => { n += c.length; if (n > I.LIMITS.download) tooBig = true; else chunks.push(c); });
  req.on("end", () => {
    if (tooBig) return json(res, 200, { ok: false, error: "That file is too big (over 25 MB)." });
    try {
      const name = decodeURIComponent(String(req.headers["x-file-name"] || "")).slice(0, 200);
      const r = I.install(Buffer.concat(chunks), APPS_DIR, { replace: req.headers["x-replace"] === "1", fileName: name });
      if (r.conflict) return json(res, 200, { ok: false, conflict: true, slug: r.slug, name: r.name });
      if (runners.has(r.slug)) { runners.get(r.slug).stop(); runners.delete(r.slug); }
      loadApps(); refreshLinks();
      { const na = apps.get(r.slug); if (na && alwaysApps().includes(na)) runner(na.slug).startAlways(); }
      log(`Added ${r.name} (${r.files} files) to games/${r.slug}`);
      return json(res, 200, { ok: true, game: r, state: publicState() });
    } catch (e) {
      return json(res, 200, { ok: false, error: e.install ? e.message : "That file couldn't be added: " + String(e.message || e).slice(0, 160) });
    }
  });
}

const server = http.createServer(async (req, res) => {
  const host = String(req.headers.host || "");
  const isLobby = host === `localhost:${PORT}`, isScreens = host === `127.0.0.1:${PORT}`;
  if (!isLobby && !isScreens) { res.writeHead(421); return res.end("Open Kin Relay at http://localhost:" + PORT); }
  let url; try { url = new URL(req.url, "http://" + host); } catch { res.writeHead(400); return res.end(); }
  const p = decodeURIComponent(url.pathname);
  try {
    // Game screens live on 127.0.0.1, a different web origin from the lobby on localhost, so a screen can never
    // read the lobby page or call the Kin Relay API itself.
    const am = /^\/apps\/([a-z0-9-]+)\/(.*)$/.exec(p);
    if (am && req.method === "GET") {
      const app = apps.get(am[1]); if (!app || !app.screen) { res.writeHead(404); return res.end(); }
      const base = path.join(app.dir, path.dirname(app.screen));
      const f = inside(base, am[2] || path.basename(app.screen));
      if (f && /\.html?$/i.test(f)) return sendScreenHtml(res, f);
      return f ? sendFile(res, f) : (res.writeHead(404), res.end());
    }
    if (p === "/internal/ask" && req.method === "POST") return await api(req, res, url); // a game's run (needs its run token)
    if (!isLobby) { res.writeHead(404); return res.end(); }
    if (p.startsWith("/api/") || p === "/internal/ask") return await api(req, res, url);
    const av = /^\/avatars\/([a-z0-9]{6,20})$/.exec(p);
    if (av && req.method === "GET") { // <img> can't send headers, so the page's key rides in the address
      const f = S.avatarFile(av[1]);
      if (url.searchParams.get("t") !== TOKEN || !f || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
      const buf = fs.readFileSync(f); res.writeHead(200, { "content-type": imgType(buf) || "application/octet-stream", "cache-control": "no-cache" }); return res.end(buf);
    }
    if (p === "/" || p === "/index.html") return page(res, "index.html");
    if (/^\/play\/[a-z0-9-]+$/.test(p)) return apps.has(p.slice(6)) ? page(res, "play.html") : (res.writeHead(302, { location: "/" }), res.end());
    const f = inside(PUBLIC, p.replace(/^\/+/, ""));
    if (f && !/\.html$/.test(f)) return sendFile(res, f);
    res.writeHead(404); res.end("Not found");
  } catch (e) { log("error:", e.message); if (!res.headersSent) json(res, 500, { ok: false, error: "Kin Relay error" }); }
});

// Starts Kin Relay on the first free port from BASE_PORT. The Windows app calls this and shows the address in its
// own window; run from the zip (node server.js), it opens your browser instead.
function start(opts = {}) {
  return new Promise((resolve, reject) => {
    const listen = (port, tries) => {
      const onError = (e) => { server.removeListener("listening", onListening); if (e.code === "EADDRINUSE" && tries > 0) listen(port + 1, tries - 1); else reject(e); };
      server.once("error", onError);
      server.once("listening", onListening);
      server.listen(port, "127.0.0.1");
      function onListening() {
        server.removeListener("error", onError);
        PORT = port;
        const url = `http://localhost:${PORT}/`;
        if (!opts.quiet) {
          console.log(`\n  Kin Relay ${VERSION} is open at ${url}`);
          console.log(`  Your settings and saves: ${S.ROOT}`);
          console.log("  Keep this window open while you play. Close it to stop.\n");
        }
        const s = S.settings();
        if (s.ownRelay) startOwnRelay(s.ownRelayPort || 8787);
        setTimeout(refreshLinks, s.ownRelay ? 600 : 0);
        for (const a of alwaysApps()) runner(a.slug).startAlways(); // apps that stay connected (Twitch chat...) run while Kin Relay is open
        schedTimer = setInterval(schedulerTick, 20000); schedTimer.unref && schedTimer.unref();
        if (opts.open) openBrowser(url);
        resolve({ port: PORT, url, version: VERSION, dataFolder: S.ROOT });
      }
    };
    listen(BASE_PORT, 10);
  });
}
let schedTimer = null;
function stop() { clearInterval(schedTimer); stopOwnRelay(); for (const l of links.values()) l.stop(); for (const r of runners.values()) r.stop(); try { server.close(); } catch {} }
function openBrowser(url) {
  try {
    if (process.platform === "win32") spawn("cmd", ["/c", "start", "", url], { stdio: "ignore", detached: true, windowsHide: true }).unref();
    else spawn(process.platform === "darwin" ? "open" : "xdg-open", [url], { stdio: "ignore", detached: true }).on("error", () => {}).unref();
  } catch {}
}
const major = Number(process.versions.node.split(".")[0]);
if (major < 22) console.warn(`Note: this is Node.js ${process.versions.node}. Kin Relay needs Node.js 22 or newer for tables with other people.`);
process.on("exit", () => { stopOwnRelay(); for (const r of runners.values()) r.stop(); });
module.exports = { start, stop, VERSION };
if (require.main === module) {
  process.on("SIGINT", () => { stopOwnRelay(); process.exit(0); });
  start({ open: !process.argv.includes("--no-open") && !process.env.KGR_NO_OPEN }).catch((e) => { console.error("Could not start:", e.message); process.exit(1); });
}
