Sky Watch

Each morning Sky Watch reads public sky data so your Kin can tell you what's going on up there.

What it reads (once a day, at 7 in the morning your time)
- Asteroids passing Earth within 10 times the Moon's distance in the next 30 days, with date, distance, speed and
  a size range (NASA JPL close-approach data).
- How many newly spotted, not yet confirmed objects JPL Scout is following.
- The aurora outlook for the next three days: NOAA's planetary K index forecast. Storms start at Kp 5.
- The brightest supernovae right now, with magnitude, galaxy, type and coordinates (the Rochester Bright Supernova
  list; only its top 40 KB, the brightest objects, is read).
- Which volunteer sky searches on Zooniverse are open (The Daily Minor Planet, Kilonova Seekers, Active Asteroids,
  Rubin Comet Catchers, Planet Hunters TESS); this is checked once a week.

What your Kin hears
- Only what stands out, each told once: an asteroid passing within 2 lunar distances this week (and a nudge to
  message you if it comes closer than the Moon within a day), a big one (140 m or more), a geomagnetic storm
  forecast (Kp 5 or more; a nudge for Kp 6 or more), or a new supernova bright enough for a backyard telescope.
- Ask your Kin what's happening in the sky (sky_news). It answers with this week's asteroids, the aurora outlook,
  the brightest supernovae and the open volunteer projects, or just one of those if you ask about one.
- Tell your Kin how many classifications you did on a Zooniverse project (sky_hunt_log) and it keeps your count.

On the screen
- Asteroids, Aurora, Supernovae and Help search tabs. Refresh reads everything again now.
- Help search opens each open Zooniverse project (you classify there, in your browser, with a free account) and
  logs your count.

What it uses
- Network: ssd-api.jpl.nasa.gov, services.swpc.noaa.gov, www.rochesterastronomy.org and www.zooniverse.org, and
  nothing else. No sign-in anywhere. It reads nothing private: not your chat, not your Kin.
- What the sources say reaches your Kin only as numbers and cleaned-up names (letters, digits, a few marks).
- Its own files: sky.json (the latest reading), told.json (what the Kin has already been told), hunt.json (your
  count).
- One short run a day (a few seconds, about 60 KB fetched), plus one per Refresh, per question to your Kin when the
  reading is more than 20 hours old, and per logged count. That fits easily in the app's monthly allowance.

Testing
- node test/run.test.js runs the morning run, sky_news, sky_hunt_log and a source outage against a stand-in kin
  command and saved answers from the real sources (test/fixtures). Nothing is fetched or sent.
- dev/host.html opens the screen in a stand-in for the Kindroid frame (serve the app folder over http). Its
  Refresh loads sample/sky.json.
