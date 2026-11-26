// Character import/export: the file readers (synthetic fixtures; the private sample only if present, counts only),
// then the real server's import, update, export and round trip. No API key may ever appear in an export.
"use strict";
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kr-chario-"));
process.env.KGR_DATA = tmp; process.env.KGR_PORT = String(48200 + Math.floor(Math.random() * 400)); process.env.KGR_APPS = path.join(tmp, "games");
const IO = require("../public/chario.js");
const FX = path.join(__dirname, "fixtures");
let pass = 0; const tests = [];
const ok = (name, fn) => tests.push([name, fn]);
async function* pieces(f, size) { for await (const c of fs.createReadStream(f, { encoding: "utf8", highWaterMark: size })) yield c; }
const read = (f, size = 4096) => IO.parseChunks(pieces(f, size));

ok("Kindroid export: Kins, profile fields, template join, user, chats ignored", async () => {
  const r = await read(path.join(FX, "kindroid-export.jsonl"), 333);
  assert.equal(r.format, "kindroid-export");
  assert.equal(r.kins.length, 4); // Testa, Bruno, Cleo, Keyholder (the entry with no id is dropped)
  assert.deepEqual(r.kins.slice(0, 3).map((k) => k.name), ["Testa", "Bruno", "Cleo"]); // Kindroid's own order
  const t = r.kins[0];
  assert.equal(t.details.backstory.includes("lighthouses"), true);
  assert.equal(t.details.tagline, "Fixture tagline"); assert.equal(t.details.greeting, "Fixture greeting"); // from shared_template
  assert.equal(t.details.gender, "female"); assert.equal(t.share_code, "ABC1x");
  assert.equal(t.avatar_url, "https://storage.kindroid.ai/fixture/testa.png");
  assert.equal(r.kins[2].avatar_url, ""); // a picture on another host is never used
  assert.equal(r.userName, "Test Person"); assert.equal(r.personas, 1);
  assert.equal(r.ignored.chatMessages, 45); assert.equal(r.bad, 1);
  assert.equal(IO.aiIdProblem(r.kins[3].ai_id) !== "", true); // an API key where an AI ID should be is refused
});
ok("Kindroid export: chunk size never changes the result", async () => {
  const a = await read(path.join(FX, "kindroid-export.jsonl"), 1), b = await read(path.join(FX, "kindroid-export.jsonl"), 1 << 20);
  assert.deepEqual(a, b);
});
ok("Kin Relay file and Kin Studio file read back", async () => {
  const a = await read(path.join(FX, "kin-relay-characters.json"), 50), b = await read(path.join(FX, "kin-studio-characters.json"), 50);
  assert.equal(a.format, IO.FORMAT); assert.equal(a.kins.length, 2); assert.equal(a.kins[0].avatar.startsWith("data:image/png"), true);
  assert.equal(b.kins.length, 2); assert.equal(b.kins[0].details.backstory, "Made-up backstory."); assert.equal(b.kins[0].details.tagline, "Fixture tagline");
  assert.equal(a.kins[1].details.memory, b.kins[1].details.memory);
});
ok("unknown, empty and newer files are refused politely", async () => {
  const bad = async (s) => { try { await IO.parseChunks((async function* () { yield s; })()); return null; } catch (e) { return e.message; } };
  assert(await bad("")); assert(await bad("hello")); assert(await bad('{"a":1}'));
  assert(/newer/.test(await bad(JSON.stringify({ format: IO.FORMAT, version: 99, characters: [] }))));
});
ok("a data-URL avatar is only accepted if it is a small image", () => {
  assert(IO.isDataImage("data:image/png;base64,AAAA")); assert(!IO.isDataImage("data:text/html;base64,AAAA")); assert(!IO.isDataImage("javascript:alert(1)"));
});
ok("exports never carry a key", () => {
  const f = JSON.stringify([IO.toRelayFile([{ name: "A", ai_id: "abcdefgh1", details: { backstory: "x" }, apiKey: "kn_" + "s".repeat(20) }]), IO.toStudioFile([{ name: "A", ai_id: "abcdefgh1", api_key: "kn_secretsecretsecret" }])]);
  assert(!/kn_secret|apiKey|api_key/.test(f));
});
const PRIVATE = path.join(__dirname, "..", "samples", "character-export-sample.jsonl");
if (fs.existsSync(PRIVATE)) ok("private Kindroid export: counts only", async () => {
  const r = await read(PRIVATE, 65536);
  assert.equal(r.kins.length, 44); assert.equal(r.kins.every((k) => k.ai_id.length === 20 && !IO.aiIdProblem(k.ai_id)), true);
  assert.equal(r.ignored.chatMessages > 0, true); assert.equal(r.bad, 0); assert(r.personas >= 1 && r.userName);
  assert.equal(r.kins.every((k) => !k.avatar_url || k.avatar_url.startsWith("https://storage.kindroid.ai/")), true);
  const again = await read(PRIVATE, 997); assert.equal(again.kins.length, 44);
  console.log(`   (44 Kins; ${r.ignored.chatMessages} chat messages ignored; ${r.kins.filter((k) => k.avatar_url).length} with pictures; ${r.kins.filter((k) => Object.keys(k.details).length).length} with profile fields)`);
});

