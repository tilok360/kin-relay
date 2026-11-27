// Kin Battleship: original vector art, drawn here in code (no image files, nothing fetched).
// Ships are top-down, bow to the right, one 100-unit square per cell. The background is an
// Iowa-class battleship in side profile at dusk.
(function (root) {
  "use strict";
  let uid = 0;
  const U = 100;

  function defs(id) {
    return `<defs>
      <linearGradient id="h${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#aeb9c4"/><stop offset=".45" stop-color="#7d8a97"/><stop offset="1" stop-color="#46525e"/></linearGradient>
      <linearGradient id="d${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c8ab7c"/><stop offset="1" stop-color="#9c8058"/></linearGradient>
      <linearGradient id="s${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d5dde4"/><stop offset="1" stop-color="#8a96a2"/></linearGradient>
      <linearGradient id="k${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4b5966"/><stop offset=".5" stop-color="#2c3640"/><stop offset="1" stop-color="#1a2128"/></linearGradient>
      <filter id="f${id}" x="-10%" y="-30%" width="120%" height="160%"><feDropShadow dx="0" dy="5" stdDeviation="4" flood-color="#000" flood-opacity=".55"/></filter>
    </defs>`;
  }
  // A pointed hull: bow at the right, rounded stern at the left. top/bottom are the beam edges.
  function hullPath(W, top, bot) {
    const mid = (top + bot) / 2;
    return `M10 ${mid} C10 ${top + 6} 22 ${top} 46 ${top} L${W - 110} ${top} C${W - 46} ${top} ${W - 16} ${mid - 10} ${W - 5} ${mid} C${W - 16} ${mid + 10} ${W - 46} ${bot} ${W - 110} ${bot} L46 ${bot} C22 ${bot} 10 ${bot - 6} 10 ${mid}Z`;
  }
  function turret(x, dir, id, scale) {
    const s = scale || 1, f = dir > 0 ? 1 : -1;
    const barrels = [-6.5, 0, 6.5].map((dy) => `<rect x="${f > 0 ? 18 * s : -18 * s - 44 * s}" y="${50 + dy * s - 1.9 * s}" width="${44 * s}" height="${3.8 * s}" rx="1.6" fill="#2a323a"/>`).join("");
    const body = `<path d="M${-20 * s} ${50 - 13 * s} h${28 * s} a${13 * s} ${13 * s} 0 0 1 0 ${26 * s} h${-28 * s} q${-4 * s} 0 ${-4 * s} ${-4 * s} v${-18 * s} q0 ${-4 * s} ${4 * s} ${-4 * s}z" ${f < 0 ? 'transform="scale(-1 1)"' : ""} fill="#7f8b97" stroke="#38424c" stroke-width="1.6"/>`;
    return `<g transform="translate(${x} 0)">${barrels}${body}<circle cx="${-6 * s * f}" cy="50" r="${3.6 * s}" fill="#56626e"/><rect x="${(f > 0 ? -14 : 6) * s}" y="${50 - 10 * s}" width="${8 * s}" height="${3 * s}" rx="1" fill="#9aa6b2"/></g>`;
  }
  function funnel(x, w, id) {
    return `<ellipse cx="${x}" cy="50" rx="${w}" ry="${w * 0.72}" fill="#5e6a75" stroke="#3a434c" stroke-width="1.5"/><ellipse cx="${x}" cy="50" rx="${w * 0.62}" ry="${w * 0.42}" fill="#151a1f"/>`;
  }
  function deckLines(x0, x1, top, bot) {
    let s = "";
    for (let y = top + 6; y < bot - 3; y += 6) s += `<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="#7d6646" stroke-opacity=".45" stroke-width="1"/>`;
    return s;
  }

  // ship(name, len) -> SVG markup, width len*100, height 100, bow right.
  function ship(nameOrLen, lenIn) {
    const name = typeof nameOrLen === "string" ? nameOrLen : "";
    const len = lenIn || (typeof nameOrLen === "number" ? nameOrLen : 3);
    const W = len * U, id = "s" + (++uid);
    let body = "";
    if (name === "Carrier") {
      body = `<path d="M8 22 L${W - 70} 18 C${W - 30} 20 ${W - 10} 38 ${W - 4} 50 C${W - 10} 62 ${W - 30} 80 ${W - 70} 82 L8 78 C4 66 4 34 8 22Z" fill="url(#h${id})" stroke="#2b333c" stroke-width="2"/>
        <path d="M18 26 L${W - 76} 23 C${W - 44} 25 ${W - 24} 40 ${W - 18} 50 C${W - 24} 60 ${W - 44} 75 ${W - 76} 77 L18 74Z" fill="#4c5660"/>
        <path d="M40 28 L${W - 160} 40" stroke="#e6edf2" stroke-opacity=".55" stroke-width="2.4" stroke-dasharray="12 10"/>
        <line x1="30" y1="50" x2="${W - 40}" y2="50" stroke="#f2f5f7" stroke-opacity=".7" stroke-width="2" stroke-dasharray="16 12"/>
        <rect x="${W - 92}" y="44" width="40" height="12" rx="2" fill="none" stroke="#ffd27a" stroke-opacity=".6" stroke-width="1.5"/>
        <circle cx="${W * 0.32}" cy="50" r="12" fill="none" stroke="#f2f5f7" stroke-opacity=".45" stroke-width="1.6"/>
        <g fill="#c5cdd5" stroke="#5a6570" stroke-width="1">
          <path d="M${W * 0.45} 62 l14 0 l-6 -9 h4 l8 9 h10 l3 -2 v6 l-3 -2 h-10 l-8 9 h-4 l6 -9 l-14 0z"/>
          <path d="M${W * 0.18} 38 l14 0 l-6 -9 h4 l8 9 h10 l3 -2 v6 l-3 -2 h-10 l-8 9 h-4 l6 -9 l-14 0z"/></g>
        <g filter="url(#f${id})"><rect x="${W * 0.58}" y="10" width="70" height="20" rx="4" fill="url(#s${id})" stroke="#3f4a55" stroke-width="1.5"/>
          <rect x="${W * 0.58 + 18}" y="13" width="18" height="14" rx="3" fill="#2d3640"/><circle cx="${W * 0.58 + 52}" cy="20" r="5" fill="#6d7884"/></g>`;
    } else if (name === "Submarine") {
      body = `<path d="M12 50 C12 32 40 28 80 28 L${W - 70} 28 C${W - 26} 28 ${W - 8} 40 ${W - 8} 50 C${W - 8} 60 ${W - 26} 72 ${W - 70} 72 L80 72 C40 72 12 68 12 50Z" fill="url(#k${id})" stroke="#0f1418" stroke-width="2"/>
        <path d="M6 50 L22 38 L22 62Z" fill="#26303a"/>
        <rect x="${W * 0.42}" y="38" width="54" height="24" rx="12" fill="#3c4855" stroke="#141a20" stroke-width="1.6" filter="url(#f${id})"/>
        <rect x="${W * 0.42 + 14}" y="44" width="18" height="12" rx="6" fill="#1c232a"/>
        <line x1="40" y1="50" x2="${W - 30}" y2="50" stroke="#5b6977" stroke-opacity=".5" stroke-width="1.5"/>
        <g fill="#5b6977" opacity=".7"><circle cx="${W * 0.25}" cy="50" r="3"/><circle cx="${W * 0.7}" cy="50" r="3"/></g>`;
    } else {
      const slim = name === "Destroyer", top = slim ? 30 : 22, bot = slim ? 70 : 78;
      const wood = name === "Battleship" || name === "Cruiser";
      body = `<path d="${hullPath(W, top, bot)}" fill="url(#h${id})" stroke="#2b333c" stroke-width="2"/>
        <path d="${hullPath(W, top + 5, bot - 5)}" transform="translate(4 0)" fill="${wood ? `url(#d${id})` : "#6a7682"}"/>
        ${wood ? deckLines(40, W - 60, top + 5, bot - 5) : ""}`;
      if (name === "Battleship") {
        body += turret(W - 92, 1, id) + turret(W - 152, 1, id, 1.05) + turret(70, -1, id)
          + `<g filter="url(#f${id})"><rect x="${W * 0.36}" y="30" width="${W * 0.26}" height="40" rx="8" fill="url(#s${id})" stroke="#46515c" stroke-width="1.5"/>
             <rect x="${W * 0.47}" y="36" width="34" height="28" rx="6" fill="#9aa5b0" stroke="#46515c"/><circle cx="${W * 0.47 + 17}" cy="50" r="7" fill="#56616c"/></g>`
          + funnel(W * 0.41, 10, id) + funnel(W * 0.33, 9, id)
          + `<g fill="#6b7682"><circle cx="${W * 0.3}" cy="31" r="4"/><circle cx="${W * 0.3}" cy="69" r="4"/><circle cx="${W * 0.66}" cy="31" r="4"/><circle cx="${W * 0.66}" cy="69" r="4"/></g>`;
      } else if (name === "Cruiser") {
        body += turret(W - 80, 1, id, .85) + turret(60, -1, id, .85)
          + `<g filter="url(#f${id})"><rect x="${W * 0.36}" y="32" width="${W * 0.24}" height="36" rx="7" fill="url(#s${id})" stroke="#46515c" stroke-width="1.5"/></g>`
          + funnel(W * 0.44, 9, id);
      } else if (name === "Destroyer") {
        body += turret(W - 58, 1, id, .62)
          + `<g filter="url(#f${id})"><rect x="${W * 0.3}" y="38" width="${W * 0.28}" height="24" rx="6" fill="url(#s${id})" stroke="#46515c" stroke-width="1.4"/></g>`
          + funnel(W * 0.26, 7, id)
          + `<rect x="24" y="45" width="20" height="10" rx="3" fill="#56616c"/>`;
      } else {
        body += `<g filter="url(#f${id})"><rect x="${W * 0.35}" y="34" width="${W * 0.3}" height="32" rx="7" fill="url(#s${id})"/></g>`;
      }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} 100" preserveAspectRatio="none" aria-hidden="true">${defs(id)}<g filter="url(#f${id})">${body}</g></svg>`;
  }

  // The Iowa-class battleship at dusk: side profile, bow to the right.
  function iowa() {
    const tur = (x, y, dir, w) => {
      const bw = w || 1;
      const barrels = [0, 7, 14].map((dy) => `<rect x="${dir > 0 ? x + 70 * bw : x - 150 * bw}" y="${y + 9 + dy * 0.55}" width="${150 * bw}" height="5" rx="2.5" fill="#141a22"/>`).join("");
      return `${barrels}<path d="M${x - 8} ${y + 36} L${x + 2} ${y + 6} Q${x + 6} ${y} ${x + 14} ${y} L${x + 82 * bw} ${y} Q${x + 96 * bw} ${y + 2} ${x + 100 * bw} ${y + 14} L${x + 104 * bw} ${y + 36}Z"
        fill="url(#ironSide)" stroke="#0b0f14" stroke-width="1.5" ${dir > 0 ? "" : `transform="translate(${2 * x + 96 * bw} 0) scale(-1 1)"`}/>`;
    };
    const fiveInch = (x, y) => `<path d="M${x} ${y + 16} q0 -14 16 -16 h10 q12 2 12 16z" fill="#1b232d" stroke="#0b0f14"/><rect x="${x + 30}" y="${y + 5}" width="34" height="3" rx="1.5" fill="#121820"/><rect x="${x + 30}" y="${y + 10}" width="34" height="3" rx="1.5" fill="#121820"/>`;
    let windows = "";
    for (let x = 640; x < 960; x += 22) windows += `<rect x="${x}" y="${470 + ((x / 22) % 3) * 22}" width="6" height="4" fill="#ffcf7a" opacity="${0.35 + ((x * 7) % 5) / 10}"/>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0c1530"/><stop offset=".38" stop-color="#3a2a52"/><stop offset=".6" stop-color="#b4566a"/><stop offset=".72" stop-color="#f19a5c"/></linearGradient>
        <radialGradient id="sun" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff1cf"/><stop offset=".35" stop-color="#ffc36e"/><stop offset="1" stop-color="#ff8a4c" stop-opacity="0"/></radialGradient>
        <linearGradient id="seaBg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b3354"/><stop offset=".2" stop-color="#1d2a48"/><stop offset="1" stop-color="#050b16"/></linearGradient>
        <linearGradient id="ironSide" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a4452"/><stop offset=".25" stop-color="#232c38"/><stop offset="1" stop-color="#0f141b"/></linearGradient>
        <linearGradient id="hullG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a3340"/><stop offset=".6" stop-color="#151b24"/><stop offset="1" stop-color="#0a0e14"/></linearGradient>
        <linearGradient id="rim" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#ffb069" stop-opacity=".9"/><stop offset=".6" stop-color="#ff8a4c" stop-opacity=".25"/><stop offset="1" stop-color="#ff8a4c" stop-opacity="0"/></linearGradient>
        <linearGradient id="reflect" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb069" stop-opacity=".55"/><stop offset="1" stop-color="#ffb069" stop-opacity="0"/></linearGradient>
        <filter id="soft"><feGaussianBlur stdDeviation="6"/></filter>
        <filter id="haze"><feGaussianBlur stdDeviation="2.2"/></filter>
      </defs>
      <rect width="1600" height="900" fill="url(#sky)"/>
      <circle cx="1270" cy="610" r="190" fill="url(#sun)"/>
      <g opacity=".55" filter="url(#soft)" fill="#ffb7a0"><ellipse cx="380" cy="300" rx="260" ry="14"/><ellipse cx="980" cy="250" rx="320" ry="10"/><ellipse cx="1320" cy="380" rx="220" ry="9"/></g>
      <g opacity=".35" fill="#2a2140"><ellipse cx="300" cy="200" rx="300" ry="20"/><ellipse cx="1150" cy="160" rx="380" ry="16"/></g>
      <g fill="#fff" opacity=".6"><circle cx="160" cy="90" r="1.2"/><circle cx="520" cy="60" r="1"/><circle cx="820" cy="110" r="1.3"/><circle cx="1500" cy="80" r="1"/><circle cx="1130" cy="40" r="1.1"/></g>
      <rect y="640" width="1600" height="260" fill="url(#seaBg)"/>
      <g fill="#ffb069" filter="url(#soft)"><ellipse cx="1270" cy="660" rx="170" ry="8" opacity=".55"/><ellipse cx="1260" cy="690" rx="130" ry="6" opacity=".4"/><ellipse cx="1285" cy="725" rx="100" ry="6" opacity=".3"/><ellipse cx="1270" cy="770" rx="70" ry="5" opacity=".2"/></g>
      <g class="bg-ship">
        <g class="bg-smoke" opacity=".5" filter="url(#soft)" fill="#3a3440"><circle cx="640" cy="330" r="26"/><circle cx="600" cy="300" r="34"/><circle cx="550" cy="270" r="40"/><circle cx="480" cy="250" r="46"/></g>
        <g filter="url(#haze)" opacity=".98">
          <!-- foremast and mainmast with radar -->
          <path d="M832 340 L840 175 L848 340Z" fill="#141a22"/><rect x="806" y="196" width="68" height="6" rx="3" fill="#141a22"/><rect x="812" y="232" width="56" height="5" rx="2.5" fill="#141a22"/>
          <path d="M790 196 q50 -30 100 0" stroke="#141a22" stroke-width="5" fill="none"/>
          <path d="M560 420 L566 270 L572 420Z" fill="#141a22"/><rect x="540" y="292" width="54" height="5" rx="2.5" fill="#141a22"/>
          <!-- superstructure -->
          <path d="M600 560 L612 470 L700 470 L708 420 L770 420 L780 360 L900 360 L912 420 L960 430 L978 560Z" fill="url(#ironSide)" stroke="#0b0f14" stroke-width="2"/>
          <rect x="800" y="330" width="80" height="34" rx="6" fill="#1d252f" stroke="#0b0f14"/><rect x="820" y="300" width="40" height="32" rx="5" fill="#1a222c" stroke="#0b0f14"/>
          <!-- funnels -->
          <path d="M650 470 L664 380 L716 380 L726 470Z" fill="#1a212b" stroke="#0b0f14" stroke-width="2"/><rect x="660" y="372" width="60" height="12" rx="3" fill="#0e1218"/>
          <path d="M500 520 L512 430 L560 430 L568 520Z" fill="#1a212b" stroke="#0b0f14" stroke-width="2"/><rect x="508" y="422" width="56" height="12" rx="3" fill="#0e1218"/>
          <path d="M430 560 L440 500 L620 500 L630 560Z" fill="url(#ironSide)" stroke="#0b0f14" stroke-width="2"/>
          ${windows}
          <!-- main turrets: two forward (superfiring), one aft -->
          ${tur(1050, 510, 1, 1.05)}${tur(1180, 535, 1, 1)}${tur(300, 535, -1, 1)}
          ${fiveInch(640, 538)}${fiveInch(740, 536)}${fiveInch(880, 536)}
          <!-- hull: low stern, sheer rising to a raked bow -->
          <path d="M120 568 L1120 568 Q1330 560 1500 520 L1512 524 Q1470 600 1440 646 L170 646 Q140 640 128 610Z" fill="url(#hullG)" stroke="#06090d" stroke-width="2"/>
          <path d="M120 568 L1120 568 Q1330 560 1500 520" fill="none" stroke="url(#rim)" stroke-width="4"/>
          <path d="M160 600 L1440 596" stroke="#3a4552" stroke-width="2" opacity=".55"/>
          <path d="M150 568 q-30 -40 -10 -70" stroke="#141a22" stroke-width="3" fill="none"/><path d="M140 500 l26 8 l-26 8z" fill="#8a2c2c"/>
          <g fill="#ffcf7a" opacity=".7"><circle cx="360" cy="584" r="2"/><circle cx="420" cy="584" r="2"/><circle cx="980" cy="582" r="2"/><circle cx="1040" cy="582" r="2"/><circle cx="1240" cy="578" r="2"/></g>
        </g>
        <!-- bow wave and wake -->
        <path d="M1440 646 q-40 -14 -90 0 q60 6 120 -2z" fill="#ffffff" opacity=".55"/>
        <path d="M170 646 q-90 8 -170 4 q80 -14 180 -10z" fill="#ffffff" opacity=".25"/>
      </g>
      <g class="bg-waves" fill="none" stroke="#ffffff" stroke-linecap="round">
        <path d="M0 668 Q200 660 400 668 T800 668 T1200 668 T1600 668" stroke-opacity=".12" stroke-width="2"/>
        <path d="M0 700 Q200 690 400 700 T800 700 T1200 700 T1600 700" stroke-opacity=".09" stroke-width="2.5"/>
        <path d="M0 750 Q200 738 400 750 T800 750 T1200 750 T1600 750" stroke-opacity=".07" stroke-width="3"/>
        <path d="M0 820 Q200 805 400 820 T800 820 T1200 820 T1600 820" stroke-opacity=".05" stroke-width="4"/>
      </g>
    </svg>`;
  }

  const api = { ship, iowa };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ART = api;
})(typeof self !== "undefined" ? self : this);
