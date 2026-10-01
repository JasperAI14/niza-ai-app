// In-browser video editing with FFmpeg (WebAssembly). Browser-only: always import dynamically.
export const MAX_VIDEO_BYTES = 500 * 1024 * 1024; // 500 MB
export const VIDEO_EXT_RE = /\.(mp4|mov|m4v|webm|mkv|avi|3gp)$/i;

export function isAcceptedVideo(file: File): boolean {
  return file.type.startsWith("video/") || VIDEO_EXT_RE.test(file.name);
}

export type VideoEditPlan = {
  args: string[]; // args between input and output
  outExt: "mp4" | "gif";
  summary: string[];
};

function toSeconds(s: string): number {
  const parts = s.split(":").map(Number);
  if (parts.some((n) => Number.isNaN(n))) return NaN;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

const T = String.raw`(\d+(?::\d{1,2}){0,2}(?:\.\d+)?)`;

/** Turn a plain-language instruction into FFmpeg arguments. Returns null if nothing is understood. */
export function planVideoEdit(instruction: string): VideoEditPlan | null {
  const text = instruction.toLowerCase();
  const pre: string[] = [];
  const vf: string[] = [];
  const af: string[] = [];
  const summary: string[] = [];
  let mute = false;
  let outExt: "mp4" | "gif" = "mp4";
  let crf = 26;

  // ---- Trim ----
  const range = new RegExp(String.raw`(?:from|between)\s*${T}\s*(?:s|sec|secs|seconds)?\s*(?:to|and|-|until)\s*${T}`).exec(text);
  const first = new RegExp(String.raw`(?:first|keep(?: only)?(?: the)? first|start(?:ing)? \w+)\s*${T}\s*(?:s|sec|secs|seconds)`).exec(text);
  const last = new RegExp(String.raw`last\s*${T}\s*(?:s|sec|secs|seconds)`).exec(text);
  const startAt = new RegExp(String.raw`(?:start(?:ing)? at|skip(?: the)? first|remove(?: the)? first|cut(?: the)? first)\s*${T}`).exec(text);
  if (range) {
    const a = toSeconds(range[1]);
    const b = toSeconds(range[2]);
    if (b > a) {
      pre.push("-ss", String(a), "-t", String(b - a));
      summary.push(`trimmed to ${range[1]}–${range[2]}`);
    }
  } else if (last) {
    pre.push("-sseof", `-${toSeconds(last[1])}`);
    summary.push(`kept the last ${last[1]} seconds`);
  } else if (startAt) {
    pre.push("-ss", String(toSeconds(startAt[1])));
    summary.push(`removed the first ${startAt[1]} seconds`);
  } else if (first) {
    pre.push("-t", String(toSeconds(first[1])));
    summary.push(`kept the first ${first[1]} seconds`);
  }

  // ---- Rotate / flip ----
  if (/rotate.*(left|counter|anti|-?\s*90\s*(?:degrees)?\s*left|270)/.test(text)) {
    vf.push("transpose=2");
    summary.push("rotated left");
  } else if (/rotate.*180|upside down/.test(text)) {
    vf.push("transpose=1,transpose=1");
    summary.push("rotated 180°");
  } else if (/rotate/.test(text)) {
    vf.push("transpose=1");
    summary.push("rotated right");
  }
  if (/flip.*(vertical|upside)/.test(text)) {
    vf.push("vflip");
    summary.push("flipped vertically");
  } else if (/flip|mirror/.test(text)) {
    vf.push("hflip");
    summary.push("mirrored");
  }

  // ---- Shape / aspect ----
  if (/9\s*:\s*16|vertical|portrait|tiktok|reel|shorts|story/.test(text) && !/flip.*vertical/.test(text)) {
    vf.push("crop='min(iw,ih*9/16)':'min(ih,iw*16/9)'");
    summary.push("cropped to 9:16");
  } else if (/1\s*:\s*1|square/.test(text)) {
    vf.push("crop='min(iw,ih)':'min(iw,ih)'");
    summary.push("cropped to square");
  } else if (/16\s*:\s*9|landscape|widescreen|youtube/.test(text)) {
    vf.push("crop='min(iw,ih*16/9)':'min(ih,iw*9/16)'");
    summary.push("cropped to 16:9");
  } else if (/4\s*:\s*5/.test(text)) {
    vf.push("crop='min(iw,ih*4/5)':'min(ih,iw*5/4)'");
    summary.push("cropped to 4:5");
  }

  // ---- Look ----
  if (/black and white|black & white|grayscale|greyscale|b&w|monochrome/.test(text)) {
    vf.push("hue=s=0");
    summary.push("made black and white");
  }
  if (/bright(er|en)/.test(text)) {
    vf.push("eq=brightness=0.08");
    summary.push("brightened");
  }
  if (/dark(er|en)/.test(text)) {
    vf.push("eq=brightness=-0.08");
    summary.push("darkened");
  }
  if (/reverse|backwards/.test(text)) {
    vf.push("reverse");
    af.push("areverse");
    summary.push("reversed");
  }

  // ---- Speed ----
  let speed = 0;
  const sx = /(\d+(?:\.\d+)?)\s*x\b/.exec(text);
  if (sx && /speed|fast|slow|x\b/.test(text)) speed = Number(sx[1]);
  else if (/slow ?mo|slow motion|slow( it)? down|slower/.test(text)) speed = 0.5;
  else if (/speed( it)? up|faster|fast forward|timelapse/.test(text)) speed = 2;
  if (speed > 0 && speed !== 1 && speed >= 0.25 && speed <= 4) {
    vf.push(`setpts=PTS/${speed}`);
    let s = speed;
    while (s > 2) {
      af.push("atempo=2");
      s /= 2;
    }
    while (s < 0.5) {
      af.push("atempo=0.5");
      s /= 0.5;
    }
    af.push(`atempo=${s}`);
    summary.push(`changed speed to ${speed}×`);
  }

  // ---- Audio ----
  if (/mute|no sound|remove (the )?(audio|sound)|without (audio|sound)|silent/.test(text)) {
    mute = true;
    summary.push("removed the audio");
  }

  // ---- Size / format ----
  if (/compress|smaller|reduce (the )?size|shrink|720p|lower quality/.test(text)) {
    vf.push("scale='min(1280,iw)':-2");
    crf = 32;
    summary.push("compressed");
  }
  if (/\bgif\b/.test(text)) {
    outExt = "gif";
    summary.push("converted to GIF");
  }
  if (/convert|mp4|re-?encode/.test(text) && summary.length === 0) {
    summary.push("converted to MP4");
  }

  if (summary.length === 0) return null;

  const args: string[] = [...pre];
  if (outExt === "gif") {
    vf.push("fps=12", "scale='min(480,iw)':-2:flags=lanczos");
    args.push("-vf", vf.join(","), "-an", "-loop", "0");
  } else {
    if (vf.length) args.push("-vf", vf.join(","));
    if (mute) args.push("-an");
    else {
      if (af.length) args.push("-af", af.join(","));
      args.push("-c:a", "aac", "-b:a", "128k");
    }
    args.push("-c:v", "libx264", "-preset", "ultrafast", "-crf", String(crf), "-pix_fmt", "yuv420p", "-movflags", "+faststart");
  }
  return { args, outExt, summary };
}

let ffmpegPromise: Promise<any> | null = null;
let progressCb: ((p: number) => void) | null = null;

async function getFFmpeg() {
  if (!ffmpegPromise) {
    ffmpegPromise = (async () => {
      const { FFmpeg } = await import("@ffmpeg/ffmpeg");
      const { toBlobURL } = await import("@ffmpeg/util");
      const ff = new FFmpeg();
      ff.on("progress", ({ progress }: { progress: number }) => {
        progressCb?.(Math.max(0, Math.min(1, progress)));
      });
      const base = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm";
      await ff.load({
        coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, "application/wasm"),
      });
      return ff;
    })().catch((e) => {
      ffmpegPromise = null;
      throw e;
    });
  }
  return ffmpegPromise;
}

