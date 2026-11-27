// Chess Clash stage: a torch-lit castle hall with an angled board, the armored pieces walking their moves, and a
// short fight for every capture. All drawn on one canvas, in code; nothing is loaded or fetched.
(function (root) {
  "use strict";
  const R = root.Rigs, SFX = root.ClashSfx || { step() {} };
  const reduce = () => !!(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const lerp = (a, b, k) => a + (b - a) * k, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2), easeOut = (k) => 1 - Math.pow(1 - k, 3), easeIn = (k) => k * k * k;
  const rnd = (a, b) => a + Math.random() * (b - a);

  let cv, g, W = 1, H = 1, DPR = 1, area = { x: 0, y: 0, w: 1, h: 1 };
  const cam = { pitch: 0.74, dist: 15, F: 60, ox: 0, oy: 0, flip: false, yaw: 0, zoom: 1, fx: 0, fy: 0, k: 0, shake: 0 };
  const S = { anim: "full", menu: false, hl: { sel: -1, targets: [], last: null, check: -1, cursor: -1, hover: -1 }, caption: "", letter: 0, speed: 1, time: 0 };
  let actors = [], parts = [], tweens = [], bg = null, bgKey = "", skipping = false, braziers = [], torches = [];

  // ---------- camera ----------
  const sinP = () => Math.sin(cam.pitch), cosP = () => Math.cos(cam.pitch);
  function raw(wx, wy, wz) {
    let x = wx, z = wz; if (cam.flip) { x = -x; z = -z; }
    const c = Math.cos(cam.yaw), s = Math.sin(cam.yaw), xr = x * c - z * s, zr = x * s + z * c;
    const sp = sinP(), cp = cosP(), cy = cam.dist * sp, cz = cam.dist * cp, vy = wy - cy, vz = zr - cz;
    const d = -vy * sp - vz * cp, u = vy * cp - vz * sp;
    return { x: xr / d, y: -u / d, d };
  }
  function project(wx, wy, wz) { const p = raw(wx, wy, wz); return { x: cam.ox + cam.F * p.x, y: cam.oy + cam.F * p.y, s: cam.F / p.d, d: p.d }; }
  function fit() {
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    const saveYaw = cam.yaw; cam.yaw = 0;
    for (const [x, y, z] of [[-4.7, 0, -4.7], [4.7, 0, -4.7], [-4.7, 0, 4.7], [4.7, 0, 4.7], [-4.2, 1.5, -4.2], [4.2, 1.5, -4.2], [-4.7, -0.5, 4.7], [4.7, -0.5, 4.7]]) { const p = raw(x, y, z); x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
    cam.yaw = saveYaw;
    cam.F = Math.min(area.w / (x1 - x0), area.h / (y1 - y0));
    cam.ox = area.x + area.w / 2 - cam.F * (x0 + x1) / 2; cam.oy = area.y + area.h / 2 - cam.F * (y0 + y1) / 2;
  }
  const sqXZ = (sq) => ({ x: (sq & 7) - 3.5, z: 3.5 - (sq >> 3) });
  function pick(sx, sy) {
    const a = (sx - cam.ox) / cam.F, b = -(sy - cam.oy) / cam.F, sp = sinP(), cp = cosP();
    const dir = [a, -sp + b * cp, -cp - b * sp], c0 = [0, cam.dist * sp, cam.dist * cp];
    if (dir[1] >= 0) return -1;
    const t = -c0[1] / dir[1], X = c0[0] + t * dir[0], Z = c0[2] + t * dir[2];
    const c = Math.cos(cam.yaw), s = Math.sin(cam.yaw); let x = X * c + Z * s, z = -X * s + Z * c;
    if (cam.flip) { x = -x; z = -z; }
    const f = Math.floor(x + 4), r = Math.floor(4 - z);
    return f >= 0 && f < 8 && r >= 0 && r < 8 ? r * 8 + f : -1;
  }
  function squareScreen(sq) { const { x, z } = sqXZ(sq); const p = project(x, 0, z); return toScreen(p.x, p.y); }
  function toScreen(x, y) { const z = cam.zoom, k = cam.k; return { x: (x - cam.fx) * z + cam.fx + (W / 2 - cam.fx) * k, y: (y - cam.fy) * z + cam.fy + (H / 2 - cam.fy) * k }; }

  // ---------- the hall (cached) ----------
  function hash(i) { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  function buildBackdrop() {
    const key = [W, H, DPR, Math.round(cam.F), Math.round(cam.ox), Math.round(cam.oy)].join(",");
    if (key === bgKey && bg) return; bgKey = key;
    bg = document.createElement("canvas"); bg.width = Math.round(W * DPR); bg.height = Math.round(H * DPR);
    const b = bg.getContext("2d"); b.setTransform(DPR, 0, 0, DPR, 0, 0);
    const saveYaw = cam.yaw, saveFlip = cam.flip; cam.yaw = 0; cam.flip = false;
    const WZ = -7.6, base = project(0, 0, WZ), wallTop = project(0, 11, WZ);
    // sky beyond the windows and the wall
    b.fillStyle = "#120d0b"; b.fillRect(0, 0, W, H);
    const wy0 = Math.min(0, wallTop.y), wy1 = base.y;
    let gr = b.createLinearGradient(0, wy0, 0, wy1); gr.addColorStop(0, "#1a1412"); gr.addColorStop(1, "#3a2e27"); b.fillStyle = gr; b.fillRect(0, wy0, W, wy1 - wy0);
    // stone blocks on the wall
    const s = base.s, bw = 1.3 * s, bh = 0.62 * s;
    for (let row = 0, y = wy1 - bh; y > wy0 - bh; row++, y -= bh) {
      for (let col = -1, x = (row % 2) * -bw / 2; x < W + bw; col++, x += bw) {
        const h = hash(row * 97 + col * 13), l = 30 + h * 14;
        b.fillStyle = `rgb(${l + 14},${l + 6},${l})`; b.fillRect(x + 1, y + 1, bw - 2, bh - 2);
        b.fillStyle = "rgba(255,220,180,.04)"; b.fillRect(x + 1, y + 1, bw - 2, 2);
      }
    }
    // arches with deep recesses; the middle one a tall stained-glass window
    const arch = (cx, w, h, glass) => {
      const L = project(cx - w / 2, 0, WZ), Rr = project(cx + w / 2, 0, WZ), T = project(cx, h, WZ), x0 = L.x, x1 = Rr.x, yb = L.y, yt = T.y, sh = (x1 - x0) / 2, ys = yt + sh;
      b.save(); b.beginPath(); b.moveTo(x0, yb); b.lineTo(x0, ys); b.quadraticCurveTo(x0, yt, (x0 + x1) / 2, yt - sh * 0.15); b.quadraticCurveTo(x1, yt, x1, ys); b.lineTo(x1, yb); b.closePath();
      if (glass) {
        let lg = b.createLinearGradient(0, yt, 0, yb); lg.addColorStop(0, "#26346e"); lg.addColorStop(0.5, "#3c2a6e"); lg.addColorStop(1, "#1b1530"); b.fillStyle = lg; b.fill(); b.clip();
        const panes = ["#3e5fb8", "#7a3aa0", "#c0892f", "#2f8a8a", "#a02f45", "#5a74d4"];
        for (let i = 0; i < 60; i++) { const px = x0 + hash(i * 3) * (x1 - x0), py = yt + hash(i * 7 + 1) * (yb - yt); b.fillStyle = panes[i % panes.length]; b.globalAlpha = 0.5; b.beginPath(); b.moveTo(px, py - sh * 0.25); b.lineTo(px + sh * 0.2, py); b.lineTo(px, py + sh * 0.25); b.lineTo(px - sh * 0.2, py); b.fill(); }
        b.globalAlpha = 1; b.strokeStyle = "#0d0a12"; b.lineWidth = Math.max(1, s * 0.05);
        for (let i = 1; i < 4; i++) { const xx = x0 + (x1 - x0) * i / 4; b.beginPath(); b.moveTo(xx, yt); b.lineTo(xx, yb); b.stroke(); }
        for (let y = ys; y < yb; y += sh * 0.6) { b.beginPath(); b.moveTo(x0, y); b.lineTo(x1, y); b.stroke(); }
        // rose
        b.beginPath(); b.arc((x0 + x1) / 2, ys, sh * 0.55, 0, Math.PI * 2); b.stroke();
        for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; b.beginPath(); b.moveTo((x0 + x1) / 2, ys); b.lineTo((x0 + x1) / 2 + Math.cos(a) * sh * 0.55, ys + Math.sin(a) * sh * 0.55); b.stroke(); }
        const rg = b.createRadialGradient((x0 + x1) / 2, ys, 0, (x0 + x1) / 2, ys, sh * 3); rg.addColorStop(0, "rgba(140,160,255,.35)"); rg.addColorStop(1, "rgba(0,0,0,0)"); b.fillStyle = rg; b.fillRect(x0, yt, x1 - x0, yb - yt);
      } else {
        let lg = b.createLinearGradient(0, yt, 0, yb); lg.addColorStop(0, "#0b0807"); lg.addColorStop(1, "#191210"); b.fillStyle = lg; b.fill();
      }
      b.restore();
      b.strokeStyle = "#5b4b40"; b.lineWidth = s * 0.22; b.beginPath(); b.moveTo(x0, yb); b.lineTo(x0, ys); b.quadraticCurveTo(x0, yt, (x0 + x1) / 2, yt - sh * 0.15); b.quadraticCurveTo(x1, yt, x1, ys); b.lineTo(x1, yb); b.stroke();
      b.strokeStyle = "rgba(0,0,0,.5)"; b.lineWidth = s * 0.06; b.stroke();
    };
    arch(-8.2, 3.6, 7.2, false); arch(8.2, 3.6, 7.2, false); arch(0, 4.4, 9, true);
    // pillars
    torches = [];
    for (const px of [-4.6, 4.6, -11.5, 11.5]) {
      const L = project(px - 0.75, 0, WZ + 0.6), Rr = project(px + 0.75, 0, WZ + 0.6), T = project(px, 12, WZ + 0.6);
      let pg = b.createLinearGradient(L.x, 0, Rr.x, 0); pg.addColorStop(0, "#2a211c"); pg.addColorStop(0.45, "#6b5a4b"); pg.addColorStop(1, "#231b17");
      b.fillStyle = pg; b.fillRect(L.x, Math.min(T.y, 0), Rr.x - L.x, L.y - Math.min(T.y, 0));
      b.fillStyle = "#4a3c33"; b.fillRect(L.x - s * 0.15, L.y - s * 0.5, Rr.x - L.x + s * 0.3, s * 0.5);
      const tq = project(px, 4.2, WZ + 1.1); torches.push({ x: tq.x, y: tq.y, s: tq.s });
      b.fillStyle = "#1b1512"; b.fillRect(tq.x - s * 0.08, tq.y, s * 0.16, s * 0.7); b.fillStyle = "#3a2e26"; b.beginPath(); b.moveTo(tq.x - s * 0.3, tq.y); b.lineTo(tq.x + s * 0.3, tq.y); b.lineTo(tq.x + s * 0.12, tq.y + s * 0.3); b.lineTo(tq.x - s * 0.12, tq.y + s * 0.3); b.fill();
    }
    // banners: the light house on the left, the dark on the right
    const banner = (cx, side) => {
      const P = R.PAL[side], T = project(cx, 8.2, WZ + 0.4), Bt = project(cx, 3.2, WZ + 0.4), w = s * 1.0;
      b.fillStyle = P.trim; b.fillRect(T.x - w * 0.65, T.y - s * 0.08, w * 1.3, s * 0.12);
      b.beginPath(); b.moveTo(T.x - w / 2, T.y); b.lineTo(T.x + w / 2, T.y); b.lineTo(T.x + w / 2, Bt.y); b.lineTo(T.x, Bt.y - s * 0.5); b.lineTo(T.x - w / 2, Bt.y); b.closePath();
      let lg = b.createLinearGradient(T.x - w / 2, 0, T.x + w / 2, 0); lg.addColorStop(0, P.cloth2); lg.addColorStop(0.5, P.cloth); lg.addColorStop(1, P.cloth2); b.fillStyle = lg; b.fill();
      b.strokeStyle = P.trim; b.lineWidth = s * 0.05; b.stroke();
      b.save(); b.translate(T.x, (T.y + Bt.y) / 2 - s * 0.3); b.scale(s / 28, s / 28); drawEmblem(b, side, P); b.restore();
    };
    banner(-4.6 + 2.3, "w"); banner(4.6 - 2.3, "b"); banner(-11.5 + 1.6, "w"); banner(11.5 - 1.6, "b");
    // floor: flagstones in perspective
    const fy0 = base.y; gr = b.createLinearGradient(0, fy0, 0, H); gr.addColorStop(0, "#2b221d"); gr.addColorStop(1, "#4a3a2f"); b.fillStyle = gr; b.fillRect(0, fy0, W, H - fy0);
    for (let zi = 0; zi < 20; zi++) for (let xi = -12; xi < 12; xi++) {
      const z0 = WZ + zi * 1.5, z1 = z0 + 1.5, off = (zi % 2) * 0.9, x0 = xi * 1.8 + off, x1 = x0 + 1.8;
      const a = project(x0, 0, z0), c = project(x1, 0, z0), d = project(x1, 0, z1), e = project(x0, 0, z1);
      if (Math.max(a.y, e.y) < fy0 - 2 || Math.min(a.d, c.d, d.d, e.d) < 0.8) continue;
      const h = hash(zi * 31 + xi * 7), l = 52 + h * 18;
      b.fillStyle = `rgb(${l + 10},${l},${l - 8})`; b.beginPath(); b.moveTo(a.x, a.y); b.lineTo(c.x, c.y); b.lineTo(d.x, d.y); b.lineTo(e.x, e.y); b.closePath(); b.fill();
      b.strokeStyle = "rgba(10,6,4,.55)"; b.lineWidth = Math.max(1, a.s * 0.04); b.stroke();
    }
    // rug under the board
    const rug = [[-6, -6], [6, -6], [6, 6], [-6, 6]].map(([x, z]) => project(x, 0.001, z));
    b.beginPath(); rug.forEach((p, i) => (i ? b.lineTo(p.x, p.y) : b.moveTo(p.x, p.y))); b.closePath(); b.fillStyle = "#5a1a1c"; b.fill();
    const rug2 = [[-5.6, -5.6], [5.6, -5.6], [5.6, 5.6], [-5.6, 5.6]].map(([x, z]) => project(x, 0.001, z));
    b.beginPath(); rug2.forEach((p, i) => (i ? b.lineTo(p.x, p.y) : b.moveTo(p.x, p.y))); b.closePath(); b.strokeStyle = "#c79a3e"; b.lineWidth = Math.max(1.5, base.s * 0.12); b.stroke();
    // darkness at the back and edges
    gr = b.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, "rgba(5,3,2,.45)"); gr.addColorStop(0.35, "rgba(5,3,2,.08)"); gr.addColorStop(1, "rgba(5,3,2,.35)"); b.fillStyle = gr; b.fillRect(0, 0, W, H);
    cam.yaw = saveYaw; cam.flip = saveFlip;
    braziers = [[-6.3, 2.8], [6.3, 2.8], [-6.1, -4.6], [6.1, -4.6]];
  }
  function drawEmblem(b, side, P) {
    b.fillStyle = P.trim; b.beginPath();
    if (side === "w") { for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8, r = i % 2 ? 4.5 : 10; b.lineTo(Math.cos(a) * r, Math.sin(a) * r); } b.closePath(); b.fill(); b.fillStyle = P.cloth; b.beginPath(); b.arc(0, 0, 3.4, 0, Math.PI * 2); b.fill(); }
    else { b.moveTo(-10, -4); b.lineTo(0, 5); b.lineTo(10, -4); b.lineTo(6, -7); b.lineTo(0, 0); b.lineTo(-6, -7); b.closePath(); b.fill(); b.beginPath(); b.moveTo(-3, 6.5); b.lineTo(0, 10); b.lineTo(3, 6.5); b.fill(); }
  }

  // ---------- board ----------
  function quad(pts) { g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.closePath(); }
  const tilePts = (sq, inset, y) => { const { x, z } = sqXZ(sq), h = 0.5 - (inset || 0); return [[x - h, z - h], [x + h, z - h], [x + h, z + h], [x - h, z + h]].map(([a, c]) => project(a, y || 0.002, c)); };
  function drawBoard(t) {
    // plinth sides (the ones facing the camera)
    const E = 4.45, top = (x, z) => project(x, 0, z), bot = (x, z) => project(x, -0.55, z);
    const faces = [[[-E, E], [E, E]], [[E, E], [E, -E]], [[E, -E], [-E, -E]], [[-E, -E], [-E, E]]];
    for (const [[ax, az], [bx, bz]] of faces) {
      const p0 = top(ax, az), p1 = top(bx, bz), p2 = bot(bx, bz), p3 = bot(ax, az);
      if ((p1.x - p0.x) * (p2.y - p0.y) - (p1.y - p0.y) * (p2.x - p0.x) <= 0) continue;
      quad([p0, p1, p2, p3]); const lg = g.createLinearGradient(0, p0.y, 0, p3.y); lg.addColorStop(0, "#5a3b26"); lg.addColorStop(1, "#22150d"); g.fillStyle = lg; g.fill();
      g.strokeStyle = "#c79a3e"; g.lineWidth = Math.max(1, p0.s * 0.035); g.beginPath(); g.moveTo(lerp(p0.x, p3.x, 0.25), lerp(p0.y, p3.y, 0.25)); g.lineTo(lerp(p1.x, p2.x, 0.25), lerp(p1.y, p2.y, 0.25)); g.stroke();
    }
    // frame
    quad([top(-E, -E), top(E, -E), top(E, E), top(-E, E)]);
    const c0 = top(-E, -E), c1 = top(E, E); let lg = g.createLinearGradient(c0.x, c0.y, c1.x, c1.y); lg.addColorStop(0, "#6e4a2e"); lg.addColorStop(1, "#3c2616"); g.fillStyle = lg; g.fill();
    quad([top(-4.08, -4.08), top(4.08, -4.08), top(4.08, 4.08), top(-4.08, 4.08)]); g.strokeStyle = "#d7ab4a"; g.lineWidth = Math.max(1, c1.s * 0.04); g.stroke();
    // tiles
    for (let sq = 0; sq < 64; sq++) {
      const light = ((sq >> 3) + (sq & 7)) % 2 === 1, pts = tilePts(sq);
      quad(pts);
      const lg2 = g.createLinearGradient(pts[0].x, pts[0].y, pts[2].x, pts[2].y), h = hash(sq) * 10;
      if (light) { lg2.addColorStop(0, `rgb(${226 + h},${211 + h},${178 + h})`); lg2.addColorStop(1, `rgb(${196 + h},${178 + h},${142 + h})`); }
      else { lg2.addColorStop(0, `rgb(${84 + h},${64 + h},${52 + h})`); lg2.addColorStop(1, `rgb(${58 + h},${42 + h},${34 + h})`); }
      g.fillStyle = lg2; g.fill();
      // marble veins
      g.strokeStyle = light ? "rgba(140,110,80,.18)" : "rgba(255,220,190,.06)"; g.lineWidth = Math.max(0.5, pts[0].s * 0.012);
      g.beginPath(); g.moveTo(lerp(pts[0].x, pts[1].x, hash(sq + 1)), lerp(pts[0].y, pts[1].y, hash(sq + 1))); g.quadraticCurveTo((pts[0].x + pts[2].x) / 2, (pts[0].y + pts[2].y) / 2, lerp(pts[3].x, pts[2].x, hash(sq + 2)), lerp(pts[3].y, pts[2].y, hash(sq + 2))); g.stroke();
    }
    // coordinates on the frame
    g.fillStyle = "#f0d48a"; g.textAlign = "center"; g.textBaseline = "middle";
    for (let i = 0; i < 8; i++) {
      const fsq = cam.flip ? 7 - i : i, near = cam.flip ? -4.27 : 4.27, pf = project(fsq - 3.5, 0, near);
      g.font = `600 ${Math.max(9, pf.s * 0.24)}px Georgia, serif`; g.fillText("abcdefgh"[fsq], pf.x, pf.y);
      const rsq = cam.flip ? 7 - i : i, side = cam.flip ? 4.27 : -4.27, pr = project(side, 0, 3.5 - rsq);
      g.font = `600 ${Math.max(9, pr.s * 0.24)}px Georgia, serif`; g.fillText(String(rsq + 1), pr.x, pr.y);
    }
    // highlights
    const hl = S.hl;
    if (hl.last) for (const sq of hl.last) { quad(tilePts(sq, 0.02)); g.fillStyle = "rgba(255,190,70,.28)"; g.fill(); }
    if (hl.check >= 0) { const { x, z } = sqXZ(hl.check), p = project(x, 0, z), r = p.s * 0.75, rg = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, r); rg.addColorStop(0, `rgba(255,40,30,${0.75 + Math.sin(t * 6) * 0.15})`); rg.addColorStop(1, "rgba(255,40,30,0)"); g.fillStyle = rg; g.beginPath(); g.ellipse(p.x, p.y, r, r * 0.62, 0, 0, Math.PI * 2); g.fill(); }
    if (hl.hover >= 0 && hl.hover !== hl.sel) { quad(tilePts(hl.hover, 0.03)); g.fillStyle = "rgba(255,255,255,.1)"; g.fill(); }
    if (hl.sel >= 0) { const pts = tilePts(hl.sel, 0.04); quad(pts); g.fillStyle = "rgba(110,220,255,.22)"; g.fill(); g.strokeStyle = `rgba(150,235,255,${0.7 + Math.sin(t * 5) * 0.3})`; g.lineWidth = Math.max(1.5, pts[0].s * 0.05); g.stroke(); }
    for (const tg of hl.targets) {
      const { x, z } = sqXZ(tg.sq), p = project(x, 0.003, z);
      if (tg.cap) { g.strokeStyle = "rgba(255,90,60,.9)"; g.lineWidth = Math.max(2, p.s * 0.07); g.beginPath(); g.ellipse(p.x, p.y, p.s * 0.4, p.s * 0.4 * 0.62, 0, 0, Math.PI * 2); g.stroke(); }
      else { g.fillStyle = "rgba(120,230,255,.55)"; g.beginPath(); g.ellipse(p.x, p.y, p.s * 0.13, p.s * 0.13 * 0.62, 0, 0, Math.PI * 2); g.fill(); }
    }
    if (hl.cursor >= 0) { const pts = tilePts(hl.cursor, 0.06); quad(pts); g.setLineDash([6, 4]); g.strokeStyle = "rgba(255,255,255,.95)"; g.lineWidth = 2; g.stroke(); g.setLineDash([]); }
  }

  // ---------- fire ----------
  function flame(x, y, s, t, seed, big) {
    const n = big ? 7 : 5;
    g.save(); g.globalCompositeOperation = "lighter";
    const fl = 0.85 + Math.sin(t * 13 + seed) * 0.08 + Math.sin(t * 23 + seed * 2) * 0.06;
    const rg = g.createRadialGradient(x, y - s * 0.3, 0, x, y - s * 0.3, s * (big ? 5 : 3.6) * fl); rg.addColorStop(0, "rgba(255,170,70,.45)"); rg.addColorStop(1, "rgba(255,120,30,0)");
    g.fillStyle = rg; g.beginPath(); g.arc(x, y - s * 0.3, s * (big ? 5 : 3.6) * fl, 0, Math.PI * 2); g.fill();
    for (let i = 0; i < n; i++) {
      const ph = t * (3 + i * 0.7) + seed + i, h = s * (big ? 1.25 : 0.9) * (0.6 + 0.4 * Math.sin(ph * 1.7)), w = s * (big ? 0.34 : 0.24) * (1 - i / n * 0.5), dx = Math.sin(ph) * s * 0.08 + (i - n / 2) * s * 0.06;
      const lg = g.createLinearGradient(x, y, x, y - h); lg.addColorStop(0, "rgba(255,230,140,.9)"); lg.addColorStop(0.5, "rgba(255,130,40,.6)"); lg.addColorStop(1, "rgba(200,40,10,0)");
      g.fillStyle = lg; g.beginPath(); g.moveTo(x + dx - w, y); g.quadraticCurveTo(x + dx - w * 0.8, y - h * 0.6, x + dx + Math.sin(ph * 2) * w * 0.5, y - h); g.quadraticCurveTo(x + dx + w * 0.8, y - h * 0.6, x + dx + w, y); g.closePath(); g.fill();
    }
    g.restore();
  }
  function drawBrazier(wx, wz, t, i) {
    const foot = project(wx, 0, wz), bowl = project(wx, 1.35, wz), s = foot.s;
    g.strokeStyle = "#1c1714"; g.lineWidth = Math.max(2, s * 0.08);
    for (const dx of [-0.32, 0, 0.32]) { const f = project(wx + dx, 0, wz + (dx ? 0.18 : -0.25)); g.beginPath(); g.moveTo(f.x, f.y); g.lineTo(bowl.x, bowl.y + s * 0.15); g.stroke(); }
    g.fillStyle = "#2c2420"; g.beginPath(); g.ellipse(bowl.x, bowl.y, s * 0.42, s * 0.15, 0, 0, Math.PI); g.fill();
    g.fillStyle = "#3d322b"; g.beginPath(); g.ellipse(bowl.x, bowl.y, s * 0.42, s * 0.12, 0, 0, Math.PI * 2); g.fill();
    flame(bowl.x, bowl.y, s * 0.55, t, i * 3.1, true);
    if (Math.random() < 0.35 && !reduce()) parts.push({ kind: "ember", x: wx + rnd(-0.15, 0.15), y: 1.5, z: wz + rnd(-0.1, 0.1), vx: rnd(-0.1, 0.1), vy: rnd(0.4, 0.9), vz: rnd(-0.05, 0.05), life: 0, max: rnd(0.8, 1.8), size: rnd(0.015, 0.03) });
  }

  // ---------- actors ----------
  function actorAt(sq) { const { x, z } = sqXZ(sq); return actors.find((a) => !a.gone && Math.abs(a.x - x) < 0.3 && Math.abs(a.z - z) < 0.3); }
  let nextId = 1;
  function setPieces(b) {
    actors = [];
    for (let sq = 0; sq < 64; sq++) { const p = b[sq]; if (!p) continue; const { x, z } = sqXZ(sq); const w = p === p.toUpperCase(); actors.push(newActor(p.toLowerCase(), w ? "w" : "b", x, z)); }
  }
  function newActor(t, side, x, z) { return { id: nextId++, t, side, x, z, y: 0, face: side === "w" ? 1 : -1, pose: {}, walk: 0, walking: 0, alpha: 1, flash: 0, rot: 0, sq: 1, seed: Math.random() * 6 }; }
  function faceFor(a) { return (a.side === "w") !== cam.flip ? 1 : -1; }
  function drawActor(a, t) {
    const p = project(a.x, a.y, a.z), unit = p.s * 0.0118 * (a.scale || 1);
    if (a.alpha <= 0.01) return;
    const dim = S.pair && !S.pair.includes(a) ? 1 - 0.78 * S.letter : 1;
    g.save(); g.translate(p.x, p.y); g.globalAlpha = a.alpha * dim;
    if (a.rot) g.rotate(a.rot);
    g.scale(a.face * unit, unit * (a.sq || 1));
    if (a.flash > 0.01 && "filter" in g) g.filter = `brightness(${1 + a.flash * 2.4}) saturate(${1 - a.flash * 0.6})`;
    const pose = Object.assign({ t: t + a.seed, seed: a.seed, walk: a.walk, walking: a.walking }, a.pose);
    if (a.selected) pose.bob = (pose.bob || 0) - 3 - Math.abs(Math.sin(t * 4)) * 3;
    R.draw(g, a.t, a.side, pose);
    g.restore();
    if (a.aura) { const c = project(a.x, a.y + 0.6, a.z); g.save(); g.globalCompositeOperation = "lighter"; const rg = g.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.s * 0.9); rg.addColorStop(0, `rgba(255,240,180,${a.aura})`); rg.addColorStop(1, "rgba(255,240,180,0)"); g.fillStyle = rg; g.beginPath(); g.arc(c.x, c.y, c.s * 0.9, 0, Math.PI * 2); g.fill(); g.restore(); }
  }
  function drawShadow(a) {
    if (a.alpha <= 0.05) return;
    const p = project(a.x + 0.06, 0.004, a.z + 0.05), lift = Math.max(0, a.y), r = p.s * (a.t === "n" ? 0.42 : a.t === "r" ? 0.36 : 0.3) * (1 - Math.min(0.5, lift * 0.4));
    const rg = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, r); rg.addColorStop(0, `rgba(0,0,0,${0.55 * a.alpha})`); rg.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = rg; g.beginPath(); g.ellipse(p.x, p.y, r * (a.t === "n" ? 1.4 : 1), r * 0.55, 0, 0, Math.PI * 2); g.fill();
  }

  // ---------- particles ----------
  function addP(o) { if (parts.length < 1400) parts.push(Object.assign({ life: 0, vx: 0, vy: 0, vz: 0, gy: 0 }, o)); }
  function burst(kind, x, y, z, n, o) { for (let i = 0; i < n; i++) addP(Object.assign({ kind, x, y, z }, typeof o === "function" ? o(i) : o)); }
  function drawParts(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const q = parts[i]; q.life += dt; const k = q.life / q.max;
      if (k >= 1) { parts.splice(i, 1); continue; }
      q.vy -= (q.gy || 0) * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
      if (q.kind === "rubble" && q.y < 0) { q.y = 0; q.vy *= -0.35; q.vx *= 0.6; q.vz *= 0.6; }
      const p = project(q.x, q.y, q.z), s = p.s;
      if (q.kind === "spark" || q.kind === "ember" || q.kind === "mote") {
        g.save(); g.globalCompositeOperation = "lighter"; g.globalAlpha = 1 - k;
        g.fillStyle = q.color || (q.kind === "ember" ? "#ffb057" : "#fff1b8");
        if (q.kind === "spark") { const p2 = project(q.x - q.vx * 0.03, q.y - q.vy * 0.03, q.z - q.vz * 0.03); g.strokeStyle = g.fillStyle; g.lineWidth = Math.max(1, s * q.size); g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p2.x, p2.y); g.stroke(); }
        else { g.beginPath(); g.arc(p.x, p.y, Math.max(0.7, s * q.size * (q.kind === "mote" ? 1 + Math.sin(q.life * 20) * 0.3 : 1)), 0, Math.PI * 2); g.fill(); }
        g.restore();
      } else if (q.kind === "dust") {
        const r = s * (q.size + k * (q.grow || 0.4)); g.fillStyle = `rgba(${q.shade || 120},${(q.shade || 120) - 10},${(q.shade || 120) - 20},${0.35 * (1 - k)})`; g.beginPath(); g.arc(p.x, p.y, r, 0, Math.PI * 2); g.fill();
      } else if (q.kind === "rubble") {
        q.rot = (q.rot || 0) + (q.vr || 5) * dt; g.save(); g.translate(p.x, p.y); g.rotate(q.rot); g.globalAlpha = Math.min(1, (1 - k) * 3); g.fillStyle = q.color || "#8a7a68"; const r = s * q.size; g.fillRect(-r, -r * 0.7, r * 2, r * 1.4); g.restore();
      } else if (q.kind === "ring") {
        g.save(); g.globalAlpha = (1 - k) * 0.8; g.strokeStyle = q.color || "rgba(255,230,190,1)"; g.lineWidth = Math.max(1, s * 0.06 * (1 - k)); const r = s * (0.2 + k * (q.size || 1.6)); g.beginPath(); g.ellipse(p.x, p.y, r, r * 0.6, 0, 0, Math.PI * 2); g.stroke(); g.restore();
      } else if (q.kind === "flash") {
        g.save(); g.globalCompositeOperation = "lighter"; const r = s * (q.size || 1) * (0.5 + k); const rg = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, r); rg.addColorStop(0, `rgba(255,250,230,${1 - k})`); rg.addColorStop(0.35, (q.color || "rgba(255,190,90,") + (0.7 * (1 - k)) + ")"); rg.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = rg; g.beginPath(); g.arc(p.x, p.y, r, 0, Math.PI * 2); g.fill(); g.restore();
      } else if (q.kind === "beam") {
        const a = project(q.x, q.y, q.z), b = project(q.x2, q.y2, q.z2);
        g.save(); g.globalCompositeOperation = "lighter"; g.globalAlpha = 1 - k * 0.6;
        for (const [w, col] of [[s * 0.22, q.color], [s * 0.07, "#ffffff"]]) {
          g.strokeStyle = col; g.lineWidth = w; g.lineCap = "round"; g.beginPath(); g.moveTo(a.x, a.y);
          for (let j = 1; j < 9; j++) { const f = j / 9; g.lineTo(lerp(a.x, b.x, f) + rnd(-1, 1) * s * 0.12, lerp(a.y, b.y, f) + rnd(-1, 1) * s * 0.12); }
          g.lineTo(b.x, b.y); g.stroke();
        }
        g.restore();
      } else if (q.kind === "orb") {
        const f = Math.min(1, k * 1.05), x = lerp(q.x, q.x2, f), y = lerp(q.y, q.y2, f) + Math.sin(f * Math.PI) * 0.25, z = lerp(q.z, q.z2, f), o = project(x, y, z);
        g.save(); g.globalCompositeOperation = "lighter"; const r = o.s * 0.28, rg = g.createRadialGradient(o.x, o.y, 0, o.x, o.y, r); rg.addColorStop(0, "rgba(255,255,255,1)"); rg.addColorStop(0.3, q.color); rg.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = rg; g.beginPath(); g.arc(o.x, o.y, r, 0, Math.PI * 2); g.fill(); g.restore();
        if (Math.random() < 0.8) addP({ kind: "mote", x, y, z, vx: rnd(-0.2, 0.2), vy: rnd(-0.2, 0.2), vz: 0, max: 0.4, size: 0.02, color: q.color });
      }
    }
  }

  // ---------- tweens and timing ----------
  function tween(ms, fn, ez) {
    return new Promise((res) => {
      const dur = skipping ? 0 : ms * S.speed;
      if (dur <= 0) { fn(1); return res(); }
      tweens.push({ t0: S.time, dur: dur / 1000, fn, ez: ez || ease, res });
    });
  }
  const wait = (ms) => tween(ms, () => {});
  function runTweens() {
    for (let i = tweens.length - 1; i >= 0; i--) {
      const tw = tweens[i], k = skipping ? 1 : clamp((S.time - tw.t0) / tw.dur, 0, 1);
      tw.fn(tw.ez(k));
      if (k >= 1) { tweens.splice(i, 1); tw.res(); }
    }
  }
  function shake(a) { if (!reduce() && S.anim !== "off") cam.shake = Math.max(cam.shake, a); }

  // ---------- main loop ----------
  let last = 0, crackleT = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now; S.time += dt;
    const t = S.time;
    if (S.menu && !reduce()) cam.yaw = Math.sin(t * 0.16) * 0.1; else cam.yaw = lerp(cam.yaw, 0, Math.min(1, dt * 3));
    runTweens();
    buildBackdrop();
    g.setTransform(DPR, 0, 0, DPR, 0, 0); g.clearRect(0, 0, W, H);
    const z = cam.zoom, kx = (W / 2 - cam.fx) * cam.k, ky = (H / 2 - cam.fy) * cam.k;
    const sx = cam.shake > 0.01 ? rnd(-1, 1) * cam.shake * 9 : 0, sy = cam.shake > 0.01 ? rnd(-1, 1) * cam.shake * 7 : 0;
    cam.shake *= Math.pow(0.02, dt);
    g.setTransform(DPR * z, 0, 0, DPR * z, DPR * (cam.fx * (1 - z) + kx + sx), DPR * (cam.fy * (1 - z) + ky + sy));
    g.drawImage(bg, 0, 0, W, H);
    for (const tq of torches) flame(tq.x, tq.y, tq.s * 0.6, t, tq.x * 0.01, false);
    // far braziers behind the board, then the board, then near braziers with the pieces
    const cd = project(0, 0, 0).d, far = braziers.filter(([x, zz]) => project(x, 0, zz).d > cd), near = braziers.filter(([x, zz]) => project(x, 0, zz).d <= cd);
    far.forEach(([x, zz], i) => drawBrazier(x, zz, t, i));
    drawBoard(t);
    const live = actors.filter((a) => !a.gone);
    live.forEach(drawShadow);
    const sorted = live.map((a) => ({ a, d: project(a.x, 0, a.z).d })).sort((p, q) => q.d - p.d);
    sorted.forEach(({ a }) => drawActor(a, t));
    near.forEach(([x, zz], i) => drawBrazier(x, zz, t, i + 2));
    drawParts(dt);
    // warm light pools and a vignette
    g.save(); g.globalCompositeOperation = "soft-light";
    const lp = project(0, 0, 0.5), rg = g.createRadialGradient(lp.x, lp.y, 0, lp.x, lp.y, lp.s * 8); rg.addColorStop(0, "rgba(255,190,120,.35)"); rg.addColorStop(1, "rgba(30,10,0,.5)");
    g.fillStyle = rg; g.fillRect(-W, -H, W * 3, H * 3); g.restore();
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    const vg = g.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * 0.35, W / 2, H * 0.55, Math.max(W, H) * 0.8); vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,.6)"); g.fillStyle = vg; g.fillRect(0, 0, W, H);
    if (S.letter > 0.01) {
      const h = H * 0.09 * S.letter; g.fillStyle = "#000"; g.fillRect(0, 0, W, h); g.fillRect(0, H - h, W, h);
      if (S.caption) { g.globalAlpha = S.letter; g.fillStyle = "#f3d58c"; g.font = `600 ${Math.max(13, Math.min(24, W * 0.022))}px Georgia, "Times New Roman", serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(S.caption, W / 2, H - h / 2); g.globalAlpha = 1; }
    }
    crackleT -= dt; if (crackleT < 0) { crackleT = rnd(0.15, 0.6); if (!S.quietFire) SFX.crackle && SFX.crackle(); }
    root.requestAnimationFrame(frame);
  }

  // ---------- movement ----------
  const SPEED = { p: 1.5, n: 2.2, b: 2.3, r: 1.25, q: 2.4, k: 1.05 };
  function setFacing(a, tx, tz) { const p0 = project(a.x, 0, a.z), p1 = project(tx, 0, tz); if (Math.abs(p1.x - p0.x) > 2) a.face = p1.x > p0.x ? 1 : -1; }
  async function walk(a, tx, tz, opts) {
    opts = opts || {};
    const dx = tx - a.x, dz = tz - a.z, dist = Math.hypot(dx, dz);
    if (dist < 0.01) return;
    if (S.anim === "off") { a.x = tx; a.z = tz; return; }
    setFacing(a, tx, tz);
    const x0 = a.x, z0 = a.z, fast = S.anim === "fast" || reduce();
    if (a.t === "n" && !opts.straight) {
      // a gallop and a leap
      const ms = (fast ? 420 : 760) + dist * 40;
      SFX.neigh && !fast && SFX.neigh();
      let stepAcc = 0;
      await tween(ms, (k) => {
        a.x = lerp(x0, tx, k); a.z = lerp(z0, tz, k); a.y = Math.sin(Math.PI * k) * Math.min(1.1, 0.35 + dist * 0.28);
        a.walking = 1; a.walk = k * dist * 1.1; a.pose.tuck = Math.sin(Math.PI * k) * 0.8;
        const s = Math.floor(k * 6); if (s > stepAcc && (k < 0.25 || k > 0.8)) { stepAcc = s; SFX.step("hoof"); }
      }, (k) => k);
      a.y = 0; a.pose.tuck = 0; a.walking = 0; SFX.thud && SFX.thud(); burst("dust", tx, 0.05, tz, fast ? 4 : 8, () => ({ vx: rnd(-0.6, 0.6), vy: rnd(0.1, 0.4), vz: rnd(-0.3, 0.3), max: rnd(0.5, 0.9), size: 0.1, grow: 0.3, shade: 140 }));
      return;
    }
    const sp = SPEED[a.t] * (opts.speed || 1) * (fast ? 2.4 : 1), ms = Math.max(fast ? 160 : 380, (dist / sp) * 1000), stride = a.t === "r" ? 0.7 : 0.55;
    let lastStep = 0;
    await tween(ms, (k) => {
      a.x = lerp(x0, tx, k); a.z = lerp(z0, tz, k);
      a.walking = a.t === "b" || a.t === "q" ? 0.45 : 1; a.walk = (k * dist) / stride;
      if (a.t === "q") { a.pose.lift = 6 + Math.sin(k * Math.PI) * 6; if (Math.random() < 0.6) addP({ kind: "mote", x: a.x + rnd(-0.2, 0.2), y: rnd(0.05, 0.5), z: a.z, vy: rnd(0.2, 0.6), max: rnd(0.4, 0.8), size: 0.022, color: R.PAL[a.side].glow }); }
      const st = Math.floor(a.walk * 2);
      if (st > lastStep) { lastStep = st; SFX.step(R.STEP[a.t]); if (a.t === "r") { shake(0.25); burst("dust", a.x, 0.03, a.z, 3, () => ({ vx: rnd(-0.4, 0.4), vy: rnd(0.05, 0.2), vz: rnd(-0.2, 0.2), max: 0.6, size: 0.08, grow: 0.25 })); } }
    }, (k) => (a.t === "k" || a.t === "r" ? k : ease(k)));
    a.walking = 0; a.pose.lift = 0;
  }

  // ---------- the fights ----------
  const chest = (a, h) => ({ x: a.x, y: (h == null ? 0.62 : h) * (a.t === "n" ? 1.15 : 1), z: a.z });
  function hitFx(d, power, color) {
    const c = chest(d);
    burst("spark", c.x, c.y, c.z, Math.round(18 * power), () => ({ vx: rnd(-2.5, 2.5), vy: rnd(-0.5, 2.6), vz: rnd(-1, 1), gy: 5, max: rnd(0.25, 0.6), size: 0.025, color: color }));
    addP({ kind: "flash", x: c.x, y: c.y, z: c.z, max: 0.3, size: 0.9 * power });
    d.flash = 1; tween(260, (k) => { d.flash = 1 - k; });
  }
  async function die(d, style, from) {
    const dirx = Math.sign(d.x - from.x) || 1, dirz = Math.sign(d.z - from.z) * 0.3;
    const away = project(d.x + dirx, 0, d.z).x > project(d.x, 0, d.z).x ? 1 : -1;
    if (style === "fly") {
      const x0 = d.x, z0 = d.z; SFX.fall();
      await tween(700, (k) => { d.x = x0 + dirx * 1.3 * k; d.z = z0 + dirz * k; d.y = Math.sin(Math.PI * k) * 0.9; d.rot = away * k * Math.PI * 1.3; d.alpha = k > 0.75 ? 1 - (k - 0.75) * 4 : 1; }, (k) => k);
      burst("dust", d.x, 0.1, d.z, 12, () => ({ vx: rnd(-0.7, 0.7), vy: rnd(0.1, 0.6), vz: rnd(-0.4, 0.4), max: rnd(0.6, 1.1), size: 0.12, grow: 0.4, shade: 130 }));
    } else if (style === "dissolve") {
      const col = R.PAL[d.side === "w" ? "b" : "w"].glow;
      await tween(800, (k) => { d.alpha = 1 - k; d.y = k * 0.35; if (Math.random() < 0.9) burst("mote", d.x + rnd(-0.25, 0.25), rnd(0.1, 1.1), d.z + rnd(-0.1, 0.1), 2, () => ({ vy: rnd(0.3, 1.1), vx: rnd(-0.2, 0.2), max: rnd(0.5, 1), size: 0.025, color: col })); });
    } else if (style === "crush") {
      SFX.crumble && SFX.crumble();
      burst("rubble", d.x, 0.5, d.z, 18, () => ({ vx: rnd(-1.6, 1.6), vy: rnd(0.4, 2.2), vz: rnd(-0.8, 0.8), gy: 7, max: rnd(0.9, 1.5), size: rnd(0.03, 0.07), vr: rnd(-9, 9), color: d.t === "r" ? R.PAL[d.side].st1 : R.PAL[d.side].m2 }));
      burst("dust", d.x, 0.2, d.z, 14, () => ({ vx: rnd(-0.8, 0.8), vy: rnd(0.1, 0.7), vz: rnd(-0.4, 0.4), max: rnd(0.7, 1.3), size: 0.14, grow: 0.5, shade: 125 }));
      await tween(280, (k) => { d.sq = 1 - k * 0.8; d.alpha = 1 - k * k; });
    } else {
      SFX.fall();
      await tween(560, (k) => { d.rot = away * k * 1.45; d.alpha = k > 0.6 ? 1 - (k - 0.6) * 2.5 : 1; }, easeIn);
      burst("dust", d.x + away * 0.4, 0.05, d.z, 10, () => ({ vx: rnd(-0.6, 0.6), vy: rnd(0.05, 0.4), vz: rnd(-0.3, 0.3), max: rnd(0.6, 1), size: 0.12, grow: 0.35, shade: 135 }));
      if (d.t === "r") burst("rubble", d.x, 0.4, d.z, 10, () => ({ vx: rnd(-1, 1), vy: rnd(0.4, 1.5), vz: rnd(-0.5, 0.5), gy: 7, max: 1, size: 0.05, color: R.PAL[d.side].st1 }));
    }
    d.gone = true;
  }
  const FIGHTS = {
    async p(a, d) { // three spear jabs
      d.pose.guard = 1;
      for (let i = 0; i < 3; i++) {
        SFX.whoosh(); await tween(130, (k) => { a.pose.thrust = k; a.x += 0; });
        if (i < 2) { SFX.clang(); hitFx(d, 0.4); d.pose.head = -0.15; } else { SFX.clang(); SFX.thud(); hitFx(d, 1.1); shake(0.5); }
        await tween(160, (k) => { a.pose.thrust = 1 - k; d.pose.head = -0.15 * (1 - k); });
      }
      return "fall";
    },
    async n(a, d) { // lance charge
      const x0 = a.x, z0 = a.z, dx = Math.sign(d.x - a.x) || (a.face), back = 0.45;
      SFX.neigh && SFX.neigh();
      await tween(380, (k) => { a.pose.rear = Math.sin(k * Math.PI); a.x = x0 - (d.x - x0) * 0.35 * k; a.z = z0 - (d.z - z0) * 0.35 * k; });
      await tween(220, (k) => { a.pose.lance = k; });
      SFX.gallop && SFX.gallop();
      const x1 = a.x, z1 = a.z;
      await tween(300, (k) => { a.x = lerp(x1, d.x - (d.x - x0) * 0.25, k); a.z = lerp(z1, d.z - (d.z - z0) * 0.25, k); a.walking = 1; a.walk += 0.12; }, easeIn);
      a.walking = 0; SFX.clang(); SFX.thud(); hitFx(d, 1.4); shake(0.7);
      const fin = die(d, "fly", a);
      await tween(300, (k) => { a.pose.lance = 1 - k; a.x = lerp(d.x - (d.x - x0) * 0.25, x0, k * 0.5); });
      await fin; void dx; void back;
      return null;
    },
    async b(a, d) { // a bolt of light from the staff
      SFX.magic();
      await tween(480, (k) => { a.pose.cast = k; a.aura = k * 0.35; if (Math.random() < 0.7) addP({ kind: "mote", x: a.x + rnd(-0.4, 0.4), y: rnd(0.3, 1.4), z: a.z, vx: (a.x - a.x) * 0, vy: rnd(-0.2, 0.3), max: 0.5, size: 0.025, color: R.PAL[a.side].glow }); });
      const c = chest(d), src = { x: a.x + a.face * 0.12 * (cam.flip ? -1 : 1), y: 1.2, z: a.z };
      addP({ kind: "orb", x: src.x, y: src.y, z: src.z, x2: c.x, y2: c.y, z2: c.z, max: 0.38, color: R.PAL[a.side].glow });
      await wait(360);
      SFX.zap(); hitFx(d, 1.2, R.PAL[a.side].glow); addP({ kind: "ring", x: d.x, y: 0.02, z: d.z, max: 0.6, size: 1.2, color: R.PAL[a.side].glow });
      const fin = die(d, "dissolve", a);
      await tween(300, (k) => { a.pose.cast = 1 - k; a.aura = 0.35 * (1 - k); });
      await fin; return null;
    },
    async r(a, d) { // the tower raises its fists and slams the floor
      await tween(520, (k) => { a.pose.lift = k; a.pose.rage = k * 0.6; a.pose.bob = -k * 4; });
      await tween(130, (k) => { a.pose.lift = 1 - k * 1.2; a.pose.bob = -4 + k * 8; }, easeIn);
      SFX.smash(); shake(1.2); addP({ kind: "ring", x: d.x, y: 0.02, z: d.z, max: 0.7, size: 2 }); addP({ kind: "flash", x: d.x, y: 0.3, z: d.z, max: 0.25, size: 1.2 });
      d.flash = 1;
      const fin = die(d, "crush", a);
      await tween(380, (k) => { a.pose.lift = -0.2 * (1 - k); a.pose.bob = 4 * (1 - k); a.pose.rage = 0.6 * (1 - k); });
      await fin; return null;
    },
    async q(a, d) { // the queen rises and looses a storm of light
      SFX.magic();
      await tween(560, (k) => { a.pose.cast = k; a.pose.lift = k * 14; a.aura = k * 0.4; const ang = k * 14; addP({ kind: "mote", x: a.x + Math.cos(ang) * 0.4, y: 0.5 + k * 0.6, z: a.z + Math.sin(ang) * 0.2, vy: 0.2, max: 0.5, size: 0.03, color: R.PAL[a.side].glow }); });
      const c = chest(d);
      addP({ kind: "beam", x: a.x, y: 0.95, z: a.z, x2: c.x, y2: c.y, z2: c.z, max: 0.32, color: R.PAL[a.side].glow });
      SFX.blast(); await wait(90); hitFx(d, 1.5, R.PAL[a.side].glow); shake(0.6);
      burst("mote", c.x, c.y, c.z, 24, () => ({ vx: rnd(-1.5, 1.5), vy: rnd(-0.5, 1.5), vz: rnd(-0.6, 0.6), max: rnd(0.4, 0.9), size: 0.03, color: R.PAL[a.side].glow }));
      const fin = die(d, "dissolve", a);
      await tween(400, (k) => { a.pose.cast = 1 - k; a.pose.lift = 14 * (1 - k); a.aura = 0.4 * (1 - k); });
      await fin; return null;
    },
    async k(a, d) { // the king's great overhead strike
      await tween(460, (k) => { a.pose.raise = k; a.pose.shine = k * 0.6; });
      SFX.whoosh();
      await tween(150, (k) => { a.pose.raise = 1 - k; a.pose.strike = k; }, easeIn);
      SFX.clang(); SFX.thud(); hitFx(d, 1.3); shake(0.8);
      const fin = die(d, "fall", a);
      await tween(420, (k) => { a.pose.strike = 1 - k; a.pose.shine = 0.6 * (1 - k); });
      await fin; return null;
    },
  };
  const NAMES = { p: "Pawn", n: "Knight", b: "Bishop", r: "Rook", q: "Queen", k: "King" };
  async function cameraTo(a, d, on) {
    if (reduce()) { S.letter = on ? 1 : 0; return; }
    const mid = project((a.x + d.x) / 2, 0.55, (a.z + d.z) / 2);
    if (on) { cam.fx = mid.x; cam.fy = mid.y; }
    const z1 = S.anim === "fast" ? 1.45 : 1.85, z0 = cam.zoom, k0 = cam.k, l0 = S.letter;
    await tween(on ? 420 : 380, (k) => { cam.zoom = lerp(z0, on ? z1 : 1, k); cam.k = lerp(k0, on ? 1 : 0, k); S.letter = lerp(l0, on ? 1 : 0, k); });
  }

  // Plays a move: the walk, the fight when it captures, castling's rook, en passant and promotion.
  // m: {from, to, p, c, flag, promo}. Resolves when the board can be redrawn from the engine.
  let playing = false;
  async function play(m) {
    playing = true; skipping = false;
    const a = actorAt(m.from); if (!a) { playing = false; return; }
    const to = sqXZ(m.to), capSq = m.flag === "ep" ? m.to + (m.p === "P" ? -8 : 8) : m.c ? m.to : -1, d = capSq >= 0 ? actorAt(capSq) : null;
    S.hl.targets = []; S.hl.sel = -1;
    if (d && S.anim !== "off") {
      const dx = to.x - a.x, dz = to.z - a.z, L = Math.hypot(dx, dz) || 1;
      let sx = d.x - (dx / L) * 0.72, sz = d.z - (dz / L) * 0.72;
      if (a.t === "n") { sx = d.x - Math.sign(dx || 1) * 0.72; sz = d.z; }
      await walk(a, sx, sz);
      setFacing(a, d.x, d.z); setFacing(d, a.x, a.z);
      S.caption = `${a.side === "w" ? "Light" : "Dark"} ${NAMES[a.t]} attacks ${d.side === "w" ? "Light" : "Dark"} ${NAMES[d.t]}`;
      S.pair = [a, d]; await cameraTo(a, d, true);
      const style = await FIGHTS[a.t](a, d);
      if (style) await die(d, style, a);
      d.gone = true;
      await cameraTo(a, d, false); S.caption = ""; S.pair = null;
      await walk(a, to.x, to.z, { straight: true });
    } else {
      if (d) { d.gone = true; SFX.clang(); }
      await walk(a, to.x, to.z);
    }
    if (m.flag === "O-O" || m.flag === "O-O-O") {
      const rf = m.flag === "O-O" ? m.from + 3 : m.from - 4, rt = m.flag === "O-O" ? m.from + 1 : m.from - 1, r = actorAt(rf), rx = sqXZ(rt);
      if (r) await walk(r, rx.x, rx.z);
    }
    if (m.promo) {
      SFX.promote && SFX.promote();
      if (S.anim !== "off") {
        burst("mote", a.x, 0.6, a.z, 40, () => ({ vx: rnd(-0.8, 0.8), vy: rnd(0.2, 1.6), vz: rnd(-0.4, 0.4), max: rnd(0.6, 1.2), size: 0.03, color: "#ffe9a8" }));
        await tween(300, (k) => { a.aura = k; a.flash = k; });
        a.t = m.promo;
        await tween(400, (k) => { a.aura = 1 - k; a.flash = 1 - k; });
      } else a.t = m.promo;
    }
    a.x = to.x; a.z = to.z; a.face = faceFor(a);
    playing = false; skipping = false;
  }
  function skip() { if (playing) skipping = true; }
  // Checkmate: the beaten king sways, then topples where he stands (stays down until the board is rebuilt).
  async function topple(sq, caption) {
    const k = actorAt(sq); if (!k || S.anim === "off") return;
    playing = true; skipping = false;
    S.pair = [k]; S.caption = caption || ""; await cameraTo(k, k, true);
    shake(5); SFX.thud && SFX.thud();
    await tween(520, (t) => { k.rot = Math.sin(t * Math.PI * 3) * 0.08 * (1 - t); k.flash = (1 - t) * 0.6; });
    const away = k.face > 0 ? -1 : 1; SFX.fall && SFX.fall();
    await tween(650, (t) => { k.rot = away * t * t * 1.45; }, (t) => t);
    burst("dust", k.x, 0.1, k.z, 10, () => ({ vx: rnd(-0.7, 0.7), vy: rnd(0.05, 0.3), vz: rnd(-0.4, 0.4), max: rnd(0.5, 0.9), size: 0.09, grow: 0.3, shade: 130 }));
    shake(8); SFX.thud && SFX.thud();
    await tween(900, () => {});
    await cameraTo(k, k, false); S.caption = ""; S.pair = null;
    playing = false; skipping = false;
  }
  function resize() {
    DPR = Math.min(2, root.devicePixelRatio || 1); W = cv.clientWidth || root.innerWidth; H = cv.clientHeight || root.innerHeight;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR); fit(); bgKey = "";
  }
  function init(canvas) {
    cv = canvas; g = cv.getContext("2d"); resize();
    root.addEventListener("resize", () => { resize(); });
    root.requestAnimationFrame(frame);
  }
  function setArea(r) { area = { x: r.x, y: r.y, w: Math.max(50, r.w), h: Math.max(50, r.h) }; fit(); bgKey = ""; }
  function setFlip(f) { if (cam.flip === !!f) return; cam.flip = !!f; actors.forEach((a) => (a.face = faceFor(a))); }
  function setAnim(v) { S.anim = v; S.speed = v === "fast" || reduce() ? 0.5 : 1; }
  function settle(b) { S.pair = null; setPieces(b); actors.forEach((a) => (a.face = faceFor(a))); }
  function select(sq) { actors.forEach((a) => (a.selected = false)); const a = sq >= 0 ? actorAt(sq) : null; if (a) a.selected = true; }

  root.Scene = { init, setArea, setFlip, setAnim, settle, play, skip, topple, pick, squareScreen, select, state: S, cam, get playing() { return playing; }, get actors() { return actors; }, project, shake };
})(typeof self !== "undefined" ? self : this);
