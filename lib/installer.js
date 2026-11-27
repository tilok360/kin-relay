// Adding a game: the file Kindroid gives you from an app's "Get its code" (a .gz: a gzipped tar of kin.json, main.js,
// screen/ and the rest), or the same thing as .tgz, .tar or .zip. Nothing in it is run while it is added.
//  - Read in memory only, with limits: 25 MB download, 80 MB unpacked, 3,000 files, 15 MB a file.
//  - Only plain files and folders are kept: links, devices and anything else are skipped and listed.
//  - Every path is checked: no absolute paths, no "..", no drive letters, nothing outside the game's own folder.
//  - node_modules and .git are left out; packages are never installed and install scripts never run.
//  - It is written to a staging folder first and moved into games/<name> only when everything is in place.
// analyze() then says plainly what works here, what Kin Relay stands in for, and what can't work outside Kindroid.
"use strict";
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const crypto = require("crypto");

const LIMITS = { download: 25 * 1024 * 1024, unpacked: 80 * 1024 * 1024, files: 3000, file: 15 * 1024 * 1024 };
class InstallError extends Error { constructor(msg) { super(msg); this.install = true; } }

// ---------- reading the archive ----------
function cleanPath(p) {
  let s = String(p || "").replace(/\\/g, "/");
  if (s.includes("\0")) return null;
  while (s.startsWith("./")) s = s.slice(2);
  if (!s || s.startsWith("/") || /^[A-Za-z]:/.test(s)) return null;
  const parts = s.split("/").filter((x) => x !== "" && x !== ".");
  if (!parts.length || parts.some((x) => x === ".." || /[<>:"|?*\u0000-\u001f]/.test(x))) return null;
  return parts.join("/");
}
const octal = (buf, a, n) => { const s = buf.toString("latin1", a, a + n).replace(/\0.*$/s, "").trim(); return s ? parseInt(s, 8) : 0; };
const cstr = (buf, a, n) => { const s = buf.toString("utf8", a, a + n); const i = s.indexOf("\0"); return i >= 0 ? s.slice(0, i) : s; };

function readTar(buf) {
  const files = [], skipped = [];
  let off = 0, longName = null, paxPath = null, total = 0;
  while (off + 512 <= buf.length) {
    const h = buf.subarray(off, off + 512);
    if (h.every((b) => b === 0)) break;
    let sum = 0; for (let i = 0; i < 512; i++) sum += i >= 148 && i < 156 ? 32 : h[i];
    if (sum !== octal(h, 148, 8)) throw new InstallError("This file isn't a readable app download (damaged archive).");
    const size = octal(h, 124, 12), type = String.fromCharCode(h[156] || 48);
    const magic = h.toString("latin1", 257, 262);
    let name = cstr(h, 0, 100);
    if (magic === "ustar") { const pre = cstr(h, 345, 155); if (pre) name = pre + "/" + name; }
    const dataStart = off + 512, dataEnd = dataStart + size;
    if (dataEnd > buf.length) throw new InstallError("This app download is cut short. Try downloading it again.");
    const data = buf.subarray(dataStart, dataEnd);
    off = dataStart + Math.ceil(size / 512) * 512;
    if (type === "L") { longName = cstr(data, 0, data.length); continue; }
    if (type === "x") { const m = /(?:^|\n)\d+ path=([^\n]*)\n/.exec(data.toString("utf8")); paxPath = m ? m[1] : null; continue; }
    if (type === "g") continue;
    if (longName) { name = longName; longName = null; }
    if (paxPath) { name = paxPath; paxPath = null; }
    if (type === "5") continue; // folders are made as needed
    if (type !== "0" && type !== "\0" && type !== "7") { skipped.push(`${name} (not a plain file)`); continue; }
    total += size; push(files, skipped, name, data, total);
  }
  return { files, skipped };
}
function push(files, skipped, name, data, total) {
  const p = cleanPath(name);
  if (!p) { skipped.push(`${name} (unsafe path)`); return; }
  if (/(^|\/)(node_modules|\.git)(\/|$)/.test(p)) { skipped.push(`${p} (left out)`); return; }
  if (data.length > LIMITS.file) throw new InstallError(`${p} is too big (over 15 MB).`);
  if (total > LIMITS.unpacked) throw new InstallError("This app is too big to add (over 80 MB unpacked).");
  if (files.length >= LIMITS.files) throw new InstallError("This app has too many files (over 3,000).");
  files.push({ path: p, data: Buffer.from(data) });
}

function readZip(buf) {
  const files = [], skipped = [];
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new InstallError("This .zip can't be read.");
  const count = buf.readUInt16LE(eocd + 10); let p = buf.readUInt32LE(eocd + 16), total = 0;
  for (let n = 0; n < count; n++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== 0x02014b50) throw new InstallError("This .zip is damaged.");
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20), usize = buf.readUInt32LE(p + 24);
    const nlen = buf.readUInt16LE(p + 28), xlen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32), local = buf.readUInt32LE(p + 42);
    const attrs = buf.readUInt32LE(p + 38) >>> 16, name = buf.toString("utf8", p + 46, p + 46 + nlen);
    p += 46 + nlen + xlen + clen;
    if (name.endsWith("/")) continue;
    if ((attrs & 0o170000) === 0o120000) { skipped.push(`${name} (link)`); continue; }
    if (usize > LIMITS.file) throw new InstallError(`${name} is too big (over 15 MB).`);
    const lp = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const raw = buf.subarray(lp, lp + csize);
    let data;
    if (method === 0) data = raw;
    else if (method === 8) data = zlib.inflateRawSync(raw, { maxOutputLength: LIMITS.file + 1 });
    else { skipped.push(`${name} (packed in a way Kin Relay can't read)`); continue; }
    total += data.length; push(files, skipped, name, data, total);
  }
  return { files, skipped };
}

