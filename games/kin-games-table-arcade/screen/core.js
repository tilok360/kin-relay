// Kin Games: Table & Arcade: the lounge and the shell every game runs in. It talks to the page around the screen (files, the Kin,
// actions), keeps settings, scores and achievements, loads a game's code only when it is opened, and gives each game
// an `api`. Two ways to play: Solo (free: the computer plays, nothing is asked and no run happens) and with your Kin
// (your Kin is asked for its moves or lines, which uses Kindroid credits, and each finished game is one short run).
(function () {
  "use strict";
  const Q = new URLSearchParams(location.search);
  const ASK_MS = (Number(Q.get("asktimeout")) || 90) * 1000; // a Kin may first wait for Kindroid's limit (10 requests per 30 seconds)
  const $ = (id) => document.getElementById(id);
  const K = window.Kit, CAT = window.KG_CATALOG, SFX = K.sfx, el = K.el;
  const KG = (window.KG = { games: [], add(g) { const c = CAT.GAMES.find((x) => x.id === g.id) || {}; const m = Object.assign({}, g, { title: c.title || g.title, blurb: c.blurb || g.blurb, cat: c.cat, kin: c.kin }); const i = this.games.findIndex((x) => x.id === g.id); if (i >= 0) this.games[i] = m; else this.games.push(m); } });

  // ---------- the page around the screen ----------
  let seq = 0; const waiting = {};
  function send(msg, ms) {
    const id = "m" + (++seq); msg.id = id;
    return new Promise((res) => { waiting[id] = res; parent.postMessage(msg, "*"); setTimeout(() => { if (waiting[id]) { delete waiting[id]; res(null); } }, ms || 10000); });
  }
  const read = async (p) => { const m = await send({ kin: "files.read", path: p }); try { return m && m.body ? JSON.parse(m.body) : null; } catch { return null; } };
  const write = (p, o) => send({ kin: "files.write", path: p, body: JSON.stringify(o) });
  const ask = async (q) => { const m = await send({ kin: "ask", question: q.slice(0, 7900), kinId: current ? current.id : undefined }, ASK_MS); if (m && m.ok && m.text) return String(m.text);
    const why = `${current ? current.name : "Your Kin"} couldn't answer: ${(m && m.error) || "Kin Relay didn't get an answer in time."}`; // never silent: say why (no key, wrong key, offline ...)
    status(why); setTimeout(() => { if ($("status").textContent === why) status(""); }, 9000);
    return null; };
  KG.read = read; KG.write = write;

  let kins = [], current = null, fromChat = false;
  addEventListener("message", (e) => {
    const d = e.data || {};
    if (d.id && waiting[d.id]) { const f = waiting[d.id]; delete waiting[d.id]; f(d); }
    if (d.kin === "kins") {
      kins = Array.isArray(d.kins) ? d.kins : [];
      fromChat = typeof d.current === "string"; window.__krCur = d.current;
      pickCurrent();
      showMode(); renderShelves();
    }
  });
  // Which Kin plays: the one chosen on the lounge (remembered in this app's settings), else the one the page around the screen names, else the first.
  function pickCurrent() { const want = (typeof settings === "object" && settings && settings.kin) || ""; current = (want && kins.find((k) => k.id === want)) || (fromChat && kins.find((k) => k.id === window.__krCur)) || kins[0] || null; }
  const realKin = () => (current && current.name) || "Your Kin";
  const hasKin = () => !!current;

  // ---------- settings, scores, achievements ----------
  let settings = { play: "solo", mode: "kin", level: "normal", sound: { on: true, vol: 0.7 }, favs: [], prefs: {} }, scores = {}, soloStats = {}, achBook = {};
  const saveSettings = () => write("settings.json", settings);
  const solo = () => settings.play === "solo";
  const akey = (isSolo) => (isSolo ? "solo" : (current && current.id) || "any");
  const achRead = (gid, isSolo) => ((achBook[akey(isSolo)] || {})[gid]) || { you: {}, kin: {} };
  function achFor(gid, isSolo) { const b = achBook[akey(isSolo)] || (achBook[akey(isSolo)] = {}); return b[gid] || (b[gid] = { you: {}, kin: {} }); }
  function recordFor(id) {
    if (solo()) { const s = soloStats[id]; return s ? { you: s.w, kin: s.l, draw: s.d } : null; }
    const mine = (current && scores[current.id]) || scores.any || {}; return mine[id] || null;
  }

  // ---------- choosing for the Kin and the computer ----------
  const shuffle = K.shuffle;
  function pool(ranked, level) {
    const lv = level || settings.level;
    if (lv === "hard") return ranked.slice(0, 3);
    if (lv === "normal") return ranked.slice(0, 6);
    if (lv === "easy") return shuffle(ranked.slice(0, Math.max(8, Math.ceil(ranked.length / 2)))).slice(0, 8);
    return shuffle(ranked.slice()).slice(0, 8);
  }
  function appPick(p, level) {
    const lv = level || settings.level;
    if (lv === "hard" || p.length === 1) return p[0];
    if (lv === "normal") { const r = Math.random(); return p[r < 0.55 ? 0 : r < 0.8 ? 1 : Math.min(2, p.length - 1)]; }
    return p[Math.floor(Math.random() * p.length)];
  }
  const cleanLine = (t) => String(t || "").trim().replace(/^```[a-z]*|```$/g, "").replace(/^["“]+|["”]+$/g, "").replace(/\s+/g, " ").slice(0, 260);

  // ---------- toasts ----------
  const toastQ = []; let toasting = false;
  function toast(icon, t1, t2, t3) {
    toastQ.push({ icon, t1, t2, t3 }); if (toasting) return;
    const next = () => {
      const t = toastQ.shift(); if (!t) { toasting = false; return; }
      toasting = true; $("sealicon").textContent = t.icon; $("t1").textContent = t.t1; $("t2").textContent = t.t2; $("t3").textContent = t.t3 || "";
      $("toast").classList.add("show"); SFX.achieve();
      setTimeout(() => { $("toast").classList.remove("show"); setTimeout(next, 400); }, K.fast ? 200 : 2800);
    };
    next();
  }

  // ---------- one game on screen ----------
  let session = null;
  function say(text, who) {
    const e = $("say"); e.textContent = "";
    if (who) e.append(el("b", "", who + ": "));
    e.append(text || ""); e.hidden = !text;
  }
  function status(text, thinking) { const e = $("status"); e.textContent = text || ""; e.classList.toggle("thinking", !!thinking); }

  function makeApi(game, saved, isSolo) {
    let lastLine = 0, talking = false, saveTimer = null, ended = false, earned = [];
    const file = (isSolo ? "solo-" : "game-") + game.id + ".json";
    const live = () => session && session.api === api;
    const api = {
      el: $("stage"), state: saved, game, solo: isSolo, sfx: SFX, kit: K,
      get settings() { return settings; },
      kinName: () => (isSolo ? "Computer" : realKin()), hasKin: () => !isSolo && hasKin(), status, rand: Math.random,
      sayKin: (t) => say(t, api.kinName()), sayApp: (t) => say(t),
      async firstMover() {
        const s = (await read("starts.json")) || {}, key = (isSolo ? "solo:" : "") + game.id, who = s[key] === "you" ? "kin" : "you";
        s[key] = who; write("starts.json", s); return who;
      },
      async kinMove(spec) {
        const c = await api.choose(spec);
        if (!c) return null;
        if (c.say) say(c.say, realKin());
        else if (c.missed) status(`${realKin()} didn't answer in time, so the app moved for it.`);
        else if (!isSolo && settings.mode === "talk" && spec.talk) api.line(spec.talk);
        return c.move;
      },
      pref: (k, d) => (settings.prefs[game.id + "." + k] != null ? settings.prefs[game.id + "." + k] : d),
      setPref: (k, v) => { settings.prefs[game.id + "." + k] = v; saveSettings(); },
      botPick: (ranked, level) => (ranked.length ? appPick(pool(ranked, level), level) : null),
      save(state) { clearTimeout(saveTimer); saveTimer = setTimeout(() => write(file, state), 150); },
      // In Solo the computer picks at the level set; nothing is asked. With your Kin (and "your Kin chooses"), it is asked.
      async choose(spec) {
        const ranked = spec.ranked || [];
        if (!ranked.length) return null;
        if (ranked.length === 1) return { move: ranked[0], say: "", asked: false };
        const p = pool(ranked);
        if (!isSolo && settings.mode === "kin" && hasKin()) {
          const opts = shuffle(p.slice());
          status(`${realKin()} is thinking…`, true);
          const q = `We're playing ${game.title} in ${CAT.APP.name}. ${spec.situation || ""}\nYour options:\n${opts.map((o, i) => `${i + 1}) ${o.label}`).join("\n")}\nPick one. Reply only with JSON, no other text: {"pick": number, "say": "one short line to your person, in your own voice"}`;
          const t = await ask(q);
          if (!live()) return null;
          status("");
          if (t) {
            let n = NaN, line = "";
            const m = t.match(/\{[\s\S]*\}/);
            if (m) { try { const j = JSON.parse(m[0]); n = Number(j.pick); line = cleanLine(j.say); } catch {} }
            if (!(n >= 1)) { const d = t.match(/\b(\d{1,2})\b/); if (d) n = Number(d[1]); }
            if (n >= 1 && n <= opts.length) return { move: opts[n - 1], say: line, asked: true };
          }
          return { move: appPick(p), say: "", asked: false, missed: true };
        }
        if (isSolo) await K.wait(60);
        return { move: appPick(p), say: "", asked: false };
      },
      // A line from your Kin (never in Solo or quiet; at most one every 20 seconds unless it matters).
      async line(context, matters) {
        if (isSolo || settings.mode === "quiet" || !hasKin() || talking) return;
        if (!matters && Date.now() - lastLine < 20000) return;
        talking = true; lastLine = Date.now();
        const t = await ask(`We're playing ${game.title} in ${CAT.APP.name}. ${context} Say one short line to your person about it, in your own voice. Reply with just the line.`);
        talking = false;
        if (t && live()) say(cleanLine(t), realKin());
      },
      async over(result, detail) {
        if (ended) return; ended = true;
        clearTimeout(saveTimer); write(file, null);
        const ban = $("banner"); ban.hidden = false;
        ban.className = "banner " + (result === "you" ? "won" : result === "kin" ? "lost" : "draw");
        ban.querySelector("b").textContent = result === "you" ? "You win!" : result === "kin" ? `${api.kinName()} wins` : "A draw";
        ban.querySelector("span").textContent = detail ? String(detail).slice(0, 160) : "";
        if (result === "you") { SFX.win(); K.confetti($("table")); } else if (result === "kin") SFX.lose(); else SFX.draw();
        status("");
        if (isSolo) {
          const s = soloStats[game.id] || (soloStats[game.id] = { w: 0, l: 0, d: 0, streak: 0, best: 0 });
          if (result === "you") { s.w++; s.streak++; s.best = Math.max(s.best, s.streak); } else if (result === "kin") { s.l++; s.streak = 0; } else s.d++;
          write("solo-stats.json", soloStats);
          return;
        }
        const achievements = earned.slice(0, 20).map((k) => { const [who, id] = k.split(":"); return { who, name: ((game.achievements || []).find((a) => a.id === id) || {}).name || id }; });
        send({ kin: "action", name: CAT.APP.over, input: { game: game.id, result, detail: String(detail || "").slice(0, 300), achievements, ...(current ? { kin_id: current.id } : {}) } }, 60000).then(loadScores);
        if (settings.mode !== "quiet" && hasKin()) {
          const how = result === "you" ? "Your person won" : result === "kin" ? "You won" : "It was a draw";
          api.line(`We just finished a game: ${how}${detail ? " (" + detail + ")" : ""}. Say one or two short lines about the game.`, true);
        }
      },
      ended: () => ended,
      achieve(id, who) {
        if (!live()) return;
        const a = (game.achievements || []).find((x) => x.id === id);
        if (!a || (who !== "you" && who !== "kin") || earned.includes(who + ":" + id)) return;
        if (isSolo && who !== "you") return; // the computer doesn't collect achievements
        earned.push(who + ":" + id);
        const side = achFor(game.id, isSolo)[who], rec = side[id] || (side[id] = { n: 0, name: a.name }); rec.n++;
        write("achievements.json", achBook); showAch(game, isSolo);
        toast(a.icon, (who === "you" ? "You earned" : realKin() + " earned") + (rec.n > 1 ? ` ×${rec.n}` : ""), a.name, a.about);
        if (who === "you" && !isSolo && settings.mode !== "quiet" && hasKin()) api.line(`Your person just earned the "${a.name}" achievement (${a.about.replace(/\.$/, "").toLowerCase()}).`, true);
      },
    };
    return api;
  }

  // ---------- loading game code on demand ----------
  const DEPS = { carrom: ["physics"], darts: ["physics"], pool: ["physics"], minigolf: ["physics"], shuffleboard: ["physics", "arcade"], bowling: ["physics", "arcade"], airhockey: ["physics", "arcade"], foosball: ["physics", "arcade"], tabletennis: ["physics", "arcade"], alleyroll: ["physics", "arcade"], cuppong: ["physics", "arcade"], ludo: ["race"], popdice: ["race"] };
  const loaded = {};
  function loadScript(name) {
    if (loaded[name]) return loaded[name];
    return (loaded[name] = new Promise((res, rej) => { const s = document.createElement("script"); s.src = `games/${name}.js`; s.onload = res; s.onerror = () => { delete loaded[name]; rej(new Error("could not load " + name)); }; document.head.append(s); }));
  }
  async function loadGame(id) { for (const d of DEPS[id] || []) await loadScript(d); await loadScript(id); return KG.games.find((g) => g.id === id); }
  KG.loadGame = loadGame;

  function showAch(game, isSolo) {
    const box = $("achs"); box.textContent = "";
    const list = game.achievements || [], book = achRead(game.id, isSolo);
    let y = 0;
    for (const a of list) {
      const n = book.you[a.id] ? book.you[a.id].n : 0, k = book.kin[a.id] ? book.kin[a.id].n : 0; if (n) y++;
      const c = el("div", "ach" + (n ? " got" : "")); c.append(el("span", "ai", a.icon), el("b", "", a.name), el("small", "", a.about), el("span", "an", n ? (n > 1 ? "×" + n : "✔") : "–"));
      if (!isSolo && k) c.title = `${realKin()} has this ×${k}`;
      box.append(c);
    }
    $("achsum").textContent = list.length ? `${y} of ${list.length}` : "";
  }

  async function open(id, fresh) {
    const meta = CAT.GAMES.find((g) => g.id === id); if (!meta) return;
    close(); SFX.open();
    view("play");
    $("gtitle").textContent = meta.title; $("gbox").innerHTML = CAT.boxSVG(meta);
    $("banner").hidden = true; say(""); status("Loading…");
    const isSolo = solo();
    $("gmode").textContent = isSolo ? "Solo · Free · no credits" : `With ${realKin()} · Uses Kindroid credits`;
    $("gmode").className = "badge " + (isSolo ? "free" : "paid");
    $("gnote").textContent = isSolo ? "" : meta.kin === "cheer" ? `The app plays ${realKin()}'s side; ${realKin()} talks along now and then (uses credits).` : meta.kin === "shots" ? `${realKin()} calls each shot and the app takes it (uses credits).` : settings.mode === "kin" ? `${realKin()} is asked for every move (uses credits).` : "";
    const stage = $("stage"); stage.textContent = ""; stage.className = "stage g-" + id;
    let game;
    try { game = await loadGame(id); } catch (e) { status("This game couldn't load."); return; }
    if (!game) { status("This game couldn't load."); return; }
    $("rules").textContent = game.rules || ""; showAch(game, isSolo);
    status("");
    const saved = fresh ? null : await read((isSolo ? "solo-" : "game-") + id + ".json");
    const api = makeApi(game, saved && saved.v ? saved : null, isSolo);
    session = { game, api, inst: null };
    try { session.inst = game.mount(api) || {}; }
    catch (e) { stage.textContent = "This game hit a problem: " + e.message; console.error(e); }
    $("stage").focus({ preventScroll: true });
  }
  function close() { if (session && session.inst && session.inst.destroy) { try { session.inst.destroy(); } catch {} } session = null; }
  function back() { close(); view("lounge"); loadScores(); }
  function view(v) { $("lounge").hidden = v !== "lounge"; $("play").hidden = v !== "play"; document.body.dataset.view = v; window.scrollTo(0, 0); }

  // ---------- the lounge ----------
  let filter = "all", query = "";
  function showMode() {
    const isSolo = solo();
    $("modeSolo").classList.toggle("on", isSolo); $("modeKin").classList.toggle("on", !isSolo);
    $("modeSolo").setAttribute("aria-pressed", isSolo); $("modeKin").setAttribute("aria-pressed", !isSolo);
    $("kinWho").textContent = current ? `Play ${current.name}` : "Play your Kin";
    $("kinOpts").hidden = isSolo;
    renderKinSel();
    $("kinbar").textContent = current ? (kins.length > 1 && !fromChat && !window.KRKins ? `${current.name} (the first attached Kin; open ${CAT.APP.name} from another Kin's chat to play that one).` : "") : "No Kin is attached yet: attach one in the app's settings → Kins. Until then the app plays the other side.";
    $("modeNote").textContent = isSolo ? "Solo runs entirely on this screen: the computer plays, nothing is sent to your Kin, and it uses no Kindroid credits and none of the app's runs." : "Your Kin is asked for its moves or a line now and then (each question takes a few seconds and uses Kindroid credits, like a message). Every finished game is saved with one short run (game_over) and your Kin is told how it went.";
  }
  // Choose which of your saved Kins to play (shown when Kin Relay has more than one).
  function renderKinSel() {
    const box = $("kinSel"); if (!box) return;
    const on = !!window.KRKins && kins.length > 1, note = $("kinSelNote");
    box.hidden = !on; if (note) note.hidden = !on; if (!on) return;
    window.KRKins.chooser(box, { current: current && current.id, pick: (id) => { settings.kin = id; saveSettings(); pickCurrent(); showMode(); } });
  }
  function renderShelves() {
    const host = $("shelves"); host.textContent = "";
    const q = query.trim().toLowerCase();
    const match = (g) => (!q || (g.title + " " + g.blurb + " " + g.cat).toLowerCase().includes(q)) && (filter === "all" || (filter === "favs" ? settings.favs.includes(g.id) : g.cat === filter));
    const groups = filter === "favs" ? [{ id: "favs", name: "Favorites" }] : CAT.CATS;
    let any = 0;
    for (const c of groups) {
      const list = CAT.GAMES.filter((g) => match(g) && (c.id === "favs" || g.cat === c.id)); if (!list.length) continue;
      any += list.length;
      const sec = el("section", "shelf"), h = el("h2", "", c.name); h.append(el("small", "", `${list.length} game${list.length > 1 ? "s" : ""}`)); sec.append(h);
      const row = el("div", "row-boxes");
      for (const g of list) row.append(boxTile(g));
      sec.append(row, el("div", "plank")); host.append(sec);
    }
    if (!any) host.append(el("p", "empty", settings.favs.length || filter !== "favs" ? "No games match that." : "Tap the ☆ on any box to keep it here."));
  }
  function boxTile(g) {
    const w = el("div", "gbox"), b = K.btn("box", null, () => open(g.id));
    b.innerHTML = CAT.boxSVG(g); b.setAttribute("aria-label", `${g.title}: ${g.blurb}`);
    const lab = el("div", "boxlab"); lab.append(el("b", "", g.title), el("span", "", g.blurb));
    const r = recordFor(g.id), got = Object.keys(achRead(g.id, solo()).you).length;
    if (r || got) lab.append(el("i", "", (r ? `You ${r.you} · ${solo() ? "CPU" : realKin()} ${r.kin}${r.draw ? " · " + r.draw + " drawn" : ""}` : "") + (got ? ` · 🏅${got}` : "")));
    b.append(lab);
    const fav = settings.favs.includes(g.id), f = K.btn("fav" + (fav ? " on" : ""), fav ? "★" : "☆", (e) => { e.stopPropagation(); const i = settings.favs.indexOf(g.id); if (i >= 0) settings.favs.splice(i, 1); else settings.favs.push(g.id); saveSettings(); SFX.click(); renderShelves(); });
    f.setAttribute("aria-label", (fav ? "Remove " : "Add ") + g.title + (fav ? " from" : " to") + " favorites"); f.setAttribute("aria-pressed", fav);
    w.append(b, f); return w;
  }
  function renderChips() {
    const box = $("chips"); box.textContent = "";
    for (const c of [{ id: "all", name: "All" }, { id: "favs", name: "★ Favorites" }, ...CAT.CATS]) {
      const b = K.btn("chip" + (filter === c.id ? " on" : ""), c.name, () => { filter = c.id; SFX.click(); renderChips(); renderShelves(); });
      b.setAttribute("aria-pressed", filter === c.id); box.append(b);
    }
  }
  async function loadScores() { scores = (await read("scores.json")) || {}; soloStats = (await read("solo-stats.json")) || {}; renderShelves(); }
  function applySound() {
    SFX.setVolume(settings.sound.vol, !settings.sound.on);
    $("mute").textContent = !settings.sound.on || !settings.sound.vol ? "🔇" : settings.sound.vol < 0.4 ? "🔉" : "🔊";
    $("mute").setAttribute("aria-label", settings.sound.on ? "Mute" : "Turn sound on"); $("vol").value = Math.round(settings.sound.vol * 100);
  }

  function init() {
    document.title = CAT.APP.name; $("appSub").textContent = CAT.APP.sub + " · " + CAT.GAMES.length + " games"; $("sister").textContent = "Looking for more? " + CAT.APP.other + " is its own app, in your Apps.";
    renderChips(); renderShelves(); showMode();
    $("modeSolo").onclick = () => { settings.play = "solo"; saveSettings(); SFX.click(); showMode(); renderShelves(); };
    $("modeKin").onclick = () => { settings.play = "kin"; saveSettings(); SFX.click(); showMode(); renderShelves(); };
    $("search").oninput = () => { query = $("search").value; renderShelves(); };
    $("back").onclick = back;
    $("again").onclick = () => session && open(session.game.id, true);
    let armed = 0;
    $("newgame").onclick = () => {
      if (!session) return;
      if (!session.api.ended() && Date.now() - armed > 4000) { armed = Date.now(); $("newgame").textContent = "Tap again to restart"; setTimeout(() => { $("newgame").textContent = "New game"; }, 4000); return; }
      open(session.game.id, true);
    };
    $("mode").onchange = () => { settings.mode = $("mode").value; saveSettings(); };
    const setLevel = (v) => { settings.level = v; $("level").value = v; $("level2").value = v; saveSettings(); };
    $("level").onchange = () => setLevel($("level").value); $("level2").onchange = () => setLevel($("level2").value);
    $("mute").onclick = () => { SFX.unlock(); settings.sound.on = !settings.sound.on; if (settings.sound.on && !settings.sound.vol) settings.sound.vol = 0.6; applySound(); saveSettings(); };
    $("vol").oninput = () => { SFX.unlock(); settings.sound.vol = $("vol").value / 100; settings.sound.on = settings.sound.vol > 0; applySound(); };
    $("vol").onchange = () => { saveSettings(); SFX.click(); };
    $("rulesBtn").onclick = () => { $("rulesDlg").hidden = false; $("rulesClose").focus(); };
    $("rulesClose").onclick = () => ($("rulesDlg").hidden = true);
    addEventListener("pointerdown", () => SFX.unlock(), { once: true });
    addEventListener("keydown", (e) => {
      if (e.key === "Escape") { if (!$("rulesDlg").hidden) { $("rulesDlg").hidden = true; return; } if (!$("play").hidden && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) back(); }
      if (e.key === "/" && !$("lounge").hidden && document.activeElement !== $("search")) { e.preventDefault(); $("search").focus(); }
    });
    parent.postMessage({ kin: "kins" }, "*");
    read("settings.json").then((s) => {
      if (s) { for (const k of ["play", "mode", "level", "kin"]) if (typeof s[k] === "string") settings[k] = s[k]; if (s.sound && typeof s.sound === "object") settings.sound = { on: s.sound.on !== false, vol: Math.max(0, Math.min(1, Number(s.sound.vol) || 0)) }; if (Array.isArray(s.favs)) settings.favs = s.favs.filter((x) => typeof x === "string").slice(0, 60); if (s.prefs && typeof s.prefs === "object") for (const [k, v] of Object.entries(s.prefs).slice(0, 40)) if (typeof v === "number" || typeof v === "string") settings.prefs[k] = typeof v === "string" ? v.slice(0, 40) : v; }
      if (s && !s.play) settings.play = "kin"; // people who already played keep playing their Kin until they switch
      $("mode").value = settings.mode; $("level").value = settings.level; $("level2").value = settings.level;
      pickCurrent(); applySound(); showMode(); renderShelves();
      if (Q.get("game")) open(Q.get("game")); // a game named in the address opens once settings are in
    });
    read("achievements.json").then((b) => { achBook = b || {}; renderShelves(); });
    loadScores();
    document.body.classList.add("ready");
  }
  KG.init = init; KG.open = open; KG.back = back;
  KG.util = { shuffle };
  KG.state = () => ({ session: session && { id: session.game.id, ended: session.api.ended(), solo: session.api.solo }, settings });
})();
