// Table addresses. A game made for Kindroid Apps gets its inbound address from `kin address <id>` and checks that it
// looks like https://in.kinusercontent.com/... before it puts it in an invite code. Kin Relay hands out addresses of the
// same shape whose path names a Kin Relay and a mailbox on it:
//   https://in.kinusercontent.com/kr/<relay address, base64url>/<mailbox, 32 hex>
// Nothing is ever sent to in.kinusercontent.com: the shim inside each game catches these and posts to the relay.
"use strict";
const HOST = "in.kinusercontent.com";
const b64u = (s) => Buffer.from(String(s), "utf8").toString("base64url");
function make(relay, box) { return `https://${HOST}/kr/${b64u(relay)}/${box}`; }
function parse(addr) {
  try {
    const u = new URL(String(addr));
    if (u.hostname !== HOST) return null;
    const m = /^\/kr\/([A-Za-z0-9_-]+)\/([0-9a-f]{32})$/.exec(u.pathname);
    if (!m) return { kindroid: true };
    const relay = Buffer.from(m[1], "base64url").toString("utf8");
    const r = new URL(relay);
    if (!/^https?:$/.test(r.protocol)) return null;
    return { relay, box: m[2] };
  } catch { return null; }
}
// The relay's delivery URL for a mailbox, keeping an access code (?k=...) if the relay address has one.
function deliveryUrl(relay, box) { const u = new URL(relay); u.pathname = u.pathname.replace(/\/+$/, "") + "/d/" + box; return u.toString(); }
function socketUrl(relay) { const u = new URL(relay); u.protocol = u.protocol === "https:" ? "wss:" : "ws:"; u.pathname = u.pathname.replace(/\/+$/, "") + "/ws"; return u.toString(); }
module.exports = { HOST, make, parse, deliveryUrl, socketUrl };
