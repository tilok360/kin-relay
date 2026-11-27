// The `kin` command, as Kindroid Apps gives it to a run, re-made for a run on this PC. Used by kin-shim.js, inside the
// game's own process.
//   kin files get|put|ls|rm <path>     the game's own folder under the Kin Relay data folder
//   kin kins [--json]                  the Kins you added in Kin Relay Settings (short stand-in ids, never AI IDs)
//   kin ask "<question>" [--kin id]    asks your Kin through Kin Relay, which uses your own Kindroid API key
//   kin tell "<fact>" [--key k]        kept in the game's tells.json on this PC (not sent to Kindroid)
//   kin address <id>                   this copy's table address on your Kin Relay
//   kin end [--failed] [--next <time>] "<summary>"     how the run went, and when to wake it again
//   kin return '<text>'                accepted and ignored
//   kin chat [--days N] [--kin id]     the recent chat with that Kin, read through Kindroid's API (JSON)
//   kin fetch <url> [-X M] [-H h] [-d x]   one web request from this PC; {{secret:name}} is filled from Settings > App sign-ins
//   kin secret <name>                  the sign-in you saved in Kin Relay for that name
// Voice, pictures, video, avatars and raw connections are Kindroid's own services: Kindroid's public API has no endpoint
// for them, so those commands say so plainly (exit 3) and the app shows that message.
"use strict";
const fs = require("fs");
const path = require("path");

const ENV = () => ({
  files: process.env.KGR_FILES, result: process.env.KGR_RESULT, port: process.env.KGR_PORT, token: process.env.KGR_RUN_TOKEN,
  kins: (() => { try { return JSON.parse(process.env.KGR_KINS || "[]"); } catch { return []; } })(),
  addrs: (() => { try { return JSON.parse(process.env.KGR_ADDRS || "{}"); } catch { return {}; } })(),
  current: process.env.KGR_CURRENT_KIN || "",
  secrets: (() => { try { return JSON.parse(process.env.KGR_SECRETS || "{}"); } catch { return {}; } })(),
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
    // What an app tells a Kin is kept here and put in front of that Kin's next questions from this app (see server.js memoryFor).
    const key = flag(args, "--key"), ttl = flag(args, "--ttl"), kin = flag(args, "--kin"); flag(args, "--reach-out"); flag(args, "--group");
    const f = path.join(env.files, "..", "tells.json");
    let list = []; try { list = JSON.parse(fs.readFileSync(f, "utf8")); } catch {}
    list = (Array.isArray(list) ? list : []).filter((t) => !(key && t.key === key && t.kin === (kin || ""))); // a keyed fact replaces the older one
    if (!(key && ttl !== null && Number(ttl) === 0)) list.push({ at: new Date().toISOString(), kin: kin || "", key: key || "", ttl: Number(ttl) || null, text: args.join(" ").slice(0, 300) });
    try { fs.writeFileSync(f, JSON.stringify(list.slice(-100), null, 1)); } catch {}
    return R(0, "");
  }
  if (cmd === "return" || cmd === "progress") return R(0, "");
  if (cmd === "check") return R(0, "");
  if (cmd === "ask" || cmd === "chat" || cmd === "fetch") return null;
  if (cmd === "secret") {
    const name = args[0] || "", sec = env.secrets[name];
    return sec && sec.value ? R(0, sec.value) : R(1, "", `No sign-in saved for "${name}". Add it in Kin Relay Settings > App sign-ins.`);
  }
  const NO = {
    say: "Your Kin's own voice can't be made in Kin Relay: Kindroid's public API has no voice endpoint (it only works inside Kindroid Apps).",
    picture: "Pictures of your Kin can't be made in Kin Relay: Kindroid's public API has no selfie endpoint (it only works inside Kindroid Apps).",
    video: "Video selfies can't be made in Kin Relay: Kindroid's public API has no video endpoint (it only works inside Kindroid Apps).",
    avatar: "A Kin's avatar can't be fetched in Kin Relay (set a picture on the Characters tab instead).",
    media: "Voice, picture and video jobs aren't available in Kin Relay: Kindroid's public API can't make them.",
    tcp: "Raw connections (kin tcp) aren't available in Kin Relay.",
    shortcut: "iPhone shortcuts (kin shortcut) need a paired Mac in Kindroid Apps and aren't available in Kin Relay.",
    device: "Your computer's folders (kin device) aren't available in Kin Relay.",
  };
  if (NO[cmd]) return R(3, "", NO[cmd]);
  return R(2, "", `"kin ${cmd || ""}" isn't something Kin Relay knows.`);
}

