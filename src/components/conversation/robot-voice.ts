// Robot voice for Pixo: the avatar's remote WebRTC audio is tapped as soon as it arrives, run
// through a bit crusher (fewer bits, lower sample rate) and a small-speaker band-pass, and played
// by our own Web Audio graph; the SDK's own audio is then set to volume 0 (see useLiveConversation).
// Everything stays in the browser: the stream is never recorded or sent anywhere.

const CRUSHER = `
class Crusher extends AudioWorkletProcessor {
  constructor() { super(); this.hold = 0; this.count = 0; }
  process(inputs, outputs) {
    const i = inputs[0][0], o = outputs[0][0];
    if (!i || !o) return true;
    const step = Math.pow(0.5, 5); // 5 bits
    for (let n = 0; n < i.length; n++) {
      if (this.count++ % 6 === 0) this.hold = Math.round(i[n] / step) * step; // 48 kHz / 6 = 8 kHz
      o[n] = this.hold;
    }
    return true;
  }
}
registerProcessor("crusher", Crusher);
`;

export interface RobotVoice {
  /** Current output level, 0..1 (RMS): used by the live test to prove the audio goes through the effect. */
  level: () => number;
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
    const crusher = new AudioWorkletNode(ctx, "crusher");
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 280;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 3600;
    const gain = ctx.createGain();
    gain.gain.value = 1.25;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    src.connect(crusher).connect(hp).connect(lp).connect(gain);
    gain.connect(analyser);
    gain.connect(ctx.destination);
    const buf = new Float32Array(analyser.fftSize);
    return {
      level: () => {
        analyser.getFloatTimeDomainData(buf);
        let s = 0;
        for (const v of buf) s += v * v;
        return Math.sqrt(s / buf.length);
      },
      destroy: () => void ctx.close().catch(() => {}),
    };
  } catch {
    return null;
  }
}
