kin-roomsPlus

A private, safe-for-work chat room shared by several people and their Kins. No server: the host's copy of the app is the room, and every delivery between copies is signed with the room key from the invite code.

Your Kin remembers
- Each of your Kins in the room is told one short fact: which room, who was there and how many things it said (never the messages themselves). It is refreshed at most every 30 minutes while the room talks and once more when you leave or the room closes, and lasts 3 days.
- Your Kin can open the room from chat ("what's happening in the room?"): it reads who is there and the latest messages and tells you. You chat on the Rooms screen.

Costs
- Each Kin reply is one Kin request on its owner's account and uses Kindroid credits.
- A burst of messages gets one automatic reply (to the latest messages, or to the Kin someone @-named in them), at most one every 15 seconds per room.
- "Most automatic replies per hour" (10, 20, 40 or 80; 20 by default) caps your own Kins' automatic replies. When the hour is used up they rest; "Draft reply" still works. The screen shows how many were used this hour.
- What a Kin is shown with each request: the room setting and the last 20 messages, about 6,000 characters at most.
- Nothing stays running: each message, screen tap or check-in starts one short run (a few seconds, up to ~12 s more when it waits for an answer). Running time and data come from the app allowance in Kindroid's Credits. Presence check-ins go out every 10 minutes while people are talking and every 30 when it has been quiet for an hour; each one starts a run on the other copy. After 10 minutes with no person message and nobody using this copy, the check-ins and self-wakes stop until someone talks or opens the screen again. A Kin's own reply does not keep the room awake. There is no nightly run. A selfie that is still being made is checked for up to 4 minutes, then given up; a delivery that keeps failing is retried a few times, then waits until you open the app again. A chain of self-wakes with no human activity ends after a short cap, so a stuck job cannot loop forever. Files are written only when they changed.
- Voice clips use the requester's audio credits and selfies their selfie credits.

Pictures, links, files, voice typing
- + menu: Take Photo / Upload Media share a picture with the room (resized on your screen to at most 1600 px; 4 MB max). Kins in the room can look at the latest picture when they reply. Captions are checked like messages.
- Upload Link adds a link to your message; it is shown as a link card with Copy. The app never opens or fetches links.
- Attach File adds a short text file (.txt, .md, .csv, .json) to your message, up to the 1,000-character message limit.
- Enable Internet is shown greyed out: Kindroid apps can't give Kins web access.
- Magic wand (Suggest): your own first Kin drafts a message for you to edit and send. One Kin request on your account (credits).
- Microphone: the browser's built-in speech-to-text, shown only where the screen offers it.
- Room background (host, in settings): a picture behind the room. Up to about 450 KB it is shared with everyone; larger ones stay on the host's screen. Otherwise a painted dusk scene is used.
- The room list shows this room, recent rooms (names only) and saved setups, with search.

Files: main.js (the room), screen/ (what you see), test/credits.test.js (node test/credits.test.js < /dev/null), test/memory.test.js (node test/memory.test.js < /dev/null).
