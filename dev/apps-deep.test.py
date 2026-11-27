# Plays each bundled app a little, the way a person would, in Kin Relay: starts a game against a Kin, makes a move,
# drafts with a Kin, saves a file, refreshes data. Checks the app does what it should here and reports nothing broken.
# Mock Kindroid API (no real key). Sky Watch reaches real public sites when online; set OFFLINE=1 to skip that check.
import json, os, shutil, subprocess, sys, time
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
SH = os.environ.get("SHOTS", "/workspace/kin-apps/shots/"); os.makedirs(SH, exist_ok=True)
LOG, CTRL, DATA, PORT = "/tmp/kgr-deep-mock.jsonl", "/tmp/kgr-deep-ctrl.json", "/tmp/kgrDeep", 47962
OFFLINE = os.environ.get("OFFLINE") == "1"
procs, res = [], {}
def check(n, ok, d=""): res[n] = bool(ok); print(("PASS " if ok else "FAIL ") + n, d, flush=True)
def start(cmd, env=None, log=None):
    e = dict(os.environ); e.update(env or {}); procs.append(subprocess.Popen(cmd, env=e, stdout=open(log or os.devnull, "w"), stderr=subprocess.STDOUT))
def mock():
    try: return [json.loads(l) for l in open(LOG)]
    except FileNotFoundError: return []
def asks(): return len([r for r in mock() if str(r.get("path", "")).endswith("send-message")])
def wait(fn, secs=30, step=0.4):
    t0 = time.time()
    while time.time() - t0 < secs:
        try: r = fn()
        except Exception: r = None
        if r: return r
        time.sleep(step)
    return None
def files(slug): return os.path.join(DATA, "apps", slug, "files")
def srvlog(): return open(DATA + ".log").read()
for f in (LOG, CTRL):
    if os.path.exists(f): os.remove(f)
shutil.rmtree(DATA, ignore_errors=True)
start(["node", os.path.join(HERE, "mock-kindroid.js")], {"MOCK_LOG": LOG, "MOCK_PORT": "47815", "MOCK_CTRL": CTRL})
start(["node", os.path.join(ROOT, "server.js")], {"KGR_PORT": str(PORT), "KGR_DATA": DATA, "KGR_NO_OPEN": "1", "KGR_API_BASE": "http://127.0.0.1:47815/v1"}, DATA + ".log")
time.sleep(1.5)
EXP = "/tmp/kr-deep.jsonl"
L = [{"type": "meta", "schema_version": 2}, {"type": "user", "data": {"user_name": "Casey Tester", "ai_list": ["deepAiId00xxxxxxxxx"]}},
     {"type": "entity", "entity_type": "ai", "entity_id": "deepAiId00xxxxxxxxx", "data": {"ai_id": "deepAiId00xxxxxxxxx", "ai_name": "Crikey", "ai_backstory": "Made-up.", "ai_memory": "Made-up."}}]
