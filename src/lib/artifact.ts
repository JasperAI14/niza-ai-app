// Artifact detection for Smart Copy.
//
// The assistant is instructed to wrap reusable, copy-out output in a marker:
//
//   ::artifact title="Marketing Email" kind="email"
//   ...body...
//   ::end
//
// Markers are authoritative. When they are absent we fall back to a
// deliberately conservative heuristic so ordinary conversation, explanations,
// advice and teaching are NEVER boxed into a Smart Copy card.

export type ArtifactKind =
  | "code"
  | "email"
  | "letter"
  | "post"
  | "document"
  | "prompt"
  | "template"
  | "config"
  | "json"
  | "sql"
  | "resume"
  | "proposal"
  | "writing";

export type Artifact = {
  title: string;
  kind: ArtifactKind;
  body: string;
  /** Fenced-code language when the artifact is a single code block. */
  lang?: string;
};

export type Segment =
  | { type: "text"; text: string }
  | { type: "artifact"; artifact: Artifact };

const MARKER =
  /^::artifact([^\n]*)\n([\s\S]*?)(?:^::end[ \t]*$|$(?![\s\S]))/gm;

const KINDS: ArtifactKind[] = [
  "code", "email", "letter", "post", "document", "prompt",
  "template", "config", "json", "sql", "resume", "proposal", "writing",
];

const KIND_TITLE: Record<ArtifactKind, string> = {
  code: "Code",
  email: "Email",
  letter: "Letter",
  post: "Post",
  document: "Document",
  prompt: "Prompt",
  template: "Template",
  config: "Configuration",
  json: "JSON",
  sql: "SQL Query",
  resume: "Resume",
  proposal: "Proposal",
  writing: "Writing",
};

const LANG_TITLE: Record<string, string> = {
  js: "JavaScript File", javascript: "JavaScript File", jsx: "React Component",
  tsx: "React Component", ts: "TypeScript File", typescript: "TypeScript File",
  python: "Python Script", py: "Python Script", sql: "SQL Query", json: "JSON",
  html: "HTML Page", css: "Stylesheet", scss: "Stylesheet", bash: "Shell Script",
  sh: "Shell Script", go: "Go File", rust: "Rust File", rs: "Rust File",
  java: "Java File", php: "PHP File", ruby: "Ruby Script", rb: "Ruby Script",
  cpp: "C++ File", c: "C File", cs: "C# File", swift: "Swift File",
  kotlin: "Kotlin File", yaml: "YAML Config", yml: "YAML Config", toml: "Config",
  xml: "XML File", markdown: "Document", md: "Document",
};

function attr(raw: string, name: string): string | undefined {
  const m = new RegExp(`${name}\\s*=\\s*"([^"]*)"`).exec(raw);
  return m?.[1]?.trim() || undefined;
}

function titleCase(s: string) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Language of a body that is exactly one fenced code block, else undefined. */
export function singleFenceLang(body: string): string | undefined {
  const m = /^```([\w+#-]*)\n([\s\S]*?)```\s*$/.exec(body.trim());
  return m ? (m[1] || "").toLowerCase() || "text" : undefined;
}

/** Strip a single surrounding code fence, so Copy yields only the code. */
export function stripSingleFence(body: string): string {
  const m = /^```[\w+#-]*\n([\s\S]*?)```\s*$/.exec(body.trim());
  return m ? m[1].replace(/\n$/, "") : body;
}

function inferTitle(body: string, kind: ArtifactKind): string {
  const lang = singleFenceLang(body);
  if (lang && LANG_TITLE[lang]) return LANG_TITLE[lang];
  if (kind === "code" && lang) return `${titleCase(lang)} File`;
  return KIND_TITLE[kind];
}

function normaliseKind(raw?: string, body = ""): ArtifactKind {
  const k = (raw || "").toLowerCase().trim() as ArtifactKind;
  if (KINDS.includes(k)) return k;
  const lang = singleFenceLang(body);
  if (lang === "sql") return "sql";
  if (lang === "json") return "json";
  if (lang) return "code";
  return "writing";
}

/** Remove all artifact markers, leaving plain readable text. */
export function stripMarkers(text: string): string {
  return (text || "")
    .replace(/^::artifact[^\n]*\n/gm, "")
    .replace(/^::end\s*$/gm, "")
    .trim();
}

/**
 * Split an assistant message into plain-text and artifact segments.
 * When no marker is present, returns a single text segment (the fallback
 * heuristic below decides whether the whole message is an artifact).
 */
