// Kin Casino kit: original card, chip, dice and symbol artwork drawn as SVG, and Web Audio sounds (no images, no audio files, no borrowed designs).
const Art = (() => {
  const RED = "#c4142b", BLACK = "#15171d";
  const SUIT = { s: "M12 1C12 1 2 9 2 14.5C2 18.5 7 19.5 10.6 15.8C10.2 19 9.2 21 7.5 23H16.5C14.8 21 13.8 19 13.4 15.8C17 19.5 22 18.5 22 14.5C22 9 12 1 12 1Z",
    h: "M12 22C-3 11 4 0.5 12 7.6C20 0.5 27 11 12 22Z", d: "M12 1L21 12L12 23L3 12Z",
    c: "M12 1.5A5 5 0 0 0 8.6 10A5.2 5.2 0 1 0 10.9 17.4C10.6 19.7 9.6 21.5 7.8 23H16.2C14.4 21.5 13.4 19.7 13.1 17.4A5.2 5.2 0 1 0 15.4 10A5 5 0 0 0 12 1.5Z" };
  const sprite = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${Object.entries(SUIT).map(([k, d]) => `<path id="s-${k}" d="${d}"/>`).join("")}
    <linearGradient id="cf" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fffefa"/><stop offset="1" stop-color="#ece5d3"/></linearGradient>
    <linearGradient id="cb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8d1d33"/><stop offset="1" stop-color="#4d0e1d"/></linearGradient>
    <pattern id="lat" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 7H14M7 0V14" stroke="#e7c36a" stroke-width=".7" opacity=".55"/></pattern></defs></svg>`;
  const pip = (s, x, y, size, flip) => `<use href="#s-${s}" x="${x - size / 2}" y="${y - size / 2}" width="${size}" height="${size}" ${flip ? `transform="rotate(180 ${x} ${y})"` : ""}/>`;
  // Pip positions on the 100 x 140 card: [x, y, upside-down?]
  const L = { 2: [[50, 32], [50, 108, 1]], 3: [[50, 32], [50, 70], [50, 108, 1]], 4: [[30, 32], [70, 32], [30, 108, 1], [70, 108, 1]],
    5: [[30, 32], [70, 32], [50, 70], [30, 108, 1], [70, 108, 1]], 6: [[30, 32], [70, 32], [30, 70], [70, 70], [30, 108, 1], [70, 108, 1]],
    7: [[30, 32], [70, 32], [50, 51], [30, 70], [70, 70], [30, 108, 1], [70, 108, 1]], 8: [[30, 32], [70, 32], [50, 51], [30, 70], [70, 70], [50, 89, 1], [30, 108, 1], [70, 108, 1]],
    9: [[30, 30], [70, 30], [30, 57], [70, 57], [50, 70], [30, 83, 1], [70, 83, 1], [30, 110, 1], [70, 110, 1]],
    10: [[30, 30], [70, 30], [50, 43], [30, 57], [70, 57], [30, 83, 1], [70, 83, 1], [50, 97, 1], [30, 110, 1], [70, 110, 1]] };
  const cache = {};
  function face(c) {
    if (cache[c]) return cache[c];
    const r = c[0], s = c[1], col = s === "h" || s === "d" ? RED : BLACK, label = r === "T" ? "10" : r;
    let mid = "";
    if (r === "A") mid = pip(s, 50, 70, 46);
    else if ("JQK".includes(r)) mid = `<rect x="24" y="26" width="52" height="88" rx="5" fill="none" stroke="${col}" stroke-width="1.6" opacity=".6"/><rect x="29" y="31" width="42" height="78" rx="3" fill="${col}" opacity=".07"/>` +
      `<text x="50" y="82" text-anchor="middle" font-family="Georgia,serif" font-weight="700" font-size="44" fill="${col}">${r}</text>` + pip(s, 36, 44, 14) + pip(s, 64, 96, 14, 1);
    else mid = L[+r || 10].map(([x, y, f]) => pip(s, x, y, 21, f)).join("");
    return (cache[c] = `<svg viewBox="0 0 100 140" aria-label="${r}${s}"><rect x=".7" y=".7" width="98.6" height="138.6" rx="9" fill="url(#cf)" stroke="#00000033" stroke-width="1.2"/><g fill="${col}">` +
      `<text x="11" y="23" text-anchor="middle" font-family="Georgia,serif" font-weight="700" font-size="${label.length > 1 ? 19 : 23}">${label}</text>${pip(s, 11, 35, 12)}` +
      `<g transform="rotate(180 50 70)"><text x="11" y="23" text-anchor="middle" font-family="Georgia,serif" font-weight="700" font-size="${label.length > 1 ? 19 : 23}">${label}</text>${pip(s, 11, 35, 12)}</g>${mid}</g></svg>`);
  }
  const back = `<svg viewBox="0 0 100 140" aria-hidden="true"><rect x=".7" y=".7" width="98.6" height="138.6" rx="9" fill="#fffefa" stroke="#00000033"/><rect x="6" y="6" width="88" height="128" rx="6" fill="url(#cb)"/><rect x="6" y="6" width="88" height="128" rx="6" fill="url(#lat)"/><rect x="10" y="10" width="80" height="120" rx="4" fill="none" stroke="#e7c36a" stroke-width="1.4"/><circle cx="50" cy="70" r="19" fill="#4d0e1d" stroke="#e7c36a" stroke-width="1.6"/><use href="#s-s" x="38" y="58" width="24" height="24" fill="#e7c36a"/></svg>`;
  // One card element: both sides are in it, and the `up` class turns it over.
  function card(c, cls) {
    const d = document.createElement("div"); d.className = "card" + (cls ? " " + cls : "");
    d.innerHTML = `<div class="in"><div class="bk">${back}</div><div class="fc"></div></div>`;
    if (c) show(d, c);
    return d;
  }
  function show(d, c) { const f = d.querySelector(".fc"); if (d.dataset.c !== c) { d.dataset.c = c; f.innerHTML = face(c); } d.classList.add("up"); }
  function hide(d) { d.classList.remove("up"); }

  const DEN = [[1000, "#d9a521", "#8a6200"], [500, "#7a45b8", "#47236f"], [100, "#2a2d36", "#0f1014"], [25, "#238a52", "#0f4a2a"], [5, "#c0313a", "#6e1219"], [1, "#4f7fc4", "#233f70"]];
  const chip = (v, col, dark) => `<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="${dark}"/><circle cx="32" cy="32" r="29" fill="${col}"/><circle cx="32" cy="32" r="25.5" fill="none" stroke="#fff" stroke-width="7" stroke-dasharray="10.7 10.7" opacity=".92"/><circle cx="32" cy="32" r="19" fill="${col}" stroke="#ffffff88" stroke-width="1.3"/><circle cx="32" cy="32" r="29" fill="none" stroke="#00000033" stroke-width="1.5"/><text x="32" y="37.5" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="800" font-size="${v >= 1000 ? 13 : v >= 100 ? 15 : 17}" fill="#fff">${v >= 1000 ? v / 1000 + "k" : v}</text></svg>`;
  // A few towers of chips that add up to `amount` (at most 4 towers of 6 chips are drawn).
  function stack(amount) {
    let left = Math.round(amount), towers = [];
    for (const [v, col, dark] of DEN) { const n = Math.floor(left / v); if (n > 0) { towers.push([v, col, dark, n]); left -= n * v; } }
    towers = towers.slice(0, 4);
    return `<span class="stk">${towers.map(([v, col, dark, n]) => `<span class="tw">${Array.from({ length: Math.min(n, 6) }, (_, i) => `<i style="--i:${i}">${chip(v, col, dark)}</i>`).join("")}</span>`).join("")}</span>`;
  }
  const hue = (s) => { let h = 7; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) % 360; return h; };
  function avatar(name, kind) {
    const h = hue(name), ini = (String(name).trim()[0] || "?").toUpperCase();
    return `<span class="av ${kind}" style="--h:${h}"><b>${ini.replace(/[<&]/g, "?")}</b></span>`;
  }

  // Dice: pips on a rounded ivory square.
  const PIPS = { 1: [[50, 50]], 2: [[28, 28], [72, 72]], 3: [[28, 28], [50, 50], [72, 72]], 4: [[28, 28], [72, 28], [28, 72], [72, 72]],
    5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]], 6: [[28, 26], [72, 26], [28, 50], [72, 50], [28, 74], [72, 74]] };
  const die = (n, red) => `<svg viewBox="0 0 100 100" aria-label="${n}"><rect x="3" y="3" width="94" height="94" rx="20" fill="${red ? "#c8202f" : "#fbf8ef"}" stroke="#0004" stroke-width="2"/><rect x="9" y="7" width="82" height="40" rx="16" fill="#fff" opacity=".18"/>${(PIPS[n] || []).map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9" fill="${red ? "#fff" : n === 1 ? "#c8202f" : "#1b1c22"}"/>`).join("")}</svg>`;
  // Symbols for the reels, the scratch ticket and the money wheel (simple original shapes).
  const SYM = {
    cherry: '<path d="M30 20C42 22 50 30 52 44M52 44C58 30 66 24 76 22" stroke="#2f7d32" stroke-width="5" fill="none"/><path d="M50 18c10-8 24-6 30 2-10 6-22 6-30-2z" fill="#43a047"/><circle cx="32" cy="66" r="17" fill="#d3122f"/><circle cx="66" cy="62" r="17" fill="#e5203a"/><circle cx="26" cy="60" r="5" fill="#fff" opacity=".5"/><circle cx="60" cy="56" r="5" fill="#fff" opacity=".5"/>',
    lemon: '<ellipse cx="50" cy="52" rx="34" ry="25" fill="#f6d21c" stroke="#c9a400" stroke-width="3"/><circle cx="14" cy="52" r="5" fill="#f6d21c"/><circle cx="86" cy="52" r="5" fill="#f6d21c"/><ellipse cx="40" cy="42" rx="10" ry="5" fill="#fff" opacity=".45"/>',
    bell: '<path d="M50 14c-17 0-25 14-25 32v14l-9 12h68l-9-12V46c0-18-8-32-25-32z" fill="#f2b632" stroke="#a66f00" stroke-width="3"/><circle cx="50" cy="80" r="8" fill="#a66f00"/><path d="M37 30c3-6 8-9 13-9" stroke="#fff" stroke-width="5" opacity=".5" fill="none"/>',
    star: '<path d="M50 8l11 26 28 2-21 18 7 28-25-15-25 15 7-28-21-18 28-2z" fill="#ffcc2e" stroke="#c48a00" stroke-width="3" stroke-linejoin="round"/>',
    bar: '<rect x="10" y="32" width="80" height="36" rx="6" fill="#1d1f27" stroke="#e8c46a" stroke-width="3"/><text x="50" y="60" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="900" font-size="24" fill="#e8c46a">BAR</text>',
    seven: '<path d="M22 20h58v12L48 86H32l30-52H22z" fill="#e11d35" stroke="#7d0010" stroke-width="3" stroke-linejoin="round"/>',
    gem: '<path d="M28 22h44l18 20-40 42-40-42z" fill="#3fb6ff" stroke="#0f6ea8" stroke-width="3" stroke-linejoin="round"/><path d="M10 42h80M28 22l10 20 12-20 12 20 10-20M38 42l12 42 12-42" stroke="#0f6ea8" stroke-width="2" fill="none"/>',
    coin: '<circle cx="50" cy="50" r="36" fill="#f2c443" stroke="#a37a00" stroke-width="4"/><circle cx="50" cy="50" r="26" fill="none" stroke="#a37a00" stroke-width="2"/><text x="50" y="61" text-anchor="middle" font-family="Georgia,serif" font-weight="700" font-size="30" fill="#a37a00">K</text>',
    clover: '<g fill="#2e9d4a"><circle cx="38" cy="36" r="15"/><circle cx="62" cy="36" r="15"/><circle cx="38" cy="58" r="15"/><circle cx="62" cy="58" r="15"/></g><path d="M50 50q4 22 16 38" stroke="#1f6e33" stroke-width="5" fill="none"/>',
    horseshoe: '<path d="M24 22v26a26 26 0 0 0 52 0V22h-14v26a12 12 0 0 1-24 0V22z" fill="#9aa3ad" stroke="#5c6670" stroke-width="3"/><g fill="#5c6670"><circle cx="31" cy="32" r="2.5"/><circle cx="69" cy="32" r="2.5"/><circle cx="33" cy="52" r="2.5"/><circle cx="67" cy="52" r="2.5"/></g>',
    crown: '<path d="M14 72l-4-42 22 18 18-28 18 28 22-18-4 42z" fill="#f3c23d" stroke="#a47700" stroke-width="3" stroke-linejoin="round"/><circle cx="50" cy="56" r="6" fill="#d3122f"/><rect x="14" y="72" width="72" height="10" rx="3" fill="#d8a520"/>',
    moon: '<path d="M60 12a38 38 0 1 0 28 56A30 30 0 1 1 60 12z" fill="#cfd8ff" stroke="#6f7fc4" stroke-width="3"/>',
  };
  const sym = (k) => `<svg viewBox="0 0 100 100" aria-label="${k}">${SYM[k] || ""}</svg>`;
  return { sprite, card, show, hide, stack, avatar, chip, face, back, die, sym, DEN };
})();
// Original sounds made with Web Audio: shuffle, deal, chips, dice, wheel ticks, balls, reels, scratching and wins.
const Sfx = (() => {
  let ctx = null, master = null, noise = null, on = true;
  try { on = localStorage.getItem("casino-sound") !== "off"; } catch {}
  function ready() {
    if (!ctx && navigator.userActivation && !navigator.userActivation.hasBeenActive) return false; // no sound before the first tap or key
    if (!ctx) {
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)(); master = ctx.createGain(); master.gain.value = 0.6; master.connect(ctx.destination);
        noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      } catch { ctx = null; }
    }
    if (ctx && ctx.state === "suspended") ctx.resume();
    return on && ctx;
  }
  // A short puff of filtered noise: the base of a card flick, a shuffle riffle, a chip clack or a fold swish.
  function puff(t, dur, f0, f1, gain, type = "bandpass", q = 1.2) {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), at = ctx.currentTime + t;
    s.buffer = noise; s.playbackRate.value = 0.8 + Math.random() * 0.4; f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, at); f.frequency.exponentialRampToValueAtTime(Math.max(40, f1), at + dur);
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(gain, at + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(at, Math.random() * 0.5, dur + 0.05);
  }
  function tone(t, freq, dur, gain, type = "sine", f1) {
    const o = ctx.createOscillator(), g = ctx.createGain(), at = ctx.currentTime + t;
    o.type = type; o.frequency.setValueAtTime(freq, at); if (f1) o.frequency.exponentialRampToValueAtTime(f1, at + dur);
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(gain, at + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g); g.connect(master); o.start(at); o.stop(at + dur + 0.05);
  }
  const sounds = {
    shuffle() { for (let i = 0; i < 16; i++) puff(i * 0.045 + Math.random() * 0.02, 0.05, 2200 + Math.random() * 1800, 1200, 0.22, "bandpass", 0.9); },
    deal() { puff(0, 0.07, 3200, 900, 0.3, "bandpass", 1.5); tone(0.02, 150, 0.06, 0.12, "sine", 90); },
    chips(n = 3) { for (let i = 0; i < Math.min(n, 6); i++) { const t = i * 0.045 + Math.random() * 0.03; tone(t, 2400 + Math.random() * 900, 0.05, 0.1, "triangle", 1500); puff(t, 0.04, 5000, 2500, 0.13, "highpass", 0.7); } },
    check() { tone(0, 190, 0.1, 0.4, "sine", 85); puff(0, 0.05, 900, 300, 0.22, "lowpass"); tone(0.13, 175, 0.1, 0.34, "sine", 80); puff(0.13, 0.05, 900, 300, 0.18, "lowpass"); },
    fold() { puff(0, 0.24, 2400, 300, 0.22, "lowpass", 0.7); },
    turn() { tone(0, 880, 0.3, 0.1, "sine"); tone(0.09, 1320, 0.3, 0.07, "sine"); },
    win() { [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => { tone(i * 0.085, f, 0.5, 0.13, "triangle"); tone(i * 0.085, f * 2, 0.35, 0.04, "sine"); }); sounds.chips(6); },
    lose() { tone(0, 330, 0.35, 0.12, "sine", 220); tone(0.18, 247, 0.5, 0.1, "sine", 165); },
    dice() { for (let i = 0; i < 7; i++) { const t = i * 0.07 + Math.random() * 0.04; tone(t, 300 + Math.random() * 500, 0.04, 0.18, "square", 120); puff(t, 0.05, 1800, 600, 0.2, "bandpass", 2); } },
    tick() { tone(0, 2600, 0.02, 0.06, "square", 1800); },
    spin() { for (let i = 0; i < 30; i++) tone(i * (0.04 + i * 0.004), 2400, 0.02, 0.05, "square", 1700); },
    ball() { tone(0, 900, 0.12, 0.16, "sine", 500); puff(0, 0.08, 2000, 900, 0.15, "bandpass"); },
    reel() { tone(0, 160, 0.09, 0.3, "triangle", 70); puff(0, 0.06, 1400, 400, 0.2, "lowpass"); },
    scratch() { puff(0, 0.09, 5000 + Math.random() * 2000, 2500, 0.08, "highpass", 0.6); },
    flip() { puff(0, 0.06, 2800, 1400, 0.2, "bandpass", 1.1); },
  };
  const play = (name, arg) => { try { if (ready()) sounds[name](arg); } catch {} };
  return { play, unlock: ready, get on() { return on; }, set on(v) { on = !!v; try { localStorage.setItem("casino-sound", on ? "on" : "off"); } catch {} if (on) ready(); } };
})();
