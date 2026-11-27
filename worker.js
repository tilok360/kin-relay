// One run of a Kindroid app's main.js inside a Web Worker (the phone and web versions of Kin Relay). Same idea as
// lib/runtime.js on the PC: the trigger arrives as stdin, `kin` is answered by lib/kin-shim.js + lib/kin-commands.js
// (the very same files the PC version uses), and the run ends when the program calls process.exit / `kin end`, or has
// nothing left to do. This worker never sees your API key: `kin ask` is passed to the page, which asks Kindroid.
"use strict";
importScripts("nodelite.js", "lib-bundle.js");
const NL = self.NodeLite, { Buffer, path, EventEmitter } = NL;
const realSetTimeout = self.setTimeout.bind(self), realClearTimeout = self.clearTimeout.bind(self), realSetInterval = self.setInterval.bind(self), realClearInterval = self.clearInterval.bind(self);
let done = false, inflight = 0, idle = 0, vfs = null, proc = null, stderrTail = "";
const timers = new Set(), askWaiting = new Map(); let askSeq = 0;
class ExitSignal extends Error {}

const live = () => inflight + [...timers].filter((t) => t.refd).length;
function touch() { realClearTimeout(idle); idle = realSetTimeout(() => { if (!done && live() === 0) finish(0); }, 40); }
function finish(code, err) {
  if (done) return; done = true;
  let result = null; try { const b = vfs.files.get("/result.json"); if (b) result = JSON.parse(b.toString("utf8")); } catch {}
  self.postMessage({ t: "done", code, result, stderr: (err ? String(err) + "\n" : "") + stderrTail.slice(-1500) });
  realSetTimeout(() => self.close(), 0);
}
function uncaught(e) {
  const hs = proc ? proc.listeners("uncaughtException") : [];
  if (hs.length) { try { hs.forEach((h) => h(e)); } catch {} return; }
  finish(1, (e && e.stack) || e);
}

function wrapTimers() {
  class Timeout {
    constructor(fn, ms, args, repeat) {
      this.refd = true; this.repeat = repeat;
      const tick = () => { if (!repeat) timers.delete(this); try { fn(...args); } catch (e) { if (!(e instanceof ExitSignal)) uncaught(e); } touch(); };
      this.id = (repeat ? realSetInterval : realSetTimeout)(tick, Math.max(0, Number(ms) || 0)); timers.add(this);
    }
    unref() { this.refd = false; return this; } ref() { this.refd = true; return this; } hasRef() { return this.refd; } refresh() { return this; }
    close() { clearT(this); } [Symbol.toPrimitive]() { return this.id; }
  }
  const clearT = (t) => { if (t instanceof Timeout) { (t.repeat ? realClearInterval : realClearTimeout)(t.id); timers.delete(t); } else if (t != null) { realClearTimeout(t); realClearInterval(t); } touch(); };
  self.setTimeout = (fn, ms, ...a) => new Timeout(fn, ms, a, false);
  self.setInterval = (fn, ms, ...a) => new Timeout(fn, ms, a, true);
  self.setImmediate = (fn, ...a) => new Timeout(fn, 0, a, false);
  self.clearTimeout = self.clearInterval = self.clearImmediate = clearT;
}
function wrapFetch() {
  const real = self.fetch.bind(self);
  self.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input && input.url ? input.url : String(input);
    inflight++;
    try {
      if (url.startsWith("http://127.0.0.1:0/internal/ask")) { // `kin ask`: the page asks Kindroid with your key
        const b = JSON.parse(init.body), id = ++askSeq;
        self.postMessage({ t: "ask", id, question: b.question, kin: b.kin, slug: b.slug });
        const m = await new Promise((res) => askWaiting.set(id, res));
        return new Response(JSON.stringify(m), { status: 200, headers: { "content-type": "application/json" } });
      }
      return await real(input, init);
    } finally { inflight--; touch(); }
  };
}

self.onmessage = (e) => {
  const m = e.data;
  if (m.t === "askr") { const r = askWaiting.get(m.id); if (r) { askWaiting.delete(m.id); r(m.answer); } return; }
  if (m.t === "job") run(m);
};

