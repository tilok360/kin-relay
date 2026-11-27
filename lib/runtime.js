// Runs a Kindroid app's `run.entry` (its main.js) on this PC the way Kindroid Apps would: one run at a time per app,
// the trigger as JSON on stdin, `kin` answered by kin-shim.js, and `kin end --next <time>` waking it again later.
// Runs here are free: they use this PC, not Kindroid credits.
"use strict";
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const S = require("./store");

const SHIM = path.join(__dirname, "kin-shim.js");
const FLAGS = process.allowedNodeEnvironmentFlags;
const ms = (t) => { const m = /^(\d+)\s*(s|m|h)?$/.exec(String(t || "").trim()); if (!m) return 5 * 60000; return Number(m[1]) * ({ s: 1000, m: 60000, h: 3600000 }[m[2] || "s"]); };

class Runner {
  // app: {slug, dir, manifest}; ctx: {port, runToken, env(slug) -> {kins, addrs, current}, log(slug, line)}
  constructor(app, ctx) {
    this.app = app; this.ctx = ctx;
    this.chain = Promise.resolve(); this.bgQueued = false; this.wakeTimer = null; this.running = false;
    this.last = null; this.runs = 0;
  }
  get canRun() { return !!(this.app.manifest.run && this.app.manifest.run.entry); }

  // A screen used an action: run now (after any run already going) and answer how it went.
  action(name, input, kin) {
    const trig = { trigger: "action", action: String(name), input: input && typeof input === "object" ? input : {} };
    if (kin) trig.kin = kin;
    return this.enqueue(trig);
  }
  // Something arrived or a timer came due: one run covers everything waiting, so extra calls while one waits are merged.
  background(trig) {
    if (this.bgQueued) return;
    this.bgQueued = true;
    this.enqueue(trig, () => { this.bgQueued = false; });
  }
  enqueue(trig, before) {
    const p = this.chain.then(() => { if (before) before(); return this.exec(trig); });
    this.chain = p.catch(() => {});
    return p;
  }

  exec(trig) {
    if (!this.canRun) return Promise.resolve({ ok: false, summary: "This app has no run." });
    const { slug, dir, manifest } = this.app;
    const parts = String(manifest.run.entry).trim().split(/\s+/);
    if (parts[0] !== "node") return Promise.resolve({ ok: false, summary: `Kin Relay can run "node ..." entries only (this app says "${manifest.run.entry}").` });
    const files = S.filesDir(slug); fs.mkdirSync(files, { recursive: true });
    const resultFile = path.join(S.appDir(slug), `run-${crypto.randomBytes(4).toString("hex")}.result.json`);
    const e = this.ctx.env(slug);
    const env = Object.assign({}, process.env, {
      KGR_SLUG: slug, KGR_FILES: files, KGR_RESULT: resultFile, KGR_PORT: String(this.ctx.port), KGR_RUN_TOKEN: this.ctx.runToken,
      KGR_KINS: JSON.stringify(e.kins), KGR_ADDRS: JSON.stringify(e.addrs), KGR_CURRENT_KIN: e.current || "", KGR_PLAYER: e.player || "",
    }, process.versions.electron ? { ELECTRON_RUN_AS_NODE: "1" } : {}); // the Windows app's own Node runs the game
    // Node's permission model, when this Node has it: the game may read only its own code, the Kin Relay shim and its
    // own data folder, and write only there. It can't read your key file or anything else on the PC.
    const guard = [];
    if (FLAGS.has("--permission") && !process.env.KGR_NO_GUARD) {
      guard.push("--permission", `--allow-fs-read=${dir}`, `--allow-fs-read=${__dirname}`, `--allow-fs-read=${S.appDir(slug)}`, `--allow-fs-write=${S.appDir(slug)}`, "--allow-worker");
    }
    const args = [...guard, "--require", SHIM, ...parts.slice(1)];
    this.running = true; this.runs++;
    const started = Date.now();
    return new Promise((resolve) => {
      let err = "", out = "";
      const child = spawn(process.execPath, args, { cwd: dir, env, stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
      const killer = setTimeout(() => { try { child.kill(); } catch {} }, ms(manifest.run.timeout));
      child.stdout.on("data", (d) => { out = (out + d).slice(-4000); });
      child.stderr.on("data", (d) => { err = (err + d).slice(-4000); });
      child.on("error", (x) => { err += String(x.message || x); });
      child.on("close", (code) => {
        clearTimeout(killer); this.running = false;
        let res = null; try { res = JSON.parse(fs.readFileSync(resultFile, "utf8")); } catch {} try { fs.unlinkSync(resultFile); } catch {}
        if (!res) res = { ok: code === 0, summary: code === 0 ? "" : "The run stopped: " + (err.trim().split("\n").slice(-3).join(" ") || "exit " + code).slice(0, 300), next: null };
        this.last = { at: started, ms: Date.now() - started, trigger: trig.trigger, ok: res.ok, summary: res.summary, err: err.slice(-600) };
        if (err.trim()) this.ctx.log(slug, err.trim().split("\n").slice(-5).join("\n"));
        this.schedule(res.next);
        resolve({ ok: !!res.ok, summary: res.summary || "" });
      });
      child.stdin.end(JSON.stringify(trig));
    });
  }

  // The newest `kin end --next` decides the next wake; a run that ends without one cancels it.
  schedule(next) {
    clearTimeout(this.wakeTimer); this.wakeTimer = null;
    if (!next) return;
    const at = Date.parse(next); if (!Number.isFinite(at)) return;
    const wait = Math.min(Math.max(1000, at - Date.now()), 24 * 3600000);
    this.wakeTimer = setTimeout(() => this.background({ trigger: "schedule", wake: true }), wait);
    this.wakeTimer.unref && this.wakeTimer.unref();
  }
  stop() { clearTimeout(this.wakeTimer); }
}
module.exports = { Runner };
