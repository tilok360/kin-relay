# Regression: "chat in Kin Relay not working". At a Kin Hold'em table (solo with my Kins and hosted between two PCs) and at a Kin Casino
# table, anyone's chat line (a person's or a Kin's) must be answered by the Kins through the Kindroid API, shown in Chat with "X is typing…",
# with a clear message when the key is missing/wrong or the request fails, never more than 3 Kin lines in a row, never past Kindroid's
# limit of 10 requests per 30 seconds, and a person's name (from Settings / the Kindroid export), not "Host".
# Everything runs against a mock of api.kindroid.ai (dev/mock-kindroid.js); Kins come in through Import (synthetic Kindroid export).
import json, os, re, shutil, subprocess, sys, time
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
SH = os.environ.get("SHOTS", "/workspace/kin-apps/shots/"); os.makedirs(SH, exist_ok=True)
LOG, CTRL = "/tmp/kgr-rooms-mock.jsonl", "/tmp/kgr-rooms-ctrl.json"
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

for d in ("/tmp/kgrRoomsA", "/tmp/kgrRoomsB"): shutil.rmtree(d, ignore_errors=True)
for f in (LOG, CTRL):
    if os.path.exists(f): os.remove(f)
start(["node", os.path.join(HERE, "mock-kindroid.js")], {"MOCK_LOG": LOG, "MOCK_PORT": "47813", "MOCK_CTRL": CTRL})
start(["node", os.path.join(ROOT, "relay.js")], {"PORT": "47823", "HOST": "127.0.0.1", "RELAY_QUIET": "1"})
for port, data in ((47970, "/tmp/kgrRoomsA"), (47971, "/tmp/kgrRoomsB")):
    start(["node", os.path.join(ROOT, "server.js")], {"KGR_PORT": str(port), "KGR_DATA": data, "KGR_NO_OPEN": "1", "KGR_API_BASE": "http://127.0.0.1:47813/v1", "KGR_ROOM_CHAIN": "1"}, data + ".log")
