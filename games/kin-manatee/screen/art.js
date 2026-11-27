// Original art, drawn as SVG: the manatee, the card back, avatars and the crown. No images are loaded.
const Art = (() => {
  const MANATEE = `<symbol id="manatee" viewBox="0 0 120 80">
    <circle cx="96" cy="16" r="3.2" fill="none" stroke="currentColor" stroke-width="1.4" opacity=".8"/><circle cx="104" cy="7" r="2" fill="none" stroke="currentColor" stroke-width="1.2" opacity=".7"/><circle cx="90" cy="9" r="1.4" fill="none" stroke="currentColor" stroke-width="1" opacity=".6"/>
    <path d="M20 46 C6 34 0 56 5 63 C10 70 22 60 25 51 Z" fill="#94cfd3"/>
    <path d="M21 49 C23 32 50 25 75 28 C92 30 104 38 106 48 C108 58 98 65 84 65 C62 67 34 65 21 49 Z" fill="#a9dcdf"/>
    <path d="M33 58 C52 67 80 67 97 58 C86 64 52 67 33 58 Z" fill="#d3f2f3"/><path d="M68 59 C66 69 72 75 79 71 C82 67 78 61 73 59 Z" fill="#86c2c7"/>
    <ellipse cx="104" cy="51" rx="9.5" ry="8" fill="#c2e8ea"/>
    <circle cx="101" cy="49" r=".9" fill="#4a7c80"/><circle cx="104" cy="48" r=".9" fill="#4a7c80"/><circle cx="107" cy="49" r=".9" fill="#4a7c80"/><circle cx="103" cy="52" r=".9" fill="#4a7c80"/><circle cx="106" cy="52" r=".9" fill="#4a7c80"/>
    <circle cx="93" cy="42" r="2.1" fill="#16323a"/><circle cx="93.7" cy="41.3" r=".7" fill="#fff"/>
    <path d="M99 56 q4.5 3.2 9 0" stroke="#4a7c80" fill="none" stroke-width="1.3" stroke-linecap="round"/>
    <path d="M40 40 q6 -3 12 0 M56 36 q6 -3 12 0" stroke="#8cc6cb" fill="none" stroke-width="1.2" stroke-linecap="round" opacity=".7"/></symbol>`;
  // A tiny glyph for each computer player, drawn in a 24-unit box.
  const GLYPH = {
    barnacle: '<path d="M12 4v13M7 8h10M5 14c1 4 4 6 7 6s6-2 7-6" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="12" cy="5" r="1.8" fill="#fff"/>',
    pearl: '<path d="M4 15c0-5 4-9 8-9s8 4 8 9H4z" fill="#fff"/><path d="M12 6v9M8 7.5l2 7.5M16 7.5l-2 7.5" stroke="#9aa" stroke-width="1"/><circle cx="12" cy="18" r="2" fill="#fff"/>',
    kelp: '<path d="M12 21c-3-4 3-6 0-10s3-6 0-9M12 21c3-3-2-5 1-8" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round"/>',
    wavy: '<path d="M3 9c3-3 6 3 9 0s6 3 9 0M3 15c3-3 6 3 9 0s6 3 9 0" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round"/>',
    bubbles: '<circle cx="9" cy="14" r="5" fill="none" stroke="#fff" stroke-width="2"/><circle cx="16.5" cy="8" r="3" fill="none" stroke="#fff" stroke-width="2"/><circle cx="17" cy="17" r="1.6" fill="#fff"/>',
    finn: '<path d="M3 12c4-6 11-6 14 0-3 6-10 6-14 0zM17 12l5-4v8z" fill="#fff"/><circle cx="8" cy="11" r="1.1" fill="#124"/>',
  };
  const HUE = { barnacle: 205, pearl: 330, kelp: 140, wavy: 188, bubbles: 265, finn: 28 };
  const hash = (s) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
  // An avatar: a coloured disc with a glyph (computer players), an initial (people) or an initial with a sparkle ring (Kins).
  function avatar(name, kind, botId) {
    const hue = botId ? HUE[botId] : hash(name) % 360, bg = `hsl(${hue} 55% ${kind === "kin" ? 42 : 38}%)`;
    const inner = botId && GLYPH[botId] ? GLYPH[botId] : `<text x="12" y="16.5" text-anchor="middle" font-size="12" font-weight="800" fill="#fff" font-family="system-ui,sans-serif">${(String(name).trim()[0] || "?").toUpperCase().replace(/[<&]/g, "")}</text>`;
    const ring = kind === "kin" ? '<circle cx="12" cy="12" r="11" fill="none" stroke="#ffe08a" stroke-width="1.2" stroke-dasharray="2 2.4"/>' : "";
    return `<svg viewBox="0 0 24 24" class="av" aria-hidden="true"><circle cx="12" cy="12" r="12" fill="${bg}"/>${ring}${inner}</svg>`;
  }
  const crown = '<svg viewBox="0 0 24 16" class="crown" aria-hidden="true"><path d="M2 14L1 3l6 5 5-7 5 7 6-5-1 11z" fill="#f4c95d" stroke="#b8860b" stroke-width="1"/></svg>';
  const logo = '<svg viewBox="0 0 120 80" class="logo" aria-hidden="true" style="color:#bfeef0"><use href="#manatee"/></svg>';
  document.getElementById("sprite").innerHTML = `<svg width="0" height="0" style="position:absolute"><defs>${MANATEE}</defs></svg>`;
  return { avatar, crown, logo, HUE };
})();
