# Kin Relay smoke test (headless Chrome). Starts a mock Kindroid API, a Kin Relay and two Kin Relay apps (two "PCs"),
# then checks: 1) Solo plays with no network beyond this PC and no Kin asks; 2) the Kin path asks the mock API with the
# key and AI ID; 3) two copies meet at a Hold'em table through the relay and play a hand, each seeing only its own cards.
import json, os, subprocess, sys, time, shutil, urllib.request
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); RELAYJS = os.path.join(ROOT, "relay.js")
SH = os.environ.get("SHOTS", "/workspace/kin-apps/shots/"); os.makedirs(SH, exist_ok=True)
MOCKLOG = "/tmp/kgr-mock.jsonl"; RELAY = os.environ.get("KR_RELAY", "http://127.0.0.1:47820/")  # KR_RELAY=<url> tests another relay (e.g. wrangler dev)
procs = []
def start(cmd, env=None, log=None):
    e = dict(os.environ); e.update(env or {})
    procs.append(subprocess.Popen(cmd, env=e, stdout=open(log or os.devnull, "w"), stderr=subprocess.STDOUT))
def mocklines():
    try: return [json.loads(l) for l in open(MOCKLOG)]
    except FileNotFoundError: return []
results = {}
def check(name, ok, detail=""):
    results[name] = bool(ok); print(("PASS " if ok else "FAIL ") + name, detail, flush=True)

for d in ("/tmp/kgrA", "/tmp/kgrB"): shutil.rmtree(d, ignore_errors=True)
if os.path.exists(MOCKLOG): os.remove(MOCKLOG)
start(["node", os.path.join(HERE, "mock-kindroid.js")], {"MOCK_LOG": MOCKLOG, "MOCK_PORT": "47811"})
if "KR_RELAY" not in os.environ: start(["node", RELAYJS], {"PORT": "47820", "HOST": "127.0.0.1"}, "/tmp/kgr-relay.log")
for port, data in ((47900, "/tmp/kgrA"), (47901, "/tmp/kgrB")):
    start(["node", os.path.join(ROOT, "server.js")], {"KGR_PORT": str(port), "KGR_DATA": data, "KGR_NO_OPEN": "1", "KGR_API_BASE": "http://127.0.0.1:47811/v1"}, data + ".log")
time.sleep(1.5)

def setup(pg, port, name, kin, ai):
    pg.goto(f"http://localhost:{port}/"); pg.wait_for_selector("#view-welcome:not([hidden])")  # first run shows Welcome
    pg.click("#wGoKey"); pg.wait_for_selector("#view-settings:not([hidden])")
    pg.fill("#apiKey", "kn_good_test_key_0001"); pg.click("#saveKey"); pg.wait_for_function("document.querySelector('#keyMsg').textContent.includes('works')")
    pg.fill("#myName", name); pg.dispatch_event("#myName", "change"); pg.wait_for_timeout(300)
    pg.fill("#relay", RELAY); pg.click("#saveRelay")
    pg.wait_for_function("document.querySelector('#relayTxt').textContent.includes('connected')", timeout=15000)
    pg.click("#tab-characters"); pg.fill("#cName", kin); pg.fill("#cAiId", ai); pg.click("#cSave")
    pg.wait_for_function("document.querySelector('#charMsg').textContent.includes('Saved')")
    pg.click("#tab-games"); pg.wait_for_selector(".game")

