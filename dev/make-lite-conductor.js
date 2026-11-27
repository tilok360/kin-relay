// Writes a comment-stripped copy of lib/conductor.js for the Kindroid App Library apps (they must stay small enough to share):
//   node dev/make-lite-conductor.js [--mention-only] <app dir> [more dirs...]   -> <dir>/conductor.js
// --mention-only also drops the code that picks a Kin nobody spoke to (draft-only apps never ask a Kin unprompted).
const fs = require("fs"), path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "lib", "conductor.js"), "utf8");
const MO = process.argv.includes("--mention-only"); let skip = false;
const lines = src.split("\n").filter((l) => { if (/^\s*\/\/ @full-begin/.test(l)) { skip = MO; return false; } if (/^\s*\/\/ @full-end/.test(l)) { skip = false; return false; } return !skip; }).filter((l) => !/^\s*\/\//.test(l)).map((l) => l.replace(/ +\/\/ [^"'`]*$/, "").replace(/^\s+/, "")).filter((l) => l.length);
const out = "// Kin Relay group-chat conductor (comment-stripped copy; the commented source is lib/conductor.js in tilok360/kin-relay).\n" + lines.join("\n");
for (const d of process.argv.slice(2).filter((x) => x !== "--mention-only")) { fs.writeFileSync(path.join(d, "conductor.js"), out); console.log(d, out.length, "bytes"); }
