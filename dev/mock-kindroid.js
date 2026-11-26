// A stand-in for api.kindroid.ai used by the tests: logs each request (with the key replaced by its length) and
// answers like a Kin would. Never contacts Kindroid.
"use strict";
const http = require("http");
const fs = require("fs");
const LOG = process.env.MOCK_LOG || "/tmp/mock-kindroid.jsonl";
const PORT = Number(process.env.MOCK_PORT) || 47811;
http.createServer((req, res) => {
  let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => {
    let j = {}; try { j = JSON.parse(b); } catch {}
    const auth = String(req.headers.authorization || "");
    fs.appendFileSync(LOG, JSON.stringify({ path: req.url, bearer: auth.startsWith("Bearer kn_"), keyLen: auth.length, ai_id: j.ai_id, share_code: j.share_code, msg: String(j.message || (j.conversation && j.conversation[0].text) || "").slice(0, 400) }) + "\n");
    if (!auth.startsWith("Bearer kn_good")) { res.writeHead(401); return res.end("Unauthorized"); }
    if (String(j.ai_id || "").startsWith("kin-relay-key-check")) { res.writeHead(404); return res.end("AI not found"); }
    const q = String(j.message || (j.conversation && j.conversation[0].text) || "");
    let a = "Ha, nice move! I'm coming for you.";
    const m = q.match(/\b(?:Reply|Answer)[^\n]*?\bwith\b[^\n]*?\b(?:only|just)\b[^\n]*/i);
    // Moves: games list options as numbered or lettered choices; pick the first one offered.
    const opt = q.match(/(?:^|\n)\s*(?:1[.)]|\(1\)|A[.)])\s*([^\n]+)/);
    if (q.includes('" | "')) a = "1 | Bold opening. Let's see what you've got.";
    else if (/"pick"/.test(q)) a = "{\"pick\": 1, \"say\": \"Your turn, champ.\"}";
    else if (/JSON/i.test(q)) a = '{"type":"call","to":0,"say":"Let\'s see it."}';
    else if (opt) a = "1";
    if (/one number|a number|number only|just the number/i.test(q)) a = "1";
    if (j.share_code) { res.writeHead(200, { "content-type": "application/json" }); return res.end(JSON.stringify({ success: true, reply: a, stop_reason: "stop" })); }
    res.writeHead(200, { "content-type": "text/plain" }); res.end(a);
  });
}).listen(PORT, "127.0.0.1", () => console.log("mock kindroid on", PORT));