errors = []
try:
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        ctxA = b.new_context(viewport={"width": 1280, "height": 860}); ctxB = b.new_context(viewport={"width": 1280, "height": 860})
        A = ctxA.new_page(); B = ctxB.new_page()
        for pg, tag in ((A, "A"), (B, "B")):
            pg.on("pageerror", lambda e, t=tag: errors.append(f"{t} pageerror: {e}"))
            pg.set_default_timeout(20000)
        setup(A, 47900, "Tilok", "Ava", "aiAlpha1"); setup(B, 47901, "Bo", "Remy", "aiBravo1")
        A.goto("http://localhost:47900/#games"); A.wait_for_timeout(600); A.screenshot(path=SH + "kr-lobby.png", full_page=True)

        # ---------- 0. Drag-and-drop install of the real "Get its code" sample ----------
        import base64
        gz = base64.b64encode(open(os.path.join(ROOT, "samples", "kindroid-get-code-sample.gz"), "rb").read()).decode()
        A.evaluate("""(b64) => { const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0)); const f = new File([bin], "checkers-get-its-code.gz", { type: "application/gzip" });
          const dt = new DataTransfer(); dt.items.add(f);
          for (const t of ["dragenter", "dragover", "drop"]) window.dispatchEvent(new DragEvent(t, { dataTransfer: dt, bubbles: true, cancelable: true })); }""", gz)
        A.wait_for_selector("dialog[open] h2:has-text('Checkers is ready')", timeout=15000)
        A.screenshot(path=SH + "kr-install-report.png")
        check("install: dropped .gz added as games/checkers", os.path.exists(os.path.join(ROOT, "games", "checkers", "engine.js")))
        A.click("dialog[open] button:has-text('Done')"); A.wait_for_timeout(300)
        check("install: Checkers listed in the lobby", A.locator(".game h4:has-text('Checkers')").count() == 1)

        # ---------- 1. Solo, offline ----------
        outside, calls = [], []
        def guard(route):
            u = route.request.url
            if u.startswith("http://localhost:4790") or u.startswith("http://127.0.0.1:4790") or u.startswith("data:") or u.startswith("blob:"): return route.continue_()
            outside.append(u); route.abort()
        A.route("**/*", guard)
        A.on("request", lambda r: calls.append(r.url) if "/api/ask" in r.url or "/api/action" in r.url else None)
        before = len(mocklines())
        A.goto("http://localhost:47900/play/kin-casino"); A.wait_for_timeout(1500)
        f = A.frame_locator("#screen"); fr = [x for x in A.frames if "/apps/kin-casino/" in x.url][0]
        f.locator("#tSolo").click(); f.locator(".t-blackjack").click(); A.wait_for_timeout(400)
        rounds, guardn = 0, 0
        while rounds < 3 and guardn < 300:
            guardn += 1
            st = fr.evaluate("(()=>{const s=App.state(); if(!s.S) return null; const r=s.S.T.round; return {phase:r.phase,no:r.no,busy:s.busy,turn:r.R&&r.R.turn}})()")
            if not st or st["busy"]: A.wait_for_timeout(80); continue
            if st["phase"] == "play" and st["turn"] == "h:me": fr.evaluate("document.querySelector('#acts button')&&0"); A.keyboard.press("s"); A.wait_for_timeout(80); continue
            if st["phase"] == "bets":
                rounds = st["no"] - 1
                if rounds >= 3: break
                el = fr.query_selector('.spot[data-s="bet"]')
                if el: el.click()
                A.keyboard.press("Enter"); A.wait_for_timeout(120); continue
            A.wait_for_timeout(80)
        A.screenshot(path=SH + "kr-casino-solo.png")
        check("solo: casino blackjack plays 3 rounds", rounds >= 3, f"rounds={rounds}")
        A.goto("http://localhost:47900/play/kin-games-table-arcade"); A.wait_for_timeout(1500)
        g = [x for x in A.frames if "/apps/kin-games-table-arcade/" in x.url][0]
        g.click("#modeSolo"); g.evaluate("KG.open('tictactoe')"); A.wait_for_timeout(700)
        for _ in range(6):
            free = g.query_selector(".ttt .sq:not(.x):not(.o)")
            if not free: break
            if "Your move" in (g.inner_text("#status") or ""): free.click()
            A.wait_for_timeout(600)
        A.screenshot(path=SH + "kr-games-solo.png")
        check("solo: tic tac toe vs computer plays", g.evaluate("document.querySelectorAll('.ttt .sq.o').length") >= 1)
        check("solo: no request left this PC", not outside, str(outside[:3]))
        check("solo: no Kin asks or app runs", not calls and len(mocklines()) == before, str(calls[:3]))
        A.unroute("**/*")

        # ---------- 2. Kin path through the (mock) Kindroid API ----------
        before = len(mocklines())
        g.click("#back") if g.is_visible("#back") else None
        A.goto("http://localhost:47900/play/kin-games-table-arcade"); A.wait_for_timeout(1500)
        g = [x for x in A.frames if "/apps/kin-games-table-arcade/" in x.url][0]
        g.click("#modeKin"); g.evaluate("KG.open('tictactoe', true)"); A.wait_for_timeout(800)
        for _ in range(8):
            if g.evaluate("document.querySelectorAll('.ttt .sq.o').length") >= 1: break
            free = g.query_selector(".ttt .sq:not(.x):not(.o)")
            if free and "Your move" in (g.inner_text("#status") or ""): free.click()
            A.wait_for_timeout(1200)
        A.wait_for_timeout(600); A.screenshot(path=SH + "kr-games-kin.png")
        new = mocklines()[before:]
        asks = [l for l in new if l["path"] == "/v1/send-message" and l["ai_id"] == "aiAlpha1"]
        check("kin: your Kin was asked through the API with your key and AI ID", asks and all(l["bearer"] for l in asks), json.dumps(asks[:1])[:300])
        check("kin: the Kin's move landed on the board", g.evaluate("document.querySelectorAll('.ttt .sq.o').length") >= 1)

        # ---------- 3. A Hold'em table between two PCs through the relay ----------
        A.goto("http://localhost:47900/play/kin-holdem"); B.goto("http://localhost:47901/play/kin-holdem"); A.wait_for_timeout(1500)
        ha = [x for x in A.frames if "/apps/kin-holdem/" in x.url][0]; hb = [x for x in B.frames if "/apps/kin-holdem/" in x.url][0]
        ha.fill("#myname", "Tilok"); ha.click("#tHost"); ha.fill("#tName", "Friday Felt"); ha.click("#doHost")
        t0 = time.time()
        while time.time() - t0 < 30 and not ((json.load(open("/tmp/kgrA/apps/kin-holdem/files/view.json")) if os.path.exists("/tmp/kgrA/apps/kin-holdem/files/view.json") else {}).get("host") or {}).get("invite"): time.sleep(0.5)
        A.wait_for_timeout(2500); ha.click("#gear"); A.wait_for_timeout(500)
        ha.wait_for_function("(()=>{const i=document.querySelector('#invite'); const v=i&&(i.value||i.textContent)||''; return v.startsWith('TABLE-')})()", timeout=30000)
        invite = ha.evaluate("(()=>{const i=document.querySelector('#invite'); return i.value||i.textContent})()").strip()
        check("table: host got an invite code", invite.startswith("TABLE-"), invite[:24] + "…")
        hb.fill("#myname", "Bo"); hb.click("#tJoin"); hb.fill("#jCode", invite); hb.click("#doJoin")
        ha.wait_for_selector("#waiting button:has-text('Admit')", timeout=40000)
        A.screenshot(path=SH + "kr-holdem-admit.png")
        ha.click("#waiting button:has-text('Admit')")
        def view(d):
            try: return json.load(open(f"{d}/apps/kin-holdem/files/view.json"))
            except Exception: return {}
        t0 = time.time()
        while time.time() - t0 < 40 and not view("/tmp/kgrB").get("joined"): time.sleep(0.5)
        check("table: guest seated through the relay", view("/tmp/kgrB").get("joined"))
        if ha.is_visible("#closeDrawer"): ha.click("#closeDrawer")
        A.wait_for_timeout(2500)
        if ha.is_visible("#dealBtn"): ha.click("#dealBtn")
        t0 = time.time()
        while time.time() - t0 < 40 and not ((view("/tmp/kgrB").get("mine") or {}).get("hole")): time.sleep(0.5)
        vA, vB = view("/tmp/kgrA"), view("/tmp/kgrB")
        holeA, holeB = (vA.get("mine") or {}).get("hole") or [], (vB.get("mine") or {}).get("hole") or []
        check("table: both players were dealt their own two cards", len(holeA) == 2 and len(holeB) == 2, f"A={holeA} B={holeB}")
        sB, sA = json.dumps(vB.get("table", {})), json.dumps(vA.get("table", {}))
        check("table: hidden cards go only to their owner", holeA and not any(f'"{c}"' in sB for c in holeA) and not any(f'"{c}"' in sA for c in holeB))
        hb.wait_for_timeout(2500); B.screenshot(path=SH + "kr-holdem-guest.png"); A.screenshot(path=SH + "kr-holdem-host.png")
        start_hand = (vA.get("table") or {}).get("handNo")
        t0, acts = time.time(), 0
        while time.time() - t0 < 120:
            vA = view("/tmp/kgrA"); T = vA.get("table") or {}
            if T.get("handNo") != start_hand or T.get("result"): break
            for fr_, pg in ((ha, A), (hb, B)):
                try:
                    if fr_.is_visible("#acts") and fr_.is_enabled("#aCall") and fr_.is_visible("#aCall"):
                        fr_.click("#aCall", timeout=2000); acts += 1; pg.wait_for_timeout(1500)
                except Exception: pass
            time.sleep(1)
        vA = view("/tmp/kgrA"); T = vA.get("table") or {}
        check("table: the hand played to the end", T.get("result") or T.get("handNo") != start_hand, f"actions={acts} street={T.get('street')} result={bool(T.get('result'))}")
        A.wait_for_timeout(1500); A.screenshot(path=SH + "kr-holdem-host-end.png"); B.screenshot(path=SH + "kr-holdem-guest-end.png")
        # ---------- 4. The dropped-in Checkers app, played with the (mock) Kin ----------
        before = len(mocklines())
        A.goto("http://localhost:47900/play/checkers"); A.wait_for_timeout(1500)
        ck = [x for x in A.frames if "/apps/checkers/" in x.url][0]
        ck.click("button:has-text('Start game')"); A.wait_for_timeout(2500)
        gfile = "/tmp/kgrA/apps/checkers/files/game.json"
        g0 = json.load(open(gfile)) if os.path.exists(gfile) else {}
        if g0.get("turn") == g0.get("me"):
            ck.evaluate("act('move',{path:[[5,0],[4,1]]})" if g0.get("me") == "r" else "act('take_turn',{})")
        else: ck.evaluate("act('take_turn',{})")
        t0 = time.time()
        while time.time() - t0 < 30:
            g1 = json.load(open(gfile)) if os.path.exists(gfile) else {}
            if (g1.get("moves") or 0) >= 2 or (g1.get("me") == "w" and (g1.get("moves") or 0) >= 1): break
            time.sleep(0.5)
        A.wait_for_timeout(1500); A.screenshot(path=SH + "kr-checkers-kin.png")
        g1 = json.load(open(gfile)) if os.path.exists(gfile) else {}
        asks = [l for l in mocklines()[before:] if l["ai_id"] == "aiAlpha1"]
        check("dropped-in app: game started and the Kin moved through the API", g1.get("moves", 0) >= 1 and asks, f"moves={g1.get('moves')} asks={len(asks)}")
        A.goto("http://localhost:47900/#games"); A.wait_for_timeout(500)
        A.click(".game:has(h4:has-text('Checkers')) button:has-text('Remove')"); A.click("dialog[open] button:has-text('Remove')"); A.wait_for_timeout(800)
        check("install: Remove takes it out of games/", not os.path.exists(os.path.join(ROOT, "games", "checkers")))
        check("relay: no Kindroid address was ever contacted", all(l["path"].startswith("/v1/") for l in mocklines()))
        b.close()
finally:
    for pr in procs: pr.terminate()
print("page errors:", errors)
ok = all(results.values()) and not errors
print("SMOKE", "PASS" if ok else "FAIL", f"({sum(results.values())}/{len(results)})")
sys.exit(0 if ok else 1)
