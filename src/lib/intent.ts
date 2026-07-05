// Detect whether a user message is requesting an image (generation).
// Returns the cleaned image prompt if so, otherwise null.
const VERB_PATTERNS = [
  /\b(generate|create|make|draw|paint|design|render|produce|sketch|compose|give\s+me)\s+(?:me\s+)?(?:an?\s+|some\s+|a\s+couple\s+of\s+|two\s+|2\s+)?(image|images|picture|pictures|photo|photos|pic|pics|illustration|illustrations|drawing|drawings|painting|paintings|artwork|art|logo|logos|wallpaper|wallpapers|poster|posters|sketch|render|portrait|scene|icon|icons|graphic|graphics|banner|thumbnail|avatar|mockup)\b/i,
  /\b(imagine|visuali[sz]e)\b/i,
  /\b(?:an?|the|some)\s+(image|picture|photo|illustration|drawing|painting|artwork|logo|poster|sketch|render|portrait|scene|graphic|banner|wallpaper|mockup)\s+(of|showing|depicting|with|featuring)\b/i,
  /\b(show|draw|paint)\s+me\s+(?:an?\s+|a\s+)?(image|picture|photo|pic|illustration|drawing|scene|portrait)\b/i,
  /\b(picture|photo|image|illustration|drawing|painting|art|logo|wallpaper|poster)\s+of\s+/i,
  /^\s*(draw|paint|sketch|illustrate|render)\s+/i,
];

export function detectImageRequest(text: string): string | null {
  const t = text.trim();
  if (!t) return null;
  for (const re of VERB_PATTERNS) {
    if (re.test(t)) return t;
  }
  return null;
}

// Detect whether a prompt (with an attached image) is asking to EDIT the image
// vs. asking to analyze/describe/answer questions about it.
const EDIT_PATTERNS = [
  /\b(edit|modify|change|adjust|alter|transform|convert|turn\s+(?:it|this)\s+into)\b/i,
  /\b(remove|erase|delete|get\s+rid\s+of)\b/i,
  /\b(add|insert|put)\s+(?:a|an|some|the)?/i,
  /\b(replace|swap|switch)\b/i,
  /\b(make\s+(?:it|this|the))\b/i,
  /\b(background|bg)\b.*\b(remove|replace|change|blur|transparent)\b/i,
  /\b(upscale|enhance|improve|sharpen|denoise|restore|colori[sz]e)\b/i,
  /\b(outpaint|inpaint|expand|extend|fill)\b/i,
  /\b(anime|cartoon|realistic|painting|sketch|3d|pixel\s*art|oil\s*painting|watercolor)\s*(style|version)?\b/i,
  /\b(recolor|change\s+color|different\s+color)\b/i,
  /\b(crop|resize)\b/i,
  /\b(add|remove)\s+text\b/i,
];

export function detectImageEdit(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return EDIT_PATTERNS.some((re) => re.test(t));
}

// Detect whether an assistant response is "reusable content" worth surfacing a Copy button for.
// True when the message is long OR contains code / structured content.
export function isReusableContent(text: string): boolean {
  if (!text) return false;
  if (/```/.test(text)) return true;
  if (text.length >= 240) return true;
  // Markdown lists or numbered lists spanning multiple lines
  const lines = text.split("\n");
  const listy = lines.filter((l) => /^\s*(?:[-*+]\s|\d+\.\s)/.test(l)).length;
  if (listy >= 3) return true;
  // Multiple paragraphs
  if ((text.match(/\n\s*\n/g) ?? []).length >= 2) return true;
  return false;
}

// Stricter: should this response be surfaced as a collapsed "copy card"
// (ChatGPT-style expandable block) instead of a normal chat bubble?
export function shouldUseCopyCard(text: string): boolean {
  if (!text) return false;
  if (/```[\s\S]*?```/.test(text)) return true; // any code block
  if (text.length >= 500) return true;
  const lines = text.split("\n");
  const listy = lines.filter((l) => /^\s*(?:[-*+]\s|\d+\.\s)/.test(l)).length;
  if (listy >= 4) return true;
  // multi-heading guide
  const headings = lines.filter((l) => /^#{1,3}\s/.test(l)).length;
  if (headings >= 2) return true;
  return false;
}

export function copyCardTitle(text: string): "Code" | "Guide" | "Prompt" | "Writing" {
  const t = text.trim();
  if (/```/.test(t)) return "Code";
  if (/^(you are|act as|imagine you are|pretend you are|your task is|write a prompt)/i.test(t)) return "Prompt";
  if (/^#{1,3}\s/m.test(t)) return "Guide";
  // numbered step-by-step
  const stepLines = t.split("\n").filter((l) => /^\s*(?:\d+\.\s|step\s+\d)/i.test(l)).length;
  if (stepLines >= 3) return "Guide";
  return "Writing";
}
