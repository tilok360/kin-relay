# The phone/web app with 44 Kins imported from a Kindroid-format export (synthetic): Hold'em, Casino, Kin Games and an installed game
# list every Kin, with search, and the "uses credits" wording is gone. The private sample is used too when present (counts only).
import os, re, subprocess, sys, time
sys.argv = [sys.argv[0]]
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
src = open(os.path.join(HERE, "kins-in-games.test.py")).read().split("def scenario(")[0]
exec(compile(src.replace("__file__", repr(os.path.join(HERE, "kins-in-games.test.py"))), "kins-in-games", "exec"))
WEBDIR = os.environ.get("WEB_DIST", os.path.join(ROOT, "web-dist")); PORT = 47953; WEB = f"http://127.0.0.1:{PORT}/"
srv = subprocess.Popen(["python3", "-m", "http.server", str(PORT), "--bind", "127.0.0.1"], cwd=WEBDIR, stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT); time.sleep(1)
def run(label, export_file, expect):
    PRIV["on"] = label == "private"; errors = []
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        ctx = b.new_context(viewport={"width": 420, "height": 900}, is_mobile=True, has_touch=True); pg = ctx.new_page(); pg.set_default_timeout(30000)
        pg.on("pageerror", lambda e: errors.append(str(e)))
        pg.goto(WEB + "index.html"); pg.wait_for_selector("#tab-characters")
        pg.evaluate("location.hash='#characters'"); pg.wait_for_selector("#view-characters:not([hidden])")
        pg.set_input_files("#importFile", export_file); pg.wait_for_selector("#impDlg[open]"); pg.wait_for_function(f"document.querySelectorAll('#impList .improw').length === {expect}")
        pg.click("#impGo"); pg.wait_for_selector("dialog[open] h2:has-text('Import done')", timeout=120000); pg.click("dialog[open] button:has-text('Done')")
        gz = f"/tmp/kin-seats-demo-web-{label}.gz"; demo_gz(gz)
        pg.evaluate("location.hash='#games'"); pg.wait_for_selector("#view-games:not([hidden])")
        pg.set_input_files("#pickFile", gz); pg.wait_for_selector(".game h4:has-text('Kin Seats Demo')", timeout=40000)
        def play(slug):
            q = ctx.new_page(); q.set_default_timeout(30000); q.on("pageerror", lambda e: errors.append(slug + ": " + str(e))); q.goto(WEB + "play.html?g=" + slug); return q, q.frame_locator("#screen")
        q, f = play("kin-holdem"); f.locator("#tKins").click(); f.locator("#soloPick button[data-krname]").first.wait_for()
        check(f"web {label}: Hold'em My Kins lists all {expect} + search", f.locator("#soloPick button[data-krname]").count() == expect and f.locator("#pKins .krk-search").is_visible())
        txt = page_text(f)
        check(f"web {label}: Hold'em wording fixed", not re.search(r"Uses credits|may use (Kindroid )?credits|runs? this app on Kindroid", txt) and "Uses your Kindroid API" in txt)
        if label == "synthetic44": q.screenshot(path=SH + "v121-web-holdem-my-kins.png")
        q.close()
        q, f = play("kin-casino"); f.locator("#tKin").click(); f.locator("#soloKin button[data-krname]").first.wait_for()
        check(f"web {label}: Casino lists all {expect} + search", f.locator("#soloKin button[data-krname]").count() == expect and f.locator("#pKin .krk-search").is_visible()); q.close()
        for slug in ["kin-games-table-arcade", "kin-games-board-cards"]:
            q, f = play(slug); f.locator("#modeKin").click(); f.locator("#kinSel button.krk-btn").first.wait_for()
            check(f"web {label}: {slug} chooser lists all {expect}", f.locator("#kinSel button.krk-btn").count() == expect); q.close()
        q, f = play("kin-seats-demo"); ok = False
        for _ in range(40):
            a, r = f.locator("#fromBridge").text_content(), f.locator("#fromRun").text_content()
            if a == str(expect) and r == str(expect): ok = True; break
            time.sleep(0.5)
        check(f"web {label}: installed game gets all {expect} (message and `kin kins` in its worker run)", ok, f"bridge={a} run={r}"); q.close()
        check(f"web {label}: no page errors", not errors, str(errors[:3])); b.close()
try:
    names = synthetic_export("/tmp/kr-synth-export.jsonl", 44)
    run("synthetic44", "/tmp/kr-synth-export.jsonl", 44)
    if os.path.exists(PRIVATE) and not os.environ.get("NO_PRIVATE"): run("private", PRIVATE, 44)
finally: srv.terminate()
bad = [k for k, v in results.items() if not v]
print(f"\nWEB KINS {'PASS' if not bad else 'FAIL'} ({len(results) - len(bad)}/{len(results)})"); sys.exit(1 if bad else 0)
