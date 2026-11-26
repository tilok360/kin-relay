# Regression: "Choose up to 10 Kins" was empty in Kin Hold'em for someone with 44 saved Kins. Every game must list ALL saved Kins
# (with search when there are many), inside the game itself, and the "uses credits" wording must be gone.
# Kins come in the way a person brings them: a Kindroid data export, through Import. Synthetic 44-Kin export always; the real
# private sample too when samples/character-export-sample.jsonl exists (counts only, nothing from it is printed or shown).
import gzip, io, json, os, shutil, subprocess, sys, tarfile, time
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
SH = os.environ.get("SHOTS", "/workspace/kin-apps/shots/"); os.makedirs(SH, exist_ok=True)
PRIVATE = os.path.join(ROOT, "samples", "character-export-sample.jsonl")
results = {}
PRIV = {"on": False}
def check(name, ok, detail=""):
    # the private sample: counts only, never a name or any text from it
    results[name] = bool(ok); print(("PASS " if ok else "FAIL ") + name, "" if PRIV["on"] else detail, flush=True)

def page_text(f):  # the words on the page (not the game's own script text, which the web build puts inline)
    return f.locator("body").evaluate("b => { const c = b.cloneNode(true); c.querySelectorAll('script,style').forEach(e => e.remove()); return c.textContent; }")

def synthetic_export(path, n=44):
    ids = [f"synthAiId{i:03d}xxxxxxxx"[:20] for i in range(n)]
    names = [f"Synth {chr(65 + i % 26)}{i:02d}" for i in range(n)]
    L = [{"type": "meta", "schema_version": 2}, {"type": "user", "data": {"user_name": "Test Person", "ai_list": ids}}]
    for i in range(n): L.append({"type": "entity", "entity_type": "ai", "entity_id": ids[i], "data": {"ai_id": ids[i], "ai_name": names[i], "ai_backstory": "Made-up.", "ai_memory": "Made-up."}})
    for i in range(30): L.append({"type": "chat", "data": {"text": "made-up chat line %d" % i}})
    open(path, "w").write("\n".join(json.dumps(x) for x in L) + "\n"); return names

DEMO_KIN = {"kin": 1, "name": "Kin Seats Demo", "purpose": "Test game: lists the Kins it is given.", "run": {"entry": "node main.js", "timeout": "1m"},
  "screens": [{"slot": "panel", "entry": "screen/index.html", "title": "Seats"}],
  "actions": [{"name": "wake", "description": "Lists Kins.", "input": {"type": "object", "properties": {}}, "by": ["user"], "reply": True}], "grants": ["kin:read", "files"]}
DEMO_MAIN = '''const cp = require("child_process");
const out = cp.execFileSync("kin", ["kins", "--json"]).toString();
cp.execFileSync("kin", ["files", "put", "kins.json"], { input: out });
cp.execFileSync("kin", ["end", "listed"]);
'''
DEMO_HTML = '''<!doctype html><meta charset="utf-8"><title>Seats</title><p>Bridge: <b id="fromBridge">0</b> Run: <b id="fromRun">0</b></p>
<script>
addEventListener("message", (e) => { const d = e.data || {};
  if (d.kin === "kins") document.getElementById("fromBridge").textContent = d.kins.length;
  if (d.kin === "files.read" && d.body) { try { document.getElementById("fromRun").textContent = JSON.parse(d.body).length; } catch (x) {} } });
parent.postMessage({ kin: "kins" }, "*");
setInterval(() => parent.postMessage({ kin: "files.read", path: "kins.json" }, "*"), 700);
</script>'''
def demo_gz(path):
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w") as t:
        for name, data in [("kin.json", json.dumps(DEMO_KIN)), ("main.js", DEMO_MAIN), ("screen/index.html", DEMO_HTML)]:
            b = data.encode(); ti = tarfile.TarInfo(name); ti.size = len(b); t.addfile(ti, io.BytesIO(b))
    open(path, "wb").write(gzip.compress(buf.getvalue()))