// ---- the real server ----
function call(base, token, p, body) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? null : Buffer.from(JSON.stringify(body));
    const req = http.request(base + p, { method: data ? "POST" : "GET", headers: { "x-room-token": token, origin: base, "content-type": "application/json", ...(data ? { "content-length": data.length } : {}) } }, (res) => {
      const ch = []; res.on("data", (c) => ch.push(c)); res.on("end", () => { try { resolve(JSON.parse(Buffer.concat(ch).toString())); } catch (e) { reject(e); } });
    });
    req.on("error", reject); if (data) req.write(data); req.end();
  });
}
ok("server: import, duplicates, update, export, round trip, no key", async () => {
  const srv = require("../server.js"); const info = await srv.start();
  const base = `http://localhost:${new URL(info.url).port}`;
  const page = await new Promise((res) => http.get(base + "/", (r) => { let s = ""; r.on("data", (c) => (s += c)); r.on("end", () => res(s)); }));
  const token = /name="room-token" content="([^"]+)"/.exec(page)[1];
  const imp = async (items) => call(base, token, "/api/import", { items });
  const parsed = await read(path.join(FX, "kindroid-export.jsonl"));
  const items = parsed.kins.map((k) => ({ ai_id: k.ai_id, name: k.name, share_code: k.share_code, details: k.details, avatar_url: k.avatar_url, action: "add" }));
  let r = await imp(items);
  assert.equal(r.added, 3); assert.equal(r.skipped, 1); assert.equal(r.problems.length, 1); // the "key" row
  assert.equal(r.state.settings.kins.length, 3);
  assert.equal(r.state.settings.kins.every((k) => k.hasDetails), true);
  const testa = r.state.settings.kins.find((k) => k.name === "Testa");
  const g = await call(base, token, "/api/character", { op: "get", cid: testa.cid });
  assert.equal(g.details.tagline, "Fixture tagline");
  // same file again: skipped unless "update"
  r = await imp(items); assert.equal(r.added, 0); assert.equal(r.skipped, 4);
  r = await imp([{ ...items[0], name: "Testa Two", details: { bio: "new bio" }, action: "update" }]);
  assert.equal(r.updated, 1); assert.equal(r.state.settings.kins.length, 3);
  const g2 = await call(base, token, "/api/character", { op: "get", cid: testa.cid });
  assert.equal(g2.details.bio, "new bio"); assert.equal(g2.details.backstory.includes("lighthouses"), true); // old fields the file leaves out are kept
  // a picture that comes as a data URL is stored
  const relay = await read(path.join(FX, "kin-relay-characters.json"));
  r = await imp(relay.kins.map((k) => ({ ...k, action: "add" })));
  assert.equal(r.added, 1); assert.equal(r.updated + r.skipped, 1); // Dara is new; Testa was already here -> skipped
  r = await imp([{ ...relay.kins[0], action: "update" }]); assert.equal(r.pictures, 1);
  assert.equal(r.state.settings.kins.find((k) => k.ai_id === "fixtureAiOne000000001").avatar, true);
  // refuses non-image data
  r = await imp([{ ai_id: "fixtureAiNine00000009", name: "Bad", avatar: "data:text/html;base64,PGI+", action: "add" }]);
  assert.equal(r.pictures, 0);
  // export
  const ex = await call(base, token, "/api/export", {});
  assert.equal(ex.ok, true); assert.equal(ex.file.format, IO.FORMAT); assert.equal(ex.count, 5);
  const withPic = ex.file.characters.find((c) => c.ai_id === "fixtureAiOne000000001");
  assert.equal(withPic.avatar.startsWith("data:image/png;base64,"), true); assert.equal(withPic.details.backstory.includes("backstory"), true);
  const st = await call(base, token, "/api/export", { format: "studio", cids: [testa.cid] });
  assert.equal(st.ok, true); assert.equal(st.file.characters.length, 1); assert.equal(st.file.characters[0].personality.includes("backstory"), true);
  // a key saved in Kin Relay never shows up in an export
  const keyDir = fs.readdirSync(tmp); const text = JSON.stringify([ex, st]);
  assert(!/kn_[A-Za-z0-9]{6}/.test(text) && !/api_?key/i.test(text));
  assert(keyDir.length > 0);
  // round trip into an empty Kin Relay data folder is checked in the UI tests; here: re-read what we exported
  const again = IO.fromDocument(JSON.parse(JSON.stringify(ex.file)));
  assert.equal(again.kins.length, 5); assert.equal(again.kins.find((k) => k.ai_id === "fixtureAiOne000000001").details.bio, "new bio");
  // delete one and get a clear message for an unknown export
  assert.equal((await call(base, token, "/api/export", { cids: ["zzzzzzzz"] })).ok, false);
  await srv.stop();
});

(async () => {
  for (const [name, fn] of tests) { try { await fn(); pass++; console.log("PASS", name); } catch (e) { console.log("FAIL", name, "\n  ", e && e.stack || e); process.exitCode = 1; } }
  console.log(`${pass}/${tests.length} passed`);
  setTimeout(() => process.exit(process.exitCode || 0), 100);
})();
