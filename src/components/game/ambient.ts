// Procedural ambient sound (Web Audio, no asset, no licence): the booth in each era.
// 1996: warm room tone, a low projector hum and a soft shutter flutter (24 frames a second).
// 2026: cold, empty room tone, a faint high hiss and the odd far water drip (the 2016 flood).
// Both beds run together and crossfade with the era. Everything is low on purpose: the player
// talks to a companion through the microphone, the bed must never compete with it.

export type AmbientEra = 1996 | 2026;

const BED_LEVEL = 0.16; // master, before ducking
const DUCKED = 0.4; // fraction kept while the companion talks
const FADE_S = 1.6;

function brownNoise(ctx: AudioContext, seconds = 6): AudioBuffer {
  const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    d[i] = last * 3.5;
  }
  // Seamless loop: blend the end into the start.
  const n = Math.floor(ctx.sampleRate * 0.25);
  for (let i = 0; i < n; i++) d[d.length - n + i] = d[d.length - n + i] * (1 - i / n) + d[i] * (i / n);
  return buf;
}

export interface Ambient {
  setEra: (era: AmbientEra) => void;
  setDucked: (ducked: boolean) => void;
  setMuted: (muted: boolean) => void;
  suspend: () => void;
  resume: () => void;
  destroy: () => void;
}

/** Must be called from a user gesture (autoplay policy). Returns null when Web Audio is missing. */
export function createAmbient(era: AmbientEra, muted: boolean): Ambient | null {
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  const ctx = new AC();
  const master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);
  const noise = brownNoise(ctx);
  const stoppers: (() => void)[] = [];
  const timers: ReturnType<typeof setTimeout>[] = [];

  const loop = (dest: AudioNode, filter: BiquadFilterType, freq: number, gain: number, q = 0.7) => {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    src.playbackRate.value = 0.9 + Math.random() * 0.2;
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(f).connect(g).connect(dest);
    src.start(0, Math.random() * 3);
    stoppers.push(() => src.stop());
    return g;
  };
  const osc = (dest: AudioNode, type: OscillatorType, freq: number, gain: number) => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = gain;
    o.connect(g).connect(dest);
    o.start();
    stoppers.push(() => o.stop());
    return { o, g };
  };

  // --- 1996: warm room, projector hum, shutter flutter ---
  const warm = ctx.createGain();
  warm.gain.value = 0;
  warm.connect(master);
  loop(warm, "lowpass", 420, 0.9);
  const hum = ctx.createBiquadFilter();
  hum.type = "lowpass";
  hum.frequency.value = 260;
  hum.connect(warm);
  osc(hum, "sawtooth", 50, 0.05);
  osc(hum, "triangle", 100, 0.04);
  const flutter = ctx.createGain();
  flutter.gain.value = 0.05;
  flutter.connect(warm);
  const shutter = loop(flutter, "bandpass", 900, 1, 0.8);
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 24;
  const lfoDepth = ctx.createGain();
  lfoDepth.gain.value = 0.7;
  lfo.connect(lfoDepth).connect(shutter.gain);
  lfo.start();
  stoppers.push(() => lfo.stop());

  // --- 2026: cold room, faint hiss, far drips ---
  const cold = ctx.createGain();
  cold.gain.value = 0;
  cold.connect(master);
  loop(cold, "lowpass", 170, 1);
  loop(cold, "highpass", 5200, 0.012);
  const breath = loop(cold, "bandpass", 320, 0.35, 0.5);
  const slow = ctx.createOscillator();
  slow.frequency.value = 0.07;
  const slowDepth = ctx.createGain();
  slowDepth.gain.value = 0.2;
  slow.connect(slowDepth).connect(breath.gain);
  slow.start();
  stoppers.push(() => slow.stop());
  const echo = ctx.createDelay(1);
  echo.delayTime.value = 0.23;
  const echoGain = ctx.createGain();
  echoGain.gain.value = 0.35;
  echo.connect(echoGain).connect(echo);
  echo.connect(cold);
  const drip = () => {
    if (ctx.state === "running" && current === 2026) {
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(1100 + Math.random() * 500, t);
      o.frequency.exponentialRampToValueAtTime(600, t + 0.08);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.09, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      o.connect(g);
      g.connect(cold);
      g.connect(echo);
      o.start(t);
      o.stop(t + 0.25);
    }
    timers.push(setTimeout(drip, 6000 + Math.random() * 9000));
  };
  timers.push(setTimeout(drip, 4000));

  let current: AmbientEra = era;
  let isMuted = muted;
  let ducked = false;
  const level = () => (isMuted ? 0 : BED_LEVEL * (ducked ? DUCKED : 1));
  const apply = (fade = FADE_S) => {
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setTargetAtTime(level(), t, fade / 3);
    warm.gain.setTargetAtTime(current === 1996 ? 1 : 0, t, FADE_S / 3);
    cold.gain.setTargetAtTime(current === 2026 ? 1 : 0, t, FADE_S / 3);
  };
  void ctx.resume().then(() => apply());
  apply();

  return {
    setEra: (e) => {
      current = e;
      apply();
    },
    setDucked: (d) => {
      ducked = d;
      apply(0.5);
    },
    setMuted: (m) => {
      isMuted = m;
      apply(0.4);
    },
    suspend: () => void ctx.suspend(),
    resume: () => void ctx.resume(),
    destroy: () => {
      timers.forEach(clearTimeout);
      for (const s of stoppers) {
        try {
          s();
        } catch {
          /* already stopped */
        }
      }
      void ctx.close();
    },
  };
}
