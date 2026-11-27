// Original card, chip and avatar artwork, drawn as SVG (no images, no borrowed designs).
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
  return { sprite, card, show, hide, stack, avatar, chip, face, back };
})();