export function parseSegments(content: string): Segment[] {
  const text = content ?? "";
  const out: Segment[] = [];
  let last = 0;
  MARKER.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MARKER.exec(text)) !== null) {
    const before = text.slice(last, m.index).trim();
    if (before) out.push({ type: "text", text: before });
    const body = m[2].replace(/\n?::end\s*$/, "").trim();
    const kind = normaliseKind(attr(m[1], "kind"), body);
    out.push({
      type: "artifact",
      artifact: {
        title: attr(m[1], "title") || inferTitle(body, kind),
        kind,
        body,
        lang: singleFenceLang(body),
      },
    });
    last = m.index + m[0].length;
  }
  const tail = text.slice(last).trim();
  if (tail) out.push({ type: "text", text: tail });
  return out.length ? out : [{ type: "text", text }];
}

export function hasMarker(content: string): boolean {
  return /^::artifact/m.test(content ?? "");
}

/**
 * Conservative fallback used only when the assistant emitted no marker.
 * True only for output that is clearly a copy-out artifact.
 */
export function looksLikeArtifact(content: string): Artifact | null {
  const t = (content ?? "").trim();
  if (!t) return null;

  // A message that is (essentially) one big fenced code block.
  const fenced = /^```([\w+#-]*)\n([\s\S]*?)```\s*$/.exec(t);
  if (fenced) {
    const lang = (fenced[1] || "text").toLowerCase();
    return {
      title: LANG_TITLE[lang] ?? `${titleCase(lang)} File`,
      kind: lang === "sql" ? "sql" : lang === "json" ? "json" : "code",
      body: t,
      lang,
    };
  }

  // A short lead-in sentence followed by one long fenced block, nothing after.
  const lead = /^([\s\S]{0,180}?)\n+```([\w+#-]*)\n([\s\S]*?)```\s*$/.exec(t);
  if (lead && lead[3].split("\n").length >= 5) {
    const lang = (lead[2] || "text").toLowerCase();
    return {
      title: LANG_TITLE[lang] ?? `${titleCase(lang)} File`,
      kind: lang === "sql" ? "sql" : lang === "json" ? "json" : "code",
      body: "```" + lang + "\n" + lead[3] + "```",
      lang,
    };
  }

  // Emails / letters — recognisable structure, not just length.
  if (/^(subject:|dear\s+[a-z][^\n]{0,60},)/im.test(t) && t.length > 200) {
    return { title: /^subject:/im.test(t) ? "Email" : "Letter", kind: /^subject:/im.test(t) ? "email" : "letter", body: t };
  }

  // Explicit AI prompt / system prompt output.
  if (/^(you are|act as|your task is|system prompt:)/i.test(t) && t.length > 200) {
    return { title: "Prompt", kind: "prompt", body: t };
  }

  // Resume / CV.
  if (/\b(professional summary|work experience|education)\b/i.test(t) && /\b(skills|experience)\b/i.test(t) && t.length > 400) {
    return { title: "Resume", kind: "resume", body: t };
  }

  return null;
}

/** Everything the UI needs for one assistant message. */
export function analyseMessage(content: string): Segment[] {
  if (hasMarker(content)) return parseSegments(content);
  const guess = looksLikeArtifact(content);
  if (guess) return [{ type: "artifact", artifact: guess }];
  return [{ type: "text", text: content ?? "" }];
}

const EXT: Record<string, string> = {
  javascript: "js", js: "js", jsx: "jsx", typescript: "ts", ts: "ts", tsx: "tsx",
  python: "py", py: "py", ruby: "rb", rb: "rb", go: "go", rust: "rs", rs: "rs",
  java: "java", kotlin: "kt", swift: "swift", c: "c", cpp: "cpp", cs: "cs",
  php: "php", sh: "sh", bash: "sh", html: "html", css: "css", scss: "scss",
  json: "json", yaml: "yml", yml: "yml", toml: "toml", xml: "xml", sql: "sql",
  md: "md", markdown: "md",
};

export function artifactExtension(a: Artifact): string {
  if (a.lang && EXT[a.lang]) return EXT[a.lang];
  if (a.kind === "json") return "json";
  if (a.kind === "sql") return "sql";
  if (a.kind === "config") return "txt";
  if (a.kind === "code") return "txt";
  return "md";
}

/** Body to copy or download — code artifacts lose their fence. */
export function artifactPlainBody(a: Artifact): string {
  return a.lang ? stripSingleFence(a.body) : a.body;
}