// The full command, including `kin ask`, which goes to the Kin Relay server on this PC (it holds your API key).
const internal = async (env, route, body) => {
  const r = await fetch(`http://127.0.0.1:${env.port}/internal/${route}`, { method: "POST", headers: { "content-type": "application/json", "x-run-token": env.token }, body: JSON.stringify(body) });
  return r.json();
};
// Takes "--name value ..." pairs out of args; --attach takes every file name after it.
function takeAttach(args) {
  let n = 0;
  for (let i = args.indexOf("--attach"); i >= 0; i = args.indexOf("--attach")) { let j = i + 1; while (j < args.length && !args[j].startsWith("--")) j++; n += j - i - 1; args.splice(i, j - i); }
  return n;
}
function fillSecrets(env, text, host) {
  return String(text).replace(/\{\{secret:([A-Za-z0-9_.-]+)\}\}/g, (all, name) => { const s = env.secrets[name]; return s && s.value && hostMatches(s.host, host) ? s.value : all; });
}
const hostMatches = (granted, host) => String(granted || "").replace(/:\d+$/, "").toLowerCase() === String(host || "").toLowerCase();
async function run(argv, input) {
  const done = local(argv, input);
  if (done) return done;
  const env = ENV(), cmd = argv[0], args = argv.slice(1);
  try {
    if (cmd === "ask") {
      const kin = flag(args, "--kin"); flag(args, "--group");
      const attached = takeAttach(args);
      let question = args.join(" ");
      if (attached) question += "\n(" + attached + " picture/file" + (attached === 1 ? " was" : "s were") + " attached in the app, but Kin Relay can't send pictures to your Kin. Answer from the text alone and say so if you need to see it.)";
      const j = await internal(env, "ask", { question, kin: kin || env.current || "", slug: process.env.KGR_SLUG || "" });
      return j.ok ? R(0, j.text) : R(1, "", j.error || "the Kin could not answer");
    }
    if (cmd === "chat") {
      const kin = flag(args, "--kin"), days = flag(args, "--days"); bool(args, "--groups");
      const j = await internal(env, "chat", { kin: kin || env.current || "", days: Number(days) || 1, slug: process.env.KGR_SLUG || "" });
      return j.ok ? R(0, JSON.stringify(j.messages)) : R(1, "", j.error || "the chat could not be read");
    }
    if (cmd === "fetch") { // kin fetch <url> [-X METHOD] [-H "Name: value"]... [-d <text> | -d @file]
      let method = "GET", url = "", data = null; const headers = {};
      for (let i = 0; i < args.length; i++) {
        if (args[i] === "-X") method = String(args[++i] || "GET").toUpperCase();
        else if (args[i] === "-H") { const h = String(args[++i] || ""), k = h.indexOf(":"); if (k > 0) headers[h.slice(0, k).trim()] = h.slice(k + 1).trim(); }
        else if (args[i] === "-d") { data = String(args[++i] || ""); if (data.startsWith("@")) { try { data = fs.readFileSync(filePath(env, data.slice(1)), "utf8"); } catch { return R(1, "", "no such file: " + data.slice(1)); } } if (method === "GET") method = "POST"; }
        else if (!url) url = args[i];
      }
      let u; try { u = new URL(fillSecrets(env, url, new URL(url).hostname)); } catch { return R(2, "", "kin fetch needs a web address"); }
      if (!/^https?:$/.test(u.protocol)) return R(2, "", "kin fetch needs an http or https address");
      for (const k of Object.keys(headers)) headers[k] = fillSecrets(env, headers[k], u.hostname);
      const r = await fetch(u, { method, headers, body: data == null ? undefined : fillSecrets(env, data, u.hostname) });
      const text = await r.text();
      return r.ok ? R(0, text) : R(1, text.slice(0, 2000), `${r.status} ${text.slice(0, 200)}`);
    }
  } catch (e) { return R(1, "", "Kin Relay is not answering: " + (e && e.message)); }
  return R(2, "", `"kin ${cmd}" isn't something Kin Relay knows.`);
}

module.exports = { local, run };
