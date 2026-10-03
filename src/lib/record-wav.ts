// Records a complete, decodable WAV (16 kHz mono) in the browser.
function encodeWav(chunks: readonly Float32Array[], inRate: number, outRate = 16000): Blob {
  const ratio = inRate / outRate;
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const flat = new Float32Array(total);
  let o = 0;
  for (const c of chunks) {
    flat.set(c, o);
    o += c.length;
  }
  const length = Math.floor(total / ratio);
  const bytes = new ArrayBuffer(44 + length * 2);
  const view = new DataView(bytes);
  const tag = (off: number, v: string) => {
    for (let i = 0; i < v.length; i++) view.setUint8(off + i, v.charCodeAt(i));
  };
  tag(0, "RIFF");
  view.setUint32(4, 36 + length * 2, true);
  tag(8, "WAVE");
  tag(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, outRate, true);
  view.setUint32(28, outRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  tag(36, "data");
  view.setUint32(40, length * 2, true);
  let off = 44;
  for (let i = 0; i < length; i++) {
    const s = Math.max(-1, Math.min(1, flat[Math.floor(i * ratio)]));
    view.setInt16(off, s * (s < 0 ? 32768 : 32767), true);
    off += 2;
  }
  return new Blob([bytes], { type: "audio/wav" });
}

export type Recorder = {
  stop: () => Promise<File>;
  cancel: () => void;
  level: () => number; // 0..1 for waveform
};

export async function startRecording(): Promise<Recorder> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const ctx = new AudioContext();
  await ctx.resume();
  const source = ctx.createMediaStreamSource(stream);
  const node = ctx.createScriptProcessor(4096, 1, 1);
  const chunks: Float32Array[] = [];
  let lvl = 0;
  node.onaudioprocess = (e) => {
    const d = e.inputBuffer.getChannelData(0);
    chunks.push(new Float32Array(d));
    let sum = 0;
    for (let i = 0; i < d.length; i += 16) sum += d[i] * d[i];
    lvl = Math.min(1, Math.sqrt(sum / (d.length / 16)) * 4);
  };
  source.connect(node);
  node.connect(ctx.destination);
  let done = false;
  const teardown = () => {
    done = true;
    stream.getTracks().forEach((t) => t.stop());
    node.disconnect();
    source.disconnect();
    node.onaudioprocess = null;
    void ctx.close();
  };
  return {
    level: () => lvl,
    cancel: () => {
      if (!done) teardown();
    },
    async stop() {
      if (done) throw new Error("Recording already stopped");
      const rate = ctx.sampleRate;
      teardown();
      const blob = encodeWav(chunks, rate);
      if (blob.size < 4096) throw new Error("The recording was empty. Please try again.");
      return new File([blob], "recording.wav", { type: "audio/wav" });
    },
  };
}
