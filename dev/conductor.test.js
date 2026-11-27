// Conductor tests (no network): one speaker at a time, @Name gets the answer, caps, no duplicate lines across two copies.
"use strict";
const C = require("../lib/conductor.js");
let pass = 0, fail = 0;
const check = (name, ok, extra) => { (ok ? pass++ : fail++); console.log(`${ok ? "PASS" : "FAIL"} ${name}${extra !== undefined ? " " + extra : ""}`); };
const PROFILES = ["shy and quiet librarian who loves books", "outgoing chatty sailor, loves the ocean and boats", "playful chef who talks about food and cooking", "stoic soldier, reserved, loves chess", "witty sarcastic poet who writes songs"];
const NAMES = ["Ada Quill", "Barnaby Salt", "Cora Basil", "Dmitri Stone", "Elsie Rhyme"];
const mkKins = () => NAMES.map((n, i) => ({ id: "k" + i, name: n, owner: i < 3 ? "host" : "guest", profile: PROFILES[i], auto: true }));

// A table on a fake clock. gen() takes `dur` ms; we count how many are running at once.
function table(opts = {}) {
  let T = 1e6; const kins = mkKins(), st = C.fresh(), log = [], running = { n: 0, max: 0 }, asked = [];
  const cond = C.create({ now: () => T, delayScale: opts.delayScale ?? 1, kinGapMs: opts.kinGapMs ?? 20000, asksPerMin: opts.asksPerMin ?? 99 });
  let id = 0;
  const post = (who, kind, speaker, text) => { const e = { id: "m" + ++id, who, kind, speaker, text, ts: T }; log.push(e); cond.note(st, e, kins); return e; };
  const genText = (k) => `${k.name} says something${opts.echo ? " " + opts.echo(k) : ""}`;
  async function run() {
    await cond.drive(st, {
      kins, ctx: () => ({ people: ["Chris"] }), maxSleep: 1e9, sleep: async (ms) => { T += ms; },
      ask: async (k, job) => {
        asked.push({ k: k.id, job });
        running.n++; running.max = Math.max(running.max, running.n);
        T += opts.dur ?? 3000; await new Promise((r) => setImmediate(r));                       // the Kin "generates" for a while
        running.n--; post(k.name, "kin", k.id, genText(k)); return { local: true };
      },
    });
  }
  return { cond, st, kins, log, running, asked, post, run, adv: (ms) => { T += ms; }, now: () => T };
}

