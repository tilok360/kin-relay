// The `kin` command, as Kindroid Apps gives it to a run, re-made for a run on this PC. Used by kin-shim.js, inside the
// game's own process.
//   kin files get|put|ls|rm <path>     the game's own folder under the Kin Relay data folder
//   kin kins [--json]                  the Kins you added in Kin Relay Settings (short stand-in ids, never AI IDs)
//   kin ask "<question>" [--kin id]    asks your Kin through Kin Relay, which uses your own Kindroid API key
//   kin tell "<fact>" [--key k]        kept in the game's tells.json on this PC (not sent to Kindroid)
//   kin address <id>                   this copy's table address on your Kin Relay
//   kin end [--failed] [--next <time>] "<summary>"     how the run went, and when to wake it again
//   kin return '<text>'                accepted and ignored
// Pictures, voice, video, secrets and raw connections are Kindroid's own services and are not available here.
"use strict";
const fs = require("fs");
const path = require("path");

const ENV = () => ({
  files: process.env.KGR_FILES, result: process.env.KGR_RESULT, port: process.env.KGR_PORT, token: process.env.KGR_RUN_TOKEN,
  kins: (() => { try { return JSON.parse(process.env.KGR_KINS || "[]"); } catch { return []; } })(),
  addrs: (() => { try { return JSON.parse(process.env.KGR_ADDRS || "{}"); } catch { return {}; } })(),
  current: process.env.KGR_CURRENT_KIN || "",
});
const R = (code, out, err) => ({ code, out: out == null ? "" : String(out), err: err == null ? "" : String(err) });

function flag(args, name) { const i = args.indexOf(name); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v == null ? "" : v; }
function bool(args, name) { const i = args.indexOf(name); if (i < 0) return false; args.splice(i, 1); return true; }

function filePath(env, p) {
  const rel = String(p || "").replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, "");
  if (rel.split("/").some((x) => x === "..")) return null;
  const full = path.resolve(env.files, rel || ".");
  const base = path.resolve(env.files);
  return full === base || full.startsWith(base + path.sep) ? full : null;
}
function listFiles(dir, rel, out) {
  let items = []; try { items = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const it of items) { const r = rel ? rel + "/" + it.name : it.name; if (it.isDirectory()) listFiles(path.join(dir, it.name), r, out); else if (!it.name.endsWith(".tmp")) out.push(r); }
  return out;
}

// Everything that can be answered without the network, synchronously. Returns null for commands that need run().
function local(argv, input) {
  const env = ENV(), args = argv.slice(), cmd = args.shift();
  if (cmd === "files") {
    const sub = args.shift(), p = args.find((a) => a !== "-");
    if (sub === "get") {
      const f = filePath(env, p); if (!f) return R(2, "", "bad path");
      try { return R(0, fs.readFileSync(f)); } catch { return R(1, "", "no such file: " + p); }
    }
    if (sub === "put") {
      const f = filePath(env, p); if (!f || f === path.resolve(env.files)) return R(2, "", "bad path");
      fs.mkdirSync(path.dirname(f), { recursive: true });
      const tmp = f + "." + process.pid + "." + Date.now() + ".tmp";
      fs.writeFileSync(tmp, input == null ? "" : input); fs.renameSync(tmp, f);
      return R(0, "");
    }
    if (sub === "ls") {
      const rel = String(p || "").replace(/^\/+|\/+$/g, ""), f = filePath(env, rel); if (!f) return R(2, "", "bad path");
      return R(0, listFiles(f, rel, []).sort().join("\n"));
    }
    if (sub === "rm") {
      const f = filePath(env, p); if (!f || f === path.resolve(env.files)) return R(2, "", "bad path");
      try { fs.rmSync(f, { recursive: true, force: true }); } catch {}
      return R(0, "");
    }
    return R(2, "", "kin files: get, put, ls or rm");
  }
  if (cmd === "kins") {
    const json = bool(args, "--json");
    return R(0, json ? JSON.stringify(env.kins) : env.kins.map((k) => k.id + "\t" + k.name).join("\n"));
  }
  if (cmd === "address") {
    const id = args[0] || "";
    return env.addrs[id] ? R(0, env.addrs[id]) : R(1, "", "No Kin Relay is set yet. Open Kin Relay > Settings > Relay address to play with other people.");
  }
  if (cmd === "end") {
    const failed = bool(args, "--failed"), next = flag(args, "--next");
    const summary = args.join(" ").slice(0, 4000);
    try { fs.writeFileSync(env.result, JSON.stringify({ ok: !failed, summary, next: next || null })); } catch {}
    return R(0, "");
  }
  if (cmd === "tell") {
    const key = flag(args, "--key"), ttl = flag(args, "--ttl"), kin = flag(args, "--kin");
    const f = path.join(env.files, "..", "tells.json");
    let list = []; try { list = JSON.parse(fs.readFileSync(f, "utf8")); } catch {}
    list = (Array.isArray(list) ? list : []).filter((t) => !(key && t.key === key && t.kin === (kin || ""))); // a keyed fact replaces the older one
    list.push({ at: new Date().toISOString(), kin: kin || "", key: key || "", ttl: Number(ttl) || null, text: args.join(" ").slice(0, 300) });
    try { fs.writeFileSync(f, JSON.stringify(list.slice(-100), null, 1)); } catch {}
    return R(0, "");
  }
  if (cmd === "return") return R(0, "");
  if (cmd === "ask") return null;
  return R(2, "", `"kin ${cmd || ""}" is one of Kindroid's own services and isn't available in Kin Relay.`);
}

// The full command, including `kin ask`, which goes to the Kin Relay server on this PC (it holds your API key).
async function run(argv, input) {
  const done = local(argv, input);
  if (done) return done;
  const env = ENV(), args = argv.slice(1);
  const kin = flag(args, "--kin");
  while (flag(args, "--attach") !== null) {} // pictures can't be described here; the question still goes
  const question = args.join(" ");
  try {
    const r = await fetch(`http://127.0.0.1:${env.port}/internal/ask`, {
      method: "POST", headers: { "content-type": "application/json", "x-run-token": env.token },
      body: JSON.stringify({ question, kin: kin || env.current || "", slug: process.env.KGR_SLUG || "" }),
    });
    const j = await r.json();
    return j.ok ? R(0, j.text) : R(1, "", j.error || "the Kin could not answer");
  } catch (e) { return R(1, "", "Kin Relay is not answering: " + (e && e.message)); }
}

module.exports = { local, run };
