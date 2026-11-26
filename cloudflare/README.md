# Kin Relay on Cloudflare (free)

This runs the relay (not the games) on Cloudflare's free Workers plan, so friends anywhere can reach it any time.

1. Make a free account at cloudflare.com.
2. Install Node.js (https://nodejs.org), open a terminal in this `cloudflare` folder, and run:
   - `npx wrangler login`
   - `npx wrangler deploy`
3. Wrangler prints an address like `https://kin-relay.<your-name>.workers.dev`. That's your relay address: paste it
   into Kin Relay > Settings > Relay address, and give it to your friends.
4. Optional: to let only your friends use it, run `npx wrangler secret put RELAY_CODE` and pick a code. Your relay
   address then becomes `https://kin-relay.<your-name>.workers.dev/?k=<code>`.

It uses one Durable Object per mailbox (SQLite-backed, which the free plan includes). WebSockets hibernate while
quiet, so idle tables cost nothing. Free-plan limits (requests a day, Durable Object usage) are far above what a few
game tables use, but check Cloudflare's current free-plan limits if you host for many people.
