KIN RELAY
=========
Play your Kindroid games on your own PC, add any Kindroid app by dragging it in, and host tables for friends.
No Kindroid Apps credits are used by anything in this folder.        Made by tilok360. Play chips only.

GET IT (WINDOWS, EASIEST)
   1) Download Kin-Relay-Setup.exe:
      https://github.com/tilok360/kin-relay/releases/latest/download/Kin-Relay-Setup.exe
   2) Double-click it. Windows may show a blue "Windows protected your PC" box, because Kin Relay is a free app
      that isn't code-signed (signing certificates cost money every year). Click "More info", then "Run anyway".
   3) Click Install. It installs just for you (no administrator needed), adds Kin Relay to your Start menu and
      desktop, then opens it. Nothing else to install: Kin Relay brings everything it needs.
   To remove it: Windows Settings > Apps > Kin Relay > Uninstall. Your key, characters and saves stay in
   %APPDATA%\KinRelay (delete that folder too if you want them gone).

   No installer? The portable zip still works: unzip it and double-click "Start Kin Relay.bat". It uses Node.js 22
   or newer, and downloads a private copy from nodejs.org (about 30 MB, checksum-checked) the first time if you
   don't have one. It opens in your browser instead of its own window. Mac/Linux: run start-kin-relay.sh.


GET IT (MAC)
   Download Kin-Relay-Mac-AppleSilicon.zip (M1 or newer) or Kin-Relay-Mac-Intel.zip:
      https://github.com/tilok360/kin-relay/releases/latest/download/Kin-Relay-Mac-AppleSilicon.zip
      https://github.com/tilok360/kin-relay/releases/latest/download/Kin-Relay-Mac-Intel.zip
   Unzip, drag Kin Relay into Applications. It isn't signed by Apple (that costs money every year), so the
   first time: right-click Kin Relay > Open > Open. If macOS only offers "Done", open System Settings >
   Privacy & Security, find "Kin Relay was blocked", click "Open Anyway". If it says "damaged", run this in
   Terminal:   xattr -cr "/Applications/Kin Relay.app"      It has not been tried on a real Mac yet.

GET IT (ANDROID)
   Download the app: https://github.com/tilok360/kin-relay/releases/latest/download/Kin-Relay.apk
   Open it. Android asks to allow "install unknown apps" for the app you opened it from: allow, go back,
   tap Install. If Play Protect warns, choose "Install anyway". It's not on Google Play. To update, install
   a newer .apk over it. It only asks for the Internet permission.

GET IT (IPHONE / IPAD)
   In Safari open https://tilok360.github.io/kin-relay/   Tap Share > Add to Home Screen > Add.
   Open it from the Home Screen. A Home Screen app keeps its own storage, so set up your key and Kins in it
   (or move Kins with Characters > Export and Import).

PHONE AND WEB NOTES
   The games run inside the app, your key stays in the app's storage on the device, and only Kindroid's API
   and your relay are contacted. Tables work while the app is open. Drag and drop becomes a "Pick file"
   button. Added games that wait for your Kin in one blocking step don't work there; the four built-in games do.

PICKING A KIN INSIDE A GAME
   Every game gets all your saved Kins. Where a game asks you to pick a Kin, every saved Kin is listed with a
   picture, and a search box appears when you have more than 8. The "Kins" button at the top of a game narrows
   which Kins that game gets (leave all unticked to give it all of them). A Kin answers through your own Kindroid
   API key as a normal Kin message, not Kindroid Apps credits. Kin Relay can't see whether Kindroid counts API
   messages against your account, so check your account after a first session.

TABLE CHAT
   At a Hold'em or Casino table, anyone's chat line can get a reply from a Kin. Whoever you speak to (@Name, or
   "Name, ..." at the start) answers first, otherwise the Kin that has been quiet longest, and a reply can start one
   more reply: never more than 3 Kin lines in a row without a person speaking. Kin Relay waits out Kindroid's limit
   (10 requests per 30 seconds) while "X is typing..." shows. Each Kin speaks through its owner's key on the
   owner's PC. If a Kin can't answer (no key, wrong key, offline) the chat says so. OOC is people only. Your name at
   tables comes from Settings, or from the persona in your Kindroid export when you import it.

IMPORT AND EXPORT KINS
   Characters > Import reads Kindroid's data export (.jsonl), a Kin Relay file or a Kin Studio character file.
   Chats in the file are ignored. Tick the Kins you want; for ones you already have, choose Update or Skip.
   API keys are never imported. Characters > Export saves a Kin Relay file (with pictures, never your key) or
   a Kin Studio file. Keep exported files private: they hold your Kins' profiles.


1. FIRST START
   Kin Relay opens on a Welcome page with two short steps for playing with your Kin. Solo games need no setup:
   click "Play solo now" any time.

2. SETTINGS: YOUR KINDROID API KEY
   In Kindroid: Profile > Preferences > API & Integrations > reveal your API key (it starts with kn_).
   Paste it under Settings > "Kindroid API key". The box hides it (click Show to check what you pasted).
     - Test: asks Kindroid whether the key works, and says plainly "Your key works" or what went wrong.
       It doesn't save anything.
     - Save key: tests it, then saves it. A key Kindroid refuses is not saved.
     - Remove key: forgets it.
   The key is saved only on this PC, in %APPDATA%\KinRelay. In the Windows app it's encrypted by Windows for your
   account (DPAPI), so another account or a copied file can't read it. It is never put in a game, a file you share
   or a message to another player. Never send your key to anyone.
   Also in Settings: your name at tables, how your Kin is asked (below), and the relay for tables with friends.

