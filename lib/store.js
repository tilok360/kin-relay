// Where Kin Relay keeps your own things on this PC. Your key, your characters and your saves never live in the
// program's folder, so that folder can be zipped and shared with friends safely:
//   Windows: %APPDATA%\KinRelay\      Mac/Linux: ~/.kin-relay/      (KGR_DATA overrides, for tests)
//   settings.json   your characters (name, AI ID, notes), relay address, which Kins play which game
//   key.json        your Kindroid API key. In the Windows app it is encrypted with Windows (DPAPI, through Electron's
//                   safeStorage), so only your Windows account can read it. Run from the zip, it is a file only you can read.
//   avatars/        your characters' pictures
//   games/          games you added (Windows app; the zip keeps them in its own games/ folder)
//   apps/<slug>/    each game's own files (what the game saves with files.write / kin files put)
"use strict";
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

const ROOT = process.env.KGR_DATA || (process.platform === "win32" && process.env.APPDATA ? path.join(process.env.APPDATA, "KinRelay") : path.join(os.homedir(), ".kin-relay"));
fs.mkdirSync(ROOT, { recursive: true });

const file = (name) => path.join(ROOT, name);
function readJSON(p, d) { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return d; } }
function writeJSON(p, obj, secret) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const tmp = p + "." + process.pid + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), secret ? { mode: 0o600 } : undefined);
  fs.renameSync(tmp, p);
}

// A Kin's id inside games is a short stand-in made from its AI ID, so the real AI ID never reaches a game,
// a save file or another player.
const kinAlias = (aiId) => "k" + crypto.createHash("sha256").update("kgr:" + aiId).digest("hex").slice(0, 15);

