Kin Co-Host

Puts your Kin in your Twitch or Joystick.tv live chat as a co-host: it answers !kin questions, welcomes first-time chatters, thanks follows, subs, gifts, raids, bits and tips, reacts now and then, and wakes up a quiet chat.

Stream recap
- While the chat is live the app counts chatters, !kin questions, follows, subs, gifts, raids, bits and tips (recap.json). After 45 quiet minutes, or when you switch the co-host off, your Kin is told a one-line recap (for a day) and nudged to message you about the stream when its messages are on.

Costs
- Each line your Kin writes itself is one Kin request and uses Kindroid credits.
- Thank-yous and welcomes are ready-made lines by default: no Kin request, no credits. Everything that happens within a few seconds is thanked in one message. Switch to "Kin's own words" on the screen to have the Kin write them (one request per batch).
- "Most Kin requests per hour" (10, 20, 40 or 80; 20 by default) caps the Kin's requests. !kin questions may use the whole hour; reactions, banter and Kin-worded thanks stop at 70% of it. When the hour is used up, a !kin question gets a short "catching my breath" line at most once every 10 minutes. The screen shows how many requests were used this hour and today.
- Banter only follows real chat: never into an empty room, and never twice without a person talking in between.
- The app runs all the time (an "always" app), so it can stay connected to the chat. Running time and data come from the app allowance in Kindroid's Credits. Kindroid's guide offers no way to pause an always app; switched off, it only reads its settings once a minute and makes no Kin requests.

Files: main.js (the connection and the co-host), screen/ (what you see), test/cohost.test.js (node test/cohost.test.js).
