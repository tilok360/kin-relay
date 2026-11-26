// One listening connection to a Kin Relay for one mailbox of one game. Messages that arrive are handed to onMessage
// (which stores them in the game's inbox/ folder) and only then acknowledged, so nothing is lost if this PC stops
// halfway. Reconnects by itself, slower each time (1 s up to 30 s).
"use strict";
const A = require("./address");
const crypto = require("crypto");
const boxOf = (secret) => crypto.createHash("sha256").update("kin-relay:" + secret).digest("hex").slice(0, 32);

class RelayLink {
  constructor({ relay, secret, onMessage, onStatus }) {
    this.relay = relay; this.secret = secret; this.onMessage = onMessage; this.onStatus = onStatus || (() => {});
    this.ws = null; this.wait = 1000; this.stopped = false; this.state = "off"; this.box = "";
    this.connect();
  }
  set(state, why) { this.state = state; this.why = why || ""; this.onStatus(state, why); }
  connect() {
    if (this.stopped) return;
    if (typeof WebSocket !== "function") { this.set("error", "This Node.js is too old for relays: install Node.js 22 or newer."); return; }
    let ws;
    try { const u = new URL(A.socketUrl(this.relay)); u.searchParams.set("box", boxOf(this.secret)); ws = new WebSocket(u.toString()); } catch (e) { this.set("error", "Bad relay address: " + e.message); return; }
    this.ws = ws; this.set("connecting");
    let ping = null, alive = Date.now();
    ws.onopen = () => { ws.send(JSON.stringify({ t: "listen", secret: this.secret })); ping = setInterval(() => { if (Date.now() - alive > 70000) { try { ws.close(); } catch {} return; } try { ws.send('{"t":"ping"}'); } catch {} }, 25000); };
    ws.onmessage = async (e) => {
      alive = Date.now();
      let m; try { m = JSON.parse(typeof e.data === "string" ? e.data : Buffer.from(e.data).toString("utf8")); } catch { return; }
      if (m.t === "ready") { this.box = m.box; this.wait = 1000; this.set("online"); return; }
      if (m.t === "replaced") { this.set("error", "Another copy is listening on this mailbox."); return; }
      if (m.t === "error") { this.set("error", m.error); return; }
      if (m.t === "msg") {
        try { await this.onMessage({ body: String(m.body || ""), ct: String(m.ct || "application/json"), at: m.at }); ws.send(JSON.stringify({ t: "ack", id: m.id })); }
        catch (err) { /* not stored: the relay sends it again next time */ }
      }
    };
    ws.onclose = () => {
      clearInterval(ping);
      if (this.ws !== ws) return;
      this.ws = null;
      if (this.stopped) return this.set("off");
      this.set("reconnecting");
      setTimeout(() => this.connect(), this.wait);
      this.wait = Math.min(30000, this.wait * 2);
    };
    ws.onerror = () => {};
  }
  stop() { this.stopped = true; try { this.ws && this.ws.close(); } catch {} this.ws = null; this.set("off"); }
}
module.exports = { RelayLink };