function run(job) {
  try {
    vfs = new NL.VFS();
    const sources = Object.assign({}, self.KR_SOURCES);
    for (const [rel, buf] of Object.entries(job.appFiles)) { const f = "/app/" + rel; vfs.files.set(f, Buffer.from(buf)); if (/\.(js|json|cjs)$/.test(rel)) sources[f] = Buffer.from(buf).toString("utf8"); }
    for (const [rel, buf] of Object.entries(job.dataFiles)) vfs.files.set("/files/" + rel, Buffer.from(buf));
    if (job.tells != null) vfs.files.set("/tells.json", Buffer.from(job.tells));
    vfs.stdin = JSON.stringify(job.trigger);
    vfs.onWrite = (f, data) => {
      if (f.endsWith(".tmp")) return;
      if (f.startsWith("/files/")) self.postMessage({ t: "put", path: f.slice(7), data: data.buffer.slice(data.byteOffset, data.byteOffset + data.length) });
      else if (f === "/tells.json") self.postMessage({ t: "tells", text: data.toString("utf8") });
    };
    vfs.onRemove = (f) => { if (f.endsWith(".tmp")) return; if (f.startsWith("/files/")) self.postMessage({ t: "rm", path: f.slice(7) }); };

    proc = new EventEmitter();
    Object.assign(proc, {
      env: Object.assign({ KGR_SLUG: job.slug, KGR_FILES: "/files", KGR_RESULT: "/result.json", KGR_PORT: "0", KGR_RUN_TOKEN: "web" }, job.env),
      argv: ["node", "/app/" + job.entry], pid: 4242, ppid: 1, platform: "linux", arch: "x64", version: "v22.0.0", versions: { node: "22.0.0" }, exitCode: 0, execPath: "/usr/bin/node", title: "node",
      cwd: () => "/app", uptime: () => performance.now() / 1000, hrtime: Object.assign(() => { const t = performance.now(); return [Math.floor(t / 1000), Math.floor((t % 1000) * 1e6)]; }, { bigint: () => BigInt(Math.floor(performance.now() * 1e6)) }),
      nextTick: (fn, ...a) => queueMicrotask(() => fn(...a)), memoryUsage: () => ({ rss: 5e7, heapUsed: 2e7, heapTotal: 4e7 }), umask: () => 18, emitWarning() {},
      stdout: { write: (s) => { stderrTail = (stderrTail + s).slice(-3000); return true; }, isTTY: false }, stderr: { write: (s) => { stderrTail = (stderrTail + s).slice(-3000); return true; }, isTTY: false },
      exit: (c) => { finish(c == null ? proc.exitCode : c); throw new ExitSignal("exit"); },
    });
    const cons = (self.console);
    self.console = Object.assign(Object.create(cons), { error: (...a) => { stderrTail = (stderrTail + a.map((x) => (typeof x === "string" ? x : x && x.stack || JSON.stringify(x))).join(" ") + "\n").slice(-3000); }, warn: () => {}, log: () => {}, info: () => {}, debug: () => {} });
    self.addEventListener("unhandledrejection", (ev) => { ev.preventDefault(); const hs = proc.listeners("unhandledRejection"); if (hs.length) hs.forEach((h) => h(ev.reason, ev.promise)); else if (!(ev.reason instanceof ExitSignal)) uncaught(ev.reason); touch(); });
    self.addEventListener("error", (ev) => { ev.preventDefault(); if (!(ev.error instanceof ExitSignal)) uncaught(ev.error || ev.message); });

    wrapTimers(); wrapFetch();
    const EE = EventEmitter; EE.EventEmitter = EventEmitter;
    const fsApi = vfs.api();
    const util = { promisify: (fn) => (...a) => new Promise((res, rej) => fn(...a, (e, v) => (e ? rej(e) : res(v)))), inspect: (x) => (typeof x === "string" ? x : JSON.stringify(x)), format: (...a) => a.join(" "), TextEncoder, TextDecoder, types: {} };
    const builtins = {
      fs: fsApi, "fs/promises": fsApi.promises, path: NL.path, crypto: NL.crypto, os: NL.os, events: EE, stream: NL.stream, child_process: NL.child_process, worker_threads: NL.worker_threads, zlib: NL.zlib,
      buffer: { Buffer }, util, url: { URL, URLSearchParams }, timers: { setTimeout: self.setTimeout, setInterval: self.setInterval, setImmediate: self.setImmediate, clearTimeout: self.clearTimeout, clearInterval: self.clearInterval },
      "timers/promises": { setTimeout: (ms, v) => new Promise((r) => self.setTimeout(() => r(v), ms)) }, assert: Object.assign((c, m) => { if (!c) throw new Error(m || "assertion failed"); }, { ok: (c, m) => { if (!c) throw new Error(m || "assertion failed"); } }),
    };
    const L = NL.loader({ sources, builtins, process: proc });
    L.load("/lib/kin-shim.js"); // from now on, "kin" and table addresses behave as they do in Kindroid
    const killer = realSetTimeout(() => finish(124, "The run took too long and was stopped."), job.timeoutMs || 120000);
    try { L.load("/app/" + job.entry); } catch (e) { if (!(e instanceof ExitSignal)) { finish(1, (e && e.stack) || e); } }
    touch();
  } catch (e) { finish(1, (e && e.stack) || e); }
}
