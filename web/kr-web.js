// Kin Relay for phones and the web: the same pages as the PC app, with this file standing in for the PC's server.
// Everything is kept on this device (IndexedDB, plus your API key in this app's own storage). Games run right here:
// their screens in a sandboxed frame, their main.js in a Web Worker (web/worker.js). Your Kin is asked straight from this
// page to Kindroid's API with your own key; nothing passes through any server of ours.
(function () {
  "use strict";
  const NL = self.NodeLite, { Buffer } = NL;
  const VERSION = window.KR_VERSION || "1.2.0";

  // ---------- Kin Relay's library files (the same ones the PC app uses) ----------
  const scratch = new NL.VFS(), fsApi = scratch.api();
  const builtins = { fs: fsApi, path: NL.path, crypto: NL.crypto, os: NL.os, zlib: NL.zlib, events: NL.EventEmitter, stream: NL.stream, child_process: NL.child_process, worker_threads: NL.worker_threads, buffer: { Buffer } };
  const proc = { env: {}, platform: "linux", pid: 1, cwd: () => "/", versions: {} };
  const LIB = NL.loader({ sources: self.KR_SOURCES, builtins, process: proc });
  const KD = LIB.load("/lib/kindroid.js"), A = LIB.load("/lib/address.js"), RL = LIB.load("/lib/relay-link.js"), I = LIB.load("/lib/installer.js"), S = LIB.load("/lib/store.js"), IO = LIB.load("/public/chario.js");
  const boxOf = (secret) => NL.crypto.createHash("sha256").update("kin-relay:" + secret).digest("hex").slice(0, 32);

  // ---------- storage ----------
  const dbp = new Promise((res, rej) => {
    const r = indexedDB.open("kin-relay", 1);
    r.onupgradeneeded = () => { const d = r.result; for (const n of ["kv", "avatars", "files", "apps"]) d.createObjectStore(n); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  async function idb(store, mode, fn) {
    const db = await dbp;
    return new Promise((res, rej) => { const t = db.transaction(store, mode), st = t.objectStore(store); let out; const r = fn(st); if (r) r.onsuccess = () => { out = r.result; }; t.oncomplete = () => res(out); t.onerror = t.onabort = () => rej(t.error); });
  }
  const kvGet = (k) => idb("kv", "readonly", (s) => s.get(k)), kvSet = (k, v) => idb("kv", "readwrite", (s) => s.put(v, k));
  const fkey = (slug, p) => slug + "|" + p;
  const filesGet = (slug, p) => idb("files", "readonly", (s) => s.get(fkey(slug, p)));
  const filesPut = (slug, p, buf) => idb("files", "readwrite", (s) => s.put(buf, fkey(slug, p)));
  const filesDel = (slug, p) => idb("files", "readwrite", (s) => s.delete(fkey(slug, p)));
  async function filesAll(slug) {
    const db = await dbp, out = {};
    return new Promise((res, rej) => { const t = db.transaction("files", "readonly"), r = t.objectStore("files").openCursor(IDBKeyRange.bound(slug + "|", slug + "|\uffff")); r.onsuccess = () => { const c = r.result; if (c) { out[c.key.slice(slug.length + 1)] = c.value; c.continue(); } else res(out); }; r.onerror = () => rej(r.error); });
  }
  const enc = new TextEncoder(), dec = new TextDecoder();
  const toBuf = (s) => enc.encode(s).buffer;

  // ---------- settings ----------
  const DEFAULTS = { name: "", kins: [], currentKin: "", games: {}, relay: "", askStyle: "chat", welcomeDone: false };
  let cfg = null;
  const norm = (raw) => {
    const s = Object.assign({}, DEFAULTS, raw || {});
    s.kins = (Array.isArray(s.kins) ? s.kins : []).filter((k) => k && k.ai_id).map((k) => Object.assign(S.cleanKin(k), { id: S.kinAlias(S.cleanAiId(k.ai_id)) }));
    if (!s.games || typeof s.games !== "object") s.games = {};
    return s;
  };
  const save = () => kvSet("settings", JSON.parse(JSON.stringify(cfg)));
  const getKey = () => { try { return localStorage.getItem("kr.key") || ""; } catch { return ""; } };
  const setKey = (k) => { try { k ? localStorage.setItem("kr.key", k) : localStorage.removeItem("kr.key"); } catch {} };

  // ---------- avatars ----------
  const avatarUrls = new Map();
  async function primeAvatars() {
    const want = new Set(cfg.kins.filter((k) => k.avatar).map((k) => k.cid));
    for (const [cid, u] of avatarUrls) if (!want.has(cid)) { URL.revokeObjectURL(u); avatarUrls.delete(cid); }
    for (const cid of want) if (!avatarUrls.has(cid)) { const b = await idb("avatars", "readonly", (s) => s.get(cid)); if (b) avatarUrls.set(cid, URL.createObjectURL(b)); }
  }
  const avatarPut = async (cid, blob) => { await idb("avatars", "readwrite", (s) => s.put(blob, cid)); const u = avatarUrls.get(cid); if (u) { URL.revokeObjectURL(u); avatarUrls.delete(cid); } };
  const avatarDel = async (cid) => { await idb("avatars", "readwrite", (s) => s.delete(cid)); const u = avatarUrls.get(cid); if (u) { URL.revokeObjectURL(u); avatarUrls.delete(cid); } };
  async function shrink(blob) { // a 256 px square JPEG, like the PC app keeps
    const bmp = await createImageBitmap(blob), s = Math.min(bmp.width, bmp.height), cv = document.createElement("canvas"); cv.width = cv.height = 256;
    cv.getContext("2d").drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, 256, 256);
    return new Promise((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error("no image"))), "image/jpeg", 0.88));
  }
  const imgOk = (u8) => u8.length > 11 && ((u8[0] === 0x89 && u8[1] === 0x50) || (u8[0] === 0xff && u8[1] === 0xd8) || (u8[0] === 0x52 && u8[1] === 0x49) || (u8[0] === 0x47 && u8[1] === 0x49));
  const blobToDataUrl = (b) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(b); });

  // ---------- the games ----------
  const apps = new Map(); // slug -> {slug, builtin, manifest, screen, inbound, report, added, art, files(optional cache)}
  const makeApp = (o) => {
    const m = o.manifest, screen = (m.screens || [])[0];
    return Object.assign(o, { screen: screen ? String(screen.entry).replace(/\\/g, "/") : "", inbound: (m.triggers || []).filter((t) => t && t.on === "inbound" && t.id).map((t) => String(t.id)) });
  };
  let builtinIndex = [];
  async function loadApps() {
    apps.clear();
    const installed = await idb("apps", "readonly", (s) => s.getAll());
    for (const r of installed || []) apps.set(r.slug, makeApp({ slug: r.slug, builtin: false, manifest: r.manifest, report: r.report, added: r.added, art: "default", record: r }));
    for (const g of builtinIndex) if (!apps.has(g.slug)) apps.set(g.slug, makeApp({ slug: g.slug, builtin: true, manifest: g.manifest, report: g.report, added: null, art: g.art || "default", list: g.files }));
  }
  const gameCache = new Map();
  async function appFiles(app) { // { path: ArrayBuffer }
    if (app.record) return app.record.files;
    if (gameCache.has(app.slug)) return gameCache.get(app.slug);
    const out = {};
    await Promise.all(app.list.map(async (rel) => { const r = await fetch(`games/${app.slug}/${rel}`); if (r.ok) out[rel] = await r.arrayBuffer(); }));
    gameCache.set(app.slug, out); return out;
  }

  // ---------- a game's screen: one self-contained page, run in a frame that can't reach this page's storage ----------
  const dataUrl = (buf, type) => `data:${type};base64,${NL.b64encode(new Uint8Array(buf))}`;
  const TYPES = { svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg", woff2: "font/woff2", woff: "font/woff", ttf: "font/ttf" };
  const typeOf = (p) => TYPES[(p.split(".").pop() || "").toLowerCase()] || "application/octet-stream";
  const POLY = `(function(){
var F=window.__KR_F||{},B=window.__KR_B||{},D=window.__KR_DIR||"";
function key(u){u=String(u);if(/^([a-z][a-z0-9+.-]*:|\\/\\/|#)/i.test(u))return null;u=u.split(/[?#]/)[0];var parts=(D?D.split("/"):[]).concat(u.split("/")),out=[];for(var i=0;i<parts.length;i++){var p=parts[i];if(!p||p===".")continue;if(p==="..")out.pop();else out.push(p)}return out.join("/")}
function mk(){var m={};return{getItem:function(k){return Object.prototype.hasOwnProperty.call(m,k)?m[k]:null},setItem:function(k,v){m[k]=String(v)},removeItem:function(k){delete m[k]},clear:function(){m={}},key:function(i){return Object.keys(m)[i]||null},get length(){return Object.keys(m).length}}}
["localStorage","sessionStorage"].forEach(function(n){try{window[n].getItem("x")}catch(e){try{Object.defineProperty(window,n,{value:mk(),configurable:true})}catch(e2){}}});
function over(proto,prop,pick){var d=Object.getOwnPropertyDescriptor(proto,prop);if(!d||!d.set)return;Object.defineProperty(proto,prop,{configurable:true,enumerable:d.enumerable,get:d.get,set:function(v){var k=key(v),r=k===null?null:pick.call(this,k);if(r===null||r===undefined)d.set.call(this,v)}})}
over(HTMLScriptElement.prototype,"src",function(k){if(typeof F[k]==="string"){this.text=F[k];this.__kr=1;return 1}return null});
over(HTMLImageElement.prototype,"src",function(k){if(B[k]){Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,"src").set;this.setAttribute("src",B[k]);return 1}return null});
over(HTMLMediaElement.prototype,"src",function(k){if(B[k]){this.setAttribute("src",B[k]);return 1}return null});
var sa=Element.prototype.setAttribute;Element.prototype.setAttribute=function(n,v){if(String(n).toLowerCase()==="src"&&(this instanceof HTMLScriptElement||this instanceof HTMLImageElement||this instanceof HTMLMediaElement)){var k=key(v);if(k!==null&&((this instanceof HTMLScriptElement&&typeof F[k]==="string")||(!(this instanceof HTMLScriptElement)&&B[k]))){this.src=v;return}}return sa.call(this,n,v)};
function fire(n){if(n&&n.__kr&&n.nodeType===1){var s=n;setTimeout(function(){s.dispatchEvent(new Event("load"))},0)}}
var ac=Node.prototype.appendChild;Node.prototype.appendChild=function(n){var r=ac.call(this,n);fire(n);return r};
var ib=Node.prototype.insertBefore;Node.prototype.insertBefore=function(n,x){var r=ib.call(this,n,x);fire(n);return r};
var ap=Element.prototype.append;Element.prototype.append=function(){var a=[].slice.call(arguments),r=ap.apply(this,a);a.forEach(fire);return r};
var A0=window.Audio;window.Audio=function(src){var a=new A0();if(src)a.src=src;return a};
var rf=window.fetch;window.fetch=function(u){var k=typeof u==="string"?key(u):null;if(k!==null){if(typeof F[k]==="string")return Promise.resolve(new Response(F[k]));if(B[k])return rf.call(window,B[k])}return rf?rf.apply(window,arguments):Promise.reject(new TypeError("Network is not available to a game screen here"))};
})();`;
  let SHIM = null;
  async function shimText() { if (SHIM === null) { try { SHIM = await (await fetch("screen-shim.js", { cache: "no-cache" })).text(); } catch { SHIM = ""; } } return SHIM; }
  async function screenDoc(slug) {
    const app = apps.get(slug); if (!app || !app.screen) return "";
    const files = await appFiles(app), dir = NL.path.dirname(app.screen);
    const at = (ref) => { if (!ref || /^(data:|blob:|https?:|\/\/|#)/i.test(ref)) return null; const p = NL.path.join(dir === "." ? "" : dir, ref.split(/[?#]/)[0]).replace(/^\/+/, ""); return files[p] ? p : null; };
    const text = (p) => dec.decode(files[p]);
    const cssFix = (css) => css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (m, q, u) => { const p = at(u); return p ? `url(${dataUrl(files[p], typeOf(p))})` : m; });
    const doc = new DOMParser().parseFromString(text(app.screen), "text/html");
    for (const s of doc.querySelectorAll("script[src]")) { const p = at(s.getAttribute("src")); if (p && s.type !== "module") { s.removeAttribute("src"); s.textContent = text(p).replace(/<\/script/gi, "<\\/script"); } }
    for (const l of doc.querySelectorAll('link[rel~="stylesheet"][href]')) { const p = at(l.getAttribute("href")); if (p) { const st = doc.createElement("style"); st.textContent = cssFix(text(p)); l.replaceWith(st); } }
    for (const st of doc.querySelectorAll("style")) st.textContent = cssFix(st.textContent);
    for (const e of doc.querySelectorAll("img[src],source[src],audio[src],video[src]")) { const p = at(e.getAttribute("src")); if (p) e.setAttribute("src", dataUrl(files[p], typeOf(p))); }
    const head = doc.head || doc.documentElement;
    const csp = doc.createElement("meta"); csp.setAttribute("http-equiv", "Content-Security-Policy");
    csp.setAttribute("content", "default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; font-src data:; worker-src blob:; connect-src 'none'; form-action 'none'");
    // Files the screen loads later (a game's own scripts, data, pictures) are answered from here, since the frame has no web address.
    const T = {}, Bn = {};
    let total = 0;
    for (const [p, buf] of Object.entries(files)) {
      if (buf.byteLength > 1.5 * 1024 * 1024 || total > 12 * 1024 * 1024) continue;
      const ext = (p.split(".").pop() || "").toLowerCase();
      if (/^(js|json|css|txt|html|csv|md|mjs)$/.test(ext)) { T[p] = dec.decode(buf); total += buf.byteLength; }
      else if (TYPES[ext]) { Bn[p] = dataUrl(buf, typeOf(p)); total += buf.byteLength * 1.4; }
    }
    const lit = (o) => JSON.stringify(o).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
    const data = doc.createElement("script");
    data.textContent = `window.__KR_F=${lit(T)};window.__KR_B=${lit(Bn)};window.__KR_DIR=${JSON.stringify(dir === "." ? "" : dir)};`;
    const poly = doc.createElement("script");
    poly.textContent = POLY;
    const shim = doc.createElement("script"); shim.textContent = (await shimText()).replace(/<\/script/gi, "<\\/script");
    head.prepend(shim); head.prepend(poly); head.prepend(data); head.prepend(csp);
    return "<!doctype html>\n" + doc.documentElement.outerHTML;
  }

  // ---------- asking a Kin ----------
  async function askKin(question, kinId, slug) {
    const g = slug ? S.gameKins(cfg, slug) : null;
    if (g && kinId && !g.kins.some((k) => k.id === kinId)) kinId = g.current;
    const kin = cfg.kins.find((k) => k.id === kinId) || (g && cfg.kins.find((k) => k.id === g.current)) || cfg.kins.find((k) => k.id === cfg.currentKin) || cfg.kins[0];
    if (!kin) return { ok: false, error: "Add a Kin on the Characters tab first (Solo needs nothing)." };
    if (!getKey()) return { ok: false, error: "Add your Kindroid API key in Settings first (Solo needs nothing)." };
    try { return { ok: true, text: await KD.ask({ apiKey: getKey(), kin, question, style: cfg.askStyle, playerName: cfg.name }) }; }
    catch (e) { return { ok: false, error: e.message, kind: e.kind }; }
  }

  // ---------- runs (a Web Worker per run), tables (relay links) ----------
  const ms = (t) => { const m = /^(\d+)\s*(s|m|h)?$/.exec(String(t || "").trim()); if (!m) return 5 * 60000; return Number(m[1]) * ({ s: 1000, m: 60000, h: 3600000 }[m[2] || "s"]); };
  async function relaySecrets(slug) {
    const j = (await kvGet("relay:" + slug)) || { secrets: {} }; let changed = false;
    for (const id of apps.get(slug).inbound) if (!/^[0-9a-f]{64}$/.test(j.secrets[id] || "")) { j.secrets[id] = NL.crypto.randomBytes(32).toString("hex"); changed = true; }
    if (changed) await kvSet("relay:" + slug, j);
    return j.secrets;
  }
  async function envFor(slug) {
    const g = S.gameKins(cfg, slug), addrs = {};
    if (cfg.relay && apps.get(slug).inbound.length) for (const [id, sec] of Object.entries(await relaySecrets(slug))) addrs[id] = A.make(cfg.relay, boxOf(sec));
    return { kins: g.kins.map((k) => ({ id: k.id, name: k.name })), current: g.current, addrs };
  }
  class WebRunner {
    constructor(app) { this.app = app; this.chain = Promise.resolve(); this.bgQueued = false; this.wakeTimer = null; this.active = null; }
    action(name, input, kin) { const t = { trigger: "action", action: String(name), input: input && typeof input === "object" ? input : {} }; if (kin) t.kin = kin; return this.enqueue(t); }
    background(trig) { if (this.bgQueued) return; this.bgQueued = true; this.enqueue(trig, () => { this.bgQueued = false; }); }
    enqueue(trig, before) { const p = this.chain.then(() => { if (before) before(); return this.exec(trig); }); this.chain = p.catch(() => {}); return p; }
    async exec(trig) {
      const { slug, manifest } = this.app;
      if (!(manifest.run && manifest.run.entry)) return { ok: false, summary: "This app has no run." };
      const parts = String(manifest.run.entry).trim().split(/\s+/);
      if (parts[0] !== "node") return { ok: false, summary: `Kin Relay can run "node ..." entries only (this app says "${manifest.run.entry}").` };
      const [files, dataFiles, tells, e] = await Promise.all([appFiles(this.app), filesAll(slug), kvGet("tells:" + slug), envFor(slug)]);
      const job = { t: "job", slug, entry: parts[1] || "main.js", appFiles: files, dataFiles, tells: tells == null ? null : tells, trigger: trig,
        env: { KGR_KINS: JSON.stringify(e.kins), KGR_ADDRS: JSON.stringify(e.addrs), KGR_CURRENT_KIN: e.current || "", KGR_SLUG: slug }, timeoutMs: Math.min(ms(manifest.run.timeout), 150000) };
      return new Promise((resolve) => {
        let writes = Promise.resolve(), finished = false;
        const w = new Worker("worker.js"); this.active = w;
        const end = async (r) => { if (finished) return; finished = true; clearTimeout(kill); try { w.terminate(); } catch {} this.active = null; try { await writes; } catch {} resolve(r); };
        const kill = setTimeout(() => end({ ok: false, summary: "The run took too long and was stopped." }), job.timeoutMs + 5000);
        w.onerror = (ev) => end({ ok: false, summary: "The run couldn't start: " + (ev.message || "worker error") });
        w.onmessage = (ev) => {
          const m = ev.data;
          if (m.t === "put") writes = writes.then(() => filesPut(slug, m.path, m.data));
          else if (m.t === "rm") writes = writes.then(() => filesDel(slug, m.path));
          else if (m.t === "tells") writes = writes.then(() => kvSet("tells:" + slug, m.text));
          else if (m.t === "ask") askKin(String(m.question || "").slice(0, 8000), String(m.kin || ""), String(m.slug || slug)).then((a) => { try { w.postMessage({ t: "askr", id: m.id, answer: a }); } catch {} });
          else if (m.t === "done") {
            const res = m.result || { ok: m.code === 0, summary: m.code === 0 ? "" : "The run stopped: " + String(m.stderr || "exit " + m.code).trim().split("\n").slice(-3).join(" ").slice(0, 300), next: null };
            this.schedule(res.next); end({ ok: !!res.ok, summary: res.summary || "" });
          }
        };
        w.postMessage(job);
      });
    }
    schedule(next) { clearTimeout(this.wakeTimer); this.wakeTimer = null; if (!next) return; const at = Date.parse(next); if (!Number.isFinite(at)) return; this.wakeTimer = setTimeout(() => this.background({ trigger: "schedule", wake: true }), Math.min(Math.max(1000, at - Date.now()), 24 * 3600000)); }
    stop() { clearTimeout(this.wakeTimer); if (this.active) try { this.active.terminate(); } catch {} }
  }
  const runners = new Map();
  const runner = (slug) => { if (!runners.has(slug)) runners.set(slug, new WebRunner(apps.get(slug))); return runners.get(slug); };
  const links = new Map();
  async function refreshLinks() {
    for (const l of links.values()) l.stop();
    links.clear();
    if (!cfg.relay) return;
    try { new URL(cfg.relay); } catch { return; }
    for (const app of apps.values()) {
      if (!app.inbound.length) continue;
      const secrets = await relaySecrets(app.slug);
      for (const id of app.inbound) {
        links.set(app.slug + ":" + id, new RL.RelayLink({
          relay: cfg.relay, secret: secrets[id], onStatus: () => {},
          onMessage: async (m) => {
            const name = `inbox/${Date.now()}-${NL.crypto.randomBytes(4).toString("hex")}.json`;
            await filesPut(app.slug, name, toBuf(JSON.stringify({ body: m.body, content_type: m.ct, headers: { "content-type": m.ct } })));
            runner(app.slug).background({ trigger: "inbound", id });
          },
        }));
      }
    }
  }

  // ---------- state ----------
  function publicState() {
    const key = getKey();
    const appList = [...apps.values()].map((a) => ({ slug: a.slug, builtin: !!a.builtin, name: a.manifest.name || a.slug, purpose: a.manifest.purpose || "", art: a.art, screen: !!a.screen, screenFile: a.screen ? NL.path.basename(a.screen) : "", runs: !!(a.manifest.run && a.manifest.run.entry), tables: a.inbound.length > 0, report: a.report, added: a.added || null }));
    const rl = [...links.entries()].map(([k, l]) => ({ app: k.split(":")[0], state: l.state, why: l.why || "" }));
    return {
      version: VERSION, platform: "web", apps: appList, lan: [], ownRelay: false,
      settings: { name: cfg.name, kins: cfg.kins.map((k) => ({ id: k.id, cid: k.cid, name: k.name, ai_id: k.ai_id, share_code: k.share_code, notes: k.notes, avatar: k.avatar, hasDetails: Object.keys(k.details || {}).length > 0 })), currentKin: cfg.currentKin || (cfg.kins[0] || {}).id || "", relay: cfg.relay, ownRelayPort: 8787, askStyle: cfg.askStyle, welcomeDone: !!cfg.welcomeDone },
      games: Object.fromEntries([...apps.keys()].map((slug) => { const g = S.gameKins(cfg, slug); return [slug, { kins: g.kins.map((k) => k.id), current: g.current, chosen: g.chosen }]; })),
      key: key ? { set: true, hint: "kn_…" + key.slice(-4), protection: "device" } : { set: false, protection: "none" },
      desktop: false,
      relay: rl.length ? (rl.every((x) => x.state === "online") ? "online" : rl.some((x) => x.state === "error") ? "error" : "connecting") : (cfg.relay ? "idle" : "off"),
      relayWhy: (rl.find((x) => x.why) || {}).why || "",
      dataFolder: "This device (this app's own storage)",
    };
  }
  const stateOut = async () => { await primeAvatars(); return publicState(); };

  // ---------- the routes (the same as the PC server's) ----------
  const okState = async (o) => Object.assign({ ok: true, state: await stateOut() }, o || {});
  async function exportCharacters(b) {
    const want = Array.isArray(b.cids) && b.cids.length ? new Set(b.cids.map(String)) : null, chars = [];
    for (const k of cfg.kins.filter((k) => !want || want.has(k.cid))) {
      let avatar = ""; if (k.avatar) { const bl = await idb("avatars", "readonly", (s) => s.get(k.cid)); if (bl) avatar = await blobToDataUrl(bl); }
      chars.push({ cid: k.cid, name: k.name, ai_id: k.ai_id, share_code: k.share_code, notes: k.notes, details: k.details, avatar });
    }
    if (!chars.length) return { ok: false, error: "There are no characters to export." };
    const studio = b.format === "studio";
    return { ok: true, count: chars.length, filename: studio ? "kin-studio-characters.json" : "kin-relay-characters.json", file: studio ? IO.toStudioFile(chars) : IO.toRelayFile(chars, "Kin Relay " + VERSION) };
  }
  async function pictureFor(it) {
    try {
      if (typeof it.avatar === "string" && IO.isDataImage(it.avatar)) return await shrink(await (await fetch(it.avatar)).blob());
      if (it.avatar_url && IO.safeAvatarUrl(it.avatar_url)) {
        const r = await fetch(IO.safeAvatarUrl(it.avatar_url), { redirect: "error", referrerPolicy: "no-referrer", signal: AbortSignal.timeout(15000) });
        if (!r.ok) return null; const bl = await r.blob(); if (bl.size > 6 * 1024 * 1024) return null; return await shrink(bl);
      }
    } catch {}
    return null;
  }
  async function importCharacters(b) {
    const items = Array.isArray(b.items) ? b.items.slice(0, 60) : [], res = { added: 0, updated: 0, skipped: 0, pictures: 0, problems: [] };
    for (const it of items) {
      if (!it || typeof it !== "object") continue;
      const ai = S.cleanAiId(it.ai_id), problem = S.aiIdProblem(ai);
      if (problem || /^kn_/i.test(ai)) { res.skipped++; res.problems.push(`${String(it.name || "A character").slice(0, 40)}: ${problem || "not an AI ID"}`); continue; }
      const old = cfg.kins.find((x) => x.ai_id === ai);
      if (old && it.action !== "update") { res.skipped++; continue; }
      if (!old && cfg.kins.length >= 50) { res.skipped++; res.problems.push(`${String(it.name || "A character").slice(0, 40)}: Kin Relay keeps at most 50 characters.`); continue; }
      const fields = { name: it.name, ai_id: ai, share_code: it.share_code, notes: it.notes, details: it.details };
      let c;
      if (old) { c = S.cleanKin(Object.assign({}, old, fields, { cid: old.cid, notes: it.notes ? it.notes : old.notes, share_code: it.share_code || old.share_code, details: Object.assign({}, old.details, IO.cleanDetails(it.details)), avatar: old.avatar })); Object.assign(old, c); res.updated++; }
      else { c = S.cleanKin(Object.assign({}, fields, { cid: "", avatar: false })); c.id = S.kinAlias(ai); cfg.kins.push(c); res.added++; }
      const pic = await pictureFor(it);
      if (pic) { await avatarPut(c.cid, pic); (old || c).avatar = true; res.pictures++; }
      if (!cfg.currentKin) cfg.currentKin = S.kinAlias(ai);
    }
    await save();
    return Object.assign({ ok: true, state: await stateOut() }, res);
  }
  async function installGame(blob, name, replace) {
    if (blob.size > I.LIMITS.download) return { ok: false, error: "That file is too big (over 25 MB)." };
    try {
      scratch.files.clear();
      const buf = Buffer.from(await blob.arrayBuffer());
      const r = I.install(buf, "/games", { replace: true, fileName: name });
      const existing = apps.get(r.slug);
      if (existing && !replace) return { ok: false, conflict: true, slug: r.slug, name: r.name };
      if (existing && existing.builtin) return { ok: false, error: "A game that comes with Kin Relay already has that name. Rename the game's folder name and try again." };
      const files = {}, pre = "/games/" + r.slug + "/";
      for (const [k, v] of scratch.files) if (k.startsWith(pre)) files[k.slice(pre.length)] = v.buffer.slice(v.byteOffset, v.byteOffset + v.length);
      const manifest = JSON.parse(dec.decode(files["kin.json"])); delete files["kinrelay-added.json"];
      const rec = { slug: r.slug, manifest, files, report: r.report, added: new Date().toISOString() };
      await idb("apps", "readwrite", (s) => s.put(rec, r.slug)); scratch.files.clear();
      if (runners.has(r.slug)) { runners.get(r.slug).stop(); runners.delete(r.slug); }
      await loadApps(); await refreshLinks();
      return { ok: true, game: r, state: await stateOut() };
    } catch (e) { scratch.files.clear(); return { ok: false, error: e && e.install ? e.message : "That file couldn't be added: " + (e && e.message ? e.message : "unknown error") }; }
  }
  const safePath = (p) => { const rel = String(p || "").replace(/\\/g, "/").replace(/^\/+/, ""); return !rel || rel.split("/").some((x) => x === ".." || x === "") || rel.length > 300 ? null : rel; };

  async function route(method, url, init) {
    const hdr = (n) => { const h = init && init.headers; if (!h) return ""; if (h.get) return h.get(n) || ""; const k = Object.keys(h).find((x) => x.toLowerCase() === n); return k ? h[k] : ""; };
    const u = new URL(url, location.origin), p = u.pathname;
    if (p === "/api/state") return stateOut();
    if (p === "/api/files/raw") { const slug = u.searchParams.get("slug"); const rel = safePath(u.searchParams.get("path")); const b = rel && apps.has(slug) ? await filesGet(slug, rel) : null; return b ? new Blob([b]) : null; }
    if (p === "/api/install") return installGame(init.body, decodeURIComponent(hdr("x-file-name")), hdr("x-replace") === "1");
    if (p === "/api/avatar") {
      const k = cfg.kins.find((x) => x.cid === hdr("x-cid")); if (!k) return { ok: false, error: "Save the character first." };
      const bl = init.body; if (!(bl && bl.size) || bl.size > 1024 * 1024) return { ok: false, error: "That picture is too big." };
      if (!imgOk(new Uint8Array(await bl.slice(0, 16).arrayBuffer()))) return { ok: false, error: "That isn't a picture Kin Relay can use (PNG, JPEG, WebP or GIF)." };
      await avatarPut(k.cid, bl); k.avatar = true; await save(); return okState();
    }
    const b = init && init.body ? JSON.parse(init.body) : {};
    const app = b.slug ? apps.get(String(b.slug)) : null;
    switch (p) {
      case "/api/settings": {
        if (typeof b.name === "string") cfg.name = b.name.trim().slice(0, 40);
        if (typeof b.currentKin === "string") cfg.currentKin = b.currentKin;
        if (b.askStyle === "chat" || b.askStyle === "quiet") cfg.askStyle = b.askStyle;
        let relayChanged = false;
        if (typeof b.relay === "string") {
          const r = b.relay.trim();
          if (r) { try { const x = new URL(r); if (!/^https?:$/.test(x.protocol)) throw 0; } catch { return { ok: false, error: "A relay address starts with https:// (or http:// on a home network)." }; } }
          relayChanged = r !== cfg.relay; cfg.relay = r;
        }
        if (b.welcomeDone === true) cfg.welcomeDone = true;
        await save(); if (relayChanged) await refreshLinks();
        return okState();
      }
      case "/api/key": {
        if (b.clear) { setKey(""); return okState({ message: "Your key was removed from this device." }); }
        const typed = String(b.apiKey || b.test || "").replace(/[\s\u200b-\u200d\ufeff]/g, "");
        if (b.test !== undefined && !typed && !getKey()) return { ok: false, message: "There's no key to test yet. Paste your key first." };
        const c = await KD.checkKey(typed || getKey());
        if (b.apiKey === undefined) return { ok: c.ok, message: c.message, state: await stateOut() };
        if (!c.ok && c.refused) return { ok: false, message: c.message + " It was not saved." };
        setKey(typed);
        return { ok: c.ok, saved: true, message: c.ok ? "Saved. " + c.message : "Saved, but it couldn't be checked: " + c.message, state: await stateOut() };
      }
      case "/api/character": {
        if (b.op === "delete") {
          const k = cfg.kins.find((x) => x.cid === b.cid); if (!k) return { ok: false, error: "That character is already gone." };
          cfg.kins = cfg.kins.filter((x) => x !== k); await avatarDel(k.cid); await save(); return okState();
        }
        if (b.op === "clearAvatar") { const k = cfg.kins.find((x) => x.cid === b.cid); if (k) { k.avatar = false; await avatarDel(k.cid); await save(); } return okState(); }
        if (b.op === "get") { const k = cfg.kins.find((x) => x.cid === b.cid); return k ? { ok: true, details: k.details || {} } : { ok: false, error: "That character is gone." }; }
        if (b.op === "save") {
          const inK = b.kin || {}, ai = S.cleanAiId(inK.ai_id), problem = S.aiIdProblem(ai);
          if (problem) return { ok: false, field: "ai_id", error: problem };
          if (!String(inK.name || "").trim()) return { ok: false, field: "name", error: "Give your Kin a name." };
          const old = cfg.kins.find((x) => x.cid === inK.cid);
          if (cfg.kins.some((x) => x !== old && x.ai_id === ai)) return { ok: false, field: "ai_id", error: "Another character already uses that AI ID." };
          if (!old && cfg.kins.length >= 50) return { ok: false, error: "That's 50 characters, the most Kin Relay keeps." };
          const c = S.cleanKin(Object.assign({}, inK, { ai_id: ai, cid: old ? old.cid : "", avatar: old ? old.avatar : false, details: inK.details === undefined && old ? old.details : inK.details }));
          c.id = S.kinAlias(ai);
          if (old) Object.assign(old, c); else cfg.kins.push(c);
          if (!cfg.currentKin) cfg.currentKin = c.id;
          await save(); return okState({ cid: c.cid });
        }
        return { ok: false };
      }
      case "/api/export": return exportCharacters(b);
      case "/api/import": return importCharacters(b);
      case "/api/game-kins": {
        if (!app) return { ok: false };
        const ids = new Set(cfg.kins.map((k) => k.id)), list = Array.isArray(b.kins) ? b.kins.map(String).filter((id) => ids.has(id)) : [];
        cfg.games[app.slug] = { kins: list, current: list.includes(String(b.current)) ? String(b.current) : list[0] || "" };
        await save(); return okState();
      }
      case "/api/own-relay": return okState();
      case "/api/files/read": { if (!app) return {}; const rel = safePath(b.path); const v = rel ? await filesGet(app.slug, rel) : null; return { body: v ? dec.decode(v) : null }; }
      case "/api/files/write": { if (!app) return {}; const rel = safePath(b.path); if (!rel) return { ok: false }; await filesPut(app.slug, rel, toBuf(String(b.body == null ? "" : b.body).slice(0, 5 * 1024 * 1024))); return { ok: true }; }
      case "/api/ask": return app ? askKin(String(b.question || "").slice(0, 8000), String(b.kin || ""), app.slug) : {};
      case "/api/action": {
        if (!app) return {};
        if (!(app.manifest.actions || []).map((x) => x.name).includes(String(b.name))) return { ok: false, summary: "This app has no action " + b.name };
        return runner(app.slug).action(b.name, b.input, S.gameKins(cfg, app.slug).current);
      }
      case "/api/open": {
        if (!app) return { ok: false };
        const wakes = (app.manifest.actions || []).some((x) => x.name === "wake");
        if (wakes) Promise.resolve(runner(app.slug).action("wake", {}, S.gameKins(cfg, app.slug).current)).catch(() => {});
        return { ok: true, started: wakes };
      }
      case "/api/reload": await loadApps(); await refreshLinks(); return okState();
      case "/api/remove": {
        if (!app) return { ok: false };
        if (app.builtin) return { ok: false, error: "This game comes with Kin Relay, so it can't be removed." };
        if (runners.has(app.slug)) { runners.get(app.slug).stop(); runners.delete(app.slug); }
        await idb("apps", "readwrite", (s) => s.delete(app.slug)); await loadApps(); await refreshLinks(); return okState();
      }
    }
    return { ok: false };
  }

  // ---------- plugged into the pages ----------
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input && input.url ? input.url : String(input);
    if (typeof url === "string" && url.startsWith("/api/")) { // the pages talk to "/api/..."; here that is answered by the code above, not a server
      await ready;
      const r = await route((init && init.method) || "GET", url, init || {});
      if (r instanceof Blob || r === null) return r ? new Response(r) : new Response(null, { status: 404 });
      return new Response(JSON.stringify(r), { status: 200, headers: { "content-type": "application/json" } });
    }
    return realFetch(input, init);
  };
  const ready = (async () => {
    try { const r = await realFetch("games/index.json"); builtinIndex = r.ok ? (await r.json()).games : []; } catch { builtinIndex = []; }
    cfg = norm(await kvGet("settings"));
    await loadApps();
    refreshLinks();
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch {}
  })();

  window.KR = {
    web: true,
    ready,
    avatarUrl: (k) => avatarUrls.get(k.cid) || "",
    playUrl: (slug) => "play.html?g=" + encodeURIComponent(slug),
    homeUrl: (hash) => "index.html" + (hash || ""),
    slug: () => new URLSearchParams(location.search).get("g") || "",
    asset: (p) => String(p).replace(/^\/+/, ""),
    async openScreen(frame, slug) {
      frame.setAttribute("sandbox", "allow-scripts allow-forms allow-modals allow-popups allow-downloads");
      frame.srcdoc = await screenDoc(slug);
    },
    async saveFile(blob, name) { // the phone app's saver, the share sheet, or a normal download
      if (window.KinRelayAndroid && window.KinRelayAndroid.saveFile) {
        const b64 = (await blobToDataUrl(blob)).split(",")[1];
        window.KinRelayAndroid.saveFile(name, b64); return "saved";
      }
      try { const f = new File([blob], name, { type: blob.type }); if (/iPhone|iPad|iPod/.test(navigator.userAgent) && navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], title: name }); return "shared"; } } catch (e) { if (e && e.name === "AbortError") return "shared"; }
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 30000); return "downloaded";
    },
  };
  window.KinRelayNative = { saveFile: (b, n) => window.KR.saveFile(b, n) };
  if ("serviceWorker" in navigator && location.protocol !== "file:" && !window.KinRelayAndroid) navigator.serviceWorker.register("sw.js").catch(() => {});
})();
