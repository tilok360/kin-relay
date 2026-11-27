Kin Workshop

One Kindroid Apps screen that replaces three older ones: Kin Blueprint Studio, Roleplay Engine Builder and Room & Group Starter. It keeps their questions and adds what they lacked.

Tools (tabs)
- Character card: drafts Personality / Backstory, Key memories, Additional context, Response directive, Example message, Greeting and Avatar description from the details you enter.
- Game system: core system, first scenario, rules stress test, or a compact Kindroid install pack.
- Room & group: group dynamics, Room or Group Chat setup text, a multi-session arc, or a privacy audit.
- Saved drafts: every answer your Kin gave, newest first (the newest 40 are kept).

What it does
- Shows which Kin answers. A screen's ask goes to the Kin whose chat the app was opened from (or the first attached Kin); a screen can't choose another, so the bar says to open the app from that Kin's chat.
- Counts the request against the 8,000-character limit for one ask and won't send a longer one.
- Waits up to 2 minutes for an answer. Kindroid sometimes drops an ask; then "Ask again" retries, and "Stop waiting" lets you give up. A late answer still shows up.
- Splits the answer into its sections (the Kin is asked to head each one "### HEADING"; bold or capital-letter headings are read too). Each section is an editable box with a Copy button and a live count against its Kindroid limit when it has one: Avatar generator 250, Avatar description 800, Personality/Backstory and Engine rules 2,500, Key memories 1,000, Additional context 2,500, Response directive 250, Example message 750, Greeting 750, Ongoing thread 800, Voice 1,000, Tagline 100.
- Fit in Chinese: asks the Kin to rewrite a section in Simplified Chinese under its limit (names in Latin letters, spoken words in English). The English stays under the box for reference and can be put back. Shorten in English does the same in English.
- Saves your details for each tool (forms.json) and every draft (drafts.json) in the program's own folder, so closing the panel loses nothing. Section edits are saved as you type.

Grants
- kin:read only, to ask the attached Kin. It does not read chat history, write to Kin memory, post in a chat, or use the network. Asking may use Kindroid AI credits; files count toward the monthly app allowance.

Files
- kin.json: the manifest.
- screen/index.html: the whole screen.
- dev/host.html: a local test host that stands in for Kindroid (kins, files, ask). Serve the folder with a local web server and open dev/host.html; it can drop an ask, make answers too long, or show no attached Kin.
