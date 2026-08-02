// Intelligent, human-readable filenames derived from what the user asked for.

const STOP = new Set([
  "a","an","the","of","for","to","in","on","with","and","or","my","me","i","you","your",
  "please","can","could","would","make","create","generate","give","write","draw","design",
  "picture","image","photo","that","this","some","it","is","are","be","using","use","about",
  "into","at","by","from","as","new","need","want","show","help","let","us","we","do","does",
]);

const EXT_BY_LANG: Record<string, string> = {
  js: "js", javascript: "js", jsx: "jsx", ts: "ts", typescript: "ts", tsx: "tsx",
  python: "py", py: "py", java: "java", kotlin: "kt", swift: "swift", go: "go",
  rust: "rs", ruby: "rb", php: "php", c: "c", cpp: "cpp", "c++": "cpp", cs: "cs",
  csharp: "cs", html: "html", css: "css", scss: "scss", json: "json", yaml: "yml",
  yml: "yml", sql: "sql", sh: "sh", bash: "sh", shell: "sh", markdown: "md", md: "md",
};

function titleCase(word: string) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/** Build a short, descriptive base name (max ~15 words) from a prompt. */
export function smartBaseName(prompt: string, fallback = "NovaMind Result"): string {
  const cleaned = (prompt || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .toLowerCase();

  const words = cleaned
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => !STOP.has(w) && w.length > 1);

  const picked: string[] = [];
  for (const w of words) {
    if (picked.includes(w)) continue;
    picked.push(w);
    if (picked.length >= 7) break;
  }
  if (!picked.length) return fallback;
  return picked.map(titleCase).join(" ").slice(0, 90);
}

/** Strip characters that break filesystems, keep it readable. */
export function sanitizeFilename(name: string): string {
  return (
    name
      .replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 90) || "NovaMind File"
  );
}

export type AssetKind = "image" | "audio" | "code" | "document" | "text";

export function extensionFor(kind: AssetKind, hint?: string): string {
  if (kind === "image") return hint?.includes("jpeg") ? "jpg" : "png";
  if (kind === "audio") return hint?.includes("wav") ? "wav" : "mp3";
  if (kind === "code") return EXT_BY_LANG[(hint || "").toLowerCase()] ?? "txt";
  if (kind === "document") return "md";
  return "txt";
}

/**
 * Full filename for a download, derived from the user's request.
 * No numbering, no random ids — a descriptive title plus the right extension.
 */
export function smartFilename(opts: {
  prompt?: string;
  kind: AssetKind;
  hint?: string;
  fallback?: string;
}): string {
  const { prompt = "", kind, hint, fallback } = opts;
  const suffixByKind: Record<AssetKind, string> = {
    image: "",
    audio: " Track",
    code: kind === "code" ? " Script" : "",
    document: " Document",
    text: "",
  };
  let base = smartBaseName(prompt, fallback ?? "NovaMind Result");
  const suffix = suffixByKind[kind];
  if (suffix && !base.toLowerCase().includes(suffix.trim().toLowerCase())) base += suffix;
  return `${sanitizeFilename(base)}.${extensionFor(kind, hint)}`;
}

/** Download a blob or URL with an intelligent filename. */
export async function downloadWithSmartName(
  source: Blob | string,
  opts: { prompt?: string; kind: AssetKind; hint?: string; fallback?: string },
) {
  const filename = smartFilename(opts);
  let blob: Blob;
  if (typeof source === "string") {
    const res = await fetch(source, { mode: "cors" });
    blob = await res.blob();
  } else {
    blob = source;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return filename;
}
