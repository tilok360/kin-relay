// Kin Casino stage: the animated part of each table (wheels and ball, dice, dealt cards, reels, ball draws,
// the scratch ticket). Stage.show(...) draws a round and resolves when its animation has finished.
const Stage = (() => {
  const U = Games.util;
  let host = null, built = "", roundKey = "", motion = true, dealt = {};
  const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const wait = (ms) => new Promise((r) => setTimeout(r, motion ? ms : 0));
  const NS = "http://www.w3.org/2000/svg";
  const polar = (r, deg) => { const a = ((deg - 90) * Math.PI) / 180; return [50 + r * Math.cos(a), 50 + r * Math.sin(a)]; };
  const wedge = (r0, r1, a0, a1) => { const [x0, y0] = polar(r1, a0), [x1, y1] = polar(r1, a1), [x2, y2] = polar(r0, a1), [x3, y3] = polar(r0, a0); return `M${x0} ${y0}A${r1} ${r1} 0 0 1 ${x1} ${y1}L${x2} ${y2}A${r0} ${r0} 0 0 0 ${x3} ${y3}Z`; };
  const COL = { red: "#b3122a", black: "#17181d", green: "#0f7a44" };

  // ---------- wheels ----------
  function rouletteSvg() {
    const st = 360 / 37; let s = "";
    U.wheel.forEach((n, i) => {
      const a = i * st, [tx, ty] = polar(40.5, a + st / 2);
      s += `<path d="${wedge(31, 45, a, a + st)}" fill="${COL[U.colorOf(n)]}" stroke="#e8c46a" stroke-width=".3"/><text x="${tx}" y="${ty}" transform="rotate(${a + st / 2} ${tx} ${ty})" text-anchor="middle" dominant-baseline="central" font-size="3.6" font-weight="700" fill="#fff" font-family="system-ui,sans-serif">${n}</text>`;
      s += `<path d="${wedge(24, 31, a, a + st)}" fill="#3b2412" stroke="#c9a24f" stroke-width=".3"/>`;
    });
    return `<svg viewBox="0 0 100 100" class="wheel rl"><circle cx="50" cy="50" r="49" fill="#4a2a12" stroke="#c9a24f" stroke-width="1.5"/><circle cx="50" cy="50" r="46" fill="#6b3d1a"/>
      <g class="spin">${s}<circle cx="50" cy="50" r="24" fill="url(#cone)"/>${[0, 90, 180, 270].map((a) => `<path d="M50 50L${polar(20, a).join(" ")}" stroke="#e8c46a" stroke-width="2.4" stroke-linecap="round"/>`).join("")}<circle cx="50" cy="50" r="5" fill="#e8c46a"/></g>
      <g class="orbit"><circle class="ball" cx="50" cy="3.5" r="2" fill="#fafafa" stroke="#999" stroke-width=".3"/></g>
      <defs><radialGradient id="cone"><stop offset="0" stop-color="#c9a24f"/><stop offset="1" stop-color="#5a3414"/></radialGradient></defs></svg>`;
  }
  const B6COL = { 1: "#2b6cb0", 2: "#c53030", 5: "#2f855a", 10: "#6b46c1", 20: "#d69e2e", star: "#111", moon: "#111" };
  function big6Svg() {
    const segs = Games.by.big6.segs, st = 360 / segs.length; let s = "";
    segs.forEach((v, i) => {
      const a = i * st, [tx, ty] = polar(38, a + st / 2);
      s += `<path d="${wedge(16, 47, a, a + st)}" fill="${B6COL[v]}" stroke="#f3e2b0" stroke-width=".35"/>`;
      s += typeof v === "number" ? `<text x="${tx}" y="${ty}" transform="rotate(${a + st / 2} ${tx} ${ty})" text-anchor="middle" dominant-baseline="central" font-size="4" font-weight="800" fill="#fff" font-family="system-ui,sans-serif">${v}</text>`
        : `<g transform="translate(${tx - 3} ${ty - 3}) rotate(${a + st / 2} 3 3) scale(.06)">${Art.sym(v).replace(/<\/?svg[^>]*>/g, "")}</g>`;
    });
    return `<svg viewBox="0 0 100 106" class="wheel b6"><g class="spin">${s}<circle cx="50" cy="50" r="16" fill="#5c0f22" stroke="#e8c46a" stroke-width="1.2"/><text x="50" y="53" text-anchor="middle" font-size="8" font-family="Georgia,serif" fill="#e8c46a">K</text></g><circle cx="50" cy="50" r="48" fill="none" stroke="#c9a24f" stroke-width="2"/><path d="M45 0h10l-5 9z" fill="#e8c46a" stroke="#5a3a00" stroke-width=".6"/></svg>`;
  }
  function spinTo(svg, deg, dur) {
    const g = svg.querySelector(".spin"), from = +(g.dataset.r || 0);
    g.dataset.r = deg; g.style.transform = `rotate(${deg}deg)`;
    if (motion && g.animate) g.animate([{ transform: `rotate(${from}deg)` }, { transform: `rotate(${deg}deg)` }], { duration: dur, easing: "cubic-bezier(.15,.6,.2,1)" });
  }
  async function roulette(R) {
    const svg = host.querySelector(".rl"), st = 360 / 37, i = U.wheel.indexOf(R.n);
    const from = +(svg.querySelector(".spin").dataset.r || 0), W = from - (from % 360) + 720 + Math.random() * 360;
    const B = i * st + st / 2 + W; // the ball comes to rest over pocket i once the wheel has turned by W
    spinTo(svg, W, 4200); Sfx.play("spin");
    const o = svg.querySelector(".orbit"), ball = svg.querySelector(".ball");
    o.style.transform = `rotate(${B}deg)`; ball.style.transform = "translateY(12.5px)";
    if (motion && o.animate) {
      o.animate([{ transform: `rotate(${B + 360 * 6}deg)` }, { transform: `rotate(${B}deg)` }], { duration: 4200, easing: "cubic-bezier(.2,.65,.25,1)" });
      ball.animate([{ transform: "translateY(0)" }, { transform: "translateY(0)", offset: .55 }, { transform: "translateY(9px)", offset: .75 }, { transform: "translateY(6px)", offset: .82 }, { transform: "translateY(12.5px)" }], { duration: 4200 });
    }
    await wait(4300); Sfx.play("ball");
    const hist = host.querySelector(".hist"); hist.prepend(h("b", "n " + R.color, String(R.n))); while (hist.children.length > 12) hist.lastChild.remove();
  }
  async function big6(R) {
    const svg = host.querySelector(".b6"), st = 360 / Games.by.big6.segs.length, from = +(svg.querySelector(".spin").dataset.r || 0);
    const W = from - (((from % 360) + 360) % 360) + 360 * 3 + (360 - (R.i * st + st / 2));
    spinTo(svg, W, 3800); Sfx.play("spin"); await wait(3900); Sfx.play("tick");
  }

  // ---------- dice ----------
  async function roll(box, vals, red) {
    box.replaceChildren(...vals.map(() => h("span", "die")));
    Sfx.play("dice");
    const kids = [...box.children];
    if (motion) for (let k = 0; k < 8; k++) { kids.forEach((d) => { d.innerHTML = Art.die(1 + ((Math.random() * 6) | 0), red); d.style.transform = `rotate(${(Math.random() * 80 - 40) | 0}deg) translateY(${(Math.random() * -14) | 0}px)`; }); await wait(70); }
    kids.forEach((d, i) => { d.innerHTML = Art.die(vals[i], red); d.style.transform = `rotate(${(Math.random() * 16 - 8) | 0}deg)`; d.classList.add("land"); });
    await wait(250);
  }

  // ---------- cards ----------
  // Adds the new cards of a hand (and turns over a hidden one when it's revealed), one at a time.
  async function deal(box, cards, gap = 260) {
    const have = [...box.children];
    for (let i = 0; i < cards.length; i++) {
      let d = have[i];
      if (!d) {
        d = Art.card(null); box.append(d);
        if (motion && d.animate) d.animate([{ transform: "translate(-40vw,-30vh) rotate(-30deg)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 380, easing: "cubic-bezier(.2,.7,.3,1)" });
        Sfx.play("deal"); await wait(gap);
      }
      if (cards[i] && d.dataset.c !== cards[i]) { Art.show(d, cards[i]); Sfx.play("flip"); await wait(140); }
    }
    while (box.children.length > cards.length) box.lastChild.remove();
  }
  const hand = (label, cls) => { const w = h("div", "hand " + (cls || "")); w.append(h("div", "hl", label), h("div", "cards"), h("div", "tot")); return w; };

  // ---------- reels ----------
  async function reels(res) {
    const rows = [...host.querySelectorAll(".reel")], sy = Games.by.slots.sym;
    Sfx.play("spin");
    await Promise.all(rows.map(async (r, i) => {
      const strip = r.firstChild, n = motion ? 14 + i * 6 : 1, list = [];
      for (let k = 0; k < n - 1; k++) list.push(sy[(Math.random() * sy.length) | 0]);
      list.push(res[i]);
      strip.innerHTML = list.map((s) => `<i>${Art.sym(s)}</i>`).join("");
      if (motion && strip.animate) await strip.animate([{ transform: "translateY(0)" }, { transform: `translateY(${-(n - 1) * 100 / n}%)` }], { duration: 900 + i * 450, easing: "cubic-bezier(.3,.1,.3,1.08)", fill: "forwards" }).finished;
      strip.innerHTML = `<i>${Art.sym(res[i])}</i>`; strip.getAnimations && strip.getAnimations().forEach((a) => a.cancel());
      Sfx.play("reel");
    }));
  }

  // ---------- balls ----------
  async function balls(tray, list, each) {
    tray.replaceChildren();
    for (const n of list) {
      const b = h("b", "ball", String(n)); b.style.setProperty("--h", (n * 47) % 360); tray.append(b);
      if (each) each(n);
      Sfx.play("ball"); await wait(list.length > 20 ? 110 : 150);
    }
  }
  const BINGO = "BINGO";
  function bingoGrid(card, drawn) {
    const g = h("div", "bingo");
    for (const ch of BINGO) g.append(h("b", "bh", ch));
    for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
      const v = card ? card[c][r] : null, e = h("span", "bc", v === 0 ? "★" : v == null ? "" : String(v));
      e.dataset.v = v == null ? "" : v; if (v === 0 || (drawn && drawn.includes(v))) e.classList.add("dab");
      g.append(e);
    }
    return g;
  }

  // ---------- scratch ticket ----------
  function ticket(cells, done) {
    const t = h("div", "ticket"), grid = h("div", "tgrid"), cv = document.createElement("canvas");
    cells.forEach((s) => grid.append(h("span", "tc", Art.sym(s))));
    const all = h("button", "sm", "Reveal all"); all.onclick = () => finish();
    t.append(h("div", "thead", "<b>LUCKY NINE</b><span>match three to win</span>"), grid, all); grid.append(cv);
    let left = 9, fin = false;
    const paint = () => {
      const r = grid.getBoundingClientRect(); cv.width = r.width; cv.height = r.height;
      const c = cv.getContext("2d"), g = c.createLinearGradient(0, 0, r.width, r.height);
      g.addColorStop(0, "#b9bec7"); g.addColorStop(.5, "#e6e9ee"); g.addColorStop(1, "#9aa1ab");
      c.fillStyle = g; c.fillRect(0, 0, r.width, r.height);
      c.fillStyle = "#7b828d"; c.font = "700 13px system-ui"; c.textAlign = "center";
      for (let i = 0; i < 9; i++) c.fillText("SCRATCH", (i % 3 + .5) * r.width / 3, (((i / 3) | 0) + .55) * r.height / 3);
    };
    const finish = () => { if (fin) return; fin = true; all.remove(); cv.style.transition = "opacity .4s"; cv.style.opacity = 0; setTimeout(() => cv.remove(), 450); done(); };
    const check = () => {
      const c = cv.getContext("2d"); left = 0;
      for (let i = 0; i < 9; i++) { const x = (i % 3 + .5) * cv.width / 3, y = (((i / 3) | 0) + .5) * cv.height / 3; if (c.getImageData(x, y, 1, 1).data[3] > 0) left++; }
      if (!left) finish();
    };
    let down = false, n = 0;
    const at = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    const rub = (e) => { if (!down) return; const [x, y] = at(e), c = cv.getContext("2d"); c.globalCompositeOperation = "destination-out"; c.beginPath(); c.arc(x, y, 18, 0, 7); c.fill(); if (++n % 6 === 0) { Sfx.play("scratch"); check(); } };
    cv.onpointerdown = (e) => { down = true; cv.setPointerCapture && cv.setPointerCapture(e.pointerId); rub(e); };
    cv.onpointermove = rub; cv.onpointerup = cv.onpointercancel = () => { down = false; check(); };
    cv.tabIndex = 0; cv.setAttribute("aria-label", "Scratch area: drag to scratch, or press Enter to reveal all");
    cv.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); finish(); } };
    requestAnimationFrame(paint);
    t.reveal = finish;
    return t;
  }

  // ---------- building and drawing ----------
  function build(g) {
    built = g.id; dealt = {}; roundKey = ""; host.replaceChildren(); host.className = "show k-" + g.kind + " g-" + g.id;
    if (g.id === "roulette") { host.append(h("div", "wheelbox", rouletteSvg()), h("div", "hist")); }
    else if (g.id === "big6") host.append(h("div", "wheelbox", big6Svg()), h("div", "hist"));
    else if (g.kind === "dice") { host.append(h("div", g.id === "chuck" ? "cage" : "bowl", '<div class="dice"></div>'), h("div", "puck")); }
    else if (g.id === "slots") { const m = h("div", "machine", '<div class="mtop">KIN SEVENS</div><div class="reels"></div><div class="mpay"></div>'); for (let i = 0; i < 3; i++) m.querySelector(".reels").append(h("div", "reel", `<div class="strip"><i>${Art.sym(["seven", "bar", "cherry"][i])}</i></div>`)); host.append(m); }
    else if (g.id === "keno") host.append(h("div", "tray"), h("div", "kcount"));
    else if (g.id === "bingo") host.append(bingoGrid(null), h("div", "tray"));
    else if (g.id === "scratch") host.append(h("div", "tbox", '<div class="ticket ghost"><div class="thead"><b>LUCKY NINE</b><span>buy a ticket to play</span></div></div>'));
    else host.append(h("div", "dealer"), h("div", "hands"));
  }
  // Seat hands for the card games (one row per seat).
  function handsFor(R, names, cls) {
    const box = host.querySelector(".hands");
    for (const s of R.seats) if (!box.querySelector(`[data-id="${CSS.escape(s.id)}"]`)) { const w = hand(names[s.id] || "", cls); w.dataset.id = s.id; box.append(w); }
    return (id) => box.querySelector(`[data-id="${CSS.escape(id)}"]`);
  }
  // Draws round R (the live one or the last finished one). me: my seat id. Resolves when animations end.
  async function show(g, R, ctx) {
    if (built !== g.id) build(g);
    if (!R) return;
    const key = g.id + ":" + R.no, fresh = key !== roundKey;
    if (fresh) { roundKey = key; dealt = {}; if (g.kind === "cards") { host.querySelector(".dealer").replaceChildren(); host.querySelector(".hands").replaceChildren(); } }
    const me = R.seats.find((s) => s.id === ctx.me), names = ctx.names || {};
    if (g.id === "roulette") { if (fresh) await roulette(R); return; }
    if (g.id === "big6") { if (fresh) { await big6(R); const hist = host.querySelector(".hist"); hist.prepend(h("b", "n b6v", typeof R.v === "number" ? String(R.v) : R.v === "star" ? "★" : "☾")); while (hist.children.length > 12) hist.lastChild.remove(); } return; }
    if (g.kind === "dice") {
      if (!fresh) return;
      await roll(host.querySelector(".dice"), R.dice, g.id === "sicbo");
      const p = host.querySelector(".puck");
      if (g.id === "craps") { p.className = "puck " + (R.point ? "on" : "off"); p.textContent = R.point ? "ON " + R.point : "OFF"; }
      else p.textContent = g.id === "sicbo" ? "Total " + R.dice.reduce((a, b) => a + b, 0) : "";
      return;
    }
    if (g.id === "slots") { if (fresh && me) await reels(me.reels); const p = host.querySelector(".mpay"); p.textContent = me && me.back ? "PAID " + me.back : ""; return; }
    if (g.id === "keno") {
      if (!fresh) return;
      host.querySelector(".kcount").textContent = "";
      document.querySelectorAll("[data-k]").forEach((e) => e.classList.remove("drawn"));
      await balls(host.querySelector(".tray"), R.drawn, (n) => { const e = document.querySelector(`[data-k="${n}"]`); if (e) e.classList.add("drawn"); });
      host.querySelector(".kcount").textContent = me ? `You caught ${me.hits} of ${(me.picks || []).length}` : "";
      return;
    }
    if (g.id === "bingo") {
      if (!fresh) return;
      const grid = bingoGrid(me ? me.card : null, []); host.querySelector(".bingo").replaceWith(grid);
      await balls(host.querySelector(".tray"), R.drawn, (n) => { const e = grid.querySelector(`[data-v="${n}"]`); if (e) e.classList.add("dab"); });
      return;
    }
    if (g.id === "scratch") {
      if (!fresh || !me) return;
      const box = host.querySelector(".tbox");
      await new Promise((res) => { const t = ticket(me.cells, res); box.replaceChildren(t); Stage.reveal = t.reveal; });
      Stage.reveal = null; return;
    }
    // card games
    const D = host.querySelector(".dealer");
    if (g.id === "baccarat") {
      if (!fresh) return;
      D.replaceChildren(hand("Player", "bp"), hand("Banker", "bb"));
      const [P, B] = D.children, pc = P.querySelector(".cards"), bc = B.querySelector(".cards");
      await deal(pc, R.player.slice(0, 1)); await deal(bc, R.banker.slice(0, 1)); await deal(pc, R.player.slice(0, 2)); await deal(bc, R.banker.slice(0, 2));
      if (R.player[2]) { await wait(300); await deal(pc, R.player); }
      if (R.banker[2]) { await wait(300); await deal(bc, R.banker); }
      P.querySelector(".tot").textContent = R.pt; B.querySelector(".tot").textContent = R.bt;
      (R.win === "tie" ? [P, B] : [R.win === "player" ? P : B]).forEach((x) => x.classList.add("won"));
      return;
    }
    if (g.id === "reddog") {
      if (!D.firstChild) D.append(hand("Red Dog", "rd"));
      await deal(D.querySelector(".cards"), R.cards);
      D.querySelector(".tot").textContent = R.cards.length === 2 && R.spread ? `Spread ${R.spread} · pays ${{ 1: "5:1", 2: "4:1", 3: "2:1" }[R.spread] || "1:1"}` : R.cards.length === 2 && R.spread === 0 ? "Consecutive: push" : R.cards.length === 3 && U.rv(R.cards[0]) === U.rv(R.cards[1]) ? (U.rv(R.cards[2]) === U.rv(R.cards[0]) ? "Three of a kind!" : "Pair: push") : R.spread ? `Spread ${R.spread}` : "";
      return;
    }
    if (g.id === "war") {
      if (!D.firstChild) D.append(hand("Dealer"));
      await deal(D.querySelector(".cards"), [R.dealer]);
      const get = handsFor(R, names);
      for (const s of R.seats) { const w = get(s.id); await deal(w.querySelector(".cards"), s.war ? [s.card, s.war[0]] : [s.card], 200); if (s.war) w.querySelector(".tot").textContent = "War: dealer " + s.war[1][0].replace("T", "10"); else if (U.rv(s.card) === U.rv(R.dealer)) w.querySelector(".tot").textContent = "Tie!"; }
      return;
    }
    if (g.id === "blackjack") {
      if (!D.firstChild) D.append(hand("Dealer"));
      const get = handsFor(R, names), dc = D.querySelector(".cards");
      if (fresh) { for (const s of R.seats) await deal(get(s.id).querySelector(".cards"), s.hand.slice(0, 1), 170); await deal(dc, R.dealer.slice(0, 1)); for (const s of R.seats) await deal(get(s.id).querySelector(".cards"), s.hand.slice(0, 2), 170); await deal(dc, R.dealer.slice(0, 2)); }
      for (const s of R.seats) {
        const w = get(s.id); await deal(w.querySelector(".cards"), s.hand);
        const t = U.bjTotal(s.hand); w.querySelector(".tot").textContent = s.bj ? "Blackjack" : s.bust ? "Bust " + t.t : (t.soft && t.t < 21 ? "Soft " : "") + t.t + (s.doubled ? " · doubled" : "");
        w.classList.toggle("turn", R.turn === s.id);
      }
      if (R.done) for (let i = 2; i <= R.dealer.length; i++) { await deal(dc, R.dealer.slice(0, i), 420); }
      else await deal(dc, R.dealer);
      const known = R.dealer.filter(Boolean); D.querySelector(".tot").textContent = known.length ? (R.done ? U.bjTotal(R.dealer).t + (U.bjTotal(R.dealer).t > 21 ? " bust" : "") : "Shows " + U.bjTotal(known).t) : "";
    }
  }
  return { mount(el) { host = el; }, show, set motion(v) { motion = v; }, reset() { built = ""; }, reveal: null, bingoGrid };
})();