// ---------- AI IDs (same cleaning as Kin Studio) ----------
const INVISIBLE = /[\u0000-\u001F\u007F-\u009F\u00A0\u00AD\u034F\u061C\u115F\u1160\u17B4\u17B5\u180E\u2000-\u200F\u2028-\u202F\u205F-\u206F\u3000\u3164\uFE00-\uFE0F\uFEFF\uFFA0]/g;
function cleanAiId(raw) {
  let s = String(raw == null ? "" : raw).replace(INVISIBLE, "").trim();
  s = s.replace(/^["'`\u2018\u2019\u201C\u201D]+|["'`\u2018\u2019\u201C\u201D.,;]+$/g, "").trim();
  const url = s.match(/\/(?:chat\/group|group|chat|kin|ai)\/([A-Za-z0-9_-]{6,64})/i);
  if (url) return url[1];
  return s.replace(/^(?:kin\s*id|ai\s*id|ai_id|id)\s*[:=#-]?\s*/i, "").replace(/\s+/g, "");
}
function aiIdProblem(id) {
  id = String(id || "");
  if (!id) return "Add the Kin's AI ID. It's at the bottom of the Kin's settings in Kindroid.";
  if (/^kn_/i.test(id)) return "That is your API key, not an AI ID. Put the key in Settings. The AI ID is at the bottom of the Kin's settings.";
  if (/^[A-Za-z0-9]{5}$/.test(id)) return "That looks like a 5-letter share code. Kindroid's API needs the AI ID from the bottom of the Kin's settings.";
  if (!/^[A-Za-z0-9_-]{6,64}$/.test(id)) return "An AI ID is 6 to 64 letters, numbers, - or _. Copy it again from the bottom of the Kin's settings.";
  return "";
}

// ---------- settings and characters ----------
const CHARIO = require("../public/chario.js");
const DEFAULTS = { name: "", kins: [], currentKin: "", games: {}, relay: "", ownRelay: false, ownRelayPort: 8787, askStyle: "chat", welcomeDone: false };
const cleanKin = (k) => ({
  cid: /^[a-z0-9]{6,20}$/.test(k.cid || "") ? k.cid : "c" + crypto.randomBytes(5).toString("hex"),
  name: String(k.name || "My Kin").trim().slice(0, 40) || "My Kin",
  ai_id: cleanAiId(k.ai_id).slice(0, 64),
  share_code: String(k.share_code || "").trim().slice(0, 12),
  notes: String(k.notes || "").slice(0, 1000),
  details: CHARIO.cleanDetails(k.details), // profile text kept for reference (backstory, memories ...), never sent anywhere
  avatar: !!k.avatar,
});
function settings() {
  const raw = readJSON(file("settings.json"), {});
  const s = Object.assign({}, DEFAULTS, raw);
  let migrated = false;
  s.kins = (Array.isArray(s.kins) ? s.kins : []).filter((k) => k && k.ai_id).map((k) => { if (!k.cid) migrated = true; return Object.assign(cleanKin(k), { id: kinAlias(cleanAiId(k.ai_id)) }); });
  if (!s.games || typeof s.games !== "object") s.games = {};
  if (migrated) saveSettings(s); // give older characters a lasting id (for their picture)
  return s;
}
const stored = (s) => Object.assign({}, s, { kins: s.kins.map((k) => { const c = cleanKin(k); return c; }) });
function saveSettings(s) { writeJSON(file("settings.json"), stored(s)); }

// Which Kins a game gets, and which one is "your Kin" there. Every game gets all your characters unless you chose.
function gameKins(s, slug) {
  const g = (s.games && s.games[slug]) || {};
  const ids = new Set(s.kins.map((k) => k.id));
  let list = Array.isArray(g.kins) ? g.kins.filter((id) => ids.has(id)) : null;
  if (!list || !list.length) list = s.kins.map((k) => k.id);
  const current = list.includes(g.current) ? g.current : list.includes(s.currentKin) ? s.currentKin : list[0] || "";
  return { kins: list.map((id) => s.kins.find((k) => k.id === id)), current, chosen: !!(g.kins && g.kins.length) };
}

// ---------- avatars ----------
const avatarFile = (cid) => /^[a-z0-9]{6,20}$/.test(cid || "") ? path.join(ROOT, "avatars", cid + ".img") : null;

// ---------- the API key ----------
// The Windows app hands Kin Relay Windows' own encryption (DPAPI via Electron safeStorage). Without it (the zip, run
// with Node), the key is kept in a file only your account can read.
let vault = null; // { encrypt(string) -> Buffer, decrypt(Buffer) -> string, kind }
function useVault(v) { vault = v && typeof v.encrypt === "function" ? v : null; if (vault) { const k = apiKey(); if (k) setApiKey(k); } }
function apiKey() {
  const j = readJSON(file("key.json"), {});
  if (j.enc && j.data) { try { return vault ? vault.decrypt(Buffer.from(j.data, "base64")) : ""; } catch { return ""; } }
  return typeof j.apiKey === "string" ? j.apiKey : "";
}
function keyProtection() { const j = readJSON(file("key.json"), {}); return j.enc ? "encrypted" : j.apiKey ? "file" : "none"; }
function setApiKey(k) {
  if (!k) { try { fs.unlinkSync(file("key.json")); } catch {} return; }
  if (vault) writeJSON(file("key.json"), { enc: vault.kind || "os", data: vault.encrypt(k).toString("base64") }, true);
  else writeJSON(file("key.json"), { apiKey: k }, true);
}

const appDir = (slug) => path.join(ROOT, "apps", slug);
const filesDir = (slug) => path.join(appDir(slug), "files");

// A game's file path, kept inside its own folder.
function safeFile(slug, p) {
  const rel = String(p || "").replace(/\\/g, "/").replace(/^\/+/, "");
  if (!rel || rel.split("/").some((x) => x === ".." || x === "") || rel.length > 300) return null;
  const base = filesDir(slug), full = path.resolve(base, rel);
  return full.startsWith(path.resolve(base) + path.sep) ? full : null;
}

module.exports = { ROOT, file, readJSON, writeJSON, settings, saveSettings, gameKins, cleanKin, cleanAiId, aiIdProblem, avatarFile, useVault, apiKey, keyProtection, setApiKey, appDir, filesDir, safeFile, kinAlias };
