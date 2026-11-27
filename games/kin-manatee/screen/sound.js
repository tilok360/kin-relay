// Original sounds made with Web Audio (no audio files): card flicks, a shuffle, bubbles, a fanfare for the winner.
const Sfx = (() => {
  let ctx = null, master = null, noise = null, on = true;
  try { on = localStorage.getItem("manatee-sound") !== "off"; } catch {}
  function ready() {
    if (!ctx) {
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)(); master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination);
        noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      } catch { ctx = null; }
    }
    if (ctx && ctx.state === "suspended") ctx.resume();
    return on && ctx;
  }
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
    shuffle() { for (let i = 0; i < 14; i++) puff(i * 0.04 + Math.random() * 0.02, 0.05, 2200 + Math.random() * 1800, 1200, 0.2, "bandpass", 0.9); },
    deal() { puff(0, 0.07, 3200, 900, 0.28, "bandpass", 1.5); tone(0.02, 150, 0.06, 0.1, "sine", 90); },
    pick() { tone(0, 520, 0.08, 0.12, "triangle", 700); },          // choosing a card in your hand
    play() { puff(0, 0.09, 2400, 700, 0.3, "bandpass", 1.2); tone(0.02, 130, 0.1, 0.22, "sine", 70); },
    flip() { puff(0, 0.06, 2800, 1400, 0.2, "bandpass", 1.1); },
    bubble() { const f = 500 + Math.random() * 500; tone(0, f, 0.12, 0.08, "sine", f * 1.8); },
    turn() { tone(0, 880, 0.3, 0.09, "sine"); tone(0.09, 1320, 0.3, 0.06, "sine"); },
    win() { [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => { tone(i * 0.085, f, 0.5, 0.12, "triangle"); tone(i * 0.085, f * 2, 0.35, 0.035, "sine"); }); for (let i = 0; i < 5; i++) tone(0.45 + i * 0.05, 800 + Math.random() * 900, 0.1, 0.05, "sine", 1800); },
    lose() { tone(0, 330, 0.35, 0.1, "sine", 220); tone(0.18, 247, 0.5, 0.08, "sine", 165); },
    ach() { [784, 988, 1175, 1568].forEach((f, i) => tone(i * 0.07, f, 0.35, 0.09, "triangle")); },
  };
  const play = (name) => { try { if (ready()) sounds[name](); } catch {} };
  return { play, unlock: ready, get on() { return on; }, set on(v) { on = !!v; try { localStorage.setItem("manatee-sound", on ? "on" : "off"); } catch {} if (on) ready(); } };
})();
