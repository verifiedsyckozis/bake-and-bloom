// Game sound effects, synthesized with the Web Audio API (no sound files).
// Browsers only allow sound after the player taps the page, so input
// handlers call unlock() first. Phones only count a finished tap (touchend,
// click), not the moment a finger lands.
window.M3 = window.M3 || {};

M3.audio = (function () {
  let ctx = null;
  let out = null;
  let noiseBuf = null;
  let muted = false;

  function init() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.connect(ctx.destination);
    out = ctx.createGain();
    out.gain.value = muted ? 0 : 0.7;
    out.connect(comp);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return true;
  }

  function unlock() {
    if (!init()) return;
    // Treat these as game sounds that play even with the iPhone silent switch on
    // (Safari 16.4+). Without this, iOS mutes web audio when the phone is on silent.
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* ignore */ }
    if (ctx.state !== 'running') ctx.resume();
    // Older iOS also needs a sound started inside the tap itself.
    const src = ctx.createBufferSource();
    src.buffer = ctx.createBuffer(1, 1, 22050);
    src.connect(ctx.destination);
    src.start(0);
  }

  function setMuted(value) {
    muted = value;
    if (out) out.gain.setTargetAtTime(muted ? 0 : 0.7, ctx.currentTime, 0.02);
  }

  function midi(n) {
    return 440 * Math.pow(2, (n - 69) / 12);
  }

  // One enveloped oscillator note. `delay` is seconds from now.
  function tone(freq, { delay = 0, dur = 0.15, type = 'sine', vol = 0.15, slide = null, attack = 0.005 } = {}) {
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(slide, t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(out);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  // A burst of filtered noise, for whooshes, crunches, and booms.
  function noise({ delay = 0, dur = 0.2, vol = 0.15, filter = 'bandpass', freq = 1000, slide = null, q = 1 } = {}) {
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    const f = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    src.buffer = noiseBuf;
    f.type = filter;
    f.Q.value = q;
    f.frequency.setValueAtTime(freq, t);
    if (slide) f.frequency.exponentialRampToValueAtTime(slide, t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(gain).connect(out);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  const PENTA = [72, 74, 76, 79, 81, 84, 86, 88, 91, 93];

  const SOUNDS = {
    tap() { tone(midi(81), { dur: 0.06, vol: 0.07 }); },
    swap() { tone(420, { dur: 0.1, type: 'triangle', vol: 0.1, slide: 700 }); },
    invalid() {
      tone(midi(55), { dur: 0.12, type: 'triangle', vol: 0.14 });
      tone(midi(52), { delay: 0.1, dur: 0.16, type: 'triangle', vol: 0.14 });
    },
    // Each cascade step plays one note higher.
    match(chain = 1) {
      const n = PENTA[Math.min(chain - 1, PENTA.length - 1)];
      tone(midi(n), { dur: 0.2, vol: 0.14 });
      tone(midi(n + 12), { dur: 0.12, vol: 0.04 });
      noise({ dur: 0.06, vol: 0.05, filter: 'highpass', freq: 3000 });
    },
    special() {
      [72, 76, 79, 84].forEach((n, i) => tone(midi(n), { delay: i * 0.05, dur: 0.18, type: 'triangle', vol: 0.09 }));
    },
    line() {
      noise({ dur: 0.28, vol: 0.22, freq: 3500, slide: 500, q: 2 });
      tone(1500, { dur: 0.25, type: 'triangle', vol: 0.07, slide: 300 });
    },
    wrap() {
      tone(170, { dur: 0.4, vol: 0.35, slide: 40 });
      noise({ dur: 0.35, vol: 0.25, filter: 'lowpass', freq: 900, slide: 120 });
    },
    bomb() {
      for (let i = 0; i < 10; i++) {
        const n = PENTA[Math.floor(Math.random() * PENTA.length)] + 12;
        tone(midi(n), { delay: i * 0.035, dur: 0.15, vol: 0.06 });
      }
      noise({ dur: 0.4, vol: 0.1, freq: 600, slide: 4000 });
    },
    board() {
      SOUNDS.wrap();
      SOUNDS.bomb();
    },
    frost() { noise({ dur: 0.09, vol: 0.12, filter: 'highpass', freq: 4500 }); },
    shuffle() { noise({ dur: 0.45, vol: 0.12, freq: 400, slide: 2500 }); },
    word() { [84, 88, 91].forEach(n => tone(midi(n), { dur: 0.5, type: 'triangle', vol: 0.06 })); },
    convert() { tone(midi(96), { dur: 0.05, vol: 0.05 }); },
    win() {
      [72, 76, 79, 84].forEach((n, i) => tone(midi(n), { delay: i * 0.12, dur: 0.3, type: 'triangle', vol: 0.13 }));
      [72, 76, 79, 84].forEach(n => tone(midi(n), { delay: 0.5, dur: 0.9, vol: 0.06 }));
    },
    lose() {
      [67, 65, 64].forEach((n, i) => tone(midi(n), { delay: i * 0.25, dur: 0.3, type: 'triangle', vol: 0.12 }));
      tone(midi(62), { delay: 0.75, dur: 0.8, type: 'triangle', vol: 0.12, slide: midi(58) });
    },
    star(i = 0) {
      tone(midi(84 + i * 4), { dur: 0.45, vol: 0.12 });
      tone(midi(96 + i * 4), { dur: 0.3, vol: 0.04 });
    },
    life() { tone(300, { dur: 0.5, type: 'triangle', vol: 0.12, slide: 120 }); },
  };

  function play(name, arg) {
    if (muted || !ctx) return;
    if (ctx.state !== 'running') ctx.resume(); // e.g. after the phone locked or a call
    SOUNDS[name](arg);
  }

  return { unlock, setMuted, play };
})();
