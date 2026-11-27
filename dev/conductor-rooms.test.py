# Conductor test (v1.3.1):  At a Kin Hold'em table (solo with my Kins and hosted between two PCs) and at a Kin Casino
# table, anyone's chat line (a person's or a Kin's) must be answered by the Kins through the Kindroid API, shown in Chat with "X is typing…",
# with a clear message when the key is missing/wrong or the request fails, never more than 3 Kin lines in a row, never past Kindroid's
# limit of 10 requests per 30 seconds, and a person's name (from Settings / the Kindroid export), not "Host".
# Everything runs against a mock of api.kindroid.ai (dev/mock-kindroid.js); Kins come in through Import (synthetic Kindroid export).
import json, os, re, shutil, subprocess, sys, time
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
SH = os.environ.get("SHOTS", "/workspace/kin-apps/shots/"); os.makedirs(SH, exist_ok=True)
LOG, CTRL = "/tmp/kgr-cond-mock.jsonl", "/tmp/kgr-cond-ctrl.json"
KEY_A, KEY_B = "kn_goodAaaaaaaaaaaa", "kn_goodBbbbbbbbbbbb"
results = {}; procs = []
def check(name, ok, detail=""):
    results[name] = bool(ok); print(("PASS " if ok else "FAIL ") + name, detail, flush=True)
def start(cmd, env=None, log=None):
    e = dict(os.environ); e.update(env or {}); procs.append(subprocess.Popen(cmd, env=e, stdout=open(log or os.devnull, "w"), stderr=subprocess.STDOUT))
def mock():
    try: return [json.loads(l) for l in open(LOG)]
    except FileNotFoundError: return []
def ctrl(**kw): open(CTRL, "w").write(json.dumps(kw))
def export_file(path, names, ids, user="Casey Tester"):
    L = [{"type": "meta", "schema_version": 2}, {"type": "user", "data": {"user_name": user, "ai_list": ids}}]
    for n, i in zip(names, ids): L.append({"type": "entity", "entity_type": "ai", "entity_id": i, "data": {"ai_id": i, "ai_name": n, "ai_backstory": "Made-up.", "ai_memory": "Made-up."}})
    open(path, "w").write("\n".join(json.dumps(x) for x in L) + "\n")
def view(d, slug):
    try: return json.load(open(f"{d}/apps/{slug}/files/view.json"))
    except Exception: return {}
def wait(fn, secs=60, step=0.5):
    t0 = time.time()
    while time.time() - t0 < secs:
        r = fn()
        if r: return r
        time.sleep(step)
    return None
def chat_of(d, slug): return (view(d, slug).get("chat") or [])
def runs_of_kin(chat):  # longest run of Kin lines with no person line between them
    best = cur = 0
    for m in chat:
        if m["kind"] == "kin": cur += 1; best = max(best, cur)
        elif m["kind"] == "person": cur = 0
    return best
def api(pg, token, path, body): return pg.evaluate("async ([p,b,t]) => (await fetch(p,{method:'POST',headers:{'x-room-token':t,'content-type':'application/json'},body:JSON.stringify(b)})).json()", [path, body, token])

for d in ("/tmp/kgrCondA", "/tmp/kgrCondB"): shutil.rmtree(d, ignore_errors=True)
for f in (LOG, CTRL):
    if os.path.exists(f): os.remove(f)
start(["node", os.path.join(HERE, "mock-kindroid.js")], {"MOCK_LOG": LOG, "MOCK_PORT": "47833", "MOCK_CTRL": CTRL})
start(["node", os.path.join(ROOT, "relay.js")], {"PORT": "47843", "HOST": "127.0.0.1", "RELAY_QUIET": "1"})
for port, data in ((47980, "/tmp/kgrCondA"), (47981, "/tmp/kgrCondB")):
    start(["node", os.path.join(ROOT, "server.js")], {"KGR_PORT": str(port), "KGR_DATA": data, "KGR_NO_OPEN": "1", "KGR_API_BASE": "http://127.0.0.1:47833/v1", "KGR_ROOM_CHAIN": "1", "KGR_CHAT_DELAY": "0.3"}, data + ".log")
time.sleep(1.8)
RELAY = "http://127.0.0.1:47843/"
NAMES_A = ["Crikey", "Gator Vance", "Darken Rahl", "Panis Rahl"]; IDS_A = [f"chatAiIdA{i:02d}xxxxxxxx"[:20] for i in range(4)]
NAMES_B = ["Remy Fox"]; IDS_B = ["chatAiIdB00xxxxxxxx"]
export_file("/tmp/kr-cond-A.jsonl", NAMES_A, IDS_A); export_file("/tmp/kr-cond-B.jsonl", NAMES_B, IDS_B, "Bo Tester")
errors = []

