// Chess Clash characters: original layered vector rigs drawn on a canvas, each piece its own armored figure.
// Light: polished steel, gold trim, azure cloth. Dark: blackened iron, bronze trim, crimson cloth.
// Drawn facing right in design units (feet at 0,0; up is -y; a pawn stands about 100 tall).
(function (root) {
  "use strict";
  const PAL = {
    w: { m0: "#f6f8fb", m1: "#c4cdd8", m2: "#7a8695", m3: "#4a5361", trim: "#e7bb52", trim2: "#9c7322", cloth: "#2f5db0", cloth2: "#1b3a78", skin: "#ecc6a2", glow: "#9fe8ff", glow2: "#ffffff",
      st0: "#e6dcc8", st1: "#b7a98f", st2: "#7d705c", horse: "#efebe3", horse2: "#bdb5a8", horse3: "#857c70", hair: "#ecd48a", eye: "#9fe8ff", leather: "#7a5233" },
    b: { m0: "#9aa1ae", m1: "#5b616d", m2: "#30343d", m3: "#16181d", trim: "#d0843c", trim2: "#7a4518", cloth: "#951c2a", cloth2: "#560e17", skin: "#cfa585", glow: "#c77dff", glow2: "#ffd2ff",
      st0: "#77737d", st1: "#4d4a53", st2: "#2a282f", horse: "#3a3740", horse2: "#232128", horse3: "#121115", hair: "#2b1912", eye: "#ff8a3a", leather: "#3e2617" },
  };
  const H = { p: 0.86, n: 1.18, b: 1.06, r: 1.12, q: 1.08, k: 1.16 };
  const STEP = { p: "armor", n: "hoof", b: "soft", r: "heavy", q: "soft", k: "royal" };
  const D = Math.PI / 180;

  // ---- drawing helpers ----
  function lin(g, x0, y0, x1, y1, stops) { const gr = g.createLinearGradient(x0, y0, x1, y1); stops.forEach((c, i) => gr.addColorStop(i / (stops.length - 1), c)); return gr; }
  function limb(g, ax, ay, bx, by, w, P, cloth) {
    g.lineCap = "round"; g.lineJoin = "round";
    g.strokeStyle = cloth ? P.cloth2 : P.m3; g.lineWidth = w; line(g, ax, ay, bx, by);
    g.strokeStyle = cloth ? P.cloth : P.m1; g.lineWidth = w * 0.72; line(g, ax, ay, bx, by);
    g.strokeStyle = cloth ? "rgba(255,255,255,.18)" : P.m0; g.lineWidth = w * 0.22; line(g, ax - w * 0.12, ay - w * 0.05, bx - w * 0.12, by - w * 0.05);
  }
  function line(g, ax, ay, bx, by) { g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke(); }
  function disc(g, x, y, r, fill, stroke, sw) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = sw || 1; g.stroke(); } }
  function ell(g, x, y, rx, ry, rot, fill) { g.beginPath(); g.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2); g.fillStyle = fill; g.fill(); }
  function glow(g, x, y, r, col, a) {
    const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, col); gr.addColorStop(1, "rgba(0,0,0,0)");
    g.save(); g.globalCompositeOperation = "lighter"; g.globalAlpha *= a == null ? 1 : a; g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); g.restore();
  }
  const pt = (x, y, ang, len) => [x + Math.sin(ang) * len, y + Math.cos(ang) * len];
  // Legs: thigh angle a (0 = straight down, + = forward), knee bend k (+ = shin back).
  function leg(g, hx, hy, a, k, P, len, w, boot) {
    const [kx, ky] = pt(hx, hy, a, len), [fx, fy] = pt(kx, ky, a - k, len);
    limb(g, hx, hy, kx, ky, w, P); limb(g, kx, ky, fx, fy, w * 0.86, P);
    disc(g, kx, ky, w * 0.42, P.m1, P.m3, 1.2);
    g.save(); g.translate(fx, fy); g.rotate(-(a - k) * 0.25);
    g.beginPath(); g.moveTo(-w * 0.45, -w * 0.3); g.lineTo(w * 0.95, -w * 0.15); g.quadraticCurveTo(w * 1.15, w * 0.32, w * 0.6, w * 0.4); g.lineTo(-w * 0.5, w * 0.4); g.closePath();
    g.fillStyle = boot || P.m2; g.fill(); g.strokeStyle = P.m3; g.lineWidth = 1; g.stroke(); g.restore();
    return [fx, fy];
  }
  // Arm: shoulder angle s (0 = hanging, + = forward/up), elbow e (+ = forearm further forward). Returns hand pos and forearm angle.
  function arm(g, sx, sy, s, e, P, len, w, cloth) {
    const [ex, ey] = pt(sx, sy, s, len), fa = s + e, [hx, hy] = pt(ex, ey, fa, len * 0.94);
    limb(g, sx, sy, ex, ey, w, P, cloth); limb(g, ex, ey, hx, hy, w * 0.86, P, cloth);
    disc(g, ex, ey, w * 0.4, P.m1, P.m3, 1);
    disc(g, hx, hy, w * 0.48, P.m2, P.m3, 1);
    return { hx, hy, fa };
  }
  function pauldron(g, x, y, r, P) {
    g.beginPath(); g.arc(x, y, r, Math.PI * 1.05, Math.PI * 2.05); g.quadraticCurveTo(x + r * 0.2, y + r * 0.7, x - r, y + r * 0.15); g.closePath();
    g.fillStyle = lin(g, x - r, y - r, x + r, y + r, [P.m0, P.m1, P.m2]); g.fill(); g.strokeStyle = P.trim; g.lineWidth = 1.6; g.stroke();
  }
  function emblem(g, x, y, r, side, P) {
    g.save(); g.translate(x, y);
    if (side === "w") { // sunburst
      g.fillStyle = P.trim; g.beginPath();
      for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8, rr = i % 2 ? r * 0.45 : r; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      g.closePath(); g.fill(); disc(g, 0, 0, r * 0.35, P.cloth);
    } else { // raven-wing chevron
      g.fillStyle = P.trim; g.beginPath(); g.moveTo(-r, -r * 0.4); g.lineTo(0, r * 0.5); g.lineTo(r, -r * 0.4); g.lineTo(r * 0.6, -r * 0.7); g.lineTo(0, 0); g.lineTo(-r * 0.6, -r * 0.7); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(-r * 0.3, r * 0.65); g.lineTo(0, r); g.lineTo(r * 0.3, r * 0.65); g.closePath(); g.fill();
    }
    g.restore();
  }
  function torso(g, P, side, wTop, wBot, yTop, yBot, opts) {
    opts = opts || {};
    g.beginPath(); g.moveTo(-wBot, yBot); g.lineTo(-wTop, yTop + 4); g.quadraticCurveTo(0, yTop - 4, wTop, yTop + 4); g.quadraticCurveTo(wTop + 5, (yTop + yBot) / 2, wBot, yBot); g.closePath();
    g.fillStyle = lin(g, -wTop, 0, wTop + 6, 0, [P.m2, P.m1, P.m0, P.m1]); g.fill(); g.strokeStyle = P.m3; g.lineWidth = 1.4; g.stroke();
    // plate ridges
    g.strokeStyle = "rgba(255,255,255,.35)"; g.lineWidth = 1; line(g, 3, yTop + 3, 5, yBot - 2);
    if (opts.tabard !== false) {
      const t0 = yTop + (opts.tabTop || 10), t1 = yBot + (opts.skirt || 12);
      g.beginPath(); g.moveTo(-wBot * 0.75, t0); g.lineTo(wBot * 0.85, t0); g.lineTo(wBot * 1.05, t1); g.lineTo(-wBot * 0.9, t1); g.closePath();
      g.fillStyle = lin(g, 0, t0, 0, t1, [P.cloth, P.cloth2]); g.fill(); g.strokeStyle = P.trim; g.lineWidth = 1.5; g.stroke();
      emblem(g, 2, t0 + (t1 - t0) * 0.36, Math.min(7, (t1 - t0) * 0.2), side, P);
    }
    g.fillStyle = P.leather; g.fillRect(-wBot, yBot - 3, wBot * 2, 4); disc(g, 2, yBot - 1, 2.4, P.trim);
  }
  function crown(g, x, y, w, h, P, gems) {
    g.beginPath(); g.moveTo(x - w, y); const n = 5;
    for (let i = 0; i <= n; i++) { const px = x - w + (2 * w * i) / n; g.lineTo(px - (i ? w / n : 0) * 0.5, y - h * 0.45); g.lineTo(px, y - h); }
    g.lineTo(x + w, y); g.closePath();
    g.fillStyle = lin(g, x - w, y - h, x + w, y, ["#fff4c2", P.trim, P.trim2]); g.fill(); g.strokeStyle = P.trim2; g.lineWidth = 1; g.stroke();
    if (gems) [x - w * 0.5, x, x + w * 0.5].forEach((gx, i) => disc(g, gx, y - h * 0.22, 1.6, i === 1 ? "#e23b5a" : "#3fb0ff"));
  }

  // ---- pose helpers ----
  function walkLegs(pose, amp) { const ph = (pose.walk || 0) * Math.PI * 2, a = Math.sin(ph) * (amp || 26) * D * (pose.walking || 0); return { f: a, b: -a, kf: Math.max(0, -Math.cos(ph)) * 30 * D * (pose.walking || 0), kb: Math.max(0, Math.cos(ph)) * 30 * D * (pose.walking || 0) }; }
  const bobOf = (pose) => (pose.walking ? -Math.abs(Math.sin((pose.walk || 0) * Math.PI * 2)) * 2.4 * pose.walking : 0) + Math.sin((pose.t || 0) * 2.1 + (pose.seed || 0)) * 0.9;

  // ---- PAWN: footman with kettle helm, round shield and spear ----
  function pawn(g, side, pose) {
    const P = PAL[side], L = walkLegs(pose), bob = bobOf(pose) + (pose.bob || 0);
    const atk = pose.thrust || 0, guard = pose.guard || 0;
    g.save(); g.translate(0, bob);
    // back arm with shield
    const sb = arm(g, -3, -70, 10 * D + guard * 50 * D, 40 * D, P, 15, 7);
    leg(g, -3, -42, L.b, L.kb, P, 20, 8);
    g.save(); g.translate(sb.hx + 2, sb.hy - 4);
    disc(g, 0, 0, 14, lin(g, -14, -14, 14, 14, [P.cloth, P.cloth2]), P.trim, 2.2); emblem(g, 0, 0, 7, side, P); disc(g, 0, 0, 3, P.m1);
    g.restore();
    torso(g, P, side, 12, 10, -73, -42, { skirt: 10, tabTop: 6 });
    leg(g, 3, -42, L.f, L.kf, P, 20, 8);
    // head: face + kettle hat
    g.save(); g.translate(2, -80); g.rotate((pose.head || 0));
    ell(g, 1, 3, 6.5, 7.5, 0, P.skin); ell(g, 3, 4, 3, 1.5, 0, "rgba(0,0,0,.25)");
    g.beginPath(); g.ellipse(0, -3, 10, 8, 0, Math.PI, 0); g.fillStyle = lin(g, -10, -11, 10, 0, [P.m0, P.m1, P.m2]); g.fill();
    g.beginPath(); g.ellipse(0, -2, 15, 3.6, 0, 0, Math.PI * 2); g.fillStyle = P.m1; g.fill(); g.strokeStyle = P.m3; g.lineWidth = 1; g.stroke();
    g.fillStyle = P.trim; g.fillRect(-9, -5, 18, 2);
    g.restore();
    // front arm + spear
    const sa = (pose.armF != null ? pose.armF : 20 * D) + atk * 70 * D, se = (pose.elbF != null ? pose.elbF : 50 * D) - atk * 45 * D;
    const a = arm(g, 5, -70, sa, se, P, 15, 7);
    // spear tip drawn along same line (recompute in world to place head)
    const ang = -(pose.spear != null ? pose.spear : 1.42 - atk * 1.42 + (pose.guard || 0) * -0.3);
    g.save(); g.translate(a.hx, a.hy); g.rotate(ang);
    g.strokeStyle = "#6b4a2b"; g.lineWidth = 3.2; line(g, -34, 0, 52, 0);
    g.beginPath(); g.moveTo(52, -4); g.lineTo(66, 0); g.lineTo(52, 4); g.closePath(); g.fillStyle = lin(g, 52, -4, 66, 4, [P.m0, P.m1]); g.fill(); g.strokeStyle = P.m3; g.lineWidth = 0.8; g.stroke();
    g.fillStyle = P.cloth; g.beginPath(); g.moveTo(46, -2); g.lineTo(40, -10 - Math.sin((pose.t || 0) * 6) * 2); g.lineTo(36, -1); g.fill();
    g.restore();
    g.restore();
  }

  // ---- KING: heavy plate, crowned great helm, fur-trimmed cape, two-handed greatsword ----
  function king(g, side, pose) {
    const P = PAL[side], L = walkLegs(pose, 18), bob = bobOf(pose) * 0.7 + (pose.bob || 0);
    const raise = pose.raise || 0, strike = pose.strike || 0;
    g.save(); g.translate(0, bob);
    // cape
    const sway = Math.sin((pose.t || 0) * 1.6) * 3 + (pose.walking || 0) * -6;
    g.beginPath(); g.moveTo(-10, -86); g.quadraticCurveTo(-30 + sway, -50, -28 + sway, -4); g.lineTo(4, -6); g.lineTo(10, -84); g.closePath();
    g.fillStyle = lin(g, -30, -86, 0, 0, [P.cloth, P.cloth2]); g.fill();
    g.fillStyle = "#f3efe6"; g.beginPath(); g.moveTo(-28 + sway, -8); g.lineTo(4, -9); g.lineTo(4, -3); g.lineTo(-29 + sway, -2); g.fill();
    for (let i = 0; i < 4; i++) disc(g, -22 + sway * 0.9 + i * 7, -5.5, 1, "#222");
    leg(g, -4, -46, L.b, L.kb, P, 22, 10);
    const ab = arm(g, -4, -80, 20 * D + raise * 120 * D - strike * 150 * D, 40 * D - raise * 20 * D, P, 17, 9);
    torso(g, P, side, 17, 13, -84, -46, { skirt: 14, tabTop: 8 });
    pauldron(g, -6, -80, 9, P);
    leg(g, 4, -46, L.f, L.kf, P, 22, 10);
    // head: great helm + crown
    g.save(); g.translate(2, -95); g.rotate(pose.head || 0);
    g.beginPath(); g.moveTo(-9, 8); g.lineTo(-9, -6); g.quadraticCurveTo(0, -13, 10, -6); g.lineTo(10, 8); g.quadraticCurveTo(0, 12, -9, 8); g.closePath();
    g.fillStyle = lin(g, -9, 0, 11, 0, [P.m2, P.m1, P.m0]); g.fill(); g.strokeStyle = P.m3; g.lineWidth = 1.2; g.stroke();
    g.fillStyle = "#08090b"; g.fillRect(2, -2, 9, 2.4); g.fillRect(6, -2, 1.6, 9);
    g.strokeStyle = P.trim; g.lineWidth = 1.4; line(g, -9, 3, 10, 3);
    crown(g, 0.5, -8.5, 10, 9, P, true);
    g.restore();
    // greatsword in both hands
    const sa = 30 * D + raise * 120 * D - strike * 150 * D, af = arm(g, 6, -80, sa, 45 * D - raise * 30 * D, P, 17, 9);
    pauldron(g, 6, -80, 10, P);
    const bladeAng = af.fa + Math.PI - (pose.swordTilt != null ? pose.swordTilt : 0.25) - raise * 0.4 + strike * 0.2;
    g.save(); g.translate(af.hx, af.hy); g.rotate(-bladeAng + Math.PI / 2);
    g.fillStyle = P.leather; g.fillRect(-2, -2, 4, 14); disc(g, 0, 13, 3, P.trim);
    g.fillStyle = P.trim; g.fillRect(-9, -4, 18, 3.4);
    g.beginPath(); g.moveTo(-3, -4); g.lineTo(-2.4, -58); g.lineTo(0, -64); g.lineTo(2.4, -58); g.lineTo(3, -4); g.closePath();
    g.fillStyle = lin(g, -3, 0, 3, 0, [P.m1, "#ffffff", P.m1]); g.fill(); g.strokeStyle = P.m3; g.lineWidth = 0.8; g.stroke();
    if (pose.shine) glow(g, 0, -40, 26, P.glow, pose.shine);
    g.restore();
    g.restore();
  }

  // ---- QUEEN: battle-sorceress in an armored bodice and long gown, floating, with a crown and a magic orb ----
  function queen(g, side, pose) {
    const P = PAL[side], t = pose.t || 0, lift = -6 - Math.sin(t * 1.8 + (pose.seed || 0)) * 3 - (pose.lift || 0), cast = pose.cast || 0;
    g.save(); g.translate(0, lift);
    // hair behind
    g.beginPath(); g.moveTo(-6, -96); g.quadraticCurveTo(-16 - Math.sin(t * 2) * 2, -72, -12, -58); g.lineTo(-2, -66); g.closePath(); g.fillStyle = P.hair; g.fill();
    // back arm
    const back = arm(g, -4, -76, 15 * D + cast * 40 * D, 60 * D, P, 14, 5.5);
    // gown (bell)
    const fl = Math.sin(t * 2.4) * 3;
    g.beginPath(); g.moveTo(-9, -58); g.quadraticCurveTo(-22, -20, -26 + fl, 0); g.quadraticCurveTo(0, 6, 26 - fl, 0); g.quadraticCurveTo(22, -20, 10, -58); g.closePath();
    g.fillStyle = lin(g, -24, -40, 24, 0, [P.cloth2, P.cloth, P.cloth2]); g.fill(); g.strokeStyle = P.trim; g.lineWidth = 1.6; g.stroke();
    for (let i = -2; i <= 2; i++) { g.strokeStyle = "rgba(255,255,255,.12)"; g.lineWidth = 1; g.beginPath(); g.moveTo(i * 3, -56); g.quadraticCurveTo(i * 8, -20, i * 10 + fl * 0.5, 1); g.stroke(); }
    g.beginPath(); g.moveTo(-26 + fl, 0); g.quadraticCurveTo(0, 6, 26 - fl, 0); g.strokeStyle = P.trim; g.lineWidth = 2.4; g.stroke();
    // bodice
    g.beginPath(); g.moveTo(-9, -58); g.lineTo(-10, -78); g.quadraticCurveTo(0, -83, 10, -78); g.lineTo(10, -58); g.quadraticCurveTo(0, -52, -9, -58); g.closePath();
    g.fillStyle = lin(g, -10, 0, 11, 0, [P.m2, P.m1, P.m0]); g.fill(); g.strokeStyle = P.trim; g.lineWidth = 1.2; g.stroke();
    emblem(g, 1, -68, 4.5, side, P);
    pauldron(g, -5, -77, 6, P);
    // head
    g.save(); g.translate(1, -88); g.rotate(pose.head || 0);
    ell(g, 1, 0, 6.5, 7.8, 0, P.skin);
    g.fillStyle = "#2a1b16"; g.fillRect(3, -1.5, 2.2, 1.2);
    g.beginPath(); g.ellipse(-1, -3, 8, 6.5, -0.2, Math.PI * 0.9, Math.PI * 2.05); g.fillStyle = P.hair; g.fill();
    crown(g, 0, -6.5, 7, 8, P, true);
    g.restore();
    // front arm with orb
    const fr = arm(g, 5, -76, (pose.armF != null ? pose.armF : 35 * D) + cast * 55 * D, 50 * D - cast * 40 * D, P, 14, 5.5);
    pauldron(g, 5, -77, 6.5, P);
    const orbR = 4 + cast * 3 + Math.sin(t * 5) * 0.6;
    glow(g, fr.hx + 3, fr.hy - 4, 16 + cast * 26, P.glow, 0.55 + cast * 0.45);
    disc(g, fr.hx + 3, fr.hy - 4, orbR, P.glow2);
    glow(g, back.hx, back.hy, 8 + cast * 14, P.glow, 0.3 + cast * 0.5);
    g.restore();
  }

  // ---- BISHOP: robed battle-cleric with a tall split cowl and a crystal staff; glides ----
  function bishop(g, side, pose) {
    const P = PAL[side], t = pose.t || 0, sway = Math.sin(t * 1.7 + (pose.seed || 0)) * 2 + (pose.walking || 0) * -4, cast = pose.cast || 0;
    g.save(); g.translate(0, -2 - (pose.walking || 0) * 2 + Math.sin(t * 1.7) * 0.6);
    const sb = arm(g, -3, -72, 12 * D, 50 * D, P, 14, 6.5, true);
    // robe
    g.beginPath(); g.moveTo(-11, -74); g.quadraticCurveTo(-18, -30, -20 + sway, 2); g.lineTo(18 + sway * 0.6, 2); g.quadraticCurveTo(16, -30, 11, -74); g.closePath();
    g.fillStyle = lin(g, -18, 0, 18, 0, [P.cloth2, P.cloth, P.cloth2]); g.fill();
    // stole
    g.beginPath(); g.moveTo(-4, -74); g.lineTo(-5 + sway * 0.4, 0); g.lineTo(5 + sway * 0.4, 0); g.lineTo(6, -74); g.closePath();
    g.fillStyle = side === "w" ? "#f2efe7" : "#2a2228"; g.fill(); g.strokeStyle = P.trim; g.lineWidth = 1.4; g.stroke();
    emblem(g, sway * 0.25, -32, 5, side, P);
    g.strokeStyle = P.trim; g.lineWidth = 2; g.beginPath(); g.moveTo(-20 + sway, 1); g.lineTo(18 + sway * 0.6, 1); g.stroke();
    // chain mail collar
    ell(g, 0, -73, 12, 4, 0, P.m1);
    // head with tall split cowl
    g.save(); g.translate(1, -84); g.rotate(pose.head || 0);
    ell(g, 2, 2, 6, 7, 0, P.skin);
    g.fillStyle = "#3b2a22"; g.fillRect(4, 0, 2, 1.2);
    g.beginPath(); g.moveTo(-8, 6); g.lineTo(-9, -6); g.quadraticCurveTo(-6, -26, 0, -32); g.quadraticCurveTo(8, -24, 9, -6); g.lineTo(8, 6); g.quadraticCurveTo(3, -2, -2, 6); g.closePath();
    g.fillStyle = lin(g, -9, -30, 9, 6, [side === "w" ? "#ffffff" : "#3a3038", side === "w" ? "#d9d4c7" : "#1d171c"]); g.fill(); g.strokeStyle = P.trim; g.lineWidth = 1.4; g.stroke();
    g.strokeStyle = P.trim; g.lineWidth = 1.2; line(g, 0, -30, 0, -10); disc(g, 0, -14, 2.2, P.glow);
    g.restore();
    // staff
    const fa = arm(g, 5, -72, (pose.armF != null ? pose.armF : 30 * D) + cast * 70 * D, 70 * D - cast * 50 * D, P, 14, 6.5, true);
    const stAng = -0.05 - cast * 0.55;
    g.save(); g.translate(fa.hx, fa.hy); g.rotate(stAng);
    g.strokeStyle = "#6a4a2a"; g.lineWidth = 3; line(g, 0, 40, 0, -46);
    g.strokeStyle = P.trim; g.lineWidth = 2; g.beginPath(); g.arc(0, -50, 5, Math.PI * 0.2, Math.PI * 1.8); g.stroke();
    g.beginPath(); g.moveTo(0, -60); g.lineTo(3.6, -52); g.lineTo(0, -45); g.lineTo(-3.6, -52); g.closePath(); g.fillStyle = P.glow2; g.fill();
    glow(g, 0, -52, 14 + cast * 30 + Math.sin(t * 4) * 2, P.glow, 0.6 + cast * 0.4);
    g.restore();
    g.restore();
  }

  // ---- ROOK: a living tower of stone, battlements for a head, boulder fists, glowing eye-slit ----
  function rook(g, side, pose) {
    const P = PAL[side], L = walkLegs(pose, 16), t = pose.t || 0, bob = bobOf(pose) * 1.4 + (pose.bob || 0), lift = pose.lift || 0, squash = 1 + (pose.squash || 0);
    g.save(); g.translate(0, bob); g.scale(1 / squash, squash);
    const stone = (x, y, w, h) => { g.fillStyle = lin(g, x, y, x + w, y + h, [P.st0, P.st1, P.st2]); g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, 3) : g.rect(x, y, w, h); g.fill(); g.strokeStyle = "rgba(0,0,0,.35)"; g.lineWidth = 1; g.stroke(); };
    // back arm
    const rb = 15 * D + lift * 140 * D, [bex, bey] = pt(-10, -74, rb, 16), [bhx, bhy] = pt(bex, bey, rb + 0.3, 16);
    g.strokeStyle = P.st2; g.lineWidth = 13; g.lineCap = "round"; line(g, -10, -74, bex, bey); line(g, bex, bey, bhx, bhy);
    disc(g, bhx, bhy, 9, P.st1, "rgba(0,0,0,.4)", 1);
    // legs: stumpy pillars
    const pillar = (x, a) => { g.save(); g.translate(x, -30); g.rotate(-a * 0.8); stone(-7, 0, 14, 30); g.restore(); };
    pillar(-7, L.b); 
    // body: stacked blocks
    stone(-20, -86, 40, 18); stone(-18, -68, 17, 16); stone(1, -68, 17, 16); stone(-17, -52, 34, 20);
    g.strokeStyle = "rgba(0,0,0,.35)"; g.lineWidth = 1; line(g, -4, -86, -4, -68); line(g, 8, -52, 8, -32);
    // moss/rune band
    g.fillStyle = P.cloth; g.fillRect(-20, -71, 40, 3); emblem(g, 0, -42, 6, side, P);
    pillar(7, L.f);
    // head: battlements with eye slit
    g.save(); g.translate(1, -96);
    stone(-13, -6, 26, 14);
    for (let i = 0; i < 4; i++) stone(-13 + i * 7, -13, 5, 8);
    g.fillStyle = "#050506"; g.fillRect(-2, -2, 13, 3.4);
    const eyeA = 0.75 + Math.sin(t * 3 + (pose.seed || 0)) * 0.2 + (pose.rage || 0);
    g.fillStyle = P.eye; g.globalAlpha = Math.min(1, eyeA); g.fillRect(-1, -1.4, 11, 2.2); g.globalAlpha = 1;
    glow(g, 5, -0.5, 14, P.eye, 0.5 * eyeA);
    g.restore();
    // front arm
    const rf = 20 * D + lift * 150 * D + (pose.punch || 0) * 60 * D, [fex, fey] = pt(10, -74, rf, 16), [fhx, fhy] = pt(fex, fey, rf + 0.25, 17);
    g.strokeStyle = P.st1; g.lineWidth = 14; line(g, 10, -74, fex, fey); line(g, fex, fey, fhx, fhy);
    g.strokeStyle = "rgba(255,255,255,.18)"; g.lineWidth = 3; line(g, 8, -76, fex - 3, fey);
    disc(g, fhx, fhy, 10.5, lin(g, fhx - 10, fhy - 10, fhx + 10, fhy + 10, [P.st0, P.st2]), "rgba(0,0,0,.4)", 1);
    stone(-24, -88, 12, 10); stone(12, -88, 12, 10);
    g.restore();
  }

  // ---- KNIGHT: an armored rider on a barded warhorse, plumed helm, couched lance ----
  function knight(g, side, pose) {
    const P = PAL[side], t = pose.t || 0, ph = (pose.walk || 0) * Math.PI * 2, wk = pose.walking || 0, rear = pose.rear || 0, lance = pose.lance || 0;
    g.save();
    g.translate(0, -Math.abs(Math.sin(ph)) * 4 * wk + Math.sin(t * 2) * 0.5 - (pose.jump || 0));
    g.translate(-22, -36); g.rotate(-rear * 0.45); g.translate(22, 36);
    const hleg = (x, y, phase, col, front) => {
      let a = Math.sin(ph + phase) * 32 * D * wk, k = Math.max(0, Math.cos(ph + phase)) * 55 * D * wk;
      if (front && rear) { a -= rear * 70 * D; k += rear * 80 * D; }
      if (pose.tuck) { a += (front ? -1 : 1) * pose.tuck * 40 * D; k += pose.tuck * 60 * D; }
      const [kx, ky] = pt(x, y, a, 17), [fx, fy] = pt(kx, ky, a - k, 17);
      g.strokeStyle = col; g.lineCap = "round"; g.lineWidth = 7; line(g, x, y, kx, ky); g.lineWidth = 5; line(g, kx, ky, fx, fy);
      g.fillStyle = "#17120f"; g.beginPath(); g.ellipse(fx + 1, fy + 0.5, 3.6, 2, 0, 0, Math.PI * 2); g.fill();
    };
    // far legs
    hleg(-18, -36, Math.PI, P.horse3, false); hleg(18, -36, 0, P.horse3, true);
    // tail
    g.strokeStyle = P.hair; g.lineWidth = 5; g.beginPath(); g.moveTo(-30, -50); g.quadraticCurveTo(-44, -40 + Math.sin(t * 3) * 3 + wk * -6, -40, -22); g.stroke();
    // neck and head, in front of the body
    const nod = Math.sin(t * 2.2) * 0.05 + wk * Math.sin(ph * 2) * 0.06 - rear * 0.25;
    g.save(); g.translate(22, -52); g.rotate(nod);
    g.beginPath(); g.moveTo(-8, 6); g.quadraticCurveTo(-4, -18, 6, -30); g.lineTo(18, -26); g.quadraticCurveTo(12, -8, 10, 8); g.closePath();
    g.fillStyle = lin(g, -8, -30, 16, 8, [P.horse, P.horse2]); g.fill();
    g.fillStyle = P.hair; g.beginPath(); g.moveTo(-8, 4); g.quadraticCurveTo(-6, -18, 5, -31); g.lineTo(1, -18); g.quadraticCurveTo(-3, -6, -2, 6); g.closePath(); g.fill();
    // head
    g.save(); g.translate(12, -29); g.rotate(0.85);
    g.beginPath(); g.moveTo(-6, -7); g.quadraticCurveTo(10, -9, 22, -4); g.quadraticCurveTo(26, 1, 21, 5); g.quadraticCurveTo(8, 7, -6, 6); g.closePath();
    g.fillStyle = lin(g, -6, -8, 24, 6, [P.horse, P.horse2]); g.fill();
    // chanfron (face armor)
    g.beginPath(); g.moveTo(-3, -8); g.quadraticCurveTo(10, -10, 19, -5); g.lineTo(17, -1); g.quadraticCurveTo(8, -3, -2, -1); g.closePath();
    g.fillStyle = lin(g, 0, -9, 0, 0, [P.m0, P.m2]); g.fill(); g.strokeStyle = P.trim; g.lineWidth = 0.9; g.stroke();
    disc(g, 2, -2, 1.5, "#111"); disc(g, 22, 1.5, 1, "#2a1a14");
    g.fillStyle = P.horse2; g.beginPath(); g.moveTo(-4, -7); g.lineTo(-8, -15); g.lineTo(-0.5, -8); g.closePath(); g.fill();
    g.strokeStyle = P.leather; g.lineWidth = 1.2; line(g, 4, 2, -14, 14);
    g.restore(); g.restore();
    // body
    ell(g, 0, -47, 31, 14, 0, lin(g, 0, -61, 0, -33, [P.horse, P.horse2, P.horse3]));
    // barding
    g.beginPath(); g.moveTo(-29, -54); g.quadraticCurveTo(-2, -64, 26, -54); g.lineTo(28, -40);
    for (let x = 28; x >= -28; x -= 8) { g.lineTo(x - 4, -33 + Math.sin(t * 3 + x) * 0.8); g.lineTo(x - 8, -40); }
    g.closePath(); g.fillStyle = lin(g, 0, -62, 0, -32, [P.cloth, P.cloth2]); g.fill(); g.strokeStyle = P.trim; g.lineWidth = 1.5; g.stroke();
    emblem(g, 6, -45, 6, side, P);
    // saddle
    g.fillStyle = P.leather; g.beginPath(); g.ellipse(-6, -60, 11, 4, 0, Math.PI, 0); g.fill();
    // near legs
    hleg(-14, -38, 0, P.horse2, false); hleg(22, -38, Math.PI, P.horse2, true);
    // rider: shield on the far side first
    g.save(); g.translate(-8, -60);
    g.save(); g.translate(-9, -16); g.rotate(-0.15);
    g.beginPath(); g.moveTo(-9, -11); g.lineTo(9, -11); g.lineTo(8, 4); g.quadraticCurveTo(0, 14, -8, 4); g.closePath();
    g.fillStyle = lin(g, 0, -11, 0, 12, [P.cloth, P.cloth2]); g.fill(); g.strokeStyle = P.trim; g.lineWidth = 1.8; g.stroke(); emblem(g, 0, -2, 5, side, P); g.restore();
    torso(g, P, side, 10, 8, -30, -2, { skirt: 4, tabTop: 6 });
    limb(g, 2, -2, 12, 8, 7, P); limb(g, 12, 8, 10, 20, 6, P);
    g.fillStyle = P.m2; g.fillRect(8, 18, 7, 3);
    // helm with plume
    g.save(); g.translate(2, -38); g.rotate(pose.head || 0);
    g.beginPath(); g.moveTo(-7, 6); g.lineTo(-7, -4); g.quadraticCurveTo(0, -11, 8, -4); g.lineTo(9, 3); g.lineTo(3, 7); g.closePath();
    g.fillStyle = lin(g, -7, 0, 9, 0, [P.m2, P.m1, P.m0]); g.fill(); g.strokeStyle = P.m3; g.lineWidth = 1; g.stroke();
    g.fillStyle = "#08090b"; g.fillRect(2, -2, 7, 2);
    const pl = Math.sin(t * 3) * 2 - wk * 6;
    g.beginPath(); g.moveTo(-2, -8); g.quadraticCurveTo(-14 + pl, -18, -24 + pl, -6); g.quadraticCurveTo(-12, -10, -3, -4); g.closePath(); g.fillStyle = P.cloth; g.fill();
    g.restore();
    pauldron(g, 4, -27, 6, P);
    // lance arm: couched under the arm, nearly level when charging
    const la = arm(g, 4, -26, 70 * D, 30 * D, P, 10, 5.5);
    g.save(); g.translate(la.hx - 6, la.hy); g.rotate(-1.22 + lance * 1.22 - (pose.lanceUp || 0) * 0.6);
    g.beginPath(); g.moveTo(-26, -2); g.lineTo(80, -1.1); g.lineTo(86, 0); g.lineTo(80, 1.1); g.lineTo(-26, 2); g.closePath(); g.fillStyle = lin(g, 0, -2, 0, 2, [P.m0, P.m1]); g.fill();
    g.beginPath(); g.moveTo(2, -6); g.quadraticCurveTo(12, -3, 16, 0); g.quadraticCurveTo(12, 3, 2, 6); g.closePath(); g.fillStyle = P.trim; g.fill();
    g.fillStyle = P.cloth; g.beginPath(); g.moveTo(60, -1); g.lineTo(48, -8 - Math.sin(t * 7) * 2); g.lineTo(46, -1); g.fill();
    g.restore();
    g.restore();
    g.restore();
  }

  const DRAW = { p: pawn, n: knight, b: bishop, r: rook, q: queen, k: king };
  function draw(g, type, side, pose) { (DRAW[type] || pawn)(g, side, pose || {}); }
  // A small portrait of a piece on its own canvas (captured trays, promotion picker).
  function portrait(type, side, px, dpr) {
    const c = document.createElement("canvas"), d = dpr || Math.min(2, (typeof devicePixelRatio === "number" && devicePixelRatio) || 1);
    c.width = Math.round(px * d); c.height = Math.round(px * d); c.style.width = px + "px"; c.style.height = px + "px";
    const g = c.getContext("2d"), sc = (px * 0.86) / (112 * (type === "n" ? 1.05 : 1));
    g.setTransform(d * sc * (side === "b" ? -1 : 1), 0, 0, d * sc, d * px / 2, d * px * 0.95);
    draw(g, type, side, { t: 0.6 });
    return c;
  }
  root.Rigs = { draw, portrait, PAL, H, STEP };
})(typeof self !== "undefined" ? self : this);
