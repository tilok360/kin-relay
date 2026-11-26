#!/usr/bin/env node
// Kin Relay: a tiny, free mailbox relay for Kin Relay game tables.
//
// What it does: every copy of a game at a table has a private mailbox here. The host's copy posts table updates to
// each player's mailbox, and each player's copy posts its moves to the host's mailbox. The relay only passes those
// messages along (and holds them for a short while if a player's PC is asleep or reconnecting). It never deals a card,
// never rolls a die and never talks to Kindroid: the host's own copy of the game runs the table, and every player's Kin
// is asked on that player's own PC with that player's own key. No Kindroid credits are used here, and no keys pass
// through it.
//
// Protocol (version 1), the same on the Cloudflare version in cloudflare/worker.js:
//   POST /d/<box>            deliver one message (any text, at most 256 KB) to mailbox <box> (32 hex characters).
//                            Answer: 202 {"ok":true,"online":true|false}. 413 too large, 429 slow down, 400 bad box.
//   GET  /ws?box=<box> (WebSocket)  listen to one mailbox. First message: {"t":"listen","secret":"<64 hex>"}.
//                            The mailbox is the first 32 hex characters of sha256("kin-relay:" + secret), so only the
//                            copy that made the secret can listen, while the mailbox name itself can be shared freely.
//                            Answer {"t":"ready","box":"..."}, then {"t":"msg","id","at","ct","body"} for each message.
//                            Send {"t":"ack","id"} once a message is safely stored; unacknowledged messages are sent
//                            again on the next connection. {"t":"ping"} is answered {"t":"pong"}.
//   GET  /health             {"ok":true,...} counts only, never message contents.
//   GET  /                   a small "the relay is running" page.
// If RELAY_CODE is set, every request must carry ?k=<that code> (so only people you gave the address to can use it).
//
// No packages to install: plain Node.js 18 or newer.
"use strict";
const http = require("http");
const crypto = require("crypto");
const os = require("os");

const VERSION = "1.0.0";
const PORT = Number(process.env.PORT) || 8787;
const HOST = process.env.HOST || "0.0.0.0";
const CODE = String(process.env.RELAY_CODE || "");
const QUIET = process.env.RELAY_QUIET === "1";

const MAX_BODY = 256 * 1024;          // one delivery
const KEEP_MS = 15 * 60000;           // how long an undelivered message waits for its player
const BOX_MAX_MSGS = 300, BOX_MAX_BYTES = 4 * 1024 * 1024;
const MAX_BOXES = 5000;               // mailboxes held at once
const IP_PER_MIN = 900, BOX_PER_MIN = 600, MAX_SOCKS_PER_IP = 40;
const PING_MS = 25000, DEAD_MS = 70000;

const log = (...a) => { if (!QUIET) console.log(new Date().toISOString().slice(11, 19), ...a); };
const BOX_RE = /^[0-9a-f]{32}$/, SECRET_RE = /^[0-9a-f]{64}$/;
const boxOf = (secret) => crypto.createHash("sha256").update("kin-relay:" + secret).digest("hex").slice(0, 32);

// ---------- mailboxes ----------
const boxes = new Map(); // box -> { q: [{id, at, ct, body, size}], bytes, sock, last }
let delivered = 0;
function box(id, make) {
  let b = boxes.get(id);
  if (!b && make) { if (boxes.size >= MAX_BOXES) sweep(true); if (boxes.size >= MAX_BOXES) return null; b = { q: [], bytes: 0, sock: null, last: Date.now() }; boxes.set(id, b); }
  return b || null;
}
function sweep(hard) {
  const cut = Date.now() - KEEP_MS;
  for (const [id, b] of boxes) {
    while (b.q.length && b.q[0].at < cut) b.bytes -= b.q.shift().size;
    if (!b.sock && !b.q.length && (hard || b.last < cut)) boxes.delete(id);
  }
}
setInterval(sweep, 60000).unref();

// ---------- simple rate limits (token buckets per minute) ----------
const buckets = new Map();
function allow(key, perMin) {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b) { b = { n: perMin, at: now }; buckets.set(key, b); }
  b.n = Math.min(perMin, b.n + ((now - b.at) / 60000) * perMin); b.at = now;
  if (b.n < 1) return false;
  b.n -= 1; return true;
}
setInterval(() => { const cut = Date.now() - 120000; for (const [k, b] of buckets) if (b.at < cut) buckets.delete(k); }, 60000).unref();

const ipOf = (req) => String((process.env.TRUST_PROXY === "1" && String(req.headers["x-forwarded-for"] || "").split(",")[0].trim()) || req.socket.remoteAddress || "?");
function codeOk(url) {
  if (!CODE) return true;
  const k = Buffer.from(String(url.searchParams.get("k") || "")), c = Buffer.from(CODE);
  return k.length === c.length && crypto.timingSafeEqual(k, c);
}
function send(res, status, obj, type) {
  const body = typeof obj === "string" ? obj : JSON.stringify(obj);
  res.writeHead(status, { "content-type": type || "application/json; charset=utf-8", "cache-control": "no-store", "access-control-allow-origin": "*" });
  res.end(body);
}

