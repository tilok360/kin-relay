// Copies lib/conductor.js into each app that has a multi-party chat (apps can only load files inside their own folder).
//   node dev/sync-conductor.js          copy        node dev/sync-conductor.js --check   fail if a copy differs
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, ".."), SRC = path.join(ROOT, "lib", "conductor.js");
const APPS = ["kin-holdem", "kin-casino", "kin-manatee", "kin-roomsplus"];
const src = fs.readFileSync(SRC, "utf8"); let bad = 0;
for (const a of APPS) {
  const f = path.join(ROOT, "games", a, "kr-conductor.js");
  if (process.argv.includes("--check")) { if (!fs.existsSync(f) || fs.readFileSync(f, "utf8") !== src) { console.log("DIFFERS: " + f); bad++; } }
  else fs.writeFileSync(f, src);
}
if (process.argv.includes("--check")) { console.log(bad ? "conductor copies out of date" : "conductor copies match"); process.exit(bad ? 1 : 0); }
