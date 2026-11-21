// Robot voice for Pixo: the avatar's remote WebRTC audio is tapped as soon as it arrives, run
// through a bit crusher (fewer bits, lower sample rate) and a small-speaker band-pass, and played
// by our own Web Audio graph; the SDK's own audio is then set to volume 0 (see useLiveConversation).
// Everything stays in the browser: the stream is never recorded or sent anywhere.

const CRUSHER = `
// Stereo on purpose: each side is crushed with its own phase and depth, so the two ears get
// slightly different "digital grit" instead of one mono signal copied twice.
class Crusher extends AudioWorkletProcessor {
  constructor() { super(); this.hold = [0, 0]; this.count = [0, 3]; }
  process(inputs, outputs) {
    const i = inputs[0][0], out = outputs[0];
    if (!i || !out.length) return true;
    const steps = [Math.pow(0.5, 5), Math.pow(0.5, 6)]; // left 5 bits, right 6 bits
    for (let c = 0; c < out.length; c++) {
      const o = out[c];
      for (let n = 0; n < i.length; n++) {
        if (this.count[c]++ % 6 === 0) this.hold[c] = Math.round(i[n] / steps[c]) * steps[c]; // 8 kHz
        o[n] = this.hold[c];
      }
    }
    return true;
  }
}
registerProcessor("crusher", Crusher);
`;

export interface RobotVoice {
  /** Current output level of each ear, 0..1 (RMS): the live test proves the audio is stereo and crushed. */
  levels: () => [number, number];
  destroy: () => void;
}

/** Install a global tap of remote audio tracks; `onTap` runs once with the first remote audio stream. */
export function tapRemoteAudio(onStream: (stream: MediaStream) => void): () => void {
  const Orig = window.RTCPeerConnection;
  if (!Orig) return () => {};
  let done = false;
  const Patched = function (this: RTCPeerConnection, ...args: ConstructorParameters<typeof RTCPeerConnection>) {
    const pc = new Orig(...args);
    pc.addEventListener("track", (e) => {
      if (done || e.track.kind !== "audio") return;
      const stream = e.streams[0] ?? new MediaStream([e.track]);
      done = true;
      onStream(stream);
    });
    return pc;
  } as unknown as typeof RTCPeerConnection;
  Patched.prototype = Orig.prototype;
  Object.setPrototypeOf(Patched, Orig);
  window.RTCPeerConnection = Patched;
  return () => {
    if (window.RTCPeerConnection === Patched) window.RTCPeerConnection = Orig;
  };
}

/** Build the effect chain on a remote stream. Resolves null when Web Audio / worklets are missing. */
export async function robotVoice(stream: MediaStream): Promise<RobotVoice | null> {
  try {
    const ctx = new AudioContext();
    await ctx.resume();
    const url = URL.createObjectURL(new Blob([CRUSHER], { type: "application/javascript" }));
    await ctx.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);
    const src = ctx.createMediaStreamSource(stream);
    const crusher = new AudioWorkletNode(ctx, "crusher", { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2], channelCount: 1, channelCountMode: "explicit" });
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 280;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 3600;
    // Right ear a hair later (Haas effect, 9 ms): the voice gains width without sounding doubled.
    const split = ctx.createChannelSplitter(2);
    const delayR = ctx.createDelay(0.05);
    delayR.delayTime.value = 0.009;
    const merge = ctx.createChannelMerger(2);
    const gain = ctx.createGain();
    gain.gain.value = 1.25;
    src.connect(crusher).connect(hp).connect(lp).connect(split);
    split.connect(merge, 0, 0);
    split.connect(delayR, 1).connect(merge, 0, 1);
    merge.connect(gain).connect(ctx.destination);
    const analysers = [0, 1].map((ch) => {
      const a = ctx.createAnalyser();
      a.fftSize = 1024;
      const sp = ctx.createChannelSplitter(2);
      gain.connect(sp);
      sp.connect(a, ch);
      return a;
    });
    const buf = new Float32Array(1024);
    const rms = (a: AnalyserNode) => {
      a.getFloatTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) sum += v * v;
      return Math.sqrt(sum / buf.length);
    };
    return {
      levels: () => [rms(analysers[0]), rms(analysers[1])],
      destroy: () => void ctx.close().catch(() => {}),
    };
  } catch {
    return null;
  }
}
