// Chess Clash sounds, synthesized with Web Audio on the spot: no sound files, nothing fetched.
(function (root) {
  "use strict";
  let ac = null, master = null, vol = 0.7, muted = false, verb = null;
  function ctx() {
    if (ac) { if (ac.state === "suspended") ac.resume(); return ac; }
    const AC = root.AudioContext || root.webkitAudioContext; if (!AC) return null;
    try {
      ac = new AC(); master = ac.createGain(); master.gain.value = muted ? 0 : vol; master.connect(ac.destination);
      // A short stone-hall reverb from decaying noise.
      verb = ac.createConvolver(); const len = Math.floor(ac.sampleRate * 1.6), ir = ac.createBuffer(2, len, ac.sampleRate);
      for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
      verb.buffer = ir; const wet = ac.createGain(); wet.gain.value = 0.28; verb.connect(wet).connect(master);
    } catch (e) { ac = null; }
    return ac;
  }
  function out(node, dry) { node.connect(master); if (verb && dry !== false) node.connect(verb); }
  function setVolume(v, m) { vol = Math.max(0, Math.min(1, v)); muted = !!m; if (master) master.gain.setTargetAtTime(muted ? 0 : vol, ac.currentTime, 0.02); }
  const live = () => ac && !muted && vol > 0;
  function env(g, t, a, peak, d) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
  function tone(type, f0, f1, dur, peak, when, rev) {
    if (!ctx() || !live()) return; const t = ac.currentTime + (when || 0), o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    env(g, t, 0.006, peak, dur); o.connect(g); out(g, rev); o.start(t); o.stop(t + dur + 0.05);
  }
  let noiseBuf = null;
  function noise(dur, freq, q, peak, type, when, sweepTo) {
    if (!ctx() || !live()) return;
    if (!noiseBuf) { const n = ac.sampleRate * 2; noiseBuf = ac.createBuffer(1, n, ac.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; }
    const t = ac.currentTime + (when || 0), s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf; f.type = type || "lowpass"; f.frequency.setValueAtTime(freq, t); f.Q.value = q || 0.7;
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    env(g, t, 0.004, peak, dur); s.connect(f).connect(g); out(g); s.start(t, Math.random()); s.stop(t + dur + 0.1);
  }
  // Metal: a few inharmonic partials that ring and fade.
  function metal(base, peak, when, dur) { [1, 2.76, 5.4, 8.93].forEach((r, i) => tone("sine", base * r, base * r * 0.995, (dur || 0.9) / (1 + i * 0.6), peak / (1 + i), when)); noise(0.05, 6000, 1, peak * 0.7, "highpass", when); }
  const S = {
    unlock: ctx, setVolume,
    select() { tone("triangle", 660, 990, 0.07, 0.07); },
    deny() { tone("square", 180, 140, 0.12, 0.04); },
    // One footstep. kind: armor, heavy (rook), hoof (knight), soft (bishop/queen), royal (king)
    step(kind) {
      if (kind === "heavy") { tone("sine", 70, 38, 0.32, 0.5); noise(0.22, 300, 0.8, 0.4); }
      else if (kind === "hoof") { noise(0.06, 1400, 2, 0.35, "bandpass"); tone("sine", 220, 120, 0.06, 0.12); }
      else if (kind === "soft") { noise(0.12, 900, 0.6, 0.08); }
      else if (kind === "royal") { noise(0.09, 600, 0.9, 0.3); metal(820, 0.03); }
      else { noise(0.07, 800, 0.9, 0.24); metal(1250 + Math.random() * 200, 0.025); }
    },
    whoosh() { noise(0.28, 500, 0.8, 0.22, "bandpass", 0, 2400); },
    clang() { metal(540 + Math.random() * 80, 0.22); noise(0.12, 3500, 1.2, 0.3, "bandpass"); },
    thud() { tone("sine", 110, 40, 0.45, 0.6); noise(0.3, 400, 0.7, 0.45); },
    smash() { tone("sine", 60, 28, 0.9, 0.9); noise(0.9, 900, 0.6, 0.8, "lowpass", 0, 120); for (let i = 0; i < 6; i++) noise(0.08, 2000 + Math.random() * 2000, 1.5, 0.12, "bandpass", 0.12 + i * 0.07); },
    crumble() { for (let i = 0; i < 9; i++) noise(0.07, 1500 + Math.random() * 2500, 2, 0.1, "bandpass", i * 0.05); },
    magic() { [523, 659, 784, 988, 1175].forEach((f, i) => tone("sine", f, f * 1.01, 0.5, 0.07, i * 0.05)); noise(0.7, 1200, 2, 0.12, "bandpass", 0, 6000); },
    blast() { tone("sawtooth", 880, 110, 0.5, 0.18); noise(0.6, 4000, 0.8, 0.4, "lowpass", 0, 300); tone("sine", 90, 40, 0.6, 0.5); },
    zap() { tone("square", 1800, 300, 0.18, 0.06); noise(0.2, 5000, 3, 0.15, "bandpass"); },
    gallop() { for (let i = 0; i < 6; i++) S.step("hoof"); for (let i = 0; i < 6; i++) setTimeout(() => S.step("hoof"), i * 95); },
    neigh() { tone("sawtooth", 600, 900, 0.18, 0.05); tone("sawtooth", 900, 500, 0.4, 0.05, 0.18); },
    fall() { tone("sine", 160, 60, 0.35, 0.4); noise(0.25, 700, 0.8, 0.35, "lowpass", 0.05); metal(420, 0.08, 0.05); },
    promote() { [392, 523, 659, 784, 1047].forEach((f, i) => tone("triangle", f, null, 0.5, 0.09, i * 0.09)); S.magic(); },
    // Brass-ish fanfares
    horn(notes, gap, len) { notes.forEach((f, i) => { tone("sawtooth", f, f * 1.003, len || 0.32, 0.07, i * (gap || 0.13)); tone("triangle", f / 2, null, len || 0.32, 0.06, i * (gap || 0.13)); }); },
    check() { S.horn([392, 523, 659], 0.11, 0.28); tone("sine", 196, 196, 0.5, 0.15, 0.3); },
    mate(win) { if (win) { S.horn([262, 330, 392, 523], 0.16, 0.5); setTimeout(() => S.horn([523, 659, 784, 1047], 0.12, 0.9), 700); } else { S.horn([392, 330, 262, 196], 0.24, 0.6); } for (let i = 0; i < 3; i++) tone("sine", 70, 45, 0.6, 0.5, i * 0.33); },
    draw() { S.horn([330, 392, 330], 0.2, 0.5); },
    start() { S.horn([196, 262, 330, 392], 0.15, 0.4); },
    crackle() { noise(0.03, 3000 + Math.random() * 3000, 3, 0.02 + Math.random() * 0.025, "bandpass"); },
  };
  root.ClashSfx = S;
})(typeof self !== "undefined" ? self : this);
