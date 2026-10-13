// Geluidseffecten via Web Audio, geen bestanden nodig.

let audioCtx: AudioContext | null = null;
let enabled = true;

function ctx(): AudioContext {
  audioCtx ??= new AudioContext();
  return audioCtx;
}

function beep(freq: number, dur: number, type: OscillatorType = "square", vol = 0.08, when = 0) {
  if (!enabled) return;
  try {
    const c = ctx();
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = freq;
    const t = c.currentTime + when;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + dur);
  } catch {}
}

export const sfx = {
  setEnabled(on: boolean) {
    enabled = on;
  },
  // Browsers starten audio pas na een gebruikersactie
  resume() {
    try {
      void ctx().resume();
    } catch {}
  },
  click: () => beep(600, 0.06, "square", 0.05),
  tick: () => beep(1200, 0.025, "square", 0.025),
  stop: () => beep(180, 0.12, "triangle", 0.15),
  lose: () => {
    beep(330, 0.25, "sawtooth", 0.06);
    beep(247, 0.4, "sawtooth", 0.06, 0.25);
  },
  win: () =>
    [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => beep(f, 0.18, "square", 0.07, i * 0.12)),
};
