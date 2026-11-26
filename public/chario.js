// Reading and writing characters (Kins) in files. Plain JavaScript that runs both in the Kin Relay page (where files are
// read in pieces, so even a very large Kindroid export never sits in memory) and in Node (the server and the tests).
//
// Reads:  Kindroid's data export (.jsonl, schema_version 1 or 2): only the "entity / ai" records (your Kins), the small
//         "shared_template" records (to find a Kin's tagline and greeting) and the "user" record (your name) are used.
//         Chat messages, pictures, voices, journals and rooms are counted and then ignored.
//         Kin Relay's own export (format "kin-relay-characters"), and Kin Studio's character JSON
//         (format "kin-voice-helper-v1": {characters:[...]} or {character:{...}}, or a Kin Studio backup).
// Writes: Kin Relay's file, or a Kin Studio-compatible file. Neither ever contains an API key.
(function (root) {
  "use strict";
  const FORMAT = "kin-relay-characters", VERSION = 1, STUDIO_FORMAT = "kin-voice-helper-v1";
  const INVISIBLE = /[\u0000-\u001F\u007F-\u009F\u00A0\u00AD\u034F\u061C\u115F\u1160\u17B4\u17B5\u180E\u2000-\u200F\u2028-\u202F\u205F-\u206F\u3000\u3164\uFE00-\uFE0F\uFEFF\uFFA0]/g;
  const MAX_FIELD = 12000;

  // The profile fields Kin Relay keeps for reference (named like Kin Studio's so the two files line up).
  const FIELDS = [
    ["tagline", "Tagline"], ["gender", "Gender"], ["bio", "Bio"], ["backstory", "Backstory"], ["greeting", "Greeting"],
    ["memory", "Key memories"], ["example", "Example message"], ["directive", "Response directive"], ["additional", "Additional context"],
    ["appearance", "Appearance description"], ["face", "Facial description"], ["learned", "Learned context"],
    ["growth", "Growth & relationship"], ["importantFacts", "Important facts"], ["ongoingThreads", "Ongoing threads"],
  ];
  const FIELD_KEYS = FIELDS.map((f) => f[0]);

  const str = (v, max) => (typeof v === "string" ? v : v == null || typeof v === "object" ? "" : String(v)).slice(0, max || MAX_FIELD);
  function cleanAiId(raw) {
    let s = String(raw == null ? "" : raw).replace(INVISIBLE, "").trim();
    s = s.replace(/^["'`\u2018\u2019\u201C\u201D]+|["'`\u2018\u2019\u201C\u201D.,;]+$/g, "").trim();
    const url = s.match(/\/(?:chat\/group|group|chat|kin|ai)\/([A-Za-z0-9_-]{6,64})/i);
    if (url) return url[1];
    return s.replace(/^(?:kin\s*id|ai\s*id|ai_id|id)\s*[:=#-]?\s*/i, "").replace(/\s+/g, "");
  }
  function aiIdProblem(id) {
    id = String(id || "");
    if (!id) return "No AI ID in the file.";
    if (/^kn_/i.test(id)) return "That is an API key, not an AI ID, so it was left out.";
    if (/^[A-Za-z0-9]{5}$/.test(id)) return "That looks like a 5-letter share code, not an AI ID.";
    if (!/^[A-Za-z0-9_-]{6,64}$/.test(id)) return "That doesn't look like an AI ID.";
    return "";
  }
  // Pictures are only ever fetched from Kindroid's own storage, over https. Other addresses are ignored.
  function safeAvatarUrl(u) {
    if (typeof u !== "string") return "";
    try { const x = new URL(u); return x.protocol === "https:" && x.hostname === "storage.kindroid.ai" ? x.href : ""; } catch { return ""; }
  }
  const isDataImage = (u) => typeof u === "string" && /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(u) && u.length < 1.5 * 1024 * 1024;
  const emptyDetails = () => Object.fromEntries(FIELD_KEYS.map((k) => [k, ""]));
  function cleanDetails(d) {
    const out = {};
    if (d && typeof d === "object") for (const k of FIELD_KEYS) { const v = str(d[k]); if (v.trim()) out[k] = v; }
    return out;
  }

  // ---------- Kindroid's data export ----------
  function kindroidParser() {
    const kins = new Map(), templates = new Map(), stats = { lines: 0, bad: 0, ignored: {}, templates: 0 };
    let meta = null, userName = "", order = [], personas = 0;
    const bump = (k) => { stats.ignored[k] = (stats.ignored[k] || 0) + 1; };
    return {
      line(text) {
        text = text.trim(); if (!text) return;
        stats.lines++;
        let o; try { o = JSON.parse(text); } catch { stats.bad++; return; }
        if (!o || typeof o !== "object") return;
        const t = o.type, et = o.entity_type, d = o.data || {};
        if (t === "meta") { meta = { schema_version: o.schema_version, attachment_mode: o.attachment_mode, generated_at: o.generated_at }; return; }
        if (t === "user") { userName = str(d.user_name, 80); order = Array.isArray(d.ai_list) ? d.ai_list.filter((x) => typeof x === "string") : []; return; }
        if (t === "persona") { personas++; return; }
        if (t === "entity" && et === "ai") {
          const id = cleanAiId(d.ai_id || o.entity_id);
          if (!id) return;
          const details = cleanDetails({
            gender: d.ai_gender, backstory: d.ai_backstory, memory: d.ai_memory, example: d.ai_example_message, directive: d.ai_directive,
            additional: d.ai_additional_context, bio: d.default_room_bio, appearance: d.custom_avatar_description, face: d.custom_avatar_face_prompt,
            learned: d.developed_context_v1,
          });
          kins.set(id, { ai_id: id, name: str(d.ai_name, 40).trim() || "Kin", share_code: /^[A-Za-z0-9]{5}$/.test(d.template_share_code || "") ? d.template_share_code : "",
            template_id: str(d.template_id, 60), details, avatar_url: safeAvatarUrl(d.custom_avatar_url) || safeAvatarUrl(d.display_avatar_url), created_at: Number(d.created_at) || 0 });
          return;
        }
        if (t === "entity" && et === "shared_template") {
          if (o.entity_id || d.template_id) { templates.set(str(d.template_id || o.entity_id, 60), { tagline: str(d.ai_tagline, 400), greeting: str(d.ai_greeting, MAX_FIELD) }); stats.templates++; }
          return;
        }
        bump((t || "other") + (et ? ":" + et : ""));
      },
      finish() {
        const list = [...kins.values()];
        for (const k of list) {
          const tp = templates.get(k.template_id);
          if (tp) { if (tp.tagline && !k.details.tagline) k.details.tagline = tp.tagline; if (tp.greeting && !k.details.greeting) k.details.greeting = tp.greeting; }
          delete k.template_id;
        }
        const rank = new Map(order.map((id, i) => [id, i]));
        list.sort((a, b) => (rank.has(a.ai_id) ? rank.get(a.ai_id) : 1e9) - (rank.has(b.ai_id) ? rank.get(b.ai_id) : 1e9) || b.created_at - a.created_at);
        const chats = ["text_message", "voice_message", "room_message"].reduce((n, k) => n + Object.keys(stats.ignored).filter((x) => x.startsWith(k)).reduce((m, x) => m + stats.ignored[x], 0), 0);
        return { format: "kindroid-export", label: "Kindroid data export", meta, kins: list.map(finish), userName, personas, ignored: { chatMessages: chats, other: Object.values(stats.ignored).reduce((a, b) => a + b, 0) - chats }, bad: stats.bad };
      },
    };
    function finish(k) { return { ai_id: k.ai_id, name: k.name, share_code: k.share_code, notes: "", details: k.details, avatar_url: k.avatar_url, avatar: "" }; }
  }

  // ---------- Kin Relay's own file, and Kin Studio's ----------
  function fromRelay(doc) {
    const list = Array.isArray(doc.characters) ? doc.characters : [];
    return { format: FORMAT, label: "Kin Relay characters file", kins: list.filter((c) => c && typeof c === "object").map((c) => ({
      ai_id: cleanAiId(c.ai_id), name: str(c.name, 40).trim() || "Kin", share_code: /^[A-Za-z0-9]{5}$/.test(c.share_code || "") ? c.share_code : "",
      notes: str(c.notes, 1000), details: cleanDetails(c.details), avatar_url: "", avatar: isDataImage(c.avatar) ? c.avatar : "" })) };
  }
  function fromStudio(doc) {
    let list = Array.isArray(doc.characters) ? doc.characters : doc.character ? [doc.character] : doc.helper ? [doc.helper] : [];
    return { format: STUDIO_FORMAT, label: "Kin Studio characters file", kins: list.filter((c) => c && typeof c === "object").map((c) => ({
      ai_id: cleanAiId(c.ai_id || c.aiId), name: str(c.name, 40).trim() || "Kin", share_code: /^[A-Za-z0-9]{5}$/.test(str(c.shareCode || c.share_code, 12)) ? str(c.shareCode || c.share_code, 12) : "",
      notes: "", avatar_url: "", avatar: isDataImage(c.avatar) ? c.avatar : "",
      details: cleanDetails({ tagline: c.tag || c.tagline, bio: c.bio, backstory: c.personality, greeting: c.greeting, memory: c.keyMemories || c.memories, example: c.example, directive: c.directive,
        additional: c.additional, appearance: c.appearance || c.descAtelier, face: c.face, growth: c.growth, importantFacts: c.importantFacts, ongoingThreads: c.ongoingThreads }) })) };
  }
  function fromDocument(doc) {
    if (Array.isArray(doc)) doc = { characters: doc };
    if (!doc || typeof doc !== "object") throw new Error("That file isn't a characters file Kin Relay knows.");
    if (doc.format === FORMAT) { if (Number(doc.version) > VERSION) throw new Error("That file was made by a newer Kin Relay. Update Kin Relay and try again."); return fromRelay(doc); }
    if (typeof doc.format === "string" && /^kin-(voice-helper|studio)/.test(doc.format) || doc.character || doc.helper || (Array.isArray(doc.characters))) return fromStudio(doc);
    throw new Error("That file isn't a characters file Kin Relay knows (it reads Kindroid's data export, Kin Relay's own file and Kin Studio's character file).");
  }

  // Reads a whole file given as an async source of text pieces, with a hard size ceiling for non-Kindroid files.
  // `chunks` is an async iterable of strings. Returns a result like { format, label, kins: [...], ... }.
  async function parseChunks(chunks, opts) {
    const maxDoc = (opts && opts.maxDocBytes) || 80 * 1024 * 1024;
    let mode = "", buf = "", pending = "", doc = "", size = 0, parser = null;
    const drain = (flush) => {
      let i;
      while ((i = buf.indexOf("\n")) >= 0) { parser.line(buf.slice(0, i)); buf = buf.slice(i + 1); }
      if (flush && buf) { parser.line(buf); buf = ""; }
    };
    // Kindroid's export is one JSON object per line, each with a "type". Anything else is read as one JSON document.
    const decide = (final) => {
      const m = /^\s*(\S[^\n]*)\n/.exec(pending) || (final ? /^\s*(\S[^\n]*)$/.exec(pending) : null);
      if (!m) return false;
      let j = null; try { j = JSON.parse(m[1]); } catch {}
      if (j && typeof j === "object" && !Array.isArray(j) && typeof j.type === "string") { mode = "kindroid"; parser = kindroidParser(); buf = pending; pending = ""; drain(false); }
      else { mode = "doc"; doc = pending; pending = ""; }
      return true;
    };
    for await (const c of chunks) {
      size += c.length;
      if (mode === "kindroid") { buf += c; drain(false); }
      else if (mode === "doc") { doc += c; if (size > maxDoc) throw new Error("That file is too big to be a characters file."); }
      else { pending += c; if (pending.length > maxDoc) throw new Error("That file is too big to be a characters file."); decide(false); }
    }
    if (!mode) { if (!pending.trim()) throw new Error("That file is empty."); decide(true); }
    if (mode === "kindroid") { drain(true); return parser.finish(); }
    let parsed; try { parsed = JSON.parse(doc.replace(/^\uFEFF/, "")); } catch { throw new Error("That file isn't a characters file Kin Relay knows."); }
    return fromDocument(parsed);
  }
  // A big file's pieces, from a browser File or a ReadableStream, as text.
  async function* textPieces(stream) {
    const dec = new TextDecoder("utf-8"), reader = stream.getReader();
    for (;;) { const { done, value } = await reader.read(); if (done) break; yield dec.decode(value, { stream: true }); }
    const tail = dec.decode(); if (tail) yield tail;
  }

  // ---------- writing ----------
  // characters: [{ name, ai_id, share_code, notes, details, avatar (data URL or "") }]
  function toRelayFile(characters, appName) {
    return { format: FORMAT, version: VERSION, app: appName || "Kin Relay", exported_at: new Date().toISOString(),
      characters: characters.map((c) => ({ name: c.name, ai_id: c.ai_id, share_code: c.share_code || "", notes: c.notes || "", details: cleanDetails(c.details), avatar: c.avatar || "" })) };
  }
  function toStudioFile(characters) {
    return { format: STUDIO_FORMAT, exportedAt: new Date().toISOString(), source: "kin-relay", characters: characters.map((c, i) => {
      const d = cleanDetails(c.details);
      const o = { id: "kr" + (c.cid || i), name: c.name, ai_id: c.ai_id, shareCode: c.share_code || "", tag: d.tagline || "", bio: d.bio || "", personality: d.backstory || "", greeting: d.greeting || "",
        keyMemories: d.memory || "", memories: d.memory || "", growth: d.growth || "", importantFacts: d.importantFacts || "", ongoingThreads: d.ongoingThreads || "", directive: d.directive || "",
        example: d.example || "", additional: d.additional || "", appearance: d.appearance || "", descAtelier: d.appearance || "", face: d.face || "", avatar: c.avatar || "" };
      o.build = [o.personality, o.growth, o.importantFacts, o.ongoingThreads, o.additional].filter(Boolean).join("\n\n");
      return o;
    }) };
  }

  const api = { FORMAT, VERSION, FIELDS, FIELD_KEYS, cleanAiId, aiIdProblem, safeAvatarUrl, isDataImage, cleanDetails, emptyDetails, kindroidParser, fromDocument, parseChunks, textPieces, toRelayFile, toStudioFile };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.KinRelayIO = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
