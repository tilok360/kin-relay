// Kin Relay's group-chat conductor: ONE place that decides who speaks next at any table or room with more than one
// participant (Hold'em, Casino, Cards Against Kin-manatee, RoomsPlus). It mirrors how a Kindroid group chat behaves:
//   * after every message it picks ONE next speaker, or nobody;
//   * a Kin that is spoken to (@Name, or "Name," at the start) answers; "@all" and several names answer one at a time;
//   * otherwise the pick weighs relevance to the recent talk, who has been quiet longest, who the last speaker was
//     talking with, and each Kin's personality (chatty or shy);
//   * only ONE Kin generates at a time, with a short natural pause first, and then the table is looked at again for an
//     optional follow-up from a DIFFERENT Kin, capped (default 3 Kin lines in a row, reset by a person speaking).
// In hosted play only the host runs the conductor. It asks the owner's own copy to generate (so that person's key
// is used); the guest's copy answers each request id at most once (claim), so no line is ever written twice.
// The source of truth is lib/conductor.js; games/*/kr-conductor.js are copies made by dev/sync-conductor.js.
// The state is a plain object (keep it in the app's saved settings); nothing here touches the network or disk.
"use strict";

const DEFAULTS = {
  maxChain: 3,            // Kin lines in a row without a person speaking
  maxOwed: 5,             // spoken-to Kins may exceed maxChain up to this (e.g. "@all" with 5 Kins)
  kinGapMs: 20000,        // a Kin that just spoke rests this long unless it was spoken to
  asksPerMin: 8,          // table-wide Kin requests per minute (spoken-to Kins are exempt), keeps clear of Kindroid's limit
  busyTtlMs: 120000,      // a request nobody answered frees the table after this long
  followUpChance: [0.7, 0.35], // chance of a follow-up after the 1st, 2nd Kin line in a row
  delayScale: 1,          // 0 = no pauses (tests)
  mentionOnly: false,     // true: only a Kin that was spoken to ever answers (draft-only apps; no unprompted picks, no follow-ups)
};
// @full-begin
const STOP = new Set("a about all also am an and any are as at be been but by can could did do does for from get got had has have he her him his how i if in is it its just like me my no not of on one or our out so some that the their them then there they this to too up us was we were what when who why will with would you your yes yeah okay ok oh hey hi well really very much more here now".split(" "));
// @full-end
const esc = (n) => String(n).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// @full-begin
const tokens = (s) => String(s || "").toLowerCase().match(/[a-z\u00c0-\u024f][a-z\u00c0-\u024f'-]{2,}/g)?.filter((w) => !STOP.has(w)) || [];
// @full-end
const hash = (s) => { let h = 2166136261; for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0; return h; };
// @full-begin
const chance = (seed, p) => (hash(seed) % 1000) / 1000 < p; // same input, same answer: steady and testable
// @full-end

function fresh() { return { v: 1, spoke: {}, chain: 0, chainIds: [], owed: [], busy: null, pending: false, notBefore: 0, asks: [], recent: [], claimed: {}, seq: 0, n: 0 }; }
function norm(st) {
  if (!st || typeof st !== "object") return fresh();
  const f = fresh(); for (const k of Object.keys(f)) if (st[k] === undefined || st[k] === null && k !== "busy") st[k] = f[k];
  return st;
}

// A Kin's name and its first name ("Earl" for Earl "Gator" Vance) when no other Kin shares that first name.
function nameParts(k, kins) {
  const first = (String(k.name).match(/[A-Za-z\u00C0-\u024F][\w'\u00C0-\u024F-]{2,}/) || [""])[0];
  const clash = first && kins.some((x) => x.id !== k.id && new RegExp("(^|[^\\w])" + esc(first) + "(?![\\w])", "i").test(x.name));
  return [String(k.name)].concat(first && first.toLowerCase() !== String(k.name).toLowerCase() && !clash ? [first] : []);
}
// 2 = spoken to (@Name, or "Name," / "Name:" / "Name?" at the start, optionally after hey/ok/thanks), 1 = named in passing, 0 = no.
function addressed(text, name, parts) {
  let best = 0;
  for (const n of (parts || [name]).map(esc)) {
    if (new RegExp("(^|[^\\w])@" + n + "(?![\\w])", "i").test(text)) return 2;
    if (new RegExp("^\\s*(?:(?:hey|hi|yo|ok|okay|so|well|and|thanks|thank you)[,\\s]+)?" + n + "\\s*[,:?!]", "i").test(text)) return 2;
    if (new RegExp("(^|[^\\w])" + n + "(?![\\w])", "i").test(text)) best = 1;
  }
  return best;
}
const TO_ALL = /(^|[^\w])@(all|everyone|everybody|kins|table|room)(?![\w])/i;
const TO_ROOM = /\b(everyone|everybody|y'all|you all|you guys|guys|anyone|anybody|you two|both of you)\b/i;
// @full-begin
// Personality: a rough "how talkative" weight from the Kin's own profile text (never sent anywhere).
function talkative(profile) {
  const p = String(profile || "").toLowerCase();
  let w = 1;
  if (/\b(shy|quiet|reserved|introvert|timid|stoic|laconic|withdrawn|soft-spoken|private)\b/.test(p)) w -= 0.3;
  if (/\b(outgoing|chatty|talkative|loud|playful|extrovert|bubbly|flirty|boisterous|energetic|witty|sarcastic|teasing)\b/.test(p)) w += 0.3;
  return w;
}
// @full-end

function create(opts) {
  const O = { ...DEFAULTS, ...(opts || {}) };
  // KGR_ROOM_CHAIN (0..1) sets how likely one Kin line is to draw ONE follow-up Kin in; 1 = always (used by the tests).
  const envChain = typeof process !== "undefined" && process.env && process.env.KGR_ROOM_CHAIN !== undefined && process.env.KGR_ROOM_CHAIN !== "" ? Number(process.env.KGR_ROOM_CHAIN) : NaN;
  if (Number.isFinite(envChain) && envChain >= 0 && envChain <= 1) { O.followUpChance = [envChain, 0]; O.forceFollow = envChain >= 1; }
  const clock = () => (typeof O.now === "function" ? O.now() : Date.now());
  const scaleOf = () => (typeof O.delayScale === "function" ? O.delayScale() : O.delayScale);
  const jobId = (st) => `j${(st.seq = (st.seq || 0) + 1)}${(hash(String(clock()) + st.seq) % 46656).toString(36)}`;

  // The natural pause before the next line: longer after a long message, a little longer for a Kin answering a Kin.
  function delayFor(entry) {
    const len = String((entry && entry.text) || "").length;
    const base = 500 + Math.min(1800, len * 25) + (entry && entry.kind === "kin" ? 700 : 0);
    return Math.round(base * scaleOf());
  }

  // A line was posted (by a person, a Kin or the table itself). Call once per line, in order, on the host.
  // entry: { id, who, kind: "person"|"kin"|"system", speaker: <the Kin's id when kind is "kin">, text, ts }
  function note(st, entry, kins) {
    st = norm(st); const t = entry.ts || clock(); st.n = (st.n || 0) + 1;
    const text = String(entry.text || "");
    st.recent.push({ id: entry.id, who: entry.who, kind: entry.kind, speaker: entry.speaker || "", text: text.slice(0, 400) }); st.recent = st.recent.slice(-14);
    if (entry.kind === "system") return st; // table notices don't start talk
    if (entry.kind === "kin" && entry.speaker) {
      st.spoke[entry.speaker] = t; st.chain += 1; st.chainIds.push(entry.speaker); st.chainIds = st.chainIds.slice(-6);
      // The line we waited for has arrived. Requests made while that Kin was still writing stay owed (it hasn't seen them).
      const cut = st.busy && st.busy.kinId === entry.speaker ? st.busy.n : Infinity;
      st.owed = st.owed.filter((o) => o.id !== entry.speaker || (o.n || 0) > cut);
      if (st.busy && st.busy.kinId === entry.speaker) st.busy = null;
    } else if (entry.kind === "person") { st.chain = 0; st.chainIds = []; }
    // Who was spoken to: they are owed an answer, one at a time (nobody answers themselves).
    const others = (kins || []).filter((k) => k.id !== entry.speaker);
    const toAll = TO_ALL.test(text);
    const hits = [];
    for (const k of others) { const a = toAll ? 2 : addressed(text, k.name, nameParts(k, kins)); if (a === 2) hits.push({ k, at: text.toLowerCase().indexOf(String(k.name).toLowerCase().split(/\s+/)[0]) }); }
    hits.sort((a, b) => (a.at < 0 ? 1e6 : a.at) - (b.at < 0 ? 1e6 : b.at));
    for (const h of hits) if (!st.owed.some((o) => o.id === h.k.id)) st.owed.push({ id: h.k.id, by: entry.id, hard: entry.kind === "person", n: st.n, t });
    st.pending = true; st.notBefore = t + delayFor(entry);
    return st;
  }

  // The app itself wants one particular Kin to say something (e.g. a reaction to a big hand). Chain is reset.
  function direct(st, kinId, why) {
    st = norm(st); st.owed = st.owed.filter((o) => o.id !== kinId); st.owed.unshift({ id: kinId, by: "app", hard: false, n: (st.n = (st.n || 0) + 1), why: String(why || "").slice(0, 300) });
    st.chain = 0; st.chainIds = []; st.pending = true; st.notBefore = clock() + Math.round(900 * scaleOf());
    return st;
  }
  const rested = (st, k, t) => t - (st.spoke[k.id] || 0) > O.kinGapMs;
  function eligible(st, kins, t) {
    const last = st.recent[st.recent.length - 1];
    return kins.filter((k) => k.auto !== false && !k.muted && !(last && last.speaker === k.id) && !(st.busy && st.busy.kinId === k.id));
  }

  // @full-begin
  // Score a Kin that wasn't asked directly: relevance, quiet-longest, continuity with the last speaker, personality.
  function score(st, k, kins, t) {
    const last = st.recent[st.recent.length - 1] || { text: "" };
    const lastTok = new Set(tokens(st.recent.slice(-3).map((r) => r.text).join(" ")));
    const prof = new Set(tokens(`${k.name} ${k.profile || ""}`));
    const mine = new Set(tokens(st.recent.filter((r) => r.speaker === k.id).map((r) => r.text).join(" ")));
    let rel = 0; for (const w of lastTok) { if (prof.has(w)) rel += 1; if (mine.has(w)) rel += 0.5; }
    let s = Math.min(rel, 3) * 0.6;
    const quiet = Math.min(2, (t - (st.spoke[k.id] || 0)) / 60000); s += (st.spoke[k.id] ? quiet : 2) * 0.8;      // never spoken = quiet longest
    const prev = st.recent[st.recent.length - 2];
    if (last.kind === "person" && prev && prev.speaker === k.id && String(last.text).length < 140) s += 1.2;       // a person answering that Kin
    if (st.chainIds.includes(k.id)) s -= 1;                                                                        // already in this run of talk
    if (last.speaker !== k.id && addressed(last.text, k.name, nameParts(k, kins)) >= 1) s += 1.5;                    // named in passing
    s *= talkative(k.profile);
    s += (hash(`${last.id}|${k.id}`) % 100) / 400;                                                                  // steady little tie-breaker
    return s;
  }
  // @full-end

  // What next? { act: "idle" | "busy" | "wait" | "ask", until?, speaker?, why?, job?, reason? }
  function plan(st, kins, ctx) {
    st = norm(st); const t = clock(); ctx = ctx || {};
    kins = (kins || []).filter((k) => k && k.id);
    if (st.busy && t - st.busy.since > O.busyTtlMs) { st.spoke[st.busy.kinId] = t; st.busy = null; }
    if (st.busy) return { act: "busy", until: st.busy.since + O.busyTtlMs };
    if (!st.pending) return { act: "idle" };
    if (ctx.paused) { st.pending = false; return { act: "idle" }; }
    const last = st.recent[st.recent.length - 1];
    if (!last || !kins.length) { st.pending = false; return { act: "idle" }; }
    if (t < st.notBefore) return { act: "wait", until: st.notBefore };
    st.asks = st.asks.filter((x) => t - x < 60000);
    st.owed = st.owed.filter((o) => !o.t || t - o.t < 120000); // an unanswered request goes stale
    const cand = eligible(st, kins, t);
    const limit = st.owed.some((o) => o.hard) ? O.maxOwed : O.maxChain;
    let pick = null, reason = "";
    // 1. Spoken to: the earliest asked who is able to answer.
    const owed = st.owed.map((o) => ({ o, k: cand.find((k) => k.id === o.id) })).filter((x) => x.k);
    let why = "";
    if (owed.length && st.chain < (owed[0].o.hard ? O.maxOwed : O.maxChain)) { pick = owed[0].k; reason = "spoken to"; why = owed[0].o.why || ""; }
    st.owed = st.owed.filter((o) => kins.some((k) => k.id === o.id)); // forget Kins that left
    // @full-begin
    if (!pick && st.chain < limit && !O.mentionOnly) {
      const named = (txt) => kins.filter((k) => k.id !== last.speaker && addressed(txt, k.name, nameParts(k, kins)) >= 1);
      const spokenToPerson = last.kind !== "system" && ctx.people && ctx.people.some((p) => p && p !== last.who && addressed(last.text, p, [p, String(p).split(/\s+/)[0]].filter((x) => x.length >= 3)) === 2);
      // 2. A line aimed at another PERSON by name is theirs to answer.
      if (spokenToPerson && !named(last.text).length) { st.pending = false; return { act: "idle", reason: "aimed at a person" }; }
      // 3. Named in passing, then the best-scoring Kin.
      const pool = cand.filter((k) => rested(st, k, t) || named(last.text).some((n) => n.id === k.id));
      const passing = pool.filter((k) => named(last.text).some((n) => n.id === k.id) && !st.chainIds.includes(k.id));
      if (last.kind === "person") {
        if (passing.length) { pick = passing[0]; reason = "named"; }
        else if (pool.length) { pick = pool.map((k) => [k, score(st, k, kins, t)]).sort((a, b) => b[1] - a[1])[0][0]; reason = TO_ROOM.test(last.text) || /\?\s*$/.test(last.text) ? "asked the table" : "next in the talk"; }
      } else if (last.kind === "kin") {
        // A Kin's line sometimes draws one more Kin in (never the same one, and less likely each time).
        const starter = [...st.recent].reverse().find((r) => r.kind === "person");  // a question put to the whole table gets a second voice
        const roomQ = !O.forceFollow && starter && (TO_ROOM.test(starter.text) || TO_ALL.test(starter.text) || /\?\s*$/.test(starter.text)) && st.chain === 1;
        const p = O.forceFollow && st.chain === 1 ? 1 : roomQ ? 1 : O.followUpChance[Math.min(st.chain - 1, O.followUpChance.length - 1)] ?? 0;
        if (st.chain <= O.followUpChance.length && pool.length && (p >= 1 || chance(`${last.id}|f`, p * Math.min(1, 0.6 + 0.2 * pool.length)))) {
          const best = pool.map((k) => [k, score(st, k, kins, t)]).sort((a, b) => b[1] - a[1])[0]; if (best[1] > 0.9 || p >= 1) { pick = best[0]; reason = "follow-up"; }
        }
      }
    }
    // @full-end
    st.pending = false;
    if (!pick) return { act: "idle", reason: "nobody needed" };
    const isOwed = reason === "spoken to" || reason === "named";
    if (!isOwed && st.asks.length >= O.asksPerMin) return { act: "idle", reason: "pacing" };
    st.asks.push(t);
    const job = jobId(st);
    st.busy = { kinId: pick.id, owner: pick.owner || "", job, since: t, n: st.n };
    return { act: "ask", speaker: pick, job, reason, why, addressed: reason === "spoken to", last };
  }

  // The request is over without a line (failed, nothing to say): free the table, and don't retry that Kin at once.
  function done(st, job, res) {
    st = norm(st);
    if (!st.busy || (job && st.busy.job !== job)) return st;
    const id = st.busy.kinId; st.busy = null;
    if (!res || res.ok === false || !res.text) { st.spoke[id] = clock(); st.owed = st.owed.filter((o) => o.id !== id); st.pending = false; }
    return st;
  }

  // Run the table forward. cb.ask(speaker, job) makes the Kin speak: a local Kin posts its line (calling note) and returns
  // { local: true }; a guest's Kin gets a request sent and returns { remote: true } (the line comes back later).
  // Returns { until } when something should run again at that time (a pause longer than maxSleep, or a request out).
  async function drive(st, cb) {
    st = norm(st); const maxSleep = cb.maxSleep === undefined ? 4000 : cb.maxSleep; let guard = 0, until = 0;
    while (guard++ < 12) {
      const p = plan(st, typeof cb.kins === "function" ? cb.kins() : cb.kins, cb.ctx ? cb.ctx() : {});
      if (p.act === "idle") break;
      if (p.act === "busy") { until = p.until ? Math.min(p.until, clock() + 5000) : 0; break; }
      if (p.act === "wait") { const ms = p.until - clock(); if (ms <= maxSleep) { await (cb.sleep || ((n) => new Promise((r) => setTimeout(r, n))))(Math.max(0, ms)); continue; } until = p.until; break; }
      let r = {}; try { r = (await cb.ask(p.speaker, p.job, p)) || {}; } catch (e) { r = { error: e && e.message }; }
      if (r.remote) { until = clock() + 5000; break; }
      if (st.busy && st.busy.job === p.job) done(st, p.job, { ok: false }); // no line was posted: free the table
    }
    return { until, state: st };
  }

  // A guest's copy: handle a request id once. A repeat (resent delivery, second host copy) returns false.
  function claim(st, job) {
    st = norm(st); if (!job) return true; if (st.claimed[job]) return false;
    st.claimed[job] = clock(); const ks = Object.keys(st.claimed); if (ks.length > 40) for (const k of ks.sort((a, b) => st.claimed[a] - st.claimed[b]).slice(0, ks.length - 40)) delete st.claimed[k];
    return true;
  }
  const busy = (st) => !!(norm(st).busy);
  const pending = (st) => { st = norm(st); return !!(st.busy || st.pending); };
  return { note, direct, plan, done, drive, claim, busy, pending, fresh, norm, options: O };
}

module.exports = { create, fresh, addressed, nameParts, DEFAULTS };
