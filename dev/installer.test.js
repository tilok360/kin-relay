// Installer checks: the real "Get its code" sample, tarballs of the four games, and unsafe archives.
"use strict";
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const zlib = require("zlib");
const { execFileSync } = require("child_process");
const I = require("../lib/installer");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kr-inst-"));
const games = path.join(tmp, "games");
let pass = 0; const ok = (name, fn) => { fn(); pass++; console.log("PASS", name); };

// A ustar header + data, written by hand so the test can make archives tar itself refuses to make.
function entry(name, data, type = "0", link = "") {
  const h = Buffer.alloc(512); const body = Buffer.from(data || "");
  h.write(name.slice(0, 100), 0); h.write("0000644\0", 100); h.write("0001750\0", 108); h.write("0001750\0", 116);
  h.write(body.length.toString(8).padStart(11, "0") + "\0", 124); h.write("15302105725\0", 136); h.write(type, 156); h.write(link, 157); h.write("ustar\0", 257); h.write("00", 263);
  h.write("        ", 148); let sum = 0; for (const b of h) sum += b; h.write(sum.toString(8).padStart(6, "0") + "\0 ", 148);
  return Buffer.concat([h, body, Buffer.alloc((512 - (body.length % 512)) % 512)]);
}
const tgz = (...entries) => zlib.gzipSync(Buffer.concat([...entries, Buffer.alloc(1024)]));
const KIN = JSON.stringify({ kin: 1, name: "Evil Test", screens: [{ slot: "panel", entry: "screen/index.html" }] });

ok("real Get its code sample (Checkers) unpacks with its report", () => {
  const r = I.install(fs.readFileSync(path.join(__dirname, "..", "samples", "kindroid-get-code-sample.gz")), games, {});
  assert.equal(r.slug, "checkers"); assert.equal(r.files, 6);
  for (const f of ["engine.js", "kin.json", "main.js", "sample/game.json", "sample/records.json", "screen/index.html"]) assert(fs.existsSync(path.join(games, "checkers", f)), f);
  assert(r.report.works.length >= 2 && r.report.level !== "limited");
});
ok("adding the same app again asks first, then replaces", () => {
  const buf = fs.readFileSync(path.join(__dirname, "..", "samples", "kindroid-get-code-sample.gz"));
  assert.equal(I.install(buf, games, {}).conflict, true);
  assert.equal(I.install(buf, games, { replace: true }).slug, "checkers");
});
for (const [dir, slug] of [["casino", "kin-casino"], ["holdem", "kin-holdem"], ["games", "kin-games-table-arcade"], ["games-board", "kin-games-board-cards"]]) {
  ok(`tarball of ${dir} installs as ${slug}`, () => {
    const src = path.join("/workspace/kin-apps", dir);
    const files = execFileSync("git", ["-C", src, "ls-files"], { encoding: "utf8" }).trim().split("\n");
    const out = path.join(tmp, dir + ".gz");
    execFileSync("tar", ["czf", out, "-C", src, ...files]);
    const r = I.install(fs.readFileSync(out), games, {});
    assert.equal(r.slug, slug); assert.equal(r.files, files.length);
    assert(r.report.tables === (dir === "casino" || dir === "holdem"));
  });
}
ok("a download wrapped in one folder is unwrapped", () => {
  const r = I.install(tgz(entry("wrapped/kin.json", KIN.replace("Evil Test", "Wrapped")), entry("wrapped/screen/index.html", "<p>hi")), games, {});
  assert.equal(r.slug, "wrapped"); assert(fs.existsSync(path.join(games, "wrapped", "screen", "index.html")));
});
ok("path traversal, absolute paths, links and node_modules are refused or left out", () => {
  const r = I.install(tgz(entry("kin.json", KIN), entry("../escape.txt", "x"), entry("/abs.txt", "x"), entry("C:/win.txt", "x"), entry("screen/../../up.txt", "x"),
    entry("link", "", "2", "/etc/passwd"), entry("hard", "", "1", "kin.json"), entry("node_modules/x/index.js", "x"), entry("screen/index.html", "<p>ok")), games, {});
  assert(!fs.existsSync(path.join(tmp, "escape.txt")) && !fs.existsSync(path.join(games, "escape.txt")) && !fs.existsSync("/abs.txt") && !fs.existsSync(path.join(games, "up.txt")));
  assert(!fs.existsSync(path.join(games, "evil-test", "link")) && !fs.existsSync(path.join(games, "evil-test", "node_modules")));
  assert.equal(r.skipped.length, 7, JSON.stringify(r.skipped));
});
ok("no kin.json, junk, damaged and oversized files are refused with a plain reason", () => {
  assert.throws(() => I.install(tgz(entry("readme.txt", "hi")), games, {}), /no kin\.json/);
  assert.throws(() => I.install(Buffer.from("hello world, not an archive"), games, {}), /isn't a Kindroid app download/);
  const bad = tgz(entry("kin.json", KIN)); const raw = zlib.gunzipSync(bad); raw[150] = 0x39; assert.throws(() => I.install(zlib.gzipSync(raw), games, {}), /damaged/);
  const bomb = zlib.gzipSync(Buffer.concat([entry("kin.json", KIN), entry("big.bin", Buffer.alloc(16 * 1024 * 1024))]));
  assert.throws(() => I.install(bomb, games, {}), /too big/);
  assert.equal(fs.readdirSync(games).filter((n) => n.startsWith(".adding")).length, 0);
});
ok("nothing in an added app is ever run (an install script stays a file)", () => {
  const marker = path.join(tmp, "ran.txt");
  const pkg = JSON.stringify({ name: "x", scripts: { install: `node -e "require('fs').writeFileSync('${marker}','x')"`, postinstall: "echo hi" }, dependencies: { leftpad: "1" } });
  const r = I.install(tgz(entry("kin.json", KIN.replace("Evil Test", "Scripted")), entry("package.json", pkg), entry("screen/index.html", "<p>")), games, {});
  assert(!fs.existsSync(marker)); assert(r.report.warnings.some((w) => /npm packages/.test(w)));
});
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`installer: ${pass} checks passed`);