open(EXP, "w").write("\n".join(json.dumps(x) for x in L) + "\n")
errs = []
try:
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        ctx = b.new_context(viewport={"width": 1100, "height": 900}, accept_downloads=True); pg = ctx.new_page(); pg.set_default_timeout(25000)
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(f"http://localhost:{PORT}/"); pg.wait_for_selector("#tab-characters")
        tok = pg.evaluate("document.querySelector('meta[name=room-token]').content")
        pg.click("#tab-characters"); pg.set_input_files("#importFile", EXP); pg.wait_for_selector("#impDlg[open]")
        pg.wait_for_function("document.querySelectorAll('#impList .improw').length === 1"); pg.click("#impGo")
        pg.wait_for_selector("dialog[open] h2:has-text('Import done')", timeout=60000); pg.click("dialog[open] button:has-text('Done')")
        pg.evaluate("async ([t]) => (await fetch('/api/key',{method:'POST',headers:{'x-room-token':t,'content-type':'application/json'},body:JSON.stringify({apiKey:'kn_goodAaaaaaaaaaaa'})})).json()", [tok])
        def play(slug):
            errs.clear(); pg.goto(f"http://localhost:{PORT}/play/{slug}"); pg.wait_for_timeout(3000)
            return pg.frame_locator("#screen"), [x for x in pg.frames if f"/apps/{slug}/" in x.url][0]
        def noerr(slug):
            check(f"{slug}: no page errors", not errs, "; ".join(errs)[:200]); pg.screenshot(path=SH + f"v130-deep-{slug}.png")
            fr = [x for x in pg.frames if f"/apps/{slug}/" in x.url][0]; t = fr.evaluate("document.body.innerText")
            import re as _re; bad = _re.findall(r"[^.\n]{0,30}\b(?:uses|use|costs?) (?:Kindroid |Kindroid Apps )?credits[^.\n]{0,20}", t)
            check(f"{slug}: doesn't say it uses Kindroid credits here", not bad, str(bad[:2]))
        def step(name, fn):
            try: fn()
            except Exception as e: check(name + " (ran)", False, str(e).split("\n")[0][:200])

        def battleship():
            f, fr = play("kin-battleship"); f.locator("#playkin").click(); pg.wait_for_timeout(800); f.locator("#start").click(); pg.wait_for_timeout(1500)
            a0 = asks(); box = pg.locator("#screen").bounding_box()
            for i in range(14):
                if asks() > a0: break
                pg.mouse.click(box["x"] + 70 + (i % 10) * 61, box["y"] + 280 + (i % 7) * 61); pg.wait_for_timeout(2500)
            check("kin-battleship: your Kin calls its shot through the API", wait(lambda: asks() > a0, 30), f"{asks() - a0} asks")
            noerr("kin-battleship")
        step("kin-battleship", battleship)

        def chess():
            f, fr = play("kin-chess-clash"); f.locator("#playkin").click(); pg.wait_for_timeout(1500)
            a0 = asks(); bb = pg.locator("#screen").bounding_box(); pg.wait_for_timeout(2500); f.locator("body").press("Escape"); pg.wait_for_timeout(500)
            def at(sq):
                p_ = fr.evaluate("(q) => { const r = document.getElementById('stage').getBoundingClientRect(), p = Scene.squareScreen(q); return [r.left + (p.x ?? p[0]), r.top + (p.y ?? p[1])]; }", sq)
                pg.mouse.click(bb["x"] + p_[0], bb["y"] + p_[1]); pg.wait_for_timeout(600)
            at(12); at(28)
            if not wait(lambda: asks() > a0, 8): at(12); at(28)  # the first tap may only have skipped an animation
            check("kin-chess-clash: your Kin picks its move through the API", wait(lambda: asks() > a0, 40), "")
            noerr("kin-chess-clash")
        step("kin-chess-clash", chess)

        def guesses():
            f, fr = play("kin-guesses-who"); a0 = asks(); f.locator("text=Start guessing").click()
            check("kin-guesses-who: a round starts and your Kin is asked for a question", wait(lambda: asks() > a0, 60), "")
            q = wait(lambda: f.locator("button", has_text="Yes").first.is_visible(), 60)
            check("kin-guesses-who: the answer buttons are shown", bool(q), "")
            if q:
                a1 = asks(); f.locator("button", has_text="Yes").first.click()
                check("kin-guesses-who: answering asks the Kin again", wait(lambda: asks() > a1, 60), "")
            noerr("kin-guesses-who")
        step("kin-guesses-who", guesses)

        def backup():
            f, fr = play("kin-backup")
            f.locator("#btn-new").click(); pg.wait_for_timeout(800)
            f.locator("input:visible").first.fill("Synthetic Sam"); pg.wait_for_timeout(300)
            sv = f.locator("button:visible", has_text="Save")
            if sv.count(): sv.first.click(); pg.wait_for_timeout(1500)
            f.locator("#btn-export-all").click(); pg.wait_for_timeout(1500)
            with pg.expect_download(timeout=30000) as dl: f.locator("button.btn.primary:visible").last.click()
            d = dl.value; size = os.path.getsize(d.path())
            check("kin-backup: Export all saves a file on this PC", size > 20, f"{d.suggested_filename} {size} bytes")
            noerr("kin-backup")
        step("kin-backup", backup)

        def workshop():
            f, fr = play("kin-workshop"); a0 = asks(); f.locator("#draft").click()
            check("kin-workshop: Draft with my Kin asks the Kin", wait(lambda: asks() > a0, 60), "")
            noerr("kin-workshop")
        step("kin-workshop", workshop)

        def vpw():
            f, fr = play("vignette-prompt-workshop"); f.locator("#build-btn").click(); pg.wait_for_timeout(800)
            out = fr.evaluate("[...document.querySelectorAll('textarea')].map(t=>t.value).join('').length")
            check("vignette-prompt-workshop: Build avatar fields fills the outputs", out > 50, f"{out} chars")
            noerr("vignette-prompt-workshop")
        step("vignette-prompt-workshop", vpw)

        def vpp():
            f, fr = play("vignette-prompt-partner"); f.locator("#kin-idea").fill("A quiet morning at a lakeside cabin."); a0 = asks()
            en = wait(lambda: f.locator("#kin-start").is_enabled(), 20)
            if en: f.locator("#kin-start").click()
            check("vignette-prompt-partner: Start with my Kin asks the Kin", en and wait(lambda: asks() > a0, 60), "" if en else "button stayed disabled")
            noerr("vignette-prompt-partner")
        step("vignette-prompt-partner", vpp)

        def sky():
            f, fr = play("kin-sky-watch")
            if not OFFLINE:
                sj = os.path.join(files("kin-sky-watch"), "sky.json")
                wait(lambda: os.path.exists(sj), 60); m0 = os.path.getmtime(sj) if os.path.exists(sj) else 0
                pg.wait_for_timeout(1500); f.locator("#refresh").click()
                got = wait(lambda: os.path.getmtime(sj) > m0 and os.path.getsize(sj) > 200, 150)
                check("kin-sky-watch: Refresh fetches sky data (live, needs internet)", bool(got), f"{os.path.getsize(sj) if os.path.exists(sj) else 0} bytes")
            noerr("kin-sky-watch")
        step("kin-sky-watch", sky)

        def touch():
            f, fr = play("kintouch"); noerr("kintouch")
            st = pg.evaluate("([t]) => fetch('/api/state',{headers:{'x-room-token':t}}).then(r=>r.json())", [tok])
            sec = [s for s in (st.get("secrets") or []) if s["slug"] in ("kintouch", "kin-cohost")]
            check("App sign-ins lists the sign-ins KinTouch and Co-Host need", {s["name"] for s in sec} >= {"lovense", "twitchchat", "joystickbot"}, str([s["name"] for s in sec]))
        step("kintouch", touch)

        def cohost():
            f, fr = play("kin-cohost"); pg.wait_for_timeout(2500)
            check("kin-cohost: the always-on part is running and writes its status", wait(lambda: os.path.exists(os.path.join(files("kin-cohost"), "status.json")), 30), "")
            check("kin-cohost: it isn't crashing", "permission" not in srvlog(), "")
            noerr("kin-cohost")
        step("kin-cohost", cohost)
finally:
    for pr in procs: pr.kill()
bad = [k for k, v in res.items() if not v]
print(f"APPS DEEP {'PASS' if not bad else 'FAIL'} ({len(res)-len(bad)}/{len(res)})")
sys.exit(1 if bad else 0)
