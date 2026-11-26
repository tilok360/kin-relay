// Kin Relay play page: shows one game's screen and answers it the way Kindroid's page around a screen does.
// The screen (on 127.0.0.1, its own web origin) sends postMessage requests; this page answers them:
//   { kin: "files.read", path [, as: "blob"] }  -> { kin: "files.read", path, body }
//   { kin: "files.write", path, body }           -> { kin: "files.write", path, ok }
//   { kin: "kins" }                              -> { kin: "kins", ok, kins: [{ id, name }], current }
//   { kin: "ask", question }                     -> { kin: "ask", ok, text }        (your Kin, via your API key)
//   { kin: "action", name, input }               -> { kin: "action", name, ok, summary }   (a run on this PC)
// Each answer carries the request's id back, as Kindroid does.
(function () {
  "use strict";
  const TOKEN = document.querySelector('meta[name="room-token"]').content;
  const ORIGIN = document.querySelector('meta[name="screen-origin"]').content;
  const slug = decodeURIComponent(location.pathname.split("/").pop());
  const $ = (id) => document.getElementById(id);
  const frame = $("screen");
  const H = { "x-room-token": TOKEN, "content-type": "application/json" };
  const api = async (path, body) => (await fetch(path, { method: body ? "POST" : "GET", headers: H, body: body ? JSON.stringify(body) : undefined })).json();
  let state = null, asking = 0, toastT = 0;
  const toast = (t) => { const x = $("toast"); x.textContent = t; x.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(() => x.classList.remove("on"), 5000); };
  const post = (o) => { try { frame.contentWindow.postMessage(o, ORIGIN); } catch {} };
  const game = () => (state.games && state.games[slug]) || { kins: state.settings.kins.map((k) => k.id), current: state.settings.currentKin };
  const gameKins = () => game().kins.map((id) => state.settings.kins.find((k) => k.id === id)).filter(Boolean);
  // Kindroid sends the Kins attached to the app; here, the characters you chose for this game (all of them unless you chose).
  const kinsMsg = () => ({ kin: "kins", ok: true, kins: gameKins().map((k) => ({ id: k.id, name: k.name })), current: game().current || undefined });
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  function avatarInto(box, k) {
    box.replaceChildren();
    if (k && k.avatar) { const i = el("img"); i.src = `/avatars/${k.cid}?t=${TOKEN}`; i.alt = ""; box.append(i); }
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
    if (e.source !== frame.contentWindow || e.origin !== ORIGIN) return;
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
      if (m.kin === "ask") {
        thinking(1);
        try {
          const j = await api("/api/ask", { slug, question: String(m.question || "") });
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
  function openPanel() {
    const box = $("kpList"); box.replaceChildren();
    if (!state.settings.kins.length) {
      const p = el("p", "hint", "You haven't added a Kin yet. Solo games need nothing; to play with your Kin, add one on "); const a = el("a", null, "Characters"); a.href = "/#characters"; p.append(a, document.createTextNode(".")); box.append(p);
    }
    const g = game();
    for (const k of state.settings.kins) {
      const row = el("div", "kprow");
      const cb = el("input"); cb.type = "checkbox"; cb.checked = g.kins.includes(k.id); cb.value = k.id; cb.id = "kp-" + k.id;
      const lab = el("label", "kpname"); lab.htmlFor = cb.id; const av = el("span", "avatar sm"); avatarInto(av, k); lab.append(av, el("span", null, k.name));
      const rl = el("label", "kpcur"); const rb = el("input"); rb.type = "radio"; rb.name = "kpCur"; rb.value = k.id; rb.checked = k.id === g.current; rl.append(rb, el("span", null, "Your Kin"));
      rb.onchange = () => { if (rb.checked) cb.checked = true; };
      cb.onchange = () => { if (!cb.checked && rb.checked) rb.checked = false; };
      row.append(cb, lab, rl); box.append(row);
    }
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
    if (!app || !app.screen) { $("title").textContent = "This game has no screen."; return; }
    frame.src = `${ORIGIN}/apps/${encodeURIComponent(slug)}/${app.screenFile}`;
    frame.focus();
    setInterval(async () => { if (document.hidden) return; try { const s = await api("/api/state"); const changed = s.relay !== state.relay; state = s; if (changed) renderBar(); } catch {} }, 6000);
  })();
})();