def setup(ctx, port, key, exportf, n):
    pg = ctx.new_page(); pg.set_default_timeout(25000); pg.on("pageerror", lambda e: errors.append(str(e) + " @ " + str(getattr(e, "stack", ""))[:300]))
    pg.goto(f"http://localhost:{port}/"); pg.wait_for_selector("#tab-characters")
    token = pg.evaluate("document.querySelector('meta[name=room-token]').content")
    pg.click("#tab-characters"); pg.wait_for_selector("#view-characters:not([hidden])")
    pg.set_input_files("#importFile", exportf); pg.wait_for_selector("#impDlg[open]")
    pg.wait_for_function(f"document.querySelectorAll('#impList .improw').length === {n}")
    pg.click("#impGo"); pg.wait_for_selector("dialog[open] h2:has-text('Import done')", timeout=60000); pg.click("dialog[open] button:has-text('Done')")
    r = api(pg, token, "/api/key", {"apiKey": key}); assert r.get("ok"), r
    pg.click("#tab-settings"); pg.fill("#relay", RELAY); pg.click("#saveRelay")
    pg.wait_for_function("document.querySelector('#relayTxt').textContent.includes('connected')", timeout=20000)
    return pg, token

def fr(page, slug):
    page.goto(f"http://localhost:{page.url.split(':')[2].split('/')[0]}/play/{slug}"); return page.frame_locator("#screen")

def say(f, text, ooc=False):
    f.locator("#say").fill(text); f.locator("#send").click()


def sv(d): return view(d, "kin-roomsplus")
def klines(d): return [m for m in (sv(d).get("log") or []) if m.get("kind") == "kin"]
def sysl(d): return [m["text"] for m in (sv(d).get("log") or []) if m.get("kind") == "system"]
def per_key_worst():
    by = {}
    for r in mock():
        if "tag" in r and r.get("path", "").endswith("send-message"): by.setdefault(r["tag"], []).append(r["t"])
    worst = 0
    for ts in by.values():
        for i, t in enumerate(ts): worst = max(worst, sum(1 for u in ts if t <= u < t + 30000))
    return worst
def n429(): return sum(1 for r in mock() if r.get("status") == 429)