// ---------- HTTP ----------
const server = http.createServer((req, res) => {
  let url; try { url = new URL(req.url, "http://relay"); } catch { return send(res, 400, { ok: false, error: "bad address" }); }
  if (req.method === "OPTIONS") { res.writeHead(204, { "access-control-allow-origin": "*", "access-control-allow-methods": "POST, GET", "access-control-allow-headers": "content-type" }); return res.end(); }
  if (req.method === "GET" && url.pathname === "/health") return send(res, 200, { ok: true, relay: "kin-relay", v: VERSION, protocol: 1, boxes: boxes.size, listening: [...boxes.values()].filter((b) => b.sock).length, delivered, code: !!CODE });
  if (req.method === "GET" && url.pathname === "/") return send(res, 200, page(), "text/html; charset=utf-8");
  if (!codeOk(url)) return send(res, 403, { ok: false, error: "This relay needs its access code in the address (?k=...)." });
  const m = /^\/d\/([0-9a-f]{32})$/.exec(url.pathname);
  if (req.method === "POST" && m) return deliver(req, res, m[1]);
  send(res, 404, { ok: false, error: "not found" });
});

function deliver(req, res, id) {
  const ip = ipOf(req);
  if (!allow("ip:" + ip, IP_PER_MIN) || !allow("box:" + id, BOX_PER_MIN)) return send(res, 429, { ok: false, error: "slow down" });
  const chunks = []; let size = 0, done = false;
  req.on("data", (c) => { size += c.length; if (size > MAX_BODY) { if (!done) { done = true; send(res, 413, { ok: false, error: "too large (256 KB at most)" }); req.destroy(); } return; } chunks.push(c); });
  req.on("end", () => {
    if (done) return; done = true;
    const b = box(id, true);
    if (!b) return send(res, 503, { ok: false, error: "relay is full, try again soon" });
    const msg = { id: crypto.randomBytes(8).toString("hex"), at: Date.now(), ct: String(req.headers["content-type"] || "application/json").slice(0, 100), body: Buffer.concat(chunks).toString("utf8"), size };
    while (b.q.length && (b.q.length >= BOX_MAX_MSGS || b.bytes + size > BOX_MAX_BYTES)) b.bytes -= b.q.shift().size;
    b.q.push(msg); b.bytes += size; b.last = Date.now(); delivered++;
    if (b.sock) b.sock.text(JSON.stringify({ t: "msg", id: msg.id, at: msg.at, ct: msg.ct, body: msg.body }));
    send(res, 202, { ok: true, online: !!b.sock });
  });
  req.on("error", () => { done = true; });
}

