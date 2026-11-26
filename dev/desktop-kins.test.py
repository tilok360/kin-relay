# The real Electron app (staged build, under xvfb) with 44 Kins imported from a Kindroid-format export (synthetic): opening Kin Hold'em
# starts its run inside the app, its My Kins list shows all 44 with search, and Start with my Kins opens a table.
import json, os, re, subprocess, sys, time, shutil, urllib.request
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
exec(open(os.path.join(HERE, "kins-in-games.test.py")).read().split("def scenario(")[0].replace("__file__", repr(os.path.join(HERE, "kins-in-games.test.py"))))
DESK = os.path.join(ROOT, "desktop"); STAGE = os.path.join(DESK, ".stage"); ELECTRON = os.path.join(DESK, "node_modules", "electron", "dist", "electron")
DATA = "/tmp/kr-desk-kins"; PORT = 47936; CDP = 9336; RELAY = 47937
subprocess.run(["pkill", "-f", "electron/dist/electron"], stderr=subprocess.DEVNULL); time.sleep(1); shutil.rmtree(DATA, ignore_errors=True)
subprocess.run(["node", os.path.join(DESK, "build.js"), "stage"], check=True, stdout=subprocess.DEVNULL)
names = synthetic_export("/tmp/kr-synth-export.jsonl", 44)
env = dict(os.environ, KGR_DATA=DATA, KGR_PORT=str(PORT), KGR_TEST_VAULT="1")
procs = [subprocess.Popen(["node", os.path.join(ROOT, "relay.js")], env=dict(os.environ, PORT=str(RELAY), HOST="127.0.0.1", RELAY_QUIET="1"), stdout=subprocess.DEVNULL),
         subprocess.Popen(["xvfb-run", "-a", "-s", "-screen 0 1400x950x24", ELECTRON, STAGE, "--no-sandbox", f"--remote-debugging-port={CDP}"], env=env, stdout=open("/tmp/kr-desk-kins.log", "w"), stderr=subprocess.STDOUT)]
errors = []
try:
    for _ in range(60):
        try: urllib.request.urlopen(f"http://127.0.0.1:{CDP}/json/version", timeout=1); break
        except Exception: time.sleep(0.5)
    with sync_playwright() as p:
        b = p.chromium.connect_over_cdp(f"http://127.0.0.1:{CDP}"); pg = None
        for _ in range(40):
            pages = [x for c in b.contexts for x in c.pages if f":{PORT}" in x.url]
            if pages: pg = pages[0]; break
            time.sleep(0.25)
        pg.set_default_timeout(30000); pg.on("pageerror", lambda e: errors.append(str(e)))
        pg.wait_for_selector("#tab-characters"); pg.click("#tab-characters"); pg.wait_for_selector("#view-characters:not([hidden])")
        pg.set_input_files("#importFile", "/tmp/kr-synth-export.jsonl"); pg.wait_for_selector("#impDlg[open]"); pg.wait_for_function("document.querySelectorAll('#impList .improw').length === 44")
        pg.click("#impGo"); pg.wait_for_selector("dialog[open] h2:has-text('Import done')", timeout=120000); pg.click("dialog[open] button:has-text('Done')")
        pg.click("#tab-settings"); pg.fill("#relay", f"http://127.0.0.1:{RELAY}/"); pg.click("#saveRelay")
        pg.wait_for_function("document.querySelector('#relayTxt').textContent.includes('connected')", timeout=20000)
        pg.goto(f"http://localhost:{PORT}/play/kin-holdem"); f = pg.frame_locator("#screen")
        f.locator("#tKins").click(); f.locator("#soloPick button[data-krname]").first.wait_for()
        check("electron app: Hold'em My Kins lists all 44 + search", f.locator("#soloPick button[data-krname]").count() == 44 and f.locator("#pKins .krk-search").is_visible())
        up = False
        for _ in range(30):
            if "Running" in f.locator("#runTxt0").text_content() or "Running" in f.locator("#runTxt").text_content(): up = True; break
            time.sleep(0.5)
        check("electron app: the Hold'em run started by itself (Running, no Start press needed)", up)
        f.locator("#soloPick button[data-krname]").nth(1).click(); f.locator("#soloPick button[data-krname]").nth(9).click(); f.locator("#doKins").click()
        ok = False
        for _ in range(40):
            if f.locator("#seats .seat, .seat").count() >= 3: ok = True; break
            time.sleep(0.5)
        check("electron app: Start with my Kins seats the 2 Kins at a table", ok)
        txt = page_text(f)
        check("electron app: no 'uses credits' wording in Hold'em", not re.search(r"Uses credits|may use (Kindroid )?credits|runs? this app on Kindroid", txt) and "Kindroid Apps credits" in txt)
        pg.screenshot(path=SH + "v121-electron-holdem.png")
        check("electron app: no page errors", not errors, str(errors[:3]))
finally:
    for pr in procs:
        try: pr.terminate()
        except Exception: pass
    subprocess.run(["pkill", "-f", "electron/dist/electron"], stderr=subprocess.DEVNULL)
bad = [k for k, v in results.items() if not v]
print(f"\nELECTRON KINS {'PASS' if not bad else 'FAIL'} ({len(results) - len(bad)}/{len(results)})"); sys.exit(1 if bad else 0)
