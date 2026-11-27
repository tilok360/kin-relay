// Original sounds, made with Web Audio (no audio files): shuffle, deal, chips, check knock, fold, turn ping and win.
const Sfx = (() => {
  let ctx = null, master = null, noise = null, on = true;
  try { on = localStorage.getItem("holdem-sound") !== "off"; } catch {}
  function ready() {
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
    flip() { puff(0, 0.06, 2800, 1400, 0.2, "bandpass", 1.1); },
  };
  const play = (name, arg) => { try { if (ready()) sounds[name](arg); } catch {} };
  return { play, unlock: ready, get on() { return on; }, set on(v) { on = !!v; try { localStorage.setItem("holdem-sound", on ? "on" : "off"); } catch {} if (on) ready(); } };
})();