function page() {
  const n = [...boxes.values()].filter((b) => b.sock).length;
  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kin Relay</title>
<style>body{font:16px/1.5 system-ui,sans-serif;background:#120d1f;color:#f3ecff;display:grid;place-items:center;min-height:100vh;margin:0}
main{max-width:520px;padding:28px;border-radius:18px;background:linear-gradient(160deg,#2a1d48,#17112a);box-shadow:0 20px 60px #0008}
h1{margin:0 0 6px;font-size:26px}b{color:#ffd36b}small{color:#b9a9d9}</style>
<main><h1>Kin Relay is running</h1><p>Copies of games connected right now: <b>${n}</b>.</p>
<p>Paste this page's address (from your browser's address bar${CODE ? ", including the ?k=… part" : ""}) into <b>Kin Relay → Settings → Relay</b>, and give the same address to the friends you play with.</p>
<small>The relay only passes table messages between game copies. It never sees anyone's Kindroid key and uses no Kindroid credits. Version ${VERSION}.</small></main>`;
}

// ---------- WebSocket (RFC 6455, just what the relay needs; no packages) ----------
const MAX_FRAME = MAX_BODY + 4096;
const socksPerIp = new Map();
server.on("upgrade", (req, socket) => {
  let url; try { url = new URL(req.url, "http://relay"); } catch { return socket.destroy(); }
  const key = req.headers["sec-websocket-key"];
  const ip = ipOf(req);
  if (url.pathname !== "/ws" || !key || String(req.headers.upgrade || "").toLowerCase() !== "websocket") { socket.end("HTTP/1.1 400 Bad Request\r\n\r\n"); return; }
  if (!codeOk(url)) { socket.end("HTTP/1.1 403 Forbidden\r\n\r\n"); return; }
  if ((socksPerIp.get(ip) || 0) >= MAX_SOCKS_PER_IP) { socket.end("HTTP/1.1 429 Too Many Requests\r\n\r\n"); return; }
  const accept = crypto.createHash("sha1").update(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").digest("base64");
  socket.write("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: " + accept + "\r\n\r\n");
  socket.setNoDelay(true);
  socksPerIp.set(ip, (socksPerIp.get(ip) || 0) + 1);
  const ws = wrap(socket);
  let mine = null;
  ws.onText = (txt) => {
    let m; try { m = JSON.parse(txt); } catch { return; }
    if (!m || typeof m !== "object") return;
    if (m.t === "ping") return ws.text('{"t":"pong"}');
    if (m.t === "listen" && !mine) {
      if (!SECRET_RE.test(String(m.secret))) { ws.text('{"t":"error","error":"bad secret"}'); return ws.close(); }
      const id = boxOf(String(m.secret)), want = url.searchParams.get("box");
      if (want && want !== id) { ws.text('{"t":"error","error":"secret does not match box"}'); return ws.close(); }
      const b = box(id, true);
      if (!b) { ws.text('{"t":"error","error":"relay is full"}'); return ws.close(); }
      if (b.sock && b.sock !== ws) { try { b.sock.text('{"t":"replaced"}'); b.sock.close(); } catch {} } // the same copy reconnected
      b.sock = ws; b.last = Date.now(); mine = id;
      ws.text(JSON.stringify({ t: "ready", box: id, v: VERSION }));
      for (const msg of b.q) ws.text(JSON.stringify({ t: "msg", id: msg.id, at: msg.at, ct: msg.ct, body: msg.body }));
      log("listen", id.slice(0, 6) + "…", "queued", b.q.length);
      return;
    }
    if (m.t === "ack" && mine) {
      const b = boxes.get(mine); if (!b) return;
      const i = b.q.findIndex((x) => x.id === m.id);
      if (i >= 0) { b.bytes -= b.q[i].size; b.q.splice(i, 1); }
    }
  };
  ws.onClose = () => {
    socksPerIp.set(ip, Math.max(0, (socksPerIp.get(ip) || 1) - 1));
    if (mine) { const b = boxes.get(mine); if (b && b.sock === ws) { b.sock = null; b.last = Date.now(); } }
  };
});

function wrap(socket) {
  let buf = Buffer.alloc(0), frags = [], closed = false, lastSeen = Date.now();
  const ws = { onText: null, onClose: null };
  const frame = (op, payload) => {
    const len = payload.length;
    const head = len < 126 ? Buffer.from([0x80 | op, len]) : len < 65536 ? Buffer.from([0x80 | op, 126, len >> 8, len & 255]) : (() => { const h = Buffer.alloc(10); h[0] = 0x80 | op; h[1] = 127; h.writeBigUInt64BE(BigInt(len), 2); return h; })();
    if (!closed) socket.write(Buffer.concat([head, payload]));
  };
  ws.text = (s) => frame(1, Buffer.from(String(s), "utf8"));
  ws.close = () => { if (closed) return; try { frame(8, Buffer.alloc(0)); } catch {} closed = true; socket.end(); };
  const ping = setInterval(() => { if (Date.now() - lastSeen > DEAD_MS) { socket.destroy(); return; } frame(9, Buffer.alloc(0)); }, PING_MS);
  socket.on("data", (chunk) => {
    lastSeen = Date.now();
    buf = Buffer.concat([buf, chunk]);
    while (buf.length >= 2) {
      const fin = (buf[0] & 0x80) !== 0, op = buf[0] & 0x0f, masked = (buf[1] & 0x80) !== 0;
      let len = buf[1] & 0x7f, off = 2;
      if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (buf.length < 10) return; const big = buf.readBigUInt64BE(2); if (big > BigInt(MAX_FRAME)) { socket.destroy(); return; } len = Number(big); off = 10; }
      if (len > MAX_FRAME || !masked) { socket.destroy(); return; } // clients must mask (RFC 6455)
      if (buf.length < off + 4 + len) return;
      const mask = buf.subarray(off, off + 4), data = Buffer.from(buf.subarray(off + 4, off + 4 + len));
      for (let i = 0; i < data.length; i++) data[i] ^= mask[i & 3];
      buf = buf.subarray(off + 4 + len);
      if (op === 8) { ws.close(); return; }
      if (op === 9) { frame(10, data); continue; }
      if (op === 10) continue;
      if (op === 1 || op === 2 || op === 0) {
        frags.push(data);
        if (frags.reduce((n, x) => n + x.length, 0) > MAX_FRAME) { socket.destroy(); return; }
        if (fin) { const all = Buffer.concat(frags); frags = []; try { ws.onText && ws.onText(all.toString("utf8")); } catch {} }
      }
    }
  });
  const end = () => { if (ws._ended) return; ws._ended = true; closed = true; clearInterval(ping); try { ws.onClose && ws.onClose(); } catch {} };
  socket.on("close", end); socket.on("error", end); socket.on("end", end);
  return ws;
}

// ---------- start ----------
function lanAddresses() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) for (const a of list || []) if (a.family === "IPv4" && !a.internal) out.push(a.address);
  return out;
}
if (require.main === module) {
  server.listen(PORT, HOST, () => {
    const q = CODE ? "?k=" + encodeURIComponent(CODE) : "";
    console.log(`Kin Relay ${VERSION} is running on port ${PORT}.`);
    console.log(`  On this PC:            http://localhost:${PORT}/${q}`);
    for (const ip of lanAddresses()) console.log(`  For your home network: http://${ip}:${PORT}/${q}`);
    console.log("  For friends elsewhere, see README (port forwarding, a free tunnel, or a free host).");
    console.log("Leave this window open while people play. Close it to stop the relay.");
  });
}
module.exports = { server, boxOf, lanAddresses, VERSION };