3. CHARACTERS: YOUR KINS
   Click "+ Add a Kin". Give it a name, and paste its AI ID: in Kindroid, open the Kin's settings; the AI ID is at
   the very bottom. (Not the 5-letter share code; Kin Relay tells you if you paste the wrong thing.)
   Optional: a picture (it's shrunk to a small square and kept on this PC) and notes just for you.
   Edit or delete Kins any time; "Make default" picks the Kin that plays when you haven't chosen.
   In a game, the round button at the top right picks the Kins for that game: tick the Kins the game can seat
   (games with more than one Kin seat use these) and mark one "Your Kin".
   How your Kin is asked (Settings):
     - "In your chat" (default): each question the game asks, and your Kin's answer, shows up in your normal
       chat with that Kin, so your Kin remembers the game. These are ordinary Kin messages through Kindroid's
       public API, not Apps runs.
     - "Quietly": uses the API endpoint Kindroid's Discord bot uses, so game questions stay out of your chat.
       Needs your Kin's share code (Characters > Share code) and an active subscription.
   Kindroid allows 10 API requests every 30 seconds per account; Kin Relay waits its turn automatically.

4. ADD ANY KINDROID APP (DRAG AND DROP)
   In Kindroid, open an app's menu and tap "Get its code". It downloads a .gz file.
   Drag that file onto the Kin Relay window (or click "+ Add a game"). Kin Relay:
     - unpacks it into its games folder (Windows app: %APPDATA%\KinRelay\games\<app name>; zip: the "games"
       folder next to Kin Relay), with safety checks: no files outside that
       folder, no links, size limits, and nothing in it is run while it's added (no install scripts, ever);
     - tells you plainly what works here, what Kin Relay stands in for (saves, your Kin, tables), and what can't
       work outside Kindroid (your Kin's voice, selfies, messages into your Kindroid chat, scheduled runs);
     - lists it with the other games. "Remove" deletes it; your saves for it stay. (The four games that come with
       Kin Relay can't be removed; a newer download of one of them takes its place.)
   Dropping a newer download of the same app replaces it (you're asked first). Only add apps from people you trust,
   as with any program. Each game's code runs with Node's permission limits: it can read and write only its own
   folder and its own saves, never your key file.

5. PLAY WITH FRIENDS (TABLES): HOW TO HOST
   Everyone at a table needs Kin Relay, the same game in it, and the same RELAY ADDRESS. A relay only passes table
   messages between your copies. It never sees anyone's key, and each person's Kin is asked on their own PC with
   their own key. The host's copy deals the cards and rolls the dice (secure random numbers); each player's hidden
   cards are sent only to that player.

   Pick ONE way to run a relay:
   A) Friends on your home Wi-Fi: Settings > tick "Run a relay on this PC". Kin Relay shows an address like
      http://192.168.1.20:8787/. Your friends paste that into their Settings > Relay address.
   B) Friends anywhere, quick and free: tick "Run a relay on this PC", then double-click
      "Share Relay Online (free tunnel).bat". It prints an address ending in .trycloudflare.com. Paste it into
      YOUR Relay address too, and send it to your friends. It changes each time you start it, and it's meant for
      game nights, not for staying up all the time.
   C) Friends anywhere, always on: put the relay on a free host. See "Free hosting" below.
   D) Port forwarding: forward TCP port 8787 on your router to this PC and give friends http://<your public IP>:8787/
      (only if you know how; it opens a port on your network).

   Then: the host opens the game (Kin Casino or Kin Hold'em), chooses "Host a table", and copies the invite code.
   Friends choose "Join", paste the code, and the host admits them. Each person may bring one Kin.
   If a PC sleeps or a connection drops, the relay keeps that player's messages for 15 minutes, so they can rejoin.
   Optional: to keep strangers off a public relay, start it with an access code (RELAY_CODE, see relay.js). The
   relay address then ends in ?k=<code>, and only people you give it to can use it.

   "Start Relay Only.bat" (portable zip) runs just the relay, with no games, for a PC that only hosts. The tunnel
   and "relay only" scripts come with the portable zip.

FREE HOSTING (OPTION C)
   - Cloudflare Workers (free plan): see cloudflare\README.md. Fast and always on.
   - Render (free plan): upload this folder to a GitHub repository, then in Render choose New > Blueprint; render.yaml
     sets it up. Free Render services sleep after about 15 quiet minutes and take up to a minute to wake.

TROUBLESHOOTING
   - "Relay problem": check the relay address (https:// or http:// included) and that the relay window is open.
   - "Kindroid did not accept the API key": paste it again; regenerating it in Kindroid makes the old one stop working.
   - "403": Kindroid's API needs an active subscription or trial.
   - Kin answers slowly: Kindroid's limit is 10 requests per 30 seconds; Kin Relay waits instead of failing.
   - Your settings and saves are in %APPDATA%\KinRelay. Delete that folder to start fresh.
   - "Windows protected your PC" when installing: click "More info", then "Run anyway" (see GET IT above).
   - The saved key "can't be unlocked": the key was encrypted for another Windows account or PC. Paste it again.
   - Kin Relay uses ports 47900 to 47910 on this PC only (127.0.0.1); nothing outside this PC can open it.

WHAT ISN'T KNOWN FOR SURE
   - Whether Kindroid counts API messages against anything: as far as is known they're normal messages on your plan,
     not Apps credits. Watch your account after a first session to be sure.
   - Kindroid's terms for using its API from tools like this: the API is public and documented for kn_ keys, but read
     Kindroid's current terms yourself.
   - Tables between Kin Relay and copies inside Kindroid don't mix: everyone at a table plays in Kin Relay.

Kin Relay is a fan-made tool. It isn't made by or connected to Kindroid. All art in it is original.
