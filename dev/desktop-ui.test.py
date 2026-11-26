# Kin Relay desktop (Electron) UI test, run on Linux under xvfb: the real app window, driven over the DevTools port.
# Checks the first-run Welcome, Settings (masked key, Show/Hide, Test with a bad and a good key, encrypted save),
# Characters (add with a picture, a bad AI ID refused, edit, delete), choosing Kins per game, drag-and-drop of a
# "Get its code" .gz, a game run (main.js) asking the Kin through the mock API, and that the window never navigates away.
# Usage: python3 dev/desktop-ui.test.py   (needs desktop/node_modules: cd desktop && npm install)
import json, os, subprocess, sys, time, shutil, base64, io
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
DESK = os.path.join(ROOT, "desktop"); STAGE = os.path.join(DESK, ".stage")
ELECTRON = os.path.join(DESK, "node_modules", "electron", "dist", "electron")
SH = os.environ.get("SHOTS", "/workspace/kin-apps/shots/"); os.makedirs(SH, exist_ok=True)
DATA = "/tmp/kr-desk"; MOCKLOG = "/tmp/kr-desk-mock.jsonl"; PORT = 47930; CDP = 9334
results = {}
def check(name, ok, detail=""):
    results[name] = bool(ok); print(("PASS " if ok else "FAIL ") + name, detail, flush=True)
def mocklines():
    try: return [json.loads(l) for l in open(MOCKLOG)]
    except FileNotFoundError: return []

subprocess.run(["pkill", "-f", "electron/dist/electron"], stderr=subprocess.DEVNULL); time.sleep(1)  # one copy at a time (single-instance lock)
shutil.rmtree(DATA, ignore_errors=True)
if os.path.exists(MOCKLOG): os.remove(MOCKLOG)
subprocess.run(["node", os.path.join(DESK, "build.js"), "stage"], check=True, stdout=subprocess.DEVNULL)
env = dict(os.environ, KGR_DATA=DATA, KGR_PORT=str(PORT), KGR_API_BASE="http://127.0.0.1:47812/v1", KGR_TEST_VAULT="1")
procs = [subprocess.Popen(["node", os.path.join(HERE, "mock-kindroid.js")], env=dict(os.environ, MOCK_LOG=MOCKLOG, MOCK_PORT="47812"), stdout=subprocess.DEVNULL),
         subprocess.Popen(["xvfb-run", "-a", "-s", "-screen 0 1400x950x24", ELECTRON, STAGE, "--no-sandbox", f"--remote-debugging-port={CDP}"], env=env, stdout=open("/tmp/kr-desk.log", "w"), stderr=subprocess.STDOUT)]
