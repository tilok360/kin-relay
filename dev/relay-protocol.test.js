// Checks a relay (Node relay.js or the Cloudflare worker) against protocol 1:  node relay-protocol.test.js <relay URL>
"use strict";
const crypto = require("crypto");
const A = require("../lib/address");
const base = process.argv[2] || "http://127.0.0.1:47820/";
const boxOf = (s) => crypto.createHash("sha256").update("kin-relay:" + s).digest("hex").slice(0, 32);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
function listen(secret, onMsg, box) {
  return new Promise((resolve, reject) => {
    const u = new URL(A.socketUrl(base)); u.searchParams.set("box", box || boxOf(secret));
    const ws = new WebSocket(u.toString());
    ws.onopen = () => ws.send(JSON.stringify({ t: "listen", secret }));
    ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.t === "ready") resolve(ws); else if (m.t === "error") reject(new Error(m.error)); else if (m.t === "msg") onMsg(m, ws); };
    ws.onerror = () => reject(new Error("socket error"));
    ws.onclose = () => reject(new Error("closed"));
  });
}
const post = (box, body) => fetch(A.deliveryUrl(base, box), { method: "POST", headers: { "content-type": "application/json" }, body });
(async () => {
  let pass = 0; const ok = (n, c) => { if (!c) { console.log("FAIL", n); process.exit(1); } pass++; console.log("PASS", n); };
  const secret = crypto.randomBytes(32).toString("hex"), box = boxOf(secret);
  // queued while offline, delivered on listen, gone after ack
  const r1 = await post(box, '{"n":1}'); const j1 = await r1.json();
  ok("delivery accepted while nobody listens", r1.status === 202 && j1.online === false);
  const got = [];
  let ws = await listen(secret, (m, s) => { got.push(m.body); s.send(JSON.stringify({ t: "ack", id: m.id })); });
  await wait(300); ok("queued message arrives on listen", got[0] === '{"n":1}');
  const r2 = await post(box, '{"n":2}'); ok("live delivery says online", (await r2.json()).online === true);
  await wait(300); ok("live message arrives", got[1] === '{"n":2}');
  ws.close(); await wait(300);
  const again = []; ws = await listen(secret, (m) => again.push(m.body)); await wait(300);
  ok("acknowledged messages are not sent again", again.length === 0);
  await post(box, '{"n":3}'); await wait(300); ws.close(); await wait(300);
  const third = []; ws = await listen(secret, (m) => third.push(m.body)); await wait(300);
  ok("unacknowledged message is sent again after reconnect", third.includes('{"n":3}')); ws.close();
  let refused = false; try { await listen(crypto.randomBytes(32).toString("hex"), () => {}, box); } catch { refused = true; }
  ok("a wrong secret can't listen to someone else's mailbox", refused);
  ok("oversized delivery refused", (await post(box, "x".repeat(300 * 1024))).status === 413);
  ok("bad mailbox name refused", (await fetch(base.replace(/\/$/, "") + "/d/../../etc", { method: "POST", body: "x" })).status >= 400);
  console.log(`relay protocol: ${pass} checks passed on ${base}`); process.exit(0);
})().catch((e) => { console.log("FAIL", e.message); process.exit(1); });
