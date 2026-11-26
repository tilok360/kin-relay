// Loaded (node --require) before a game's own main.js when Kin Relay runs it. It makes two things behave the way
// they do inside Kindroid Apps, without changing a line of the game:
//  1. Starting the `kin` command (spawn, execFile, execFileSync, spawnSync with "kin") is answered by
//     kin-commands.js instead of looking for a program called kin.
//  2. fetch() to a table address (https://in.kinusercontent.com/kr/...) is posted to the Kin Relay that address names.
//     A real Kindroid address is refused, so a Kin Relay table can never start runs (and spend credits) on Kindroid.
"use strict";
const cp = require("child_process");
const path = require("path");
const { EventEmitter } = require("events");
const { PassThrough, Writable } = require("stream");
const K = require("./kin-commands");
const A = require("./address");

const isKin = (file) => typeof file === "string" && /^kin(\.exe|\.cmd)?$/i.test(path.basename(file)) && !file.includes("/") && !file.includes("\\");
const argList = (a) => (Array.isArray(a) ? a.map(String) : []);
const inputOf = (opts) => (opts && opts.input != null ? (Buffer.isBuffer(opts.input) ? opts.input : Buffer.from(String(opts.input))) : null);

// A stand-in child process: stdin collects what the game writes, then the command runs and stdout/stderr/close follow.
function fakeChild(args, opts) {
  const child = new EventEmitter();
  child.stdout = new PassThrough(); child.stderr = new PassThrough();
  child.pid = 0; child.exitCode = null; child.killed = false;
  child.kill = () => { child.killed = true; return true; };
  const chunks = []; let started = false;
  const start = () => {
    if (started) return; started = true;
    const input = chunks.length ? Buffer.concat(chunks) : null;
    K.run(args, input).then((r) => {
      child.exitCode = r.code;
      child.stdout.end(r.out); child.stderr.end(r.err);
      setTimeout(() => { child.emit("exit", r.code, null); child.emit("close", r.code, null); }, 5);
    });
  };
  child.stdin = new Writable({ write(c, _e, cb) { chunks.push(Buffer.from(c)); cb(); }, final(cb) { start(); cb(); } });
  const stdio = opts && opts.stdio;
  const stdinMode = Array.isArray(stdio) ? stdio[0] : stdio;
  if (stdinMode === "ignore" || stdinMode === "inherit") setImmediate(start);
  return child;
}

const orig = { spawn: cp.spawn, spawnSync: cp.spawnSync, execFile: cp.execFile, execFileSync: cp.execFileSync };

cp.spawn = function (file, args, opts) {
  if (!isKin(file)) return orig.spawn.apply(this, arguments);
  if (!Array.isArray(args)) { opts = args; args = []; }
  return fakeChild(argList(args), opts);
};

// A synchronous call that needs the network (only `kin ask`): a worker thread does it while this thread waits.
// (No second program is started, so this works under Node's permission model too.)
function syncRun(args, input) {
  const r = K.local(args, input);
  if (r) return r;
  const { Worker, MessageChannel, receiveMessageOnPort } = require("worker_threads");
  const flag = new Int32Array(new SharedArrayBuffer(4));
  const { port1, port2 } = new MessageChannel();
  const code = `const { workerData } = require("worker_threads");
    require(workerData.mod).run(workerData.args, workerData.input ? Buffer.from(workerData.input) : null)
      .then((r) => { workerData.port.postMessage(r); Atomics.store(workerData.flag, 0, 1); Atomics.notify(workerData.flag, 0); });`;
  const w = new Worker(code, { eval: true, env: process.env, workerData: { mod: require.resolve("./kin-commands"), args, input: input ? Array.from(input) : null, port: port2, flag }, transferList: [port2] });
  Atomics.wait(flag, 0, 0, 120000);
  const m = receiveMessageOnPort(port1);
  w.terminate();
  return m ? m.message : { code: 1, out: "", err: "the Kin took too long" };
}
cp.spawnSync = function (file, args, opts) {
  if (!isKin(file)) return orig.spawnSync.apply(this, arguments);
  if (!Array.isArray(args)) { opts = args; args = []; }
  const r = syncRun(argList(args), inputOf(opts));
  const enc = opts && opts.encoding && opts.encoding !== "buffer";
  return { pid: 0, status: r.code, signal: null, stdout: enc ? r.out : Buffer.from(r.out), stderr: enc ? r.err : Buffer.from(r.err), output: [null, r.out, r.err] };
};
cp.execFileSync = function (file, args, opts) {
  if (!isKin(file)) return orig.execFileSync.apply(this, arguments);
  if (!Array.isArray(args)) { opts = args; args = []; }
  const r = syncRun(argList(args), inputOf(opts));
  if (r.code !== 0) { const e = new Error(`kin ${args[0] || ""} failed: ${r.err}`); e.status = r.code; e.stdout = r.out; e.stderr = r.err; throw e; }
  return opts && opts.encoding && opts.encoding !== "buffer" ? r.out : Buffer.from(r.out);
};
// execFile with a callback (rare in Kindroid apps).
cp.execFile = function (file, args, opts, cb) {
  if (!isKin(file)) return orig.execFile.apply(this, arguments);
  if (typeof args === "function") { cb = args; args = []; opts = {}; }
  else if (typeof opts === "function") { cb = opts; opts = {}; }
  const list = argList(args), child = new EventEmitter();
  child.kill = () => true; child.stdout = new PassThrough(); child.stderr = new PassThrough();
  K.run(list, inputOf(opts)).then((r) => {
    const enc = !opts || !opts.encoding || opts.encoding !== "buffer";
    const out = enc ? r.out : Buffer.from(r.out), err = enc ? r.err : Buffer.from(r.err);
    if (cb) cb(r.code ? Object.assign(new Error("kin failed: " + r.err), { code: r.code }) : null, out, err);
    child.emit("exit", r.code); child.emit("close", r.code);
  });
  return child;
};

// ---------- fetch to table addresses goes to the relay ----------
const realFetch = globalThis.fetch;
globalThis.fetch = async function (input, init) {
  const url = typeof input === "string" ? input : input && input.url ? input.url : String(input);
  const a = A.parse(url);
  if (!a) return realFetch.apply(this, arguments);
  if (a.kindroid) return new Response("Kin Relay tables only talk to other Kin Relay copies (no Kindroid credits).", { status: 403 });
  const body = init && init.body != null ? init.body : "";
  const headers = { "content-type": (init && init.headers && (init.headers["content-type"] || init.headers["Content-Type"])) || "application/json" };
  return realFetch(A.deliveryUrl(a.relay, a.box), { method: "POST", headers, body });
};
