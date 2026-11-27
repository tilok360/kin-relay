Kin Backup

A Kindroid Apps screen for saving Kins you aren't using. Each saved Kin is a card like the ones in the codex: the avatar picture, every Kindroid field with a copy button and a live character count, the share details, and backup tags. It holds no selfie or scene prompts. It does not read chat, does not ask any Kin anything, and does not change the Kin in Kindroid.

What a card holds
- Name and the avatar picture, plus a small gallery of extra pictures (full body, selfie or other, up to 8 extras). Add a JPEG, PNG, WebP or GIF by choosing a file, dropping it on the avatar, or pasting it (Ctrl+V / ⌘V) while the card is open. Pictures are kept at full quality up to 2,048 pixels on the long side or 6 MB; larger ones are scaled down, and a notice says so. Click a picture to view it large. Replace and remove ask first. "Save to device" offers the original file back. Kindroid's own export may include a picture web address: it is noted on the card and never fetched (this app has no network grant); add the file yourself.
- Kin Social: each card has a Has social / No social yet toggle and an optional handle or link, stored as a reminder only (never opened or fetched). The status shows as a badge on the list and on the card. Filter by "Has social" or "No social yet". New cards start as No social yet.
- Share details: Kin ID, Share code, Share link, each with a copy button. When the app is attached to Kins, "Use an attached Kin's ID" fills in the Kin ID.
- Backup tags: Featured, Shared, Not shared, plus your own tags. Shared and Not shared switch each other off; Featured goes with either. New Kins start as Not shared. The list can be filtered by any tag.
- About: Who they are, Physical description (no limit).
- Kindroid fields, with their limits: Avatar generator 250, Avatar description 800, Avatar bridge prompt 2,000 (shown only when filled in), Backstory 2,500, Key memories 1,000, Additional context 2,500 (5,000 on MAX), Response directive 250, Example messages 750, Greeting 750, Ongoing thread 800, Voice description 1,000. Over the limit shows in red; the text is still saved.
- Sharing listing: Tags 100, Tagline 100, Bio 200, Contribution instructions 500, Author's note 2,000.
- Private notes (shown only when filled in).
- Older texts: every time a field changes (by editing, putting an old text back, or an import that updates the card), the text it replaces is kept under that field, newest first, up to 10 per field. Each one has Copy and Put it back.
- Prompts: the card lists the prompts linked to this Kin, with Copy, and "+ Add a prompt".

Prompt library (the second tab)
- Save your favorite prompts: title, the prompt text with a live count, the Kin it belongs to (or none), kind (Selfie 2,000, Group selfie 600, Video 1,000, Avatar generator 250, Other), picture size (1:1, 2:3, 3:2), selfie model, NSFW, favorite star, your own tags, source and a private context note.
- Search titles, text, Kins and tags; filter by Kin, kind, Favorites, SFW, NSFW or a tag; sort favorites first, recently changed, or A to Z. Every row has a star and a Copy button.
- Saving a prompt that is the same or nearly the same as another (half or more of its four-word runs shared) asks before keeping both.
- Duplicate makes an editable copy. Deleting a Kin keeps its prompts, unlinked.

Backup status
- A strip at the top of the library shows Kins saved, the last change, the last backup file (when, how, size; amber when cards changed after it) and roughly how much is stored here. "Back up now" opens Export all; "Restore from file" opens Import.
- "Backup activity" lists the last 20 exports (to device, download link, copied JSON) and imports with date and size. Each card in the list shows when it was last changed and its size (text plus picture); sort by Largest first.
- Putting back an older text asks first; deleting a Kin asks first and offers Export first. Exports and imports show a progress bar while they work. Notices appear as toasts.

Library
- Search looks through names, tags, tagline, bio, listing tags, Kin ID, share code and Kin Social handle.
- Sort A to Z, Z to A, or recently changed.