time.sleep(1.8)
RELAY = "http://127.0.0.1:47823/"
NAMES_A = ["Crikey", 'Earl "Gator" Vance', "Darken Rahl", "Panis Rahl"]; IDS_A = [f"chatAiIdA{i:02d}xxxxxxxx"[:20] for i in range(4)]
NAMES_B = ["Remy Fox"]; IDS_B = ["chatAiIdB00xxxxxxxx"]
export_file("/tmp/kr-rooms-A.jsonl", NAMES_A, IDS_A); export_file("/tmp/kr-rooms-B.jsonl", NAMES_B, IDS_B, "Bo Tester")
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
        A, tokA = setup(ctxA, 47970, KEY_A, "/tmp/kr-rooms-A.jsonl", 4)
        B, tokB = setup(ctxB, 47971, KEY_B, "/tmp/kr-rooms-B.jsonl", 1)
        DA, DB = "/tmp/kgrRoomsA", "/tmp/kgrRoomsB"
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

        # ---- a person speaks to the whole room: a Kin answers, with "is typing…" ----
        ctrl(delayMs=5000)
        t0 = len(mock())
        fa.locator("#say").fill("Hello everyone, who is going to win tonight?"); fa.locator("#send").click()
        seen_typing_a = seen_typing_b = False; t_end = time.time() + 40; nk0 = len(klines(DA))
        while time.time() < t_end and not (seen_typing_a and seen_typing_b):
            try:
                if fa.locator(".msg.typing").count(): seen_typing_a = True
                if fb.locator(".msg.typing").count(): seen_typing_b = True
            except Exception: pass
            time.sleep(0.4)
        check("rooms: 'X is typing…' shows on the host's screen while a Kin is asked", seen_typing_a, "")
        check("rooms: 'X is typing…' shows on the guest's screen too", seen_typing_b, "")
        A.screenshot(path=SH + "v130-rooms-host.png"); B.screenshot(path=SH + "v130-rooms-guest.png")
        got = wait(lambda: len(klines(DA)) > nk0, 60)
        check("rooms: a person's line to the room is answered by a Kin", bool(got), "")
        check("rooms: the Kin's line reaches the other person", bool(wait(lambda: len(klines(DB)) >= len(klines(DA)) and len(klines(DB)) > 0, 40)), "")
        ctrl()

        # ---- addressed: the Kin named answers first, through ITS owner's key ----
        nb0 = len([r for r in mock() if r.get("tag") == KEY_B[7] and "You are Remy" in r.get("msg", "")])
        fb.locator("#say").fill("Remy Fox, what do you think about that?"); fb.locator("#send").click()
        r1 = wait(lambda: [m for m in klines(DB) if m["who"] == "Remy Fox"], 60)
        check("rooms: a Kin named in the message answers (Remy Fox, a guest's Kin)", bool(r1), "")
        used_b = [r for r in mock() if r.get("tag") == KEY_B[7] and "You are Remy" in r.get("msg", "")]
        check("rooms: it answered through its OWN owner's key (B's), not the host's", len(used_b) > nb0, f"{len(used_b)-nb0} request(s)")
        fa.locator("#say").fill("@Crikey did you see that?"); fa.locator("#send").click()
        r2 = wait(lambda: [m for m in klines(DA) if m["who"] == "Crikey" and "to Casey Tester" in m["text"]], 60)
        check("rooms: @Name makes that Kin answer first", bool(r2), "")
        time.sleep(1)

        # ---- Kin-to-Kin chat, capped at 3 in a row ----
        for i in range(3):
            fb.locator("#say").fill(f"Everyone, round {i}: who has the best bluff?"); fb.locator("#send").click(); time.sleep(22)
        log = sv(DA).get("log") or []
        longest = runs_of_kin(log)
        kin_after_kin = any(log[i]["kind"] == "kin" and log[i - 1]["kind"] == "kin" for i in range(1, len(log)))
        check("rooms: Kins answer each other (a Kin's line draws another Kin in)", kin_after_kin, f"longest run {longest}")
        check("rooms: never more than 3 Kin lines in a row", longest <= 3, f"longest run {longest}")
        check("rooms: both screens show the same conversation", [m["id"] for m in (sv(DB).get("log") or [])][-5:] == [m["id"] for m in log][-5:], "")

        # ---- Kin memory: what the app told a Kin goes in front of its next question ----
        tells = None
        try: tells = json.load(open(f"{DA}/apps/kin-roomsplus/tells.json"))
        except Exception: pass
        check("rooms: the room is remembered by the Kins (kin tell kept locally)", bool(tells) and any("Test Inn" in t["text"] for t in tells), "")
        fa.locator("#say").fill("Gator, tell me something about this room"); fa.locator("#send").click()
        wait(lambda: any("told you to remember" in r.get("msg", "") and "Test Inn" in r.get("msg", "") for r in mock()), 60)
        check("rooms: that memory is put in front of the Kin's next question", any("told you to remember" in r.get("msg", "") and "Test Inn" in r.get("msg", "") for r in mock()), "")

        # ---- limits and honest degrade ----
        check("rooms: never over Kindroid's limit (per key, 30 s window)", per_key_worst() <= 9 and n429() == 0, f"worst {per_key_worst()}, 429s {n429()}")
        ctrl(status=401)
        fa.locator("#say").fill("@Crikey are you there?"); fa.locator("#send").click()
        e1 = wait(lambda: [t for t in sysl(DA) if "couldn't answer" in t], 40)
        check("rooms: when the key is refused the room is told, plainly (host copy)", bool(e1), (e1 or [""])[-1][:100])
        e2 = wait(lambda: [t for t in sysl(DB) if "couldn't answer" in t], 40)
        check("rooms: ... and the guest sees it too", bool(e2), "")
        check("rooms: no 'typing' is left stuck after a failure", wait(lambda: not sv(DA).get("typing") and not sv(DB).get("typing"), 20) is not None, "")
        ctrl()
        for pg_, tag in ((A, "A"), (B, "B")): pass
        A.screenshot(path=SH + "v130-rooms-error.png")
finally:
    for pr in procs: pr.kill()
    bad = [k for k, v in results.items() if not v]
    print("page errors:", errors[:5])
    print(f"ROOMS CHAT {'PASS' if not bad and not errors else 'FAIL'} ({len(results)-len(bad)}/{len(results)})")
    for k in bad: print("  FAILED:", k)
