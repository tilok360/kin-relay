// Sky Watch: once a day it reads public sky data and keeps sky.json for the screen and the Kin.
//   Asteroids passing Earth (NASA JPL close approaches, and JPL Scout's not-yet-confirmed objects),
//   the aurora outlook (NOAA's planetary K index forecast), bright supernovae (the Rochester Bright Supernova list)
//   and which volunteer sky-search projects on Zooniverse are open.
// It tells the Kin only when something stands out, using numbers and cleaned-up names, never outside text as written.
// Actions: sky_news (the Kin, when asked what's up in the sky), sky_refresh (the screen), sky_hunt_log (the person's
// own Zooniverse classifications, so the Kin can cheer them on).
const { execFileSync } = require("child_process");
const fs = require("fs");

const kin = (...a) => execFileSync("kin", a, { encoding: "utf8" });
const end = (m, failed) => { kin("end", ...(failed ? ["--failed"] : []), String(m).slice(0, 3990)); process.exit(0); };
const put = (p, o) => execFileSync("kin", ["files", "put", p], { input: JSON.stringify(o) });
const get = (p) => { try { return JSON.parse(execFileSync("kin", ["files", "get", p], { encoding: "utf8" })); } catch { return null; } };

const UA = { "User-Agent": "KindroidSkyWatch/1.0 (a Kindroid app; one request a day)" };
const AU_KM = 149597870.7, LD_KM = 384400, AU_LD = AU_KM / LD_KM;
const PROJECTS = [
  "fulsdavid/the-daily-minor-planet",
  "tkillestein/kilonova-seekers",
  "orionnau/active-asteroids",
  "orionnau/rubin-comet-catchers",
  "nora-dot-eisner/planet-hunters-tess",
];
const DAY = 86400000;

