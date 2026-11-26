// Talking to a Kin through Kindroid's public API (https://api.kindroid.ai/v1), with the person's own kn_ key.
// Two ways, picked per Kin in Settings:
//   "chat"  (default) POST /send-message {ai_id, message}: the question and the Kin's answer appear in your normal
//           chat with that Kin, and the Kin remembers the game.
//   "quiet" (needs the Kin's share code) POST /discord-bot: the endpoint Kindroid's Discord bot uses. The game's
//           question does not land in your one-to-one chat. Needs an active subscription.
// Every request shares one limiter: Kindroid allows 10 requests per 30 seconds per account.
// The key is never logged, returned or put in an error message.
"use strict";
const API = process.env.KGR_API_BASE || "https://api.kindroid.ai/v1";
const TIMEOUT_MS = 75000;
const KEY_RE = /kn_[A-Za-z0-9_-]{4,}/g;
const redact = (s) => String(s == null ? "" : s).replace(KEY_RE, "kn_[hidden]").replace(/Bearer\s+\S+/gi, "Bearer [hidden]");

class RateGate {
  constructor(max = 9, windowMs = 30000) { this.max = max; this.windowMs = windowMs; this.sent = []; this.blockedUntil = 0; }
  waitMs() {
    const now = Date.now();
    this.sent = this.sent.filter((t) => now - t < this.windowMs);
    const slot = this.sent.length < this.max ? 0 : this.windowMs - (now - this.sent[0]) + 50;
    return Math.max(0, this.blockedUntil - now, slot);
  }
  async acquire() { for (;;) { const ms = this.waitMs(); if (ms <= 0) { this.sent.push(Date.now()); return; } await new Promise((r) => setTimeout(r, Math.min(ms, 1000))); } }
  penalize(ms = 30000) { this.blockedUntil = Math.max(this.blockedUntil, Date.now() + ms); }
}
const gate = new RateGate();

class KinError extends Error { constructor(kind, msg, status) { super(redact(msg)); this.kind = kind; this.status = status || 0; } }

function explain(status, body) {
  const b = redact(String(body || "").slice(0, 200));
  if (status === 401) return new KinError("auth", "Kindroid did not accept the API key. Paste it again in Kin Relay Settings.", 401);
  if (status === 403) return new KinError("forbidden", "Kindroid refused (403). The API needs an active subscription or trial. " + b, 403);
  if (status === 404) return new KinError("not_found", "Kindroid could not find that Kin. Check its AI ID (or share code) in Settings.", 404);
  if (status === 429) return new KinError("rate_limit", "Kindroid is rate limiting (10 requests every 30 seconds). Waiting a moment.", 429);
  return new KinError("error", `Kindroid answered ${status}. ${b}`, status);
}

async function post(path, apiKey, body, extraHeaders) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(API + path, {
      method: "POST", signal: ctrl.signal,
      headers: Object.assign({ Authorization: "Bearer " + apiKey, "Content-Type": "application/json", Accept: "text/plain, application/json" }, extraHeaders || {}),
      body: JSON.stringify(body),
    });
    const text = await r.text();
    return { status: r.status, text };
  } catch (e) {
    if (e && e.name === "AbortError") throw new KinError("timeout", "Kindroid took longer than 75 seconds.");
    throw new KinError("offline", "Could not reach Kindroid: " + (e && e.message));
  } finally { clearTimeout(t); }
}

// Ask one Kin one question. kin = {ai_id, share_code, name}; style "chat" or "quiet".
async function ask({ apiKey, kin, question, style, playerName }) {
  if (!apiKey || !/^kn_[A-Za-z0-9_-]{8,}$/.test(apiKey)) throw new KinError("auth", "Add your Kindroid API key in Kin Relay Settings first.");
  if (!kin || !kin.ai_id) throw new KinError("no_kin", "Add a Kin (its AI ID) in Kin Relay Settings first.");
  const quiet = style === "quiet" && /^[A-Za-z0-9]{4,12}$/.test(kin.share_code || "");
  const message = "[Kin Relay: a game you are playing with me asks. Answer just as it asks.]\n" + String(question || "").slice(0, 7900);
  for (let attempt = 0; attempt < 2; attempt++) {
    await gate.acquire();
    let r;
    if (quiet) {
      const who = String(playerName || "Player").slice(0, 40);
      const requester = Buffer.from(encodeURIComponent("kin-relay:" + who)).toString("base64").replace(/[^a-zA-Z0-9]/g, "").slice(0, 32);
      r = await post("/discord-bot", apiKey, { share_code: kin.share_code, enable_filter: false, conversation: [{ username: who, text: message, timestamp: new Date().toISOString() }] }, { "X-Kindroid-Requester": requester });
    } else {
      r = await post("/send-message", apiKey, { ai_id: kin.ai_id, message, stream: false });
    }
    if (r.status === 429 && attempt === 0) { gate.penalize(); continue; }
    if (r.status < 200 || r.status >= 300) { if (r.status === 429) gate.penalize(); throw explain(r.status, r.text); }
    let text = r.text;
    if (quiet) { try { const j = JSON.parse(text); text = j.reply || ""; } catch {} }
    text = String(text || "");
    if (text.includes("<<HTTP_ERROR>>")) throw new KinError("error", "Kindroid stopped partway: " + text.split("<<HTTP_ERROR>>")[1].slice(0, 160));
    if (/^\s*< >/.test(text)) throw new KinError("generation", "The Kin could not answer just now (Kindroid said the reply failed).");
    return text.trim();
  }
  throw new KinError("rate_limit", "Kindroid is still rate limiting. Try again in 30 seconds.");
}

// Check a key without sending anything to a real Kin: a made-up AI ID answers 404 (or 400) when the key works and 401
// when it does not. This is the same trick Kin Studio uses.
async function checkKey(apiKey) {
  if (!/^kn_[A-Za-z0-9_-]{8,}$/.test(String(apiKey || ""))) return { ok: false, refused: true, message: "That doesn't look like a Kindroid API key. It starts with kn_." };
  await gate.acquire();
  try {
    const r = await post("/send-message", apiKey, { ai_id: "kin-relay-key-check-" + Date.now().toString(36), message: "", stream: false });
    if (r.status === 401) return { ok: false, refused: true, message: "Kindroid did not accept that key. Check that you copied all of it." };
    if (r.status === 403) return { ok: false, message: "The key works, but Kindroid says the account can't use the API right now (403: subscription or trial needed)." };
    if (r.status === 429) { gate.penalize(); return { ok: true, message: "Kindroid is rate limiting right now; the key looks fine. Try a game in 30 seconds." }; }
    if (r.status >= 500) return { ok: false, message: `Kindroid's server had a problem (${r.status}), so the key couldn't be checked. Try again in a minute.` };
    return { ok: true, message: "Your key works. Kindroid accepted it." };
  } catch (e) { return { ok: false, message: "Couldn't reach Kindroid to check the key. Is this PC online? (" + redact(String(e.message || e)).slice(0, 120) + ")" }; }
}

module.exports = { ask, checkKey, redact, RateGate, KinError };
