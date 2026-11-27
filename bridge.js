// Kin Relay play page: shows one game's screen and answers it the way Kindroid's page around a screen does.
// The screen (on 127.0.0.1, its own web origin) sends postMessage requests; this page answers them:
//   { kin: "files.read", path [, as: "blob"] }  -> { kin: "files.read", path, body }
//   { kin: "files.write", path, body }           -> { kin: "files.write", path, ok }
//   { kin: "kins" }                              -> { kin: "kins", ok, kins: [{ id, name }], current }
//   { kin: "ask", question }                     -> { kin: "ask", ok, text }        (your Kin, via your API key)
//   { kin: "action", name, input }               -> { kin: "action", name, ok, summary }   (a run on this device)
// Each answer carries the request's id back, as Kindroid does.
(function () {
  "use strict";
  const TOKEN = document.querySelector('meta[name="room-token"]').content;
  const ORIGIN = document.querySelector('meta[name="screen-origin"]').content;
  const WEB = !!window.KR; // phone / web version: the game screen is a sandboxed frame without its own web address
  const slug = WEB ? window.KR.slug() : decodeURIComponent(location.pathname.split("/").pop());
  const $ = (id) => document.getElementById(id);
  const frame = $("screen");
  const H = { "x-room-token": TOKEN, "content-type": "application/json" };
  const api = async (path, body) => (await fetch(path, { method: body ? "POST" : "GET", headers: H, body: body ? JSON.stringify(body) : undefined })).json();
  let state = null, asking = 0, toastT = 0;
  const toast = (t) => { const x = $("toast"); x.textContent = t; x.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(() => x.classList.remove("on"), 5000); };
  const post = (o) => { try { frame.contentWindow.postMessage(o, WEB ? "*" : ORIGIN); } catch {} };
  const game = () => (state.games && state.games[slug]) || { kins: state.settings.kins.map((k) => k.id), current: state.settings.currentKin };
  const gameKins = () => game().kins.map((id) => state.settings.kins.find((k) => k.id === id)).filter(Boolean);
  // Kindroid sends the Kins attached to the app; here, the characters you chose for this game (all of them unless you chose).
  // Each Kin may carry a small picture (a data URL, made here from the character's picture) so a game can show it.
  const thumbs = new Map(); // cid -> data URL ("" when it can't be made)
  const kinsMsg = () => ({ kin: "kins", ok: true, kins: gameKins().map((k) => ({ id: k.id, name: k.name, avatar: thumbs.get(k.cid) || undefined })), current: game().current || undefined, player: state.settings.name || "" });
  function makeThumb(k) {
    return new Promise((resolve) => {
      const i = new Image(); i.onload = () => { try { const c = document.createElement("canvas"); c.width = c.height = 48; const s = Math.min(i.naturalWidth, i.naturalHeight), x = c.getContext("2d"); x.drawImage(i, (i.naturalWidth - s) / 2, (i.naturalHeight - s) / 2, s, s, 0, 0, 48, 48); resolve(c.toDataURL("image/jpeg", 0.7)); } catch { resolve(""); } }; i.onerror = () => resolve("");
      i.src = WEB ? window.KR.avatarUrl(k) : `/avatars/${k.cid}?t=${TOKEN}`;
    });
  }
  let thumbRun = 0;
  async function loadThumbs() {
    const run = ++thumbRun, todo = state.settings.kins.filter((k) => k.avatar && !thumbs.has(k.cid));
    if (!todo.length) return;
    for (let n = 0; n < todo.length && run === thumbRun; n += 4) await Promise.all(todo.slice(n, n + 4).map(async (k) => thumbs.set(k.cid, await makeThumb(k))));
    if (run === thumbRun) post(kinsMsg()); // Kindroid sends the Kin list again when it changes; so do we, now with pictures
  }
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  function avatarInto(box, k) {
    box.replaceChildren();
    if (k && k.avatar) { const i = el("img"); i.src = WEB ? window.KR.avatarUrl(k) : `/avatars/${k.cid}?t=${TOKEN}`; i.alt = ""; box.append(i); }
    else box.textContent = k ? k.name.charAt(0).toUpperCase() : "?";
  }

  function thinking(d) { asking += d; $("thinking").classList.toggle("on", asking > 0); }
  function renderBar() {
    const app = state.apps.find((a) => a.slug === slug);
    $("title").textContent = app ? app.name : slug; document.title = (app ? app.name : slug) + " · Kin Relay";
    const kins = gameKins(), cur = kins.find((k) => k.id === game().current) || kins[0];
    avatarInto($("kinBtnAv"), cur);
    $("kinBtnTxt").textContent = !state.settings.kins.length ? "No Kin yet (Solo only)" : (cur ? cur.name : "Kins") + (kins.length > 1 ? ` +${kins.length - 1}` : "");
    const rp = $("relayPill"); rp.hidden = !(app && app.tables);
    const st = state.relay; $("relayDot").className = "dot " + (st === "online" ? "on" : st === "error" ? "err" : st === "off" ? "" : "warn");
    $("relayTxt").textContent = st === "online" ? "Relay connected" : st === "off" ? "No relay (Solo/Kin only)" : st === "error" ? "Relay problem" : "Relay connecting";
    return app;
  }

  window.addEventListener("message", async (e) => {
    if (e.source !== frame.contentWindow || e.origin !== (WEB ? "null" : ORIGIN)) return;
    const m = e.data;
    if (!m || typeof m !== "object" || typeof m.kin !== "string") return;
    const id = m.id;
    const reply = (o) => post(id != null ? Object.assign({ id }, o) : o);
    try {
      if (m.kin === "files.read") {
        if (m.as === "blob") {
          const r = await fetch(`/api/files/raw?slug=${encodeURIComponent(slug)}&path=${encodeURIComponent(m.path)}`, { headers: H });
          return reply({ kin: "files.read", path: m.path, body: r.ok ? await r.blob() : null });
        }
        const j = await api("/api/files/read", { slug, path: m.path });
        return reply({ kin: "files.read", path: m.path, body: j.body == null ? null : j.body });
      }
      if (m.kin === "files.write") {
        const j = await api("/api/files/write", { slug, path: m.path, body: typeof m.body === "string" ? m.body : JSON.stringify(m.body) });
        return reply({ kin: "files.write", path: m.path, ok: !!j.ok });
      }
      if (m.kin === "kins") return reply(kinsMsg());
      if (m.kin === "open") { // a link the app shows (Kindroid opens it in the person's browser)
        let ok = false; try { const u = new URL(String(m.url || "")); if (u.protocol === "https:" || u.protocol === "http:") { window.open(u.href, "_blank", "noopener,noreferrer"); ok = true; } } catch {}
        return reply({ kin: "open", ok });
      }
      if (m.kin === "save") { // a file the app hands over (an export): saved through the browser's download
        let ok = false;
        try {
          const blob = m.body instanceof Blob ? m.body : new Blob([typeof m.body === "string" ? m.body : JSON.stringify(m.body)], { type: "application/octet-stream" });
          const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = String(m.name || "download").replace(/[\\/:*?"<>|]+/g, "_").slice(0, 120); document.body.append(a); a.click();
          setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000); ok = true;
        } catch {}
        return reply({ kin: "save", ok, name: m.name });
      }
      if (m.kin === "ask") {
        thinking(1);
        try {
          const j = await api("/api/ask", { slug, question: String(m.question || ""), kin: typeof m.kinId === "string" ? m.kinId : "" });
          if (!j.ok) toast(j.error || "Your Kin could not answer.");
          return reply({ kin: "ask", ok: !!j.ok, text: j.ok ? j.text : "", error: j.ok ? undefined : j.error });
        } finally { thinking(-1); }
      }
      if (m.kin === "action") {
        const j = await api("/api/action", { slug, name: m.name, input: m.input || {} });
        return reply({ kin: "action", name: m.name, ok: !!j.ok, summary: j.summary || "" });
      }
    } catch (err) {
      reply({ kin: m.kin, ok: false, path: m.path, name: m.name, body: null, summary: "Kin Relay is not answering. Is its window still open?" });
    }
  });

  // ---------- choosing Kins for this game ----------
  const panel = $("kinPanel");
  const rows = () => [...$("kpList").querySelectorAll(".kprow")];
  const refilter = () => {
    const q = $("kpSearch").value.trim().toLowerCase(); let shown = 0;
    for (const r of rows()) { const ok = !q || r.dataset.name.includes(q); r.hidden = !ok; if (ok) shown++; }
    const n = rows().length, ticked = panel.querySelectorAll('#kpList input[type="checkbox"]:checked').length;
    $("kpCount").textContent = n ? `${n} saved Kin${n === 1 ? "" : "s"}${ticked ? `, ${ticked} ticked` : ", none ticked (the game gets all of them)"}${q ? `, ${shown} shown` : ""}` : "";
  };
  $("kpSearch").oninput = refilter;
  $("kpAll").onclick = () => { for (const r of rows()) if (!r.hidden) r.querySelector('input[type="checkbox"]').checked = true; refilter(); };
  $("kpNone").onclick = () => { for (const r of rows()) { r.querySelector('input[type="checkbox"]').checked = false; r.querySelector('input[type="radio"]').checked = false; } refilter(); };
  function openPanel() {
    const box = $("kpList"); box.replaceChildren(); $("kpSearch").value = "";
    if (!state.settings.kins.length) {
      const p = el("p", "hint", "You haven't added a Kin yet. Solo games need nothing; to play with your Kin, add one on "); const a = el("a", null, "Characters"); a.href = WEB ? window.KR.homeUrl("#characters") : "/#characters"; p.append(a, document.createTextNode(".")); box.append(p);
    }
    const g = game();
    for (const k of state.settings.kins) {
      const row = el("div", "kprow"); row.dataset.name = k.name.toLowerCase();
      const cb = el("input"); cb.type = "checkbox"; cb.checked = state.games && state.games[slug] && state.games[slug].chosen ? g.kins.includes(k.id) : false; cb.value = k.id; cb.id = "kp-" + k.id;
      const lab = el("label", "kpname"); lab.htmlFor = cb.id; const av = el("span", "avatar sm"); avatarInto(av, k); lab.append(av, el("span", null, k.name));
      const rl = el("label", "kpcur"); const rb = el("input"); rb.type = "radio"; rb.name = "kpCur"; rb.value = k.id; rb.checked = k.id === g.current; rl.append(rb, el("span", null, "Your Kin"));
      rb.onchange = () => { if (rb.checked) cb.checked = true; };
      cb.onchange = () => { if (!cb.checked && rb.checked) rb.checked = false; refilter(); };
      row.append(cb, lab, rl); box.append(row);
    }
    $("kpSearch").hidden = state.settings.kins.length <= 8; refilter();
    panel.hidden = false; $("kinBtn").setAttribute("aria-expanded", "true");
    const first = panel.querySelector("input,a,button"); if (first) first.focus();
  }
  function closePanel() { panel.hidden = true; $("kinBtn").setAttribute("aria-expanded", "false"); $("kinBtn").focus(); }
  $("kinBtn").onclick = () => (panel.hidden ? openPanel() : closePanel());
  $("kpCancel").onclick = closePanel;
  panel.addEventListener("keydown", (e) => { if (e.key === "Escape") closePanel(); });
  $("kpSave").onclick = async () => {
    const kins = [...panel.querySelectorAll('input[type="checkbox"]:checked')].map((c) => c.value);
    const curEl = panel.querySelector('input[name="kpCur"]:checked');
    const r = await api("/api/game-kins", { slug, kins, current: curEl ? curEl.value : kins[0] || "" });
    if (r.ok) { state = r.state; renderBar(); post(kinsMsg()); toast(kins.length ? "Saved. The game has the new Kin list." : "Saved. With none ticked, the game gets all your Kins."); } // Kindroid sends the Kin list again when it changes
    closePanel();
  };

  (async () => {
    state = await api("/api/state");
    const app = renderBar();
    api("/api/open", { slug }).catch(() => {}); // starts the game's run, as opening a screen does in Kindroid
    loadThumbs();
    if (!app || !app.screen) { $("title").textContent = "This game has no screen."; return; }
    if (WEB) await window.KR.openScreen(frame, slug); else frame.src = `${ORIGIN}/apps/${encodeURIComponent(slug)}/${app.screenFile}`;
    frame.focus();
    setInterval(async () => { if (document.hidden) return; try { const s = await api("/api/state"); const changed = s.relay !== state.relay; state = s; if (changed) renderBar(); } catch {} }, 6000);
  })();
})();
