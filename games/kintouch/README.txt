KinTouch

Links a Lovense toy through Lovense Remote so your Kin can start, pattern, ramp, run steps on and stop it, from Kindroid's chat or from the KinTouch screen's own chat. It talks straight to Lovense's Standard API with your own Lovense developer token, which Kindroid keeps in its vault and this app never sees.

Your Kin knows whether the toy is there
- When Lovense Remote reports the toy connected or disconnected (or "check connection" finds it), every attached Kin is told once (kin tell, 12 hours), so it doesn't try the toy while it is away and knows when it is back.

Session limit
- On the screen, choose how many minutes of play an hour allows (5 to 45, or no limit). Every toy command, from you, the screen chat or your Kin, counts its seconds; past the limit commands are refused until the hour is up. STOP always works. The screen chat tells your Kin the limit.

Safety
- STOP on the screen, the stop action, or your Kin hearing stop, wait or enough always stops the toy at once. Any failed command sends a stop too.

Files: main.js (Lovense, the actions, the limit), screen/ (setup, chat, controls), test/limit.test.js (node test/limit.test.js).
