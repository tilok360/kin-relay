// Computer players for Cards Against Kin-manatee. They pick and judge cards from a few simple tastes, with no
// Kin and no network: free in Solo and when they fill empty seats at a hosted table. Runs in the app and the screen.
(function (root, factory) { if (typeof module === "object" && module.exports) module.exports = factory(); else root.Bots = factory(); })(typeof self !== "undefined" ? self : this, function () {
// Each computer player has a name, a taste and a catchphrase used when it judges.
const CAST = [
  { id: "barnacle", name: "Captain Barnacle", taste: "wordy", icon: "⚓", says: ["A fine, long-winded tale. Point!", "I do love a speech.", "That one had pages."] },
  { id: "pearl", name: "Pearl", taste: "punchy", icon: "🦪", says: ["Short. Perfect.", "No notes.", "Crisp, like a clam."] },
  { id: "kelp", name: "Professor Kelp", taste: "fitting", icon: "🌿", says: ["It fits the blank like a glove.", "Textbook comedy.", "The prompt and the answer agree."] },
  { id: "wavy", name: "Wavy", taste: "wild", icon: "🌊", says: ["No idea why. Vibes.", "The tide told me.", "Picked it with my eyes closed."] },
  { id: "bubbles", name: "Dr. Bubbles", taste: "crowd", icon: "🫧", says: ["The crowd loved this kind of card.", "Statistically hilarious.", "I ran the numbers."] },
  { id: "finn", name: "Finn", taste: "weird", icon: "🐟", says: ["Delightfully strange.", "Nobody saw that coming.", "Peak chaos."] },
];
const STOP = new Set("the a an and or of to in on for with my is it that this at as by be are was were me i you your his her its".split(" "));
const words = (t) => String(t).toLowerCase().replace(/[^a-z0-9' ]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));
const nWords = (t) => String(t).trim().split(/\s+/).length;
const KINISH = new Set("kin kins memory selfie chat group text voicemail wifi phone app update streaming profile algorithm browser tabs email podcast".split(" "));
// How much a taste likes a card text (liked: words from past winners, for the crowd pleaser).
function like(taste, text, promptText, rng, liked) {
  const w = words(text), n = nWords(text), noise = rng();
  if (taste === "wordy") return n * 1.0 + noise * 3;
  if (taste === "punchy") return 12 - n + noise * 3;
  if (taste === "wild") return noise * 10;
  if (taste === "fitting") {
    const p = new Set(words(promptText));
    return w.filter((x) => p.has(x)).length * 4 + w.filter((x) => KINISH.has(x)).length * 2 + (/ing\b/.test(text.split(" ")[0]) ? 1.5 : 0) + noise * 3;
  }
  if (taste === "crowd") { const l = new Set(liked || []); return w.filter((x) => l.has(x)).length * 3 + noise * 6; }
  if (taste === "weird") return w.filter((x) => x.length >= 8).length * 2 + (/\d/.test(text) ? 2 : 0) + (/\?|!|"/.test(text) ? 1 : 0) + noise * 5;
  return noise * 10;
}
const bySeat = (id) => CAST.find((c) => c.id === id) || CAST[0];
// Hand texts -> the indexes to play (in reading order) for a prompt that takes `pick` cards.
function choose(botId, promptText, pick, hand, rng, liked) {
  const t = bySeat(botId).taste;
  const ranked = hand.map((c, i) => ({ i, s: like(t, c, promptText, rng, liked) })).sort((a, b) => b.s - a.s);
  return ranked.slice(0, pick).map((x) => x.i);
}
// Filled-in answers -> the index it finds funniest.
function judge(botId, filled, promptText, rng, liked) {
  const t = bySeat(botId).taste;
  let best = 0, top = -1e9;
  filled.forEach((f, i) => { const s = like(t, f, promptText, rng, liked); if (s > top) { top = s; best = i; } });
  return best;
}
const quip = (botId, rng) => { const s = bySeat(botId).says; return s[Math.floor(rng() * s.length)]; };
return { CAST, choose, judge, quip, words, bySeat };
});
