# Kin Relay adapter guide (for app makers)

Kin Relay runs a Kindroid Apps program, unchanged, on a person's own PC. If your app works in Kindroid, a person can
download it with **Get its code**, drag the `.gz` onto Kin Relay, and play it with no Apps credits. This guide says
what Kin Relay provides, how it maps to Kindroid's platform, and how to make your app work well in both.

## What Kin Relay stands in for

| In Kindroid Apps | In Kin Relay |
|---|---|
| Screen in a locked frame (`screens[0].entry`) | Served from `http://127.0.0.1:<port>/apps/<slug>/`, a separate web origin from Kin Relay's own page, in a sandboxed iframe. `localStorage` works here (it doesn't in Kindroid, so keep using files for anything that matters). |
| `parent.postMessage({kin:"files.read", path [, as:"blob"]})` | Answered `{kin:"files.read", path, body, id}` from the person's data folder. |
| `{kin:"files.write", path, body}` | Answered `{kin:"files.write", path, ok, id}`. |
| `{kin:"kins"}` | Answered `{kin:"kins", ok, kins:[{id,name}], current, id}`, and sent again when the person picks another Kin in the top bar. Ids are short stand-ins (`k` + 15 hex), never real AI IDs. |
| `{kin:"ask", question}` | Answered `{kin:"ask", ok, text, id}`. Goes to the person's Kin through Kindroid's public API with their own key (`/send-message`, or `/discord-bot` in "quiet" mode). |
| `{kin:"action", name, input}` | Runs `run.entry` once on this PC with `{"trigger":"action","action":name,"input":...,"kin":<current>}` on stdin, then answers `{kin:"action", name, ok, summary, id}`. |
| `run.entry` | Only `node <file> ...` entries. One run at a time per app, queued in order. `run.timeout` is respected. |
| `kin files get/put/ls/rm` | The app's own folder in the person's data folder. `ls` prints one path per line, relative to the folder. |
| `kin kins [--json]` | The person's Kins (stand-in ids). |
| `kin ask "<q>" [--kin id]` | Same as the screen's `ask`. `--attach` is accepted, but the attachments aren't sent. |
| `kin tell "<fact>" [--key k]` | Kept in `tells.json` next to the app's files. **Not** sent to Kindroid: the Kin won't remember it. |
| `kin end [--failed] [--next <ISO time>] "<summary>"` | The summary goes back to the screen. `--next` wakes the app again at that time (trigger `{"trigger":"schedule","wake":true}`), but only while Kin Relay is open. |
| `kin address <id>` + an `inbound` trigger | An address of the form `https://in.kinusercontent.com/kr/<relay, base64url>/<mailbox>`. Your existing `okAddr` check (https, host `in.kinusercontent.com`) passes. |
| `fetch(<that address>, {method:"POST", body})` | Caught inside the run and posted to the Kin Relay the address names. Each arriving delivery becomes `inbox/<time>-<id>.json` holding `{body, content_type, headers}`, followed by a run with `{"trigger":"inbound","id":"<id>"}`. A real Kindroid address is refused (403), so a Kin Relay table can never start runs on Kindroid. |
| `kin say/picture/video/media/secret/tcp`, `kin:voice`, `kin:picture`, `kin:message`, `secret:` grants | Not available. The command exits with code 2 and says so. Design your app so these are extras, not required. |
| `schedule` triggers, `always` | Not run. Kin Relay wakes an app only for screen actions, deliveries and `--next`. |
| npm/PyPI packages | Never installed. Keep apps dependency-free (plain Node), or the runs will fail here. |

The code is in `lib/`: `kin-shim.js` is loaded with `node --require` before your entry, `kin-commands.js` is the
`kin` command, `runtime.js` runs entries, `installer.js` unpacks and checks downloads, and `public/bridge.js` answers
your screen.

### Sandboxing
Each run starts as `node --permission --allow-fs-read=<app folder> --allow-fs-read=<kin relay lib> --allow-fs-read=<app data> --allow-fs-write=<app data> --allow-worker --require kin-shim.js <your entry>`.
So your run can't read anything else on the PC: not other apps' saves, and not the person's API key. Network access
isn't limited by Node, so only use the hosts your `net:` grants name. Don't start other programs. The `kin` command
is handled inside your process: `spawn`, `spawnSync`, `execFile` and `execFileSync` of `"kin"` all work.
`exec("kin ...")` with a shell string doesn't.

## Making a multiplayer app work over Kin Relay
If your app already uses the Kindroid inbound pattern, you don't need to change anything. These are the patterns
Kin Casino and Kin Hold'em use:

1. **Host-authoritative.** The host's copy keeps the whole state (deck, dice, wheel) and decides every outcome with
   `crypto.randomInt` / `crypto.randomBytes`. Players' copies send intents ("call", "bet 20 on red"), not results.
2. **Hidden information goes only to its owner.** Send each member a view built for them: their own cards, everyone
   else's as a count. Never send the full deck to a player. The relay operator can read messages (they're signed,
   not encrypted), so keep anything private out of the table you broadcast.
3. **Invite codes, no "password" wording.** `TABLE-` + base64url of `{a: hostAddress, r: tableName, h: hostId, k: tableKey}`.
   The table key (32 random bytes, hex) signs every delivery with HMAC-SHA256 over the payload, and the payload
   carries `from`, `ts` and a `nonce`. Drop anything unsigned, stale (over 20 minutes) or replayed. Removing a player
   rotates the key.
4. **Rejoin.** A member who comes back re-sends `join` with the same id and gets the current view. The relay keeps
   undelivered messages for 15 minutes.
5. **Turn timers.** Keep `deadline` in the state and end each run with `kin end --next <deadline>`. When the wake
   comes, act for anyone who ran out of time.
6. **Each Kin on its own PC.** When a member brings a Kin, *that member's* copy asks it (`kin ask --kin <their id>`)
   and sends the answer to the host as an intent. Nobody ever holds another person's key.
7. **Cheap by default.** Stop self-wakes about 10 minutes after the last *person* acted. It costs nothing here, but it
   costs credits inside Kindroid.

## The relay protocol (version 1)
To use the relay from something that isn't a Kindroid app:

- `POST <relay>/d/<box>`: deliver up to 256 KB to a mailbox (`box` is 32 hex). Answer `202 {"ok":true,"online":bool}`.
- `GET <relay>/ws?box=<box>` (WebSocket). Send `{"t":"listen","secret":"<64 hex>"}`, where `box` = the first 32 hex of
  `sha256("kin-relay:" + secret)`. You receive `{"t":"ready"}`, then `{"t":"msg","id","at","ct","body"}` for each
  message. Reply `{"t":"ack","id"}` once you've stored it. Unacknowledged messages come again after a reconnect.
  `{"t":"ping"}` is answered `{"t":"pong"}`.
- Limits: 256 KB a message, 300 messages or 4 MB waiting per mailbox, 15 minutes kept, rate limits per address and
  per mailbox. If the relay has an access code, add `?k=<code>` to every URL.

The same protocol runs in `relay.js` (Node, no packages) and `cloudflare/worker.js` (Workers plus Durable Objects).

## Checklist for app makers
- Plain Node, no packages, `run.entry` = `node main.js`.
- Everything the screen needs goes through `files.read`/`files.write`; any `localStorage` is a cache only.
- Answer screen requests by `id`. Kin Relay echoes the `id` you send.
- Keep a free Solo mode with zero Kin asks.
- Voice, pictures and Kindroid chat messages should be extras.
- Test it: drop your `.gz` on Kin Relay and read the "What works here" list.