def scenario(label, export_file, expect, names, port, shots):
    PRIV["on"] = label == "private"
    data = f"/tmp/kgr-kins-{label}"; shutil.rmtree(data, ignore_errors=True)
    base = f"http://localhost:{port}/"
    relay = subprocess.Popen(["node", os.path.join(ROOT, "relay.js")], env=dict(os.environ, PORT=str(port + 100), HOST="127.0.0.1", RELAY_QUIET="1"), stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)
    srv = subprocess.Popen(["node", os.path.join(ROOT, "server.js")], env=dict(os.environ, KGR_PORT=str(port), KGR_DATA=data, KGR_NO_OPEN="1", KGR_USER_GAMES="1", KGR_BUILTIN_GAMES=os.path.join(ROOT, "games")), stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)
    time.sleep(1.8); errors = []
    try:
        with sync_playwright() as p:
            b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
            ctx = b.new_context(viewport={"width": 1000, "height": 900}); pg = ctx.new_page(); pg.set_default_timeout(25000)
            pg.on("pageerror", lambda e: errors.append(str(e)))
            pg.goto(base); pg.wait_for_selector("#tab-characters")
            token = pg.evaluate("document.querySelector('meta[name=room-token]').content")
            api = lambda path, body: pg.evaluate("async ([p,b,t]) => (await fetch(p,{method:'POST',headers:{'x-room-token':t,'content-type':'application/json'},body:JSON.stringify(b)})).json()", [path, body, token])
            # a person's way in: Import on the Characters tab
            pg.click("#tab-characters"); pg.wait_for_selector("#view-characters:not([hidden])")
            pg.set_input_files("#importFile", export_file); pg.wait_for_selector("#impDlg[open]")
            pg.wait_for_function(f"document.querySelectorAll('#impList .improw').length === {expect}")
            pg.click("#impGo"); pg.wait_for_selector("dialog[open] h2:has-text('Import done')", timeout=120000)
            pg.click("dialog[open] button:has-text('Done')")
            st = pg.evaluate("async (t) => (await fetch('/api/state',{headers:{'x-room-token':t}})).json()", token)
            check(f"{label}: {expect} Kins saved with AI IDs", len(st["settings"]["kins"]) == expect and all(k["ai_id"] for k in st["settings"]["kins"]), str(len(st["settings"]["kins"])))
            check(f"{label}: every game gets all {expect} by default", all(len(g["kins"]) == expect for g in st["games"].values()))
            pg.click("#tab-settings"); pg.fill("#relay", f"http://127.0.0.1:{port + 100}/"); pg.click("#saveRelay")
            pg.wait_for_function("document.querySelector('#relayTxt').textContent.includes('connected')", timeout=20000)
            # install a game the way a person does: drag/pick a "Get its code" file
            gz = f"/tmp/kin-seats-demo-{label}.gz"; demo_gz(gz)
            pg.click("#tab-games"); pg.wait_for_selector("#view-games:not([hidden])")
            pg.set_input_files("#pickFile", gz); pg.wait_for_selector(".game h4:has-text('Kin Seats Demo')", timeout=30000)
            # the root cause: nothing started Hold'em's run, so it had written no view (and so listed no Kins)
            r0 = api("/api/files/read", {"slug": "kin-holdem", "path": "view.json"})
            check(f"{label}: before its screen opens, Hold'em has no run (this was why its Kin list was empty)", r0.get("body") in (None, ""))

            def play(slug):
                q = ctx.new_page(); q.set_default_timeout(25000); q.on("pageerror", lambda e: errors.append(slug + ": " + str(e)))
                q.goto(base + "play/" + slug); return q, q.frame_locator("#screen")

            # even when the run never starts (blocked), the pickers still list every Kin
            q = ctx.new_page(); q.set_default_timeout(25000); q.route("**/api/open", lambda r: r.abort()); q.route("**/api/action", lambda r: r.abort()); q.goto(base + "play/kin-holdem")
            f = q.frame_locator("#screen"); f.locator("#tKins").click(); f.locator("#soloPick button[data-krname]").first.wait_for()
            check(f"{label}: Hold'em lists all {expect} even if its run can't start", f.locator("#soloPick button[data-krname]").count() == expect)
            q.close()

            # ---- Hold'em ----
            q, f = play("kin-holdem")
            check(f"{label}: the confusing top pill is gone", q.locator('.pill:has-text("labels don")').count() == 0 and q.locator('text=/Uses credits/').count() == 0)
            f.locator("#tKins").click()
            f.locator("#soloPick button[data-krname]").first.wait_for()
            check(f"{label}: Hold'em My Kins lists all {expect}", f.locator("#soloPick button[data-krname]").count() == expect, str(f.locator("#soloPick button[data-krname]").count()))
            check(f"{label}: ...with a picture or initial on each", f.locator("#soloPick button .krk-av, #soloPick button .krk-ini").count() == expect)
            check(f"{label}: ...and a search box", f.locator("#pKins .krk-search").is_visible())
            f.locator("#pKins .krk-search").fill(f.locator("#soloPick button[data-krname]").nth(7).get_attribute("data-krname")[-2:])
            vis = f.locator("#soloPick button[data-krname]:visible").count()
            check(f"{label}: search narrows the list", 1 <= vis < expect, str(vis))
            f.locator("#pKins .krk-search").fill("")
            if shots: q.screenshot(path=SH + "v121-holdem-my-kins.png")
            f.locator("#soloPick button[data-krname]").nth(2).click(); f.locator("#soloPick button[data-krname]").nth(5).click()
            f.locator("#doKins").click()
            for _ in range(40):
                v = api("/api/files/read", {"slug": "kin-holdem", "path": "view.json"}).get("body"); V = json.loads(v) if v else {}
                if V.get("table") and V["table"].get("solo"): break
                time.sleep(0.5)
            check(f"{label}: Start with my Kins opens a table with the 2 chosen", bool(V.get("table")) and len(V.get("kinIds") or []) == 2, str(V.get("kinIds") and len(V["kinIds"])))
            check(f"{label}: the run is running (not 'Not running')", "Not running" not in q.locator("#screen").content_frame.locator("#runTxt").text_content() if V.get("table") else False)
            txt = page_text(f)
            if os.environ.get("DEBUG") and not PRIV["on"]: print("   [debug]", [m.group(0) for m in __import__("re").finditer(r".{30}(Uses credits|may use (Kindroid )?credits|runs? this app on Kindroid|Kin request on your account).{30}", txt)])
            check(f"{label}: Hold'em wording has no 'uses credits' / 'on Kindroid'", not __import__("re").search(r"Uses credits|may use (Kindroid )?credits|runs? this app on Kindroid|Kin request on your account", txt))
            check(f"{label}: ...and says it uses your Kindroid API", "Uses your Kindroid API" in txt and "Kindroid Apps credits" in txt)
            q.close()
            # ---- Kin Casino ----
            q, f = play("kin-casino"); f.locator("#tKin").click(); f.locator("#soloKin button[data-krname]").first.wait_for()
            check(f"{label}: Casino with-my-Kin lists all {expect} + search", f.locator("#soloKin button[data-krname]").count() == expect and f.locator("#pKin .krk-search").is_visible())
            f.locator("#soloKin button[data-krname]").nth(3).click()
            check(f"{label}: Casino pick is marked", f.locator("#soloKin button.on").count() == 1)
            f.locator("#tHost").click(); check(f"{label}: Casino Host 'bring a Kin' lists all", f.locator("#bringH button[data-krname]").count() == expect)
            txt = page_text(f)
            check(f"{label}: Casino wording fixed", not __import__("re").search(r"Uses credits|may use (Kindroid )?credits|runs? the app on Kindroid|is a Kin request and uses", txt) and "Uses your Kindroid API" in txt)
            if shots: f.locator("#tKin").click(); q.screenshot(path=SH + "v121-casino-with-kin.png")
            q.close()

            # ---- Kin Games (both apps) ----
            for slug in ["kin-games-table-arcade", "kin-games-board-cards"]:
                q, f = play(slug); f.locator("#modeKin").click(); f.locator("#kinSel button.krk-btn").first.wait_for()
                check(f"{label}: {slug} lets you choose among all {expect} + search", f.locator("#kinSel button.krk-btn").count() == expect and f.locator("#kinSelNote ~ .krk-search, #lounge .krk-search").first.is_visible())
                f.locator("#kinSel button.krk-btn").nth(4).click()
                want = f.locator("#kinSel button.krk-btn").nth(4).evaluate("b => b.lastChild.textContent.trim()")
                check(f"{label}: {slug} shows the chosen Kin", f"Play {want}" == f.locator("#kinWho").text_content().strip(), want)
                time.sleep(1.2); q.reload(); f = q.frame_locator("#screen"); f.locator("#kinSel button.krk-btn").first.wait_for()
                f.locator("#kinWho").wait_for(); time.sleep(0.8)
                check(f"{label}: {slug} remembers it", f"Play {want}" == f.locator("#kinWho").text_content().strip())
                txt = page_text(f)
                check(f"{label}: {slug} wording fixed", "Uses Kindroid credits" not in txt and "Uses your Kindroid API" in txt)
                if shots and slug.endswith("arcade"): q.screenshot(path=SH + "v121-kin-games-pick-kin.png")
                q.close()

            # ---- an installed game ----
            q, f = play("kin-seats-demo")
            ok = False
            for _ in range(40):
                a, r = f.locator("#fromBridge").text_content(), f.locator("#fromRun").text_content()
                if a == str(expect) and r == str(expect): ok = True; break
                time.sleep(0.5)
            check(f"{label}: an installed game gets all {expect} (screen message and `kin kins` in its run)", ok, f"bridge={a} run={r}")
            q.close()

            # ---- the in-game Kins panel (top bar) ----
            q, f = play("kin-holdem"); q.click("#kinBtn"); q.wait_for_selector("#kpList .kprow")
            check(f"{label}: top-bar Kins panel lists all {expect} with search, none ticked by default", q.locator("#kpList .kprow").count() == expect and q.locator("#kpSearch").is_visible() and q.locator('#kpList input[type=checkbox]:checked').count() == 0)
            q.fill("#kpSearch", q.locator("#kpList .kprow").nth(3).get_attribute("data-name")[-2:])
            check(f"{label}: panel search narrows", 1 <= q.locator("#kpList .kprow:visible").count() < expect)
            if shots: q.screenshot(path=SH + "v121-kins-panel.png")
            q.close()
            check(f"{label}: no page errors", not errors, str(errors[:3]))
            b.close()
    finally:
        srv.terminate(); relay.terminate()

names = synthetic_export("/tmp/kr-synth-export.jsonl", 44)
scenario("synthetic44", "/tmp/kr-synth-export.jsonl", 44, names, 47931, True)
if os.path.exists(PRIVATE) and not os.environ.get("NO_PRIVATE"):
    scenario("private", PRIVATE, 44, None, 47932, False)
bad = [k for k, v in results.items() if not v]
print(f"\nKINS IN GAMES {'PASS' if not bad else 'FAIL'} ({len(results) - len(bad)}/{len(results)})")
sys.exit(1 if bad else 0)
