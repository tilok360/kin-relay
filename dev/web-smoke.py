# Kin Relay phone/web version smoke test (headless Chrome, two "phones"): the web build is served as static files, Kindroid's
# API is a mock (requests are answered through the browser's network layer, never reaching Kindroid), and the relay is the local
# relay.js (or KR_RELAY=<url> for another). Checks: Solo plays with no network; the Kin path asks the API with the key and AI ID
# straight from the page; a game .gz is added with the file picker; two phones meet at a Hold'em table through the relay.
import json, os, subprocess, sys, time, shutil, base64, urllib.request
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
SH = os.environ.get("SHOTS", "/workspace/kin-apps/shots/"); os.makedirs(SH, exist_ok=True)
TAG = os.environ.get("SHOT_TAG", "web")
MOCKLOG = "/tmp/kgr-webmock.jsonl"; RELAY = os.environ.get("KR_RELAY", "http://127.0.0.1:47821/")
WEBDIR = os.environ.get("WEB_DIST", os.path.join(ROOT, "web-dist")); WEBPORT = 47951; WEB = f"http://127.0.0.1:{WEBPORT}/"
MOCK = "http://127.0.0.1:47812"
procs = []; results = {}; errors = []
def start(cmd, env=None, cwd=None):
    e = dict(os.environ); e.update(env or {}); procs.append(subprocess.Popen(cmd, env=e, cwd=cwd, stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT))
def check(name, ok, detail=""):
    results[name] = bool(ok); print(("PASS " if ok else "FAIL ") + name, detail, flush=True)
def mocklines():
    try: return [json.loads(l) for l in open(MOCKLOG)]
    except FileNotFoundError: return []
if os.path.exists(MOCKLOG): os.remove(MOCKLOG)
start(["node", os.path.join(HERE, "mock-kindroid.js")], {"MOCK_LOG": MOCKLOG, "MOCK_PORT": "47812"})
if "KR_RELAY" not in os.environ: start(["node", os.path.join(ROOT, "relay.js")], {"PORT": "47821", "HOST": "127.0.0.1", "RELAY_QUIET": "1"})
start(["python3", "-m", "http.server", str(WEBPORT), "--bind", "127.0.0.1"], cwd=WEBDIR)
time.sleep(1.5)

def kindroid_route(route):  # answers api.kindroid.ai from the mock, with the browser's CORS rules still applied
    req = route.request; origin = req.headers.get("origin", "*")
    cors = {"access-control-allow-origin": origin, "access-control-allow-headers": "authorization,content-type", "access-control-allow-methods": "POST,GET,OPTIONS"}
    if req.method == "OPTIONS": return route.fulfill(status=204, headers=cors)
    r = route.fetch(url=MOCK + req.url.split("api.kindroid.ai")[1], method=req.method, headers={k: v for k, v in req.headers.items() if k.lower() not in ("origin", "referer")}, post_data=req.post_data)
    route.fulfill(status=r.status, headers={**cors, "content-type": r.headers.get("content-type", "text/plain")}, body=r.body())

def idb_get(pg, key):
    return pg.evaluate("""async (key) => { const db = await new Promise((r) => { const q = indexedDB.open('kin-relay'); q.onsuccess = () => r(q.result); });
      return await new Promise((r) => { const q = db.transaction('files').objectStore('files').get(key); q.onsuccess = () => r(q.result ? new TextDecoder().decode(q.result) : null); }); }""", key)
def view(pg):
    try: return json.loads(idb_get(pg, "kin-holdem|view.json") or "{}")
    except Exception: return {}
def screen(pg): return pg.query_selector("#screen").content_frame()

