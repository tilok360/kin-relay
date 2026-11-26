# Import / Export on the Characters tab, driven in a real browser with SYNTHETIC files only (dev/fixtures and a few
# pictures drawn here). BASE=<url> tests an already running Kin Relay page (the web app); otherwise a fresh server starts.
import base64, io, json, os, shutil, subprocess, sys, time
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); FX = os.path.join(HERE, "fixtures")
SH = os.environ.get("SHOTS", "/workspace/kin-apps/shots/"); os.makedirs(SH, exist_ok=True)
TAG = os.environ.get("SHOT_TAG", "v12")
BASE = os.environ.get("BASE"); procs = []
results = {}
def check(name, ok, detail=""):
    results[name] = bool(ok); print(("PASS " if ok else "FAIL ") + name, detail, flush=True)
if not BASE:
    data = "/tmp/kgr-chars-ui"; shutil.rmtree(data, ignore_errors=True)
    procs.append(subprocess.Popen(["node", os.path.join(ROOT, "server.js")], env=dict(os.environ, KGR_PORT="47930", KGR_DATA=data, KGR_NO_OPEN="1"), stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT))
    BASE = "http://localhost:47930/"; time.sleep(1.5)

# a synthetic Kin Relay file with drawn pictures, for the screenshots
from PIL import Image, ImageDraw
def pic(c1, c2):
    im = Image.new("RGB", (128, 128)); d = ImageDraw.Draw(im)
    for y in range(128): d.line([(0, y), (128, y)], fill=tuple(int(c1[i] + (c2[i] - c1[i]) * y / 127) for i in range(3)))
    d.ellipse([40, 30, 88, 78], fill=(255, 255, 255)); d.rectangle([34, 84, 94, 128], fill=(255, 255, 255))
    b = io.BytesIO(); im.save(b, "JPEG", quality=80); return "data:image/jpeg;base64," + base64.b64encode(b.getvalue()).decode()
demo = {"format": "kin-relay-characters", "version": 1, "characters": [
    {"name": n, "ai_id": a, "share_code": "", "notes": "", "details": {"backstory": f"{n} is a made-up demo character.", "tagline": "Demo"}, "avatar": pic(c1, c2)}
    for n, a, c1, c2 in [("Mira", "demoMiraAiId0000001", (255, 150, 90), (140, 60, 200)), ("Jonas", "demoJonasAiId000002", (70, 160, 255), (30, 40, 120)), ("Pip", "demoPipAiId00000003", (90, 220, 150), (20, 100, 90)), ("Odette", "demoOdetteAiId00004", (255, 110, 150), (110, 30, 90))]]}
DEMO = "/tmp/kr-demo-characters.json"; json.dump(demo, open(DEMO, "w"))

