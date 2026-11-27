# Regression: "chat in Kin Relay not working". At a Kin Hold'em table (solo with my Kins and hosted between two PCs) and at a Kin Casino
# table, anyone's chat line (a person's or a Kin's) must be answered by the Kins through the Kindroid API, shown in Chat with "X is typing…",
# with a clear message when the key is missing/wrong or the request fails, never more than 3 Kin lines in a row, never past Kindroid's
# limit of 10 requests per 30 seconds, and a person's name (from Settings / the Kindroid export), not "Host".
# Everything runs against a mock of api.kindroid.ai (dev/mock-kindroid.js); Kins come in through Import (synthetic Kindroid export).
import json, os, re, shutil, subprocess, sys, time
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
SH = os.environ.get("SHOTS", "/workspace/kin-apps/shots/"); os.makedirs(SH, exist_ok=True)
LOG, CTRL = "/tmp/kgr-chat-mock.jsonl", "/tmp/kgr-chat-ctrl.json"
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

for d in ("/tmp/kgrChatA", "/tmp/kgrChatB"): shutil.rmtree(d, ignore_errors=True)
for f in (LOG, CTRL):
    if os.path.exists(f): os.remove(f)
start(["node", os.path.join(HERE, "mock-kindroid.js")], {"MOCK_LOG": LOG, "MOCK_PORT": "47812", "MOCK_CTRL": CTRL})
start(["node", os.path.join(ROOT, "relay.js")], {"PORT": "47822", "HOST": "127.0.0.1", "RELAY_QUIET": "1"})
for port, data in ((47940, "/tmp/kgrChatA"), (47941, "/tmp/kgrChatB")):
    start(["node", os.path.join(ROOT, "server.js")], {"KGR_PORT": str(port), "KGR_DATA": data, "KGR_NO_OPEN": "1", "KGR_API_BASE": "http://127.0.0.1:47812/v1"}, data + ".log")
time.sleep(1.8)
RELAY = "http://127.0.0.1:47822/"
NAMES_A = ["Crikey", 'Earl "Gator" Vance', "Darken Rahl", "Panis Rahl"]; IDS_A = [f"chatAiIdA{i:02d}xxxxxxxx"[:20] for i in range(4)]
NAMES_B = ["Remy Fox"]; IDS_B = ["chatAiIdB00xxxxxxxx"]
export_file("/tmp/kr-chat-A.jsonl", NAMES_A, IDS_A); export_file("/tmp/kr-chat-B.jsonl", NAMES_B, IDS_B, "Bo Tester")
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

