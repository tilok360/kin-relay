# Cards Against Kin-manatee table chat in Kin Relay: anyone's line (a person's or a Kin's) gets Kin replies, with
# "X is typing…", at most 3 Kin lines in a row, your name (not "Host"), a visible reason when a Kin can't answer, and a
# guest's Kin answering through its own person's key. Mock Kindroid API, relay and two Kin Relay servers on this PC.
import json, os, re, shutil, subprocess, sys, time
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
SH = os.environ.get("SHOTS", "/workspace/kin-apps/shots/"); os.makedirs(SH, exist_ok=True)
LOG, CTRL = "/tmp/kgr-man-mock.jsonl", "/tmp/kgr-man-ctrl.json"
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

for d in ("/tmp/kgrManA", "/tmp/kgrManB"): shutil.rmtree(d, ignore_errors=True)
for f in (LOG, CTRL):
    if os.path.exists(f): os.remove(f)
start(["node", os.path.join(HERE, "mock-kindroid.js")], {"MOCK_LOG": LOG, "MOCK_PORT": "47814", "MOCK_CTRL": CTRL})
start(["node", os.path.join(ROOT, "relay.js")], {"PORT": "47824", "HOST": "127.0.0.1", "RELAY_QUIET": "1"})
for port, data in ((47972, "/tmp/kgrManA"), (47973, "/tmp/kgrManB")):
    start(["node", os.path.join(ROOT, "server.js")], {"KGR_PORT": str(port), "KGR_DATA": data, "KGR_NO_OPEN": "1", "KGR_API_BASE": "http://127.0.0.1:47814/v1", "KGR_ROOM_CHAIN": "1"}, data + ".log")
time.sleep(1.8)
RELAY = "http://127.0.0.1:47824/"
NAMES_A = ["Crikey", 'Earl "Gator" Vance', "Darken Rahl", "Panis Rahl"]; IDS_A = [f"chatAiIdA{i:02d}xxxxxxxx"[:20] for i in range(4)]
NAMES_B = ["Remy Fox"]; IDS_B = ["chatAiIdB00xxxxxxxx"]
export_file("/tmp/kr-man-A.jsonl", NAMES_A, IDS_A); export_file("/tmp/kr-man-B.jsonl", NAMES_B, IDS_B, "Bo Tester")
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


SLUG = "kin-manatee"
def mchat(d):
    try: return json.load(open(f"{d}/apps/{SLUG}/files/chat.json"))
    except Exception: return []
def kin_lines(d): return [m for m in mchat(d) if m.get("kind") == "kin"]
def longest_kin_run(d):
    best = cur = 0
    for m in mchat(d):
        if m["kind"] == "kin": cur += 1; best = max(best, cur)
        elif m["kind"] == "person": cur = 0
    return best
def saw_typing(f, secs=40):
    t0 = time.time()
    while time.time() - t0 < secs:
        try:
            if f.locator(".msg.typing").count(): return f.locator(".msg.typing").first.inner_text()
        except Exception: pass
        time.sleep(0.25)
    return ""
def open_chat(f):
    if f.locator("#say").is_hidden(): f.locator("#bChat").click()
    f.locator("#say").wait_for(state="visible")