def row_texts(pg): return pg.eval_on_selector_all("#impList .improw", "els => els.map(e => e.innerText.replace(/\\s+/g,' '))")
errors = []
try:
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        ctx = b.new_context(viewport={"width": int(os.environ.get("VW", "1100")), "height": int(os.environ.get("VH", "820"))}, accept_downloads=True)
        pg = ctx.new_page(); pg.set_default_timeout(20000)
        pg.on("pageerror", lambda e: errors.append(str(e)))
        pg.goto(BASE); pg.wait_for_selector("#tab-characters")
        if pg.locator("#view-welcome:not([hidden])").count(): pg.evaluate("location.hash = '#characters'")
        pg.click("#tab-characters"); pg.wait_for_selector("#view-characters:not([hidden])")
        check("buttons: Import and Export are on Characters", pg.locator("#importChars").is_visible() and pg.locator("#exportChars").is_visible())

        # ---- Kindroid export: picker ----
        pg.set_input_files("#importFile", os.path.join(FX, "kindroid-export.jsonl"))
        pg.wait_for_selector("#impDlg[open]")
        rows = row_texts(pg)
        check("kindroid: picker lists the 4 Kins in Kindroid's order", len(rows) == 4 and rows[0].startswith("T") and "Testa" in rows[0] and "Bruno" in rows[1], str(len(rows)))
        info = pg.inner_text("#impInfo")
        check("kindroid: summary says chats were ignored and nothing leaves", "45 chat messages" in info and "never leaves" in info and "API keys are never imported" in info, info[:160])
        check("kindroid: the API-key row is disabled with a reason", pg.locator("#impList .improw.off").count() == 1 and pg.locator("#impList .improw.off input").is_disabled() and "API key" in rows[3], rows[3][:90])
        check("kindroid: new Kins start ticked", pg.locator("#impList .improw input:checked").count() == 3)
        check("kindroid: row shows AI ID and field count", "fixtureAiOne000000001" in rows[0] and "profile fields" in rows[0])
        pg.screenshot(path=SH + f"{TAG}-import-picker-kindroid.png")
        pg.fill("#impFind", "bru"); check("picker: search narrows the list", pg.locator("#impList .improw:visible").count() == 1); pg.fill("#impFind", "")
        pg.click("#impNone"); check("picker: Select none", pg.locator("#impList .improw input:checked").count() == 0 and pg.locator("#impGo").is_disabled())
        pg.click("#impAll"); check("picker: Select all skips the row that can't import", pg.locator("#impList .improw input:checked").count() == 3)
        pg.uncheck("#impList .improw:nth-child(3) input")
        pg.click("#impGo"); pg.wait_for_selector("dialog[open] h2:has-text('Import done')")
        done = pg.inner_text("dialog[open] #dlgBody")
        check("kindroid: result says 2 added, no key imported", "2 added" in done and "No API key was imported" in done, done[:100])
        pg.click("dialog[open] button:has-text('Done')")
        names = pg.eval_on_selector_all("#charList .charcard h4", "e => e.map(x => x.textContent)")
        check("kindroid: Testa and Bruno are on Characters", names == ["Testa", "Bruno"], str(names))

        # ---- duplicates: update / skip ----
        pg.set_input_files("#importFile", os.path.join(FX, "kindroid-export.jsonl")); pg.wait_for_selector("#impDlg[open]")
        rows = row_texts(pg)
        check("duplicates: known AI IDs say Already here and start unticked", "Already here" in rows[0] and "Already here" in rows[1] and pg.locator("#impList .improw input:checked").count() == 1, str(rows[:3]))
        pg.screenshot(path=SH + f"{TAG}-import-duplicates.png")
        pg.select_option("#impList .improw:nth-child(1) select", "update")
        check("duplicates: choosing Update ticks the row", pg.locator("#impList .improw:nth-child(1) input").is_checked())
        pg.click("#impGo"); pg.wait_for_selector("dialog[open] h2:has-text('Import done')")
        done = pg.inner_text("dialog[open] #dlgBody"); check("duplicates: 1 updated and 1 added (Cleo)", "1 added" in done and "1 updated" in done, done[:80])
        pg.click("dialog[open] button:has-text('Done')")
        pg.set_input_files("#importFile", os.path.join(FX, "kindroid-export.jsonl")); pg.wait_for_selector("#impDlg[open]")
        pg.click("#impNone"); pg.select_option("#impList .improw:nth-child(2) select", "skip")
        check("duplicates: Skip leaves nothing to import", pg.locator("#impGo").is_disabled()); pg.click("#impCancel")
        check("duplicates: still 3 characters", pg.locator("#charList .charcard").count() == 3)

        # ---- profile details in the editor ----
        pg.click("#charList .charcard:first-child button:has-text('Edit')")
        pg.click("#cDetailsBox summary"); pg.wait_for_function("document.getElementById('cd_backstory').value.length > 5")
        check("editor: profile details were stored and show", "lighthouses" in pg.input_value("#cd_backstory") and pg.input_value("#cd_tagline") == "Fixture tagline")
        pg.fill("#cd_bio", "Edited bio text"); pg.click("#cSave"); pg.wait_for_function("document.querySelector('#charMsg').textContent.includes('Saved')")
        pg.click("#charList .charcard:first-child button:has-text('Edit')"); pg.click("#cDetailsBox summary")
        pg.wait_for_function("document.getElementById('cd_bio').value.length > 3")
        check("editor: an edited detail is saved", pg.input_value("#cd_bio") == "Edited bio text" and "lighthouses" in pg.input_value("#cd_backstory"))
        pg.click("#cCancel")

        # ---- Kin Relay file with pictures, then export ----
        pg.set_input_files("#importFile", DEMO); pg.wait_for_selector("#impDlg[open]")
        check("relay file: thumbnails show in the picker", pg.locator("#impList .improw img").count() == 4)
        pg.screenshot(path=SH + f"{TAG}-import-picker-pictures.png")
        pg.click("#impGo"); pg.wait_for_selector("dialog[open] h2:has-text('Import done')")
        check("relay file: pictures saved", "4 pictures saved" in pg.inner_text("dialog[open] #dlgBody"))
        pg.click("dialog[open] button:has-text('Done')"); pg.wait_for_timeout(300)
        pg.screenshot(path=SH + f"{TAG}-characters-after-import.png", full_page=True)
        check("characters list shows avatar images", pg.locator("#charList .charcard .avatar img").count() == 4)

        pg.click("#exportChars"); pg.wait_for_selector("#expDlg[open]")
        check("export: all 7 Kins are listed and ticked", pg.locator("#expList .improw").count() == 7 and pg.locator("#expList input:checked").count() == 7)
        pg.screenshot(path=SH + f"{TAG}-export-dialog.png")
        pg.click("#expNone"); pg.check("#expList .improw:nth-child(1) input"); pg.check("#expList .improw:nth-child(2) input")
        with pg.expect_download() as dl: pg.click("#expGo")
        f = dl.value; path = f.path(); doc = json.load(open(path))
        check("export: selected Kins only, in a Kin Relay file", f.suggested_filename == "kin-relay-characters.json" and doc["format"] == "kin-relay-characters" and len(doc["characters"]) == 2, f.suggested_filename)
        check("export: no API key anywhere in the file", not __import__("re").search(r"kn_[A-Za-z0-9]|api_?key", open(path).read(), __import__("re").I))
        pg.click("#exportChars"); pg.wait_for_selector("#expDlg[open]"); pg.check("input[value=studio]")
        with pg.expect_download() as dl2: pg.click("#expGo")
        sdoc = json.load(open(dl2.value.path()))
        check("export: Kin Studio file option", dl2.value.suggested_filename == "kin-studio-characters.json" and sdoc["format"] == "kin-voice-helper-v1" and len(sdoc["characters"]) == 7 and "personality" in sdoc["characters"][0])
        # round trip: empty the list, import the Kin Relay file back
        pg.click("#exportChars"); pg.wait_for_selector("#expDlg[open]")
        with pg.expect_download() as dl3: pg.click("#expGo")
        everything = dl3.value.path()
        for _ in range(7):
            pg.click("#charList .charcard:first-child button:has-text('Delete')"); pg.click("dialog[open] button:has-text('Delete')"); pg.wait_for_timeout(250)
        check("round trip: all deleted", pg.locator("#charList .charcard").count() == 0)
        pg.set_input_files("#importFile", everything); pg.wait_for_selector("#impDlg[open]")
        check("round trip: all 7 come back as New", pg.locator("#impList .badge.new").count() == 7)
        pg.click("#impGo"); pg.wait_for_selector("dialog[open] h2:has-text('Import done')"); pg.click("dialog[open] button:has-text('Done')"); pg.wait_for_timeout(300)
        check("round trip: names, pictures and details are back", pg.locator("#charList .charcard").count() == 7 and pg.locator("#charList .charcard .avatar img").count() == 4)
        pg.click("#charList .charcard:has-text('Mira') button:has-text('Edit')"); pg.click("#cDetailsBox summary"); pg.wait_for_function("document.getElementById('cd_backstory').value.length > 5")
        check("round trip: details survive", "made-up demo" in pg.input_value("#cd_backstory"))
        pg.click("#cCancel")

        # ---- files that aren't character files, and Kin Studio's file ----
        open("/tmp/kr-not-chars.json", "w").write('{"hello": 1}')
        pg.set_input_files("#importFile", "/tmp/kr-not-chars.json"); pg.wait_for_selector("dialog[open] h2:has-text('Couldn')")
        check("bad file: friendly message, nothing imported", "isn't a characters file" in pg.inner_text("dialog[open] #dlgBody") and pg.locator("#charList .charcard").count() == 7)
        pg.click("dialog[open] button:has-text('OK')")
        pg.set_input_files("#importFile", os.path.join(FX, "kin-studio-characters.json")); pg.wait_for_selector("#impDlg[open]")
        check("studio file: read as Kin Studio, both rows already here", "Kin Studio characters file" in pg.inner_text("#impInfo") and pg.locator("#impList .badge.dup").count() == 1, pg.inner_text("#impInfo")[:60])
        pg.click("#impCancel")
        check("no page errors", not errors, str(errors[:3]))
        b.close()
finally:
    for pr in procs: pr.kill()
bad = [k for k, v in results.items() if not v]
print(f"\n{len(results) - len(bad)}/{len(results)} passed"); sys.exit(1 if bad else 0)