try:
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        ctxA = b.new_context(viewport={"width": 1100, "height": 860}); ctxB = b.new_context(viewport={"width": 1100, "height": 860})
        A, tokA = setup(ctxA, 47940, KEY_A, "/tmp/kr-chat-A.jsonl", 4)
        st = A.evaluate("async (t) => (await fetch('/api/state',{headers:{'x-room-token':t}})).json()", tokA)
        check("name: the persona in a Kindroid export becomes your name at tables (not 'Host')", st["settings"]["name"] == "Casey Tester", "")

        # ======================= Kin Hold'em: solo with my Kins =======================
        ctrl(delayMs=4500)
        A.goto("http://localhost:47940/play/kin-holdem"); f = A.frame_locator("#screen")
        f.locator("#tKins").click(); f.locator("#soloPick button[data-krname]").first.wait_for()
        check("holdem: your name field is filled from Settings", f.locator("#myname").input_value() == "Casey Tester", "")
        for nm in ("Crikey", "Gator", "Darken"): f.locator(f'#soloPick button:has-text("{nm}")').click()
        f.locator("#doKins").click()
        V = wait(lambda: (lambda v: v if (v.get("table") or {}).get("solo") and len(v["table"]["seats"]) >= 4 else None)(view("/tmp/kgrChatA", "kin-holdem")), 40)
        check("holdem: table open with 3 Kins seated", bool(V))
        people = [x["name"] for x in V["table"]["people"]]; hseat = [s["name"] for s in V["table"]["seats"] if s["kind"] == "person"]
        check("holdem: you are 'Casey Tester', not 'Host'", people[0] == "Casey Tester" and hseat == ["Casey Tester"], str(people))
        A.click("#bChat") if A.locator("#bChat").count() else None
        f.locator("#bChat").click(); f.locator("#say").wait_for()
        txt0 = f.locator("body").evaluate("b => b.innerText")
        check("holdem: Kins are labelled 'Your Kin' (no \"Host's Kin\")", "Host's Kin" not in txt0 and "Your Kin" in txt0)
        n0 = len(mock()); say(f, "who is going to win")
        typing = False; t0 = time.time()
        while time.time() - t0 < 40:
            if f.locator(".msg.typing").count(): typing = True; break
            time.sleep(0.4)
        check("holdem: 'is typing…' shows while a Kin is being asked", typing, f.locator(".msg.typing").first.inner_text() if typing else "")
        shot_typing = SH + "v122-holdem-typing.png"
        if typing: A.screenshot(path=shot_typing)
        got = wait(lambda: [m for m in chat_of("/tmp/kgrChatA", "kin-holdem") if m["kind"] == "kin"], 60)
        check("holdem: a Kin answered a message with no @ in it", bool(got), "")
        two = wait(lambda: len([m for m in chat_of("/tmp/kgrChatA", "kin-holdem") if m["kind"] == "kin"]) >= 2, 60)
        kc = [m for m in chat_of("/tmp/kgrChatA", "kin-holdem") if m["kind"] == "kin"]
        check("holdem: a second Kin joins in, answering the first (Kin-to-Kin)", two and kc[1]["who"] != kc[0]["who"] and kc[0]["who"] in kc[1]["text"], "")
        check("holdem: the Kin saw the person's words and name", got and "Casey Tester" in got[0]["text"] and "who is going to win" in got[0]["text"], "")
        time.sleep(12)
        ch = chat_of("/tmp/kgrChatA", "kin-holdem"); kin_n = len([m for m in ch if m["kind"] == "kin"])
        check("holdem: the chat stops by itself after 2 Kin lines (no endless loop)", kin_n == 2 and runs_of_kin(ch) <= 3, f"kin lines={kin_n}")
        txt = f.locator("#pBody").inner_text()
        check("holdem: replies appear in the Chat tab", kc[0]["text"][:25] in txt and kc[0]["who"] in txt)
        A.screenshot(path=SH + "v122-holdem-chat.png")
        # addressed first
        ctrl(delayMs=300); say(f, "@Darken Rahl what is your read?")
        new = wait(lambda: [m for m in chat_of("/tmp/kgrChatA", "kin-holdem") if m["kind"] == "kin"][2:], 40)
        check("holdem: @Name is answered by that Kin first", bool(new) and new[0]["who"] == "Darken Rahl", new[0]["who"] if new else "")
        say(f, 'Earl, you sly dog')  # first name, spoken to
        new = wait(lambda: [m for m in chat_of("/tmp/kgrChatA", "kin-holdem") if m["kind"] == "kin" and m["who"] == 'Earl "Gator" Vance'], 40)
        check("holdem: 'Earl, ...' (first name) reaches Earl \"Gator\" Vance", bool(new))
        ids_asked = {l["ai_id"] for l in mock() if l.get("ai_id")}
        check("holdem: each Kin spoke through its own AI ID with the owner's key", {IDS_A[0], IDS_A[1], IDS_A[2]} <= ids_asked and all(l.get("bearer") for l in mock() if l.get("ai_id")))
        # OOC never reaches a Kin
        time.sleep(8); nreq = len(mock()); nkin = len([m for m in chat_of("/tmp/kgrChatA", "kin-holdem") if m["kind"] == "kin"])
        f.locator('#ptabs button[data-t="ooc"]').click(); say(f, "ooc: just people here"); time.sleep(8)
        check("holdem: OOC chat is never shown to a Kin (no request, no Kin line)", len(mock()) == nreq and len([m for m in chat_of("/tmp/kgrChatA", "kin-holdem") if m["kind"] == "kin"]) == nkin)
        f.locator('#ptabs button[data-t="chat"]').click()
        # a failing request is never silent
        ctrl(status=500); say(f, "@Crikey are you there?")
        e1 = wait(lambda: [m for m in chat_of("/tmp/kgrChatA", "kin-holdem") if m["kind"] == "dealer" and "couldn't reply" in m["text"]], 40)
        check("holdem: when Kindroid fails the chat says so (Crikey couldn't reply: ...)", bool(e1), e1[-1]["text"][:90] if e1 else "")
        ctrl(); api(A, tokA, "/api/key", {"clear": True}); time.sleep(65); say(f, "@Panis Rahl no key now?")  # a minute later: the same kind of problem would be reported again
        e2 = wait(lambda: [m for m in chat_of("/tmp/kgrChatA", "kin-holdem") if m["kind"] == "dealer" and "API key" in m["text"]], 40)
        check("holdem: with no API key the chat says to add it in Settings", bool(e2), e2[-1]["text"][:100] if e2 else "")
        A.screenshot(path=SH + "v122-holdem-no-key.png")
        api(A, tokA, "/api/key", {"apiKey": KEY_A}); ctrl(status=401); time.sleep(1)  # Kindroid answers 401: the key is wrong
        say(f, "@Crikey try the wrong key")
        e3 = wait(lambda: [m for m in chat_of("/tmp/kgrChatA", "kin-holdem") if m["kind"] == "dealer" and "did not accept" in m["text"]], 40)
        check("holdem: a wrong key is reported as not accepted", bool(e3), e3[-1]["text"][:100] if e3 else "")
        ctrl(); api(A, tokA, "/api/key", {"apiKey": KEY_A})

        # ======================= Kin Casino: solo with my Kin =======================
        ctrl(delayMs=3500)
        A.goto("http://localhost:47940/play/kin-casino"); f = A.frame_locator("#screen")
        f.locator("#tKin").click(); f.locator("#soloKin button[data-krname]").first.wait_for()
        f.locator('#soloKin button:has-text("Crikey")').click(); f.locator(".tile").first.click()
        f.locator("#bChat").wait_for(); f.locator("#bChat").click(); f.locator("#say").wait_for()
        say(f, "nice table, who is winning?")
        typing = False; t0 = time.time()
        while time.time() - t0 < 30:
            if f.locator("#pBody .msg.typing").count(): typing = True; break
            time.sleep(0.3)
        check("casino: 'is typing…' shows while your Kin is asked", typing)
        ok = wait(lambda: f.locator("#pBody .msg.kin:not(.typing)").count() >= 1 and f.locator("#pBody .msg.kin:not(.typing)").last.inner_text(), 40)
        check("casino: your Kin answers in Chat (solo with my Kin)", bool(ok) and "Crikey" in ok or bool(ok), (ok or "")[:60])
        A.screenshot(path=SH + "v122-casino-chat.png")
        api(A, tokA, "/api/key", {"clear": True}); say(f, "can you hear me?")
        e = wait(lambda: f.locator("#pBody .msg.dealer").count() and f.locator("#pBody .msg.dealer").last.inner_text(), 30)
        check("casino: with no key the chat says why (Add your Kindroid API key in Settings)", bool(e) and "API key" in e, (e or "")[:100])
        api(A, tokA, "/api/key", {"apiKey": KEY_A}); ctrl()

        # ============ Two PCs: a hosted Kin Hold'em table, each Kin speaking through its owner's key ============
        B, tokB = setup(ctxB, 47941, KEY_B, "/tmp/kr-chat-B.jsonl", 1)
        for d in ("/tmp/kgrChatA",): pass
        A.goto("http://localhost:47940/play/kin-holdem"); B.goto("http://localhost:47941/play/kin-holdem")
        ha, hb = A.frame_locator("#screen"), B.frame_locator("#screen")
        ha.locator("#game").wait_for(state="attached"); time.sleep(2.5)
        if ha.locator("#back").is_visible(): ha.locator("#back").click(); time.sleep(0.4); ha.locator("#back").click()  # the first tap arms "Leave?"
        wait(lambda: view("/tmp/kgrChatA", "kin-holdem").get("mode") == "off", 40)
        ha.locator("#tHost").click(); ha.locator("#bring button[data-krname]").first.wait_for(); ha.locator('#bring button:has-text("Crikey")').click()
        ha.locator("#tName").fill("Chat Night"); ha.locator("#doHost").click()
        wait(lambda: (view("/tmp/kgrChatA", "kin-holdem").get("host") or {}).get("invite"), 40)
        ha.locator("#gear").click(); ha.locator("#invite").wait_for(); invite = (ha.locator("#invite").input_value() if ha.locator("textarea#invite, input#invite").count() else ha.locator("#invite").inner_text()).strip()
        check("hosted: host has an invite code", invite.startswith("TABLE-"))
        hb.locator("#tJoin").click(); hb.locator("#bring button[data-krname]").first.wait_for(); hb.locator('#bring button:has-text("Remy")').click()
        hb.locator("#jCode").fill(invite); hb.locator("#doJoin").click()
        ha.locator("#waiting button:has-text('Admit')").wait_for(timeout=50000); ha.locator("#waiting button:has-text('Admit')").click()
        ok = wait(lambda: view("/tmp/kgrChatB", "kin-holdem").get("joined"), 60)
        check("hosted: the guest is seated with their own Kin", bool(ok))
        if ha.locator("#closeDrawer").is_visible(): ha.locator("#closeDrawer").click()
        ha.locator("#bChat").click(); hb.locator("#bChat").click(); hb.locator("#say").wait_for()
        nA = len(mock()); ctrl(delayMs=1200)
        say(ha, "@Remy what do you think of this table?")
        got = wait(lambda: [m for m in chat_of("/tmp/kgrChatA", "kin-holdem") if m["kind"] == "kin" and m["who"] == "Remy Fox"], 90)
        check("hosted: the guest's Kin (on the guest's PC) answers the host's @mention", bool(got), "")
        bl = [l for l in mock()[nA:] if l.get("ai_id") == IDS_B[0]]
        check("hosted: that request used the GUEST's key and the guest's Kin AI ID", bool(bl) and all(l["tag"] == "B" for l in bl))
        seen_b = wait(lambda: [m for m in chat_of("/tmp/kgrChatB", "kin-holdem") if m["kind"] == "kin" and m["who"] == "Remy Fox"], 60)
        check("hosted: the guest sees their Kin's line in their own Chat", bool(seen_b))
        say(hb, "@Crikey and what about you?")
        got = wait(lambda: [m for m in chat_of("/tmp/kgrChatB", "kin-holdem") if m["kind"] == "kin" and m["who"] == "Crikey"], 90)
        al = [l for l in mock() if l.get("ai_id") == IDS_A[0] and l["tag"] == "A"]
        check("hosted: the guest's @mention reaches the host's Kin, answered with the HOST's key", bool(got) and bool(al))
        hb.locator("#pBody").inner_text(); B.screenshot(path=SH + "v122-hosted-guest-chat.png")
        time.sleep(15)
        for d in ("/tmp/kgrChatA", "/tmp/kgrChatB"):
            check(f"hosted: no more than 3 Kin lines in a row ({d[-1]})", runs_of_kin(chat_of(d, "kin-holdem")) <= 3, str(runs_of_kin(chat_of(d, "kin-holdem"))))

        # ============ Kin Casino hosted: a guest's Kin answers on the guest's PC ============
        A.goto("http://localhost:47940/play/kin-casino"); B.goto("http://localhost:47941/play/kin-casino")
        ca, cb = A.frame_locator("#screen"), B.frame_locator("#screen")
        ca.locator("#tHost").click(); ca.locator("#bringH button[data-krname]").first.wait_for(); ca.locator('#bringH button:has-text("Crikey")').click()
        ca.locator("#tName").fill("Casino Night"); ca.locator(".tile").first.click()
        inv = wait(lambda: (view("/tmp/kgrChatA", "kin-casino").get("host") or {}).get("invite"), 50)
        check("casino hosted: host has an invite code", bool(inv))
        cb.locator("#tJoin").click(); cb.locator("#bringJ button[data-krname]").first.wait_for(); cb.locator('#bringJ button:has-text("Remy")').click()
        cb.locator("#jCode").fill(inv); cb.locator("#doJoin").click()
        ca.locator("#gear").click(); ca.locator("button:has-text('Admit')").wait_for(timeout=50000); ca.locator("button:has-text('Admit')").click()
        ok = wait(lambda: view("/tmp/kgrChatB", "kin-casino").get("joined"), 60)
        check("casino hosted: the guest is seated with their own Kin", bool(ok))
        if ca.locator("#closeDrawer").is_visible(): ca.locator("#closeDrawer").click()
        ca.locator("#bChat").click(); cb.locator("#bChat").click()
        nA = len(mock()); ctrl(delayMs=1200)
        say(ca, "@Remy fancy a spin?")
        got = wait(lambda: [m for m in chat_of("/tmp/kgrChatA", "kin-casino") if m["kind"] == "kin" and m["who"] == "Remy Fox"], 90)
        bl = [l for l in mock()[nA:] if l.get("ai_id") == IDS_B[0]]
        check("casino hosted: the guest's Kin answers the host's @mention, with the guest's key", bool(got) and bool(bl) and all(l["tag"] == "B" for l in bl))
        n_before = len([m for m in chat_of("/tmp/kgrChatB", "kin-casino") if m["kind"] == "kin"])
        say(cb, "hello table")
        got = wait(lambda: len([m for m in chat_of("/tmp/kgrChatB", "kin-casino") if m["kind"] == "kin"]) > n_before, 90)
        check("casino hosted: any message (no @) gets a Kin reply too", bool(got))
        B.screenshot(path=SH + "v122-casino-hosted-guest.png")

        # ============ pacing: nothing above ever went past Kindroid's limit ============
        L = mock(); ts = sorted(l["t"] for l in L if l.get("path") == "/v1/send-message" and l.get("status") != 429)
        tg = {l["t"]: l.get("tag") for l in L if l.get("t")}
        worst = max((sum(1 for u in ts if t <= u < t + 30000 and tg.get(u) == tg.get(t)) for t in ts), default=0)  # per API key (each PC has its own)
        check("limit: no request was refused for rate limiting (429)", not any(l.get("status") == 429 for l in L))
        check("limit: never more than 9 requests in any 30 seconds", worst <= 9, f"worst={worst}")
        check("no page errors", not errors, str(errors[:3]))
        b.close()
finally:
    for p_ in procs: p_.terminate()
bad = [k for k, v in results.items() if not v]
print(f"\nTABLE CHAT {'PASS' if not bad else 'FAIL'} ({len(results) - len(bad)}/{len(results)})")
sys.exit(1 if bad else 0)