def setup(pg, name, kin, ai):
    pg.goto(WEB + "index.html"); pg.wait_for_selector("#view-welcome:not([hidden])")
    pg.click("#wGoKey"); pg.wait_for_selector("#view-settings:not([hidden])")
    pg.fill("#apiKey", "kn_good_test_key_0001"); pg.click("#saveKey"); pg.wait_for_function("document.querySelector('#keyMsg').textContent.includes('works')")
    pg.fill("#myName", name); pg.dispatch_event("#myName", "change"); pg.wait_for_timeout(300)
    pg.fill("#relay", RELAY); pg.click("#saveRelay")
    pg.wait_for_function("document.querySelector('#relayTxt').textContent.includes('connected')", timeout=15000)
    pg.click("#tab-characters"); pg.fill("#cName", kin); pg.fill("#cAiId", ai); pg.click("#cSave")
    pg.wait_for_function("document.querySelector('#charMsg').textContent.includes('Saved')")
    pg.click("#tab-games"); pg.wait_for_selector(".game")

try:
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        mk = lambda: b.new_context(viewport={"width": 412, "height": 860}, is_mobile=True, has_touch=True, device_scale_factor=2)
        ctxA, ctxB = mk(), mk(); A, B = ctxA.new_page(), ctxB.new_page()
        for pg, tag in ((A, "A"), (B, "B")):
            pg.on("pageerror", lambda e, t=tag: errors.append(f"{t} pageerror: {e}")); pg.set_default_timeout(25000)
            pg.route("https://api.kindroid.ai/**", kindroid_route)
        setup(A, "Tilok", "Ava", "aiAlpha1"); setup(B, "Bo", "Remy", "aiBravo1")
        check("web: lobby lists the 16 built-in games and apps", A.locator(".game").count() == 16, str(A.locator(".game").count()))
        A.screenshot(path=SH + f"{TAG}-lobby.png")
        check("web: the key check reached the (mock) Kindroid API from the page", any(l["path"] == "/v1/send-message" and l["bearer"] for l in mocklines()))

        # ---- the game .gz through the file picker ----
        A.set_input_files("#pickFile", os.path.join(ROOT, "samples", "kindroid-get-code-sample.gz"))
        A.wait_for_selector("dialog[open] h2:has-text('Checkers is ready')", timeout=20000)
        A.screenshot(path=SH + f"{TAG}-install-report.png")
        A.click("dialog[open] button:has-text('Done')"); A.wait_for_timeout(300)
        check("install: picked .gz added and listed", A.locator(".game h4:has-text('Checkers')").count() == 1)
        A.reload(); A.wait_for_selector(".game h4:has-text('Checkers')")
        check("install: it is still there after a reload (kept on the device)", A.locator(".game h4:has-text('Checkers')").count() == 1)

        # ---- Solo, with no network beyond this page ----
        outside, calls = [], []
        def guard(route):
            u = route.request.url
            if u.startswith(WEB) or u.startswith("data:") or u.startswith("blob:"): return route.continue_()
            outside.append(u); route.abort()
        A.unroute("https://api.kindroid.ai/**"); A.route("**/*", guard)
        before = len(mocklines())
        A.goto(WEB + "play.html?g=kin-casino"); A.wait_for_timeout(2000)
        fr = screen(A); fr.locator("#tSolo").click(); fr.locator(".t-blackjack").click(); A.wait_for_timeout(400)
        rounds, n = 0, 0
        while rounds < 3 and n < 300:
            n += 1
            st = fr.evaluate("(()=>{const s=App.state(); if(!s.S) return null; const r=s.S.T.round; return {phase:r.phase,no:r.no,busy:s.busy,turn:r.R&&r.R.turn}})()")
            if not st or st["busy"]: A.wait_for_timeout(80); continue
            if st["phase"] == "play" and st["turn"] == "h:me": A.keyboard.press("s"); A.wait_for_timeout(80); continue
            if st["phase"] == "bets":
                rounds = st["no"] - 1
                if rounds >= 3: break
                el = fr.query_selector('.spot[data-s="bet"]')
                if el: el.click()
                A.keyboard.press("Enter"); A.wait_for_timeout(120); continue
            A.wait_for_timeout(80)
        A.screenshot(path=SH + f"{TAG}-casino-solo.png")
        check("solo: casino blackjack plays 3 rounds in the sandboxed screen", rounds >= 3, f"rounds={rounds}")
        A.goto(WEB + "play.html?g=kin-games-table-arcade"); A.wait_for_timeout(2000)
        g = screen(A); g.click("#modeSolo"); g.evaluate("KG.open('tictactoe')"); A.wait_for_timeout(700)
        for _ in range(6):
            free = g.query_selector(".ttt .sq:not(.x):not(.o)")
            if not free: break
            if "Your move" in (g.inner_text("#status") or ""): free.click()
            A.wait_for_timeout(600)
        check("solo: tic tac toe vs computer plays", g.evaluate("document.querySelectorAll('.ttt .sq.o').length") >= 1)
        sandbox = A.get_attribute("#screen", "sandbox") or ""
        check("solo: the screen frame has no same-origin access (can't read your key)", "allow-same-origin" not in sandbox and g.evaluate("(()=>{try{return localStorage.getItem('kr.key')}catch(e){return 'blocked'}})()") in (None, "blocked"), sandbox)
        check("solo: nothing left the device", not outside, str(outside[:3]))
        check("solo: no Kin asks", len(mocklines()) == before)
        A.unroute("**/*"); A.route("https://api.kindroid.ai/**", kindroid_route)

        # ---- Kin path ----
        before = len(mocklines())
        A.goto(WEB + "play.html?g=kin-games-table-arcade"); A.wait_for_timeout(2000)
        g = screen(A); g.click("#modeKin"); g.evaluate("KG.open('tictactoe', true)"); A.wait_for_timeout(800)
        for _ in range(8):
            if g.evaluate("document.querySelectorAll('.ttt .sq.o').length") >= 1: break
            free = g.query_selector(".ttt .sq:not(.x):not(.o)")
            if free and "Your move" in (g.inner_text("#status") or ""): free.click()
            A.wait_for_timeout(1200)
        A.wait_for_timeout(600); A.screenshot(path=SH + f"{TAG}-games-kin.png")
        asks = [l for l in mocklines()[before:] if l["path"] == "/v1/send-message" and l["ai_id"] == "aiAlpha1"]
        check("kin: your Kin was asked straight from the page with your key and AI ID", asks and all(l["bearer"] for l in asks), json.dumps(asks[:1])[:200])
        check("kin: the Kin's move landed on the board", g.evaluate("document.querySelectorAll('.ttt .sq.o').length") >= 1)

        # ---- Hold'em table between two phones through the relay ----
        A.goto(WEB + "play.html?g=kin-holdem"); B.goto(WEB + "play.html?g=kin-holdem"); A.wait_for_timeout(2000)
        ha, hb = screen(A), screen(B)
        ha.fill("#myname", "Tilok"); ha.click("#tHost"); ha.fill("#tName", "Friday Felt"); ha.click("#doHost")
        t0 = time.time()
        while time.time() - t0 < 40 and not (view(A).get("host") or {}).get("invite"): time.sleep(0.5)
        A.wait_for_timeout(2500); ha.click("#gear"); A.wait_for_timeout(500)
        ha.wait_for_function("(()=>{const i=document.querySelector('#invite'); const v=i&&(i.value||i.textContent)||''; return v.startsWith('TABLE-')})()", timeout=30000)
        invite = ha.evaluate("(()=>{const i=document.querySelector('#invite'); return i.value||i.textContent})()").strip()
        check("table: host phone got an invite code (a run in a Web Worker)", invite.startswith("TABLE-"), invite[:24] + "…")
        hb.fill("#myname", "Bo"); hb.click("#tJoin"); hb.fill("#jCode", invite); hb.click("#doJoin")
        ha.wait_for_selector("#waiting button:has-text('Admit')", timeout=60000)
        A.screenshot(path=SH + f"{TAG}-holdem-admit.png"); ha.click("#waiting button:has-text('Admit')")
        t0 = time.time()
        while time.time() - t0 < 60 and not view(B).get("joined"): time.sleep(0.5)
        check("table: guest phone seated through the relay", view(B).get("joined"))
        if ha.is_visible("#closeDrawer"): ha.click("#closeDrawer")
        A.wait_for_timeout(2500)
        if ha.is_visible("#dealBtn"): ha.click("#dealBtn")
        t0 = time.time()
        while time.time() - t0 < 60 and not ((view(B).get("mine") or {}).get("hole")): time.sleep(0.5)
        vA, vB = view(A), view(B)
        holeA, holeB = (vA.get("mine") or {}).get("hole") or [], (vB.get("mine") or {}).get("hole") or []
        check("table: both phones were dealt their own two cards", len(holeA) == 2 and len(holeB) == 2, f"A={holeA} B={holeB}")
        sB, sA = json.dumps(vB.get("table", {})), json.dumps(vA.get("table", {}))
        check("table: hidden cards go only to their owner", holeA and not any(f'"{c}"' in sB for c in holeA) and not any(f'"{c}"' in sA for c in holeB))
        hb.wait_for_timeout(2500); B.screenshot(path=SH + f"{TAG}-holdem-guest.png"); A.screenshot(path=SH + f"{TAG}-holdem-host.png")
        start_hand = (vA.get("table") or {}).get("handNo"); t0, acts = time.time(), 0
        while time.time() - t0 < 150:
            T = view(A).get("table") or {}
            if T.get("handNo") != start_hand or T.get("result"): break
            for fr_, pg in ((ha, A), (hb, B)):
                try:
                    if fr_.is_visible("#acts") and fr_.is_enabled("#aCall") and fr_.is_visible("#aCall"): fr_.click("#aCall", timeout=2000); acts += 1; pg.wait_for_timeout(1500)
                except Exception: pass
            time.sleep(1)
        T = view(A).get("table") or {}
        check("table: the hand played to the end", T.get("result") or T.get("handNo") != start_hand, f"actions={acts} street={T.get('street')}")
        A.wait_for_timeout(1500); A.screenshot(path=SH + f"{TAG}-holdem-host-end.png"); B.screenshot(path=SH + f"{TAG}-holdem-guest-end.png")

        # ---- the added Checkers game: its screen, and its run (which asks the Kin and waits for the answer) ----
        before = len(mocklines())
        A.goto(WEB + "play.html?g=checkers"); A.wait_for_timeout(2000)
        ck = screen(A); ck.click("button:has-text('Start game')"); A.wait_for_timeout(3000)
        A.screenshot(path=SH + f"{TAG}-checkers.png")
        gj = json.loads(idb_get(A, "checkers|game.json") or "{}")
        check("added game: its screen opened and Start game ran its main.js in the Worker", bool(gj), str(list(gj)[:4]))
        asks = [l for l in mocklines()[before:] if l["ai_id"] == "aiAlpha1"]
        print("INFO checkers asks via sync kin ask:", len(asks), "moves:", gj.get("moves"))
        A.goto(WEB + "index.html#games"); A.wait_for_timeout(500)
        A.click(".game:has(h4:has-text('Checkers')) button:has-text('Remove')"); A.click("dialog[open] button:has-text('Remove')"); A.wait_for_timeout(800)
        check("install: Remove takes the added game out", A.locator(".game h4:has-text('Checkers')").count() == 0)
        check("no Kindroid address other than /v1 was contacted", all(l["path"].startswith("/v1/") for l in mocklines()))
        b.close()
finally:
    for pr in procs: pr.terminate()
print("page errors:", errors)
ok = all(results.values()) and not errors
print("WEB SMOKE", "PASS" if ok else "FAIL", f"({sum(results.values())}/{len(results)})")
sys.exit(0 if ok else 1)