try:
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        ctxA = b.new_context(viewport={"width": 1100, "height": 900}); ctxB = b.new_context(viewport={"width": 1100, "height": 900})
        A, tokA = setup(ctxA, 47972, KEY_A, "/tmp/kr-man-A.jsonl", 4)
        B, tokB = setup(ctxB, 47973, KEY_B, "/tmp/kr-man-B.jsonl", 1)
        DA, DB = "/tmp/kgrManA", "/tmp/kgrManB"
        fa = fr(A, SLUG); fa.locator("#tKins").click(); A.wait_for_timeout(2500)
        check("manatee: your name is filled from Settings / the Kindroid export", fa.locator("#myname").input_value() == "Casey Tester", fa.locator("#myname").input_value())
        for n in ("Crikey", "Darken Rahl", "Panis Rahl"): fa.locator("#soloPick button", has_text=n).click(); A.wait_for_timeout(400)
        fa.locator("#doKins").click()
        ok = wait(lambda: (view(DA, SLUG).get("table") or {}).get("seats"), 40)
        seats = [s["name"] for s in ((view(DA, SLUG).get("table") or {}).get("seats") or [])]
        check("manatee: My Kins table opens with the chosen Kins seated", all(n in seats for n in ("Crikey", "Darken Rahl", "Panis Rahl")), str(seats))
        open_chat(fa)
        n0 = len(kin_lines(DA)); ctrl(delayMs=3500)
        fa.locator("#say").fill("who is going to win tonight?"); fa.locator("#send").click()
        ty = saw_typing(fa)
        check("manatee: 'X is typing…' shows while a Kin answers", "is typing" in ty, ty)
        got = wait(lambda: len(kin_lines(DA)) > n0, 60)
        wait(lambda: len(kin_lines(DA)) - n0 >= 2, 40); wait(lambda: not (view(DA, SLUG).get("table") or {}).get("typing"), 60); A.wait_for_timeout(3000); ctrl()  # a second Kin follows after a short pause
        mine = [m for m in mchat(DA) if m["kind"] == "person"]
        check("manatee: my line is under my name, not Host", mine and mine[-1]["who"] == "Casey Tester", mine and mine[-1]["who"])
        check("manatee: a Kin answers a person's line", bool(got), str([m["who"] for m in kin_lines(DA)]))
        check("manatee: the answer is shown in the chat", fa.locator(".msg.kin:not(.typing)").count() > 0, "")
        check("manatee: Kins answer each other (more than one Kin line), never more than 3 in a row", len(kin_lines(DA)) - n0 >= 2 and longest_kin_run(DA) <= 3, f"{len(kin_lines(DA)) - n0} lines, longest run {longest_kin_run(DA)}")
        # addressed Kin answers first
        wait(lambda: not (view(DA, SLUG).get("table") or {}).get("typing"), 60); A.wait_for_timeout(3000)
        n1 = len(mchat(DA))
        fa.locator("#say").fill("@Panis Rahl what card would you play?"); fa.locator("#send").click()
        wait(lambda: any(m["kind"] == "kin" for m in mchat(DA)[n1:]), 60)
        firstk = [m for m in mchat(DA)[n1:] if m["kind"] == "kin"]
        check("manatee: the Kin you name answers first", firstk and firstk[0]["who"] == "Panis Rahl", firstk and firstk[0]["who"])
        wait(lambda: not (view(DA, SLUG).get("table") or {}).get("typing"), 60); A.wait_for_timeout(3000)
        # a failure is shown, not swallowed
        ctrl(status=500); n2 = len(mchat(DA))
        fa.locator("#say").fill("Crikey, are you there?"); fa.locator("#send").click()
        er = wait(lambda: [m["text"] for m in mchat(DA)[n2:] if "couldn't answer" in m["text"]], 60)
        check("manatee: a Kin that can't answer says why in the chat", bool(er), (er or [""])[0][:120])
        ctrl()
        typ = wait(lambda: not (view(DA, SLUG).get("table") or {}).get("typing"), 30)
        check("manatee: no typing indicator is left stuck", bool(typ), "")
        A.screenshot(path=SH + "v130-manatee-kins.png")
        # ---- hosted between two PCs: a guest's Kin answers through its own person's key ----
        fa.locator("#back").click(); fa.locator("#back").click()
        wait(lambda: view(DA, SLUG).get("mode") == "off", 40)
        fa = fr(A, SLUG); fa.locator("#tHost").click(); A.wait_for_timeout(1500)
        fa.locator("#bring button", has_text="Crikey").click(); A.wait_for_timeout(800)
        fa.locator("#doHost").click()
        inv = wait(lambda: ((view(DA, SLUG).get("host") or {}).get("invite")), 40)
        fb = fr(B, SLUG); fb.locator("#tJoin").click(); B.wait_for_timeout(2500)
        check("manatee: the guest's name is filled from their export", fb.locator("#myname").input_value() == "Bo Tester", fb.locator("#myname").input_value())
        fb.locator("#bring button", has_text="Remy Fox").click(); B.wait_for_timeout(800)
        fb.locator("#jCode").fill(inv or ""); fb.locator("#doJoin").click()
        w = wait(lambda: (view(DA, SLUG).get("host") or {}).get("waiting"), 60)
        fa.locator("#gear").click(); fa.locator("button", has_text="Admit").first.click()
        joined = wait(lambda: view(DB, SLUG).get("joined"), 60)
        check("manatee: the guest joins through the relay", bool(joined), "")
        wait(lambda: "Remy Fox" in [s["name"] for s in ((view(DA, SLUG).get("table") or {}).get("seats") or [])], 40)
        n3 = len(mchat(DA)); before = [r for r in mock() if r.get("tag") == "B"]
        open_chat(fb); fb.locator("#say").fill("Remy, do you like this game?"); fb.locator("#send").click()
        rl = wait(lambda: [m for m in mchat(DA)[n3:] if m["kind"] == "kin" and m["who"] == "Remy Fox"], 90)
        check("manatee: the guest's Kin answers at the host's table", bool(rl), (rl or [{}])[0].get("text", "")[:80])
        check("manatee: ... through its own person's key", len([r for r in mock() if r.get("tag") == "B"]) > len(before), "")
        seenB = wait(lambda: [m for m in mchat(DB) if m.get("who") == "Remy Fox"], 60)
        check("manatee: ... and the guest sees it too", bool(seenB), "")
        wait(lambda: not (view(DA, SLUG).get("table") or {}).get("typing"), 60)
        A.screenshot(path=SH + "v130-manatee-host.png"); B.screenshot(path=SH + "v130-manatee-guest.png")
        check("manatee: never more than 3 Kin lines in a row", longest_kin_run(DA) <= 3, str(longest_kin_run(DA)))
        check("manatee: no page errors", not errors, "; ".join(errors)[:300])
finally:
    for pr in procs: pr.kill()
# One Kin writes at a time: no two Kin requests (to the mock Kindroid API) overlap, whatever the table.
_iv = sorted((r["ts0"], r["t"]) for r in mock() if r.get("path", "").endswith("send-message") and r.get("ts0") and r.get("chat"))
_ov = max([sum(1 for (s1, e1) in _iv if s1 < e0 and s0 < e1) for (s0, e0) in _iv] or [0])
check("conductor: two Kins never write at the same time (no overlapping Kin chat requests)", _ov <= 1 and len(_iv) > 0, f"{len(_iv)} requests, max overlap {_ov}")
bad = [k for k, v in results.items() if not v]
print(f"MANATEE CHAT {'PASS' if not bad else 'FAIL'} ({len(results)-len(bad)}/{len(results)})")
sys.exit(1 if bad else 0)