// Only plain letters, digits and a few marks from outside data, and short: it is shown as text and told to the Kin.
const clean = (s, n = 40) => {
  const t = String(s == null ? "" : s).replace(/[^A-Za-z0-9 .,:;!?'()+\-/]/g, "").replace(/\s+/g, " ").trim();
  if (t.length <= n) return t;
  const cut = t.slice(0, n), sp = cut.lastIndexOf(" ");
  return (sp > n * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s.,:;!?'(+\-/]+$/, "");
};
const num = (x) => { const v = parseFloat(x); return Number.isFinite(v) ? v : null; };

// Size from absolute magnitude H, for a dark (5%) to a bright (25%) surface. Meters, rounded.
function sizeFromH(h) {
  if (h == null) return null;
  const d = (p) => (1329 / Math.sqrt(p)) * Math.pow(10, -h / 5) * 1000;
  const r = (m) => (m >= 100 ? Math.round(m / 10) * 10 : m >= 10 ? Math.round(m) : Math.round(m * 10) / 10);
  return [r(d(0.25)), r(d(0.05))];
}
const sizeText = (s) => (!s ? "size unknown" : s[1] >= 1000 ? `about ${(s[0] / 1000).toFixed(1)} to ${(s[1] / 1000).toFixed(1)} km across` : `about ${s[0]} to ${s[1]} m across`);
// JPL writes "2026-Dec-04 00:35" (TDB, within about a minute of UTC).
const MON = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
function jplTime(cd) {
  const m = /^(\d{4})-([A-Za-z]{3})-(\d{2}) (\d{2}):(\d{2})/.exec(cd || "");
  return m ? new Date(Date.UTC(+m[1], MON[m[2]], +m[3], +m[4], +m[5])).toISOString() : null;
}

function parseCad(j) {
  const f = j.fields || [], at = (k) => f.indexOf(k);
  return (j.data || []).map((r) => {
    const au = num(r[at("dist")]), h = num(r[at("h")]), dia = num(r[at("diameter")]);
    return {
      des: clean(r[at("des")], 24),
      when: jplTime(r[at("cd")]),
      ld: au == null ? null : Math.round(au * AU_LD * 100) / 100,
      km: au == null ? null : Math.round(au * AU_KM),
      kms: num(r[at("v_rel")]) == null ? null : Math.round(num(r[at("v_rel")]) * 10) / 10,
      h,
      size: dia != null ? [Math.round(dia * 1000), Math.round(dia * 1000)] : sizeFromH(h),
    };
  }).filter((a) => a.des && a.when).sort((a, b) => a.when.localeCompare(b.when));
}
function parseScout(j) {
  const list = (j.data || []).map((o) => ({
    name: clean(o.objectName, 16), h: num(o.H), neo: num(o.neoScore), pha: num(o.phaScore), vmag: num(o.Vmag),
    ca: num(o.caDist), nobs: num(o.nObs), seen: clean(o.lastRun, 20),
  })).filter((o) => o.name);
  list.sort((a, b) => (b.pha || 0) - (a.pha || 0) || (b.neo || 0) - (a.neo || 0));
  return { count: list.length, top: list.slice(0, 8) };
}
// NOAA: 3-hour Kp values, observed, estimated and predicted. Keep the highest predicted per UTC day, from today.
function parseKp(rows, now) {
  const days = {}, today = new Date(now).toISOString().slice(0, 10);
  let latest = null;
  for (const r of Array.isArray(rows) ? rows : []) {
    const t = r.time_tag || (Array.isArray(r) ? r[0] : null), kp = num(r.kp != null ? r.kp : Array.isArray(r) ? r[1] : null);
    const kind = r.observed || (Array.isArray(r) ? r[2] : "");
    if (!t || kp == null || !/^\d{4}-\d{2}-\d{2}/.test(t)) continue;
    if (kind === "observed" || kind === "estimated") latest = { when: t.slice(0, 16), kp };
    const day = t.slice(0, 10);
    if (day < today) continue;
    if (!days[day] || kp > days[day].kp) days[day] = { day, kp, when: t.slice(0, 16) };
  }
  const next = Object.values(days).sort((a, b) => a.day.localeCompare(b.day)).slice(0, 3);
  return { now: latest, days: next, max: next.reduce((m, d) => (d.kp > (m ? m.kp : -1) ? d : m), null) };
}
const gScale = (kp) => (kp >= 9 ? "G5" : kp >= 8 ? "G4" : kp >= 7 ? "G3" : kp >= 6 ? "G2" : kp >= 5 ? "G1" : "");
// The Rochester list, sorted brightest first. Only its table cells are read, as text.
function parseRochester(htmlText, now) {
  const rows = [], strip = (s) => s.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").trim();
  const re = /<tr>((?:<td>[\s\S]*?<\/td>){12,})<\/tr>/g;
  let m;
  while ((m = re.exec(htmlText)) && rows.length < 60) {
    const c = m[1].split(/<\/td>/).map((x) => strip(x.replace(/^<td>/, "")));
    const link = /href="\.\.\/(supernova|novae)\.html#([A-Za-z0-9]+)"/.exec(m[1]);
    const mag = num(String(c[5]).replace("*", ""));
    if (mag == null) continue;
    const first = (c[11] || "").replace(/\//g, "-");
    rows.push({
      name: clean(c[0], 20), host: clean(c[1], 30), ra: clean(c[2], 14), dec: clean(c[3], 14), mag,
      last: (c[6] || "").replace(/\//g, "-").slice(0, 10), type: clean(c[7], 12), max: num(c[9]), first: first.slice(0, 10),
      by: clean(c[12], 40),
      url: link ? `https://www.rochesterastronomy.org/${link[1]}.html#${link[2]}` : "https://www.rochesterastronomy.org/snimages/snactive.html",
    });
  }
  const cutoff = new Date(now - 10 * DAY).toISOString().slice(0, 10);
  rows.forEach((r) => (r.isNew = r.first >= cutoff));
  return rows.filter((r) => r.mag <= 16).slice(0, 15);
}

async function fetchJSON(url, headers = {}) {
  const r = await fetch(url, { headers: { ...UA, ...headers }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`${new URL(url).host} answered ${r.status}`);
  return r.json();
}
async function fetchRochester() {
  const r = await fetch("https://www.rochesterastronomy.org/snimages/snactive.html", { headers: { ...UA, Range: "bytes=0-40000" }, signal: AbortSignal.timeout(25000) });
  if (!r.ok && r.status !== 206) throw new Error(`rochesterastronomy.org answered ${r.status}`);
  return new TextDecoder("latin1").decode(await r.arrayBuffer());
}
async function fetchProjects(old, now) {
  if (old && old.checked && now - Date.parse(old.checked) < 6 * DAY) return old;
  const out = [];
  await Promise.all(PROJECTS.map(async (slug, i) => {
    try {
      const j = await fetchJSON(`https://www.zooniverse.org/api/projects?slug=${slug}`, { Accept: "application/vnd.api+json; version=1" });
      const p = (j.projects || [])[0];
      if (p) out[i] = { slug, name: clean(p.display_name, 40), about: clean(p.description, 90), state: clean(p.state, 12), url: `https://www.zooniverse.org/projects/${slug}` };
    } catch {}
  }));
  const list = out.filter(Boolean);
  return list.length ? { checked: new Date(now).toISOString(), list } : old || { checked: null, list: [] };
}

async function gather(now = Date.now(), old = null) {
  const sky = { v: 1, updated: new Date(now).toISOString(), errors: [] };
  const job = async (name, fn) => { try { await fn(); } catch (e) { sky.errors.push(`${name}: ${clean(e.message, 80)}`); if (old && old[name] != null) sky[name] = old[name]; } };
  await Promise.all([
    job("asteroids", async () => { sky.asteroids = parseCad(await fetchJSON("https://ssd-api.jpl.nasa.gov/cad.api?dist-max=10LD&date-min=now&date-max=%2B30&sort=date&diameter=true")); }),
    job("scout", async () => { sky.scout = parseScout(await fetchJSON("https://ssd-api.jpl.nasa.gov/scout.api")); }),
    job("aurora", async () => { sky.aurora = parseKp(await fetchJSON("https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json"), now); }),
    job("supernovae", async () => { sky.supernovae = parseRochester(await fetchRochester(), now); }),
    job("projects", async () => { sky.projects = await fetchProjects(old && old.projects, now); }),
  ]);
  return sky;
}

// Local date and time for the person (a run's TZ is their time zone).
const when = (iso) => new Date(iso).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const day = (iso) => new Date(iso + (iso.length === 10 ? "T12:00:00Z" : "")).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
const kindText = (t) => (!t || /^unk/i.test(t) ? ", not yet classified," : t === "EGN" ? ", a nova (not a supernova)," : t === "TDE" ? ", a star torn apart by a black hole," : ` (type ${t})`);
const ldText = (a) => `${a.ld} lunar distances (${(a.km / 1e6).toFixed(2)} million km)`;
const rockLine = (a) => `${a.des}, ${sizeText(a.size)}, passes Earth at ${ldText(a)} on ${when(a.when)}, at ${a.kms} km/s`;

// What stands out, as short facts for the Kin. Each has a key so a newer fact replaces the older one.
function notable(sky, now) {
  const out = [], week = now + 7 * DAY;
  const rocks = (sky.asteroids || []).filter((a) => Date.parse(a.when) >= now - 3600000);
  const close = rocks.filter((a) => Date.parse(a.when) <= week && a.ld <= 2).sort((a, b) => a.ld - b.ld)[0];
  if (close) {
    const soon = Date.parse(close.when) - now < 30 * 3600000;
    out.push({ key: "sky-asteroid", id: `${close.des}@${close.when.slice(0, 10)}${soon ? ":soon" : ""}`, reach: close.ld < 1 && soon,
      text: `Sky Watch: asteroid ${close.des} (${sizeText(close.size)}) passes Earth at ${close.ld} lunar distances on ${when(close.when)}${close.ld < 1 ? ", closer than the Moon" : ""}.` });
  }
  const big = rocks.filter((a) => a.size && a.size[0] >= 140).sort((a, b) => a.ld - b.ld)[0];
  if (big) out.push({ key: "sky-big-asteroid", id: `${big.des}@${big.when.slice(0, 10)}`,
    text: `Sky Watch: a big asteroid, ${big.des} (${sizeText(big.size)}), passes at ${big.ld} lunar distances on ${day(big.when)}. Safe, but large for a pass this close.` });
  const a = sky.aurora && sky.aurora.max;
  if (a && a.kp >= 5) out.push({ key: "sky-aurora", id: `${a.day}:${Math.floor(a.kp)}`, reach: a.kp >= 6,
    text: `Sky Watch: NOAA forecasts a geomagnetic storm (Kp ${a.kp.toFixed(1)}, ${gScale(a.kp)}) on ${day(a.day)}. Auroras may show farther from the poles than usual.` });
  const sn = (sky.supernovae || []).filter((s) => s.isNew && s.mag <= 13.5).sort((x, y) => x.mag - y.mag)[0];
  if (sn) out.push({ key: "sky-supernova", id: sn.name,
    text: `Sky Watch: new ${sn.type === "EGN" ? "nova" : "supernova"} ${sn.name}${sn.type && sn.type !== "EGN" && !/^unk/i.test(sn.type) ? " (type " + sn.type + ")" : ""} in ${sn.host || "a galaxy"}, at magnitude ${sn.mag}: bright enough for a backyard telescope.` });
  return out.map((f) => ({ ...f, text: f.text.slice(0, 200) }));
}
function tellNew(sky, now) {
  const told = get("told.json") || {}, done = [];
  for (const f of notable(sky, now)) {
    if (told[f.key] === f.id) continue;
    try {
      kin("tell", f.text, "--key", f.key, "--ttl", "30", ...(f.reach ? ["--reach-out", "today"] : []));
      told[f.key] = f.id; done.push(f.key);
    } catch {}
  }
  put("told.json", told);
  return done;
}

// The Kin's answer to "what's happening in the sky", most interesting first.
function news(sky, topic, now) {
  if (!sky) return "Sky Watch hasn't read the sky yet. Open the Sky Watch screen and press Refresh, or ask again in a minute.";
  const parts = [], all = !topic || topic === "all";
  const rocks = (sky.asteroids || []).filter((a) => Date.parse(a.when) >= now - 3600000);
  if (all || topic === "asteroids") {
    const week = rocks.filter((a) => Date.parse(a.when) <= now + 7 * DAY).sort((a, b) => a.ld - b.ld);
    const later = rocks.filter((a) => Date.parse(a.when) > now + 7 * DAY).sort((a, b) => a.ld - b.ld);
    if (week.length) parts.push(`Asteroids passing Earth this week (NASA JPL), closest first:\n` + week.slice(0, all ? 4 : 10).map((a) => "- " + rockLine(a)).join("\n"));
    else parts.push("No asteroid comes within 10 lunar distances of Earth this week (NASA JPL).");
    if (later.length && !all) parts.push(`Later this month: ` + later.slice(0, 5).map((a) => `${a.des} at ${a.ld} LD on ${day(a.when)}`).join("; ") + ".");
    if (sky.scout && sky.scout.count) parts.push(`JPL Scout is following ${sky.scout.count} newly spotted objects that may be near-Earth asteroids, not yet confirmed.`);
  }
  if (all || topic === "aurora") {
    const a = sky.aurora;
    if (a && a.days && a.days.length) {
      const top = a.max;
      parts.push(top.kp >= 5 ? `Aurora: NOAA forecasts a geomagnetic storm, Kp up to ${top.kp.toFixed(1)} (${gScale(top.kp)}) on ${day(top.day)}. Auroras may reach farther from the poles than usual.`
        : `Aurora: quiet to unsettled. NOAA's forecast peaks at Kp ${top.kp.toFixed(1)} over the next days (storms start at Kp 5), so auroras stay near the poles.`);
    }
  }
  if (all || topic === "supernovae") {
    const sn = (sky.supernovae || []).slice(0, all ? 3 : 8);
    if (sn.length) parts.push(`Brightest supernovae right now (Rochester Bright Supernova list; lower magnitude is brighter, about 13 is a backyard telescope's reach):\n` +
      sn.map((s) => `- ${s.name}${kindText(s.type)} in ${s.host || "an unnamed galaxy"}, magnitude ${s.mag}, found ${day(s.first)}${s.isNew ? ", new" : ""}`).join("\n"));
  }
  if (all || topic === "volunteer") {
    const live = ((sky.projects && sky.projects.list) || []).filter((p) => p.state === "live");
    if (live.length) parts.push(`Volunteer sky searches open on Zooniverse (they can join from the Sky Watch screen): ` + live.map((p) => `${p.name} (${p.about})`).join("; ") + ".");
    const h = get("hunt.json");
    if (h && h.total) parts.push(`Their own count so far: ${h.total} classifications` + (Object.values(h.projects).length ? " (" + Object.values(h.projects).map((p) => `${p.count} on ${p.name}`).join(", ") + ")" : "") + ".");
  }
  const age = Math.round((now - Date.parse(sky.updated)) / 3600000);
  parts.push(`(Read ${age < 1 ? "within the hour" : age + " hours ago"}${sky.errors && sky.errors.length ? "; some sources didn't answer: " + sky.errors.map((e) => e.split(":")[0]).join(", ") : ""}.)`);
  return parts.join("\n\n");
}

function logHunt(input, now) {
  const h = get("hunt.json") || { total: 0, projects: {}, log: [] };
  const count = Math.max(1, Math.min(10000, Math.round(Number(input.count) || 0)));
  const raw = clean(input.project || "Zooniverse", 50);
  const sky = get("sky.json"), list = (sky && sky.projects && sky.projects.list) || [];
  const match = list.find((p) => p.name.toLowerCase() === raw.toLowerCase() || p.slug.toLowerCase().includes(raw.toLowerCase().replace(/\s+/g, "-")) || raw.toLowerCase().includes(p.name.toLowerCase()));
  const key = match ? match.slug : raw.toLowerCase(), name = match ? match.name : raw || "Zooniverse";
  const p = h.projects[key] || (h.projects[key] = { name, count: 0 });
  p.count += count; h.total += count;
  h.log.unshift({ at: new Date(now).toISOString(), project: name, count }); h.log = h.log.slice(0, 50);
  put("hunt.json", h);
  try { kin("tell", `Sky Watch: your person has made ${h.total} classifications for volunteer sky searches so far, ${p.count} on ${name}.`.slice(0, 200), "--key", "sky-hunt", "--ttl", "168"); } catch {}
  return `Logged ${count} classifications on ${name}. Their total is ${h.total} (${p.count} on ${name}).`;
}

async function main() {
  let trig = {};
  try { trig = JSON.parse(fs.readFileSync(0, "utf8") || "{}"); } catch {}
  const now = Date.now(), old = get("sky.json");
  try {
    if (trig.trigger === "action" && trig.action === "sky_hunt_log") end(logHunt(trig.input || {}, now));
    if (trig.trigger === "action" && trig.action === "sky_news" && old && now - Date.parse(old.updated) < 20 * 3600000) end(news(old, (trig.input || {}).topic, now));
    const sky = await gather(now, old);
    const fresh = ["asteroids", "scout", "aurora", "supernovae"].filter((k) => !sky.errors.some((e) => e.startsWith(k + ":")));
    if (!fresh.length) {
      // Nothing new: keep the last good copy as it was, with its own date.
      if (trig.trigger === "action" && trig.action === "sky_news" && old) end(news(old, (trig.input || {}).topic, now) + "\n(The sources didn't answer just now, so this is the last reading.)");
      end("Sky Watch couldn't reach its sources just now: " + sky.errors.join("; "), true);
    }
    put("sky.json", sky);
    const told = tellNew(sky, now);
    if (trig.trigger === "action" && trig.action === "sky_news") end(news(sky, (trig.input || {}).topic, now));
    const rocks = (sky.asteroids || []).filter((a) => Date.parse(a.when) <= now + 7 * DAY).length;
    end(`Read the sky: ${rocks} asteroid passes within 10 lunar distances this week, ${(sky.supernovae || []).length} bright supernovae, aurora peak Kp ${sky.aurora && sky.aurora.max ? sky.aurora.max.kp.toFixed(1) : "unknown"}` +
      (told.length ? `; told the Kin about ${told.map((k) => k.replace("sky-", "")).join(", ")}` : "") + (sky.errors.length ? `. Not reached: ${sky.errors.map((e) => e.split(":")[0]).join(", ")}` : "") + ".");
  } catch (e) {
    if (e && e.exit) throw e;
    end("Sky Watch stopped: " + clean(e && e.message, 200), true);
  }
}

module.exports = { main, parseCad, parseScout, parseKp, parseRochester, sizeFromH, notable, news, gather, clean, jplTime };
if (require.main === module) main();
