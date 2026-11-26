// Kin Relay lobby: Games, Characters and Settings (and a Welcome page the first time). Talks only to this PC's Kin Relay.
(function () {
  "use strict";
  const TOKEN = document.querySelector('meta[name="room-token"]').content;
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const api = async (path, body) => {
    const r = await fetch(path, { method: body ? "POST" : "GET", headers: { "x-room-token": TOKEN, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    return r.json();
  };
  let state = null, toastT = 0, avVer = Date.now();
  const toast = (t) => { const x = $("toast"); x.textContent = t; x.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(() => x.classList.remove("on"), 3800); };
  const msg = (id, text, ok) => { const m = $(id); m.textContent = text || ""; m.className = m.className.replace(/\s*\b(ok|bad|busy)\b/g, "") + (text ? (ok === true ? " ok" : ok === false ? " bad" : " busy") : ""); };
  const avatarUrl = (k) => `/avatars/${k.cid}?t=${TOKEN}&v=${avVer}`;
  function avatarEl(k, cls) {
    const d = el("div", "avatar " + (cls || ""));
    if (k && k.avatar) { const i = el("img"); i.src = avatarUrl(k); i.alt = ""; d.append(i); }
    else d.textContent = ((k && k.name) || "?").trim().charAt(0).toUpperCase() || "?";
    return d;
  }

  // ---------- views ----------
  const VIEWS = ["welcome", "games", "characters", "settings"];
  function route() {
    let v = location.hash.slice(1);
    if (!VIEWS.includes(v)) v = state && !state.settings.welcomeDone ? "welcome" : "games";
    for (const name of VIEWS) $("view-" + name).hidden = name !== v;
    for (const name of VIEWS.slice(1)) { const t = $("tab-" + name); t.setAttribute("aria-selected", String(name === v)); t.classList.toggle("on", name === v); }
    if (v === "settings" && !$("apiKey").value) setTimeout(() => $("apiKey").focus(), 30);
    if (v === "characters" && state && !state.settings.kins.length && !$("cName").value) setTimeout(() => $("cName").focus(), 30);
    window.scrollTo(0, 0);
  }
  addEventListener("hashchange", route);

  // ---------- games ----------
  const LEVEL = { full: ["full", "Works fully here"], mostly: ["mostly", "Mostly works here"], limited: ["limited", "Limited here"] };
  function renderGames() {
    const g = $("games"); g.replaceChildren();
    if (!state.apps.length) { g.append(el("p", "hint", "No games yet. Drop a game's \"Get its code\" file on this window to add it.")); return; }
    for (const a of state.apps) {
      const card = el("article", "game");
      const img = el("img"); img.src = "/art/" + a.art + ".svg"; img.alt = ""; img.loading = "lazy";
      const lv = LEVEL[(a.report && a.report.level) || "full"];
      const badge = el("span", "tag level " + lv[0], lv[1]);
      const body = el("div", "body");
      body.append(el("h4", null, a.name), el("p", null, a.purpose.replace(/\s*\([^)]*credits[^)]*\)/gi, "").replace(/uses? Kindroid credits/gi, "free here")));
      const tags = el("div", "tags");
      if (a.screen) tags.append(el("span", "tag free", "Solo · free"));
      if (a.report && a.report.shim.some((x) => /asked/.test(x))) tags.append(el("span", "tag kin", "With your Kin"));
      if (a.tables) tags.append(el("span", "tag tables", "Tables via relay"));
      if (a.builtin) tags.append(el("span", "tag", "Comes with Kin Relay"));
      const b = el("button", "primary play", a.screen ? "Play" : "No screen to open"); b.disabled = !a.screen;
      b.onclick = () => { location.href = "/play/" + a.slug; };
      b.setAttribute("aria-label", "Play " + a.name);
      const more = el("div", "more");
      const info = el("button", "ghost", "What works here"); info.onclick = () => showReport(a.name, a.report);
      more.append(info);
      if (!a.builtin) {
        const rm = el("button", "ghost danger", "Remove"); rm.setAttribute("aria-label", "Remove " + a.name);
        rm.onclick = () => dialog("Remove " + a.name + "?", [el("p", null, "The game is deleted from Kin Relay. Your saves for it stay on this PC, so adding it again picks up where you left off.")], [["Cancel", null], ["Remove", async () => { const r = await api("/api/remove", { slug: a.slug }); if (r.ok) { state = r.state; renderGames(); toast(a.name + " removed."); } else toast(r.error || "Couldn't remove it."); }, "primary"]]);
        more.append(rm);
      }
      body.append(tags, b, more); card.append(img, badge, body); g.append(card);
    }
  }
  // ---------- dialogs ----------
  function dialog(title, nodes, buttons) {
    const d = $("dlg"); $("dlgH").textContent = title; $("dlgBody").replaceChildren(...nodes);
    const row = $("dlgBtns"); row.replaceChildren();
    for (const [label, fn, cls] of buttons) { const b = el("button", cls || "ghost", label); b.onclick = () => { d.close(); if (fn) fn(); }; row.append(b); }
    d.showModal(); (row.lastChild || d).focus();
  }
  function list(head, items) { const out = []; if (!items || !items.length) return out; out.push(el("h5", null, head)); const ul = el("ul"); for (const t of items) ul.append(el("li", null, t)); out.push(ul); return out; }
  function reportNodes(r) { return [...list("Works here", r.works), ...list("Kin Relay stands in for Kindroid", r.shim), ...list("Won't work outside Kindroid", r.warnings)]; }
  function showReport(name, r) { dialog(name, reportNodes(r || { works: [], shim: [], warnings: [] }), [["Close", null, "primary"]]); }

  // ---------- adding a game ----------
  async function addFile(file, replace) {
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) return toast("That file is too big (over 25 MB).");
    toast("Adding " + file.name + "…");
    const r = await (await fetch("/api/install", { method: "POST", headers: { "x-room-token": TOKEN, "content-type": "application/octet-stream", "x-file-name": encodeURIComponent(file.name), "x-replace": replace ? "1" : "0" }, body: file })).json();
    if (r.conflict) return dialog(r.name + " is already here", [el("p", null, "Replace it with the one you dropped? Your saves for it are kept.")], [["Keep the old one", null], ["Replace it", () => addFile(file, true), "primary"]]);
    if (!r.ok) return dialog("Couldn't add that file", [el("p", null, r.error)], [["OK", null, "primary"]]);
    state = r.state; renderGames();
    if (location.hash !== "#games") location.hash = "#games";
    const gm = r.game, nodes = [el("p", null, `Added (${gm.files} files). Nothing in it was run.`), ...reportNodes(gm.report)];
    if (gm.skipped && gm.skipped.length) nodes.push(...list("Left out", gm.skipped.slice(0, 12)));
    dialog(gm.name + " is ready", nodes, [["Done", null], ["Play now", () => { location.href = "/play/" + gm.slug; }, "primary"]]);
  }
  $("addGame").onclick = () => $("pickFile").click();
  $("dropzone").onclick = () => $("pickFile").click();
  $("dropzone").onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); $("pickFile").click(); } };
  $("pickFile").onchange = () => { const f = $("pickFile").files[0]; $("pickFile").value = ""; addFile(f); };
  let dragDepth = 0;
  const hasFiles = (e) => e.dataTransfer && [...(e.dataTransfer.types || [])].includes("Files");
  const overPhoto = (e) => e.target && e.target.closest && e.target.closest("#charForm");
  addEventListener("dragenter", (e) => { if (!hasFiles(e)) return; e.preventDefault(); if (overPhoto(e)) return; dragDepth++; $("dropcover").classList.add("on"); });
  addEventListener("dragover", (e) => { if (hasFiles(e)) e.preventDefault(); });
  addEventListener("dragleave", () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) $("dropcover").classList.remove("on"); });
  addEventListener("drop", (e) => {
    if (!hasFiles(e)) return; e.preventDefault(); dragDepth = 0; $("dropcover").classList.remove("on");
    const f = e.dataTransfer.files[0]; if (!f) return;
    if (/^image\//.test(f.type) && !$("view-characters").hidden) return pickPhoto(f); // a picture dropped on Characters
    addFile(f);
  });

  // ---------- characters ----------
  let editing = null, pendingPhoto = null; // pendingPhoto: Blob waiting for Save, or "clear"
  function renderChars() {
    const box = $("charList"); box.replaceChildren();
    const kins = state.settings.kins;
    if (!kins.length) {
      const e = el("div", "empty"); e.append(el("strong", null, "No Kins yet"), el("span", null, "Add your Kin with the form. You only need a name and the AI ID."));
      box.append(e);
    }
    for (const k of kins) {
      const c = el("article", "charcard" + (editing === k.cid ? " on" : ""));
      const info = el("div", "info");
      info.append(el("h4", null, k.name), el("code", null, k.ai_id));
      if (k.notes) info.append(el("p", null, k.notes.length > 110 ? k.notes.slice(0, 110) + "…" : k.notes));
      if (k.id === state.settings.currentKin) info.append(el("span", "tag kin", "Plays by default"));
      const btns = el("div", "cbtns");
      const ed = el("button", "ghost", "Edit"); ed.setAttribute("aria-label", "Edit " + k.name); ed.onclick = () => editChar(k);
      const def = el("button", "ghost", "Make default"); def.hidden = k.id === state.settings.currentKin; def.setAttribute("aria-label", "Make " + k.name + " the default Kin");
      def.onclick = async () => { const r = await api("/api/settings", { currentKin: k.id }); state = r.state; renderAll(); toast(k.name + " now plays by default."); };
      const del = el("button", "ghost danger", "Delete"); del.setAttribute("aria-label", "Delete " + k.name); del.onclick = () => deleteChar(k);
      btns.append(ed, def, del);
      c.append(avatarEl(k), info, btns); box.append(c);
    }
  }
  function editChar(k) {
    editing = k ? k.cid : null; pendingPhoto = null;
    $("edH").textContent = k ? "Edit " + k.name : "Add a Kin";
    $("cCid").value = k ? k.cid : ""; $("cName").value = k ? k.name : ""; $("cAiId").value = k ? k.ai_id : "";
    $("cNotes").value = k ? k.notes || "" : ""; $("cShare").value = k ? k.share_code || "" : "";
    $("cDelete").hidden = !k; msg("charMsg", "");
    for (const f of ["cName", "cAiId"]) $(f).removeAttribute("aria-invalid");
    paintPreview(); renderChars();
    if (k) $("cName").focus();
  }
  function paintPreview() {
    const k = state.settings.kins.find((x) => x.cid === editing);
    const prev = $("cAvPrev"); prev.replaceChildren();
    if (pendingPhoto && pendingPhoto !== "clear") { const i = el("img"); i.src = URL.createObjectURL(pendingPhoto); i.alt = ""; prev.append(i); }
    else if (k && k.avatar && pendingPhoto !== "clear") { const i = el("img"); i.src = avatarUrl(k); i.alt = ""; prev.append(i); }
    else prev.textContent = ($("cName").value || "?").trim().charAt(0).toUpperCase() || "?";
    const has = !!prev.querySelector("img");
    $("cPhotoClear").hidden = !has; $("cPhoto").textContent = has ? "Change picture" : "Add a picture";
  }
  // A picture becomes a 256 px square JPEG here, before it is saved.
  async function pickPhoto(file) {
    if (!file || !/^image\//.test(file.type)) return msg("charMsg", "That isn't a picture.", false);
    if (file.size > 15 * 1024 * 1024) return msg("charMsg", "That picture is too big (over 15 MB).", false);
    try {
      const bmp = await createImageBitmap(file);
      const s = Math.min(bmp.width, bmp.height), cv = document.createElement("canvas"); cv.width = cv.height = 256;
      cv.getContext("2d").drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, 256, 256);
      pendingPhoto = await new Promise((res) => cv.toBlob(res, "image/jpeg", 0.88));
      paintPreview(); msg("charMsg", "Picture ready. Press Save Kin to keep it.", null);
    } catch { msg("charMsg", "That picture couldn't be opened. Try a PNG or JPEG.", false); }
  }
  $("cPhoto").onclick = () => $("cPhotoFile").click();
  $("cPhotoFile").onchange = () => { const f = $("cPhotoFile").files[0]; $("cPhotoFile").value = ""; pickPhoto(f); };
  $("cPhotoClear").onclick = () => { pendingPhoto = "clear"; paintPreview(); };
  $("cName").oninput = () => { if (!$("cAvPrev").querySelector("img")) paintPreview(); };
  $("newChar").onclick = () => { editChar(null); $("cName").focus(); };
  $("cCancel").onclick = () => { editChar(null); $("cName").focus(); };
  $("cDelete").onclick = () => { const k = state.settings.kins.find((x) => x.cid === editing); if (k) deleteChar(k); };
  function deleteChar(k) {
    dialog("Delete " + k.name + "?", [el("p", null, "This removes the character from Kin Relay on this PC. Your Kin in Kindroid isn't touched.")], [["Cancel", null], ["Delete", async () => {
      const r = await api("/api/character", { op: "delete", cid: k.cid });
      if (r.ok) { state = r.state; if (editing === k.cid) editChar(null); renderAll(); msg("charMsg", ""); toast(k.name + " deleted."); }
    }, "primary"]]);
  }
  $("charForm").onsubmit = async (e) => {
    e.preventDefault();
    for (const f of ["cName", "cAiId"]) $(f).removeAttribute("aria-invalid");
    const kin = { cid: $("cCid").value, name: $("cName").value, ai_id: $("cAiId").value, notes: $("cNotes").value, share_code: $("cShare").value };
    const r = await api("/api/character", { op: "save", kin });
    if (!r.ok) { msg("charMsg", r.error, false); if (r.field) { const f = r.field === "name" ? "cName" : "cAiId"; $(f).setAttribute("aria-invalid", "true"); $(f).focus(); } return; }
    state = r.state;
    if (pendingPhoto === "clear") { const x = await api("/api/character", { op: "clearAvatar", cid: r.cid }); state = x.state; }
    else if (pendingPhoto) {
      const x = await (await fetch("/api/avatar", { method: "POST", headers: { "x-room-token": TOKEN, "x-cid": r.cid, "content-type": "application/octet-stream" }, body: pendingPhoto })).json();
      if (x.ok) state = x.state; else toast(x.error || "The picture couldn't be saved.");
    }
    avVer = Date.now();
    const k = state.settings.kins.find((x) => x.cid === r.cid);
    editChar(null); renderAll();
    msg("charMsg", `Saved ${k ? k.name : "your Kin"}.`, true);
    toast(`Saved ${k ? k.name : "your Kin"}.`);
  };

  // ---------- settings ----------
  function renderSettings(full) {
    const s = state.settings;
    $("dataFolder").textContent = state.dataFolder;
    $("helloName").textContent = s.name ? "Welcome back, " + s.name : "Welcome";
    $("keyDot").className = "dot " + (state.key.set ? "on" : "");
    $("keyTxt").textContent = state.key.set ? "Key saved" : "No key yet";
    const ks = $("keyState"); ks.replaceChildren();
    if (state.key.set) ks.append(el("span", "dot on"), el("span", null, "A key is saved (" + state.key.hint + ")."));
    else if (state.key.protection === "locked") ks.append(el("span", "dot err"), el("span", null, "A saved key can't be unlocked on this Windows account. Paste it again."));
    else ks.append(el("span", "dot"), el("span", null, "No key saved yet. Solo games don't need one."));
    $("apiKey").placeholder = state.key.set ? "Paste a new key to replace the saved one" : "kn_…";
    $("keyWhere").textContent = state.key.protection === "encrypted"
      ? "Saved only on this PC, encrypted by Windows for your account. It's never put in a game, a file you share or a message to another player."
      : "Saved only on this PC, in your data folder, readable only by your account. It's never put in a game, a file you share or a message to another player.";
    if (full) { $("relay").value = s.relay || ""; $("myName").value = s.name || ""; }
    for (const r of document.querySelectorAll('input[name="askStyle"]')) r.checked = r.value === (s.askStyle || "chat");
    $("ownRelay").checked = !!state.ownRelay;
    const own = $("ownRelayAddr");
    own.hidden = !state.ownRelay;
    if (state.ownRelay) own.textContent = "Share with friends on your network: " + (state.lan.length ? state.lan.map((ip) => `http://${ip}:${s.ownRelayPort}/`).join("  or  ") : `http://localhost:${s.ownRelayPort}/`);
    const st = state.relay, dot = $("relayDot");
    dot.className = "dot " + (st === "online" ? "on" : st === "error" ? "err" : st === "off" ? "" : "warn");
    $("relayTxt").textContent = st === "online" ? "Relay connected" : st === "error" ? "Relay problem" : st === "off" ? "No relay" : "Relay connecting";
    if (st === "error" && state.relayWhy) msg("relayMsg", state.relayWhy, false);
    // checklists (Games page and Welcome)
    const cl = $("checklist"); cl.replaceChildren();
    const item = (ok, text, href) => { const f = el("div", "fact"); const t = el("span", "tag " + (ok ? "free" : "tables"), ok ? "Ready" : "To do"); const x = href && !ok ? el("a", null, text) : el("span", null, text); if (href && !ok) x.href = href; f.append(t, x); cl.append(f); };
    item(true, "Solo games: ready, no setup needed.");
    item(state.key.set, state.key.set ? "API key saved." : "Add your API key in Settings.", "#settings");
    item(s.kins.length > 0, s.kins.length ? `${s.kins.length} Kin${s.kins.length > 1 ? "s" : ""} on Characters.` : "Add a Kin on Characters.", "#characters");
    item(st === "online", st === "online" ? "Tables with friends: relay connected." : "Tables with friends: set a relay (optional).", "#settings");
    $("wStepKey").classList.toggle("done", state.key.set); $("wStepKin").classList.toggle("done", s.kins.length > 0);
    $("wStepKey").querySelector(".num").textContent = state.key.set ? "✓" : "1";
    $("wStepKin").querySelector(".num").textContent = s.kins.length ? "✓" : "2";
  }
  function renderAll(full) { renderGames(); renderChars(); renderSettings(full); }
  async function load(full) { state = await api("/api/state"); renderAll(full); route(); }

  $("showKey").onclick = () => {
    const shown = $("apiKey").type === "text";
    $("apiKey").type = shown ? "password" : "text"; $("showKey").textContent = shown ? "Show" : "Hide"; $("showKey").setAttribute("aria-pressed", String(!shown));
  };
  const keyResult = (r) => { msg("keyMsg", (r.ok ? "✓ " : "✕ ") + r.message, !!r.ok); };
  $("saveKey").onclick = async () => {
    const k = $("apiKey").value.trim(); if (!k) return msg("keyMsg", "Paste your key in the box first.", false);
    msg("keyMsg", "Checking with Kindroid…", null);
    const r = await api("/api/key", { apiKey: k });
    keyResult(r);
    if (r.saved) { $("apiKey").value = ""; $("apiKey").type = "password"; $("showKey").textContent = "Show"; }
    if (r.state) { state = r.state; renderSettings(); }
  };
  $("testKey").onclick = async () => {
    msg("keyMsg", "Testing with Kindroid…", null);
    const r = await api("/api/key", { test: $("apiKey").value.trim() });
    keyResult(r);
  };
  $("clearKey").onclick = () => dialog("Remove your API key?", [el("p", null, "Kin play stops until you add a key again. Solo games keep working.")], [["Cancel", null], ["Remove", async () => { const r = await api("/api/key", { clear: true }); state = r.state; renderSettings(); msg("keyMsg", r.message, true); }, "primary"]]);
  $("myName").onchange = async () => { const r = await api("/api/settings", { name: $("myName").value }); state = r.state; renderSettings(); toast("Name saved."); };
  for (const r of document.querySelectorAll('input[name="askStyle"]')) r.onchange = async () => {
    if (r.value === "quiet" && !state.settings.kins.some((k) => k.share_code)) toast("Add a share code to your Kin on Characters for quiet asking. Until then, asks go to your chat.");
    const x = await api("/api/settings", { askStyle: r.value }); state = x.state; renderSettings();
  };
  $("saveRelay").onclick = async () => {
    const r = await api("/api/settings", { relay: $("relay").value });
    if (!r.ok) return msg("relayMsg", r.error, false);
    state = r.state; renderSettings(true); msg("relayMsg", $("relay").value ? "Saved. Connecting…" : "Relay turned off.", true);
    setTimeout(load, 2500);
  };
  $("ownRelay").onchange = async () => {
    const r = await api("/api/own-relay", { on: $("ownRelay").checked }); state = r.state; renderSettings(true);
    msg("relayMsg", state.ownRelay ? "Relay running on this PC." : "Relay on this PC stopped.", true);
    setTimeout(load, 2500);
  };
  // Welcome: leaving it for any page counts as seen, so it shows only the first time (Getting started brings it back).
  const seen = async () => { if (!state.settings.welcomeDone) { const r = await api("/api/settings", { welcomeDone: true }); state = r.state; } };
  for (const id of ["wGoKey", "wGoKin", "wGoGames"]) $(id).addEventListener("click", seen);
  $("wDone").onclick = async () => { await seen(); location.hash = "#games"; route(); };

  load(true).then(() => editChar(null));
  setInterval(() => { if (!document.hidden) api("/api/state").then((s) => { const was = state && state.relay; state = s; if (s.relay !== was) renderSettings(); }); }, 5000);
})();
