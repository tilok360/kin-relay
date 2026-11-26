// Kin Relay on Cloudflare Workers (free plan): the same protocol as relay.js, with one Durable Object per mailbox.
// Deploy: see cloudflare/README.md. No Kindroid keys or credits are involved; it only passes table messages along.
const KEEP_MS = 15 * 60000, MAX_BODY = 256 * 1024, MAX_MSGS = 300;
const BOX_RE = /^[0-9a-f]{32}$/, SECRET_RE = /^[0-9a-f]{64}$/;
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json", "access-control-allow-origin": "*", "cache-control": "no-store" } });
async function boxOf(secret) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("kin-relay:" + secret));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}
function codeOk(url, env) {
  const code = env.RELAY_CODE || "";
  return !code || url.searchParams.get("k") === code;
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    // Browsers (the phone and web versions of Kin Relay) ask permission first before posting JSON from another address.
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-methods": "POST, GET, OPTIONS", "access-control-allow-headers": "content-type", "access-control-max-age": "86400" } });
    if (url.pathname === "/health") return json({ ok: true, relay: "kin-relay", protocol: 1, host: "cloudflare", code: !!env.RELAY_CODE });
    if (url.pathname === "/" && req.method === "GET") return new Response(`<!doctype html><meta charset="utf-8"><title>Kin Relay</title><body style="font:16px system-ui;background:#120d1f;color:#f3ecff;display:grid;place-items:center;min-height:100vh;margin:0"><main style="max-width:520px;padding:28px;border-radius:18px;background:#2a1d48"><h1>Kin Relay is running</h1><p>Paste this page's address into Kin Relay → Settings → Relay address, and give it to the friends you play with.</p></main>`, { headers: { "content-type": "text/html; charset=utf-8" } });
    if (!codeOk(url, env)) return json({ ok: false, error: "This relay needs its access code (?k=...)." }, 403);
    const d = /^\/d\/([0-9a-f]{32})$/.exec(url.pathname);
    if (d && req.method === "POST") {
      const len = Number(req.headers.get("content-length") || 0);
      if (len > MAX_BODY) return json({ ok: false, error: "too large" }, 413);
      return env.MAILBOX.get(env.MAILBOX.idFromName(d[1])).fetch(new Request("https://box/deliver", { method: "POST", headers: req.headers, body: req.body }));
    }
    if (url.pathname === "/ws") {
      const box = url.searchParams.get("box") || "";
      if (req.headers.get("upgrade") !== "websocket" || !BOX_RE.test(box)) return json({ ok: false, error: "expected a WebSocket with ?box=" }, 400);
      return env.MAILBOX.get(env.MAILBOX.idFromName(box)).fetch(new Request("https://box/listen?box=" + box, { headers: req.headers }));
    }
    return json({ ok: false, error: "not found" }, 404);
  },
};

export class Mailbox {
  constructor(ctx) { this.ctx = ctx; }
  async queue() { return (await this.ctx.storage.get("q")) || []; }
  live() { return this.ctx.getWebSockets().filter((ws) => (ws.deserializeAttachment() || {}).ready); }
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/deliver") {
      const body = await req.text();
      if (body.length > MAX_BODY) return json({ ok: false, error: "too large" }, 413);
      const msg = { id: crypto.randomUUID().replace(/-/g, "").slice(0, 16), at: Date.now(), ct: (req.headers.get("content-type") || "application/json").slice(0, 100), body };
      const q = (await this.queue()).filter((m) => m.at > Date.now() - KEEP_MS);
      q.push(msg); while (q.length > MAX_MSGS) q.shift();
      await this.ctx.storage.put("q", q);
      if (!(await this.ctx.storage.getAlarm())) await this.ctx.storage.setAlarm(Date.now() + KEEP_MS);
      const live = this.live();
      for (const ws of live) ws.send(JSON.stringify({ t: "msg", id: msg.id, at: msg.at, ct: msg.ct, body: msg.body }));
      return json({ ok: true, online: live.length > 0 }, 202);
    }
    if (url.pathname === "/listen") {
      const pair = new WebSocketPair();
      this.ctx.acceptWebSocket(pair[1]);
      pair[1].serializeAttachment({ ready: false, box: url.searchParams.get("box") });
      return new Response(null, { status: 101, webSocket: pair[0] });
    }
    return json({ ok: false }, 404);
  }
  async webSocketMessage(ws, data) {
    let m; try { m = JSON.parse(typeof data === "string" ? data : new TextDecoder().decode(data)); } catch { return; }
    const att = ws.deserializeAttachment() || {};
    if (m.t === "ping") return ws.send('{"t":"pong"}');
    if (m.t === "listen" && !att.ready) {
      if (!SECRET_RE.test(String(m.secret)) || (await boxOf(m.secret)) !== att.box) { ws.send('{"t":"error","error":"bad secret"}'); return ws.close(1008, "bad secret"); }
      for (const other of this.live()) { try { other.send('{"t":"replaced"}'); other.close(1000, "replaced"); } catch {} }
      ws.serializeAttachment({ ready: true, box: att.box });
      ws.send(JSON.stringify({ t: "ready", box: att.box }));
      for (const msg of await this.queue()) if (msg.at > Date.now() - KEEP_MS) ws.send(JSON.stringify({ t: "msg", id: msg.id, at: msg.at, ct: msg.ct, body: msg.body }));
      return;
    }
    if (m.t === "ack" && att.ready) { const q = (await this.queue()).filter((x) => x.id !== m.id); await this.ctx.storage.put("q", q); }
  }
  async webSocketClose(ws) { try { ws.close(); } catch {} }
  async alarm() {
    const q = (await this.queue()).filter((m) => m.at > Date.now() - KEEP_MS);
    if (q.length) { await this.ctx.storage.put("q", q); await this.ctx.storage.setAlarm(Date.now() + KEEP_MS); }
    else await this.ctx.storage.deleteAll();
  }
}
