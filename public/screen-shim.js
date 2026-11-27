// Kin Relay: added to every game screen when Kin Relay shows it (the game's own files are never changed on disk).
//  1. Wording: games made for Kindroid word some modes as paid and say they run on Kindroid's servers. In Kin Relay the game runs on
//     this device and a Kin answers through the player's own Kindroid API key, so that wording is rewritten to say so.
//  2. window.KRKins: the saved Kins (from the page around the screen), with a search box and pictures for long lists.
(function () {
  "use strict";
  if (window.__krShim) return; window.__krShim = true;

  // ---------- 1. wording ----------
  const R = [
    [/\b(runs?) (?:this|the) app on Kindroid\b/g, "$1 on this device"],
    [/, so it may use (?:Kindroid )?credits(?: \([^)]*\))?/g, ", so it uses no Kindroid Apps credits"],
    [/and that may use (?:Kindroid )?credits/g, "and that uses no Kindroid Apps credits"],
    [/may use (?:Kindroid )?credits/g, "uses no Kindroid Apps credits"],
    [/is a Kin request on your account and uses credits/g, "is a normal Kin message through your Kindroid API key, not Kindroid Apps credits"],
    [/is a Kin request on your account/g, "is a normal Kin message through your Kindroid API key"],
    [/Each ask is a Kin request and uses Kindroid credits/g, "Each ask is a normal Kin message through your Kindroid API key, not Kindroid Apps credits"],
    [/uses Kindroid credits, like a message/g, "is a normal Kin message through your Kindroid API key, not Kindroid Apps credits"],
    [/seating a Kin uses a Kin request per decision/g, "each Kin decision is a normal Kin message through your Kindroid API key"],
    [/one Kin request \(credits\)/g, "one Kin message through your API key"],
    [/\(asks your Kin: credits\)/g, "(asks your Kin through your API key)"],
    [/\((?:it )?uses credits\)/g, "(a Kin message through your API key)"],
    [/talking uses credits/g, "talking sends Kin messages through your API key"],
    [/\b(uses|use) (?:Kindroid )?credits\b/g, "$1 your Kindroid API"],
    [/\bcosts? (?:Kindroid )?credits\b/g, "is a normal Kin message through your API key"],
    [/Uses Kindroid credits/g, "Uses your Kindroid API"],
    [/Uses credits/g, "Uses your Kindroid API"],
    [/Kindroid credits/g, "Kindroid Apps credits"],
    [/^(\s*)Credits(\s*)$/, "$1Credits and your API key$2"],
    [/Attach (a Kin|Kins) to (?:this app|Kin Casino|the app)(?: in Kindroid)?( first)?/g, "Add $1 on Kin Relay's Characters tab$2"],
    [/This copy has no table address yet; try again in a moment\./g, "Tables need a relay. Open Kin Relay > Settings, set a relay address (a free one is fine), then try again."],
    [/No Kin is attached yet: attach one in the app's settings → Kins\./g, "No Kin is added yet: add one on Kin Relay's Characters tab."],
  ];
  const fix = (s) => { let o = s; for (const [re, to] of R) o = o.replace(re, to); return o; };
  const ATTRS = ["placeholder", "title", "aria-label"];
  function scan(root) {
    if (!root) return;
    if (root.nodeType === 3) { const n = root.nodeValue, f = fix(n); if (f !== n) root.nodeValue = f; return; }
    if (root.nodeType !== 1 || /^(SCRIPT|STYLE|TEXTAREA)$/.test(root.tagName)) return;
    for (const a of ATTRS) { const v = root.getAttribute(a); if (v) { const f = fix(v); if (f !== v) root.setAttribute(a, f); } }
    for (let c = root.firstChild; c; c = c.nextSibling) scan(c);
  }
  let queued = false;
  function soon() { if (queued) return; queued = true; Promise.resolve().then(() => { queued = false; if (document.body) scan(document.body); if (document.title) { const t = fix(document.title); if (t !== document.title) document.title = t; } }); }
  function watch() { scan(document.body); new MutationObserver(soon).observe(document.documentElement, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ATTRS }); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", watch); else watch();

  // ---------- 2. the saved Kins ----------
  let kins = [], cbs = [], player = "";
  const style = document.createElement("style");
  style.textContent = ".krk-av{width:22px;height:22px;border-radius:50%;object-fit:cover;vertical-align:middle;margin:-3px 6px -3px -4px;background:#ffffff22}" +
    ".krk-ini{display:inline-flex;width:22px;height:22px;border-radius:50%;align-items:center;justify-content:center;font-size:12px;font-weight:700;margin:-3px 6px -3px -4px;background:#ffffff2e;color:inherit;vertical-align:middle}" +
    ".krk-search{display:block;width:100%;box-sizing:border-box;margin:6px 0;padding:8px 12px;border-radius:10px;border:1px solid #ffffff33;background:#00000033;color:inherit;font:inherit}" +
    ".krk-scroll{max-height:230px;overflow:auto;padding:2px}.krk-none{opacity:.7;font-size:13px;padding:4px}";
  (document.head || document.documentElement).appendChild(style);
  const MANY = 8;
  const norm = (s) => String(s || "").toLowerCase();
  const byId = (id) => kins.find((k) => k.id === id);
  function face(k) {
    if (k && k.avatar) { const i = document.createElement("img"); i.className = "krk-av"; i.alt = ""; i.src = k.avatar; return i; }
    const s = document.createElement("span"); s.className = "krk-ini"; s.textContent = k && k.name ? k.name.charAt(0).toUpperCase() : "?"; return s;
  }
  // Decorate buttons a game already drew for the Kins: a picture on each, and a search box above when there are many.
  // items[i] is the Kin id of box.children[i] (null for a button that isn't a Kin, like "Just me").
  function enhance(box, items) {
    if (!box || !items) return;
    const btns = [...box.children].filter((c) => c.tagName === "BUTTON");
    btns.forEach((b, i) => {
      const id = items[i]; if (!id) return;
      const k = byId(id); b.dataset.krname = norm(k ? k.name : b.textContent);
      if (!b.querySelector(".krk-av,.krk-ini")) b.insertBefore(face(k), b.firstChild);
    });
    const many = items.filter(Boolean).length > MANY;
    let s = box._krs;
    if (many && !s) {
      s = box._krs = document.createElement("input"); s.type = "search"; s.className = "krk-search"; s.setAttribute("aria-label", "Search your Kins"); s.autocomplete = "off";
      s.oninput = () => filter(box); box.parentNode.insertBefore(s, box);
    }
    if (s) { s.hidden = !many; s.placeholder = `Search your ${items.filter(Boolean).length} Kins`; }
    box.classList.toggle("krk-scroll", many); filter(box);
  }
  function filter(box) {
    const s = box._krs, q = s && !s.hidden ? norm(s.value).trim() : "";
    let shown = 0;
    for (const b of box.children) if (b.tagName === "BUTTON" && b.dataset.krname !== undefined) { const ok = !q || b.dataset.krname.includes(q); b.hidden = !ok; if (ok) shown++; }
    let n = box._krn; if (n) n.remove(); box._krn = null;
    if (q && !shown) { n = document.createElement("span"); n.className = "krk-none"; n.textContent = "No Kin matches that."; box.appendChild(n); box._krn = n; }
  }
  // A complete chooser for games that had none: pick(id) is called with the chosen Kin's id.
  function chooser(box, o) {
    o = o || {}; const list = kins.slice();
    box.replaceChildren();
    const cur = o.current || "";
    for (const k of list) {
      const b = document.createElement("button"); b.type = "button"; b.className = "krk-btn" + (k.id === cur ? " on" : ""); b.setAttribute("aria-pressed", String(k.id === cur));
      b.append(face(k), document.createTextNode(k.name)); b.style.cssText = "border-radius:20px;padding:6px 14px;margin:3px;cursor:pointer;border:1px solid #ffffff44;background:" + (k.id === cur ? "#ffffff33" : "#00000022") + ";color:inherit;font:inherit;font-weight:" + (k.id === cur ? 700 : 400);
      b.onclick = () => { if (o.pick) o.pick(k.id); };
      box.append(b);
    }
    enhance(box, list.map((k) => k.id));
  }
  window.KRKins = { player: () => player, list: () => kins.slice(), get: byId, enhance, chooser, onChange: (f) => { cbs.push(f); if (kins.length) setTimeout(() => { try { f(kins); } catch {} }, 0); } }; // a late listener is told about the list that already came
  window.addEventListener("message", (e) => {
    const d = e.data; if (!d || d.kin !== "kins" || e.source !== parent) return;
    kins = Array.isArray(d.kins) ? d.kins.filter((k) => k && k.id).map((k) => ({ id: String(k.id), name: String(k.name || "Kin").slice(0, 40), avatar: typeof k.avatar === "string" && k.avatar.startsWith("data:image/") ? k.avatar : "" })) : [];
    player = typeof d.player === "string" ? d.player.slice(0, 40) : player;
    for (const f of cbs) { try { f(kins); } catch {} }
  });
  try { parent.postMessage({ kin: "kins" }, "*"); } catch {}
})();
