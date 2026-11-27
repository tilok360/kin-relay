/* Kin Backup — a Kindroid Apps screen.
   Data lives in the program's own folder through files.read / files.write (no grants needed):
     index.json            list of saved Kins (name, tags, tagline, bio, thumbnail, dates)
     kin-<id>.json         one Kin's full record (every field, share details, tags)
     avatar-<id>.txt       that Kin's avatar picture as a data URL (empty when none)
     gallery-<id>-<pic>.txt  extra pictures (full body, selfie, and others) as data URLs
     kin-backup-export.json  written only when the person asks for a download link (served by "links")
   Pictures are the actual image data, kept in the app's own files. Everything that came from
   saved data is put on the page as text, never as HTML. */
(function () {
  "use strict";

  // ---------- Field list ----------
  const FIELDS = [
    { key: "who_they_are", label: "Who they are", group: "about", cap: 0, rows: 6 },
    { key: "physical_description", label: "Physical description", group: "about", cap: 0, rows: 5 },

    { key: "avatar_generator", label: "Avatar generator", group: "kindroid", cap: 250, note: "avatar photo prompt", rows: 3 },
    { key: "avatar_description", label: "Avatar description", group: "kindroid", cap: 800, note: "selfie engine", rows: 4 },
    { key: "avatar_bridge", label: "Avatar bridge prompt", group: "kindroid", cap: 2000, note: "selfie prompt after uploading an outside avatar photo", rows: 4, optional: true },
    { key: "backstory", label: "Backstory", group: "kindroid", cap: 2500, note: "personality and backstory box", rows: 10 },
    { key: "key_memories", label: "Key memories", group: "kindroid", cap: 1000, rows: 6 },
    { key: "additional_context", label: "Additional context", group: "kindroid", cap: 2500, note: "Ultra cap; MAX 5,000", rows: 8 },
    { key: "response_directive", label: "Response directive", group: "kindroid", cap: 250, rows: 3 },
    { key: "example_messages", label: "Example messages", group: "kindroid", cap: 750, rows: 5 },
    { key: "greeting", label: "Greeting", group: "kindroid", cap: 750, rows: 5 },
    { key: "ongoing_thread", label: "Ongoing thread", group: "kindroid", cap: 800, rows: 5 },
    { key: "voice_description", label: "Voice description", group: "kindroid", cap: 1000, note: "how they sound", rows: 5 },

    { key: "listing_tags", label: "Tags", group: "listing", cap: 100, note: "listing", rows: 2 },
    { key: "tagline", label: "Tagline", group: "listing", cap: 100, note: "listing", rows: 2 },
    { key: "bio", label: "Bio", group: "listing", cap: 200, note: "listing", rows: 3 },
    { key: "contribution_instructions", label: "Contribution instructions", group: "listing", cap: 500, note: "listing", rows: 4 },
    { key: "authors_note", label: "Author's note", group: "listing", cap: 2000, note: "listing; users see it", rows: 6 },

    { key: "notes", label: "Private notes", group: "notes", cap: 0, note: "only for you", rows: 4 }
  ];
  const GROUPS = [
    { id: "about", title: "About" },
    { id: "kindroid", title: "Kindroid fields" },
    { id: "listing", title: "Sharing listing" },
    { id: "notes", title: "Notes" }
  ];
  const SHARE = [
    { key: "kin_id", label: "Kin ID" },
    { key: "share_code", label: "Share code" },
    { key: "share_link", label: "Share link" }
  ];
  const STATUS_TAGS = ["Featured", "Shared", "Not shared"];
  // Kept with each Kin but never shown as a field: where a codex card came from, and older texts.
  const META = ["codex_id", "history", "social", "social_handle", "avatar_pending", "gallery"];
  const PIC_MAX_BYTES = 6 * 1048576, PIC_MAX_SIDE = 2048, GALLERY_MAX = 8;
  const PIC_LIMIT = "Pictures are kept at full quality up to 2,048 pixels on the long side or 6 MB. Larger ones are scaled down so they still fit.";
  const PIC_KINDS = [{ id: "avatar", label: "Avatar" }, { id: "full-body", label: "Full body" }, { id: "selfie", label: "Selfie" }, { id: "other", label: "Extra" }];
  const socialOf = (k) => (k && k.social === "yes" ? "yes" : "no");
  const socialLabel = (k) => socialOf(k) === "yes" ? (k.social_handle ? "Social · " + shortHandle(k.social_handle) : "Has social") : "No social yet";
  const shortHandle = (s) => String(s || "").trim().replace(/^https?:\/\/(www\.)?/i, "").slice(0, 40);
  const kindLabel = (id) => (PIC_KINDS.find((x) => x.id === id) || { label: "Extra" }).label;
  const HISTORY_KEEP = 10; // older versions kept per field
  const HISTORY_KEYS = ["name"].concat(SHARE.map((s) => s.key), FIELDS.map((f) => f.key));

  // ---------- Prompt library ----------
  const PROMPT_TYPES = [
    { id: "Selfie", cap: 2000 }, { id: "Group selfie", cap: 600 }, { id: "Video", cap: 1000 },
    { id: "Avatar generator", cap: 250 }, { id: "Other", cap: 0 }
  ];
  const SIZES = ["", "1:1", "2:3", "3:2"];
  const SIZE_NAMES = { "1:1": "1:1 square", "2:3": "2:3 portrait", "3:2": "3:2 landscape" };
  const typeCap = (t) => (PROMPT_TYPES.find((x) => x.id === t) || { cap: 0 }).cap;

  // Names other files may use for the same field (lower case, spaces and marks turned to "_").
  const ALIASES = {
    personality: "backstory", backstory_personality: "backstory", personality_and_backstory: "backstory",
    memory: "key_memories", memories: "key_memories", keymemories: "key_memories",
    directive: "response_directive", responsedirective: "response_directive",
    examples: "example_messages", example_message: "example_messages", example: "example_messages",
    additional: "additional_context", additional_info: "additional_context", context: "additional_context",
    first_message: "greeting", opening_message: "greeting",
    thread: "ongoing_thread", current_thread: "ongoing_thread",
    voice: "voice_description", voice_profile: "voice_description", voice_desc: "voice_description",
    avatar_gen: "avatar_generator", avatar_prompt: "avatar_generator",
    avatar_desc: "avatar_description", appearance: "avatar_description",
    avatar_bridge_prompt: "avatar_bridge", bridge_prompt: "avatar_bridge",
    who: "who_they_are", about: "who_they_are", who_they_are_: "who_they_are",
    physical: "physical_description", look: "physical_description",
    author_s_note: "authors_note", author_note: "authors_note", authors_notes: "authors_note",
    contribution: "contribution_instructions", instructions: "contribution_instructions",
    description: "bio", short_bio: "bio",
    kindroid_tags: "listing_tags", listing_tag: "listing_tags",
    note: "notes", private_notes: "notes",
    kinid: "kin_id", kindroid_id: "kin_id", ai_id: "kin_id",
    sharecode: "share_code", code: "share_code",
    sharelink: "share_link", share_url: "share_link", link: "share_link", url: "share_link",
    title: "name", kin_name: "name", character: "name",
    image: "avatar", avatar_image: "avatar", picture: "avatar", avatar_url: "avatar", photo: "avatar",
    labels: "tags", backup_tags: "tags", status: "tags"
  };

  // ---------- Helpers ----------
  const $ = (id) => document.getElementById(id);
  function el(tag, attrs, ...kids) {
    const n = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === "class") n.className = v;
      else if (k === "text") n.textContent = v;
      else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? "" : String(v));
    }
    for (const kid of kids.flat()) {
      if (kid == null || kid === false) continue;
      n.appendChild(typeof kid === "string" ? document.createTextNode(kid) : kid);
    }
    return n;
  }
  const len = (s) => Array.from(s || "").length;
  const fmt = (n) => n.toLocaleString("en-US");
  const now = () => new Date().toISOString();
  const newId = () => "k" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const normKey = (k) => String(k).trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  const kb = (s) => { const b = new Blob([s]).size; return b > 1048576 ? (b / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(b / 1024)) + " KB"; };
  const blankKin = () => {
    const k = { id: newId(), name: "", tags: ["Not shared"], avatar: "", social: "no", social_handle: "", avatar_pending: "", gallery: [], codex_id: "", history: {}, created: now(), updated: now() };
    for (const s of SHARE) k[s.key] = "";
    for (const f of FIELDS) k[f.key] = "";
    return k;
  };
  function dateText(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    return isNaN(d) ? "" : d.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  }
  function tagClass(t) {
    const n = t.toLowerCase();
    return n === "featured" ? "tag featured" : n === "shared" ? "tag shared" : n === "not shared" ? "tag notshared" : "tag";
  }
  function cleanTags(list) {
    const out = [], seen = new Set();
    for (let t of list || []) {
      t = String(t).trim().replace(/\s+/g, " ");
      if (!t) continue;
      const canon = STATUS_TAGS.find((s) => s.toLowerCase() === t.toLowerCase()) || t;
      if (seen.has(canon.toLowerCase())) continue;
      seen.add(canon.toLowerCase()); out.push(canon);
    }
    // Shared and Not shared exclude each other: the later one wins.
    const iS = out.lastIndexOf("Shared"), iN = out.lastIndexOf("Not shared");
    if (iS >= 0 && iN >= 0) out.splice(iS < iN ? iS : iN, 1);
    return out;
  }

  // ---------- Platform bridge ----------
  const inFrame = window.parent && window.parent !== window;
  const memory = new Map(); // used only when the page is opened outside Kindroid
  let reqSeq = 0;
  const pending = new Map();

  window.addEventListener("message", (ev) => {
    const m = ev.data;
    if (!m || typeof m !== "object" || typeof m.kin !== "string") return;
    if (m.kin === "kins") { setAttached(m); if (m.id == null) { resolveByKind("kins", m); return; } }
    let key = m.id != null && pending.has(m.id) ? m.id : null;
    if (key == null) { // answer without an id: match the oldest request of the same kind and path
      for (const [k, p] of pending) if (p.kind === m.kin && (p.path == null || p.path === m.path)) { key = k; break; }
    }
    if (key == null) return;
    const p = pending.get(key); pending.delete(key); clearTimeout(p.timer); p.resolve(m);
  });
  function resolveByKind(kind, m) {
    for (const [k, p] of pending) if (p.kind === kind) { pending.delete(k); clearTimeout(p.timer); p.resolve(m); return; }
  }
  function request(msg, timeoutMs) {
    return new Promise((resolve, reject) => {
      const id = ++reqSeq;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error("Kindroid did not answer in time.")); }, timeoutMs || 20000);
      pending.set(id, { kind: msg.kin, path: msg.path, resolve, timer });
      parent.postMessage(Object.assign({ id }, msg), "*");
    });
  }
  const files = {
    async read(path) {
      if (!inFrame) return memory.has(path) ? memory.get(path) : null;
      const m = await request({ kin: "files.read", path });
      const b = m.body;
      if (b == null) return null;
      if (typeof b === "string") return b;
      if (b instanceof Blob) return await b.text();
      return JSON.stringify(b);
    },
    async write(path, body) {
      if (!inFrame) { memory.set(path, body); return true; }
      const m = await request({ kin: "files.write", path, body }, 60000);
      if (!m.ok) throw new Error("Saving " + path + " failed.");
      return true;
    }
  };
  // Writes go one at a time so the index never races itself.
  let writeChain = Promise.resolve();
  function queueWrite(path, body) {
    const p = writeChain.then(() => files.write(path, body));
    writeChain = p.catch(() => {});
    return p;
  }

  // Quit waits for saves already under way to finish.
  window.kinBackupIdle = () => writeChain;

  // Kins attached to this app copy (for filling in a Kin ID).
  let attached = { kins: [], current: null };
  function setAttached(m) {
    if (!m || !m.ok) return;
    attached = { kins: Array.isArray(m.kins) ? m.kins : [], current: typeof m.current === "string" ? m.current : null };
  }

  // ---------- Library ----------
  let meta = { log: [] }; // backup activity: [{at, kind, size, count, name}], newest first
  let index = []; // [{id,name,tags,tagline,bio,listing_tags,kin_id,thumb,updated,created}]
  const cache = new Map(); // id -> full kin (without avatar)
  const avatarCache = new Map(); // id -> data URL
  const galleryCache = new Map(); // id -> [{id,kind,label,src}]

  function summary(k, thumb) {
    return { id: k.id, name: k.name, tags: k.tags, tagline: k.tagline, bio: k.bio, listing_tags: k.listing_tags,
             kin_id: k.kin_id, share_code: k.share_code, codex_id: k.codex_id || "", thumb: thumb || "", size: k.size || 0,
             social: socialOf(k), social_handle: k.social_handle || "", pending: k.avatar_pending || "", created: k.created, updated: k.updated };
  }
  async function loadIndex() {
    try {
      const raw = await files.read("index.json");
      const data = raw ? JSON.parse(raw) : null;
      index = data && Array.isArray(data.kins) ? data.kins : [];
      meta = { log: data && Array.isArray(data.log) ? data.log.slice(0, 20) : [] };
    } catch (e) {
      index = [];
      toast("Could not read the saved list: " + e.message);
    }
  }
  function saveIndex() { return queueWrite("index.json", JSON.stringify({ app: "kin-backup", version: 1, kins: index, log: meta.log })); }

  async function loadKin(id) {
    if (cache.has(id)) return cache.get(id);
    const raw = await files.read("kin-" + id + ".json");
    if (!raw) throw new Error("This Kin's file is missing.");
    const k = normalizeKin(JSON.parse(raw), true);
    k.id = id;
    cache.set(id, k);
    return k;
  }
  // Pictures are kept only as picture data (data:image/...;base64). A web address or anything else is
  // dropped, so the screen never tries to reach a host it has no grant for.
  const isPicture = (s) => typeof s === "string" && /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+\/=\s]+$/i.test(s.trim());
  async function loadAvatar(id) {
    if (avatarCache.has(id)) return avatarCache.get(id);
    let a = "";
    try { a = (await files.read("avatar-" + id + ".txt")) || ""; } catch (e) { a = ""; }
    if (!isPicture(a)) a = "";
    avatarCache.set(id, a);
    return a;
  }
  async function saveKin(k, avatar, avatarChanged, galleryItems) {
    const prev = cache.get(k.id);
    k.history = addHistory(prev ? Object.assign({}, prev, { history: k.history || prev.history }) : { history: k.history }, k);
    k.updated = now();
    k.tags = cleanTags(k.tags);
    k.social = socialOf(k);
    k.social_handle = String(k.social_handle || "").trim().slice(0, 200);
    if (k.social !== "yes") k.social_handle = k.social_handle; // handle is kept even if they switch off, so turning it back on still has it
    if (avatar && k.avatar_pending) k.avatar_pending = "";
    const items = galleryItems != null ? galleryItems : (galleryCache.has(k.id) ? galleryCache.get(k.id) : null);
    if (items) {
      const prevIds = new Set((prev && prev.gallery || []).map((g) => g.id));
      const nextIds = new Set(items.map((g) => g.id));
      await writeGallery(k.id, items, [...prevIds].filter((id) => !nextIds.has(id)));
      k.gallery = galleryMeta(items);
    } else if (!Array.isArray(k.gallery)) k.gallery = [];
    const rec = Object.assign({}, k); delete rec.avatar; delete rec._hadTags; delete rec._srcId; delete rec._importGallery;
    const body = JSON.stringify(rec);
    await queueWrite("kin-" + k.id + ".json", body);
    let thumb = (index.find((x) => x.id === k.id) || {}).thumb || "";
    if (avatarChanged) {
      await queueWrite("avatar-" + k.id + ".txt", avatar || "");
      avatarCache.set(k.id, avatar || "");
      thumb = avatar ? await makeThumb(avatar).catch(() => "") : "";
    }
    cache.set(k.id, rec);
    const picLen = (avatarChanged ? (avatar || "").length : (avatarCache.has(k.id) ? (avatarCache.get(k.id) || "").length : ((index.find((x) => x.id === k.id) || {}).pic || 0)))
      + (items ? galleryBytes(items) : 0);
    const s = summary(Object.assign({}, rec, { size: body.length + picLen }), thumb); s.pic = picLen;
    const i = index.findIndex((x) => x.id === k.id);
    if (i >= 0) index[i] = s; else index.push(s);
    updateCount();
    await saveIndex();
  }
  async function deleteKin(id) {
    const gone = cache.get(id);
    const pics = (gone && gone.gallery) || (galleryCache.get(id) || []).map((g) => ({ id: g.id }));
    index = index.filter((x) => x.id !== id);
    cache.delete(id); avatarCache.delete(id); galleryCache.delete(id);
    await saveIndex();
    // The platform has no delete message for screens, so the files are emptied instead.
    await queueWrite("kin-" + id + ".json", "");
    await queueWrite("avatar-" + id + ".txt", "");
    for (const g of pics) await queueWrite("gallery-" + id + "-" + g.id + ".txt", "");
    // Its prompts stay in the library, no longer linked to a card.
    let changed = false;
    for (const p of prompts) if (p.kin === id) { p.kin = ""; changed = true; }
    if (changed) await savePrompts();
  }

  // ---------- Prompt library storage (prompts.json) ----------
  let prompts = []; // [{id,title,text,kin,kin_name,type,size,model,nsfw,fav,tags,context,source,ref,created,updated}]
  function normalizePrompt(src) {
    const s = (v) => (v == null ? "" : typeof v === "string" ? v : String(v));
    const p = {
      id: s(src.id) || "p" + newId().slice(1), title: s(src.title || src.name).trim(), text: s(src.text || src.prompt),
      kin: s(src.kin), kin_name: s(src.kin_name).trim(),
      type: PROMPT_TYPES.some((t) => t.id === src.type) ? src.type : "Selfie",
      size: SIZES.includes(src.size) ? src.size : "", model: s(src.model).trim() || "Vignette",
      nsfw: src.nsfw === true || src.nsfw === "true", fav: src.fav === true || src.fav === "true",
      tags: cleanTags(Array.isArray(src.tags) ? src.tags : s(src.tags).split(",")).filter((t) => !STATUS_TAGS.includes(t)),
      context: s(src.context), source: s(src.source), ref: s(src.ref),
      created: s(src.created) || now(), updated: s(src.updated) || now()
    };
    if (!p.title) p.title = p.text.trim().split(/\s+/).slice(0, 8).join(" ") || "Untitled prompt";
    return p;
  }
  async function loadPrompts() {
    try {
      const raw = await files.read("prompts.json");
      const data = raw ? JSON.parse(raw) : null;
      prompts = data && Array.isArray(data.prompts) ? data.prompts.map(normalizePrompt) : [];
    } catch (e) { prompts = []; toast("Could not read the prompt library: " + e.message); }
  }
  function savePrompts() {
    const w = queueWrite("prompts.json", JSON.stringify({ app: "kin-backup", version: 1, prompts }));
    updateTabs(); updateCount();
    return w;
  }
  async function savePrompt(p) {
    p.updated = now();
    const i = prompts.findIndex((x) => x.id === p.id);
    if (i >= 0) prompts[i] = p; else prompts.push(p);
    await savePrompts();
  }
  async function deletePrompt(id) { prompts = prompts.filter((x) => x.id !== id); await savePrompts(); }
  const kinName = (id) => (index.find((x) => x.id === id) || {}).name || "";
  const promptsOf = (kinId) => prompts.filter((p) => p.kin === kinId);
  // Same or nearly the same text as another prompt (4-word shingles, half or more shared).
  function shingles(t) {
    const w = String(t || "").toLowerCase().replace(/[^\p{L}\p{N}\s]+/gu, " ").split(/\s+/).filter(Boolean), out = new Set();
    for (let i = 0; i + 4 <= w.length; i++) out.add(w.slice(i, i + 4).join(" "));
    return out;
  }
  function nearDuplicate(p) {
    const a = shingles(p.text); if (a.size < 3) return null;
    for (const q of prompts) {
      if (q.id === p.id) continue;
      const b = shingles(q.text); if (!b.size) continue;
      let common = 0; for (const s of a) if (b.has(s)) common++;
      if (common / Math.min(a.size, b.size) >= 0.5) return q;
    }
    return null;
  }

  // ---------- Pictures ----------
  function loadImage(src) {
    if (!isPicture(src)) return Promise.reject(new Error("That picture could not be opened."));
    return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error("That picture could not be opened.")); im.src = src; });
  }
  async function makeThumb(src) {
    const im = await loadImage(src);
    const S = 112, c = document.createElement("canvas"); c.width = S; c.height = S;
    const side = Math.min(im.naturalWidth, im.naturalHeight);
    const sx = (im.naturalWidth - side) / 2, sy = Math.max(0, (im.naturalHeight - side) / 4);
    c.getContext("2d").drawImage(im, sx, sy, side, side, 0, 0, S, S);
    return c.toDataURL("image/jpeg", 0.8);
  }
  function readFile(file, as) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result); r.onerror = () => rej(new Error("The file could not be read."));
      as === "text" ? r.readAsText(file) : r.readAsDataURL(file);
    });
  }
  // Keeps the picture as it is up to 2,048 px and 6 MB; larger ones are scaled down (JPEG). The limit is shown in the UI.
  async function pictureFromFile(file) {
    const type = file.type || PIC_TYPES[(file.name.split(".").pop() || "").toLowerCase()] || "";
    if (!/^image\/(jpeg|png|webp|gif)$/i.test(type) && !/^image\//.test(type))
      throw new Error("Choose a JPEG, PNG, WebP or GIF picture. " + PIC_LIMIT);
    const url = await readFile(file, "url");
    if (!isPicture(url)) throw new Error("That file is not a picture Kin Backup can keep. " + PIC_LIMIT);
    let long = 0;
    try { const im = await loadImage(url); long = Math.max(im.naturalWidth, im.naturalHeight); } catch (e) { throw new Error("That picture could not be opened."); }
    if (file.size <= PIC_MAX_BYTES && long <= PIC_MAX_SIDE) return url;
    const im = await loadImage(url);
    const r = Math.min(1, PIC_MAX_SIDE / Math.max(im.naturalWidth, im.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(im.naturalWidth * r)); c.height = Math.max(1, Math.round(im.naturalHeight * r));
    c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
    for (const q of [0.92, 0.85, 0.75, 0.62]) {
      const out = c.toDataURL("image/jpeg", q);
      const bytes = Math.ceil((out.length - out.indexOf(",") - 1) * 0.75);
      if (bytes <= PIC_MAX_BYTES) {
        toast("This picture was larger than 2,048 pixels or 6 MB, so it was scaled to " + c.width + "×" + c.height + ".");
        return out;
      }
    }
    throw new Error("That picture is still too large after scaling. Try a smaller file. " + PIC_LIMIT);
  }
  function dataUrlBytes(url) {
    const i = String(url).indexOf(",");
    if (i < 0) return new Uint8Array();
    const bin = atob(String(url).slice(i + 1).replace(/\s/g, ""));
    const u = new Uint8Array(bin.length);
    for (let n = 0; n < bin.length; n++) u[n] = bin.charCodeAt(n);
    return u;
  }
  function dataUrlExt(url) {
    return ((String(url).match(/^data:image\/(png|jpeg|webp|gif)/) || [, "jpeg"])[1] || "jpeg").replace("jpeg", "jpg");
  }
  function newPicId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  async function loadGallery(k) {
    if (!k) return [];
    if (galleryCache.has(k.id)) return galleryCache.get(k.id);
    const items = [];
    for (const g of k.gallery || []) {
      if (!g || !g.id) continue;
      let src = "";
      try { src = (await files.read("gallery-" + k.id + "-" + g.id + ".txt")) || ""; } catch (e) { src = ""; }
      if (isPicture(src)) items.push({ id: String(g.id), kind: PIC_KINDS.some((x) => x.id === g.kind) ? g.kind : "other", label: String(g.label || ""), src });
    }
    galleryCache.set(k.id, items);
    return items;
  }
  async function writeGallery(kinId, items, removed) {
    for (const id of removed || []) await queueWrite("gallery-" + kinId + "-" + id + ".txt", "");
    for (const g of items || []) {
      if (g.src && g._dirty) await queueWrite("gallery-" + kinId + "-" + g.id + ".txt", g.src);
    }
    galleryCache.set(kinId, (items || []).map((g) => ({ id: g.id, kind: g.kind, label: g.label || "", src: g.src })));
  }
  function galleryMeta(items) {
    return (items || []).map((g) => ({ id: g.id, kind: g.kind || "other", label: g.label || "" }));
  }
  function galleryBytes(items) {
    return (items || []).reduce((n, g) => n + (g.src ? g.src.length : 0), 0);
  }
  function socialChip(k) {
    return el("span", { class: "tag social " + (socialOf(k) === "yes" ? "yes" : "no"), text: socialLabel(k) });
  }
  function bindDrop(node, onFile) {
    node.addEventListener("dragover", (e) => { e.preventDefault(); node.classList.add("over"); });
    node.addEventListener("dragleave", (e) => { if (!node.contains(e.relatedTarget)) node.classList.remove("over"); });
    node.addEventListener("drop", (e) => {
      e.preventDefault(); node.classList.remove("over");
      const f = [...(e.dataTransfer.files || [])].find((x) => /^image\//.test(x.type) || /\.(jpe?g|png|webp|gif)$/i.test(x.name));
      if (f) onFile(f); else toast("Drop a JPEG, PNG, WebP or GIF picture. " + PIC_LIMIT);
    });
  }
  function fileFromPaste(e) {
    const items = e.clipboardData && e.clipboardData.items;
    if (!items) return null;
    for (const it of items) if (it.kind === "file" && /^image\//.test(it.type)) return it.getAsFile();
    return null;
  }
  // CRC32 + zip (store only) so an export can be a folder of JSON + pictures, not only a JSON file.
  const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; } return t; })();
  function crc32(u8) { let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = CRC_TABLE[(c ^ u8[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
  function zipStore(files) {
    const enc = new TextEncoder(), chunks = [];
    let offset = 0, cdLen = 0;
    const centrals = [];
    for (const f of files) {
      const name = enc.encode(f.name), data = f.data, crc = crc32(data);
      const lh = new Uint8Array(30 + name.length), v = new DataView(lh.buffer);
      v.setUint32(0, 0x04034b50, true); v.setUint16(4, 20, true);
      v.setUint32(14, crc, true); v.setUint32(18, data.length, true); v.setUint32(22, data.length, true); v.setUint16(26, name.length, true);
      lh.set(name, 30); chunks.push(lh, data);
      const ch = new Uint8Array(46 + name.length), w = new DataView(ch.buffer);
      w.setUint32(0, 0x02014b50, true); w.setUint16(4, 20, true); w.setUint16(6, 20, true);
      w.setUint32(16, crc, true); w.setUint32(20, data.length, true); w.setUint32(24, data.length, true); w.setUint16(28, name.length, true); w.setUint32(42, offset, true);
      ch.set(name, 46); centrals.push(ch); offset += lh.length + data.length;
    }
    for (const c of centrals) { chunks.push(c); cdLen += c.length; }
    const eocd = new Uint8Array(22), e = new DataView(eocd.buffer);
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true);
    e.setUint32(12, cdLen, true); e.setUint32(16, offset, true);
    chunks.push(eocd);
    return new Blob(chunks, { type: "application/zip" });
  }
  async function saveBlobToDevice(filename, blob) {
    if (inFrame) {
      try { const m = await request({ kin: "save", name: filename, body: blob }, 120000); if (m.ok) return true; }
      catch (e) { /* Kindroid's phone apps answer no; fall through to a download link */ }
    }
    try {
      const url = URL.createObjectURL(blob);
      const a = el("a", { href: url, download: filename }); document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      return true;
    } catch (e) { return false; }
  }
  function openLite(src, caption, filename) {
    const layer = $("lightbox"); if (!layer) return;
    $("liteimg").src = src; $("liteimg").alt = caption || "Picture";
    $("litecap").textContent = caption || "";
    $("litesave").onclick = (e) => { e.stopPropagation(); savePictureToDevice(filename || caption || "kin", src, ""); };
    layer.hidden = false; $("liteclose").focus();
  }
  function thumbNode(name, src, big) {
    const box = el("div", { class: "thumb" + (big ? " avatar-big" : ""), "aria-hidden": "true" });
    if (isPicture(src)) { const im = el("img", { alt: "" }); im.src = src; im.onerror = () => { box.textContent = initials(name); }; box.appendChild(im); }
    else box.textContent = initials(name);
    return box;
  }
  const initials = (name) => (String(name || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0] || "").join("").toUpperCase() || "?");

  // ---------- Copy and save to device ----------
  async function copyText(text, label) {
    let ok = false;
    try { if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(text); ok = true; } } catch (e) { ok = false; }
    if (!ok) {
      const ta = el("textarea", { style: "position:fixed;left:-9999px;top:0;opacity:0" }); ta.value = text;
      document.body.appendChild(ta); ta.focus(); ta.select();
      try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
      ta.remove();
    }
    toast(ok ? "Copied " + (label || "text") : "Copying is blocked here. Press and hold the text to copy it.");
    return ok;
  }
  function saveToDevice(filename, text, type) {
    try {
      const url = URL.createObjectURL(new Blob([text], { type: type || "application/json" }));
      const a = el("a", { href: url, download: filename }); document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      return true;
    } catch (e) { return false; }
  }
  function savePictureToDevice(name, dataUrl, suffix) {
    const ext = dataUrlExt(dataUrl);
    const filename = (safeName(name) || "kin") + (suffix != null && suffix !== "" ? suffix : "-avatar") + "." + ext;
    const blob = new Blob([dataUrlBytes(dataUrl)], { type: "image/" + (ext === "jpg" ? "jpeg" : ext) });
    saveBlobToDevice(filename, blob).then((ok) => {
      toast(ok ? "Saving " + filename + ". If nothing starts, press and hold the picture to save it." : "Saving is blocked here. Press and hold the picture to save it.");
    });
  }
  const localDate = () => { const d = new Date(), p = (n) => String(n).padStart(2, "0"); return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()); };
  const safeName = (s) => String(s || "").trim().replace(/[^\w\- ]+/g, "").replace(/\s+/g, "-").slice(0, 60);

  // ---------- Import / export format ----------
  function normalizeKin(src, keepId) {
    const k = blankKin();
    if (!src || typeof src !== "object") return k;
    let srcFields = src;
    if (src.fields && typeof src.fields === "object") srcFields = Object.assign({}, src, src.fields);
    let hadTags = false;
    const extras = [];
    const known = new Set(["id", "name", "tags", "avatar", "created", "updated"].concat(META, SHARE.map((s) => s.key), FIELDS.map((f) => f.key)));
    for (const [rawKey, val] of Object.entries(srcFields)) {
      let key = normKey(rawKey);
      if (!known.has(key) && ALIASES[key]) key = ALIASES[key];
      if (!known.has(key)) {
        // Keep any other text the file holds (for example a facial description, gender or NSFW notes) in Private notes.
        if (typeof val === "string" && val.trim() && !/^(app|version|exported|count|fields|kins)$/.test(key))
          extras.push(String(rawKey).replace(/[_-]+/g, " ").replace(/^./, (c) => c.toUpperCase()) + ": " + val.trim());
        continue;
      }
      if (key === "tags") {
        hadTags = true;
        const arr = Array.isArray(val) ? val : String(val || "").split(",");
        // A plain-text "tags" value that is not a status list is the Kindroid listing tags.
        const asStatus = arr.map((t) => String(t).trim()).filter(Boolean);
        if (!Array.isArray(val) && asStatus.some((t) => !STATUS_TAGS.some((s) => s.toLowerCase() === t.toLowerCase())) && !k.listing_tags) {
          k.listing_tags = String(val);
        } else k.tags = asStatus;
        continue;
      }
      if (key === "id") { if (keepId && val) k.id = String(val); else if (val) k._srcId = String(val); continue; }
      if (key === "history") { k.history = cleanHistory(val); continue; }
      if (key === "social") { k.social = val === "yes" || val === true ? "yes" : "no"; continue; }
      if (key === "social_handle") { k.social_handle = String(val || "").trim().slice(0, 200); continue; }
      if (key === "avatar_pending") { k.avatar_pending = String(val || "").trim().slice(0, 500); continue; }
      if (key === "gallery") {
        const rows = Array.isArray(val) ? val : [];
        k.gallery = [];
        k._importGallery = [];
        rows.forEach((g, i) => {
          if (!g || typeof g !== "object") return;
          const src = typeof g.image === "string" ? g.image : typeof g.src === "string" ? g.src : typeof g.avatar === "string" ? g.avatar : "";
          const kind = PIC_KINDS.some((x) => x.id === g.kind) ? g.kind : "other";
          const id = String(g.id || "g" + i);
          const label = String(g.label || "");
          k.gallery.push({ id, kind, label });
          if (isPicture(src)) k._importGallery.push({ id, kind, label, src });
        });
        if (!k._importGallery.length) delete k._importGallery;
        continue;
      }
      if (key === "created" || key === "updated") { if (val) k[key] = String(val); continue; }
      if (key === "example_messages" && Array.isArray(val)) { k[key] = val.map(String).join("\n"); continue; }
      k[key] = val == null ? "" : typeof val === "string" ? val : Array.isArray(val) ? val.map(String).join("\n") : typeof val === "object" ? JSON.stringify(val) : String(val);
    }
    if (extras.length) k.notes = (k.notes ? k.notes + "\n\n" : "") + extras.join("\n\n");
    k.tags = cleanTags(hadTags ? k.tags : ["Not shared"]);
    if (!keepId) k._hadTags = hadTags;
    return k;
  }
  // Older texts: { field: [{ at, text }] }, newest first.
  function cleanHistory(h) {
    const out = {};
    if (!h || typeof h !== "object" || Array.isArray(h)) return out;
    for (const key of HISTORY_KEYS) {
      if (!Array.isArray(h[key])) continue;
      const list = h[key].filter((x) => x && typeof x.text === "string").map((x) => ({ at: String(x.at || ""), text: x.text })).slice(0, HISTORY_KEEP);
      if (list.length) out[key] = list;
    }
    return out;
  }
  // Puts each changed text into the history before the new one replaces it.
  function addHistory(prev, next) {
    const h = cleanHistory(prev && prev.history);
    if (prev) for (const key of HISTORY_KEYS) {
      const was = prev[key] == null ? "" : String(prev[key]), is = next[key] == null ? "" : String(next[key]);
      if (!was || was === is) continue;
      const list = (h[key] || []).filter((x) => x.text !== was && x.text !== is);
      list.unshift({ at: prev.updated || now(), text: was });
      h[key] = list.slice(0, HISTORY_KEEP);
    }
    return h;
  }
  function parseImport(text, opts) {
    let data;
    try { data = JSON.parse(text.replace(/^\uFEFF/, "")); } catch (e) { throw new Error("This is not valid JSON: " + e.message); }
    return parseData(data, opts || {});
  }
  // opts.idIsKin: the file came from Kindroid or a Kin backup zip, so its "id" is the Kindroid Kin ID, not a Kin Backup ID.
  function parseData(data, opts) {
    let list;
    const arrayKey = data && typeof data === "object" && !Array.isArray(data)
      ? ["kins", "characters", "kindroids", "ais", "companions", "bots"].find((x) => Array.isArray(data[x])) : null;
    const filePrompts = data && !Array.isArray(data) && Array.isArray(data.prompts) ? data.prompts.filter((p) => p && typeof p === "object" && (p.text || p.prompt)).map(normalizePrompt) : [];
    if (Array.isArray(data)) list = data;
    else if (arrayKey) list = data[arrayKey];
    else if (filePrompts.length && !data.name) list = []; // a file with prompts only
    else if (data && data.kin && typeof data.kin === "object") list = [data.kin];
    else if (data && typeof data === "object") list = [data];
    else throw new Error("No Kins were found in this file.");
    const kins = [], skipped = [];
    const fromKinBackup = data && data.app === "kin-backup";
    list.forEach((item, i) => {
      if (!item || typeof item !== "object") { skipped.push((opts.label ? opts.label + ": " : "") + "item " + (i + 1) + " is not a Kin"); return; }
      if (opts.idIsKin && !fromKinBackup && item.id != null && item.kin_id == null && item.ai_id == null) {
        item = Object.assign({}, item, { kin_id: String(item.id) }); delete item.id;
      }
      const k = normalizeKin(item, false);
      if (!k.name.trim() && opts.fallbackName) k.name = opts.fallbackName;
      if (!k.name.trim()) { skipped.push((opts.label ? opts.label + ": " : "") + "item " + (i + 1) + " has no name"); return; }
      kins.push(k);
    });
    return { kins, skipped, prompts: filePrompts };
  }
  // ---------- Zip files (Kindroid exports and Kin backup zips) ----------
  async function inflate(bytes, method) {
    if (method === 0) return bytes;
    if (method !== 8) throw new Error("This zip uses a packing method Kin Backup can't open.");
    if (typeof DecompressionStream === "undefined") throw new Error("This browser can't open zip files. Unzip it and import the JSON inside.");
    const out = await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer();
    return new Uint8Array(out);
  }
  function listZip(buf) {
    const dv = new DataView(buf), u8 = new Uint8Array(buf);
    let eocd = -1;
    for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error("This is not a zip file Kin Backup can read.");
    const count = dv.getUint16(eocd + 10, true);
    let p = dv.getUint32(eocd + 16, true);
    if (p === 0xffffffff) throw new Error("This zip is too large for Kin Backup. Unzip it and import the files inside.");
    const dec = new TextDecoder("utf-8"), entries = [];
    for (let n = 0; n < count; n++) {
      if (dv.getUint32(p, true) !== 0x02014b50) throw new Error("This zip file looks damaged.");
      const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true);
      const nlen = dv.getUint16(p + 28, true), xlen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true), loc = dv.getUint32(p + 42, true);
      const name = dec.decode(u8.subarray(p + 46, p + 46 + nlen));
      p += 46 + nlen + xlen + clen;
      if (name.endsWith("/") || /(^|\/)(__MACOSX|\.)/.test(name)) continue;
      const start = loc + 30 + dv.getUint16(loc + 26, true) + dv.getUint16(loc + 28, true);
      entries.push({ name, read: () => inflate(u8.slice(start, start + csize), method) });
    }
    return entries;
  }
  const PIC_TYPES = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };
  // Every Kin in the zip: JSON files are read like an import file; a picture named avatar.* in the same folder
  // as a one-Kin JSON (as in name_backup.zip: name/character.json + avatar.jpg) becomes that Kin's picture.
  async function readZip(buf, label, depth) {
    const entries = listZip(buf), kins = [], skipped = [], prompts = [];
    const dirOf = (n) => n.includes("/") ? n.slice(0, n.lastIndexOf("/")) : "";
    for (const e of entries.filter((x) => /\.zip$/i.test(x.name)))
      if (depth < 1) { const r = await readZip((await e.read()).slice().buffer, e.name, depth + 1); kins.push(...r.kins); skipped.push(...r.skipped); prompts.push(...r.prompts); }
    for (const e of entries.filter((x) => /\.jsonl$/i.test(x.name))) {
      try { const r = parseKindroidExport(new TextDecoder("utf-8").decode(await e.read())); kins.push(...r.kins); skipped.push(...r.skipped); }
      catch (err) { skipped.push(e.name + ": " + err.message); }
    }
    for (const e of entries.filter((x) => /\.json$/i.test(x.name))) {
      let parsed;
      const dir = dirOf(e.name);
      try {
        const text = new TextDecoder("utf-8").decode(await e.read());
        parsed = parseImport(text, { idIsKin: true, label: e.name, fallbackName: dir ? dir.split("/").pop().replace(/_backup$/i, "") : "" });
      } catch (err) { skipped.push(e.name + ": " + err.message); continue; }
      if (parsed.kins.length === 1) {
        const pic = entries.find((x) => dirOf(x.name) === dir && /(^|\/)avatar\.(jpe?g|png|webp|gif)$/i.test(x.name));
        if (pic && !parsed.kins[0].avatar) {
          try {
            const ext = pic.name.split(".").pop().toLowerCase();
            parsed.kins[0].avatar = await pictureFromFile(new File([await pic.read()], pic.name, { type: PIC_TYPES[ext] || "image/jpeg" }));
          } catch (err) { skipped.push(pic.name + ": " + err.message); }
        }
        const extras = [];
        for (const x of entries) {
          if (dirOf(x.name) !== dir) continue;
          const m = x.name.match(/(^|\/)(full[-_]?body|selfie|extra|gallery)[-_.a-z0-9]*\.(jpe?g|png|webp|gif)$/i);
          if (!m || /(^|\/)avatar\./i.test(x.name)) continue;
          try {
            const ext = (x.name.split(".").pop() || "").toLowerCase();
            if (!PIC_TYPES[ext]) continue;
            const src = await pictureFromFile(new File([await x.read()], x.name, { type: PIC_TYPES[ext] }));
            const kind = /full/i.test(m[2]) ? "full-body" : /selfie/i.test(m[2]) ? "selfie" : "other";
            extras.push({ id: "g" + extras.length, kind, label: "", src });
          } catch (err) { skipped.push(x.name + ": " + err.message); }
        }
        if (extras.length) parsed.kins[0]._importGallery = (parsed.kins[0]._importGallery || []).concat(extras);
      }
      kins.push(...parsed.kins); skipped.push(...parsed.skipped); prompts.push(...(parsed.prompts || []));
    }
    if (!kins.length && !prompts.length && !skipped.length) skipped.push((label || "The zip") + " holds no JSON files.");
    return { kins, skipped, prompts };
  }

  // ---------- Kindroid's data export (.jsonl, one JSON record per line) ----------
  // Kins are {"type":"entity","entity_type":"ai"} records; shared listings are entity_type "shared_template".
  // Custom voices give the voice description; journal entries are kept in Private notes.
  // Chats, selfies, rooms and personas are not Kins and are left out. Picture links in the export are web
  // addresses, so they are noted as text and not loaded.
  const looksLikeKindroidExport = (text) => /^\s*\{[^\n]*"type"\s*:/.test(text) && /"entity_type"\s*:\s*"(ai|shared_template)"/.test(text);
  function parseKindroidExport(text) {
    const ais = [], templates = [], voices = {}, journals = {}, skipped = [];
    let bad = 0, owner = "";
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) continue;
      let r; try { r = JSON.parse(line); } catch (e) { bad++; continue; }
      if (!r || typeof r !== "object") continue;
      const d = r.data && typeof r.data === "object" ? r.data : null;
      if (r.type === "meta" && typeof r.uid === "string") owner = r.uid;
      else if (r.type === "entity" && r.entity_type === "ai" && d) ais.push(d);
      else if (r.type === "entity" && r.entity_type === "shared_template" && d) templates.push(d);
      else if (r.type === "custom_voice" && d) for (const id of [d.voice_id, d.id, r.record_id]) if (id) voices[id] = d;
      else if (r.type === "journal_entry" && d && r.entity_id) (journals[r.entity_id] = journals[r.entity_id] || []).push(d);
    }
    if (!ais.length && !templates.length) throw new Error("No Kins were found in this Kindroid export.");
    const s = (v) => (typeof v === "string" ? v.trim() : "");
    // Only listings this account shared count as "Shared". A Kin made from someone else's shared Kin carries
    // that Kin's share code (template_share_code); that code is not this person's listing, so it is kept as a note.
    const mine = templates.filter((tp) => !owner || !s(tp.uid) || s(tp.uid) === owner);
    const byCode = {};
    for (const tp of mine) if (s(tp.share_code)) byCode[s(tp.share_code)] = tp;
    const used = new Set(), kins = [];
    function listing(k, tp, notes) {
      k.share_code = s(tp.share_code); k.share_link = s(tp.share_link);
      if (s(tp.ai_tagline)) k.tagline = s(tp.ai_tagline);
      if (s(tp.ai_greeting)) k.greeting = s(tp.ai_greeting);
      if (s(tp.tags)) k.listing_tags = s(tp.tags);
      if (s(tp.author_notes)) k.authors_note = s(tp.author_notes);
      k.tags = cleanTags([tp.is_private ? "Not shared" : "Shared"].concat(tp.is_unlisted ? ["Unlisted"] : []));
      if (s(tp.template_id)) notes.push("Shared listing ID: " + s(tp.template_id));
      if (typeof tp.num_created === "number") notes.push("Copies made from the listing: " + tp.num_created + (typeof tp.num_messages_total === "number" ? " · messages sent with it: " + tp.num_messages_total : ""));
    }
    function base(src) {
      const k = blankKin();
      k.name = s(src.ai_name);
      k.backstory = s(src.ai_backstory); k.key_memories = s(src.ai_memory);
      k.additional_context = s(src.ai_additional_context); k.example_messages = s(src.ai_example_message);
      k.response_directive = s(src.ai_directive); k.avatar_description = s(src.custom_avatar_description);
      k.ongoing_thread = s(src.current_scene);
      if (src.created_at) k.created = new Date(src.created_at).toISOString();
      k._hadTags = true;
      return k;
    }
    for (const a of ais) {
      const k = base(a), notes = ["Imported from a Kindroid data export."];
      k.kin_id = s(a.ai_id);
      const v = voices[a.custom_voice_id];
      if (v && s(v.voice_description)) k.voice_description = s(v.voice_description);
      if (v && s(v.name)) notes.push("Custom voice: " + s(v.name));
      if (s(a.ai_gender)) notes.push("Gender: " + s(a.ai_gender));
      if (s(a.template_author_notes) && !k.authors_note) k.authors_note = s(a.template_author_notes);
      // The Kin's own listing, only when its share code is exactly one of this account's listings.
      let tp = byCode[s(a.template_share_code)];
      if (tp && used.has(tp)) tp = null;
      if (tp) { listing(k, tp, notes); used.add(tp); }
      else {
        k.tags = cleanTags(["Not shared"]);
        if (s(a.template_share_code)) notes.push("Made from the shared Kin with code " + s(a.template_share_code) + " (not one of your own listings).");
      }
      if (s(a.default_room_bio)) notes.push("Room bio: " + s(a.default_room_bio));
      if (s(a.voice_call_directive)) notes.push("Voice call directive: " + s(a.voice_call_directive));
      if (s(a.developed_context_v1)) notes.push("Learned context: " + s(a.developed_context_v1));
      const js = (journals[a.ai_id] || []).filter((j) => s(j.entry));
      if (js.length) notes.push("Journal entries:\n" + js.map((j) => "- " + (Array.isArray(j.keyphrases) && j.keyphrases.length ? "[" + j.keyphrases.join(", ") + "] " : "") + s(j.entry)).join("\n"));
      if (s(a.custom_avatar_url)) { k.avatar_pending = s(a.custom_avatar_url); notes.push("Avatar picture link (not downloaded): " + s(a.custom_avatar_url) + ". Add the picture file on the card; this app does not fetch web addresses."); }
      k.notes = notes.join("\n\n");
      if (!k.name) { skipped.push("a Kin with no name (" + (k.kin_id || "no ID") + ")"); continue; }
      kins.push(k);
    }
    for (const tp of mine) {
      if (used.has(tp)) continue;
      const k = base(tp), notes = ["Imported from a Kindroid data export: a shared listing with no matching Kin in this export."];
      listing(k, tp, notes);
      if (s(tp.ai_gender)) notes.push("Gender: " + s(tp.ai_gender));
      if (s(tp.custom_avatar_url)) { k.avatar_pending = s(tp.custom_avatar_url); notes.push("Avatar picture link (not downloaded): " + s(tp.custom_avatar_url) + ". Add the picture file on the card; this app does not fetch web addresses."); }
      k.notes = notes.join("\n\n");
      if (!k.name) { skipped.push("a shared listing with no name (" + (k.share_code || "no code") + ")"); continue; }
      kins.push(k);
    }
    if (bad) skipped.push(bad + (bad === 1 ? " line" : " lines") + " that weren't valid JSON");
    if (templates.length > mine.length) skipped.push((templates.length - mine.length) + " shared listings that belong to another account");
    return { kins, skipped, merge: true, found: { kins: ais.length, listings: mine.length, joined: used.size } };
  }

  // ---------- Codex HTML (Sword of Truth codex style: <section class="card"> per character) ----------
  // Each card gives name, About, Physical description, the Kindroid fields and its selfie/video prompts.
  // The file is only read as text here; nothing in it runs, and its pictures and links are not fetched.
  const looksLikeCodex = (text) => /<section class="card"/.test(text);
  const htmlText = (html) => new DOMParser().parseFromString("<body>" + html + "</body>", "text/html").body.textContent.trim();
  function listCodex(text) {
    const parts = text.split('<section class="card"');
    const cards = [];
    for (let i = 1; i < parts.length; i++) {
      const chunk = parts[i];
      const end = chunk.indexOf("</section>");
      const body = end >= 0 ? chunk.slice(0, end) : chunk;
      const id = (body.match(/^\s[^>]*\bid="([^"]+)"/) || [])[1] || "";
      const nm = body.match(/<h2 class="cname">([\s\S]*?)<\/h2>/);
      if (!nm) continue;
      cards.push({ id, name: htmlText(nm[1]), prompts: (body.match(/<div class="item"/g) || []).length, html: '<section class="card"' + body + "</section>" });
    }
    return cards;
  }
  const CODEX_FIELDS = {
    "avatar generator": "avatar_generator", "avatar description": "avatar_description", "vignette avatar description": "avatar_description",
    "personality": "backstory", "backstory": "backstory", "key memories": "key_memories", "additional context": "additional_context",
    "response directive": "response_directive", "example messages": "example_messages", "example message": "example_messages",
    "greeting": "greeting", "opening message": "greeting", "ongoing thread": "ongoing_thread", "voice profile": "voice_description",
    "voice description": "voice_description", "tagline": "tagline", "bio": "bio", "contribution instructions": "contribution_instructions",
    "author's note": "authors_note", "avatar bridge prompt": "avatar_bridge"
  };
  function parseCodexCard(card) {
    const doc = new DOMParser().parseFromString(card.html, "text/html");
    const sec = doc.querySelector("section.card");
    const k = blankKin();
    const clean = (s) => String(s || "").replace(/\s+/g, " ").trim();
    k.name = clean(sec.querySelector("h2.cname").textContent);
    k.codex_id = sec.id || card.id;
    k._srcId = k.codex_id; k._hadTags = false;
    k.tags = ["Not shared", "Codex"];
    const summary = [], phys = [], who = [], notes = [];
    let head = "";
    for (const c of sec.children) {
      if (c.tagName === "H3" || c.tagName === "H4") { head = clean(c.textContent); continue; }
      if (c.tagName !== "P") continue;
      if (!head) { if (!/\b(cardhead|idx)\b/.test(c.className)) summary.push(clean(c.textContent)); }
      else if (/^physical description/i.test(head)) phys.push(clean(c.textContent));
      else if (/^who (he|she|they|it) (was|is)/i.test(head)) who.push(clean(c.textContent));
    }
    k.who_they_are = summary.concat(who).filter(Boolean).join("\n\n");
    k.physical_description = phys.filter(Boolean).join("\n\n");
    const inItem = (n) => !!n.closest(".item");
    const labelOf = (f) => { const fl = f.querySelector(".flabel"); return fl ? clean((fl.firstChild && fl.firstChild.nodeType === 3 ? fl.firstChild.textContent : fl.textContent)).replace(/\s*\(\d[\d,]*\)\s*$/, "") : ""; };
    for (const f of sec.querySelectorAll("div.field")) {
      if (inItem(f)) continue;
      const label = labelOf(f), pre = f.querySelector("pre.paste");
      if (!label || !pre) continue;
      const text = pre.textContent.trim(), key = CODEX_FIELDS[label.toLowerCase()];
      if (key && !k[key]) k[key] = text;
      else if (text) notes.push(label + ":\n" + text);
    }
    for (const e of sec.querySelectorAll("div.engref")) {
      if (inItem(e)) continue;
      let prev = e.previousElementSibling;
      while (prev && !(prev.matches && prev.matches("div.field"))) prev = prev.previousElementSibling;
      const body = clean(Array.from(e.querySelectorAll("p")).map((p) => p.textContent).join(" "));
      if (body) notes.push("English reference" + (prev ? " for " + labelOf(prev) : "") + " (not for pasting):\n" + body);
    }
    if (notes.length) k.notes = "From the codex card " + k.codex_id + ".\n\n" + notes.join("\n\n");
    const ps = [];
    for (const it of sec.querySelectorAll("div.item")) {
      const pre = it.querySelector("pre.paste");
      if (!pre || !pre.textContent.trim()) continue;
      const ihead = clean((it.querySelector(".ihead") || {}).textContent);
      const title = clean((it.querySelector(".ititle") || {}).textContent);
      const inum = clean((it.querySelector(".inum") || {}).textContent);
      const scene = clean((it.querySelector(".scenedesc") || {}).textContent).replace(/^Scene:\s*/i, "");
      const social = clean((it.querySelector(".socialpost") || {}).textContent).replace(/^Kindroid social:\s*/i, "");
      const eng = clean(Array.from(it.querySelectorAll(".engref p")).map((p) => p.textContent).join(" "));
      const parts = ihead.split(" · ").map((s) => s.trim());
      const source = parts.find((s, i) => i > 0 && /\bch\s*\d|\bchapter\b|,/i.test(s) && !/^(People|Size|NSFW|Linked)/i.test(s)) || "";
      const video = /^V/i.test(inum) || /^video/i.test(title);
      const secs = (ihead.match(/\b(8|10|15|20)s\b/) || [])[1];
      ps.push(normalizePrompt({
        title: title || inum, text: pre.textContent.trim(), kin: k.codex_id, kin_name: k.name,
        type: video ? "Video" : "Selfie", size: (ihead.match(/Size:\s*(1:1|2:3|3:2)/) || [])[1] || "",
        model: video ? "Video selfie" : "Vignette", nsfw: /NSFW feature:\s*ON/i.test(ihead) || !!it.querySelector(".nsfw-on"),
        tags: ["Codex"].concat(secs ? [secs + " seconds"] : []), source, ref: it.id || "",
        context: [scene && "Scene: " + scene, social && "Kindroid social: " + social, eng && "English reference: " + eng].filter(Boolean).join("\n")
      }));
    }
    return { kin: k, prompts: ps };
  }

  // ---------- Saving an import: new cards, or updates to cards already saved ----------
  function findMatch(k) {
    const low = (s) => String(s || "").trim().toLowerCase();
    if (k.codex_id) { const m = index.find((x) => x.codex_id && x.codex_id === k.codex_id); if (m) return m; }
    if (k.kin_id) { const m = index.find((x) => x.kin_id && x.kin_id === k.kin_id); if (m) return m; }
    if (k.share_code) { const m = index.find((x) => x.share_code && x.share_code === k.share_code); if (m) return m; }
    return index.find((x) => low(x.name) && low(x.name) === low(k.name)) || null;
  }
  // Fields the file fills in replace the saved ones (the old text goes into the card's history);
  // empty fields in the file leave the saved text alone. Notes and tags are added to, not replaced.
  function mergeKin(old, inc) {
    const out = Object.assign({}, old);
    let changed = false;
    for (const key of ["name", "codex_id"].concat(SHARE.map((s) => s.key), FIELDS.map((f) => f.key).filter((x) => x !== "notes"))) {
      const v = inc[key];
      if (typeof v === "string" && v.trim() && v !== out[key]) { out[key] = v; changed = true; }
    }
    if (inc.social === "yes" && out.social !== "yes") { out.social = "yes"; changed = true; }
    if (inc.social_handle && inc.social_handle.trim() && inc.social_handle.trim() !== out.social_handle) { out.social_handle = inc.social_handle.trim().slice(0, 200); changed = true; }
    if (inc.avatar_pending && !out.avatar && !out.avatar_pending) { out.avatar_pending = inc.avatar_pending; changed = true; }
    if (inc.notes && inc.notes.trim() && !String(out.notes || "").includes(inc.notes.trim())) {
      out.notes = (out.notes ? out.notes + "\n\n" : "") + inc.notes.trim(); changed = true;
    }
    const incTags = (inc.tags || []).filter((t) => inc._hadTags || !STATUS_TAGS.includes(t));
    const tags = cleanTags((old.tags || []).concat(incTags));
    if (tags.join("|") !== cleanTags(old.tags || []).join("|")) { out.tags = tags; changed = true; }
    return { out, changed };
  }
  // mode: "update" (default), "new" (always a new card) or "skip" (leave saved Kins alone).
  async function mergeImportGallery(k, incoming) {
    if (!incoming || !incoming.length) return null;
    const have = await loadGallery(k).catch(() => []);
    const out = have.slice();
    for (const g of incoming) {
      if (!g.src) continue;
      if (out.some((x) => x.src === g.src)) continue;
      if (out.length >= GALLERY_MAX) break;
      out.push({ id: newPicId(), kind: g.kind === "avatar" ? "other" : (g.kind || "other"), label: g.label || "", src: g.src, _dirty: true });
    }
    return out.length !== have.length ? out : null;
  }
  async function saveImport(parsed, mode, progress) {
    let added = 0, updated = 0, same = 0, skippedSaved = 0, dropped = 0, pAdded = 0, pUpdated = 0, pSame = 0;
    const failed = [], idMap = new Map();
    const total = parsed.kins.length;
    for (const k of parsed.kins) {
      let pic = typeof k.avatar === "string" ? k.avatar.trim() : ""; k.avatar = "";
      if (pic && !isPicture(pic)) { pic = ""; dropped++; }
      const src = k._srcId; delete k._srcId;
      try {
        const match = mode === "new" ? null : findMatch(k);
        if (match && mode === "skip") { skippedSaved++; if (src) idMap.set(src, match.id); }
        else if (match) {
          const old = await loadKin(match.id);
          const { out, changed } = mergeKin(old, k);
          const g = await mergeImportGallery(out, k._importGallery);
          if (changed || pic || g) { await saveKin(out, pic, !!pic, g || undefined); updated++; } else same++;
          if (src) idMap.set(src, match.id);
        } else {
          k.id = newId(); delete k._hadTags;
          const g = await mergeImportGallery(k, k._importGallery);
          await saveKin(k, pic, true, g || undefined); added++;
          if (src) idMap.set(src, k.id);
        }
      } catch (e) { failed.push(k.name + " (" + e.message + ")"); }
      if (progress) progress("Saving " + (added + updated + same + skippedSaved + failed.length) + " of " + total + "…");
    }
    // Prompts: linked to the card their Kin became; the same prompt (same codex item, or the same text) is updated, not doubled.
    if (parsed.prompts && parsed.prompts.length) {
      for (const p0 of parsed.prompts) {
        const p = Object.assign({}, p0);
        p.kin = idMap.get(p.kin) || (index.find((x) => x.id === p.kin) ? p.kin : "") ||
          (p.kin_name ? (index.find((x) => String(x.name).toLowerCase() === p.kin_name.toLowerCase()) || {}).id || "" : "");
        const same0 = prompts.find((q) => q.id === p0.id) || prompts.find((q) => p.ref && q.ref === p.ref && q.kin === p.kin) || prompts.find((q) => q.text === p.text);
        if (same0) {
          if (same0.text !== p.text || same0.title !== p.title || same0.context !== p.context) {
            Object.assign(same0, { title: p.title, text: p.text, context: p.context, size: p.size || same0.size, nsfw: p.nsfw, source: p.source || same0.source, updated: now() });
            pUpdated++;
          } else pSame++;
        } else { p.id = "p" + newId().slice(1); prompts.push(p); pAdded++; }
      }
      if (pAdded || pUpdated) await savePrompts();
    }
    return { added, updated, same, skippedSaved, dropped, failed, pAdded, pUpdated, pSame };
  }
  function importReport(r, parsed) {
    const f = parsed.found, lines = [];
    if (f) lines.push("Found " + f.kins + (f.kins === 1 ? " Kin" : " Kins") + " and " + f.listings + (f.listings === 1 ? " shared listing" : " shared listings") +
      (f.joined ? " (" + f.joined + " of the listings belong to a Kin in the file and are on that Kin's card)" : "") + ".");
    const k = [];
    if (r.added) k.push("added " + r.added + (r.added === 1 ? " new card" : " new cards"));
    if (r.updated) k.push("updated " + r.updated + (r.updated === 1 ? " saved card" : " saved cards") + " (older texts are kept in each card's history)");
    if (r.same) k.push(r.same + " already up to date");
    if (r.skippedSaved) k.push("left " + r.skippedSaved + " saved " + (r.skippedSaved === 1 ? "Kin" : "Kins") + " alone");
    if (k.length) lines.push(k.join("; ").replace(/^./, (c) => c.toUpperCase()) + ".");
    const p = [];
    if (r.pAdded) p.push(r.pAdded + " new");
    if (r.pUpdated) p.push(r.pUpdated + " updated");
    if (r.pSame) p.push(r.pSame + " already saved");
    if (p.length) lines.push("Prompts: " + p.join(", ") + ".");
    if (parsed.skipped && parsed.skipped.length) lines.push("Skipped: " + parsed.skipped.join("; "));
    if (r.dropped) lines.push(r.dropped + (r.dropped === 1 ? " picture was" : " pictures were") + " left out: only pictures stored in the file (data:image) are kept, not web addresses.");
    if (r.failed.length) lines.push("Not saved: " + r.failed.join("; "));
    return lines.join("\n") || "Nothing to import.";
  }
  function modePicker() {
    const box = el("div", { class: "stack modes", role: "radiogroup", "aria-label": "When a Kin is already saved" });
    const name = "mode" + Date.now();
    const opts = [["update", "Update the saved card", "Matched by codex card, Kin ID, share code, then name. Filled-in fields replace the saved ones; the old text goes into the card's history."],
                  ["new", "Add it as a new card", "Keeps both: you may see doubles."],
                  ["skip", "Leave the saved card alone", "Only Kins that aren't saved yet are added."]];
    for (const [v, label, help] of opts) {
      box.appendChild(el("label", { class: "opt radio" }, el("input", { type: "radio", name, value: v, checked: v === "update" }),
        el("span", null, el("strong", { text: label }), el("span", { class: "help", text: " " + help }))));
    }
    box.value = () => (box.querySelector("input:checked") || { value: "update" }).value;
    return box;
  }

  // whichPrompts: "none", "linked" (prompts of these Kins) or "all" (the whole library).
  async function buildExport(ids, withPictures, whichPrompts) {
    const out = [];
    for (const id of ids) {
      const k = Object.assign({}, await loadKin(id));
      k.avatar = withPictures ? await loadAvatar(id) : "";
      if (withPictures) {
        const g = await loadGallery(k);
        if (g.length) k.gallery = g.map((x) => ({ id: x.id, kind: x.kind, label: x.label, image: x.src }));
      } else if (k.gallery) k.gallery = galleryMeta(k.gallery);
      out.push(k);
    }
    const ps = whichPrompts === "all" ? prompts : whichPrompts === "linked" ? prompts.filter((p) => ids.includes(p.kin)) : [];
    const data = { app: "kin-backup", version: 2, exported: now(), count: out.length, kins: out };
    if (ps.length) data.prompts = ps.map((p) => Object.assign({}, p, { kin_name: p.kin ? kinName(p.kin) || p.kin_name : p.kin_name }));
    return JSON.stringify(data, null, 2);
  }
  async function buildZipExport(ids, withPictures, whichPrompts) {
    const json = await buildExport(ids, withPictures, whichPrompts);
    const files = [{ name: "kin-backup-export.json", data: new TextEncoder().encode(json) }];
    if (withPictures) {
      for (const id of ids) {
        const k = await loadKin(id);
        const folder = (safeName(k.name) || id) + "/";
        const av = await loadAvatar(id);
        if (av) files.push({ name: folder + "avatar." + dataUrlExt(av), data: dataUrlBytes(av) });
        for (const g of await loadGallery(k)) {
          files.push({ name: folder + (g.kind || "extra") + "-" + g.id + "." + dataUrlExt(g.src), data: dataUrlBytes(g.src) });
        }
        const rec = Object.assign({}, k); delete rec.avatar;
        if (av) rec.avatar = ""; // pictures travel as files beside the JSON
        files.push({ name: folder + "character.json", data: new TextEncoder().encode(JSON.stringify(rec, null, 2)) });
      }
    }
    return zipStore(files);
  }

  // ---------- Views ----------
  const state = { filter: "All", social: "all", query: "", sort: "az", view: "list", openId: null, tab: "kins", openPrompt: null, promptFrom: null, pasteTo: null };

  function renderFilters() {
    const counts = new Map();
    for (const k of index) for (const t of k.tags || []) counts.set(t, (counts.get(t) || 0) + 1);
    const custom = [...counts.keys()].filter((t) => !STATUS_TAGS.includes(t)).sort((a, b) => a.localeCompare(b));
    if (state.filter !== "All" && !STATUS_TAGS.includes(state.filter) && !counts.has(state.filter)) state.filter = "All";
    const box = $("filters"); box.textContent = "";
    for (const t of ["All", ...STATUS_TAGS, ...custom]) {
      const n = t === "All" ? index.length : counts.get(t) || 0;
      box.appendChild(el("button", { type: "button", class: "chip", "aria-pressed": String(state.filter === t),
        onclick: () => { state.filter = t; renderList(); } }, t, el("span", { class: "n", text: String(n) })));
    }
    const yesN = index.filter((k) => socialOf(k) === "yes").length, noN = index.length - yesN;
    for (const [id, label, n] of [["yes", "Has social", yesN], ["no", "No social yet", noN]]) {
      box.appendChild(el("button", { type: "button", class: "chip social", "aria-pressed": String(state.social === id),
        onclick: () => { state.social = state.social === id ? "all" : id; renderList(); } }, label, el("span", { class: "n", text: String(n) })));
    }
  }
  function visibleKins() {
    const q = state.query.trim().toLowerCase();
    let list = index.filter((k) => state.filter === "All" || (k.tags || []).includes(state.filter));
    if (state.social === "yes") list = list.filter((k) => socialOf(k) === "yes");
    else if (state.social === "no") list = list.filter((k) => socialOf(k) !== "yes");
    if (q) list = list.filter((k) => [k.name, k.tagline, k.bio, k.listing_tags, k.kin_id, k.share_code, k.social_handle, socialLabel(k), (k.tags || []).join(" ")]
      .some((v) => String(v || "").toLowerCase().includes(q)));
    const byName = (a, b) => String(a.name || "").localeCompare(String(b.name || ""), undefined, { sensitivity: "base" });
    if (state.sort === "az") list.sort(byName);
    else if (state.sort === "za") list.sort((a, b) => byName(b, a));
    else if (state.sort === "big") list.sort((a, b) => (b.size || 0) - (a.size || 0));
    else list.sort((a, b) => String(b.updated || "").localeCompare(String(a.updated || "")));
    return list;
  }
  function renderList() {
    renderFilters(); renderStats();
    const list = visibleKins(), box = $("list"); box.textContent = "";
    $("skeleton").hidden = true;
    updateCount(list.length);
    $("empty").hidden = index.length !== 0;
    for (const k of list) {
      box.appendChild(el("button", { type: "button", class: "item", onclick: () => openCard(k.id) },
        thumbNode(k.name, k.thumb),
        el("div", { class: "meta" },
          el("div", { class: "name", text: k.name || "(no name)" }),
          k.tagline ? el("div", { class: "line", text: k.tagline }) : null,
          el("div", null, (k.tags || []).map((t) => el("span", { class: tagClass(t), text: t })), socialChip(k)),
          el("div", { class: "foot" }, el("span", { text: k.updated ? "Updated " + new Date(k.updated).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "Saved" }), k.size ? el("span", { class: "dot", text: "·" }) : null, k.size ? el("span", { text: bytes(k.size) }) : null)
        )));
    }
    if (index.length && !list.length) box.appendChild(el("p", { class: "empty", text: "No Kins match this search or tag." }));
  }
  function updateCount(shown) {
    const pn = prompts.length ? " · " + prompts.length + (prompts.length === 1 ? " prompt" : " prompts") : "";
    $("count").textContent = (index.length === 0 ? "No Kins saved yet" :
      index.length + (index.length === 1 ? " Kin saved" : " Kins saved") + (shown != null && shown !== index.length && state.view === "list" ? " · " + shown + " shown" : "")) + pn;
  }
  function logEvent(kind, size, count, name) {
    meta.log.unshift({ at: now(), kind, size: size || 0, count: count || 0, name: name || "" });
    meta.log = meta.log.slice(0, 20);
    saveIndex().catch(() => {});
    if (state.view === "list") renderStats();
  }
  const bytes = (n) => n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : n >= 1024 ? Math.round(n / 1024) + " KB" : n ? n + " B" : "—";
  function ago(iso) {
    const t = Date.parse(iso); if (!t) return "never";
    const m = Math.round((Date.now() - t) / 60000);
    if (m < 1) return "just now"; if (m < 60) return m + " min ago";
    const h = Math.round(m / 60); if (h < 24) return h + (h === 1 ? " hour ago" : " hours ago");
    const d = Math.round(h / 24); return d + (d === 1 ? " day ago" : " days ago");
  }
  const KIND_TEXT = { device: "Saved to this device", link: "Download link made", copy: "Copied as JSON", import: "Restored from a file" };
  function renderStats() {
    const has = index.length > 0 || prompts.length > 0;
    $("stats").hidden = !has; $("backupbar").hidden = !has;
    if (!has) { $("blog").hidden = true; return; }
    const lastSaved = index.reduce((m, k) => (k.updated && k.updated > m ? k.updated : m), "");
    const lastBackup = (meta.log.find((e) => e.kind !== "import") || {});
    const total = index.reduce((n, k) => n + (k.size || 0), 0) + JSON.stringify(prompts).length;
    const stale = !lastBackup.at || (lastSaved && lastSaved > lastBackup.at);
    const tile = (k, v, d, cls) => el("div", { class: "stat" + (cls ? " " + cls : "") }, el("div", { class: "k", text: k }), el("div", { class: "v", text: v }), el("div", { class: "d", text: d }));
    $("stats").replaceChildren(
      tile("Kins saved", String(index.length), prompts.length + (prompts.length === 1 ? " prompt" : " prompts") + " in the library"),
      tile("Last change", lastSaved ? ago(lastSaved) : "—", lastSaved ? dateText(lastSaved) : "Nothing saved yet"),
      tile("Last backup file", lastBackup.at ? ago(lastBackup.at) : "Not yet", lastBackup.at ? (KIND_TEXT[lastBackup.kind] || "Export") + " · " + bytes(lastBackup.size) : "Export keeps a copy off Kindroid", stale ? "old" : "ok"),
      tile("Stored here", bytes(total), "cards, pictures and prompts"));
    $("backupmsg").replaceChildren(stale ? (lastBackup.at ? "Changes since your last backup file. " : "You have no backup file yet. ") : "Your last backup file is up to date. ",
      el("b", { text: stale ? "Back up now to keep a copy on your device." : "You can still export again any time." }));
    const rows = meta.log.map((e) => el("div", { class: "brow" },
      el("div", null, el("div", { class: "t", text: KIND_TEXT[e.kind] || "Export" }), el("div", { class: "m", text: dateText(e.at) + (e.name ? " · " + e.name : "") + (e.count ? " · " + e.count + (e.count === 1 ? " Kin" : " Kins") : "") })),
      el("span", { class: "m", text: ago(e.at) }), el("span", { class: "sz", text: e.size ? bytes(e.size) : "" })));
    $("blog").hidden = !rows.length; $("blogrows").replaceChildren(...rows);
  }
  function showList() {
    state.view = "list"; state.openId = null; state.pasteTo = null; setTab("kins");
    hideAll(); $("view-list").hidden = false;
    renderList(); window.scrollTo(0, 0);
  }

  function pasteBox(text, label, cap) {
    const has = String(text || "").length > 0;
    const pre = el("pre", { class: "paste" + (has ? "" : " blank"), text: has ? text : "Empty" });
    return el("div", { class: "boxwrap" }, has ? el("button", { type: "button", class: "btn small copy", onclick: () => copyText(text, label) }, "Copy") : null, pre);
  }
  function countNote(text, cap, note) {
    const n = len(text);
    const parts = [];
    if (cap) parts.push(fmt(n) + " / " + fmt(cap) + " characters"); else if (n) parts.push(fmt(n) + " characters");
    if (note) parts.push(note);
    return el("span", { class: "fnote" + (cap && n > cap ? " over" : ""), text: parts.length ? "(" + parts.join(" · ") + ")" + (cap && n > cap ? " over the limit" : "") : "" });
  }

  async function openCard(id) {
    try {
      const k = await loadKin(id);
      const avatar = await loadAvatar(id);
      const gallery = await loadGallery(k);
      renderCard(k, avatar, gallery);
    } catch (e) { toast("Could not open this Kin: " + e.message); }
  }
  function renderCard(k, avatar, gallery) {
    gallery = gallery || [];
    state.view = "card"; state.openId = k.id; setTab("kins");
    const v = $("view-card"); v.textContent = "";
    hideAll(); v.hidden = false;

    v.appendChild(el("div", { class: "cardtop" },
      el("div", { class: "left" }, el("button", { type: "button", class: "btn", onclick: showList }, "← All Kins")),
      el("div", { class: "right" },
        el("button", { type: "button", class: "btn primary", onclick: () => renderEdit(Object.assign({}, k), avatar, false, gallery) }, "Edit"),
        el("button", { type: "button", class: "btn", onclick: () => exportDialog([k.id], k.name) }, "Export"),
        el("button", { type: "button", class: "btn danger", onclick: () => deleteDialog(k) }, "Delete"))));

    const shareRows = el("div", { class: "idrow" });
    for (const s of SHARE) {
      const val = k[s.key] || "";
      shareRows.appendChild(el("div", { class: "k", text: s.label }));
      shareRows.appendChild(el("div", { class: "v" + (val ? "" : " blank"), text: val || "Not filled in" }));
      shareRows.appendChild(val ? el("button", { type: "button", class: "btn small", onclick: () => copyText(val, s.label) }, "Copy") : el("span"));
    }
    const fileAv = el("input", { type: "file", accept: "image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif", hidden: true });
    const fileGal = el("input", { type: "file", accept: "image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif", hidden: true, multiple: true });
    async function takePic(file, asGallery, kind) {
      try {
        const src = await pictureFromFile(file);
        if (asGallery) {
          if (gallery.length >= GALLERY_MAX) { toast("This card already has " + GALLERY_MAX + " pictures. Remove one to add another."); return; }
          const items = gallery.concat([{ id: newPicId(), kind: kind || "other", label: "", src, _dirty: true }]);
          await saveKin(k, null, false, items);
          toast("Picture added to the gallery.");
        } else {
          await saveKin(Object.assign({}, k, { avatar_pending: "" }), src, true);
          toast("Avatar saved.");
        }
        openCard(k.id);
      } catch (e) { toast(e.message); }
    }
    function pickAvatar() {
      const go = () => { fileAv.value = ""; fileAv.onchange = () => { const f = fileAv.files && fileAv.files[0]; if (f) takePic(f, false); }; fileAv.click(); };
      if (avatar) confirmPic("Replace this avatar?", "The current avatar stays until you choose a new picture. " + PIC_LIMIT, "Replace", go);
      else go();
    }
    function confirmPic(title, text, ok, fn) {
      openDialog(el("h2", { text: title }), el("p", { text: text }),
        el("div", { class: "actions" },
          el("button", { type: "button", class: "btn", onclick: closeDialog }, "Cancel"),
          el("button", { type: "button", class: "btn " + (ok === "Remove" ? "danger solid" : "primary"), onclick: () => { closeDialog(); fn(); } }, ok)));
    }
    const avWrap = el("div", { class: "avatarcol dropzone", title: "Drop a picture, or click to view it large" });
    const avNode = thumbNode(k.name, avatar, true);
    if (avatar) {
      avNode.style.cursor = "zoom-in";
      avNode.title = "View large";
      avNode.onclick = (e) => { e.stopPropagation(); openLite(avatar, (k.name || "Kin") + " — avatar", k.name); };
    }
    avWrap.appendChild(avNode);
    const avBtns = el("div", { class: "avbtns" });
    avBtns.appendChild(el("button", { type: "button", class: "btn small", onclick: pickAvatar }, avatar ? "Replace picture" : "Add avatar"));
    if (avatar) {
      avBtns.appendChild(el("button", { type: "button", class: "btn small", onclick: () => savePictureToDevice(k.name, avatar) }, "Save to device"));
      avBtns.appendChild(el("button", { type: "button", class: "btn small danger", onclick: () => confirmPic("Remove this avatar?", "The picture is removed from Kin Backup. It does not change the Kin in Kindroid. This cannot be undone unless you exported it.", "Remove", async () => {
        try { await saveKin(k, "", true); toast("Avatar removed."); openCard(k.id); } catch (e) { toast(e.message); }
      }) }, "Remove"));
    }
    avWrap.appendChild(avBtns);
    avWrap.appendChild(el("p", { class: "help", text: PIC_LIMIT }));
    avWrap.appendChild(fileAv); avWrap.appendChild(fileGal);
    bindDrop(avWrap, (f) => {
      if (avatar) confirmPic("Replace this avatar with the dropped picture?", PIC_LIMIT, "Replace", () => takePic(f, false));
      else takePic(f, false);
    });
    state.pasteTo = (file) => {
      if (avatar) confirmPic("Replace this avatar with the pasted picture?", PIC_LIMIT, "Replace", () => takePic(file, false));
      else takePic(file, false);
    };

    const handleIn = el("input", { type: "text", value: k.social_handle || "", placeholder: "@handle or a link — saved as a reminder, never opened", autocomplete: "off", maxlength: "200" });
    const socialBox = el("div", { class: "socialbox" },
      el("div", { class: "flabel" }, el("span", { text: "Kin Social" })),
      el("div", { class: "tagpick" },
        el("button", { type: "button", class: "chip", "aria-pressed": String(socialOf(k) === "yes"), onclick: () => setSoc("yes") }, "Has social"),
        el("button", { type: "button", class: "chip", "aria-pressed": String(socialOf(k) !== "yes"), onclick: () => setSoc("no") }, "No social yet")),
      socialOf(k) === "yes" ? el("div", { class: "field", style: "margin:8px 0 0" }, handleIn,
        el("p", { class: "help", text: "A handle or link to remember. This app never opens or fetches it." })) : null,
      socialOf(k) === "yes" && k.social_handle ? el("div", { class: "handle" }, el("span", { text: k.social_handle }),
        el("button", { type: "button", class: "btn small", onclick: () => copyText(k.social_handle, "Kin Social handle") }, "Copy")) : null);
    async function setSoc(v) {
      const handle = handleIn.value.trim().slice(0, 200);
      try {
        await saveKin(Object.assign({}, k, { social: v, social_handle: handle }), null, false);
        toast(v === "yes" ? "Marked as having a Kin Social." : "Marked as no Kin Social yet.");
        openCard(k.id);
      } catch (e) { toast(e.message); }
    }
    handleIn.addEventListener("change", () => { if (socialOf(k) === "yes") setSoc("yes"); });

    const pending = k.avatar_pending && !avatar ? el("div", { class: "notice pending" },
      el("strong", { text: "Avatar file not stored yet. " }),
      "A Kindroid export had a picture link. This app does not fetch web addresses, so add the picture file here.") : null;

    const gal = el("div", { class: "gallery" });
    function galItem(g) {
      const t = thumbNode(g.label || kindLabel(g.kind), g.src, false);
      t.className += " gthumb"; t.style.cursor = "zoom-in";
      t.onclick = () => openLite(g.src, (k.name || "Kin") + " — " + kindLabel(g.kind), (k.name || "kin") + "-" + g.kind);
      return el("div", { class: "gitem" }, t, el("span", { class: "glabel", text: kindLabel(g.kind) }),
        el("div", { class: "gacts" },
          el("button", { type: "button", class: "btn small", onclick: () => savePictureToDevice(k.name, g.src, "-" + (g.kind || "pic")) }, "Save"),
          el("button", { type: "button", class: "btn small danger", onclick: () => confirmPic("Remove this " + kindLabel(g.kind).toLowerCase() + " picture?", "It is removed from this card. This cannot be undone unless you exported it.", "Remove", async () => {
            try { await saveKin(k, null, false, gallery.filter((x) => x.id !== g.id)); toast("Picture removed."); openCard(k.id); } catch (e) { toast(e.message); }
          }) }, "Remove")));
    }
    if (gallery.length) gallery.forEach((g) => gal.appendChild(galItem(g)));
    if (gallery.length < GALLERY_MAX) {
      const add = el("button", { type: "button", class: "gadd", onclick: () => { fileGal.value = ""; fileGal.onchange = async () => {
        for (const f of [...(fileGal.files || [])]) await takePic(f, true, "other");
      }; fileGal.click(); } }, el("span", { text: "+" }), el("span", { text: "Add photo" }));
      gal.appendChild(add);
    }

    v.appendChild(el("div", { class: "hero" },
      avWrap,
      el("div", { class: "info" },
        el("h2", { text: k.name || "(no name)" }),
        k.tagline ? el("p", { class: "tagline", text: k.tagline }) : null,
        el("div", null, (k.tags || []).map((t) => el("span", { class: tagClass(t), text: t })), socialChip(k)),
        shareRows,
        socialBox,
        pending,
        el("div", { class: "dates", text: "Saved " + dateText(k.created) + (k.updated && k.updated !== k.created ? " · changed " + dateText(k.updated) : "") }))));
    v.appendChild(el("div", { class: "section" },
      el("div", { class: "flabel" }, el("h3", { text: "Pictures" }),
        el("span", { class: "fnote", text: "Avatar, full body, selfie or extras. " + PIC_LIMIT })),
      gal, el("p", { class: "help", text: "You can also drop a picture onto the avatar, or paste one (Ctrl+V / ⌘V) while this card is open." })));

    for (const g of GROUPS) {
      const fs = FIELDS.filter((f) => f.group === g.id);
      if (g.id === "notes" && !k.notes) continue;
      const sec = el("div", { class: "section" }, el("h3", { text: g.title }));
      for (const f of fs) {
        if (f.optional && !k[f.key] && !(k.history && k.history[f.key])) continue;
        sec.appendChild(el("div", { class: "field" },
          el("div", { class: "flabel" }, el("span", { text: f.label + (f.cap ? " (" + fmt(f.cap) + ")" : "") }), countNote(k[f.key], f.cap, f.note)),
          pasteBox(k[f.key], f.label, f.cap), historyBox(k, f)));
      }
      v.appendChild(sec);
      if (g.id === "kindroid") v.appendChild(kinPromptsSection(k));
    }
    window.scrollTo(0, 0);
  }

  function renderEdit(k, avatar, isNew, galleryIn) {
    state.view = "edit"; setTab("kins");
    const v = $("view-card"); v.textContent = "";
    hideAll(); v.hidden = false;
    let pic = avatar || "", picChanged = false;
    const inputs = {};
    let gallery = (galleryIn || []).map((g) => Object.assign({}, g));
    // Avatar + extra pictures
    const avBox = el("div", { class: "avatarcol dropzone" });
    const fileIn = el("input", { type: "file", accept: "image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif", hidden: true });
    const fileGal = el("input", { type: "file", accept: "image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif", hidden: true, multiple: true });
    function applyPic(file) {
      return pictureFromFile(file).then((url) => { pic = url; picChanged = true; drawAvatar(); }).catch((e) => toast(e.message));
    }
    function drawAvatar() {
      avBox.textContent = ""; avBox.className = "avatarcol dropzone";
      const t = thumbNode(inputs.name ? inputs.name.value : k.name, pic, true);
      if (pic) { t.style.cursor = "zoom-in"; t.onclick = () => openLite(pic, (inputs.name && inputs.name.value) || k.name || "Avatar", k.name); }
      avBox.appendChild(t);
      avBox.appendChild(el("button", { type: "button", class: "btn small", onclick: () => {
        const go = () => fileIn.click();
        if (pic) openDialog(el("h2", { text: "Replace this avatar?" }), el("p", { text: PIC_LIMIT }),
          el("div", { class: "actions" }, el("button", { type: "button", class: "btn", onclick: closeDialog }, "Cancel"),
            el("button", { type: "button", class: "btn primary", onclick: () => { closeDialog(); go(); } }, "Replace")));
        else go();
      } }, pic ? "Replace picture" : "Add avatar"));
      if (pic) avBox.appendChild(el("button", { type: "button", class: "btn small danger", onclick: () => {
        openDialog(el("h2", { text: "Remove this avatar?" }), el("p", { text: "It is removed when you save. This cannot be undone unless you exported it." }),
          el("div", { class: "actions" }, el("button", { type: "button", class: "btn", onclick: closeDialog }, "Keep it"),
            el("button", { type: "button", class: "btn danger solid", onclick: () => { closeDialog(); pic = ""; picChanged = true; drawAvatar(); } }, "Remove")));
      } }, "Remove picture"));
      avBox.appendChild(el("p", { class: "help", text: "Drop or paste a picture, or choose a file. " + PIC_LIMIT }));
      avBox.appendChild(fileIn); avBox.appendChild(fileGal);
    }
    fileIn.addEventListener("change", async () => {
      const f = fileIn.files && fileIn.files[0]; fileIn.value = "";
      if (f) applyPic(f);
    });
    bindDrop(avBox, (f) => {
      if (pic) openDialog(el("h2", { text: "Replace this avatar with the dropped picture?" }), el("p", { text: PIC_LIMIT }),
        el("div", { class: "actions" }, el("button", { type: "button", class: "btn", onclick: closeDialog }, "Cancel"),
          el("button", { type: "button", class: "btn primary", onclick: () => { closeDialog(); applyPic(f); } }, "Replace")));
      else applyPic(f);
    });
    state.pasteTo = (file) => {
      if (pic) openDialog(el("h2", { text: "Replace this avatar with the pasted picture?" }), el("p", { text: PIC_LIMIT }),
        el("div", { class: "actions" }, el("button", { type: "button", class: "btn", onclick: closeDialog }, "Cancel"),
          el("button", { type: "button", class: "btn primary", onclick: () => { closeDialog(); applyPic(file); } }, "Replace")));
      else applyPic(file);
    };
    const galBox = el("div", { class: "gallery editgal" });
    function drawGallery() {
      galBox.textContent = "";
      for (const g of gallery) {
        const kind = el("select", { "aria-label": "Kind of picture", onchange: () => { g.kind = kind.value; } },
          PIC_KINDS.filter((x) => x.id !== "avatar").map((x) => el("option", { value: x.id, text: x.label, selected: g.kind === x.id })));
        galBox.appendChild(el("div", { class: "gitem" },
          el("div", { class: "gthumb", onclick: () => openLite(g.src, kindLabel(g.kind), k.name) }, thumbNode(kindLabel(g.kind), g.src)),
          kind,
          el("button", { type: "button", class: "btn small danger", onclick: () => {
            openDialog(el("h2", { text: "Remove this picture?" }), el("p", { text: "It is removed when you save." }),
              el("div", { class: "actions" }, el("button", { type: "button", class: "btn", onclick: closeDialog }, "Keep it"),
                el("button", { type: "button", class: "btn danger solid", onclick: () => { closeDialog(); gallery = gallery.filter((x) => x.id !== g.id); drawGallery(); } }, "Remove")));
          } }, "Remove")));
      }
      if (gallery.length < GALLERY_MAX) galBox.appendChild(el("button", { type: "button", class: "gadd", onclick: () => fileGal.click() }, el("span", { text: "+" }), el("span", { text: "Add photo" })));
    }
    fileGal.addEventListener("change", async () => {
      for (const f of [...(fileGal.files || [])]) {
        if (gallery.length >= GALLERY_MAX) { toast("This card already has " + GALLERY_MAX + " extra pictures."); break; }
        try { gallery.push({ id: newPicId(), kind: "other", label: "", src: await pictureFromFile(f), _dirty: true }); }
        catch (e) { toast(e.message); }
      }
      fileGal.value = ""; drawGallery();
    });
    inputs.social_handle = el("input", { type: "text", value: k.social_handle || "", placeholder: "@handle or a link — reminder only, never opened", autocomplete: "off", maxlength: "200" });
    let social = socialOf(k);
    const socialPick = el("div", { class: "tagpick" });
    function drawSocial() {
      socialPick.textContent = "";
      for (const [id, label] of [["yes", "Has social"], ["no", "No social yet"]]) {
        socialPick.appendChild(el("button", { type: "button", class: "chip", "aria-pressed": String(social === id), onclick: () => { social = id; drawSocial(); } }, label));
      }
      inputs.social_handle.hidden = social !== "yes";
    }

    // Name and share details
    inputs.name = el("input", { type: "text", value: k.name || "", placeholder: "The Kin's name", autocomplete: "off" });
    const shareBox = el("div", { class: "row2" });
    for (const s of SHARE) {
      inputs[s.key] = el("input", { type: s.key === "share_link" ? "url" : "text", value: k[s.key] || "", placeholder: s.label, autocomplete: "off", spellcheck: "false" });
      const field = el("div", { class: "field" }, el("label", { text: s.label }), inputs[s.key]);
      if (s.key === "kin_id" && attached.kins.length) {
        const sel = el("select", { "aria-label": "Use an attached Kin's ID", onchange: () => { if (sel.value) { inputs.kin_id.value = sel.value; if (!inputs.name.value.trim()) inputs.name.value = sel.selectedOptions[0].dataset.name || ""; } } },
          el("option", { value: "", text: "Use an attached Kin's ID…" }),
          attached.kins.map((a) => el("option", { value: a.id, "data-name": a.name || "", text: (a.name || a.id) + (a.id === attached.current ? " (this chat)" : "") })));
        field.appendChild(el("div", { style: "margin-top:6px" }, sel));
      }
      shareBox.appendChild(field);
    }

    // Tags
    let tags = cleanTags(k.tags);
    const tagBox = el("div", { class: "tagpick" });
    const customIn = el("input", { type: "text", placeholder: "Your own tags, separated by commas", autocomplete: "off",
      value: tags.filter((t) => !STATUS_TAGS.includes(t)).join(", ") });
    function drawTags() {
      tagBox.textContent = "";
      for (const t of STATUS_TAGS) {
        tagBox.appendChild(el("button", { type: "button", class: "chip", "aria-pressed": String(tags.includes(t)), onclick: () => {
          if (tags.includes(t)) tags = tags.filter((x) => x !== t);
          else { if (t === "Shared") tags = tags.filter((x) => x !== "Not shared"); if (t === "Not shared") tags = tags.filter((x) => x !== "Shared"); tags.push(t); }
          drawTags();
        } }, t));
      }
    }

    const form = el("div", { class: "edit" });
    form.appendChild(el("div", { class: "cardtop" },
      el("div", { class: "left" }, el("h2", { text: isNew ? "New Kin" : "Edit " + (k.name || "Kin") })),
      el("div", { class: "right" }, el("button", { type: "button", class: "btn", onclick: cancel }, "Cancel"))));
    form.appendChild(el("div", { class: "hero" }, avBox,
      el("div", { class: "info" },
        el("div", { class: "field" }, el("label", { text: "Name" }), inputs.name),
        el("div", { class: "field" }, el("label", { text: "Backup tags" }), tagBox, customIn,
          el("p", { class: "help", text: "Shared and Not shared switch each other off. Featured can go with either." })),
        el("div", { class: "field" }, el("label", { text: "Kin Social" }), socialPick, inputs.social_handle,
          el("p", { class: "help", text: "A reminder of whether this Kin has a Kin Social. A handle or link is stored as text only; this app never opens or fetches it." })))));
    form.appendChild(el("div", { class: "section" }, el("h3", { text: "Extra pictures" }),
      el("p", { class: "help", text: "Full body, selfie or other pictures for this Kin, in addition to the avatar. " + PIC_LIMIT }), galBox));
    form.appendChild(el("div", { class: "section" }, el("h3", { text: "Share details" }), shareBox));

    for (const g of GROUPS) {
      const sec = el("div", { class: "section" }, el("h3", { text: g.title }));
      for (const f of FIELDS.filter((x) => x.group === g.id)) {
        const ta = el("textarea", { rows: String(f.rows || 4), spellcheck: "true" }); ta.value = k[f.key] || "";
        const head = el("div", { class: "flabel" }, el("label", { text: f.label + (f.cap ? " (" + fmt(f.cap) + ")" : "") }), countNote(ta.value, f.cap, f.note));
        ta.addEventListener("input", () => { head.replaceChild(countNote(ta.value, f.cap, f.note), head.lastChild); });
        inputs[f.key] = ta;
        sec.appendChild(el("div", { class: "field" }, head, ta));
      }
      form.appendChild(sec);
    }
    const saveBtn = el("button", { type: "button", class: "btn primary", onclick: save }, isNew ? "Save Kin" : "Save changes");
    form.appendChild(el("div", { class: "savebar" }, el("button", { type: "button", class: "btn", onclick: cancel }, "Cancel"), saveBtn));
    v.appendChild(form);
    inputs.name.addEventListener("input", () => { if (!pic) drawAvatar(); });
    inputs.name.addEventListener("keydown", (e) => { if (e.key === "Enter") save(); });
    drawAvatar(); drawTags(); drawSocial(); drawGallery();
    window.scrollTo(0, 0);
    inputs.name.focus();

    function cancel() { if (isNew) showList(); else openCard(k.id); }
    async function save() {
      const name = inputs.name.value.trim();
      if (!name) { toast("Give the Kin a name first."); inputs.name.focus(); return; }
      const out = Object.assign({}, k, { name });
      for (const s of SHARE) out[s.key] = inputs[s.key].value.trim();
      for (const f of FIELDS) out[f.key] = inputs[f.key].value;
      out.tags = cleanTags(tags.filter((t) => STATUS_TAGS.includes(t)).concat(customIn.value.split(",")));
      out.social = social === "yes" ? "yes" : "no";
      out.social_handle = inputs.social_handle.value.trim().slice(0, 200);
      saveBtn.disabled = true; saveBtn.textContent = "Saving…";
      try {
        await saveKin(out, pic, picChanged || (isNew && !!pic), gallery);
        toast("Saved " + name);
        openCard(out.id);
      } catch (e) {
        toast("Could not save: " + e.message);
        saveBtn.disabled = false; saveBtn.textContent = isNew ? "Save Kin" : "Save changes";
      }
    }
  }

  // ---------- Tabs ----------
  function setTab(t) {
    state.tab = t;
    $("tab-kins").setAttribute("aria-selected", String(t === "kins"));
    $("tab-prompts").setAttribute("aria-selected", String(t === "prompts"));
  }
  function hideAll() { for (const v of ["view-list", "view-card", "view-prompts", "view-prompt"]) $(v).hidden = true; }
  function updateTabs() {
    $("tab-kins").textContent = "Kins" + (index.length ? " (" + index.length + ")" : "");
    $("tab-prompts").textContent = "Prompt library" + (prompts.length ? " (" + prompts.length + ")" : "");
  }
  // Redraws whatever is open after an import or a change elsewhere.
  function refreshViews() {
    updateTabs(); updateCount();
    if (state.view === "list") renderList();
    else if (state.view === "prompts") renderPrompts();
    else if (state.view === "card" && state.openId && index.some((x) => x.id === state.openId)) openCard(state.openId);
    else if (state.view === "prompt" && state.openPrompt && prompts.some((p) => p.id === state.openPrompt)) openPrompt(state.openPrompt);
    else if (state.tab === "prompts") showPrompts(); else showList();
  }

  // ---------- Prompt library views ----------
  const pstate = { query: "", kin: "", type: "", sort: "fav", chip: "All" };
  function promptMeta(p) {
    const bits = [];
    const kn = p.kin ? kinName(p.kin) : "";
    if (kn) bits.push(kn); else if (p.kin_name) bits.push(p.kin_name + " (not saved)");
    bits.push(p.type);
    if (p.size) bits.push(SIZE_NAMES[p.size] || p.size);
    if (p.model) bits.push(p.model);
    if (p.source) bits.push(p.source);
    return bits.join(" · ");
  }
  function visiblePrompts() {
    const q = pstate.query.trim().toLowerCase();
    let list = prompts.filter((p) =>
      (!pstate.kin || (pstate.kin === "-" ? !p.kin : p.kin === pstate.kin)) &&
      (!pstate.type || p.type === pstate.type) &&
      (pstate.chip === "All" || (pstate.chip === "Favorites" && p.fav) || (pstate.chip === "SFW" && !p.nsfw) || (pstate.chip === "NSFW" && p.nsfw) || p.tags.includes(pstate.chip)));
    if (q) list = list.filter((p) => [p.title, p.text, p.context, p.source, p.kin_name, kinName(p.kin), p.tags.join(" ")].some((v) => String(v || "").toLowerCase().includes(q)));
    const byTitle = (a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base", numeric: true });
    if (pstate.sort === "az") list.sort(byTitle);
    else if (pstate.sort === "new") list.sort((a, b) => String(b.updated).localeCompare(String(a.updated)));
    else list.sort((a, b) => (b.fav - a.fav) || String(b.updated).localeCompare(String(a.updated)));
    return list;
  }
  function fillSelect(sel, options, value) {
    sel.textContent = "";
    for (const [v, t] of options) sel.appendChild(el("option", { value: v, text: t }));
    sel.value = options.some((o) => o[0] === value) ? value : options[0][0];
    return sel.value;
  }
  function starButton(p, after) {
    return el("button", { type: "button", class: "star", "aria-pressed": String(!!p.fav), title: p.fav ? "Favorite" : "Mark as favorite",
      "aria-label": (p.fav ? "Remove " : "Mark ") + p.title + (p.fav ? " from favorites" : " as a favorite"),
      onclick: async (e) => {
        e.stopPropagation();
        p.fav = !p.fav;
        try { await savePrompts(); } catch (err) { toast("Could not save: " + err.message); }
        if (after) after(); else { e.currentTarget.setAttribute("aria-pressed", String(p.fav)); e.currentTarget.textContent = p.fav ? "★" : "☆"; }
      } }, p.fav ? "★" : "☆");
  }
  function promptRow(p, fromKin) {
    return el("div", { class: "prow" },
      starButton(p),
      el("button", { type: "button", class: "pmain", onclick: () => openPrompt(p.id, fromKin) },
        el("div", { class: "ptitle", text: p.title }),
        el("div", { class: "pmeta" }, promptMeta(p), p.nsfw ? el("span", { class: "tag nsfw", style: "margin-left:6px", text: "NSFW" }) : null),
        el("div", { class: "psnip", text: p.text })),
      el("div", { class: "pbtns" }, el("button", { type: "button", class: "btn small", onclick: () => copyText(p.text, p.title) }, "Copy")));
  }
  function renderPrompts() {
    const kinsWith = [...new Set(prompts.map((p) => p.kin).filter(Boolean))].map((id) => [id, kinName(id) || "(deleted Kin)"]).sort((a, b) => a[1].localeCompare(b[1]));
    pstate.kin = fillSelect($("pkin"), [["", "All Kins"], ["-", "Not linked to a Kin"]].concat(kinsWith), pstate.kin);
    pstate.type = fillSelect($("ptype"), [["", "All kinds"]].concat(PROMPT_TYPES.map((t) => [t.id, t.id])), pstate.type);
    $("psort").value = pstate.sort;
    const counts = new Map();
    for (const p of prompts) for (const t of p.tags) counts.set(t, (counts.get(t) || 0) + 1);
    const chips = [["All", prompts.length], ["Favorites", prompts.filter((p) => p.fav).length], ["SFW", prompts.filter((p) => !p.nsfw).length], ["NSFW", prompts.filter((p) => p.nsfw).length]]
      .concat([...counts.keys()].sort((a, b) => a.localeCompare(b)).map((t) => [t, counts.get(t)]));
    if (!chips.some((c) => c[0] === pstate.chip)) pstate.chip = "All";
    const fbox = $("pfilters"); fbox.textContent = "";
    for (const [t, n] of chips) {
      if (t !== "All" && !n && t !== pstate.chip) continue;
      fbox.appendChild(el("button", { type: "button", class: "chip", "aria-pressed": String(pstate.chip === t), onclick: () => { pstate.chip = t; renderPrompts(); } },
        t === "Favorites" ? "★ Favorites" : t, el("span", { class: "n", text: String(n) })));
    }
    const list = visiblePrompts(), box = $("plist"); box.textContent = "";
    $("pempty").hidden = prompts.length !== 0;
    for (const p of list) box.appendChild(promptRow(p));
    if (prompts.length && !list.length) box.appendChild(el("p", { class: "empty", text: "No prompts match this search or filter." }));
    updateCount(); updateTabs();
  }
  function showPrompts() {
    state.view = "prompts"; state.openPrompt = null; state.pasteTo = null; setTab("prompts");
    hideAll(); $("view-prompts").hidden = false;
    renderPrompts(); window.scrollTo(0, 0);
  }
  function openPrompt(id, fromKin) {
    const p = prompts.find((x) => x.id === id);
    if (!p) { toast("That prompt is gone."); showPrompts(); return; }
    state.view = "prompt"; state.openPrompt = id; state.promptFrom = fromKin || null;
    hideAll();
    const v = $("view-prompt"); v.textContent = ""; v.hidden = false;
    const back = fromKin && index.some((x) => x.id === fromKin)
      ? el("button", { type: "button", class: "btn", onclick: () => { setTab("kins"); openCard(fromKin); } }, "← " + (kinName(fromKin) || "Kin"))
      : el("button", { type: "button", class: "btn", onclick: showPrompts }, "← Prompt library");
    v.appendChild(el("div", { class: "cardtop" },
      el("div", { class: "left" }, back),
      el("div", { class: "right" },
        el("button", { type: "button", class: "btn primary", onclick: () => renderPromptEdit(Object.assign({}, p), false) }, "Edit"),
        el("button", { type: "button", class: "btn", onclick: () => {
          const c = normalizePrompt(Object.assign({}, p, { id: "", title: p.title + " (copy)", fav: false, ref: "", created: "", updated: "" }));
          renderPromptEdit(c, true);
        } }, "Duplicate"),
        el("button", { type: "button", class: "btn danger", onclick: () => deletePromptDialog(p) }, "Delete"))));
    const cap = typeCap(p.type);
    const kinBtn = p.kin && kinName(p.kin) ? el("button", { type: "button", class: "btn small", onclick: () => { setTab("kins"); openCard(p.kin); } }, "Open " + kinName(p.kin)) : null;
    v.appendChild(el("div", { class: "hero" },
      starButton(p, () => openPrompt(id, fromKin)),
      el("div", { class: "info" },
        el("h2", { text: p.title }),
        el("p", { class: "tagline", text: promptMeta(p) }),
        el("div", null, p.nsfw ? el("span", { class: "tag nsfw", text: "NSFW" }) : el("span", { class: "tag", text: "SFW" }), p.tags.map((t) => el("span", { class: "tag", text: t }))),
        kinBtn,
        el("div", { class: "dates", text: "Saved " + dateText(p.created) + (p.updated && p.updated !== p.created ? " · changed " + dateText(p.updated) : "") }))));
    const sec = el("div", { class: "section" }, el("h3", { text: "Prompt" }),
      el("div", { class: "field" },
        el("div", { class: "flabel" }, el("span", { text: p.type + (cap ? " (" + fmt(cap) + ")" : "") }), countNote(p.text, cap, /[㐀-鿿]/.test(p.text) ? "Simplified Chinese" : "")),
        pasteBox(p.text, p.title, cap)));
    if (p.context) sec.appendChild(el("div", { class: "field" }, el("div", { class: "flabel" }, el("span", { text: "Context (not for pasting)" })), el("p", { class: "ctx", text: p.context })));
    v.appendChild(sec);
    window.scrollTo(0, 0);
  }
  function renderPromptEdit(p, isNew) {
    state.view = "prompt-edit";
    hideAll();
    const v = $("view-prompt"); v.textContent = ""; v.hidden = false;
    const title = el("input", { type: "text", value: p.title || "", placeholder: "A short name you will recognise", autocomplete: "off" });
    const kinSel = el("select", { "aria-label": "Kin" });
    fillSelect(kinSel, [["", "Not linked to a Kin"]].concat(index.slice().sort((a, b) => String(a.name).localeCompare(String(b.name))).map((k) => [k.id, k.name || "(no name)"])), p.kin || "");
    const typeSel = el("select", { "aria-label": "Kind of prompt" });
    fillSelect(typeSel, PROMPT_TYPES.map((t) => [t.id, t.id + (t.cap ? " (" + fmt(t.cap) + ")" : "")]), p.type);
    const sizeSel = el("select", { "aria-label": "Picture size" });
    fillSelect(sizeSel, SIZES.map((s) => [s, s ? SIZE_NAMES[s] : "No size"]), p.size);
    const model = el("input", { type: "text", value: p.model || "Vignette", autocomplete: "off" });
    const nsfw = el("input", { type: "checkbox", checked: !!p.nsfw });
    const fav = el("input", { type: "checkbox", checked: !!p.fav });
    const tags = el("input", { type: "text", value: (p.tags || []).join(", "), placeholder: "Your own tags, separated by commas", autocomplete: "off" });
    const source = el("input", { type: "text", value: p.source || "", placeholder: "Where it comes from, e.g. a book and chapter", autocomplete: "off" });
    const context = el("textarea", { rows: "3" }); context.value = p.context || "";
    const text = el("textarea", { rows: "10", spellcheck: "true" }); text.value = p.text || "";
    const head = el("div", { class: "flabel" }, el("label", { text: "Prompt" }), countNote(text.value, typeCap(typeSel.value)));
    const recount = () => head.replaceChild(countNote(text.value, typeCap(typeSel.value), /[㐀-鿿]/.test(text.value) ? "Simplified Chinese" : ""), head.lastChild);
    text.addEventListener("input", () => { recount(); dupNote.hidden = true; confirmDup = false; saveBtn.textContent = isNew ? "Save prompt" : "Save changes"; });
    typeSel.addEventListener("change", recount);
    const dupNote = el("p", { class: "help", hidden: true });
    let confirmDup = false;
    const saveBtn = el("button", { type: "button", class: "btn primary", onclick: save }, isNew ? "Save prompt" : "Save changes");
    const row = (label, input) => el("div", { class: "field" }, el("label", { text: label }), input);
    v.appendChild(el("div", { class: "edit" },
      el("div", { class: "cardtop" }, el("div", { class: "left" }, el("h2", { text: isNew ? "New prompt" : "Edit prompt" })),
        el("div", { class: "right" }, el("button", { type: "button", class: "btn", onclick: cancel }, "Cancel"))),
      el("div", { class: "section" },
        row("Title", title),
        el("div", { class: "row2" }, row("Kin", kinSel), row("Kind", typeSel)),
        el("div", { class: "row2" }, row("Picture size", sizeSel), row("Selfie model", model)),
        el("div", { class: "field" }, el("label", { class: "opt" }, fav, " Favorite"), el("label", { class: "opt" }, nsfw, " NSFW (needs the NSFW feature on)")),
        row("Tags", tags), row("Source", source),
        el("div", { class: "field" }, head, text, dupNote),
        row("Context, for you (not for pasting)", context)),
      el("div", { class: "savebar" }, el("button", { type: "button", class: "btn", onclick: cancel }, "Cancel"), saveBtn)));
    window.scrollTo(0, 0); title.focus();
    function cancel() { if (isNew) { if (p.kin && state.promptFrom !== null && index.some((x) => x.id === p.kin) && state.tab === "kins") openCard(p.kin); else showPrompts(); } else openPrompt(p.id, state.promptFrom); }
    async function save() {
      const out = normalizePrompt(Object.assign({}, p, {
        title: title.value.trim(), text: text.value, kin: kinSel.value, kin_name: kinSel.value ? kinName(kinSel.value) : p.kin_name,
        type: typeSel.value, size: sizeSel.value, model: model.value.trim(), nsfw: nsfw.checked, fav: fav.checked,
        tags: tags.value.split(","), source: source.value.trim(), context: context.value, id: p.id || ""
      }));
      if (!out.text.trim()) { toast("Write or paste the prompt first."); text.focus(); return; }
      const dup = nearDuplicate(out);
      if (dup && !confirmDup) {
        dupNote.hidden = false; dupNote.className = "help fnote over";
        dupNote.textContent = "This is the same or nearly the same as “" + dup.title + "”" + (dup.kin ? " (" + kinName(dup.kin) + ")" : "") + ". Save anyway if you want both.";
        confirmDup = true; saveBtn.textContent = "Save anyway"; return;
      }
      saveBtn.disabled = true;
      try { await savePrompt(out); toast("Saved " + out.title); openPrompt(out.id, state.promptFrom); }
      catch (e) { toast("Could not save: " + e.message); saveBtn.disabled = false; }
    }
  }
  function deletePromptDialog(p) {
    openDialog(
      el("h2", { text: "Delete “" + p.title + "”?" }),
      el("p", { text: "This removes the prompt from the library. It cannot be undone, so export first if you might want it back." }),
      el("div", { class: "actions" },
        el("button", { type: "button", class: "btn", onclick: closeDialog }, "Keep it"),
        el("button", { type: "button", class: "btn danger solid", onclick: async () => {
          try { await deletePrompt(p.id); closeDialog(); toast("Deleted " + p.title); if (state.promptFrom && index.some((x) => x.id === state.promptFrom)) { setTab("kins"); openCard(state.promptFrom); } else showPrompts(); }
          catch (e) { toast("Could not delete: " + e.message); }
        } }, "Delete")));
  }

  // ---------- Card extras: older texts and the Kin's prompts ----------
  function historyBox(k, f) {
    const list = (k.history && k.history[f.key]) || [];
    if (!list.length) return null;
    return el("details", { class: "hist" },
      el("summary", { text: "Older texts (" + list.length + ")" }),
      list.map((h) => el("div", { class: "old" },
        el("div", { class: "when" }, el("span", { text: (dateText(h.at) || "Earlier") + " · " + fmt(len(h.text)) + (f.cap ? " / " + fmt(f.cap) : "") + " characters" }),
          el("button", { type: "button", class: "btn small", onclick: () => copyText(h.text, f.label + " (older)") }, "Copy"),
          el("button", { type: "button", class: "btn small", onclick: () => restoreDialog(k, f, h.text) }, "Put it back")),
        el("pre", { text: h.text }))));
  }
  function restoreDialog(k, f, text) {
    const cur = (cache.get(k.id) || k)[f.key] || "";
    openDialog(
      el("h2", { text: "Put this older " + f.label + " back?" }),
      el("p", { text: "It replaces the current text (" + fmt(len(cur)) + " characters) with this older one (" + fmt(len(text)) + " characters). The current text is kept under Older texts, so you can undo this." }),
      el("div", { class: "actions" },
        el("button", { type: "button", class: "btn", onclick: closeDialog }, "Cancel"),
        el("button", { type: "button", class: "btn primary", onclick: () => { closeDialog(); restoreText(k, f, text); } }, "Put it back")));
  }
  async function restoreText(k, f, text) {
    const out = Object.assign({}, cache.get(k.id) || k); out[f.key] = text;
    try { await saveKin(out, null, false); toast(f.label + " put back. The text it replaced is in Older texts."); openCard(k.id); }
    catch (e) { toast("Could not save: " + e.message); }
  }
  function kinPromptsSection(k) {
    const ps = promptsOf(k.id).sort((a, b) => (b.fav - a.fav) || a.title.localeCompare(b.title, undefined, { numeric: true }));
    return el("div", { class: "section" },
      el("div", { class: "flabel" }, el("h3", { text: "Prompts (" + ps.length + ")" }),
        el("button", { type: "button", class: "btn small", onclick: () => { state.promptFrom = k.id; renderPromptEdit(normalizePrompt({ kin: k.id, kin_name: k.name, title: "New prompt", text: "" }), true); } }, "+ Add a prompt")),
      ps.length ? el("div", { class: "plist" }, ps.map((p) => promptRow(p, k.id))) : el("p", { class: "help", text: "No prompts saved for " + (k.name || "this Kin") + " yet." }));
  }

  // ---------- Dialogs ----------
  function openDialog(...kids) {
    const d = $("dialog"); d.textContent = "";
    kids.flat().forEach((k) => k && d.appendChild(k));
    $("overlay").hidden = false;
    const first = d.querySelector("button, input, textarea, select"); if (first) first.focus();
  }
  function closeDialog() { $("overlay").hidden = true; $("dialog").textContent = ""; }
  $("overlay").addEventListener("click", (e) => { if (e.target === $("overlay")) closeDialog(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("overlay").hidden) closeDialog(); });

  function deleteDialog(k) {
    openDialog(
      el("h2", { text: "Delete " + (k.name || "this Kin") + "?" }),
      el("p", { text: "This removes the saved card and its picture from Kin Backup. Its prompts stay in the prompt library, no longer linked. It does not touch the Kin in Kindroid. It cannot be undone, so export it first if you might want it back." }),
      el("div", { class: "actions" },
        el("button", { type: "button", class: "btn", onclick: closeDialog }, "Keep it"),
        el("button", { type: "button", class: "btn", onclick: () => { closeDialog(); exportDialog([k.id], k.name); } }, "Export first"),
        el("button", { type: "button", class: "btn danger solid", onclick: async () => {
          try { await deleteKin(k.id); closeDialog(); toast("Deleted " + (k.name || "Kin")); showList(); }
          catch (e) { toast("Could not delete: " + e.message); }
        } }, "Delete")));
  }

  function exportDialog(ids, oneName) {
    if (!ids.length && !prompts.length) { toast("There are no Kins or prompts to export yet."); return; }
    const pics = el("input", { type: "checkbox", checked: true });
    const nLinked = oneName ? prompts.filter((p) => ids.includes(p.kin)).length : prompts.length;
    const withPrompts = el("input", { type: "checkbox", checked: nLinked > 0, disabled: nLinked === 0 });
    const result = el("div", { class: "result", hidden: true });
    const base = oneName ? "kin-backup-" + (safeName(oneName) || "kin") : "kin-backup-all-" + localDate();
    let cached = null, cachedKey = null;
    async function get() {
      const key = pics.checked + "/" + withPrompts.checked;
      if (cached != null && cachedKey === key) return cached;
      result.hidden = false; result.classList.remove("done"); result.classList.add("busy"); result.textContent = "Gathering " + ids.length + (ids.length === 1 ? " Kin…" : " Kins…");
      cached = await buildExport(ids, pics.checked, withPrompts.checked ? (oneName ? "linked" : "all") : "none"); cachedKey = key;
      return cached;
    }
    function say(t) { result.hidden = false; result.textContent = t; result.classList.remove("busy"); result.classList.add("done"); }
    openDialog(
      el("h2", { text: oneName ? "Export " + oneName : "Export all " + ids.length + " Kins" }),
      el("p", { text: "Makes one JSON file you can keep on your computer or phone and import again later." }),
      el("label", { class: "opt" }, pics, "Include avatar pictures"),
      el("label", { class: "opt" }, withPrompts, oneName ? "Include this Kin's prompts (" + nLinked + ")" : "Include the prompt library (" + nLinked + ")"),
      el("div", { class: "stack", style: "margin-top:10px" },
        el("button", { type: "button", class: "btn primary", onclick: async () => {
          try { const t = await get(); saveToDevice(base + ".json", t); logEvent("device", new Blob([t]).size, ids.length, oneName);
            say("Saving " + base + ".json (" + kb(t) + "). If no download starts, Kindroid's frame blocks downloads here: use Make a download link or Copy JSON instead."); }
          catch (e) { say("Export failed: " + e.message); }
        } }, "Save to this device"),
        el("button", { type: "button", class: "btn", onclick: async () => {
          try { const t = await get();
            const size = new Blob([t]).size;
            if (size > 5 * 1048576) { say("This export is " + kb(t) + ". Kindroid serves download links up to 5 MB, so turn off pictures or export fewer Kins for a link."); return; }
            await files.write("kin-backup-export.json", t); logEvent("link", size, ids.length, oneName);
            say("Ready (" + kb(t) + "). In Kindroid Apps, open Kin Backup's settings: the link to kin-backup-export.json is there. Making a new link replaces the old file."); }
          catch (e) { say("Could not make the link: " + e.message); }
        } }, "Make a download link"),
        el("button", { type: "button", class: "btn", onclick: async () => {
          try { const t = await get(); const ok = await copyText(t, "JSON"); if (ok) logEvent("copy", new Blob([t]).size, ids.length, oneName);
            say(ok ? "Copied " + kb(t) + " of JSON. Paste it into a text file and save it as .json." : "Copying is blocked here. Use one of the other buttons."); }
          catch (e) { say("Export failed: " + e.message); }
        } }, "Copy JSON"),
        el("button", { type: "button", class: "btn", onclick: async () => {
          try {
            result.hidden = false; result.classList.remove("done"); result.classList.add("busy"); result.textContent = "Building a zip…";
            const blob = await buildZipExport(ids, pics.checked, withPrompts.checked ? (oneName ? "linked" : "all") : "none");
            const name = base + ".zip";
            const ok = await saveBlobToDevice(name, blob);
            logEvent("device", blob.size, ids.length, oneName);
            say((ok ? "Saving " : "Could not start a download of ") + name + " (" + bytes(blob.size) + "). The zip holds each Kin's JSON and, if you included them, the avatar and extra pictures as image files.");
          } catch (e) { say("Export failed: " + e.message); }
        } }, "Save as a zip")),
      result,
      el("div", { class: "actions" }, el("button", { type: "button", class: "btn", onclick: closeDialog }, "Done")));
  }

  function importDialog() {
    const fileIn = el("input", { type: "file", accept: ".json,.jsonl,.zip,.html,.htm,application/json,application/x-ndjson,application/zip,application/x-zip-compressed,text/html,text/plain", hidden: true });
    const paste = el("textarea", { class: "json", placeholder: "…or paste JSON here", spellcheck: "false" });
    const result = el("div", { class: "result", hidden: true });
    const go = el("button", { type: "button", class: "btn primary" }, "Import pasted JSON");
    const modes = modePicker();
    let busy = false;
    async function run(text, ready) {
      if (busy) return;
      result.hidden = false; result.classList.add("busy"); result.textContent = "Reading…";
      let parsed = ready;
      if (!parsed) { try { parsed = looksLikeKindroidExport(text) ? parseKindroidExport(text) : parseImport(text); } catch (e) { result.textContent = e.message; return; } }
      if (!parsed.kins.length && !(parsed.prompts && parsed.prompts.length)) { result.textContent = "No Kins with a name were found." + (parsed.skipped.length ? "\nSkipped: " + parsed.skipped.join("; ") : ""); return; }
      busy = true;
      try {
        const r = await saveImport(parsed, modes.value(), (t) => { result.textContent = t; });
        result.textContent = importReport(r, parsed); result.classList.remove("busy"); result.classList.add("done");
        logEvent("import", 0, r.added + r.updated, "");
      } finally { busy = false; }
      refreshViews();
    }
    fileIn.addEventListener("change", async () => {
      const f = fileIn.files && fileIn.files[0]; fileIn.value = "";
      if (!f) return;
      try {
        if (/\.zip$/i.test(f.name) || /zip/.test(f.type)) {
          result.hidden = false; result.textContent = "Opening " + f.name + "…";
          const parsed = await readZip(await f.arrayBuffer(), f.name, 0);
          if (!parsed.kins.length && !parsed.prompts.length) { result.textContent = "No Kins were found in " + f.name + "." + (parsed.skipped.length ? "\nSkipped: " + parsed.skipped.join("; ") : ""); return; }
          await run("", parsed);
        } else {
          result.hidden = false; result.textContent = "Reading " + f.name + "…";
          const text = await readFile(f, "text");
          if (/\.html?$/i.test(f.name) || looksLikeCodex(text)) {
            const cards = listCodex(text);
            if (!cards.length) { result.textContent = "No codex character cards were found in " + f.name + "."; return; }
            codexDialog(cards, f.name);
          } else if (/\.jsonl$/i.test(f.name) || looksLikeKindroidExport(text)) await run("", parseKindroidExport(text));
          else await run(text);
        }
      } catch (e) { result.hidden = false; result.textContent = e.message; }
    });
    go.addEventListener("click", () => { if (paste.value.trim()) run(paste.value); else toast("Paste some JSON first."); });
    openDialog(
      el("h2", { text: "Import Kins and prompts" }),
      el("p", { text: "Choose a file from your computer or phone: Kindroid's data export (.jsonl), a Kin Backup export, a Kin backup zip (its avatar picture comes too), a codex HTML file (you pick which character cards), one Kin, or a list of Kins. From Kindroid's export it takes your Kins and your shared listings; chats, selfies and rooms are left out. Fields Kin Backup has no box for are kept in each Kin's Private notes." }),
      el("h3", { class: "dlg-h", text: "When a Kin is already saved" }), modes,
      el("div", { class: "stack", style: "margin-top:10px" },
        el("button", { type: "button", class: "btn primary", onclick: () => fileIn.click() }, "Choose a JSON, JSONL, zip or codex HTML file"), fileIn,
        paste, go),
      result,
      el("div", { class: "actions" }, el("button", { type: "button", class: "btn", onclick: () => { closeDialog(); refreshViews(); } }, "Done")));
  }

  // Picks which codex character cards to bring in. Only the chosen cards are read in full.
  function codexDialog(cards, fileName) {
    const chosen = new Set();
    const search = el("input", { type: "search", placeholder: "Search " + cards.length + " cards", autocomplete: "off" });
    const listBox = el("div", { class: "picklist", role: "group", "aria-label": "Codex cards" });
    const withPrompts = el("input", { type: "checkbox", checked: true });
    const modes = modePicker();
    const result = el("div", { class: "result", hidden: true });
    const count = el("span", { class: "help" });
    const go = el("button", { type: "button", class: "btn primary" }, "Import chosen cards");
    const saved = (c) => index.some((x) => x.codex_id === c.id) ? " · saved" : "";
    function visible() { const q = search.value.trim().toLowerCase(); return cards.filter((c) => !q || c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)); }
    function draw() {
      listBox.textContent = "";
      for (const c of visible()) {
        const cb = el("input", { type: "checkbox", checked: chosen.has(c) });
        cb.addEventListener("change", () => { if (cb.checked) chosen.add(c); else chosen.delete(c); tally(); });
        listBox.appendChild(el("label", { class: "opt pick" }, cb, el("span", { text: c.name }), el("span", { class: "help", text: c.prompts + (c.prompts === 1 ? " prompt" : " prompts") + saved(c) })));
      }
      tally();
    }
    function tally() {
      const n = chosen.size, p = [...chosen].reduce((a, c) => a + c.prompts, 0);
      count.textContent = n + (n === 1 ? " card" : " cards") + " chosen" + (withPrompts.checked ? " · " + p + " prompts" : "");
      go.disabled = !n;
    }
    search.addEventListener("input", draw);
    withPrompts.addEventListener("change", tally);
    go.addEventListener("click", async () => {
      go.disabled = true; result.hidden = false;
      const parsed = { kins: [], prompts: [], skipped: [] };
      let i = 0;
      for (const c of chosen) {
        i++;
        if (i % 10 === 1) { result.textContent = "Reading card " + i + " of " + chosen.size + "…"; await new Promise((r) => setTimeout(r, 0)); }
        try { const r = parseCodexCard(c); parsed.kins.push(r.kin); if (withPrompts.checked) parsed.prompts.push(...r.prompts); }
        catch (e) { parsed.skipped.push(c.name + " (" + e.message + ")"); }
      }
      try {
        const r = await saveImport(parsed, modes.value(), (t) => { result.textContent = t; });
        result.textContent = importReport(r, parsed);
      } catch (e) { result.textContent = "Import failed: " + e.message; }
      go.disabled = false; draw(); refreshViews();
    });
    openDialog(
      el("h2", { text: "Import from the codex" }),
      el("p", { text: fileName + " holds " + cards.length + " character cards. Choose the ones to save. Each becomes a card tagged Codex with its About, Physical description and Kindroid fields; other fields and English references go to Private notes. Its selfie and video prompts go to the prompt library, linked to the card." }),
      el("div", { class: "toolbar" }, search),
      el("div", { class: "actions", style: "justify-content:flex-start;margin:0 0 6px" },
        el("button", { type: "button", class: "btn small", onclick: () => { visible().forEach((c) => chosen.add(c)); draw(); } }, "Choose all shown"),
        el("button", { type: "button", class: "btn small", onclick: () => { visible().forEach((c) => chosen.delete(c)); draw(); } }, "Clear shown"),
        count),
      listBox,
      el("label", { class: "opt", style: "margin-top:8px" }, withPrompts, "Bring their prompts into the prompt library"),
      el("h3", { class: "dlg-h", text: "When a Kin is already saved" }), modes,
      result,
      el("div", { class: "actions" },
        el("button", { type: "button", class: "btn", onclick: () => { closeDialog(); refreshViews(); } }, "Done"), go));
    draw();
  }

  // ---------- Toast ----------
  function toast(t) {
    const box = $("toasts"), n = el("div", { class: "toast" + (/^(could not|export failed|no |there are no|that |copying is blocked|pick |paste )/i.test(t) ? " err" : ""), text: t });
    box.appendChild(n);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => { n.classList.add("out"); setTimeout(() => n.remove(), 320); }, 3600);
  }

  // ---------- Start ----------
  $("btn-new").addEventListener("click", () => renderEdit(blankKin(), "", true));
  $("tab-kins").addEventListener("click", showList);
  $("tab-prompts").addEventListener("click", showPrompts);
  $("btn-new-prompt").addEventListener("click", () => { state.promptFrom = null; renderPromptEdit(normalizePrompt({ title: "", text: "" }), true); });
  $("psearch").addEventListener("input", (e) => { pstate.query = e.target.value; renderPrompts(); });
  $("pkin").addEventListener("change", (e) => { pstate.kin = e.target.value; renderPrompts(); });
  $("ptype").addEventListener("change", (e) => { pstate.type = e.target.value; renderPrompts(); });
  $("psort").addEventListener("change", (e) => { pstate.sort = e.target.value; renderPrompts(); });
  $("btn-import").addEventListener("click", importDialog);
  $("btn-restore").addEventListener("click", importDialog);
  $("btn-empty-import").addEventListener("click", importDialog);
  $("btn-empty-new").addEventListener("click", () => renderEdit(blankKin(), "", true));
  $("btn-backup-now").addEventListener("click", () => exportDialog(index.map((k) => k.id)));
  $("btn-export-all").addEventListener("click", () => exportDialog(index.map((k) => k.id)));
  $("search").addEventListener("input", (e) => { state.query = e.target.value; renderList(); });
  $("sort").addEventListener("change", (e) => { state.sort = e.target.value; renderList(); });

  // Cards saved before sizes were tracked get one measured, a few at a time in the background.
  async function backfillSizes() {
    const todo = index.filter((k) => !k.size);
    if (!todo.length) return;
    for (const k of todo) {
      try {
        const body = await files.read("kin-" + k.id + ".json");
        const pic = k.thumb ? await files.read("avatar-" + k.id + ".txt") : "";
        k.pic = (pic || "").length; k.size = (body || "").length + k.pic;
      } catch (e) { /* leave it blank; tried again next time */ }
    }
    await saveIndex().catch(() => {});
    if (state.view === "list") renderList();
  }
  document.addEventListener("paste", (e) => {
    if (!state.pasteTo) return;
    const t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
    const f = fileFromPaste(e);
    if (f) { e.preventDefault(); state.pasteTo(f); }
  });
  $("liteclose").addEventListener("click", () => { $("lightbox").hidden = true; $("liteimg").removeAttribute("src"); });
  $("lightbox").addEventListener("click", (e) => { if (e.target.id === "lightbox") { $("lightbox").hidden = true; $("liteimg").removeAttribute("src"); } });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && $("lightbox") && !$("lightbox").hidden) { $("lightbox").hidden = true; $("liteimg").removeAttribute("src"); } });

  async function start() {
    $("preview-notice").hidden = inFrame;
    if (inFrame) { request({ kin: "kins" }, 5000).then(setAttached).catch(() => {}); }
    await loadIndex();
    await loadPrompts();
    updateTabs();
    showList();
    backfillSizes();
  }
  start();
})();