Export (one Kin from its card, or every Kin with Export all)
- Save to this device: downloads a .json file. Kindroid's frame may block downloads; then use one of the other two.
- Include the prompt library (or, for one Kin, its prompts): on by default when there are any.
- Make a download link: writes kin-backup-export.json in the app's folder. The link is in Kin Backup's settings in Kindroid Apps. Kindroid serves links up to 5 MB, so turn off "Include avatar pictures" or export fewer Kins for a big library. A new link replaces the old file.
- Save as a zip: one JSON plus, if pictures are included, each Kin's folder with avatar and extra pictures as image files (avatar.jpg, full-body-…, selfie-…). Import reads those files back.
- Copy JSON: copies the whole export to paste into a text file.

Import
- Kindroid's own data export (.jsonl, one record per line): every Kin (entity_type "ai") and every shared listing (entity_type "shared_template") is read. A Kin gets its name, backstory, key memories, additional context, example message, response directive, avatar description, current scene, Kin ID and custom voice description; its shared listing adds share code, share link, tagline, greeting, tags and author's note, and marks it Shared (or Not shared when the listing is private; "Unlisted" is added when it is unlisted). Gender, room bio, voice call directive, learned context and journal entries go to Private notes. Only listings this account shared count (the export's meta uid). A listing goes on its Kin's card when the Kin's share code is that listing's code; listings with no Kin in the export get their own card. A Kin made from someone else's shared Kin carries that Kin's code: it stays Not shared, and the code is noted in Private notes. Chats, selfies, rooms and personas are left out, and picture links stay as text in Private notes (they are web addresses, so they are not loaded).
- Choose a .json or .zip file, or paste JSON. A Kin Backup export, one Kin, a list of Kins, or {"kins": [...]} (also "characters", "kindroids" or "ais") all work. Items with no name are skipped and listed.
- Zip files are opened in the screen itself, with no network: every .json inside is read, zips inside the zip are opened one level down, and a picture named avatar.jpg/.png/.webp beside a one-Kin JSON becomes that Kin's picture. A Kin backup zip (Name/character.json + avatar.jpg) imports with its fields (personality, memories, directive, example, additional, appearance), its Kindroid Kin ID and its picture. Zip64 archives (over 4 GB) and packing other than stored or deflate aren't supported.
- Text fields Kin Backup has no box for (for example facial, gender or nsfw) are kept in Private notes, labeled.
- When a Kin in the file is already saved, you choose: Update the saved card (the default), Add it as a new card, or Leave the saved card alone. A match is found by codex card, then Kin ID, then share code, then name. Updating replaces only the fields the file fills in (the old text goes into Older texts), adds notes that aren't there yet, and adds tags. Importing the same file twice changes nothing. The result says how many cards were added, updated, already up to date or left alone.
- Prompts in a Kin Backup export come too, linked to the card their Kin became. A prompt already saved (same prompt, same codex item, or the same text) is updated instead of doubled.
- Codex HTML (cards written as <section class="card">, like the Sword of Truth codex): Kin Backup lists the character cards and you choose which to save. Each becomes a card tagged Codex: the summary and "Who he/she was" go to Who they are, Physical description to its box, and the Kindroid fields to theirs (Personality to Backstory, Voice profile to Voice description, Opening message to Greeting). Other field variants and the English references of Chinese fields go to Private notes. Its selfie and video prompts go to the prompt library with title, kind, size, NSFW flag, book and chapter, and the scene, social line and English reference as context. Importing the codex again updates the same cards. A 248-card codex lists in under a second; only the chosen cards are read in full.

JSON format (version 2; version 1 files still import)
{
  "app": "kin-backup", "version": 1, "exported": "2026-11-23T19:30:00.000Z", "count": 1,
  "kins": [{
    "id": "backup ID made by the app", "name": "", "tags": ["Featured", "Not shared"],
    "avatar": "data:image/jpeg;base64,... or empty",
    "social": "yes | no", "social_handle": "",
    "avatar_pending": "a picture web address from a Kindroid export, never fetched",
    "gallery": [{ "id": "", "kind": "full-body | selfie | other", "label": "", "image": "data:image/..." }],
    "kin_id": "", "share_code": "", "share_link": "",
    "who_they_are": "", "physical_description": "",
    "avatar_generator": "", "avatar_description": "", "backstory": "", "key_memories": "",
    "additional_context": "", "response_directive": "", "example_messages": "", "greeting": "",
    "ongoing_thread": "", "voice_description": "",
    "listing_tags": "", "tagline": "", "bio": "", "contribution_instructions": "", "authors_note": "",
    "notes": "", "codex_id": "", "history": { "backstory": [{ "at": "ISO date", "text": "older text" }] },
    "created": "ISO date", "updated": "ISO date"
  }],
  "prompts": [{
    "id": "", "title": "", "text": "", "kin": "the id of a Kin in this file, or empty", "kin_name": "",
    "type": "Selfie | Group selfie | Video | Avatar generator | Other", "size": "1:1 | 2:3 | 3:2 | empty",
    "model": "Vignette", "nsfw": false, "fav": false, "tags": [], "source": "", "context": "", "ref": "",
    "created": "ISO date", "updated": "ISO date"
  }]
}
Other field names that are read on import (case, spaces and punctuation don't matter):
personality -> backstory; voice, voice profile -> voice_description; memories -> key_memories; first message, opening message -> greeting; author's note -> authors_note; kindroid id, kinid -> kin_id; share url, share code -> share_link, share_code; title -> name; image, picture, photo -> avatar; status, labels -> tags. A "tags" value written as plain text with words other than Featured, Shared and Not shared is read as the listing tags. A "fields" object inside a Kin is read too. Example messages may be a list.

Where it keeps things (the program's own folder, through the screen's files.read and files.write)
- index.json: the list of saved Kins with a small thumbnail and size each, plus the last 20 backup activity entries (dates, sizes; no Kin text).
- kin-<id>.json: one Kin's card.
- avatar-<id>.txt: that Kin's avatar as a data URL (the actual image data, in the app's own files).
- gallery-<id>-<pic>.txt: extra pictures for that Kin, the same way.
- prompts.json: the prompt library.
- kin-backup-export.json: only after "Make a download link" (named in kin.json "links").
Screens cannot delete files, so deleting a Kin empties its two files and removes it from the list.

Costs
- No grants: it makes no pictures, voice or video and asks no Kin, so it uses no selfie or audio credits.
- It stays grant-free on purpose: filling in an attached Kin's avatar picture automatically would need kin:picture, and an app holding that grant may not serve download links, which Export uses.
- Reading and saving files and the download link count as data and files kept in Kindroid's Credits, which are free up to the monthly app allowance. Pictures are the biggest part; each card is a few KB of text.

Files
- kin.json: the manifest (a screen only: no run, no triggers, no grants).
- screen/index.html, screen/style.css, screen/app.js: the screen.
- sample/: one made-up example Kin laid out like the data folder, for the App Library card picture.
- dev/host.html: a local test page that stands in for Kindroid's frame and keeps files in the test page's browser storage. Serve the folder (python -m http.server 8765) and open http://localhost:8765/dev/host.html, or dev/host.html?nosandbox where an embedded browser refuses sandboxed frames. "Load sample/ data" fills it with the example. dev/sample-export.json is an export file to try Import with. Opening screen/index.html on its own runs in preview mode, keeping nothing after the page closes.

Sending it in (from your own computer, with your own key)
1. On kindroid.ai: Profile > API & integrations > Your own coding tools > Make a key (starts kk_). Keep it to yourself; never put it in a file in this folder.
2. In PowerShell:
   cd <the kin-backup folder>
   git init
   git add -A
   git commit -m "Kin Backup"
   $env:KIN_TOKEN = "kk_your_key"
   $env:KIN_PROGRAM = "kin-backup"
   curl -fsSO https://downloads.kinusercontent.com/workshop/kin.mjs
   node kin.mjs send .
3. Open Apps in Kindroid; Kin Backup waits under "Waiting for you" until you press Allow.