(async () => {
  // 1. @Name gets the reply, and only that Kin
  { const t = table(); t.post("Chris", "person", "", "@Cora Basil what should we cook tonight?"); await t.run();
    const first = t.log[1]; check("@Name: the named Kin answers first", first && first.speaker === "k2", first && first.who);
    check("@Name: not everybody piles in", t.log.filter((m) => m.kind === "kin").length <= 3, t.log.filter((m) => m.kind === "kin").length + " Kin lines"); }
  { const t = table(); t.post("Chris", "person", "", "Dmitri, what do you think about chess?"); await t.run();
    check("'Name,' at the start also counts as spoken to", t.log[1] && t.log[1].speaker === "k3", t.log[1] && t.log[1].who); }
  // 2. busy table, five Kins: never two generating at once; cap holds; nobody answers itself; follow-ups from a different Kin
  { const t = table({ dur: 2500 }); let maxRun = 0, selfReply = 0, capBreak = 0, same = 0;
    const lines = ["hello everyone", "who is winning?", "that was a wild hand", "anyone hungry?", "tell me a story", "I love this game", "what's the ocean like?", "ha, nice", "chess anyone?", "write me a song"];
    for (let r = 0; r < 40; r++) {
      t.post("Chris", "person", "", lines[r % lines.length]); await t.run(); t.adv(1500);
      if (r % 3 === 0) { t.post("Chris", "person", "", lines[(r + 3) % lines.length]); await t.run(); }
      let chain = 0, prev = null;
      for (const m of t.log.slice(-8)) { if (m.kind === "person") chain = 0; else { chain++; if (prev && prev.speaker === m.speaker) same++; } prev = m; }
      if (chain > 3) capBreak++;
    }
    check("busy table: two Kins never generate at once", t.running.max === 1, "max " + t.running.max);
    check("busy table: Kin-to-Kin chains stay within 3 lines", capBreak === 0, "breaks " + capBreak);
    check("busy table: no Kin follows its own line", same === 0, same);
    const spoke = new Set(t.log.filter((m) => m.kind === "kin").map((m) => m.speaker));
    check("busy table: all 5 Kins get to talk over time", spoke.size === 5, [...spoke].join(","));
    check("busy table: a person's line is always answered or deliberately left (one at a time)", t.asked.length > 20, t.asked.length + " requests"); }
  // 3. @all with five Kins: five answers, one at a time, each different, then stop
  { const t = table({ dur: 1000 }); t.post("Chris", "person", "", "@all introduce yourselves"); await t.run();
    const ks = t.log.filter((m) => m.kind === "kin").map((m) => m.speaker);
    check("@all: five different Kins answer in turn", ks.length === 5 && new Set(ks).size === 5, ks.join(","));
    check("@all: never overlapping", t.running.max === 1);
    await t.run(); check("@all: then the table goes quiet", t.log.filter((m) => m.kind === "kin").length === 5); }
  // 4. two names in one line: both answer, one after the other
  { const t = table(); t.post("Chris", "person", "", "@Ada Quill and @Elsie Rhyme, you two settle this"); await t.run();
    const ks = t.log.filter((m) => m.kind === "kin").map((m) => m.speaker).slice(0, 2);
    check("two names: both spoken-to Kins answer, in the order named", ks[0] === "k0" && ks[1] === "k4", ks.join(",")); }
  // 5. a line aimed at another person by name is theirs to answer
  { const t = table(); const e = { id: "x1", who: "Chris", kind: "person", speaker: "", text: "Sam, did you see that river card?", ts: t.now() };
    t.cond.note(t.st, e, t.kins); const pl = t.cond.plan(t.st, t.kins, { people: ["Chris", "Sam"] }); // (plan waits for the pause first)
    t.adv(5000); const pl2 = t.cond.plan(t.st, t.kins, { people: ["Chris", "Sam"] });
    check("a line to another person gets no Kin reply", pl2.act === "idle", pl.act + "/" + pl2.act); }
  // 6. an @mention is answered even while resting / pacing-limited; unaddressed talk respects pacing
  { const t = table({ asksPerMin: 2, delayScale: 0 }); let n = 0;
    for (let i = 0; i < 6; i++) { t.post("Chris", "person", "", "nice weather today " + i); await t.run(); }
    n = t.asked.length; check("pacing: unaddressed Kin requests stay within the per-minute allowance", n <= 3, n);
    t.post("Chris", "person", "", "@Barnaby Salt your turn"); await t.run();
    check("pacing: but a spoken-to Kin still answers", t.log[t.log.length - 1].speaker === "k1" || t.asked[t.asked.length - 1].k === "k1"); }
  // 7. failure frees the table and the Kin isn't hammered
  { const t = table(); t.post("Chris", "person", "", "@Ada Quill hi"); 
    await t.cond.drive(t.st, { kins: t.kins, maxSleep: 1e9, sleep: async (ms) => t.adv(ms), ask: async () => { throw new Error("no key"); } });
    check("a failed request frees the table", !t.cond.busy(t.st)); }
  // 8. two copies (host + guest): the guest generates once per request id, a repeated delivery makes no second line
  { const host = table({ dur: 500 }); const guestSt = C.fresh(); const gcond = host.cond; let guestGens = 0; const inbox = [];
    host.post("Chris", "person", "", "@Elsie Rhyme write us a song");     // Elsie (k4) belongs to the guest
    await host.cond.drive(host.st, { kins: host.kins, maxSleep: 1e9, sleep: async (ms) => host.adv(ms),
      ask: async (k, job) => { if (k.owner === "guest") { inbox.push({ kinId: k.id, job }); inbox.push({ kinId: k.id, job }); return { remote: true }; } host.post(k.name, "kin", k.id, "local"); return { local: true }; } });
    check("hosted: the host waits instead of asking another Kin while the guest's Kin is working", host.cond.busy(host.st) && host.asked.length === 0);
    const out = []; for (const req of inbox) { if (!gcond.claim(guestSt, req.job)) continue; guestGens++; out.push({ kinId: req.kinId }); }
    check("hosted: the guest's copy makes exactly one line for a request delivered twice", guestGens === 1 && out.length === 1, guestGens);
    host.post("Elsie Rhyme", "kin", "k4", "guest line"); // arrives at the host
    check("hosted: the arriving line frees the table", !host.cond.busy(host.st));
    check("hosted: one line from that Kin in the log", host.log.filter((m) => m.speaker === "k4").length === 1); }
  // 9. spoken-to Kin that belongs to a guest + later follow-up from a different Kin
  { const t = table({ dur: 300 }); t.post("Chris", "person", "", "Barnaby, how's the sea?"); await t.run();
    const ks = t.log.filter((m) => m.kind === "kin"); check("follow-up (if any) is from a different Kin", ks.every((m, i) => i === 0 || m.speaker !== ks[i - 1].speaker)); }
  // 10. mentionOnly: nobody is asked unless spoken to; a burst keeps the first @mention
  { const T = { v: 1e6 }; const kins = mkKins(), st = C.fresh(), asked = [];
    const cond = C.create({ now: () => T.v, mentionOnly: true, delayScale: 0, kinGapMs: 0 });
    const drive = () => cond.drive(st, { kins, ctx: () => ({ people: ["Chris"] }), maxSleep: 1e9, sleep: async (ms) => { T.v += ms; }, ask: async (k) => { asked.push(k.id); return { local: true }; } });
    cond.note(st, { id: "a", who: "Chris", kind: "person", text: "nice weather today", ts: T.v }, kins); await drive();
    check("mentionOnly: an unaddressed line asks nobody", asked.length === 0, asked.length);
    cond.note(st, { id: "b", who: "Chris", kind: "person", text: "@Cora Basil hi", ts: T.v }, kins);
    cond.note(st, { id: "c", who: "Chris", kind: "person", text: "and something else", ts: T.v }, kins); await drive();
    check("mentionOnly: the @mention in a burst is answered, by that Kin only", asked.length === 1 && asked[0] === "k2", asked.join()); }
  // 11. two drives at once (a tick and a hosted event) never ask two Kins together
  { const t = table({ dur: 1000, delayScale: 0 }); t.post("Chris", "person", "", "@Ada Quill and @Barnaby Salt hello"); await Promise.all([t.run(), t.run(), t.run()]);
    check("concurrent drives: never two generating at once", t.running.max <= 1, t.running.max);
    check("concurrent drives: both named Kins answered once", t.log.filter((m) => m.speaker === "k0").length === 1 && t.log.filter((m) => m.speaker === "k1").length === 1); }
  console.log(`CONDUCTOR ${fail ? "FAIL" : "PASS"} (${pass}/${pass + fail})`); process.exit(fail ? 1 : 0);
})();