function unpack(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 4) throw new InstallError("That file is empty.");
  if (buf.length > LIMITS.download) throw new InstallError("That file is too big (over 25 MB).");
  if (buf[0] === 0x1f && buf[1] === 0x8b) {
    try { buf = zlib.gunzipSync(buf, { maxOutputLength: LIMITS.unpacked + 1024 * 1024 }); }
    catch (e) { throw new InstallError(/maxOutputLength|buffer/i.test(String(e.message)) ? "This app is too big to add (over 80 MB unpacked)." : "This .gz file can't be unpacked. Try downloading it again."); }
  }
  if (buf.readUInt32LE(0) === 0x04034b50) return readZip(buf);
  if (buf.length >= 512 && (buf.toString("latin1", 257, 262) === "ustar" || /^[0-7 \0]{7}/.test(buf.toString("latin1", 148, 156)))) return readTar(buf);
  throw new InstallError("That isn't a Kindroid app download. Use the .gz file from the app's \"Get its code\".");
}

// ---------- what an app needs, in plain words ----------
const SCREEN_MSGS = new Set(["files.read", "files.write", "action", "kins", "ask", "open", "save"]);
function analyze(manifest, readFile) {
  const m = manifest || {}, works = [], shim = [], warnings = [];
  const grants = (m.grants || []).map(String), triggers = m.triggers || [];
  const screen = (m.screens || [])[0], entry = m.run && m.run.entry ? String(m.run.entry) : "";
  const text = (p) => { try { return readFile(p) || ""; } catch { return ""; } };
  if (screen && screen.entry) {
    if (text(String(screen.entry))) works.push("Its screen opens here in your browser.");
    else warnings.push(`Its screen file (${screen.entry}) is missing.`);
  } else warnings.push("It has no screen, so there is nothing to open here; a Kin uses it in Kindroid chat.");
  if (entry) {
    if (/^node\s/.test(entry)) works.push("Its runs happen on this PC for free (no Kindroid Apps credits).");
    else warnings.push(`Its runs use "${entry}". Kin Relay runs only Node.js entries, so its actions won't work here.`);
  }
  let code = "";
  if (/^node\s/.test(entry)) { const f = entry.split(/\s+/)[1]; code = text(f); }
  const screenCode = screen ? text(String(screen.entry)) : "";
  shim.push("Saving and loading (files) are kept on this PC.");
  if (grants.includes("kin:read") || /["']ask["']/.test(code) || /kin\s*:\s*["']ask["']/.test(screenCode)) shim.push("Your Kin is asked through Kindroid's API with your own key (normal Kin messages, not Apps credits).");
  if (triggers.some((t) => t && t.on === "inbound")) shim.push("Tables with other people go through the relay instead of Kindroid's inbound addresses.");
  if (/["']tell["']/.test(code)) shim.push("What it tells your Kin to remember is kept on this PC and put in front of that Kin's next questions from this app (it isn't added to the Kin's own memory in Kindroid).");
  const nope = { "kin:voice": "your Kin's voice", "kin:picture": "pictures and video selfies of your Kin", "kin:message": "messages from your Kin into your Kindroid chat" };
  for (const g of grants) {
    if (nope[g]) warnings.push(`It uses ${nope[g]}, which only works inside Kindroid.`);
    else if (g.startsWith("secret:")) shim.push(`It needs a sign-in for ${g.replace(/^secret:[^@]*@/, "")}: paste it in Settings > App sign-ins (kept only on this device, sent only to that site).`);
    else if (g.startsWith("chat:read")) shim.push("Your Kin won't see your recent chat when asked here.");
    else if (g.startsWith("net:") && !/kinusercontent\.com/.test(g)) works.push(`It may reach ${g.slice(4)} from this PC.`);
    else if (g === "always") shim.push("It stays running (connected) for as long as Kin Relay is open.");
  }
  for (const c of ["say", "picture", "video", "media", "secret", "tcp", "message", "chat"]) if (new RegExp(`\\[\\s*["']${c}["']`).test(code)) warnings.push(`Its code uses "kin ${c}", which only works inside Kindroid; that part will say it isn't available.`);
  if (triggers.some((t) => t && t.on === "schedule")) shim.push("Its scheduled runs happen while Kin Relay is open, and it catches up the first time you open it after being away.");
  const used = new Set([...screenCode.matchAll(/kin\s*:\s*["']([a-z.]+)["']/g)].map((x) => x[1]));
  for (const k of used) if (!SCREEN_MSGS.has(k) && !["moves", "shots", "cheer"].includes(k)) warnings.push(`Its screen asks Kindroid for "${k}", which Kin Relay doesn't know; that part may do nothing.`);
  const pkg = text("package.json");
  if (pkg) { try { const j = JSON.parse(pkg); if (Object.keys(j.dependencies || {}).length) warnings.push("It needs npm packages. Kin Relay never installs packages, so its runs may fail."); } catch {} }
  if (text("requirements.txt")) warnings.push("It needs Python packages, which Kin Relay doesn't install.");
  const level = warnings.some((w) => /no screen|won't work|missing/.test(w)) ? "limited" : warnings.length ? "mostly" : "full";
  return { works, shim, warnings, level, tables: triggers.some((t) => t && t.on === "inbound") };
}

function slugOf(name) {
  return String(name || "game").toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").replace(/[\s_]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "game";
}

// Add (or with replace, update) a game in gamesDir. Returns {slug, name, purpose, report, skipped, files, bytes}.
function install(buf, gamesDir, opts = {}) {
  let { files, skipped } = unpack(buf);
  // A download wrapped in one folder (my-app/kin.json …) is unwrapped.
  if (!files.some((f) => f.path === "kin.json")) {
    const tops = new Set(files.map((f) => f.path.split("/")[0]));
    if (tops.size === 1 && files.some((f) => f.path.split("/").length === 2 && f.path.endsWith("/kin.json"))) {
      const top = [...tops][0] + "/"; files = files.map((f) => ({ path: f.path.slice(top.length), data: f.data })).filter((f) => f.path);
    }
  }
  const mf = files.find((f) => f.path === "kin.json");
  if (!mf) throw new InstallError("There's no kin.json in it, so it isn't a Kindroid app's code.");
  let manifest; try { manifest = JSON.parse(mf.data.toString("utf8")); } catch { throw new InstallError("Its kin.json can't be read."); }
  if (!manifest || typeof manifest !== "object" || !manifest.name) throw new InstallError("Its kin.json has no app name.");
  const slug = opts.slug || slugOf(manifest.name);
  const dest = path.join(gamesDir, slug);
  if (fs.existsSync(dest) && !opts.replace) return { conflict: true, slug, name: String(manifest.name).slice(0, 60) };
  const map = new Map(files.map((f) => [f.path, f.data]));
  const report = analyze(manifest, (p) => { const d = map.get(cleanPath(p)); return d ? d.toString("utf8") : ""; });
  // Write everything to staging, then swap it in.
  fs.mkdirSync(gamesDir, { recursive: true });
  const stage = path.join(gamesDir, `.adding-${crypto.randomBytes(4).toString("hex")}`);
  const root = path.resolve(stage);
  try {
    for (const f of files) {
      const full = path.resolve(stage, f.path);
      if (!full.startsWith(root + path.sep)) throw new InstallError("Unsafe file path in the download.");
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, f.data, { mode: 0o644 });
    }
    fs.writeFileSync(path.join(stage, "kinrelay-added.json"), JSON.stringify({ added: new Date().toISOString(), from: String(opts.fileName || "").slice(0, 120), files: files.length, skipped }, null, 1));
    if (fs.existsSync(dest)) { const old = dest + `.old-${Date.now()}`; fs.renameSync(dest, old); fs.rmSync(old, { recursive: true, force: true }); }
    fs.renameSync(stage, dest);
  } catch (e) { fs.rmSync(stage, { recursive: true, force: true }); throw e; }
  return { slug, name: String(manifest.name).slice(0, 60), purpose: String(manifest.purpose || "").slice(0, 300), report, skipped, files: files.length, bytes: files.reduce((n, f) => n + f.data.length, 0) };
}

module.exports = { install, analyze, unpack, cleanPath, slugOf, InstallError, LIMITS };
