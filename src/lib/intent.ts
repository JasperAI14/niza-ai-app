// Detect whether a user message is requesting an image.
// Returns the cleaned image prompt if so, otherwise null.
const VERB_PATTERNS = [
  /\b(generate|create|make|draw|paint|design|render|produce|give\s+me)\s+(?:an?\s+|some\s+)?(image|picture|photo|pic|illustration|drawing|painting|artwork|art|logo|wallpaper|poster|sketch|render|portrait|scene|icon)s?\b/i,
  /\bimagine\b/i,
  /\bvisuali[sz]e\b/i,
  /\b(?:a|an)\s+(image|picture|photo|illustration|drawing|painting|artwork|logo|poster|sketch|render)\s+of\b/i,
  /\b(show|draw)\s+me\s+(?:an?\s+|a\s+)?(image|picture|photo|pic|illustration|drawing|scene)\b/i,
];

export function detectImageRequest(text: string): string | null {
  const t = text.trim();
  if (!t) return null;
  for (const re of VERB_PATTERNS) {
    if (re.test(t)) return t;
  }
  return null;
}
