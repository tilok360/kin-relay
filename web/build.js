// Builds the phone/web version of Kin Relay into web-dist/ (static files: host them anywhere, or bundle them in the Android app).
//   node web/build.js            -> web-dist/
// Nothing from dev/, samples/ or any data folder is copied, and no key ever is.
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const ROOT = path.resolve(__dirname, "..");
const OUT = process.env.WEB_OUT || path.join(ROOT, "web-dist");
const VERSION = /const VERSION = "([\d.]+)"/.exec(fs.readFileSync(path.join(ROOT, "server.js"), "utf8"))[1];
const I = require(path.join(ROOT, "lib", "installer.js"));
const GAMES = ["kin-casino", "kin-holdem", "kin-games-table-arcade", "kin-games-board-cards"];

function copy(from, to) {
  const st = fs.statSync(from);
  if (st.isDirectory()) { fs.mkdirSync(to, { recursive: true }); for (const n of fs.readdirSync(from)) copy(path.join(from, n), path.join(to, n)); }
  else fs.copyFileSync(from, to);
}
const walk = (d, base = d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name), base) : [path.relative(base, path.join(d, e.name)).split(path.sep).join("/")]));

fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
// the pages, as the PC app serves them, with the phone's wording
const WORDS = [[/Your Kindroid games, on your own PC/g, "Your Kindroid games, on your own device"], [/Drop a Kindroid app here to add it/g, "Tap here to add a Kindroid app"], [/Drag the \.gz file it downloads onto this window\./g, "Then choose the .gz file it downloads."], [/\bPC\b/g, "device"], [/Windows account/g, "device"], [/Drop to add this game/g, "Add this game"]];
const words = (s) => WORDS.reduce((t, [a, b]) => t.replace(a, b), s);
for (const n of ["lobby.js", "bridge.js", "chario.js", "room.css", "screen-shim.js"]) fs.writeFileSync(path.join(OUT, n), words(fs.readFileSync(path.join(ROOT, "public", n), "utf8")));
copy(path.join(ROOT, "public", "art"), path.join(OUT, "art"));
const HEAD = `<link rel="manifest" href="manifest.webmanifest">
<meta name="theme-color" content="#0f0a1c">
<meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Kin Relay"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">`;
const LIBS = `<script>window.KR_VERSION=${JSON.stringify(VERSION)}</script>\n<script src="nodelite.js"></script>\n<script src="lib-bundle.js"></script>\n<script src="kr-web.js"></script>`;
for (const n of ["index.html", "play.html"]) {
  let h = fs.readFileSync(path.join(ROOT, "public", n), "utf8");
  h = h.replace(/\{\{TOKEN\}\}/g, "web").replace(/\{\{SCREEN_ORIGIN\}\}/g, "web").replace(/\{\{VERSION\}\}/g, VERSION);
  h = h.replace(/href="\/#characters"/g, 'href="index.html#characters"').replace(/href="\/"/g, 'href="index.html"').replace(/(href|src)="\/([^/"#])/g, '$1="$2');
  h = h.replace('name="viewport" content="width=device-width, initial-scale=1"', 'name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"');
  h = h.replace(/sandbox="allow-scripts allow-same-origin /, 'sandbox="allow-scripts ').replace("</head>", HEAD + "\n</head>");
  h = h.replace(/<script src="(lobby|bridge)\.js"><\/script>/, LIBS + '\n<script src="$1.js"></script>').replace('<script src="chario.js"></script>\n<script src="lobby.js">', '<script src="chario.js"></script>\n' + LIBS + '\n<script src="lobby.js">');
  fs.writeFileSync(path.join(OUT, n), words(h));
}
// chario.js must load before kr-web.js needs it? kr-web loads its own copy through lib-bundle; the page copy is for lobby.js.
// Node-lite, the worker, the backend
for (const n of ["nodelite.js", "worker.js", "kr-web.js"]) fs.copyFileSync(path.join(__dirname, n), path.join(OUT, n));
const SRC = {};
for (const n of ["address", "kindroid", "relay-link", "kin-commands", "kin-shim", "installer", "store"]) SRC["/lib/" + n + ".js"] = fs.readFileSync(path.join(ROOT, "lib", n + ".js"), "utf8");
SRC["/public/chario.js"] = fs.readFileSync(path.join(ROOT, "public", "chario.js"), "utf8");
fs.writeFileSync(path.join(OUT, "lib-bundle.js"), "self.KR_SOURCES = " + JSON.stringify(SRC) + ";\n");
// the games that come with Kin Relay
const index = [];
for (const g of GAMES) {
  copy(path.join(ROOT, "games", g), path.join(OUT, "games", g));
  const dir = path.join(OUT, "games", g), manifest = JSON.parse(fs.readFileSync(path.join(dir, "kin.json"), "utf8")), files = walk(dir);
  const report = I.analyze(manifest, (p) => { const c = I.cleanPath(p); return c && fs.existsSync(path.join(dir, c)) ? fs.readFileSync(path.join(dir, c), "utf8") : ""; });
  index.push({ slug: g, manifest, files, report, art: fs.existsSync(path.join(ROOT, "public", "art", g + ".svg")) ? g : "default" });
}
fs.writeFileSync(path.join(OUT, "games", "index.json"), JSON.stringify({ version: VERSION, games: index }));
// icons and manifest
fs.mkdirSync(path.join(OUT, "icons"), { recursive: true });
require("child_process").execFileSync("python3", ["-c", `
from PIL import Image
im = Image.open(${JSON.stringify(path.join(ROOT, "desktop/assets/icon.png"))}).convert("RGBA")
out = ${JSON.stringify(path.join(OUT, "icons"))}
for n in (192, 512): im.resize((n, n), Image.LANCZOS).save(f"{out}/icon-{n}.png")
bg = Image.new("RGBA", (180, 180), (15, 10, 28, 255)); r = im.resize((150, 150), Image.LANCZOS); bg.paste(r, (15, 15), r); bg.convert("RGB").save(f"{out}/apple-touch-icon.png")
m = Image.new("RGBA", (512, 512), (15, 10, 28, 255)); r2 = im.resize((384, 384), Image.LANCZOS); m.paste(r2, (64, 64), r2); m.save(f"{out}/maskable-512.png")
`]);
fs.writeFileSync(path.join(OUT, "manifest.webmanifest"), JSON.stringify({ name: "Kin Relay", short_name: "Kin Relay", description: "Play your Kindroid games on your own device and host tables for friends.", start_url: "./index.html", scope: "./", display: "standalone", orientation: "any", background_color: "#0f0a1c", theme_color: "#0f0a1c",
  icons: [{ src: "icons/icon-192.png", sizes: "192x192", type: "image/png" }, { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" }, { src: "icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }] }, null, 1));
// service worker: every file is listed so a first visit works offline; the version changes whenever any file does
const all = walk(OUT).filter((f) => f !== "sw.js");
const h = crypto.createHash("sha256"); for (const f of all.sort()) h.update(f).update(fs.readFileSync(path.join(OUT, f)));
const ver = VERSION + "-" + h.digest("hex").slice(0, 10);
fs.writeFileSync(path.join(OUT, "sw.js"), fs.readFileSync(path.join(__dirname, "sw.js"), "utf8").replace("__VERSION__", ver).replace("__CORE__", JSON.stringify(["./", ...all])));
// never ship a key
const bad = []; for (const f of walk(OUT)) if (/kn_[A-Za-z0-9]{12,}/.test(fs.readFileSync(path.join(OUT, f), "latin1"))) bad.push(f);
if (bad.length) { console.error("Refusing to build: something that looks like a key is in", bad); process.exit(1); }
console.log(`web build ${ver}: ${all.length + 1} files in ${OUT}`);