try:
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        ctxA = b.new_context(viewport={"width": 1000, "height": 900}); ctxB = b.new_context(viewport={"width": 1000, "height": 900})
        A, tokA = setup(ctxA, 47980, KEY_A, "/tmp/kr-cond-A.jsonl", 4)
        B, tokB = setup(ctxB, 47981, KEY_B, "/tmp/kr-cond-B.jsonl", 1)
        DA, DB = "/tmp/kgrCondA", "/tmp/kgrCondB"
        fa = fr(A, "kin-roomsplus"); fb = fr(B, "kin-roomsplus")
        fa.locator("#hRoom").wait_for(); fb.locator("#tJoin").wait_for(); A.wait_for_timeout(5000)
        check("rooms: your name is filled from Settings / the Kindroid export (A)", fa.locator("#myname").input_value() == "Casey Tester", fa.locator("#myname").input_value())
        check("rooms: your name is filled from the export (B)", fb.locator("#myname").input_value() == "Bo Tester", fb.locator("#myname").input_value())
        fa.locator("#hRoom").fill("Test Inn"); fa.locator("#doHost").click()
        fa.locator("#invite").wait_for(state="visible", timeout=30000); A.wait_for_timeout(1500)
        inv = fa.locator("#invite").inner_text()
        fb.locator("#tJoin").click(); fb.locator("#jCode").fill(inv); fb.locator("#doJoin").click()
        fb.locator("#reviewRules").wait_for(state="visible", timeout=45000); fb.locator("#reviewRules").click()
        fa.locator("#waiting button:has-text('Admit')").first.wait_for(timeout=45000); fa.locator("#waiting button:has-text('Admit')").first.click()
        wait(lambda: len(((sv(DB).get("room") or {}).get("members") or [])) >= 2 or sv(DB).get("joined"), 60)
        check("rooms: a guest joins through the relay and is admitted", sv(DB).get("joined") is True, "")
        auto_ok = all(k["auto"] for k in sv(DA)["kins"])
        check("rooms: Kins join the conversation by default (auto replies on)", auto_ok, "")

        # ---- a busy table of 5 Kins (4 mine, 1 a guest's): one Kin writes at a time ----
        def reqs(): return [r for r in mock() if r.get("path", "").endswith("send-message") and r.get("ts0")]
        def max_overlap():
            iv = sorted((r["ts0"], r["t"]) for r in reqs()); best = 0
            for i, (s0, e0) in enumerate(iv): best = max(best, sum(1 for (s1, e1) in iv if s1 < e0 and s0 < e1))
            return best
        ctrl(delayMs=2500)
        for i, line in enumerate(["Hello everyone, who is going to win tonight?", "anyone hungry?", "what a hand that was", "Everyone, who has the best bluff?"]):
            (say(fa, line) if i % 2 == 0 else say(fb, line)); time.sleep(3 if i < 3 else 1)
        # a person talks again while a Kin is still writing
        say(fa, "ha, I knew it"); time.sleep(25)
        wait(lambda: not sv(DA).get("typing") and not sv(DB).get("typing"), 60)
        n_req = len(reqs())
        check("conductor: a busy table of 5 Kins made requests", n_req >= 4, f"{n_req} requests")
        check("conductor: two Kins never write at the same time (requests don't overlap)", max_overlap() <= 1, f"max overlap {max_overlap()}")
        log = sv(DA).get("log") or []
        check("conductor: never more than 3 Kin lines in a row", runs_of_kin(log) <= 3, f"longest {runs_of_kin(log)}")
        kk = [log[i]["kinId"] == log[i - 1]["kinId"] for i in range(1, len(log)) if log[i]["kind"] == "kin" and log[i - 1]["kind"] == "kin"]
        check("conductor: a Kin never follows its own line", not any(kk), "")
        check("conductor: both screens show the same conversation", [m["id"] for m in (sv(DB).get("log") or [])][-6:] == [m["id"] for m in log][-6:], "")
        # ---- @Name gets the reply ----
        for target, who in (("Darken Rahl", "Darken Rahl"), ("Remy Fox", "Remy Fox")):
            n0 = len([m for m in klines(DA) if m["who"] == who])
            say(fa, f"@{target} what is your honest read on this table?")
            ok = wait(lambda: len([m for m in klines(DA) if m["who"] == who]) > n0, 60)
            first = None
            if ok:
                lg = sv(DA).get("log") or []; idx = max(i for i, m in enumerate(lg) if m["kind"] == "person" and f"@{target}" in m["text"])
                nxt = [m for m in lg[idx + 1:] if m["kind"] == "kin"]; first = nxt[0]["who"] if nxt else None
            check(f"conductor: @{target} gets the reply, and answers first", bool(ok) and first == who, f"first={first}")
            time.sleep(8); wait(lambda: not sv(DA).get("typing") and not sv(DB).get("typing"), 60)
        # ---- no duplicate replies across the two PCs: one Kin line per request, each Kin request seen once ----
        lg = sv(DA).get("log") or []; ids = [m["id"] for m in lg]
        check("conductor: no line is in the log twice", len(ids) == len(set(ids)), "")
        remy_lines = [m for m in lg if m.get("who") == "Remy Fox" and m["kind"] == "kin"]
        remy_reqs = [r for r in reqs() if "You are Remy" in r.get("msg", "") and r.get("tag") == KEY_B[7]]
        check("conductor: the guest's Kin wrote exactly one line per request (its own key, no duplicates)", len(remy_lines) == len(remy_reqs) and len(remy_reqs) >= 1, f"{len(remy_lines)} lines / {len(remy_reqs)} requests")
        host_reqs_for_remy = [r for r in reqs() if "You are Remy" in r.get("msg", "") and r.get("tag") == KEY_A[7]]
        check("conductor: the host never asked the guest's Kin through its own key", not host_reqs_for_remy, str(len(host_reqs_for_remy)))
        a_lines = [m for m in lg if m["kind"] == "kin" and m.get("kinId") and m["who"] != "Remy Fox"]
        a_reqs = [r for r in reqs() if r.get("tag") == KEY_A[7]]
        check("conductor: host Kins wrote one line per request", abs(len(a_lines) - len(a_reqs)) <= 1, f"{len(a_lines)} lines / {len(a_reqs)} requests")
        check("conductor: never over Kindroid's limit (per key, 30 s window)", per_key_worst() <= 9 and n429() == 0, f"worst {per_key_worst()}, 429s {n429()}")
        ctrl()
        A.screenshot(path=SH + "v131-conductor-host.png"); B.screenshot(path=SH + "v131-conductor-guest.png")
finally:
    for pr in procs: pr.kill()
    bad = [k for k, v in results.items() if not v]
    print("page errors:", errors[:5])
    print(f"CONDUCTOR ROOMS {'PASS' if not bad and not errors else 'FAIL'} ({len(results)-len(bad)}/{len(results)})")
    for k in bad: print("  FAILED:", k)
