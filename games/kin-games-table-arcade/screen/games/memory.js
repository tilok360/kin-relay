// Memory: twenty face-down cards, ten pairs. Turn two over; a pair is yours and you go again.
// Your Kin's flips are the app's: it remembers the cards it has seen as well as the level allows.
(function (root) {
  "use strict";
  const FACES = ["🦊", "🐙", "🌵", "🍉", "🚀", "🎻", "🦋", "🍄", "⚓", "🌙", "🐢", "🎈", "🍒", "🦉", "🌻", "🧭"];
  function deal(rand) {
    rand = rand || Math.random;
    const pick = FACES.slice().sort(() => rand() - 0.5).slice(0, 10), cards = pick.concat(pick);
    for (let i = cards.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [cards[i], cards[j]] = [cards[j], cards[i]]; }
    return cards;
  }
  // The Kin's choice of two cards, from what it remembers (seen: index -> face; taken: set of matched indexes).
  function kinPicks(cards, seen, taken, recall, rand) {
    rand = rand || Math.random;
    const open = cards.map((_, i) => i).filter((i) => !taken.has(i));
    const known = new Map();
    for (const i of open) if (seen[i] != null && rand() < recall) known.set(i, seen[i]);
    const byFace = {};
    for (const [i, f] of known) (byFace[f] = byFace[f] || []).push(i);
    const pair = Object.values(byFace).find((a) => a.length >= 2);
    if (pair) return [pair[0], pair[1]];
    const unseen = open.filter((i) => seen[i] == null), pool = unseen.length ? unseen : open;
    const first = pool[Math.floor(rand() * pool.length)];
    return [first, null];   // the second is chosen after the first is seen
  }
  function kinSecond(cards, seen, taken, first, recall, rand) {
    rand = rand || Math.random;
    const open = cards.map((_, i) => i).filter((i) => !taken.has(i) && i !== first);
    const match = open.find((i) => seen[i] === cards[first] && rand() < recall);
    if (match != null) return match;
    const unseen = open.filter((i) => seen[i] == null), pool = unseen.length ? unseen : open;
    return pool[Math.floor(rand() * pool.length)];
  }
  const E = { deal, kinPicks, kinSecond };
  if (typeof module === "object" && module.exports) { module.exports = E; return; }

  const RECALL = { beginner: 0.2, easy: 0.45, normal: 0.75, hard: 1 };
  root.KG.add({
    id: "memory", title: "Memory", icon: "🃏", blurb: "Find the pairs.",
    rules: "Twenty cards lie face down: ten pairs. On your turn flip two. If they match you keep them and go again; if not they turn back over and it's your Kin's turn. When every pair is found, whoever holds more pairs wins. Your Kin remembers what it has seen as well as the strength you set: patchy on Easy, sharp on Hard.",
    achievements: [
      { id: "on_a_roll", icon: "🔥", name: "On a Roll", about: "Find three pairs in a row in one turn." },
      { id: "lucky_guess", icon: "🍀", name: "Lucky Guess", about: "Match a pair from two cards nobody had seen yet." },
      { id: "clean_sweep", icon: "🧹", name: "Clean Sweep", about: "Win with seven or more of the ten pairs." },
    ],
    mount(api) {
      let S = null, busy = false, dead = false, up = [], fresh = [], run = { who: "", n: 0 };
      const info = document.createElement("div"); info.className = "score";
      const grid = document.createElement("div"); grid.className = "cards"; grid.style.gridTemplateColumns = "repeat(5,1fr)"; grid.style.maxWidth = "440px"; grid.style.margin = "auto";
      api.el.append(info, grid);
      const els = [];
      for (let i = 0; i < 20; i++) { const b = document.createElement("button"); b.type = "button"; b.className = "mcard"; b.onclick = () => tap(i); grid.append(b); els.push(b); }
      const taken = () => new Set(Object.keys(S.owner).map(Number));
      function draw() {
        els.forEach((b, i) => {
          const owner = S.owner[i], show = owner || up.includes(i);
          b.className = "mcard" + (show ? " up" : "") + (owner === "you" ? " mine" : owner === "kin" ? " theirs" : "");
          b.textContent = show ? S.cards[i] : "";
          b.setAttribute("aria-label", show ? S.cards[i] + (owner ? (owner === "you" ? ", your pair" : ", your Kin's pair") : "") : "face-down card");
        });
        const n = (w) => Object.values(S.owner).filter((x) => x === w).length / 2;
        info.innerHTML = `<span><b class="you">You</b> ${n("you")} pairs</span><span><b class="kinc"></b> ${n("kin")} pairs</span>`;
        info.querySelector(".kinc").textContent = api.kinName();
        if (!busy && S.turn === "you" && !api.ended()) api.status(up.length ? "Now flip a second card." : "Your turn: flip two cards.");
      }
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      async function resolve(who) {
        const [a, b] = up;
        const lucky = fresh.length === 2 && fresh.every(Boolean); fresh = [];
        S.seen[a] = S.cards[a]; S.seen[b] = S.cards[b];
        busy = true; draw();
        await wait(S.cards[a] === S.cards[b] ? 500 : 1100);
        if (dead) return false;
        up = [];
        if (S.cards[a] === S.cards[b]) {
          S.owner[a] = who; S.owner[b] = who; api.save(S); draw();
          run = run.who === who ? { who, n: run.n + 1 } : { who, n: 1 };
          if (run.n === 3) api.achieve("on_a_roll", who);
          if (lucky) api.achieve("lucky_guess", who);
          if (Object.keys(S.owner).length === 20) {
            const y = Object.values(S.owner).filter((x) => x === "you").length / 2, k = 10 - y;
            if (y >= 7) api.achieve("clean_sweep", "you"); if (k >= 7) api.achieve("clean_sweep", "kin");
            busy = false; S.turn = "done"; api.save(S);
            api.over(y > k ? "you" : k > y ? "kin" : "draw", `${y} pairs to ${k}`);
            return false;
          }
          if (who === "kin" && api.settings.mode !== "quiet") api.line(`You just found a pair of ${S.cards[a]} cards.`);
          return true;   // same player again
        }
        run = { who: "", n: 0 };
        S.turn = who === "you" ? "kin" : "you"; api.save(S); draw();
        return false;
      }
      async function tap(i) {
        if (busy || dead || S.turn !== "you" || api.ended() || S.owner[i] || up.includes(i)) return;
        fresh.push(!(i in S.seen)); up.push(i); S.seen[i] = S.cards[i]; draw();
        if (up.length < 2) return;
        const again = await resolve("you");
        busy = false;
        if (again) draw(); else if (S.turn === "kin") kinTurn();
      }
      async function kinTurn() {
        busy = true; draw();
        while (!dead && S.turn === "kin" && !api.ended()) {
          api.status(`${api.kinName()} is choosing…`);
          await wait(700); if (dead) return;
          const recall = RECALL[api.settings.level] || 0.75;
          const [a, b0] = kinPicks(S.cards, S.seen, taken(), recall);
          fresh = [!(a in S.seen)]; up = [a]; S.seen[a] = S.cards[a]; draw();
          await wait(700); if (dead) return;
          const b = b0 != null ? b0 : kinSecond(S.cards, S.seen, taken(), a, recall);
          fresh.push(!(b in S.seen)); up = [a, b]; draw();
          const again = await resolve("kin");
          if (!again) break;
        }
        busy = false; draw();
      }
      (async () => {
        S = api.state && api.state.cards ? api.state : null;
        if (!S) { const first = await api.firstMover(); S = { v: 1, cards: deal(), owner: {}, seen: {}, turn: first }; api.save(S); }
        draw();
        if (S.turn === "kin") kinTurn();
      })();
      return { destroy() { dead = true; } };
    },
  });
})(typeof self !== "undefined" ? self : this);