export async function runVideoEdit(
  file: Blob,
  inputName: string,
  plan: VideoEditPlan,
  onProgress?: (stage: string, pct: number) => void,
): Promise<Blob> {
  onProgress?.("Loading video editor…", 0);
  const ff = await getFFmpeg();
  const { fetchFile } = await import("@ffmpeg/util");
  const ext = (VIDEO_EXT_RE.exec(inputName)?.[1] ?? "mp4").toLowerCase();
  const inName = `in.${ext}`;
  const outName = `out.${plan.outExt}`;
  await ff.writeFile(inName, await fetchFile(file));
  progressCb = (p) => onProgress?.("Editing your video…", Math.round(p * 100));
  try {
    const code = await ff.exec(["-i", inName, ...plan.args, "-y", outName]);
    if (code !== 0) throw new Error("The video could not be processed with that edit.");
    const data = (await ff.readFile(outName)) as Uint8Array;
    if (!data || data.byteLength === 0) throw new Error("The edit produced an empty video.");
    return new Blob([data as BlobPart], { type: plan.outExt === "gif" ? "image/gif" : "video/mp4" });
  } finally {
    progressCb = null;
    try {
      await ff.deleteFile(inName);
      await ff.deleteFile(outName);
    } catch {
      // ignore
    }
  }
}

export const VIDEO_HELP =
  "I can edit this video for you. Try things like: **trim from 0:05 to 0:20**, **keep the first 10 seconds**, **rotate right**, **mute**, **speed up 2x**, **slow motion**, **make it 9:16 / square**, **black and white**, **reverse**, **compress**, or **convert to GIF**.";