errors = []
try:
    for _ in range(60):
        try:
            import urllib.request; urllib.request.urlopen(f"http://127.0.0.1:{CDP}/json/version", timeout=1); break
        except Exception: time.sleep(0.5)
    with sync_playwright() as p:
        b = p.chromium.connect_over_cdp(f"http://127.0.0.1:{CDP}")
        pg = None
        for _ in range(40):
            pages = [x for c in b.contexts for x in c.pages if f":{PORT}" in x.url]
            if pages: pg = pages[0]; break
            time.sleep(0.25)
        pg.on("pageerror", lambda e: errors.append(str(e)))
        pg.set_default_timeout(20000)
        pg.set_viewport_size({"width": 1280, "height": 860})
        pg.wait_for_selector("#view-welcome:not([hidden])")
        check("app window opens on the first-run Welcome", pg.is_visible("text=Welcome to Kin Relay"))
        pg.wait_for_timeout(300); pg.screenshot(path=SH + "v11-welcome.png")

        # ---------- Settings ----------
        pg.click("#wGoKey"); pg.wait_for_selector("#view-settings:not([hidden])")
        check("key box is masked", pg.get_attribute("#apiKey", "type") == "password")
        pg.fill("#apiKey", "kn_wrong_key_99999999"); pg.click("#showKey")
        check("Show reveals the key", pg.get_attribute("#apiKey", "type") == "text" and pg.text_content("#showKey") == "Hide")
        pg.click("#showKey"); check("Hide masks it again", pg.get_attribute("#apiKey", "type") == "password")
        pg.click("#testKey"); pg.wait_for_function("document.querySelector('#keyMsg').className.includes('bad')")
        check("Test with a wrong key says plainly it failed", "did not accept" in pg.text_content("#keyMsg"), pg.text_content("#keyMsg"))
        pg.click("#saveKey"); pg.wait_for_function("document.querySelector('#keyMsg').textContent.includes('not saved')")
        check("a refused key is not saved", not os.path.exists(os.path.join(DATA, "key.json")))
        pg.fill("#apiKey", "kn_good_test_key_0001"); pg.click("#testKey"); pg.wait_for_function("document.querySelector('#keyMsg').className.includes('ok')")
        check("Test with a good key says it works (nothing saved yet)", "works" in pg.text_content("#keyMsg") and not os.path.exists(os.path.join(DATA, "key.json")))
        pg.click("#saveKey"); pg.wait_for_function("document.querySelector('#keyMsg').textContent.includes('Saved')")
        kj = open(os.path.join(DATA, "key.json")).read()
        check("saved key is encrypted (safeStorage), never in plain text", "kn_good" not in kj and '"enc"' in kj, kj[:40] + "…")
        check("key box is cleared after saving", pg.input_value("#apiKey") == "")
        pg.click("#testKey"); pg.wait_for_function("document.querySelector('#keyMsg').className.includes('ok')")
        check("Test with the box empty tests the saved key", "works" in pg.text_content("#keyMsg"))
        pg.wait_for_timeout(200); pg.screenshot(path=SH + "v11-settings.png")

        # ---------- Characters ----------
        from PIL import Image
        img = Image.new("RGB", (400, 300), (200, 90, 160)); buf = io.BytesIO(); img.save(buf, "PNG"); open("/tmp/kr-avatar.png", "wb").write(buf.getvalue())
        pg.click("#tab-characters"); pg.wait_for_selector("#view-characters:not([hidden])")
        pg.fill("#cName", "Ava"); pg.fill("#cAiId", "ABCDE"); pg.click("#cSave"); pg.wait_for_function("document.querySelector('#charMsg').className.includes('bad')")
        check("a share code instead of an AI ID is refused with a plain reason", "share code" in pg.text_content("#charMsg"))
        pg.fill("#cAiId", "  aiAlpha1\u200b "); pg.fill("#cNotes", "Loves blackjack and bluffing.")
        pg.set_input_files("#cPhotoFile", "/tmp/kr-avatar.png"); pg.wait_for_selector("#cAvPrev img")
        pg.click("#cSave"); pg.wait_for_function("document.querySelectorAll('.charcard').length === 1")
        s = json.load(open(os.path.join(DATA, "settings.json")))
        k = s["kins"][0]
        check("character saved with cleaned AI ID, notes and picture", k["ai_id"] == "aiAlpha1" and k["notes"].startswith("Loves") and k["avatar"] and os.path.exists(os.path.join(DATA, "avatars", k["cid"] + ".img")))
        check("picture shows on the card", pg.locator(".charcard .avatar img").count() == 1)
        pg.fill("#cName", "Remy"); pg.fill("#cAiId", "aiRemy22"); pg.click("#cSave"); pg.wait_for_function("document.querySelectorAll('.charcard').length === 2")
        pg.fill("#cName", "Dup"); pg.fill("#cAiId", "aiRemy22"); pg.click("#cSave"); pg.wait_for_function("document.querySelector('#charMsg').className.includes('bad')")
        check("the same AI ID twice is refused", "already uses" in pg.text_content("#charMsg"))
        pg.click(".charcard:has(h4:has-text('Remy')) button:has-text('Edit')"); pg.fill("#cName", "Remy Q"); pg.click("#cSave")
        pg.wait_for_selector(".charcard h4:has-text('Remy Q')")
        check("editing a character keeps one card", pg.locator(".charcard").count() == 2)
        pg.fill("#cName", "Temp"); pg.fill("#cAiId", "aiTemp333"); pg.click("#cSave"); pg.wait_for_function("document.querySelectorAll('.charcard').length === 3")
        pg.click(".charcard:has(h4:has-text('Temp')) button:has-text('Delete')"); pg.click("dialog[open] button:has-text('Delete')")
        pg.wait_for_function("document.querySelectorAll('.charcard').length === 2")
        check("deleting a character", "Temp" not in pg.inner_text("#charList"))
        pg.wait_for_timeout(300); pg.screenshot(path=SH + "v11-characters.png")
        check("first-run steps show done", pg.evaluate("document.querySelector('#wStepKey').classList.contains('done') && document.querySelector('#wStepKin').classList.contains('done')"))

        # ---------- drag-and-drop install in the app window ----------
        pg.click("#tab-games"); pg.wait_for_selector(".game")
        gz = base64.b64encode(open(os.path.join(ROOT, "samples", "kindroid-get-code-sample.gz"), "rb").read()).decode()
        pg.evaluate("""(b64) => { const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0)); const f = new File([bin], "checkers.gz", { type: "application/gzip" });
          const dt = new DataTransfer(); dt.items.add(f); const t = document.querySelector('#games');
          for (const n of ["dragenter", "dragover"]) t.dispatchEvent(new DragEvent(n, { dataTransfer: dt, bubbles: true, cancelable: true }));
          window.__cover = document.querySelector('#dropcover').classList.contains('on');
          t.dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true })); }""", gz)
        pg.wait_for_selector("dialog[open] h2:has-text('Checkers is ready')", timeout=15000)
        check("drop cover shows while dragging", pg.evaluate("window.__cover"))
        check("dropped .gz installed into the data folder's games/", os.path.exists(os.path.join(DATA, "games", "checkers", "kin.json")))
        pg.screenshot(path=SH + "v11-drop-installed.png")
        pg.click("dialog[open] button:has-text('Done')")
        check("built-in games are listed and can't be removed", pg.locator(".game:has(h4:has-text('Kin Casino')) button:has-text('Remove')").count() == 0 and pg.locator(".game:has(h4:has-text('Checkers')) button:has-text('Remove')").count() == 1)
        url0 = pg.url
        pg.evaluate("location.href = 'file:///etc/hostname'"); pg.wait_for_timeout(800)
        check("the window can't be navigated away (file://)", pg.url == url0, pg.url)

        # ---------- per-game Kins, and a game run asking the Kin ----------
        pg.goto(f"http://localhost:{PORT}/play/checkers"); pg.wait_for_selector("#kinBtn")
        pg.click("#kinBtn"); pg.wait_for_selector("#kinPanel:not([hidden])")
        pg.screenshot(path=SH + "v11-game-kins.png")
        remy = [x for x in json.load(open(os.path.join(DATA, "settings.json")))["kins"] if x["name"] == "Remy Q"][0]
        pg.locator(".kprow").filter(has_text="Ava").locator("input[type=checkbox]").uncheck()
        pg.locator(".kprow").filter(has_text="Remy Q").locator("input[type=radio]").check()
        pg.click("#kpSave"); pg.wait_for_function("document.querySelector('#kinBtnTxt').textContent.includes('Remy')")
        g = json.load(open(os.path.join(DATA, "settings.json")))["games"]["checkers"]
        check("per-game Kin choice saved (only Remy plays Checkers)", len(g["kins"]) == 1 and g["current"] == g["kins"][0])
        ck = [x for x in pg.frames if "/apps/checkers/" in x.url][0]
        pg.wait_for_timeout(1200)
        before = len(mocklines())
        ck.click("button:has-text('Start game')"); pg.wait_for_timeout(2500)
        gfile = os.path.join(DATA, "apps", "checkers", "files", "game.json")
        g0 = json.load(open(gfile)) if os.path.exists(gfile) else {}
        if g0.get("turn") == g0.get("me"): ck.evaluate("act('move',{path:[[5,0],[4,1]]})" if g0.get("me") == "r" else "act('take_turn',{})")
        else: ck.evaluate("act('take_turn',{})")
        t0 = time.time()
        while time.time() - t0 < 30:
            asks = [l for l in mocklines()[before:] if l["path"] == "/v1/send-message"]
            if asks: break
            time.sleep(0.5)
        pg.wait_for_timeout(1500); pg.screenshot(path=SH + "v11-checkers-kin.png")
        asks = [l for l in mocklines()[before:] if l["path"] == "/v1/send-message"]
        check("a game run inside the Windows app asks the chosen Kin (Remy) via the API", asks and all(l["ai_id"] == "aiRemy22" and l["bearer"] for l in asks), json.dumps(asks[:1])[:200])
        log = open("/tmp/kr-desk.log").read()
        check("no key in the app's log", "kn_good" not in log)
        b.close()
finally:
    for pr in procs: pr.terminate()
    subprocess.run(["pkill", "-f", "electron/dist/electron"], stderr=subprocess.DEVNULL)
print("page errors:", errors)
ok = all(results.values()) and not errors
print("DESKTOP UI", "PASS" if ok else "FAIL", f"({sum(results.values())}/{len(results)})")
sys.exit(0 if ok else 1)
