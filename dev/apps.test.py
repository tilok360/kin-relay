# Opens every app that comes with Kin Relay in headless Chrome and checks it loads its screen without page errors and
# shows something. Prints one line per app. Uses a mock Kindroid API (no real key).
import json, os, subprocess, sys, time, shutil
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
SH = os.environ.get("SHOTS", "/workspace/kin-apps/shots/"); os.makedirs(SH, exist_ok=True)
procs = []
def start(cmd, env=None, log=None):
    e = dict(os.environ); e.update(env or {}); procs.append(subprocess.Popen(cmd, env=e, stdout=open(log or os.devnull, "w"), stderr=subprocess.STDOUT))
shutil.rmtree("/tmp/kgrApps", ignore_errors=True)
start(["node", os.path.join(HERE, "mock-kindroid.js")], {"MOCK_LOG": "/tmp/kgr-mock-apps.jsonl", "MOCK_PORT": "47811"})
start(["node", os.path.join(ROOT, "server.js")], {"KGR_PORT": "47960", "KGR_DATA": "/tmp/kgrApps", "KGR_NO_OPEN": "1", "KGR_API_BASE": "http://127.0.0.1:47811/v1"}, "/tmp/kgrApps.log")
time.sleep(1.5)
res = {}
def check(n, ok, d=""): res[n] = bool(ok); print(("PASS " if ok else "FAIL ") + n, d, flush=True)
try:
    from lib_names import BUNDLED
except Exception:
    BUNDLED = json.loads(subprocess.check_output(["node", "-e", "console.log(JSON.stringify(require('./lib/bundled.js')))"], cwd=ROOT))
try:
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        pg = b.new_context(viewport={"width": 1100, "height": 800}).new_page(); pg.set_default_timeout(20000)
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto("http://localhost:47960/"); pg.wait_for_selector(".game", state="attached")
        n = pg.locator(".game").count(); check("lobby lists every bundled app", n == len(BUNDLED), f"{n}/{len(BUNDLED)}")
        for slug in BUNDLED:
            errs.clear()
            pg.goto(f"http://localhost:47960/play/{slug}"); pg.wait_for_timeout(2500)
            fr = [x for x in pg.frames if f"/apps/{slug}/" in x.url]
            body = ""
            if fr:
                try: body = fr[0].evaluate("document.body && document.body.innerText || ''")
                except Exception as e: body = ""
            check(f"{slug}: screen opens and shows content", bool(fr) and len(body.strip()) > 20, f"{len(body.strip())} chars")
            check(f"{slug}: no page errors", not errs, "; ".join(errs)[:200])
            pg.screenshot(path=SH + f"v130-app-{slug}.png")
finally:
    for pr in procs: pr.kill()
bad = [k for k, v in res.items() if not v]
print(f"APPS {'PASS' if not bad else 'FAIL'} ({len(res)-len(bad)}/{len(res)})")
sys.exit(1 if bad else 0)
