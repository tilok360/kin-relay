// The `kin` commands Kin Relay stands in for, secrets, always-on apps and schedules, against local fake servers (no network, no key).
"use strict";
const fs = require("fs"), os = require("os"), path = require("path"), http = require("http"), crypto = require("crypto");
const { spawn } = require("child_process");
const ROOT = path.resolve(__dirname, ".."), DATA = fs.mkdtempSync(path.join(os.tmpdir(), "kr-rt-"));
process.env.KGR_DATA = DATA;
let pass = 0, fail = 0;
const check = (n, ok, d = "") => { (ok ? pass++ : fail++); console.log((ok ? "PASS " : "FAIL ") + n, d); };
const FILES = path.join(DATA, "apps", "t", "files"); fs.mkdirSync(FILES, { recursive: true });
process.env.KGR_FILES = FILES; process.env.KGR_RESULT = path.join(DATA, "r.json");
const K = require(path.join(ROOT, "lib/kin-commands"));
const { cronMatches } = require(path.join(ROOT, "lib/cron"));
const { Runner } = require(path.join(ROOT, "lib/runtime"));

(async () => {
  // voice, pictures and the rest: said plainly, exit 3
  for (const c of ["say", "picture", "video", "avatar", "media", "tcp", "shortcut"]) {
    const r = await K.run([c, "x"]); check(`kin ${c} says plainly it isn't available here`, r.code === 3 && /Kin Relay|Kindroid/.test(r.err) && r.err.length > 30, r.err.slice(0, 70));
  }
  check("kin check / progress / return are accepted", (await K.run(["check", "ls"])).code === 0 && (await K.run(["progress"])).code === 0);
  check("an unknown command says so", (await K.run(["wibble"])).code === 2);
  // tell: keyed replace, ttl 0 removes
  await K.run(["tell", "one", "--key", "k1", "--kin", "a"]); await K.run(["tell", "two", "--key", "k1", "--kin", "a"]); await K.run(["tell", "other", "--kin", "b"]);
  let tells = JSON.parse(fs.readFileSync(path.join(FILES, "..", "tells.json"), "utf8"));
  check("kin tell: a keyed fact replaces the older one", tells.filter((t) => t.key === "k1").length === 1 && tells.find((t) => t.key === "k1").text === "two");
  await K.run(["tell", "--key", "k1", "--ttl", "0", "--kin", "a"]); tells = JSON.parse(fs.readFileSync(path.join(FILES, "..", "tells.json"), "utf8"));
  check("kin tell --ttl 0 takes it back", !tells.some((t) => t.key === "k1") && tells.length === 1);
  // fetch + secrets, only to the granted host
  const seen = [];
  const web = http.createServer((q, s) => { let b = ""; q.on("data", (c) => b += c); q.on("end", () => { seen.push({ auth: q.headers.authorization || "", url: q.url, body: b }); s.writeHead(200); s.end("hello"); }); }).listen(0, "127.0.0.1");
  await new Promise((r) => web.once("listening", r)); const port = web.address().port;
  process.env.KGR_SECRETS = JSON.stringify({ tok: { host: "127.0.0.1", value: "S3CRET" }, other: { host: "example.com", value: "NOPE" } });
  let r = await K.run(["fetch", `http://127.0.0.1:${port}/x?t={{secret:tok}}`, "-H", "Authorization: Bearer {{secret:tok}}", "-d", "k={{secret:tok}}"]);
  check("kin fetch fills {{secret:name}} for the host it was saved for", r.code === 0 && r.out === "hello" && seen[0].auth === "Bearer S3CRET" && seen[0].url.includes("S3CRET") && seen[0].body === "k=S3CRET", JSON.stringify(seen[0] || {}).replace(/S3CRET/g, "***"));
  r = await K.run(["fetch", `http://127.0.0.1:${port}/y`, "-H", "Authorization: Bearer {{secret:other}}"]);
  check("... and never fills one saved for a different host", seen[1].auth === "Bearer {{secret:other}}", seen[1].auth);
  r = await K.run(["secret", "tok"]); check("kin secret prints a saved sign-in; an unsaved one says where to add it", r.out === "S3CRET" && (await K.run(["secret", "zzz"])).err.includes("App sign-ins"));
  // the shim: fetch and WebSocket from a game's own code
  const wsGot = [];
  const wss = http.createServer(); wss.on("upgrade", (req, sock) => {
    const key = req.headers["sec-websocket-key"]; sock.write("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: " + crypto.createHash("sha1").update(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").digest("base64") + "\r\n\r\n");
    sock.on("data", (d) => { let o = 0; while (o + 6 <= d.length) { const len = d[o + 1] & 127; const mask = d.subarray(o + 2, o + 6), data = d.subarray(o + 6, o + 6 + len); wsGot.push(Buffer.from(data.map((b, i) => b ^ mask[i % 4])).toString()); o += 6 + len; } });
  }).listen(0, "127.0.0.1"); await new Promise((r2) => wss.once("listening", r2));
  const script = `const ws = new WebSocket("ws://127.0.0.1:${wss.address().port}/"); ws.onopen = () => { ws.send("PASS oauth:{{secret:tok}}"); ws.send("NICK x {{secret:other}}"); setTimeout(() => process.exit(0), 300); }; ws.onerror = () => process.exit(2);`;
  const code = await new Promise((res) => { const c = spawn(process.execPath, ["--require", path.join(ROOT, "lib/kin-shim.js"), "-e", script], { env: Object.assign({}, process.env), stdio: "ignore" }); c.on("close", res); });
  check("a game's WebSocket gets {{secret:name}} filled, only for its own host", code === 0 && wsGot[0] === "PASS oauth:S3CRET" && wsGot[1] === "NICK x {{secret:other}}", JSON.stringify(wsGot).replace(/S3CRET/g, "***"));
  web.close(); wss.close();
  // schedules
  const d = new Date(2026, 10, 26, 7, 0);
  check("a daily 7:00 schedule matches 7:00 and not 8:00", cronMatches("0 7 * * *", d) && !cronMatches("0 8 * * *", d) && cronMatches("*/15 7 * * 1-5", d));
  // an "always" app stays running, is restarted when it stops, and stops when asked
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kr-always-"));
  fs.writeFileSync(path.join(dir, "main.js"), `const { execFileSync } = require("child_process"); let n = 0; setInterval(() => { n++; execFileSync("kin", ["files", "put", "beat.txt"], { input: String(n) }); }, 200);`);
  const app = { slug: "t", dir, manifest: { name: "t", run: { entry: "node main.js", timeout: "5m" }, triggers: [{ on: "always" }] } };
  const run = new Runner(app, { port: 1, runToken: "x", env: () => ({ kins: [], addrs: {}, current: "", secrets: {} }), log: () => {} });
  run.startAlways(); await new Promise((r2) => setTimeout(r2, 1800));
  const beat1 = fs.existsSync(path.join(FILES, "beat.txt")) ? Number(fs.readFileSync(path.join(FILES, "beat.txt"), "utf8")) : 0;
  check("an 'always' app keeps running (no timeout)", beat1 >= 3, "beats " + beat1);
  const pid = run.child && run.child.pid; try { process.kill(pid, "SIGKILL"); } catch {}
  await new Promise((r2) => setTimeout(r2, 5200));
  const beat2 = Number(fs.readFileSync(path.join(FILES, "beat.txt"), "utf8"));
  check("... and is started again if it stops", run.child && run.child.pid !== pid && beat2 >= 1);
  run.stop(); await new Promise((r2) => setTimeout(r2, 600));
  check("... and stops when Kin Relay stops it", !run.child);
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`runtime commands: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
