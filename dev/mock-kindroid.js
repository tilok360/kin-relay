// A stand-in for api.kindroid.ai used by the tests: logs each request (with the key replaced by its length) and
// answers like a Kin would. Never contacts Kindroid.
"use strict";
const http = require("http");
const fs = require("fs");
const LOG = process.env.MOCK_LOG || "/tmp/mock-kindroid.jsonl";
const PORT = Number(process.env.MOCK_PORT) || 47811;
const CTRL = process.env.MOCK_CTRL || "/tmp/mock-ctrl.json"; // {"delayMs": 1500} slows each answer; {"status": 500} fails them
const recentBy = {}; // per API key: when the last requests came: Kindroid's own limit is 10 per 30 seconds, answered with 429
http.createServer((req, res) => {
  let b = ""; req.on("data", (c) => (b += c)); req.on("end", async () => {
    let ctl = {}; try { ctl = JSON.parse(fs.readFileSync(CTRL, "utf8")); } catch {}
    if (ctl.delayMs) await new Promise((r) => setTimeout(r, ctl.delayMs));
    let j = {}; try { j = JSON.parse(b); } catch {}
    const auth = String(req.headers.authorization || "");
    fs.appendFileSync(LOG, JSON.stringify({ path: req.url, bearer: auth.startsWith("Bearer kn_"), t: Date.now(), keyLen: auth.length, tag: auth.slice(14, 15), ai_id: j.ai_id, share_code: j.share_code, msg: String(j.message || (j.conversation && j.conversation[0].text) || "").slice(0, 400) }) + "\n");
    if (req.method === "GET" && req.url.startsWith("/v1/get-chat-messages")) { fs.appendFileSync(LOG, JSON.stringify({ path: "/get-chat-messages", tag: auth.slice(14, 15), t: Date.now() }) + "\n"); if (!auth.startsWith("Bearer kn_good")) { res.writeHead(401); return res.end("Unauthorized"); } res.writeHead(200, { "content-type": "application/json" }); return res.end(JSON.stringify({ messages: [{ id: "1", sender: "user", sender_type: "user", display_name: "Casey", timestamp: Date.now(), message: "hello there" }, { id: "2", sender: "ai", sender_type: "ai", display_name: "Kin", timestamp: Date.now(), message: "hi, how are you?" }] })); }
    const nowT = Date.now(), recent = (recentBy[auth] = recentBy[auth] || []); while (recent.length && nowT - recent[0] > 30000) recent.shift(); recent.push(nowT);
    if (recent.length > 10) { fs.appendFileSync(LOG, JSON.stringify({ path: req.url, status: 429, t: Date.now() }) + "\n"); res.writeHead(429); return res.end("Too Many Requests"); }
    if (!auth.startsWith("Bearer kn_good")) { res.writeHead(401); return res.end("Unauthorized"); }
    if (ctl.status) { res.writeHead(ctl.status); return res.end("mock failure"); }
    if (String(j.ai_id || "").startsWith("kin-relay-key-check")) { res.writeHead(404); return res.end("AI not found"); }
    const q = String(j.message || (j.conversation && j.conversation[0].text) || "");
    let a = "Ha, nice move! I'm coming for you.";
    const cm = q.match(/(?:^|\n)You are (.+?), sitting at a friendly Texas Hold'em table|(?:^|\n)You are (.+?), at a friendly casino table/);
    const tail = (q.split(/Recent (?:table )?chat[^\n]*\n/)[1] || "").split("\n").filter((l) => /<<<.*>>>/.test(l)).pop() || "";
    const tm = tail.match(/^(.*?)(?: \((?:Kin|person)\))?: <<<(.*)>>>/);
    const chatQ = cm && /Recent (?:table )?chat/.test(q) && /(chat line|one short chat line)/.test(q);
    const m = q.match(/\b(?:Reply|Answer)[^\n]*?\bwith\b[^\n]*?\b(?:only|just)\b[^\n]*/i);
    // Moves: games list options as numbered or lettered choices; pick the first one offered.
    const opt = q.match(/(?:^|\n)\s*(?:1[.)]|\(1\)|A[.)])\s*([^\n]+)/);
    const rm = q.match(/(?:^|\n)You are (.+?), taking part in a shared chat room/);
    const mm = /Write only your one chat line/.test(q) && q.match(/(?:^|\n)You are (.+?), playing a friendly fill-in-the-blank party card game/);
    if (mm) { const last = (q.split(/Recent table chat:\n/)[1] || "").split("\n").filter((l) => /<<<.*>>>/.test(l)).pop() || ""; const lm = last.match(/^(.*?)(?: \((?:Kin|person)\))?: <<<(.*)>>>/); a = `${mm[1]} here: ${lm ? "to " + lm[1] + ", about " + lm[2].slice(0, 40) : "hello table"}.`; }
    if (mm) {}
    else if (rm) { const last = (q.split(/Recent messages[^\n]*\n/)[1] || "").split("\n").filter((l) => /<<<.*>>>/.test(l)).pop() || ""; const lm = last.match(/^(.*?) \((?:Kin|person)[^)]*\): <<<(.*)>>>/); a = `${rm[1]} here: ${lm ? "to " + lm[1] + ", about " + lm[2].slice(0, 40) : "hello everyone"}.`; }
    else if (chatQ) a = `Heard ${tm ? tm[1] : "someone"} say "${tm ? tm[2].slice(0, 40) : "..."}". ${cm[1] || cm[2]} has a view.`;
    else if (/"action":"fold\|check/.test(q)) a = '{"action":"call"}';
    else if (q.includes('" | "')) a = "1 | Bold opening. Let's see what you've got.";
    else if (/"pick"/.test(q)) a = "{\"pick\": 1, \"say\": \"Your turn, champ.\"}";
    else if (/JSON/i.test(q)) a = '{"type":"call","to":0,"say":"Let\'s see it."}';
    else if (opt) a = "1";
    if (!mm && /one number|a number|number only|just the number/i.test(q)) a = "1";
    if (j.share_code) { res.writeHead(200, { "content-type": "application/json" }); return res.end(JSON.stringify({ success: true, reply: a, stop_reason: "stop" })); }
    res.writeHead(200, { "content-type": "text/plain" }); res.end(a);
  });
}).listen(PORT, "127.0.0.1", () => console.log("mock kindroid on", PORT));
